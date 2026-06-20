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
- [x] Project JSON serialize/parse helpers
- [x] Receipt JSONL serialize/parse helpers
- [x] Smoke test script
- [x] Basic CI workflow

## v0.3 — Render Contract Prototype

Goal: create auditable render plans before integrating a full render engine.

- [x] Export preset schema
- [x] Render job schema
- [x] Render status helpers
- [x] FFmpeg-style command planner
- [x] Render plan input inventory
- [x] Render plan clip normalization
- [x] Render plan warning collection
- [x] Render-plan receipt lifecycle
- [x] Smoke test covers render planning
- [ ] Output metadata capture
- [ ] Error receipt capture
- [ ] Real FFmpeg execution adapter

## v0.4 — File Adapter Layer

Goal: make project state portable before the desktop UI exists.

- [x] Save/load project JSON from disk
- [x] Receipt JSONL disk adapter
- [x] Project folder manifest
- [x] Manifest/project/receipt consistency checks
- [x] File adapter smoke test
- [ ] Media copy/import adapter
- [ ] Proxy folder adapter
- [ ] Thumbnail folder adapter
- [ ] Render output folder adapter

## v0.5 — Desktop App Shell

Goal: create a tested desktop shell state before native runtime complexity.

- [x] Tauri-first decision boundary documented
- [x] Desktop shell package
- [x] Project-loaded shell state
- [x] Active panel state
- [x] Project summary model
- [x] Command readiness model
- [x] Static workspace mock
- [x] Desktop preview script
- [x] Desktop shell smoke test
- [ ] Real Tauri runtime wiring
- [ ] Project open/save native dialog interface
- [ ] Media shelf interface
- [ ] Basic timeline interface
- [ ] Inspector panel
- [ ] Receipt viewer

## v0.6 — AI Approval Loop

Goal: assistant suggestions enter the same ledger as manual edits.

- [x] Suggestion model
- [x] Human approve/reject contract
- [ ] Caption generation adapter
- [ ] Silence detection adapter
- [ ] Scene detection adapter
- [ ] Suggestion-to-receipt bridge
- [ ] AI receipt viewer

## v0.7 — Desktop Runtime Wiring

Goal: move from shell contract to a local app runtime.

- [ ] Add Tauri app runtime
- [ ] Wire open project command to file adapter
- [ ] Wire save project command to file adapter
- [ ] Render static shell layout through app window
- [ ] Add native app menu draft
- [ ] Add local settings file

## v1.0 — Creator Workbench

Goal: make ParaCut useful for daily creator workflows.

- [ ] Basic preview
- [ ] Basic export
- [ ] Captions
- [ ] Templates
- [ ] Platform presets
- [ ] Project memory
- [ ] Plugin API draft
