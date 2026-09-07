import { isDashboardAuthorized } from '../../../lib/access.js';
import { buildIntelSnapshot } from '../../../lib/intel/index.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!isDashboardAuthorized(request)) return Response.json({ error: 'Sign in to access intelligence feeds.' }, { status: 401 });
  try {
    const data = await buildIntelSnapshot();
    return Response.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 502 });
  }
}
