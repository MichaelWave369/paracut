# ParaCut v0.5 Desktop App Shell

## Status

v0.5 adds the first desktop app shell contract for ParaCut.

This is not a finished editor UI, and it is not yet a Tauri/Electron runtime. It is a CI-safe shell layer that proves the desktop app can hold project state, summarize a project, expose panel state, expose command readiness, and render a static workspace mock without changing the core architecture.

## What v0.5 adds

- `apps/desktop/package.json`
- `apps/desktop/src/shell.ts`
- `apps/desktop/src/sample-project.ts`
- `apps/desktop/src/dev-preview.ts`
- `apps/desktop/public/index.html`
- `scripts/desktop-shell-smoke-test.ts`

## Shell responsibilities

The shell state tracks:

- active panel
- loaded project
- project folder snapshot, when one exists
- dirty/clean save state
- status message
- last loaded timestamp
- last saved timestamp

The shell can summarize:

- project ID
- project name
- media asset count
- track count
- clip count
- receipt count
- render job count
- timeline duration

The shell also exposes command readiness for:

- open project folder
- save project folder
- import media
- plan render
- view receipts

## Why this is intentionally thin

ParaCut should not jump into a heavy desktop runtime before the timeline, ledger, file adapter, and render plan contracts are stable.

v0.5 keeps the desktop layer small so it can be tested in CI without pulling in a GUI stack. The app can move to Tauri after the shell contract is proven.

## Smoke test coverage

`pnpm smoke:desktop` verifies that the shell can:

1. Load a sample ParaCut project.
2. Produce a project summary.
3. Count media, tracks, clips, receipts, render jobs, and duration.
4. Build command readiness states.
5. Explain why save is disabled without a project folder.
6. Switch active panels.
7. Mark the shell dirty.

## Boundary

v0.5 does not yet provide:

- real file picker integration
- drag/drop media import
- waveform rendering
- timeline canvas rendering
- Tauri commands
- native menu bindings
- real export execution

Those come later. v0.5 exists to make the desktop app state honest first.
