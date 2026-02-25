#!/usr/bin/env node
// setup-google-auth.js — One-time script to get a Google OAuth refresh token
// Run: node setup-google-auth.js
//
// Prerequisites:
//   1. Go to https://console.cloud.google.com/apis/credentials
//   2. Create an OAuth 2.0 Client ID (type: Desktop app)
//   3. Copy the Client ID and Client Secret
//   4. Enable "Generative Language API" at:
//      https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com

import { createServer } from 'http';
import { URL } from 'url';
import { createInterface } from 'readline';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPES = 'https://www.googleapis.com/auth/generative-language https://www.googleapis.com/auth/cloud-platform';
const REDIRECT_PORT = 8976;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}`;

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

async function main() {
  console.log('\n=== Google OAuth Setup for Gemini ===\n');
  console.log('This script will get a refresh token for your Google account.');
  console.log('You need a Google Cloud OAuth Client ID (Desktop app).\n');

  const clientId = await ask('Google Client ID: ');
  const clientSecret = await ask('Google Client Secret: ');

  if (!clientId.trim() || !clientSecret.trim()) {
    console.error('Client ID and Secret are required.');
    process.exit(1);
  }

  // Build authorization URL
  const authUrl = `${AUTH_URL}?` + new URLSearchParams({
    client_id: clientId.trim(),
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
  }).toString();

  console.log('\n1. Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\n2. Log in with your Google account and authorize access.');
  console.log('3. You will be redirected to localhost — the token will be captured automatically.\n');

  // Start local server to catch the redirect
  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<h1>Error: ${error}</h1><p>Close this tab.</p>`);
        reject(new Error(`Auth failed: ${error}`));
      } else if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Success!</h1><p>You can close this tab and go back to the terminal.</p>');
        resolve(code);
      } else {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>No code received</h1>');
      }

      setTimeout(() => server.close(), 500);
    });

    server.listen(REDIRECT_PORT, () => {
      console.log(`Waiting for authorization on port ${REDIRECT_PORT}...`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${REDIRECT_PORT} is in use. Close other apps and retry.`));
      } else {
        reject(err);
      }
    });
  });

  console.log('\nAuthorization code received! Exchanging for tokens...');

  // Exchange code for tokens
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Token exchange failed (${res.status}): ${err}`);
    process.exit(1);
  }

  const tokens = await res.json();

  console.log('\n=== SUCCESS ===\n');
  console.log('Add these to your .env file:\n');
  console.log(`GOOGLE_CLIENT_ID=${clientId.trim()}`);
  console.log(`GOOGLE_CLIENT_SECRET=${clientSecret.trim()}`);
  console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log(`\nAccess token (temporary, auto-refreshed):`);
  console.log(`${tokens.access_token?.slice(0, 30)}...`);
  console.log(`\nExpires in: ${tokens.expires_in}s`);
  console.log('\nDone! The community agent will now use Gemini for content generation.');

  rl.close();
}

main().catch(err => {
  console.error('Error:', err.message);
  rl.close();
  process.exit(1);
});
