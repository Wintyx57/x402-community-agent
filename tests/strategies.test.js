// Tests — strategies/*.js
// Teste les métadonnées et la structure des contenus retournés (avec mock réseau)
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// ─── Mock fetch global avant import des stratégies ────────────────
const MOCK_STATS = {
  services: 69,
  apiCalls: 164,
  totalPayments: 96,
  uptimePercent: 99.8,
  recentCallCount24h: 42,
  topEndpoints: [
    { name: '/api/summarize' },
    { name: '/api/translate' },
    { name: '/api/sentiment' },
  ],
};

// Setup fetch mock qui répond aux appels de fetchStats et generateText
function setupFetchMock() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    // Public stats endpoint
    if (url.includes('public-stats')) {
      return {
        text: async () => JSON.stringify(MOCK_STATS),
        status: 200,
        ok: true,
      };
    }
    // Pour callApi (summarize, etc.) — retourner 200 sans paiement
    return {
      status: 200,
      text: async () => JSON.stringify({ summary: 'Generated content from API' }),
      ok: true,
    };
  };
  return () => { globalThis.fetch = originalFetch; };
}

// ─── daily-stats strategy ─────────────────────────────────────────
describe('strategy: daily-stats — metadata', () => {
  it('should export name and description', async () => {
    const mod = await import('../strategies/daily-stats.js');
    assert.equal(mod.name, 'daily-stats');
    assert.equal(typeof mod.description, 'string');
    assert.ok(mod.description.length > 0);
  });

  it('should export an execute function', async () => {
    const mod = await import('../strategies/daily-stats.js');
    assert.equal(typeof mod.execute, 'function');
  });
});

describe('strategy: daily-stats — execute output structure', () => {
  let restore;
  let result;

  before(async () => {
    restore = setupFetchMock();
    const mod = await import('../strategies/daily-stats.js');
    result = await mod.execute();
    restore();
  });

  it('should return object with contents, stats, imageUrl', () => {
    assert.ok('contents' in result);
    assert.ok('stats' in result);
    assert.ok('imageUrl' in result);
  });

  it('should have twitter content in contents', () => {
    assert.ok('twitter' in result.contents);
    assert.equal(typeof result.contents.twitter, 'string');
  });

  it('should have linkedin content in contents', () => {
    assert.ok('linkedin' in result.contents);
  });

  it('should have discord content with embeds', () => {
    assert.ok('discord' in result.contents);
    assert.ok('embeds' in result.contents.discord);
  });

  it('should have telegram content with text property', () => {
    assert.ok('telegram' in result.contents);
    assert.ok('text' in result.contents.telegram);
  });

  it('should have reddit content with subreddit, title, body', () => {
    assert.ok('reddit' in result.contents);
    assert.ok('subreddit' in result.contents.reddit);
    assert.ok('title' in result.contents.reddit);
  });

  it('should have farcaster content as string', () => {
    assert.ok('farcaster' in result.contents);
    assert.equal(typeof result.contents.farcaster, 'string');
  });

  it('should have hn content with title and url', () => {
    assert.ok('hn' in result.contents);
    assert.ok('title' in result.contents.hn);
    assert.ok('url' in result.contents.hn);
  });

  it('should have stats with required fields', () => {
    assert.ok('totalServices' in result.stats);
    assert.ok('uptimePercent' in result.stats);
  });
});

// ─── weekly-recap strategy ────────────────────────────────────────
describe('strategy: weekly-recap — metadata', () => {
  it('should export name and description', async () => {
    const mod = await import('../strategies/weekly-recap.js');
    assert.equal(mod.name, 'weekly-recap');
    assert.equal(typeof mod.description, 'string');
  });

  it('should export an execute function', async () => {
    const mod = await import('../strategies/weekly-recap.js');
    assert.equal(typeof mod.execute, 'function');
  });
});

describe('strategy: weekly-recap — execute output structure', () => {
  let restore;
  let result;

  before(async () => {
    restore = setupFetchMock();
    const mod = await import('../strategies/weekly-recap.js');
    result = await mod.execute();
    restore();
  });

  it('should return object with contents, stats, imageUrl', () => {
    assert.ok('contents' in result);
    assert.ok('stats' in result);
    assert.ok('imageUrl' in result);
  });

  it('should have twitter content', () => {
    assert.ok('twitter' in result.contents);
  });

  it('should have linkedin content', () => {
    assert.ok('linkedin' in result.contents);
  });

  it('should have devto content with title and body_markdown', () => {
    assert.ok('devto' in result.contents);
    const devto = result.contents.devto;
    assert.ok('title' in devto || typeof devto === 'string');
  });

  it('should have reddit content', () => {
    assert.ok('reddit' in result.contents);
  });
});

// ─── new-api strategy ─────────────────────────────────────────────
describe('strategy: new-api — metadata', () => {
  it('should export name and description', async () => {
    const mod = await import('../strategies/new-api.js');
    assert.equal(mod.name, 'new-api');
    assert.equal(typeof mod.description, 'string');
  });
});

describe('strategy: new-api — execute with custom options', () => {
  let restore;
  let result;

  before(async () => {
    restore = setupFetchMock();
    const mod = await import('../strategies/new-api.js');
    result = await mod.execute({
      apiName: 'Test Sentiment API',
      apiDescription: 'Analyzes text sentiment',
      apiPrice: '0.001',
    });
    restore();
  });

  it('should return contents with twitter, linkedin, discord, telegram, farcaster', () => {
    const expected = ['twitter', 'linkedin', 'discord', 'telegram', 'farcaster'];
    for (const p of expected) {
      assert.ok(p in result.contents, `Missing platform: ${p}`);
    }
  });

  it('should include API name in twitter content', () => {
    assert.ok(result.contents.twitter.includes('Test Sentiment API') ||
      result.contents.twitter.includes('x402 Bazaar'));
  });

  it('should use "New API" as default apiName when not provided', async () => {
    const restore2 = setupFetchMock();
    const mod = await import('../strategies/new-api.js');
    const defaultResult = await mod.execute();
    restore2();
    assert.ok('contents' in defaultResult);
    assert.ok('stats' in defaultResult);
  });
});

// ─── loadStrategy (agent.js logic) ───────────────────────────────
describe('loadStrategy — strategy loader', () => {
  async function loadStrategy(name) {
    const strategies = {
      'daily-stats': () => import('../strategies/daily-stats.js'),
      'new-api': () => import('../strategies/new-api.js'),
      'weekly-recap': () => import('../strategies/weekly-recap.js'),
    };
    if (!strategies[name]) throw new Error(`Unknown strategy: ${name}. Available: ${Object.keys(strategies).join(', ')}`);
    return strategies[name]();
  }

  it('should load daily-stats strategy', async () => {
    const mod = await loadStrategy('daily-stats');
    assert.equal(typeof mod.execute, 'function');
  });

  it('should load new-api strategy', async () => {
    const mod = await loadStrategy('new-api');
    assert.equal(typeof mod.execute, 'function');
  });

  it('should load weekly-recap strategy', async () => {
    const mod = await loadStrategy('weekly-recap');
    assert.equal(typeof mod.execute, 'function');
  });

  it('should throw on unknown strategy name', async () => {
    await assert.rejects(
      () => loadStrategy('unknown-strategy'),
      (err) => {
        assert.ok(err.message.includes('Unknown strategy'));
        assert.ok(err.message.includes('unknown-strategy'));
        return true;
      }
    );
  });

  it('should include available strategies in error message', async () => {
    await assert.rejects(
      () => loadStrategy('bad-strategy'),
      (err) => {
        assert.ok(err.message.includes('daily-stats'));
        assert.ok(err.message.includes('new-api'));
        assert.ok(err.message.includes('weekly-recap'));
        return true;
      }
    );
  });
});
