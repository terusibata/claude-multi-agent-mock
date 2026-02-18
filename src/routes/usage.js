/**
 * 使用状況・コストレポート API
 * 本家: /app/api/usage.py
 */
const { Router } = require('express');
const store = require('../store');

const router = Router({ mergeParams: true });

// GET /api/tenants/:tenant_id/usage - 使用状況ログ
router.get('/usage', (req, res) => {
  const { user_id, from_date, to_date, limit, offset } = req.query;
  const logs = store.listUsageLogs(req.params.tenant_id, {
    user_id,
    from_date,
    to_date,
    limit: parseInt(limit) || 100,
    offset: parseInt(offset) || 0,
  });
  res.json(logs);
});

// GET /api/tenants/:tenant_id/usage/users/:user_id - ユーザー別使用状況
router.get('/usage/users/:user_id', (req, res) => {
  const { from_date, to_date, limit, offset } = req.query;
  const logs = store.listUsageLogs(req.params.tenant_id, {
    user_id: req.params.user_id,
    from_date,
    to_date,
    limit: parseInt(limit) || 100,
    offset: parseInt(offset) || 0,
  });
  res.json(logs);
});

// GET /api/tenants/:tenant_id/usage/summary - 使用状況サマリー
router.get('/usage/summary', (req, res) => {
  const { from_date, to_date, group_by } = req.query;
  const logs = store.listUsageLogs(req.params.tenant_id, { from_date, to_date, limit: 10000 });

  // 集計
  const totalInput = logs.reduce((s, l) => s + l.input_tokens, 0);
  const totalOutput = logs.reduce((s, l) => s + l.output_tokens, 0);
  const totalCost = logs.reduce((s, l) => s + parseFloat(l.cost_usd), 0);

  // グルーピング
  const grouped = {};
  for (const log of logs) {
    let key;
    const date = new Date(log.executed_at);
    if (group_by === 'month') {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } else if (group_by === 'week') {
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay());
      key = startOfWeek.toISOString().slice(0, 10);
    } else {
      key = date.toISOString().slice(0, 10);
    }

    if (!grouped[key]) {
      grouped[key] = { period: key, input_tokens: 0, output_tokens: 0, total_tokens: 0, cost_usd: 0, request_count: 0 };
    }
    grouped[key].input_tokens += log.input_tokens;
    grouped[key].output_tokens += log.output_tokens;
    grouped[key].total_tokens += log.total_tokens;
    grouped[key].cost_usd += parseFloat(log.cost_usd);
    grouped[key].request_count += 1;
  }

  res.json({
    summary: {
      total_input_tokens: totalInput,
      total_output_tokens: totalOutput,
      total_tokens: totalInput + totalOutput,
      total_cost_usd: totalCost.toFixed(6),
      total_requests: logs.length,
    },
    by_period: Object.values(grouped).map(g => ({
      ...g,
      cost_usd: g.cost_usd.toFixed(6),
    })),
  });
});

// GET /api/tenants/:tenant_id/cost-report - コストレポート
router.get('/cost-report', (req, res) => {
  const { from_date, to_date, model_id, user_id } = req.query;
  if (!from_date || !to_date) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'from_date と to_date は必須です。',
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }

  let logs = store.listUsageLogs(req.params.tenant_id, { from_date, to_date, limit: 10000 });
  if (model_id) logs = logs.filter(l => l.model_id === model_id);
  if (user_id) logs = logs.filter(l => l.user_id === user_id);

  // モデル別集計
  const byModel = {};
  for (const log of logs) {
    if (!byModel[log.model_id]) {
      byModel[log.model_id] = { model_id: log.model_id, input_tokens: 0, output_tokens: 0, cost_usd: 0, request_count: 0 };
    }
    byModel[log.model_id].input_tokens += log.input_tokens;
    byModel[log.model_id].output_tokens += log.output_tokens;
    byModel[log.model_id].cost_usd += parseFloat(log.cost_usd);
    byModel[log.model_id].request_count += 1;
  }

  // ユーザー別集計
  const byUser = {};
  for (const log of logs) {
    if (!byUser[log.user_id]) {
      byUser[log.user_id] = { user_id: log.user_id, input_tokens: 0, output_tokens: 0, cost_usd: 0, request_count: 0 };
    }
    byUser[log.user_id].input_tokens += log.input_tokens;
    byUser[log.user_id].output_tokens += log.output_tokens;
    byUser[log.user_id].cost_usd += parseFloat(log.cost_usd);
    byUser[log.user_id].request_count += 1;
  }

  const totalCost = logs.reduce((s, l) => s + parseFloat(l.cost_usd), 0);

  res.json({
    period: { from_date, to_date },
    total_cost_usd: totalCost.toFixed(6),
    total_requests: logs.length,
    by_model: Object.values(byModel).map(m => ({ ...m, cost_usd: m.cost_usd.toFixed(6) })),
    by_user: Object.values(byUser).map(u => ({ ...u, cost_usd: u.cost_usd.toFixed(6) })),
  });
});

// GET /api/tenants/:tenant_id/tool-logs - ツールログ
router.get('/tool-logs', (req, res) => {
  const { session_id, tool_name, from_date, to_date, limit, offset } = req.query;
  const logs = store.listToolLogs(req.params.tenant_id, {
    session_id,
    tool_name,
    from_date,
    to_date,
    limit: parseInt(limit) || 100,
    offset: parseInt(offset) || 0,
  });
  res.json(logs);
});

module.exports = router;
