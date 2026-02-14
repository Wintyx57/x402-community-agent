// Twitter/X — Generate-only (manual post) OR auto-post if API keys configured
import { config } from '../../config.js';
import crypto from 'crypto';

function log(msg) { console.log(`[twitter] ${msg}`); }

// Twitter OAuth 1.0a signing
function oauthSign(method, url, params, consumerSecret, tokenSecret) {
  const sortedParams = Object.keys(params).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&');
  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
}

function buildAuthHeader(method, url, body, cfg) {
  const oauthParams = {
    oauth_consumer_key: cfg.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: cfg.accessToken,
    oauth_version: '1.0',
  };

  const allParams = { ...oauthParams, ...body };
  oauthParams.oauth_signature = oauthSign(method, url, allParams, cfg.apiSecret, cfg.accessSecret);

  const header = Object.keys(oauthParams).sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ');
  return `OAuth ${header}`;
}

export async function post(text, imageUrl) {
  const cfg = config.platforms.twitter;

  if (!cfg.enabled) {
    log('Twitter API not configured — generate-only mode');
    return {
      success: false,
      message: 'Generate-only (no API key)',
      content: text,
      imageUrl,
      manualPost: true,
    };
  }

  // Auto-post via Twitter API v2
  const url = 'https://api.twitter.com/2/tweets';
  const body = { text: text.slice(0, 280) };
  const auth = buildAuthHeader('POST', url, {}, cfg);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': auth,
    },
    body: JSON.stringify(body),
  });

  if (res.ok) {
    const data = await res.json();
    log(`Posted tweet: ${data.data?.id}`);
    return { success: true, message: `Tweet posted: ${data.data?.id}`, tweetId: data.data?.id };
  }

  const err = await res.text();
  log(`Twitter post failed: ${res.status} ${err}`);
  return { success: false, message: `HTTP ${res.status}`, content: text, manualPost: true };
}
