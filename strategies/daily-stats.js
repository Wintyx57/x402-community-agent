// Strategy: Daily Stats — Post daily platform statistics to all networks
import {
  fetchStats, generateText, generateImage,
  adaptForTwitter, adaptForReddit, adaptForLinkedIn,
  adaptForDiscord, adaptForTelegram, adaptForFarcaster, adaptForHN,
} from '../lib/content-gen.js';
import { config } from '../config.js';

export const name = 'daily-stats';
export const description = 'Post daily platform statistics to all configured networks';

// Rotating templates for variety
const TEMPLATES = [
  (s) => `x402 Bazaar is live with ${s.totalServices} APIs for AI agents. ${s.uptimePercent}% uptime, ${s.recentCalls24h} calls in the last 24h, and ${s.totalPayments} on-chain USDC payments. The first marketplace where agents discover, pay, and use APIs autonomously via the x402 protocol. No subscriptions, no API keys — just crypto-native pay-as-you-go.`,

  (s) => `${s.totalServices} APIs. ${s.uptimePercent}% uptime. ${s.totalPayments} on-chain payments. x402 Bazaar lets AI agents pay for APIs with USDC — per call, no middleman. Today: ${s.recentCalls24h} API calls processed. The future of autonomous agent commerce is here.`,

  (s) => `Your AI agent needs data? x402 Bazaar has ${s.totalServices} APIs ready. Pay per call with USDC on Base — no subscriptions, no credit cards. ${s.recentCalls24h} calls today, ${s.uptimePercent}% uptime, ${s.totalPayments} verified payments on-chain. Built for agents, by agents.`,

  (s) => `Daily stats from x402 Bazaar: ${s.totalServices} APIs live, ${s.uptimePercent}% uptime, ${s.recentCalls24h} calls in 24h. AI agents pay per call with USDC via x402 protocol. 95% revenue share for API creators. The autonomous API economy is growing.`,

  (s) => `x402 Bazaar update: ${s.totalServices} curated APIs for AI agents. ${s.totalPayments} on-chain USDC payments to date. ${s.recentCalls24h} calls in the last 24h at ${s.uptimePercent}% uptime. No API keys needed — agents pay directly with crypto.`,
];

export async function execute() {
  console.log('[daily-stats] Fetching live stats...');
  const stats = await fetchStats();

  // Pick template based on day of month for variety
  const templateIndex = new Date().getDate() % TEMPLATES.length;
  const localContent = TEMPLATES[templateIndex](stats);

  // Try AI-enhanced content, with good local fallback
  console.log('[daily-stats] Generating content...');
  const mainContent = await generateText(
    `Write a short, engaging social media post about this API marketplace update. Be concise and enthusiastic but professional. Focus on what makes this unique (AI agents paying for APIs with crypto). Here are the facts: ${localContent}`,
    400,
    localContent
  );

  // Generate image (optional, needs funded wallet)
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
    hn: { title: `x402 Bazaar \u2013 ${stats.totalServices} APIs for autonomous AI agents (pay-per-call USDC)`, url: config.projectUrl },
  };

  return { contents, stats, imageUrl };
}
