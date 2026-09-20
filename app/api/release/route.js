export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    service: 'causaledge-markets',
    release: 'phase3-user-robinhood-v1',
    userScopedBots: true,
    robinhoodAgentic: {
      endpoint: 'https://agent.robinhood.com/mcp/trading',
      perUserOAuth: true,
      causalEdgeTradingEnabled: false,
    },
    safety: {
      liveTrading: false,
      phase: 3,
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
