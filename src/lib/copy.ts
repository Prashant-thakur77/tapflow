// TapFlow — the deployed copy-trading stack (F3), as the web app sees it.
// Addresses come from contracts/deployments.json, written by the deploy.

import deployments from "../../contracts/deployments.json";

type Addr = `0x${string}`;
const isAddr = (s: string): s is Addr => /^0x[0-9a-fA-F]{40}$/.test(s) && !/^0x0{40}$/.test(s);

export const COPY = {
  router: deployments.router as Addr,
  vault: deployments.mirrorVault as Addr,
  copyHandler: deployments.copyHandler as Addr,
  riskGuard: deployments.riskGuard as Addr,
  subscription: deployments.subscriptions.copyHandler,
};

/** True once the contracts are on-chain (deployments.json filled in). */
export const COPY_DEPLOYED = isAddr(deployments.router) && isAddr(deployments.mirrorVault);

export const MIRROR_VAULT_ABI = [
  { type: "function", name: "deposit", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  {
    type: "function",
    name: "setFollow",
    stateMutability: "nonpayable",
    inputs: [
      { name: "leader", type: "address" },
      { name: "ratioBps", type: "uint32" },
      { name: "maxLoss", type: "uint256" },
    ],
    outputs: [],
  },
  { type: "function", name: "clearFollow", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "followerCount", stateMutability: "view", inputs: [{ name: "leader", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "available", stateMutability: "view", inputs: [{ name: "follower", type: "address" }], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "follows",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "leader", type: "address" },
      { name: "ratioBps", type: "uint32" },
      { name: "maxLoss", type: "uint256" },
      { name: "deposited", type: "uint256" },
      { name: "spent", type: "uint256" },
      { name: "active", type: "bool" },
    ],
  },
] as const;

export const ROUTER_ABI = [
  {
    type: "function",
    name: "broadcast",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "pool", type: "address" },
      { name: "side", type: "uint8" },
      { name: "qty", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "expiryNs", type: "uint64" },
    ],
    outputs: [],
  },
] as const;

export const ERC20_ALLOWANCE_ABI = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;
