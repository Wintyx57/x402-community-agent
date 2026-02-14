// Strategy: Daily Stats — Post daily platform statistics to all networks
import {
  fetchStats, generateText, generateImage, translateText,
  adaptForTwitter, adaptForReddit, adaptForLinkedIn,
  adaptForDiscord, adaptForTelegram, adaptForFarcaster, adaptForHN,
} from '../lib/content-gen.js';
import { config } from '../config.js';

export const name = 'daily-stats';
export const description = 'Post daily platform statistics to all configured networks';

export async function execute() {
  console.log('[daily-stats] Fetching live stats...');
  const stats = await fetchStats();

  // Build context for content generation
  const context = [
    `x402 Bazaar daily update:`,
    `${stats.totalServices} APIs available on the marketplace.`,
    `${stats.uptimePercent}% uptime across all services.`,
    `${stats.recentCalls24h} API calls in the last 24 hours.`,
    stats.totalPayments > 0 ? `${stats.totalPayments} on-chain USDC payments processed.` : '',
    `The first autonomous API marketplace where AI agents pay per call with USDC.`,
    `No subscriptions, no API keys needed — just crypto-native pay-as-you-go.`,
    `Agents can discover, pay, and use APIs autonomously via the x402 protocol.`,
  ].filter(Boolean).join(' ');

  console.log('[daily-stats] Generating content...');
  const mainContent = await generateText(
    `Write a short, engaging social media post about this API marketplace update. Be concise and enthusiastic but professional. Focus on what makes this unique (AI agents paying for APIs with crypto). Here are the facts: ${context}`,
    400
  );

  // Generate image
  let imageUrl = null;
  if (config.generateImages) {
    console.log('[daily-stats] Generating visual...');
    imageUrl = await generateImage(
      `Futuristic dashboard showing API marketplace stats: ${stats.totalServices} APIs, ${stats.uptimePercent}% uptime. Neon orange and dark theme. Minimal, tech aesthetic. No text.`
    );
  }

  // Adapt content for each platform
  const contents = {
    twitter: adaptForTwitter(mainContent, stats),
    linkedin: adaptForLinkedIn(mainContent, stats),
    discord: adaptForDiscord(mainContent, stats, imageUrl),
    telegram: adaptForTelegram(mainContent, stats, imageUrl),
    reddit: {
      subreddit: 'SideProject',
      title: `x402 Bazaar: ${stats.totalServices} APIs for AI agents, ${stats.uptimePercent}% uptime`,
      body: mainContent,
    },
    farcaster: adaptForFarcaster(mainContent),
    hn: { title: `x402 Bazaar – ${stats.totalServices} APIs for autonomous AI agents (pay-per-call USDC)`, url: config.projectUrl },
  };

  return { contents, stats, imageUrl };
}
