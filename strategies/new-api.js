// Strategy: New API Announcement — Hook + use case + code snippet
import {
  fetchStats, generateText, generateImage,
  adaptForTwitter, adaptForDiscord, adaptForTelegram, adaptForLinkedIn, adaptForFarcaster,
} from '../lib/content-gen.js';
import { config } from '../config.js';

export const name = 'new-api';
export const description = 'Announce new APIs — hook, concrete use case, ready-to-use code snippet';

// Generate a concrete use case sentence for the API category
function buildUseCase(apiName, apiDescription) {
  const name = apiName.toLowerCase();
  if (name.includes('sentiment') || name.includes('emotion'))
    return `Your agent reads 1000 product reviews → calls this API → knows exactly which features customers hate. Autonomous feedback loop.`;
  if (name.includes('search') || name.includes('web'))
    return `Agent researching competitors? It now searches the web mid-task, pays $0.001 per call, no API key needed.`;
  if (name.includes('image') || name.includes('vision') || name.includes('ocr'))
    return `Agent receives a PDF invoice → calls this API → extracts amounts automatically. No human in the loop.`;
  if (name.includes('translate') || name.includes('language'))
    return `Your multilingual agent just got smarter. It translates content on-demand, per call, zero setup.`;
  if (name.includes('weather') || name.includes('climate'))
    return `Agent planning logistics? It fetches real-time weather for any city, pays per call, no subscription needed.`;
  if (name.includes('news') || name.includes('article'))
    return `Research agent? It now pulls live news on any topic autonomously. One call, $0.001, zero friction.`;
  if (name.includes('summary') || name.includes('summarize'))
    return `Agent processing long documents? This API condenses 10,000 words into key insights. Pay per summary.`;
  if (name.includes('verify') || name.includes('validation'))
    return `Your agent validates data in real-time before acting. Prevents costly mistakes. One call, one truth.`;
  return `Your AI agent can now ${apiDescription.toLowerCase().split('.')[0]} — autonomously, pay-per-call, no setup.`;
}

// Generate a minimal code snippet for quick integration
function buildCodeSnippet(apiEndpoint) {
  const endpoint = apiEndpoint || '/api/example';
  return `\`\`\`bash
# Try it right now
npx x402-bazaar call ${endpoint} --param "your input"

# Or via CLI
x402-bazaar search ${endpoint}
\`\`\``;
}

export async function execute(options = {}) {
  const apiName = options.apiName || 'New API';
  const apiDescription = options.apiDescription || 'A powerful new API has been added to x402 Bazaar';
  const apiPrice = options.apiPrice || 'varies';
  const apiEndpoint = options.apiEndpoint || '';
  const apiCategory = options.apiCategory || '';

  const stats = await fetchStats();
  const useCase = buildUseCase(apiName, apiDescription);
  const codeSnippet = buildCodeSnippet(apiEndpoint);

  console.log(`[new-api] Announcing: ${apiName}`);

  // Hook: surprising capability first, then what it is
  const localContent = [
    `${useCase}`,
    ``,
    `NEW on x402 Bazaar: ${apiName}`,
    `${apiDescription}`,
    ``,
    `→ Price: ${apiPrice} USDC per call`,
    `→ Marketplace: now ${stats.totalServices} APIs total`,
    `→ Payment: USDC on Base via x402 protocol`,
    `→ Auth: none — agents pay directly`,
    ``,
    codeSnippet,
    ``,
    `Built for autonomous agents. Works with Claude MCP, ChatGPT, LangChain, Auto-GPT.`,
  ].join('\n');

  // AI-enhanced version with better copywriting
  const mainContent = await generateText(
    `Write an exciting new API announcement for x402 Bazaar (autonomous AI agent API marketplace). ` +
    `Structure: (1) hook — one sentence showing a concrete surprising use case for an AI agent, ` +
    `(2) what the API is and what it does, (3) price and marketplace stats, (4) CTA. ` +
    `API: ${apiName}. Description: ${apiDescription}. Price: ${apiPrice} USDC/call. ` +
    `Marketplace total: ${stats.totalServices} APIs. ` +
    `Tone: excited builder, not corporate marketing. Short and punchy.`,
    400,
    localContent
  );

  let imageUrl = null;
  if (config.generateImages) {
    imageUrl = await generateImage(
      `New product launch announcement visual. Dark tech background, neon orange glow. ` +
      `Abstract representation of "${apiName}" as an API node connecting to an AI brain. ` +
      `Clean, minimal, modern SaaS aesthetic. No text, no people.`
    );
  }

  // Long-form version for LinkedIn and Discord with code snippet
  const longContent = `${mainContent}\n\n${codeSnippet}\n\nTotal APIs on x402 Bazaar: ${stats.totalServices}`;

  // Twitter: hook + price + link (no code snippet — too long)
  const twitterHook = `${useCase}\n\nNew: ${apiName} — ${apiPrice} USDC/call. No API key, no sub. Just pay.`;

  const contents = {
    twitter: adaptForTwitter(twitterHook, stats),
    linkedin: adaptForLinkedIn(`New on x402 Bazaar: ${apiName}\n\n${longContent}`, stats),
    discord: adaptForDiscord(`New API: ${apiName}\n\n${longContent}`, stats, imageUrl),
    telegram: adaptForTelegram(`*New API: ${apiName}*\n\n${mainContent}\n\n${codeSnippet}`, stats, imageUrl),
    farcaster: adaptForFarcaster(`New on x402 Bazaar: ${apiName}! ${useCase} Pay ${apiPrice} USDC/call.`),
    reddit: {
      subreddit: 'SideProject',
      title: `New API on x402 Bazaar: ${apiName} — AI agents pay per call with USDC, no API key needed`,
      body: `${localContent}\n\nDiscover it at: ${config.projectUrl}`,
    },
  };

  return { contents, stats, imageUrl };
}
