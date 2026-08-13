const express = require('express');
const db = require('../db');

const router = express.Router();



router.get('/settings', (req, res) => {
  const row = db.prepare('SELECT * FROM experiment_settings WHERE id = 1').get();
  if (!row) {
    res.status(404).json({ error: 'Settings not initialised' });
    return;
  }
  res.json({
    timeLimitMinutes: row.time_limit_minutes,
    landingText: row.landing_text,
    instructionsText: row.instructions_text || row.task_a_instructions_text,
    finishingText: row.finishing_text || row.task_a_finishing_text,
  });
});


router.get('/study-tree', (req, res) => {
  const row = db.prepare('SELECT * FROM experiment_settings WHERE id = 1').get();
  const treeJson = row && (row.tree_json || row.task_a_tree_json);
  if (!treeJson) {
    res.status(404).json({ error: 'No study tree configured' });
    return;
  }
  try {
    res.json(JSON.parse(treeJson));
  } catch {
    res.status(500).json({ error: 'Stored study tree is invalid JSON' });
  }
});



router.get('/expert-tree', (req, res) => {
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



router.get('/questions', (req, res) => {
  const rows = db
    .prepare('SELECT id, prompt, type, options_json FROM experiment_questions WHERE active = 1')
    .all();
  res.json(
    rows.map(r => ({
      id: r.id,
      prompt: r.prompt,
      type: r.type,
      options: r.options_json ? JSON.parse(r.options_json) : null,
    }))
  );
});

module.exports = router;
