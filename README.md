# claude-multi-agent-mock

`claude-multi-agent` (AWS Bedrock + Claude Agent SDK マルチエージェントバックエンド) の Node.js モックサーバー。

全データはインメモリ保持。外部依存なし（DB, Redis, S3, Docker不要）で即座に起動可能。

## セットアップ

```bash
npm install
npm start        # ポート8000で起動
npm run dev      # --watch モード (ファイル変更時自動リスタート)

# ポート変更
APP_PORT=3000 npm start
```

## API エンドポイント一覧

本家と同じURLパス構造。

### ヘルスチェック
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/health` | 詳細ヘルスチェック |
| GET | `/health/live` | Kubernetes liveness probe |
| GET | `/health/ready` | Kubernetes readiness probe |
| GET | `/metrics` | Prometheusメトリクス |

### テナント管理
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/tenants` | テナント一覧 |
| POST | `/api/tenants` | テナント作成 |
| GET | `/api/tenants/:tenant_id` | テナント取得 |
| PUT | `/api/tenants/:tenant_id` | テナント更新 |
| DELETE | `/api/tenants/:tenant_id` | テナント削除 |

### モデル管理
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/models` | モデル一覧 |
| POST | `/api/models` | モデル作成 |
| GET | `/api/models/:model_id` | モデル取得 |
| PUT | `/api/models/:model_id` | モデル更新 |
| PATCH | `/api/models/:model_id/status` | ステータス変更 |
| DELETE | `/api/models/:model_id` | モデル削除 |

### 会話 (CRUD + ストリーミング)
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/tenants/:tid/conversations` | 会話一覧 |
| POST | `/api/tenants/:tid/conversations` | 会話作成 |
| GET | `/api/tenants/:tid/conversations/:cid` | 会話取得 |
| PUT | `/api/tenants/:tid/conversations/:cid` | 会話更新 |
| POST | `/api/tenants/:tid/conversations/:cid/archive` | アーカイブ |
| DELETE | `/api/tenants/:tid/conversations/:cid` | 会話削除 |
| GET | `/api/tenants/:tid/conversations/:cid/messages` | メッセージログ |
| **POST** | `/api/tenants/:tid/conversations/:cid/stream` | **SSEストリーミング** |

### シンプルチャット
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/tenants/:tid/simple-chats` | チャット一覧 |
| GET | `/api/tenants/:tid/simple-chats/:chat_id` | チャット取得 |
| POST | `/api/tenants/:tid/simple-chats/:chat_id/archive` | アーカイブ |
| DELETE | `/api/tenants/:tid/simple-chats/:chat_id` | チャット削除 |
| **POST** | `/api/tenants/:tid/simple-chats/stream` | **SSEストリーミング** |

### Agent Skills
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/tenants/:tid/skills` | スキル一覧 |
| GET | `/api/tenants/:tid/skills/slash-commands` | スラッシュコマンド一覧 |
| GET | `/api/tenants/:tid/skills/:sid` | スキル取得 |
| POST | `/api/tenants/:tid/skills` | スキル作成 (multipart) |
| PUT | `/api/tenants/:tid/skills/:sid` | メタデータ更新 |
| PUT | `/api/tenants/:tid/skills/:sid/files` | ファイル更新 |
| GET | `/api/tenants/:tid/skills/:sid/files` | ファイル一覧 |
| GET | `/api/tenants/:tid/skills/:sid/files/:path` | ファイル内容取得 |
| DELETE | `/api/tenants/:tid/skills/:sid` | スキル削除 |

### MCPサーバー
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/tenants/:tid/mcp-servers` | MCP一覧 |
| GET | `/api/tenants/:tid/mcp-servers/builtin` | ビルトインMCP |
| GET | `/api/tenants/:tid/mcp-servers/:sid` | MCP取得 |
| POST | `/api/tenants/:tid/mcp-servers` | MCP作成 |
| PUT | `/api/tenants/:tid/mcp-servers/:sid` | MCP更新 |
| DELETE | `/api/tenants/:tid/mcp-servers/:sid` | MCP削除 |

### 使用状況・コスト
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/tenants/:tid/usage` | 使用状況ログ |
| GET | `/api/tenants/:tid/usage/users/:uid` | ユーザー別使用状況 |
| GET | `/api/tenants/:tid/usage/summary` | 使用状況サマリー |
| GET | `/api/tenants/:tid/cost-report` | コストレポート |
| GET | `/api/tenants/:tid/tool-logs` | ツール実行ログ |

### ワークスペース・ファイル
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/tenants/:tid/conversations/:cid/files` | ファイル一覧 |
| GET | `/api/tenants/:tid/conversations/:cid/files/download?path=...` | ファイルダウンロード |
| GET | `/api/tenants/:tid/conversations/:cid/files/presented` | 提示ファイル一覧 |

## 認証

全APIリクエストに `X-API-Key` ヘッダーが必要（値は任意）。

```bash
curl -H "X-API-Key: any-value" http://localhost:8000/api/tenants
```

## SSEストリーミング

会話ストリーミングは `multipart/form-data` で送信:

```bash
curl -N -X POST \
  -H "X-API-Key: test" \
  -F 'request_data={"user_input":"こんにちは","executor":{"user_id":"u1","name":"太郎","email":"taro@example.com"}}' \
  http://localhost:8000/api/tenants/demo-tenant/conversations/{id}/stream
```

### SSEイベント種別

| イベント | 説明 |
|---------|------|
| `session_start` | セッション開始 (session_id, tools, model) |
| `thinking` | 思考プロセス |
| `assistant` | テキスト応答 |
| `tool_use` | ツール呼び出し開始 |
| `tool_result` | ツール実行結果 |
| `subagent_start` | サブエージェント開始 |
| `subagent_end` | サブエージェント完了 |
| `progress` | 進捗更新 |
| `title` | 会話タイトル生成 |
| `context_status` | コンテキスト使用状況 |
| `done` | 完了 (usage, cost, duration) |
| `error` | エラー |
| `ping` | ハートビート |

## モック動作

- AIエージェント応答はランダムシナリオ生成（日本語）
- Read, Write, Edit, Bash, Glob, Grep, WebSearch, Task 等のツール使用をシミュレート
- サブエージェント（Explore, Plan等）の起動もランダムに発生
- ファイル作成時はサンプルコンテンツ (md, json, csv, py, html, css, sql, tsx, png, pdf, xlsx等) を自動生成
- トークン数・コストはリアルな範囲でランダム計算

## 初期データ

起動時に以下が自動投入:
- **モデル**: Claude Sonnet 4, Haiku 4, Opus 4
- **テナント**: `demo-tenant`, `test-tenant`
- **スキル**: コードレビュー (`/review`), ドキュメント生成 (`/docs`)
- **MCPサーバー**: ServiceNow連携
