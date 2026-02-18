/**
 * 認証ミドルウェア
 * claude-multi-agent の AuthMiddleware を再現
 * モックなので簡易的なAPIキー検証
 */
const { v4: uuidv4 } = require('uuid');

// 認証スキップするパス
const SKIP_PATHS = ['/health', '/health/live', '/health/ready', '/metrics', '/docs', '/openapi.json'];

function authMiddleware(req, res, next) {
  // ヘルスチェック等はスキップ
  if (SKIP_PATHS.some(p => req.path.startsWith(p))) {
    return next();
  }

  // X-Request-ID の自動付与
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = uuidv4();
  }
  res.setHeader('X-Request-ID', req.headers['x-request-id']);

  // APIキー検証 (モック: 存在すればOK、なければ401)
  const apiKey = req.headers['x-api-key'] || extractBearer(req.headers['authorization']);
  if (!apiKey) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'APIキーが提供されていません。X-API-Key ヘッダーを指定してください。',
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }

  // テナント操作にはX-Tenant-IDが必要 (パスに含まれる場合)
  const tenantMatch = req.path.match(/\/api\/tenants\/([^/]+)\//);
  if (tenantMatch) {
    req.tenantId = tenantMatch[1];
  }

  // ヘッダーからユーザー情報を取得
  req.userId = req.headers['x-user-id'] || null;
  req.adminId = req.headers['x-admin-id'] || null;

  next();
}

function extractBearer(authHeader) {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

module.exports = authMiddleware;
