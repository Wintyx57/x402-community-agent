// Strategy: Provocative Take — Hot takes on AI agents, crypto payments, API economy
// Goal: generate discussion, retweets, and debate — high engagement potential
import {
  fetchStats, generateText,
  adaptForTwitter, adaptForLinkedIn, adaptForDiscord,
  adaptForTelegram, adaptForFarcaster,
} from '../lib/content-gen.js';
import { config } from '../config.js';

export const name = 'provocative-take';
export const description = 'Hot takes on AI agents and the API economy — designed for engagement and debate';

// Rotating provocative angles — each challenges a common assumption
const TAKES = [
  {
    hook: "API keys are the wrong abstraction for the AI agent era.",
    body: "API keys assume a human is in the loop, managing credentials, rotating secrets. AI agents don't work that way. They need to pay per call, autonomously, without a human handing them a credit card.\n\nThat's what x402 does. HTTP payment headers. USDC. No API key required.\n\nThe protocol stack is changing.",
    angle: 'api-keys-dead',
  },
  {
    hook: "Your API is invisible to AI agents if it requires a subscription.",
    body: "Agents don't subscribe. They call, they pay, they move on. Monthly plans assume a human who budgets, waits for billing cycles, manages renewals.\n\nPay-per-call is the native business model of AI agents. If your API doesn't support it, you're not in the agent economy.\n\nx402 Bazaar: pay-per-call, USDC, on-chain.",
    angle: 'subscriptions-dead',
  },
  {
    hook: "The next wave of crypto adoption won't come from DeFi. It'll come from AI agents buying APIs.",
    body: "Think about it: millions of agents will need data, compute, and tools — every second, at micro-scale. A $0.001 USDC payment is useless with a credit card. It's trivial on-chain.\n\nThe x402 protocol enables agents to pay APIs autonomously, per call. This is how crypto goes mainstream.",
    angle: 'crypto-adoption',
  },
  {
    hook: "Developers who monetize their APIs today will own passive income streams tomorrow.",
    body: "Not from human subscribers. From AI agents — running 24/7, making thousands of API calls, paying per use.\n\nOn x402 Bazaar, API creators keep 95% of every payment. The agent economy is already running. The question is whether your API is in it.",
    angle: 'passive-income',
  },
  {
    hook: "We're building infrastructure that humans won't use — and that's the point.",
    body: "x402 Bazaar is a marketplace for AI agents. Not for developers browsing a catalog. For agents autonomously discovering, evaluating, and paying for APIs in real-time.\n\nThe HTTP 402 status code has existed since 1991. Nobody used it — until now. Agents don't need a UI.",
    angle: 'agent-native',
  },
  {
    hook: "The API economy is worth $4 trillion. Almost none of it is accessible to AI agents today.",
    body: "APIs require credit cards, OAuth flows, human-readable docs, subscription plans. Agents can't navigate any of that autonomously.\n\nx402 changes the access model: discover via API, pay per call with USDC, no human in the loop. The $4T is up for grabs.",
    angle: 'market-size',
  },
];

export async function execute(options = {}) {
  console.log('[provocative-take] Selecting take...');
  const stats = await fetchStats();

  // Rotate daily through provocative angles
  const dayIndex = new Date().getDate() % TAKES.length;
  const take = options.take || TAKES[dayIndex];

  console.log(`[provocative-take] Angle: ${take.angle}`);

  const localContent = `${take.hook}\n\n${take.body}`;

  const mainContent = await generateText(
    `Rewrite this provocative opinion post about AI agents and API commerce. Keep the bold, contrarian tone. ` +
    `Start with the hook. Don't soften it. Don't add disclaimers. ` +
    `Hook: "${take.hook}". Body: "${take.body}". ` +
    `Tie it back to x402 Bazaar (${stats.totalServices} APIs, pay-per-call USDC, autonomous agent payments). ` +
    `Max 500 chars. Punchy. Opinionated. Share-worthy.`,
    500,
    localContent
  );

  // Twitter version: just the hook + shortened take (for max engagement)
  const twitterHook = `${take.hook}\n\n${mainContent}`;

  // LinkedIn version: expand with professional framing
  const linkedInIntro = `Hot take on the future of API monetization:\n\n`;

  const contents = {
    twitter: adaptForTwitter(twitterHook, stats),
    linkedin: adaptForLinkedIn(`${linkedInIntro}${mainContent}`, stats),
    discord: adaptForDiscord(`Opinion: ${take.hook}\n\n${mainContent}`, stats, null),
    telegram: adaptForTelegram(`*Hot take*\n_${take.hook}_\n\n${mainContent}`, stats, null),
    farcaster: adaptForFarcaster(`${take.hook}\n\n${mainContent}`),
    reddit: {
      subreddit: 'artificial',
      title: take.hook,
      body: `${mainContent}\n\n---\nBuilding this at [x402bazaar.org](${config.projectUrl}). ${stats.totalServices} APIs, pay-per-call USDC.`,
    },
  };

  return { contents, stats, take };
}
