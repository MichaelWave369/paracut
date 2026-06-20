# ParaCut

**The timeline is a ledger.**

ParaCut is a local-first, AI-assisted video editor built around a clean timeline core, reversible edit receipts, creator memory, auditable render plans, portable project folders, a desktop shell, runtime command wiring, local app settings, safe media import references, media probe metadata contracts, probe cache adapters, source fingerprints, probe planning, cached probe application, probe executor boundaries, safe probe runner stubs, and human-approved automation.

This repository starts ParaCut as a ground-up build inspired by the open-source creator-editor space, but designed around a Parallax-style ledger spine from day one.

## Product Promise

ParaCut helps creators make videos fast without losing control of their files, edits, style, or provenance.

It is not only a timeline UI. It is a creator workbench where every meaningful action can be saved, replayed, audited, reverted, persisted, reloaded, and exported with context.

## Core Ideas

- **Local-first projects**: project folders remain readable and portable.
- **Timeline as data**: clips, tracks, captions, effects, and exports live in structured project files.
- **Receipts for every edit**: cuts, trims, moves, AI suggestions, approvals, render plans, media imports, media probes, probe cache applications, probe executor outcomes, and exports are logged.
- **Human-approved AI**: AI may suggest edits, captions, scenes, or exports, but the creator stays in control.
- **Auditable render plans**: a queued render becomes an inspectable FFmpeg-style plan before execution.
- **Portable folder spine**: `project.json`, `receipts.jsonl`, and `manifest.json` form the v0.4 persistence contract.
- **Desktop shell first**: v0.5 proves project summary, active panel state, command readiness, and static workspace layout before a heavy GUI runtime.
- **Assistant suggestion inbox**: v0.6 stores AI proposals in project state and logs proposal, approval, rejection, and application receipts.
- **Desktop runtime bridge**: v0.7 wires open/save/save-as project folder commands over the file adapter for a future Tauri command layer.
- **Local app settings**: v0.8 adds `settings.json`, default panel/preset preferences, autosave preference, and recent-project memory.
- **Safe media references**: v0.9 imports media as references, infers kind/name/intent, preserves rights notes, and prepares future proxy/thumbnail/waveform/cache targets without copying large files.
- **Media probe contracts**: v0.10 defines duration, dimensions, codecs, audio, bitrate, stream, warning, and error metadata without running FFmpeg yet.
- **Probe cache adapter**: v0.11 saves and reloads probe results under `.paracut/probes/` so unchanged media can avoid re-probing later.
- **Source fingerprints**: v0.12 derives local file fingerprints from filesystem stats so probe cache lookup can be automatic.
- **Probe planning bridge**: v0.13 plans each media asset as `cache-hit`, `needs-probe`, `missing-source`, or `unsupported-source` before any real probing runs.
- **Cached probe application**: v0.14 applies only valid `cache-hit` probe metadata to project media assets and records a summary receipt.
- **Probe executor interface**: v0.15 defines the FFprobe request/result/receipt boundary before spawning any external process.
- **Probe runner stub**: v0.16 adds an injectable runner harness and deterministic mock runner without spawning FFprobe.
- **Creator memory**: preferred styles, caption formats, pacing, and export presets can be remembered.
- **Plugin-ready future**: effects, transitions, render presets, caption styles, and AI tools should become modular.

## Current Status

**Stage:** v0.16 probe executor runner stub

ParaCut is not a working editor yet, but it now has a typed foundation for:

1. Creating a project.
2. Importing media.
3. Creating timeline tracks.
4. Adding, trimming, splitting, moving, and deleting clips.
5. Queueing render jobs.
6. Converting timeline + media + export preset into an auditable render plan.
7. Recording each meaningful action, including render-plan creation, as a receipt.
8. Saving a project folder with `project.json`, `receipts.jsonl`, and `manifest.json`.
9. Loading a project folder and validating manifest/project/receipt consistency.
10. Holding desktop shell state for a loaded project.
11. Summarizing project counts for UI panels.
12. Building command readiness states for open/save/import/render/receipts.
13. Opening a project folder through the desktop runtime.
14. Saving the loaded runtime project back to its attached folder.
15. Saving the loaded runtime project as a new folder.
16. Replacing the in-memory runtime project after command mutations.
17. Storing assistant suggestions on the project.
18. Logging AI proposal, approval, rejection, and application receipts.
19. Creating, saving, loading, and normalizing app settings.
20. Tracking default panel, default export preset, autosave preference, and recent projects.
21. Creating safe media import references with inferred kind/name/intent.
22. Preparing proxy, thumbnail, waveform, and cache target paths for later adapters.
23. Applying a media import batch to a project with individual import receipts and a batch receipt.
24. Creating media probe results for duration, dimensions, codecs, audio properties, bitrate, streams, warnings, and errors.
25. Applying successful probe metadata to project media assets and recording probe receipts.
26. Recording failed/skipped probe receipts without corrupting existing asset metadata.
27. Saving and loading media probe cache records from `.paracut/probes/`.
28. Deriving local source fingerprints from file size and modified time.
29. Using source fingerprints to hit or miss probe cache records.
30. Planning media probe work as cache hits, probe-needed assets, missing sources, or unsupported sources.
31. Recording a probe-plan receipt without running FFprobe or mutating media metadata.
32. Applying cached probe metadata for cache-hit plan items only.
33. Skipping needs-probe, missing-source, and unsupported-source plan items without mutating media.
34. Recording a cached-probe application summary receipt.
35. Building canonical FFprobe request args without spawning FFprobe.
36. Normalizing executor stdout/stderr/exit/timeout results.
37. Parsing FFprobe JSON into ParaCut probe metadata.
38. Recording probe executor completed/failed/timed-out/skipped receipts.
39. Running probe executor requests through an injectable runner interface.
40. Using a deterministic mock probe runner for success, failure, timeout, skipped, and thrown-runner cases.
41. Running smoke tests against the core loop, file adapter loop, desktop shell loop, desktop runtime loop, settings loop, AI approval loop, media import loop, media probe loop, probe cache loop, source fingerprint loop, probe planning loop, cached probe application loop, probe executor loop, and probe runner loop.

## Quick Start

```bash
pnpm install
pnpm typecheck
pnpm smoke
pnpm dev:desktop
```

The core smoke test creates a sample project in memory, performs timeline edits, queues a vertical export job, creates an FFmpeg-style render plan, and verifies the receipt count.

The file smoke test creates a temp project folder, saves `project.json`, `receipts.jsonl`, and `manifest.json`, reloads them, validates counts, and removes the temp folder.

The desktop shell smoke test loads a sample project into shell state, checks panel switching, checks command readiness, and verifies the sample project summary.

The desktop runtime smoke test creates a temp project folder, opens it through the runtime, mutates the loaded project, saves it, saves it as a second folder, validates manifest counts, and confirms recent-project memory updates.

The settings smoke test creates `settings.json`, changes preferences, writes/reads settings, load-or-creates missing settings, and routes settings through the desktop runtime.

The AI approval smoke test proposes, approves, applies, and rejects assistant suggestions while confirming every state transition is receipt-tracked.

The media import smoke test creates media import references, applies a batch to a project, validates proxy/thumbnail/waveform/cache targets, and confirms duplicate inferred asset IDs are made unique inside a batch.

The media probe smoke test applies mock probe metadata to a media asset, verifies duration/dimensions/audio enrichment, records a completed probe receipt, then records a failed probe without erasing known metadata.

The probe cache smoke test writes a probe record to `.paracut/probes/`, reloads it, verifies metadata survives, and confirms changed fingerprints miss the cache.

The source fingerprint smoke test fingerprints a local file, uses that fingerprint for a probe cache hit, changes the file, verifies a cache miss, then checks relative, remote, and missing-source behavior.

The probe planning smoke test builds a mixed media project, checks `cache-hit`, `needs-probe`, `missing-source`, and `unsupported-source` lanes, then records the plan as a receipt.

The cached probe application smoke test consumes a probe plan, applies only the cache-hit item, skips every other lane, verifies metadata enrichment, and checks both the normal probe receipt and summary receipt.

The probe executor smoke test builds a canonical FFprobe request, parses realistic FFprobe JSON, converts execution output into a media probe result, and records completed/failed/timed-out executor receipts without launching FFprobe.

The probe runner smoke test runs executor requests through an injectable mock runner, covering success, non-zero exit, timeout, skipped, and thrown-runner normalization without launching FFprobe.

`pnpm dev:desktop` runs a console preview of the desktop shell state. The static desktop mock lives at `apps/desktop/public/index.html`.

## Repository Layout

```txt
paracut/
  apps/
    desktop/              # Desktop shell, runtime wiring, and static mock
  packages/
    ai-core/              # AI suggestion and approval contracts
    cached-probe-application-core/ # Cached probe metadata application bridge
    file-adapter-core/    # Project folder save/load adapter
    ledger-core/          # Receipt/event model
    media-core/           # Media asset model
    media-import-core/    # Safe media import references and batch application
    media-probe-core/     # Media probe metadata and project enrichment contract
    probe-cache-core/     # Local probe result cache adapter
    probe-executor-core/  # FFprobe executor request/result/receipt boundary
    probe-planning-core/  # Probe planning bridge across fingerprint/cache/probe lanes
    probe-runner-core/    # Injectable probe runner and mock harness
    project-core/         # Project orchestration layer
    render-core/          # Export/render job and render-plan model
    settings-core/        # Local app settings and recent-project memory
    source-fingerprint-core/ # Local filesystem source fingerprint adapter
    timeline-core/        # Timeline state and reducer logic
    ui-kit/               # Shared UI primitives later
  scripts/
    smoke-test.ts                  # Core project/timeline/render smoke test
    file-adapter-smoke-test.ts     # Project folder persistence smoke test
    desktop-shell-smoke-test.ts    # Desktop shell smoke test
    desktop-runtime-smoke-test.ts  # Desktop runtime open/save smoke test
    settings-smoke-test.ts         # Local app settings smoke test
    ai-approval-smoke-test.ts      # AI proposal/review/application smoke test
    media-import-smoke-test.ts     # Media import adapter smoke test
    media-probe-smoke-test.ts      # Media probe metadata smoke test
    probe-cache-smoke-test.ts      # Probe cache adapter smoke test
    source-fingerprint-smoke-test.ts # Local source fingerprint smoke test
    probe-planning-smoke-test.ts   # Probe planning bridge smoke test
    cached-probe-application-smoke-test.ts # Cached probe application smoke test
    probe-executor-smoke-test.ts   # Probe executor boundary smoke test
    probe-runner-smoke-test.ts     # Probe runner harness smoke test
  docs/
    MASTER_SPEC.md
    PROJECT_FORMAT.md
    LEDGER_EVENTS.md
    ROADMAP.md
    V0_2_BUILD_NOTES.md
    V0_3_RENDER_PLANNER.md
    V0_4_FILE_ADAPTER.md
    V0_5_DESKTOP_SHELL.md
    V0_6_AI_APPROVAL_LOOP.md
    V0_7_DESKTOP_RUNTIME.md
    V0_8_SETTINGS_LAYER.md
    V0_9_MEDIA_IMPORT_ADAPTER.md
    V0_10_MEDIA_PROBE_CONTRACT.md
    V0_11_PROBE_CACHE_ADAPTER.md
    V0_12_SOURCE_FINGERPRINT_ADAPTER.md
    V0_13_PROBE_PLANNING_BRIDGE.md
    V0_14_CACHED_PROBE_APPLICATION.md
    V0_15_PROBE_EXECUTOR_INTERFACE.md
    V0_16_PROBE_RUNNER_STUB.md
  examples/
    sample-project/
```

## Initial Build Target

The first real version should do six things well:

1. Import video/audio/image files.
2. Place clips on a timeline.
3. Cut, trim, move, and delete clips.
4. Save/load project state as readable JSON.
5. Export through an auditable render pipeline.
6. Log every important action as a receipt.
