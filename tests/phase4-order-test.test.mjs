import test from 'node:test';
import assert from 'node:assert/strict';
import { phase4OrderTestPreconditions, PHASE4_TEST_NOTIONAL, PHASE4_TEST_SYMBOL } from '../lib/phase4-order-test.js';

const clean = {
  liveTrading: false,
  account: { status: 'ACTIVE', trading_blocked: false, cash: 100 },
  positions: [],
  openOrders: [],
};

test('controlled Phase 4 paper round-trip is capped at $1 BTC/USD', () => {
  assert.equal(PHASE4_TEST_NOTIONAL, 1);
  assert.equal(PHASE4_TEST_SYMBOL, 'BTC/USD');
  assert.equal(phase4OrderTestPreconditions(clean).approved, true);
});

test('controlled test refuses live trading', () => {
  const result = phase4OrderTestPreconditions({ ...clean, liveTrading: true });
  assert.equal(result.approved, false);
  assert.match(result.reasons.join(' '), /Live trading/i);
});

test('controlled test refuses existing positions or open orders', () => {
  assert.equal(phase4OrderTestPreconditions({ ...clean, positions: [{ symbol: 'SPY' }] }).approved, false);
  assert.equal(phase4OrderTestPreconditions({ ...clean, openOrders: [{ id: '1' }] }).approved, false);
});
