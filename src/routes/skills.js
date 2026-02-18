/**
 * Agent Skills API
 * 本家: /app/api/skills.py
 */
const { Router } = require('express');
const multer = require('multer');
const store = require('../store');

const router = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/tenants/:tenant_id/skills - スキル一覧
router.get('/', (req, res) => {
  const { status } = req.query;
  const items = store.listSkills(req.params.tenant_id, { status });
  // 内部プロパティを除外
  const cleaned = items.map(({ _files, ...rest }) => rest);
  res.json(cleaned);
});

// GET /api/tenants/:tenant_id/skills/slash-commands - スラッシュコマンド一覧
// 本家: SlashCommandListResponse = { items: [{ skill_id, name, slash_command, description }] }
router.get('/slash-commands', (req, res) => {
  const skills = store.listSkills(req.params.tenant_id, { status: 'active' });
  const items = skills
    .filter(s => s.slash_command)
    .map(s => ({
      skill_id: s.skill_id,
      name: s.name,
      slash_command: s.slash_command,
      description: s.slash_command_description || null,
    }));
  res.json({ items });
});

// GET /api/tenants/:tenant_id/skills/:skill_id - スキル取得
router.get('/:skill_id', (req, res) => {
  const skill = store.getSkill(req.params.skill_id);
  if (!skill || skill.tenant_id !== req.params.tenant_id) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `スキル ${req.params.skill_id} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  const { _files, ...rest } = skill;
  res.json(rest);
});

// POST /api/tenants/:tenant_id/skills - スキル作成
router.post('/', upload.array('additional_files', 20), (req, res) => {
  const { name, display_title, description, skill_md, slash_command, slash_command_description } = req.body || {};
  if (!name || !skill_md) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'name と skill_md は必須です。',
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  const skill = store.createSkill(req.params.tenant_id, {
    name,
    display_title,
    description,
    skill_md,
    slash_command,
    slash_command_description,
  });

  // 追加ファイルの保存
  if (req.files) {
    for (const file of req.files) {
      skill._files[file.originalname] = file.buffer.toString('utf-8');
    }
  }

  const { _files, ...rest } = skill;
  res.status(201).json(rest);
});

// PUT /api/tenants/:tenant_id/skills/:skill_id - スキルメタデータ更新
router.put('/:skill_id', (req, res) => {
  const skill = store.getSkill(req.params.skill_id);
  if (!skill || skill.tenant_id !== req.params.tenant_id) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `スキル ${req.params.skill_id} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  const updated = store.updateSkill(req.params.skill_id, req.body);
  const { _files, ...rest } = updated;
  res.json(rest);
});

// PUT /api/tenants/:tenant_id/skills/:skill_id/files - スキルファイル更新
router.put('/:skill_id/files', upload.array('files', 20), (req, res) => {
  const skill = store.getSkill(req.params.skill_id);
  if (!skill || skill.tenant_id !== req.params.tenant_id) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `スキル ${req.params.skill_id} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  if (req.files) {
    for (const file of req.files) {
      skill._files[file.originalname] = file.buffer.toString('utf-8');
    }
    skill.version += 1;
    skill.updated_at = new Date().toISOString();
  }
  const { _files, ...rest } = skill;
  res.json(rest);
});

// GET /api/tenants/:tenant_id/skills/:skill_id/files - ファイル一覧
// 本家: SkillFilesResponse = { skill_id, skill_name, files: [{ filename, path, size, modified_at }] }
router.get('/:skill_id/files', (req, res) => {
  const skill = store.getSkill(req.params.skill_id);
  if (!skill || skill.tenant_id !== req.params.tenant_id) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `スキル ${req.params.skill_id} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  const files = Object.keys(skill._files).map(name => ({
    filename: name,
    path: `${skill.file_path}${name}`,
    size: Buffer.byteLength(skill._files[name], 'utf-8'),
    modified_at: skill.updated_at,
  }));
  res.json({ skill_id: skill.skill_id, skill_name: skill.name, files });
});

// GET /api/tenants/:tenant_id/skills/:skill_id/files/:file_path - ファイル内容取得
// Express 5: ワイルドカードは *name 構文（path-to-regexp v8）
router.get('/:skill_id/files/*filePath', (req, res) => {
  const skill = store.getSkill(req.params.skill_id);
  if (!skill || skill.tenant_id !== req.params.tenant_id) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `スキル ${req.params.skill_id} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  const content = skill._files[req.params.filePath];
  if (content === undefined) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `ファイル ${req.params.filePath} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  res.json({ content });
});

// DELETE /api/tenants/:tenant_id/skills/:skill_id - スキル削除
router.delete('/:skill_id', (req, res) => {
  const skill = store.getSkill(req.params.skill_id);
  if (!skill || skill.tenant_id !== req.params.tenant_id) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `スキル ${req.params.skill_id} が見つかりません。`,
        request_id: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  }
  store.deleteSkill(req.params.skill_id);
  res.status(204).end();
});

module.exports = router;
