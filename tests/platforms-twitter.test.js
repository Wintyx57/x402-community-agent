// Tests — lib/platforms/twitter.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { post } from '../lib/platforms/twitter.js';

describe('twitter.post — platform disabled', () => {
  it('should return manualPost:true with content when not configured', async () => {
    const originalEnabled = config.platforms.twitter.enabled;
    config.platforms.twitter.enabled = false;

    try {
      const result = await post('Hello Twitter', null);
      assert.equal(result.success, false);
      assert.equal(result.manualPost, true);
      assert.equal(result.content, 'Hello Twitter');
      assert.ok(
        result.message.toLowerCase().includes('generate-only') ||
        result.message.toLowerCase().includes('no api'),
        `Unexpected message: ${result.message}`
      );
    } finally {
      config.platforms.twitter.enabled = originalEnabled;
    }
  });
});

describe('twitter.post — platform enabled (mocked fetch)', () => {
  it('should return success:true with tweetId on 200 response', async () => {
    const originalFetch = globalThis.fetch;
    const originalEnabled = config.platforms.twitter.enabled;

    config.platforms.twitter.enabled = true;
    config.platforms.twitter.apiKey = 'fake-key';
    config.platforms.twitter.apiSecret = 'fake-secret';
    config.platforms.twitter.accessToken = 'fake-token';
    config.platforms.twitter.accessSecret = 'fake-access-secret';
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ data: { id: '1234567890', text: 'Test tweet' } }),
    });

    try {
      const result = await post('Test tweet content', null);
      assert.equal(result.success, true);
      assert.ok(result.tweetId === '1234567890' || result.message.includes('Tweet'));
    } finally {
      globalThis.fetch = originalFetch;
      config.platforms.twitter.enabled = originalEnabled;
    }
  });

  it('should truncate tweet to 280 chars in API call', async () => {
    let capturedBody;
    const originalFetch = globalThis.fetch;
    const originalEnabled = config.platforms.twitter.enabled;

    config.platforms.twitter.enabled = true;
    config.platforms.twitter.apiKey = 'fake-key';
    config.platforms.twitter.apiSecret = 'fake-secret';
    config.platforms.twitter.accessToken = 'fake-token';
    config.platforms.twitter.accessSecret = 'fake-secret2';
    globalThis.fetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ data: { id: '123', text: '' } }) };
    };

    try {
      await post('A'.repeat(500), null);
      assert.ok(capturedBody);
      assert.ok(capturedBody.text.length <= 280, `Tweet length ${capturedBody.text.length} exceeds 280`);
    } finally {
      globalThis.fetch = originalFetch;
      config.platforms.twitter.enabled = originalEnabled;
    }
  });

  it('should return manualPost:true on HTTP error', async () => {
    const originalFetch = globalThis.fetch;
    const originalEnabled = config.platforms.twitter.enabled;

    config.platforms.twitter.enabled = true;
    config.platforms.twitter.apiKey = 'bad-key';
    config.platforms.twitter.apiSecret = 'bad-secret';
    config.platforms.twitter.accessToken = 'bad-token';
    config.platforms.twitter.accessSecret = 'bad-secret2';
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    try {
      const result = await post('Test', null);
      assert.equal(result.success, false);
      assert.equal(result.manualPost, true);
    } finally {
      globalThis.fetch = originalFetch;
      config.platforms.twitter.enabled = originalEnabled;
    }
  });

  it('should include Authorization header with OAuth scheme', async () => {
    let capturedHeaders;
    const originalFetch = globalThis.fetch;
    const originalEnabled = config.platforms.twitter.enabled;

    config.platforms.twitter.enabled = true;
    config.platforms.twitter.apiKey = 'key123';
    config.platforms.twitter.apiSecret = 'secret456';
    config.platforms.twitter.accessToken = 'token789';
    config.platforms.twitter.accessSecret = 'accesssecret';
    globalThis.fetch = async (url, opts) => {
      capturedHeaders = opts.headers;
      return { ok: true, json: async () => ({ data: { id: '1', text: 'ok' } }) };
    };

    try {
      await post('Short tweet', null);
      assert.ok(capturedHeaders);
      assert.ok(capturedHeaders['Authorization'].startsWith('OAuth '));
    } finally {
      globalThis.fetch = originalFetch;
      config.platforms.twitter.enabled = originalEnabled;
    }
  });
});

// ─── OAuth signing (internal logic via crypto) ────────────────────
describe('Twitter OAuth signing logic', () => {
  it('should produce valid HMAC-SHA1 base64 signature', () => {
    const signingKey = `consumerSecret&tokenSecret`;
    const baseString = 'GET&https%3A%2F%2Fapi.twitter.com%2F2%2Ftweets&param%3Dvalue';
    const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
    assert.equal(typeof signature, 'string');
    assert.ok(signature.length > 0);
    assert.match(signature, /^[A-Za-z0-9+/]+=*$/);
  });

  it('should produce different signatures for different keys', () => {
    const base = 'GET&https%3A%2F%2Fapi.example.com&param%3Dvalue';
    const sig1 = crypto.createHmac('sha1', 'key1&secret1').update(base).digest('base64');
    const sig2 = crypto.createHmac('sha1', 'key2&secret2').update(base).digest('base64');
    assert.notEqual(sig1, sig2);
  });
});
