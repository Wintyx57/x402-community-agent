// Content generation pipeline — uses x402 APIs
import { callApi, callFreeApi } from './x402-client.js';
import { config } from '../config.js';

function log(msg) {
  console.log(`[content-gen] ${msg}`);
}

// ─── Viral Hook Templates ──────────────────────────────────────────────

const HOOK_TEMPLATES = {
  question: [
    'What if your AI agent could pay for its own API calls?',
    'Why are developers still paying for APIs they never use?',
    'What happens when AI agents become autonomous economic actors?',
    'Did you know {stat}?',
    'What if every AI agent had its own wallet?',
  ],
  stat: [
    '{totalCalls} API calls — all paid automatically by AI agents.',
    '{totalServices} APIs available. Zero subscriptions. Pay only what you use.',
    '{uptimePercent}% uptime. {totalCalls} calls served. $0 monthly fee.',
    'From 0 to {totalPayments} on-chain payments — autonomous AI agents did it.',
  ],
  counterintuitive: [
    'Subscriptions are killing AI agent economics. Here\'s a better model.',
    'The best API marketplace isn\'t the one with the most APIs.',
    'AI agents don\'t need your credit card. They need USDC.',
    'The x402 protocol turns every HTTP 402 into a micro-economy.',
    'Free-tier APIs are a trap for production AI agents.',
  ],
  story: [
    'I built a marketplace where AI agents pay each other. Here\'s what happened:',
    'Three months ago this was a hackathon project. Now it\'s processing real money.',
    'The HTTP 402 status code was created in 1996 for this exact use case.',
    'An AI agent walked into a marketplace. It left with results, not a bill.',
  ],
};

/**
 * Add a viral hook to the start of content.
 * @param {string} content - Original content
 * @param {'question'|'stat'|'counterintuitive'|'story'} hookType - Hook style
 * @param {object} stats - Platform stats for interpolation
 * @returns {string} Content with hook prepended
 */
export function addHook(content, hookType = 'question', stats = {}) {
  const templates = HOOK_TEMPLATES[hookType] || HOOK_TEMPLATES.question;
  const template = templates[Math.floor(Math.random() * templates.length)];
  const hook = template
    .replace('{totalCalls}', stats.totalCalls?.toLocaleString() || '10k+')
    .replace('{totalServices}', stats.totalServices || '69')
    .replace('{uptimePercent}', stats.uptimePercent || '99.9')
    .replace('{totalPayments}', stats.totalPayments?.toLocaleString() || '100+')
    .replace('{stat}', `${stats.totalCalls?.toLocaleString() || '10k+'} API calls were paid autonomously by AI agents`);

  return `${hook}\n\n${content}`;
}

// ─── Call-To-Action Templates ──────────────────────────────────────────

const CTA_TEMPLATES = {
  twitter: [
    `Try it free → ${config.projectUrl}`,
    `Build your first paying agent → ${config.projectUrl}`,
    `Join ${config.projectUrl} — no subscription needed`,
  ],
  reddit: [
    `Full docs at ${config.projectUrl} — happy to answer questions in comments.`,
    `Open to feedback — we're pre-launch and iterating fast. ${config.projectUrl}`,
    `Try it yourself: ${config.projectUrl} — all APIs pay-per-call, no key needed.`,
  ],
  linkedin: [
    `Follow for more on autonomous AI agents and the future of API economics.\n${config.projectUrl}`,
    `DM me if you're building AI agents — happy to help you get started.\n${config.projectUrl}`,
    `What's your take on autonomous agent payments? Drop a comment below.\n${config.projectUrl}`,
  ],
  discord: [
    `Check it out: ${config.projectUrl}`,
    `Docs + quickstart: ${config.projectUrl}`,
  ],
  telegram: [
    `[Try x402 Bazaar](${config.projectUrl})`,
    `[Quickstart guide](${config.projectUrl}/quickstart)`,
  ],
  devto: [
    `Try the live marketplace at [x402bazaar.org](${config.projectUrl}) — all APIs are pay-per-call with USDC.`,
    `Full source code and docs at [x402bazaar.org](${config.projectUrl}).`,
  ],
  farcaster: [
    `${config.projectUrl}`,
    `Try it → ${config.projectUrl}`,
  ],
  default: [
    `Learn more: ${config.projectUrl}`,
    `${config.projectUrl}`,
  ],
};

/**
 * Add a platform-appropriate call-to-action to content.
 * @param {string} content - Content to append CTA to
 * @param {string} platform - Target platform key
 * @returns {string} Content with CTA appended
 */
export function addCTA(content, platform = 'default') {
  const ctas = CTA_TEMPLATES[platform] || CTA_TEMPLATES.default;
  const cta = ctas[Math.floor(Math.random() * ctas.length)];
  return `${content}\n\n${cta}`;
}

// ─── Viral Hashtags ────────────────────────────────────────────────────

const HASHTAG_SETS = {
  twitter: {
    core: ['#x402', '#AIAgents', '#Web3', '#USDC', '#BuildInPublic'],
    ai: ['#LLM', '#MachineLearning', '#GenerativeAI', '#AgentAI', '#AITools'],
    dev: ['#API', '#DevTools', '#OpenSource', '#NodeJS', '#TypeScript'],
    web3: ['#DeFi', '#Base', '#OnchainSummer', '#Crypto', '#Blockchain'],
    growth: ['#IndieHacker', '#SideProject', '#Startup', '#ProductHunt', '#MakerLog'],
  },
  linkedin: {
    core: ['#AIAgents', '#ArtificialIntelligence', '#Web3', '#USDC', '#x402Protocol'],
    industry: ['#DigitalTransformation', '#Innovation', '#FutureOfWork', '#TechStartup'],
    dev: ['#SoftwareDevelopment', '#API', '#OpenSource', '#ProductLaunch'],
  },
  devto: {
    core: ['ai', 'webdev', 'api', 'blockchain'],
    dev: ['javascript', 'nodejs', 'typescript', 'opensource'],
    ai: ['machinelearning', 'llm', 'agents', 'automation'],
    web3: ['web3', 'crypto', 'usdc', 'defi'],
  },
  instagram: {
    core: ['#x402', '#AIAgents', '#Web3', '#Crypto', '#BuildInPublic'],
    tech: ['#Tech', '#Coding', '#Developer', '#API', '#Blockchain'],
  },
  farcaster: {
    core: ['/x402', 'aiagents', 'web3', 'usdc', 'buildwithbase'],
  },
};

/**
 * Get viral hashtags for a platform and optional topic.
 * @param {'twitter'|'linkedin'|'devto'|'instagram'|'farcaster'} platform
 * @param {'ai'|'dev'|'web3'|'growth'|'industry'} [topic] - Optional topic filter
 * @param {number} [maxCount] - Max number of hashtags to return
 * @returns {string[]} Array of hashtags
 */
export function getViralHashtags(platform = 'twitter', topic = null, maxCount = 5) {
  const sets = HASHTAG_SETS[platform] || HASHTAG_SETS.twitter;
  let tags = [...(sets.core || [])];

  if (topic && sets[topic]) {
    tags = [...tags, ...sets[topic]];
  } else {
    // Merge all topic sets if no specific topic requested
    for (const key of Object.keys(sets)) {
      if (key !== 'core') tags = [...tags, ...sets[key]];
    }
  }

  // Deduplicate and shuffle for variety
  const unique = [...new Set(tags)];
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }

  // Always keep core tags first
  const core = sets.core || [];
  const rest = unique.filter(t => !core.includes(t));
  return [...core, ...rest].slice(0, maxCount);
}

// ─── Data Fetching ─────────────────────────────────────────────────────

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

// Generate text content using /api/summarize (with smart local fallback)
export async function generateText(prompt, maxLength = 500, localFallback = null) {
  const fallback = localFallback || null;

  try {
    log(`Generating text (max ${maxLength} chars)...`);
    const result = await callApi(`/api/summarize?text=${encodeURIComponent(prompt)}&max_length=${maxLength}`);
    const text = result.summary || result.result || result.response;
    if (text && text.length > 20) return text;
  } catch (err) {
    log(`API call failed: ${err.message} — using local fallback`);
  }

  if (fallback) return fallback.slice(0, maxLength);
  return prompt.slice(0, maxLength);
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

/**
 * Adapt content for Twitter — supports single tweet or thread format.
 * @param {string} content - Main content text
 * @param {object} stats - Platform stats
 * @param {object} [opts] - Options
 * @param {boolean} [opts.thread=false] - Generate a thread instead of single tweet
 * @param {'question'|'stat'|'counterintuitive'|'story'} [opts.hookType='question'] - Hook style
 * @param {'ai'|'dev'|'web3'|'growth'} [opts.topic='ai'] - Hashtag topic
 * @returns {string|string[]} Single tweet string, or array of tweet strings for thread
 */
export function adaptForTwitter(content, stats, opts = {}) {
  const { thread = false, hookType = 'question', topic = 'ai' } = opts;
  const hashtags = getViralHashtags('twitter', topic, 4).join(' ');
  const link = config.projectUrl;

  if (!thread) {
    // Single tweet: hook + content snippet + hashtags + link
    const hookedContent = addHook(content, hookType, stats);
    const footerLen = hashtags.length + link.length + 4;
    const available = config.limits.twitter.maxChars - footerLen;
    const text = hookedContent.length > available
      ? hookedContent.slice(0, available - 3) + '...'
      : hookedContent;
    return `${text}\n\n${link}\n${hashtags}`;
  }

  // Thread format: split content into tweets
  const tweets = buildTwitterThread(content, stats, hashtags, link, hookType);
  return tweets;
}

/**
 * Build a Twitter thread from content.
 * @param {string} content
 * @param {object} stats
 * @param {string} hashtags
 * @param {string} link
 * @param {string} hookType
 * @returns {string[]} Array of tweet strings
 */
function buildTwitterThread(content, stats, hashtags, link, hookType) {
  const MAX_TWEET = config.limits.twitter.maxChars;
  const threadLabel = (n, total) => `${n}/${total}`;

  // Tweet 1: Hook
  const hookTemplates = HOOK_TEMPLATES[hookType] || HOOK_TEMPLATES.question;
  const hook = hookTemplates[Math.floor(Math.random() * hookTemplates.length)]
    .replace('{totalCalls}', stats.totalCalls?.toLocaleString() || '10k+')
    .replace('{totalServices}', stats.totalServices || '69')
    .replace('{uptimePercent}', stats.uptimePercent || '99.9')
    .replace('{totalPayments}', stats.totalPayments?.toLocaleString() || '100+')
    .replace('{stat}', `${stats.totalCalls?.toLocaleString() || '10k+'} API calls paid by AI agents`);

  // Split body into chunks
  const sentences = content.match(/[^.!?]+[.!?]+/g) || [content];
  const bodyTweets = [];
  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).length < MAX_TWEET - 10) {
      current += sentence + ' ';
    } else {
      if (current.trim()) bodyTweets.push(current.trim());
      current = sentence + ' ';
    }
  }
  if (current.trim()) bodyTweets.push(current.trim());

  // Last tweet: stats + link + hashtags
  const statLine = `${stats.totalServices || 69} APIs | ${stats.recentCalls24h || 0} calls today | ${stats.uptimePercent || 99.9}% uptime`;
  const lastTweet = `${statLine}\n\n${link}\n${hashtags}`;

  const allTweets = [hook, ...bodyTweets, lastTweet];
  const total = allTweets.length;

  return allTweets.map((tweet, i) => {
    const label = threadLabel(i + 1, total);
    const labelledTweet = `${label} ${tweet}`;
    return labelledTweet.length > MAX_TWEET
      ? `${label} ${tweet.slice(0, MAX_TWEET - label.length - 4)}...`
      : labelledTweet;
  });
}

export function adaptForReddit(title, body, subreddit) {
  // Value-first: lead with usefulness, soft mention of project at the end
  const valueIntro = body.startsWith('**') ? body : `${body}`;
  return {
    subreddit,
    title: title.slice(0, 300),
    body: `${valueIntro}\n\n---\n\n**What is x402 Bazaar?**\n`
      + `A pay-per-call API marketplace for AI agents — no subscriptions, no API keys. `
      + `Agents pay with USDC via the x402 protocol.\n\n`
      + `[x402bazaar.org](${config.projectUrl}) | `
      + `*Open source, feedback welcome in comments.*`,
  };
}

/**
 * Adapt content for LinkedIn — uses story format: hook → problem → solution → CTA.
 * @param {string} content - Main narrative body
 * @param {object} stats - Platform stats
 * @param {object} [opts]
 * @param {'question'|'stat'|'counterintuitive'|'story'} [opts.hookType='story'] - Hook style
 * @param {'ai'|'dev'|'web3'|'industry'} [opts.topic='ai'] - Hashtag topic
 * @returns {string}
 */
export function adaptForLinkedIn(content, stats, opts = {}) {
  const { hookType = 'story', topic = 'ai' } = opts;
  const hashtags = getViralHashtags('linkedin', topic, 6).join(' ');
  const hook = addHook('', hookType, stats).trim();

  const storyBody = [
    hook,
    '',
    content,
    '',
    `The numbers speak for themselves:`,
    `• ${stats.totalServices} APIs available, no subscription required`,
    `• ${stats.totalPayments?.toLocaleString() || '100+'} on-chain payments processed`,
    `• ${stats.recentCalls24h || 0} API calls in the last 24 hours`,
    `• ${stats.uptimePercent}% uptime`,
    '',
    addCTA('', 'linkedin').trim(),
    '',
    hashtags,
  ].join('\n');

  return storyBody.slice(0, config.limits.linkedin.maxChars);
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

/**
 * Adapt content for Dev.to — rich markdown, good tags, code examples when relevant.
 * @param {string} title
 * @param {string} body
 * @param {'ai'|'dev'|'web3'|string[]} [topic='ai'] - Tag category string OR array of tags (legacy)
 * @returns {object} Dev.to article payload
 */
export function adaptForDevTo(title, body, topic = 'ai') {
  const tagSets = HASHTAG_SETS.devto;
  let allTags;

  if (Array.isArray(topic)) {
    // Legacy: tags passed directly as array
    allTags = topic.slice(0, 4);
  } else {
    const coreTags = tagSets.core;
    const topicTags = tagSets[topic] || tagSets.ai;
    allTags = [...new Set([...coreTags, ...topicTags])].slice(0, 4);
  }

  const footer = [
    '---',
    '',
    `*Published by [x402 Bazaar](${config.projectUrl}) Community Agent*`,
    `*Explore ${config.projectUrl} — pay-per-call APIs for AI agents*`,
  ].join('\n');

  return {
    title,
    body_markdown: `${body}\n\n${footer}`,
    published: false, // Draft by default — user reviews before publishing
    tags: allTags,
  };
}

export function adaptForHN(title) {
  return {
    title: title.slice(0, 80),
    url: config.projectUrl,
  };
}

export function adaptForFarcaster(content, stats = {}) {
  const link = config.projectUrl;
  const hashtags = getViralHashtags('farcaster', null, 3)
    .map(t => (t.startsWith('/') || t.startsWith('#') ? t : `#${t}`))
    .join(' ');
  const footer = `${link} ${hashtags}`;
  const available = config.limits.farcaster.maxChars - footer.length - 2;
  const text = content.length > available ? content.slice(0, available - 3) + '...' : content;
  return `${text}\n${footer}`;
}
