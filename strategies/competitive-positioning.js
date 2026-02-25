// Strategy: Competitive Positioning — "x402 vs X" content to capture search intent
// Goal: attract developers evaluating API marketplaces, drive SEO and Reddit discovery
import {
  fetchStats, generateText,
  adaptForTwitter, adaptForLinkedIn, adaptForReddit,
  adaptForDiscord, adaptForTelegram, adaptForFarcaster, adaptForDevTo,
} from '../lib/content-gen.js';
import { config } from '../config.js';

export const name = 'competitive-positioning';
export const description = 'Comparison posts highlighting x402 unique advantages over legacy API monetization';

// Comparison angles — position against concepts, not specific companies
const COMPARISONS = [
  {
    versus: 'Legacy API Marketplaces',
    theirApproach: 'Require accounts, credit cards, manual approval for each API',
    ourApproach: 'Agent discovers and pays per call with USDC — no account needed',
    winningPoint: 'Zero friction for autonomous agents. If you can make an HTTP call, you can pay.',
    hook: "If your API marketplace requires a signup form, AI agents can't use it.",
    devToTitle: 'Why AI Agents Cannot Use Traditional API Marketplaces (And What to Use Instead)',
  },
  {
    versus: 'Monthly API Subscriptions',
    theirApproach: 'Pay $99/month whether you use 1 call or 1 million',
    ourApproach: 'Pay $0.001 per call — exact usage, exact cost, on-chain record',
    winningPoint: 'Agents need granular, predictable costs. Subscriptions create budget unpredictability.',
    hook: "Paying $99/month for an API your agent calls 3 times is just a bad deal.",
    devToTitle: 'Pay-Per-Call vs Subscriptions: What AI Agents Actually Need',
  },
  {
    versus: 'OAuth & API Key Management',
    theirApproach: 'Rotate keys, store secrets, handle OAuth flows, manage token expiry',
    ourApproach: 'HTTP 402 header with USDC payment — the API key IS the payment',
    winningPoint: 'No secrets to manage. No token expiry. No OAuth dance. Just pay and call.',
    hook: "OAuth was designed for humans. AI agents don't need to log in.",
    devToTitle: 'OAuth Is the Wrong Authentication Model for AI Agents',
  },
  {
    versus: 'Building API Integrations Yourself',
    theirApproach: 'Write adapters, handle rate limits, manage keys for each API individually',
    ourApproach: 'One integration to x402 Bazaar unlocks 70+ APIs with a single payment protocol',
    winningPoint: '1 integration = access to 70+ APIs. And the catalog keeps growing.',
    hook: "You could spend 3 weeks integrating 10 different APIs. Or use one endpoint.",
    devToTitle: 'Stop Writing API Integrations from Scratch — Use x402 Bazaar',
  },
];

export async function execute(options = {}) {
  console.log('[competitive-positioning] Preparing comparison post...');
  const stats = await fetchStats();

  // Rotate weekly
  const weekIndex = Math.floor(Date.now() / (7 * 24 * 3600 * 1000)) % COMPARISONS.length;
  const comparison = options.comparison || COMPARISONS[weekIndex];

  console.log(`[competitive-positioning] Angle: x402 vs ${comparison.versus}`);

  const localContent = [
    comparison.hook,
    '',
    `x402 Bazaar vs ${comparison.versus}:`,
    '',
    `The old way: ${comparison.theirApproach}.`,
    `The x402 way: ${comparison.ourApproach}.`,
    '',
    `The key difference: ${comparison.winningPoint}`,
    '',
    `${stats.totalServices} APIs. Pay-per-call. USDC. No account required.`,
  ].join('\n');

  const mainContent = await generateText(
    `Write a confident, factual comparison post: x402 Bazaar vs ${comparison.versus}. ` +
    `Hook: "${comparison.hook}". ` +
    `Old approach: ${comparison.theirApproach}. ` +
    `x402 approach: ${comparison.ourApproach}. ` +
    `Key differentiator: ${comparison.winningPoint}. ` +
    `Facts: ${stats.totalServices} APIs, ${stats.uptimePercent}% uptime, pay-per-call USDC. ` +
    `Tone: direct, confident, educational. Not arrogant. Hook first. Max 450 chars.`,
    450,
    localContent
  );

  const comparisonTable = [
    `| | ${comparison.versus} | x402 Bazaar |`,
    `|---|---|---|`,
    `| Payment model | Subscription / credit card | Per-call USDC |`,
    `| Agent compatible | No | Yes |`,
    `| Account required | Yes | No |`,
    `| Revenue share | Varies | 95% to creator |`,
    `| Auth | API key / OAuth | HTTP 402 header |`,
  ].join('\n');

  const devtoBody = [
    `## ${comparison.hook}`,
    ``,
    mainContent,
    ``,
    `### The difference at a glance`,
    ``,
    comparisonTable,
    ``,
    `### Why this matters for AI agents`,
    ``,
    comparison.winningPoint,
    ``,
    `### Try x402 Bazaar`,
    ``,
    `\`\`\`bash`,
    `npx x402-bazaar init`,
    `\`\`\``,
    ``,
    `${stats.totalServices} APIs live. ${stats.uptimePercent}% uptime. → [x402bazaar.org](${config.projectUrl})`,
  ].join('\n');

  const contents = {
    twitter: adaptForTwitter(`${comparison.hook}\n\n${mainContent}`, stats),
    linkedin: adaptForLinkedIn(`x402 Bazaar vs ${comparison.versus}\n\n${mainContent}`, stats),
    discord: adaptForDiscord(`x402 vs ${comparison.versus}\n\n${mainContent}`, stats, null),
    telegram: adaptForTelegram(`*x402 vs ${comparison.versus}*\n\n${mainContent}`, stats, null),
    farcaster: adaptForFarcaster(`${comparison.hook}\n\n${mainContent}`),
    reddit: adaptForReddit(
      `x402 Bazaar vs ${comparison.versus}: ${comparison.hook}`,
      `${mainContent}\n\n${comparisonTable}`,
      'webdev'
    ),
    devto: {
      title: comparison.devToTitle,
      body_markdown: devtoBody,
      tags: ['ai', 'api', 'webdev', 'devtools'],
    },
  };

  return { contents, stats, comparison };
}
