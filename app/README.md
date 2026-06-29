# Drive16 App

Phase 3 Tauri shell for Drive16.

This app starts as a runnable two-pane shell:

- left pane: conversation, agent step stream, project files, and command input
- right pane: emulator viewport, transport controls, model status, and tool
  health

Provider credentials stay outside git. The OpenRouter key is entered at
runtime or supplied through local environment configuration, never committed.
