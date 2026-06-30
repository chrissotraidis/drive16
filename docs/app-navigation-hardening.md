# App Navigation Hardening Evidence

## Scope

This slice follows a hands-on UI critique of the Drive16 app at
`http://127.0.0.1:1420/`. The app needed a clearer project menu, a real save
surface, better placement for inference state, clearer chat feedback, and
more stable responsive layout. This does not change the Phase 4 generated
asset gate.

## Findings

- Project actions were spread across the top bar, and there was no menu for
  project switching, saving, or setup context.
- The active inference model was shown in the global top bar, where it competed
  with run status and project actions instead of living with agent settings.
- The top action buttons expanded awkwardly at narrow widths.
- The chat composer posted messages, but freeform prompts looked broken because
  the app did not explain that live replies require a tested model.
- The conversation header compressed poorly on phone-sized viewports.

## Implemented Behavior

- Added a hamburger project menu on the left side of the top bar.
- Moved `New Project`, `Save Project`, `Export ROM`, recent project selection,
  inference state, and tool attention into that menu.
- Added a native `save_current_project` command that snapshots the starter
  project under `artifacts/phase3/projects/` when running in Tauri.
- Kept `Run`, `Save`, and `Export` as compact top actions.
- Moved the active inference label into the conversation pane beside
  `Agent Settings`.
- Updated freeform chat feedback so the app explains what is handled locally
  and what still needs a tested model connection.
- Added dark scrollbar styling and phone-width header rules to avoid clipped
  app chrome.

## Browser Verification

Desktop browser pass:

- Page identity was `http://127.0.0.1:1420/`, title `Drive16`.
- Project menu opened from the hamburger button.
- `Save Project` in the menu reported
  `artifacts/phase3/projects/drive16-starter-preview` in browser preview.
- `Agent Settings` opened from the project menu.
- Top `Save` produced visible action feedback.
- Sending `what can you do?` produced an agent response that explains the
  local ROM prompt path and the model-settings requirement.
- The top model control was removed from the top bar.
- The top bar measured 58 px tall at desktop width, with compact `Run`,
  `Save`, and `Export` actions.
- Console warnings and errors were empty.

Mobile browser pass:

- The project menu opened and closed at a phone-width viewport.
- The app reported no horizontal overflow. The measured body client width and
  scroll width were both 316 px in the rendered browser surface.
- The conversation header stacked cleanly, and the inference row stayed inside
  the pane.
- Console warnings and errors were empty.

## Native Verification

```sh
cargo test --manifest-path app/src-tauri/Cargo.toml project -- --nocapture
```

Result: passed. The project save test copied the starter project tree to a
snapshot path and preserved the expected files.

## Frontend Verification

```sh
pnpm --dir app build
git diff --check
```

Result: both passed.
