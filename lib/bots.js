import { createClient } from '@supabase/supabase-js';

export const BOT_STRATEGIES = Object.freeze(['momentum', 'trend', 'mean-reversion', 'breakout']);
export const BOT_STATUSES = Object.freeze(['running', 'paused', 'stopped']);

function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_API_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function numberInRange(value, fallback, min, max) {
  const parsed = Number(value);
  const resolved = Number.isFinite(parsed) ? parsed : fallback;
  return Math.max(min, Math.min(max, resolved));
}

function cleanName(value, fallback = 'Paper bot') {
  const text = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 48);
  return text || fallback;
}

export function normalizeBotSymbol(value, assetType = 'stock') {
  const symbol = String(value || '').trim().toUpperCase().replace('-', '/');
  const valid = assetType === 'crypto' ? /^[A-Z]{2,8}\/[A-Z]{2,8}$/.test(symbol) : /^[A-Z.]{1,10}$/.test(symbol);
  if (!valid) throw new Error(assetType === 'crypto' ? 'Use a crypto pair such as BTC/USD.' : 'Use a valid stock ticker such as AAPL.');
  return symbol;
}

export function sanitizeBot(input = {}, options = {}) {
  const assetType = input.assetType === 'crypto' ? 'crypto' : 'stock';
  const symbol = normalizeBotSymbol(input.symbol || (assetType === 'crypto' ? 'BTC/USD' : 'SPY'), assetType);
  const strategy = BOT_STRATEGIES.includes(input.strategy) ? input.strategy : 'momentum';
  const status = BOT_STATUSES.includes(input.status) ? input.status : 'paused';
  const now = new Date().toISOString();
  return {
    id: String(options.id || input.id || crypto.randomUUID()).slice(0, 80),
    name: cleanName(input.name, `${symbol} ${strategy.replace('-', ' ')}`),
    assetType,
    symbol,
    strategy,
    status,
    tradeAmount: Number(numberInRange(input.tradeAmount, 5, 1, 25).toFixed(2)),
    stopLossPct: Number(numberInRange(input.stopLossPct, 3, 0.5, 10).toFixed(2)),
    takeProfitPct: Number(numberInRange(input.takeProfitPct, 6, 1, 20).toFixed(2)),
    maxPositions: Math.round(numberInRange(input.maxPositions, 1, 1, 2)),
    maxDailyLossUsd: Number(numberInRange(input.maxDailyLossUsd, 2, 0.5, 3).toFixed(2)),
    createdAt: String(input.createdAt || now),
    updatedAt: now,
  };
}

export function sharedRiskLimits(equity = 100) {
  const value = Math.max(Number(equity || 100), 1);
  return {
    maxOpenPositions: 2,
    maxAggregateExposurePct: 50,
    maxPositionPct: 25,
    maxDailyLossPct: 3,
    maxDailyLossUsd: Number(Math.max(3, value * 0.03).toFixed(2)),
    maxOrderNotional: Number(Math.min(25, Math.max(1, value * 0.25)).toFixed(2)),
  };
}

export async function writeBotEvent({ botId, eventType, status, symbol = '', side = '', orderId = '', message, metadata = {} }) {
  const client = db();
  if (!client) throw new Error('Supabase server storage is not configured.');
  const row = {
    event_type: eventType,
    mode: 'paper',
    symbol: symbol || null,
    side: side || null,
    status: status || 'INFO',
    order_id: orderId || null,
    message: String(message || '').slice(0, 1000),
    metadata: { ...metadata, botId: String(botId || '') },
  };
  const { data, error } = await client.from('execution_audit').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function saveBotConfig(bot, message = 'Bot configuration saved.') {
  const clean = sanitizeBot(bot, { id: bot.id });
  await writeBotEvent({
    botId: clean.id,
    eventType: 'BOT_CONFIG',
    status: clean.status.toUpperCase(),
    symbol: clean.symbol,
    message,
    metadata: { config: clean },
  });
  return clean;
}

export async function deleteBotConfig(bot, message = 'Bot deleted.') {
  await writeBotEvent({
    botId: bot.id,
    eventType: 'BOT_DELETE',
    status: 'DELETED',
    symbol: bot.symbol,
    message,
    metadata: { config: bot },
  });
}

export async function loadBots() {
  const client = db();
  if (!client) return [];
  const { data, error } = await client
    .from('execution_audit')
    .select('id,created_at,event_type,status,symbol,message,metadata')
    .in('event_type', ['BOT_CONFIG', 'BOT_DELETE'])
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw error;

  const resolved = new Map();
  for (const row of data || []) {
    const botId = String(row?.metadata?.botId || '');
    if (!botId || resolved.has(botId)) continue;
    if (row.event_type === 'BOT_DELETE') {
      resolved.set(botId, null);
      continue;
    }
    const config = row?.metadata?.config;
    if (!config) continue;
    try { resolved.set(botId, sanitizeBot(config, { id: botId })); }
    catch { resolved.set(botId, null); }
  }
  return [...resolved.values()].filter(Boolean).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function loadBotActivity(botId, limit = 80) {
  const client = db();
  if (!client) return [];
  const { data, error } = await client
    .from('execution_audit')
    .select('id,created_at,event_type,status,symbol,side,order_id,message,metadata')
    .order('created_at', { ascending: false })
    .limit(Math.max(200, Math.min(1000, limit * 8)));
  if (error) throw error;
  return (data || []).filter((row) => String(row?.metadata?.botId || '') === String(botId)).slice(0, limit);
}

export async function loadRecentBotActivity(limit = 120) {
  const client = db();
  if (!client) return [];
  const { data, error } = await client
    .from('execution_audit')
    .select('id,created_at,event_type,status,symbol,side,order_id,message,metadata')
    .order('created_at', { ascending: false })
    .limit(Math.max(100, Math.min(1000, limit * 3)));
  if (error) throw error;
  return (data || []).filter((row) => String(row.event_type || '').startsWith('BOT_')).slice(0, limit);
}
