// Tests — lib/content-gen.js
// Teste les fonctions d'adaptation de contenu (pure functions, sans réseau)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import des fonctions à tester
import {
  adaptForTwitter,
  adaptForReddit,
  adaptForLinkedIn,
  adaptForDiscord,
  adaptForTelegram,
  adaptForDevTo,
  adaptForHN,
  adaptForFarcaster,
} from '../lib/content-gen.js';

const MOCK_STATS = {
  totalServices: 69,
  totalCalls: 164,
  totalPayments: 96,
  uptimePercent: 99.8,
  recentCalls24h: 42,
  topEndpoints: [],
  monitoring: {},
  integrations: 6,
};

// ─── adaptForTwitter ─────────────────────────────────────────────
describe('adaptForTwitter', () => {
  it('should return a string', () => {
    const result = adaptForTwitter('Hello world', MOCK_STATS);
    assert.equal(typeof result, 'string');
  });

  it('should include hashtags', () => {
    const result = adaptForTwitter('Test content', MOCK_STATS);
    assert.ok(result.includes('#x402') || result.includes('#AI'));
  });

  it('should include project URL', () => {
    const result = adaptForTwitter('Test', MOCK_STATS);
    assert.ok(result.includes('https://'));
  });

  it('should truncate long content to respect 280 chars total', () => {
    const longContent = 'A'.repeat(400);
    const result = adaptForTwitter(longContent, MOCK_STATS);
    assert.ok(result.length <= 280, `Result length ${result.length} exceeds 280`);
  });

  it('should not truncate short content', () => {
    const shortContent = 'Short post';
    const result = adaptForTwitter(shortContent, MOCK_STATS);
    assert.ok(result.includes(shortContent));
  });

  it('should add ellipsis when truncating', () => {
    const longContent = 'A'.repeat(400);
    const result = adaptForTwitter(longContent, MOCK_STATS);
    assert.ok(result.includes('...'));
  });
});

// ─── adaptForReddit ───────────────────────────────────────────────
describe('adaptForReddit', () => {
  it('should return an object with subreddit, title, body', () => {
    const result = adaptForReddit('My Title', 'My Body', 'webdev');
    assert.equal(typeof result, 'object');
    assert.ok('subreddit' in result);
    assert.ok('title' in result);
    assert.ok('body' in result);
  });

  it('should set the correct subreddit', () => {
    const result = adaptForReddit('Title', 'Body', 'SideProject');
    assert.equal(result.subreddit, 'SideProject');
  });

  it('should truncate title to 300 chars max', () => {
    const longTitle = 'T'.repeat(500);
    const result = adaptForReddit(longTitle, 'Body', 'webdev');
    assert.ok(result.title.length <= 300);
  });

  it('should append attribution footer to body', () => {
    const result = adaptForReddit('Title', 'Body content', 'webdev');
    assert.ok(result.body.includes('x402 Bazaar'));
    assert.ok(result.body.includes('Body content'));
  });
});

// ─── adaptForLinkedIn ─────────────────────────────────────────────
describe('adaptForLinkedIn', () => {
  it('should return a string', () => {
    const result = adaptForLinkedIn('Great content', MOCK_STATS);
    assert.equal(typeof result, 'string');
  });

  it('should include total services count', () => {
    const result = adaptForLinkedIn('Content', MOCK_STATS);
    assert.ok(result.includes('69'));
  });

  it('should include hashtags', () => {
    const result = adaptForLinkedIn('Content', MOCK_STATS);
    assert.ok(result.includes('#'));
  });

  it('should include original content', () => {
    const result = adaptForLinkedIn('Unique content here', MOCK_STATS);
    assert.ok(result.includes('Unique content here'));
  });
});

// ─── adaptForDiscord ──────────────────────────────────────────────
describe('adaptForDiscord', () => {
  it('should return an object with embeds array', () => {
    const result = adaptForDiscord('Content', MOCK_STATS, null);
    assert.ok('embeds' in result);
    assert.ok(Array.isArray(result.embeds));
    assert.equal(result.embeds.length, 1);
  });

  it('should have orange color (0xFF9900)', () => {
    const result = adaptForDiscord('Content', MOCK_STATS, null);
    assert.equal(result.embeds[0].color, 0xFF9900);
  });

  it('should include fields for APIs, Uptime, Calls 24h', () => {
    const result = adaptForDiscord('Content', MOCK_STATS, null);
    const fieldNames = result.embeds[0].fields.map(f => f.name);
    assert.ok(fieldNames.includes('APIs'));
    assert.ok(fieldNames.includes('Uptime'));
    assert.ok(fieldNames.includes('Calls 24h'));
  });

  it('should include imageUrl in embed when provided', () => {
    const result = adaptForDiscord('Content', MOCK_STATS, 'https://example.com/img.png');
    assert.equal(result.embeds[0].image.url, 'https://example.com/img.png');
  });

  it('should not include image when imageUrl is null', () => {
    const result = adaptForDiscord('Content', MOCK_STATS, null);
    assert.equal(result.embeds[0].image, undefined);
  });

  it('should include timestamp in ISO format', () => {
    const result = adaptForDiscord('Content', MOCK_STATS, null);
    assert.ok(result.embeds[0].timestamp);
    assert.doesNotThrow(() => new Date(result.embeds[0].timestamp));
  });
});

// ─── adaptForTelegram ─────────────────────────────────────────────
describe('adaptForTelegram', () => {
  it('should return an object with text, imageUrl, parseMode', () => {
    const result = adaptForTelegram('Content', MOCK_STATS, null);
    assert.ok('text' in result);
    assert.ok('imageUrl' in result);
    assert.ok('parseMode' in result);
  });

  it('should use Markdown parseMode', () => {
    const result = adaptForTelegram('Content', MOCK_STATS, null);
    assert.equal(result.parseMode, 'Markdown');
  });

  it('should include total services in text', () => {
    const result = adaptForTelegram('Content', MOCK_STATS, null);
    assert.ok(result.text.includes('69'));
  });

  it('should include a clickable project link', () => {
    const result = adaptForTelegram('Content', MOCK_STATS, null);
    assert.ok(result.text.includes('x402bazaar.org'));
  });

  it('should pass through imageUrl', () => {
    const result = adaptForTelegram('Content', MOCK_STATS, 'https://img.example.com/x.png');
    assert.equal(result.imageUrl, 'https://img.example.com/x.png');
  });
});

// ─── adaptForDevTo ────────────────────────────────────────────────
describe('adaptForDevTo', () => {
  it('should return object with title, body_markdown, published, tags', () => {
    const result = adaptForDevTo('My Article', 'Body content');
    assert.ok('title' in result);
    assert.ok('body_markdown' in result);
    assert.ok('published' in result);
    assert.ok('tags' in result);
  });

  it('should default published to false (draft mode)', () => {
    const result = adaptForDevTo('Title', 'Body');
    assert.equal(result.published, false);
  });

  it('should respect max 4 tags', () => {
    const result = adaptForDevTo('Title', 'Body', ['a', 'b', 'c', 'd', 'e', 'f']);
    assert.ok(result.tags.length <= 4);
  });

  it('should include attribution footer in body_markdown', () => {
    const result = adaptForDevTo('Title', 'My body text');
    assert.ok(result.body_markdown.includes('My body text'));
    assert.ok(result.body_markdown.includes('x402 Bazaar'));
  });

  it('should use default tags when none provided', () => {
    const result = adaptForDevTo('Title', 'Body');
    assert.ok(Array.isArray(result.tags));
    assert.ok(result.tags.length > 0);
  });
});

// ─── adaptForHN ───────────────────────────────────────────────────
describe('adaptForHN', () => {
  it('should return object with title and url', () => {
    const result = adaptForHN('Show HN: My project');
    assert.ok('title' in result);
    assert.ok('url' in result);
  });

  it('should truncate title to 80 chars', () => {
    const longTitle = 'T'.repeat(150);
    const result = adaptForHN(longTitle);
    assert.ok(result.title.length <= 80);
  });

  it('should include project URL', () => {
    const result = adaptForHN('My Title');
    assert.ok(result.url.startsWith('https://'));
  });
});

// ─── adaptForFarcaster ───────────────────────────────────────────
describe('adaptForFarcaster', () => {
  it('should return a string', () => {
    const result = adaptForFarcaster('Short content');
    assert.equal(typeof result, 'string');
  });

  it('should include project URL', () => {
    const result = adaptForFarcaster('Content');
    assert.ok(result.includes('https://'));
  });

  it('should truncate to 320 chars max', () => {
    const longContent = 'A'.repeat(400);
    const result = adaptForFarcaster(longContent);
    assert.ok(result.length <= 320, `Result length ${result.length} exceeds 320`);
  });

  it('should add ellipsis when truncating', () => {
    const longContent = 'A'.repeat(400);
    const result = adaptForFarcaster(longContent);
    assert.ok(result.includes('...'));
  });

  it('should not truncate short content', () => {
    const result = adaptForFarcaster('Short content');
    assert.ok(result.includes('Short content'));
  });
});
