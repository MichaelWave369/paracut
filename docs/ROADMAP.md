# ParaCut Roadmap

## v0.1 — Foundation

Goal: establish the project spine before UI complexity.

- [x] Public repo
- [x] README
- [x] License
- [x] Master spec
- [x] Project format spec
- [x] Ledger event spec
- [x] TypeScript workspace scaffold
- [x] Core package folders
- [x] Example project

## v0.2 — Timeline Core Prototype

Goal: prove timeline state can be mutated through pure operations and logged as receipts.

- [x] Create project helper
- [x] Import media helper
- [x] Create track helper
- [x] Add clip helper
- [x] Move clip helper
- [x] Trim clip helper
- [x] Split clip helper
- [x] Delete clip helper
- [x] Append receipt helper
- [x] Queue render job helper
- [x] Smoke test script
- [x] Basic CI workflow
- [ ] Save/load project JSON from disk
- [ ] Receipt JSONL file adapter

## v0.3 — Render Contract Prototype

Goal: create render job definitions before integrating a full render engine.

- [x] Export preset schema
- [x] Render job schema
- [x] Render status helpers
- [ ] FFmpeg command planner
- [ ] Render receipt lifecycle
- [ ] Output metadata capture
- [ ] Error receipt capture

## v0.4 — Desktop App

Goal: create a usable local desktop workspace.

- [ ] Tauri or Electron decision
- [ ] Project open/save interface
- [ ] Media shelf interface
- [ ] Basic timeline interface
- [ ] Inspector panel
- [ ] Receipt viewer

## v0.5 — AI Approval Loop

Goal: assistant suggestions enter the same ledger as manual edits.

- [x] Suggestion model
- [x] Human approve/reject contract
- [ ] Caption generation adapter
- [ ] Silence detection adapter
- [ ] Scene detection adapter
- [ ] Suggestion-to-receipt bridge
- [ ] AI receipt viewer

## v1.0 — Creator Workbench

Goal: make ParaCut useful for daily creator workflows.

- [ ] Basic preview
- [ ] Basic export
- [ ] Captions
- [ ] Templates
- [ ] Platform presets
- [ ] Project memory
- [ ] Plugin API draft
