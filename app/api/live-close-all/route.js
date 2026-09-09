import { isDashboardAuthorized } from '../../../lib/access.js';
import { writeAudit } from '../../../lib/audit.js';

const BASE = 'https://api.alpaca.markets';

async function closeAll() {
  const headers = {
    'APCA-API-KEY-ID': process.env.ALPACA_LIVE_API_KEY || '',
    'APCA-API-SECRET-KEY': process.env.ALPACA_LIVE_API_SECRET || '',
    'Content-Type': 'application/json',
  };
  const response = await fetch(`${BASE}/v2/positions`, { headers, cache: 'no-store' });
  const positions = await response.json().catch(() => []);
  if (!response.ok) throw new Error(positions?.message || 'Unable to read live positions.');
  const results = [];
  for (const position of positions) {
    const close = await fetch(`${BASE}/v2/positions/${encodeURIComponent(position.symbol)}`, { method: 'DELETE', headers, cache: 'no-store' });
    const data = await close.json().catch(() => ({}));
    if (!close.ok) throw new Error(data?.message || `Unable to close ${position.symbol}.`);
    results.push({ symbol: position.symbol, orderId: data.id || null, status: data.status || 'submitted' });
  }
  return results;
}

export async function POST(request) {
  if (!isDashboardAuthorized(request)) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (process.env.LIVE_TRADING_ENABLED !== 'true') return Response.json({ error: 'Live trading is disabled.' }, { status: 403 });
  if (process.env.TRADING_KILL_SWITCH !== 'true') return Response.json({ error: 'Emergency close requires the kill switch to be active.' }, { status: 409 });
  if (body.confirmCloseAll !== true || body.confirmationText !== 'CLOSE ALL LIVE POSITIONS') {
    return Response.json({ error: 'Explicit close-all confirmation is required.' }, { status: 400 });
  }
  try {
    const orders = await closeAll();
    await writeAudit({ eventType: 'EMERGENCY_CLOSE', status: 'SUBMITTED', message: `Submitted ${orders.length} live close orders.`, metadata: { orders } });
    return Response.json({ ok: true, orders });
  } catch (error) {
    await writeAudit({ eventType: 'EMERGENCY_CLOSE', status: 'ERROR', message: String(error?.message || error) });
    return Response.json({ ok: false, error: String(error?.message || error) }, { status: 502 });
  }
}
