/**
 * テナント管理 API
 * 本家: /app/api/tenants.py
 */
const { Router } = require('express');
const store = require('../store');

const router = Router();

// GET /api/tenants - テナント一覧
router.get('/', (req, res) => {
  const { status, limit, offset } = req.query;
  const items = store.listTenants({
    status,
    limit: parseInt(limit) || 100,
    offset: parseInt(offset) || 0,
  });
  res.json(items);
});

// POST /api/tenants - テナント作成
router.post('/', (req, res) => {
  const { tenant_id, system_prompt, model_id } = req.body;
  if (!tenant_id) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'tenant_id は必須です。',
        details: [{ field: 'tenant_id', message: 'この項目は必須です', code: 'required' }],
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  if (store.getTenant(tenant_id)) {
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: `テナント ${tenant_id} は既に存在します。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  const tenant = store.createTenant({ tenant_id, system_prompt, model_id });
  res.status(201).json(tenant);
});

// GET /api/tenants/:tenant_id - テナント取得
router.get('/:tenant_id', (req, res) => {
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
  res.json(tenant);
});

// PUT /api/tenants/:tenant_id - テナント更新
router.put('/:tenant_id', (req, res) => {
  const tenant = store.updateTenant(req.params.tenant_id, req.body);
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
  res.json(tenant);
});

// DELETE /api/tenants/:tenant_id - テナント削除
router.delete('/:tenant_id', (req, res) => {
  const deleted = store.deleteTenant(req.params.tenant_id);
  if (!deleted) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `テナント ${req.params.tenant_id} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  res.status(204).end();
});

module.exports = router;
