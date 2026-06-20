# ParaCut

**The timeline is a ledger.**

ParaCut is a local-first, AI-assisted video editor built around a clean timeline core, reversible edit receipts, creator memory, auditable render plans, portable project folders, and human-approved automation.

This repository starts ParaCut as a ground-up build inspired by the open-source creator-editor space, but designed around a Parallax-style ledger spine from day one.

## Product Promise

ParaCut helps creators make videos fast without losing control of their files, edits, style, or provenance.

It is not only a timeline UI. It is a creator workbench where every meaningful action can be saved, replayed, audited, reverted, persisted, reloaded, and exported with context.

## Core Ideas

- **Local-first projects**: project folders remain readable and portable.
- **Timeline as data**: clips, tracks, captions, effects, and exports live in structured project files.
- **Receipts for every edit**: cuts, trims, moves, AI suggestions, approvals, render plans, and exports are logged.
- **Human-approved AI**: AI may suggest edits, captions, scenes, or exports, but the creator stays in control.
- **Auditable render plans**: a queued render becomes an inspectable FFmpeg-style plan before execution.
- **Portable folder spine**: `project.json`, `receipts.jsonl`, and `manifest.json` form the v0.4 persistence contract.
- **Creator memory**: preferred styles, caption formats, pacing, and export presets can be remembered.
- **Plugin-ready future**: effects, transitions, render presets, caption styles, and AI tools should become modular.

## Current Status

**Stage:** v0.4 file adapter scaffold

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
10. Running smoke tests against the core loop and file adapter loop.

## Quick Start

```bash
pnpm install
pnpm typecheck
pnpm smoke
```

The core smoke test creates a sample project in memory, performs timeline edits, queues a vertical export job, creates an FFmpeg-style render plan, and verifies the receipt count.

The file smoke test creates a temp project folder, saves `project.json`, `receipts.jsonl`, and `manifest.json`, reloads them, validates counts, and removes the temp folder.

## Repository Layout

```txt
paracut/
  apps/
    desktop/              # Future desktop app
  packages/
    ai-core/              # AI suggestion and approval contracts
    file-adapter-core/    # Project folder save/load adapter
    ledger-core/          # Receipt/event model
    media-core/           # Media asset model
    project-core/         # Project orchestration layer
    render-core/          # Export/render job and render-plan model
    timeline-core/        # Timeline state and reducer logic
    ui-kit/               # Shared UI primitives later
  scripts/
    smoke-test.ts              # Core project/timeline/render smoke test
    file-adapter-smoke-test.ts # Project folder persistence smoke test
  docs/
    MASTER_SPEC.md
    PROJECT_FORMAT.md
    LEDGER_EVENTS.md
    ROADMAP.md
    V0_2_BUILD_NOTES.md
    V0_3_RENDER_PLANNER.md
    V0_4_FILE_ADAPTER.md
  examples/
    sample-project/
```

## Initial Build Target

The first real version should do six things well:

1. Import video, audio, and image media.
2. Place clips on a timeline.
3. Cut, trim, move, and delete clips.
4. Save/load a readable project folder.
5. Export through an auditable render job and render plan.
6. Append every action to a receipt log.

## License

MIT. See [LICENSE](./LICENSE).
