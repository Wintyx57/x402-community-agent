// Content generation pipeline — uses x402 APIs
import { callApi, callFreeApi } from './x402-client.js';
import { config } from '../config.js';

function log(msg) {
  console.log(`[content-gen] ${msg}`);
}

// Fetch live platform stats
export async function fetchStats() {
  log('Fetching platform stats...');
  const stats = await callFreeApi('/api/public-stats');
  return {
    totalServices: stats.services || stats.nativeEndpoints || stats.totalServices || 0,
    totalCalls: stats.apiCalls || stats.totalCalls || 0,
    totalPayments: stats.totalPayments || 0,
    uptimePercent: stats.uptimePercent || 0,
    recentCalls24h: stats.recentCallCount24h || 0,
    topEndpoints: stats.topEndpoints || [],
    monitoring: stats.monitoring || {},
    integrations: stats.integrations || 0,
    tests: stats.tests || 0,
  };
}

// Generate text content using /api/summarize (with local fallback)
export async function generateText(prompt, maxLength = 500) {
  if (!process.env.AGENT_PRIVATE_KEY) {
    log('No wallet — using local content generation');
    return prompt.slice(0, maxLength);
  }
  try {
    log(`Generating text (max ${maxLength} chars)...`);
    const result = await callApi(`/api/summarize?text=${encodeURIComponent(prompt)}&max_length=${maxLength}`);
    return result.summary || result.result || result.response || prompt;
  } catch (err) {
    log(`API call failed: ${err.message} — using fallback`);
    return prompt.slice(0, maxLength);
  }
}

// Translate text using /api/translate
export async function translateText(text, targetLang = 'fr') {
  if (!process.env.AGENT_PRIVATE_KEY) { log('No wallet — skipping translate'); return text; }
  try {
    log(`Translating to ${targetLang}...`);
    const result = await callApi(`/api/translate?text=${encodeURIComponent(text)}&to=${targetLang}`);
    return result.translated || result.result || result.response || text;
  } catch (err) { log(`Translate failed: ${err.message}`); return text; }
}

// Generate image using /api/image (DALL-E 3)
export async function generateImage(prompt) {
  if (!config.generateImages) return null;
  if (!process.env.AGENT_PRIVATE_KEY) { log('No wallet — skipping image gen'); return null; }
  try {
    log('Generating image...');
    const result = await callApi(`/api/image?prompt=${encodeURIComponent(prompt)}&size=1024x1024`);
    return result.url || result.image_url || result.data?.[0]?.url || null;
  } catch (err) { log(`Image gen failed: ${err.message}`); return null; }
}

// Analyze sentiment of text
export async function analyzeSentiment(text) {
  if (!process.env.AGENT_PRIVATE_KEY) return 'neutral';
  try {
    const result = await callApi(`/api/sentiment?text=${encodeURIComponent(text)}`);
    return result.sentiment || result.result || 'neutral';
  } catch { return 'neutral'; }
}

// Search for trending topics
export async function searchTrending(query) {
  if (!process.env.AGENT_PRIVATE_KEY) return [];
  try {
    log(`Searching: ${query}`);
    const result = await callApi(`/api/search?q=${encodeURIComponent(query)}`);
    return result.results || result.data || [];
  } catch { return []; }
}

// Get latest news
export async function getNews(query) {
  if (!process.env.AGENT_PRIVATE_KEY) return [];
  try {
    log(`Fetching news: ${query}`);
    const result = await callApi(`/api/news?q=${encodeURIComponent(query)}`);
    return result.articles || result.results || result.data || [];
  } catch { return []; }
}

// ─── Content Adaptation per Platform ──────────────────────────────────

export function adaptForTwitter(content, stats) {
  const hashtags = '#x402 #AI #APIMarketplace #Web3 #USDC';
  const link = config.projectUrl;
  // Max 280 chars including link and hashtags
  const available = 280 - hashtags.length - link.length - 4; // 4 = spaces + newlines
  const text = content.length > available ? content.slice(0, available - 3) + '...' : content;
  return `${text}\n\n${link}\n${hashtags}`;
}

export function adaptForReddit(title, body, subreddit) {
  return {
    subreddit,
    title: title.slice(0, 300),
    body: `${body}\n\n---\n*Posted by x402 Bazaar Community Agent | [x402bazaar.org](${config.projectUrl})*`,
  };
}

export function adaptForLinkedIn(content, stats) {
  return `${content}\n\n` +
    `${stats.totalServices} APIs | ${stats.uptimePercent}% uptime | Pay-per-call USDC\n\n` +
    `${config.projectUrl}\n\n` +
    `#AIAgents #APIMarketplace #Web3 #x402Protocol #USDC #DeFi`;
}

export function adaptForDiscord(content, stats, imageUrl) {
  return {
    embeds: [{
      title: `${config.projectName} — Daily Update`,
      description: content,
      color: 0xFF9900,
      fields: [
        { name: 'APIs', value: `${stats.totalServices}`, inline: true },
        { name: 'Uptime', value: `${stats.uptimePercent}%`, inline: true },
        { name: 'Calls 24h', value: `${stats.recentCalls24h}`, inline: true },
      ],
      image: imageUrl ? { url: imageUrl } : undefined,
      footer: { text: `x402 Bazaar | ${config.projectUrl}` },
      timestamp: new Date().toISOString(),
    }],
  };
}

export function adaptForTelegram(content, stats, imageUrl) {
  let msg = `*${config.projectName} Update*\n\n${content}\n\n`;
  msg += `APIs: ${stats.totalServices} | Uptime: ${stats.uptimePercent}%\n`;
  msg += `Calls 24h: ${stats.recentCalls24h}\n\n`;
  msg += `[x402bazaar.org](${config.projectUrl})`;
  return { text: msg, imageUrl, parseMode: 'Markdown' };
}

export function adaptForDevTo(title, body, tags = ['ai', 'webdev', 'api', 'blockchain']) {
  return {
    title,
    body_markdown: body + `\n\n---\n\n*Published by [x402 Bazaar](${config.projectUrl}) Community Agent*`,
    published: false, // Draft by default — user reviews before publishing
    tags: tags.slice(0, 4),
  };
}

export function adaptForHN(title) {
  return {
    title: title.slice(0, 80),
    url: config.projectUrl,
  };
}

export function adaptForFarcaster(content) {
  const link = config.projectUrl;
  const available = 320 - link.length - 2;
  const text = content.length > available ? content.slice(0, available - 3) + '...' : content;
  return `${text}\n${link}`;
}
