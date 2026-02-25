// Tests — lib/platforms/discord.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../config.js';
import { post } from '../lib/platforms/discord.js';

// Note: ESM modules sont mis en cache — on manipule config directement

describe('discord.post — platform disabled', () => {
  it('should return success:false when platform is disabled', async () => {
    const originalEnabled = config.platforms.discord.enabled;
    config.platforms.discord.enabled = false;

    try {
      const result = await post({ embeds: [{ title: 'Test' }] });
      assert.equal(result.success, false);
      assert.ok(
        result.message.toLowerCase().includes('not configured') ||
        result.message.toLowerCase().includes('configured'),
        `Unexpected message: ${result.message}`
      );
    } finally {
      config.platforms.discord.enabled = originalEnabled;
    }
  });
});

describe('discord.post — platform enabled (mocked fetch)', () => {
  it('should return success:true when webhook responds 204', async () => {
    const originalFetch = globalThis.fetch;
    const originalEnabled = config.platforms.discord.enabled;
    const originalUrl = config.platforms.discord.webhookUrl;

    config.platforms.discord.enabled = true;
    config.platforms.discord.webhookUrl = 'https://discord.com/api/webhooks/test/hook';
    globalThis.fetch = async () => ({ ok: false, status: 204 });

    try {
      const result = await post('Test message');
      assert.equal(result.success, true);
      assert.equal(result.message, 'Posted');
    } finally {
      globalThis.fetch = originalFetch;
      config.platforms.discord.enabled = originalEnabled;
      config.platforms.discord.webhookUrl = originalUrl;
    }
  });

  it('should return success:true when webhook responds 200', async () => {
    const originalFetch = globalThis.fetch;
    const originalEnabled = config.platforms.discord.enabled;
    const originalUrl = config.platforms.discord.webhookUrl;

    config.platforms.discord.enabled = true;
    config.platforms.discord.webhookUrl = 'https://discord.com/api/webhooks/test/hook';
    globalThis.fetch = async () => ({ ok: true, status: 200 });

    try {
      const result = await post('Test message');
      assert.equal(result.success, true);
    } finally {
      globalThis.fetch = originalFetch;
      config.platforms.discord.enabled = originalEnabled;
      config.platforms.discord.webhookUrl = originalUrl;
    }
  });

  it('should wrap string content in { content: ... } field', async () => {
    let capturedBody;
    const originalFetch = globalThis.fetch;
    const originalEnabled = config.platforms.discord.enabled;
    const originalUrl = config.platforms.discord.webhookUrl;

    config.platforms.discord.enabled = true;
    config.platforms.discord.webhookUrl = 'https://discord.com/api/webhooks/test/hook';
    globalThis.fetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200 };
    };

    try {
      await post('Plain text message');
      assert.ok(capturedBody, 'fetch should have been called');
      assert.ok('content' in capturedBody);
      assert.ok(capturedBody.content.length <= 2000);
      assert.ok(capturedBody.content.includes('Plain text message'));
    } finally {
      globalThis.fetch = originalFetch;
      config.platforms.discord.enabled = originalEnabled;
      config.platforms.discord.webhookUrl = originalUrl;
    }
  });

  it('should pass object (embed) content directly to fetch', async () => {
    let capturedBody;
    const originalFetch = globalThis.fetch;
    const originalEnabled = config.platforms.discord.enabled;
    const originalUrl = config.platforms.discord.webhookUrl;

    config.platforms.discord.enabled = true;
    config.platforms.discord.webhookUrl = 'https://discord.com/api/webhooks/test/hook';
    globalThis.fetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, status: 200 };
    };

    try {
      const embedPayload = { embeds: [{ title: 'Test embed', description: 'Hello' }] };
      await post(embedPayload);
      assert.ok(capturedBody);
      assert.ok('embeds' in capturedBody);
      assert.equal(capturedBody.embeds[0].title, 'Test embed');
    } finally {
      globalThis.fetch = originalFetch;
      config.platforms.discord.enabled = originalEnabled;
      config.platforms.discord.webhookUrl = originalUrl;
    }
  });

  it('should return success:false with HTTP status in message on error', async () => {
    const originalFetch = globalThis.fetch;
    const originalEnabled = config.platforms.discord.enabled;
    const originalUrl = config.platforms.discord.webhookUrl;

    config.platforms.discord.enabled = true;
    config.platforms.discord.webhookUrl = 'https://discord.com/api/webhooks/test/hook';
    globalThis.fetch = async () => ({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    });

    try {
      const result = await post('Test');
      assert.equal(result.success, false);
      assert.ok(result.message.includes('403'));
    } finally {
      globalThis.fetch = originalFetch;
      config.platforms.discord.enabled = originalEnabled;
      config.platforms.discord.webhookUrl = originalUrl;
    }
  });
});
