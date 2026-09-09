import { isDashboardAuthorized } from '../../../lib/access.js';
import { evaluateRisk } from '../../../lib/risk.js';

const PAPER_BASE = 'https://paper-api.alpaca.markets';
const seen = globalThis.__signalForgeSeen || new Set();
globalThis.__signalForgeSeen = seen;

function headers() {
  return {
    'APCA-API-KEY-ID': process.env.ALPACA_API_KEY || '',
    'APCA-API-SECRET-KEY': process.env.ALPACA_API_SECRET || '',
    'Content-Type': 'application/json',
  };
}

async function alpaca(path, options = {}) {
  const res = await fetch(`${PAPER_BASE}${path}`, { ...options, headers: { ...headers(), ...(options.headers || {}) }, cache: 'no-store' });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data?.message || data?.raw || `Alpaca paper API ${res.status}`);
  return data;
}

export async function POST(request) {
  if (!isDashboardAuthorized(request)) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));

  if (!process.env.ALPACA_API_KEY || !process.env.ALPACA_API_SECRET) {
    return Response.json({ approved: false, demo: true, error: 'Alpaca paper credentials are not configured.' }, { status: 400 });
  }

  const symbol = String(body.symbol || '').toUpperCase();
  const assetType = body.assetType === 'crypto' ? 'crypto' : 'stock';
  const side = String(body.side || '').toUpperCase();
  const source = body.source === 'auto' ? 'auto' : 'manual';
  const qty = Number(body.qty || 0);
  const notional = Number(body.notional || 0);
  const intelligenceId = String(body.intelligenceId || '').slice(0, 100);
  const duplicateKey = intelligenceId ? `${intelligenceId}:${symbol}:${side}` : '';

  try {
    const [account, positions] = await Promise.all([
      alpaca('/v2/account'),
      alpaca('/v2/positions'),
    ]);
    const position = positions.find((p) => p.symbol === symbol);
    const equity = Number(account.equity || 0);
    const lastEquity = Number(account.last_equity || equity || 1);
    const dailyLossPct = Math.max(((lastEquity - equity) / Math.max(lastEquity, 1)) * 100, 0);

    const risk = evaluateRisk({
      symbol,
      assetType,
      side,
      qty,
      notional,
      source,
      equity,
      currentPositionValue: Math.abs(Number(position?.market_value || 0)),
      currentQty: Math.max(Number(position?.qty || 0), 0),
      dailyLossPct,
      openPositions: positions.length,
      confidence: Number(body.confidence || 0),
      impact: Number(body.impact || 0),
      ageMinutes: Number(body.ageMinutes || 0),
      duplicate: duplicateKey ? seen.has(duplicateKey) : false,
      killSwitch: process.env.TRADING_KILL_SWITCH === 'true',
      executionAuthorized: process.env.PAPER_EXECUTION_ENABLED === 'true',
      autoExecution: process.env.AUTO_EXECUTION_ENABLED === 'true',
    });

    if (!risk.approved) return Response.json({ approved: false, risk }, { status: 403 });

    const order = side === 'BUY'
      ? { symbol, side: 'buy', type: 'market', time_in_force: 'day', notional: String(notional) }
      : { symbol, side: 'sell', type: 'market', time_in_force: 'day', qty: String(qty) };

    const placed = await alpaca('/v2/orders', { method: 'POST', body: JSON.stringify(order) });
    if (duplicateKey) seen.add(duplicateKey);

    return Response.json({ approved: true, liveTrading: false, broker: 'alpaca-paper', risk, order: {
      id: placed.id, symbol: placed.symbol, side: placed.side, status: placed.status, qty: placed.qty, notional: placed.notional,
    }});
  } catch (error) {
    return Response.json({ approved: false, error: String(error?.message || error) }, { status: 502 });
  }
}
