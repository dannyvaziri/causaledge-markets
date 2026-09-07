export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    ok: true,
    service: 'causaledge-markets',
    product: 'CausalEdge Markets',
    mode: process.env.ALPACA_API_KEY && process.env.ALPACA_API_SECRET ? 'alpaca-paper' : 'demo',
    liveTrading: false,
    paperExecutionEnabled: process.env.PAPER_EXECUTION_ENABLED === 'true',
    autoExecutionEnabled: process.env.AUTO_EXECUTION_ENABLED === 'true',
    killSwitch: process.env.TRADING_KILL_SWITCH === 'true',
    aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    timestamp: new Date().toISOString(),
  });
}
