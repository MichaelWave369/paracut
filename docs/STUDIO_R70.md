# ParaCut Studio R7.0 — Per-Segment Easing Curves

R7.0 builds directly on R6.9's clip-relative 2–8-point animation. A keyframe may now optionally specify one of four easing modes for the **outgoing interval** to its next keyframe. The existing two-point and multi-point linear drafts remain valid and visually unchanged.

## Editor workflow

1. Choose a V2 clip for **Opacity** or any media clip for **Volume**. Enable **◆ Keyframe lanes**.
2. Add/move keyframe diamonds as before. Under each visible graph, choose an interval in **Segment** (for example **1→2**) and select **Linear**, **Ease In**, **Ease Out**, or **Ease In/Out**.
3. Scrub the Program Monitor to inspect the curve. The graph is a sampled representation of the same interpolation function used by the preview and browser recording.
4. Changing the easing select commits **one** validated `clip.keyframe.points.updated` action and ledger receipt, with Undo/Redo. Selecting the current mode is a no-op without a new receipt.
5. Use the original Inspector Start/End Apply action to intentionally return that property to the old two-point linear curve. Clear removes automation.

**Interpolation definitions** for normalized local interval time `u ∈ [0,1]`:
- Linear: `u`
- Ease In: `u²`
- Ease Out: `1 − (1 − u)²`
- Ease In/Out: `u²(3 − 2u)` (smoothstep)

These modes are monotonic and bounded: they do not overshoot a clip's saved 0–100% keyframe values. For a 0→100% interval at 25% of its duration, Ease In/Out produces 15.625%.

## Saved representation and compatibility

The optional `ease` field lives on a point and applies from that point to the next; the final point has no outgoing interval and cannot carry `ease`.

```json
{
  "opacity_keyframe_points": [
    {"at": 0, "value": 0, "ease": "ease-in"},
    {"at": 0.4, "value": 1, "ease": "ease-out"},
    {"at": 1, "value": 0.4}
  ]
}
```

Valid easing names are `linear`, `ease-in`, `ease-out`, and `ease-in-out`. The linear mode is stored by *omitting* `ease`, so old drafts do not grow new fields until the editor actually saves non-linear easing. Existing saved `paracut.studio.draft.v3` files remain on the same schema: two-field points and R6.7 Start/End pairs still interpolate linearly; points continue to override a legacy pair where present. Values, point counts, order, minimum spacing, and easing allowlist remain validated on edits and imports. Unsupported properties or expression strings are rejected.

R6.9's **+ Point at Playhead** preserves the value at the insertion moment. Splitting an eased section into two segments can change the shape between its points because the new segment defaults to linear; inspect the result before exporting. Moving a point preserves that point's outgoing easing; removing a point deletes that outgoing easing.

## Preview and local render

Browser Program Monitor, browser recording, and local FFmpeg MP4 share the same interpolation definitions. The local renderer produces only bounded, generated numeric FFmpeg expressions; a project cannot inject arbitrary filter commands or scripting through `ease`. The local MP4 alpha path still uses `geq`, which may be slow for large overlays. Actual browser-vs-FFmpeg frame timing and pixel/sample math are not guaranteed bit-identical.

## Automated and browser acceptance

Run `pnpm typecheck && pnpm smoke:studio`, or run just `node scripts/studio-r70-smoke.mjs`.

Manual acceptance:
1. Open an older R6.9 project with 2–8 linear points. Confirm its appearance and exported behavior are unchanged.
2. On V2 opacity, assign different easing to intervals **1→2** and **2→3**; verify visible bend and smoothly changing Program preview.
3. Repeat with A1 volume, checking the browser recording and local Windows MP4 render for ramps without sharp jumps.
4. Change the easing dropdown, Undo, Redo, save and reopen. Verify exactly one receipt per committed change, the expected mode, and no duplicate receipts on no-op selections.
5. Drag eased points, insert a point, remove a middle point, and apply Inspector Start/End to return to a linear two-point curve.
6. Import a tampered draft with an unknown easing mode or easing on the final point. Confirm validation rejects it.

R7.0 adds **named, per-segment easing presets**, not freeform Bézier handles, parameter curves for arbitrary effects, arbitrary FFmpeg commands, or a new network service. Advanced tangents and true Bézier editing are intentionally deferred to a later milestone.
