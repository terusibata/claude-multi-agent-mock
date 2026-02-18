/**
 * シンプルチャット API
 * 本家: /app/api/simple_chats/router.py, streaming.py
 */
const { Router } = require('express');
const store = require('../store');
const { simulateSimpleChatStream } = require('../utils/agentMock');

const router = Router({ mergeParams: true });

// GET /api/tenants/:tenant_id/simple-chats - チャット一覧
router.get('/', (req, res) => {
  const { user_id, application_type, status, limit, offset } = req.query;
  const result = store.listSimpleChats(req.params.tenant_id, {
    user_id,
    application_type,
    status,
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
  });
  res.json(result);
});

// GET /api/tenants/:tenant_id/simple-chats/:chat_id - チャット取得
router.get('/:chat_id', (req, res) => {
  const chat = store.getSimpleChat(req.params.chat_id);
  if (!chat || chat.tenant_id !== req.params.tenant_id) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `チャット ${req.params.chat_id} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  const messages = store.getSimpleChatMessages(req.params.chat_id);
  res.json({ ...chat, messages });
});

// POST /api/tenants/:tenant_id/simple-chats/:chat_id/archive - アーカイブ
router.post('/:chat_id/archive', (req, res) => {
  const chat = store.getSimpleChat(req.params.chat_id);
  if (!chat || chat.tenant_id !== req.params.tenant_id) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `チャット ${req.params.chat_id} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  const updated = store.simpleChats.get(req.params.chat_id);
  updated.status = 'archived';
  updated.updated_at = new Date().toISOString();
  res.json(updated);
});

// DELETE /api/tenants/:tenant_id/simple-chats/:chat_id - チャット削除
router.delete('/:chat_id', (req, res) => {
  const chat = store.getSimpleChat(req.params.chat_id);
  if (!chat || chat.tenant_id !== req.params.tenant_id) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `チャット ${req.params.chat_id} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  store.deleteSimpleChat(req.params.chat_id);
  res.status(204).end();
});

// POST /api/tenants/:tenant_id/simple-chats/stream - ストリーミング
router.post('/stream', async (req, res) => {
  const {
    chat_id,
    user_id,
    application_type,
    system_prompt,
    model_id,
    message,
  } = req.body;

  if (!message) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'message は必須です。',
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }

  let chat;

  // 既存チャットの継続
  if (chat_id) {
    chat = store.getSimpleChat(chat_id);
    if (!chat || chat.tenant_id !== req.params.tenant_id) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `チャット ${chat_id} が見つかりません。`,
          request_id: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    }
  } else {
    // 新規チャット作成
    if (!user_id || !application_type || !model_id) {
      return res.status(422).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: '新規チャットの場合、user_id, application_type, model_id は必須です。',
          request_id: req.headers['x-request-id'],
          timestamp: new Date().toISOString(),
        },
      });
    }
    chat = store.createSimpleChat({
      tenant_id: req.params.tenant_id,
      user_id,
      application_type,
      system_prompt: system_prompt || null,
      model_id,
    });
  }

  // ユーザーメッセージ記録
  store.addSimpleChatMessage(chat.chat_id, {
    role: 'user',
    content: message,
  });

  // SSEヘッダー
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'X-Chat-ID': chat.chat_id,
  });

  try {
    const result = await simulateSimpleChatStream(res, {
      chatId: chat.chat_id,
      message,
      applicationContext: chat.application_type,
    });

    // アシスタントメッセージ記録
    store.addSimpleChatMessage(chat.chat_id, {
      role: 'assistant',
      content: result.fullText,
    });

    // タイトル設定（初回のみ）
    if (!chat.title) {
      const title = message.slice(0, 30);
      const c = store.simpleChats.get(chat.chat_id);
      if (c) {
        c.title = title;
        c.updated_at = new Date().toISOString();
      }
    }
  } catch (err) {
    const errPayload = JSON.stringify({
      seq: 999,
      timestamp: new Date().toISOString(),
      event_type: 'error',
      message: `ストリーミング中にエラーが発生しました: ${err.message}`,
    });
    res.write(`event: error\ndata: ${errPayload}\n\n`);
  }

  res.end();
});

module.exports = router;
