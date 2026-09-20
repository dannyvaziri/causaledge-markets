import { createClient } from '@supabase/supabase-js';
import { authorizedUser, isDashboardAuthorized, matchesSecret } from '../../../../lib/access.js';
import { deleteBotConfig, loadBots, sanitizeBot, saveBotConfig, sharedRiskLimits } from '../../../../lib/bots.js';
import { paperEntryBlockReason, paperSafetyState, phase4SafeBaseline } from '../../../../lib/paper-safety.js';
import { primaryPaperOwnerKey, userScopeKey } from '../../../../lib/user-scope.js';

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

function serverAuthorized(request) {
  const configured = process.env.CRON_SECRET || process.env.ENGINE_SECRET || '';
  if (matchesSecret(request.headers.get('x-engine-secret'), configured)) return { kind: 'engine', ownerKey: primaryPaperOwnerKey() };
  if (!isDashboardAuthorized(request)) return null;
  const user = authorizedUser(request);
  if (!user) return null;
  const ownerKey = userScopeKey(user);
  if (ownerKey !== primaryPaperOwnerKey()) return null;
  return { kind: 'user', ownerKey };
}

function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_API_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function checkSupabaseAudit(ownerKey) {
  const client = supabase();
  if (!client) return { ok: false, detail: 'Supabase server storage is not configured.' };
  const marker = `phase4-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const row = {
    event_type: 'PHASE4_VALIDATION',
    mode: 'paper',
    symbol: null,
    side: null,
    status: 'PASS',
    order_id: null,
    message: 'Phase 4 production persistence probe.',
    metadata: { ownerKey, marker, validationOnly: true },
  };
  const inserted = await client.from('execution_audit').insert(row).select('id,created_at,metadata').single();
  if (inserted.error) throw inserted.error;
  const loaded = await client.from('execution_audit').select('id,created_at,metadata').eq('id', inserted.data.id).single();
  if (loaded.error) throw loaded.error;
  return { ok: loaded.data?.metadata?.marker === marker, auditId: loaded.data?.id || null };
}

async function checkTemporaryBots(ownerKey) {
  const stamp = Date.now().toString(36);
  const one = sanitizeBot({
    id: `phase4-stock-${stamp}`,
    name: 'Phase 4 stock validation',
    assetType: 'stock',
    symbol: 'SPY',
    strategy: 'trend',
    status: 'paused',
    tradeAmount: 1,
    stopLossPct: 3,
    takeProfitPct: 6,
    maxPositions: 1,
    maxDailyLossUsd: 1,
  }, { id: `phase4-stock-${stamp}` });
  const two = sanitizeBot({
    id: `phase4-crypto-${stamp}`,
    name: 'Phase 4 crypto validation',
    assetType: 'crypto',
    symbol: 'BTC/USD',
    strategy: 'momentum',
    status: 'running',
    tradeAmount: 1,
    stopLossPct: 3,
    takeProfitPct: 6,
    maxPositions: 1,
    maxDailyLossUsd: 1,
  }, { id: `phase4-crypto-${stamp}` });

  try {
    await saveBotConfig(one, 'Phase 4 temporary paused bot.', ownerKey);
    await saveBotConfig(two, 'Phase 4 temporary running bot.', ownerKey);
    const loaded = await loadBots(ownerKey);
    const stock = loaded.find((bot) => bot.id === one.id);
    const crypto = loaded.find((bot) => bot.id === two.id);
    return {
      ok: Boolean(stock && crypto && stock.status === 'paused' && crypto.status === 'running'),
      stockStatus: stock?.status || null,
      cryptoStatus: crypto?.status || null,
      stockSymbol: stock?.symbol || null,
      cryptoSymbol: crypto?.symbol || null,
    };
  } finally {
    await deleteBotConfig(one, 'Phase 4 temporary stock bot cleanup.', ownerKey).catch(() => null);
    await deleteBotConfig(two, 'Phase 4 temporary crypto bot cleanup.', ownerKey).catch(() => null);
  }
}

async function alpacaSnapshot() {
  const [account, positions, clock] = await Promise.all([
    jsonFetch(`${PAPER_BASE}/v2/account`),
    jsonFetch(`${PAPER_BASE}/v2/positions`),
    jsonFetch(`${PAPER_BASE}/v2/clock`),
  ]);
  return {
    ok: Boolean(account?.id && account?.status),
    account: {
      status: account?.status || null,
      equity: Number(account?.equity || 0),
      cash: Number(account?.cash || 0),
      buyingPower: Number(account?.buying_power || 0),
      tradingBlocked: Boolean(account?.trading_blocked),
    },
    positions: Array.isArray(positions) ? positions.length : 0,
    marketOpen: Boolean(clock?.is_open),
  };
}

async function stockDataProbe() {
  const data = await jsonFetch(`${DATA_BASE}/v2/stocks/SPY/bars?timeframe=5Min&limit=8&feed=iex&sort=asc`);
  const rows = Array.isArray(data?.bars) ? data.bars : [];
  if (rows.length >= 2) {
    return { ok: true, symbol: 'SPY', source: '5Min bars', bars: rows.length, lastPrice: Number(rows.at(-1)?.c || 0) || null };
  }

  const snapshot = await jsonFetch(`${DATA_BASE}/v2/stocks/SPY/snapshot?feed=iex`);
  const price = Number(snapshot?.latestTrade?.p || snapshot?.minuteBar?.c || snapshot?.dailyBar?.c || snapshot?.prevDailyBar?.c || 0);
  return {
    ok: price > 0,
    symbol: 'SPY',
    source: 'snapshot/off-hours fallback',
    bars: rows.length,
    lastPrice: price || null,
  };
}

async function cryptoDataProbe() {
  const data = await jsonFetch(`${DATA_BASE}/v1beta3/crypto/us/bars?symbols=BTC%2FUSD&timeframe=5Min&limit=8&sort=asc`);
  const rows = data?.bars?.['BTC/USD'] || data?.bars?.BTCUSD || [];
  return { ok: Array.isArray(rows) && rows.length >= 2, symbol: 'BTC/USD', bars: Array.isArray(rows) ? rows.length : 0, lastPrice: Number(rows?.at?.(-1)?.c || 0) || null };
}

export async function GET(request) {
  const auth = serverAuthorized(request);
  if (!auth?.ownerKey) return Response.json({ error: 'Phase 4 validation requires the paper-account owner or engine secret.' }, { status: 401 });

  const checks = {};
  const errors = [];
  const run = async (name, fn) => {
    try {
      checks[name] = await fn();
      if (!checks[name]?.ok) errors.push(name);
    } catch (error) {
      checks[name] = { ok: false, detail: String(error?.message || error) };
      errors.push(name);
    }
  };

  const safety = paperSafetyState();
  checks.safetyBaseline = {
    ok: phase4SafeBaseline(safety),
    ...safety,
    entryBlockReason: paperEntryBlockReason(safety),
  };
  if (!checks.safetyBaseline.ok) errors.push('safetyBaseline');

  checks.liveMoneyDisabled = { ok: safety.liveTrading === false };
  if (!checks.liveMoneyDisabled.ok) errors.push('liveMoneyDisabled');

  checks.credentials = {
    ok: Boolean(process.env.ALPACA_API_KEY && process.env.ALPACA_API_SECRET),
    alpacaPaperConfigured: Boolean(process.env.ALPACA_API_KEY && process.env.ALPACA_API_SECRET),
    liveBrokerConfigured: Boolean(process.env.LIVE_ALPACA_API_KEY && process.env.LIVE_ALPACA_API_SECRET),
  };
  if (!checks.credentials.ok) errors.push('credentials');

  if (checks.credentials.ok) {
    await run('alpacaPaper', alpacaSnapshot);
    await run('stockMarketData', stockDataProbe);
    await run('cryptoMarketData', cryptoDataProbe);
  }

  await run('supabasePersistence', () => checkSupabaseAudit(auth.ownerKey));
  await run('multiBotPersistence', () => checkTemporaryBots(auth.ownerKey));

  const accountEquity = Number(checks.alpacaPaper?.account?.equity || 100);
  const limits = sharedRiskLimits(accountEquity);
  checks.sharedRisk = {
    ok: limits.maxOpenPositions === 2 &&
      limits.maxAggregateExposurePct === 50 &&
      limits.maxPositionPct === 25 &&
      limits.maxDailyLossPct === 3 &&
      limits.maxOrderNotional <= 25,
    ...limits,
  };
  if (!checks.sharedRisk.ok) errors.push('sharedRisk');

  checks.killSwitch = {
    ok: safety.killSwitch === true && Boolean(paperEntryBlockReason({ ...safety, multiBotArmed: true, paperExecution: true, autoExecution: true, liveTrading: false })),
    current: safety.killSwitch,
    blocksNewEntries: safety.killSwitch === true,
  };
  if (!checks.killSwitch.ok) errors.push('killSwitch');

  return Response.json({
    ok: errors.length === 0,
    phase: 4,
    mode: 'production-read-only-validation',
    orderPlaced: false,
    liveTradingEnabled: false,
    checks,
    failures: errors,
    next: errors.length ? 'Fix failing checks before paper execution is armed.' : 'Read-only Phase 4 validation passed. Paper execution may be armed separately for a controlled paper-order test.',
    timestamp: new Date().toISOString(),
  }, { status: errors.length ? 503 : 200, headers: { 'Cache-Control': 'no-store' } });
}
