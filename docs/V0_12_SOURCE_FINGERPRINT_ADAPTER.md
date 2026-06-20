# v0.12 Source Fingerprint Adapter

## Purpose

v0.12 adds a local filesystem fingerprint adapter so ParaCut can tell whether a referenced media source appears unchanged before attempting to reuse a cached probe result.

This is the missing bridge between:

```text
media reference -> source fingerprint -> probe cache key -> cached probe hit/miss
```

## What v0.12 adds

- `packages/source-fingerprint-core`
- `SOURCE_FINGERPRINT_SCHEMA_VERSION`
- `SOURCE_FINGERPRINT_ALGORITHM`
- Local file source resolution
- `file://` URI support
- Absolute path support
- Relative path support against a project root
- Missing-file status
- Unsupported remote/data/unknown scheme status
- Stat-based fingerprint helper using file size and modified time
- Probe-cache lookup input bridge
- `scripts/source-fingerprint-smoke-test.ts`

## Fingerprint algorithm

The current algorithm is intentionally cheap and local:

```text
stat-size-mtime-v0:size=<size_bytes>;mtimeMs=<mtime_ms>
```

This is not a cryptographic content hash. It is a practical cache invalidation signal for early probe reuse.

## Supported in v0.12

- Local `file://` sources
- Absolute local paths
- Relative local paths resolved against a project root
- File size capture
- Modified-time capture
- Cache hit when source fingerprint matches
- Cache miss when source fingerprint changes

## Explicit boundaries

v0.12 does **not**:

- read full media bytes
- hash full media files
- fingerprint remote HTTP/HTTPS media
- fingerprint data URIs
- execute FFprobe
- copy media into the project
- create proxies
- create thumbnails
- create waveforms

## Why this matters

Probe caching only works if ParaCut can tell whether the source still looks like the same source. v0.11 could save and load probe cache records, but the caller had to provide a fingerprint manually.

v0.12 creates the first automatic local fingerprint path.

## Current cache flow

```text
1. Import/reference local media
2. Fingerprint the local source from filesystem stats
3. Run or create probe result
4. Save probe result with source fingerprint
5. Fingerprint again later
6. Load cached probe only if source fingerprint matches
```

## Next likely step

v0.13 should bridge source fingerprints directly into media import / probe planning so imported local files can automatically check the probe cache before deciding whether a new probe is needed.
