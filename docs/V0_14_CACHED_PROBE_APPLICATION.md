# v0.14 — Cached Probe Application Bridge

## Goal

v0.14 connects probe planning to media metadata enrichment without running a real probe executor.

The bridge consumes a `ProbePlan`, applies only valid `cache-hit` items, and leaves every other lane untouched:

```text
cache-hit          -> apply cached probe metadata
needs-probe        -> skip and wait for real probe executor
missing-source     -> skip and preserve existing project state
unsupported-source -> skip and preserve existing project state
```

## What landed

- New package: `packages/cached-probe-application-core`.
- New application schema: `paracut.cached-probe-application.v0`.
- `applyCachedProbePlanToProject()` consumes a probe plan and project.
- Valid cached probes are applied through the existing media probe bridge.
- Each applied cached probe still writes a normal `media.probe.completed` receipt.
- The application pass writes a summary receipt:

```text
media.probe.cache.application.created
```

## Safety gates

A cached probe is skipped unless all of these are true:

1. The plan item status is `cache-hit`.
2. The item includes `cached_probe`.
3. `cached_probe.asset_id` matches the plan item asset.
4. `cached_probe.project_id`, when present, matches the active project.
5. The cached probe status is `probed`.
6. The cached probe includes metadata.

This prevents stale or mismatched cached metadata from silently mutating project media.

## Receipt behavior

A successful cached application can add two kinds of receipts:

1. One `media.probe.completed` receipt per applied cached probe.
2. One `media.probe.cache.application.created` summary receipt for the whole pass.

Skipped items are included in the summary receipt with their reason.

## What v0.14 does not do

v0.14 does not:

- run FFprobe;
- read or decode media files;
- create thumbnails;
- create waveforms;
- create proxies;
- apply `needs-probe` items;
- repair missing sources;
- apply metadata from unsupported remote/data sources.

Those remain later adapters.

## Why this matters

ParaCut can now use cached metadata safely and audibly:

```text
import media -> fingerprint source -> plan probes -> cache-hit -> apply cached probe -> receipts
```

That is the first complete metadata reuse loop in the project spine.
