const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const OpenAI = require('openai');
const { searchScopus, SEARCH_SCOPUS_TOOL, rewritePapersBlock } = require('../lib/scopus');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const MODEL = 'gpt-5-nano';
const SYSTEM_PROMPT_PATH = path.join(__dirname, '..', 'prompts', 'configure-system.txt');
const MAX_HISTORY = 20;
const MAX_FILE_TEXT_CHARS = 40000;

const MAX_TOOL_ROUNDS = 3;

const DELTA_CHUNK_CHARS = 24;

const TEXT_EXT = new Set(['.txt', '.csv']);
const IMAGE_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };


function loadSystemPrompt() {
  try {
    return fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf8').trim();
  } catch {
    return 'You are the Interactive Configuration assistant for DEFT. Help the user configure decision tree parameters in plain language.';
  }
}



function formatTimeEstimate(maxDepth, agentCandidates, agentReflections) {
  const depth = Number(maxDepth);
  const candidates = Number(agentCandidates);
  const reflections = Number(agentReflections);
  if (![depth, candidates, reflections].every(n => Number.isFinite(n))) return '';

  const timeUnits = Math.pow(2, depth) * candidates * (1 + reflections);
  const hours = timeUnits / 2500;
  const timeLabel = hours >= 10 ? '10+ hours'
    : hours >= 1 ? `${hours.toFixed(1)} hours`
    : hours * 60 < 1 ? '< 1 min'
    : `~${Math.round(hours * 60)} min`;
  const severity = hours < 1 ? 'Low' : hours < 5 ? 'Medium' : 'High';
  return `Precomputed estimate for the current numeric settings (maxDepth=${depth}, agentCandidates=${candidates}, agentReflections=${reflections}): ${severity} (${timeLabel}). timeUnits=${timeUnits}. Use this when wrapping up if these are still your final numbers.`;
}

function summarizeConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return '';
  const lines = [];
  if (cfg.targetName) lines.push(`- Target prediction: ${cfg.targetName}`);
  if (cfg.datasetInfo) lines.push(`- Dataset: ${cfg.datasetInfo}`);
  if (cfg.userContext) lines.push(`- Additional context: ${cfg.userContext}`);
  if (cfg.maxDepth != null) lines.push(`- Maximum tree depth: ${cfg.maxDepth}`);
  if (cfg.minSamples != null) lines.push(`- Minimum node sample percentage: ${cfg.minSamples}%`);
  if (cfg.agentCandidates != null) lines.push(`- Agent candidates: ${cfg.agentCandidates}`);
  if (cfg.agentReflections != null) lines.push(`- Agent reflections: ${cfg.agentReflections}`);
  if (!lines.length) return '';
  const estimate = formatTimeEstimate(cfg.maxDepth, cfg.agentCandidates, cfg.agentReflections);
  return `The configuration currently set in the interface is:\n${lines.join('\n')}${estimate ? `\n\n${estimate}` : ''}`;
}

function summarizeAdvice(advice) {
  if (!Array.isArray(advice) || !advice.length) return '';
  const items = advice
    .filter(a => a && typeof a.message === 'string')
    .map((a, i) => {
      const handoff = a.handoffSnippet ? `\n  Handoff: ${a.handoffSnippet}` : '';
      return `${i + 1}. ${a.message}${handoff}`;
    });
  if (!items.length) return '';
  return `The user has already submitted this advice for the next tree generation (treat it as context):\n${items.join('\n')}`;
}



async function runToolCall(toolCall) {
  const name = toolCall.function && toolCall.function.name;
  if (name !== 'search_scopus') {
    return { output: JSON.stringify({ error: `Unknown tool "${name}".` }), results: [] };
  }

  let args = {};
  try {
    args = JSON.parse(toolCall.function.arguments || '{}');
  } catch {
    return { output: JSON.stringify({ error: 'Tool arguments were not valid JSON.' }), results: [] };
  }

  const result = await searchScopus({ query: args.query, count: args.count });
  const results = Array.isArray(result.results) ? result.results : [];
  return { output: JSON.stringify(result), results };
}




async function runWithTools(client, messages, send) {
  const working = [...messages];
  let announcedSearch = false;
  const scopusCache = [];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const isFinalRound = round === MAX_TOOL_ROUNDS;
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: working,
      tools: [SEARCH_SCOPUS_TOOL],

      tool_choice: isFinalRound ? 'none' : 'auto',
    });

    const choice = completion.choices?.[0];
    const message = choice?.message;
    const toolCalls = message?.tool_calls || [];

    if (!toolCalls.length) {

      return rewritePapersBlock(message?.content || '', scopusCache);
    }

    if (!announcedSearch) {
      send({ status: 'searching_literature' });
      announcedSearch = true;
    }

    working.push(message);
    for (const toolCall of toolCalls) {
      const { output, results } = await runToolCall(toolCall);
      for (const item of results) scopusCache.push(item);
      working.push({ role: 'tool', tool_call_id: toolCall.id, content: output });
    }
  }

  return '';
}

router.post('/configure-chat', upload.array('files', 10), async (req, res) => {
  const apiKey = process.env.OPEN_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'The AI assistant is not configured (missing API key).' });
    return;
  }



  let payload = {};
  if (req.body && typeof req.body.payload === 'string') {
    try {
      payload = JSON.parse(req.body.payload);
    } catch {
      payload = {};
    }
  } else if (req.body && typeof req.body === 'object') {
    payload = req.body;
  }

  const { message, conversationHistory, currentConfig, submittedAdvice } = payload;
  if (typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'A message is required.' });
    return;
  }

  const systemParts = [loadSystemPrompt()];
  const configSummary = summarizeConfig(currentConfig);
  if (configSummary) systemParts.push(configSummary);
  const adviceSummary = summarizeAdvice(submittedAdvice);
  if (adviceSummary) systemParts.push(adviceSummary);

  const history = Array.isArray(conversationHistory)
    ? conversationHistory
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-MAX_HISTORY)
        .map(m => ({ role: m.role, content: m.content }))
    : [];



  const fileTextBlocks = [];
  const imageParts = [];
  for (const file of req.files || []) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (TEXT_EXT.has(ext)) {
      const text = file.buffer.toString('utf8').slice(0, MAX_FILE_TEXT_CHARS);
      fileTextBlocks.push(`--- File: ${file.originalname} ---\n${text}`);
    } else if (IMAGE_MIME[ext]) {
      const b64 = file.buffer.toString('base64');
      imageParts.push({
        type: 'image_url',
        image_url: { url: `data:${IMAGE_MIME[ext]};base64,${b64}` },
      });
    } else {
      fileTextBlocks.push(`--- Attached file (content not extracted, filename only): ${file.originalname} ---`);
    }
  }

  let userText = message;
  if (fileTextBlocks.length) {
    userText += `\n\nAttached reference materials:\n\n${fileTextBlocks.join('\n\n')}`;
  }

  const userContent = imageParts.length
    ? [{ type: 'text', text: userText }, ...imageParts]
    : userText;

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
    const content = await runWithTools(client, messages, send);



    for (let i = 0; i < content.length; i += DELTA_CHUNK_CHARS) {
      send({ delta: content.slice(i, i + DELTA_CHUNK_CHARS) });
    }
    send({ done: true });
    res.end();
  } catch (err) {
    console.error('Configure chat request failed:', err.message);
    send({ error: 'The AI assistant could not be reached. Please try again.' });
    res.end();
  }
});

module.exports = router;
