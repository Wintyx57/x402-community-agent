// Tests — fonctions testPlatform* de dashboard.js
// Ces fonctions testent la connexion aux plateformes
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── testTelegram ─────────────────────────────────────────────────
describe('testTelegram', () => {
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

  it('should return error when botToken is missing', async () => {
    const result = await testTelegram({ botToken: '' });
    assert.equal(result.success, false);
    assert.ok(result.message.toLowerCase().includes('bot token'));
  });

  it('should return success when Telegram API responds ok:true', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      json: async () => ({ ok: true, result: { username: 'x402_bot' } }),
    });
    try {
      const result = await testTelegram({ botToken: 'fake-token' });
      assert.equal(result.success, true);
      assert.ok(result.message.includes('@x402_bot'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should return failure when Telegram API responds ok:false', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      json: async () => ({ ok: false, description: 'Unauthorized' }),
    });
    try {
      const result = await testTelegram({ botToken: 'bad-token' });
      assert.equal(result.success, false);
      assert.ok(result.message.includes('Unauthorized'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should return failure on network error', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('Network unreachable'); };
    try {
      const result = await testTelegram({ botToken: 'any-token' });
      assert.equal(result.success, false);
      assert.ok(result.message.includes('Network unreachable'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ─── testDiscord ──────────────────────────────────────────────────
describe('testDiscord', () => {
  async function testDiscord(cfg) {
    if (!cfg.webhookUrl) return { success: false, message: 'Webhook URL not configured' };
    try {
      const res = await fetch(cfg.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [{ title: 'x402 Community Agent - Test', description: 'Connection test successful', color: 0x00ff00 }] }),
      });
      if (res.ok || res.status === 204) {
        return { success: true, message: 'Test message sent' };
      }
      return { success: false, message: `HTTP ${res.status}` };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  it('should return error when webhookUrl is empty', async () => {
    const result = await testDiscord({ webhookUrl: '' });
    assert.equal(result.success, false);
    assert.ok(result.message.toLowerCase().includes('webhook'));
  });

  it('should return success on 204 response', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: false, status: 204 });
    try {
      const result = await testDiscord({ webhookUrl: 'https://discord.com/api/webhooks/fake/hook' });
      assert.equal(result.success, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should return success on 200 response', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: true, status: 200 });
    try {
      const result = await testDiscord({ webhookUrl: 'https://discord.com/api/webhooks/fake/hook' });
      assert.equal(result.success, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should return failure on 403 response', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: false, status: 403 });
    try {
      const result = await testDiscord({ webhookUrl: 'https://discord.com/api/webhooks/fake/hook' });
      assert.equal(result.success, false);
      assert.ok(result.message.includes('403'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ─── testTwitter ──────────────────────────────────────────────────
describe('testTwitter', () => {
  async function testTwitter(cfg) {
    if (!cfg.apiKey || !cfg.apiSecret) {
      return { success: false, message: 'API keys not configured' };
    }
    if (cfg.accessToken && cfg.accessSecret) {
      return { success: true, message: 'API keys configured (posting requires live test)' };
    }
    return { success: false, message: 'Access tokens not configured' };
  }

  it('should return error when apiKey is missing', async () => {
    const result = await testTwitter({ apiKey: '', apiSecret: 'secret' });
    assert.equal(result.success, false);
    assert.ok(result.message.toLowerCase().includes('api keys'));
  });

  it('should return error when apiSecret is missing', async () => {
    const result = await testTwitter({ apiKey: 'key', apiSecret: '' });
    assert.equal(result.success, false);
  });

  it('should return error when access tokens are missing', async () => {
    const result = await testTwitter({ apiKey: 'key', apiSecret: 'secret', accessToken: '', accessSecret: '' });
    assert.equal(result.success, false);
    assert.ok(result.message.toLowerCase().includes('access tokens'));
  });

  it('should return success when all keys are configured', async () => {
    const result = await testTwitter({
      apiKey: 'key', apiSecret: 'secret',
      accessToken: 'token', accessSecret: 'access-secret',
    });
    assert.equal(result.success, true);
  });
});

// ─── testFarcaster ────────────────────────────────────────────────
describe('testFarcaster', () => {
  async function testFarcaster(cfg) {
    if (!cfg.mnemonic) return { success: false, message: 'Mnemonic not configured' };
    const words = cfg.mnemonic.trim().split(/\s+/);
    if (words.length === 12 || words.length === 24) {
      return { success: true, message: `Mnemonic configured (${words.length} words)` };
    }
    return { success: false, message: 'Invalid mnemonic format' };
  }

  it('should return error when mnemonic is missing', async () => {
    const result = await testFarcaster({ mnemonic: '' });
    assert.equal(result.success, false);
    assert.ok(result.message.toLowerCase().includes('mnemonic'));
  });

  it('should return success for 12-word mnemonic', async () => {
    const mnemonic12 = Array(12).fill('word').join(' ');
    const result = await testFarcaster({ mnemonic: mnemonic12 });
    assert.equal(result.success, true);
    assert.ok(result.message.includes('12 words'));
  });

  it('should return success for 24-word mnemonic', async () => {
    const mnemonic24 = Array(24).fill('word').join(' ');
    const result = await testFarcaster({ mnemonic: mnemonic24 });
    assert.equal(result.success, true);
    assert.ok(result.message.includes('24 words'));
  });

  it('should return failure for invalid word count (e.g. 5 words)', async () => {
    const result = await testFarcaster({ mnemonic: 'one two three four five' });
    assert.equal(result.success, false);
    assert.ok(result.message.toLowerCase().includes('invalid'));
  });
});

// ─── testDevTo ────────────────────────────────────────────────────
describe('testDevTo', () => {
  async function testDevTo(cfg) {
    if (!cfg.apiKey) return { success: false, message: 'API key not configured' };
    try {
      const res = await fetch('https://dev.to/api/users/me', {
        headers: { 'api-key': cfg.apiKey },
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

  it('should return error when apiKey is missing', async () => {
    const result = await testDevTo({ apiKey: '' });
    assert.equal(result.success, false);
    assert.ok(result.message.toLowerCase().includes('api key'));
  });

  it('should return success when Dev.to responds with user data', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ username: 'x402bazaar', name: 'x402 Bazaar' }),
    });
    try {
      const result = await testDevTo({ apiKey: 'valid-key' });
      assert.equal(result.success, true);
      assert.ok(result.message.includes('@x402bazaar'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should return failure on 401 unauthorized', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: false, status: 401 });
    try {
      const result = await testDevTo({ apiKey: 'bad-key' });
      assert.equal(result.success, false);
      assert.ok(result.message.includes('401'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
