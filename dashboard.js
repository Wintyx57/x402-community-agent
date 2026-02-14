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
const logs = [];
const history = [];

function addLog(level, msg) {
  const entry = { time: new Date().toISOString(), level, msg };
  logs.push(entry);
  if (logs.length > 200) logs.shift();
  console.log(`[${level}] ${msg}`);
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

server.listen(PORT, () => {
  console.log(`\n  x402 Community Agent Dashboard`);
  console.log(`  http://localhost:${PORT}\n`);
  addLog('info', 'Dashboard started');
});
