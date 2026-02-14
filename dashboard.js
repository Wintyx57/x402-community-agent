#!/usr/bin/env node
// x402 Community Agent — Web Dashboard
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'http';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

import { config } from './config.js';
import { getSpending } from './lib/x402-client.js';
import { fetchStats, generateText, generateImage, adaptForTwitter, adaptForLinkedIn, adaptForDiscord, adaptForTelegram, adaptForFarcaster, adaptForHN, adaptForReddit, adaptForDevTo } from './lib/content-gen.js';
import { sendPreview, sendImage, postToChannel, sendReport } from './lib/platforms/telegram.js';
import * as discord from './lib/platforms/discord.js';
import * as twitter from './lib/platforms/twitter.js';
import * as reddit from './lib/platforms/reddit.js';
import * as devto from './lib/platforms/devto.js';
import * as linkedin from './lib/platforms/linkedin.js';
import * as farcaster from './lib/platforms/farcaster.js';

const PORT = process.env.DASHBOARD_PORT || 3500;
const DATA_DIR = join(__dirname, 'data');
const SETTINGS_FILE = join(DATA_DIR, 'settings.json');
const HISTORY_FILE = join(DATA_DIR, 'history.json');

const logs = [];
let history = [];

// Default settings structure
const DEFAULT_SETTINGS = {
  wallet: {
    privateKey: '',
    maxBudget: 0.50
  },
  platforms: {
    telegram: { enabled: false, botToken: '', adminChatId: '', channelId: '' },
    discord: { enabled: false, webhookUrl: '' },
    twitter: { enabled: false, apiKey: '', apiSecret: '', accessToken: '', accessSecret: '' },
    reddit: { enabled: false, clientId: '', clientSecret: '', username: '', password: '', subreddits: ['artificial', 'webdev', 'SideProject'] },
    devto: { enabled: false, apiKey: '' },
    linkedin: { enabled: false, accessToken: '' },
    farcaster: { enabled: false, mnemonic: '' },
    hn: { enabled: false }
  },
  content: {
    generateImages: true,
    defaultLanguage: 'fr',
    projectName: 'x402 Bazaar',
    projectUrl: 'https://x402bazaar.org'
  },
  schedule: {
    monday: ['weekly-recap'],
    tuesday: ['daily-stats'],
    wednesday: ['daily-stats'],
    thursday: ['daily-stats'],
    friday: ['daily-stats'],
    saturday: ['daily-stats'],
    sunday: []
  }
};

// ─── Initialization ──────────────────────────────────────────────
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(join(DATA_DIR, '.gitkeep'), '');
    addLog('info', 'Created data directory');
  }
}

function loadSettings() {
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
      // Merge with env vars (env takes priority)
      if (process.env.AGENT_PRIVATE_KEY) {
        saved.wallet.privateKey = process.env.AGENT_PRIVATE_KEY;
      }
      if (process.env.MAX_BUDGET_USDC) {
        saved.wallet.maxBudget = parseFloat(process.env.MAX_BUDGET_USDC);
      }
      // Merge platform configs from env
      if (process.env.TELEGRAM_BOT_TOKEN) {
        saved.platforms.telegram.botToken = process.env.TELEGRAM_BOT_TOKEN;
        saved.platforms.telegram.adminChatId = process.env.TELEGRAM_CHAT_ID || saved.platforms.telegram.adminChatId;
        saved.platforms.telegram.channelId = process.env.TELEGRAM_CHANNEL_ID || saved.platforms.telegram.channelId;
      }
      if (process.env.DISCORD_WEBHOOK_URL) {
        saved.platforms.discord.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      }
      if (process.env.TWITTER_API_KEY) {
        saved.platforms.twitter.apiKey = process.env.TWITTER_API_KEY;
        saved.platforms.twitter.apiSecret = process.env.TWITTER_API_SECRET || saved.platforms.twitter.apiSecret;
        saved.platforms.twitter.accessToken = process.env.TWITTER_ACCESS_TOKEN || saved.platforms.twitter.accessToken;
        saved.platforms.twitter.accessSecret = process.env.TWITTER_ACCESS_SECRET || saved.platforms.twitter.accessSecret;
      }
      if (process.env.REDDIT_CLIENT_ID) {
        saved.platforms.reddit.clientId = process.env.REDDIT_CLIENT_ID;
        saved.platforms.reddit.clientSecret = process.env.REDDIT_CLIENT_SECRET || saved.platforms.reddit.clientSecret;
        saved.platforms.reddit.username = process.env.REDDIT_USERNAME || saved.platforms.reddit.username;
        saved.platforms.reddit.password = process.env.REDDIT_PASSWORD || saved.platforms.reddit.password;
      }
      if (process.env.DEVTO_API_KEY) {
        saved.platforms.devto.apiKey = process.env.DEVTO_API_KEY;
      }
      if (process.env.LINKEDIN_ACCESS_TOKEN) {
        saved.platforms.linkedin.accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
      }
      if (process.env.FARCASTER_MNEMONIC) {
        saved.platforms.farcaster.mnemonic = process.env.FARCASTER_MNEMONIC;
      }
      if (process.env.DEFAULT_LANGUAGE) {
        saved.content.defaultLanguage = process.env.DEFAULT_LANGUAGE;
      }
      if (process.env.GENERATE_IMAGES !== undefined) {
        saved.content.generateImages = process.env.GENERATE_IMAGES !== 'false';
      }

      applySettingsToConfig(saved);
      addLog('info', 'Settings loaded from file');
      return saved;
    } catch (e) {
      addLog('error', `Failed to load settings: ${e.message}`);
    }
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    applySettingsToConfig(settings);
    addLog('info', 'Settings saved');
    return true;
  } catch (e) {
    addLog('error', `Failed to save settings: ${e.message}`);
    return false;
  }
}

function applySettingsToConfig(settings) {
  // Update runtime config
  config.maxBudget = settings.wallet.maxBudget;
  config.defaultLanguage = settings.content.defaultLanguage;
  config.generateImages = settings.content.generateImages;
  config.projectName = settings.content.projectName;
  config.projectUrl = settings.content.projectUrl;

  // Update platform configs
  Object.keys(settings.platforms).forEach(platform => {
    if (config.platforms[platform]) {
      Object.assign(config.platforms[platform], settings.platforms[platform]);
    }
  });

  // Update schedule
  config.schedule = settings.schedule;
}

function loadHistory() {
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
      addLog('info', `Loaded ${history.length} history entries`);
    } catch (e) {
      addLog('error', `Failed to load history: ${e.message}`);
    }
  }
}

function saveHistory() {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
  } catch (e) {
    addLog('error', `Failed to save history: ${e.message}`);
  }
}

function addLog(level, msg) {
  const entry = { time: new Date().toISOString(), level, msg };
  logs.push(entry);
  if (logs.length > 200) logs.shift();
  console.log(`[${level}] ${msg}`);
}

// ─── Settings Merge (preserve redacted values) ──────────────────
function isRedacted(val) {
  if (typeof val !== 'string') return false;
  return val === '___KEEP___' || val.startsWith('***') || val === '*** (redacted)';
}

function mergeSettings(existing, incoming) {
  const merged = JSON.parse(JSON.stringify(incoming));
  // Wallet
  if (isRedacted(merged.wallet?.privateKey)) {
    merged.wallet.privateKey = existing.wallet?.privateKey || '';
  }
  // Platforms — preserve sensitive fields if redacted
  if (merged.platforms && existing.platforms) {
    for (const [name, platCfg] of Object.entries(merged.platforms)) {
      const ex = existing.platforms[name];
      if (!ex) continue;
      for (const [key, val] of Object.entries(platCfg)) {
        if (isRedacted(val)) {
          merged.platforms[name][key] = ex[key] || '';
        }
      }
    }
  }
  return merged;
}

// ─── Platform Connection Tests ───────────────────────────────────
async function testTelegram(cfg) {
  if (!cfg.botToken) return { success: false, message: 'Bot token not configured' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${cfg.botToken}/getMe`);
    const data = await res.json();
    if (data.ok) {
      return { success: true, message: `Connected as @${data.result.username}` };
    }
    return { success: false, message: data.description || 'Invalid token' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

async function testDiscord(cfg) {
  if (!cfg.webhookUrl) return { success: false, message: 'Webhook URL not configured' };
  try {
    const res = await fetch(cfg.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: 'x402 Community Agent - Test',
          description: 'Connection test successful',
          color: 0x00ff00
        }]
      })
    });
    if (res.ok || res.status === 204) {
      return { success: true, message: 'Test message sent' };
    }
    return { success: false, message: `HTTP ${res.status}` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

async function testTwitter(cfg) {
  if (!cfg.apiKey || !cfg.apiSecret) {
    return { success: false, message: 'API keys not configured' };
  }
  // Twitter requires OAuth signature to test — we can only validate keys are set
  if (cfg.accessToken && cfg.accessSecret) {
    return { success: true, message: 'API keys configured (posting requires live test)' };
  }
  return { success: false, message: 'Access tokens not configured' };
}

async function testReddit(cfg) {
  if (!cfg.clientId || !cfg.clientSecret || !cfg.username || !cfg.password) {
    return { success: false, message: 'Credentials not configured' };
  }
  try {
    const auth = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'x402-community-agent/1.0'
      },
      body: `grant_type=password&username=${cfg.username}&password=${cfg.password}`
    });
    const data = await res.json();
    if (data.access_token) {
      return { success: true, message: 'Authentication successful' };
    }
    return { success: false, message: data.error || 'Authentication failed' };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

async function testDevTo(cfg) {
  if (!cfg.apiKey) return { success: false, message: 'API key not configured' };
  try {
    const res = await fetch('https://dev.to/api/users/me', {
      headers: { 'api-key': cfg.apiKey }
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, message: `Connected as @${data.username}` };
    }
    return { success: false, message: `HTTP ${res.status}` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

async function testLinkedIn(cfg) {
  if (!cfg.accessToken) return { success: false, message: 'Access token not configured' };
  try {
    const res = await fetch('https://api.linkedin.com/v2/me', {
      headers: { 'Authorization': `Bearer ${cfg.accessToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, message: `Connected as ${data.localizedFirstName} ${data.localizedLastName}` };
    }
    return { success: false, message: `HTTP ${res.status}` };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

async function testFarcaster(cfg) {
  if (!cfg.mnemonic) return { success: false, message: 'Mnemonic not configured' };
  // Basic validation: mnemonic should be 12 or 24 words
  const words = cfg.mnemonic.trim().split(/\s+/);
  if (words.length === 12 || words.length === 24) {
    return { success: true, message: `Mnemonic configured (${words.length} words)` };
  }
  return { success: false, message: 'Invalid mnemonic format' };
}

// ─── API Routes ───────────────────────────────────────────────────
async function handleApi(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // GET /api/status — platform status + budget
  if (path === '/api/status' && req.method === 'GET') {
    const platforms = {};
    for (const [name, cfg] of Object.entries(config.platforms)) {
      platforms[name] = { enabled: cfg.enabled };
    }
    const spending = getSpending();
    return json(res, {
      platforms,
      budget: { max: config.maxBudget, spent: spending.spent, remaining: spending.remaining },
      walletConfigured: !!process.env.AGENT_PRIVATE_KEY,
      logsCount: logs.length,
      historyCount: history.length,
    });
  }

  // GET /api/stats — live x402 stats
  if (path === '/api/stats' && req.method === 'GET') {
    try {
      const stats = await fetchStats();
      return json(res, stats);
    } catch (e) { return json(res, { error: e.message }, 500); }
  }

  // GET /api/settings — read settings
  if (path === '/api/settings' && req.method === 'GET') {
    const settings = fs.existsSync(SETTINGS_FILE)
      ? JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'))
      : DEFAULT_SETTINGS;
    // Redact sensitive values for security
    const safe = JSON.parse(JSON.stringify(settings));
    if (safe.wallet.privateKey) {
      safe.wallet.privateKey = '***' + safe.wallet.privateKey.slice(-8);
    }
    Object.keys(safe.platforms).forEach(platform => {
      const p = safe.platforms[platform];
      if (p.botToken) p.botToken = '***' + p.botToken.slice(-8);
      if (p.apiKey) p.apiKey = '***' + p.apiKey.slice(-8);
      if (p.apiSecret) p.apiSecret = '***' + p.apiSecret.slice(-8);
      if (p.accessToken) p.accessToken = '***' + p.accessToken.slice(-8);
      if (p.accessSecret) p.accessSecret = '***' + p.accessSecret.slice(-8);
      if (p.clientId) p.clientId = '***' + p.clientId.slice(-8);
      if (p.clientSecret) p.clientSecret = '***' + p.clientSecret.slice(-8);
      if (p.password) p.password = '***';
      if (p.mnemonic) p.mnemonic = '*** (redacted)';
      if (p.webhookUrl) p.webhookUrl = p.webhookUrl.slice(0, 30) + '***';
    });
    return json(res, safe);
  }

  // POST /api/settings — save settings
  if (path === '/api/settings' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body || typeof body !== 'object') {
      return json(res, { error: 'Invalid settings object' }, 400);
    }
    // Merge with existing settings — preserve redacted values
    const existing = fs.existsSync(SETTINGS_FILE)
      ? JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'))
      : DEFAULT_SETTINGS;
    const merged = mergeSettings(existing, body);
    const success = saveSettings(merged);
    if (success) {
      addLog('info', 'Settings updated via API');
      return json(res, { success: true });
    }
    return json(res, { error: 'Failed to save settings' }, 500);
  }

  // GET /api/settings/test/:platform — test platform connection
  if (path.startsWith('/api/settings/test/') && req.method === 'GET') {
    const platform = path.split('/').pop();
    const settings = fs.existsSync(SETTINGS_FILE)
      ? JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'))
      : DEFAULT_SETTINGS;
    const cfg = settings.platforms[platform];

    if (!cfg) {
      return json(res, { success: false, message: 'Unknown platform' }, 400);
    }

    addLog('info', `Testing ${platform} connection...`);
    let result;

    switch (platform) {
      case 'telegram':
        result = await testTelegram(cfg);
        break;
      case 'discord':
        result = await testDiscord(cfg);
        break;
      case 'twitter':
        result = await testTwitter(cfg);
        break;
      case 'reddit':
        result = await testReddit(cfg);
        break;
      case 'devto':
        result = await testDevTo(cfg);
        break;
      case 'linkedin':
        result = await testLinkedIn(cfg);
        break;
      case 'farcaster':
        result = await testFarcaster(cfg);
        break;
      default:
        result = { success: false, message: 'Platform does not support testing' };
    }

    addLog('info', `${platform} test: ${result.success ? 'OK' : result.message}`);
    return json(res, result);
  }

  // POST /api/preview — generate content preview
  if (path === '/api/preview' && req.method === 'POST') {
    const body = await readBody(req);
    const strategy = body.strategy || 'daily-stats';
    addLog('info', `Generating preview for strategy: ${strategy}`);
    try {
      const mod = await import(`./strategies/${strategy}.js`);
      const result = await mod.execute(body.options || {});
      addLog('info', `Preview generated: ${Object.keys(result.contents).join(', ')}`);
      return json(res, result);
    } catch (e) {
      addLog('error', `Preview failed: ${e.message}`);
      return json(res, { error: e.message }, 500);
    }
  }

  // POST /api/publish — publish to selected platforms
  if (path === '/api/publish' && req.method === 'POST') {
    const body = await readBody(req);
    const { contents, imageUrl, platforms: targetPlatforms } = body;
    if (!contents) return json(res, { error: 'No contents provided' }, 400);

    addLog('info', `Publishing to: ${(targetPlatforms || Object.keys(contents)).join(', ')}`);
    const results = {};
    const targets = targetPlatforms || Object.keys(contents);

    for (const platform of targets) {
      const content = contents[platform];
      if (!content) continue;
      try {
        switch (platform) {
          case 'discord':
            results.discord = await discord.post(content);
            break;
          case 'telegram':
            results.telegram = await postToChannel(content.text || content, content.imageUrl || imageUrl)
              .then(r => ({ success: !!r?.ok, message: r?.ok ? 'Posted' : 'Failed' }));
            break;
          case 'twitter':
            results.twitter = await twitter.post(typeof content === 'string' ? content : content.text || JSON.stringify(content), imageUrl);
            break;
          case 'reddit':
            results.reddit = await reddit.post(content);
            break;
          case 'linkedin':
            results.linkedin = await linkedin.post(typeof content === 'string' ? content : content.text || JSON.stringify(content));
            break;
          case 'devto':
            results.devto = await devto.post(content);
            break;
          case 'farcaster':
            results.farcaster = await farcaster.post(typeof content === 'string' ? content : content.text || JSON.stringify(content));
            break;
          default:
            results[platform] = { success: false, message: 'Unknown platform' };
        }
        addLog('info', `${platform}: ${results[platform]?.success ? 'OK' : results[platform]?.message || 'Failed'}`);
      } catch (e) {
        results[platform] = { success: false, message: e.message };
        addLog('error', `${platform}: ${e.message}`);
      }
    }

    history.push({ time: new Date().toISOString(), strategy: body.strategy, results });
    if (history.length > 100) history.shift(); // Keep last 100
    saveHistory();
    await sendReport(results).catch(() => {});
    return json(res, { results });
  }

  // POST /api/telegram-preview — send preview to admin Telegram
  if (path === '/api/telegram-preview' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      await sendPreview(body.contents || {});
      if (body.imageUrl) await sendImage(body.imageUrl, 'Community Agent preview');
      addLog('info', 'Preview sent to Telegram admin');
      return json(res, { success: true });
    } catch (e) { return json(res, { error: e.message }, 500); }
  }

  // GET /api/logs
  if (path === '/api/logs' && req.method === 'GET') {
    return json(res, logs.slice(-50));
  }

  // GET /api/history
  if (path === '/api/history' && req.method === 'GET') {
    return json(res, history.slice(-20));
  }

  return json(res, { error: 'Not found' }, 404);
}

// ─── Static file server ──────────────────────────────────────────
function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  filePath = join(__dirname, 'public', filePath);

  const ext = filePath.split('.').pop();
  const mimeTypes = { html: 'text/html', css: 'text/css', js: 'application/javascript', json: 'application/json', png: 'image/png', svg: 'image/svg+xml' };

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    res.end(content);
  } catch {
    // Fallback to index.html for SPA
    try {
      const content = fs.readFileSync(join(__dirname, 'public', 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────
function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

// ─── Server ──────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }

  if (req.url.startsWith('/api/')) {
    return handleApi(req, res);
  }
  serveStatic(req, res);
});

// Initialize on startup
ensureDataDir();
loadSettings();
loadHistory();

server.listen(PORT, () => {
  console.log(`\n  x402 Community Agent Dashboard`);
  console.log(`  http://localhost:${PORT}\n`);
  addLog('info', 'Dashboard started');
});
