# ParaCut Interop Room v0.1

ParaCut Interop Room is a minimal live browser surface around the existing Creative Interop v2 contracts.

It is not a pretend full video editor.

Its job is to make the already-tested ParaCut lineage and RenderPlan path directly exercisable by humans and agents.

## Same-origin inputs

The room reads:

```text
parallax-creative-bridge-v2
parallax-creative-evidence-v2
```

from same-origin browser storage.

The first contains the native Creative Bridge v2 package.

The second contains Auralith observation evidence hashes only.

## Live API

The room installs:

```js
window.ParaCut
```

with:

```js
ParaCut.bridge.receive()
ParaCut.bridge.import()

ParaCut.project.current()

ParaCut.timeline.create({ durationSeconds })
ParaCut.timeline.current()

ParaCut.render.plan({ outputUri })
ParaCut.render.current()

ParaCut.bridge.waveforge.transfer({ planRevision })

ParaCut.receipts.latest()
ParaCut.state()
```

## Verification

`bridge.receive()` independently verifies:

- Creative Bridge v2 route;
- base image bytes against `baseContentHash`;
- protected overlay bytes against each overlay hash;
- protected role/preserve requirements;
- canonical semantic manifest against `contentHash`;
- optional Auralith evidence record against the same creative manifest.

The room does not trust browser storage merely because it is same-origin.

## Native ParaCut state

`bridge.import()` creates separate reference-only assets for:

```text
gradeable base
protected overlay 1
protected overlay 2
...
```

The semantic split is not flattened.

## Timeline

The acceptance timeline is deterministic and bounded.

By default:

```text
12 seconds
one track per imported asset
base on video-base
protected overlays on overlay tracks
```

This is sufficient for Acceptance 003 lineage testing without pretending the Interop Room is the full future ParaCut editor.

## RenderPlan

`render.plan()` creates a native RenderPlan-shaped object and SHA-256.

It explicitly warns:

> Interop Room creates a deterministic RenderPlan only. It does not render media.

## WaveForge handoff

`bridge.waveforge.transfer()` writes:

```text
localStorage['parallax-paracut-waveforge-v2']
```

using:

```text
schema: parallax.bridge.v2
interopProfile: parallax.creative-interop.v2
source: ParaCut
target: WaveForgeStudio
```

with:

- RenderPlan SHA-256;
- positive `planRevision`;
- creative lineage;
- Auralith capture/receipt evidence when present;
- ParaCut asset hashes;
- explicit false authority flags.

## Receipts

The room emits:

```text
paracut.interop-room.receipt.v1
```

for:

- creative import;
- timeline creation;
- RenderPlan creation;
- WaveForge transfer.

These are observation/provenance receipts only.

## Native site tools

When WebMCP is available, the room registers:

```text
paracut_get_interop_state
paracut_receive_creative_bridge
paracut_import_creative_bridge
paracut_create_acceptance_timeline
paracut_plan_render
paracut_transfer_waveforge
```

The same `window.ParaCut` runtime backs the human buttons and native agent tools.

## Authority

The room has no media-rendering, publishing, or network authority.

It plans and hands off references.

```text
CAPABILITY != AUTHORITY
RenderPlan != rendered media
receipt != approval
```
