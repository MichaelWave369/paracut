# ParaCut Roadmap

## Current lane

**Active stage:** v0.20 Probe Progress Persistence Adapter

ParaCut is moving in small, CI-safe layers: data contracts first, then persistence, then bounded execution, then UI/runtime wiring.

## Completed spine

### v0.1 — Foundation

- [x] Public repository
- [x] README, license, master spec, project format spec, ledger event spec
- [x] TypeScript workspace scaffold
- [x] Core package folders
- [x] Example project

### v0.2 — Timeline Core Prototype

- [x] Create/import media/project helpers
- [x] Track, clip, trim, split, move, delete helpers
- [x] Receipt append helpers
- [x] Render job queue helper
- [x] Project JSON and receipt JSONL helpers
- [x] Core smoke test and CI workflow

### v0.3 — Render Contract Prototype

- [x] Export preset schema
- [x] Render job schema
- [x] FFmpeg-style render plan contract
- [x] Render plan input inventory and clip normalization
- [x] Render-plan receipt lifecycle
- [x] Render planner smoke test

### v0.4 — File Adapter Layer

- [x] Save/load project folder
- [x] `project.json`, `receipts.jsonl`, and `manifest.json`
- [x] Manifest/project/receipt consistency checks
- [x] File adapter smoke test

### v0.5 — Desktop App Shell

- [x] Desktop shell package
- [x] Project-loaded shell state
- [x] Active panel state
- [x] Project summary model
- [x] Command readiness model
- [x] Static workspace mock
- [x] Desktop shell smoke test

### v0.6 — AI Approval Loop

- [x] Assistant suggestion model
- [x] Human approve/reject/apply contract
- [x] Suggestion-to-project bridge
- [x] AI proposal/approval/rejection/application receipts
- [x] AI approval smoke test

### v0.7 — Desktop Runtime Wiring

- [x] Desktop runtime state model
- [x] Open/save/save-as project folder commands
- [x] Runtime project replacement helper
- [x] Desktop runtime smoke test

### v0.8 — Local Settings Layer

- [x] App settings schema
- [x] Default panel and export preset preferences
- [x] Autosave flag
- [x] Recent project folder list
- [x] Settings JSON read/write adapter
- [x] Desktop runtime settings bridge
- [x] Settings smoke test

### v0.9 — Media Import Adapter

- [x] Safe source URI normalization
- [x] Media kind/name/intent inference
- [x] Rights note preservation
- [x] Reference-only import policy
- [x] Future proxy/thumbnail/waveform/cache target paths
- [x] Batch import receipts
- [x] Media import smoke test

### v0.10 — Media Probe Contract

- [x] Media probe result schema
- [x] Container/video/audio/stream metadata contracts
- [x] Probe status, warning, and error capture
- [x] Probe-to-media metadata enrichment helper
- [x] Probe receipt lifecycle
- [x] Media probe smoke test

### v0.11 — Probe Cache Adapter

- [x] Probe cache record schema
- [x] `.paracut/probes/` folder convention
- [x] Save/load probe cache helpers
- [x] Cache lookup helper with miss handling
- [x] Probe cache smoke test

### v0.12 — Source Fingerprint Adapter

- [x] Source fingerprint result schema
- [x] Stat-based fingerprint algorithm
- [x] Local `file://`, absolute path, and relative path support
- [x] Missing/unsupported source statuses
- [x] Probe-cache key input bridge
- [x] Source fingerprint smoke test

### v0.13 — Probe Planning Bridge

- [x] Probe plan schema
- [x] Per-asset and project-level planning helpers
- [x] `cache-hit`, `needs-probe`, `missing-source`, and `unsupported-source` lanes
- [x] Probe-plan receipt lifecycle
- [x] Probe planning smoke test

### v0.14 — Cached Probe Application Bridge

- [x] Cached probe application schema
- [x] Apply only valid `cache-hit` items
- [x] Skip uncached/missing/unsupported lanes without mutation
- [x] Guard against stale or mismatched cache payloads
- [x] Cached-probe application summary receipt
- [x] Cached probe application smoke test

### v0.15 — Probe Executor Interface

- [x] FFprobe request/result contract
- [x] Canonical FFprobe args builder
- [x] Stdout/stderr/exit/timeout capture model
- [x] FFprobe JSON parser into ParaCut probe metadata
- [x] Executor receipt lifecycle
- [x] Probe executor smoke test

### v0.16 — Probe Executor Runner Stub

- [x] Injectable `ProbeRunner` interface
- [x] Safe mock runner harness
- [x] Runner exception normalization
- [x] Request-ID mismatch guard
- [x] Probe runner smoke test

### v0.17 — Probe Plan Runner Bridge

- [x] Run only `needs-probe` plan items through injected runner
- [x] Apply successful probe metadata to project assets
- [x] Cache successful probe results
- [x] Executor/media-probe/summary receipts
- [x] Probe plan runner smoke test

### v0.18 — Probe Progress Model

- [x] Progress event schema
- [x] Queued/running/applied/cached/failed/skipped event types
- [x] Batch count model
- [x] Convert runner output into progress batches
- [x] Probe progress smoke test

### v0.19 — Probe Runner Progress Bridge

- [x] Optional progress batch output from `runProbePlanWithRunner()`
- [x] Optional live progress callback support
- [x] Queued/running/terminal event emission during runner bridge flow
- [x] Probe runner progress bridge smoke test

### v0.20 — Probe Progress Persistence Adapter

- [x] Probe progress persistence schema
- [x] `.paracut/progress/` folder convention
- [x] Save/load named progress batches
- [x] Save/load `latest.json` recovery record
- [x] Validate persisted counts against event list
- [x] Probe progress persistence smoke test

## Next likely lanes

### v0.21 — Probe Progress Receipt Bridge

- [ ] Optional receipt for persisted progress batch writes
- [ ] Receipt payload with batch ID, event count, terminal count, and latest pointer status
- [ ] Smoke test for progress persistence receipt emission

### Later execution/UI lanes

- [ ] Real FFprobe child-process adapter behind explicit safety gate
- [ ] Probe worker queue and cancellation model
- [ ] Retry/backoff model for failed probes
- [ ] Probe plan/progress UI panel
- [ ] Thumbnail extraction adapter
- [ ] Waveform extraction adapter
- [ ] Proxy generation adapter
- [ ] Real Tauri desktop runtime
- [ ] Media shelf interface
- [ ] Basic timeline interface
- [ ] Inspector panel
- [ ] Receipt viewer
