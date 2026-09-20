import { authorizedUser } from '../../../../../lib/access.js';
import { brokerSecretsConfigured } from '../../../../../lib/broker-secrets.js';
import { loadBrokerConnection } from '../../../../../lib/broker-store.js';
import { publicRobinhoodStatus, ROBINHOOD_MCP_URL } from '../../../../../lib/robinhood-mcp.js';
import { userScopeKey } from '../../../../../lib/user-scope.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const user = authorizedUser(request);
  if (!user) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  try {
    const ownerKey = userScopeKey(user);
    const connection = await loadBrokerConnection(ownerKey, 'robinhood');
    return Response.json({
      ...publicRobinhoodStatus(connection),
      connectionEnabled: process.env.ROBINHOOD_CONNECTIONS_ENABLED !== 'false',
      encryptionConfigured: brokerSecretsConfigured(),
      mcp: ROBINHOOD_MCP_URL,
      userBound: true,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return Response.json({ error: 'Robinhood connection status is unavailable.', detail: String(error?.message || error) }, { status: 503 });
  }
}
