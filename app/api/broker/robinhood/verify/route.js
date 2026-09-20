import { authorizedUser, isDashboardAuthorized } from '../../../../../lib/access.js';
import { verifyRobinhoodConnection } from '../../../../../lib/robinhood-mcp.js';
import { userScopeKey } from '../../../../../lib/user-scope.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!isDashboardAuthorized(request)) return Response.json({ error: 'Invalid request.' }, { status: 401 });
  const user = authorizedUser(request);
  if (!user) return Response.json({ error: 'A signed-in user is required.' }, { status: 401 });
  try {
    const result = await verifyRobinhoodConnection(userScopeKey(user));
    return Response.json({
      ok: true,
      connected: true,
      toolCount: result.tools.length,
      agenticAccounts: result.accounts,
      verifiedAt: new Date().toISOString(),
      tradingEnabledByCausalEdge: false,
    });
  } catch (error) {
    return Response.json({ ok: false, error: String(error?.message || error) }, { status: 502 });
  }
}
