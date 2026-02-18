/**
 * claude-multi-agent モックサーバー
 *
 * 本家 (Python/FastAPI) の全APIエンドポイントをNode.js/Expressで忠実に再現。
 * データはすべてインメモリ保持。
 * AIエージェントの応答はランダムなシナリオで日本語生成。
 */
const express = require('express');
const cors = require('cors');

const authMiddleware = require('./middleware/auth');
const securityHeaders = require('./middleware/security');

const healthRouter = require('./routes/health');
const tenantsRouter = require('./routes/tenants');
const modelsRouter = require('./routes/models');
const conversationsRouter = require('./routes/conversations');
const simpleChatsRouter = require('./routes/simpleChats');
const skillsRouter = require('./routes/skills');
const mcpServersRouter = require('./routes/mcpServers');
const usageRouter = require('./routes/usage');
const workspaceRouter = require('./routes/workspace');

const store = require('./store');

const app = express();
const PORT = process.env.APP_PORT || 8000;

// ========= ミドルウェア =========
app.use(securityHeaders);
app.use(cors({
  origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'X-Tenant-ID', 'X-User-ID', 'X-Admin-ID', 'X-Request-ID', 'Authorization'],
  exposedHeaders: ['X-Request-ID', 'X-Chat-ID'],
}));
app.use(express.json());
app.use(authMiddleware);

// ========= ルート登録 =========
// 本家と同じパスプレフィックス

// ルートエンドポイント (認証不要 - middleware でスキップ済み)
app.get('/', (req, res) => {
  res.json({
    name: 'AIエージェントバックエンド',
    version: '1.0.0-mock',
    docs_url: null,
  });
});

// ヘルスチェック (認証不要 - middleware でスキップ済み)
app.use('/health', healthRouter);

// メトリクス (モック)
app.get('/metrics', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(`# HELP mock_uptime_seconds Mock server uptime
# TYPE mock_uptime_seconds gauge
mock_uptime_seconds ${Math.floor(process.uptime())}
# HELP mock_store_tenants_total Total tenants
# TYPE mock_store_tenants_total gauge
mock_store_tenants_total ${store.tenants.size}
# HELP mock_store_conversations_total Total conversations
# TYPE mock_store_conversations_total gauge
mock_store_conversations_total ${store.conversations.size}
`);
});

// テナント管理
app.use('/api/tenants', tenantsRouter);

// モデル管理
app.use('/api/models', modelsRouter);

// 会話 (CRUD + ストリーミング)
app.use('/api/tenants/:tenant_id/conversations', conversationsRouter);

// シンプルチャット
app.use('/api/tenants/:tenant_id/simple-chats', simpleChatsRouter);

// Skills
app.use('/api/tenants/:tenant_id/skills', skillsRouter);

// MCPサーバー
app.use('/api/tenants/:tenant_id/mcp-servers', mcpServersRouter);

// 使用状況・コストレポート
app.use('/api/tenants/:tenant_id', usageRouter);

// ワークスペース・ファイル
app.use('/api/tenants/:tenant_id/conversations', workspaceRouter);

// ========= エラーハンドリング =========

// 404
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `エンドポイント ${req.method} ${req.path} は存在しません。`,
      request_id: req.headers['x-request-id'] || null,
      timestamp: new Date().toISOString(),
    },
  });
});

// グローバルエラーハンドラ
app.use((err, req, res, _next) => {
  console.error(`[ERROR] ${err.stack || err.message}`);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'サーバー内部エラーが発生しました。',
      request_id: req.headers['x-request-id'] || null,
      timestamp: new Date().toISOString(),
    },
  });
});

// ========= 初期データ投入 =========
function seedData() {
  // モデル
  store.createModel({
    model_id: 'claude-sonnet-4',
    display_name: 'Claude Sonnet 4',
    bedrock_model_id: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
    model_region: 'us-west-2',
    input_token_price: '0.003',
    output_token_price: '0.015',
    cache_creation_5m_price: '0.00375',
    cache_creation_1h_price: '0.003',
    cache_read_price: '0.0003',
    context_window: 200000,
    max_output_tokens: 64000,
    supports_extended_context: false,
  });

  store.createModel({
    model_id: 'claude-haiku-4',
    display_name: 'Claude Haiku 4',
    bedrock_model_id: 'global.anthropic.claude-haiku-4-5-20251001-v1:0',
    model_region: 'us-west-2',
    input_token_price: '0.0008',
    output_token_price: '0.004',
    cache_creation_5m_price: '0.001',
    cache_creation_1h_price: '0.0008',
    cache_read_price: '0.00008',
    context_window: 200000,
    max_output_tokens: 64000,
    supports_extended_context: false,
  });

  store.createModel({
    model_id: 'claude-opus-4',
    display_name: 'Claude Opus 4',
    bedrock_model_id: 'global.anthropic.claude-opus-4-0-20250514-v1:0',
    model_region: 'us-west-2',
    input_token_price: '0.015',
    output_token_price: '0.075',
    cache_creation_5m_price: '0.01875',
    cache_creation_1h_price: '0.015',
    cache_read_price: '0.0015',
    context_window: 200000,
    max_output_tokens: 32000,
    supports_extended_context: false,
  });

  // テナント
  store.createTenant({
    tenant_id: 'demo-tenant',
    system_prompt: 'あなたは優秀なAIアシスタントです。ユーザーの質問に日本語で丁寧に回答してください。コードの作成、分析、デバッグなど幅広いタスクに対応できます。',
    model_id: 'claude-sonnet-4',
  });

  store.createTenant({
    tenant_id: 'test-tenant',
    system_prompt: 'テスト用テナントです。',
    model_id: 'claude-haiku-4',
  });

  // スキル
  store.createSkill('demo-tenant', {
    name: 'code-review',
    display_title: 'コードレビュー',
    description: 'コードの品質、セキュリティ、パフォーマンスを自動レビューします。',
    skill_md: `# コードレビュースキル

## 概要
コードの品質を多角的にレビューし、改善提案を行います。

## チェック項目
- セキュリティ脆弱性 (OWASP Top 10)
- パフォーマンスボトルネック
- コーディング規約準拠
- テストカバレッジ

## 使用方法
レビュー対象のファイルパスを指定してください。
`,
    slash_command: '/review',
    slash_command_description: 'コードレビューを実行します',
  });

  store.createSkill('demo-tenant', {
    name: 'generate-docs',
    display_title: 'ドキュメント生成',
    description: 'ソースコードからAPIドキュメントやREADMEを自動生成します。',
    skill_md: `# ドキュメント生成スキル

## 概要
コードベースを分析し、自動的にドキュメントを生成します。

## 対応フォーマット
- Markdown
- OpenAPI (Swagger)
- JSDoc / docstring

## 使用方法
対象ディレクトリまたはファイルを指定してください。
`,
    slash_command: '/docs',
    slash_command_description: 'ドキュメントを自動生成します',
  });

  // MCPサーバー
  store.createMcpServer('demo-tenant', {
    name: 'servicenow',
    display_name: 'ServiceNow連携',
    openapi_spec: {
      openapi: '3.0.0',
      info: { title: 'ServiceNow API', version: '1.0.0' },
      paths: {
        '/api/now/table/incident': {
          get: { summary: 'インシデント一覧取得', operationId: 'listIncidents' },
          post: { summary: 'インシデント作成', operationId: 'createIncident' },
        },
      },
    },
    openapi_base_url: 'https://instance.service-now.com',
    headers_template: { Authorization: 'Bearer {{servicenowToken}}' },
    allowed_tools: ['listIncidents', 'createIncident'],
    description: 'ServiceNowとの連携でインシデント管理を行います。',
  });

  console.log('[SEED] 初期データ投入完了:');
  console.log(`  - モデル: ${store.models.size}件`);
  console.log(`  - テナント: ${store.tenants.size}件`);
  console.log(`  - スキル: ${store.skills.size}件`);
  console.log(`  - MCPサーバー: ${store.mcpServers.size}件`);
}

// ========= サーバー起動 =========
seedData();

app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   claude-multi-agent Mock Server                    ║');
  console.log('║   Node.js / Express / In-Memory                    ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║   URL:  http://localhost:${PORT}                      ║`);
  console.log('║                                                      ║');
  console.log('║   Endpoints:                                         ║');
  console.log('║     GET  /health              ヘルスチェック          ║');
  console.log('║     *    /api/tenants          テナント管理           ║');
  console.log('║     *    /api/models           モデル管理             ║');
  console.log('║     *    /api/tenants/:id/conversations  会話API      ║');
  console.log('║     *    /api/tenants/:id/simple-chats   チャットAPI  ║');
  console.log('║     *    /api/tenants/:id/skills         スキルAPI    ║');
  console.log('║     *    /api/tenants/:id/mcp-servers    MCP API      ║');
  console.log('║     GET  /api/tenants/:id/usage          使用状況     ║');
  console.log('║     GET  /api/tenants/:id/cost-report    コスト       ║');
  console.log('║     GET  /api/tenants/:id/tool-logs      ツールログ   ║');
  console.log('║     GET  /api/tenants/:id/conversations/:id/files     ║');
  console.log('║                                                      ║');
  console.log('║   Headers:                                            ║');
  console.log('║     X-API-Key: any-value (認証)                       ║');
  console.log('║     X-Tenant-ID / X-User-ID (任意)                    ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
});

module.exports = app;
