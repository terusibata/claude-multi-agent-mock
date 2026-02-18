/**
 * モデル管理 API
 * 本家: /app/api/models.py
 */
const { Router } = require('express');
const store = require('../store');

const router = Router();

// GET /api/models - モデル一覧
router.get('/', (req, res) => {
  const { status } = req.query;
  const items = store.listModels({ status });
  res.json(items);
});

// GET /api/models/:model_id - モデル取得
router.get('/:model_id', (req, res) => {
  const model = store.getModel(req.params.model_id);
  if (!model) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `モデル ${req.params.model_id} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  res.json(model);
});

// POST /api/models - モデル作成
router.post('/', (req, res) => {
  const { model_id, bedrock_model_id } = req.body;
  if (!model_id || !bedrock_model_id) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'model_id と bedrock_model_id は必須です。',
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  if (store.getModel(model_id)) {
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: `モデル ${model_id} は既に存在します。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  const model = store.createModel(req.body);
  res.status(201).json(model);
});

// PUT /api/models/:model_id - モデル更新
router.put('/:model_id', (req, res) => {
  const model = store.updateModel(req.params.model_id, req.body);
  if (!model) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `モデル ${req.params.model_id} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  res.json(model);
});

// PATCH /api/models/:model_id/status - モデルステータス更新
router.patch('/:model_id/status', (req, res) => {
  const { status } = req.query;
  if (!status || !['active', 'deprecated'].includes(status)) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'status は active または deprecated を指定してください。',
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  const model = store.updateModel(req.params.model_id, { status });
  if (!model) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `モデル ${req.params.model_id} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  res.json(model);
});

// DELETE /api/models/:model_id - モデル削除
router.delete('/:model_id', (req, res) => {
  const deleted = store.deleteModel(req.params.model_id);
  if (!deleted) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `モデル ${req.params.model_id} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  res.status(204).end();
});

module.exports = router;
