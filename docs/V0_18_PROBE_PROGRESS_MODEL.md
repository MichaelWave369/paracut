# v0.18 Probe Progress Model

ParaCut v0.18 adds a typed progress model for media probe batches.

The goal is to give the future desktop UI a stable progress language before real FFprobe child-process execution is enabled.

## What this adds

- `packages/probe-progress-core`
- `ProbeProgressEvent`
- `ProbeProgressBatch`
- `ProbeProgressCounts`
- Progress event types:
  - `queued`
  - `running`
  - `applied`
  - `cached`
  - `failed`
  - `skipped`
- A converter from probe-plan runner results into progress events.
- A batch summary helper that counts events by type.
- A smoke test that proves all progress lanes.

## Why this matters

The probe pipeline now has several stages:

1. Import media references.
2. Fingerprint local sources.
3. Plan probe work.
4. Apply cached probe metadata.
5. Run `needs-probe` items through an injected runner.
6. Apply successful probe results.
7. Cache successful probe results.
8. Report progress for UI and future orchestration.

v0.18 gives step 8 a typed contract.

## Event semantics

| Event | Meaning |
| --- | --- |
| `queued` | An asset entered the batch progress stream. |
| `running` | A runner request was created and execution began through the injected runner path. |
| `applied` | Successful probe metadata was applied to a project media asset. |
| `cached` | Probe metadata was already available from cache, or a successful runner result was written to cache. |
| `failed` | A runner attempt or probe conversion failed. |
| `skipped` | The asset was not runnable or was intentionally ignored by the runner bridge. |

## Batch counts

`ProbeProgressCounts` includes:

- `event_count`
- `asset_count`
- `queued_count`
- `running_count`
- `applied_count`
- `cached_count`
- `failed_count`
- `skipped_count`
- `terminal_count`

These counts are intentionally event-based rather than asset-state-only. A successful newly probed asset can emit both `applied` and `cached`, because both things happened.

## Boundaries

v0.18 does **not** add:

- real child-process FFprobe execution
- live event streaming
- UI rendering
- retry/backoff policy
- cancellation
- progress persistence to project files
- worker threads or job queues

This is the progress model only. Live orchestration comes later.

## Smoke test

`pnpm smoke:probe-progress` proves:

- a cache-hit asset emits `queued` and `cached`
- a successful needs-probe asset emits `queued`, `running`, `applied`, and `cached`
- a failed needs-probe asset emits `queued`, `running`, and `failed`
- an unsupported remote asset emits `queued` and `skipped`
- batch counts match the generated event stream

## Next likely step

v0.19 should connect this model back into the probe-plan runner bridge as an optional progress output, so callers can receive result data and UI progress data from one execution path.
