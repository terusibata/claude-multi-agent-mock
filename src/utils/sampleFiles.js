/**
 * サンプルファイル生成
 * 各種ファイル形式のモックコンテンツを提供
 */

const SAMPLE_FILES = {
  // ========= テキスト系 =========
  'report.md': {
    mime_type: 'text/markdown',
    content: `# 分析レポート

## 概要
本レポートはデータ分析の結果をまとめたものです。

## 主要な発見事項
1. ユーザーアクティビティが前月比で15%増加
2. 平均セッション時間が3分延長
3. コンバージョン率が2.3%改善

## 推奨アクション
- ダッシュボードの改善を推奨
- A/Bテストの継続実施

## まとめ
全体的にポジティブな傾向が確認されました。
`,
  },

  'config.json': {
    mime_type: 'application/json',
    content: JSON.stringify({
      version: '1.0.0',
      settings: {
        theme: 'dark',
        language: 'ja',
        notifications: { email: true, slack: true },
        api: { timeout: 30000, retries: 3 },
      },
      features: {
        dashboard: true,
        analytics: true,
        export: false,
      },
    }, null, 2),
  },

  'data.csv': {
    mime_type: 'text/csv',
    content: `日付,ユーザー数,セッション数,コンバージョン率
2025-01-01,1250,3400,2.1%
2025-01-02,1380,3650,2.3%
2025-01-03,1420,3800,2.5%
2025-01-04,1100,2900,1.8%
2025-01-05,1050,2700,1.9%
2025-01-06,1500,4100,2.7%
2025-01-07,1620,4350,2.8%
`,
  },

  'app.py': {
    mime_type: 'text/x-python',
    content: `"""サンプルPythonアプリケーション"""
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="サンプルAPI")

class Item(BaseModel):
    name: str
    price: float
    quantity: int = 1

items_db: list[Item] = []

@app.get("/items")
async def list_items():
    return {"items": items_db}

@app.post("/items")
async def create_item(item: Item):
    items_db.append(item)
    return {"message": "アイテムを追加しました", "item": item}
`,
  },

  'index.html': {
    mime_type: 'text/html',
    content: `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>サンプルダッシュボード</title>
  <style>
    body { font-family: sans-serif; margin: 2rem; }
    .card { border: 1px solid #ddd; padding: 1rem; margin: 1rem 0; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>ダッシュボード</h1>
  <div class="card"><h2>アクティブユーザー</h2><p>1,520</p></div>
  <div class="card"><h2>本日のリクエスト</h2><p>45,200</p></div>
</body>
</html>
`,
  },

  'styles.css': {
    mime_type: 'text/css',
    content: `:root {
  --primary: #2563eb;
  --secondary: #64748b;
  --bg: #f8fafc;
  --text: #1e293b;
}

body {
  font-family: 'Noto Sans JP', sans-serif;
  background-color: var(--bg);
  color: var(--text);
  margin: 0;
  padding: 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.btn-primary {
  background-color: var(--primary);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  cursor: pointer;
}
`,
  },

  'schema.sql': {
    mime_type: 'text/plain',
    content: `-- サンプルデータベーススキーマ
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
`,
  },

  'component.tsx': {
    mime_type: 'text/typescript',
    content: `import React, { useState, useEffect } from 'react';

interface DashboardProps {
  tenantId: string;
  userId: string;
}

interface Stats {
  activeUsers: number;
  totalRequests: number;
  avgResponseTime: number;
}

export const Dashboard: React.FC<DashboardProps> = ({ tenantId, userId }) => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      const res = await fetch(\`/api/tenants/\${tenantId}/usage/summary\`);
      const data = await res.json();
      setStats(data);
      setLoading(false);
    };
    fetchStats();
  }, [tenantId]);

  if (loading) return <div>読み込み中...</div>;

  return (
    <div className="dashboard">
      <h1>ダッシュボード</h1>
      <div className="stats-grid">
        <div className="stat-card">
          <span>アクティブユーザー</span>
          <strong>{stats?.activeUsers ?? 0}</strong>
        </div>
        <div className="stat-card">
          <span>合計リクエスト</span>
          <strong>{stats?.totalRequests ?? 0}</strong>
        </div>
      </div>
    </div>
  );
};
`,
  },

  'Dockerfile': {
    mime_type: 'text/plain',
    content: `FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/server.js"]
`,
  },

  'requirements.txt': {
    mime_type: 'text/plain',
    content: `fastapi==0.128.0
uvicorn[standard]==0.40.0
pydantic==2.12.5
sqlalchemy[asyncio]==2.0.45
asyncpg==0.31.0
redis==5.2.1
boto3==1.42.27
httpx==0.28.1
structlog==25.5.0
`,
  },
};

// ========= バイナリ系サンプル =========
// 最小限の有効なバイナリを生成

function generateMinimalPNG() {
  // 1x1 赤ピクセルPNG
  const hex = '89504e470d0a1a0a0000000d49484452000000010000000108020000009001' +
    '2e00000000c4944415478016360f8cf0000000201014837f2d70000000049454e44ae426082';
  return Buffer.from(hex, 'hex');
}

function generateMinimalPDF() {
  const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 24 Tf 100 700 Td (Sample PDF) Tj ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000360 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
441
%%EOF`;
  return Buffer.from(content, 'utf-8');
}

function generateMinimalXLSX() {
  // 極小のXLSX-likeバイナリ (ZIPヘッダ + 最小構造)
  // 実際はZIPフォーマット; ここではPKヘッダのみのプレースホルダ
  const header = Buffer.from('504b0304', 'hex');
  const filler = Buffer.alloc(256, 0);
  return Buffer.concat([header, filler]);
}

const BINARY_FILES = {
  'chart.png': {
    mime_type: 'image/png',
    content: generateMinimalPNG(),
  },
  'report.pdf': {
    mime_type: 'application/pdf',
    content: generateMinimalPDF(),
  },
  'data.xlsx': {
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    content: generateMinimalXLSX(),
  },
};

/**
 * ファイル名からサンプルコンテンツを取得
 */
function getSampleFile(filename) {
  // 完全一致
  if (SAMPLE_FILES[filename]) {
    const f = SAMPLE_FILES[filename];
    return { content: Buffer.from(f.content, 'utf-8'), mime_type: f.mime_type };
  }
  if (BINARY_FILES[filename]) {
    const f = BINARY_FILES[filename];
    return { content: f.content, mime_type: f.mime_type };
  }

  // 拡張子ベースのフォールバック
  const ext = filename.split('.').pop().toLowerCase();
  const extMap = {
    md: { mime: 'text/markdown', sample: 'report.md' },
    json: { mime: 'application/json', sample: 'config.json' },
    csv: { mime: 'text/csv', sample: 'data.csv' },
    py: { mime: 'text/x-python', sample: 'app.py' },
    html: { mime: 'text/html', sample: 'index.html' },
    css: { mime: 'text/css', sample: 'styles.css' },
    sql: { mime: 'text/plain', sample: 'schema.sql' },
    tsx: { mime: 'text/typescript', sample: 'component.tsx' },
    ts: { mime: 'text/typescript', sample: 'component.tsx' },
    jsx: { mime: 'text/javascript', sample: 'component.tsx' },
    js: { mime: 'text/javascript', sample: 'component.tsx' },
    txt: { mime: 'text/plain', sample: 'requirements.txt' },
    png: { mime: 'image/png', sample: 'chart.png' },
    jpg: { mime: 'image/jpeg', sample: 'chart.png' },
    jpeg: { mime: 'image/jpeg', sample: 'chart.png' },
    pdf: { mime: 'application/pdf', sample: 'report.pdf' },
    xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', sample: 'data.xlsx' },
    docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sample: 'data.xlsx' },
    dockerfile: { mime: 'text/plain', sample: 'Dockerfile' },
  };

  const mapped = extMap[ext];
  if (mapped) {
    const src = SAMPLE_FILES[mapped.sample] || BINARY_FILES[mapped.sample];
    const content = typeof src.content === 'string' ? Buffer.from(src.content, 'utf-8') : src.content;
    return { content, mime_type: mapped.mime };
  }

  // デフォルト: プレーンテキスト
  return {
    content: Buffer.from(`# ${filename}\nサンプルファイルの内容です。\n`, 'utf-8'),
    mime_type: 'text/plain',
  };
}

/**
 * ランダムにファイル名を選択
 */
function getRandomFilename() {
  const allFiles = [...Object.keys(SAMPLE_FILES), ...Object.keys(BINARY_FILES)];
  return allFiles[Math.floor(Math.random() * allFiles.length)];
}

module.exports = { SAMPLE_FILES, BINARY_FILES, getSampleFile, getRandomFilename };
