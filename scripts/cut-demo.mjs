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
  const ms = Math.max(0, Math.round(t * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), x = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(x).padStart(3, "0")}`;
};
// A spoken line is too long to read in one go: break it into caption-sized
// chunks on sentence ends, then on commas, and share the line's time by length.
const chunk = (text, max = 90) => {
  const bits = text.match(/[^.!?—]+[.!?—]*\s*/g) ?? [text];
  const outp = [];
  for (const b of bits) {
    if (b.trim().length <= max) { outp.push(b.trim()); continue; }
    let cur = "";
    for (const piece of b.split(/(?<=,)\s+/)) {
      if (cur && (cur + " " + piece).length > max) { outp.push(cur.trim()); cur = piece; } else cur += (cur ? " " : "") + piece;
    }
    if (cur.trim()) outp.push(cur.trim());
  }
  // glue very short fragments onto the previous chunk
  const merged = [];
  for (const c of outp) {
    if (merged.length && (c.length < 28 || merged[merged.length - 1].length < 28) && (merged[merged.length - 1] + " " + c).length <= max + 30) merged[merged.length - 1] += " " + c;
    else merged.push(c);
  }
  return merged;
};
const srtPath = path.join(dir, "captions.srt");
const writeSrt = (cues) => {
  let n = 1;
  fs.writeFileSync(srtPath, cues.filter((c) => c.end > c.start + 0.2).map((c) => `${n++}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join("\n"));
  console.log(`captions: ${cues.length} cues → ${srtPath}`);
};
const style = "FontName=DejaVu Sans,FontSize=8,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,BackColour=&HA0000000,Outline=1,Shadow=0,MarginV=22,MarginL=60,MarginR=60,Alignment=2";
const burn = (input, dest, extra = []) =>
  ff(["-i", input, "-vf", `subtitles='${srtPath.replace(/'/g, "\\'")}':force_style='${style}'`, ...enc, ...extra, dest]);

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
  writeSrt(cues);
  burn(silent, out);
  console.log(`wrote ${out} (captioned, no narration — run scripts/tts.py for voice)`);
  process.exit(0);
}

// ── narration: one segment per spoken line ────────────────────────────────
const D = JSON.parse(fs.readFileSync(durPath, "utf8"));
const LEAD = 0.15;   // a beat before the voice starts
const TAIL = 0.35;   // and after it ends
const SLACK = 2.5;   // the most silence a shot may hold after its line ends
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
// the phone clip, before the closing scene
if (fs.existsSync(TELEGRAM) && LINES.telegram) {
  const wav = path.join(ttsDir, "telegram-0.wav");
  const at = segs.findIndex((s) => s.scene === "close");
  const seg = { kind: "clip", file: TELEGRAM, text: LINES.telegram[0], wav, audio: (D.telegram ?? [0])[0] ?? 0, scene: "telegram", k: 0 };
  segs.splice(at < 0 ? segs.length : at, 0, seg);
  console.log(`splicing ${TELEGRAM} before the close`);
} else if (LINES.telegram) {
  console.log(`no ${TELEGRAM} — skipping the Telegram scene`);
}

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
  // A phone clip is usually longer than its line: play it up to 1.8x so all of
  // it lands inside the narration rather than trimming the end off.
  const room = Math.max(need, 6);
  const clipLen = s.kind === "clip" ? probe(s.file) : 0;
  const speed = s.kind === "clip" ? Math.min(Math.max(clipLen / room, 1), 1.8) : 1;
  const picture = s.kind === "clip" ? Math.min(clipLen / speed, room) : s.b - s.a;
  const dur = Math.max(picture, need, 1);
  const pad = Math.max(0, dur - picture) + 0.5; // clone the last frame if the voice outruns the picture
  const vin = s.kind === "clip"
    ? ["-t", Math.min(clipLen, picture * speed).toFixed(3), "-i", s.file]
    : ["-ss", s.a.toFixed(3), "-t", picture.toFixed(3), "-i", silent];
  const scale = s.kind === "clip"
    ? `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=#0b101c,setsar=1,setpts=PTS/${speed.toFixed(4)},`
    : "";
  const vf = `[0:v]${scale}fps=25,tpad=stop_mode=clone:stop_duration=${pad.toFixed(3)},setpts=PTS-STARTPTS[v]`;
  if (s.kind === "clip") console.log(`  telegram clip ${clipLen.toFixed(1)}s at ${speed.toFixed(2)}x`);
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

const list = path.join(segDir, "list.txt");
fs.writeFileSync(list, fs.readdirSync(segDir).filter((f) => f.endsWith(".mp4")).sort().map((f) => `file '${f}'`).join("\n"));
const joined = path.join(dir, "voiced.mp4");
ff(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined]);
writeSrt(cues);
burn(joined, out, ["-af", "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000", "-ar", "48000", "-c:a", "aac", "-b:a", "160k"]);
console.log(`wrote ${out} (narrated + captioned) and ${silent} (picture only)`);
