# SignalForge — $100 Challenge

SignalForge is a personal autonomous **paper-trading** experiment designed to test whether a news + AI + deterministic-risk strategy can grow a $100 account toward $1,000 without giving an AI model unrestricted control.

> This repository intentionally contains no live Alpaca trading endpoint. It can autonomously submit Alpaca **paper** orders only.

## Flow

```text
fresh Alpaca news
      ↓
AI catalyst classifier
      ↓
market confirmation
      ↓
deterministic risk engine
      ↓
Alpaca PAPER order
      ↓
automatic stop/profit exits
```

## Starting guardrails

At approximately $100 equity:

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

## Personal dashboard

The home page is a private command center showing:

- challenge equity and $100 → $1,000 progress
- daily P&L and cash
- current paper positions
- risk configuration
- autonomous engine status
- decision journal
- Run cycle now
- Pause / Resume
- Close all paper positions

The dashboard requires `DASHBOARD_TOKEN`, stored in the Hostinger environment rather than source control. The browser stores the token locally after you enter it.

## Autonomous engine

`POST /api/engine` runs one cycle. A Hostinger cron job can call it repeatedly so the browser does not have to stay open.

Recommended cron request:

```bash
curl -fsS -X POST "https://YOUR-SITE/api/engine?action=run&secret=YOUR_ENGINE_SECRET" -H "Content-Type: application/json" -d '{}'
```

Run every 5 minutes during market hours for the initial experiment. The endpoint also accepts dashboard actions:

```json
{ "action": "run" }
{ "action": "pause" }
{ "action": "resume" }
{ "action": "close-all" }
```

The in-process journal and duplicate cache reset when the Node process restarts. Persistent database-backed journaling should be added before treating this as production infrastructure.

## Environment

Copy `.env.example` locally or configure the same variables in Hostinger:

```text
DASHBOARD_TOKEN=<long random value>
ENGINE_SECRET=<different long random value>

CHALLENGE_START=100
CHALLENGE_TARGET=1000

PAPER_EXECUTION_ENABLED=false
AUTO_EXECUTION_ENABLED=false
TRADING_KILL_SWITCH=false

ALPACA_API_KEY=<paper key>
ALPACA_API_SECRET=<paper secret>
OPENAI_API_KEY=<server-side key>
```

Never commit real credentials.

### Safe rollout

1. Reset or create a dedicated Alpaca paper account with a $100 starting balance.
2. Deploy the app with both execution flags set to `false`.
3. Add Alpaca paper and OpenAI credentials and verify the dashboard.
4. Set `PAPER_EXECUTION_ENABLED=true` and manually run several cycles.
5. Review the journal and broker orders.
6. Only then set `AUTO_EXECUTION_ENABLED=true` and enable the 5-minute cron.

`TRADING_KILL_SWITCH=true` blocks new autonomous entries. The dashboard close-all action remains available for paper positions.

## Development

Requires Node 20+.

```bash
npm install
npm test
npm run build
npm start
```

GitHub Actions verifies tests and a production build on pushes to `main`.

## Hostinger

The project is a Next.js Node application configured for Hostinger Node.js hosting. Deploy source code without `node_modules`, install dependencies, build with `npm run build`, and start with `npm start`.

Target deployment for this project:

```text
https://yellowgreen-coyote-640624.hostingersite.com/
```
