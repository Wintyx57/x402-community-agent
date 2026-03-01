#!/usr/bin/env node
// x402 Community Agent — Web Dashboard
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'http';
import fs from 'fs';
import crypto from 'crypto';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

import { config } from './config.js';
import { validateAndExit } from './src/validate-env.js';
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
const LOGS_FILE = join(DATA_DIR, 'agent-logs.json');
const LOGS_MAX_PERSIST = 1000; // max log entries on disk

const logs = [];
let history = [];
let queue = [];
const logEmitter = new EventEmitter();
logEmitter.setMaxListeners(50);
let schedulerInterval = null;
let schedulerRunning = false;
let schedulerTickRunning = false; // Bug 1: race condition guard
let lastSchedulerCheck = null;

// Bug 2: timezone helper — reads TZ_OFFSET env var (signed integer, e.g. "2" for UTC+2).
// Falls back to server local time if TZ_OFFSET is not set.
function getLocalNow() {
  const offsetHours = parseInt(process.env.TZ_OFFSET ?? 'NaN', 10);
  if (!isNaN(offsetHours)) {
    // Shift epoch by the configured offset; use UTC getters to read "local" fields.
    return new Date(Date.now() + offsetHours * 3600000);
  }
  return new Date();
}

// Bug 2: "YYYY-MM-DD" in the configured local timezone (works with the shifted date).
function getLocalDateStr(localNow) {
  const y = localNow.getUTCFullYear();
  const mo = String(localNow.getUTCMonth() + 1).padStart(2, '0');
  const d = String(localNow.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

// Non-sensitive default settings — NO secrets stored here, ever.
const DEFAULT_SETTINGS = {
  platforms: {
    telegram: { enabled: false, autoPublish: false, channelId: '' },
    discord: { enabled: false, autoPublish: false },
    twitter: { enabled: false, autoPublish: false },
    reddit: { enabled: false, autoPublish: false, subreddits: ['artificial', 'webdev', 'SideProject'] },
    devto: { enabled: false, autoPublish: false },
    linkedin: { enabled: false, autoPublish: false },
    farcaster: { enabled: false, autoPublish: false, fid: 0 },
    hn: { enabled: false, autoPublish: false }
  },
  content: {
    generateImages: false,
    defaultLanguage: 'en',
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

// Keys that must NEVER be persisted to disk (always sourced from env vars only)
const SENSITIVE_PERSIST_KEYS = new Set([
  'privateKey', 'botToken', 'apiKey', 'apiSecret',
  'accessToken', 'accessSecret', 'clientId', 'clientSecret',
  'password', 'mnemonic', 'signerKey', 'neynarApiKey', 'webhookUrl', 'adminChatId',
]);

// Inject secrets from env vars into a runtime settings object (result is NEVER written to disk)
function injectSecretsFromEnv(settings) {
  const s = JSON.parse(JSON.stringify(settings));

  // Wallet — always sourced from env only
  s.wallet = {
    maxBudget: parseFloat(process.env.MAX_BUDGET_USDC || '0.50'),
    privateKey: process.env.AGENT_PRIVATE_KEY || '',
  };

  if (!s.platforms.telegram) s.platforms.telegram = {};
  s.platforms.telegram.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  s.platforms.telegram.adminChatId = process.env.TELEGRAM_CHAT_ID || '';
  if (process.env.TELEGRAM_CHANNEL_ID && !s.platforms.telegram.channelId) {
    s.platforms.telegram.channelId = process.env.TELEGRAM_CHANNEL_ID;
  }

  if (!s.platforms.discord) s.platforms.discord = {};
  s.platforms.discord.webhookUrl = process.env.DISCORD_WEBHOOK_URL || '';

  if (!s.platforms.twitter) s.platforms.twitter = {};
  s.platforms.twitter.apiKey = process.env.TWITTER_API_KEY || '';
  s.platforms.twitter.apiSecret = process.env.TWITTER_API_SECRET || '';
  s.platforms.twitter.accessToken = process.env.TWITTER_ACCESS_TOKEN || '';
  s.platforms.twitter.accessSecret = process.env.TWITTER_ACCESS_SECRET || '';

  if (!s.platforms.reddit) s.platforms.reddit = {};
  s.platforms.reddit.clientId = process.env.REDDIT_CLIENT_ID || '';
  s.platforms.reddit.clientSecret = process.env.REDDIT_CLIENT_SECRET || '';
  s.platforms.reddit.username = process.env.REDDIT_USERNAME || '';
  s.platforms.reddit.password = process.env.REDDIT_PASSWORD || '';

  if (!s.platforms.devto) s.platforms.devto = {};
  s.platforms.devto.apiKey = process.env.DEVTO_API_KEY || '';

  if (!s.platforms.linkedin) s.platforms.linkedin = {};
  s.platforms.linkedin.accessToken = process.env.LINKEDIN_ACCESS_TOKEN || '';

  if (!s.platforms.farcaster) s.platforms.farcaster = {};
  s.platforms.farcaster.signerKey = process.env.FARCASTER_SIGNER_KEY || '';
  s.platforms.farcaster.neynarApiKey = process.env.NEYNAR_API_KEY || '';
  if (!s.platforms.farcaster.fid) {
    s.platforms.farcaster.fid = parseInt(process.env.FARCASTER_FID || '0');
  }

  if (process.env.DEFAULT_LANGUAGE) s.content.defaultLanguage = process.env.DEFAULT_LANGUAGE;
  if (process.env.GENERATE_IMAGES !== undefined) {
    s.content.generateImages = process.env.GENERATE_IMAGES !== 'false';
  }

  return s;
}

// Strip all secrets before writing to disk — only non-sensitive fields are persisted
function stripSecretsForPersist(settings) {
  const safe = JSON.parse(JSON.stringify(settings));
  delete safe.wallet; // never persisted
  if (safe.platforms) {
    for (const platform of Object.values(safe.platforms)) {
      for (const key of SENSITIVE_PERSIST_KEYS) {
        delete platform[key];
      }
    }
  }
  return safe;
}

// ─── Initialization ──────────────────────────────────────────────
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(join(DATA_DIR, '.gitkeep'), '');
    addLog('info', 'Created data directory');
  }
}

function loadSettings() {
  let base = DEFAULT_SETTINGS;
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      base = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
      // Ensure all platform keys exist (backward compat with older JSON)
      base.platforms = { ...DEFAULT_SETTINGS.platforms, ...base.platforms };
      base.content = { ...DEFAULT_SETTINGS.content, ...base.content };
      addLog('info', 'Settings loaded from file');
    } catch (e) {
      addLog('error', `Failed to load settings: ${e.message}`);
      base = DEFAULT_SETTINGS;
    }
  }
  // Always inject secrets from env — env takes absolute priority
  const runtime = injectSecretsFromEnv(base);
  applySettingsToConfig(runtime);
  return runtime;
}

function saveSettings(settings) {
  try {
    // SECURITY: strip all secrets before writing to disk
    const toPersist = stripSecretsForPersist(settings);
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(toPersist, null, 2), 'utf-8');
    applySettingsToConfig(settings); // apply full runtime settings (with secrets) to config
    addLog('info', 'Settings saved');
    return true;
  } catch (e) {
    addLog('error', `Failed to save settings: ${e.message}`);
    return false;
  }
}

// S9 — Strip all secrets server-side before sending to frontend
const SENSITIVE_FRONTEND_KEYS = new Set([
  'privateKey', 'botToken', 'apiKey', 'apiSecret',
  'accessToken', 'accessSecret', 'clientId', 'clientSecret',
  'password', 'mnemonic', 'signerKey', 'neynarApiKey', 'webhookUrl', 'adminChatId',
]);

function sanitizeConfigForFrontend(settings) {
  const safe = JSON.parse(JSON.stringify(settings));
  // Wallet: remove private key, expose only configured flag + budget
  if (safe.wallet) {
    delete safe.wallet.privateKey;
    safe.wallet.configured = !!(settings.wallet && settings.wallet.privateKey);
  } else {
    safe.wallet = { configured: !!process.env.AGENT_PRIVATE_KEY, maxBudget: parseFloat(process.env.MAX_BUDGET_USDC || '0.50') };
  }
  // Strip all sensitive platform credentials
  if (safe.platforms) {
    Object.keys(safe.platforms).forEach(platform => {
      const p = safe.platforms[platform];
      const orig = settings.platforms?.[platform] || {};
      for (const key of SENSITIVE_FRONTEND_KEYS) {
        delete p[key];
      }
      // Expose boolean: is this platform configured (has credentials)?
      p.configured = !!(orig.botToken || orig.apiKey || orig.accessToken
        || orig.webhookUrl || orig.mnemonic || orig.signerKey || orig.clientId);
    });
  }
  return safe;
}

function applySettingsToConfig(settings) {
  // Update runtime config (defensive — guard every access)
  if (settings.wallet?.maxBudget != null) config.maxBudget = settings.wallet.maxBudget;
  if (settings.content) {
    if (settings.content.defaultLanguage) config.defaultLanguage = settings.content.defaultLanguage;
    if (settings.content.generateImages != null) config.generateImages = settings.content.generateImages;
    if (settings.content.projectName) config.projectName = settings.content.projectName;
    if (settings.content.projectUrl) config.projectUrl = settings.content.projectUrl;
  }

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

function loadLogs() {
  if (fs.existsSync(LOGS_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8'));
      if (Array.isArray(saved)) {
        // Keep only last 200 in memory
        const slice = saved.slice(-200);
        logs.push(...slice);
      }
    } catch (e) {
      console.error(`[error] Failed to load logs: ${e.message}`);
    }
  }
}

function persistLogs() {
  try {
    // Keep last LOGS_MAX_PERSIST on disk
    const toPersist = logs.slice(-LOGS_MAX_PERSIST);
    fs.writeFileSync(LOGS_FILE, JSON.stringify(toPersist, null, 2), 'utf-8');
  } catch (e) {
    console.error(`[error] Failed to persist logs: ${e.message}`);
  }
}

function addLog(level, msg) {
  const entry = { time: new Date().toISOString(), level, msg };
  logs.push(entry);
  if (logs.length > 200) logs.shift();
  console.log(`[${level}] ${msg}`);
  try { logEmitter.emit('log', entry); } catch { /* ignore */ }
  // Async persist every 10 logs to avoid blocking
  if (logs.length % 10 === 0) setImmediate(persistLogs);
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

  // Bug 3 (jitter): align first tick to the next full minute instead of firing
  // immediately (which would be out-of-sync with the 60-s interval).
  const now = Date.now();
  const msUntilNextMinute = 60_000 - (now % 60_000);
  setTimeout(() => {
    if (!schedulerRunning) return; // stopped before first tick
    schedulerTick();
    schedulerInterval = setInterval(schedulerTick, 60_000);
  }, msUntilNextMinute);

  addLog('info', `Scheduler démarré — premier tick dans ${Math.round(msUntilNextMinute / 1000)}s`);
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
  let base = DEFAULT_SETTINGS;
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
      base = { ...DEFAULT_SETTINGS, ...saved, platforms: { ...DEFAULT_SETTINGS.platforms, ...saved.platforms } };
    } catch {}
  }
  // Always inject secrets from env at runtime
  return injectSecretsFromEnv(base);
}

async function schedulerTick() {
  // Bug 1: prevent concurrent ticks if a previous one is still running
  if (schedulerTickRunning) {
    addLog('info', 'Scheduler: tick précédent encore en cours, ignoré');
    return;
  }
  schedulerTickRunning = true;

  try {
    // Bug 2: use local timezone-aware time instead of raw server Date
    const now = getLocalNow();
    const time = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const day = dayNames[now.getUTCDay()];
    const todayStr = getLocalDateStr(now);
    lastSchedulerCheck = new Date().toISOString();

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
  } finally {
    schedulerTickRunning = false;
  }
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

    // Always send copy-paste versions for unconfigured platforms (Twitter, Reddit, HN)
    // so admin can post manually from Telegram
    const COPY_PASTE_PLATFORMS = ['twitter', 'reddit', 'hn'];
    const copyPasteContents = {};
    for (const p of COPY_PASTE_PLATFORMS) {
      if (result.contents[p] && !settings.platforms[p]?.enabled) {
        copyPasteContents[p] = result.contents[p];
      }
    }
    if (Object.keys(copyPasteContents).length > 0) {
      // Send only the manual copy-paste messages (no preview/approve needed)
      const { sendCopyPaste } = await import('./lib/platforms/telegram.js');
      await sendCopyPaste(copyPasteContents).catch(() => {});
      addLog('info', `Copy-paste envoyé sur Telegram: ${Object.keys(copyPasteContents).join(', ')}`);
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
          result = await postToChannel(content.text || content, content.imageUrl || item.imageUrl); break;
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
    // Bug 4 (retry stagnation): increment retryCount BEFORE the comparison so
    // that after maxRetries failed attempts the item correctly lands in 'failed'.
    item.retryCount++;
    const settings = loadCurrentSettings();
    const maxRetries = settings.scheduler?.retryMax || 3;
    if (item.retryCount <= maxRetries) {
      item.status = 'retry';
      const delays = settings.scheduler?.retryDelays || [5, 30, 60];
      const delayMin = delays[Math.min(item.retryCount - 1, delays.length - 1)];
      item.nextRetry = new Date(Date.now() + delayMin * 60000).toISOString();
      addLog('info', `Retry planifié dans ${delayMin}min (tentative ${item.retryCount}/${maxRetries})`);
    } else {
      item.status = 'failed';
      item.nextRetry = null;
      addLog('error', `Item ${item.strategy} abandonné après ${maxRetries} tentatives`);
    }
  }

  history.push({ time: new Date().toISOString(), strategy: item.strategy, results: item.results, auto: item.autoPublish });
  saveHistory();
  saveQueue();
  await sendReport(item.results).catch(() => {});
}

async function processRetryQueue(settings) {
  const now = Date.now();
  // Bug 4: only pick items that are truly due for retry (not already in publishing)
  const retryItems = queue.filter(q =>
    q.status === 'retry' &&
    q.nextRetry &&
    new Date(q.nextRetry).getTime() <= now
  );

  for (const item of retryItems) {
    // Re-check status: a concurrent tick may have already picked it up
    if (item.status !== 'retry') continue;
    addLog('info', `Retry: ${item.strategy} (tentative ${item.retryCount})`);
    // Only retry failed platforms, not the ones that already succeeded
    const failedPlatforms = Object.entries(item.results)
      .filter(([, r]) => !r.success)
      .map(([p]) => p);
    item.platforms = failedPlatforms.length > 0 ? failedPlatforms : item.platforms;
    item.results = {};
    await publishQueueItem(item);
  }
}

// ─── Settings Merge (preserve redacted values) ──────────────────
// Merge incoming (from frontend) with existing persisted settings.
// Secrets are NEVER included: they come from env vars only.
// Incoming may contain redacted placeholders (***) or be missing secret keys — both are ignored.
function mergeSettings(existing, incoming) {
  // Deep merge: existing as base, incoming overrides
  const base = JSON.parse(JSON.stringify(existing));
  const inc = JSON.parse(JSON.stringify(incoming));
  // Remove any secret fields sent by the frontend (should not be sent, but defensive)
  delete inc.wallet;
  if (inc.platforms) {
    for (const platform of Object.values(inc.platforms)) {
      for (const key of SENSITIVE_PERSIST_KEYS) {
        delete platform[key];
      }
    }
  }
  // Merge top-level sections
  if (inc.platforms) {
    for (const [name, val] of Object.entries(inc.platforms)) {
      base.platforms[name] = { ...base.platforms[name], ...val };
    }
  }
  if (inc.content) base.content = { ...base.content, ...inc.content };
  if (inc.scheduler) base.scheduler = { ...base.scheduler, ...inc.scheduler };
  if (inc.schedule) base.schedule = inc.schedule; // replace entirely
  return base;
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
    // Merge non-sensitive settings only (secrets always come from env)
    const existing = fs.existsSync(SETTINGS_FILE)
      ? JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'))
      : DEFAULT_SETTINGS;
    const merged = mergeSettings(existing, body);
    // Re-inject secrets from env for applySettingsToConfig (secrets not persisted)
    const runtimeMerged = injectSecretsFromEnv(merged);
    const success = saveSettings(runtimeMerged);
    if (success) {
      addLog('info', 'Settings updated via API');
      return json(res, { success: true });
    }
    return json(res, { error: 'Failed to save settings' }, 500);
  }

  // GET /api/settings/test/:platform — test platform connection
  if (path.startsWith('/api/settings/test/') && req.method === 'GET') {
    const platform = path.split('/').pop();
    // Use loadCurrentSettings so secrets are injected from env vars
    const settings = loadCurrentSettings();
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
            results.telegram = await postToChannel(content.text || content, content.imageUrl || imageUrl);
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

  // GET /api/stream/logs — SSE real-time log stream
  if (path === '/api/stream/logs' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });
    // Send last 20 logs as initial snapshot
    res.write(`event: snapshot\ndata: ${JSON.stringify(logs.slice(-20))}\n\n`);
    const onLog = (entry) => {
      res.write(`event: log\ndata: ${JSON.stringify(entry)}\n\n`);
    };
    logEmitter.on('log', onLog);
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => {
      logEmitter.off('log', onLog);
      clearInterval(ping);
    });
    return; // keep connection open
  }

  // GET /api/logs[?level=info|error&limit=N&q=text]
  if (path === '/api/logs' && req.method === 'GET') {
    const levelFilter = url.searchParams.get('level');
    const limitParam = parseInt(url.searchParams.get('limit') || '100', 10);
    const query = (url.searchParams.get('q') || '').toLowerCase();
    let result = logs;
    if (levelFilter) result = result.filter(l => l.level === levelFilter);
    if (query) result = result.filter(l => l.msg.toLowerCase().includes(query));
    return json(res, result.slice(-Math.min(limitParam, 500)));
  }

  // DELETE /api/logs — clear all logs
  if (path === '/api/logs' && req.method === 'DELETE') {
    logs.length = 0;
    persistLogs();
    addLog('info', 'Logs effacés par l\'utilisateur');
    return json(res, { success: true });
  }

  // GET /api/history
  if (path === '/api/history' && req.method === 'GET') {
    return json(res, history.slice(-20));
  }

  // GET /api/health — machine-readable health check (used by x402-backend monitoring)
  if (path === '/api/health' && req.method === 'GET') {
    const settings = loadCurrentSettings();
    const enabledPlatforms = Object.entries(settings.platforms || {})
      .filter(([, cfg]) => cfg.enabled)
      .map(([name]) => name);
    const pendingApproval = queue.filter(q => q.status === 'awaiting_approval').length;
    const retryCount = queue.filter(q => q.status === 'retry').length;
    return json(res, {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      scheduler: {
        running: schedulerRunning,
        lastCheck: lastSchedulerCheck,
        nextPost: getNextScheduledPost(),
      },
      queue: {
        total: queue.length,
        pendingApproval,
        retry: retryCount,
      },
      platforms: {
        enabled: enabledPlatforms,
        count: enabledPlatforms.length,
      },
      logs: logs.length,
      history: history.length,
      timestamp: new Date().toISOString(),
    });
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
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Token,Authorization',
    });
    return res.end();
  }

  if (req.url.startsWith('/api/')) {
    return handleApi(req, res);
  }
  serveStatic(req, res);
});

// Initialize on startup
// Validate environment variables before starting server
validateAndExit();

ensureDataDir();
loadLogs(); // Restore persisted logs before any addLog calls
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

// ─── Graceful Shutdown ────────────────────────────────────────────
function gracefulShutdown(signal) {
  console.log(`\n[${signal}] Shutting down community agent...`);
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  saveQueue();
  saveHistory();
  addLog('info', `Agent stopped (${signal})`);
  persistLogs();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
