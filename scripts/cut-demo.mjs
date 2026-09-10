// Cuts the raw recording from scripts/record-demo.mjs into the demo video.
//
//   node scripts/cut-demo.mjs [video-dir] [out.mp4]
//
// The recorder stamps a 12px colour square (one colour per scene) into the
// top-left of the picture, because the screencast's clock drifts from wall
// time. This script reads those squares back from the frames, so every cut
// and caption is placed on what is actually on screen. It drops the blank
// stretches while pages load (the block explorer takes 15-40 s to paint),
// keeps only a few seconds of the wait for the indexer to pick up the live
// mirror, and burns the script lines in as captions. Needs ffmpeg.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2] ?? "./video";
const out = process.argv[3] ?? "docs/media/tapflow-demo.mp4";
const scenes = JSON.parse(fs.readFileSync(path.join(dir, "scenes.json"), "utf8"));
const proof = JSON.parse(fs.readFileSync(path.join(dir, "proof.json"), "utf8"));
const src = fs.existsSync(path.join(dir, "raw.mp4")) ? path.join(dir, "raw.mp4") : path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith(".webm")));

const PALETTE = [
  [255, 0, 0], [255, 128, 0], [255, 255, 0], [0, 255, 0], [0, 255, 255], [0, 0, 255], [255, 0, 255], [255, 128, 128],
  [128, 0, 0], [128, 64, 0], [128, 128, 0], [0, 128, 0], [0, 128, 128], [0, 0, 128], [128, 0, 128], [128, 255, 128],
];
const FPS = 5;

// ── read the markers back from the picture ────────────────────────────────
const raw = execFileSync("ffmpeg", ["-loglevel", "error", "-i", src, "-vf", `fps=${FPS},crop=12:12:0:0,scale=1:1:flags=area`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1 << 26 });
const samples = [];
for (let i = 0; i + 2 < raw.length; i += 3) {
  const [r, g, b] = [raw[i], raw[i + 1], raw[i + 2]];
  let best = -1, bd = Infinity;
  PALETTE.forEach(([pr, pg, pb], k) => {
    const d = Math.hypot(r - pr, g - pg, b - pb);
    if (d < bd) { bd = d; best = k; }
  });
  samples.push(bd < 70 ? best : -1);
}
const duration = samples.length / FPS;
// runs of the same marker
const runs = [];
for (let i = 0; i < samples.length; i++) {
  const v = samples[i];
  const last = runs[runs.length - 1];
  if (last && last.idx === v) last.end = (i + 1) / FPS;
  else runs.push({ idx: v, start: i / FPS, end: (i + 1) / FPS });
}
// drop flicker: a run shorter than 0.6 s takes its neighbour's value
const clean = [];
for (const r of runs) {
  if (r.end - r.start < 0.6 && clean.length) { clean[clean.length - 1].end = r.end; continue; }
  clean.push({ ...r });
}
const nameOf = (idx) => scenes.find((s) => s.idx === idx)?.name ?? `#${idx}`;
console.log(`video ${duration.toFixed(1)}s, markers:`);
for (const r of clean) console.log(`  ${r.start.toFixed(1).padStart(6)} → ${r.end.toFixed(1).padStart(6)}  ${r.idx < 0 ? "(none)" : nameOf(r.idx)}`);
const firstSeen = (name) => clean.find((r) => r.idx >= 0 && nameOf(r.idx) === name)?.start;

// ── what to drop ──────────────────────────────────────────────────────────
const drops = [];
// blank/loading stretches: no marker for more than 3 s (keep the last second so the cut lands on a painted page)
for (const r of clean) if (r.idx < 0 && r.end - r.start > 3) drops.push([r.start, r.end - 0.4]);
// tick markers (14/15) inside the live scene: keep 4.5 s after each new line, drop the waiting
const TICKS = new Set([14, 15]);
for (const r of clean) if (TICKS.has(r.idx) && r.end - r.start > 5.5) drops.push([r.start + 4.5, r.end - 1]);
// the indexer wait: keep 5 s of it and the second before the row lands
const rowA = firstSeen("mirror-row"), rowB = firstSeen("mirror-row-ready") ?? firstSeen("mirror-row-missing");
if (rowA !== undefined && rowB !== undefined && rowB - rowA > 7) drops.push([rowA + 5, rowB - 1]);
// anything after the end marker
const endAt = firstSeen("end");
if (endAt !== undefined && duration > endAt + 1.5) drops.push([endAt + 1.5, duration]);
drops.sort((x, y) => x[0] - y[0]);
const keeps = [];
let cursor = 0;
for (const [a, b] of drops) {
  if (a > cursor + 0.2) keeps.push([cursor, a]);
  cursor = Math.max(cursor, b);
}
if (duration > cursor + 0.2) keeps.push([cursor, duration]);
const removedBefore = (t) => drops.reduce((acc, [a, b]) => acc + (t >= b ? b - a : t > a ? t - a : 0), 0);
const map = (t) => t - removedBefore(t);
const total = keeps.reduce((s, [a, b]) => s + (b - a), 0);
console.log(`cut ${total.toFixed(1)}s (${drops.length} drops, ${keeps.length} segments)`);

// ── captions ──────────────────────────────────────────────────────────────
const LINES = {
  landing: [
    "This is TapFlow. Every live DreamDEX Event Contract becomes a one-tap UP or DOWN call on Somnia Shannon.",
    "Real orders on a real on-chain book. Nothing simulated.",
    "The part nobody else has: when a leader taps, followers are filled in the SAME BLOCK — Somnia's reactivity precompile calls our contract. No keeper. No relayer.",
  ],
  tap: [
    "One window: the countdown, the price against the open, and the crowd's odds.",
    "Tap UP or DOWN and your stake becomes an immediate-or-cancel order on the live book, sized on the venue's own tick and lot grid.",
    "The crowd-odds line comes from one-minute candles. Top positions are read from the pool's own logs — the upstream indexer lags by up to 100 minutes.",
    "The chips show your payout, not just the odds. Fund a capped session wallet once and every tap signs itself. No popups. Arrow keys tap.",
  ],
  markets: ["Every live window on the venue as a card, with quick taps.", "Any Somnia app can embed a card in an iframe — the embed button copies the snippet."],
  leaders: [
    "The leaderboard is built from chain, ranked by realized profit on settled windows.",
    "TapBot is our agent: a momentum strategy that taps as a public leader you can follow like any human. 50+ real taps, a settled record, every copy on-chain.",
    "When it does NOT trade, it says why: price above 90¢, spread wider than the edge, cooling down. Every hold is published with its reason code.",
  ],
  proof: ["This page pairs every reactive mirror with the broadcast that triggered it. Let's add one now, live."],
  "mirror-live": [
    "A real leader tap goes in. It fills. It is broadcast through the Router…",
    "…and the follower's order is placed by the CopyHandler contract, from the follower's vault, in the SAME BLOCK.",
  ],
  "mirror-row": ["The indexer picks it up from chain: the new row lands at the top with both transactions and the block number."],
  "mirror-row-ready": [`Block ${proof.block ?? "…"}: leader broadcast and follower mirror, one block. A row that placed nothing is the safety rail — the vault declined on the follower's own max-loss cap.`],
  "mirror-row-missing": ["The indexer will pair this mirror with its broadcast on its next pass, as it has for every one before it."],
  "explorer-tx": [`On the Shannon explorer: block ${proof.block ?? "…"}, status Success, method onEvent, sent FROM the CopyHandler contract.`, "No externally owned account signed this. That is Somnia reactivity placing a follower's trade in the leader's block."],
  close: [
    "Followers redeem mirrored winnings through the vault. A Telegram bot exposes the same flow.",
    "Everything you saw is a real transaction on Shannon. Code, contracts and a 20-item SDK feedback report are in the repo. TapFlow.",
  ],
};
const marks = clean.filter((r) => r.idx >= 0).map((r) => ({ name: nameOf(r.idx), start: r.start, end: r.end }));
const ts = (t) => {
  const ms = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), x = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(x).padStart(3, "0")}`;
};
const srt = [];
let n = 1;
marks.forEach((m, i) => {
  const lines = LINES[m.name];
  if (!lines) return;
  const a = map(m.start);
  const next = marks.slice(i + 1).find((x) => LINES[x.name] || x.name === "end");
  const b = next ? map(next.start) : total;
  const per = Math.max(b - a, 2.5 * lines.length) / lines.length;
  lines.forEach((text, k) => {
    const s = a + k * per, e = Math.min(a + (k + 1) * per - 0.15, total);
    if (e > s) srt.push(`${n++}\n${ts(s)} --> ${ts(e)}\n${text}\n`);
  });
});
const srtPath = path.join(dir, "captions.srt");
fs.writeFileSync(srtPath, srt.join("\n"));
console.log(`captions: ${srt.length} cues`);

// ── ffmpeg: trim + concat, cover the marker, burn captions ─────────────────
const parts = keeps.map((k, i) => `[0:v]trim=start=${k[0].toFixed(3)}:end=${k[1].toFixed(3)},setpts=PTS-STARTPTS[v${i}]`);
const concat = `${keeps.map((_, i) => `[v${i}]`).join("")}concat=n=${keeps.length}:v=1:a=0[vc]`;
const cover = `[vc]drawbox=x=0:y=0:w=12:h=12:color=#0b101c@1:t=fill[vd]`;
const style = "FontName=DejaVu Sans,FontSize=8,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,BackColour=&HA0000000,Outline=1,Shadow=0,MarginV=22,MarginL=60,MarginR=60,Alignment=2";
const sub = `[vd]subtitles='${srtPath.replace(/'/g, "\\'")}':force_style='${style}'[vo]`;
const enc = ["-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
fs.mkdirSync(path.dirname(out), { recursive: true });
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-filter_complex", [...parts, concat, cover, sub].join(";"), "-map", "[vo]", ...enc, out], { stdio: "inherit" });
const silent = out.replace(/\.mp4$/, "-silent.mp4");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-filter_complex", [...parts, concat, cover].join(";"), "-map", "[vd]", ...enc, silent], { stdio: "inherit" });
console.log(`wrote ${out} (captioned) and ${silent} (for narration)`);
