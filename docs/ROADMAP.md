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
- [x] Media reference/import adapter
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
- [ ] Media shelf interface
- [ ] Basic timeline interface
- [ ] Inspector panel
- [ ] Receipt viewer

## v0.6 — AI Approval Loop

Goal: assistant suggestions enter the same ledger as manual edits.

- [x] Suggestion model
- [x] Human approve/reject contract
- [x] Suggestion-to-project bridge
- [x] Suggestion-to-receipt bridge
- [x] Proposed/approved/rejected/applied receipt lifecycle
- [x] AI approval smoke test
- [ ] Caption generation adapter
- [ ] Silence detection adapter
- [ ] Scene detection adapter
- [ ] AI receipt viewer

## v0.7 — Desktop Runtime Wiring

Goal: move from shell contract to a local app runtime command bridge.

- [x] Desktop runtime state model
- [x] Wire open project command to file adapter
- [x] Wire save project command to file adapter
- [x] Wire save-as project command to file adapter
- [x] Add runtime project replacement helper for command mutations
- [x] Desktop runtime smoke test
- [ ] Real Tauri app runtime
- [ ] Project open/save native dialog interface
- [ ] Render static shell layout through app window
- [ ] Add native app menu draft

## v0.8 — Local Settings Layer

Goal: add creator memory without introducing cloud accounts or databases.

- [x] App settings schema
- [x] Default panel preference
- [x] Default export preset preference
- [x] Autosave preference flag
- [x] Recent project folder list
- [x] Settings JSON read/write adapter
- [x] Load-or-create settings helper
- [x] Desktop runtime settings load/save bridge
- [x] Runtime recent-project updates on open/save-as
- [x] Settings smoke test
- [ ] Native app config directory resolver
- [ ] Settings panel UI
- [ ] Settings migration framework

## v0.9 — Media Import Adapter

Goal: make media import explicit, portable, and receipt-aware before copying or probing large files.

- [x] Safe source URI normalization
- [x] Media kind inference from URI/data MIME/extension
- [x] Name and asset ID inference
- [x] Rights note preservation and default warning
- [x] Local/remote/data scheme detection
- [x] Reference-only import policy
- [x] Future proxy/thumbnail/waveform/cache target paths
- [x] Batch import model
- [x] Duplicate inferred asset ID handling within a batch
- [x] Batch import receipt after individual media receipts
- [x] Media import smoke test
- [ ] Real file picker adapter
- [x] Media probing contract for duration/codec/size
- [ ] Copy-to-project-media adapter
- [ ] Proxy generation adapter
- [ ] Thumbnail generation adapter

## v0.10 — Media Probe Contract

Goal: define a typed, receipt-aware probe layer before wiring FFprobe or platform-native media metadata readers.

- [x] Media probe result schema
- [x] Container/video/audio/stream metadata contracts
- [x] Probe status model for completed, failed, and skipped probes
- [x] Probe warning/error capture
- [x] Probe-to-media metadata enrichment helper
- [x] Probe-to-project application bridge
- [x] Completed/failed/skipped probe receipt lifecycle
- [x] Media probe smoke test
- [ ] Real FFprobe execution adapter
- [x] Probe cache file adapter
- [ ] Probe-from-import batch bridge
- [ ] Thumbnail extraction adapter
- [ ] Waveform extraction adapter

## v0.11 — Probe Cache Adapter

Goal: save and reload probe results so unchanged media can avoid unnecessary re-probing later.

- [x] Probe cache record schema
- [x] Deterministic cache key helper
- [x] `.paracut/probes/` folder convention
- [x] Save probe cache record helper
- [x] Load probe cache record helper
- [x] Cache lookup helper with miss handling
- [x] Runtime cache/probe consistency validation
- [x] Probe cache smoke test
- [x] Source fingerprint adapter from real filesystem stats
- [ ] Probe cache pruning policy
- [ ] Probe-from-import batch bridge
- [ ] FFprobe execution adapter integration

## v0.12 — Source Fingerprint Adapter

Goal: derive stable local source fingerprints so probe cache lookup can become automatic.

- [x] Source fingerprint result schema
- [x] Stat-based fingerprint algorithm
- [x] Local `file://` source support
- [x] Absolute path support
- [x] Relative path support against project root
- [x] Missing source status
- [x] Unsupported remote/data/unknown scheme status
- [x] Probe-cache key input bridge
- [x] Source fingerprint smoke test
- [ ] Fingerprint-from-media-import bridge
- [ ] Probe planning cache-hit/cache-miss bridge
- [ ] Strong hash adapter for user-selected deep verification

## v1.0 — Creator Workbench

Goal: make ParaCut useful for daily creator workflows.

- [ ] Basic preview
- [ ] Basic export
- [ ] Captions
- [ ] Templates
