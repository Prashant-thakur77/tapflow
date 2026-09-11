"""Generate the narration with Chatterbox TTS, one clip per line.

    ~/tts/.venv/bin/python scripts/tts.py [out-dir]

Reads scripts/demo-lines.mjs (the LINES object), writes <out>/<scene>-<i>.wav
and <out>/durations.json = { "<scene>": [seconds, ...] }. Runs on the GPU when
one is present. Voice: Chatterbox's built-in voice (no reference clip), with a
calm read (low exaggeration) and a slightly slower pace, which suits a product
walkthrough better than the default.
"""
import json, os, re, sys, subprocess, time

out = sys.argv[1] if len(sys.argv) > 1 else "video/tts"
# Any further arguments name the scenes to (re)generate; without them, all of
# them. Regenerating one scene leaves every other clip — and so every other
# scene's timing in the cut — exactly as it was.
only = set(sys.argv[2:])
os.makedirs(out, exist_ok=True)

# Pull LINES out of the ES module with node, so there is one source of truth.
src = subprocess.check_output(
    ["node", "-e", "import('./scripts/demo-lines.mjs').then(m => console.log(JSON.stringify(m.LINES)))"], text=True
)
LINES = json.loads(src)

import torch, torchaudio as ta
from chatterbox.tts import ChatterboxTTS

device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"device: {device}")
model = ChatterboxTTS.from_pretrained(device=device)
if only:
    print(f"regenerating only: {', '.join(sorted(only))}")

def clean(t: str) -> str:
    # Spoken forms for things the TTS would otherwise spell or stumble on.
    t = t.replace("DreamDEX", "Dream DEX").replace("TapFlow", "Tap Flow").replace("TapBot", "Tap Bot")
    t = t.replace("onEvent", "on-Event").replace("CopyHandler", "Copy Handler").replace("RiskGuard", "Risk Guard")
    t = t.replace("SDK", "S D K").replace("UP", "Up").replace("DOWN", "Down").replace("SAME BLOCK", "same block")
    t = re.sub(r"\s+", " ", t).strip()
    return t

durations = {}
prev_path = os.path.join(out, "durations.json")
if only and os.path.exists(prev_path):
    durations.update(json.load(open(prev_path)))
t0 = time.time()
for scene, lines in LINES.items():
    if only and scene not in only:
        continue
    durations[scene] = []
    for i, line in enumerate(lines):
        path = os.path.join(out, f"{scene}-{i}.wav")
        wav = model.generate(clean(line), exaggeration=0.35, cfg_weight=0.55, temperature=0.7)
        ta.save(path, wav, model.sr)
        secs = wav.shape[-1] / model.sr
        durations[scene].append(round(secs, 2))
        print(f"{scene}-{i}: {secs:5.1f}s  {line[:60]}")
json.dump(durations, open(os.path.join(out, "durations.json"), "w"), indent=2)
print(f"done in {time.time() - t0:.0f}s → {out}/durations.json")
