# Drive16 ctrmml Megadrive MML Notes

Drive16-authored reference for Phase 4 generated music. Use this before
writing MML for the optional `drive16-mml-music` MCP server.

## Goal

Write short Megadrive MML that compiles with `ctrmml` to a VGM file. The MCP
tool is `compile_music(mml_text)`. Its output is a VGM path plus an SGDK
resource line shaped like:

```text
XGM drive16_generated_music "<generated-vgm-path>"
```

The generated SGDK project should play it with:

```c
XGM_startPlay(drive16_generated_music);
```

## Required Song Shape

Always include:

```text
#title Drive16 Generated Loop
#platform megadrive
```

Keep Phase 4 generated loops short. Prefer FM and PSG only. Do not require PCM
sample files unless a later prompt explicitly gives sample assets.

Channel map for the first generated music pass:

- `A` through `F`: YM2612 FM channels.
- `G` through `I`: PSG tone channels.
- `J`: PSG noise channel.

Useful MML commands:

- `t120`: tempo in BPM.
- `@80`: select instrument number 80.
- `v12`: coarse volume from 0 to 15.
- `o4`: octave.
- `l8`: default note length.
- `c d e f g a b`: notes.
- `r`: rest.
- `>` and `<`: octave up and down.
- `L`: loop point.

## Drive16 FM Presets

The committed preset library is:

- MML include: `assets/enhancements/mml/fm-presets.mml`.
- Manifest: `assets/enhancements/mml/manifest.json`.

Use these stable instruments before inventing FM voice tables:

- `@80` `drive16_round_bass`: bass, channel `A`, octave 3, volume 13.
- `@81` `drive16_clear_lead`: lead, channel `B`, octave 4, volume 11.
- `@82` `drive16_soft_pad`: pad, channel `C`, octave 4, volume 8.
- `@83` `drive16_chip_pluck`: pluck, channel `D`, octave 5, volume 10.
- `@84` `drive16_bright_bell`: bell, channel `E`, octave 5, volume 9.
- `@85` `drive16_brass_stab`: brass, channel `F`, octave 4, volume 11.

The prompt path should paste the preset include before the generated tracks
when asking `compile_music` to compile the song.

## FM Instrument Table Shape

If a new voice is needed, use the `ctrmml` FM table shape:

```text
@90 fm ; short_name
  ALG FB
  AR DR SR RR SL TL KS ML DT SSG
  AR DR SR RR SL TL KS ML DT SSG
  AR DR SR RR SL TL KS ML DT SSG
  AR DR SR RR SL TL KS ML DT SSG
```

Use the committed presets instead when possible. When writing a new table,
stay inside these practical ranges:

- `ALG`: 0 to 7.
- `FB`: 0 to 7.
- `AR`: 0 to 31.
- `DR`, `SR`: 0 to 31.
- `RR`, `SL`: 0 to 15.
- `TL`: 0 to 127.
- `KS`: 0 to 3.
- `ML`: 0 to 15.
- `DT`: -7 to 7.
- `SSG`: 0 unless a specific envelope shape is needed.

## Minimal Generated Example

```text
#title Drive16 Generated Loop
#platform megadrive

; Paste assets/enhancements/mml/fm-presets.mml here.

A t128 @80 v13 o3 l8 c c g c >c< g c r L c4 r4
B      @81 v11 o4 l8 c d e g a g e d L c4 r4
C      @82 v8  o4 l4 c e g >c< L c2 r2
```

## Agent Rules

- Query this corpus before writing Phase 4 generated music.
- Use `drive16_round_bass` and `drive16_clear_lead` for the first generated
  proof unless the user asks for a different mood.
- Do not copy commercial melodies.
- Do not use ComfyUI or generated sprites for music-only work.
- After `compile_music` succeeds, wire the returned `XGM` line into
  `res/resources.res` and call `XGM_startPlay` from `src/main.c`.
