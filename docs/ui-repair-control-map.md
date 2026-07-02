# UI Repair Control Map

Status: active UI repair artifact, created for the Phase 8 UI/IA pause.

This map documents what each visible control should do, where feedback should
appear, and what has been confusing in the current shell. It is intentionally
product-facing: the app should feel trustworthy without reading implementation
notes.

Status key:

- `Verified`: clicked or inspected in the current browser/native repair pass.
- `Guarded`: feedback exists, but the full path depends on a native OS dialog
  or local user file.
- `Open`: still needs a direct native click-through before the UI repair track
  can be called complete.

## Current Audit Status

| Control | Actual action now | Feedback now | Status |
| --- | --- | --- | --- |
| Project menu / Setup | Opens the project drawer | Drawer appears with Actions first and readiness collapsed | Verified |
| Verify | Captures the current ROM proof | Top status and ROM feedback return to `Ready` | Verified |
| Save | Snapshots the current project | Path appears in top status and ROM feedback paths | Verified |
| Export | Exports/copies the current ROM | Path appears in top status and ROM feedback paths | Verified |
| Agent Settings | Opens settings drawer | Settings opens as compact right drawer | Verified |
| Composer / Send | Sends chat or ROM-changing prompt | Chat labels remain `Drive16`, `You`, `Proof result`, or `OpenRouter` | Verified |
| Composer session row | Shows current provider/session mode beside the input | `OpenRouter key needed`, `OpenRouter live`, or `Ollama readiness only` appears near composer | Verified |
| Play ROM | Starts Play when the core and ROM bytes are available | Browser preview now explains import-or-desktop next step when it cannot read disk ROM bytes | Verified |
| Verify Right | Runs scripted proof input | Proof result appears and top status returns to `Ready` | Verified |
| Controls | Opens input mappings | Inline controls panel opens near the player | Verified |
| Player `More` | Reveals secondary player facts | Verify/core/controller/audio details are hidden until expanded | Verified |
| Show Details | Expands ROM/tool inspector | ROM metadata, tool health, files, proof events become visible on request | Verified |
| Provider switch | Switches OpenRouter/Ollama settings | Irrelevant provider fields hide; composer mode updates | Verified |
| New Project | Resets to blank starter | Conversation resets to a Drive16 starter message; proof preview reloads | Verified |
| Open Project | Opens latest saved snapshot when present; otherwise says save first | Drawer action status explains the outcome | Verified |
| Import Test ROM | Loads repo-generated test ROM | Drawer/player update to imported-ROM state | Verified |
| Import ROM | Opens native/browser file selection | Drawer status says accepted ROM extensions before picker | Guarded |
| Choose Core / Set Up Play | Opens native/browser file selection | Drawer/player status says accepted core extensions before picker | Guarded |
| AI sprites / MML music | Enables optional enhancement settings | Settings keeps details collapsed until expanded | Guarded |
| Native file-picker completion | Imports selected user files | Needs direct native click-through | Open |

## Primary Shell

| Control | Expected action | Feedback location | Current repair target |
| --- | --- | --- | --- |
| Project menu | Open the project/action drawer | Drawer opens from the left | Keep actions first; move readiness details behind disclosure controls. |
| Setup | Open first-run/setup drawer | Project menu / readiness summary | Do not show an endless expanded checklist by default. |
| Verify | Capture deterministic ROM proof | ROM workspace feedback near player | Keep Verify separate from interactive Play. |
| Save | Save a project snapshot | ROM workspace feedback plus project drawer | Show saved path near the action that triggered it. |
| Export | Export the active ROM | ROM workspace feedback plus project drawer | Confirm the active ROM source, not hidden starter fallback. |

## Conversation

| Control | Expected action | Feedback location | Current repair target |
| --- | --- | --- | --- |
| Agent Settings | Open provider/setup settings | Settings modal | Keep provider state close to chat. |
| Composer | Send chat or ROM-changing prompt | Conversation message list | A normal message must never be labeled as local proof. |
| Send | Submit the composer text | Conversation list and composer state | If OpenRouter needs a session key, say that plainly near chat. |
| Composer session | Explain current chat/provider mode | Directly above composer | Keep this short and readable at normal desktop widths. |

## ROM Workspace

| Control | Expected action | Feedback location | Current repair target |
| --- | --- | --- | --- |
| Pause preview | Pause/resume proof preview frames | Player toolbar and ROM workspace feedback | Label as proof preview, not gameplay. |
| Capture proof | Re-run the current ROM proof | Player feedback row | Show progress and result near the player. |
| Hide conversation | Collapse/restore chat rail | App shell | Useful at normal window widths. |
| Hide details | Collapse/restore ROM/tool inspector | App shell | Details should not crowd the player by default. |
| Focus emulator | Expand player workspace | App shell | Keep status compact and reversible. |
| More | Expand secondary player state | Player session strip | Hide core/controller/audio implementation details until asked. |
| Click ROM for keyboard | Focus keyboard input on ROM viewport | ROM control strip | Confirm focus state locally. |
| Choose Core | Import user-supplied Play core | ROM control strip / project drawer | Keep Play setup distinct from Verify. |
| Play ROM | Start interactive emulator if core is ready | ROM viewport and feedback row | If setup is missing, show the exact missing step. |
| Controls | Open keyboard/controller bindings | Inline controls panel | Keep controls near player, not in global settings sprawl. |
| Verify Right | Run scripted Right-input proof | ROM feedback row and proof details | Keep this as proof, not manual play. |

## Project Drawer

| Control | Expected action | Feedback location | Current repair target |
| --- | --- | --- | --- |
| New Project | Reset to blank starter template | Drawer action status and conversation | Make it obvious this is a reset. |
| Save Project | Snapshot current project | Drawer action status | Confirm snapshot path. |
| Open Project | Open latest or selected snapshot | Drawer action status | If unavailable, say save first. |
| Import ROM | Choose a Genesis ROM file | Drawer action status and ROM workspace | Make clear this imports for proof/play, not editing commercial games. |
| Import Test ROM | Import repo-generated test ROM | Drawer action status and ROM workspace | Useful for local smoke testing. |
| Set Up Play | Choose interactive core files | Drawer action status and ROM workspace | Preserve user-supplied core policy. |
| Export ROM | Export active ROM | Drawer action status | Confirm exported file. |

## Settings

| Control | Expected action | Feedback location | Current repair target |
| --- | --- | --- | --- |
| Provider switch | Choose OpenRouter or Ollama readiness mode | Provider section summary | Hide irrelevant provider fields after switching. |
| OpenRouter key | Store BYOK key in memory only | Provider status near key field and composer | Say keys are forgotten after reload. |
| Test OpenRouter | Validate session key | Provider status and composer mode | Freeform replies should only be live after this passes. |
| Test Ollama | Check local endpoint/model readiness | Provider status | Do not imply live Ollama chat is wired. |
| AI sprites | Enable ComfyUI sprite path | Enhancements section | Keep default off and collapsed. |
| MML music | Enable generated-MML path | Enhancements section | Keep default off and collapsed. |
