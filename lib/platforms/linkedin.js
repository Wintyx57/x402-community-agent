// LinkedIn — Post via API (free, needs OAuth2 token)
import { config } from '../../config.js';

function log(msg) { console.log(`[linkedin] ${msg}`); }

export async function post(text) {
  const cfg = config.platforms.linkedin;
  if (!cfg.enabled) {
    log('LinkedIn not configured — generate-only mode');
    return { success: false, message: 'Not configured', content: text, manualPost: true };
  }

  // Get user profile to get the person URN
  const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: { 'Authorization': `Bearer ${cfg.accessToken}` },
  });
  const profile = await profileRes.json();
  const personUrn = `urn:li:person:${profile.sub}`;

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: text.slice(0, 3000) },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  });

  if (res.ok || res.status === 201) {
    const data = await res.json();
    log(`Posted to LinkedIn: ${data.id}`);
    return { success: true, message: `Posted: ${data.id}` };
  }

  const err = await res.text();
  log(`LinkedIn post failed: ${res.status} ${err}`);
  return { success: false, message: `HTTP ${res.status}`, content: text, manualPost: true };
}
