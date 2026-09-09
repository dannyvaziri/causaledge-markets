import { isDashboardAuthorized } from '../../../lib/access.js';
import { writeAudit } from '../../../lib/audit.js';
import { evaluateRisk } from '../../../lib/risk.js';

const LIVE_BASE = 'https://api.alpaca.markets';
const seen = globalThis.__causalEdgeLiveSeen || new Set();
globalThis.__causalEdgeLiveSeen = seen;

function enabled() {
  return process.env.LIVE_TRADING_ENABLED === 'true';
}

function headers() {
  return {
    'APCA-API-KEY-ID': process.env.ALPACA_LIVE_API_KEY || '',
    'APCA-API-SECRET-KEY': process.env.ALPACA_LIVE_API_SECRET || '',
    'Content-Type': 'application/json',
  };
}

async function alpaca(path, options = {}) {
  const response = await fetch(`${LIVE_BASE}${path}`, { ...options, headers: { ...headers(), ...(options.headers || {}) }, cache: 'no-store' });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(data?.message || data?.raw || `Alpaca live API ${response.status}`);
  return data;
}

async function audit(entry) {
  try { return await writeAudit({ ...entry, mode: 'live' }); }
  catch (error) { return { persisted: false, error: String(error?.message || error) }; }
}

export async function POST(request) {
  if (!isDashboardAuthorized(request)) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const symbol = String(body.symbol || '').toUpperCase();
  const side = String(body.side || '').toUpperCase();
  const qty = Number(body.qty || 0);
  const notional = Number(body.notional || 0);
  const duplicateKey = String(body.intelligenceId || '').slice(0, 100) + ':' + symbol + ':' + side;

  if (!enabled()) {
    await audit({ eventType: 'ORDER', status: 'REJECTED', symbol, side, message: 'Live trading is disabled.' });
    return Response.json({ approved: false, error: 'Live trading is disabled.' }, { status: 403 });
  }
  if (body.confirmLive !== true || body.confirmationText !== 'I UNDERSTAND') {
    await audit({ eventType: 'ORDER', status: 'REJECTED', symbol, side, message: 'Explicit live-order confirmation missing.' });
    return Response.json({ approved: false, error: 'Explicit live-order confirmation is required.' }, { status: 400 });
  }
  if (!process.env.ALPACA_LIVE_API_KEY || !process.env.ALPACA_LIVE_API_SECRET) {
    await audit({ eventType: 'ORDER', status: 'REJECTED', symbol, side, message: 'Live credentials are not configured.' });
    return Response.json({ approved: false, error: 'Live credentials are not configured.' }, { status: 400 });
  }

  try {
    const [account, positions] = await Promise.all([alpaca('/v2/account'), alpaca('/v2/positions')]);
    const position = positions.find((item) => item.symbol === symbol);
    const equity = Number(account.equity || 0);
    const lastEquity = Number(account.last_equity || equity || 1);
    const dailyLossPct = Math.max(((lastEquity - equity) / Math.max(lastEquity, 1)) * 100, 0);
    const risk = evaluateRisk({
      symbol, side, qty, notional, source: 'manual', equity,
      currentPositionValue: Math.abs(Number(position?.market_value || 0)),
      currentQty: Math.max(Number(position?.qty || 0), 0), dailyLossPct,
      dailyLossUsd: Math.max(lastEquity - equity, 0), openPositions: positions.length,
      ageMinutes: Number(body.ageMinutes || 0), duplicate: seen.has(duplicateKey),
      killSwitch: process.env.TRADING_KILL_SWITCH === 'true', executionAuthorized: true, autoExecution: false,
      limits: { maxOrderNotional: Number(process.env.LIVE_MAX_ORDER_NOTIONAL || 25) },
    });
    if (!risk.approved) {
      await audit({ eventType: 'ORDER', status: 'REJECTED', symbol, side, message: risk.reasons.join(' '), metadata: { risk } });
      return Response.json({ approved: false, risk }, { status: 403 });
    }
    const order = side === 'BUY'
      ? { symbol, side: 'buy', type: 'market', time_in_force: 'day', notional: String(notional) }
      : { symbol, side: 'sell', type: 'market', time_in_force: 'day', qty: String(qty) };
    const placed = await alpaca('/v2/orders', { method: 'POST', body: JSON.stringify(order) });
    seen.add(duplicateKey);
    await audit({ eventType: 'ORDER', status: 'SUBMITTED', symbol, side, orderId: placed.id, message: 'Live order submitted after confirmation.', metadata: { risk } });
    return Response.json({ approved: true, liveTrading: true, broker: 'alpaca-live', risk, order: { id: placed.id, symbol: placed.symbol, side: placed.side, status: placed.status, qty: placed.qty, notional: placed.notional } });
  } catch (error) {
    await audit({ eventType: 'ORDER', status: 'ERROR', symbol, side, message: String(error?.message || error) });
    return Response.json({ approved: false, error: String(error?.message || error) }, { status: 502 });
  }
}
