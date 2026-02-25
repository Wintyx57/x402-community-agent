// Strategy: Daily Stats — Viral hook first, stats second
import {
  fetchStats, generateText, generateImage,
  adaptForTwitter, adaptForReddit, adaptForLinkedIn,
  adaptForDiscord, adaptForTelegram, adaptForFarcaster, adaptForHN,
} from '../lib/content-gen.js';
import { config } from '../config.js';

export const name = 'daily-stats';
export const description = 'Post daily platform statistics — hook first, viral format';

// Rotating viral hooks — curiosity/contrarian/surprising angle FIRST
const HOOKS = [
  (s) => `Your AI agent just paid for an API call. With crypto. Automatically. No human involved.\n\n` +
    `That's what's happening on x402 Bazaar right now:\n` +
    `→ ${s.totalServices} APIs ready for autonomous agents\n` +
    `→ ${s.recentCalls24h} API calls in the last 24h\n` +
    `→ ${s.totalPayments} on-chain USDC payments verified\n` +
    `→ ${s.uptimePercent}% uptime\n\n` +
    `No subscriptions. No API keys. Just pay-per-call with USDC on Base.`,

  (s) => `The API economy is changing. Quietly.\n\n` +
    `AI agents are now buying API access themselves — no credit card, no human approval.\n\n` +
    `x402 Bazaar today:\n` +
    `• ${s.totalServices} APIs available\n` +
    `• ${s.recentCalls24h} autonomous calls processed\n` +
    `• ${s.totalPayments} on-chain payments, zero chargebacks\n` +
    `• ${s.uptimePercent}% uptime\n\n` +
    `HTTP 402 is becoming the payment layer of agentic AI.`,

  (s) => `We built a marketplace where AI agents are the customers.\n\n` +
    `Not devs. Not companies. Agents.\n\n` +
    `Today's numbers:\n` +
    `↗ ${s.totalServices} APIs — weather, sentiment, image gen, search...\n` +
    `↗ ${s.recentCalls24h} calls autonomously made in 24h\n` +
    `↗ ${s.totalPayments} USDC payments settled on Base\n` +
    `↗ ${s.uptimePercent}% uptime\n\n` +
    `x402 Bazaar: the API marketplace agents pay for themselves.`,

  (s) => `What if your AI agent could buy the tools it needs — mid-task?\n\n` +
    `x402 Bazaar makes this real. ${s.totalServices} APIs, USDC pay-per-call, zero setup.\n\n` +
    `Stats right now:\n` +
    `${s.recentCalls24h} API calls today | ${s.totalPayments} on-chain payments | ${s.uptimePercent}% uptime\n\n` +
    `Works with Claude MCP, ChatGPT, LangChain, Auto-GPT, CLI.\n` +
    `Try: npx x402-bazaar init`,

  (s) => `Most APIs still require:\n` +
    `→ Developer account\n` +
    `→ Credit card on file\n` +
    `→ Human reading ToS\n\n` +
    `x402 Bazaar requires: nothing. Agents pay as they go.\n\n` +
    `Today: ${s.totalServices} APIs | ${s.recentCalls24h} calls | ${s.uptimePercent}% uptime | ${s.totalPayments} USDC payments`,
];

export async function execute() {
  console.log('[daily-stats] Fetching live stats...');
  const stats = await fetchStats();

  // Rotate hook by day of month for variety
  const hookIndex = new Date().getDate() % HOOKS.length;
  const localContent = HOOKS[hookIndex](stats);

  console.log('[daily-stats] Generating AI-enhanced content...');
  const mainContent = await generateText(
    `Rewrite this social media post about x402 Bazaar (autonomous AI agent API marketplace). ` +
    `Keep the hook structure: start with a surprising/contrarian statement, THEN reveal stats. ` +
    `Tone: confident, builder, slightly provocative. Max 400 chars for Twitter adaptation. ` +
    `Facts: ${localContent}`,
    400,
    localContent
  );

  let imageUrl = null;
  if (config.generateImages) {
    console.log('[daily-stats] Generating visual...');
    imageUrl = await generateImage(
      `Futuristic tech dashboard, dark background, neon orange glowing stats: "${stats.totalServices} APIs" "${stats.uptimePercent}% uptime". ` +
      `Minimalist, cyberpunk aesthetic, no people, abstract network nodes. Professional product visual.`
    );
  }

  const redditDay = new Date().getDay(); // vary subreddit by day
  const subreddits = ['SideProject', 'artificial', 'webdev', 'MachineLearning', 'cryptocurrency'];
  const subreddit = subreddits[redditDay % subreddits.length];

  const contents = {
    twitter: adaptForTwitter(mainContent, stats),
    linkedin: adaptForLinkedIn(mainContent, stats),
    discord: adaptForDiscord(mainContent, stats, imageUrl),
    telegram: adaptForTelegram(mainContent, stats, imageUrl),
    reddit: {
      subreddit,
      title: `AI agents are paying for APIs autonomously — x402 Bazaar hits ${stats.totalServices} APIs, ${stats.recentCalls24h} calls today`,
      body: mainContent,
    },
    farcaster: adaptForFarcaster(mainContent),
    hn: { title: `x402 Bazaar \u2013 AI agents pay for APIs autonomously with USDC (${stats.totalServices} APIs live)`, url: config.projectUrl },
  };

  return { contents, stats, imageUrl };
}
