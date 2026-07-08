# Drive16 Project Structure

How a Drive16 game lives on disk today: where the code is, where assets go,
and how a folder of files becomes a ROM. This answers "is there a formal
file/folder structure?" — yes, and this page is its definition.

## The active project (your working folder)

Everything the agent builds for you lives in one ordinary folder:

```text
artifacts/phase3/active-project/
├── Makefile          # delegates to the SGDK toolchain
├── GAME.md           # living game notes: concept, controls, assets, issues
├── ASSETS.md         # role-by-role asset manifest and proof status
├── PLAYTEST.md       # living evidence log: checks run, results, next test
├── src/
│   └── main.c        # the game code the agent writes and edits
├── res/              # ALL game assets live here
│   ├── resources.res # SGDK resource manifest: one line per asset
│   ├── resources.h   # C declarations matching resources.res
│   ├── *.png         # sprites (32x32, max 16 colors, index 0 transparent)
│   └── *.vgm         # music (compiled from MML)
└── out/
    └── rom.bin       # the built ROM the player runs
```

It is a standard SGDK project — nothing app-specific. You can open it in an
editor, copy it, or build it by hand with `scripts/build-sgdk.sh
artifacts/phase3/active-project`. It is created on first use by copying the
starter template (`examples/app-starter-blank`) and is never committed to
git (it lives under ignored `artifacts/`).

How files become a ROM: `rescomp` (inside the SGDK Docker toolchain) reads
`res/resources.res` and compiles every referenced PNG/VGM into linkable C
data; GCC (m68k-elf) compiles `src/*.c`; the linker produces `out/rom.bin`.
So "the ROM" is always just a compilation of that folder — there is no
hidden state.

`GAME.md`, `ASSETS.md`, and `PLAYTEST.md` are part of the active project
contract. Agents should read them before editing a continued game and update
them after each build turn. `GAME.md` answers what the game is, which controls
it uses, what has been attempted, and what is currently broken. `ASSETS.md`
maps each sprite, tile, music, or primitive drawing to its game role, source,
path, and proof status. `PLAYTEST.md` records build/run/input/screenshot/audio
evidence and the next checks required before calling a result done.

## How assets get into the project

Generated assets are staged in scratch space first, then copied into the
project's `res/` folder and referenced from `resources.res`:

- Music: the agent writes MML, `compile_music` (ctrmml) produces a VGM under
  `artifacts/phase4/mml-music/`, and the agent copies it to
  `res/<name>.vgm` plus an `XGM <name> "..."` line in `resources.res`.
- Sprites: `scripts/run-comfyui-sprite-workflow.py --prompt "<subject>"`
  generates, downscales, quantizes, and validates a Genesis-legal PNG under
  `artifacts/phase4/live-comfyui-sprite/<id>/`; the agent copies it to
  `res/<name>.png` plus a `SPRITE <name> "..." 4 4 NONE 0` line.
  Each generated PNG should be treated as one role-specific sprite. If a game
  needs multiple semantic roles, generate, validate, and record each role
  separately; use primitives for simple geometry unless the user asks for
  styled generated art.
- Bundled pack: `assets/core/player.png` and `assets/core/loop.vgm` can be
  referenced directly, no copying needed.

The project folder is therefore exactly the "non-ROM version" you would
expect: all code and all assets as plain files, compiled into `out/rom.bin`
on every build.

## Saving, opening, exporting

- Save Project copies the current project tree to
  `artifacts/phase3/projects/drive16-<name>-<timestamp>/` (a snapshot).
- Open Project loads the most recent snapshot.
- Export ROM copies the active ROM to
  `artifacts/phase3/exports/drive16-rom-<timestamp>.bin`.

## Other storage locations

| Path | Purpose |
|---|---|
| `examples/app-starter-blank/` | committed starter template every project begins from |
| `artifacts/phase3/active-project/` | the agent's working project (code + assets + ROM) |
| `artifacts/phase3/projects/` | saved project snapshots |
| `artifacts/phase3/exports/` | exported ROMs |
| `artifacts/phase4/mml-music/` | music compile scratch (last.mml, last.vgm, log) |
| `artifacts/phase4/live-comfyui-sprite/` | sprite generation scratch (one folder per run) |
| `artifacts/phase5/imports/` | ROMs you import through the app |
| `artifacts/phase7/interactive-core/` | user-supplied Play emulator core |
| `assets/core/` | committed bundled asset pack (sprite + music loop) |
| `assets/enhancements/` | committed generation contracts (ComfyUI workflow, MML presets) |

## Known limitations (future work)

- One active project at a time. Snapshots are copies, not named workspaces
  you can switch between; a proper multi-project picker is future work.
- Scratch folders under `artifacts/phase4` keep every generation run;
  nothing cleans them up yet.
- The paths are repo-relative because the app currently runs from the repo
  checkout; the packaging track (overhaul plan, Track E) moves them to
  proper per-user app-data folders.
