// lib/gemini.js — Gemini API client with API key
// Uses generativelanguage.googleapis.com

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash';

function log(msg) {
  console.log(`[gemini] ${msg}`);
}

/**
 * Check if Gemini is configured (API key present).
 */
export function isGeminiConfigured() {
  return !!process.env.GEMINI_API_KEY;
}

/**
 * Generate text using Gemini.
 * @param {string} prompt - The prompt to send
 * @param {object} [options] - Generation options
 * @param {number} [options.maxTokens=1024] - Max output tokens
 * @param {number} [options.temperature=0.8] - Creativity (0-2)
 * @param {string} [options.model] - Model to use (default: gemini-2.5-flash)
 * @returns {Promise<string>} Generated text
 */
export async function generateWithGemini(prompt, options = {}) {
  const {
    maxTokens = 1024,
    temperature = 0.8,
    model = DEFAULT_MODEL,
  } = options;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY');

  const res = await fetch(`${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    throw new Error(`Gemini API error (${res.status}): ${err.slice(0, 200)}`);
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
