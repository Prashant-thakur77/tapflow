// TapFlow — session wallet (F2): one funding popup, then zero popups.
//
// After the user funds a small, capped session wallet held in the browser, every
// tap is signed locally by that wallet — no MetaMask prompt per tap. The session
// expires after 30 minutes; on end or expiry the remaining tUSDC and gas are
// swept back to the owner. The cap bounds the float at risk.
//
// This is the custodial-but-capped variant, which works end-to-end against the
// venue with no extra contracts. The non-custodial upgrade — an operator key
// granted `placeOrderFor` (selector 0x80054449) on the venue pools via the
// OperatorPermissionsRegistry, trading against a manual-mode vault the owner
// funds — is documented in docs/CONTRACTS.md and stubbed in operator.ts; it
// needs on-chain verification with a funded key before it ships.

import { createWalletClient, http, parseEther, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { COLLATERAL, ONE, somniaShannon } from "./config";

export const SESSION_TTL_MS = 30 * 60 * 1000;
export const SESSION_CAP_USDC = 50; // hard ceiling the UI enforces on the fund amount
export const SESSION_GAS_STT = 1.5; // STT sent to the session wallet for gas

export interface Session {
  privateKey: Hex;
  address: `0x${string}`;
  owner: `0x${string}`;
  createdAt: number;
  expiresAt: number;
  capUsdc: number;
}

export const ERC20_ABI = [
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

/** Mint a fresh session wallet bound to an owner, valid for 30 minutes. */
export function newSession(owner: `0x${string}`, capUsdc: number): Session {
  const privateKey = generatePrivateKey();
  const address = privateKeyToAccount(privateKey).address;
  const now = Date.now();
  return {
    privateKey,
    address,
    owner,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
    capUsdc: Math.min(capUsdc, SESSION_CAP_USDC),
  };
}

export const isLive = (s: Session | null): s is Session => !!s && s.expiresAt > Date.now();

export const remainingMs = (s: Session | null) => (s ? Math.max(0, s.expiresAt - Date.now()) : 0);

/** A viem wallet client that signs as the session wallet (for sweeping). */
export function sessionWallet(s: Session) {
  return createWalletClient({ account: privateKeyToAccount(s.privateKey), chain: somniaShannon, transport: http() });
}

/** tUSDC raw amount to fund, from a human cap. */
export const capRaw = (capUsdc: number) => BigInt(Math.round(Math.min(capUsdc, SESSION_CAP_USDC) * Number(ONE)));

export const gasWei = () => parseEther(String(SESSION_GAS_STT));

export { COLLATERAL };
