// Telegram — Admin preview + Public channel posting
import { config } from '../../config.js';

const API = `https://api.telegram.org/bot${config.platforms.telegram.botToken}`;

function log(msg) { console.log(`[telegram] ${msg}`); }

// Send preview to admin for approval
export async function sendPreview(contents) {
  if (!config.platforms.telegram.enabled) {
    log('Telegram not configured — skipping preview');
    return null;
  }

  let message = `Community Agent — New Post Ready\n\n`;

  for (const [platform, content] of Object.entries(contents)) {
    const text = typeof content === 'string' ? content : (content.text || content.title || JSON.stringify(content));
    // Strip markdown to avoid Telegram parse errors
    const clean = text.replace(/[*_`\[\]]/g, '').slice(0, 500);
    message += `--- ${platform.toUpperCase()} ---\n${clean}\n\n`;
  }

  message += `Reply /approve to post to all platforms\nReply /reject to discard`;

  const res = await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.platforms.telegram.adminChatId,
      text: message,
      disable_web_page_preview: true,
    }),
  });

  const data = await res.json();
  if (!data.ok) log(`Preview send failed: ${JSON.stringify(data)}`);
  else log(`Preview sent to admin (msg ${data.result.message_id})`);
  return data;
}

// Send image to admin
export async function sendImage(imageUrl, caption) {
  if (!config.platforms.telegram.enabled || !imageUrl) return null;

  const res = await fetch(`${API}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.platforms.telegram.adminChatId,
      photo: imageUrl,
      caption: caption?.slice(0, 1024) || '',
      parse_mode: 'Markdown',
    }),
  });
  return res.json();
}

// Post to public channel
export async function postToChannel(text, imageUrl) {
  const channelId = config.platforms.telegram.channelId;
  if (!channelId) {
    log('No TELEGRAM_CHANNEL_ID configured — skipping channel post');
    return null;
  }

  if (imageUrl) {
    const res = await fetch(`${API}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: channelId,
        photo: imageUrl,
        caption: text.slice(0, 1024),
        parse_mode: 'Markdown',
      }),
    });
    const data = await res.json();
    log(data.ok ? `Posted to channel ${channelId} (with image)` : `Channel post failed: ${JSON.stringify(data)}`);
    return data;
  }

  const res = await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: channelId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: false,
    }),
  });
  const data = await res.json();
  log(data.ok ? `Posted to channel ${channelId}` : `Channel post failed: ${JSON.stringify(data)}`);
  return data;
}

// Wait for admin approval (polls for /approve or /reject)
export async function waitForApproval(timeoutMs = 300_000) {
  if (!config.platforms.telegram.enabled) return 'auto';

  log(`Waiting for admin approval (${timeoutMs / 1000}s timeout)...`);
  const start = Date.now();
  let lastUpdateId = 0;

  // Get latest update ID to ignore old messages
  const init = await fetch(`${API}/getUpdates?offset=-1&limit=1`);
  const initData = await init.json();
  if (initData.ok && initData.result.length > 0) {
    lastUpdateId = initData.result[0].update_id + 1;
  }

  while (Date.now() - start < timeoutMs) {
    await new Promise(r => setTimeout(r, 3000)); // Poll every 3s

    const res = await fetch(`${API}/getUpdates?offset=${lastUpdateId}&timeout=2`);
    const data = await res.json();

    if (!data.ok || !data.result.length) continue;

    for (const update of data.result) {
      lastUpdateId = update.update_id + 1;
      const msg = update.message;
      if (!msg || String(msg.chat.id) !== String(config.platforms.telegram.adminChatId)) continue;

      const text = (msg.text || '').trim().toLowerCase();
      if (text === '/approve' || text === 'ok' || text === 'go') {
        log('Admin APPROVED');
        await fetch(`${API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: msg.chat.id, text: 'Publishing to all platforms...' }),
        });
        return 'approved';
      }
      if (text === '/reject' || text === 'no' || text === 'skip') {
        log('Admin REJECTED');
        await fetch(`${API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: msg.chat.id, text: 'Post discarded.' }),
        });
        return 'rejected';
      }
    }
  }

  log('Approval timeout — discarding');
  return 'timeout';
}

// Send completion report to admin
export async function sendReport(results) {
  if (!config.platforms.telegram.enabled) return;

  let msg = `Community Agent Report\n\n`;
  for (const [platform, result] of Object.entries(results)) {
    const icon = result.success ? 'OK' : 'FAIL';
    const message = (result.message || '').replace(/[*_`\[\]()~>#+=|{}.!-]/g, '');
    msg += `${icon} ${platform}: ${message.slice(0, 100)}\n`;
  }
  msg += `\n${new Date().toISOString()}`;

  await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.platforms.telegram.adminChatId,
      text: msg,
    }),
  });
}
