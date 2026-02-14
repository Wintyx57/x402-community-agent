#!/usr/bin/env node
// x402 Community Agent — AI-powered multi-network community manager
// Uses x402 Bazaar APIs for content generation (dogfooding)
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

import { config } from './config.js';
import { getSpending, getBalance } from './lib/x402-client.js';
import { sendPreview, sendImage, waitForApproval, postToChannel, sendReport } from './lib/platforms/telegram.js';
import * as discord from './lib/platforms/discord.js';
import * as twitter from './lib/platforms/twitter.js';
import * as reddit from './lib/platforms/reddit.js';
import * as devto from './lib/platforms/devto.js';
import * as linkedin from './lib/platforms/linkedin.js';
import * as farcaster from './lib/platforms/farcaster.js';

// ─── Strategy loader ──────────────────────────────────────────────
async function loadStrategy(name) {
  const strategies = {
    'daily-stats': () => import('./strategies/daily-stats.js'),
    'new-api': () => import('./strategies/new-api.js'),
    'weekly-recap': () => import('./strategies/weekly-recap.js'),
  };
  if (!strategies[name]) throw new Error(`Unknown strategy: ${name}. Available: ${Object.keys(strategies).join(', ')}`);
  return strategies[name]();
}

// ─── Publish to all platforms ─────────────────────────────────────
async function publishAll(contents, imageUrl) {
  const results = {};

  // Discord — auto-post (low risk)
  if (contents.discord) {
    try { results.discord = await discord.post(contents.discord); }
    catch (e) { results.discord = { success: false, message: e.message }; }
  }

  // Telegram channel — auto-post (low risk)
  if (contents.telegram) {
    try {
      const tg = contents.telegram;
      const res = await postToChannel(tg.text || tg, tg.imageUrl || imageUrl);
      results.telegram_channel = { success: !!res?.ok, message: res?.ok ? 'Posted' : 'Failed' };
    } catch (e) { results.telegram_channel = { success: false, message: e.message }; }
  }

  // Twitter — auto if configured, otherwise generate-only
  if (contents.twitter) {
    try { results.twitter = await twitter.post(contents.twitter, imageUrl); }
    catch (e) { results.twitter = { success: false, message: e.message, manualPost: true }; }
  }

  // Reddit
  if (contents.reddit) {
    try { results.reddit = await reddit.post(contents.reddit); }
    catch (e) { results.reddit = { success: false, message: e.message, manualPost: true }; }
  }

  // LinkedIn
  if (contents.linkedin) {
    try { results.linkedin = await linkedin.post(typeof contents.linkedin === 'string' ? contents.linkedin : contents.linkedin.text); }
    catch (e) { results.linkedin = { success: false, message: e.message, manualPost: true }; }
  }

  // Dev.to
  if (contents.devto) {
    try { results.devto = await devto.post(contents.devto); }
    catch (e) { results.devto = { success: false, message: e.message, manualPost: true }; }
  }

  // Farcaster
  if (contents.farcaster) {
    try { results.farcaster = await farcaster.post(typeof contents.farcaster === 'string' ? contents.farcaster : contents.farcaster.text); }
    catch (e) { results.farcaster = { success: false, message: e.message, manualPost: true }; }
  }

  return results;
}

// ─── Main ─────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const strategyFlag = args.find((_, i) => args[i - 1] === '--strategy') || 'daily-stats';
  const previewOnly = args.includes('--preview');
  const autoApprove = args.includes('--auto');
  const skipApproval = args.includes('--skip-approval');

  console.log(`\n========================================`);
  console.log(`  x402 Community Agent`);
  console.log(`  Strategy: ${strategyFlag}`);
  console.log(`  Preview: ${previewOnly}, Auto: ${autoApprove}`);
  console.log(`========================================\n`);

  // List enabled platforms
  const enabled = Object.entries(config.platforms)
    .filter(([, v]) => v.enabled)
    .map(([k]) => k);
  console.log(`Platforms enabled: ${enabled.length > 0 ? enabled.join(', ') : 'none (generate-only mode)'}\n`);

  // Execute strategy
  console.log(`Running strategy: ${strategyFlag}...`);
  const strategy = await loadStrategy(strategyFlag);
  const { contents, stats, imageUrl } = await strategy.execute();

  console.log(`\nContent generated for: ${Object.keys(contents).join(', ')}`);
  if (imageUrl) console.log(`Image: ${imageUrl}`);

  // Preview mode — just show content and exit
  if (previewOnly) {
    console.log('\n--- PREVIEW MODE ---\n');
    for (const [platform, content] of Object.entries(contents)) {
      console.log(`=== ${platform.toUpperCase()} ===`);
      console.log(typeof content === 'string' ? content : JSON.stringify(content, null, 2));
      console.log('');
    }
    const spending = getSpending();
    console.log(`\nBudget: ${spending.spent.toFixed(4)} / ${config.maxBudget} USDC spent`);
    return;
  }

  // Send preview to Telegram admin
  await sendPreview(contents);
  if (imageUrl) await sendImage(imageUrl, 'Generated visual for this post');

  // Wait for approval (unless auto or skip-approval)
  let approval = 'approved';
  if (!autoApprove && !skipApproval) {
    approval = await waitForApproval(300_000); // 5 min timeout
  }

  if (approval === 'rejected' || approval === 'timeout') {
    console.log(`\nPost ${approval}. Exiting.`);
    return;
  }

  // Publish to all platforms
  console.log('\nPublishing to all platforms...');
  const results = await publishAll(contents, imageUrl);

  // Report results
  console.log('\n--- Results ---');
  const manualPosts = [];
  for (const [platform, result] of Object.entries(results)) {
    const icon = result.success ? 'OK' : (result.manualPost ? 'MANUAL' : 'FAIL');
    console.log(`  ${icon} ${platform}: ${result.message || ''}`);
    if (result.manualPost && result.content) {
      manualPosts.push({ platform, content: result.content });
    }
  }

  // Send manual post content to Telegram
  if (manualPosts.length > 0) {
    let manualMsg = `*Manual Posts Needed*\n\n`;
    for (const { platform, content } of manualPosts) {
      const text = typeof content === 'string' ? content : (content.title || content.text || JSON.stringify(content));
      manualMsg += `--- *${platform.toUpperCase()}* ---\nCopy and post manually:\n\`\`\`\n${text.slice(0, 800)}\n\`\`\`\n\n`;
    }
    await sendPreview({ 'manual-posts': manualMsg });
  }

  // Send completion report
  await sendReport(results);

  // Budget summary
  const spending = getSpending();
  console.log(`\nBudget: ${spending.spent.toFixed(4)} / ${config.maxBudget} USDC spent`);
  console.log(`Payments: ${spending.payments.length}`);
  spending.payments.forEach(p => console.log(`  ${p.amount} USDC → ${p.endpoint}`));

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Agent error:', err.message);
  process.exit(1);
});
