import test from 'node:test';
import assert from 'node:assert/strict';
import { paperEntryBlockReason, paperSafetyState, phase4SafeBaseline } from '../lib/paper-safety.js';

test('Phase 4 safe baseline is locked and live trading is off', () => {
  const state = paperSafetyState({
    MULTI_BOT_EXECUTION_ENABLED: 'false',
    PAPER_EXECUTION_ENABLED: 'false',
    AUTO_EXECUTION_ENABLED: 'false',
    TRADING_KILL_SWITCH: 'true',
    LIVE_TRADING_ENABLED: 'false',
  });
  assert.equal(phase4SafeBaseline(state), true);
  assert.match(paperEntryBlockReason(state), /not armed/i);
});

test('kill switch blocks entry even when every paper execution gate is armed', () => {
  const reason = paperEntryBlockReason({
    multiBotArmed: true,
    paperExecution: true,
    autoExecution: true,
    killSwitch: true,
    liveTrading: false,
  });
  assert.match(reason, /kill switch/i);
});

test('live trading always blocks the paper engine', () => {
  const reason = paperEntryBlockReason({
    multiBotArmed: true,
    paperExecution: true,
    autoExecution: true,
    killSwitch: false,
    liveTrading: true,
  });
  assert.match(reason, /live trading/i);
});

test('paper engine can only enter when every gate is explicitly ready', () => {
  assert.equal(paperEntryBlockReason({
    multiBotArmed: true,
    paperExecution: true,
    autoExecution: true,
    killSwitch: false,
    liveTrading: false,
  }), '');
});
