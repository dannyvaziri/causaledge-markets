# CausalEdge Markets

**CausalEdge Markets** is a global market-intelligence command center that connects real-world causes to market effects. It combines geopolitical events, hazards, supply-chain and country-risk intelligence, market/news data, AI-generated company and regional dossiers, relationship mapping, market briefings, and a deterministic risk-gated paper-trading engine.

The product is built around a simple idea:

```text
GLOBAL EVENT / COMPANY CATALYST
              ↓
NORMALIZED INTELLIGENCE LAYER
              ↓
AI CORRELATION + MARKET CONTEXT
              ↓
COMPANY / REGION / ENTITY DOSSIERS
              ↓
MARKET CONFIRMATION
              ↓
DETERMINISTIC RISK ENGINE
              ↓
ALPACA PAPER EXECUTION
```

> The current repository intentionally contains no live-money Alpaca execution endpoint. Automated execution is restricted to Alpaca paper trading.

## Core capabilities

- full-screen MapLibre global intelligence map
- normalized geopolitical and global-event feeds
- country-risk and supply-chain intelligence
- USGS earthquake data and NASA hazard fallbacks
- Alpaca market snapshots and financial news
- source-health monitoring and fail-soft data ingestion
- company dossiers with live market/news context
- regional dossiers from map locations
- AI market briefings that correlate current events and market activity
- entity/relationship views for connected companies and themes
- live watchlist ticker and market-session status
- keyboard-driven intelligence command center
- private Google-authenticated dashboard
- $100 → $1,000 paper-trading experiment
- deterministic position/risk controls
- automated paper entries and exits
- pause, run-cycle, close-all, and kill-switch controls
- auditable decision journal

## $100 paper challenge

At approximately $100 equity, the default guardrails are:

- Starting challenge: $100
- Target scoreboard: $1,000
- Maximum new position: 25% of equity ($25 at $100)
- Maximum open positions: 2
- Daily loss stop: 3% / minimum $3
- Protective position exit: -3%
- Profit exit: +6%
- Minimum AI confidence: 90%
- Minimum catalyst impact: 8/10
- Fresh-news threshold: 5 minutes
- Maximum quote spread: 0.5%
- Long-only
- No margin logic
- No options
- No shorts
- Leveraged/inverse/high-volatility ETFs blocked
- Averaging into an existing position blocked
- Kill switch overrides new entries

Position sizing scales with account equity while remaining capped at $250 per new order.

## Authentication

The dashboard supports Google sign-in with a secure HttpOnly session cookie. Configure:

```text
APP_URL=
AUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ALLOWED_GOOGLE_EMAILS=
```

An optional `DASHBOARD_TOKEN` remains available for operator access. Authenticated dashboard requests use the `x-ce-token` header when token access is used.

## Autonomous paper engine

`POST /api/engine` runs one engine cycle. A Hostinger cron job can invoke it so the browser does not need to remain open.

Example:

```bash
curl -fsS -X POST "https://YOUR-SITE/api/engine?action=run" \
  -H "x-engine-secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Supported operator actions:

```json
{ "action": "run" }
{ "action": "pause" }
{ "action": "resume" }
{ "action": "close-all" }
```

## Environment

Copy `.env.example` locally or configure the same variables in Hostinger:

```text
APP_URL=https://yellowgreen-coyote-640624.hostingersite.com

DASHBOARD_TOKEN=
ENGINE_SECRET=
CRON_SECRET=

CHALLENGE_START=100
CHALLENGE_TARGET=1000
CHALLENGE_WATCHLIST=AAPL,MSFT,NVDA,AMZN,META,GOOGL,TSLA,AMD,JPM,SPY

PAPER_EXECUTION_ENABLED=false
AUTO_EXECUTION_ENABLED=false
TRADING_KILL_SWITCH=false

ALPACA_API_KEY=
ALPACA_API_SECRET=

OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
```

Never commit actual credentials.

## Safe rollout

1. Use a dedicated Alpaca paper account with a $100 starting balance.
2. Deploy with both execution flags set to `false`.
3. Add Alpaca paper and OpenAI credentials and verify intelligence/dashboard routes.
4. Set `PAPER_EXECUTION_ENABLED=true` and manually run several cycles.
5. Review the decision journal and broker paper orders.
6. Only then set `AUTO_EXECUTION_ENABLED=true` and enable the protected cron schedule.

`TRADING_KILL_SWITCH=true` blocks new autonomous entries.

## Development

Requires Node 22.x.

```bash
npm install
npm test
npm run build
npm start
```

GitHub Actions verifies tests and a production build on pushes to `main`.

## Hostinger

CausalEdge Markets is a Next.js Node application configured for direct GitHub deployment on Hostinger.

Current production target:

```text
https://yellowgreen-coyote-640624.hostingersite.com/
```

See `HOSTINGER.md` for deployment settings.

## Credential separation

`ALPACA_API_KEY` and `ALPACA_API_SECRET` are paper credentials used by the fixed paper-trading execution paths. `ALPACA_LIVE_API_KEY` and `ALPACA_LIVE_API_SECRET` are reserved server-side names and are not consumed by the current execution engine. `LIVE_TRADING_ENABLED` must remain `false` in this build.
