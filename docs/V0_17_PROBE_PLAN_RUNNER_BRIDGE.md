# v0.17 Probe Plan Runner Bridge

## Purpose

v0.17 connects the probe planner to the safe injected runner harness.

The bridge takes a `ProbePlan`, executes only items marked `needs-probe`, applies successful probe metadata to project media assets, saves successful probe results back to `.paracut/probes/`, and records a summary receipt for the run.

This keeps ParaCut on the same policy line:

> Plan first. Run only what the plan permits. Apply only successful metadata. Cache with receipts.

## What v0.17 Adds

- `packages/probe-plan-runner-core`
- `PROBE_PLAN_RUNNER_SCHEMA_VERSION`
- `runProbePlanWithRunner()`
- `summarizeProbePlanRunnerItems()`
- `createProbePlanRunnerReceipt()`
- `media.probe.plan.runner.created` summary receipt
- `scripts/probe-plan-runner-smoke-test.ts`
- root `smoke:probe-plan-runner` script

## Execution Rule

The bridge only executes plan items with:

```txt
status = needs-probe
```

The bridge skips:

```txt
cache-hit
missing-source
unsupported-source
```

This means cached metadata is handled by the cached probe application bridge, while missing and unsupported sources remain non-mutating planning outcomes.

## Successful Runner Flow

For a `needs-probe` item:

1. Look up the project media asset.
2. Build a canonical probe execution request.
3. Execute the request through an injected runner.
4. Record the executor receipt when enabled.
5. Convert successful FFprobe-style output into a `MediaProbeResult`.
6. Apply successful metadata through the normal media probe bridge.
7. Save the successful probe result to `.paracut/probes/`.
8. Include the item in the final probe-plan runner summary receipt.

## Receipt Layers

A successful runner pass may produce three receipt layers:

1. `media.probe.executor.completed`
2. `media.probe.completed`
3. `media.probe.plan.runner.created`

Failed, skipped, or timed-out runner calls can still produce executor receipts, but they do not apply metadata to project media assets.

## Smoke Test

The v0.17 smoke test creates a temporary project with two local media references:

- one clip that already has a probe cache hit,
- one clip that needs probing.

The test proves:

- cache-hit items are skipped by the runner bridge,
- needs-probe items execute through the mock runner,
- successful metadata is applied to the project,
- successful probe results are cached,
- a second probe plan sees both local assets as cache hits,
- executor, media-probe, and summary receipts are recorded.

## Boundary

v0.17 still does **not** add:

- real child-process FFprobe execution,
- executable discovery,
- sandbox/resource-limit enforcement,
- UI progress reporting,
- probe retry/backoff policy,
- automatic background scanning.

Those remain later gates.
