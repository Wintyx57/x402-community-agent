// Discord — Post via webhook (free, no auth needed)
import { config } from '../../config.js';

function log(msg) { console.log(`[discord] ${msg}`); }

export async function post(embed) {
  if (!config.platforms.discord.enabled) {
    log('Discord not configured — skipping');
    return { success: false, message: 'Not configured' };
  }

  const body = typeof embed === 'string'
    ? { content: embed.slice(0, 2000) }
    : embed;

  const res = await fetch(config.platforms.discord.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.ok || res.status === 204) {
    log('Posted to Discord');
    return { success: true, message: 'Posted' };
  }

  const err = await res.text();
  log(`Discord post failed: ${res.status} ${err}`);
  return { success: false, message: `HTTP ${res.status}: ${err}` };
}
