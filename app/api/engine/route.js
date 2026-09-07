import { isDashboardAuthorized, matchesSecret } from '../../../lib/access.js';
import { aiConfigured, requestStructured } from '../../../lib/ai.js';
import { evaluateRisk } from '../../../lib/risk.js';

export const dynamic = 'force-dynamic';

const PAPER_BASE = 'https://paper-api.alpaca.markets';
const DATA_BASE = 'https://data.alpaca.markets';
const WATCHLIST = (process.env.CHALLENGE_WATCHLIST || 'AAPL,MSFT,NVDA,AMZN,META,GOOGL,TSLA,AMD,JPM,SPY')
  .split(',').map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 30);

const runtime = globalThis.__signalForgeEngine || { paused: false, logs: [], seen: new Set(), lastRun: null };
globalThis.__signalForgeEngine = runtime;

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function now() { return new Date().toISOString(); }

function log(type, message, symbol = '') {
  runtime.logs.unshift({ time: now(), type, message, symbol });
  runtime.logs = runtime.logs.slice(0, 80);
}

function paperHeaders() {
  return {
    'APCA-API-KEY-ID': process.env.ALPACA_API_KEY || '',
    'APCA-API-SECRET-KEY': process.env.ALPACA_API_SECRET || '',
    'Content-Type': 'application/json',
  };
}

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, { ...options, cache: 'no-store' });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data?.message || data?.raw || `${res.status} ${res.statusText}`);
  return data;
}

async function alpaca(path, options = {}) {
  return jsonFetch(`${PAPER_BASE}${path}`, { ...options, headers: { ...paperHeaders(), ...(options.headers || {}) } });
}

async function marketData(path) {
  return jsonFetch(`${DATA_BASE}${path}`, { headers: paperHeaders() });
}

function limits(equity) {
  const e = Math.max(Number(equity || 100), 1);
  return {
    maxOrderNotional: Number(clamp(e * 0.25, 5, 250).toFixed(2)),
    maxPositionPct: 25,
    maxDailyLossPct: 3,
    maxDailyLossUsd: Number(Math.max(3, e * 0.03).toFixed(2)),
    maxOpenPositions: 2,
    minConfidence: 90,
    minImpact: 8,
    staleMinutes: 5,
  };
}

function isEngineAuthorized(request) {
  if (isDashboardAuthorized(request)) return true;
  const configured = process.env.CRON_SECRET || process.env.ENGINE_SECRET || '';
  return matchesSecret(request.headers.get('x-engine-secret'), configured);
}

async function accountSnapshot() {
  if (!process.env.ALPACA_API_KEY || !process.env.ALPACA_API_SECRET) {
    return { account: null, positions: [] };
  }
  const [account, rawPositions] = await Promise.all([alpaca('/v2/account'), alpaca('/v2/positions')]);
  const equity = Number(account.equity || 0);
  const lastEquity = Number(account.last_equity || equity || 0);
  return {
    account: {
      equity,
      cash: Number(account.cash || 0),
      buyingPower: Number(account.buying_power || 0),
      dayPnl: Number((equity - lastEquity).toFixed(2)),
      status: account.status,
      tradingBlocked: Boolean(account.trading_blocked),
    },
    positions: (rawPositions || []).map((p) => ({
      symbol: p.symbol,
      qty: Number(p.qty || 0),
      marketValue: Number(p.market_value || 0),
      avgEntry: Number(p.avg_entry_price || 0),
      currentPrice: Number(p.current_price || 0),
      unrealizedPnl: Number(p.unrealized_pl || 0),
      unrealizedPlpc: Number(p.unrealized_plpc || 0),
    })),
  };
}

function statusPayload(snapshot = { account: null, positions: [] }) {
  const equity = snapshot.account?.equity || Number(process.env.CHALLENGE_START || 100);
  const guard = limits(equity);
  return {
    mode: 'paper',
    account: snapshot.account || { equity: Number(process.env.CHALLENGE_START || 100), cash: Number(process.env.CHALLENGE_START || 100), dayPnl: 0 },
    positions: snapshot.positions || [],
    challenge: {
      start: Number(process.env.CHALLENGE_START || 100),
      target: Number(process.env.CHALLENGE_TARGET || 1000),
      maxOrder: guard.maxOrderNotional,
      dailyLossLimit: guard.maxDailyLossUsd,
      maxPositions: guard.maxOpenPositions,
      minConfidence: guard.minConfidence,
    },
    engine: {
      enabled: process.env.AUTO_EXECUTION_ENABLED === 'true',
      paused: runtime.paused,
      lastRun: runtime.lastRun,
    },
    safety: {
      paperExecution: process.env.PAPER_EXECUTION_ENABLED === 'true',
      autoExecution: process.env.AUTO_EXECUTION_ENABLED === 'true',
      killSwitch: process.env.TRADING_KILL_SWITCH === 'true',
      brokerConfigured: Boolean(process.env.ALPACA_API_KEY && process.env.ALPACA_API_SECRET),
      aiConfigured: aiConfigured(),
      liveTrading: false,
    },
    logs: runtime.logs,
  };
}

async function getRecentNews() {
  const symbols = WATCHLIST.join(',');
  const data = await marketData(`/v1beta1/news?sort=desc&limit=20&include_content=false&symbols=${encodeURIComponent(symbols)}`);
  const cutoff = Date.now() - 5 * 60 * 1000;
  return (data.news || []).filter((item) => {
    const created = Date.parse(item.created_at || '');
    return created >= cutoff && (item.symbols || []).some((s) => WATCHLIST.includes(String(s).toUpperCase()));
  }).slice(0, 12);
}

async function chooseCandidate(news) {
  if (!aiConfigured() || !news.length) return { signal: 'HOLD', confidence: 0, impact: 0, reason: 'No AI or fresh news available.' };

  const compact = news.map((n) => ({ id: String(n.id), headline: n.headline, summary: n.summary, symbols: n.symbols, created_at: n.created_at }));
  const schema = {
    type: 'object', additionalProperties: false,
    properties: {
      signal: { type: 'string', enum: ['BUY', 'HOLD'] },
      symbol: { type: 'string' }, newsId: { type: 'string' },
      confidence: { type: 'number', minimum: 0, maximum: 100 },
      impact: { type: 'number', minimum: 0, maximum: 10 },
      reason: { type: 'string' },
    },
    required: ['signal', 'symbol', 'newsId', 'confidence', 'impact', 'reason'],
  };

  const prompt = `You are the catalyst classifier inside an autonomous PAPER-TRADING experiment. Select at most one long BUY candidate from the supplied fresh news. Prefer genuinely material, surprising company-specific catalysts. Avoid vague commentary, already-old items, macro speculation, leveraged ETFs, and weak sentiment-only headlines. If there is not an unusually strong candidate, return HOLD. You cannot change sizing or risk controls.\n\nNEWS:\n${JSON.stringify(compact)}`;
  const candidate = await requestStructured({ input: prompt, schema, name: 'candidate' });
  candidate.symbol = String(candidate.symbol || '').toUpperCase();
  if (candidate.signal === 'BUY' && !WATCHLIST.includes(candidate.symbol)) return { signal: 'HOLD', confidence: 0, impact: 0, reason: 'AI selected a symbol outside the allowlist.' };
  return candidate;
}

async function confirmMarket(symbol) {
  const snap = await marketData(`/v2/stocks/${encodeURIComponent(symbol)}/snapshot`);
  const trade = Number(snap?.latestTrade?.p || 0);
  const bid = Number(snap?.latestQuote?.bp || 0);
  const ask = Number(snap?.latestQuote?.ap || 0);
  const dayOpen = Number(snap?.dailyBar?.o || 0);
  const minuteVwap = Number(snap?.minuteBar?.vw || 0);
  const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : 0;
  const spreadPct = mid > 0 ? (ask - bid) / mid : 1;
  const confirmed = trade > 0 && bid > 0 && ask > 0 && spreadPct <= 0.005 && (!dayOpen || trade >= dayOpen) && (!minuteVwap || trade >= minuteVwap);
  return { confirmed, trade, bid, ask, spreadPct, dayOpen, minuteVwap };
}

async function closePosition(position, reason) {
  const placed = await alpaca('/v2/orders', {
    method: 'POST',
    body: JSON.stringify({ symbol: position.symbol, side: 'sell', type: 'market', time_in_force: 'day', qty: String(position.qty) }),
  });
  log('EXIT', `${reason} · sell ${position.qty} shares · order ${placed.id}`, position.symbol);
  return placed;
}

async function closeAll() {
  const snapshot = await accountSnapshot();
  for (const position of snapshot.positions) await closePosition(position, 'Emergency close-all');
  return accountSnapshot();
}

async function runCycle() {
  runtime.lastRun = now();
  if (runtime.paused) { log('SYSTEM', 'Cycle skipped because the engine is paused.'); return accountSnapshot(); }
  if (process.env.TRADING_KILL_SWITCH === 'true') { log('REJECT', 'Cycle blocked by the global kill switch.'); return accountSnapshot(); }
  if (process.env.PAPER_EXECUTION_ENABLED !== 'true' || process.env.AUTO_EXECUTION_ENABLED !== 'true') {
    log('REJECT', 'Paper or automatic execution is disabled in the server environment.');
    return accountSnapshot();
  }
  if (!process.env.ALPACA_API_KEY || !process.env.ALPACA_API_SECRET) throw new Error('Alpaca paper credentials are not configured.');

  const snapshot = await accountSnapshot();
  if (snapshot.account?.tradingBlocked) { log('REJECT', 'Broker reports trading is blocked.'); return snapshot; }
  const guard = limits(snapshot.account.equity);
  const dailyLossUsd = Math.max(-Number(snapshot.account.dayPnl || 0), 0);
  if (dailyLossUsd >= guard.maxDailyLossUsd) { log('REJECT', `Daily loss stop reached (${dailyLossUsd.toFixed(2)}).`); return snapshot; }

  for (const position of snapshot.positions) {
    if (position.unrealizedPlpc <= -0.03) { await closePosition(position, '3% protective stop reached'); return accountSnapshot(); }
    if (position.unrealizedPlpc >= 0.06) { await closePosition(position, '6% profit target reached'); return accountSnapshot(); }
  }

  if (snapshot.positions.length >= guard.maxOpenPositions) { log('HOLD', 'Maximum open-position count reached.'); return snapshot; }

  const news = await getRecentNews();
  const candidate = await chooseCandidate(news);
  if (candidate.signal !== 'BUY' || candidate.confidence < guard.minConfidence || candidate.impact < guard.minImpact) {
    log('HOLD', `${candidate.reason || 'No qualifying catalyst.'} · confidence ${Number(candidate.confidence || 0).toFixed(0)} · impact ${Number(candidate.impact || 0).toFixed(1)}`, candidate.symbol || '');
    return snapshot;
  }
  if (snapshot.positions.some((p) => p.symbol === candidate.symbol)) { log('HOLD', 'Existing position; averaging in is disabled.', candidate.symbol); return snapshot; }

  const intelligenceId = String(candidate.newsId || '').slice(0, 100);
  const duplicateKey = `${intelligenceId}:${candidate.symbol}:BUY`;
  if (runtime.seen.has(duplicateKey)) { log('REJECT', 'Duplicate news/order attempt blocked.', candidate.symbol); return snapshot; }

  const confirmation = await confirmMarket(candidate.symbol);
  if (!confirmation.confirmed) { log('REJECT', `Market confirmation failed; spread ${(confirmation.spreadPct * 100).toFixed(2)}%.`, candidate.symbol); return snapshot; }

  const ageSource = news.find((n) => String(n.id) === intelligenceId);
  const ageMinutes = ageSource ? Math.max((Date.now() - Date.parse(ageSource.created_at)) / 60000, 0) : 99;
  const notional = Number(Math.min(guard.maxOrderNotional, snapshot.account.cash, snapshot.account.equity * 0.25).toFixed(2));
  const risk = evaluateRisk({
    symbol: candidate.symbol, side: 'BUY', notional, qty: 0, source: 'auto',
    equity: snapshot.account.equity, currentPositionValue: 0, currentQty: 0,
    dailyLossPct: snapshot.account.equity ? (dailyLossUsd / snapshot.account.equity) * 100 : 0,
    dailyLossUsd, openPositions: snapshot.positions.length,
    confidence: Number(candidate.confidence || 0), impact: Number(candidate.impact || 0), ageMinutes,
    duplicate: false, killSwitch: false, executionAuthorized: true, autoExecution: true, limits: guard,
  });
  if (!risk.approved) { log('REJECT', risk.reasons.join(' '), candidate.symbol); return snapshot; }

  const placed = await alpaca('/v2/orders', {
    method: 'POST',
    body: JSON.stringify({ symbol: candidate.symbol, side: 'buy', type: 'market', time_in_force: 'day', notional: String(notional) }),
  });
  runtime.seen.add(duplicateKey);
  log('BUY', `${candidate.reason} · ${candidate.confidence}% confidence · ${candidate.impact}/10 impact · ${notional.toFixed(2)} notional · order ${placed.id}`, candidate.symbol);
  return accountSnapshot();
}

export async function GET(request) {
  if (!isDashboardAuthorized(request)) return Response.json({ error: 'Sign in to access your dashboard.' }, { status: 401 });
  try { return Response.json(statusPayload(await accountSnapshot())); }
  catch (error) { return Response.json({ ...statusPayload(), error: String(error?.message || error) }, { status: 502 }); }
}

export async function POST(request) {
  if (!isEngineAuthorized(request)) return Response.json({ error: 'Invalid engine access token.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || new URL(request.url).searchParams.get('action') || 'run').toLowerCase();
  try {
    let snapshot;
    if (action === 'pause') { runtime.paused = true; log('SYSTEM', 'Autonomous engine paused by operator.'); snapshot = await accountSnapshot(); }
    else if (action === 'resume') { runtime.paused = false; log('SYSTEM', 'Autonomous engine resumed by operator.'); snapshot = await accountSnapshot(); }
    else if (action === 'close-all') { snapshot = await closeAll(); }
    else if (action === 'run') { snapshot = await runCycle(); }
    else return Response.json({ error: 'Unknown engine action.' }, { status: 400 });
    return Response.json(statusPayload(snapshot));
  } catch (error) {
    log('ERROR', String(error?.message || error));
    return Response.json({ ...statusPayload(), error: String(error?.message || error) }, { status: 502 });
  }
}
