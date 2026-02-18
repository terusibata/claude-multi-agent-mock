/**
 * SSE (Server-Sent Events) ユーティリティ
 * claude-multi-agent のストリーミングイベント形式を忠実に再現
 */

let _seq = 0;

function resetSeq() {
  _seq = 0;
}

function nextSeq() {
  return ++_seq;
}

function getTimestamp() {
  return new Date().toISOString();
}

/**
 * SSE イベントを res に送信
 */
function sendSSE(res, eventType, data) {
  const payload = JSON.stringify(data, null, 0);
  res.write(`event: ${eventType}\ndata: ${payload}\n\n`);
}

/**
 * イベント生成ヘルパー群 (claude-multi-agent の streaming.py を再現)
 */

function formatInitEvent(sessionId, tools, model, conversationId) {
  return {
    seq: nextSeq(),
    timestamp: getTimestamp(),
    session_id: sessionId,
    tools,
    model,
    conversation_id: conversationId,
  };
}

function formatAssistantEvent(contentBlocks, parentAgentId) {
  const evt = {
    seq: nextSeq(),
    timestamp: getTimestamp(),
    content_blocks: contentBlocks,
  };
  if (parentAgentId) evt.parent_agent_id = parentAgentId;
  return evt;
}

function formatToolCallEvent(toolUseId, toolName, input, summary, parentAgentId) {
  const evt = {
    seq: nextSeq(),
    timestamp: getTimestamp(),
    tool_use_id: toolUseId,
    tool_name: toolName,
    input,
    summary,
  };
  if (parentAgentId) evt.parent_agent_id = parentAgentId;
  return evt;
}

function formatToolResultEvent(toolUseId, toolName, status, content, isError, parentAgentId) {
  const evt = {
    seq: nextSeq(),
    timestamp: getTimestamp(),
    tool_use_id: toolUseId,
    tool_name: toolName,
    status,
    content,
    is_error: isError || false,
  };
  if (parentAgentId) evt.parent_agent_id = parentAgentId;
  return evt;
}

function formatSubagentStartEvent(agentId, agentType, description, model) {
  return {
    seq: nextSeq(),
    timestamp: getTimestamp(),
    agent_id: agentId,
    agent_type: agentType,
    description,
    model,
  };
}

function formatSubagentEndEvent(agentId, agentType, status, resultPreview) {
  return {
    seq: nextSeq(),
    timestamp: getTimestamp(),
    agent_id: agentId,
    agent_type: agentType,
    status,
    result_preview: resultPreview,
  };
}

function formatProgressEvent(type, message, toolInfo, parentAgentId) {
  const evt = {
    seq: nextSeq(),
    timestamp: getTimestamp(),
    type,
    message,
  };
  if (toolInfo) {
    evt.tool_use_id = toolInfo.tool_use_id;
    evt.tool_name = toolInfo.tool_name;
    evt.tool_status = toolInfo.tool_status;
  }
  if (parentAgentId) evt.parent_agent_id = parentAgentId;
  return evt;
}

function formatTitleEvent(title) {
  return {
    seq: nextSeq(),
    timestamp: getTimestamp(),
    title,
  };
}

function formatPingEvent(elapsedMs) {
  return {
    seq: nextSeq(),
    timestamp: getTimestamp(),
    elapsed_ms: elapsedMs,
  };
}

function formatContextStatusEvent(currentTokens, maxTokens) {
  const pct = (currentTokens / maxTokens) * 100;
  let warningLevel = 'normal';
  let canContinue = true;
  let message = null;
  let recommendedAction = null;

  if (pct >= 95) {
    warningLevel = 'blocked';
    canContinue = false;
    message = 'コンテキストウィンドウの上限に達しました。新しい会話を開始してください。';
    recommendedAction = 'new_chat';
  } else if (pct >= 85) {
    warningLevel = 'critical';
    message = '会話が非常に長くなっています。次の返信でエラーの可能性があります。';
    recommendedAction = 'new_chat';
  } else if (pct >= 70) {
    warningLevel = 'warning';
    message = '会話が長くなっています。新しいチャットの開始をお勧めします。';
    recommendedAction = 'new_chat';
  }

  return {
    seq: nextSeq(),
    timestamp: getTimestamp(),
    current_context_tokens: currentTokens,
    max_context_tokens: maxTokens,
    usage_percent: Math.round(pct * 10) / 10,
    warning_level: warningLevel,
    can_continue: canContinue,
    message,
    recommended_action: recommendedAction,
  };
}

function formatDoneEvent({ status, result, errors, usage, costUsd, turnCount, durationMs, sessionId }) {
  return {
    seq: nextSeq(),
    timestamp: getTimestamp(),
    status: status || 'success',
    result: result || null,
    is_error: status === 'error',
    errors: errors || null,
    usage: usage || {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_5m_tokens: 0,
      cache_creation_1h_tokens: 0,
      cache_read_tokens: 0,
      total_tokens: 0,
    },
    cost_usd: costUsd || '0',
    turn_count: turnCount || 1,
    duration_ms: durationMs || 0,
    session_id: sessionId || null,
  };
}

function formatErrorEvent(errorType, message, recoverable) {
  return {
    seq: nextSeq(),
    timestamp: getTimestamp(),
    error_type: errorType,
    message,
    recoverable: recoverable || false,
  };
}

// シンプルチャット用
function formatSimpleTextDeltaEvent(seq, content) {
  return {
    seq,
    timestamp: getTimestamp(),
    event_type: 'text_delta',
    content,
  };
}

function formatSimpleDoneEvent(seq, { title, usage, costUsd }) {
  return {
    seq,
    timestamp: getTimestamp(),
    event_type: 'done',
    title: title || null,
    usage: usage || { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    cost_usd: costUsd || '0',
  };
}

module.exports = {
  resetSeq,
  nextSeq,
  getTimestamp,
  sendSSE,
  formatInitEvent,
  formatAssistantEvent,
  formatToolCallEvent,
  formatToolResultEvent,
  formatSubagentStartEvent,
  formatSubagentEndEvent,
  formatProgressEvent,
  formatTitleEvent,
  formatPingEvent,
  formatContextStatusEvent,
  formatDoneEvent,
  formatErrorEvent,
  formatSimpleTextDeltaEvent,
  formatSimpleDoneEvent,
};
