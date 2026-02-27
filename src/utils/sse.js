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
  const evt = {
    seq: nextSeq(),
    timestamp: getTimestamp(),
    session_id: sessionId,
    tools,
    model,
  };
  // 本家: conversation_id が truthy な場合のみ含む
  if (conversationId) evt.conversation_id = conversationId;
  return evt;
}

function formatThinkingEvent(content, parentAgentId) {
  const evt = {
    seq: nextSeq(),
    timestamp: getTimestamp(),
    content,
  };
  if (parentAgentId) evt.parent_agent_id = parentAgentId;
  return evt;
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
  // 本家: 500文字超の文字列値を切り詰め
  const truncatedInput = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.length > 500) {
      truncatedInput[key] = value.slice(0, 500) + '...';
    } else {
      truncatedInput[key] = value;
    }
  }

  const evt = {
    seq: nextSeq(),
    timestamp: getTimestamp(),
    tool_use_id: toolUseId,
    tool_name: toolName,
    input: truncatedInput,
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
  const evt = {
    seq: nextSeq(),
    timestamp: getTimestamp(),
    agent_id: agentId,
    agent_type: agentType,
    description,
  };
  // 本家: model が truthy な場合のみ含む
  if (model) evt.model = model;
  return evt;
}

function formatSubagentEndEvent(agentId, agentType, status, resultPreview) {
  const evt = {
    seq: nextSeq(),
    timestamp: getTimestamp(),
    agent_id: agentId,
    agent_type: agentType,
    status,
  };
  // 本家: result_preview が truthy な場合のみ含む
  if (resultPreview) evt.result_preview = resultPreview;
  return evt;
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

function formatPingEvent(seq, elapsedMs) {
  // 本家: ping は seq=0 固定（シーケンスカウンターを使わない）
  return {
    seq: seq,
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
    // 本家と同一メッセージ
    message = 'コンテキスト制限に達しました。新しいチャットを開始してください。';
    recommendedAction = 'new_chat';
  } else if (pct >= 85) {
    warningLevel = 'critical';
    message = 'コンテキストが残りわずかです。次の返信でエラーの可能性があります。';
    recommendedAction = 'new_chat';
  } else if (pct >= 70) {
    warningLevel = 'warning';
    message = '会話が長くなっています。新しいチャットを開始することをおすすめします。';
    recommendedAction = 'new_chat';
  }

  const evt = {
    seq: nextSeq(),
    timestamp: getTimestamp(),
    current_context_tokens: currentTokens,
    max_context_tokens: maxTokens,
    usage_percent: Math.round(pct * 10) / 10,
    warning_level: warningLevel,
    can_continue: canContinue,
  };
  // 本家: message, recommended_action は truthy な場合のみ含む
  if (message) evt.message = message;
  if (recommendedAction) evt.recommended_action = recommendedAction;
  return evt;
}

function formatDoneEvent({ status, result, errors, usage, costUsd, turnCount, durationMs, sessionId, messages, modelUsage }) {
  const resolvedStatus = status || 'success';
  const evt = {
    seq: nextSeq(),
    timestamp: getTimestamp(),
    status: resolvedStatus,
    result: result || null,
    // 本家: is_error = status != "success" (cancelled も true になる)
    is_error: resolvedStatus !== 'success',
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
  };
  // 本家: session_id は None でない場合のみ含む
  if (sessionId != null) evt.session_id = sessionId;
  // 本家: messages は None でない場合のみ含む
  if (messages != null) evt.messages = messages;
  // 本家: model_usage は None でない場合のみ含む
  if (modelUsage != null) evt.model_usage = modelUsage;
  return evt;
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
// 本家: SSEイベントタイプは "text_delta"、data に event_type フィールドは含まない
function formatSimpleTextDeltaEvent(seq, content) {
  return {
    seq,
    timestamp: getTimestamp(),
    content,
  };
}

// 本家: done イベントには status フィールドがあり、event_type フィールドはない
function formatSimpleDoneEvent(seq, { title, usage, costUsd }) {
  return {
    seq,
    timestamp: getTimestamp(),
    status: 'success',
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
  formatThinkingEvent,
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
