// Strategy: Weekly Recap — Comprehensive weekly summary thread
import {
  fetchStats, generateText, generateImage,
  adaptForDiscord, adaptForTelegram, adaptForLinkedIn, adaptForDevTo, adaptForFarcaster,
} from '../lib/content-gen.js';
import { config } from '../config.js';

export const name = 'weekly-recap';
export const description = 'Weekly recap — detailed summary for LinkedIn, Dev.to, Telegram';

export async function execute() {
  console.log('[weekly-recap] Building weekly recap...');
  const stats = await fetchStats();

  const topApis = (stats.topEndpoints || []).slice(0, 5).map(e => e.name || e.endpoint).join(', ');

  // Local long-form content
  const localLongContent = [
    `This week on x402 Bazaar:`,
    ``,
    `${stats.totalServices} APIs available on the marketplace, serving AI agents with ${stats.uptimePercent}% uptime.`,
    `${stats.recentCalls24h} API calls in the last 24 hours, with ${stats.totalPayments} total on-chain USDC payments processed.`,
    topApis ? `Most popular: ${topApis}.` : '',
    ``,
    `x402 Bazaar is the first autonomous API marketplace for AI agents. Agents discover, pay (USDC on Base), and use APIs without human intervention.`,
    `95% revenue share for API creators. 6 integrations: MCP Server, ChatGPT GPT, CLI, LangChain, Telegram Bot, Auto-GPT Plugin.`,
    ``,
    `Try it: npx x402-bazaar init`,
    `Website: ${config.projectUrl}`,
  ].filter(Boolean).join('\n');

  // Local thread content for Twitter
  const localThread = [
    `1/5 Weekly recap from @x402Bazaar: ${stats.totalServices} APIs live, ${stats.uptimePercent}% uptime, ${stats.totalPayments} on-chain payments. The autonomous API economy keeps growing.`,
    `2/5 AI agents can now discover, pay, and use ${stats.totalServices} APIs with USDC on Base. No API keys, no subscriptions — just pay-per-call.`,
    `3/5 Top APIs this week: ${topApis || 'search, weather, translate, sentiment, image generation'}. All verified, all pay-as-you-go.`,
    `4/5 For API creators: 95% revenue share. List your API in 2 minutes. Earn USDC every time an agent calls it. ${config.projectUrl}/creators`,
    `5/5 Get started: npx x402-bazaar init. Works with Claude, Cursor, ChatGPT, LangChain, and Auto-GPT. ${config.projectUrl}`,
  ].join('\n\n');

  const context = `x402 Bazaar weekly recap. ${stats.totalServices} APIs, ${stats.uptimePercent}% uptime, ${stats.recentCalls24h} calls/24h, ${stats.totalPayments} payments. ${localLongContent}`;

  // Generate long-form content
  const longContent = await generateText(
    `Write a comprehensive weekly update blog post for x402 Bazaar, an API marketplace for AI agents. Include sections: highlights, stats, what's new, coming next. Facts: ${context}. Tone: professional, forward-looking. 800-1200 chars.`,
    1200,
    localLongContent
  );

  // Generate Twitter thread
  const threadIntro = await generateText(
    `Write 5 short tweet-sized updates (max 250 chars each) for a weekly recap thread about x402 Bazaar. Number them 1/5 to 5/5. Facts: ${context}.`,
    1500,
    localThread
  );

  let imageUrl = null;
  if (config.generateImages) {
    imageUrl = await generateImage(
      `Weekly tech report infographic. Dark background, orange accents. Futuristic data visualization with API nodes connected. Clean, minimal design.`
    );
  }

  const contents = {
    twitter: threadIntro,
    linkedin: adaptForLinkedIn(`Weekly Recap\n\n${longContent}`, stats),
    discord: adaptForDiscord(`Weekly Recap\n\n${longContent.slice(0, 1500)}`, stats, imageUrl),
    telegram: adaptForTelegram(`Weekly Recap\n\n${longContent.slice(0, 3000)}`, stats, imageUrl),
    devto: {
      title: `x402 Bazaar Weekly Recap \u2014 ${stats.totalServices} APIs, ${stats.uptimePercent}% Uptime`,
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
