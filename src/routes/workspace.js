/**
 * ワークスペース・ファイル API
 * 本家: /app/api/workspace.py
 */
const { Router } = require('express');
const path = require('path');
const store = require('../store');
const { getSampleFile } = require('../utils/sampleFiles');

const router = Router({ mergeParams: true });

// GET /api/tenants/:tenant_id/conversations/:conversation_id/files - ファイル一覧
router.get('/:conversation_id/files', (req, res) => {
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

  const files = store.getConversationFiles(req.params.conversation_id);
  res.json({
    conversation_id: req.params.conversation_id,
    workspace_enabled: conv.workspace_enabled,
    files,
    total: files.length,
  });
});

// GET /api/tenants/:tenant_id/conversations/:conversation_id/files/download - ファイルダウンロード
router.get('/:conversation_id/files/download', (req, res) => {
  const { path: filePath } = req.query;
  if (!filePath) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'path クエリパラメータは必須です。',
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }

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

  // パストラバーサル防止
  const normalized = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  if (normalized !== filePath && !filePath.startsWith('/')) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: '不正なファイルパスです。',
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }

  const file = store.getConversationFile(req.params.conversation_id, filePath);
  if (!file) {
    // ファイルが見つからない場合、サンプルを生成して返す
    const filename = path.basename(filePath);
    const sample = getSampleFile(filename);
    res.setHeader('Content-Type', sample.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    return res.send(sample.content);
  }

  // ストアに実コンテンツがある場合
  const content = file._content;
  if (content) {
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name || path.basename(filePath))}`);
    return res.send(content);
  }

  // コンテンツがない場合はサンプル生成
  const filename = path.basename(filePath);
  const sample = getSampleFile(filename);
  res.setHeader('Content-Type', sample.mime_type);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.send(sample.content);
});

// GET /api/tenants/:tenant_id/conversations/:conversation_id/files/presented - 提示ファイル一覧
router.get('/:conversation_id/files/presented', (req, res) => {
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

  const files = store.getPresentedFiles(req.params.conversation_id);
  res.json({
    conversation_id: req.params.conversation_id,
    files,
    total: files.length,
  });
});

module.exports = router;
