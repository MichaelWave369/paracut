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

- [ ] Create project helper
- [ ] Import media helper
- [ ] Create track helper
- [ ] Add clip helper
- [ ] Move clip helper
- [ ] Trim clip helper
- [ ] Cut clip helper
- [ ] Delete clip helper
- [ ] Append receipt helper
- [ ] Save/load project JSON

## v0.3 — Render Contract Prototype

Goal: create render job definitions before integrating a full render engine.

- [ ] Export preset schema
- [ ] FFmpeg command planner
- [ ] Render receipt lifecycle
- [ ] Output metadata capture
- [ ] Error receipt capture

## v0.4 — Desktop Shell

Goal: create a usable local desktop workspace.

- [ ] Tauri or Electron decision
- [ ] Project open/save UI
- [ ] Media shelf UI
- [ ] Basic timeline UI
- [ ] Inspector panel
- [ ] Receipt viewer

## v0.5 — AI Approval Loop

Goal: AI suggestions enter the same ledger as manual edits.

- [ ] Suggestion model
- [ ] Human approve/reject flow
- [ ] Caption generation adapter
- [ ] Silence detection adapter
- [ ] Scene detection adapter
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
