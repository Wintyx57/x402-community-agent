// Tests — fonctions utilitaires extraites de dashboard.js
// On teste les logiques pures: sanitizeConfigForFrontend, mergeSettings,
// createQueueItem, isRedacted, getNextScheduledPost, addLog structure
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── isRedacted (logique inline) ─────────────────────────────────
describe('isRedacted — detection of redacted sentinel values', () => {
  function isRedacted(val) {
    if (typeof val !== 'string') return false;
    return val === '___KEEP___' || val.startsWith('***') || val === '*** (redacted)';
  }

  it('should detect ___KEEP___', () => {
    assert.equal(isRedacted('___KEEP___'), true);
  });

  it('should detect *** prefix', () => {
    assert.equal(isRedacted('*** hidden ***'), true);
  });

  it('should detect *** (redacted)', () => {
    assert.equal(isRedacted('*** (redacted)'), true);
  });

  it('should not flag normal strings', () => {
    assert.equal(isRedacted('my-actual-token'), false);
    assert.equal(isRedacted(''), false);
    assert.equal(isRedacted('some-api-key-123'), false);
  });

  it('should not flag non-strings', () => {
    assert.equal(isRedacted(null), false);
    assert.equal(isRedacted(undefined), false);
    assert.equal(isRedacted(42), false);
    assert.equal(isRedacted(true), false);
  });
});

// ─── mergeSettings ────────────────────────────────────────────────
describe('mergeSettings — preserve credentials when redacted', () => {
  function isRedacted(val) {
    if (typeof val !== 'string') return false;
    return val === '___KEEP___' || val.startsWith('***') || val === '*** (redacted)';
  }

  function mergeSettings(existing, incoming) {
    const merged = JSON.parse(JSON.stringify(incoming));
    if (isRedacted(merged.wallet?.privateKey)) {
      merged.wallet.privateKey = existing.wallet?.privateKey || '';
    }
    if (merged.platforms && existing.platforms) {
      for (const [name, platCfg] of Object.entries(merged.platforms)) {
        const ex = existing.platforms[name];
        if (!ex) continue;
        for (const [key, val] of Object.entries(platCfg)) {
          if (isRedacted(val)) {
            merged.platforms[name][key] = ex[key] || '';
          }
        }
      }
    }
    return merged;
  }

  it('should preserve existing privateKey when incoming has ___KEEP___', () => {
    const existing = { wallet: { privateKey: 'real-private-key' }, platforms: {} };
    const incoming = { wallet: { privateKey: '___KEEP___' }, platforms: {} };
    const result = mergeSettings(existing, incoming);
    assert.equal(result.wallet.privateKey, 'real-private-key');
  });

  it('should update privateKey when incoming has real value', () => {
    const existing = { wallet: { privateKey: 'old-key' }, platforms: {} };
    const incoming = { wallet: { privateKey: 'new-real-key' }, platforms: {} };
    const result = mergeSettings(existing, incoming);
    assert.equal(result.wallet.privateKey, 'new-real-key');
  });

  it('should preserve platform secrets when redacted', () => {
    const existing = {
      wallet: {},
      platforms: {
        telegram: { botToken: 'real-bot-token', enabled: true },
      },
    };
    const incoming = {
      wallet: {},
      platforms: {
        telegram: { botToken: '*** (redacted)', enabled: false },
      },
    };
    const result = mergeSettings(existing, incoming);
    assert.equal(result.platforms.telegram.botToken, 'real-bot-token');
    assert.equal(result.platforms.telegram.enabled, false);
  });

  it('should update platform secrets when not redacted', () => {
    const existing = {
      wallet: {},
      platforms: {
        discord: { webhookUrl: 'old-url', enabled: false },
      },
    };
    const incoming = {
      wallet: {},
      platforms: {
        discord: { webhookUrl: 'https://discord.com/api/webhooks/new', enabled: true },
      },
    };
    const result = mergeSettings(existing, incoming);
    assert.equal(result.platforms.discord.webhookUrl, 'https://discord.com/api/webhooks/new');
  });
});

// ─── sanitizeConfigForFrontend ────────────────────────────────────
describe('sanitizeConfigForFrontend — strip sensitive credentials', () => {
  const SENSITIVE_KEYS = new Set([
    'privateKey', 'botToken', 'apiKey', 'apiSecret',
    'accessToken', 'accessSecret', 'clientId', 'clientSecret',
    'password', 'mnemonic', 'webhookUrl',
  ]);

  function sanitizeConfigForFrontend(settings) {
    const safe = JSON.parse(JSON.stringify(settings));
    if (safe.wallet) {
      safe.wallet.privateKey = undefined;
      safe.wallet.configured = !!settings.wallet.privateKey;
    }
    if (safe.platforms) {
      Object.keys(safe.platforms).forEach(platform => {
        const p = safe.platforms[platform];
        for (const key of SENSITIVE_KEYS) {
          if (key in p) {
            p[key] = undefined;
          }
        }
        p.configured = !!(settings.platforms[platform].botToken
          || settings.platforms[platform].apiKey
          || settings.platforms[platform].accessToken
          || settings.platforms[platform].webhookUrl
          || settings.platforms[platform].mnemonic
          || settings.platforms[platform].clientId);
      });
    }
    return safe;
  }

  it('should remove privateKey from wallet', () => {
    const settings = {
      wallet: { privateKey: '0xsecretkey123', maxBudget: 0.5 },
      platforms: {},
    };
    const safe = sanitizeConfigForFrontend(settings);
    assert.equal(safe.wallet.privateKey, undefined);
  });

  it('should set wallet.configured=true when privateKey is set', () => {
    const settings = {
      wallet: { privateKey: '0xsecretkey', maxBudget: 0.5 },
      platforms: {},
    };
    const safe = sanitizeConfigForFrontend(settings);
    assert.equal(safe.wallet.configured, true);
  });

  it('should set wallet.configured=false when privateKey is empty', () => {
    const settings = {
      wallet: { privateKey: '', maxBudget: 0.5 },
      platforms: {},
    };
    const safe = sanitizeConfigForFrontend(settings);
    assert.equal(safe.wallet.configured, false);
  });

  it('should strip botToken from telegram platform', () => {
    const settings = {
      wallet: { privateKey: '' },
      platforms: {
        telegram: { botToken: 'secret-bot-token', enabled: true, adminChatId: '12345' },
      },
    };
    const safe = sanitizeConfigForFrontend(settings);
    assert.equal(safe.platforms.telegram.botToken, undefined);
  });

  it('should set platform.configured=true when botToken is set', () => {
    const settings = {
      wallet: { privateKey: '' },
      platforms: {
        telegram: { botToken: 'real-token', enabled: true },
      },
    };
    const safe = sanitizeConfigForFrontend(settings);
    assert.equal(safe.platforms.telegram.configured, true);
  });

  it('should strip webhookUrl from discord platform', () => {
    const settings = {
      wallet: { privateKey: '' },
      platforms: {
        discord: { webhookUrl: 'https://discord.com/api/webhooks/secret', enabled: true },
      },
    };
    const safe = sanitizeConfigForFrontend(settings);
    assert.equal(safe.platforms.discord.webhookUrl, undefined);
    assert.equal(safe.platforms.discord.configured, true);
  });

  it('should not mutate original settings object', () => {
    const settings = {
      wallet: { privateKey: 'original-key', maxBudget: 0.5 },
      platforms: {
        telegram: { botToken: 'original-token', enabled: true },
      },
    };
    sanitizeConfigForFrontend(settings);
    assert.equal(settings.wallet.privateKey, 'original-key');
    assert.equal(settings.platforms.telegram.botToken, 'original-token');
  });
});

// ─── createQueueItem ──────────────────────────────────────────────
import crypto from 'node:crypto';

describe('createQueueItem — queue item structure', () => {
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
      error: null,
    };
  }

  const mockPreview = {
    contents: { twitter: 'Test tweet', discord: { embeds: [] } },
    stats: { totalServices: 69 },
    imageUrl: null,
  };

  it('should have a valid UUID as id', () => {
    const item = createQueueItem('daily-stats', mockPreview, ['discord'], false);
    assert.match(item.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('should set status to awaiting_approval when autoPublish=false', () => {
    const item = createQueueItem('daily-stats', mockPreview, ['discord'], false);
    assert.equal(item.status, 'awaiting_approval');
  });

  it('should set status to pending when autoPublish=true', () => {
    const item = createQueueItem('daily-stats', mockPreview, ['discord'], true);
    assert.equal(item.status, 'pending');
  });

  it('should have retryCount=0 initially', () => {
    const item = createQueueItem('daily-stats', mockPreview, [], false);
    assert.equal(item.retryCount, 0);
  });

  it('should copy strategy name', () => {
    const item = createQueueItem('weekly-recap', mockPreview, [], false);
    assert.equal(item.strategy, 'weekly-recap');
  });

  it('should copy platforms array', () => {
    const platforms = ['discord', 'telegram'];
    const item = createQueueItem('daily-stats', mockPreview, platforms, false);
    assert.deepEqual(item.platforms, platforms);
  });

  it('should have empty results object', () => {
    const item = createQueueItem('daily-stats', mockPreview, [], false);
    assert.deepEqual(item.results, {});
  });

  it('should set imageUrl to null when not provided', () => {
    const preview = { contents: {}, stats: {}, imageUrl: undefined };
    const item = createQueueItem('daily-stats', preview, [], false);
    assert.equal(item.imageUrl, null);
  });

  it('should have valid ISO createdAt', () => {
    const item = createQueueItem('daily-stats', mockPreview, [], false);
    assert.doesNotThrow(() => new Date(item.createdAt));
    assert.ok(new Date(item.createdAt).getTime() > 0);
  });
});

// ─── addLog structure ─────────────────────────────────────────────
describe('addLog — log entry structure', () => {
  function addLog(logs, level, msg) {
    const entry = { time: new Date().toISOString(), level, msg };
    logs.push(entry);
    if (logs.length > 200) logs.shift();
    return entry;
  }

  it('should create entry with time, level, msg', () => {
    const logs = [];
    const entry = addLog(logs, 'info', 'Test message');
    assert.ok('time' in entry);
    assert.ok('level' in entry);
    assert.ok('msg' in entry);
  });

  it('should have valid ISO time', () => {
    const logs = [];
    const entry = addLog(logs, 'info', 'Test');
    assert.doesNotThrow(() => new Date(entry.time));
  });

  it('should add entry to logs array', () => {
    const logs = [];
    addLog(logs, 'info', 'msg1');
    addLog(logs, 'error', 'msg2');
    assert.equal(logs.length, 2);
  });

  it('should evict oldest when logs exceed 200 entries', () => {
    const logs = [];
    for (let i = 0; i < 201; i++) {
      addLog(logs, 'info', `msg ${i}`);
    }
    assert.equal(logs.length, 200);
    assert.equal(logs[0].msg, 'msg 1'); // msg 0 was evicted
  });
});
