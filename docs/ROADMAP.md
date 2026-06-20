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
- [x] Probe executor interface boundary
- [x] Probe cache file adapter
- [x] Probe planning bridge
- [x] Cached probe application bridge
- [x] Probe plan runner bridge
- [x] Probe progress model
- [ ] Real FFprobe execution adapter
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
- [x] Probe planning cache-hit/cache-miss bridge
- [x] Cached probe application bridge
- [x] Probe plan runner cache write-back
- [x] Probe progress event model
- [ ] Probe cache pruning policy
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
- [x] Probe planning cache-hit/cache-miss bridge
- [x] Cached probe application bridge
- [x] Probe plan runner bridge
- [x] Probe progress event model
- [ ] Strong hash adapter for user-selected deep verification

## v0.13 — Probe Planning Bridge

Goal: plan probe work before running FFprobe or mutating media metadata.

- [x] Probe plan schema
- [x] Per-asset planning helper
- [x] Project-level planning helper
- [x] Cache-hit lane
- [x] Needs-probe lane
- [x] Missing-source lane
- [x] Unsupported-source lane
- [x] Probe-plan summary counts
- [x] Probe-plan receipt lifecycle
- [x] Probe planning smoke test
- [x] Cached probe application bridge
- [x] Probe executor interface boundary
- [x] Feed `needs-probe` items through injected runner bridge
- [x] Probe progress event model
- [ ] Execute needs-probe items through real FFprobe adapter
- [ ] Probe plan UI panel
- [ ] Probe plan pruning/refresh policy

## v0.14 — Cached Probe Application Bridge

Goal: safely apply cached probe metadata from a probe plan without running FFprobe.

- [x] Cached probe application schema
- [x] Apply only `cache-hit` plan items
- [x] Skip `needs-probe`, `missing-source`, and `unsupported-source` items
- [x] Guard against missing cached probe payloads
- [x] Guard against mismatched asset/project IDs
- [x] Guard against failed/skipped/no-metadata cached probes
- [x] Reuse normal media probe application receipts
- [x] Write cached-application summary receipt
- [x] Cached probe application smoke test
- [x] Feed `needs-probe` items into injectable runner bridge
- [x] Probe progress event model
- [ ] Feed `needs-probe` items into real FFprobe executor
- [ ] Probe application UI panel
- [ ] Cache invalidation refresh policy

## v0.15 — Probe Executor Interface

Goal: define the FFprobe execution boundary before spawning external processes.

- [x] Probe execution request schema
- [x] Canonical FFprobe args helper
- [x] Timeout/executable path contract
- [x] Stdout/stderr/exit-code result schema
- [x] FFprobe JSON parser into media probe metadata
- [x] Execution-to-probe-result conversion
- [x] Completed/failed/timed-out/skipped executor receipt lifecycle
- [x] Probe executor smoke test
- [x] Injectable runner interface and mock harness
- [x] Feed `needs-probe` plan items through runner bridge
- [x] Probe progress event model
- [ ] Real child-process executor
- [ ] Executable discovery policy
- [ ] Sandbox/resource-limit policy

## v0.16 — Probe Executor Runner Stub

Goal: prove executor orchestration through an injectable runner before enabling real process spawning.

- [x] Probe runner schema
- [x] `ProbeRunner` interface with `runner_id`
- [x] `executeProbeWithRunner()` orchestration helper
- [x] Deterministic mock runner fixtures
- [x] Success fixture path
- [x] Non-zero exit fixture path
- [x] Timed-out fixture path
- [x] Unmatched fixture skipped path
- [x] Thrown-runner exception normalization
- [x] Request-id mismatch normalization
- [x] Optional executor receipt output
- [x] Probe runner smoke test
- [x] Feed `needs-probe` plan items through runner bridge
- [x] Probe progress event model
- [ ] Real child-process runner behind explicit opt-in
- [ ] Runner timeout enforcement policy
- [ ] Runner sandbox/resource-limit policy

## v0.17 — Probe Plan Runner Bridge

Goal: run only planned `needs-probe` items through an injected runner, then apply and cache successful probe metadata.

- [x] Probe plan runner schema
- [x] Run only `needs-probe` plan items
- [x] Skip `cache-hit`, `missing-source`, and `unsupported-source` plan items
- [x] Build canonical probe execution requests from plan items
- [x] Execute requests through injected runner
- [x] Record executor receipts for attempted runs
- [x] Apply successful probe metadata through normal media probe bridge
- [x] Save successful probe results back to `.paracut/probes/`
- [x] Write probe-plan runner summary receipt
- [x] Probe plan runner smoke test
- [x] Batch probe progress model
- [ ] Real FFprobe child-process runner behind explicit opt-in
- [ ] Probe retry/backoff policy

## v0.18 — Probe Progress Model

Goal: give future UI/orchestration a typed progress stream for batch probe work.

- [x] Probe progress event schema
- [x] Probe progress batch schema
- [x] Queued event lane
- [x] Running event lane
- [x] Applied event lane
- [x] Cached event lane
- [x] Failed event lane
- [x] Skipped event lane
- [x] Event-based progress counts
- [x] Terminal progress count helper
- [x] Convert probe-plan runner results into progress events
- [x] Probe progress smoke test
- [ ] Live progress callback from probe-plan runner bridge
- [ ] Progress persistence adapter
- [ ] Probe progress UI panel

## v1.0 — Creator Workbench

Goal: make ParaCut useful for daily creator workflows.

- [ ] Basic preview
- [ ] Basic export
- [ ] Captions
- [ ] Templates
