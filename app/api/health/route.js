import { aiProvider } from '../../../lib/ai.js';

import { auditConfigured } from '../../../lib/audit.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.ALLOWED_GOOGLE_EMAILS);
  const authConfigured = Boolean(process.env.AUTH_SECRET);
  const liveTrading = process.env.LIVE_TRADING_ENABLED === 'true';
  const paperBrokerConfigured = Boolean(process.env.ALPACA_API_KEY && process.env.ALPACA_API_SECRET);
  const liveBrokerConfigured = Boolean(process.env.LIVE_ALPACA_API_KEY && process.env.LIVE_ALPACA_API_SECRET);
  const brokerConfigured = liveTrading ? liveBrokerConfigured : paperBrokerConfigured;
  const aiConfigured = Boolean(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY);
  const cronConfigured = Boolean(process.env.CRON_SECRET || process.env.ENGINE_SECRET);

  return Response.json({
    ok: true,
    service: 'causaledge-markets',
    product: 'CausalEdge Markets',
    mode: brokerConfigured ? (liveTrading ? 'alpaca-live' : 'alpaca-paper') : 'demo',
    liveTrading,
    configuration: {
      authConfigured,
      googleConfigured,
      brokerConfigured,
      liveBrokerConfigured,
      aiConfigured,
      aiProvider: aiProvider(),
      cronConfigured,
    appUrlConfigured: Boolean(process.env.APP_URL),
    auditConfigured: auditConfigured(),
    },
    paperExecutionEnabled: process.env.PAPER_EXECUTION_ENABLED === 'true',
    autoExecutionEnabled: process.env.AUTO_EXECUTION_ENABLED === 'true',
    killSwitch: process.env.TRADING_KILL_SWITCH === 'true',
    timestamp: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
