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
//
// When scripts/tts.py has been run (<video-dir>/tts/durations.json exists) it
// also lays the narration under the picture, one segment per spoken line:
// a line that outruns its picture freezes the last frame, a picture longer
// than its line keeps playing over silence. A phone clip at
// docs/media/telegram.mp4, if present, is spliced in before the closing scene.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { LINES } from "./demo-lines.mjs";

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
const W = 1280, H = 800;
const TELEGRAM = "docs/media/telegram.mp4";
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: "inherit" });
const probe = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).trim());

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
for (const r of clean) if (r.idx < 0 && r.end - r.start > 3) drops.push([r.start, r.end]); // the next marker is only stamped once the page is painted
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

// ── the silent cut: trim + concat, cover the marker ────────────────────────
const parts = keeps.map((k, i) => `[0:v]trim=start=${k[0].toFixed(3)}:end=${k[1].toFixed(3)},setpts=PTS-STARTPTS[v${i}]`);
const concat = `${keeps.map((_, i) => `[v${i}]`).join("")}concat=n=${keeps.length}:v=1:a=0[vc]`;
const cover = `[vc]drawbox=x=0:y=0:w=12:h=12:color=#0b101c@1:t=fill,fps=25[vd]`;
const enc = ["-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
fs.mkdirSync(path.dirname(out), { recursive: true });
const silent = out.replace(/\.mp4$/, "-silent.mp4");
ff(["-i", src, "-filter_complex", [...parts, concat, cover].join(";"), "-map", "[vd]", ...enc, silent]);
console.log(`wrote ${silent} (picture only)`);

// ── captions ──────────────────────────────────────────────────────────────
const ts = (t) => {
  const cs = Math.max(0, Math.round(t * 100));
  const h = Math.floor(cs / 360000), m = Math.floor((cs % 360000) / 6000), s = Math.floor((cs % 6000) / 100), x = cs % 100;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(x).padStart(2, "0")}`;
};
// A spoken line is too long to read in one go, so it becomes several caption
// lines. Pick the breaks the way a person would: lines near a comfortable
// length, never wider than the plate, and ending where the sentence ends.
const IDEAL = 38, MAXC = 46, MIDPHRASE = 400, SHORT = 0.35;
const chunk = (text) => {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= MAXC) return [t];
  const w = t.split(" "), n = w.length;
  const dp = Array(n + 1).fill(Infinity), back = Array(n + 1).fill(0);
  dp[0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let s = i - 1; s >= 0; s--) {
      const line = w.slice(s, i).join(" ");
      if (line.length > MAXC) break;
      if (dp[s] === Infinity) continue;
      const d = line.length - IDEAL;
      let cost = dp[s] + (d > 0 ? d * d : SHORT * d * d);
      if (i < n && !/[,:;.!?—]$/.test(line)) cost += MIDPHRASE; // breaking mid-phrase reads worse than an uneven line
      if (cost < dp[i]) { dp[i] = cost; back[i] = s; }
    }
  }
  const out = [];
  for (let i = n; i > 0; i = back[i]) out.unshift(w.slice(back[i], i).join(" "));
  return out;
};

// Captions are written as ASS rather than SRT so they can carry the product's
// own typeface and a plate that reads on both the dark app and the white block
// explorer: one line per cue, white Manrope on a near-opaque panel, no shadow.
const assPath = path.join(dir, "captions.ass");
const FONTS = path.resolve(new URL(".", import.meta.url).pathname, "fonts");
const ASS_HEAD = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Manrope,32,&H00FFFFFF,&H00FFFFFF,&H261C120B,&H70000000,-1,0,0,0,100,100,0.8,0,3,14,0,2,80,80,54,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
const writeCaptions = (cues) => {
  const body = cues
    .filter((c) => c.end > c.start + 0.2)
    .map((c) => `Dialogue: 0,${ts(c.start)},${ts(c.end)},Cap,,0,0,0,,{\\fad(90,90)}${c.text.replace(/\n/g, " ")}`)
    .join("\n");
  fs.writeFileSync(assPath, ASS_HEAD + body + "\n");
  console.log(`captions: ${cues.length} cues → ${assPath}`);
};
const burn = (input, dest, extra = []) =>
  ff(["-i", input, "-vf", `subtitles='${assPath.replace(/'/g, "\\'")}':fontsdir='${FONTS}'`, ...enc, ...extra, dest]);

const marks = clean.filter((r) => r.idx >= 0).map((r) => ({ name: nameOf(r.idx), start: r.start, end: r.end }));
const named = marks.filter((m, i) => (LINES[m.name] || m.name === "end") && marks.findIndex((x) => x.name === m.name) === i);

// ── no narration: the old silent-with-captions cut ────────────────────────
// the narration lives in <video-dir>/tts, or in ./video/tts when a take was
// recorded into a second directory against the same voice track
const ttsDir = fs.existsSync(path.join(dir, "tts", "durations.json")) ? path.join(dir, "tts") : "video/tts";
const durPath = path.join(ttsDir, "durations.json");
if (!fs.existsSync(durPath)) {
  const cues = [];
  named.forEach((m, i) => {
    const lines = LINES[m.name];
    if (!lines) return;
    const a = map(m.start), b = i + 1 < named.length ? map(named[i + 1].start) : total;
    const per = Math.max(b - a, 2.5 * lines.length) / lines.length;
    lines.forEach((text, k) => cues.push({ start: a + k * per, end: Math.min(a + (k + 1) * per - 0.15, total), text }));
  });
  writeCaptions(cues);
  burn(silent, out);
  console.log(`wrote ${out} (captioned, no narration — run scripts/tts.py for voice)`);
  process.exit(0);
}

// ── narration: one segment per spoken line ────────────────────────────────
const D = JSON.parse(fs.readFileSync(durPath, "utf8"));
// Pacing. These four numbers decide how much of the film is dead air: the old
// values left ~2.8s of silence after every single line, which added up to 50s
// of a 249s cut — a fifth of it, and it felt like waiting rather than watching.
// A breath between lines, not a pause.
const LEAD = 0.10;   // a beat before the voice starts
const TAIL = 0.25;   // and after it ends
const SLACK = 0.35;  // the most silence a shot may hold after its line ends
const segs = [];
const firstStart = named.length ? map(named[0].start) : 0;
if (firstStart > 0.3) segs.push({ kind: "pic", a: 0, b: firstStart });
named.forEach((m, i) => {
  const a = map(m.start), b = i + 1 < named.length ? map(named[i + 1].start) : total;
  const lines = LINES[m.name] ?? [];
  if (!lines.length) { if (b - a > 0.2) segs.push({ kind: "pic", a, b }); return; }
  const durs = D[m.name] ?? lines.map(() => 0);
  const weights = lines.map((_, k) => Math.max(durs[k] ?? 0, 0.5));
  const sum = weights.reduce((x, y) => x + y, 0);
  let cur = a;
  lines.forEach((text, k) => {
    const pb = k === lines.length - 1 ? b : cur + (b - a) * (weights[k] / sum);
    // A scene can sit on screen far longer than its line takes to say (a page
    // that was slow to settle, a hover that timed out). Keep the head of the
    // shot and drop the tail rather than play half a minute of silence.
    const keep = Math.min(pb - cur, (durs[k] ?? 0) + LEAD + SLACK);
    segs.push({ kind: "line", scene: m.name, k, text, a: cur, b: cur + keep, wav: path.join(ttsDir, `${m.name}-${k}.wav`), audio: durs[k] ?? 0 });
    cur = pb;
  });
});
// The phone clip, before the closing scene. Its lines are spread across the
// clip the way a scene's lines are spread across its shot: each line gets a
// slice of the footage. A clip longer than the narration plays faster (up to
// 1.8x) so all of it is seen rather than the tail being cut off; a clip shorter
// than the narration holds its last frame.
if (fs.existsSync(TELEGRAM) && LINES.telegram?.length) {
  const lines = LINES.telegram;
  const durs = D.telegram ?? lines.map(() => 0);
  const clipLen = probe(TELEGRAM);
  const need = durs.reduce((a, b) => a + b, 0) + LEAD + TAIL;
  const speed = Math.min(Math.max(clipLen / Math.max(need, 1), 1), 1.8);
  const shown = Math.min(clipLen / speed, need); // seconds of finished picture
  const weights = lines.map((_, k) => Math.max(durs[k] ?? 0, 0.5));
  const sum = weights.reduce((a, b) => a + b, 0);
  const at = segs.findIndex((x) => x.scene === "close");
  let outAt = 0;
  const clipSegs = lines.map((text, k) => {
    const p = k === lines.length - 1 ? shown - outAt : (shown * weights[k]) / sum;
    const seg = {
      kind: "clip", file: TELEGRAM, scene: "telegram", k, text,
      srcStart: outAt * speed, srcLen: Math.min(p * speed, Math.max(clipLen - outAt * speed, 0.1)), speed, picture: p,
      wav: path.join(ttsDir, `telegram-${k}.wav`), audio: durs[k] ?? 0,
    };
    outAt += p;
    return seg;
  });
  segs.splice(at < 0 ? segs.length : at, 0, ...clipSegs);
  console.log(`splicing ${TELEGRAM}: ${clipLen.toFixed(1)}s of footage at ${speed.toFixed(2)}x over ${lines.length} lines (${shown.toFixed(1)}s on screen)`);
} else if (LINES.telegram) {
  console.log(`no ${TELEGRAM} — skipping the Telegram scene`);
}

// ── the two cards ──────────────────────────────────────────────────────────
// A title to open on and a card of links to end on. Drawn here rather than
// recorded, so they carry the same type as the captions and can be rebuilt
// from the facts in this repo.
const FONT_B = path.join(FONTS, "Manrope-Bold.ttf");
const FONT_S = path.join(FONTS, "Manrope-SemiBold.ttf");
const esc = (t) => t.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\u2019").replace(/%/g, "\\%");
const line = (text, size, y, color, font = FONT_S) =>
  `drawtext=fontfile='${font}':text='${esc(text)}':fontsize=${size}:fontcolor=${color}:x=(w-tw)/2:y=${y}`;
const card = (dur, draws, dest) =>
  ff(["-f", "lavfi", "-i", `color=c=#0a0e18:s=${W}x${H}:r=25:d=${dur.toFixed(2)}`, "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono",
      "-vf", draws.join(","), "-map", "0:v", "-map", "1:a", "-t", dur.toFixed(2), ...SEG_ENC, dest]);

// build each segment as its own file, so every one can stretch on its own
const segDir = path.join(dir, "seg");
fs.rmSync(segDir, { recursive: true, force: true });
fs.mkdirSync(segDir, { recursive: true });
const SEG_ENC = ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "25", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "1", "-video_track_timescale", "12800"];
const AFMT = "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=mono";
const cues = [];
let at = 0;
segs.forEach((s, i) => {
  const file = path.join(segDir, `${String(i).padStart(3, "0")}.mp4`);
  const wavOk = s.wav && fs.existsSync(s.wav);
  const spoken = wavOk ? (s.audio || probe(s.wav)) : 0;
  if (s.kind === "pic") {
    const p = s.b - s.a;
    ff(["-ss", s.a.toFixed(3), "-t", p.toFixed(3), "-i", silent, "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono",
      "-map", "0:v", "-map", "1:a", "-t", p.toFixed(3), ...SEG_ENC, file]);
    at += p;
    return;
  }
  const need = wavOk ? LEAD + spoken + TAIL : 0;
  const picture = s.kind === "clip" ? s.picture : s.b - s.a;
  const dur = Math.max(picture, need, 1);
  const pad = Math.max(0, dur - picture) + 0.5; // clone the last frame if the voice outruns the picture
  const vin = s.kind === "clip"
    ? ["-ss", s.srcStart.toFixed(3), "-t", s.srcLen.toFixed(3), "-i", s.file]
    : ["-ss", s.a.toFixed(3), "-t", picture.toFixed(3), "-i", silent];
  const scale = s.kind === "clip"
    ? `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=#0b101c,setsar=1,setpts=PTS/${s.speed.toFixed(4)},`
    : "";
  const vf = `[0:v]${scale}fps=25,tpad=stop_mode=clone:stop_duration=${pad.toFixed(3)},setpts=PTS-STARTPTS[v]`;
  const af = wavOk
    ? `[1:a]${AFMT},adelay=${Math.round(LEAD * 1000)},apad,asetpts=PTS-STARTPTS[a]`
    : `[1:a]${AFMT},asetpts=PTS-STARTPTS[a]`;
  const ain = wavOk ? ["-i", s.wav] : ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono"];
  ff([...vin, ...ain, "-filter_complex", `${vf};${af}`, "-map", "[v]", "-map", "[a]", "-t", dur.toFixed(3), ...SEG_ENC, file]);
  // captions: share this line's spoken time across readable chunks
  const bits = chunk(s.text);
  const chars = bits.reduce((x, b) => x + b.length, 0) || 1;
  let c = at + LEAD;
  const span = wavOk ? spoken : dur - LEAD;
  for (const b of bits) {
    const w = (span * b.length) / chars;
    cues.push({ start: c, end: c + w - 0.08, text: b });
    c += w;
  }
  at += dur;
  console.log(`  ${s.scene}-${s.k}: picture ${picture.toFixed(1)}s, voice ${spoken.toFixed(1)}s → ${dur.toFixed(1)}s`);
});
console.log(`voiced length ${at.toFixed(1)}s over ${segs.length} segments`);

// title card first, links card last — numbered so the concat list keeps order
card(2.2, [
  line("TapFlow", 74, "h/2-96", "white", FONT_B),
  line("one tap on a live DreamDEX Event Contract", 27, "h/2+4", "#aab4c8"),
  line("and the chain copies you in the same block", 27, "h/2+44", "#aab4c8"),
  line("SOMNIA SHANNON  ·  EVERY NUMBER READ FROM CHAIN", 17, "h/2+120", "#5d6a80"),
], path.join(segDir, "000-title.mp4"));

const outroWav = path.join(ttsDir, "outro-0.wav");
if (fs.existsSync(outroWav)) {
  const d = (D.outro ?? [6])[0] + LEAD + TAIL;
  const dest = path.join(segDir, "zzz-outro.mp4");
  ff(["-f", "lavfi", "-i", `color=c=#0a0e18:s=${W}x${H}:r=25:d=${d.toFixed(2)}`, "-i", outroWav,
    "-filter_complex",
    `[0:v]${[
      line("TapFlow", 52, "h/2-190", "white", FONT_B),
      line("github.com/Prashant-thakur77/tapflow", 30, "h/2-90", "#8aa6f9"),
      line("tapflow-phi.vercel.app", 30, "h/2-40", "#8aa6f9"),
      line("@TapFlowSomniaBot", 30, "h/2+10", "#8aa6f9"),
      line(`same-block mirror proven in block ${proof.block ?? ""}`, 20, "h/2+100", "#5d6a80"),
      line("Somnia x DreamDEX Event Contracts", 20, "h/2+140", "#5d6a80"),
    ].join(",")}[v];[1:a]${AFMT},adelay=${Math.round(LEAD * 1000)},apad,asetpts=PTS-STARTPTS[a]`,
    "-map", "[v]", "-map", "[a]", "-t", d.toFixed(2), ...SEG_ENC, dest]);
  const at0 = at;
  for (const b of chunk(LINES.outro[0])) {
    const w = ((D.outro ?? [6])[0] * b.length) / (LINES.outro[0].length || 1);
    cues.push({ start: at + LEAD, end: at + LEAD + w - 0.08, text: b });
    at += w;
  }
  at = at0 + d;
  console.log(`  outro card: ${d.toFixed(1)}s`);
}
// The title card sits in front of everything, so every caption moves with it.
const TITLE = 2.2;
for (const c of cues) { c.start += TITLE; c.end += TITLE; }
at += TITLE;
console.log(`with cards: ${at.toFixed(1)}s`);

const list = path.join(segDir, "list.txt");
fs.writeFileSync(list, fs.readdirSync(segDir).filter((f) => f.endsWith(".mp4")).sort().map((f) => `file '${f}'`).join("\n"));
const joined = path.join(dir, "voiced.mp4");
ff(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined]);
writeCaptions(cues);
burn(joined, out, ["-af", "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000", "-ar", "48000", "-c:a", "aac", "-b:a", "160k"]);
console.log(`wrote ${out} (narrated + captioned) and ${silent} (picture only)`);
