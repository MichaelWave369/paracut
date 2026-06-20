# ParaCut v0.15 — Probe Executor Interface

**Stage:** v0.15 scaffold  
**Status:** Interface contract only  
**Boundary:** Does not spawn FFprobe yet

## Purpose

v0.15 defines the boundary between ParaCut's media probe system and a future FFprobe execution adapter.

The goal is to make real media probing auditable before any external process is launched by ParaCut.

## What v0.15 Adds

- `packages/probe-executor-core`
- Probe execution request schema
- Canonical FFprobe args helper
- Executable path and timeout contract
- Stdout/stderr/exit-code result schema
- FFprobe JSON parser
- Execution-to-`MediaProbeResult` conversion
- Executor receipt lifecycle
- `smoke:probe-executor`

## Execution Flow

```txt
MediaAsset
  -> createProbeExecutionRequest()
  -> external runner later executes request
  -> createProbeExecutionResult()
  -> probeExecutionToMediaProbeResult()
  -> createProbeExecutionReceipt()
```

In v0.15, the external runner is not implemented. The smoke test supplies deterministic stdout/stderr/exit-code payloads instead.

## Receipt Types

v0.15 introduces executor-level receipts:

- `media.probe.executor.completed`
- `media.probe.executor.failed`
- `media.probe.executor.timed_out`
- `media.probe.executor.skipped`

These are separate from normal probe metadata receipts such as `media.probe.completed`.

That separation matters because a process can finish while the probe still fails, for example when FFprobe exits non-zero or emits invalid JSON.

## What the Receipt Captures

Executor receipts include:

- request ID
- asset ID
- source URI
- executable path
- FFprobe args
- timeout
- execution status
- exit code
- stdout byte count
- stderr byte count
- duration
- error message
- probe ID
- probe status
- warning count
- error count

## Explicit Non-Goals

v0.15 does **not**:

- spawn FFprobe
- discover an FFprobe executable
- read real media bytes
- enforce sandbox/resource limits
- feed `needs-probe` plan items into the executor automatically
- apply probe metadata to project assets automatically
- generate thumbnails, waveforms, or proxies

## Why This Layer Exists

ParaCut should not jump directly from planning to process execution.

The safe order is:

```txt
import reference
  -> fingerprint source
  -> check probe cache
  -> plan probe work
  -> apply cached probes
  -> build executor request
  -> execute later under policy
  -> parse output
  -> record receipts
```

v0.15 locks down the executor request/result/receipt contract before introducing actual FFprobe process execution.
