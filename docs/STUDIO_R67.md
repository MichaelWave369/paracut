# ParaCut Studio R6.7 — First Real Keyframes

R6.7 adds validated two-point, **linear Start → End keyframes** to selected clip properties: V2 **opacity** and media clip **audio volume**. The new controls appear inside the R6.6 Effects Controls Inspector and use existing Undo/Redo and ledger receipts.

## Use the controls

Select a **V2** overlay to expose **Opacity Keyframes**. Enter Start and End percentages, then click **Apply keyframes**. The overlay's effective transparency changes linearly across its full trimmed duration. You can still use the ordinary **Opacity (%)** control and V2 visual fade IN/OUT: the keyframe values act as a multiplier, so these existing effects remain authoritative.

Select any V1/V2/A1/A2 clip to expose **Volume Keyframes** in the Audio section. Enter Start and End percentages, then click **Apply keyframes**. The clip's effective gain changes linearly during playback; the original clip volume, audio fades, mixer lane gains/mutes/solos and source-audio mute remain active.

- A keyframe **Start** of 0% and **End** of 100% fades a property from zero to its existing base level.
- Start 100%, End 0% fades from its existing level to zero.
- Start 100%, End 100% preserves the existing base value without changing the timeline.
- **Clear animation** deletes only the selected property's keyframe envelope; it doesn't reset the existing base opacity or volume.
- Each Apply or Clear uses one existing `change(...)` command and creates one `clip.keyframes.updated` ledger receipt with clip ID, property and endpoint values. The entire transaction is Undo/Redo-safe.

## Model and time

Optional clip properties:
- `opacity_keyframes: { start: 0..1, end: 0..1 }` only on V2.
- `volume_keyframes: { start: 0..1, end: 0..1 }` on V1, V2, A1 or A2.

The endpoint times are normalized to **0% and 100% of the clip's timeline duration**, not hard-coded source seconds. If you trim a clip, the two points remain its new beginning and end. Linear interpolation clamps to the interval, never extrapolating outside the clip.

The same bounded interpolation function is shared by the Program Monitor and browser recording. Animated audio gain goes through the existing live preview and Web Audio export gain controls.

## Local MP4 rendering

The opt-in local FFmpeg renderer emits bounded, whitelist-generated expressions for animated clip audio gain (FFmpeg `volume`, evaluated per audio frame). For V2 visual keyframes it uses a `geq` alpha expression on the source-local clip frames before timestamp repositioning and overlay composition. Existing V2 alpha, video fades and paired transitions remain in the graph.

No arbitrary user FFmpeg expressions or shell scripts are accepted; all values must be finite and between 0 and 1. The existing default render graph remains unchanged for clips without keyframes.

**Performance:** `geq` performs per-pixel work. Animated opacity on large/full-screen V2 clips may be significantly slower with the local FFmpeg exporter than fixed opacity, especially on a CPU. Most effects processing remains on CPU regardless of any future GPU encoder selection.

**Fidelity:** The browser and FFmpeg calculations share normalized intent, but exact pixel matching isn't guaranteed. Browser audio gain updates have scheduling granularity; FFmpeg's audio filter evaluates per audio frame. This is not a calibrated, sample-accurate audio automation engine.

## Scope

R6.7 is a deliberate first implementation, not Premiere's arbitrary multi-point keyframe lanes. There are exactly **two endpoint values per property**, with linear interpolation; no bezier curves, draggable timeline diamonds, keyframe path editing, color keyframes, position animation, clip-attached multi-point automation, or full motion graph editor yet.

Source media remains local; saved drafts stay `paracut.studio.draft.v3`, older drafts default to no keyframes, and export output only changes on clips where keyframe animation is explicitly applied.

## Test plan

```sh
pnpm typecheck
pnpm smoke:studio
```

`scripts/studio-r67-smoke.mjs` covers bounded keyframe validation, interpolation at start/midpoint/end, preservation of old clip behavior, receipts, Undo/Redo, imported-draft safety and browser/local FFmpeg integration. We also verified standalone `geq` and `volume` FFmpeg expressions with synthetic test inputs, but full real-media export still needs manual testing.

**Manual acceptance:** Add a full-screen V2 overlay above a V1 clip and animate opacity Start 0%, End 100%. Seek through the timeline to confirm the V2 fade; render a browser movie and local MP4, watching for a continuous fade and listening for unaffected audio. Add A1 music, set volume Start 100%, End 0%, test audition, export and Undo/Redo. Confirm Clearing keyframes restores base opacity/volume without removing existing clip fade settings.
