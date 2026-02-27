/**
 * MCPサーバー管理 API
 * 本家: /app/api/mcp_servers.py
 */
const { Router } = require('express');
const store = require('../store');
const { createErrorResponse } = require('../utils/errorResponse');

const router = Router({ mergeParams: true });

// GET /api/tenants/:tenant_id/mcp-servers - MCP一覧
router.get('/', (req, res) => {
  const { status, limit, offset } = req.query;
  const result = store.listMcpServers(req.params.tenant_id, {
    status,
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
  });
  res.json(result);
});

// GET /api/tenants/:tenant_id/mcp-servers/:server_id - MCP取得
router.get('/:server_id', (req, res) => {
  const server = store.getMcpServer(req.params.server_id);
  if (!server || server.tenant_id !== req.params.tenant_id) {
    return res.status(404).json(createErrorResponse(req, 'NOT_FOUND', `MCPサーバー ${req.params.server_id} が見つかりません。`));
  }
  res.json(server);
});

// POST /api/tenants/:tenant_id/mcp-servers - MCP作成
router.post('/', (req, res) => {
  const { name, openapi_spec } = req.body || {};
  if (!name || !openapi_spec) {
    return res.status(422).json(createErrorResponse(req, 'VALIDATION_ERROR', 'name と openapi_spec は必須です。'));
  }
  const server = store.createMcpServer(req.params.tenant_id, req.body);
  res.status(201).json(server);
});

// PUT /api/tenants/:tenant_id/mcp-servers/:server_id - MCP更新
router.put('/:server_id', (req, res) => {
  const server = store.getMcpServer(req.params.server_id);
  if (!server || server.tenant_id !== req.params.tenant_id) {
    return res.status(404).json(createErrorResponse(req, 'NOT_FOUND', `MCPサーバー ${req.params.server_id} が見つかりません。`));
  }
  const updated = store.updateMcpServer(req.params.server_id, req.body);
  res.json(updated);
});

// DELETE /api/tenants/:tenant_id/mcp-servers/:server_id - MCP削除
router.delete('/:server_id', (req, res) => {
  const server = store.getMcpServer(req.params.server_id);
  if (!server || server.tenant_id !== req.params.tenant_id) {
    return res.status(404).json(createErrorResponse(req, 'NOT_FOUND', `MCPサーバー ${req.params.server_id} が見つかりません。`));
  }
  store.deleteMcpServer(req.params.server_id);
  res.status(204).end();
});

module.exports = router;
