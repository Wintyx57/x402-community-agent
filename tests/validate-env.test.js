// Tests — validate-env.js
// Verifies environment variable validation logic
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// Store original env
const originalEnv = { ...process.env };

describe('validate-env — validation logic', () => {
  let validateEnvironment;

  before(async () => {
    const mod = await import('../src/validate-env.js');
    validateEnvironment = mod.validateEnvironment;
  });

  // Helper to test with temp env vars
  function withEnv(vars, fn) {
    const saved = { ...process.env };
    try {
      // Clear relevant vars
      delete process.env.X402_SERVER_URL;
      delete process.env.MAX_BUDGET_USDC;
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_CHAT_ID;
      delete process.env.DISCORD_WEBHOOK_URL;
      delete process.env.TWITTER_API_KEY;
      delete process.env.TWITTER_API_SECRET;
      delete process.env.TWITTER_ACCESS_TOKEN;
      delete process.env.TWITTER_ACCESS_SECRET;
      delete process.env.REDDIT_CLIENT_ID;
      delete process.env.REDDIT_CLIENT_SECRET;
      delete process.env.REDDIT_USERNAME;
      delete process.env.REDDIT_PASSWORD;
      delete process.env.DEVTO_API_KEY;
      delete process.env.LINKEDIN_ACCESS_TOKEN;
      delete process.env.FARCASTER_SIGNER_KEY;
      delete process.env.FARCASTER_FID;
      delete process.env.NEYNAR_API_KEY;

      // Set test vars
      Object.assign(process.env, vars);
      return fn();
    } finally {
      // Restore
      Object.assign(process.env, saved);
    }
  }

  it('should pass validation with no platforms configured', () => {
    const result = withEnv({}, () => validateEnvironment());
    assert.equal(result.valid, true);
  });

  it('should detect missing core URL but not fail (has default)', () => {
    const result = withEnv({}, () => validateEnvironment());
    assert.equal(result.valid, true);
    assert.ok(!result.errors.some(e => e.var === 'X402_SERVER_URL'));
  });

  it('should accept valid Farcaster signer key', () => {
    const result = withEnv(
      { FARCASTER_SIGNER_KEY: '0x' + 'a'.repeat(40) },
      () => validateEnvironment()
    );
    // Should have farcaster detected as enabled
    assert.ok(result.summary.configuredPlatforms.includes('farcaster'));
  });

  it('should accept Farcaster signer key in any non-empty format', () => {
    const result = withEnv(
      { FARCASTER_SIGNER_KEY: 'any-non-empty-value' },
      () => validateEnvironment()
    );
    // Farcaster signer key just needs to be non-empty (hex validation optional)
    assert.ok(result.summary.configuredPlatforms.includes('farcaster'));
  });

  it('should validate Discord webhook URL format', () => {
    // Valid Discord webhook
    const result = withEnv(
      { DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/123456789/abcdefghijk' },
      () => validateEnvironment()
    );
    assert.ok(result.summary.configuredPlatforms.includes('discord'));
  });

  it('should reject invalid Discord webhook URL', () => {
    const result = withEnv(
      { DISCORD_WEBHOOK_URL: 'https://example.com/webhook' },
      () => validateEnvironment()
    );
    // Should detect discord as enabled but invalid
    const discordError = result.errors.find(e => e.var === 'DISCORD_WEBHOOK_URL');
    assert.ok(discordError);
  });

  it('should require all Twitter credentials when enabled', () => {
    const result = withEnv(
      { TWITTER_API_KEY: 'valid_key' }, // Only one of 4 required
      () => validateEnvironment()
    );
    // Should report missing Twitter creds
    assert.ok(result.errors.some(e => e.platform === 'twitter'));
  });

  it('should validate telegram numeric IDs', () => {
    const result = withEnv(
      {
        TELEGRAM_BOT_TOKEN: 'valid_token',
        TELEGRAM_CHAT_ID: '12345',
        TELEGRAM_CHANNEL_ID: '-12345'
      },
      () => validateEnvironment()
    );
    // Should accept valid telegram setup
    assert.ok(result.summary.configuredPlatforms.includes('telegram'));
    assert.equal(result.errors.filter(e => e.platform === 'telegram').length, 0);
  });

  it('should reject invalid telegram numeric IDs', () => {
    const result = withEnv(
      {
        TELEGRAM_BOT_TOKEN: 'valid_token',
        TELEGRAM_CHAT_ID: 'not_a_number'
      },
      () => validateEnvironment()
    );
    // Should report invalid ID format
    assert.ok(result.errors.some(e => e.var === 'TELEGRAM_CHAT_ID'));
  });

  it('should validate farcaster FID as numeric', () => {
    const result = withEnv(
      {
        FARCASTER_SIGNER_KEY: '0x' + 'a'.repeat(40),
        FARCASTER_FID: '12345'
      },
      () => validateEnvironment()
    );
    // Should accept valid FID
    assert.equal(result.errors.filter(e => e.var === 'FARCASTER_FID').length, 0);
  });

  it('should reject invalid farcaster FID', () => {
    const result = withEnv(
      {
        FARCASTER_SIGNER_KEY: '0x' + 'a'.repeat(40),
        FARCASTER_FID: 'not_a_number'
      },
      () => validateEnvironment()
    );
    // Should reject non-numeric FID
    assert.ok(result.errors.some(e => e.var === 'FARCASTER_FID'));
  });

  it('should validate MAX_BUDGET_USDC as positive number', () => {
    const result = withEnv(
      { MAX_BUDGET_USDC: '10.5' },
      () => validateEnvironment()
    );
    assert.equal(result.errors.filter(e => e.var === 'MAX_BUDGET_USDC').length, 0);
  });

  it('should reject zero or negative MAX_BUDGET_USDC', () => {
    let result = withEnv(
      { MAX_BUDGET_USDC: '0' },
      () => validateEnvironment()
    );
    assert.ok(result.errors.some(e => e.var === 'MAX_BUDGET_USDC'));

    result = withEnv(
      { MAX_BUDGET_USDC: '-5' },
      () => validateEnvironment()
    );
    assert.ok(result.errors.some(e => e.var === 'MAX_BUDGET_USDC'));
  });

  it('should detect enabled platforms correctly', () => {
    const result = withEnv(
      {
        TELEGRAM_BOT_TOKEN: 'token',
        DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/123/abc',
      },
      () => validateEnvironment()
    );
    const configured = result.summary.configuredPlatforms;
    assert.ok(configured.includes('telegram'));
    assert.ok(configured.includes('discord'));
    assert.equal(result.summary.configuredCount, 2);
  });

  it('should require all Reddit credentials when enabled', () => {
    const result = withEnv(
      { REDDIT_CLIENT_ID: 'id' }, // Only one of 4 required
      () => validateEnvironment()
    );
    // Should report missing Reddit creds
    const redditErrors = result.errors.filter(e => e.platform === 'reddit');
    assert.ok(redditErrors.length > 0);
  });

  it('should validate Dev.to with just API key', () => {
    const result = withEnv(
      { DEVTO_API_KEY: 'valid_key' },
      () => validateEnvironment()
    );
    assert.ok(result.summary.configuredPlatforms.includes('devto'));
    assert.equal(result.errors.filter(e => e.platform === 'devto').length, 0);
  });

  it('should validate LinkedIn with just access token', () => {
    const result = withEnv(
      { LINKEDIN_ACCESS_TOKEN: 'valid_token' },
      () => validateEnvironment()
    );
    assert.ok(result.summary.configuredPlatforms.includes('linkedin'));
    assert.equal(result.errors.filter(e => e.platform === 'linkedin').length, 0);
  });

  it('should return summary with all platform counts', () => {
    const result = withEnv(
      {
        TELEGRAM_BOT_TOKEN: 'token',
        TWITTER_API_KEY: 'key',
        TWITTER_API_SECRET: 'secret',
        TWITTER_ACCESS_TOKEN: 'token',
        TWITTER_ACCESS_SECRET: 'secret',
      },
      () => validateEnvironment()
    );
    assert.ok(result.summary.configuredPlatforms.length >= 1);
    assert.ok(typeof result.summary.configuredCount === 'number');
    assert.ok(typeof result.summary.totalIssues === 'number');
  });

  it('should accept valid HTTP URLs for X402_SERVER_URL', () => {
    let result = withEnv(
      { X402_SERVER_URL: 'https://api.example.com' },
      () => validateEnvironment()
    );
    assert.equal(result.errors.filter(e => e.var === 'X402_SERVER_URL').length, 0);

    result = withEnv(
      { X402_SERVER_URL: 'http://localhost:3000' },
      () => validateEnvironment()
    );
    assert.equal(result.errors.filter(e => e.var === 'X402_SERVER_URL').length, 0);
  });

  it('should reject invalid URLs for X402_SERVER_URL', () => {
    const result = withEnv(
      { X402_SERVER_URL: 'not-a-url' },
      () => validateEnvironment()
    );
    assert.ok(result.errors.some(e => e.var === 'X402_SERVER_URL'));
  });
});
