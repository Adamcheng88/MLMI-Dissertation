const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { customAlphabet } = require('nanoid');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'study.db');
const SEED_TREE_PATH = path.join(__dirname, '..', 'deft', 'data', 'tree_paused_refined.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    condition TEXT,
    assignment_json TEXT,
    current_step TEXT NOT NULL DEFAULT 'instructions',
    study_data_json TEXT NOT NULL DEFAULT '{}',
    -- Legacy columns retained so older databases/rows keep working.
    current_block INTEGER NOT NULL DEFAULT 1,
    block1_started_at TEXT,
    block1_completed_at TEXT,
    block2_started_at TEXT,
    block2_completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS experiment_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    time_limit_minutes INTEGER NOT NULL DEFAULT 30,
    landing_text TEXT NOT NULL DEFAULT '',
    instructions_text TEXT NOT NULL DEFAULT '',
    finishing_text TEXT NOT NULL DEFAULT '',
    tree_json TEXT,
    -- Independent tree shown on the standalone expert sample interface (/expert).
    expert_tree_json TEXT,
    -- Legacy per-task columns retained for backwards compatibility.
    task_a_instructions_text TEXT NOT NULL DEFAULT '',
    task_a_finishing_text TEXT NOT NULL DEFAULT '',
    task_a_tree_json TEXT,
    task_b_instructions_text TEXT NOT NULL DEFAULT '',
    task_b_finishing_text TEXT NOT NULL DEFAULT '',
    task_b_tree_json TEXT
  );

  CREATE TABLE IF NOT EXISTS experiment_questions (
    id TEXT PRIMARY KEY,
    prompt TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    options_json TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS participant_state (
    participant_id TEXT PRIMARY KEY,
    advice TEXT NOT NULL DEFAULT '[]',
    submitted_advice TEXT NOT NULL DEFAULT '[]',
    version_names TEXT NOT NULL DEFAULT '{}',
    uploaded_trees TEXT NOT NULL DEFAULT '[]',
    chat_conversations TEXT NOT NULL DEFAULT '[]',
    ui_preferences TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL,
    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS participant_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    participant_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT,
    FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_events_participant ON participant_events(participant_id);
`);



function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

function migrate() {
  ensureColumn('participants', 'condition', 'condition TEXT');
  ensureColumn('participants', 'assignment_json', 'assignment_json TEXT');
  ensureColumn('participants', 'current_step', "current_step TEXT NOT NULL DEFAULT 'instructions'");
  ensureColumn('participants', 'study_data_json', "study_data_json TEXT NOT NULL DEFAULT '{}'");
  ensureColumn('participants', 'current_block', 'current_block INTEGER NOT NULL DEFAULT 1');
  ensureColumn('participants', 'block1_started_at', 'block1_started_at TEXT');
  ensureColumn('participants', 'block1_completed_at', 'block1_completed_at TEXT');
  ensureColumn('participants', 'block2_started_at', 'block2_started_at TEXT');
  ensureColumn('participants', 'block2_completed_at', 'block2_completed_at TEXT');

  ensureColumn('experiment_settings', 'expert_tree_json', 'expert_tree_json TEXT');
  ensureColumn('experiment_settings', 'task_a_instructions_text', "task_a_instructions_text TEXT NOT NULL DEFAULT ''");
  ensureColumn('experiment_settings', 'task_a_finishing_text', "task_a_finishing_text TEXT NOT NULL DEFAULT ''");
  ensureColumn('experiment_settings', 'task_a_tree_json', 'task_a_tree_json TEXT');
  ensureColumn('experiment_settings', 'task_b_instructions_text', "task_b_instructions_text TEXT NOT NULL DEFAULT ''");
  ensureColumn('experiment_settings', 'task_b_finishing_text', "task_b_finishing_text TEXT NOT NULL DEFAULT ''");
  ensureColumn('experiment_settings', 'task_b_tree_json', 'task_b_tree_json TEXT');



  const legacy = db.prepare("SELECT * FROM participants WHERE condition IS NULL").all();
  if (legacy.length) {
    const update = db.prepare('UPDATE participants SET condition = ? WHERE id = ?');
    const tx = db.transaction(rows => {
      for (const p of rows) {
        let cond = Math.random() < 0.5 ? 'real' : 'baseline';
        try {
          const a = p.assignment_json ? JSON.parse(p.assignment_json) : null;
          if (a && a.condition) cond = a.condition;
          else if (a && Array.isArray(a.blocks)) {
            const real = a.blocks.find(b => b.interface === 'real');
            cond = real ? 'real' : 'baseline';
          }
        } catch {

        }
        update.run(cond, p.id);
      }
    });
    tx(legacy);
  }
}

migrate();

function readTreeFile(p) {
  try {
    const txt = fs.readFileSync(p, 'utf8');
    JSON.parse(txt);
    return txt;
  } catch (err) {
    console.warn(`Could not seed study tree from ${p}: ${err.message}`);
    return null;
  }
}

const DEFAULT_LANDING =
  'Welcome to the study. On this site you will explore and give feedback on an ' +
  'interface built for studying decision trees. Click "New User" to begin.';
const DEFAULT_INSTRUCTIONS =
  'In this task you will be shown a decision tree that predicts an outcome from ' +
  'genomic sequence data. Explore the tree and its nodes carefully and answer the ' +
  'questions shown alongside it. When you have answered every question, the task will ' +
  'finish. Please read these instructions before continuing.';
const DEFAULT_FINISHING =
  'Thank you for completing this study. Your responses have been recorded.';

function seedSettings() {
  const row = db.prepare('SELECT * FROM experiment_settings WHERE id = 1').get();
  if (!row) {
    const tree = readTreeFile(SEED_TREE_PATH);
    db.prepare(
      `INSERT INTO experiment_settings
         (id, time_limit_minutes, landing_text, instructions_text, finishing_text, tree_json, expert_tree_json)
       VALUES (1, ?, ?, ?, ?, ?, ?)`
    ).run(30, DEFAULT_LANDING, DEFAULT_INSTRUCTIONS, DEFAULT_FINISHING, tree, tree);
    return;
  }



  if (!row.expert_tree_json) {
    const expertTree = row.tree_json || row.task_a_tree_json || readTreeFile(SEED_TREE_PATH);
    if (expertTree) {
      db.prepare('UPDATE experiment_settings SET expert_tree_json = ? WHERE id = 1').run(expertTree);
    }
  }



  if (!row.tree_json) {
    const tree = row.task_a_tree_json || row.task_b_tree_json || readTreeFile(SEED_TREE_PATH);
    db.prepare(
      `UPDATE experiment_settings SET
         tree_json = ?,
         instructions_text = ?,
         finishing_text = ?
       WHERE id = 1`
    ).run(
      tree,
      row.instructions_text || row.task_a_instructions_text || DEFAULT_INSTRUCTIONS,
      row.finishing_text || row.task_a_finishing_text || DEFAULT_FINISHING
    );
  }
}

seedSettings();

const makeQuestionId = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);

function seedQuestions() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM experiment_questions').get().n;
  if (count > 0) return;
  const defaults = [
    {
      prompt: 'Based on the tree, which single feature is most important for the prediction? Explain briefly.',
      type: 'text',
      options: null,
    },
    {
      prompt: 'How confident are you that this tree makes sensible predictions?',
      type: 'mcq',
      options: ['Not at all confident', 'Slightly confident', 'Moderately confident', 'Very confident', 'Extremely confident'],
    },
    {
      prompt: 'Describe one change you would make to improve this decision tree.',
      type: 'text',
      options: null,
    },
  ];
  const insert = db.prepare(
    'INSERT INTO experiment_questions (id, prompt, type, options_json, sort_order, active) VALUES (?, ?, ?, ?, ?, 1)'
  );
  const tx = db.transaction(items => {
    items.forEach((q, i) => {
      insert.run(makeQuestionId(), q.prompt, q.type, q.options ? JSON.stringify(q.options) : null, i);
    });
  });
  tx(defaults);
}

seedQuestions();

module.exports = db;
module.exports.makeQuestionId = makeQuestionId;
