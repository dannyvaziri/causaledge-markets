export function paperSafetyState(env = process.env) {
  const phase4Armed = env.PHASE4_PAPER_ARMED === 'true';
  const raw = {
    multiBotArmed: env.MULTI_BOT_EXECUTION_ENABLED === 'true',
    paperExecution: env.PAPER_EXECUTION_ENABLED === 'true',
    autoExecution: env.AUTO_EXECUTION_ENABLED === 'true',
    killSwitch: env.TRADING_KILL_SWITCH === 'true',
    liveTrading: env.LIVE_TRADING_ENABLED === 'true',
  };

  return {
    phase4Armed,
    multiBotArmed: phase4Armed && raw.multiBotArmed,
    paperExecution: phase4Armed && raw.paperExecution,
    autoExecution: phase4Armed && raw.autoExecution,
    killSwitch: !phase4Armed || raw.killSwitch,
    liveTrading: raw.liveTrading,
    raw,
  };
}

export function paperEntryBlockReason(safety) {
  if (safety.liveTrading) return 'Live trading must remain disabled for the paper engine.';
  if (!safety.phase4Armed) return 'Phase 4 paper automation is locked.';
  if (!safety.multiBotArmed) return 'Multi-bot paper execution is not armed.';
  if (safety.killSwitch) return 'Global kill switch blocks all new bot entries.';
  if (!safety.paperExecution) return 'Paper execution is disabled.';
  if (!safety.autoExecution) return 'Automatic paper execution is disabled.';
  return '';
}

export function phase4SafeBaseline(safety) {
  return Boolean(
    safety.liveTrading === false &&
    safety.phase4Armed === false &&
    safety.multiBotArmed === false &&
    safety.paperExecution === false &&
    safety.autoExecution === false &&
    safety.killSwitch === true
  );
}
