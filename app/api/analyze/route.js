import { isDashboardAuthorized } from '../../../lib/access.js';
const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    signal: { type: 'string', enum: ['BUY','SELL','HOLD'] },
    sentiment: { type: 'string', enum: ['Bullish','Bearish','Neutral'] },
    confidence: { type: 'number', minimum: 0, maximum: 100 },
    impact: { type: 'number', minimum: 0, maximum: 10 },
    horizon: { type: 'string' },
    summary: { type: 'string' },
    thesis: { type: 'string' },
    risks: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    invalidation: { type: 'string' },
    pricedIn: { type: 'string' },
    relatedSymbols: { type: 'array', items: { type: 'string' }, maxItems: 6 },
  },
  required: ['signal','sentiment','confidence','impact','horizon','summary','thesis','risks','invalidation','pricedIn','relatedSymbols'],
};

function demo(symbol, headline) {
  return {
    signal: 'HOLD', sentiment: 'Neutral', confidence: 72, impact: 6.4, horizon: '1–3 days',
    summary: headline || `${symbol} has no configured live AI/news feed in demo mode.`,
    thesis: 'Wait for a verified catalyst and market confirmation before creating a paper-trade intent.',
    risks: ['Demo analysis is not based on a live licensed news feed.', 'Market reaction may differ from headline sentiment.'],
    invalidation: 'A material verified catalyst changes the expected risk/reward.',
    pricedIn: 'Unknown in demo mode.', relatedSymbols: [], demo: true,
  };
}

export async function POST(request) {
  if (!isDashboardAuthorized(request)) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const symbol = String(body.symbol || '').toUpperCase().slice(0, 10);
  const headline = String(body.headline || '').slice(0, 1000);
  const context = String(body.context || '').slice(0, 6000);

  if (!symbol) return Response.json({ error: 'symbol is required' }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) return Response.json(demo(symbol, headline));

  const prompt = `You are a market-news research analyst for a PAPER-TRADING system. You do not place trades, choose position sizes, or override risk controls. Analyze only the supplied information. Distinguish positive language from true financial surprise and consider whether the event may already be priced in.\n\nSymbol: ${symbol}\nHeadline: ${headline || 'None supplied'}\nContext: ${context || 'None supplied'}`;

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
      input: prompt,
      text: { format: { type: 'json_schema', name: 'market_analysis', strict: true, schema } },
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const detail = await res.text();
    return Response.json({ error: 'AI analysis failed', detail: detail.slice(0, 800) }, { status: 502 });
  }

  const data = await res.json();
  const text = data.output_text || data.output?.flatMap((o) => o.content || []).find((c) => c.type === 'output_text')?.text;
  if (!text) return Response.json({ error: 'AI returned no structured output' }, { status: 502 });
  return Response.json({ ...JSON.parse(text), demo: false });
}
