import { createClient } from '@supabase/supabase-js';

function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_API_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function providerName(value) {
  return String(value || '').trim().toLowerCase().slice(0, 40);
}

export async function loadBrokerConnection(ownerKey, provider = 'robinhood') {
  const client = db();
  if (!client || !ownerKey) return null;
  const name = providerName(provider);
  const { data, error } = await client
    .from('execution_audit')
    .select('id,created_at,event_type,status,message,metadata')
    .in('event_type', ['BROKER_CONNECTION', 'BROKER_DISCONNECT'])
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;

  const row = (data || []).find((item) => String(item?.metadata?.ownerKey || '') === ownerKey && String(item?.metadata?.provider || '') === name);
  if (!row || row.event_type === 'BROKER_DISCONNECT') return null;
  return {
    id: row.id,
    createdAt: row.created_at,
    status: String(row.status || row?.metadata?.status || 'UNKNOWN'),
    message: row.message || '',
    provider: name,
    ...(row?.metadata?.connection || {}),
  };
}

export async function saveBrokerConnection(ownerKey, provider, connection = {}, message = 'Broker connection updated.') {
  const client = db();
  if (!client) throw new Error('Supabase server storage is not configured.');
  if (!ownerKey) throw new Error('User scope is required.');
  const name = providerName(provider);
  const row = {
    event_type: 'BROKER_CONNECTION',
    mode: 'agentic',
    symbol: null,
    side: null,
    status: String(connection.status || 'CONNECTED').slice(0, 24),
    order_id: null,
    message: String(message || '').slice(0, 1000),
    metadata: {
      ownerKey,
      provider: name,
      status: String(connection.status || 'CONNECTED'),
      connection,
    },
  };
  const { data, error } = await client.from('execution_audit').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function disconnectBroker(ownerKey, provider = 'robinhood', message = 'Broker disconnected by user.') {
  const client = db();
  if (!client) throw new Error('Supabase server storage is not configured.');
  const name = providerName(provider);
  const row = {
    event_type: 'BROKER_DISCONNECT',
    mode: 'agentic',
    symbol: null,
    side: null,
    status: 'DISCONNECTED',
    order_id: null,
    message: String(message || '').slice(0, 1000),
    metadata: { ownerKey, provider: name, status: 'DISCONNECTED' },
  };
  const { data, error } = await client.from('execution_audit').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function findBrokerOwnerByAccountHash(provider, accountHash) {
  const client = db();
  if (!client || !accountHash) return '';
  const name = providerName(provider);
  const { data, error } = await client
    .from('execution_audit')
    .select('id,created_at,event_type,status,metadata')
    .in('event_type', ['BROKER_CONNECTION', 'BROKER_DISCONNECT'])
    .order('created_at', { ascending: false })
    .limit(1500);
  if (error) throw error;

  const resolvedOwners = new Set();
  for (const row of data || []) {
    const metadata = row?.metadata || {};
    if (String(metadata.provider || '') !== name) continue;
    const ownerKey = String(metadata.ownerKey || '');
    if (!ownerKey || resolvedOwners.has(ownerKey)) continue;
    resolvedOwners.add(ownerKey);
    if (row.event_type === 'BROKER_DISCONNECT') continue;
    const hashes = metadata?.connection?.agenticAccountHashes;
    if (Array.isArray(hashes) && hashes.includes(accountHash)) return ownerKey;
  }
  return '';
}
