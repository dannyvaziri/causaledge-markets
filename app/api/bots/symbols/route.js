import { isDashboardAuthorized } from '../../../../lib/access.js';

export const dynamic = 'force-dynamic';
const PAPER_BASE = 'https://paper-api.alpaca.markets';

function headers() {
  return {
    'APCA-API-KEY-ID': process.env.ALPACA_API_KEY || '',
    'APCA-API-SECRET-KEY': process.env.ALPACA_API_SECRET || '',
  };
}

export async function GET(request) {
  if (!isDashboardAuthorized(request)) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  if (!process.env.ALPACA_API_KEY || !process.env.ALPACA_API_SECRET) return Response.json({ suggestions: [] });
  const url = new URL(request.url);
  const query = String(url.searchParams.get('q') || '').trim().toUpperCase().slice(0, 24);
  if (!query) return Response.json({ suggestions: [] });
  try {
    const response = await fetch(`${PAPER_BASE}/v2/assets?status=active&asset_class=us_equity`, { headers: headers(), cache: 'no-store' });
    const assets = await response.json();
    if (!response.ok) throw new Error(assets?.message || `Asset search failed (${response.status})`);
    const normalized = query.replace('-', '/');
    const suggestions = (Array.isArray(assets) ? assets : [])
      .filter((asset) => asset.tradable !== false)
      .filter((asset) => {
        const symbol = String(asset.symbol || '').toUpperCase();
        const name = String(asset.name || '').toUpperCase();
        return symbol.startsWith(normalized) || symbol.includes(normalized) || name.includes(normalized);
      })
      .sort((a, b) => {
        const aSymbol = String(a.symbol || '').toUpperCase();
        const bSymbol = String(b.symbol || '').toUpperCase();
        const aStarts = aSymbol.startsWith(normalized) ? 0 : 1;
        const bStarts = bSymbol.startsWith(normalized) ? 0 : 1;
        return aStarts - bStarts || aSymbol.length - bSymbol.length || aSymbol.localeCompare(bSymbol);
      })
      .slice(0, 12)
      .map((asset) => ({ symbol: asset.symbol, name: asset.name || asset.symbol, assetType: 'stock', fractionable: Boolean(asset.fractionable) }));
    return Response.json({ suggestions }, { headers: { 'Cache-Control': 'private, max-age=30' } });
  } catch (error) {
    return Response.json({ suggestions: [], error: String(error?.message || error) }, { status: 200 });
  }
}
