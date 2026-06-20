# ParaCut v0.9 — Media Import Adapter

## Status

v0.9 adds a safe media import adapter layer. It does not copy, probe, transcode, proxy, thumbnail, or render media files yet.

The adapter creates explicit media references that can be applied to a project and logged through the existing project ledger.

## Why this layer exists

Media import is not just `add a file path`.

ParaCut needs to know:

- what the source URI was,
- whether it is local, relative, remote, data, or unknown,
- what kind of asset it likely is,
- what rights note came with it,
- what future cache/proxy/thumbnail/waveform paths should be reserved,
- and which receipts prove the media entered the project.

## Current behavior

The v0.9 adapter can:

1. Normalize media source URIs.
2. Detect schemes: `file`, `relative`, `http`, `https`, `data`, or `unknown`.
3. Infer asset kind from URI extension or data URI MIME type.
4. Infer display name from the URI.
5. Infer stable asset IDs from the display name.
6. Preserve rights notes.
7. Add a default rights warning when no rights note is supplied.
8. Prepare future workspace targets:
   - `.paracut/proxies/<asset_id>.mp4`
   - `.paracut/thumbnails/<asset_id>.jpg`
   - `.paracut/waveforms/<asset_id>.json`
   - `.paracut/cache/<asset_id>`
9. Apply a media import batch to a project.
10. Record individual `media.imported` receipts and a final `media.import.batch.created` receipt.

## Boundary

v0.9 is reference-only.

It intentionally does not:

- verify file existence,
- copy source files into the project folder,
- generate proxies,
- generate thumbnails,
- generate waveforms,
- probe duration/codec/size,
- or validate copyright ownership.

Those are future adapters.

## Receipt rule

Every applied media batch should produce:

1. one `media.imported` receipt per asset, and
2. one `media.import.batch.created` receipt summarizing the batch.

That keeps individual assets traceable while also preserving the original import action as a batch-level event.

## Smoke coverage

`pnpm smoke:media-import` validates:

- kind inference,
- asset ID inference,
- rights note preservation,
- remote URL warnings,
- future proxy/thumbnail/waveform/cache target paths,
- duplicate inferred asset ID handling,
- project media count,
- and receipt count.
