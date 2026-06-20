# ParaCut v0.2 Build Notes

**Tagline:** The timeline is a ledger.

v0.2 turns ParaCut from a named scaffold into a small working core loop. It is still not a video editor UI, but the core data model can now create a project, import media, mutate a timeline, queue a render job, and record receipts for each meaningful action.

## What changed

### Timeline core

- Added safer track and clip helpers.
- Fixed cross-track clip movement so a moved clip is actually stored under the destination track.
- Added timeline duration, clip lookup, track lookup, split clip, and validation helpers.
- Added duplicate track and clip ID checks.

### Media core

- Added `MediaLibrary`.
- Added duplicate asset checks.
- Added negative duration guard.
- Added visual/audio helper predicates.

### Project core

- Added the orchestration layer that ties together media, timeline, render jobs, and receipts.
- Added helpers for project creation, media import, track creation, clip add/move/trim/split/delete, render queueing, and project serialization.

### Render core

- Added render status helpers.
- Added square and audio export presets.
- Added safer render job creation.

### AI core

- Added a bounded assistant suggestion model.
- Added approve, reject, and mark-applied helpers.
- Preserved the ParaCut rule: assistant suggestions are not applied unless approved.

### Test/CI

- Added `scripts/smoke-test.ts`.
- Added `pnpm smoke`.
- Added GitHub Actions CI for install, typecheck, and smoke test.

## Current core loop

1. Create project.
2. Import media.
3. Add tracks.
4. Add clip.
5. Trim clip.
6. Split clip.
7. Move split clip to another track.
8. Queue vertical render.
9. Verify receipt count.

## Next best step

v0.3 should add a render command planner that converts a ParaCut project and export preset into an FFmpeg command plan without executing it yet. That keeps render behavior auditable before ParaCut starts touching real user files.
