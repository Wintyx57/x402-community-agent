// Strategy: Tutorial Thread — "How to get started" thread targeting developers
// Goal: drive signups, CLI installs, and MCP setups
import {
  fetchStats, generateText, generateImage,
  adaptForTwitter, adaptForLinkedIn, adaptForDiscord,
  adaptForTelegram, adaptForFarcaster, adaptForDevTo,
} from '../lib/content-gen.js';
import { config } from '../config.js';

export const name = 'tutorial-thread';
export const description = 'Developer tutorial thread — drives CLI installs, MCP setups, and first API calls';

// Tutorial tracks targeting different audiences
const TUTORIALS = [
  {
    audience: 'Claude / Cursor users',
    hook: "Your Claude agent can now call 70+ APIs and pay for them automatically. Here's the 2-minute setup.",
    steps: [
      'Install: Add x402-bazaar MCP to your Claude/Cursor config',
      'Discover: Ask Claude "list APIs on x402 Bazaar"',
      'Pay: Fund your wallet with $5 USDC on Base',
      'Call: "Search for AI news" — Claude picks the API, pays, returns results',
    ],
    cta: `Get the MCP config: ${config.projectUrl}/mcp`,
    track: 'mcp',
  },
  {
    audience: 'Python / LangChain developers',
    hook: "3 lines of Python. Your LangChain agent can now access 70+ APIs and pay autonomously with USDC.",
    steps: [
      'pip install x402-bazaar',
      'from x402_bazaar import X402Tool — add to your agent tools',
      'Fund wallet: send $5 USDC to your agent wallet on Base',
      'Run: agent.run("summarize this article") — x402 handles the rest',
    ],
    cta: `Full docs: ${config.projectUrl}/langchain`,
    track: 'langchain',
  },
  {
    audience: 'Terminal power users',
    hook: "One command. 70+ APIs. No registration, no API key, no account. Just USDC.",
    steps: [
      'npx x402-bazaar init — interactive setup in 60 seconds',
      'x402-bazaar list — browse all APIs with prices',
      'x402-bazaar call /api/search?q=AI+agents — pay and call in one command',
      'x402-bazaar wallet — check balance and transaction history',
    ],
    cta: `npm install -g x402-bazaar → ${config.projectUrl}/cli`,
    track: 'cli',
  },
  {
    audience: 'API creators',
    hook: "You can list your API on x402 Bazaar in under 10 minutes and start earning USDC from AI agents.",
    steps: [
      'Register: POST /api/register with your endpoint URL and price',
      'Set price: as low as $0.001 per call — you keep 95%',
      'Monitor: real-time dashboard shows calls, payments, uptime',
      'Receive: USDC lands in your wallet on every agent call — automatic',
    ],
    cta: `List your API: ${config.projectUrl}/creators`,
    track: 'creators',
  },
];

export async function execute(options = {}) {
  console.log('[tutorial-thread] Preparing tutorial...');
  const stats = await fetchStats();

  // Rotate weekly across audiences
  const weekIndex = Math.floor(Date.now() / (7 * 24 * 3600 * 1000)) % TUTORIALS.length;
  const tutorial = options.tutorial || TUTORIALS[weekIndex];

  console.log(`[tutorial-thread] Tutorial track: ${tutorial.track} — audience: ${tutorial.audience}`);

  const stepsText = tutorial.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const localThread = [
    tutorial.hook,
    '',
    stepsText,
    '',
    tutorial.cta,
    '',
    `${stats.totalServices} APIs live. Pay-per-call USDC. No subscription.`,
  ].join('\n');

  const mainContent = await generateText(
    `Write a practical developer tutorial introduction for x402 Bazaar. ` +
    `Target audience: ${tutorial.audience}. Hook: "${tutorial.hook}". ` +
    `Steps: ${tutorial.steps.join(' → ')}. ` +
    `CTA: ${tutorial.cta}. Stats: ${stats.totalServices} APIs, ${stats.uptimePercent}% uptime. ` +
    `Tone: practical, direct, no fluff. Start with the hook. Max 450 chars.`,
    450,
    localThread
  );

  // Twitter thread: split into numbered tweets
  const tweetThread = [
    `${tutorial.hook} (thread 🧵)`,
    ...tutorial.steps.map((step, i) => `${i + 1}/${tutorial.steps.length} ${step}`),
    `Done. ${stats.totalServices} APIs ready. Pay with USDC. No subscription.\n\n${tutorial.cta}`,
  ].join('\n\n');

  let imageUrl = null;
  if (config.generateImages) {
    imageUrl = await generateImage(
      `Code terminal screenshot aesthetic. Dark background with orange syntax highlighting. Shows a CLI command being executed. Clean, minimal, developer-focused.`
    );
  }

  const devtoBody = [
    `## ${tutorial.hook}`,
    ``,
    `This guide targets **${tutorial.audience}**.`,
    ``,
    `### Prerequisites`,
    `- A wallet with a few USDC on Base (you can use MetaMask or any EVM wallet)`,
    `- Node.js 18+ (for CLI/MCP tracks)`,
    ``,
    `### Steps`,
    ``,
    tutorial.steps.map((s, i) => `**Step ${i + 1}**: ${s}`).join('\n\n'),
    ``,
    `### Ready to go`,
    ``,
    `${tutorial.cta}`,
    ``,
    `x402 Bazaar has ${stats.totalServices} APIs live. All pay-per-call, all verified, ${stats.uptimePercent}% uptime.`,
    ``,
    `→ [Full documentation](${config.projectUrl}/docs)`,
  ].join('\n');

  const contents = {
    twitter: tweetThread,
    linkedin: adaptForLinkedIn(`Tutorial: Getting Started on x402 Bazaar (${tutorial.audience})\n\n${mainContent}`, stats),
    discord: adaptForDiscord(`Tutorial: ${tutorial.hook}\n\n${mainContent}`, stats, imageUrl),
    telegram: adaptForTelegram(`*Tutorial: ${tutorial.audience}*\n\n${mainContent}\n\n${tutorial.cta}`, stats, imageUrl),
    farcaster: adaptForFarcaster(`${tutorial.hook}\n\n${mainContent}`),
    devto: {
      title: `Getting Started with x402 Bazaar as a ${tutorial.audience}`,
      body_markdown: devtoBody,
      tags: ['tutorial', 'ai', 'api', 'webdev'],
    },
  };

  return { contents, stats, tutorial, imageUrl };
}
