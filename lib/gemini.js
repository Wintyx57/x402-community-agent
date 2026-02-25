// lib/gemini.js — Gemini API client with Google OAuth refresh token
// Uses generativelanguage.googleapis.com with Bearer token

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

let cachedToken = null;
let tokenExpiry = 0;

function log(msg) {
  console.log(`[gemini] ${msg}`);
}

/**
 * Get a fresh access token using the refresh token.
 * Caches the token until it expires.
 */
async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60_000) {
    return cachedToken;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REFRESH_TOKEN');
  }

  log('Refreshing access token...');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
  log('Access token refreshed OK');
  return cachedToken;
}

/**
 * Check if Gemini is configured (all env vars present).
 */
export function isGeminiConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN);
}

/**
 * Generate text using Gemini.
 * @param {string} prompt - The prompt to send
 * @param {object} [options] - Generation options
 * @param {number} [options.maxTokens=1024] - Max output tokens
 * @param {number} [options.temperature=0.8] - Creativity (0-2)
 * @param {string} [options.model='gemini-2.0-flash'] - Model to use
 * @returns {Promise<string>} Generated text
 */
export async function generateWithGemini(prompt, options = {}) {
  const {
    maxTokens = 1024,
    temperature = 0.8,
    model = 'gemini-2.0-flash',
  } = options;

  const token = await getAccessToken();

  const res = await fetch(`${GEMINI_API_URL}/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini returned empty response');
  }

  return text.trim();
}

/**
 * Translate text using Gemini.
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language code (e.g. 'fr', 'es')
 * @returns {Promise<string>} Translated text
 */
export async function translateWithGemini(text, targetLang = 'fr') {
  return generateWithGemini(
    `Translate the following text to ${targetLang}. Return ONLY the translation, nothing else.\n\n${text}`,
    { temperature: 0.3, maxTokens: 2048 }
  );
}

/**
 * Analyze sentiment using Gemini.
 * @param {string} text - Text to analyze
 * @returns {Promise<string>} 'positive', 'negative', or 'neutral'
 */
export async function analyzeSentimentWithGemini(text) {
  const result = await generateWithGemini(
    `Analyze the sentiment of the following text. Reply with exactly one word: positive, negative, or neutral.\n\n${text}`,
    { temperature: 0, maxTokens: 10 }
  );
  const lower = result.toLowerCase().trim();
  if (['positive', 'negative', 'neutral'].includes(lower)) return lower;
  return 'neutral';
}
