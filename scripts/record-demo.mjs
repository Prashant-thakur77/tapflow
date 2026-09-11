// Records the TapFlow demo against the LIVE site and the LIVE chain.
//
//   node scripts/record-demo.mjs [out-dir]
//
// Scenes follow docs/DEMO-SCRIPT.md. Scene 5 runs scripts/mirror-demo.ts for
// real while the camera rolls: a leader tap, its broadcast, and the follower's
// reactive mirror in the same block, streamed into an overlay on the proof
// page as it happens. The recorder writes scenes.json (scene → start second)
// so the caption file can be timed exactly, and proof.json with the block and
// transaction hashes it produced.
//
// Needs: a funded PRIVATE_KEY in .env (the leader), Chromium for Playwright.

import "dotenv/config";
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createWalletClient, createPublicClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const outDir = process.argv[2] ?? "./video";
fs.mkdirSync(outDir, { recursive: true });
const APP = process.env.DEMO_APP ?? "https://tapflow-phi.vercel.app";
const EXPLORER = "https://shannon-explorer.somnia.network";
const CHROME = process.env.CHROME ?? `${process.env.HOME}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`;

// Preflight: the hosted indexer sleeps when idle and must be caught up, or the
// live mirror will not show in the table while the camera is on it.
const API = process.env.DEMO_API ?? "https://tapflow-indexer.onrender.com";
const RPC = "https://dream-rpc.somnia.network";
async function headBlock() {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }) });
  return Number((await r.json()).result);
}
// The mirror scanner is the one the live scene depends on; the fill scanner
// can lag on a slow host without affecting it.
for (let i = 0; i < 40; i++) {
  try {
    // Ask where the scanner is, not when it last saw a mirror: on a quiet
    // chain the newest mirror can be hours old while the scanner sits at the
    // head, and comparing those two made this wait ten minutes for nothing.
    const h = await (await fetch(`${API}/api/health`, { signal: AbortSignal.timeout(40000) })).json();
    const head = await headBlock();
    const behind = head - Number(h?.lastBlock ?? 0);
    console.log(`preflight: indexer is ${behind} blocks behind head`);
    if (behind < 60_000) break;
  } catch (e) {
    console.log(`preflight: indexer not answering yet (${String(e).slice(0, 60)})`);
  }
  await new Promise((r) => setTimeout(r, 15000));
}

// ── a real wallet in the recording browser ────────────────────────────────
// Playwright cannot drive a MetaMask popup, but the app only needs an EIP-1193
// provider. This one answers reads straight from the Shannon RPC and hands
// writes back to node, where viem signs them with DEMO_WALLET_KEY. So every
// transaction in the take is a real signed transaction from a real wallet —
// the page just never sees the key. Unset the env var and the take is filmed
// disconnected, exactly as before.
const CHAIN_ID = 50312;
const somniaShannon = defineChain({
  id: CHAIN_ID,
  name: "Somnia Shannon",
  nativeCurrency: { name: "Somnia Test Token", symbol: "STT", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  blockExplorers: { default: { name: "Shannon Explorer", url: EXPLORER } },
  testnet: true,
});
const WALLET_KEY = process.env.DEMO_WALLET_KEY ?? process.env.PRIVATE_KEY;
const wallet = WALLET_KEY ? privateKeyToAccount(WALLET_KEY) : null;
const walletClient = wallet ? createWalletClient({ account: wallet, chain: somniaShannon, transport: http(RPC) }) : null;
const publicClient = createPublicClient({ chain: somniaShannon, transport: http(RPC) });
if (wallet) console.log(`wallet in the browser: ${wallet.address}`);

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: outDir, size: { width: 1280, height: 800 } } });
await ctx.addInitScript(() => {
  try {
    if (!localStorage.getItem("tapflow")) localStorage.setItem("tapflow", JSON.stringify({ state: { seenHowItWorks: true, asset: "BTC", intervalSec: 300, stake: 5, taps: [] }, version: 2 }));
  } catch {}
});
// Hand the page a wallet before any script on it runs.
if (wallet) {
  // One at a time, and mined before the next is signed. A real wallet serialises
  // because a person confirms one popup at a time; sending two straight through
  // gave both the same pending nonce and the second was dropped, which is why
  // funding a session stopped halfway.
  let queue = Promise.resolve();
  await ctx.exposeFunction("__tfSend", async (tx) => {
    const run = queue.then(async () => {
      const hash = await walletClient.sendTransaction({
        to: tx.to ?? undefined,
        data: tx.data ?? undefined,
        value: tx.value ? BigInt(tx.value) : undefined,
        gas: tx.gas ? BigInt(tx.gas) : undefined,
      });
      await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 }).catch(() => {});
      console.log(`  wallet → ${hash}`);
      return hash;
    });
    queue = run.then(() => {}, () => {});
    return run;
  });
  await ctx.exposeFunction("__tfSign", async (kind, a, b) => {
    if (kind === "personal_sign") return walletClient.signMessage({ message: { raw: a } });
    return walletClient.signTypedData(typeof b === "string" ? JSON.parse(b) : b);
  });
  await ctx.addInitScript(
    ({ address, chainIdHex, rpc }) => {
      const listeners = {};
      const provider = {
        isMetaMask: true,
        chainId: chainIdHex,
        selectedAddress: address,
        async request({ method, params }) {
          switch (method) {
            case "eth_accounts":
            case "eth_requestAccounts":
              return [address];
            case "eth_chainId":
              return chainIdHex;
            case "net_version":
              return String(parseInt(chainIdHex, 16));
            case "wallet_switchEthereumChain":
            case "wallet_addEthereumChain":
              return null;
            case "wallet_requestPermissions":
            case "wallet_getPermissions":
              return [{ parentCapability: "eth_accounts" }];
            case "eth_sendTransaction":
              return window.__tfSend(params[0]);
            case "personal_sign":
              return window.__tfSign("personal_sign", params[0]);
            case "eth_signTypedData_v4":
              return window.__tfSign("typed", params[0], params[1]);
            default: {
              const r = await fetch(rpc, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params: params ?? [] }),
              });
              const j = await r.json();
              if (j.error) throw Object.assign(new Error(j.error.message), { code: j.error.code });
              return j.result;
            }
          }
        },
        on(ev, fn) { (listeners[ev] ||= []).push(fn); return provider; },
        removeListener(ev, fn) { listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn); return provider; },
      };
      window.ethereum = provider;
      // EIP-6963, so a connector that discovers wallets that way finds it too
      const info = { uuid: "8e2d1f4c-0c1a-4a6f-9f6d-2f3a4b5c6d7e", name: "MetaMask", icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=", rdns: "io.metamask" };
      const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider }) }));
      window.addEventListener("eip6963:requestProvider", announce);
      announce();
    },
    { address: wallet.address, chainIdHex: `0x${CHAIN_ID.toString(16)}`, rpc: RPC },
  );
}

const page = await ctx.newPage();
const t0 = Date.now();
const scenes = [];
// Scene markers are stamped INTO the picture (a 12px square, top-left, one
// colour per scene) because the screencast's clock drifts from wall time by
// tens of seconds over a long take. scripts/cut-demo.mjs reads them back.
// Keep in step with scripts/cut-demo.mjs. No white/grey/black: page corners are those.
const PALETTE = [
  [255, 0, 0], [255, 128, 0], [255, 255, 0], [0, 255, 0], [0, 255, 255], [0, 0, 255], [255, 0, 255], [255, 128, 128],
  [128, 0, 0], [128, 64, 0], [128, 128, 0], [0, 128, 0], [0, 128, 128], [0, 0, 128], [128, 0, 128], [128, 255, 128],
];
const stamp = async (idx) => {
  const [r, g, b] = PALETTE[idx % PALETTE.length];
  await page
    .evaluate(
      ([r, g, b]) => {
        let el = document.getElementById("tf-mark");
        if (!el) {
          el = document.createElement("div");
          el.id = "tf-mark";
          Object.assign(el.style, { position: "fixed", left: "0", top: "0", width: "12px", height: "12px", zIndex: "2147483647", pointerEvents: "none" });
          document.documentElement.appendChild(el);
        }
        el.style.background = `rgb(${r},${g},${b})`;
      },
      [r, g, b],
    )
    .catch(() => {});
};
const scene = async (name) => {
  const at = (Date.now() - t0) / 1000;
  const idx = scenes.length;
  scenes.push({ name, at, idx });
  await stamp(idx);
  console.log(`${at.toFixed(1).padStart(6)}s  #${idx} ${name}`);
};
const hold = (ms) => page.waitForTimeout(ms);
// When the narration has been generated, each scene stays on screen at least as
// long as its lines take to say (plus a beat), so the voiced cut never freezes.
let NARR = {};
try {
  NARR = JSON.parse(fs.readFileSync(path.join(outDir, "..", "video", "tts", "durations.json"), "utf8"));
} catch {
  try { NARR = JSON.parse(fs.readFileSync("video/tts/durations.json", "utf8")); } catch { /* silent take */ }
}
const need = (name) => (NARR[name] ?? []).reduce((a, b) => a + b, 0) * 1000;
/** hold the rest of a scene: `spent` ms already shown, split across `parts` further holds */
const holdFor = async (name, spentMs, fallbackMs) => {
  const total = Math.max(fallbackMs, need(name) + 1500 - spentMs);
  await hold(Math.max(500, total));
};
const scroll = async (y, steps = 14) => {
  for (let i = 1; i <= steps; i++) {
    await page.mouse.wheel(0, y / steps);
    await hold(50);
  }
};
const waitText = (t, ms = 60000) => page.getByText(t, { exact: false }).first().waitFor({ timeout: ms }).catch(() => console.log(`  (no "${t}" within ${ms}ms)`));

// ── overlay: a terminal-style card in the corner, fed by real script output ──
async function overlay(lines, opts = {}) {
  await page.evaluate(
    ({ lines, opts }) => {
      let el = document.getElementById("tf-demo-overlay");
      if (!el) {
        el = document.createElement("div");
        el.id = "tf-demo-overlay";
        Object.assign(el.style, {
          position: "fixed", right: "20px", bottom: "20px", width: "560px", maxHeight: "300px", overflow: "hidden",
          background: "rgba(7,9,15,0.94)", border: "1px solid rgba(46,189,133,0.45)", borderRadius: "14px",
          padding: "12px 14px", font: "12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace", color: "#e8edf7",
          boxShadow: "0 12px 40px rgba(0,0,0,0.6)", zIndex: 99999, whiteSpace: "pre-wrap", wordBreak: "break-all",
        });
        document.body.appendChild(el);
      }
      const head = `<div style="font:700 10px/1 Manrope,sans-serif;letter-spacing:.25em;color:#2ebd85;margin-bottom:8px">${opts.title ?? "LIVE · scripts/mirror-demo.ts"}</div>`;
      el.innerHTML = head + lines.map((l) => (l.startsWith("✅") ? `<div style="color:#2ebd85;font-weight:700;margin-top:6px">${l}</div>` : `<div>${l}</div>`)).join("");
    },
    { lines, opts },
  );
}
const overlayOff = () => page.evaluate(() => document.getElementById("tf-demo-overlay")?.remove());

// ── 1 · landing ──────────────────────────────────────────────────────────
await page.goto(APP, { waitUntil: "domcontentloaded" });
await waitText("live windows", 30000);
await waitText("closes", 30000); // the hero ring has a real window
await scene("landing");
await hold(Math.max(4500, need("landing") * 0.45));
await scroll(620);
await holdFor("landing", Math.max(4500, need("landing") * 0.45) + 1000, 4500);

// ── 2 · tap screen ───────────────────────────────────────────────────────
// With a wallet in the browser this scene is the whole user story end to end:
// connect, fund a capped session wallet, then a real tap that fills on the
// live book — no popup, because the session key signs it.
await page.goto(`${APP}/tap`, { waitUntil: "domcontentloaded" });
await waitText("if right", 75000);
await scene("tap");
// connect first, so the header carries the address and balances all scene
if (wallet) {
  await page.getByRole("button", { name: "CONNECT", exact: true }).first().click({ timeout: 15000 }).catch(() => console.log("  (no CONNECT button)"));
  await page.getByText(wallet.address.slice(2, 6), { exact: false }).first().waitFor({ timeout: 30000 }).catch(() => console.log("  (header never showed the address)"));
}
await hold(Math.max(5000, need("tap") * 0.26));
await scroll(380);
await hold(Math.max(4500, need("tap") * 0.18));
await scroll(-380);
await hold(800);

// the capped session wallet: two signatures here, none afterwards
let oneTap = false;
if (wallet) {
  const enable = page.getByRole("button", { name: /Enable one-tap/i }).first();
  if (await enable.isVisible().catch(() => false)) {
    await enable.click().catch(() => {});
    await hold(2200);
    await page.getByRole("button", { name: /Fund .* & go/i }).first().click({ timeout: 10000 }).catch(() => console.log("  (no fund button)"));
    // The live pill is the only place that says "tUSDC left"; matching on
    // "one-tap" alone also matches the button that opened this modal.
    oneTap = await page
      .getByText(/tUSDC left/i)
      .first()
      .waitFor({ timeout: 120000 })
      .then(() => true)
      .catch(() => false);
    console.log(`  one-tap session: ${oneTap ? "live" : "did not start"}`);
    // Whatever happened, get the dialog off the screen — while it is up it
    // covers the page and swallows the click on UP.
    await page.keyboard.press("Escape").catch(() => {});
    await hold(600);
    const stillOpen = await page.locator("[role=dialog]").first().isVisible().catch(() => false);
    if (stillOpen) {
      await page.locator("[role=dialog] button").first().click({ timeout: 4000 }).catch(() => {});
      await hold(500);
    }
    await hold(1800);
  }
}

// A real tap, placed through the UI. Both sides are disabled when that side of
// the book is empty — "no liquidity" — and a 5-minute window thins out near
// expiry, so take whichever side can actually be filled, and if neither can,
// move to a longer cadence rather than filming a dead button.
if (wallet) {
  const sideButton = async () => {
    for (const name of [/^UP/, /^DOWN/]) {
      const b = page.getByRole("button", { name }).first();
      if (await b.isEnabled().catch(() => false)) return b;
    }
    return null;
  };
  let btn = await sideButton();
  for (const cadence of ["15m", "1h"]) {
    if (btn) break;
    console.log(`  no side tappable — trying ${cadence}`);
    await page.getByRole("button", { name: cadence, exact: true }).first().click({ timeout: 8000 }).catch(() => {});
    await hold(6000);
    btn = await sideButton();
  }
  if (!btn) console.log("  (no tappable side on any cadence)");
  const up = btn ?? page.getByRole("button", { name: /^UP/ }).first();
  await up.hover().catch(() => {});
  await hold(900);
  await up.click({ timeout: 10000 }).catch(() => console.log("  (side not clickable)"));
  const filled = await page
    .getByText(/filled|shares @/i)
    .first()
    .waitFor({ timeout: 60000 })
    .then(() => true)
    .catch(() => false);
  console.log(`  UI tap: ${filled ? "filled" : "no fill on camera"}`);
  await holdFor("tap", Math.max(5000, need("tap") * 0.26) + Math.max(4500, need("tap") * 0.18) + 8000, 6000);
} else {
  const up = page.getByRole("button", { name: /^UP/ }).first();
  await up.hover().catch(() => {});
  await hold(1300);
  const down = page.getByRole("button", { name: /^DOWN/ }).first();
  await down.hover().catch(() => {});
  await hold(1300);
  await page.getByRole("button", { name: "ETH", exact: true }).first().click().catch(() => {});
  await holdFor("tap", Math.max(5000, need("tap") * 0.4) + 1000 + Math.max(5000, need("tap") * 0.3) + 800 + 2600, 4500);
}

// ── 3 · markets ──────────────────────────────────────────────────────────
await page.goto(`${APP}/markets`, { waitUntil: "domcontentloaded" });
await waitText("LIVE", 60000);
await waitText("→", 60000);
// every card polls its own book on-chain; give most of them time to fill in
await page.locator("text=→").nth(5).waitFor({ timeout: 40000 }).catch(() => {});
await hold(1500);
await scene("markets");
await hold(Math.max(4000, need("markets") * 0.45));
await page.getByText("embed", { exact: false }).first().hover().catch(() => {});
await holdFor("markets", Math.max(4000, need("markets") * 0.45), 3000);

// ── 4 · leaders ──────────────────────────────────────────────────────────
await page.goto(`${APP}/leaders`, { waitUntil: "domcontentloaded" });
await waitText("Agent leaders", 45000);
await scene("leaders");
await hold(Math.max(6000, need("leaders") * 0.5));
await scroll(420);
await holdFor("leaders", Math.max(6000, need("leaders") * 0.5) + 900, 6000);

// ── 5 · live proof ───────────────────────────────────────────────────────
await page.goto(`${APP}/proof`, { waitUntil: "domcontentloaded" });
await waitText("Latest mirrors", 45000);
await scene("proof");
await holdFor("proof", 0, 5000);
const before = await page.locator("table tbody tr").first().innerText().catch(() => "");

await scene("mirror-live");
const lines = ["$ npx tsx scripts/mirror-demo.ts", ""];
await overlay(lines);
const proof = { block: null, broadcastTx: null, reactiveTx: null, tapTx: null };
let tick = 15;
await new Promise((resolve) => {
  const child = spawn("npx", ["tsx", "scripts/mirror-demo.ts"], { cwd: path.resolve(new URL(".", import.meta.url).pathname, ".."), env: { ...process.env, TAPFLOW_API: process.env.TAPFLOW_API ?? "http://localhost:8787" } });
  const onLine = async (raw) => {
    const l = raw.replace(/\x1b\[[0-9;]*m/g, "");
    if (!l.trim() || l.startsWith("[tapflow]")) return;
    const m = l.match(/tx\/(0x[0-9a-f]{64})/i);
    if (l.includes("[1] leader tap") && m) proof.tapTx = m[1];
    if (l.includes("[2] broadcast") && m) proof.broadcastTx = m[1];
    if (l.includes("reactive tx") && m) proof.reactiveTx = m[1];
    const b = l.match(/PROVEN — block (\d+)/);
    if (b) proof.block = Number(b[1]);
    lines.push(l.replace(/https:\/\/shannon-explorer\.somnia\.network\/tx\//g, "tx ").slice(0, 110));
    while (lines.length > 14) lines.splice(2, 1);
    await overlay(lines).catch(() => {});
    // A tick marker (two alternating colours) each time a line lands, so the
    // cut can keep the moments something happens and drop the waiting.
    tick = tick === 14 ? 15 : 14;
    await stamp(tick);
  };
  let buf = "";
  child.stdout.on("data", (d) => {
    buf += d.toString();
    const parts = buf.split("\n");
    buf = parts.pop();
    for (const p of parts) void onLine(p);
  });
  child.stderr.on("data", (d) => console.error(String(d).slice(0, 200)));
  child.on("close", () => resolve());
  setTimeout(() => {
    child.kill();
    resolve();
  }, 150_000);
});
console.log("proof:", proof);
fs.writeFileSync(path.join(outDir, "proof.json"), JSON.stringify(proof, null, 2));
await hold(2500);

// Wait for the proof page to refetch (15s) and show the new row at the top.
await scene("mirror-row");
// The indexer polls every 15 s and the page refetches every 15 s, and a busy
// scanner can take a few minutes: allow ~4 min. The cut keeps only a few
// seconds of this wait; the scene markers say where it starts and ends.
let rowShown = false;
for (let i = 0; i < 80; i++) {
  await hold(3000);
  const now = await page.locator("table tbody tr").first().innerText().catch(() => "");
  if (now && now !== before && (!proof.block || now.includes(String(proof.block)))) {
    rowShown = true;
    break;
  }
}
await scene(rowShown ? "mirror-row-ready" : "mirror-row-missing");
await page.evaluate(() => {
  const r = document.querySelector("table tbody tr");
  if (r) {
    r.style.outline = "2px solid #2ebd85";
    r.style.outlineOffset = "-2px";
    r.style.background = "rgba(46,189,133,0.10)";
  }
});
await hold(6000);
await overlayOff();
await hold(1000);

// ── 6 · explorer ─────────────────────────────────────────────────────────
// Blockscout takes 15-40 s to paint; the recorder marks when content is on
// screen and the cut drops the blank stretch before it.
if (proof.reactiveTx) {
  await page.goto(`${EXPLORER}/tx/${proof.reactiveTx}`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
  await page.getByText("Success", { exact: false }).first().waitFor({ timeout: 60000 }).catch(() => {});
  await page.getByText("onEvent", { exact: false }).first().waitFor({ timeout: 30000 }).catch(() => {});
  await hold(1500);
  await scene("explorer-tx");
  await holdFor("explorer-tx", 0, 11000);
}

// ── 7 · close ────────────────────────────────────────────────────────────
await page.goto(APP, { waitUntil: "domcontentloaded" });
await waitText("PROVEN ON SHANNON", 30000);
await scene("close");
await scroll(620);
await holdFor("close", 900, 9000);
await scene("end");
await hold(1500);

await ctx.close();
await browser.close();
fs.writeFileSync(path.join(outDir, "scenes.json"), JSON.stringify(scenes, null, 2));
const files = fs.readdirSync(outDir).filter((f) => f.endsWith(".webm"));
console.log("video:", files.map((f) => path.join(outDir, f)).join(", "));
