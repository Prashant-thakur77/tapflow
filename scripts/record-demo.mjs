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

import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

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
    const [newest] = await (await fetch(`${API}/api/mirrors?limit=1`, { signal: AbortSignal.timeout(40000) })).json();
    const head = await headBlock();
    const behind = head - Number(newest?.block ?? 0);
    console.log(`preflight: newest indexed mirror is ${behind} blocks behind head`);
    if (behind < 60_000) break;
  } catch (e) {
    console.log(`preflight: indexer not answering yet (${String(e).slice(0, 60)})`);
  }
  await new Promise((r) => setTimeout(r, 15000));
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: outDir, size: { width: 1280, height: 800 } } });
await ctx.addInitScript(() => {
  try {
    if (!localStorage.getItem("tapflow")) localStorage.setItem("tapflow", JSON.stringify({ state: { seenHowItWorks: true, asset: "BTC", intervalSec: 300, stake: 5, taps: [] }, version: 2 }));
  } catch {}
});
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
await hold(4500);
await scroll(620);
await hold(4500);

// ── 2 · tap screen ───────────────────────────────────────────────────────
await page.goto(`${APP}/tap`, { waitUntil: "domcontentloaded" });
await waitText("if right", 75000);
await scene("tap");
await hold(5000);
await scroll(380);
await hold(5000);
await scroll(-380);
await hold(800);
const up = page.getByRole("button", { name: /^UP/ }).first();
await up.hover().catch(() => {});
await hold(1300);
const down = page.getByRole("button", { name: /^DOWN/ }).first();
await down.hover().catch(() => {});
await hold(1300);
await page.getByRole("button", { name: "ETH", exact: true }).first().click().catch(() => {});
await hold(4500);

// ── 3 · markets ──────────────────────────────────────────────────────────
await page.goto(`${APP}/markets`, { waitUntil: "domcontentloaded" });
await waitText("LIVE", 60000);
await waitText("→", 60000);
// every card polls its own book on-chain; give most of them time to fill in
await page.locator("text=→").nth(5).waitFor({ timeout: 40000 }).catch(() => {});
await hold(1500);
await scene("markets");
await hold(4000);
await page.getByText("embed", { exact: false }).first().hover().catch(() => {});
await hold(3000);

// ── 4 · leaders ──────────────────────────────────────────────────────────
await page.goto(`${APP}/leaders`, { waitUntil: "domcontentloaded" });
await waitText("Agent leaders", 45000);
await scene("leaders");
await hold(6000);
await scroll(420);
await hold(6000);

// ── 5 · live proof ───────────────────────────────────────────────────────
await page.goto(`${APP}/proof`, { waitUntil: "domcontentloaded" });
await waitText("Latest mirrors", 45000);
await scene("proof");
await hold(5000);
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
// The indexer polls every 15 s and the page refetches every 15 s: allow ~90 s.
// The cut keeps only a few seconds of this wait; scene markers say where.
let rowShown = false;
for (let i = 0; i < 30; i++) {
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
  await hold(11000);
}

// ── 7 · close ────────────────────────────────────────────────────────────
await page.goto(APP, { waitUntil: "domcontentloaded" });
await waitText("PROVEN ON SHANNON", 30000);
await scene("close");
await scroll(620);
await hold(9000);
await scene("end");
await hold(1500);

await ctx.close();
await browser.close();
fs.writeFileSync(path.join(outDir, "scenes.json"), JSON.stringify(scenes, null, 2));
const files = fs.readdirSync(outDir).filter((f) => f.endsWith(".webm"));
console.log("video:", files.map((f) => path.join(outDir, f)).join(", "));
