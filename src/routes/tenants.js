/**
 * テナント管理 API
 * 本家: /app/api/tenants.py
 */
const { Router } = require('express');
const store = require('../store');
const { createErrorResponse } = require('../utils/errorResponse');

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
  const { tenant_id, system_prompt, model_id } = req.body || {};
  if (!tenant_id) {
    return res.status(422).json(createErrorResponse(req, 'VALIDATION_ERROR', 'tenant_id は必須です。', [
      { field: 'tenant_id', message: 'この項目は必須です', code: 'required' },
    ]));
  }
  if (store.getTenant(tenant_id)) {
    return res.status(409).json(createErrorResponse(req, 'CONFLICT', `テナント ${tenant_id} は既に存在します。`));
  }
  const tenant = store.createTenant({ tenant_id, system_prompt, model_id });
  res.status(201).json(tenant);
});

// GET /api/tenants/:tenant_id - テナント取得
router.get('/:tenant_id', (req, res) => {
  const tenant = store.getTenant(req.params.tenant_id);
  if (!tenant) {
    return res.status(404).json(createErrorResponse(req, 'NOT_FOUND', `テナント ${req.params.tenant_id} が見つかりません。`));
  }
  res.json(tenant);
});

// PUT /api/tenants/:tenant_id - テナント更新
router.put('/:tenant_id', (req, res) => {
  const tenant = store.updateTenant(req.params.tenant_id, req.body);
  if (!tenant) {
    return res.status(404).json(createErrorResponse(req, 'NOT_FOUND', `テナント ${req.params.tenant_id} が見つかりません。`));
  }
  res.json(tenant);
});

// DELETE /api/tenants/:tenant_id - テナント削除
router.delete('/:tenant_id', (req, res) => {
  const deleted = store.deleteTenant(req.params.tenant_id);
  if (!deleted) {
    return res.status(404).json(createErrorResponse(req, 'NOT_FOUND', `テナント ${req.params.tenant_id} が見つかりません。`));
  }
  res.status(204).end();
});

module.exports = router;
