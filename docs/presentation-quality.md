# Drive16 Presentation Quality Baseline

Date: 2026-07-10

The original four promoted audit frames were functionally valid but still
looked like sparse text-grid prototypes. The screenshot validator now rejects
those exact frames: they use too few visible colors or leave one background
color covering more than 84% of the screen.

The four deterministic genre skeletons now use custom 8x8 tile art, composed
playfield panels, distinct object silhouettes, stronger palette hierarchy, and
clear top/bottom information bars while preserving their existing gameplay,
restart, and audio behavior.

| Baseline | Visible colors | Dominant color | Foreground |
|---|---:|---:|---:|
| Snake | 8 | 57.1% | 36.2% |
| Pong | 9 | 34.7% | 42.4% |
| Tetris | 10 | 33.9% | 44.5% |
| Asteroids | 9 | 57.4% | 33.5% |

The same proof also requires directional/action input to produce a visible
frame change and Start to return within 5% pixel difference of the equivalent
fresh state. The current four baselines return within 0%-0.7%; the tolerance
allows normal one-frame timing differences without accepting a broken screen.

Run the complete deterministic proof with:

```sh
pnpm --dir app verify:presentation-baseline
```

The command builds all four SGDK projects, captures stable emulator frames,
applies screenshot-quality contract version 2, verifies non-silent audio,
proves input visibly changes the frame, and proves Start returns to the same
fresh state. Evidence is written under
`artifacts/phase9/presentation-baseline/`.

This baseline strengthens future generated runs without spending hosted-model
tokens. The July 9 model report has been rescored under v2: all 12 historical
outputs need presentation repair. DeepSeek remains the operational default for
tool discipline and honesty, not a claimed visual-quality winner.
