import { aiProvider } from '../../../lib/ai.js';
import { auditConfigured } from '../../../lib/audit.js';
import { brokerSecretsConfigured, brokerUsesDedicatedKey } from '../../../lib/broker-secrets.js';
import { paperSafetyState } from '../../../lib/paper-safety.js';

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
  const robinhoodAgenticReady = Boolean(authConfigured && auditConfigured() && brokerSecretsConfigured() && process.env.APP_URL && process.env.ROBINHOOD_CONNECTIONS_ENABLED !== 'false');
  const paperSafety = paperSafetyState();

  return Response.json({
    ok: true,
    service: 'causaledge-markets',
    product: 'CausalEdge Markets',
    release: 'phase4-paper-validation-v1',
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
      robinhoodAgenticReady,
      brokerTokenEncryptionDedicated: brokerUsesDedicatedKey(),
      userScopedBots: true,
    },
    phase4PaperArmed: paperSafety.phase4Armed,
    multiBotExecutionEnabled: paperSafety.multiBotArmed,
    paperExecutionEnabled: paperSafety.paperExecution,
    autoExecutionEnabled: paperSafety.autoExecution,
    killSwitch: paperSafety.killSwitch,
    timestamp: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
