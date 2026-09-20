import { authorizedUser } from '../../../../../lib/access.js';
import { exchangeRobinhoodCode, verifyRobinhoodConnection } from '../../../../../lib/robinhood-mcp.js';
import { appOrigin, clearCookie, readSealedCookie, redirect, ROBINHOOD_STATE_COOKIE } from '../../../../../lib/session.js';
import { userScopeKey } from '../../../../../lib/user-scope.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const origin = appOrigin(request);
  const user = authorizedUser(request);
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const saved = readSealedCookie(request, ROBINHOOD_STATE_COOKIE);

  if (error) return redirect(`${origin}/?broker=robinhood-denied`, [clearCookie(ROBINHOOD_STATE_COOKIE)]);
  if (!user || !code || !state || !saved || state !== saved.state) {
    return redirect(`${origin}/?broker=robinhood-callback-error`, [clearCookie(ROBINHOOD_STATE_COOKIE)]);
  }

  try {
    const ownerKey = userScopeKey(user);
    if (ownerKey !== saved.ownerKey) throw new Error('Robinhood authorization belongs to a different signed-in user.');
    const redirectUri = `${origin}/api/broker/robinhood/callback`;
    await exchangeRobinhoodCode({ ownerKey, code, verifier: saved.verifier, redirectUri });
    try {
      await verifyRobinhoodConnection(ownerKey);
      return redirect(`${origin}/?broker=robinhood-connected`, [clearCookie(ROBINHOOD_STATE_COOKIE)]);
    } catch {
      return redirect(`${origin}/?broker=robinhood-connected-unverified`, [clearCookie(ROBINHOOD_STATE_COOKIE)]);
    }
  } catch {
    return redirect(`${origin}/?broker=robinhood-token-error`, [clearCookie(ROBINHOOD_STATE_COOKIE)]);
  }
}
