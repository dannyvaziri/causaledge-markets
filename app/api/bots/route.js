import { isDashboardAuthorized } from '../../../lib/access.js';
import { deleteBotConfig, loadBotActivity, loadBots, loadRecentBotActivity, sanitizeBot, saveBotConfig, sharedRiskLimits } from '../../../lib/bots.js';

export const dynamic = 'force-dynamic';

const PAPER_BASE = 'https://paper-api.alpaca.markets';
const DATA_BASE = 'https://data.alpaca.markets';

function alpacaHeaders() {
  return {
    'APCA-API-KEY-ID': process.env.ALPACA_API_KEY || '',
    'APCA-API-SECRET-KEY': process.env.ALPACA_API_SECRET || '',
    'Content-Type': 'application/json',
  };
}

async function jsonFetch(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, headers: { ...alpacaHeaders(), ...(options.headers || {}) }, signal: controller.signal, cache: 'no-store' });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!response.ok) throw new Error(data?.message || `Alpaca request failed (${response.status})`);
    return data;
  } finally { clearTimeout(timer); }
}

function sameSymbol(a, b) {
  return String(a || '').toUpperCase().replace(/[^A-Z0-9]/g, '') === String(b || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function accountSnapshot() {
  if (!process.env.ALPACA_API_KEY || !process.env.ALPACA_API_SECRET) return { account: null, positions: [] };
  const [account, positions] = await Promise.all([jsonFetch(`${PAPER_BASE}/v2/account`), jsonFetch(`${PAPER_BASE}/v2/positions`)]);
  const equity = Number(account?.equity || 0);
  const lastEquity = Number(account?.last_equity || equity || 0);
  return {
    account: { equity, cash: Number(account?.cash || 0), buyingPower: Number(account?.buying_power || 0), dayPnl: Number((equity - lastEquity).toFixed(2)), status: account?.status || '', tradingBlocked: Boolean(account?.trading_blocked) },
    positions: (positions || []).map((position) => ({ symbol: position.symbol, qty: Number(position.qty || 0), marketValue: Number(position.market_value || 0), currentPrice: Number(position.current_price || 0), unrealizedPnl: Number(position.unrealized_pl || 0), unrealizedPlpc: Number(position.unrealized_plpc || 0) })),
  };
}

async function marketSeries(bot) {
  if (!process.env.ALPACA_API_KEY || !process.env.ALPACA_API_SECRET) return { price: null, changePct: null, series: [] };
  const symbol = encodeURIComponent(bot.symbol);
  let bars = [];
  if (bot.assetType === 'crypto') {
    const payload = await jsonFetch(`${DATA_BASE}/v1beta3/crypto/us/bars?symbols=${symbol}&timeframe=5Min&limit=48&sort=asc`);
    bars = payload?.bars?.[bot.symbol] || payload?.bars?.[bot.symbol.replace('/', '')] || [];
  } else {
    const payload = await jsonFetch(`${DATA_BASE}/v2/stocks/${symbol}/bars?timeframe=5Min&limit=48&feed=iex&sort=asc`);
    bars = payload?.bars || [];
  }
  const series = bars.map((bar) => ({ time: bar.t, open: Number(bar.o || 0), high: Number(bar.h || 0), low: Number(bar.l || 0), close: Number(bar.c || 0), volume: Number(bar.v || 0) })).filter((bar) => bar.close > 0);
  const first = series[0]?.close || 0;
  const last = series.at(-1)?.close || 0;
  return { price: last || null, changePct: first > 0 && last > 0 ? Number((((last - first) / first) * 100).toFixed(3)) : null, series };
}

function nextPlan(bot, safety) {
  if (bot.status === 'paused') return 'Paused. Resume this bot when you want it to evaluate its next paper signal.';
  if (bot.status === 'stopped') return 'Stopped. Edit or duplicate it before running again.';
  if (!safety.multiBotArmed) return 'Multi-bot execution is not armed yet. The bot can monitor and show charts, but it cannot submit a new entry.';
  if (safety.killSwitch) return 'Global kill switch is on, so no new entry can be submitted.';
  if (!safety.paperExecution) return 'Waiting for paper execution authorization.';
  if (!safety.autoExecution) return 'Waiting for automatic paper execution authorization.';
  const plans = {
    momentum: 'Compare recent 5-minute momentum and only consider an entry after account-level risk checks.',
    trend: 'Check whether price remains above its recent average with a positive slope, then apply shared risk limits.',
    'mean-reversion': 'Watch for an unusually weak move below the recent average, then apply shared risk limits.',
    breakout: 'Watch for a break above the recent range, then apply shared risk limits before any paper entry.',
  };
  return plans[bot.strategy] || 'Evaluate the next paper signal and shared account-level risk limits.';
}

export async function GET(request) {
  if (!isDashboardAuthorized(request)) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  try {
    const url = new URL(request.url);
    const requestedId = url.searchParams.get('id');
    const bots = await loadBots();
    const snapshot = await accountSnapshot().catch(() => ({ account: null, positions: [] }));
    const activity = requestedId ? await loadBotActivity(requestedId, 120) : await loadRecentBotActivity(240);
    const safety = {
      multiBotArmed: process.env.MULTI_BOT_EXECUTION_ENABLED === 'true',
      paperExecution: process.env.PAPER_EXECUTION_ENABLED === 'true',
      autoExecution: process.env.AUTO_EXECUTION_ENABLED === 'true',
      killSwitch: process.env.TRADING_KILL_SWITCH === 'true',
      liveTrading: process.env.LIVE_TRADING_ENABLED === 'true',
    };

    const selected = requestedId ? bots.filter((bot) => bot.id === requestedId) : bots;
    const enriched = await Promise.all(selected.slice(0, 20).map(async (bot) => {
      const market = await marketSeries(bot).catch(() => ({ price: null, changePct: null, series: [] }));
      const position = snapshot.positions.find((item) => sameSymbol(item.symbol, bot.symbol)) || null;
      const botActivity = (activity || []).filter((row) => String(row?.metadata?.botId || '') === bot.id);
      const lastAction = botActivity.find((row) => !['BOT_CONFIG', 'BOT_DELETE'].includes(row.event_type));
      return { ...bot, market, position, lastAction: lastAction ? { type: lastAction.event_type, status: lastAction.status, message: lastAction.message, time: lastAction.created_at } : null, nextAction: nextPlan(bot, safety), activity: requestedId ? botActivity : undefined };
    }));

    const sharedRisk = sharedRiskLimits(snapshot.account?.equity || 100);
    const totalExposure = snapshot.positions.reduce((sum, position) => sum + Math.abs(Number(position.marketValue || 0)), 0);
    return Response.json({
      bots: enriched,
      account: snapshot.account,
      positions: snapshot.positions,
      safety,
      sharedRisk: { ...sharedRisk, currentOpenPositions: snapshot.positions.length, currentExposureUsd: Number(totalExposure.toFixed(2)), currentExposurePct: snapshot.account?.equity ? Number(((totalExposure / snapshot.account.equity) * 100).toFixed(2)) : 0 },
      timestamp: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return Response.json({ error: 'Multi-bot workspace is unavailable.', detail: String(error?.message || error) }, { status: 503 });
  }
}

export async function POST(request) {
  if (!isDashboardAuthorized(request)) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || 'create').toLowerCase();
  try {
    const bots = await loadBots();
    const find = (id) => bots.find((bot) => bot.id === String(id || ''));
    let bot = null;

    if (action === 'create') {
      bot = sanitizeBot({ ...body.bot, status: 'paused' });
      await saveBotConfig(bot, 'Bot created in paused state.');
    } else if (action === 'update') {
      const current = find(body.bot?.id || body.id);
      if (!current) return Response.json({ error: 'Bot not found.' }, { status: 404 });
      bot = sanitizeBot({ ...current, ...body.bot, id: current.id, status: current.status, createdAt: current.createdAt }, { id: current.id });
      await saveBotConfig(bot, 'Bot settings updated.');
    } else if (action === 'duplicate') {
      const current = find(body.id);
      if (!current) return Response.json({ error: 'Bot not found.' }, { status: 404 });
      bot = sanitizeBot({ ...current, id: undefined, name: `${current.name} copy`, status: 'paused', createdAt: undefined });
      await saveBotConfig(bot, 'Bot duplicated in paused state.');
    } else if (['pause', 'resume', 'stop'].includes(action)) {
      const current = find(body.id);
      if (!current) return Response.json({ error: 'Bot not found.' }, { status: 404 });
      const status = action === 'resume' ? 'running' : action === 'pause' ? 'paused' : 'stopped';
      bot = sanitizeBot({ ...current, status }, { id: current.id });
      await saveBotConfig(bot, `Bot ${status}.`);
    } else if (action === 'delete') {
      const current = find(body.id);
      if (!current) return Response.json({ error: 'Bot not found.' }, { status: 404 });
      await deleteBotConfig(current);
      return Response.json({ ok: true, deleted: current.id });
    } else {
      return Response.json({ error: 'Unknown bot action.' }, { status: 400 });
    }

    return Response.json({ ok: true, bot });
  } catch (error) {
    return Response.json({ error: 'Bot change could not be saved.', detail: String(error?.message || error) }, { status: 400 });
  }
}
