// Dev.to — Post articles via API (free)
import { config } from '../../config.js';

function log(msg) { console.log(`[devto] ${msg}`); }

export async function post({ title, body_markdown, published = false, tags = [] }) {
  const cfg = config.platforms.devto;
  if (!cfg.enabled) {
    log('Dev.to not configured — generate-only mode');
    return { success: false, message: 'Not configured', content: { title, body_markdown }, manualPost: true };
  }

  const res = await fetch('https://dev.to/api/articles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': cfg.apiKey,
    },
    body: JSON.stringify({
      article: {
        title: title.slice(0, 150),
        body_markdown,
        published,
        tags: tags.slice(0, 4),
      },
    }),
  });

  if (res.ok) {
    const data = await res.json();
    log(`Article created: ${data.url} (${published ? 'published' : 'draft'})`);
    return { success: true, message: `Article: ${data.url}`, url: data.url };
  }

  const err = await res.text();
  log(`Dev.to post failed: ${res.status} ${err}`);
  return { success: false, message: `HTTP ${res.status}`, manualPost: true };
}
