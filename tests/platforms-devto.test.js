// Tests — lib/platforms/devto.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../config.js';
import { post } from '../lib/platforms/devto.js';

describe('devto.post — platform disabled', () => {
  it('should return manualPost:true with content when not configured', async () => {
    const originalEnabled = config.platforms.devto.enabled;
    config.platforms.devto.enabled = false;

    try {
      const result = await post({ title: 'My Article', body_markdown: 'Content', published: false, tags: ['ai'] });
      assert.equal(result.success, false);
      assert.equal(result.manualPost, true);
      assert.ok(result.content);
      assert.equal(result.content.title, 'My Article');
    } finally {
      config.platforms.devto.enabled = originalEnabled;
    }
  });
});

describe('devto.post — platform enabled (mocked fetch)', () => {
  it('should return success:true with article URL on 200 response', async () => {
    const originalFetch = globalThis.fetch;
    const originalEnabled = config.platforms.devto.enabled;
    const originalKey = config.platforms.devto.apiKey;

    config.platforms.devto.enabled = true;
    config.platforms.devto.apiKey = 'fake-key';
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ url: 'https://dev.to/user/my-article-123', id: 123 }),
    });

    try {
      const result = await post({
        title: 'Test Article',
        body_markdown: '# Test\nContent here',
        published: false,
        tags: ['ai', 'webdev'],
      });
      assert.equal(result.success, true);
      assert.ok(result.url.includes('dev.to'));
    } finally {
      globalThis.fetch = originalFetch;
      config.platforms.devto.enabled = originalEnabled;
      config.platforms.devto.apiKey = originalKey;
    }
  });

  it('should truncate title to 150 chars in API call', async () => {
    let capturedBody;
    const originalFetch = globalThis.fetch;
    const originalEnabled = config.platforms.devto.enabled;
    const originalKey = config.platforms.devto.apiKey;

    config.platforms.devto.enabled = true;
    config.platforms.devto.apiKey = 'fake-key';
    globalThis.fetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ url: 'https://dev.to/x', id: 1 }) };
    };

    try {
      await post({
        title: 'T'.repeat(200),
        body_markdown: 'Content',
        published: false,
        tags: ['ai'],
      });
      assert.ok(capturedBody);
      assert.ok(capturedBody.article.title.length <= 150);
    } finally {
      globalThis.fetch = originalFetch;
      config.platforms.devto.enabled = originalEnabled;
      config.platforms.devto.apiKey = originalKey;
    }
  });

  it('should limit tags to 4 in API call', async () => {
    let capturedBody;
    const originalFetch = globalThis.fetch;
    const originalEnabled = config.platforms.devto.enabled;
    const originalKey = config.platforms.devto.apiKey;

    config.platforms.devto.enabled = true;
    config.platforms.devto.apiKey = 'fake-key';
    globalThis.fetch = async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ url: 'https://dev.to/x', id: 1 }) };
    };

    try {
      await post({
        title: 'Test',
        body_markdown: 'Content',
        published: false,
        tags: ['a', 'b', 'c', 'd', 'e', 'f'],
      });
      assert.ok(capturedBody);
      assert.ok(capturedBody.article.tags.length <= 4);
    } finally {
      globalThis.fetch = originalFetch;
      config.platforms.devto.enabled = originalEnabled;
      config.platforms.devto.apiKey = originalKey;
    }
  });

  it('should return manualPost:true on HTTP error response', async () => {
    const originalFetch = globalThis.fetch;
    const originalEnabled = config.platforms.devto.enabled;
    const originalKey = config.platforms.devto.apiKey;

    config.platforms.devto.enabled = true;
    config.platforms.devto.apiKey = 'fake-key';
    globalThis.fetch = async () => ({
      ok: false,
      status: 422,
      text: async () => 'Unprocessable Entity',
    });

    try {
      const result = await post({ title: 'Test', body_markdown: 'Content', published: false, tags: [] });
      assert.equal(result.success, false);
      assert.equal(result.manualPost, true);
    } finally {
      globalThis.fetch = originalFetch;
      config.platforms.devto.enabled = originalEnabled;
      config.platforms.devto.apiKey = originalKey;
    }
  });

  it('should send api-key header in request', async () => {
    let capturedHeaders;
    const originalFetch = globalThis.fetch;
    const originalEnabled = config.platforms.devto.enabled;
    const originalKey = config.platforms.devto.apiKey;

    config.platforms.devto.enabled = true;
    config.platforms.devto.apiKey = 'my-devto-api-key';
    globalThis.fetch = async (url, opts) => {
      capturedHeaders = opts.headers;
      return { ok: true, json: async () => ({ url: 'https://dev.to/x', id: 1 }) };
    };

    try {
      await post({ title: 'T', body_markdown: 'B', published: false, tags: [] });
      assert.ok(capturedHeaders);
      assert.equal(capturedHeaders['api-key'], 'my-devto-api-key');
    } finally {
      globalThis.fetch = originalFetch;
      config.platforms.devto.enabled = originalEnabled;
      config.platforms.devto.apiKey = originalKey;
    }
  });
});
