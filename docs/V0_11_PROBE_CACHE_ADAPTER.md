# v0.11 Probe Cache Adapter

## Purpose

v0.11 adds a local probe-cache adapter so ParaCut can save and reload media probe results without needing to re-probe unchanged media every run.

This keeps the probe layer local-first and receipt-friendly while we prepare for a future FFprobe adapter.

## What landed

- New `@paracut/probe-cache-core` package.
- Deterministic probe cache keys based on:
  - `asset_id`
  - `source_uri`
  - optional source fingerprint such as file size and modified time
- Probe cache folder layout:

```txt
.paracut/
  probes/
    <cache-key>.json
```

- Probe cache record schema:
  - schema version
  - cache key
  - asset ID
  - source URI
  - optional source fingerprint
  - cached timestamp
  - full `MediaProbeResult`
- Save/load helpers for probe cache records.
- Lookup helper that returns `undefined` on cache miss.
- Runtime validation that cached asset/source values match the embedded probe result.
- Smoke test proving write/read/parse/cache-miss behavior.

## Boundary

v0.11 does **not** run FFmpeg or FFprobe.

It does **not** inspect files directly.

It does **not** decide whether a file changed by itself. A caller supplies an optional fingerprint, and that fingerprint becomes part of the cache key.

It does **not** mutate the project by itself. The existing media probe project bridge still handles applying probe results and recording probe receipts.

## Why this matters

Once a real probe adapter exists, ParaCut can use this cache before doing expensive media inspection:

1. Create or receive source fingerprint.
2. Look for cached probe result.
3. Use cached metadata when available.
4. Run FFprobe only on cache miss.
5. Save the new result to `.paracut/probes/`.
6. Apply the probe result to the project with receipt tracking.

That keeps the future editor faster, more transparent, and easier to audit.
