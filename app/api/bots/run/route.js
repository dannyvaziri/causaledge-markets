import { isDashboardAuthorized, matchesSecret } from '../../../../lib/access.js';
import { evaluateRisk } from '../../../../lib/risk.js';
import { loadBotActivity, loadBots, sharedRiskLimits, writeBotEvent } from '../../../../lib/bots.js';

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

async function jsonFetch(url, options = {}, timeoutMs = 9000) {
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

function authorized(request) {
  if (isDashboardAuthorized(request)) return true;
  const expected = process.env.CRON_SECRET || process.env.ENGINE_SECRET || '';
  return matchesSecret(request.headers.get('x-engine-secret'), expected);
}

function keyFor(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function safetyState() {
  return {
    multiBotArmed: process.env.MULTI_BOT_EXECUTION_ENABLED === 'true',
    paperExecution: process.env.PAPER_EXECUTION_ENABLED === 'true',
    autoExecution: process.env.AUTO_EXECUTION_ENABLED === 'true',
    killSwitch: process.env.TRADING_KILL_SWITCH === 'true',
    liveTrading: process.env.LIVE_TRADING_ENABLED === 'true',
  };
}

function entryBlockReason(safety) {
  if (safety.liveTrading) return 'The multi-bot engine is paper-only and will not run while live trading is enabled.';
  if (!safety.multiBotArmed) return 'Multi-bot paper execution is not armed. Monitoring and configuration remain available.';
  if (safety.killSwitch) return 'Global kill switch blocks all new bot entries.';
  if (!safety.paperExecution) return 'Paper execution is disabled.';
  if (!safety.autoExecution) return 'Automatic paper execution is disabled.';
  return '';
}

async function barsFor(bot) {
  const encoded = encodeURIComponent(bot.symbol);
  let rows = [];
  if (bot.assetType === 'crypto') {
    const data = await jsonFetch(`${DATA_BASE}/v1beta3/crypto/us/bars?symbols=${encoded}&timeframe=5Min&limit=48&sort=asc`);
    rows = data?.bars?.[bot.symbol] || data?.bars?.[keyFor(bot.symbol)] || [];
  } else {
    const data = await jsonFetch(`${DATA_BASE}/v2/stocks/${encoded}/bars?timeframe=5Min&limit=48&feed=iex&sort=asc`);
    rows = data?.bars || [];
  }
  return rows.map((bar) => ({ time: bar.t, close: Number(bar.c || 0), high: Number(bar.h || 0), low: Number(bar.l || 0), volume: Number(bar.v || 0) })).filter((bar) => bar.close > 0);
}

function signalFor(bot, series) {
  if (series.length < 6) return { action: 'HOLD', reason: 'Not enough recent bars to evaluate this strategy yet.', score: 0 };
  const closes = series.map((bar) => bar.close);
  const current = closes.at(-1);
  const first = closes[0];
  const average = closes.reduce((sum, value) => sum + value, 0) / closes.length;
  const recent = closes.slice(-12);
  const priorRange = recent.slice(0, -1);
  const priorHigh = Math.max(...priorRange);
  const priorLow = Math.min(...priorRange);
  const momentumPct = first > 0 ? ((current - first) / first) * 100 : 0;
  const distancePct = average > 0 ? ((current - average) / average) * 100 : 0;
  const short = closes.slice(-6);
  const previous = closes.slice(-12, -6);
  const shortAverage = short.reduce((sum, value) => sum + value, 0) / Math.max(short.length, 1);
  const priorAverage = previous.reduce((sum, value) => sum + value, 0) / Math.max(previous.length, 1);

  if (bot.strategy === 'momentum') {
    const buy = momentumPct >= 0.6 && current >= shortAverage;
    return { action: buy ? 'BUY' : 'HOLD', reason: buy ? `Positive 5-minute momentum is ${momentumPct.toFixed(2)}% and price is above the short average.` : `Momentum is ${momentumPct.toFixed(2)}%; waiting for at least 0.60% with price above the short average.`, score: Math.abs(momentumPct) };
  }
  if (bot.strategy === 'trend') {
    const buy = current > average && shortAverage > priorAverage;
    return { action: buy ? 'BUY' : 'HOLD', reason: buy ? 'Price is above the recent average and the short trend is rising.' : 'Trend confirmation is incomplete.', score: Math.abs(distancePct) };
  }
  if (bot.strategy === 'mean-reversion') {
    const buy = distancePct <= -1 && current > priorLow;
    return { action: buy ? 'BUY' : 'HOLD', reason: buy ? `Price is ${Math.abs(distancePct).toFixed(2)}% below its recent average and has stabilized above the recent low.` : `Price is ${distancePct.toFixed(2)}% from its average; waiting for a deeper, stabilizing pullback.`, score: Math.abs(distancePct) };
  }
  const breakoutPct = priorHigh > 0 ? ((current - priorHigh) / priorHigh) * 100 : 0;
  const buy = current > priorHigh && breakoutPct >= 0.15;
  return { action: buy ? 'BUY' : 'HOLD', reason: buy ? `Price broke the recent range by ${breakoutPct.toFixed(2)}%.` : 'No confirmed break above the recent range yet.', score: Math.abs(breakoutPct) };
}

async function accountSnapshot() {
  const [account, positions] = await Promise.all([
    jsonFetch(`${PAPER_BASE}/v2/account`),
    jsonFetch(`${PAPER_BASE}/v2/positions`),
  ]);
  const equity = Number(account.equity || 0);
  const lastEquity = Number(account.last_equity || equity || 0);
  return { account, equity, cash: Number(account.cash || 0), dayPnl: Number((equity - lastEquity).toFixed(2)), positions: positions || [] };
}

async function reconcileFills(bot) {
  const activity = await loadBotActivity(bot.id, 120);
  const filled = new Set(activity.filter((row) => row.event_type === 'BOT_FILL').map((row) => row.order_id).filter(Boolean));
  const pending = activity.filter((row) => ['BOT_ORDER', 'BOT_EXIT'].includes(row.event_type) && row.order_id && !filled.has(row.order_id)).slice(0, 12);
  for (const row of pending) {
    try {
      const order = await jsonFetch(`${PAPER_BASE}/v2/orders/${encodeURIComponent(row.order_id)}`);
      if (order?.status !== 'filled') continue;
      await writeBotEvent({
        botId: bot.id,
        eventType: 'BOT_FILL',
        status: 'FILLED',
        symbol: bot.symbol,
        side: String(order.side || row.side || '').toUpperCase(),
        orderId: row.order_id,
        message: `${String(order.side || row.side || '').toUpperCase()} filled: ${order.filled_qty || order.qty || '0'} ${bot.symbol} at about $${Number(order.filled_avg_price || 0).toFixed(4)}.`,
        metadata: { filledQty: Number(order.filled_qty || 0), filledAvgPrice: Number(order.filled_avg_price || 0), parentEventType: row.event_type },
      });
    } catch {}
  }
  return loadBotActivity(bot.id, 120);
}

function ownedQty(activity) {
  return Math.max(0, activity.filter((row) => row.event_type === 'BOT_FILL').reduce((total, row) => {
    const qty = Number(row?.metadata?.filledQty || 0);
    return total + (String(row.side || '').toUpperCase() === 'SELL' ? -qty : qty);
  }, 0));
}

async function audit(bot, eventType, status, message, metadata = {}) {
  return writeBotEvent({ botId: bot.id, eventType, status, symbol: bot.symbol, message, metadata });
}

export async function POST(request) {
  if (!authorized(request)) return Response.json({ error: 'Invalid engine access token.' }, { status: 401 });
  if (!process.env.ALPACA_API_KEY || !process.env.ALPACA_API_SECRET) return Response.json({ error: 'Alpaca paper credentials are not configured.' }, { status: 400 });

  const bots = (await loadBots()).filter((bot) => bot.status === 'running');
  const safety = safetyState();
  const blocked = entryBlockReason(safety);
  if (blocked) return Response.json({ ok: true, blocked: true, safety, runningBots: bots.length, message: blocked });

  const snapshot = await accountSnapshot();
  const shared = sharedRiskLimits(snapshot.equity);
  const dailyLossUsd = Math.max(-snapshot.dayPnl, 0);
  const results = [];
  const claimedSymbols = new Set();

  for (const bot of bots.slice(0, 20)) {
    try {
      const key = keyFor(bot.symbol);
      if (claimedSymbols.has(key)) {
        await audit(bot, 'BOT_REJECT', 'REJECTED', 'Another running bot already owns this symbol for the current cycle. Duplicate active symbols are blocked.');
        results.push({ botId: bot.id, action: 'REJECT', reason: 'duplicate active symbol' });
        continue;
      }
      claimedSymbols.add(key);

      if (dailyLossUsd >= Math.min(shared.maxDailyLossUsd, bot.maxDailyLossUsd)) {
        await audit(bot, 'BOT_REJECT', 'REJECTED', `Daily account loss of $${dailyLossUsd.toFixed(2)} reached this bot's $${bot.maxDailyLossUsd.toFixed(2)} limit.`);
        results.push({ botId: bot.id, action: 'REJECT', reason: 'daily loss limit' });
        continue;
      }

      const activity = await reconcileFills(bot);
      const botQty = ownedQty(activity);
      const position = snapshot.positions.find((item) => keyFor(item.symbol) === key);

      if (position && botQty > 0) {
        const plpc = Number(position.unrealized_plpc || 0) * 100;
        const exitReason = plpc <= -bot.stopLossPct ? `${bot.stopLossPct}% stop-loss reached` : plpc >= bot.takeProfitPct ? `${bot.takeProfitPct}% take-profit reached` : '';
        if (exitReason) {
          const qty = Math.min(botQty, Math.max(Number(position.qty || 0), 0));
          if (qty > 0) {
            const order = await jsonFetch(`${PAPER_BASE}/v2/orders`, { method: 'POST', body: JSON.stringify({ symbol: bot.symbol, side: 'sell', type: 'market', time_in_force: bot.assetType === 'crypto' ? 'gtc' : 'day', qty: String(qty), client_order_id: `ce-${bot.id.slice(0, 8)}-exit-${Date.now()}`.slice(0, 48) }) });
            await writeBotEvent({ botId: bot.id, eventType: 'BOT_EXIT', status: 'ACCEPTED', symbol: bot.symbol, side: 'SELL', orderId: order.id, message: `${exitReason}; submitted a paper exit for ${qty} ${bot.symbol}.`, metadata: { qty, unrealizedPlpc: plpc } });
            results.push({ botId: bot.id, action: 'EXIT', orderId: order.id });
            continue;
          }
        }
        await audit(bot, 'BOT_DECISION', 'HOLD', `Holding the bot-owned ${bot.symbol} position. Unrealized movement is ${plpc.toFixed(2)}%; exit limits are -${bot.stopLossPct}% / +${bot.takeProfitPct}%.`, { unrealizedPlpc: plpc });
        results.push({ botId: bot.id, action: 'HOLD', reason: 'position open' });
        continue;
      }

      if (position && botQty <= 0) {
        await audit(bot, 'BOT_REJECT', 'REJECTED', 'A broker position already exists for this symbol but was not opened by this bot. The bot will not take ownership of a manual or other-bot position.');
        results.push({ botId: bot.id, action: 'REJECT', reason: 'unowned existing position' });
        continue;
      }

      if (snapshot.positions.length >= shared.maxOpenPositions) {
        await audit(bot, 'BOT_REJECT', 'REJECTED', `Shared account limit of ${shared.maxOpenPositions} open positions is already reached.`);
        results.push({ botId: bot.id, action: 'REJECT', reason: 'shared position limit' });
        continue;
      }

      const exposure = snapshot.positions.reduce((sum, item) => sum + Math.abs(Number(item.market_value || 0)), 0);
      const projectedExposurePct = snapshot.equity > 0 ? ((exposure + bot.tradeAmount) / snapshot.equity) * 100 : 100;
      if (projectedExposurePct > shared.maxAggregateExposurePct) {
        await audit(bot, 'BOT_REJECT', 'REJECTED', `Shared bot exposure would exceed ${shared.maxAggregateExposurePct}% of paper equity.`);
        results.push({ botId: bot.id, action: 'REJECT', reason: 'shared exposure limit' });
        continue;
      }

      const series = await barsFor(bot);
      const signal = signalFor(bot, series);
      if (signal.action !== 'BUY') {
        await audit(bot, 'BOT_DECISION', 'HOLD', signal.reason, { strategy: bot.strategy, score: signal.score, lastPrice: series.at(-1)?.close || null });
        results.push({ botId: bot.id, action: 'HOLD', reason: signal.reason });
        continue;
      }

      const notional = Number(Math.min(bot.tradeAmount, shared.maxOrderNotional, snapshot.cash, snapshot.equity * 0.25).toFixed(2));
      const risk = evaluateRisk({
        symbol: bot.symbol,
        assetType: bot.assetType,
        side: 'BUY',
        notional,
        source: 'bot',
        equity: snapshot.equity,
        currentPositionValue: 0,
        currentQty: 0,
        dailyLossPct: snapshot.equity ? (dailyLossUsd / snapshot.equity) * 100 : 0,
        dailyLossUsd,
        openPositions: snapshot.positions.length,
        duplicate: false,
        killSwitch: false,
        executionAuthorized: true,
        autoExecution: true,
        limits: {
          maxOrderNotional: Math.min(shared.maxOrderNotional, bot.tradeAmount),
          maxPositionPct: shared.maxPositionPct,
          maxDailyLossPct: shared.maxDailyLossPct,
          maxDailyLossUsd: Math.min(shared.maxDailyLossUsd, bot.maxDailyLossUsd),
          maxOpenPositions: shared.maxOpenPositions,
          minOrderNotional: 1,
          staleMinutes: 9999,
        },
      });
      if (!risk.approved) {
        await audit(bot, 'BOT_REJECT', 'REJECTED', risk.reasons.join(' '), { strategy: bot.strategy, risk: risk.reasons });
        results.push({ botId: bot.id, action: 'REJECT', reason: risk.reasons.join(' ') });
        continue;
      }

      const order = await jsonFetch(`${PAPER_BASE}/v2/orders`, { method: 'POST', body: JSON.stringify({ symbol: bot.symbol, side: 'buy', type: 'market', time_in_force: bot.assetType === 'crypto' ? 'gtc' : 'day', notional: String(notional), client_order_id: `ce-${bot.id.slice(0, 8)}-buy-${Date.now()}`.slice(0, 48) }) });
      await writeBotEvent({ botId: bot.id, eventType: 'BOT_ORDER', status: 'ACCEPTED', symbol: bot.symbol, side: 'BUY', orderId: order.id, message: `${bot.strategy} signal passed shared risk checks; submitted a $${notional.toFixed(2)} paper buy.`, metadata: { notional, strategy: bot.strategy, signal } });
      results.push({ botId: bot.id, action: 'BUY', orderId: order.id, notional });
    } catch (error) {
      await audit(bot, 'BOT_REJECT', 'ERROR', String(error?.message || error)).catch(() => null);
      results.push({ botId: bot.id, action: 'ERROR', reason: String(error?.message || error) });
    }
  }

  return Response.json({ ok: true, blocked: false, safety, sharedRisk: shared, results, timestamp: new Date().toISOString() });
}
