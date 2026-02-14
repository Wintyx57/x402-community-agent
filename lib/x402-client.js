// x402 API Client — handles automatic x402 payment flow
import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { config } from '../config.js';

const USDC_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
]);

let account = null;
let publicClient = null;
let walletClient = null;
let sessionSpending = 0;
const payments = [];

function initWallet() {
  if (account) return;
  const key = process.env.AGENT_PRIVATE_KEY;
  if (!key) throw new Error('AGENT_PRIVATE_KEY not set');
  const pk = key.startsWith('0x') ? key : `0x${key}`;
  account = privateKeyToAccount(pk);
  publicClient = createPublicClient({ chain: base, transport: http() });
  walletClient = createWalletClient({ account, chain: base, transport: http() });
  log(`Wallet initialized: ${account.address}`);
}

function log(msg) {
  console.log(`[x402-client] ${msg}`);
}

// Call an x402 API with automatic payment handling
export async function callApi(endpoint, options = {}) {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${config.serverUrl}${endpoint}`;

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // Normal response — no payment needed
  if (res.status !== 402) {
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { response: text }; }
  }

  // x402 Payment Required
  let body;
  try { body = await res.json(); } catch {
    throw new Error('API returned 402 but response is not valid JSON');
  }

  const details = body.payment_details;
  if (!details?.amount || !details?.recipient) {
    throw new Error(`Non-standard 402 response: ${JSON.stringify(body)}`);
  }

  const cost = parseFloat(details.amount);

  // Budget check
  if (sessionSpending + cost > config.maxBudget) {
    throw new Error(
      `Budget limit reached: ${sessionSpending.toFixed(4)}/${config.maxBudget} USDC. ` +
      `This call costs ${cost} USDC.`
    );
  }

  initWallet();

  // Send USDC payment on-chain
  log(`Paying ${cost} USDC to ${details.recipient}...`);
  const amountInUnits = BigInt(Math.round(cost * 1e6));
  let txHash;
  try {
    txHash = await walletClient.writeContract({
      address: config.usdcAddress,
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [details.recipient, amountInUnits],
    });
  } catch (err) {
    const msg = err.message?.includes('insufficient funds')
      ? `Insufficient funds in wallet ${account.address} — need ${cost} USDC + gas`
      : err.shortMessage || err.message?.split('\n')[0] || 'Transaction failed';
    throw new Error(msg);
  }

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: 120_000,
  });

  if (receipt.status !== 'success') {
    throw new Error(`Payment transaction failed: ${txHash}`);
  }

  sessionSpending += cost;
  payments.push({ amount: cost, txHash, endpoint: url, timestamp: new Date().toISOString() });
  log(`Paid ${cost} USDC — tx: ${config.explorerUrl}/tx/${txHash}`);

  // Retry with payment proof
  const retryRes = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Payment-TxHash': txHash,
      'X-Payment-Chain': 'base',
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const retryText = await retryRes.text();
  try { return JSON.parse(retryText); } catch { return { response: retryText }; }
}

// Call a free API (no payment)
export async function callFreeApi(endpoint) {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${config.serverUrl}${endpoint}`;
  const res = await fetch(url);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { response: text }; }
}

// Get wallet balance
export async function getBalance() {
  initWallet();
  const balance = await publicClient.readContract({
    address: config.usdcAddress,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });
  return {
    address: account.address,
    balanceUsdc: (Number(balance) / 1e6).toFixed(6),
    sessionSpent: sessionSpending.toFixed(4),
    sessionRemaining: (config.maxBudget - sessionSpending).toFixed(4),
    payments,
  };
}

export function getSpending() {
  return { spent: sessionSpending, remaining: config.maxBudget - sessionSpending, payments };
}
