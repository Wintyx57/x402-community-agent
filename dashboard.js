#!/usr/bin/env node
// x402 Community Agent — Web Dashboard
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'http';
import fs from 'fs';
import crypto from 'crypto';

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
const SETTINGS_FILE = join(DATA_DIR, 'agent-config.json');
const HISTORY_FILE = join(DATA_DIR, 'publication-history.json');
const QUEUE_FILE = join(DATA_DIR, 'publication-queue.json');

const logs = [];
let history = [];
let queue = [];
let schedulerInterval = null;
let schedulerRunning = false;
let lastSchedulerCheck = null;

// Default settings structure
const DEFAULT_SETTINGS = {
  wallet: {
    privateKey: '',
    maxBudget: 0.50
  },
  platforms: {
    telegram: { enabled: false, autoPublish: false, botToken: '', adminChatId: '', channelId: '' },
    discord: { enabled: false, autoPublish: false, webhookUrl: '' },
    twitter: { enabled: false, autoPublish: false, apiKey: '', apiSecret: '', accessToken: '', accessSecret: '' },
    reddit: { enabled: false, autoPublish: false, clientId: '', clientSecret: '', username: '', password: '', subreddits: ['artificial', 'webdev', 'SideProject'] },
    devto: { enabled: false, autoPublish: false, apiKey: '' },
    linkedin: { enabled: false, autoPublish: false, accessToken: '' },
    farcaster: { enabled: false, autoPublish: false, mnemonic: '' },
    hn: { enabled: false, autoPublish: false }
  },
  content: {
    generateImages: true,
    defaultLanguage: 'fr',
    projectName: 'x402 Bazaar',
    projectUrl: 'https://x402bazaar.org'
  },
  scheduler: {
    enabled: false,
    defaultTime: '09:00',
    retryMax: 3,
    retryDelays: [5, 30, 60]
  },
  schedule: {
    monday: [{ strategy: 'weekly-recap', time: '09:00' }],
    tuesday: [{ strategy: 'daily-stats', time: '09:00' }],
    wednesday: [{ strategy: 'daily-stats', time: '09:00' }],
    thursday: [{ strategy: 'daily-stats', time: '09:00' }],
    friday: [{ strategy: 'daily-stats', time: '09:00' }],
    saturday: [{ strategy: 'daily-stats', time: '09:00' }],
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

// S9 — Strip all secrets server-side before sending to frontend
const SENSITIVE_KEYS = new Set([
  'privateKey', 'botToken', 'apiKey', 'apiSecret',
  'accessToken', 'accessSecret', 'clientId', 'clientSecret',
  'password', 'mnemonic', 'webhookUrl',
]);

function sanitizeConfigForFrontend(settings) {
  const safe = JSON.parse(JSON.stringify(settings));
  // Remove wallet private key entirely
  if (safe.wallet) {
    safe.wallet.privateKey = undefined;
    safe.wallet.configured = !!settings.wallet.privateKey;
  }
  // Strip all sensitive platform credentials
  if (safe.platforms) {
    Object.keys(safe.platforms).forEach(platform => {
      const p = safe.platforms[platform];
      for (const key of SENSITIVE_KEYS) {
        if (key in p) {
          p[key] = undefined;
        }
      }
      // Expose only safe fields: enabled, autoPublish, subreddits, etc.
      p.configured = !!(settings.platforms[platform].botToken
        || settings.platforms[platform].apiKey
        || settings.platforms[platform].accessToken
        || settings.platforms[platform].webhookUrl
        || settings.platforms[platform].mnemonic
        || settings.platforms[platform].clientId);
    });
  }
  return safe;
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

// ─── Queue Management ───────────────────────────────────────────
function loadQueue() {
  if (fs.existsSync(QUEUE_FILE)) {
    try {
      queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
      addLog('info', `Loaded ${queue.length} queue items`);
    } catch (e) { addLog('error', `Failed to load queue: ${e.message}`); }
  }
}

function saveQueue() {
  try {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf-8');
  } catch (e) { addLog('error', `Failed to save queue: ${e.message}`); }
}

function createQueueItem(strategy, previewResult, platforms, autoPublish = false) {
  return {
    id: crypto.randomUUID(),
    strategy,
    contents: previewResult.contents,
    stats: previewResult.stats,
    imageUrl: previewResult.imageUrl || null,
    platforms,
    autoPublish,
    status: autoPublish ? 'pending' : 'awaiting_approval',
    retryCount: 0,
    nextRetry: null,
    createdAt: new Date().toISOString(),
    publishedAt: null,
    results: {},
    error: null
  };
}

// ─── Scheduler Engine ───────────────────────────────────────────
function startScheduler() {
  if (schedulerInterval) return;
  schedulerRunning = true;
  schedulerInterval = setInterval(schedulerTick, 60_000);
  addLog('info', 'Scheduler demarré — vérification chaque minute');
  schedulerTick();
}

function stopScheduler() {
  if (schedulerInterval) clearInterval(schedulerInterval);
  schedulerInterval = null;
  schedulerRunning = false;
  addLog('info', 'Scheduler arrêté');
}

function getNextScheduledPost() {
  const settings = loadCurrentSettings();
  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(now.getTime() + offset * 86400000);
    const dayKey = dayNames[d.getDay()];
    const entries = settings.schedule[dayKey] || [];

    for (const entry of entries) {
      const strategyName = typeof entry === 'string' ? entry : entry.strategy;
      const time = typeof entry === 'string' ? (settings.scheduler?.defaultTime || '09:00') : entry.time;
      const [h, m] = time.split(':').map(Number);

      const scheduled = new Date(d);
      scheduled.setHours(h, m, 0, 0);

      if (scheduled > now) {
        return { strategy: strategyName, time: scheduled.toISOString(), day: dayKey, hour: time };
      }
    }
  }
  return null;
}

function loadCurrentSettings() {
  if (fs.existsSync(SETTINGS_FILE)) {
    try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')); } catch {}
  }
  return DEFAULT_SETTINGS;
}

async function schedulerTick() {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const day = dayNames[now.getDay()];
  const todayStr = now.toISOString().slice(0, 10);
  lastSchedulerCheck = now.toISOString();

  const settings = loadCurrentSettings();
  const daySchedule = settings.schedule[day] || [];

  for (const entry of daySchedule) {
    const strategyName = typeof entry === 'string' ? entry : entry.strategy;
    const scheduledTime = typeof entry === 'string' ? (settings.scheduler?.defaultTime || '09:00') : entry.time;

    if (time === scheduledTime) {
      const alreadyDone = queue.some(q =>
        q.strategy === strategyName && q.createdAt.startsWith(todayStr)
      );
      if (alreadyDone) continue;

      addLog('info', `Scheduler: exécution ${strategyName} (${time})`);
      await executeScheduledStrategy(strategyName, settings);
    }
  }

  await processRetryQueue(settings);
}

async function executeScheduledStrategy(strategyName, settings) {
  try {
    const mod = await import(`./strategies/${strategyName}.js`);
    const result = await mod.execute({});

    const autoPlatforms = [];
    const manualPlatforms = [];

    for (const [name, cfg] of Object.entries(settings.platforms)) {
      if (!cfg.enabled) continue;
      if (cfg.autoPublish) {
        autoPlatforms.push(name);
      } else {
        manualPlatforms.push(name);
      }
    }

    if (autoPlatforms.length > 0) {
      const item = createQueueItem(strategyName, result, autoPlatforms, true);
      queue.push(item);
      saveQueue();
      addLog('info', `Auto-publish: ${autoPlatforms.join(', ')}`);
      await publishQueueItem(item);
    }

    if (manualPlatforms.length > 0) {
      const item = createQueueItem(strategyName, result, manualPlatforms, false);
      queue.push(item);
      saveQueue();
      addLog('info', `En attente d'approbation: ${manualPlatforms.join(', ')}`);
      await sendPreview(result.contents).catch(() => {});
    }

    if (autoPlatforms.length === 0 && manualPlatforms.length === 0) {
      addLog('info', 'Aucune plateforme activée — contenu généré sans publication');
    }
  } catch (e) {
    addLog('error', `Strategy ${strategyName} échouée: ${e.message}`);
  }
}

async function publishQueueItem(item) {
  item.status = 'publishing';
  saveQueue();

  for (const platform of item.platforms) {
    const content = item.contents[platform];
    if (!content) continue;
    try {
      let result;
      switch (platform) {
        case 'discord':
          result = await discord.post(content); break;
        case 'telegram':
          result = await postToChannel(content.text || content, content.imageUrl || item.imageUrl)
            .then(r => ({ success: !!r?.ok, message: r?.ok ? 'Publié' : 'Échec' })); break;
        case 'twitter':
          result = await twitter.post(typeof content === 'string' ? content : content.text || JSON.stringify(content), item.imageUrl); break;
        case 'reddit':
          result = await reddit.post(content); break;
        case 'linkedin':
          result = await linkedin.post(typeof content === 'string' ? content : content.text || JSON.stringify(content)); break;
        case 'devto':
          result = await devto.post(content); break;
        case 'farcaster':
          result = await farcaster.post(typeof content === 'string' ? content : content.text || JSON.stringify(content)); break;
        default:
          result = { success: false, message: 'Plateforme inconnue' };
      }
      item.results[platform] = result;
      addLog('info', `${platform}: ${result?.success ? 'OK' : result?.message || 'Échec'}`);
    } catch (e) {
      item.results[platform] = { success: false, message: e.message };
      addLog('error', `${platform}: ${e.message}`);
    }
  }

  const allOk = Object.values(item.results).every(r => r.success);
  const anyOk = Object.values(item.results).some(r => r.success);

  if (allOk) {
    item.status = 'published';
    item.publishedAt = new Date().toISOString();
  } else if (anyOk) {
    item.status = 'partial';
    item.publishedAt = new Date().toISOString();
  } else {
    item.status = 'failed';
    const settings = loadCurrentSettings();
    const maxRetries = settings.scheduler?.retryMax || 3;
    if (item.retryCount < maxRetries) {
      item.status = 'retry';
      const delays = settings.scheduler?.retryDelays || [5, 30, 60];
      const delayMin = delays[Math.min(item.retryCount, delays.length - 1)];
      item.nextRetry = new Date(Date.now() + delayMin * 60000).toISOString();
      item.retryCount++;
      addLog('info', `Retry planifié dans ${delayMin}min (tentative ${item.retryCount}/${maxRetries})`);
    }
  }

  history.push({ time: new Date().toISOString(), strategy: item.strategy, results: item.results, auto: item.autoPublish });
  saveHistory();
  saveQueue();
  await sendReport(item.results).catch(() => {});
}

async function processRetryQueue(settings) {
  const now = Date.now();
  const retryItems = queue.filter(q => q.status === 'retry' && q.nextRetry && new Date(q.nextRetry).getTime() <= now);

  for (const item of retryItems) {
    addLog('info', `Retry: ${item.strategy} (tentative ${item.retryCount})`);
    const failedPlatforms = Object.entries(item.results)
      .filter(([_, r]) => !r.success)
      .map(([p]) => p);
    item.platforms = failedPlatforms;
    item.results = {};
    await publishQueueItem(item);
  }
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
      scheduler: { running: schedulerRunning, lastCheck: lastSchedulerCheck },
      queueLength: queue.length,
      pendingApproval: queue.filter(q => q.status === 'awaiting_approval').length,
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
    const safe = sanitizeConfigForFrontend(settings);
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

  // ─── Scheduler Routes ─────────────────────────────────────────
  // GET /api/scheduler — status
  if (path === '/api/scheduler' && req.method === 'GET') {
    return json(res, {
      running: schedulerRunning,
      lastCheck: lastSchedulerCheck,
      nextPost: getNextScheduledPost(),
      queueLength: queue.length,
      pendingApproval: queue.filter(q => q.status === 'awaiting_approval').length,
      retryCount: queue.filter(q => q.status === 'retry').length,
    });
  }

  // POST /api/scheduler/start
  if (path === '/api/scheduler/start' && req.method === 'POST') {
    startScheduler();
    const settings = loadCurrentSettings();
    settings.scheduler = settings.scheduler || {};
    settings.scheduler.enabled = true;
    saveSettings(settings);
    return json(res, { success: true, running: true });
  }

  // POST /api/scheduler/stop
  if (path === '/api/scheduler/stop' && req.method === 'POST') {
    stopScheduler();
    const settings = loadCurrentSettings();
    settings.scheduler = settings.scheduler || {};
    settings.scheduler.enabled = false;
    saveSettings(settings);
    return json(res, { success: true, running: false });
  }

  // POST /api/scheduler/run-now — execute a strategy immediately
  if (path === '/api/scheduler/run-now' && req.method === 'POST') {
    const body = await readBody(req);
    const strategy = body.strategy || 'daily-stats';
    addLog('info', `Exécution manuelle: ${strategy}`);
    const settings = loadCurrentSettings();
    await executeScheduledStrategy(strategy, settings);
    return json(res, { success: true, queueLength: queue.length });
  }

  // ─── Queue Routes ───────────────────────────────────────────────
  // GET /api/queue
  if (path === '/api/queue' && req.method === 'GET') {
    return json(res, queue.slice(-50).reverse());
  }

  // POST /api/queue/:id/approve
  if (path.match(/^\/api\/queue\/[^/]+\/approve$/) && req.method === 'POST') {
    const id = path.split('/')[3];
    const item = queue.find(q => q.id === id);
    if (!item) return json(res, { error: 'Item not found' }, 404);
    if (item.status !== 'awaiting_approval') return json(res, { error: 'Item not awaiting approval' }, 400);
    addLog('info', `Queue approuvé: ${item.strategy} → ${item.platforms.join(', ')}`);
    await publishQueueItem(item);
    return json(res, { success: true, status: item.status });
  }

  // POST /api/queue/:id/retry
  if (path.match(/^\/api\/queue\/[^/]+\/retry$/) && req.method === 'POST') {
    const id = path.split('/')[3];
    const item = queue.find(q => q.id === id);
    if (!item) return json(res, { error: 'Item not found' }, 404);
    item.retryCount = 0;
    item.status = 'retry';
    item.nextRetry = new Date().toISOString();
    saveQueue();
    addLog('info', `Retry forcé: ${item.strategy}`);
    return json(res, { success: true });
  }

  // DELETE /api/queue/:id
  if (path.match(/^\/api\/queue\/[^/]+$/) && req.method === 'DELETE') {
    const id = path.split('/')[3];
    const idx = queue.findIndex(q => q.id === id);
    if (idx === -1) return json(res, { error: 'Item not found' }, 404);
    queue.splice(idx, 1);
    saveQueue();
    addLog('info', `Queue supprimé: ${id}`);
    return json(res, { success: true });
  }

  // ─── Webhook Routes ─────────────────────────────────────────────
  // POST /api/webhook/new-api — triggered when new API registered on x402
  if (path === '/api/webhook/new-api' && req.method === 'POST') {
    const body = await readBody(req);
    const { apiName, apiDescription, apiPrice } = body;
    if (!apiName) return json(res, { error: 'apiName required' }, 400);

    addLog('info', `Webhook: nouvelle API "${apiName}"`);
    const settings = loadCurrentSettings();
    try {
      const mod = await import('./strategies/new-api.js');
      const result = await mod.execute({ apiName, apiDescription: apiDescription || '', apiPrice: apiPrice || '0.001 USDC' });

      const autoPlatforms = [];
      const manualPlatforms = [];
      for (const [name, cfg] of Object.entries(settings.platforms)) {
        if (!cfg.enabled) continue;
        if (cfg.autoPublish) autoPlatforms.push(name);
        else manualPlatforms.push(name);
      }

      if (autoPlatforms.length > 0) {
        const item = createQueueItem('new-api', result, autoPlatforms, true);
        queue.push(item);
        saveQueue();
        await publishQueueItem(item);
      }
      if (manualPlatforms.length > 0) {
        const item = createQueueItem('new-api', result, manualPlatforms, false);
        queue.push(item);
        saveQueue();
        await sendPreview(result.contents).catch(() => {});
      }

      return json(res, { success: true, message: `Annonce "${apiName}" créée`, queueLength: queue.length });
    } catch (e) {
      addLog('error', `Webhook new-api failed: ${e.message}`);
      return json(res, { error: e.message }, 500);
    }
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
const currentSettings = loadSettings();
loadHistory();
loadQueue();

server.listen(PORT, () => {
  console.log(`\n  x402 Community Agent Dashboard`);
  console.log(`  http://localhost:${PORT}\n`);
  addLog('info', 'Dashboard démarré');

  // Auto-start scheduler if enabled in settings
  const settings = loadCurrentSettings();
  if (settings.scheduler?.enabled) {
    startScheduler();
  }
});
