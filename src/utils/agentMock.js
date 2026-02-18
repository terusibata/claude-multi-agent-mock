/**
 * AIエージェント モックシナリオ生成
 *
 * claude-multi-agent のストリーミング動作を忠実にシミュレート。
 * ランダムに様々なツール利用シナリオを生成し、
 * リアルなエージェント応答をSSEで返す。
 *
 * すべての応答は日本語。
 */
const { v4: uuidv4 } = require('uuid');
const sse = require('./sse');
const store = require('../store');
const { getSampleFile, getRandomFilename } = require('./sampleFiles');

// ========= ランダム選択ヘルパー =========
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ========= ツール定義 =========
const AVAILABLE_TOOLS = [
  { name: 'Read', description: 'ファイルの読み取り' },
  { name: 'Write', description: 'ファイルの書き込み' },
  { name: 'Edit', description: 'ファイルの編集' },
  { name: 'Bash', description: 'コマンドの実行' },
  { name: 'Glob', description: 'ファイルパターン検索' },
  { name: 'Grep', description: 'テキスト検索' },
  { name: 'WebSearch', description: 'Web検索' },
  { name: 'WebFetch', description: 'Webコンテンツ取得' },
  { name: 'Task', description: 'サブエージェント起動' },
  { name: 'TodoWrite', description: 'タスクリスト管理' },
  { name: 'NotebookEdit', description: 'Jupyter Notebook編集' },
];

// ========= ツール使用シナリオ =========

function scenarioReadFile(conversationId) {
  const filenames = ['src/app.py', 'package.json', 'README.md', 'src/utils/helpers.ts', 'config/settings.yaml', 'tests/test_main.py'];
  const filename = pick(filenames);
  const toolUseId = uuidv4();
  return {
    toolUseId,
    toolName: 'Read',
    input: { file_path: `/workspace/${filename}` },
    summary: `${filename} を読み取り中...`,
    resultStatus: 'completed',
    resultContent: `ファイル ${filename} の内容を読み取りました（${randInt(20, 200)}行）`,
    resultSummary: `${filename} の読み取り完了`,
    afterText: `\`${filename}\` の内容を確認しました。`,
  };
}

function scenarioWriteFile(conversationId) {
  const targets = [
    { name: 'report.md', desc: '分析レポート' },
    { name: 'config.json', desc: '設定ファイル' },
    { name: 'index.html', desc: 'HTMLページ' },
    { name: 'app.py', desc: 'Pythonスクリプト' },
    { name: 'component.tsx', desc: 'Reactコンポーネント' },
    { name: 'schema.sql', desc: 'データベーススキーマ' },
    { name: 'styles.css', desc: 'スタイルシート' },
    { name: 'data.csv', desc: 'CSVデータ' },
  ];
  const target = pick(targets);
  const toolUseId = uuidv4();

  // ファイルをストアに追加
  const sample = getSampleFile(target.name);
  store.addConversationFile(conversationId, {
    file_path: target.name,
    original_name: target.name,
    file_size: sample.content.length,
    mime_type: sample.mime_type,
    source: 'ai_created',
    is_presented: true,
    _content: sample.content,
  });

  return {
    toolUseId,
    toolName: 'Write',
    input: { file_path: `/workspace/${target.name}`, content: '...' },
    summary: `${target.desc}を作成中...`,
    resultStatus: 'completed',
    resultContent: `${target.name} を作成しました（${sample.content.length} bytes）`,
    resultSummary: `${target.desc}の作成完了`,
    afterText: `\`${target.name}\` を作成しました。`,
    createdFile: target.name,
  };
}

function scenarioEditFile() {
  const targets = ['src/main.py', 'src/components/App.tsx', 'lib/utils.js', 'src/api/routes.py'];
  const filename = pick(targets);
  const toolUseId = uuidv4();
  const edits = [
    'エラーハンドリングを追加',
    'バリデーションロジックを修正',
    'パフォーマンス最適化',
    '型定義を更新',
    'ログ出力を追加',
  ];
  const edit = pick(edits);
  return {
    toolUseId,
    toolName: 'Edit',
    input: { file_path: `/workspace/${filename}`, old_string: '...', new_string: '...' },
    summary: `${filename} を編集中（${edit}）...`,
    resultStatus: 'completed',
    resultContent: `${filename}: ${edit}を適用しました`,
    resultSummary: `${filename} の編集完了`,
    afterText: `\`${filename}\` の${edit}が完了しました。`,
  };
}

function scenarioBash() {
  const commands = [
    { cmd: 'npm run test', desc: 'テストを実行中', result: '全 24 テストが成功しました（実行時間: 3.2s）' },
    { cmd: 'npm run build', desc: 'ビルドを実行中', result: 'ビルド完了。出力先: dist/ （バンドルサイズ: 245KB）' },
    { cmd: 'pip install -r requirements.txt', desc: '依存パッケージをインストール中', result: '12 パッケージのインストールが完了しました' },
    { cmd: 'python -m pytest tests/', desc: 'Pytestを実行中', result: '18 passed, 0 failed, 2 skipped（実行時間: 5.1s）' },
    { cmd: 'git status', desc: 'Gitステータスを確認中', result: '変更: 3ファイル, 追加: 1ファイル, 削除: 0ファイル' },
    { cmd: 'docker compose up -d', desc: 'Docker環境を起動中', result: '3つのサービスが正常に起動しました' },
    { cmd: 'curl -s http://localhost:8000/health', desc: 'ヘルスチェックを実行中', result: '{"status": "healthy", "database": "ok", "redis": "ok"}' },
    { cmd: 'npm run lint', desc: 'Lintを実行中', result: 'ESLint: 0 errors, 2 warnings' },
  ];
  const cmd = pick(commands);
  const toolUseId = uuidv4();
  return {
    toolUseId,
    toolName: 'Bash',
    input: { command: cmd.cmd },
    summary: cmd.desc,
    resultStatus: 'completed',
    resultContent: cmd.result,
    resultSummary: `コマンド実行完了: ${cmd.cmd}`,
    afterText: `\`${cmd.cmd}\` の実行が完了しました。`,
  };
}

function scenarioGlob() {
  const patterns = [
    { pattern: '**/*.py', desc: 'Pythonファイル', count: randInt(5, 30) },
    { pattern: 'src/**/*.tsx', desc: 'TSXコンポーネント', count: randInt(3, 15) },
    { pattern: '**/*.test.js', desc: 'テストファイル', count: randInt(8, 20) },
    { pattern: 'config/**/*', desc: '設定ファイル', count: randInt(2, 8) },
  ];
  const p = pick(patterns);
  const toolUseId = uuidv4();
  return {
    toolUseId,
    toolName: 'Glob',
    input: { pattern: p.pattern },
    summary: `${p.desc}を検索中...`,
    resultStatus: 'completed',
    resultContent: `${p.count}件のファイルが見つかりました（パターン: ${p.pattern}）`,
    resultSummary: `${p.count}件のファイルを検出`,
    afterText: `\`${p.pattern}\` で ${p.count}件のファイルが見つかりました。`,
  };
}

function scenarioGrep() {
  const searches = [
    { pattern: 'TODO|FIXME', desc: 'TODO/FIXMEコメント', count: randInt(3, 15) },
    { pattern: 'import.*from', desc: 'import文', count: randInt(20, 80) },
    { pattern: 'async function', desc: '非同期関数', count: randInt(5, 25) },
    { pattern: 'class\\s+\\w+', desc: 'クラス定義', count: randInt(3, 12) },
    { pattern: 'console\\.log', desc: 'デバッグログ', count: randInt(1, 10) },
  ];
  const s = pick(searches);
  const toolUseId = uuidv4();
  return {
    toolUseId,
    toolName: 'Grep',
    input: { pattern: s.pattern, path: '/workspace' },
    summary: `${s.desc}を検索中...`,
    resultStatus: 'completed',
    resultContent: `${s.count}件のマッチが見つかりました（パターン: ${s.pattern}）`,
    resultSummary: `${s.count}件のマッチを検出`,
    afterText: `\`${s.pattern}\` の検索で ${s.count}件のマッチが見つかりました。`,
  };
}

function scenarioWebSearch() {
  const queries = [
    { q: 'React useEffect best practices 2025', desc: 'React ベストプラクティスを調査中' },
    { q: 'FastAPI streaming SSE implementation', desc: 'FastAPIのSSE実装を調査中' },
    { q: 'Docker multi-stage build optimization', desc: 'Dockerビルド最適化を調査中' },
    { q: 'PostgreSQL indexing strategy large tables', desc: 'PostgreSQLインデックス戦略を調査中' },
  ];
  const q = pick(queries);
  const toolUseId = uuidv4();
  return {
    toolUseId,
    toolName: 'WebSearch',
    input: { query: q.q },
    summary: q.desc,
    resultStatus: 'completed',
    resultContent: `検索結果: 5件の関連ドキュメントが見つかりました`,
    resultSummary: 'Web検索完了',
    afterText: `Web検索の結果をもとに情報を整理しました。`,
  };
}

function scenarioTodoWrite() {
  const toolUseId = uuidv4();
  const tasks = [
    ['要件の分析と整理', 'コードベースの調査', '実装', 'テスト作成', '動作確認'],
    ['既存コードの確認', 'バグの原因特定', '修正の実装', 'リグレッションテスト'],
    ['APIの設計', 'エンドポイントの実装', 'バリデーション追加', 'テスト実施', 'ドキュメント更新'],
  ];
  const taskList = pick(tasks);
  return {
    toolUseId,
    toolName: 'TodoWrite',
    input: {
      todos: taskList.map((t, i) => ({
        content: t,
        status: i === 0 ? 'in_progress' : 'pending',
        activeForm: t + '中',
      })),
    },
    summary: 'タスクリストを作成中...',
    resultStatus: 'completed',
    resultContent: `${taskList.length}件のタスクを作成しました`,
    resultSummary: 'タスクリスト作成完了',
    afterText: `作業計画をまとめました。${taskList.length}つのステップで進めます。`,
  };
}

// ========= サブエージェントシナリオ =========
function scenarioSubagent() {
  const agents = [
    { type: 'Explore', desc: 'コードベースの構造を分析', result: 'プロジェクト構造の分析完了: 15ディレクトリ、87ファイル' },
    { type: 'Bash', desc: 'テストスイートを実行', result: '全テスト合格（24/24）' },
    { type: 'Plan', desc: '実装計画を策定', result: '5ステップの実装計画を策定しました' },
    { type: 'general-purpose', desc: 'ライブラリの互換性を調査', result: '依存関係の互換性チェック完了。問題なし' },
  ];
  const agent = pick(agents);
  return {
    agentId: uuidv4().slice(0, 7),
    agentType: agent.type,
    description: agent.desc,
    resultPreview: agent.result,
    model: 'claude-sonnet-4',
  };
}

// ========= メインのシナリオ生成 =========

const SCENARIO_GENERATORS = [
  scenarioReadFile,
  scenarioWriteFile,
  scenarioEditFile,
  scenarioBash,
  scenarioGlob,
  scenarioGrep,
  scenarioWebSearch,
  scenarioTodoWrite,
];

// ========= 応答テキストパターン =========
const OPENING_TEXTS = [
  'はい、承知しました。早速取り掛かります。',
  'ご依頼の内容を確認しました。対応いたします。',
  'なるほど、理解しました。順を追って進めていきますね。',
  'ありがとうございます。では作業を開始します。',
  'お任せください。まず状況を確認してから進めます。',
  'わかりました。いくつかのステップに分けて対応します。',
];

const CLOSING_TEXTS = [
  '以上で作業が完了しました。他にご質問があればお気軽にどうぞ。',
  '処理が完了しました。結果をご確認ください。何か調整が必要であればお知らせください。',
  '作業完了です。期待通りの動作になっているか確認をお願いします。',
  '全ての対応が終わりました。追加の修正やご要望があれば、いつでもお声がけください。',
  '完了しました。もし問題や改善点がありましたら、お知らせください。',
];

const MIDDLE_TEXTS = [
  '次のステップに進みます。',
  '続いて、関連するファイルも確認しましょう。',
  '良い進捗です。もう少し調べてみます。',
  'ここまでの結果を踏まえて、次の作業に移ります。',
  '問題なさそうですね。残りの作業を進めます。',
];

/**
 * メインのストリーミングシミュレーション
 *
 * @param {object} res - Express レスポンスオブジェクト（SSE）
 * @param {object} options - { conversationId, userInput, model, sessionId }
 */
async function simulateAgentStream(res, options) {
  const {
    conversationId,
    userInput,
    model = 'claude-sonnet-4',
    sessionId: existingSessionId,
    tenantId,
    userId,
  } = options;

  sse.resetSeq();
  const sessionId = existingSessionId || `session-${uuidv4().slice(0, 8)}`;
  const startTime = Date.now();

  // 使用するツールリスト（ランダムにサブセット）
  const toolSubset = AVAILABLE_TOOLS.slice(0, randInt(6, AVAILABLE_TOOLS.length));
  const toolNames = toolSubset.map(t => t.name);

  // 1. init イベント (ドキュメント仕様: event名は "init")
  sse.sendSSE(res, 'init', sse.formatInitEvent(sessionId, toolNames, model, conversationId));
  await sleep(randInt(100, 300));

  // 会話にsession_idを紐付け
  store.updateConversation(conversationId, { session_id: sessionId });

  // 2. 最初のテキスト応答
  // 本家: progress(type="generating") → assistant のペア
  // ※ thinking は現在無効化されているため送信しない
  const openingText = pick(OPENING_TEXTS);
  sse.sendSSE(res, 'progress', sse.formatProgressEvent('generating', '応答を生成中です...'));
  await sleep(randInt(50, 150));
  sse.sendSSE(res, 'assistant', sse.formatAssistantEvent([{ type: 'text', text: openingText }]));
  store.addMessageLog(conversationId, {
    message_type: 'assistant',
    message_subtype: 'text',
    content: { text: openingText },
  });
  await sleep(randInt(200, 500));

  // 4. ツール使用シナリオ（1〜4回）
  const numTools = randInt(1, 4);
  const toolScenarios = [];

  for (let i = 0; i < numTools; i++) {
    const generator = pick(SCENARIO_GENERATORS);
    const scenario = generator(conversationId);
    toolScenarios.push(scenario);

    // progress イベント (type: "tool", tool_status: "running")
    sse.sendSSE(res, 'progress', sse.formatProgressEvent(
      'tool',
      scenario.summary,
      { tool_use_id: scenario.toolUseId, tool_name: scenario.toolName, tool_status: 'running' }
    ));
    await sleep(randInt(100, 250));

    // tool_call イベント (ドキュメント仕様: event名は "tool_call")
    sse.sendSSE(res, 'tool_call', sse.formatToolCallEvent(
      scenario.toolUseId,
      scenario.toolName,
      scenario.input,
      scenario.summary
    ));

    store.addMessageLog(conversationId, {
      message_type: 'assistant',
      message_subtype: 'tool_use',
      content: {
        tool_use_id: scenario.toolUseId,
        tool_name: scenario.toolName,
        input: scenario.input,
      },
    });
    await sleep(randInt(400, 1200));

    // tool_result イベント (status: "completed" | "error")
    const isError = Math.random() < 0.05; // 5%の確率でエラー
    sse.sendSSE(res, 'tool_result', sse.formatToolResultEvent(
      scenario.toolUseId,
      scenario.toolName,
      isError ? 'error' : 'completed',
      isError ? 'ツールの実行中にエラーが発生しました。リトライします。' : scenario.resultContent,
      isError
    ));

    store.addMessageLog(conversationId, {
      message_type: 'user_result',
      message_subtype: 'tool_result',
      content: {
        tool_use_id: scenario.toolUseId,
        tool_name: scenario.toolName,
        status: isError ? 'error' : 'completed',
      },
    });

    // ツールログ記録
    store.addToolLog({
      session_id: sessionId,
      conversation_id: conversationId,
      tool_name: scenario.toolName,
      tool_use_id: scenario.toolUseId,
      tool_input: scenario.input,
      tool_output: scenario.resultContent,
      status: isError ? 'error' : 'completed',
      execution_time_ms: randInt(50, 2000),
    });

    // progress 完了 (type: "tool", tool_status: "completed" or "error")
    sse.sendSSE(res, 'progress', sse.formatProgressEvent(
      'tool',
      scenario.resultSummary || scenario.summary,
      { tool_use_id: scenario.toolUseId, tool_name: scenario.toolName, tool_status: isError ? 'error' : 'completed' }
    ));
    await sleep(randInt(150, 400));

    // ツール間のテキスト応答（最後以外）
    if (i < numTools - 1 && Math.random() > 0.4) {
      const middleText = pick(MIDDLE_TEXTS);
      sse.sendSSE(res, 'assistant', sse.formatAssistantEvent([{ type: 'text', text: middleText }]));
      await sleep(randInt(150, 350));
    }
  }

  // 5. サブエージェント利用（30%の確率）
  if (Math.random() > 0.7) {
    const sub = scenarioSubagent();
    sse.sendSSE(res, 'subagent_start', sse.formatSubagentStartEvent(
      sub.agentId, sub.agentType, sub.description, sub.model
    ));
    await sleep(randInt(500, 1500));

    sse.sendSSE(res, 'subagent_end', sse.formatSubagentEndEvent(
      sub.agentId, sub.agentType, 'completed', sub.resultPreview
    ));
    await sleep(randInt(200, 400));
  }

  // 6. タイトル生成（新規会話時・50%の確率）
  const conv = store.getConversation(conversationId);
  if (conv && !conv.title) {
    const titles = [
      `${userInput.slice(0, 20)}...に関する対応`,
      'コード分析と修正',
      'ファイル作成・編集タスク',
      'プロジェクト環境構築',
      'バグ修正と改善',
      'データ分析レポート',
      'API実装タスク',
      'テスト作成・実行',
    ];
    const title = pick(titles);
    store.updateConversation(conversationId, { title });
    sse.sendSSE(res, 'title', sse.formatTitleEvent(title));
    await sleep(randInt(100, 200));
  }

  // 7. 最終テキスト応答
  const closingText = pick(CLOSING_TEXTS);
  sse.sendSSE(res, 'assistant', sse.formatAssistantEvent([{ type: 'text', text: closingText }]));
  store.addMessageLog(conversationId, {
    message_type: 'assistant',
    message_subtype: 'text',
    content: { text: closingText },
  });
  await sleep(randInt(100, 300));

  // 8. context_status イベント
  const contextTokens = randInt(5000, 80000);
  const maxTokens = 200000;
  sse.sendSSE(res, 'context_status', sse.formatContextStatusEvent(contextTokens, maxTokens));
  store.updateConversation(conversationId, { estimated_context_tokens: contextTokens });

  // 9. done イベント
  const inputTokens = randInt(1000, 15000);
  const outputTokens = randInt(500, 8000);
  const cacheRead = randInt(0, 5000);
  const cache5m = randInt(0, 2000);
  const durationMs = Date.now() - startTime;

  const usage = {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_creation_5m_tokens: cache5m,
    cache_creation_1h_tokens: 0,
    cache_read_tokens: cacheRead,
    total_tokens: inputTokens + outputTokens + cacheRead + cache5m,
  };

  const costUsd = ((inputTokens * 0.003 + outputTokens * 0.015 + cacheRead * 0.0003 + cache5m * 0.00375) / 1000).toFixed(6);

  sse.sendSSE(res, 'done', sse.formatDoneEvent({
    status: 'success',
    result: closingText,
    usage,
    costUsd,
    turnCount: numTools + 1,
    durationMs,
    sessionId,
  }));

  // トークン数を会話に反映
  store.updateConversation(conversationId, {
    total_input_tokens: (conv.total_input_tokens || 0) + inputTokens,
    total_output_tokens: (conv.total_output_tokens || 0) + outputTokens,
  });

  // 使用状況ログ
  store.addUsageLog({
    tenant_id: tenantId,
    user_id: userId,
    model_id: model,
    session_id: sessionId,
    conversation_id: conversationId,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_creation_5m_tokens: cache5m,
    cache_read_tokens: cacheRead,
    total_tokens: usage.total_tokens,
    cost_usd: costUsd,
  });
}

/**
 * シンプルチャット用ストリーミング
 * ツール使用なし、テキストのみ
 */
async function simulateSimpleChatStream(res, options) {
  const { chatId, message, applicationContext } = options;
  let seq = 0;

  const responses = {
    translationApp: [
      'ご依頼の翻訳を行います。\n\n',
      '原文の内容を解析しています...\n\n',
      '翻訳結果：\n\n> ',
      `「${message.slice(0, 30)}...」の翻訳が完了しました。\n\n`,
      'ニュアンスを保ちつつ、自然な表現になるよう調整しました。修正が必要な箇所があれば、お知らせください。',
    ],
    summarizer: [
      '要約を作成します。\n\n',
      '## 要約\n\n',
      '主要なポイントを抽出中...\n\n',
      '- ポイント1: 入力テキストの核心的な内容\n',
      '- ポイント2: 補足的な情報の整理\n',
      '- ポイント3: 今後のアクションに関する提案\n\n',
      '以上が要約です。さらに詳しい分析が必要な場合はお知らせください。',
    ],
    chatbot: [
      'お問い合わせありがとうございます。',
      '\n\nご質問の内容について回答いたします。',
      `\n\n「${message.slice(0, 20)}...」に関してですが、`,
      '\n\nいくつかの観点から考えることができます。',
      '\n\n1. まず基本的な点として、適切な設計パターンの選択が重要です。',
      '\n2. 次に、パフォーマンスとスケーラビリティの観点から検討します。',
      '\n3. 最後に、メンテナンス性を考慮した実装を推奨します。',
      '\n\n何か追加のご質問があれば、お気軽にどうぞ。',
    ],
  };

  const chunks = responses[applicationContext] || responses.chatbot;
  let fullText = '';

  for (const chunk of chunks) {
    seq++;
    fullText += chunk;
    const payload = JSON.stringify(sse.formatSimpleTextDeltaEvent(seq, chunk));
    res.write(`event: message\ndata: ${payload}\n\n`);
    await sleep(randInt(80, 250));
  }

  // done
  seq++;
  const inputTokens = randInt(200, 2000);
  const outputTokens = randInt(100, 1500);
  const donePayload = JSON.stringify(sse.formatSimpleDoneEvent(seq, {
    title: message.slice(0, 30),
    usage: { input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: inputTokens + outputTokens },
    costUsd: ((inputTokens * 0.003 + outputTokens * 0.015) / 1000).toFixed(6),
  }));
  res.write(`event: done\ndata: ${donePayload}\n\n`);

  return { fullText, inputTokens, outputTokens };
}

module.exports = {
  simulateAgentStream,
  simulateSimpleChatStream,
  AVAILABLE_TOOLS,
};
