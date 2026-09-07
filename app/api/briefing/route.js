import { isDashboardAuthorized } from '../../../lib/access.js';
import { buildBriefing, buildIntelSnapshot } from '../../../lib/intel/index.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!isDashboardAuthorized(request)) return Response.json({ error: 'Sign in to access AI briefings.' }, { status: 401 });
  try {
    const intel = await buildIntelSnapshot();
    const briefing = await buildBriefing(intel);
    return Response.json({ ...briefing, timestamp: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 502 });
  }
}
