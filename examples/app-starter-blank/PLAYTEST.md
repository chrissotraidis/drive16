# Playtest Notes

## Latest Result

No game-specific playtest has run yet.

Playability gate: FAIL.

Reason: no game has been implemented, built, screen-checked, input-tested, or
audio-checked yet.

## Required Gate Before Calling A Build Done

- ROM builds successfully.
- The first screen is visible and readable.
- Player/object movement is visible when controls are pressed.
- Start and reset behavior are checked when the game uses them.
- Score or state counters start at the intended value.
- The game does not immediately fail or become unplayable.
- Asset usage is recorded in `ASSETS.md` as primitive tiles, bundled assets,
  ComfyUI, or MML.
- Passing games must record non-silent audio evidence, or explicitly say audio
  was disabled/omitted by request.

## Genre Acceptance Checklist

Use the relevant row for the game being built. Mark unrelated rows as N/A.
When `Playability gate: PASS`, the Evidence section must name each relevant
genre check that was tested; `Genre checks: pending` is never compatible with a
passing gate.

| Genre | Minimum checks before PASS |
| --- | --- |
| Snake | Score starts at 0; snake and food are visible; D-pad movement is visible; food can be approached/eaten without instant fail; wall/self collision reaches a clear fail state; Start restarts after game over when present. |
| Pong | Both paddles and ball are visible; at least one paddle responds to input; ball travels and bounces; scoring changes when the ball exits a side; serve/point restart is visible. |
| Tetris | Playfield and score/line state are readable; a piece spawns visibly; left/right/down movement works; rotation works; pieces lock into the grid; line clear/stacking behavior is present; game-over is possible at the top. |
| Asteroids | Ship, asteroids, and shots are visible; rotation/thrust changes the ship; firing creates a moving projectile; asteroids move or wrap; collisions/destruction affect score/state; restart works after death/game over. |

## Evidence

- Build log: pending
- Screenshot/frame capture: pending
- Input test: pending
- Audio test: pending if the project includes music
- Genre checks: pending
