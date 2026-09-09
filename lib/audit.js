import { createClient } from '@supabase/supabase-js';

let client;
function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_API_KEY;
  if (!url || !key) return null;
  client ||= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export async function writeAudit(entry = {}) {
  const record = {
    event_type: String(entry.eventType || 'SYSTEM').slice(0, 40),
    mode: String(entry.mode || 'paper').slice(0, 12),
    symbol: entry.symbol ? String(entry.symbol).slice(0, 12) : null,
    side: entry.side ? String(entry.side).slice(0, 8) : null,
    status: String(entry.status || 'INFO').slice(0, 24),
    order_id: entry.orderId ? String(entry.orderId).slice(0, 120) : null,
    message: String(entry.message || '').slice(0, 1000),
    metadata: entry.metadata || {},
  };
  const db = supabase();
  if (!db) return { persisted: false, record };
  const { error } = await db.from('execution_audit').insert(record);
  if (error) throw new Error(`Audit persistence failed: ${error.message}`);
  return { persisted: true, record };
}

export function auditConfigured() {
  return Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_API_KEY));
}
