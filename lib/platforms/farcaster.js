// Farcaster — Post casts directly via Hub gRPC (free, no Neynar paid plan)
import { config } from '../../config.js';
import {
  NobleEd25519Signer,
  FarcasterNetwork,
  makeCastAdd,
  getSSLHubRpcClient,
} from '@farcaster/hub-nodejs';
import { Message } from '@farcaster/core';

function log(msg) { console.log(`[farcaster] ${msg}`); }

let _signer = null;

function getSigner() {
  if (_signer) return _signer;
  const cfg = config.platforms.farcaster;
  const keyHex = cfg.signerKey || '';
  if (!keyHex) throw new Error('FARCASTER_SIGNER_KEY not set');
  const privateKeyBytes = Buffer.from(keyHex.replace(/^0x/, ''), 'hex');
  _signer = new NobleEd25519Signer(privateKeyBytes);
  return _signer;
}

export async function post(text) {
  const cfg = config.platforms.farcaster;
  if (!cfg.enabled) {
    log('Farcaster not configured — skipping');
    return { success: false, message: 'Not configured', content: text, manualPost: true };
  }

  try {
    const signer = getSigner();
    const fid = cfg.fid || 2788746;
    const castText = text.slice(0, 320);

    // Build the cast message
    log(`Building cast (${castText.length} chars) for FID ${fid}...`);
    const castResult = await makeCastAdd(
      {
        text: castText,
        embeds: [],
        embedsDeprecated: [],
        mentions: [],
        mentionsPositions: [],
      },
      { fid, network: FarcasterNetwork.MAINNET },
      signer
    );

    if (castResult.isErr()) {
      log(`makeCastAdd failed: ${castResult.error}`);
      return { success: false, message: `Build error: ${castResult.error}`, content: text, manualPost: true };
    }

    const cast = castResult.value;
    const castHash = Buffer.from(cast.hash).toString('hex');
    log(`Cast built. Hash: ${castHash}`);

    // Encode and submit to Hub via gRPC
    const messageBytes = Buffer.from(Message.encode(cast).finish());
    const hubUrl = `${cfg.hubHost || 'nemes.farcaster.xyz'}:${cfg.hubPort || 2283}`;
    log(`Submitting to hub ${hubUrl}...`);

    const client = getSSLHubRpcClient(hubUrl);
    const submitResult = await client.submitMessage(messageBytes);
    client.close();

    if (submitResult.isErr()) {
      const errMsg = submitResult.error?.message || String(submitResult.error);
      log(`Hub submission failed: ${errMsg}`);
      return { success: false, message: `Hub error: ${errMsg}`, content: text, manualPost: true };
    }

    const url = `https://warpcast.com/x402bazaar/${castHash.slice(0, 10)}`;
    log(`Cast posted! Hash: ${castHash}`);
    return { success: true, message: `Cast: ${castHash}`, url, hash: castHash };

  } catch (err) {
    log(`Error: ${err.message}`);
    return { success: false, message: err.message, content: text, manualPost: true };
  }
}
