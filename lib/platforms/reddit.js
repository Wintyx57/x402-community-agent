// Reddit — Post via OAuth2 API (free)
import { config } from '../../config.js';

function log(msg) { console.log(`[reddit] ${msg}`); }

let accessToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;

  const cfg = config.platforms.reddit;
  const auth = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');

  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'x402-community-agent/1.0',
    },
    body: `grant_type=password&username=${cfg.username}&password=${cfg.password}`,
  });

  const data = await res.json();
  if (data.access_token) {
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return accessToken;
  }
  throw new Error(`Reddit auth failed: ${JSON.stringify(data)}`);
}

export async function post({ subreddit, title, body }) {
  const cfg = config.platforms.reddit;
  if (!cfg.enabled) {
    log('Reddit not configured — generate-only mode');
    return { success: false, message: 'Not configured', content: { subreddit, title, body }, manualPost: true };
  }

  const token = await getAccessToken();

  const params = new URLSearchParams({
    kind: 'self',
    sr: subreddit,
    title: title.slice(0, 300),
    text: body.slice(0, 40000),
    api_type: 'json',
  });

  const res = await fetch('https://oauth.reddit.com/api/submit', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'x402-community-agent/1.0',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await res.json();
  const errors = data.json?.errors;

  if (!errors || errors.length === 0) {
    const url = data.json?.data?.url;
    log(`Posted to r/${subreddit}: ${url}`);
    return { success: true, message: `Posted to r/${subreddit}`, url };
  }

  log(`Reddit post failed: ${JSON.stringify(errors)}`);
  return { success: false, message: errors[0]?.[1] || 'Post failed', manualPost: true };
}
