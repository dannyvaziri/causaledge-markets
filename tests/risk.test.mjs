import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRisk } from '../lib/risk.js';

const base = {
  symbol: 'NVDA', side: 'BUY', notional: 25, qty: 0, source: 'manual', equity: 100,
  currentPositionValue: 0, currentQty: 0, dailyLossPct: 0, dailyLossUsd: 0, openPositions: 0,
  confidence: 95, impact: 9, ageMinutes: 1, duplicate: false,
  killSwitch: false, executionAuthorized: true, autoExecution: false,
};

test('approves a compliant $25 paper BUY on a $100 account', () => {
  assert.equal(evaluateRisk(base).approved, true);
});

test('blocks a BUY above the $25 starting limit', () => {
  const result = evaluateRisk({ ...base, notional: 26 });
  assert.equal(result.approved, false);
  assert.match(result.reasons.join(' '), /notional exceeds/i);
});

test('daily $3 loss stop blocks execution', () => {
  const result = evaluateRisk({ ...base, dailyLossUsd: 3 });
  assert.equal(result.approved, false);
  assert.match(result.reasons.join(' '), /daily loss/i);
});

test('kill switch blocks execution', () => {
  const result = evaluateRisk({ ...base, killSwitch: true });
  assert.equal(result.approved, false);
  assert.match(result.reasons.join(' '), /kill switch/i);
});

test('blocks short selling', () => {
  const result = evaluateRisk({ ...base, side: 'SELL', qty: 5, currentQty: 2, notional: 0 });
  assert.equal(result.approved, false);
  assert.match(result.reasons.join(' '), /short selling/i);
});

test('closing a valid long position is allowed even if its value is above buy limit', () => {
  const result = evaluateRisk({ ...base, side: 'SELL', qty: 2, currentQty: 2, notional: 80 });
  assert.equal(result.approved, true);
});

test('auto execution requires strong AI signal', () => {
  const result = evaluateRisk({ ...base, source: 'auto', autoExecution: true, confidence: 70, impact: 6 });
  assert.equal(result.approved, false);
  assert.match(result.reasons.join(' '), /confidence/i);
  assert.match(result.reasons.join(' '), /impact/i);
});

test('two open positions blocks a third', () => {
  const result = evaluateRisk({ ...base, openPositions: 2 });
  assert.equal(result.approved, false);
  assert.match(result.reasons.join(' '), /maximum 2/i);
});
