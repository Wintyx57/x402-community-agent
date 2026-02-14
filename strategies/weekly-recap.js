// Strategy: Weekly Recap — Comprehensive weekly summary thread
import {
  fetchStats, generateText, generateImage, translateText,
  adaptForDiscord, adaptForTelegram, adaptForLinkedIn, adaptForDevTo,
} from '../lib/content-gen.js';
import { config } from '../config.js';

export const name = 'weekly-recap';
export const description = 'Weekly recap — detailed summary for LinkedIn, Dev.to, Telegram';

export async function execute() {
  console.log('[weekly-recap] Building weekly recap...');
  const stats = await fetchStats();

  const context = [
    `x402 Bazaar weekly recap.`,
    `${stats.totalServices} APIs on the marketplace.`,
    `${stats.uptimePercent}% average uptime.`,
    `${stats.recentCalls24h} calls in last 24h.`,
    `${stats.totalPayments} total on-chain payments.`,
    `Top APIs: ${(stats.topEndpoints || []).slice(0, 5).map(e => e.name || e.endpoint).join(', ')}.`,
    `x402 Bazaar is the first autonomous API marketplace for AI agents.`,
    `Agents discover, pay (USDC), and use APIs without human intervention.`,
    `95% revenue share for API creators. 61+ curated APIs.`,
    `6 integrations: MCP Server, ChatGPT GPT, CLI, LangChain, Telegram Bot, Auto-GPT Plugin.`,
  ].filter(Boolean).join(' ');

  // Generate long-form content for Dev.to / LinkedIn
  const longContent = await generateText(
    `Write a comprehensive weekly update blog post for x402 Bazaar, an API marketplace for AI agents. ` +
    `Include sections: highlights, stats, what's new, coming next. ` +
    `Facts: ${context}. ` +
    `Tone: professional, forward-looking, tech-savvy. 800-1200 chars.`,
    1200
  );

  // Generate Twitter thread (5 tweets)
  const threadIntro = await generateText(
    `Write 5 short tweet-sized updates (max 250 chars each) for a weekly recap thread about x402 Bazaar. ` +
    `Number them 1/5 to 5/5. Facts: ${context}. ` +
    `Make each tweet standalone but part of a thread. Include relevant stats.`,
    1500
  );

  let imageUrl = null;
  if (config.generateImages) {
    imageUrl = await generateImage(
      `Weekly tech report infographic. Dark background, orange accents. Futuristic data visualization with API nodes connected. Clean, minimal design.`
    );
  }

  const contents = {
    twitter: threadIntro, // Multi-tweet thread
    linkedin: adaptForLinkedIn(`Weekly Recap\n\n${longContent}`, stats),
    discord: adaptForDiscord(`Weekly Recap\n\n${longContent.slice(0, 1500)}`, stats, imageUrl),
    telegram: adaptForTelegram(`Weekly Recap\n\n${longContent.slice(0, 3000)}`, stats, imageUrl),
    devto: {
      title: `x402 Bazaar Weekly Recap — ${stats.totalServices} APIs, ${stats.uptimePercent}% Uptime`,
      body_markdown: `# x402 Bazaar Weekly Recap\n\n${longContent}\n\n` +
        `## Stats\n- ${stats.totalServices} APIs\n- ${stats.uptimePercent}% uptime\n- ${stats.recentCalls24h} calls/24h\n\n` +
        `## Try it\n- Website: [x402bazaar.org](${config.projectUrl})\n- CLI: \`npx x402-bazaar init\`\n- MCP: Works with Claude, Cursor, VS Code`,
      tags: ['ai', 'webdev', 'api', 'blockchain'],
    },
    reddit: {
      subreddit: 'SideProject',
      title: `x402 Bazaar Weekly: ${stats.totalServices} APIs for AI agents, ${stats.uptimePercent}% uptime`,
      body: longContent,
    },
  };

  return { contents, stats, imageUrl };
}
