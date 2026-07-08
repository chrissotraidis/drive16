# UI Repair Control Map

Status: active UI repair artifact, updated through Phase 8 UI repair Slice 6.

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
| Project menu / Setup | Opens the project drawer | Drawer appears with Actions first and uses the active project name, not the old starter summary | Verified |
| Verify | Captures the current ROM proof when an active/imported ROM exists | Missing-ROM projects say there is no ROM to verify; real ROMs report the active path | Verified |
| Save | Snapshots the current project | Path appears in top status and ROM feedback paths | Verified |
| Export | Exports/copies the current ROM | Path appears in top status and ROM feedback paths | Verified |
| Agent Settings | Opens settings drawer | Settings opens as compact right drawer | Verified |
| Composer / Send | Sends chat or ROM-changing prompt | Chat labels remain `Drive16`, `You`, `Proof result`, or `OpenRouter`; unsafe model build/proof claims are blocked | Verified |
| Composer label | Keeps chat input neutral | Composer says `Message`; provider details stay in Settings | Verified |
| Play ROM | Starts Play when the core and ROM bytes are available | Browser preview now explains import-or-desktop next step when it cannot read disk ROM bytes | Verified |
| Playability gate | Summarizes screen, input, and audio evidence | Player evidence row says `no ROM`, `incomplete`, `failed`, or `verified` instead of treating a ROM file as playable | Verified |
| Verify Right | Runs scripted proof input | Proof result appears and top status returns to `Ready` | Verified |
| Controls | Opens input mappings | Inline controls panel opens near the player | Verified |
| Player `More` | Reveals secondary player facts | Verify/core/controller/audio details are hidden until expanded | Verified |
| Show Details | Expands ROM/tool inspector | ROM metadata, tool health, files, proof events become visible on request | Verified |
| Hide ROM details | Collapses the ROM/tool inspector | Compact ROM/tools summary returns | Verified |
| Hide/Show conversation | Collapses and restores the chat rail | ROM player expands, then the conversation rail returns | Verified |
| Provider switch | Switches OpenRouter/Ollama settings | Irrelevant provider fields hide; provider status stays in Settings | Verified |
| New Project | Resets to blank starter | Conversation, build log, imported/generated ROM state, and player state reset to a no-ROM active project | Verified |
| Open Project | Opens latest saved snapshot when present; otherwise says save first | Drawer action status explains the outcome | Verified |
| Import Test ROM | Loads repo-generated test ROM | Drawer/player update to imported-ROM state | Verified |
| Import ROM | Opens native/browser file selection | Drawer status says accepted ROM extensions before picker | Guarded |
| Set Up Play | Opens native/browser file selection for a user-supplied Genesis core | Drawer/player status explains Play setup while Verify remains available | Guarded |
| AI sprites / MML music | Enables optional enhancement settings | Settings keeps details collapsed until expanded | Guarded |
| Native valid file selection | Imports selected user ROM/core files | Needs real valid user files and error/size guardrails | Open |

## Primary Shell

| Control | Expected action | Feedback location | Current repair target |
| --- | --- | --- | --- |
| Project menu | Open the project/action drawer | Drawer opens from the left | Keep actions first; move readiness details behind disclosure controls. |
| Setup | Open first-run/setup drawer | Project menu / readiness summary | Do not show an endless expanded checklist by default. |
| Verify | Capture deterministic ROM proof | ROM workspace feedback near player | Keep Verify separate from interactive Play; do not fall back to a template ROM when the active project has none. |
| Save | Save a project snapshot | ROM workspace feedback plus project drawer | Show saved path near the action that triggered it. |
| Export | Export the active ROM | ROM workspace feedback plus project drawer | Confirm the active ROM source, not hidden starter fallback. |

## Conversation

| Control | Expected action | Feedback location | Current repair target |
| --- | --- | --- | --- |
| Agent Settings | Open provider/setup settings | Settings modal | Keep provider state in Settings, not as a persistent chat panel. |
| Composer | Send chat or ROM-changing prompt | Conversation message list | A normal message must never be labeled as local proof. |
| Send | Submit the composer text | Conversation list and composer state | If OpenRouter needs an API key, say that plainly near chat. |
| Provider status | Explain current chat/provider mode | Settings and setup replies | Do not persist provider status in the chat rail. |
| Build log | Show live agent progress | Chat rail below messages | Show meaningful events only, keep heartbeat pinned in the header, and keep raw events behind disclosure. |

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
| Set Up Play | Import user-supplied Play core | ROM control strip / project drawer | Native open/cancel path verified; valid core import still needs a compatible local core file. |
| Play ROM | Start interactive emulator if core is ready | ROM viewport and feedback row | Missing-core feedback is verified and concise. |
| Playability gate | Summarize whether the current ROM has enough evidence to be trusted | Player evidence row | Keep this conservative: visible/captured frames are not enough without input and audio truth. |
| Controls | Open keyboard/controller bindings | Inline controls panel | Keep controls near player, not in global settings sprawl. |
| Verify Right | Run scripted Right-input proof | ROM feedback row and proof details | Keep this as proof, not manual play. |

## Project Drawer

| Control | Expected action | Feedback location | Current repair target |
| --- | --- | --- | --- |
| New Project | Reset to blank starter template | Drawer action status and conversation | Make it obvious this is a reset. |
| Save Project | Snapshot current project | Drawer action status | Confirm snapshot path. |
| Open Project | Open latest or selected snapshot | Drawer action status | If unavailable, say save first. |
| Import ROM | Choose a Genesis ROM file | Drawer action status and ROM workspace | Native open/cancel path verified; valid local file selection still needs follow-up coverage. |
| Import Test ROM | Import repo-generated test ROM | Drawer action status and ROM workspace | Native import and proof capture verified. |
| Set Up Play | Choose interactive core files | Drawer action status and ROM workspace | Native open/cancel path verified; valid core import still needs a compatible local core file. |
| Export ROM | Export active ROM | Drawer action status | Confirm exported file. |

## Settings

| Control | Expected action | Feedback location | Current repair target |
| --- | --- | --- | --- |
| Provider switch | Choose OpenRouter or Ollama readiness mode | Provider section summary | Hide irrelevant provider fields after switching. |
| OpenRouter key | Store BYOK key in local app storage | Provider status near key field | Survives refresh; changing or clearing the key clears the accepted connection state. Never commit to project files, logs, exports, or screenshots. |
| Test OpenRouter | Validate API key | Provider status in Settings | Records an accepted-key marker for the saved key; freeform replies should only be live after this passes. |
| Test Ollama | Check local endpoint/model readiness | Provider status | Do not imply live Ollama chat is wired. |
| AI sprites | Enable ComfyUI sprite path | Enhancements section | Keep default off and collapsed. |
| MML music | Enable generated-MML path | Enhancements section | Keep default off and collapsed. |
