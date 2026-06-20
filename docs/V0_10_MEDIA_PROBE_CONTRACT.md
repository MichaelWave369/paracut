# ParaCut v0.10 — Media Probe Contract

## Purpose

v0.10 gives ParaCut a typed media probe contract before any real probing engine is wired in.

The goal is to make future FFprobe/native probe output safe, auditable, and project-aware.

## What v0.10 Adds

- `packages/media-probe-core`
- `MediaProbeResult`
- Container/video/audio/stream metadata contracts
- Probe status states: `probed`, `failed`, `skipped`
- Warning and error capture
- Project bridge for applying successful probe metadata to media assets
- Probe receipts for completed, failed, and skipped probes
- `scripts/media-probe-smoke-test.ts`

## Probe Metadata

A probe result can carry:

- container format name
- duration seconds
- file size bytes
- bitrate
- video codec
- width / height
- fps
- audio codec
- sample rate
- channel count
- stream list
- warnings
- errors

## Receipt Boundary

A successful probe writes:

```txt
media.probe.completed
```

A failed probe writes:

```txt
media.probe.failed
```

A skipped probe writes:

```txt
media.probe.skipped
```

The receipt payload records the probe ID, asset ID, source URI, probe source, status, duration, stream count, warning count, and error count.

## Important Boundary

v0.10 does **not** run FFmpeg or FFprobe.

It does **not** read real media files.

It does **not** generate thumbnails, waveforms, or proxies.

It only defines and tests the contract that a future probe adapter will satisfy.

## Why This Matters

The timeline should not rely on guessed durations forever.

Media import can safely create references first. A probe step can later enrich those references with duration, dimensions, codecs, and stream metadata. That keeps ParaCut's import flow fast while preserving a clean path toward real preview, timeline validation, proxy generation, and render planning.
