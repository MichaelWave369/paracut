# v0.20 — Probe Progress Persistence Adapter

## Purpose

v0.20 makes probe progress recoverable after a run.

The v0.18 model created UI-ready progress batches. v0.19 wired those batches into the probe plan runner bridge. v0.20 adds a small local persistence adapter so a future desktop UI can reload the last probe run history from disk.

## What landed

- New `@paracut/probe-progress-persistence-core` package.
- `.paracut/progress/` folder convention.
- Batch-specific progress JSON files.
- `latest.json` recovery record for the most recently saved progress batch.
- Save/load helpers for named progress batches.
- Save/load helpers for the latest progress batch.
- Runtime validation for persisted progress records.
- Count validation so persisted event counts must still match the event list.
- Smoke test for save, named reload, latest reload, safe filenames, and count preservation.

## File layout

```text
.paracut/
  progress/
    <safe-batch-id>.json
    latest.json
```

Each file stores a persistence record:

```json
{
  "schema_version": "paracut.probe-progress-persistence.v0",
  "batch_id": "progress_batch_id",
  "project_id": "project_id",
  "saved_at": "2026-06-19T20:00:05.000Z",
  "progress": {
    "schema_version": "paracut.probe-progress.v0",
    "batch_id": "progress_batch_id",
    "project_id": "project_id",
    "events": [],
    "counts": {}
  }
}
```

## Boundaries

v0.20 does not add:

- real FFprobe spawning,
- background probe workers,
- UI rendering,
- long-running live subscriptions,
- cancellation/retry persistence,
- database sync,
- cloud progress history.

It only saves and reloads local progress batch JSON.

## Why this matters

Probe progress is now part of the local-first spine. A future UI can open a project and show the last known probe progress state without rerunning probes or guessing what happened.

This keeps the ParaCut pattern intact:

1. plan before action,
2. run through bounded adapters,
3. emit receipts and progress,
4. persist local state in readable files.
