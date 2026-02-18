/**
 * インメモリデータストア
 * claude-multi-agent の全エンティティを管理
 */
const { v4: uuidv4 } = require('uuid');

class Store {
  constructor() {
    this.tenants = new Map();
    this.models = new Map();
    this.conversations = new Map();
    this.messageLogs = new Map();      // conversationId -> [messages]
    this.simpleChats = new Map();
    this.simpleChatMessages = new Map(); // chatId -> [messages]
    this.skills = new Map();
    this.mcpServers = new Map();
    this.usageLogs = [];
    this.toolLogs = [];
    this.conversationFiles = new Map(); // conversationId -> [files]
  }

  // ========= テナント =========
  createTenant({ tenant_id, system_prompt, model_id }) {
    const now = new Date().toISOString();
    const tenant = {
      tenant_id,
      system_prompt: system_prompt || null,
      model_id: model_id || null,
      status: 'active',
      created_at: now,
      updated_at: now,
    };
    this.tenants.set(tenant_id, tenant);
    return tenant;
  }

  getTenant(tenantId) {
    return this.tenants.get(tenantId) || null;
  }

  listTenants({ status, limit = 100, offset = 0 } = {}) {
    let items = [...this.tenants.values()];
    if (status) items = items.filter(t => t.status === status);
    return items.slice(offset, offset + limit);
  }

  updateTenant(tenantId, updates) {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return null;
    Object.assign(tenant, updates, { updated_at: new Date().toISOString() });
    return tenant;
  }

  deleteTenant(tenantId) {
    return this.tenants.delete(tenantId);
  }

  // ========= モデル =========
  createModel(data) {
    const now = new Date().toISOString();
    const model = {
      model_id: data.model_id,
      display_name: data.display_name,
      bedrock_model_id: data.bedrock_model_id,
      model_region: data.model_region || null,
      input_token_price: data.input_token_price || '0',
      output_token_price: data.output_token_price || '0',
      cache_creation_5m_price: data.cache_creation_5m_price || '0',
      cache_creation_1h_price: data.cache_creation_1h_price || '0',
      cache_read_price: data.cache_read_price || '0',
      context_window: data.context_window || 200000,
      max_output_tokens: data.max_output_tokens || 64000,
      supports_extended_context: data.supports_extended_context || false,
      extended_context_window: data.extended_context_window || null,
      status: 'active',
      created_at: now,
      updated_at: now,
    };
    this.models.set(model.model_id, model);
    return model;
  }

  getModel(modelId) {
    return this.models.get(modelId) || null;
  }

  listModels({ status } = {}) {
    let items = [...this.models.values()];
    if (status) items = items.filter(m => m.status === status);
    return items;
  }

  updateModel(modelId, updates) {
    const model = this.models.get(modelId);
    if (!model) return null;
    Object.assign(model, updates, { updated_at: new Date().toISOString() });
    return model;
  }

  deleteModel(modelId) {
    return this.models.delete(modelId);
  }

  // ========= 会話 =========
  createConversation({ tenant_id, user_id, model_id, workspace_enabled = true }) {
    const now = new Date().toISOString();
    const conv = {
      conversation_id: uuidv4(),
      session_id: null,
      tenant_id,
      user_id,
      model_id: model_id || this._defaultModelId(tenant_id),
      title: null,
      status: 'active',
      workspace_enabled,
      total_input_tokens: 0,
      total_output_tokens: 0,
      estimated_context_tokens: 0,
      context_limit_reached: false,
      created_at: now,
      updated_at: now,
    };
    this.conversations.set(conv.conversation_id, conv);
    this.messageLogs.set(conv.conversation_id, []);
    this.conversationFiles.set(conv.conversation_id, []);
    return conv;
  }

  getConversation(conversationId) {
    return this.conversations.get(conversationId) || null;
  }

  listConversations(tenantId, { user_id, status, from_date, to_date, limit = 50, offset = 0 } = {}) {
    let items = [...this.conversations.values()].filter(c => c.tenant_id === tenantId);
    if (user_id) items = items.filter(c => c.user_id === user_id);
    if (status) items = items.filter(c => c.status === status);
    if (from_date) items = items.filter(c => new Date(c.created_at) >= new Date(from_date));
    if (to_date) items = items.filter(c => new Date(c.created_at) <= new Date(to_date));
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const total = items.length;
    return { items: items.slice(offset, offset + limit), total, limit, offset };
  }

  updateConversation(conversationId, updates) {
    const conv = this.conversations.get(conversationId);
    if (!conv) return null;
    Object.assign(conv, updates, { updated_at: new Date().toISOString() });
    return conv;
  }

  deleteConversation(conversationId) {
    this.messageLogs.delete(conversationId);
    this.conversationFiles.delete(conversationId);
    return this.conversations.delete(conversationId);
  }

  // ========= メッセージログ =========
  addMessageLog(conversationId, { message_type, message_subtype, content }) {
    const logs = this.messageLogs.get(conversationId);
    if (!logs) return null;
    const msg = {
      message_id: uuidv4(),
      conversation_id: conversationId,
      message_seq: logs.length + 1,
      message_type,
      message_subtype: message_subtype || null,
      content: content || null,
      timestamp: new Date().toISOString(),
    };
    logs.push(msg);
    return msg;
  }

  getMessageLogs(conversationId) {
    return this.messageLogs.get(conversationId) || [];
  }

  // ========= シンプルチャット =========
  createSimpleChat({ tenant_id, user_id, model_id, application_type, system_prompt }) {
    const now = new Date().toISOString();
    const chat = {
      chat_id: uuidv4(),
      tenant_id,
      user_id,
      model_id,
      application_type,
      system_prompt,
      title: null,
      status: 'active',
      created_at: now,
      updated_at: now,
    };
    this.simpleChats.set(chat.chat_id, chat);
    this.simpleChatMessages.set(chat.chat_id, []);
    return chat;
  }

  getSimpleChat(chatId) {
    return this.simpleChats.get(chatId) || null;
  }

  listSimpleChats(tenantId, { user_id, application_type, status, limit = 50, offset = 0 } = {}) {
    let items = [...this.simpleChats.values()].filter(c => c.tenant_id === tenantId);
    if (user_id) items = items.filter(c => c.user_id === user_id);
    if (application_type) items = items.filter(c => c.application_type === application_type);
    if (status) items = items.filter(c => c.status === status);
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const total = items.length;
    return { items: items.slice(offset, offset + limit), total, limit, offset };
  }

  addSimpleChatMessage(chatId, { role, content }) {
    const msgs = this.simpleChatMessages.get(chatId);
    if (!msgs) return null;
    const msg = {
      message_id: uuidv4(),
      chat_id: chatId,
      message_seq: msgs.length + 1,
      role,
      content,
      created_at: new Date().toISOString(),
    };
    msgs.push(msg);
    return msg;
  }

  getSimpleChatMessages(chatId) {
    return this.simpleChatMessages.get(chatId) || [];
  }

  deleteSimpleChat(chatId) {
    this.simpleChatMessages.delete(chatId);
    return this.simpleChats.delete(chatId);
  }

  // ========= Skills =========
  createSkill(tenantId, data) {
    const now = new Date().toISOString();
    const skill = {
      skill_id: uuidv4(),
      tenant_id: tenantId,
      name: data.name,
      display_title: data.display_title || null,
      description: data.description || null,
      version: 1,
      file_path: `/skills/tenant_${tenantId}/.claude/skills/${data.name}/`,
      slash_command: data.slash_command || null,
      slash_command_description: data.slash_command_description || null,
      is_user_selectable: data.is_user_selectable !== undefined ? data.is_user_selectable : true,
      status: 'active',
      created_at: now,
      updated_at: now,
      // 内部用: skill_md と追加ファイルを保持
      _files: {
        'SKILL.md': data.skill_md || '# Skill\nサンプルスキル定義',
      },
    };
    this.skills.set(skill.skill_id, skill);
    return skill;
  }

  getSkill(skillId) {
    return this.skills.get(skillId) || null;
  }

  listSkills(tenantId, { status } = {}) {
    let items = [...this.skills.values()].filter(s => s.tenant_id === tenantId);
    if (status) items = items.filter(s => s.status === status);
    return items;
  }

  updateSkill(skillId, updates) {
    const skill = this.skills.get(skillId);
    if (!skill) return null;
    Object.assign(skill, updates, { updated_at: new Date().toISOString() });
    return skill;
  }

  deleteSkill(skillId) {
    return this.skills.delete(skillId);
  }

  // ========= MCPサーバー =========
  createMcpServer(tenantId, data) {
    const now = new Date().toISOString();
    const server = {
      mcp_server_id: uuidv4(),
      tenant_id: tenantId,
      name: data.name,
      display_name: data.display_name || null,
      openapi_spec: data.openapi_spec || null,
      openapi_base_url: data.openapi_base_url || null,
      headers_template: data.headers_template || null,
      allowed_tools: data.allowed_tools || null,
      env: data.env || null,
      description: data.description || null,
      status: 'active',
      created_at: now,
      updated_at: now,
    };
    this.mcpServers.set(server.mcp_server_id, server);
    return server;
  }

  getMcpServer(serverId) {
    return this.mcpServers.get(serverId) || null;
  }

  listMcpServers(tenantId, { status, limit = 50, offset = 0 } = {}) {
    let items = [...this.mcpServers.values()].filter(s => s.tenant_id === tenantId);
    if (status) items = items.filter(s => s.status === status);
    const total = items.length;
    return { items: items.slice(offset, offset + limit), total, limit, offset };
  }

  updateMcpServer(serverId, updates) {
    const server = this.mcpServers.get(serverId);
    if (!server) return null;
    Object.assign(server, updates, { updated_at: new Date().toISOString() });
    return server;
  }

  deleteMcpServer(serverId) {
    return this.mcpServers.delete(serverId);
  }

  // ========= 使用状況ログ =========
  addUsageLog(data) {
    const log = {
      usage_log_id: uuidv4(),
      tenant_id: data.tenant_id,
      user_id: data.user_id,
      model_id: data.model_id,
      session_id: data.session_id || null,
      conversation_id: data.conversation_id || null,
      input_tokens: data.input_tokens || 0,
      output_tokens: data.output_tokens || 0,
      cache_creation_5m_tokens: data.cache_creation_5m_tokens || 0,
      cache_creation_1h_tokens: data.cache_creation_1h_tokens || 0,
      cache_read_tokens: data.cache_read_tokens || 0,
      total_tokens: data.total_tokens || 0,
      cost_usd: data.cost_usd || '0',
      executed_at: new Date().toISOString(),
    };
    this.usageLogs.push(log);
    return log;
  }

  listUsageLogs(tenantId, { user_id, from_date, to_date, limit = 100, offset = 0 } = {}) {
    let items = this.usageLogs.filter(u => u.tenant_id === tenantId);
    if (user_id) items = items.filter(u => u.user_id === user_id);
    if (from_date) items = items.filter(u => new Date(u.executed_at) >= new Date(from_date));
    if (to_date) items = items.filter(u => new Date(u.executed_at) <= new Date(to_date));
    return items.slice(offset, offset + limit);
  }

  // ========= ツールログ =========
  addToolLog(data) {
    const log = {
      tool_log_id: uuidv4(),
      session_id: data.session_id,
      conversation_id: data.conversation_id || null,
      tool_name: data.tool_name,
      tool_use_id: data.tool_use_id || null,
      tool_input: data.tool_input || null,
      tool_output: data.tool_output || null,
      status: data.status || 'completed',
      execution_time_ms: data.execution_time_ms || null,
      executed_at: new Date().toISOString(),
    };
    this.toolLogs.push(log);
    return log;
  }

  listToolLogs(tenantId, { session_id, tool_name, from_date, to_date, limit = 100, offset = 0 } = {}) {
    let items = this.toolLogs;
    if (session_id) items = items.filter(t => t.session_id === session_id);
    if (tool_name) items = items.filter(t => t.tool_name === tool_name);
    if (from_date) items = items.filter(t => new Date(t.executed_at) >= new Date(from_date));
    if (to_date) items = items.filter(t => new Date(t.executed_at) <= new Date(to_date));
    return items.slice(offset, offset + limit);
  }

  // ========= ワークスペースファイル =========
  addConversationFile(conversationId, fileInfo) {
    const files = this.conversationFiles.get(conversationId);
    if (!files) return null;
    const now = new Date().toISOString();
    const file = {
      file_id: uuidv4(),
      conversation_id: conversationId,
      file_path: fileInfo.file_path,
      original_name: fileInfo.original_name,
      original_relative_path: fileInfo.original_relative_path || null,
      file_size: fileInfo.file_size || 0,
      mime_type: fileInfo.mime_type || 'application/octet-stream',
      version: 1,
      source: fileInfo.source || 'user_upload',
      is_presented: fileInfo.is_presented || false,
      checksum: fileInfo.checksum || null,
      description: fileInfo.description || null,
      created_at: now,
      updated_at: now,
      // 内部用: 実際のコンテンツ(バイナリまたは文字列)
      _content: fileInfo._content || null,
    };
    files.push(file);
    return file;
  }

  getConversationFiles(conversationId) {
    return (this.conversationFiles.get(conversationId) || []).map(f => {
      const { _content, ...rest } = f;
      return rest;
    });
  }

  getConversationFile(conversationId, filePath) {
    const files = this.conversationFiles.get(conversationId) || [];
    return files.find(f => f.file_path === filePath) || null;
  }

  getPresentedFiles(conversationId) {
    return this.getConversationFiles(conversationId).filter(f => f.is_presented);
  }

  // ========= ヘルパー =========
  _defaultModelId(tenantId) {
    const tenant = this.tenants.get(tenantId);
    if (tenant && tenant.model_id) return tenant.model_id;
    const models = [...this.models.values()].filter(m => m.status === 'active');
    return models.length > 0 ? models[0].model_id : 'claude-sonnet-4';
  }
}

// シングルトン
const store = new Store();
module.exports = store;
