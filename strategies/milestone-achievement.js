// Strategy: Milestone Achievement — Celebrate platform milestones to build social proof
import {
  fetchStats, generateText, generateImage,
  adaptForTwitter, adaptForReddit, adaptForLinkedIn,
  adaptForDiscord, adaptForTelegram, adaptForFarcaster,
} from '../lib/content-gen.js';
import { config } from '../config.js';

export const name = 'milestone-achievement';
export const description = 'Celebrate milestones (payments, API count, calls) to build social proof';

// Detect which milestone was just crossed
function detectMilestone(stats) {
  const milestones = [
    { field: 'totalPayments', thresholds: [10, 50, 100, 250, 500, 1000, 5000], unit: 'on-chain payments', emoji: '💳' },
    { field: 'totalServices', thresholds: [50, 75, 100, 150, 200], unit: 'APIs live', emoji: '🔌' },
    { field: 'totalCalls', thresholds: [100, 500, 1000, 5000, 10000], unit: 'API calls', emoji: '⚡' },
  ];

  for (const m of milestones) {
    const val = stats[m.field] || 0;
    for (const threshold of m.thresholds) {
      if (val >= threshold && val < threshold * 1.05) {
        return { value: threshold, unit: m.unit, emoji: m.emoji, field: m.field };
      }
    }
  }
  return null;
}

// Hook-first templates — never start with stats
const HOOKS = [
  (m, s) => `Something just happened that we didn't expect this early.\n\n${m.value} ${m.unit} on x402 Bazaar. AI agents are paying for APIs autonomously with USDC — and it's working. ${s.totalServices} APIs, ${s.uptimePercent}% uptime. No subscriptions, no gatekeeping.`,

  (m, s) => `We hit ${m.value} ${m.unit}.\n\nThree months ago, this was a crazy idea: let AI agents buy API access with crypto, autonomously, with no human in the loop. Today it's real. ${s.totalServices} APIs live. The future doesn't wait.`,

  (m, s) => `The number that keeps me up at night: ${m.value}.\n\nThat's how many ${m.unit} x402 Bazaar has processed. USDC. On-chain. No credit card. No subscription. Just agents calling APIs and paying as they go. This is what autonomous commerce looks like.`,

  (m, s) => `Nobody talks about ${m.value} ${m.unit} until they have them. So we will.\n\nx402 Bazaar crossed this milestone today. ${s.totalServices} APIs available. AI agents discover, pay, and use them — fully autonomous. Built on the x402 payment protocol over HTTP.`,
];

export async function execute(options = {}) {
  console.log('[milestone-achievement] Fetching stats...');
  const stats = await fetchStats();

  // Allow manual override of milestone
  const milestone = options.milestone || detectMilestone(stats) || {
    value: stats.totalPayments,
    unit: 'on-chain payments',
    emoji: '🏆',
    field: 'totalPayments',
  };

  const hookIndex = new Date().getDate() % HOOKS.length;
  const localContent = HOOKS[hookIndex](milestone, stats);

  console.log(`[milestone-achievement] Celebrating: ${milestone.value} ${milestone.unit}`);

  const mainContent = await generateText(
    `Write a powerful, milestone announcement for x402 Bazaar. Hook first — never start with stats. ` +
    `The milestone: ${milestone.value} ${milestone.unit}. ` +
    `Context: x402 Bazaar is the first API marketplace where AI agents pay autonomously with USDC via the x402 protocol. ` +
    `${stats.totalServices} APIs, ${stats.uptimePercent}% uptime. Tone: excited but grounded. Max 350 chars.`,
    350,
    localContent
  );

  let imageUrl = null;
  if (config.generateImages) {
    imageUrl = await generateImage(
      `Milestone celebration graphic. Dark background, bright orange number "${milestone.value}" dominating the frame. Minimal confetti particles, tech aesthetic. No text other than the number.`
    );
  }

  const milestoneTitle = `${milestone.value} ${milestone.unit} on x402 Bazaar`;

  const contents = {
    twitter: adaptForTwitter(`${milestone.emoji} ${milestoneTitle}\n\n${mainContent}`, stats),
    linkedin: adaptForLinkedIn(`Milestone: ${milestoneTitle}\n\n${mainContent}`, stats),
    discord: adaptForDiscord(`${milestone.emoji} ${milestoneTitle}\n\n${mainContent}`, stats, imageUrl),
    telegram: adaptForTelegram(`*${milestone.emoji} Milestone reached!*\n${milestoneTitle}\n\n${mainContent}`, stats, imageUrl),
    reddit: {
      subreddit: 'SideProject',
      title: `x402 Bazaar hit ${milestoneTitle} — AI agents paying APIs with crypto autonomously`,
      body: `${mainContent}\n\n---\n${stats.totalServices} APIs | ${stats.uptimePercent}% uptime\n\n[x402bazaar.org](${config.projectUrl})`,
    },
    farcaster: adaptForFarcaster(`${milestone.emoji} ${milestoneTitle} — ${mainContent}`),
  };

  return { contents, stats, milestone, imageUrl };
}
