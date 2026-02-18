/**
 * ヘルスチェック API
 * 本家: /app/api/health.py
 */
const { Router } = require('express');

const router = Router();
const startTime = Date.now();

// GET /health - 詳細ヘルスチェック
router.get('/', (req, res) => {
  const uptimeMs = Date.now() - startTime;
  res.json({
    status: 'healthy',
    uptime_seconds: Math.floor(uptimeMs / 1000),
    checks: {
      database: { status: 'ok', latency_ms: 1 },       // モック: 常にOK
      redis: { status: 'ok', latency_ms: 0 },           // モック: 常にOK
      s3: { status: 'ok', latency_ms: 2 },              // モック: 常にOK
      container_system: { status: 'ok', active_containers: 0, warm_pool_size: 3 },
    },
    version: '1.0.0-mock',
    environment: 'development',
  });
});

// GET /health/live - Kubernetes liveness probe
router.get('/live', (req, res) => {
  res.json({ status: 'alive' });
});

// GET /health/ready - Kubernetes readiness probe
router.get('/ready', (req, res) => {
  res.json({ status: 'ready' });
});

module.exports = router;
