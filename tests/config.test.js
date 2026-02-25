// Tests — config.js
// Vérifie les valeurs par défaut et la lecture des env vars
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

describe('config — valeurs par défaut', () => {
  let config;

  before(async () => {
    // Importer le module config (dotenv chargé dans config.js)
    const mod = await import('../config.js');
    config = mod.config;
  });

  it('should have a serverUrl', () => {
    assert.ok(typeof config.serverUrl === 'string');
    assert.ok(config.serverUrl.startsWith('http'));
  });

  it('should default to x402-api.onrender.com when X402_SERVER_URL not set', () => {
    // Sans env var, la valeur par défaut est l'URL Render
    if (!process.env.X402_SERVER_URL) {
      assert.equal(config.serverUrl, 'https://x402-api.onrender.com');
    }
  });

  it('should have maxBudget as a positive number', () => {
    assert.ok(typeof config.maxBudget === 'number');
    assert.ok(config.maxBudget > 0);
  });

  it('should default maxBudget to 0.50 when MAX_BUDGET_USDC not set', () => {
    if (!process.env.MAX_BUDGET_USDC) {
      assert.equal(config.maxBudget, 0.50);
    }
  });

  it('should have chain set to base', () => {
    assert.equal(config.chain, 'base');
  });

  it('should have a valid USDC address (42 chars, 0x prefix)', () => {
    assert.match(config.usdcAddress, /^0x[0-9a-fA-F]{40}$/);
  });

  it('should have platforms object with all expected keys', () => {
    const expectedPlatforms = ['telegram', 'discord', 'twitter', 'reddit', 'devto', 'linkedin', 'farcaster', 'hn'];
    for (const p of expectedPlatforms) {
      assert.ok(p in config.platforms, `Missing platform: ${p}`);
    }
  });

  it('should have HN always disabled (no official posting API)', () => {
    assert.equal(config.platforms.hn.enabled, false);
  });

  it('should have telegram disabled when TELEGRAM_BOT_TOKEN not set', () => {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      assert.equal(config.platforms.telegram.enabled, false);
    }
  });

  it('should have discord disabled when DISCORD_WEBHOOK_URL not set', () => {
    if (!process.env.DISCORD_WEBHOOK_URL) {
      assert.equal(config.platforms.discord.enabled, false);
    }
  });

  it('should have schedule with 7 days', () => {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const day of days) {
      assert.ok(day in config.schedule, `Missing day: ${day}`);
    }
  });

  it('should have sunday as empty schedule', () => {
    assert.deepEqual(config.schedule.sunday, []);
  });

  it('should have limits for all major platforms', () => {
    const platforms = ['twitter', 'reddit', 'linkedin', 'discord', 'telegram', 'devto', 'farcaster'];
    for (const p of platforms) {
      assert.ok(p in config.limits, `Missing limits for: ${p}`);
    }
  });

  it('should have twitter maxChars = 280', () => {
    assert.equal(config.limits.twitter.maxChars, 280);
  });

  it('should have farcaster maxChars = 320', () => {
    assert.equal(config.limits.farcaster.maxChars, 320);
  });

  it('should have projectUrl starting with https', () => {
    assert.ok(config.projectUrl.startsWith('https://'));
  });

  it('should have generateImages as boolean', () => {
    assert.equal(typeof config.generateImages, 'boolean');
  });
});
