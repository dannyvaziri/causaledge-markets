import { createClient } from '@supabase/supabase-js';
import { isDashboardAuthorized } from '../../../../lib/access.js';

export const dynamic = 'force-dynamic';
const defaults = { symbol: 'SPY', active: false, notional: 10, stopLossPct: 3, takeProfitPct: 6, maxDailyLossUsd: 3 };
function db() { return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_API_KEY, { auth: { persistSession: false, autoRefreshToken: false } }); }

export async function GET(request) {
  if (!isDashboardAuthorized(request)) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  try { const { data } = await db().from('bot_configs').select('*').eq('id', 1).maybeSingle(); return Response.json({ bot: { ...defaults, ...(data || {}) } }); }
  catch { return Response.json({ bot: defaults }); }
}

export async function POST(request) {
  if (!isDashboardAuthorized(request)) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const symbol = String(body.symbol || '').trim().toUpperCase();
  const bot = { id: 1, symbol, active: body.active === true, notional: Number(body.notional), stop_loss_pct: Number(body.stopLossPct), take_profit_pct: Number(body.takeProfitPct), max_daily_loss_usd: Number(body.maxDailyLossUsd || 3) };
  if (!/^[A-Z.]{1,10}$/.test(symbol) || !Number.isFinite(bot.notional) || bot.notional < 1 || bot.notional > 25 || !Number.isFinite(bot.stop_loss_pct) || bot.stop_loss_pct < 0.5 || bot.stop_loss_pct > 10 || !Number.isFinite(bot.take_profit_pct) || bot.take_profit_pct < 1 || bot.take_profit_pct > 20) return Response.json({ error: 'Check the symbol and limits. Paper bot size must be $1–$25.' }, { status: 400 });
  try { const { data, error } = await db().from('bot_configs').upsert(bot).select().single(); if (error) throw error; return Response.json({ ok: true, bot: { ...defaults, ...data } }); }
  catch (error) { return Response.json({ error: 'Bot storage is not ready yet.', detail: String(error?.message || error) }, { status: 503 }); }
}
