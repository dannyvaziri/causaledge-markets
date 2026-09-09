import { isDashboardAuthorized } from '../../../lib/access.js';
import { aiConfigured, aiProvider, requestStructured } from '../../../lib/ai.js';
import { buildIntelSnapshot } from '../../../lib/intel/index.js';

export const dynamic = 'force-dynamic';

function cleanText(value, max = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanProfile(profile = {}) {
  return {
    goal: cleanText(profile.goal, 120),
    target: Number(profile.target || 0),
    horizon: cleanText(profile.horizon, 80),
    risk: cleanText(profile.risk, 40),
    monthly: Number(profile.monthly || 0),
    interests: Array.isArray(profile.interests) ? profile.interests.slice(0, 10).map((item) => cleanText(item, 50)) : [],
  };
}

function cleanPortfolio(portfolio = {}) {
  const account = portfolio.account || {};
  return {
    equity: Number(account.equity || 0),
    cash: Number(account.cash || 0),
    buyingPower: Number(account.buyingPower || 0),
    positions: Array.isArray(portfolio.positions) ? portfolio.positions.slice(0, 30).map((position) => ({
      symbol: cleanText(position.symbol, 12).toUpperCase(),
      qty: Number(position.qty || 0),
      marketValue: Number(position.marketValue || 0),
      unrealizedPnl: Number(position.unrealizedPnl || 0),
      unrealizedPlpc: Number(position.unrealizedPlpc || 0),
    })) : [],
  };
}

export async function POST(request) {
  if (!isDashboardAuthorized(request)) return Response.json({ error: 'Sign in to use CausalEdge AI.' }, { status: 401 });
  if (!aiConfigured()) return Response.json({ error: 'The AI provider is not configured.' }, { status: 503 });

  try {
    const body = await request.json().catch(() => ({}));
    const question = cleanText(body.question, 1200);
    if (!question) return Response.json({ error: 'Ask a question first.' }, { status: 400 });

    const profile = cleanProfile(body.profile);
    const portfolio = cleanPortfolio(body.portfolio);
    const intel = await buildIntelSnapshot();
    const marketContext = (intel.markets || []).slice(0, 12).map((item) => ({ symbol: item.symbol, price: item.price, changePct: item.changePct }));
    const eventContext = (intel.events || []).slice(0, 16).map((item) => ({ type: item.type, title: item.title, severity: item.severity, symbols: item.symbols, country: item.country }));

    const schema = {
      type: 'object', additionalProperties: false,
      properties: {
        answer: { type: 'string' },
        keyPoints: { type: 'array', maxItems: 5, items: { type: 'string' } },
        portfolioConnections: { type: 'array', maxItems: 5, items: { type: 'string' } },
        risks: { type: 'array', maxItems: 4, items: { type: 'string' } },
        followUps: { type: 'array', maxItems: 3, items: { type: 'string' } },
      },
      required: ['answer', 'keyPoints', 'portfolioConnections', 'risks', 'followUps'],
    };

    const input = `You are CausalEdge AI, the educational copilot inside a PAPER-INVESTING research product. Explain markets clearly for a consumer investor. Use the supplied paper portfolio, investor goals, live market context and intelligence events. Distinguish observed facts from inference. Do not claim causality without evidence. Do not place, queue, recommend, or simulate an executable brokerage order. Do not tell the user a specific security is guaranteed to rise or fall. When discussing options, explain tradeoffs and uncertainty. Keep the answer useful, plain-English and concise.\n\nINVESTOR PROFILE:\n${JSON.stringify(profile)}\n\nPAPER PORTFOLIO:\n${JSON.stringify(portfolio)}\n\nMARKETS:\n${JSON.stringify(marketContext)}\n\nCURRENT INTELLIGENCE:\n${JSON.stringify(eventContext)}\n\nQUESTION:\n${question}`;

    const result = await requestStructured({ input, schema, name: 'causaledge_copilot' });
    return Response.json({ ...result, provider: aiProvider(), timestamp: new Date().toISOString() }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 502 });
  }
}
