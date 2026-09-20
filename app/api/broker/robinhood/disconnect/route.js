import { authorizedUser, isDashboardAuthorized } from '../../../../../lib/access.js';
import { disconnectBroker } from '../../../../../lib/broker-store.js';
import { userScopeKey } from '../../../../../lib/user-scope.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!isDashboardAuthorized(request)) return Response.json({ error: 'Invalid request.' }, { status: 401 });
  const user = authorizedUser(request);
  if (!user) return Response.json({ error: 'A signed-in user is required.' }, { status: 401 });
  try {
    await disconnectBroker(userScopeKey(user), 'robinhood', 'Robinhood Agentic connection disconnected from this CausalEdge user.');
    return Response.json({ ok: true, connected: false });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 503 });
  }
}
