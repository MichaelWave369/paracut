# v0.19 — Probe Runner Progress Bridge

## Purpose

v0.19 wires the v0.18 probe progress model directly into the probe plan runner bridge.

The goal is to let future UI/orchestration observe probe work as it happens without changing the safety boundary:

- the bridge still runs only `needs-probe` items through an injected runner;
- `cache-hit`, `missing-source`, and `unsupported-source` items are still not executed;
- real FFprobe process spawning is still not enabled;
- progress is a typed event stream, not a worker queue.

## What changed

`runProbePlanWithRunner()` now accepts optional progress options:

- `include_progress_batch`
- `progress_batch_id`
- `progress_created_at`
- `include_queued_progress_events`
- `include_running_progress_events`
- `include_cached_progress_events`
- `on_progress_event`

When `include_progress_batch` is true, the returned runner result includes a `progress_batch`.

When `on_progress_event` is provided, each progress event is emitted as the runner bridge advances through the plan.

## Event flow

The bridge can emit:

1. `queued` — before each plan item is handled.
2. `running` — before a `needs-probe` item is sent to the injected runner.
3. `applied` — after successful runner metadata is applied to project media.
4. `cached` — when an existing cache hit is observed or a new successful probe result is written to cache.
5. `failed` — when a runner result fails to produce successful metadata or cache write-back fails.
6. `skipped` — when an item is skipped and is not represented as a cache hit.

## Receipts

v0.19 does not add a new receipt type.

It keeps existing receipt behavior:

- executor receipts for attempted runner calls;
- media-probe receipts for successful metadata application;
- probe-plan runner summary receipt for the whole pass.

Progress events are currently returned/callback-emitted only. A persistence adapter is intentionally deferred.

## Smoke coverage

The v0.19 smoke test proves:

- optional `progress_batch` output is returned;
- optional `on_progress_event` receives every event;
- callback event order matches collected batch event order;
- cache-hit items surface as cached progress, not runner calls;
- needs-probe items emit running, applied, and cached events;
- normal metadata application still occurs.

## Boundary

v0.19 does not include:

- real FFprobe spawning;
- progress persistence;
- UI rendering;
- cancellation events;
- retry/backoff events;
- worker queues;
- background execution.

This is the progress bridge contract only.
