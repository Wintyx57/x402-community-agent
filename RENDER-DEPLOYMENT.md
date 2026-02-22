# x402 Community Agent — Render Deployment

## Quick Start

1. **Connect repo to Render**
   - Go to https://dashboard.render.com
   - New → Web Service
   - Connect GitHub repo `x402-community-agent`
   - Branch: `master`

2. **Configure Service**
   - Name: `x402-community-agent`
   - Build Command: `npm install --production`
   - Start Command: `node dashboard.js`
   - Plan: **Starter** (free tier)

3. **Set Environment Variables**
   On Render dashboard, set all vars from `.env.example`:
   - `AGENT_PRIVATE_KEY` (wallet for x402 API payments)
   - `DISCORD_WEBHOOK_URL` (for auto-publishing)
   - `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET`
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_CHANNEL_ID`
   - `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USERNAME`, `REDDIT_PASSWORD` (optional)
   - `DEVTO_API_KEY`, `LINKEDIN_ACCESS_TOKEN`, `FARCASTER_MNEMONIC` (optional)

4. **Link to Backend**
   After deploy, copy the URL (e.g., `https://x402-community-agent.onrender.com`).

   On backend Render service env vars, add:
   ```
   COMMUNITY_AGENT_URL=https://x402-community-agent.onrender.com
   ```

5. **Verify**
   - Dashboard accessible: `https://x402-community-agent.onrender.com`
   - Health check: `https://x402-api.onrender.com/admin/community-agent/health` (requires admin token)
   - Frontend admin page: `https://x402bazaar.org/admin/community-agent`

## Caveats

- **Free tier sleep**: Render puts free services to sleep after 15min inactivity. Use paid plan if 24/7 needed.
- **Cold start**: First request after sleep may take 30s.
- **Logs**: Monitor at https://dashboard.render.com — check "Logs" tab if agent doesn't start.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 502 Bad Gateway | Backend can't reach agent. Check `COMMUNITY_AGENT_URL` in backend env vars. |
| 403 on `/admin/*` | Missing `ADMIN_TOKEN` header. Frontend handles this, CLI needs `Authorization: Bearer <token>`. |
| Agent not publishing | Missing platform credentials. Check agent logs on Render dashboard. |
| Service crashes | Check `AGENT_PRIVATE_KEY` is valid. Agent needs wallet to function. |

## Manual Dashboard Access

If using local dev:
```bash
cd x402-community-agent
node dashboard.js
# → http://localhost:3500
```

## Architecture

```
Backend (Render dyno A)
├─ Express server
├─ Proxy: /admin/community-agent/* → http://COMMUNITY_AGENT_URL/api/*
└─ Admin auth required

Community Agent (Render dyno B) [OPTIONAL]
├─ Dashboard HTML on port 3500
├─ REST API: /api/status, /api/publish, /api/settings, etc.
└─ Handles: Telegram, Discord, Twitter, Reddit, Dev.to, LinkedIn, Farcaster

Frontend (Vercel)
└─ AdminCommunityAgent.tsx page
   └─ Proxies through backend `/admin/community-agent/*`
```

If `COMMUNITY_AGENT_URL` undefined:
- Backend spawns agent as companion process (same dyno, port 3500)
- Works for small deployments, but not recommended for production
