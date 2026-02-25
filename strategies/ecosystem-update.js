// Strategy: Ecosystem Update — Announce new integrations, features, and ecosystem growth
import {
  fetchStats, generateText, generateImage,
  adaptForTwitter, adaptForLinkedIn, adaptForDiscord,
  adaptForTelegram, adaptForFarcaster, adaptForHN,
} from '../lib/content-gen.js';
import { config } from '../config.js';

export const name = 'ecosystem-update';
export const description = 'Announce ecosystem expansions — new integrations, features, platform updates';

// Supported integrations for context
const INTEGRATIONS = {
  mcp: { name: 'MCP Server v2.1', tagline: 'Works natively in Claude and Cursor', icon: '🧠' },
  cli: { name: 'CLI npm x402-bazaar@3.0', tagline: 'Run API calls from your terminal', icon: '⌨️' },
  langchain: { name: 'LangChain Package', tagline: 'Drop-in for Python AI pipelines', icon: '🐍' },
  chatgpt: { name: 'ChatGPT Custom GPT', tagline: '30 operations via Actions', icon: '🤖' },
  telegram: { name: 'Telegram Bot', tagline: '11 commands, instant marketplace access', icon: '📱' },
  autogpt: { name: 'Auto-GPT Plugin', tagline: 'Autonomous agent integration', icon: '⚙️' },
};

// Hook-first announcement templates
const HOOKS = [
  (update, s) => `You don't need to write a single line of payment code.\n\n${update.headline}. ${update.detail} This is x402 Bazaar — ${s.totalServices} APIs, pay-per-call USDC, now accessible from ${Object.keys(INTEGRATIONS).length} platforms.`,

  (update, s) => `The gap between "idea" and "working AI pipeline" just got smaller.\n\n${update.headline}. ${update.detail} ${s.totalServices} APIs ready to call. Pay per use, in USDC, automatically.`,

  (update, s) => `Integration #${Object.keys(INTEGRATIONS).length} just shipped.\n\n${update.headline}. ${update.detail} Every integration means more agents can reach more APIs — autonomously.`,

  (update, s) => `${update.headline}.\n\n${update.detail} The x402 Bazaar ecosystem now spans ${Object.keys(INTEGRATIONS).length} platforms. ${s.totalServices} APIs. One protocol. No API keys.`,
];

export async function execute(options = {}) {
  console.log('[ecosystem-update] Preparing ecosystem update...');
  const stats = await fetchStats();

  // Allow custom update or pick a featured integration
  const weekIndex = Math.floor(Date.now() / (7 * 24 * 3600 * 1000)) % Object.values(INTEGRATIONS).length;
  const featuredIntegration = Object.values(INTEGRATIONS)[weekIndex];

  const update = options.update || {
    headline: `x402 Bazaar now integrates with ${featuredIntegration.name}`,
    detail: `${featuredIntegration.tagline}. ${stats.totalServices} APIs available — all pay-per-call with USDC.`,
    integrationName: featuredIntegration.name,
    icon: featuredIntegration.icon,
  };

  console.log(`[ecosystem-update] Announcing: ${update.headline}`);

  const hookIndex = new Date().getDate() % HOOKS.length;
  const localContent = HOOKS[hookIndex](update, stats);

  const mainContent = await generateText(
    `Write a punchy ecosystem update announcement for x402 Bazaar. ` +
    `Update: ${update.headline}. Detail: ${update.detail}. ` +
    `Context: x402 Bazaar has ${stats.totalServices} APIs, ${Object.keys(INTEGRATIONS).length} integrations (MCP, CLI, LangChain, ChatGPT, Telegram, Auto-GPT). ` +
    `Key message: AI agents can access all these APIs from any supported platform, paying with USDC autonomously. ` +
    `Start with a hook. Never open with stats. Max 400 chars.`,
    400,
    localContent
  );

  let imageUrl = null;
  if (config.generateImages) {
    imageUrl = await generateImage(
      `Tech ecosystem map. Dark background, orange nodes connected by bright lines. Central hub with satellite integration nodes. Clean, minimal, no text.`
    );
  }

  const integrationList = Object.values(INTEGRATIONS)
    .map(i => `- **${i.name}**: ${i.tagline}`)
    .join('\n');

  const contents = {
    twitter: adaptForTwitter(`${update.icon} ${update.headline}\n\n${mainContent}`, stats),
    linkedin: adaptForLinkedIn(`Ecosystem Update: ${update.headline}\n\n${mainContent}\n\nAll integrations:\n${integrationList}`, stats),
    discord: adaptForDiscord(`${update.icon} ${update.headline}\n\n${mainContent}`, stats, imageUrl),
    telegram: adaptForTelegram(`*${update.icon} Ecosystem Update*\n${update.headline}\n\n${mainContent}`, stats, imageUrl),
    farcaster: adaptForFarcaster(`${update.icon} ${update.headline}\n\n${mainContent}`),
    hn: adaptForHN(`x402 Bazaar — ${update.headline} (${stats.totalServices} APIs, pay-per-call USDC)`),
  };

  return { contents, stats, update, imageUrl };
}
