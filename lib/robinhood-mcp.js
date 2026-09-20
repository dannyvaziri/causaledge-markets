import crypto from 'node:crypto';
import { decryptBrokerValue, encryptBrokerValue, maskAccountReference } from './broker-secrets.js';
import { loadBrokerConnection, saveBrokerConnection } from './broker-store.js';

export const ROBINHOOD_MCP_URL = String(process.env.ROBINHOOD_MCP_URL || 'https://agent.robinhood.com/mcp/trading');

async function fetchJson(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, cache: 'no-store' });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch {}
    return { response, body, text };
  } finally {
    clearTimeout(timer);
  }
}

function authMetadataCandidates(issuer) {
  const url = new URL(issuer);
  const path = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
  return [...new Set([
    `${url.origin}/.well-known/oauth-authorization-server${path}`,
    `${issuer.replace(/\/$/, '')}/.well-known/oauth-authorization-server`,
    `${url.origin}/.well-known/openid-configuration${path}`,
    `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`,
  ])];
}

function parseResourceMetadataHeader(value = '') {
  const match = String(value).match(/resource_metadata="([^"]+)"/i);
  return match?.[1] || '';
}

async function protectedResourceMetadata() {
  const initializeBody = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'CausalEdge Markets', version: '1.0.0' },
    },
  });
  const probe = await fetch(ROBINHOOD_MCP_URL, {
    method: 'POST',
    headers: { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' },
    body: initializeBody,
    redirect: 'manual',
    cache: 'no-store',
  }).catch(() => null);

  const advertised = parseResourceMetadataHeader(probe?.headers?.get('www-authenticate') || '');
  const endpoint = new URL(ROBINHOOD_MCP_URL);
  const candidates = [...new Set([
    advertised,
    `${endpoint.origin}/.well-known/oauth-protected-resource${endpoint.pathname}`,
    `${endpoint.origin}/.well-known/oauth-protected-resource`,
  ].filter(Boolean))];

  for (const url of candidates) {
    try {
      const result = await fetchJson(url);
      if (result.response.ok && result.body && typeof result.body === 'object') return { url, metadata: result.body };
    } catch {}
  }
  throw new Error('Robinhood OAuth resource metadata could not be discovered.');
}

export async function discoverRobinhoodOAuth() {
  const resource = await protectedResourceMetadata();
  const servers = Array.isArray(resource.metadata.authorization_servers) ? resource.metadata.authorization_servers : [];
  const issuers = servers.length ? servers : [resource.metadata.authorization_server].filter(Boolean);
  for (const issuer of issuers) {
    for (const url of authMetadataCandidates(String(issuer))) {
      try {
        const result = await fetchJson(url);
        const meta = result.body;
        if (result.response.ok && meta?.authorization_endpoint && meta?.token_endpoint) {
          return { resource, issuer: String(issuer), metadataUrl: url, metadata: meta };
        }
      } catch {}
    }
  }
  if (resource.metadata.authorization_endpoint && resource.metadata.token_endpoint) {
    return { resource, issuer: resource.metadata.resource || ROBINHOOD_MCP_URL, metadataUrl: resource.url, metadata: resource.metadata };
  }
  throw new Error('Robinhood OAuth authorization endpoints could not be discovered.');
}

export function pkcePair() {
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export async function ensureRobinhoodClient(ownerKey, redirectUri) {
  const existing = await loadBrokerConnection(ownerKey, 'robinhood');
  if (existing?.clientId) {
    return {
      clientId: existing.clientId,
      clientSecret: existing.clientSecretEncrypted ? decryptBrokerValue(existing.clientSecretEncrypted) : '',
      tokenEndpointAuthMethod: existing.tokenEndpointAuthMethod || 'none',
      existing,
    };
  }

  const configuredId = String(process.env.ROBINHOOD_MCP_CLIENT_ID || '');
  if (configuredId) {
    return {
      clientId: configuredId,
      clientSecret: String(process.env.ROBINHOOD_MCP_CLIENT_SECRET || ''),
      tokenEndpointAuthMethod: String(process.env.ROBINHOOD_MCP_TOKEN_AUTH_METHOD || (process.env.ROBINHOOD_MCP_CLIENT_SECRET ? 'client_secret_basic' : 'none')),
      existing,
    };
  }

  const discovered = await discoverRobinhoodOAuth();
  const registrationEndpoint = discovered.metadata.registration_endpoint;
  if (!registrationEndpoint) throw new Error('Robinhood did not advertise dynamic client registration. Configure ROBINHOOD_MCP_CLIENT_ID for this deployment.');

  const registration = await fetchJson(registrationEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_name: 'CausalEdge Markets',
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
  });
  if (!registration.response.ok || !registration.body?.client_id) {
    throw new Error(`Robinhood client registration failed (${registration.response.status}).`);
  }

  const connection = {
    status: 'CONNECTING',
    clientId: String(registration.body.client_id),
    clientSecretEncrypted: registration.body.client_secret ? encryptBrokerValue(String(registration.body.client_secret)) : '',
    tokenEndpointAuthMethod: String(registration.body.token_endpoint_auth_method || 'none'),
    clientIdIssuedAt: registration.body.client_id_issued_at || null,
    clientSecretExpiresAt: registration.body.client_secret_expires_at || null,
  };
  await saveBrokerConnection(ownerKey, 'robinhood', connection, 'Robinhood OAuth client registered for this user.');
  return {
    clientId: connection.clientId,
    clientSecret: registration.body.client_secret || '',
    tokenEndpointAuthMethod: connection.tokenEndpointAuthMethod,
    existing: connection,
  };
}

function tokenHeaders(clientId, clientSecret, method) {
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' };
  if (clientSecret && method === 'client_secret_basic') {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  }
  return headers;
}

function tokenBody(input, clientId, clientSecret, method) {
  const body = new URLSearchParams({ ...input, client_id: clientId });
  if (clientSecret && method === 'client_secret_post') body.set('client_secret', clientSecret);
  return body;
}

export async function exchangeRobinhoodCode({ ownerKey, code, verifier, redirectUri }) {
  const discovered = await discoverRobinhoodOAuth();
  const client = await ensureRobinhoodClient(ownerKey, redirectUri);
  const request = {
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code_verifier: verifier,
    resource: ROBINHOOD_MCP_URL,
  };
  const result = await fetchJson(discovered.metadata.token_endpoint, {
    method: 'POST',
    headers: tokenHeaders(client.clientId, client.clientSecret, client.tokenEndpointAuthMethod),
    body: tokenBody(request, client.clientId, client.clientSecret, client.tokenEndpointAuthMethod),
  });
  if (!result.response.ok || !result.body?.access_token) throw new Error(`Robinhood token exchange failed (${result.response.status}).`);

  const expiresIn = Number(result.body.expires_in || 0);
  const connection = {
    ...(client.existing || {}),
    status: 'CONNECTED',
    clientId: client.clientId,
    clientSecretEncrypted: client.clientSecret ? encryptBrokerValue(client.clientSecret) : client.existing?.clientSecretEncrypted || '',
    tokenEndpointAuthMethod: client.tokenEndpointAuthMethod,
    accessTokenEncrypted: encryptBrokerValue(String(result.body.access_token)),
    refreshTokenEncrypted: result.body.refresh_token ? encryptBrokerValue(String(result.body.refresh_token)) : client.existing?.refreshTokenEncrypted || '',
    tokenType: String(result.body.token_type || 'Bearer'),
    scope: String(result.body.scope || ''),
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    connectedAt: new Date().toISOString(),
    mcpUrl: ROBINHOOD_MCP_URL,
  };
  await saveBrokerConnection(ownerKey, 'robinhood', connection, 'Robinhood Agentic OAuth authorization completed.');
  return connection;
}

export async function accessTokenForUser(ownerKey) {
  let connection = await loadBrokerConnection(ownerKey, 'robinhood');
  if (!connection?.accessTokenEncrypted) return { connection, accessToken: '' };

  const expiresAt = connection.expiresAt ? Date.parse(connection.expiresAt) : 0;
  if (!expiresAt || expiresAt > Date.now() + 5 * 60 * 1000) {
    return { connection, accessToken: decryptBrokerValue(connection.accessTokenEncrypted) };
  }

  if (!connection.refreshTokenEncrypted) return { connection, accessToken: decryptBrokerValue(connection.accessTokenEncrypted) };
  const discovered = await discoverRobinhoodOAuth();
  const clientSecret = connection.clientSecretEncrypted ? decryptBrokerValue(connection.clientSecretEncrypted) : String(process.env.ROBINHOOD_MCP_CLIENT_SECRET || '');
  const method = connection.tokenEndpointAuthMethod || 'none';
  const result = await fetchJson(discovered.metadata.token_endpoint, {
    method: 'POST',
    headers: tokenHeaders(connection.clientId, clientSecret, method),
    body: tokenBody({
      grant_type: 'refresh_token',
      refresh_token: decryptBrokerValue(connection.refreshTokenEncrypted),
      resource: ROBINHOOD_MCP_URL,
    }, connection.clientId, clientSecret, method),
  });
  if (!result.response.ok || !result.body?.access_token) throw new Error('Robinhood access token refresh failed.');

  const expiresIn = Number(result.body.expires_in || 0);
  connection = {
    ...connection,
    status: 'CONNECTED',
    accessTokenEncrypted: encryptBrokerValue(String(result.body.access_token)),
    refreshTokenEncrypted: result.body.refresh_token ? encryptBrokerValue(String(result.body.refresh_token)) : connection.refreshTokenEncrypted,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : connection.expiresAt,
    scope: String(result.body.scope || connection.scope || ''),
    refreshedAt: new Date().toISOString(),
  };
  await saveBrokerConnection(ownerKey, 'robinhood', connection, 'Robinhood Agentic access token refreshed.');
  return { connection, accessToken: String(result.body.access_token) };
}

function parseMcpBody(text, contentType = '') {
  if (String(contentType).includes('text/event-stream')) {
    const payloads = String(text).split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).filter(Boolean);
    for (let i = payloads.length - 1; i >= 0; i -= 1) {
      try { return JSON.parse(payloads[i]); } catch {}
    }
    return null;
  }
  try { return JSON.parse(text); } catch { return null; }
}

async function mcpPost(accessToken, payload, sessionId = '') {
  const response = await fetch(ROBINHOOD_MCP_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Robinhood MCP request failed (${response.status}).`);
  return {
    body: parseMcpBody(text, response.headers.get('content-type') || ''),
    sessionId: response.headers.get('mcp-session-id') || sessionId,
  };
}

export async function robinhoodTools(accessToken) {
  const init = await mcpPost(accessToken, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'CausalEdge Markets', version: '1.0.0' } },
  });
  const sessionId = init.sessionId;
  await mcpPost(accessToken, { jsonrpc: '2.0', method: 'notifications/initialized', params: {} }, sessionId).catch(() => null);
  const tools = await mcpPost(accessToken, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, sessionId);
  return { sessionId, tools: tools.body?.result?.tools || [] };
}

async function callTool(accessToken, sessionId, name, args = {}) {
  const result = await mcpPost(accessToken, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name, arguments: args } }, sessionId);
  return result.body?.result || null;
}

function parseToolJson(result) {
  const structured = result?.structuredContent;
  if (structured && typeof structured === 'object') return structured;
  for (const item of result?.content || []) {
    if (item?.type !== 'text') continue;
    try { return JSON.parse(item.text); } catch {}
  }
  return null;
}

function accountSummaries(payload) {
  const list = Array.isArray(payload) ? payload : Array.isArray(payload?.accounts) ? payload.accounts : [];
  return list.slice(0, 20).map((item) => {
    const ref = item?.account_number || item?.accountNumber || item?.account_id || item?.accountId || '';
    return {
      maskedAccount: maskAccountReference(ref),
      agenticAllowed: Boolean(item?.agentic_allowed ?? item?.agenticAllowed),
      accountType: String(item?.account_type || item?.type || '').slice(0, 80),
      status: String(item?.status || '').slice(0, 80),
    };
  }).filter((item) => item.maskedAccount || item.agenticAllowed || item.accountType);
}

export async function verifyRobinhoodConnection(ownerKey) {
  const token = await accessTokenForUser(ownerKey);
  if (!token.accessToken) throw new Error('Robinhood is not connected for this user.');
  const listed = await robinhoodTools(token.accessToken);
  const names = listed.tools.map((tool) => String(tool?.name || '')).filter(Boolean);
  let accounts = [];
  const accountTool = names.find((name) => ['get_accounts', 'list_accounts', 'accounts'].includes(name));
  if (accountTool) {
    try { accounts = accountSummaries(parseToolJson(await callTool(token.accessToken, listed.sessionId, accountTool, {}))); } catch {}
  }
  const connection = {
    ...token.connection,
    status: 'CONNECTED',
    verifiedAt: new Date().toISOString(),
    toolNames: names.slice(0, 100),
    accountSummariesEncrypted: accounts.length ? encryptBrokerValue(accounts) : token.connection?.accountSummariesEncrypted || '',
  };
  await saveBrokerConnection(ownerKey, 'robinhood', connection, 'Robinhood Agentic MCP connection verified read-only.');
  return { connection, tools: names, accounts };
}

export function publicRobinhoodStatus(connection) {
  if (!connection) return { connected: false, provider: 'robinhood' };
  let accounts = [];
  try { accounts = connection.accountSummariesEncrypted ? decryptBrokerValue(connection.accountSummariesEncrypted) : []; } catch {}
  return {
    connected: connection.status === 'CONNECTED',
    provider: 'robinhood',
    status: connection.status || 'UNKNOWN',
    connectedAt: connection.connectedAt || null,
    verifiedAt: connection.verifiedAt || null,
    expiresAt: connection.expiresAt || null,
    scope: connection.scope || '',
    agenticAccounts: Array.isArray(accounts) ? accounts : [],
    toolCount: Array.isArray(connection.toolNames) ? connection.toolNames.length : 0,
  };
}
