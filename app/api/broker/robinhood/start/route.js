import { authorizedUser } from '../../../../../lib/access.js';
import { brokerSecretsConfigured } from '../../../../../lib/broker-secrets.js';
import { discoverRobinhoodOAuth, ensureRobinhoodClient, pkcePair, ROBINHOOD_MCP_URL } from '../../../../../lib/robinhood-mcp.js';
import { appOrigin, cookie, randomState, redirect, ROBINHOOD_STATE_COOKIE, seal } from '../../../../../lib/session.js';
import { userScopeKey } from '../../../../../lib/user-scope.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const origin = appOrigin(request);
  const user = authorizedUser(request);
  if (!user) return redirect(`${origin}/?broker=signin-required`);
  if (process.env.ROBINHOOD_CONNECTIONS_ENABLED === 'false' || !brokerSecretsConfigured()) {
    return redirect(`${origin}/?broker=robinhood-config`);
  }

  try {
    const ownerKey = userScopeKey(user);
    const redirectUri = `${origin}/api/broker/robinhood/callback`;
    const discovered = await discoverRobinhoodOAuth();
    const client = await ensureRobinhoodClient(ownerKey, redirectUri);
    const state = randomState();
    const pkce = pkcePair();
    const url = new URL(discovered.metadata.authorization_endpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', client.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', pkce.challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('resource', ROBINHOOD_MCP_URL);

    const explicitScopes = String(process.env.ROBINHOOD_MCP_SCOPES || '').trim();
    const supported = Array.isArray(discovered.metadata.scopes_supported) ? discovered.metadata.scopes_supported : [];
    const scopes = explicitScopes || (supported.includes('internal') ? 'internal' : '');
    if (scopes) url.searchParams.set('scope', scopes);

    const stateCookie = seal({
      state,
      verifier: pkce.verifier,
      ownerKey,
      exp: Date.now() + 10 * 60 * 1000,
    });
    return redirect(url.toString(), [cookie(ROBINHOOD_STATE_COOKIE, stateCookie, 600)]);
  } catch {
    return redirect(`${origin}/?broker=robinhood-start-error`);
  }
}
