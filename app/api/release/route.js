export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    service: 'causaledge-markets',
    release: 'phase4-paper-validation-v1',
    userScopedBots: true,
    robinhoodAgentic: {
      endpoint: 'https://agent.robinhood.com/mcp/trading',
      perUserOAuth: true,
      causalEdgeTradingEnabled: false,
      phase4Validation: true,
    },
    safety: {
      liveTrading: false,
      phase: 4,
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
