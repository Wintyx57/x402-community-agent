// Strategy: New API Announcement — Announce when new APIs are added
import {
  fetchStats, generateText, generateImage,
  adaptForTwitter, adaptForDiscord, adaptForTelegram, adaptForLinkedIn, adaptForFarcaster,
} from '../lib/content-gen.js';
import { callFreeApi } from '../lib/x402-client.js';
import { config } from '../config.js';

export const name = 'new-api';
export const description = 'Announce new APIs added to the marketplace';

export async function execute(options = {}) {
  const apiName = options.apiName || 'New API';
  const apiDescription = options.apiDescription || 'A new API has been added to x402 Bazaar';
  const apiPrice = options.apiPrice || 'varies';
  const apiEndpoint = options.apiEndpoint || '';

  const stats = await fetchStats();

  console.log(`[new-api] Announcing: ${apiName}`);
  const mainContent = await generateText(
    `Write an exciting announcement for a new API on x402 Bazaar marketplace. ` +
    `API name: ${apiName}. Description: ${apiDescription}. Price: ${apiPrice} USDC per call. ` +
    `Total APIs now: ${stats.totalServices}. ` +
    `Key point: AI agents can use this API autonomously, paying with USDC via the x402 protocol. ` +
    `Keep it short, professional, and exciting.`,
    350
  );

  let imageUrl = null;
  if (config.generateImages) {
    imageUrl = await generateImage(
      `New API launch announcement graphic. Tech aesthetic, neon orange on dark background. Abstract representation of API connections and data flow. Minimal and modern.`
    );
  }

  const contents = {
    twitter: adaptForTwitter(`New on x402 Bazaar: ${apiName}! ${mainContent}`, stats),
    linkedin: adaptForLinkedIn(`New API: ${apiName}\n\n${mainContent}`, stats),
    discord: adaptForDiscord(`New API: ${apiName}\n\n${mainContent}`, stats, imageUrl),
    telegram: adaptForTelegram(`New API: *${apiName}*\n\n${mainContent}`, stats, imageUrl),
    farcaster: adaptForFarcaster(`New on x402 Bazaar: ${apiName}! ${mainContent}`),
  };

  return { contents, stats, imageUrl };
}
