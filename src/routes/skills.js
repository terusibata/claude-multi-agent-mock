/**
 * Agent Skills API
 * 本家: /app/api/skills.py
 */
const { Router } = require('express');
const { crc32 } = require('node:zlib');
const multer = require('multer');
const store = require('../store');
const { createErrorResponse } = require('../utils/errorResponse');

/**
 * インメモリの _files マップから無圧縮 ZIP バッファを生成する。
 * 外部ライブラリ不要。本家 (Python zipfile) と同等の出力を返す。
 */
function buildZipBuffer(filesMap) {
  const entries = Object.entries(filesMap);
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const [name, content] of entries) {
    const nameBuf = Buffer.from(name, 'utf-8');
    const dataBuf = Buffer.from(content, 'utf-8');
    const crc = crc32(dataBuf);

    // Local file header (30 bytes + filename + data)
    const local = Buffer.alloc(30 + nameBuf.length + dataBuf.length);
    local.writeUInt32LE(0x04034b50, 0);    // signature
    local.writeUInt16LE(20, 4);             // version needed
    local.writeUInt16LE(0, 6);              // flags
    local.writeUInt16LE(0, 8);              // compression: stored
    local.writeUInt16LE(0, 10);             // mod time
    local.writeUInt16LE(0, 12);             // mod date
    local.writeUInt32LE(crc, 14);           // crc-32
    local.writeUInt32LE(dataBuf.length, 18); // compressed size
    local.writeUInt32LE(dataBuf.length, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26); // filename length
    local.writeUInt16LE(0, 28);             // extra field length
    nameBuf.copy(local, 30);
    dataBuf.copy(local, 30 + nameBuf.length);
    localHeaders.push(local);

    // Central directory header (46 bytes + filename)
    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);   // signature
    central.writeUInt16LE(20, 4);            // version made by
    central.writeUInt16LE(20, 6);            // version needed
    central.writeUInt16LE(0, 8);             // flags
    central.writeUInt16LE(0, 10);            // compression: stored
    central.writeUInt16LE(0, 12);            // mod time
    central.writeUInt16LE(0, 14);            // mod date
    central.writeUInt32LE(crc, 16);          // crc-32
    central.writeUInt32LE(dataBuf.length, 20); // compressed size
    central.writeUInt32LE(dataBuf.length, 24); // uncompressed size
    central.writeUInt16LE(nameBuf.length, 28); // filename length
    central.writeUInt16LE(0, 30);            // extra field length
    central.writeUInt16LE(0, 32);            // file comment length
    central.writeUInt16LE(0, 34);            // disk number start
    central.writeUInt16LE(0, 36);            // internal file attributes
    central.writeUInt32LE(0, 38);            // external file attributes
    central.writeUInt32LE(offset, 42);       // relative offset of local header
    nameBuf.copy(central, 46);
    centralHeaders.push(central);

    offset += local.length;
  }

  const cdOffset = offset;
  const cdSize = centralHeaders.reduce((s, b) => s + b.length, 0);

  // End of central directory (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);       // signature
  eocd.writeUInt16LE(0, 4);                // disk number
  eocd.writeUInt16LE(0, 6);                // disk with CD
  eocd.writeUInt16LE(entries.length, 8);   // entries on disk
  eocd.writeUInt16LE(entries.length, 10);  // total entries
  eocd.writeUInt32LE(cdSize, 12);          // size of CD
  eocd.writeUInt32LE(cdOffset, 16);        // offset of CD
  eocd.writeUInt16LE(0, 20);              // comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

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
    return res.status(404).json(createErrorResponse(req, 'NOT_FOUND', `スキル ${req.params.skill_id} が見つかりません。`));
  }
  const { _files, ...rest } = skill;
  res.json(rest);
});

// POST /api/tenants/:tenant_id/skills - スキル作成
router.post('/', upload.array('additional_files', 20), (req, res) => {
  const { name, display_title, description, skill_md, slash_command, slash_command_description } = req.body || {};
  if (!name || !skill_md) {
    return res.status(422).json(createErrorResponse(req, 'VALIDATION_ERROR', 'name と skill_md は必須です。'));
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
    return res.status(404).json(createErrorResponse(req, 'NOT_FOUND', `スキル ${req.params.skill_id} が見つかりません。`));
  }
  const updated = store.updateSkill(req.params.skill_id, req.body);
  const { _files, ...rest } = updated;
  res.json(rest);
});

// GET /api/tenants/:tenant_id/skills/:skill_id/archive - スキルアーカイブダウンロード
// 本家: app/api/skills.py download_skill_archive - ZIPファイルとして返却
router.get('/:skill_id/archive', (req, res) => {
  const skill = store.getSkill(req.params.skill_id);
  if (!skill || skill.tenant_id !== req.params.tenant_id) {
    return res.status(404).json(createErrorResponse(req, 'NOT_FOUND', `スキル ${req.params.skill_id} が見つかりません。`));
  }
  const zipBuf = buildZipBuffer(skill._files);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${skill.name}.zip"`);
  res.send(zipBuf);
});

// PUT /api/tenants/:tenant_id/skills/:skill_id/files - スキルファイル更新
router.put('/:skill_id/files', upload.array('files', 20), (req, res) => {
  const skill = store.getSkill(req.params.skill_id);
  if (!skill || skill.tenant_id !== req.params.tenant_id) {
    return res.status(404).json(createErrorResponse(req, 'NOT_FOUND', `スキル ${req.params.skill_id} が見つかりません。`));
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
    return res.status(404).json(createErrorResponse(req, 'NOT_FOUND', `スキル ${req.params.skill_id} が見つかりません。`));
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
    return res.status(404).json(createErrorResponse(req, 'NOT_FOUND', `スキル ${req.params.skill_id} が見つかりません。`));
  }
  const content = skill._files[req.params.filePath];
  if (content === undefined) {
    return res.status(404).json(createErrorResponse(req, 'NOT_FOUND', `ファイル ${req.params.filePath} が見つかりません。`));
  }
  res.json({ content });
});

// DELETE /api/tenants/:tenant_id/skills/:skill_id - スキル削除
router.delete('/:skill_id', (req, res) => {
  const skill = store.getSkill(req.params.skill_id);
  if (!skill || skill.tenant_id !== req.params.tenant_id) {
    return res.status(404).json(createErrorResponse(req, 'NOT_FOUND', `スキル ${req.params.skill_id} が見つかりません。`));
  }
  store.deleteSkill(req.params.skill_id);
  res.status(204).end();
});

module.exports = router;
