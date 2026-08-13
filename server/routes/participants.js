const express = require('express');
const { customAlphabet } = require('nanoid');
const db = require('../db');
const {
  generateAssignment,
  nextStep,
  stepIndex,
  STEP_ORDER,
} = require('../assignment');

const router = express.Router();


const makeSuffix = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

function newParticipantId() {
  for (let i = 0; i < 10; i++) {
    const id = `P-${makeSuffix()}`;
    const existing = db.prepare('SELECT id FROM participants WHERE id = ?').get(id);
    if (!existing) return id;
  }
  throw new Error('Could not generate a unique participant id');
}

function getParticipant(id) {
  return db.prepare('SELECT * FROM participants WHERE id = ?').get(id);
}

function activeQuestionIds() {
  return db
    .prepare('SELECT id FROM experiment_questions WHERE active = 1 ORDER BY sort_order ASC')
    .all()
    .map(r => r.id);
}




function previousConditionBefore(id) {
  const self = db.prepare('SELECT rowid FROM participants WHERE id = ?').get(id);
  if (!self) return null;
  const row = db
    .prepare(
      `SELECT condition FROM participants
       WHERE rowid < ?
       ORDER BY rowid DESC
       LIMIT 1`
    )
    .get(self.rowid);
  return row ? row.condition : null;
}

function parseAssignment(participant) {
  try {
    const a = participant.assignment_json ? JSON.parse(participant.assignment_json) : null;
    if (a && a.condition) return a;
  } catch {

  }
  const previous = previousConditionBefore(participant.id);
  return generateAssignment(activeQuestionIds(), previous);
}

function parseStudyData(participant) {
  try {
    return participant.study_data_json ? JSON.parse(participant.study_data_json) : {};
  } catch {
    return {};
  }
}

function saveStudyData(id, data) {
  db.prepare('UPDATE participants SET study_data_json = ? WHERE id = ?').run(JSON.stringify(data), id);
}

function serializeState(row) {
  return {
    advice: JSON.parse(row.advice),
    submittedAdvice: JSON.parse(row.submitted_advice),
    versionNames: JSON.parse(row.version_names),
    uploadedTrees: JSON.parse(row.uploaded_trees),
    chatConversations: JSON.parse(row.chat_conversations),
    uiPreferences: JSON.parse(row.ui_preferences),
  };
}

function emptyState() {
  return {
    advice: [],
    submittedAdvice: [],
    versionNames: {},
    uploadedTrees: [],
    chatConversations: [],
    uiPreferences: {},
  };
}



router.post('/participants', (req, res) => {
  const prolificPid =
    typeof req.body?.prolificPid === 'string' && req.body.prolificPid.trim()
      ? req.body.prolificPid.trim().slice(0, 255)
      : null;
  const userAgent =
    typeof req.headers['user-agent'] === 'string' && req.headers['user-agent'].trim()
      ? req.headers['user-agent'].trim().slice(0, 1024)
      : null;
  const studyData = {};
  if (prolificPid) studyData.prolificPid = prolificPid;
  if (userAgent) studyData.userAgent = userAgent;

  const created = db.transaction(() => {
    const lastCondition = db
      .prepare(
        `SELECT condition FROM participants
         ORDER BY rowid DESC
         LIMIT 1`
      )
      .get();
    const id = newParticipantId();
    const now = new Date().toISOString();
    const assignment = generateAssignment(
      activeQuestionIds(),
      lastCondition ? lastCondition.condition : null
    );
    db.prepare(
      `INSERT INTO participants
         (id, created_at, status, condition, assignment_json, current_step, study_data_json)
       VALUES (?, ?, 'active', ?, ?, 'instructions', ?)`
    ).run(id, now, assignment.condition, JSON.stringify(assignment), JSON.stringify(studyData));
    db.prepare('INSERT INTO participant_state (participant_id, updated_at) VALUES (?, ?)').run(
      id,
      now
    );
    db.prepare(
      'INSERT INTO participant_events (participant_id, timestamp, event_type, payload) VALUES (?, ?, ?, ?)'
    ).run(id, now, 'assignment_created', JSON.stringify(assignment));
    return { id, now, assignment };
  })();

  res.status(201).json({
    id: created.id,
    createdAt: created.now,
    status: 'active',
    condition: created.assignment.condition,
    questionOrder: created.assignment.questionOrder,
    currentStep: 'instructions',
  });
});


router.get('/participants', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const rows = q
    ? db
        .prepare(
          `SELECT id, created_at, status FROM participants
           WHERE id LIKE ? ORDER BY created_at DESC LIMIT 50`
        )
        .all(`%${q}%`)
    : db
        .prepare('SELECT id, created_at, status FROM participants ORDER BY created_at DESC LIMIT 50')
        .all();
  res.json(rows.map(r => ({ id: r.id, createdAt: r.created_at, status: r.status })));
});


router.get('/participants/:id', (req, res) => {
  const participant = getParticipant(req.params.id);
  if (!participant) {
    res.status(404).json({ error: 'Participant not found' });
    return;
  }
  const stateRow = db
    .prepare('SELECT * FROM participant_state WHERE participant_id = ?')
    .get(req.params.id);
  const state = stateRow ? serializeState(stateRow) : emptyState();
  const assignment = parseAssignment(participant);
  res.json({
    id: participant.id,
    createdAt: participant.created_at,
    startedAt: participant.started_at,
    completedAt: participant.completed_at,
    status: participant.status,
    condition: participant.condition || assignment.condition,
    questionOrder: assignment.questionOrder || [],
    currentStep: participant.current_step || 'instructions',
    studyData: parseStudyData(participant),
    state,
  });
});


router.get('/participants/:id/progress', (req, res) => {
  const participant = getParticipant(req.params.id);
  if (!participant) {
    res.status(404).json({ error: 'Participant not found' });
    return;
  }
  const assignment = parseAssignment(participant);
  res.json({
    currentStep: participant.current_step || 'instructions',
    condition: participant.condition || assignment.condition,
    questionOrder: assignment.questionOrder || [],
    status: participant.status,
  });
});



router.post('/participants/:id/progress', (req, res) => {
  const participant = getParticipant(req.params.id);
  if (!participant) {
    res.status(404).json({ error: 'Participant not found' });
    return;
  }
  if (participant.status === 'completed') {
    res.status(409).json({ error: 'Participant has already completed the study' });
    return;
  }
  const current = participant.current_step || 'instructions';
  const target = typeof req.body?.step === 'string' ? req.body.step : nextStep(current);
  const expected = nextStep(current);



  if (target !== expected && target !== current) {
    res.status(400).json({ error: `Cannot move from "${current}" to "${target}"` });
    return;
  }

  const data = parseStudyData(participant);
  if (req.body && req.body.data && typeof req.body.data === 'object') {
    Object.assign(data, req.body.data);
  }
  data.stepTimestamps = data.stepTimestamps || {};
  data.stepTimestamps[target] = new Date().toISOString();
  saveStudyData(participant.id, data);

  if (target !== current) {
    db.prepare('UPDATE participants SET current_step = ? WHERE id = ?').run(target, participant.id);
  }
  res.json({ ok: true, currentStep: target });
});


router.post('/participants/:id/start', (req, res) => {
  const participant = getParticipant(req.params.id);
  if (!participant) {
    res.status(404).json({ error: 'Participant not found' });
    return;
  }
  if (participant.status === 'completed') {
    res.status(409).json({ error: 'Participant has already completed the study' });
    return;
  }
  if (!participant.started_at) {
    const now = new Date().toISOString();
    db.prepare('UPDATE participants SET started_at = ? WHERE id = ?').run(now, participant.id);
    participant.started_at = now;
  }
  res.json({ id: participant.id, startedAt: participant.started_at });
});


router.post('/participants/:id/task-responses', (req, res) => {
  const participant = getParticipant(req.params.id);
  if (!participant) {
    res.status(404).json({ error: 'Participant not found' });
    return;
  }
  const responses = Array.isArray(req.body) ? req.body : req.body && req.body.responses;
  if (!Array.isArray(responses)) {
    res.status(400).json({ error: 'Expected an array of responses' });
    return;
  }
  const data = parseStudyData(participant);
  data.taskResponses = responses;
  saveStudyData(participant.id, data);
  res.json({ ok: true, count: responses.length });
});


router.post('/participants/:id/surveys', (req, res) => {
  const participant = getParticipant(req.params.id);
  if (!participant) {
    res.status(404).json({ error: 'Participant not found' });
    return;
  }
  const body = req.body || {};
  const data = parseStudyData(participant);
  const nasaTlx = body.nasaTlx && typeof body.nasaTlx === 'object' ? body.nasaTlx : {};
  const sus = Array.isArray(body.sus) ? body.sus.map(n => Number(n) || 0) : [];
  const qualitativeFeedback =
    typeof body.qualitativeFeedback === 'string' ? body.qualitativeFeedback.trim() : '';
  const attentionCheck =
    body.attentionCheck != null && Number.isFinite(Number(body.attentionCheck))
      ? Number(body.attentionCheck)
      : null;



  let susScore = null;
  if (sus.length === 10) {
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += (i % 2 === 0 ? sus[i] - 1 : 5 - sus[i]);
    }
    susScore = sum * 2.5;
  }

  data.surveys = {
    nasaTlx,
    sus,
    susScore,
    attentionCheck,
    attentionCheckPassed: attentionCheck === 1,
    qualitativeFeedback,
    submittedAt: new Date().toISOString(),
  };
  saveStudyData(participant.id, data);

  const now = new Date().toISOString();
  db.prepare(
    "UPDATE participants SET status = 'completed', completed_at = ?, current_step = 'complete' WHERE id = ?"
  ).run(now, participant.id);

  res.json({ ok: true, susScore, completedAt: now });
});


router.post('/participants/:id/complete', (req, res) => {
  const participant = getParticipant(req.params.id);
  if (!participant) {
    res.status(404).json({ error: 'Participant not found' });
    return;
  }
  const now = new Date().toISOString();
  const data = parseStudyData(participant);
  if (participant.status !== 'completed') {
    data.withdrawn = true;
    data.withdrawnAt = now;
    data.withdrawnStep = participant.current_step || 'instructions';
    saveStudyData(participant.id, data);
    db.prepare("UPDATE participants SET status = 'completed', completed_at = ? WHERE id = ?").run(
      now,
      participant.id
    );
  }
  res.json({ id: participant.id, status: 'completed', completedAt: now });
});


router.put('/participants/:id/state', (req, res) => {
  const participant = getParticipant(req.params.id);
  if (!participant) {
    res.status(404).json({ error: 'Participant not found' });
    return;
  }
  const body = req.body || {};
  const existing = db
    .prepare('SELECT * FROM participant_state WHERE participant_id = ?')
    .get(req.params.id);
  const current = existing ? serializeState(existing) : emptyState();

  const merged = {
    advice: body.advice ?? current.advice,
    submittedAdvice: body.submittedAdvice ?? current.submittedAdvice,
    versionNames: body.versionNames ?? current.versionNames,
    uploadedTrees: body.uploadedTrees ?? current.uploadedTrees,
    chatConversations: body.chatConversations ?? current.chatConversations,
    uiPreferences: body.uiPreferences ?? current.uiPreferences,
  };
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO participant_state
       (participant_id, advice, submitted_advice, version_names, uploaded_trees, chat_conversations, ui_preferences, updated_at)
     VALUES (@participant_id, @advice, @submitted_advice, @version_names, @uploaded_trees, @chat_conversations, @ui_preferences, @updated_at)
     ON CONFLICT(participant_id) DO UPDATE SET
       advice = @advice,
       submitted_advice = @submitted_advice,
       version_names = @version_names,
       uploaded_trees = @uploaded_trees,
       chat_conversations = @chat_conversations,
       ui_preferences = @ui_preferences,
       updated_at = @updated_at`
  ).run({
    participant_id: req.params.id,
    advice: JSON.stringify(merged.advice),
    submitted_advice: JSON.stringify(merged.submittedAdvice),
    version_names: JSON.stringify(merged.versionNames),
    uploaded_trees: JSON.stringify(merged.uploadedTrees),
    chat_conversations: JSON.stringify(merged.chatConversations),
    ui_preferences: JSON.stringify(merged.uiPreferences),
    updated_at: now,
  });

  res.json({ ok: true, updatedAt: now });
});


router.post('/participants/:id/events', (req, res) => {
  const participant = getParticipant(req.params.id);
  if (!participant) {
    res.status(404).json({ error: 'Participant not found' });
    return;
  }
  const events = Array.isArray(req.body) ? req.body : req.body && req.body.events;
  if (!Array.isArray(events)) {
    res.status(400).json({ error: 'Expected an array of events' });
    return;
  }
  const insert = db.prepare(
    'INSERT INTO participant_events (participant_id, timestamp, event_type, payload) VALUES (?, ?, ?, ?)'
  );
  const insertMany = db.transaction(items => {
    for (const ev of items) {
      insert.run(
        req.params.id,
        ev.timestamp || new Date().toISOString(),
        String(ev.type || ev.event_type || 'unknown'),
        ev.payload != null ? JSON.stringify(ev.payload) : null
      );
    }
  });
  insertMany(events);
  res.status(201).json({ ok: true, count: events.length });
});


router.get('/participants/:id/remaining', (req, res) => {
  const participant = getParticipant(req.params.id);
  if (!participant) {
    res.status(404).json({ error: 'Participant not found' });
    return;
  }
  const settings = db.prepare('SELECT time_limit_minutes FROM experiment_settings WHERE id = 1').get();
  const limitSeconds = (settings ? settings.time_limit_minutes : 30) * 60;

  if (participant.status === 'completed') {
    res.json({ remainingSeconds: 0, status: participant.status, started: true, expired: true });
    return;
  }
  if (!participant.started_at) {
    res.json({ remainingSeconds: limitSeconds, status: participant.status, started: false, expired: false });
    return;
  }
  const elapsed = (Date.now() - new Date(participant.started_at).getTime()) / 1000;
  const remaining = Math.max(0, Math.round(limitSeconds - elapsed));
  res.json({ remainingSeconds: remaining, status: participant.status, started: true, expired: remaining <= 0 });
});

module.exports = router;
module.exports.STEP_ORDER = STEP_ORDER;
module.exports.stepIndex = stepIndex;
