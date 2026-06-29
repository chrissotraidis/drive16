# Drive16

Drive16 is an open-source, conversational builder for Sega Genesis / Mega Drive
games. You talk to an agent, it writes SGDK C, builds a ROM, runs it in an
emulator, reads the result, and iterates.

The v1 target is deliberately narrow: from a conversation, Drive16 writes and
builds a Genesis ROM with SGDK, runs it, self-corrects build or runtime issues,
puts a controllable bundled sprite on screen, and plays a bundled VGM loop.
AI-generated sprites and music are later enhancements, not part of the v1
critical path.

## Model stance

Drive16 is bring-your-own-key or local-only:

- OpenRouter is the default hosted model path.
- Ollama is the local model path.
- Direct provider keys can be added as configuration.
- Consumer subscription login relay is out of scope.

No Drive16 flow should ask a user to log into a Claude, ChatGPT, or other
consumer subscription account.

## License posture

Drive16 app code is intended to use a permissive license. Copyleft or
non-commercial dependencies must run as separate processes and must not be
linked or vendored into the Tauri binary. MIT is proposed in `DECISIONS.md` as
the app license, pending human confirmation before finalizing a `LICENSE` file.

## Current phase

The project is in Phase 0: manual spike. See `PROGRESS.md` for the current
checklist and `WORKLOG.md` for evidence.
