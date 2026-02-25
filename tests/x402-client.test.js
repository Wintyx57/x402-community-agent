// Tests — lib/x402-client.js
// Teste getSpending (pure), les erreurs de budget, et callFreeApi (avec mock fetch)
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// ─── getSpending ──────────────────────────────────────────────────
describe('getSpending — initial state', () => {
  let getSpending;

  before(async () => {
    const mod = await import('../lib/x402-client.js');
    getSpending = mod.getSpending;
  });

  it('should return an object with spent, remaining, payments', () => {
    const result = getSpending();
    assert.ok('spent' in result);
    assert.ok('remaining' in result);
    assert.ok('payments' in result);
  });

  it('should have spent as a number >= 0', () => {
    const result = getSpending();
    assert.equal(typeof result.spent, 'number');
    assert.ok(result.spent >= 0);
  });

  it('should have payments as an array', () => {
    const result = getSpending();
    assert.ok(Array.isArray(result.payments));
  });

  it('should have remaining + spent = maxBudget', async () => {
    const result = getSpending();
    const { config } = await import('../config.js');
    assert.ok(Math.abs((result.remaining + result.spent) - config.maxBudget) < 0.0001);
  });
});

// ─── callApi — budget guard ───────────────────────────────────────
describe('callApi — budget protection', () => {
  it('should throw when AGENT_PRIVATE_KEY is not set and 402 response is received', async () => {
    const { callApi } = await import('../lib/x402-client.js');

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      status: 402,
      json: async () => ({
        payment_details: {
          amount: '0.001',
          recipient: '0x1234567890123456789012345678901234567890',
        },
      }),
    });

    try {
      delete process.env.AGENT_PRIVATE_KEY;
      await assert.rejects(
        () => callApi('/api/test'),
        (err) => {
          assert.ok(err instanceof Error);
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ─── callFreeApi — parsing JSON ──────────────────────────────────
describe('callFreeApi — parsing response', () => {
  let callFreeApi;

  before(async () => {
    const mod = await import('../lib/x402-client.js');
    callFreeApi = mod.callFreeApi;
  });

  it('should return parsed JSON when response is valid JSON', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      text: async () => JSON.stringify({ services: 69, totalCalls: 164 }),
    });

    try {
      const result = await callFreeApi('/api/public-stats');
      assert.equal(result.services, 69);
      assert.equal(result.totalCalls, 164);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should return { response: text } when response is not JSON', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      text: async () => 'plain text response',
    });

    try {
      const result = await callFreeApi('/api/some-endpoint');
      assert.equal(result.response, 'plain text response');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should prepend serverUrl when endpoint does not start with http', async () => {
    const { config } = await import('../config.js');
    let capturedUrl;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      capturedUrl = url;
      return { text: async () => '{}' };
    };

    try {
      await callFreeApi('/api/stats');
      assert.ok(capturedUrl.startsWith(config.serverUrl));
      assert.ok(capturedUrl.includes('/api/stats'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should use full URL when endpoint starts with http', async () => {
    let capturedUrl;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      capturedUrl = url;
      return { text: async () => '{}' };
    };

    try {
      await callFreeApi('https://external.api.com/data');
      assert.equal(capturedUrl, 'https://external.api.com/data');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
