// Strategy: AI Agent Use Case — Concrete story of an agent using x402 Bazaar
import {
  fetchStats, generateText, generateImage,
  adaptForTwitter, adaptForLinkedIn, adaptForDiscord,
  adaptForTelegram, adaptForFarcaster, adaptForDevTo,
} from '../lib/content-gen.js';
import { config } from '../config.js';

export const name = 'ai-agent-usecase';
export const description = 'Tell a concrete use case story of an AI agent using x402 Bazaar — builds desire';

// Concrete use cases that rotate daily
const USE_CASES = [
  {
    agentType: 'Research Agent',
    task: 'summarizing 50 articles overnight',
    steps: [
      'Queries /api/search to find relevant articles',
      'Calls /api/summarize on each one (pay-per-call, ~$0.001 each)',
      'Runs /api/sentiment to filter negative or biased sources',
    ],
    outcome: '50 summaries delivered by morning. Total cost: $0.05 in USDC. Zero human intervention.',
    hook: "An AI agent ran 150 API calls last night while you were asleep. It paid for each one in USDC. Nobody approved it.",
  },
  {
    agentType: 'Market Intelligence Agent',
    task: 'monitoring competitor pricing in real-time',
    steps: [
      'Scrapes competitor pages via /api/scrape',
      'Translates foreign-language prices via /api/translate',
      'Sends alerts via /api/notify when thresholds are crossed',
    ],
    outcome: 'Real-time pricing intel. Fully automated. The agent owns its own budget.',
    hook: "Your competitor raised prices 3 hours ago. Your AI agent already knows. It paid $0.003 to find out.",
  },
  {
    agentType: 'Content Automation Agent',
    task: 'generating and publishing blog posts end-to-end',
    steps: [
      'Fetches trending topics via /api/news',
      'Drafts post content via /api/generate',
      'Checks grammar via /api/grammar before publishing',
    ],
    outcome: '3 blog posts live every day. No editor needed. Cost per post: under $0.01 in USDC.',
    hook: "This blog post might have been written by an AI agent that paid for its own tools.",
  },
  {
    agentType: 'Data Enrichment Agent',
    task: 'cleaning and enriching a 10K-row CRM dataset',
    steps: [
      'Resolves company name variations via /api/company-match',
      'Validates emails via /api/validate-email',
      'Geocodes addresses via /api/geocode',
    ],
    outcome: '10,000 rows cleaned in 4 hours. On-chain payment trail for every operation.',
    hook: "What used to take a data team 2 weeks now takes an agent 4 hours. And it pays its own invoice.",
  },
];

export async function execute(options = {}) {
  console.log('[ai-agent-usecase] Preparing use case story...');
  const stats = await fetchStats();

  // Rotate daily
  const dayIndex = new Date().getDay() % USE_CASES.length;
  const useCase = options.useCase || USE_CASES[dayIndex];

  console.log(`[ai-agent-usecase] Use case: ${useCase.agentType}`);

  const stepsText = useCase.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const localContent = `${useCase.hook}\n\nThis is a ${useCase.agentType} on x402 Bazaar — ${useCase.task}.\n\n${stepsText}\n\n${useCase.outcome}`;

  const mainContent = await generateText(
    `Write a compelling short story about an AI agent use case. Hook first — make readers feel they're missing out. ` +
    `Agent type: ${useCase.agentType}. Task: ${useCase.task}. ` +
    `Steps: ${useCase.steps.join(', ')}. Outcome: ${useCase.outcome}. ` +
    `Key angle: agents can autonomously pay per API call with USDC on x402 Bazaar — no human intervention, no credit card, just crypto-native commerce. ` +
    `Tone: concrete, practical, slightly provocative. Max 450 chars.`,
    450,
    localContent
  );

  let imageUrl = null;
  if (config.generateImages) {
    imageUrl = await generateImage(
      `Abstract visualization of an AI agent workflow. Dark background, orange data flow lines connecting API nodes. Minimal, futuristic. No text.`
    );
  }

  const devtoBody = [
    `## ${useCase.agentType}: ${useCase.task}`,
    ``,
    `> ${useCase.hook}`,
    ``,
    mainContent,
    ``,
    `### How it works`,
    ``,
    useCase.steps.map(s => `- ${s}`).join('\n'),
    ``,
    `**Result**: ${useCase.outcome}`,
    ``,
    `### Try it yourself`,
    ``,
    `\`\`\`bash`,
    `npx x402-bazaar init`,
    `\`\`\``,
    ``,
    `All APIs are pay-per-call with USDC on Base. No subscriptions. 95% revenue goes to the API creator.`,
    ``,
    `→ [Browse APIs on x402 Bazaar](${config.projectUrl})`,
  ].join('\n');

  const contents = {
    twitter: adaptForTwitter(`${useCase.hook}\n\n${mainContent}`, stats),
    linkedin: adaptForLinkedIn(`Use Case: ${useCase.agentType}\n\n${mainContent}`, stats),
    discord: adaptForDiscord(`Agent Use Case: ${useCase.agentType}\n\n${mainContent}`, stats, imageUrl),
    telegram: adaptForTelegram(`*Agent Use Case: ${useCase.agentType}*\n\n${mainContent}`, stats, imageUrl),
    farcaster: adaptForFarcaster(`${useCase.hook}\n\n${mainContent}`),
    devto: {
      title: `How a ${useCase.agentType} Pays for Its Own APIs with Crypto`,
      body_markdown: devtoBody,
      tags: ['ai', 'agents', 'api', 'webdev'],
    },
  };

  return { contents, stats, useCase, imageUrl };
}
