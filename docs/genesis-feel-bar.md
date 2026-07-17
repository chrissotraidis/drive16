# The Genesis feel bar — measured from real games

Produced by P2-G0 (2026-07-17): `scripts/profile-reference-rom.py` played
user-supplied ROMs (Sonic 1, Streets of Rage, Shining Force) through Genteel
with scripted controllers, streamed every 2nd frame and the audio, and
measured behavior. The same instrument profiled Drive16's P1 Missile Command
build. Behavior analysis only; no assets extracted; evidence lives in
gitignored `artifacts/reference-profiles/` (sample frames confirm both
action references reached genuine gameplay — Green Hill Zone, Round 1
street fight).

## Measured play-session profiles

| Metric (play session) | Sonic 1 | Streets of Rage | Shining Force | **Drive16 P1 build** |
|---|---|---|---|---|
| Camera motion share (frame pairs with scroll) | **0.44** | 0.21 | 0.07 | **0.02** |
| Scroll speed p90 (px/frame) | **4.0** | 4.6 | 0 | **0** |
| Residual pixel churn p90 (after scroll comp.) | **0.30** | 0.055 | 0.012 | **0.0006** |
| Moving 16px regions, median | **40** | 12 | 5 | **0** |
| Moving 16px regions, p90 | **233** | 48 | 15 | **1** |
| Unique on-screen colors (sampled) | 36–41 | 28–33 | 15–18 | **17–18** |
| Static HUD row share | 0.075 | 0.125 | 0.30 | **0.87** |

Two orders of magnitude separate our output from the action references on
motion and liveliness. Even the menu-driven RPG out-animates our arcade
game five-to-one. 87% of our screen never changes: it is, measurably, a
near-still image with a cursor.

## The bar (targets for P2-G1..G3, action genres)

- **Camera/motion**: moving share ≥ 0.20 during play; something on screen
  moves every frame; scrolling scenes reach 2–5 px/frame.
- **Liveliness**: ≥ 8 moving 16px regions median during action, p90 ≥ 40;
  residual churn p90 ≥ 0.05 (ambient animation: flames, water, idle cycles).
- **Motion granularity**: per-pixel 60 Hz movement (1–3 px/frame per
  object); tile-stepped (≥8 px jumps at <10 Hz) motion fails.
- **Color depth**: ≥ 28 unique on-screen colors in play scenes.
- **HUD share**: static rows ≤ 0.20 of the frame.
- **Animation**: player-facing objects have ≥2 frames; explosions ≥4; some
  ambient animation always running.

## Audio: provisional (known measurement gaps)

Spectral-flux onsets discriminate Sonic (0.35/s) from the rest (~0.06/s)
but under-count SFX against a music bed, and high-band energy reads zero for
every dump — the Genteel WAV path needs investigation (possible low-pass or
rate metadata issue) before audio targets are set. Carried into P2-G2:
fix the capture/measure chain, then set onset-density and SFX-on-action
targets from the references. What is already certain from listening
context: every reference layers SFX over music; our build has zero SFX
calls (see `docs/2026-07-17-genesis-feel-gap.md`).

## How to re-measure

```sh
python3 scripts/profile-reference-rom.py <rom> --label <name> \
  --play-style runner|brawler|generic
```

Profiles land in `artifacts/reference-profiles/<label>.profile.json` with
sample frames beside them. Run the same command against any Drive16 build's
`out/rom.bin` for an apples-to-apples score.
