# Corpus

RAG documentation set for the Drive16 agent loop.

Allowed material:

- SGDK API and `rescomp` documentation.
- Genesis VDP and hardware references.
- Openly licensed SGDK examples.
- Drive16 house best practices.

Do not add disassembled commercial ROMs or commercial game source material.

Current Phase 1 source setup:

- `sources.json`: source manifest and exclusions.
- `sgdk/`: fetched SGDK v2.11 documentation and API headers. Regenerate with
  `scripts/fetch-rag-corpus.sh`.
- `vdp/`: Drive16-authored Genesis VDP core notes.
- `drive16/`: Drive16-authored SGDK project patterns.

Validate local indexing with:

```sh
scripts/validate-rag-corpus.sh
```
