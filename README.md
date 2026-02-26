# x402 Community Agent

AI-powered community manager that generates and publishes content to 8 social networks, using x402 Bazaar APIs with automatic USDC micropayments on Base.

## Features

- **Multi-platform publishing** -- Telegram, Discord, Twitter/X, Reddit, Dev.to, LinkedIn, Farcaster, Hacker News
- **AI content generation** -- Uses x402 APIs (summarize, translate, image generation via DALL-E 3) with automatic pay-per-call USDC payments
- **Strategy system** -- Pluggable content strategies (daily stats, weekly recap, new API announcements)
- **Scheduler** -- Configurable per-day scheduling with automatic or manual approval workflows
- **Queue management** -- Approval queue with retry logic (exponential backoff, configurable max retries)
- **Web dashboard** -- Built-in HTTP dashboard on port 3500 with real-time SSE log streaming
- **Platform-adaptive content** -- Each platform gets content formatted to its constraints (280 chars for Twitter, embeds for Discord, Markdown for Telegram, etc.)
- **Budget control** -- Per-session USDC spending cap to prevent runaway costs
- **Webhook integration** -- Automatically generates announcements when new APIs are registered on x402 Bazaar
- **Graceful shutdown** -- Saves queue and history on SIGTERM/SIGINT

## Architecture

```
x402-community-agent/
  agent.js              CLI entry point (one-shot execution)
  dashboard.js          HTTP server (port 3500) — dashboard + REST API
  config.js             Runtime configuration (env vars + defaults)
  render.yaml           Render deployment descriptor
  strategies/
    daily-stats.js      Daily platform statistics post
    weekly-recap.js     Weekly summary post
    new-api.js          New API announcement post
  lib/
    x402-client.js      x402 API client with automatic USDC payment flow
    content-gen.js      Content generation pipeline + per-platform adapters
    platforms/
      telegram.js       Telegram Bot API (preview, approval, channel posting)
      discord.js        Discord webhook posting
      twitter.js        Twitter/X API v2 (OAuth 1.0a)
      reddit.js         Reddit API (OAuth2 password grant)
      devto.js          Dev.to API (article drafts)
      linkedin.js       LinkedIn API (share posts)
      farcaster.js      Farcaster Hub protocol (casts)
  data/
    agent-config.json   Persisted settings (created at runtime)
    publication-history.json   Publication history log
    publication-queue.json     Current publication queue
  public/
    index.html          Static dashboard UI
```

### How it works

1. A **strategy** fetches live stats from x402 Bazaar, generates text (via `/api/summarize`), optionally generates an image (via `/api/image`), and adapts the content for each platform.
2. The **scheduler** checks every minute if a strategy should run based on the weekly schedule. Content is either auto-published or queued for manual approval.
3. The **x402 client** handles the HTTP 402 payment flow transparently: when an API returns 402, the client sends a USDC payment on Base and retries with the transaction hash as proof.
4. The **queue** tracks each publication with status (`awaiting_approval`, `pending`, `publishing`, `published`, `partial`, `failed`, `retry`) and supports automatic retries with configurable backoff.

## Installation

```bash
git clone https://github.com/Wintyx57/x402-community-agent.git
cd x402-community-agent
npm install
```

Requires Node.js >= 20.0.0.

## Usage

### Web dashboard (recommended)

```bash
npm start
# Dashboard available at http://localhost:3500
```

### CLI (one-shot)

```bash
# Preview content without publishing
node agent.js --preview

# Run a specific strategy
node agent.js --strategy daily-stats
node agent.js --strategy weekly-recap
node agent.js --strategy new-api

# Auto-approve (skip Telegram approval)
node agent.js --strategy daily-stats --auto

# Skip approval entirely
node agent.js --strategy daily-stats --skip-approval
```

### npm scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm start` | `node dashboard.js` | Start the web dashboard |
| `npm run cli` | `node agent.js` | Run CLI (default: daily-stats) |
| `npm run daily` | `node agent.js --strategy daily-stats` | Run daily stats strategy |
| `npm run weekly` | `node agent.js --strategy weekly-recap` | Run weekly recap strategy |
| `npm run announce` | `node agent.js --strategy new-api` | Run new API announcement |
| `npm run preview` | `node agent.js --preview` | Preview without publishing |
| `npm test` | `node --test tests/` | Run tests |

## Environment Variables

### Core

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AGENT_PRIVATE_KEY` | Yes (for paid APIs) | -- | Private key for the Base wallet (USDC payments) |
| `MAX_BUDGET_USDC` | No | `0.50` | Maximum USDC spend per session |
| `X402_SERVER_URL` | No | `https://x402-api.onrender.com` | x402 Bazaar API base URL |
| `DASHBOARD_PORT` | No | `3500` | HTTP server port |
| `DEFAULT_LANGUAGE` | No | `en` | Content language (`en`, `fr`) |
| `GENERATE_IMAGES` | No | `true` | Enable DALL-E 3 image generation |

### Telegram

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Yes | Admin chat ID (for previews/approvals) |
| `TELEGRAM_CHANNEL_ID` | No | Channel ID for publishing |

### Discord

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_WEBHOOK_URL` | Yes | Discord webhook URL |

### Twitter/X

| Variable | Required | Description |
|----------|----------|-------------|
| `TWITTER_API_KEY` | Yes | API key (OAuth 1.0a) |
| `TWITTER_API_SECRET` | Yes | API secret |
| `TWITTER_ACCESS_TOKEN` | Yes | Access token |
| `TWITTER_ACCESS_SECRET` | Yes | Access token secret |

### Reddit

| Variable | Required | Description |
|----------|----------|-------------|
| `REDDIT_CLIENT_ID` | Yes | OAuth2 app client ID |
| `REDDIT_CLIENT_SECRET` | Yes | OAuth2 app client secret |
| `REDDIT_USERNAME` | Yes | Reddit account username |
| `REDDIT_PASSWORD` | Yes | Reddit account password |

### Dev.to

| Variable | Required | Description |
|----------|----------|-------------|
| `DEVTO_API_KEY` | Yes | Dev.to API key |

### LinkedIn

| Variable | Required | Description |
|----------|----------|-------------|
| `LINKEDIN_ACCESS_TOKEN` | Yes | OAuth2 access token |

### Farcaster

| Variable | Required | Description |
|----------|----------|-------------|
| `FARCASTER_SIGNER_KEY` | Yes | Farcaster signer key |
| `FARCASTER_FID` | No | Farcaster FID (default: `2788746`) |
| `NEYNAR_API_KEY` | No | Neynar API key |

All platform variables are optional. The agent runs in generate-only mode if no platform credentials are configured. Platforms are auto-enabled when their credentials are set.

## API Endpoints

The dashboard exposes the following REST API on the configured port (default 3500).

### Status and Stats

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/status` | Platform status, budget, scheduler state, queue length |
| `GET` | `/api/stats` | Live x402 Bazaar platform statistics |
| `GET` | `/api/health` | Machine-readable health check (uptime, scheduler, queue, platforms) |
| `GET` | `/api/logs` | Last 50 log entries |
| `GET` | `/api/history` | Last 20 publication history entries |

### Settings

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/settings` | Read settings (credentials are redacted) |
| `POST` | `/api/settings` | Save settings (redacted values are preserved) |
| `GET` | `/api/settings/test/:platform` | Test platform connection (telegram, discord, twitter, reddit, devto, linkedin, farcaster) |

### Content

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/preview` | Generate content preview for a strategy |
| `POST` | `/api/publish` | Publish content to selected platforms |
| `POST` | `/api/telegram-preview` | Send preview to Telegram admin chat |

### Scheduler

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/scheduler` | Scheduler status and next scheduled post |
| `POST` | `/api/scheduler/start` | Start the scheduler |
| `POST` | `/api/scheduler/stop` | Stop the scheduler |
| `POST` | `/api/scheduler/run-now` | Execute a strategy immediately |

### Queue

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/queue` | List queue items (last 50, newest first) |
| `POST` | `/api/queue/:id/approve` | Approve a queued item for publication |
| `POST` | `/api/queue/:id/retry` | Force retry a failed item |
| `DELETE` | `/api/queue/:id` | Remove an item from the queue |

### Webhooks

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/webhook/new-api` | Trigger new API announcement (called by x402-backend) |

### Streaming

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/stream/logs` | SSE real-time log stream (initial snapshot + live events) |

## Integration with x402-backend

The community agent is designed to run as a companion process alongside the x402 backend on the same Render instance.

### Proxy routes

The backend exposes 16 proxy routes under `/admin/community-agent/*`, all protected by `adminAuth`. These forward requests to the agent's local API:

```
Backend: /admin/community-agent/status  -->  Agent: /api/status
Backend: /admin/community-agent/queue   -->  Agent: /api/queue
...
```

The frontend never communicates with the agent directly. All traffic goes through the backend proxy.

### Webhook

When a new API is registered via `POST /register` on the backend, it calls the agent's `/api/webhook/new-api` endpoint (fire-and-forget). The agent then generates announcement content and either auto-publishes or queues for approval.

### Monitoring

The backend's monitoring engine includes the agent's `/api/health` endpoint as check #62. If the agent is down, an alert is sent to the Telegram admin.

### Environment

Set `COMMUNITY_AGENT_URL=http://localhost:3500` in the backend's environment to enable the proxy.

## Configuration

### Strategies

Three built-in strategies:

| Strategy | Description | Default Schedule |
|----------|-------------|-----------------|
| `daily-stats` | Fetches live platform stats and generates an update post | Tuesday-Saturday 09:00 |
| `weekly-recap` | Generates a weekly summary with highlights | Monday 09:00 |
| `new-api` | Announces a newly registered API | Triggered by webhook |

### Schedule

The schedule is configured per day of the week. Each day can have multiple entries with a strategy and time:

```json
{
  "schedule": {
    "monday": [{ "strategy": "weekly-recap", "time": "09:00" }],
    "tuesday": [{ "strategy": "daily-stats", "time": "09:00" }],
    "wednesday": [{ "strategy": "daily-stats", "time": "09:00" }],
    "thursday": [{ "strategy": "daily-stats", "time": "09:00" }],
    "friday": [{ "strategy": "daily-stats", "time": "09:00" }],
    "saturday": [{ "strategy": "daily-stats", "time": "09:00" }],
    "sunday": []
  }
}
```

### Auto-publish vs. Approval

Each platform can be set to `autoPublish: true` or `false` independently. When `autoPublish` is false, content is queued with status `awaiting_approval` and must be approved via the API or dashboard before publication.

### Retry Policy

Failed publications are retried automatically:

| Setting | Default | Description |
|---------|---------|-------------|
| `scheduler.retryMax` | `3` | Maximum retry attempts |
| `scheduler.retryDelays` | `[5, 30, 60]` | Delay in minutes between retries |

### Platform Content Limits

| Platform | Limit |
|----------|-------|
| Twitter/X | 280 characters |
| Farcaster | 320 characters |
| Discord | 2,000 characters |
| LinkedIn | 3,000 characters |
| Telegram | 4,096 characters |
| Reddit | 300 char title, 40,000 char body |
| Dev.to | 50,000 characters |
| Hacker News | 80 char title (generate-only, no posting API) |

## Deployment

### Render (standalone)

A `render.yaml` is included for standalone deployment:

```bash
# Deploy via Render dashboard or CLI
render deploy
```

### Render (companion process with x402-backend)

The recommended deployment runs the agent alongside the backend on a single Render instance:

```bash
# In the backend start command:
node server.js & cd ../x402-community-agent && node dashboard.js & wait
```

See `INTEGRATION-ARCHITECTURE.md` for the full deployment architecture.

## License

MIT
