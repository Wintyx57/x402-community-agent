// x402 Community Agent — Environment Variable Validation
// Validates all required env vars at startup before any strategy runs
// Provides clear feedback on which platforms are configured and which are missing

/**
 * Validation rules for format checking
 */
const validators = {
  ethereumAddress: (val) => /^0x[a-fA-F0-9]{40}$/.test(val),
  url: (val) => /^https?:\/\//.test(val),
  discordWebhook: (val) => /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(val),
  nonEmpty: (val) => typeof val === 'string' && val.trim().length > 0,
};

/**
 * Environment variable requirements by platform
 * Structure: { platformName, envVars: [{ name, validator?, required, description }] }
 */
const platformRequirements = {
  core: {
    label: 'Core Settings',
    critical: true,
    envVars: [
      {
        name: 'X402_SERVER_URL',
        validator: validators.url,
        required: false,
        description: 'x402 API server URL',
        default: 'https://x402-api.onrender.com',
      },
      {
        name: 'MAX_BUDGET_USDC',
        validator: (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
        required: false,
        description: 'Maximum USDC budget for API calls',
        default: '0.50',
      },
    ],
  },
  telegram: {
    label: 'Telegram',
    critical: false,
    envVars: [
      {
        name: 'TELEGRAM_BOT_TOKEN',
        validator: validators.nonEmpty,
        required: true,
        description: 'Telegram bot token',
      },
      {
        name: 'TELEGRAM_CHAT_ID',
        validator: (val) => /^-?\d+$/.test(val),
        required: false,
        description: 'Telegram admin chat ID (for approval notifications)',
      },
      {
        name: 'TELEGRAM_CHANNEL_ID',
        validator: (val) => /^-?\d+$/.test(val),
        required: false,
        description: 'Telegram channel ID (for publishing)',
      },
    ],
  },
  discord: {
    label: 'Discord',
    critical: false,
    envVars: [
      {
        name: 'DISCORD_WEBHOOK_URL',
        validator: validators.discordWebhook,
        required: true,
        description: 'Discord webhook URL',
      },
    ],
  },
  twitter: {
    label: 'Twitter/X',
    critical: false,
    envVars: [
      {
        name: 'TWITTER_API_KEY',
        validator: validators.nonEmpty,
        required: true,
        description: 'Twitter API key',
      },
      {
        name: 'TWITTER_API_SECRET',
        validator: validators.nonEmpty,
        required: true,
        description: 'Twitter API secret',
      },
      {
        name: 'TWITTER_ACCESS_TOKEN',
        validator: validators.nonEmpty,
        required: true,
        description: 'Twitter access token',
      },
      {
        name: 'TWITTER_ACCESS_SECRET',
        validator: validators.nonEmpty,
        required: true,
        description: 'Twitter access secret',
      },
    ],
  },
  reddit: {
    label: 'Reddit',
    critical: false,
    envVars: [
      {
        name: 'REDDIT_CLIENT_ID',
        validator: validators.nonEmpty,
        required: true,
        description: 'Reddit client ID',
      },
      {
        name: 'REDDIT_CLIENT_SECRET',
        validator: validators.nonEmpty,
        required: true,
        description: 'Reddit client secret',
      },
      {
        name: 'REDDIT_USERNAME',
        validator: validators.nonEmpty,
        required: true,
        description: 'Reddit username',
      },
      {
        name: 'REDDIT_PASSWORD',
        validator: validators.nonEmpty,
        required: true,
        description: 'Reddit password',
      },
    ],
  },
  devto: {
    label: 'Dev.to',
    critical: false,
    envVars: [
      {
        name: 'DEVTO_API_KEY',
        validator: validators.nonEmpty,
        required: true,
        description: 'Dev.to API key',
      },
    ],
  },
  linkedin: {
    label: 'LinkedIn',
    critical: false,
    envVars: [
      {
        name: 'LINKEDIN_ACCESS_TOKEN',
        validator: validators.nonEmpty,
        required: true,
        description: 'LinkedIn access token',
      },
    ],
  },
  farcaster: {
    label: 'Farcaster',
    critical: false,
    envVars: [
      {
        name: 'FARCASTER_SIGNER_KEY',
        validator: validators.nonEmpty,
        required: true,
        description: 'Farcaster signer key (hex format)',
      },
      {
        name: 'FARCASTER_FID',
        validator: (val) => /^\d+$/.test(val),
        required: false,
        description: 'Farcaster FID (default: 2788746)',
      },
      {
        name: 'NEYNAR_API_KEY',
        validator: validators.nonEmpty,
        required: false,
        description: 'Neynar API key (optional)',
      },
    ],
  },
};

/**
 * Check if a platform is enabled by examining if its primary env var is set
 */
function isPlatformEnabled(platformKey) {
  const platform = platformRequirements[platformKey];
  if (!platform) return false;

  // Find the primary env var (usually the first required one)
  const primaryVar = platform.envVars.find(v => v.required);
  if (!primaryVar) return false;

  return !!process.env[primaryVar.name];
}

/**
 * Validate environment variables
 * Returns { valid, errors, warnings, summary }
 */
export function validateEnvironment() {
  const errors = [];
  const warnings = [];
  const validatedPlatforms = {};
  let criticalMissing = false;

  console.log('\n========================================');
  console.log('  Environment Validation');
  console.log('========================================\n');

  // Check core requirements (always required)
  console.log('Checking CORE settings...');
  const coreReq = platformRequirements.core;
  const coreErrors = [];
  const coreValid = [];

  for (const envVar of coreReq.envVars) {
    const value = process.env[envVar.name];

    if (value) {
      if (envVar.validator && !envVar.validator(value)) {
        coreErrors.push(`  ✗ ${envVar.name}: Invalid format (${envVar.description})`);
        errors.push({ platform: 'core', var: envVar.name, issue: `Invalid format: ${value}` });
      } else {
        coreValid.push(`  ✓ ${envVar.name}`);
      }
    } else if (envVar.default) {
      coreValid.push(`  ✓ ${envVar.name}: using default (${envVar.default})`);
    } else if (envVar.required) {
      coreErrors.push(`  ✗ ${envVar.name}: Missing (${envVar.description})`);
      errors.push({ platform: 'core', var: envVar.name, issue: 'Required but not set' });
      criticalMissing = true;
    }
  }

  coreValid.forEach(msg => console.log(msg));
  coreErrors.forEach(msg => console.log(msg));
  validatedPlatforms.core = coreErrors.length === 0;

  // Check enabled platforms
  const enabledPlatforms = Object.keys(platformRequirements)
    .filter(key => key !== 'core' && isPlatformEnabled(key));

  if (enabledPlatforms.length === 0) {
    console.log('\nNo additional platforms configured (generate-only mode)\n');
  } else {
    console.log(`\nChecking ${enabledPlatforms.length} ENABLED platform(s)...\n`);

    for (const platformKey of enabledPlatforms) {
      const platform = platformRequirements[platformKey];
      const platformErrors = [];
      const platformValid = [];

      console.log(`[${platform.label}]`);

      for (const envVar of platform.envVars) {
        const value = process.env[envVar.name];

        if (!value) {
          if (envVar.required) {
            platformErrors.push(`  ✗ ${envVar.name}: Missing (${envVar.description})`);
            errors.push({
              platform: platformKey,
              var: envVar.name,
              issue: 'Required but not set',
            });
            if (platform.critical) criticalMissing = true;
          } else if (envVar.default) {
            platformValid.push(`  ✓ ${envVar.name}: using default`);
          }
        } else if (envVar.validator && !envVar.validator(value)) {
          platformErrors.push(`  ✗ ${envVar.name}: Invalid format (${envVar.description})`);
          errors.push({
            platform: platformKey,
            var: envVar.name,
            issue: `Invalid format: ${value}`,
          });
          if (platform.critical) criticalMissing = true;
        } else {
          platformValid.push(`  ✓ ${envVar.name}`);
        }
      }

      platformValid.forEach(msg => console.log(msg));
      platformErrors.forEach(msg => console.log(msg));
      validatedPlatforms[platformKey] = platformErrors.length === 0;
      console.log('');
    }
  }

  // Check for optional platforms with missing credentials
  const optionalPlatforms = Object.keys(platformRequirements)
    .filter(key => key !== 'core' && !isPlatformEnabled(key) && !platformRequirements[key].critical);

  if (optionalPlatforms.length > 0) {
    console.log('Optional platforms (not configured):');
    for (const platformKey of optionalPlatforms) {
      const platform = platformRequirements[platformKey];
      const primaryVar = platform.envVars.find(v => v.required);
      if (primaryVar) {
        console.log(`  - ${platform.label}: set ${primaryVar.name} to enable`);
      }
    }
    console.log('');
  }

  // Summary
  const configuredCount = enabledPlatforms.length;
  const allValid = errors.length === 0;

  console.log('========================================');
  console.log('  SUMMARY');
  console.log('========================================');
  console.log(`Configured platforms: ${configuredCount} / ${Object.keys(platformRequirements).length - 1}`);
  console.log(`Status: ${allValid ? 'ALL VALID ✓' : 'ISSUES FOUND ✗'}`);

  if (errors.length > 0) {
    console.log(`\nValidation errors: ${errors.length}`);
    errors.forEach(err => {
      console.log(`  - [${err.platform}] ${err.var}: ${err.issue}`);
    });
  }

  if (warnings.length > 0) {
    console.log(`\nWarnings: ${warnings.length}`);
    warnings.forEach(warn => console.log(`  - ${warn}`));
  }

  console.log('========================================\n');

  return {
    valid: !criticalMissing && errors.length === 0,
    errors,
    warnings,
    validatedPlatforms,
    summary: {
      configuredPlatforms: enabledPlatforms,
      configuredCount,
      totalIssues: errors.length + warnings.length,
    },
  };
}

/**
 * Validate and exit if critical issues found
 */
export function validateAndExit() {
  const result = validateEnvironment();

  if (!result.valid) {
    console.error('\nCritical validation errors found. Please fix and try again.');
    process.exit(1);
  }

  return result;
}
