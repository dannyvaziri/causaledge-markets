import { isDashboardAuthorized } from '../../../lib/access.js';
import { buildSymbolDossier } from '../../../lib/intel/index.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!isDashboardAuthorized(request)) return Response.json({ error: 'Sign in to access dossiers.' }, { status: 401 });
  const symbol = new URL(request.url).searchParams.get('symbol') || '';
  try {
    return Response.json(await buildSymbolDossier(symbol));
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 400 });
  }
}
