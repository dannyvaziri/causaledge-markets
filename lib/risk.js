const DEFAULTS = Object.freeze({
  maxOrderNotional: 25,
  maxPositionPct: 25,
  maxDailyLossPct: 3,
  maxDailyLossUsd: 3,
  maxOpenPositions: 2,
  minConfidence: 90,
  minImpact: 8,
  staleMinutes: 5,
  minOrderNotional: 1,
});

const DISALLOWED = new Set(['TQQQ','SQQQ','UPRO','SPXU','SOXL','SOXS','UVXY','SVXY']);

export function evaluateRisk(input = {}) {
  const reasons = [];
  const limits = { ...DEFAULTS, ...(input.limits || {}) };
  const side = String(input.side || '').toUpperCase();
  const symbol = String(input.symbol || '').toUpperCase();
  const notional = Number(input.notional || 0);
  const equity = Math.max(Number(input.equity || 0), 1);
  const currentPositionValue = Math.max(Number(input.currentPositionValue || 0), 0);
  const currentQty = Math.max(Number(input.currentQty || 0), 0);
  const requestedQty = Math.max(Number(input.qty || 0), 0);
  const dailyLossPct = Math.max(Number(input.dailyLossPct || 0), 0);
  const dailyLossUsd = Math.max(Number(input.dailyLossUsd || 0), 0);
  const confidence = Number(input.confidence || 0);
  const impact = Number(input.impact || 0);
  const ageMinutes = Math.max(Number(input.ageMinutes || 0), 0);
  const openPositions = Math.max(Number(input.openPositions || 0), 0);

  if (input.killSwitch) reasons.push('Global kill switch is active.');
  if (!input.executionAuthorized) reasons.push('Paper execution authorization is off.');
  if (!input.autoExecution && input.source === 'auto') reasons.push('Auto-execution is off.');
  if (!symbol || !/^[A-Z.]{1,10}$/.test(symbol)) reasons.push('Invalid symbol.');
  if (DISALLOWED.has(symbol)) reasons.push('Leveraged/inverse/high-volatility ETF is blocked.');
  if (!['BUY', 'SELL'].includes(side)) reasons.push('Only BUY or SELL paper intents are allowed.');
  if (dailyLossPct >= limits.maxDailyLossPct) reasons.push(`Daily drawdown limit of ${limits.maxDailyLossPct}% reached.`);
  if (dailyLossUsd >= limits.maxDailyLossUsd) reasons.push(`Daily loss limit of $${limits.maxDailyLossUsd} reached.`);
  if (ageMinutes > limits.staleMinutes) reasons.push(`Signal is stale (>${limits.staleMinutes} minutes).`);
  if (input.duplicate) reasons.push('Duplicate signal/order attempt blocked.');
  if (input.source === 'auto' && confidence < limits.minConfidence) reasons.push(`AI confidence below ${limits.minConfidence}%.`);
  if (input.source === 'auto' && impact < limits.minImpact) reasons.push(`Impact score below ${limits.minImpact}.`);

  if (side === 'SELL') {
    if (requestedQty <= 0) reasons.push('Sell quantity must be greater than zero.');
    if (requestedQty > currentQty) reasons.push('Short selling is blocked; sell quantity exceeds long inventory.');
  }

  if (side === 'BUY') {
    if (notional < limits.minOrderNotional) reasons.push(`Order notional must be at least $${limits.minOrderNotional}.`);
    if (notional > limits.maxOrderNotional) reasons.push(`Order notional exceeds $${limits.maxOrderNotional} limit.`);
    const projected = ((currentPositionValue + notional) / equity) * 100;
    if (projected > limits.maxPositionPct) reasons.push(`Projected position exposure exceeds ${limits.maxPositionPct}% of equity.`);
    if (currentPositionValue === 0 && openPositions >= limits.maxOpenPositions) reasons.push(`Maximum ${limits.maxOpenPositions} open positions reached.`);
  }

  return { approved: reasons.length === 0, reasons, limits };
}

export { DEFAULTS as DEFAULT_RISK_LIMITS };
