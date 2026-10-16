'use strict';
const { writeFileDurable } = require('./durable-write.js');

// One workspace owner serializes these synchronous durable updates with the gate.
function makeFinanceAudit({ fs, path, workspace, now, onError }) {
  const file = path.join(workspace, 'finance-audit.json');
  let state = null, error = null;
  function fail(cause) { error = cause.message; onError(cause); }
  try {
    try { state = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (cause) {
      if (cause.code !== 'ENOENT' || fs.existsSync(file + '.bak')) throw cause;
      state = { version: 1, counts: { allowed: 0, blocked: 0 }, recent: [] };
      writeFileDurable({ fs, path }, file, JSON.stringify(state));
    }
    if (!state || state.version !== 1 || !Array.isArray(state.recent) || state.recent.length > 100
        || !['allowed', 'blocked'].every(k => Number.isSafeInteger(state.counts?.[k]) && state.counts[k] >= 0)
        || state.recent.some(r => !r || !Number.isSafeInteger(r.sequence) || !Number.isFinite(r.at)
          || !['allowed', 'blocked'].includes(r.decision) || typeof r.surface !== 'string' || typeof r.operation !== 'string')) {
      throw new Error('Invalid finance audit store; enforcement record needs repair.');
    }
  } catch (cause) { state = null; fail(cause); }
  function record(decision, surface, operation) {
    if (!state || error) return false;
    try {
      if (!['allowed', 'blocked'].includes(decision)) throw new Error('Invalid financial decision');
      const counts = { ...state.counts, [decision]: state.counts[decision] + 1 };
      const sequence = counts.allowed + counts.blocked;
      if (!Number.isSafeInteger(sequence)) throw new Error('Finance audit counter exhausted');
      const next = { version: 1, counts, recent: [...state.recent, {
        sequence, at: now(), decision, surface: String(surface).slice(0, 40), operation: String(operation).slice(0, 160),
      }].slice(-100) };
      writeFileDurable({ fs, path }, file, JSON.stringify(next));
      state = next;
      return true;
    } catch (cause) { fail(cause); return false; }
  }
  function snapshot() {
    return { durable: !!state && !error, error, counts: state ? { ...state.counts } : null,
      recent: state ? state.recent.map(r => ({ ...r })) : [], retention: 100 };
  }
  return { record, snapshot };
}
module.exports = { makeFinanceAudit };
