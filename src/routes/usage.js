/**
 * 使用状況・コストレポート API
 * 本家: /app/api/usage.py
 */
const { Router } = require('express');
const store = require('../store');
const { createErrorResponse } = require('../utils/errorResponse');

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
// 本家: Array[UsageSummary] = [{ period, total_tokens, input_tokens, output_tokens,
//   cache_creation_5m_tokens, cache_creation_1h_tokens, cache_read_tokens, total_cost_usd, execution_count }]
router.get('/usage/summary', (req, res) => {
  const { from_date, to_date, group_by } = req.query;
  const logs = store.listUsageLogs(req.params.tenant_id, { from_date, to_date, limit: 10000 });

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
      grouped[key] = {
        period: key,
        total_tokens: 0,
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_5m_tokens: 0,
        cache_creation_1h_tokens: 0,
        cache_read_tokens: 0,
        total_cost_usd: 0,
        execution_count: 0,
      };
    }
    grouped[key].input_tokens += log.input_tokens;
    grouped[key].output_tokens += log.output_tokens;
    grouped[key].total_tokens += log.total_tokens;
    grouped[key].cache_creation_5m_tokens += log.cache_creation_5m_tokens || 0;
    grouped[key].cache_creation_1h_tokens += log.cache_creation_1h_tokens || 0;
    grouped[key].cache_read_tokens += log.cache_read_tokens || 0;
    grouped[key].total_cost_usd += parseFloat(log.cost_usd);
    grouped[key].execution_count += 1;
  }

  // 本家は Array[UsageSummary] を返す（フラットなリスト）
  const result = Object.values(grouped).map(g => ({
    ...g,
    total_cost_usd: g.total_cost_usd.toFixed(6),
  }));
  res.json(result);
});

// GET /api/tenants/:tenant_id/cost-report - コストレポート
router.get('/cost-report', (req, res) => {
  const { from_date, to_date, model_id, user_id } = req.query;
  if (!from_date || !to_date) {
    return res.status(422).json(createErrorResponse(req, 'VALIDATION_ERROR', 'from_date と to_date は必須です。'));
  }

  let logs = store.listUsageLogs(req.params.tenant_id, { from_date, to_date, limit: 10000 });
  if (model_id) logs = logs.filter(l => l.model_id === model_id);
  if (user_id) logs = logs.filter(l => l.user_id === user_id);

  // モデル別集計
  // 本家 CostReportItem: { model_id, model_name, total_tokens, input_tokens, output_tokens,
  //   cache_creation_5m_tokens, cache_creation_1h_tokens, cache_read_tokens, cost_usd, execution_count }
  const byModel = {};
  for (const log of logs) {
    if (!byModel[log.model_id]) {
      const modelDef = store.getModel(log.model_id);
      byModel[log.model_id] = {
        model_id: log.model_id,
        model_name: modelDef ? modelDef.display_name : log.model_id,
        total_tokens: 0,
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_5m_tokens: 0,
        cache_creation_1h_tokens: 0,
        cache_read_tokens: 0,
        cost_usd: 0,
        execution_count: 0,
      };
    }
    byModel[log.model_id].input_tokens += log.input_tokens;
    byModel[log.model_id].output_tokens += log.output_tokens;
    byModel[log.model_id].total_tokens += log.total_tokens;
    byModel[log.model_id].cache_creation_5m_tokens += log.cache_creation_5m_tokens || 0;
    byModel[log.model_id].cache_creation_1h_tokens += log.cache_creation_1h_tokens || 0;
    byModel[log.model_id].cache_read_tokens += log.cache_read_tokens || 0;
    byModel[log.model_id].cost_usd += parseFloat(log.cost_usd);
    byModel[log.model_id].execution_count += 1;
  }

  // ユーザー別集計
  const byUser = {};
  for (const log of logs) {
    if (!byUser[log.user_id]) {
      byUser[log.user_id] = { user_id: log.user_id, total_tokens: 0, input_tokens: 0, output_tokens: 0, cost_usd: 0, execution_count: 0 };
    }
    byUser[log.user_id].input_tokens += log.input_tokens;
    byUser[log.user_id].output_tokens += log.output_tokens;
    byUser[log.user_id].total_tokens += log.total_tokens;
    byUser[log.user_id].cost_usd += parseFloat(log.cost_usd);
    byUser[log.user_id].execution_count += 1;
  }

  const totalCost = logs.reduce((s, l) => s + parseFloat(l.cost_usd), 0);
  const totalTokens = logs.reduce((s, l) => s + l.total_tokens, 0);

  // 本家: CostReportResponse = { tenant_id, from_date, to_date, total_cost_usd, total_tokens, total_executions, by_model, by_user }
  res.json({
    tenant_id: req.params.tenant_id,
    from_date,
    to_date,
    total_cost_usd: totalCost.toFixed(6),
    total_tokens: totalTokens,
    total_executions: logs.length,
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
