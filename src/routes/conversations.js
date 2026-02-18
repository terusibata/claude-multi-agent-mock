/**
 * 会話 API (CRUD + ストリーミング)
 * 本家: /app/api/conversations/router.py, streaming.py
 */
const { Router } = require('express');
const multer = require('multer');
const store = require('../store');
const { simulateAgentStream } = require('../utils/agentMock');
const { getSampleFile } = require('../utils/sampleFiles');

const router = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/tenants/:tenant_id/conversations - 会話一覧
router.get('/', (req, res) => {
  const { user_id, status, from_date, to_date, limit, offset } = req.query;
  const result = store.listConversations(req.params.tenant_id, {
    user_id,
    status,
    from_date,
    to_date,
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
  });
  res.json(result);
});

// POST /api/tenants/:tenant_id/conversations - 会話作成
router.post('/', (req, res) => {
  const { user_id, model_id, workspace_enabled } = req.body || {};
  if (!user_id) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'user_id は必須です。',
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  const tenant = store.getTenant(req.params.tenant_id);
  if (!tenant) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `テナント ${req.params.tenant_id} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  const conv = store.createConversation({
    tenant_id: req.params.tenant_id,
    user_id,
    model_id,
    workspace_enabled: workspace_enabled !== false,
  });

  // 初期メッセージログ
  store.addMessageLog(conv.conversation_id, {
    message_type: 'system',
    message_subtype: 'init',
    content: { system_prompt: tenant.system_prompt },
  });

  res.status(201).json(conv);
});

// GET /api/tenants/:tenant_id/conversations/:conversation_id - 会話取得
router.get('/:conversation_id', (req, res) => {
  const conv = store.getConversation(req.params.conversation_id);
  if (!conv || conv.tenant_id !== req.params.tenant_id) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `会話 ${req.params.conversation_id} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  res.json(conv);
});

// PUT /api/tenants/:tenant_id/conversations/:conversation_id - 会話更新
router.put('/:conversation_id', (req, res) => {
  const conv = store.getConversation(req.params.conversation_id);
  if (!conv || conv.tenant_id !== req.params.tenant_id) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `会話 ${req.params.conversation_id} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  const { title, status } = req.body || {};
  const updated = store.updateConversation(req.params.conversation_id, { title, status });
  res.json(updated);
});

// POST /api/tenants/:tenant_id/conversations/:conversation_id/archive - アーカイブ
router.post('/:conversation_id/archive', (req, res) => {
  const conv = store.getConversation(req.params.conversation_id);
  if (!conv || conv.tenant_id !== req.params.tenant_id) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `会話 ${req.params.conversation_id} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  const updated = store.updateConversation(req.params.conversation_id, { status: 'archived' });
  res.json(updated);
});

// DELETE /api/tenants/:tenant_id/conversations/:conversation_id - 会話削除
router.delete('/:conversation_id', (req, res) => {
  const conv = store.getConversation(req.params.conversation_id);
  if (!conv || conv.tenant_id !== req.params.tenant_id) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `会話 ${req.params.conversation_id} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  store.deleteConversation(req.params.conversation_id);
  res.status(204).end();
});

// GET /api/tenants/:tenant_id/conversations/:conversation_id/messages - メッセージログ取得
router.get('/:conversation_id/messages', (req, res) => {
  const conv = store.getConversation(req.params.conversation_id);
  if (!conv || conv.tenant_id !== req.params.tenant_id) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `会話 ${req.params.conversation_id} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  const messages = store.getMessageLogs(req.params.conversation_id);
  res.json(messages);
});

// POST /api/tenants/:tenant_id/conversations/:conversation_id/stream - ストリーミング実行
router.post('/:conversation_id/stream', upload.array('files', 10), async (req, res) => {
  const conv = store.getConversation(req.params.conversation_id);
  if (!conv || conv.tenant_id !== req.params.tenant_id) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `会話 ${req.params.conversation_id} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }

  // multipart/form-data から request_data をパース
  let requestData;
  try {
    requestData = JSON.parse(req.body.request_data || '{}');
  } catch {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'request_data のJSONパースに失敗しました。',
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }

  const { user_input, executor } = requestData;
  if (!user_input || !executor) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'user_input と executor は必須です。',
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }

  // アップロードファイルをワークスペースに追加
  if (req.files && req.files.length > 0) {
    let fileMetadata = [];
    try {
      fileMetadata = JSON.parse(req.body.file_metadata || '[]');
    } catch { /* ignore */ }

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const meta = fileMetadata[i] || {};
      store.addConversationFile(req.params.conversation_id, {
        file_path: meta.relative_path || file.originalname,
        original_name: meta.original_name || file.originalname,
        file_size: file.size,
        mime_type: file.mimetype,
        source: 'user_upload',
        _content: file.buffer,
      });
    }
  }

  // ユーザーメッセージログ
  store.addMessageLog(req.params.conversation_id, {
    message_type: 'user',
    message_subtype: 'text',
    content: { text: user_input },
  });

  // SSEヘッダー設定
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  try {
    await simulateAgentStream(res, {
      conversationId: req.params.conversation_id,
      userInput: user_input,
      model: conv.model_id,
      sessionId: conv.session_id,
      tenantId: req.params.tenant_id,
      userId: executor.user_id,
    });
  } catch (err) {
    const errPayload = JSON.stringify({
      seq: 999,
      timestamp: new Date().toISOString(),
      error_type: 'INTERNAL_ERROR',
      message: `ストリーミング中にエラーが発生しました: ${err.message}`,
      recoverable: false,
    });
    res.write(`event: error\ndata: ${errPayload}\n\n`);
  }

  res.end();
});

module.exports = router;
