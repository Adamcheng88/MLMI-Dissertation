const fs = require('fs');
const path = require('path');
const express = require('express');
const OpenAI = require('openai');
const db = require('../db');
const { buildTreeOverview } = require('../lib/treeOverview');
const { buildNodeContext } = require('../lib/nodeContext');

const router = express.Router();

const MODEL = 'gpt-5-nano';
const SYSTEM_PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'coach-system.txt');
const MAX_HISTORY = 20;


const HANDOFF_MARKER = '@@HANDOFF@@';


function loadSystemPrompt() {
  try {
    return fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf8').trim();
  } catch {
    return 'You are a helpful coach explaining a decision tree to a domain expert who is not familiar with machine learning.';
  }
}



function studyTreeOverview() {
  try {
    const row = db.prepare('SELECT tree_json FROM experiment_settings WHERE id = 1').get();
    if (!row || !row.tree_json) return '';
    return buildTreeOverview(JSON.parse(row.tree_json));
  } catch {
    return '';
  }
}

const FORMAT_INSTRUCTION =
  'Format your response using GitHub-flavored Markdown: use short paragraphs separated by blank lines, ' +
  '**bold** for emphasis, and bulleted or numbered lists where they make the answer clearer. Keep it readable and well spaced.';

const ASK_INSTRUCTION =
  'The user pressed ASK. Explain clearly as a coach and end with one or two guiding follow-up questions. ' +
  FORMAT_INSTRUCTION;

const ADVISE_INSTRUCTION =
  'The user pressed ADVISE: they are giving guidance for how the tree should change in the next generation round. ' +
  'First, confirm you have accepted the advice and summarize, in plain language, what you plan to do to act on it. ' +
  FORMAT_INSTRUCTION + '\n\n' +
  `After that summary, output a line containing exactly ${HANDOFF_MARKER} on its own, ` +
  'and then a concise, self-contained handoff snippet (plain text, no markdown) directing the tree-generation agent to make the concrete change. ' +
  `Everything before ${HANDOFF_MARKER} is shown to the user; everything after it is the handoff for the next generation step.`;

router.post('/chat', async (req, res) => {
  const apiKey = process.env.OPEN_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'The AI assistant is not configured (missing API key).' });
    return;
  }

  const { mode, message, conversationHistory, attachedNodes, treeOverview } = req.body || {};
  if (typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'A message is required.' });
    return;
  }
  const isAdvise = mode === 'advise';

  const overview = (typeof treeOverview === 'string' && treeOverview.trim())
    ? treeOverview.trim()
    : studyTreeOverview();
  const nodeContext = buildNodeContext(Array.isArray(attachedNodes) ? attachedNodes : []);

  const systemParts = [loadSystemPrompt()];
  if (overview) systemParts.push(`Here is an overview of the entire decision tree:\n\n${overview}`);
  systemParts.push(isAdvise ? ADVISE_INSTRUCTION : ASK_INSTRUCTION);

  const history = Array.isArray(conversationHistory)
    ? conversationHistory
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-MAX_HISTORY)
        .map(m => ({ role: m.role, content: m.content }))
    : [];

  const userContent = nodeContext
    ? `The user has attached these nodes as context:\n\n${nodeContext}\n\n---\n\nUser message:\n${message}`
    : message;

  const messages = [
    { role: 'system', content: systemParts.join('\n\n') },
    ...history,
    { role: 'user', content: userContent },
  ];


  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    const client = new OpenAI({ apiKey });
    const stream = await client.chat.completions.create({
      model: MODEL,
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) send({ delta });
    }
    send({ done: true });
    res.end();
  } catch (err) {
    console.error('Chat request failed:', err.message);

    send({ error: 'The AI assistant could not be reached. Please try again.' });
    res.end();
  }
});

module.exports = router;
