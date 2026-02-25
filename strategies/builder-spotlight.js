// Strategy: Builder Spotlight — Feature an external API provider to drive provider acquisition
import {
  fetchStats, generateText, generateImage,
  adaptForTwitter, adaptForLinkedIn, adaptForDiscord,
  adaptForTelegram, adaptForFarcaster, adaptForDevTo,
} from '../lib/content-gen.js';
import { config } from '../config.js';

export const name = 'builder-spotlight';
export const description = 'Feature an external API provider — builds trust and attracts more providers';

// Known external providers — rotates weekly
const KNOWN_PROVIDERS = [
  {
    name: 'Interzoid',
    service: 'Company Name Matching API',
    useCase: 'AI agents resolving ambiguous company names in datasets',
    quote: 'The x402 payment layer made it trivial to monetize our API for AI consumers.',
  },
  {
    name: 'AgentsHere',
    service: 'Verify Agent API',
    useCase: 'Identity verification for autonomous agent workflows',
    quote: 'We listed our API in under 10 minutes. First USDC payment arrived within the hour.',
  },
  {
    name: 'Independent Builder',
    service: 'Sentiment Analyzer API',
    useCase: 'Real-time sentiment analysis for social listening agents',
    quote: 'No SDK required. Any agent that can make an HTTP call can use and pay for my API.',
  },
];

// Hook-first templates
const HOOKS = [
  (p, s) => `You don't need to be a big company to monetize your API to AI agents.\n\n${p.name} listed their "${p.service}" on x402 Bazaar and received their first USDC payment autonomously — no contract, no sales call. This is what the open API economy looks like.`,

  (p, s) => `"${p.quote}"\n\n— ${p.name}, builder on x402 Bazaar\n\nTheir "${p.service}" is now live on the marketplace. ${s.totalServices} APIs. Every one of them earns 95% of every call. Autonomous. Permissionless.`,

  (p, s) => `What does it look like when an AI agent pays for an API?\n\nAsk ${p.name}. Their "${p.service}" is called by agents building ${p.useCase}. Every call triggers a micropayment in USDC — on-chain, automatic, no invoice needed.`,

  (p, s) => `Builder spotlight: ${p.name}\n\nThey built "${p.service}" and listed it on x402 Bazaar. Now AI agents use it for ${p.useCase}. 95% revenue share. Every. Single. Call. This is how APIs become passive income in 2025.`,
];

export async function execute(options = {}) {
  console.log('[builder-spotlight] Preparing spotlight...');
  const stats = await fetchStats();

  // Allow override via options, else rotate weekly
  const weekIndex = Math.floor(Date.now() / (7 * 24 * 3600 * 1000)) % KNOWN_PROVIDERS.length;
  const provider = options.provider || KNOWN_PROVIDERS[weekIndex];

  const hookIndex = new Date().getDate() % HOOKS.length;
  const localContent = HOOKS[hookIndex](provider, stats);

  console.log(`[builder-spotlight] Spotlight on: ${provider.name} — ${provider.service}`);

  const mainContent = await generateText(
    `Write a compelling builder spotlight for x402 Bazaar. Feature: ${provider.name}, service: "${provider.service}". ` +
    `Use case: ${provider.useCase}. Quote: "${provider.quote}". ` +
    `Key point: any developer can list their API on x402 Bazaar and earn USDC (95% revenue share) every time an AI agent calls it. ` +
    `Start with a hook — never with stats or the provider name. Max 400 chars.`,
    400,
    localContent
  );

  let imageUrl = null;
  if (config.generateImages) {
    imageUrl = await generateImage(
      `Developer spotlight graphic. Dark background, orange spotlight beam on a simple API icon. Abstract code elements. Professional and warm. No text overlay.`
    );
  }

  const devtoBody = [
    `## Builder Spotlight: ${provider.name}`,
    ``,
    `**Service**: ${provider.service}`,
    `**Use case**: ${provider.useCase}`,
    ``,
    `> "${provider.quote}"`,
    ``,
    mainContent,
    ``,
    `## Want to list your API?`,
    ``,
    `Any developer can publish an API on [x402 Bazaar](${config.projectUrl}) and start earning USDC from AI agents immediately.`,
    `- 95% revenue share per call`,
    `- No integration SDK required — just HTTP`,
    `- Payments are on-chain, automatic, non-custodial`,
    ``,
    `→ [List your API](${config.projectUrl}/creators)`,
  ].join('\n');

  const contents = {
    twitter: adaptForTwitter(`Builder Spotlight: ${provider.name}\n\n${mainContent}`, stats),
    linkedin: adaptForLinkedIn(`Builder Spotlight: ${provider.name} — ${provider.service}\n\n${mainContent}`, stats),
    discord: adaptForDiscord(`Builder Spotlight: ${provider.name}\n\n${mainContent}`, stats, imageUrl),
    telegram: adaptForTelegram(`*Builder Spotlight: ${provider.name}*\n_${provider.service}_\n\n${mainContent}`, stats, imageUrl),
    farcaster: adaptForFarcaster(`Builder Spotlight: ${provider.name}\n\n${mainContent}`),
    devto: {
      title: `Builder Spotlight: How ${provider.name} Monetizes Their API with AI Agents`,
      body_markdown: devtoBody,
      tags: ['ai', 'api', 'webdev', 'blockchain'],
    },
  };

  return { contents, stats, provider, imageUrl };
}
