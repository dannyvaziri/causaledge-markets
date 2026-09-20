import { createClient } from '@supabase/supabase-js';
import { matchesSecret } from '../../../../lib/access.js';
import { PHASE4_TEST_NOTIONAL, PHASE4_TEST_SYMBOL, phase4OrderTestPreconditions } from '../../../../lib/phase4-order-test.js';
import { primaryPaperOwnerKey } from '../../../../lib/user-scope.js';

export const dynamic = 'force-dynamic';

const PAPER_BASE = 'https://paper-api.alpaca.markets';
const TEST_POSITION_SYMBOL = 'BTCUSD';

function alpacaHeaders() {
  return {
    'APCA-API-KEY-ID': process.env.ALPACA_API_KEY || '',
    'APCA-API-SECRET-KEY': process.env.ALPACA_API_SECRET || '',
    'Content-Type': 'application/json',
  };
}

async function jsonFetch(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      cache: 'no-store',
      signal: controller.signal,
      headers: { ...alpacaHeaders(), ...(options.headers || {}) },
    });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch {}
    if (!response.ok) throw new Error(body?.message || `Request failed (${response.status})`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_API_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function latestAudit(ownerKey, eventType) {
  const client = supabase();
  if (!client) throw new Error('Supabase audit storage is required for the controlled paper-order test.');
  const { data, error } = await client
    .from('execution_audit')
    .select('id,created_at,event_type,status,order_id,message,metadata')
    .eq('event_type', eventType)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data || []).find((row) => String(row?.metadata?.ownerKey || '') === ownerKey) || null;
}

async function audit(ownerKey, eventType, status, message, metadata = {}) {
  const client = supabase();
  if (!client) throw new Error('Supabase audit storage is required.');
  const { error } = await client.from('execution_audit').insert({
    event_type: eventType,
    mode: 'paper',
    symbol: PHASE4_TEST_SYMBOL,
    side: metadata.side || null,
    status,
    order_id: metadata.orderId || null,
    message,
    metadata: { ...metadata, ownerKey, phase4: true, validationOnly: true },
  });
  if (error) throw error;
}

async function pollOrder(orderId, attempts = 15) {
  for (let i = 0; i < attempts; i += 1) {
    const order = await jsonFetch(`${PAPER_BASE}/v2/orders/${encodeURIComponent(orderId)}`);
    if (order?.status === 'filled') return order;
    if (['canceled', 'expired', 'rejected', 'suspended'].includes(String(order?.status || '').toLowerCase())) {
      throw new Error(`Paper order ended with status ${order.status}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Paper order did not fill within the validation window.');
}

async function snapshot() {
  const [account, positions, openOrders] = await Promise.all([
    jsonFetch(`${PAPER_BASE}/v2/account`),
    jsonFetch(`${PAPER_BASE}/v2/positions`),
    jsonFetch(`${PAPER_BASE}/v2/orders?status=open&limit=100`),
  ]);
  return { account, positions: positions || [], openOrders: openOrders || [] };
}

function isTestPosition(position) {
  return String(position?.symbol || '').replace(/[^A-Z0-9]/g, '').toUpperCase() === TEST_POSITION_SYMBOL;
}

async function waitUntilFlat(attempts = 15) {
  for (let i = 0; i < attempts; i += 1) {
    const state = await snapshot();
    if (!(state.positions || []).some(isTestPosition)) return state;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Controlled paper cleanup did not flatten BTC/USD within the validation window.');
}

async function closeTestPosition(ownerKey, reason) {
  const closeOrder = await jsonFetch(`${PAPER_BASE}/v2/positions/${TEST_POSITION_SYMBOL}`, { method: 'DELETE' });
  await audit(ownerKey, 'PHASE4_ORDER_TEST_SELL', 'ACCEPTED', reason, {
    side: 'SELL',
    orderId: closeOrder?.id || null,
    cleanup: true,
  });
  const fill = closeOrder?.id ? await pollOrder(closeOrder.id) : null;
  await waitUntilFlat();
  return { closeOrder, fill };
}

async function complete(ownerKey, metadata = {}) {
  await audit(ownerKey, 'PHASE4_ORDER_TEST_COMPLETE', 'PASS', 'Controlled $10 BTC/USD paper round-trip completed and account returned flat.', metadata);
}

export async function POST(request) {
  const expected = process.env.CRON_SECRET || process.env.ENGINE_SECRET || '';
  if (!matchesSecret(request.headers.get('x-engine-secret'), expected)) {
    return Response.json({ error: 'Invalid engine access token.' }, { status: 401 });
  }

  const ownerKey = primaryPaperOwnerKey();
  if (!ownerKey) return Response.json({ error: 'Paper-account owner is not configured.' }, { status: 503 });
  if (!process.env.ALPACA_API_KEY || !process.env.ALPACA_API_SECRET) {
    return Response.json({ error: 'Alpaca paper credentials are not configured.' }, { status: 503 });
  }
  if (process.env.LIVE_TRADING_ENABLED === 'true') {
    return Response.json({ error: 'Controlled paper-order test refused because live trading is enabled.' }, { status: 409 });
  }

  try {
    const priorComplete = await latestAudit(ownerKey, 'PHASE4_ORDER_TEST_COMPLETE');
    if (priorComplete) {
      return Response.json({
        ok: true,
        phase: 4,
        orderTestComplete: true,
        alreadyComplete: true,
        liveTradingEnabled: false,
        orderPlacedThisRun: false,
        completedAt: priorComplete.created_at,
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const before = await snapshot();

    // Recovery is intentionally narrow: only flatten BTC/USD if this exact Phase 4
    // validation previously submitted a buy and there are no unrelated positions/orders.
    if ((before.positions || []).length > 0) {
      const priorBuy = await latestAudit(ownerKey, 'PHASE4_ORDER_TEST_BUY');
      const onlyTestPosition = before.positions.length === 1 && isTestPosition(before.positions[0]);
      if (priorBuy && onlyTestPosition && before.openOrders.length === 0) {
        const recovered = await closeTestPosition(ownerKey, 'Recovered and closed the BTC/USD paper position created by the Phase 4 validation test.');
        await complete(ownerKey, {
          recovered: true,
          buyOrderId: priorBuy.order_id || priorBuy?.metadata?.orderId || null,
          sellOrderId: recovered.closeOrder?.id || null,
          sellAvgPrice: Number(recovered.fill?.filled_avg_price || 0),
        });
        return Response.json({
          ok: true,
          phase: 4,
          orderTestComplete: true,
          alreadyComplete: false,
          recovered: true,
          liveTradingEnabled: false,
          orderPlacedThisRun: true,
          residualPosition: false,
          timestamp: new Date().toISOString(),
        }, { headers: { 'Cache-Control': 'no-store' } });
      }
    }

    const preconditions = phase4OrderTestPreconditions({
      liveTrading: false,
      account: before.account,
      positions: before.positions,
      openOrders: before.openOrders,
    });
    if (!preconditions.approved) {
      await audit(ownerKey, 'PHASE4_ORDER_TEST_BLOCKED', 'BLOCKED', preconditions.reasons.join(' '), { reasons: preconditions.reasons });
      return Response.json({ ok: false, phase: 4, orderTestComplete: false, liveTradingEnabled: false, preconditions }, { status: 409 });
    }

    const buy = await jsonFetch(`${PAPER_BASE}/v2/orders`, {
      method: 'POST',
      body: JSON.stringify({
        symbol: PHASE4_TEST_SYMBOL,
        side: 'buy',
        type: 'market',
        time_in_force: 'gtc',
        notional: String(PHASE4_TEST_NOTIONAL),
        client_order_id: `ce-phase4-buy-${Date.now()}`.slice(0, 48),
      }),
    });
    await audit(ownerKey, 'PHASE4_ORDER_TEST_BUY', 'ACCEPTED', 'Submitted controlled $10 BTC/USD paper validation buy.', {
      side: 'BUY',
      orderId: buy.id,
      notional: PHASE4_TEST_NOTIONAL,
    });

    const buyFill = await pollOrder(buy.id);
    const filledQty = Number(buyFill?.filled_qty || 0);
    if (!(filledQty > 0)) throw new Error('Controlled paper buy returned no filled quantity.');

    const closed = await closeTestPosition(ownerKey, 'Closed the full BTC/USD paper validation position using Alpaca close-position.');
    await complete(ownerKey, {
      recovered: false,
      buyOrderId: buy.id,
      sellOrderId: closed.closeOrder?.id || null,
      buyFilledQty: filledQty,
      buyAvgPrice: Number(buyFill?.filled_avg_price || 0),
      sellAvgPrice: Number(closed.fill?.filled_avg_price || 0),
    });

    return Response.json({
      ok: true,
      phase: 4,
      orderTestComplete: true,
      alreadyComplete: false,
      liveTradingEnabled: false,
      orderPlacedThisRun: true,
      roundTrip: {
        symbol: PHASE4_TEST_SYMBOL,
        buyNotional: PHASE4_TEST_NOTIONAL,
        filledQty,
        buyStatus: buyFill.status,
        sellStatus: closed.fill?.status || 'submitted',
        residualPosition: false,
      },
      timestamp: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    await audit(ownerKey, 'PHASE4_ORDER_TEST_ERROR', 'ERROR', String(error?.message || error)).catch(() => null);
    return Response.json({
      ok: false,
      phase: 4,
      orderTestComplete: false,
      liveTradingEnabled: false,
      error: String(error?.message || error),
    }, { status: 502 });
  }
}
