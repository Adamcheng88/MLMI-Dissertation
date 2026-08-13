const express = require('express');
const multer = require('multer');
const db = require('../db');
const { makeQuestionId } = require('../db');
const { summarizeAssignment } = require('../assignment');
const {
  verifyPassword,
  createSession,
  destroySession,
  isValidSession,
  requireAdmin,
  TOKEN_TTL_MS,
} = require('../middleware/adminAuth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  maxAge: TOKEN_TTL_MS,
  path: '/',
};

router.post('/admin/login', (req, res) => {
  const password = req.body && req.body.password;
  if (!verifyPassword(password)) {
    res.status(401).json({ error: 'Invalid password' });
    return;
  }
  const token = createSession();
  res.cookie('admin_token', token, cookieOptions);
  res.json({ ok: true });
});

router.post('/admin/logout', (req, res) => {
  const token = req.cookies && req.cookies.admin_token;
  destroySession(token);
  res.clearCookie('admin_token', { path: '/' });
  res.json({ ok: true });
});

router.get('/admin/me', (req, res) => {
  const token = req.cookies && req.cookies.admin_token;
  res.json({ authenticated: isValidSession(token) });
});


router.use('/admin', requireAdmin);

function treeMetaFromJson(treeJson) {
  if (!treeJson) return null;
  try {
    const parsed = JSON.parse(treeJson);
    return { rootId: parsed.root_id, nodeCount: Array.isArray(parsed.nodes) ? parsed.nodes.length : 0 };
  } catch {
    return { error: 'stored tree is invalid' };
  }
}

router.get('/admin/settings', (req, res) => {
  const row = db.prepare('SELECT * FROM experiment_settings WHERE id = 1').get();
  res.json({
    timeLimitMinutes: row.time_limit_minutes,
    landingText: row.landing_text,
    instructionsText: row.instructions_text || row.task_a_instructions_text,
    finishingText: row.finishing_text || row.task_a_finishing_text,
    treeMeta: treeMetaFromJson(row.tree_json || row.task_a_tree_json),
    expertTreeMeta: treeMetaFromJson(row.expert_tree_json),
  });
});

router.put('/admin/settings', (req, res) => {
  const row = db.prepare('SELECT * FROM experiment_settings WHERE id = 1').get();
  const body = req.body || {};
  const timeLimit = Number.isFinite(body.timeLimitMinutes)
    ? Math.max(1, Math.round(body.timeLimitMinutes))
    : row.time_limit_minutes;
  db.prepare(
    `UPDATE experiment_settings SET
       time_limit_minutes = ?,
       landing_text = ?,
       instructions_text = ?,
       finishing_text = ?
     WHERE id = 1`
  ).run(
    timeLimit,
    body.landingText ?? row.landing_text,
    body.instructionsText ?? row.instructions_text,
    body.finishingText ?? row.finishing_text
  );
  res.json({ ok: true });
});



router.post('/admin/study-tree', upload.single('tree'), (req, res) => {
  let raw;
  if (req.file) {
    raw = req.file.buffer.toString('utf8');
  } else if (req.body && req.body.nodes) {
    raw = JSON.stringify(req.body);
  } else {
    res.status(400).json({ error: 'No tree provided' });
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    res.status(400).json({ error: 'Uploaded file is not valid JSON' });
    return;
  }
  if (!parsed.nodes || !parsed.root_id) {
    res.status(400).json({ error: 'Invalid tree format: missing "nodes" or "root_id"' });
    return;
  }

  db.prepare('UPDATE experiment_settings SET tree_json = ? WHERE id = 1').run(JSON.stringify(parsed));
  res.json({ ok: true, treeMeta: { rootId: parsed.root_id, nodeCount: parsed.nodes.length } });
});


router.get('/admin/study-tree', (req, res) => {
  const row = db.prepare('SELECT * FROM experiment_settings WHERE id = 1').get();
  const treeJson = row.tree_json || row.task_a_tree_json;
  if (!treeJson) {
    res.status(404).json({ error: 'No tree configured' });
    return;
  }
  try {
    res.json(JSON.parse(treeJson));
  } catch {
    res.status(500).json({ error: 'Stored tree is invalid JSON' });
  }
});




router.post('/admin/expert-tree', upload.single('tree'), (req, res) => {
  let raw;
  if (req.file) {
    raw = req.file.buffer.toString('utf8');
  } else if (req.body && req.body.nodes) {
    raw = JSON.stringify(req.body);
  } else {
    res.status(400).json({ error: 'No tree provided' });
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    res.status(400).json({ error: 'Uploaded file is not valid JSON' });
    return;
  }
  if (!parsed.nodes || !parsed.root_id) {
    res.status(400).json({ error: 'Invalid tree format: missing "nodes" or "root_id"' });
    return;
  }

  db.prepare('UPDATE experiment_settings SET expert_tree_json = ? WHERE id = 1').run(JSON.stringify(parsed));
  res.json({ ok: true, treeMeta: { rootId: parsed.root_id, nodeCount: parsed.nodes.length } });
});


router.get('/admin/expert-tree', (req, res) => {
  const row = db.prepare('SELECT * FROM experiment_settings WHERE id = 1').get();
  const treeJson = row && row.expert_tree_json;
  if (!treeJson) {
    res.status(404).json({ error: 'No expert tree configured' });
    return;
  }
  try {
    res.json(JSON.parse(treeJson));
  } catch {
    res.status(500).json({ error: 'Stored expert tree is invalid JSON' });
  }
});



function serializeQuestion(r) {
  return {
    id: r.id,
    prompt: r.prompt,
    type: r.type,
    options: r.options_json ? JSON.parse(r.options_json) : null,
    sortOrder: r.sort_order,
    active: !!r.active,
  };
}

router.get('/admin/questions', (req, res) => {
  const rows = db.prepare('SELECT * FROM experiment_questions ORDER BY sort_order ASC').all();
  res.json(rows.map(serializeQuestion));
});

router.post('/admin/questions', (req, res) => {
  const body = req.body || {};
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const type = body.type === 'mcq' ? 'mcq' : 'text';
  if (!prompt) {
    res.status(400).json({ error: 'Prompt is required' });
    return;
  }
  const options = type === 'mcq' && Array.isArray(body.options)
    ? body.options.map(o => String(o)).filter(o => o.trim())
    : null;
  const maxOrder = db.prepare('SELECT MAX(sort_order) AS m FROM experiment_questions').get().m;
  const id = makeQuestionId();
  db.prepare(
    'INSERT INTO experiment_questions (id, prompt, type, options_json, sort_order, active) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, prompt, type, options ? JSON.stringify(options) : null, (maxOrder ?? -1) + 1, body.active === false ? 0 : 1);
  res.status(201).json(serializeQuestion(db.prepare('SELECT * FROM experiment_questions WHERE id = ?').get(id)));
});

router.put('/admin/questions/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM experiment_questions WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Question not found' });
    return;
  }
  const body = req.body || {};
  const prompt = typeof body.prompt === 'string' && body.prompt.trim() ? body.prompt.trim() : existing.prompt;
  const type = body.type === 'mcq' || body.type === 'text' ? body.type : existing.type;
  let optionsJson = existing.options_json;
  if (body.options !== undefined) {
    optionsJson = type === 'mcq' && Array.isArray(body.options)
      ? JSON.stringify(body.options.map(o => String(o)).filter(o => o.trim()))
      : null;
  } else if (type === 'text') {
    optionsJson = null;
  }
  const active = body.active === undefined ? existing.active : body.active ? 1 : 0;
  const sortOrder = Number.isFinite(body.sortOrder) ? body.sortOrder : existing.sort_order;
  db.prepare(
    'UPDATE experiment_questions SET prompt = ?, type = ?, options_json = ?, active = ?, sort_order = ? WHERE id = ?'
  ).run(prompt, type, optionsJson, active, sortOrder, req.params.id);
  res.json(serializeQuestion(db.prepare('SELECT * FROM experiment_questions WHERE id = ?').get(req.params.id)));
});

router.delete('/admin/questions/:id', (req, res) => {
  const info = db.prepare('DELETE FROM experiment_questions WHERE id = ?').run(req.params.id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Question not found' });
    return;
  }
  res.json({ ok: true });
});


router.post('/admin/questions/reorder', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
  if (!ids) {
    res.status(400).json({ error: 'Expected { ids: [...] }' });
    return;
  }
  const update = db.prepare('UPDATE experiment_questions SET sort_order = ? WHERE id = ?');
  const tx = db.transaction(list => list.forEach((id, i) => update.run(i, id)));
  tx(ids);
  res.json({ ok: true });
});



router.get('/admin/participants', (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.id, p.created_at, p.started_at, p.completed_at, p.status,
              p.condition, p.current_step,
              (SELECT COUNT(*) FROM participant_events e WHERE e.participant_id = p.id) AS event_count
       FROM participants p ORDER BY p.created_at DESC`
    )
    .all();
  res.json(
    rows.map(r => ({
      id: r.id,
      createdAt: r.created_at,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      status: r.status,
      condition: r.condition,
      currentStep: r.current_step || 'instructions',
      eventCount: r.event_count,
      conditionLabel: r.condition === 'real' ? 'Effective' : r.condition === 'baseline' ? 'Baseline' : '—',
    }))
  );
});

router.delete('/admin/participants/:id', (req, res) => {
  const info = db.prepare('DELETE FROM participants WHERE id = ?').run(req.params.id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Participant not found' });
    return;
  }
  res.json({ ok: true });
});


function questionLookup() {
  const rows = db.prepare('SELECT id, prompt, type, options_json FROM experiment_questions').all();
  const map = new Map();
  for (const r of rows) {
    map.set(r.id, {
      prompt: r.prompt,
      type: r.type,
      options: r.options_json ? JSON.parse(r.options_json) : null,
    });
  }
  return map;
}

function enrichTaskResponses(responses, questionsById) {
  if (!Array.isArray(responses)) return [];
  return responses.map(r => {
    const q = questionsById.get(r.questionId);
    return {
      ...r,
      prompt: q ? q.prompt : null,
      type: q ? q.type : null,
      options: q ? q.options : null,
    };
  });
}

function buildExport(participant, questionsById) {
  const stateRow = db
    .prepare('SELECT * FROM participant_state WHERE participant_id = ?')
    .get(participant.id);
  const events = db
    .prepare('SELECT timestamp, event_type, payload FROM participant_events WHERE participant_id = ? ORDER BY id ASC')
    .all(participant.id);

  let assignment = null;
  try {
    assignment = participant.assignment_json ? JSON.parse(participant.assignment_json) : null;
  } catch {
    assignment = null;
  }
  let studyData = {};
  try {
    studyData = participant.study_data_json ? JSON.parse(participant.study_data_json) : {};
  } catch {
    studyData = {};
  }

  return {
    participant: {
      id: participant.id,
      createdAt: participant.created_at,
      startedAt: participant.started_at,
      completedAt: participant.completed_at,
      status: participant.status,
      condition: participant.condition,
      conditionLabel: summarizeAssignment(assignment),
      currentStep: participant.current_step || 'instructions',
      prolificPid: studyData.prolificPid || null,
      userAgent: studyData.userAgent || null,
    },
    assignment,
    studyData: {
      prolificPid: studyData.prolificPid || null,
      infoSheetAcknowledgedAt: studyData.infoSheetAcknowledgedAt || null,
      consent: studyData.consent || null,
      demographics: studyData.demographics || null,
      tutorialViewedAt: studyData.tutorialViewedAt || null,
      stepTimestamps: studyData.stepTimestamps || null,
      withdrawn: !!studyData.withdrawn,
      withdrawnAt: studyData.withdrawnAt || null,
      withdrawnStep: studyData.withdrawnStep || null,
    },
    taskResponses: enrichTaskResponses(studyData.taskResponses, questionsById),
    surveys: studyData.surveys || null,
    state: stateRow
      ? {
          advice: JSON.parse(stateRow.advice),
          submittedAdvice: JSON.parse(stateRow.submitted_advice),
          versionNames: JSON.parse(stateRow.version_names),
          uploadedTrees: JSON.parse(stateRow.uploaded_trees),
          chatConversations: JSON.parse(stateRow.chat_conversations),
          uiPreferences: JSON.parse(stateRow.ui_preferences),
        }
      : null,
    events: events.map(e => ({
      timestamp: e.timestamp,
      type: e.event_type,
      payload: e.payload ? JSON.parse(e.payload) : null,
    })),
  };
}

router.get('/admin/participants/:id/export', (req, res) => {
  const participant = db.prepare('SELECT * FROM participants WHERE id = ?').get(req.params.id);
  if (!participant) {
    res.status(404).json({ error: 'Participant not found' });
    return;
  }
  const questionsById = questionLookup();
  res.setHeader('Content-Disposition', `attachment; filename="${participant.id}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(buildExport(participant, questionsById), null, 2));
});


router.get('/admin/export/all', (req, res) => {
  const participants = db.prepare('SELECT * FROM participants ORDER BY created_at ASC').all();
  const questionsById = questionLookup();
  const exportData = {
    exportedAt: new Date().toISOString(),
    participantCount: participants.length,
    questions: [...questionsById.entries()].map(([id, q]) => ({ id, ...q })),
    participants: participants.map(p => buildExport(p, questionsById)),
  };
  res.setHeader('Content-Disposition', `attachment; filename="study-data-${Date.now()}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(exportData, null, 2));
});

module.exports = router;
