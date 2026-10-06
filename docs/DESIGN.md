# Drive16 design thesis

Drive16 is a game console with a conversation attached. The person came to see
their game, so the interface should feel like a well-made piece of hardware: a
quiet graphite shell, one bright cartridge accent, and a screen that gets all
the attention. This page is the rule set for UI changes. Tokens live at the top
of [app/src/styles.css](../app/src/styles.css).

## The five rules

1. **The screen is the product.** The player gets the most space and the
   cleanest frame. Chrome around it recedes; nothing decorative competes with
   the game's own colors.
2. **Graphite, not brown.** Surfaces are near-neutral charcoal (`--bg`,
   `--panel`, `--panel-2`, `--panel-3`) so Genesis palettes read true. Tinted
   backgrounds distort the game's colors and make the app look dated.
3. **One accent, one job.** Cartridge orange (`--accent`, from the D16 mark)
   marks the primary action and keyboard focus. It is never used for
   decoration, chat bubbles, or borders at rest.
4. **Status speaks once, in semantic color.** Each fact has one home:
   the header chip shows the project stage, the line under the player shows
   playback, and the chips show evidence. Green (`--ok`) means proven, amber
   (`--amber`) means pending, red (`--danger`) means failed. An empty project
   is neutral, not an error.
5. **Quiet type, loud pixels.** System sans at a small, consistent scale;
   uppercase only for tiny section labels; pixel art is always shown with
   `image-rendering: pixelated` and letterboxed, never cropped.

## Where state lives

| Question | Answer shown in |
|---|---|
| How far along is this project? | Header chip: No ROM yet, Prototype, Built, Needs rebuild, Playable, Reviewed, Failed Review |
| What just happened? | Header feedback strip and the project menu notice |
| Is the game running? | Player status line: Playing, Paused, Stopped |
| What has been proven? | Evidence chips: Stage, Screen, Input, Audio, Assets |
| What did the agent do? | Build log in the chat rail (paths shown repo-relative, full path on hover) |

## Interaction rules

- Every dialog closes with Escape, the close button, or a backdrop click.
- Every focusable control shows the orange focus ring on keyboard focus.
- The composer grows with long prompts; Enter sends, Shift+Enter adds a line,
  and Enter is ignored while an input method is composing text.
- A project whose source is newer than its ROM is never presented as a new
  game. It offers a plain rebuild that compiles the files as they are.
- Destructive or project-replacing actions (New Project, a new-game prompt)
  are never the default button on a screen that already has work.
