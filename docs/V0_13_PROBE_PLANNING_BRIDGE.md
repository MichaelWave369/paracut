# ParaCut v0.13 — Probe Planning Bridge

## Purpose

v0.13 connects the v0.9 media import lane, v0.10 probe contract, v0.11 probe cache, and v0.12 source fingerprint adapter into a single planning bridge.

The core question is:

> For each imported media asset, what should ParaCut do before probing?

The answer is now explicit and testable.

## Plan Item Statuses

Each media asset becomes one of four statuses:

| Status | Meaning |
| --- | --- |
| `cache-hit` | The source fingerprint matches a saved probe result in `.paracut/probes/`. |
| `needs-probe` | The source exists and was fingerprinted, but no matching probe cache record exists. |
| `missing-source` | The source should be local, but the resolved file is missing. |
| `unsupported-source` | The source is remote, data URI, unknown scheme, or otherwise not local-stat fingerprintable in v0.13. |

## What Landed

- `packages/probe-planning-core`
- `planProbeForAsset()`
- `planMediaProbesForProject()`
- `summarizeProbePlanItems()`
- `recordProbePlanOnProject()`
- `scripts/probe-planning-smoke-test.ts`
- Root `smoke:probe-planning` command

## Receipt Boundary

The planner can record a `media.probe.plan.created` receipt. This logs the plan counts and per-asset decisions without applying probe metadata or running FFprobe.

That keeps the sequence clean:

```txt
import media
  -> fingerprint sources
  -> check probe cache
  -> create probe plan
  -> record probe plan receipt
  -> later: execute probe only for needs-probe items
```

## Explicit Non-Goals

v0.13 does **not**:

- run FFmpeg or FFprobe
- read media duration directly
- create thumbnails
- create waveforms
- create proxies
- copy large media files
- apply cached probe metadata automatically
- mutate project media assets from the plan

Those stay behind later adapters.

## Acceptance

v0.13 is accepted when:

- a cached local file becomes `cache-hit`
- an uncached local file becomes `needs-probe`
- a missing local file becomes `missing-source`
- a remote file becomes `unsupported-source`
- the plan summary counts all four lanes correctly
- recording the plan appends one project receipt
