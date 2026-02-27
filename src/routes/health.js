/**
 * ヘルスチェック API
 * 本家: /app/api/health.py
 */
const { Router } = require('express');

const router = Router();
const startTime = Date.now();

// GET /health - 詳細ヘルスチェック
// 本家: HealthResponse = { status, version, environment, timestamp, checks: { [name]: ComponentHealth } }
// ComponentHealth = { status: "healthy"|"degraded"|"unhealthy", message: str|null, latency_ms: float|null }
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0-mock',
    environment: 'development',
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: 'healthy', message: null, latency_ms: 1.2 },
      s3: { status: 'healthy', message: null, latency_ms: 2.1 },
    },
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
