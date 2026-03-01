// Strategy: Milestone Tracker — Detect payment count milestones and celebrate on-chain
import fs from 'fs';
import path from 'path';
import {
  fetchStats, generateText, generateImage,
  adaptForTwitter, adaptForReddit, adaptForLinkedIn,
  adaptForDiscord, adaptForTelegram, adaptForFarcaster, adaptForHN,
} from '../lib/content-gen.js';
import { config } from '../config.js';

export const name = 'milestone';
export const description = 'Detect and celebrate payment milestones — track last announced to avoid duplicates';

// Define milestone thresholds
const MILESTONES = [200, 500, 1000, 2500, 5000, 10000];

// Path to track last announced milestone
const MILESTONE_DATA_PATH = new URL('../data/milestones.json', import.meta.url).pathname;

/**
 * Load milestone tracking data
 * @returns {object} { lastAnnouncedMilestone: number }
 */
function loadMilestoneData() {
  try {
    if (fs.existsSync(MILESTONE_DATA_PATH)) {
      const data = fs.readFileSync(MILESTONE_DATA_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.log('[milestone] Could not load milestone data:', err.message);
  }
  return { lastAnnouncedMilestone: 0 };
}

/**
 * Save milestone tracking data
 * @param {object} data - { lastAnnouncedMilestone: number }
 */
function saveMilestoneData(data) {
  try {
    const dir = path.dirname(MILESTONE_DATA_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(MILESTONE_DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[milestone] Saved milestone data: ${JSON.stringify(data)}`);
  } catch (err) {
    console.error('[milestone] Failed to save milestone data:', err.message);
  }
}

/**
 * Detect if a new milestone has been reached
 * @param {number} currentPayments - Current payment count from API
 * @param {number} lastAnnouncedMilestone - Last announced milestone
 * @returns {number|null} New milestone value, or null if none reached
 */
function detectNewMilestone(currentPayments, lastAnnouncedMilestone) {
  for (const milestone of MILESTONES) {
    // If current >= milestone AND we haven't announced it yet
    if (currentPayments >= milestone && milestone > lastAnnouncedMilestone) {
      return milestone;
    }
  }
  return null;
}

// Milestone-specific hooks — celebration-focused, contrarian angles
const MILESTONE_HOOKS = [
  (m, s) =>
    `Something we didn't expect to happen happened.\n\n` +
    `${m} on-chain payments on x402 Bazaar. That's ${m} times an AI agent autonomously ` +
    `discovered an API, checked the price, and paid USDC on Base — with zero human involvement.\n\n` +
    `${s.totalServices} APIs. ${s.uptimePercent}% uptime. The autonomous agent economy works.`,

  (m, s) =>
    `We hit ${m} payments.\n\nThree months ago this was a hackathon project. ` +
    `Now it's processing real money on a real blockchain. AI agents are economic actors. ` +
    `${s.totalServices} APIs, ${s.recentCalls24h} calls yesterday. This is shipping.`,

  (m, s) =>
    `${m} reasons to believe the agent economy is real:\n\n` +
    `1. ${m} on-chain payments (all verifiable)\n` +
    `2. ${s.totalServices} APIs live\n` +
    `3. 5 external providers already earning\n` +
    `4. Zero chargebacks\n\n` +
    `Agents are paying for services. This works.`,

  (m, s) =>
    `The HTTP 402 protocol was specified in 1996 for a payment-based web.\n\n` +
    `We just hit ${m} live payments using it.\n\n` +
    `x402 Bazaar: ${s.totalServices} APIs, ${s.uptimePercent}% uptime, ` +
    `${s.totalPayments} USDC payments total. The future doesn't wait.`,

  (m, s) =>
    `$${(m * 0.01).toFixed(2)} may not sound like much.\n\n` +
    `But each of those ${m} payments is an AI agent buying exactly what it needed, ` +
    `exactly when it needed it. No subscriptions. No waste. Pure economics. ` +
    `${s.totalServices} APIs. This is the API economy of the future.`,
];

/**
 * Generate compelling milestone announcement content
 * @param {number} milestoneValue - The milestone (e.g., 200)
 * @param {object} stats - Current platform stats
 * @returns {object} { contents, stats, milestone, imageUrl }
 */
export async function execute(options = {}) {
  console.log('[milestone] Strategy starting...');

  // Fetch current stats
  const stats = await fetchStats();
  const currentPayments = stats.totalPayments || 0;

  // Load tracking data
  const tracking = loadMilestoneData();
  const lastAnnouncedMilestone = tracking.lastAnnouncedMilestone || 0;

  // Allow manual override
  let milestone = options.milestone;

  if (!milestone) {
    // Detect if new milestone reached
    milestone = detectNewMilestone(currentPayments, lastAnnouncedMilestone);

    if (!milestone) {
      console.log(
        `[milestone] No new milestone. ` +
        `Current: ${currentPayments}, Last announced: ${lastAnnouncedMilestone}`
      );
      return {
        triggered: false,
        message: `No new milestone reached. Current payments: ${currentPayments}`,
        stats,
      };
    }
  }

  console.log(`[milestone] 🎉 NEW MILESTONE DETECTED: ${milestone} payments!`);

  // Select hook (rotate by day for variety)
  const hookIndex = new Date().getDate() % MILESTONE_HOOKS.length;
  const localContent = MILESTONE_HOOKS[hookIndex](milestone, stats);

  // Generate AI-enhanced content
  console.log('[milestone] Generating milestone announcement...');
  const mainContent = await generateText(
    `Write a powerful, viral milestone announcement for x402 Bazaar. ` +
    `The milestone: ${milestone} on-chain payments reached. ` +
    `Context: x402 Bazaar is the first API marketplace where AI agents pay autonomously with USDC ` +
    `via the x402 protocol. ${stats.totalServices} APIs, ${stats.uptimePercent}% uptime. ` +
    `Tone: celebratory but grounded. Never oversell. Max 320 chars.`,
    320,
    localContent
  );

  // Generate celebration visual
  let imageUrl = null;
  if (config.generateImages) {
    console.log('[milestone] Generating milestone visual...');
    imageUrl = await generateImage(
      `Milestone celebration graphic. Dark background, bright neon orange number "${milestone}" ` +
      `dominating center. Minimal tech aesthetic, abstract network nodes, subtle confetti. ` +
      `No text other than the number itself. Professional, not cartoonish.`
    );
  }

  // Create platform-specific adaptations
  const milestoneEmoji = '🎉';
  const milestoneTitle = `${milestone} on-chain payments on x402 Bazaar`;
  const milestoneSummary = `AI agents have made ${milestone} autonomous USDC payments on x402 Bazaar. ` +
    `All on-chain. All verifiable. ${stats.totalServices} APIs. ${stats.uptimePercent}% uptime.`;

  const contents = {
    twitter: {
      text: `${milestoneEmoji} ${milestoneTitle}\n\n${mainContent}\n\n` +
        `All verifiable: https://basescan.io\n\n#x402 #AIAgents #USDC #Base`,
      hashtags: ['#x402', '#AIAgents', '#USDC', '#Base', '#Milestone'],
    },
    linkedin: {
      text: `${milestoneEmoji} ${milestoneTitle}\n\n${mainContent}\n\n` +
        `What this represents: AI agents are economic actors. ` +
        `They discover services, evaluate prices, and make autonomous purchasing decisions. ` +
        `This is the autonomous agent economy in action.\n\n` +
        `${stats.totalServices} APIs live. ${stats.uptimePercent}% uptime. ` +
        `Zero chargebacks. Pure market mechanics.\n\n` +
        `#x402 #AIAgents #Web3 #APIEconomy #Innovation`,
      hashtags: ['#x402', '#AIAgents', '#Web3', '#APIEconomy', '#Innovation'],
    },
    discord: {
      title: `${milestoneEmoji} Milestone: ${milestoneTitle}`,
      description: mainContent,
      fields: [
        {
          name: '🔢 Payment #',
          value: `${milestone}`,
          inline: true,
        },
        {
          name: '📊 APIs Live',
          value: `${stats.totalServices}`,
          inline: true,
        },
        {
          name: '⏫ Uptime',
          value: `${stats.uptimePercent}%`,
          inline: true,
        },
        {
          name: '💬 What This Means',
          value: `Autonomous AI agents are now making real economic decisions. ` +
            `Discovering APIs, comparing prices, making purchases — all without human intervention.`,
          inline: false,
        },
      ],
      color: 16756480, // Orange
      thumbnail: imageUrl ? { url: imageUrl } : undefined,
    },
    telegram: {
      text: `*${milestoneEmoji} Milestone Reached!*\n\n` +
        `*${milestoneTitle}*\n\n` +
        `${mainContent}\n\n` +
        `🔗 [Verify on Base](https://basescan.io)\n` +
        `📊 [View Stats](https://x402bazaar.org/stats)\n` +
        `🚀 [Try x402 Bazaar](https://x402bazaar.org)`,
    },
    reddit: {
      subreddit: 'SideProject',
      title: `x402 Bazaar hit ${milestoneTitle} — autonomous AI agents paying for APIs with crypto`,
      body: `${mainContent}\n\n---\n\n**What this means:**\n\n` +
        `This isn't just a number. Each of those ${milestone} payments represents an AI agent ` +
        `discovering an API on x402 Bazaar, evaluating the price, and autonomously paying USDC on Base.\n\n` +
        `No human approval. No credit card. No subscription.\n\n` +
        `**Stats:**\n\n` +
        `• ${stats.totalServices} APIs available\n` +
        `• ${stats.uptimePercent}% uptime\n` +
        `• 5 external developers earning revenue\n` +
        `• 19 USDC earned by builders\n` +
        `• Zero chargebacks\n\n` +
        `**Try it yourself:**\n\n` +
        `\`\`\`bash\n` +
        `npx x402-bazaar init\n` +
        `npx x402-bazaar list\n` +
        `npx x402-bazaar call weather --lat 48.8 --lng 2.3\n` +
        `\`\`\`\n\n` +
        `Or visit: https://x402bazaar.org\n\n` +
        `Questions? Ask in the comments. We're shipping fast and iterating on feedback.`,
    },
    farcaster: {
      text: `${milestoneEmoji} ${milestoneTitle}\n\n${mainContent}\n\n` +
        `All on-chain, all verifiable.\n\nhttps://x402bazaar.org`,
    },
    hn: {
      title: `x402 Bazaar – ${milestone} autonomous AI agent payments processed (all on-chain, all verifiable)`,
      url: config.projectUrl,
    },
  };

  // Update tracking data
  tracking.lastAnnouncedMilestone = milestone;
  tracking.lastAnnouncedAt = new Date().toISOString();
  tracking.announcementCount = (tracking.announcementCount || 0) + 1;
  saveMilestoneData(tracking);

  console.log(`[milestone] ✅ Milestone ${milestone} announced and tracked.`);

  return {
    triggered: true,
    milestone,
    contents,
    stats,
    imageUrl,
    tracking,
  };
}
