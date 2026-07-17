# Why the output still feels like Atari, not Genesis — measured

User verdict on the P1 Missile Command build (2026-07-17): "essentially an
Atari game … music bad, graphics bad, ability to play bad, game UI bad."
The verdict is correct. This document measures the gap in the shipped build
(`artifacts/phase9/p1-benchmark/missile-command-rebench/project`) so every
following goal targets a number, not a vibe.

## The five measured deficits

1. **Motion is tile-quantized and slow — the #1 "feels like Atari" driver.**
   Objects live on an 8-pixel grid (`missiles[i].x << 3`) and step once every
   **16 frames** (`MISSILE_STEP_FRAMES 16`): ~3.75 moves/second, 8 px per
   jump. A real Genesis game moves objects 1–3 px **every frame** (60/s) with
   acceleration and easing. Our motion is ~16× coarser in time and 8× in
   space. No screen shake, no hit-pause, no particles.

2. **Zero sound effects.** `grep` count of SFX calls in the shipped game:
   **0**. No shot, no explosion, no impact, no UI blip — music only. Real
   Genesis games hang game-feel on an SFX layer over the music (XGM supports
   PCM SFX channels; the system never uses them).

3. **Every sprite is one static frame.** All five PNGs are single 32×32
   frames. Real explosions are 4–8 frame sequences; ships bank; cursors
   pulse. `SPR_setAnim` is never called anywhere in the codebase.

4. **All text is the SGDK default font via `VDP_drawText`** (custom font art:
   0). Titles, HUD, and menus therefore read as a dev demo. Real games draw
   logos and HUDs as tile art.

5. **Plane B is a static texture, not depth.** 16 `BG_B` references but no
   scrolling — no parallax, the defining Genesis-era visual signature.

Root cause across all five: **every gate in the pipeline measures floors
(pixels alive, audio non-silent, input changes a frame) and nothing measures
feel.** The seeded skeletons — the model's copy-adapt reference — embody the
same five deficits, so the pipeline reproduces them faithfully. Verification
drives scripted inputs and reads frames: instruments, not hands. Nothing in
the system encodes what good looks like.

## The fix: calibrate against real games

The repo already anticipated this: `scripts/capture-reference-run.py` +
`verify-reference-run.mjs` exist to capture behavioral evidence from a
user-supplied or permissively-licensed ROM — never used ("No commercial
reference ROM was supplied"). P2 now starts there: run real Genesis games
headless, extract a measurable **feel profile** —

- pixel-velocity histograms (how far do things move per frame),
- moving-object counts per frame,
- audio transient density (SFX events/second) and spectral range,
- animation cadence (sprite-region change frequency),
- palette counts and HUD share per frame, scroll-plane deltas (parallax),

— and turn that profile into (a) hard targets for the skeletons and pass
prompts, (b) gates that fail tile-stepped motion and silent actions, and
(c) the rubric for every future self-audit. Asset extraction stays out of
scope (license hygiene: behavior analysis only, nothing copied into the
repo, human review retained).
