# ParaCut v0.16 — Probe Executor Runner Stub

## Purpose

v0.16 adds the safe runner harness around the v0.15 probe executor boundary.

The executor interface already knows how to build FFprobe requests, normalize stdout/stderr/exit/timeout results, parse FFprobe JSON, and create executor receipts. v0.16 adds an injectable runner layer so ParaCut can execute that boundary later without coupling core logic directly to child-process spawning.

## What v0.16 Adds

- `packages/probe-runner-core`
- `ProbeRunner` interface with a `runner_id`
- `executeProbeWithRunner()` orchestration helper
- Exception normalization when a runner throws
- Request-id mismatch normalization when a runner returns the wrong result
- `createMockProbeRunner()` fixture harness for deterministic tests
- `smoke:probe-runner`

## Runner Flow

```txt
ProbeExecutionRequest
  -> injected ProbeRunner.execute(request)
  -> ProbeExecutionResult
  -> MediaProbeResult
  -> optional probe executor receipt
```

The runner layer does not interpret media itself. It delegates parsing and receipt typing back to `probe-executor-core`, so there is still one canonical FFprobe boundary.

## Mock Runner Modes

The mock runner can return fixtures for:

- completed success
- completed but non-zero FFprobe exit
- timed-out execution
- skipped execution when no fixture matches
- thrown runner exceptions normalized as failed executions

## Boundaries

v0.16 does **not**:

- spawn `ffprobe`
- read media bytes
- discover FFprobe on the host machine
- enforce OS-level sandboxing
- apply probe metadata to project media assets
- run the probe plan automatically

Those remain later gates.

## Why This Matters

This is the bridge between pure contracts and real execution. ParaCut can now test the exact orchestration behavior that a future real FFprobe runner must satisfy, without letting CI depend on host binaries, media files, process timing, or machine-specific codec behavior.
