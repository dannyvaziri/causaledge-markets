import { isDashboardAuthorized } from '../../../../lib/access.js';
import { aiConfigured, aiProvider, requestStructured } from '../../../../lib/ai.js';

export const dynamic = 'force-dynamic';

const GOALS = new Set(['grow', 'world-events', 'congress', 'momentum', 'dips', 'companies', 'defensive', 'custom']);
const RISK = new Set(['Conservative', 'Moderate', 'Aggressive']);

function fallback(goal, risk, budget, symbols) {
  const symbol = symbols[0] || (goal === 'world-events' ? 'XLE' : goal === 'momentum' ? 'QQQ' : 'SPY');
  const strategy = goal === 'world-events' ? 'world-events' : goal === 'congress' ? 'congress-disclosures' : goal === 'momentum' ? 'momentum' : goal === 'dips' ? 'mean-reversion' : 'trend';
  const cautious = risk === 'Conservative';
  return {
    name: `${goal === 'world-events' ? 'World Events' : goal === 'congress' ? 'Public Disclosure' : 'AI'} — ${symbol}`,
    symbol, strategy, tradeAmount: Math.max(1, Math.min(cautious ? 5 : 10, budget)),
    stopLossPct: cautious ? 3 : 5, takeProfitPct: cautious ? 6 : 10, maxPositions: 1,
    maxDailyLossUsd: cautious ? 1 : 2,
    summary: `A paper-only ${strategy.replace('-', ' ')} bot for ${symbol}. It will wait when the evidence is incomplete.`,
    watch: [symbol], buy: ['A supported signal is present', 'Market and account risk checks pass'], sell: ['The stop loss or take-profit rule triggers', 'The original signal weakens'],
  };
}

export async function POST(request) {
  if (!isDashboardAuthorized(request)) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const goal = GOALS.has(body.goal) ? body.goal : 'custom';
  const risk = RISK.has(body.risk) ? body.risk : 'Moderate';
  const budget = Math.max(1, Math.min(Number(body.budget || 5), 25));
  const symbols = Array.isArray(body.symbols) ? body.symbols.map((value) => String(value || '').trim().toUpperCase()).filter((value) => /^[A-Z.]{1,10}$/.test(value)).slice(0, 8) : [];
  const base = fallback(goal, risk, budget, symbols);
  if (!aiConfigured()) return Response.json({ draft: base, provider: 'rules' });
  try {
    const schema = { type: 'object', additionalProperties: false, properties: {
      name: { type: 'string' }, symbol: { type: 'string' }, strategy: { type: 'string', enum: ['momentum', 'trend', 'mean-reversion', 'breakout', 'news-reaction', 'world-events', 'congress-disclosures', 'insider-filings', 'ai-discretionary'] }, tradeAmount: { type: 'number' }, stopLossPct: { type: 'number' }, takeProfitPct: { type: 'number' }, maxPositions: { type: 'number' }, maxDailyLossUsd: { type: 'number' }, summary: { type: 'string' }, watch: { type: 'array', items: { type: 'string' }, maxItems: 6 }, buy: { type: 'array', items: { type: 'string' }, maxItems: 4 }, sell: { type: 'array', items: { type: 'string' }, maxItems: 4 },
    }, required: ['name', 'symbol', 'strategy', 'tradeAmount', 'stopLossPct', 'takeProfitPct', 'maxPositions', 'maxDailyLossUsd', 'summary', 'watch', 'buy', 'sell'] };
    const input = `You design transparent PAPER-ONLY U.S. stock and ETF bots. Never promise returns, invent a current event, claim a disclosure exists, or recommend a live trade. Produce a cautious draft; abstention is valid. Use only valid stock/ETF symbols. Keep every value within: amount $1-$25, stop 0.5-10%, take profit 1-20%, positions 1-2, daily loss $0.50-$3.\nGoal: ${goal}\nRisk: ${risk}\nMaximum paper trade amount: $${budget}\nAllowed symbols: ${symbols.join(', ') || 'CausalEdge may choose SPY, QQQ, XLE, or a broad ETF'}\nReturn a concise beginner-friendly proposal.`;
    const generated = await requestStructured({ input, schema, name: 'paper_bot_draft' });
    const safe = fallback(goal, risk, budget, [generated.symbol, ...symbols].find((value) => /^[A-Z.]{1,10}$/.test(String(value || '').toUpperCase()) ? String(value).toUpperCase() : ''));
    return Response.json({ draft: { ...safe, ...generated, symbol: safe.symbol, tradeAmount: Math.max(1, Math.min(Number(generated.tradeAmount || safe.tradeAmount), budget, 25)), stopLossPct: Math.max(.5, Math.min(Number(generated.stopLossPct || safe.stopLossPct), 10)), takeProfitPct: Math.max(1, Math.min(Number(generated.takeProfitPct || safe.takeProfitPct), 20)), maxPositions: Math.max(1, Math.min(Math.round(Number(generated.maxPositions || safe.maxPositions)), 2)), maxDailyLossUsd: Math.max(.5, Math.min(Number(generated.maxDailyLossUsd || safe.maxDailyLossUsd), 3)) }, provider: aiProvider() });
  } catch {
    return Response.json({ draft: base, provider: 'rules' });
  }
}
