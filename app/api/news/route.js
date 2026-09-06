import { isDashboardAuthorized } from '../../../lib/access.js';
const DATA_BASE = 'https://data.alpaca.markets';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!isDashboardAuthorized(request)) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const symbols = String(searchParams.get('symbols') || 'AAPL,MSFT,NVDA,AMZN,META,GOOGL,TSLA,AMD,JPM,SPY')
    .toUpperCase().replace(/[^A-Z.,]/g, '').slice(0, 250);

  if (!process.env.ALPACA_API_KEY || !process.env.ALPACA_API_SECRET) {
    return Response.json({ demo: true, news: [] });
  }

  const url = `${DATA_BASE}/v1beta1/news?sort=desc&limit=30&include_content=false&symbols=${encodeURIComponent(symbols)}`;
  const res = await fetch(url, {
    headers: {
      'APCA-API-KEY-ID': process.env.ALPACA_API_KEY,
      'APCA-API-SECRET-KEY': process.env.ALPACA_API_SECRET,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const detail = await res.text();
    return Response.json({ demo: false, error: detail.slice(0, 800), news: [] }, { status: 502 });
  }

  const data = await res.json();
  const news = (data.news || []).map((item) => ({
    id: String(item.id),
    headline: item.headline,
    summary: item.summary,
    source: item.source,
    symbols: item.symbols || [],
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    url: item.url,
  }));

  return Response.json({ demo: false, news });
}
