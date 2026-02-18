/**
 * MCPサーバー管理 API
 * 本家: /app/api/mcp_servers.py
 */
const { Router } = require('express');
const store = require('../store');

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

// GET /api/tenants/:tenant_id/mcp-servers/builtin - ビルトインMCPサーバー
router.get('/builtin', (req, res) => {
  res.json({
    builtin_servers: [
      {
        name: 'file-tools',
        display_name: 'ファイル操作ツール',
        description: 'ワークスペース内のファイル読み取り・書き込み・編集・削除',
        tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
        status: 'active',
      },
    ],
  });
});

// GET /api/tenants/:tenant_id/mcp-servers/:server_id - MCP取得
router.get('/:server_id', (req, res) => {
  const server = store.getMcpServer(req.params.server_id);
  if (!server || server.tenant_id !== req.params.tenant_id) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `MCPサーバー ${req.params.server_id} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  res.json(server);
});

// POST /api/tenants/:tenant_id/mcp-servers - MCP作成
router.post('/', (req, res) => {
  const { name, openapi_spec } = req.body;
  if (!name || !openapi_spec) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'name と openapi_spec は必須です。',
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  const server = store.createMcpServer(req.params.tenant_id, req.body);
  res.status(201).json(server);
});

// PUT /api/tenants/:tenant_id/mcp-servers/:server_id - MCP更新
router.put('/:server_id', (req, res) => {
  const server = store.getMcpServer(req.params.server_id);
  if (!server || server.tenant_id !== req.params.tenant_id) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `MCPサーバー ${req.params.server_id} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  const updated = store.updateMcpServer(req.params.server_id, req.body);
  res.json(updated);
});

// DELETE /api/tenants/:tenant_id/mcp-servers/:server_id - MCP削除
router.delete('/:server_id', (req, res) => {
  const server = store.getMcpServer(req.params.server_id);
  if (!server || server.tenant_id !== req.params.tenant_id) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `MCPサーバー ${req.params.server_id} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  store.deleteMcpServer(req.params.server_id);
  res.status(204).end();
});

module.exports = router;
