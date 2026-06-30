# Phase 4 MML RAG Corpus Evidence

## Scope

This slice adds a Drive16-authored `ctrmml` Megadrive MML reference to the RAG
corpus. It does not yet wire generated music into the app prompt path.

Implemented behavior:

- Added `corpus/mml/ctrmml-megadrive.md`.
- Updated `corpus/sources.json` and `corpus/README.md`.
- Added `scripts/validate-mml-rag-corpus.sh`.

## Reference Contents

The corpus note covers:

- Required `#platform megadrive` song shape.
- FM and PSG channel mapping for the first generated music pass.
- Common MML commands such as `t`, `@`, `v`, `o`, `l`, notes, rests, octave
  shifts, and loop point `L`.
- The Drive16 FM preset IDs from `assets/enhancements/mml/manifest.json`.
- The `compile_music` MCP path and SGDK `XGM_startPlay` wiring.

## Verification

```sh
scripts/validate-mml-rag-corpus.sh
```

Result:

- The local corpus file contains the required MML syntax, MCP tool, SGDK music
  wiring, and preset terms.
- The preset manifest contains all six preset IDs.
- The full RAG corpus validates with the existing SGDK and VDP query.
- A targeted RAG query for generated MML returns `compile_music`,
  `drive16_round_bass`, and `XGM_startPlay`.
- The RAG status reported 16 documents, 1537 chunks, and FTS enabled.

## Next

Wire the optional prompt path to use generated sprite and music assets.
