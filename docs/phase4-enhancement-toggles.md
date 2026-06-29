# Phase 4 Enhancement Toggle Evidence

## Scope

Phase 4 starts by gating the deferred AI sprite and MML music generators behind
settings toggles. Both toggles default to off so the proven CORE bundled-asset
path remains the app default.

Implemented controls:

- `AI sprites`, for the ComfyUI generator path.
- `MML music`, for the ctrmml compiler path.

The controls are UI state only in this slice. They do not start ComfyUI,
install `comfyui-mcp`, call ctrmml, or change the v1 bundled-asset prompt path.

## Architecture Alignment

The Phase 4 architecture requires both enhancement paths to be optional and
gated behind settings toggles so CORE never depends on them. This slice adds
that gate before adding either external dependency.

## Verification

Run for this slice:

```sh
pnpm --dir app build
```

Result:

- Frontend build passed.
- Browser check at `http://127.0.0.1:1420/` showed title `Drive16`.
- App header showed `Phase 4 enhancements`.
- Settings dialog included the `Enhancements` section.
- Both toggles rendered off by default.
- Toggling both settings changed their visible statuses to `On`.
- Final reload returned both toggles to off by default.
- Browser console warnings and errors were empty.
- Browser viewport had no horizontal overflow.

## Next

Add ComfyUI endpoint configuration and health probing behind the `AI sprites`
toggle.
