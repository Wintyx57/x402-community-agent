// Strategy: Weekly Recap — Storytelling first, thread format, viral hooks
import {
  fetchStats, generateText, generateImage,
  adaptForDiscord, adaptForTelegram, adaptForLinkedIn, adaptForDevTo, adaptForFarcaster,
} from '../lib/content-gen.js';
import { config } from '../config.js';

export const name = 'weekly-recap';
export const description = 'Weekly recap — storytelling threads, LinkedIn long-form, Dev.to article';

// Build the story arc: tension → journey → milestone → call-to-action
function buildStoryArc(stats, topApis) {
  const topApiList = topApis || 'search, sentiment analysis, image generation, weather, translation';
  return [
    `We're building something that didn't exist 6 months ago.`,
    ``,
    `A marketplace where AI agents are the buyers.`,
    `Not developers. Not companies. Agents — buying API access mid-task, paying with USDC, no human in the loop.`,
    ``,
    `This week on x402 Bazaar:`,
    ``,
    `→ ${stats.totalServices} APIs available (and growing)`,
    `→ ${stats.recentCalls24h} autonomous API calls in the last 24h`,
    `→ ${stats.totalPayments} on-chain USDC payments — zero chargebacks`,
    `→ ${stats.uptimePercent}% uptime`,
    topApis ? `→ Most-called APIs: ${topApiList}` : '',
    ``,
    `What makes this different from every other API marketplace?`,
    ``,
    `HTTP 402 — the "Payment Required" status code that browsers have ignored for 30 years.`,
    `We built the infrastructure to actually use it.`,
    `An agent hits an API. It returns 402 + payment instructions. The agent pays. Access granted. All in <1 second.`,
    ``,
    `No subscriptions. No API keys. No credit cards. Just pay-per-call with USDC on Base.`,
    ``,
    `Works with: Claude MCP, ChatGPT, LangChain, Auto-GPT, CLI`,
    `95% revenue share for API creators`,
    ``,
    `Try it: npx x402-bazaar init`,
    `${config.projectUrl}`,
  ].filter(Boolean).join('\n');
}

// Twitter thread — each tweet is a chapter of the story
function buildViralThread(stats, topApis) {
  const topApiList = topApis || 'search, sentiment, image gen, weather, translate';
  return [
    `1/ We built a marketplace where AI agents are the buyers.\n\nNot devs. Not companies. Agents — buying API access autonomously with USDC.\n\nThis week's numbers are wild ↓`,

    `2/ ${stats.totalServices} APIs on x402 Bazaar. ${stats.recentCalls24h} calls in 24h. ${stats.totalPayments} on-chain payments.\n\nAll autonomous. No human approved any of these transactions.\n\nThis is what agentic commerce looks like.`,

    `3/ The tech: HTTP 402.\n\nThe "Payment Required" status code that's been in the HTTP spec since 1996.\n\nWe actually built the infrastructure to use it. Agent hits API → gets 402 + payment info → pays USDC → gets access. <1 second.`,

    `4/ What your agent can buy right now:\n→ Web search\n→ Sentiment analysis\n→ Image generation\n→ Weather data\n→ Translation\n→ ${stats.totalServices - 5}+ more\n\nAll at ${stats.uptimePercent}% uptime. All pay-as-you-go.`,

    `5/ Start in 30 seconds:\n\nnpx x402-bazaar init\n\nWorks with Claude, ChatGPT, LangChain, Auto-GPT.\n95% revenue → API creators.\n\n${config.projectUrl}`,
  ].join('\n\n---TWEET---\n\n');
}

export async function execute() {
  console.log('[weekly-recap] Building weekly recap...');
  const stats = await fetchStats();

  const topApis = (stats.topEndpoints || []).slice(0, 5).map(e => e.name || e.endpoint).join(', ');
  const storyArc = buildStoryArc(stats, topApis);
  const localThread = buildViralThread(stats, topApis);

  const context = `x402 Bazaar weekly update. Stats: ${stats.totalServices} APIs, ${stats.uptimePercent}% uptime, ${stats.recentCalls24h} calls/24h, ${stats.totalPayments} total payments.`;

  // LinkedIn long-form — storytelling format
  const longContent = await generateText(
    `Rewrite this weekly update as a compelling LinkedIn story post. ` +
    `Structure: hook sentence (surprising fact) → context (what we built) → stats (specific numbers) → insight (why it matters for AI) → CTA. ` +
    `Tone: founder sharing genuine progress, not marketing. Be specific, not generic. ` +
    `Facts: ${storyArc}`,
    1200,
    storyArc
  );

  // Twitter thread — viral narrative format
  const threadContent = await generateText(
    `Rewrite this as a viral Twitter thread with exactly 5 tweets. ` +
    `Each tweet max 280 chars. Number them 1/ to 5/. ` +
    `Tweet 1: controversial/surprising hook. Tweet 2-3: the "how". Tweet 4: proof/stats. Tweet 5: CTA with link. ` +
    `Facts: ${context}. Thread template: ${localThread}`,
    1500,
    localThread
  );

  let imageUrl = null;
  if (config.generateImages) {
    imageUrl = await generateImage(
      `Weekly tech report cover. Dark background, neon orange accents. Abstract interconnected API network nodes with glowing data flows. ` +
      `Numbers "${stats.totalServices} APIs" floating in space. Cinematic, professional, no people.`
    );
  }

  // Dev.to article — comprehensive long-form
  const devtoBody = [
    `# x402 Bazaar Weekly — The Autonomous API Economy Update`,
    ``,
    longContent,
    ``,
    `## This Week's Numbers`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| APIs available | ${stats.totalServices} |`,
    `| Uptime | ${stats.uptimePercent}% |`,
    `| API calls (24h) | ${stats.recentCalls24h} |`,
    `| Total on-chain payments | ${stats.totalPayments} |`,
    topApis ? `| Most-called APIs | ${topApis} |` : '',
    ``,
    `## How It Works`,
    ``,
    `HTTP 402 is the "Payment Required" status code — it's been in the HTTP spec since 1996 but nobody used it. We built the infrastructure.`,
    ``,
    `\`\`\`bash`,
    `# Get started in 30 seconds`,
    `npx x402-bazaar init`,
    `\`\`\``,
    ``,
    `1. Agent hits API endpoint`,
    `2. Server responds 402 + payment instructions (amount, USDC address on Base)`,
    `3. Agent signs + broadcasts transaction`,
    `4. API grants access — all in <1 second`,
    ``,
    `## Integrations`,
    ``,
    `- Claude MCP Server v2.1.0`,
    `- ChatGPT Custom GPT`,
    `- LangChain package`,
    `- CLI \`x402-bazaar@3.0.0\``,
    `- Telegram Bot`,
    `- Auto-GPT Plugin`,
    ``,
    `95% revenue share for API creators. [List your API →](${config.projectUrl}/creators)`,
    ``,
    `---`,
    ``,
    `*Published by [x402 Bazaar](${config.projectUrl}) Community Agent*`,
  ].filter(Boolean).join('\n');

  const contents = {
    twitter: threadContent,
    linkedin: adaptForLinkedIn(`Weekly Update — Building the Autonomous API Economy\n\n${longContent}`, stats),
    discord: adaptForDiscord(`Weekly Recap\n\n${longContent.slice(0, 1500)}`, stats, imageUrl),
    telegram: adaptForTelegram(`*Weekly Recap — x402 Bazaar*\n\n${longContent.slice(0, 3000)}`, stats, imageUrl),
    devto: {
      title: `x402 Bazaar Weekly \u2014 AI Agents Are Now Buying APIs Autonomously (${stats.totalServices} APIs, ${stats.uptimePercent}% Uptime)`,
      body_markdown: devtoBody,
      tags: ['ai', 'webdev', 'api', 'blockchain'],
    },
    reddit: {
      subreddit: 'SideProject',
      title: `Weekly update: built a marketplace where AI agents pay for APIs themselves — ${stats.totalServices} APIs, ${stats.totalPayments} on-chain payments`,
      body: storyArc,
    },
    farcaster: adaptForFarcaster(threadContent.split('---TWEET---')[0] || longContent),
  };

  return { contents, stats, imageUrl };
}
