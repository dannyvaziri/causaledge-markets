# CausalEdge Markets — Hostinger GitHub Deployment

CausalEdge Markets is configured for direct deployment from GitHub using Hostinger's managed Node.js / Next.js hosting.

## Repository

- Current repository: `dannyvaziri/signalforge-ai`
- Intended repository name after GitHub admin rename: `dannyvaziri/causaledge-markets`
- Branch: `main`
- Framework: Next.js
- Node.js: `22.x`
- Root directory: repository root (`.`)
- Package manager: npm
- Install command: `npm install`
- Build command: `npm run build`
- Start command: `npm start`
- Build output: `.next`

Hostinger should auto-detect these settings from `package.json`. If it asks for them manually, use the values above.

## Target site

`https://yellowgreen-coyote-640624.hostingersite.com`

Set this value in Hostinger as:

```text
APP_URL=https://yellowgreen-coyote-640624.hostingersite.com
```

## Required server environment variables

Add these in Hostinger hPanel under the Node.js app's environment variables. Never commit real secret values to GitHub.

```text
APP_URL=https://yellowgreen-coyote-640624.hostingersite.com
AUTH_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ALLOWED_GOOGLE_EMAILS=

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

ALPACA_LIVE_API_KEY=
ALPACA_LIVE_API_SECRET=
LIVE_TRADING_ENABLED=false

# Supabase execution audit database (server-side only)
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_API_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

The current application intentionally keeps live-money execution disabled. The live credential variables are reserved and are not consumed by the paper execution routes.

## Google OAuth

Configure the Google Web OAuth client with:

Authorized origin:

```text
https://yellowgreen-coyote-640624.hostingersite.com
```

Authorized redirect URI:

```text
https://yellowgreen-coyote-640624.hostingersite.com/api/auth/google/callback
```

## Deploy in Hostinger

1. Open hPanel → Websites → Add Website / Deploy Web App.
2. Choose GitHub integration.
3. Select the CausalEdge Markets repository (`dannyvaziri/causaledge-markets` after the repository itself is renamed; until then use `dannyvaziri/signalforge-ai`).
4. Select branch `main`.
5. Confirm Next.js and Node `22.x` are detected.
6. Confirm build command `npm run build` and start command `npm start`.
7. Add the environment variables above.
8. Deploy.

For later releases, redeploy the GitHub-connected app and Hostinger will pull the latest code from `main`. If automatic deployment on push is enabled in hPanel, updates to `main` will build automatically.

## Health checks after deploy

Check the site root and these application routes:

```text
/
/api/health
/api/auth/session
```

Authenticated intelligence and engine routes will return an authorization response unless a valid Google session or dashboard token is present.

## Autonomous paper-engine schedule

The paper engine accepts a protected POST request at `/api/engine`. If you configure a Hostinger cron command, call it with the server-side engine secret, for example:

```bash
curl -fsS -X POST \
  -H "Content-Type: application/json" \
  -H "x-engine-secret: $CRON_SECRET" \
  -d '{"action":"run"}' \
  https://yellowgreen-coyote-640624.hostingersite.com/api/engine
```

Do not put the secret directly into GitHub source files.
