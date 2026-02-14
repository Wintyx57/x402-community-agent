// Farcaster/Warpcast — Post via Neynar API (free tier)
import { config } from '../../config.js';

function log(msg) { console.log(`[farcaster] ${msg}`); }

export async function post(text) {
  const cfg = config.platforms.farcaster;
  if (!cfg.enabled) {
    log('Farcaster not configured — generate-only mode');
    return { success: false, message: 'Not configured', content: text, manualPost: true };
  }

  // Using Neynar API for Farcaster posting
  // Alternative: direct hub submission with mnemonic
  const res = await fetch('https://api.neynar.com/v2/farcaster/cast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api_key': cfg.mnemonic, // Neynar API key
    },
    body: JSON.stringify({
      signer_uuid: cfg.signerUuid,
      text: text.slice(0, 320),
    }),
  });

  if (res.ok) {
    const data = await res.json();
    log(`Cast published: ${data.cast?.hash}`);
    return { success: true, message: `Cast: ${data.cast?.hash}` };
  }

  const err = await res.text();
  log(`Farcaster post failed: ${res.status} ${err}`);
  return { success: false, message: `HTTP ${res.status}`, content: text, manualPost: true };
}
