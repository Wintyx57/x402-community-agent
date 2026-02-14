// x402 Community Agent — Configuration
export const config = {
  // x402 Bazaar API
  serverUrl: process.env.X402_SERVER_URL || 'https://x402-api.onrender.com',
  maxBudget: parseFloat(process.env.MAX_BUDGET_USDC || '0.50'),

  // Wallet (Base mainnet)
  chain: 'base',
  usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  explorerUrl: 'https://basescan.org',

  // Content
  defaultLanguage: process.env.DEFAULT_LANGUAGE || 'en',
  generateImages: process.env.GENERATE_IMAGES !== 'false',
  projectName: 'x402 Bazaar',
  projectUrl: 'https://x402bazaar.org',
  projectDescription: 'The first autonomous API marketplace for AI agents — pay-per-call with USDC via x402 protocol',

  // Platforms enabled (auto-detected from env vars)
  platforms: {
    telegram: {
      enabled: !!process.env.TELEGRAM_BOT_TOKEN,
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      adminChatId: process.env.TELEGRAM_CHAT_ID,
      channelId: process.env.TELEGRAM_CHANNEL_ID,
    },
    discord: {
      enabled: !!process.env.DISCORD_WEBHOOK_URL,
      webhookUrl: process.env.DISCORD_WEBHOOK_URL,
    },
    twitter: {
      enabled: !!process.env.TWITTER_API_KEY,
      apiKey: process.env.TWITTER_API_KEY,
      apiSecret: process.env.TWITTER_API_SECRET,
      accessToken: process.env.TWITTER_ACCESS_TOKEN,
      accessSecret: process.env.TWITTER_ACCESS_SECRET,
    },
    reddit: {
      enabled: !!process.env.REDDIT_CLIENT_ID,
      clientId: process.env.REDDIT_CLIENT_ID,
      clientSecret: process.env.REDDIT_CLIENT_SECRET,
      username: process.env.REDDIT_USERNAME,
      password: process.env.REDDIT_PASSWORD,
      subreddits: ['artificial', 'webdev', 'SideProject', 'cryptocurrency'],
    },
    devto: {
      enabled: !!process.env.DEVTO_API_KEY,
      apiKey: process.env.DEVTO_API_KEY,
    },
    linkedin: {
      enabled: !!process.env.LINKEDIN_ACCESS_TOKEN,
      accessToken: process.env.LINKEDIN_ACCESS_TOKEN,
    },
    farcaster: {
      enabled: !!process.env.FARCASTER_MNEMONIC,
      mnemonic: process.env.FARCASTER_MNEMONIC,
    },
    hn: {
      enabled: false, // HN has no official posting API — generate-only
    },
  },

  // Schedule (day of week → strategies)
  schedule: {
    monday: ['weekly-recap'],
    tuesday: ['daily-stats'],
    wednesday: ['daily-stats'],
    thursday: ['daily-stats'],
    friday: ['daily-stats'],
    saturday: ['daily-stats'],
    sunday: [],
  },

  // Platform-specific content limits
  limits: {
    twitter: { maxChars: 280, maxImages: 4 },
    reddit: { maxTitleChars: 300, maxBodyChars: 40000 },
    linkedin: { maxChars: 3000 },
    discord: { maxChars: 2000 },
    telegram: { maxChars: 4096 },
    devto: { maxChars: 50000 },
    farcaster: { maxChars: 320 },
    hn: { maxTitleChars: 80 },
  },
};
