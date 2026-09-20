import test from 'node:test';
import assert from 'node:assert/strict';
import { paperEntryBlockReason, paperSafetyState, phase4SafeBaseline } from '../lib/paper-safety.js';

test('Phase 4 master lock overrides stale legacy execution flags', () => {
  const state = paperSafetyState({
    PHASE4_PAPER_ARMED: 'false',
    MULTI_BOT_EXECUTION_ENABLED: 'true',
    PAPER_EXECUTION_ENABLED: 'true',
    AUTO_EXECUTION_ENABLED: 'true',
    TRADING_KILL_SWITCH: 'false',
    LIVE_TRADING_ENABLED: 'false',
  });
  assert.equal(phase4SafeBaseline(state), true);
  assert.equal(state.paperExecution, false);
  assert.equal(state.autoExecution, false);
  assert.equal(state.killSwitch, true);
  assert.match(paperEntryBlockReason(state), /Phase 4 paper automation is locked/i);
});

test('kill switch blocks entry even when every paper execution gate is armed', () => {
  const reason = paperEntryBlockReason({
    phase4Armed: true,
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
    phase4Armed: true,
    multiBotArmed: true,
    paperExecution: true,
    autoExecution: true,
    killSwitch: false,
    liveTrading: true,
  });
  assert.match(reason, /live trading/i);
});

test('paper engine can only enter when every Phase 4 gate is explicitly ready', () => {
  assert.equal(paperEntryBlockReason({
    phase4Armed: true,
    multiBotArmed: true,
    paperExecution: true,
    autoExecution: true,
    killSwitch: false,
    liveTrading: false,
  }), '');
});
