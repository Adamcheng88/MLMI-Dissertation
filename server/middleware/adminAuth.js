const crypto = require('crypto');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'deft-admin';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12;



const sessions = new Map();

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyPassword(password) {
  if (typeof password !== 'string') return false;
  return timingSafeEqual(password, ADMIN_PASSWORD);
}

function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { createdAt: Date.now(), expiresAt: Date.now() + TOKEN_TTL_MS });
  return token;
}

function destroySession(token) {
  if (token) sessions.delete(token);
}

function isValidSession(token) {
  if (!token) return false;
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function requireAdmin(req, res, next) {
  const token = req.cookies && req.cookies.admin_token;
  if (!isValidSession(token)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

module.exports = {
  verifyPassword,
  createSession,
  destroySession,
  isValidSession,
  requireAdmin,
  TOKEN_TTL_MS,
};
