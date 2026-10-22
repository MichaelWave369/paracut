# ParaCut Studio R7.1 — Bounded Custom Bézier Easing

R7.1 adds editable custom cubic Bézier easing to R7.0's per-segment keyframe curves. It deliberately uses **fixed horizontal handle positions** at one-third and two-thirds of each segment. Both controls move **vertically** from 0% to 100% of normalized easing progress, making the curve monotonic in time and bounded between adjacent saved keyframe values. This gives an exact, small FFmpeg expression and avoids numerical inversion, overshoot and arbitrary filter strings.

## Use the handles

1. Select a V2 overlay's **Opacity** or any clip's **Volume** lane and enable Keyframe lanes.
2. Choose a segment, such as **1→2**, below its graph. In the Ease dropdown, choose **Custom Bézier**.
3. Two orange numbered circles appear at fixed horizontal positions. **Drag them up/down** to adjust acceleration, or focus a circle and use arrows (5% each), Shift+arrows (10%), Home (0%), or End (100%).
4. Drag previews update the graph with no project mutation; releasing the pointer creates one `clip.keyframe.points.updated` receipt and standard Undo/Redo. Cancel restores the previous graph without saving.
5. Change modes to Linear, Ease In, Ease Out or Ease In/Out. The outgoing Bézier handle data is discarded by a successful mode switch.
6. The Inspector's original Start/End Apply still intentionally resets the whole property to two-point linear animation.

**Limitation:** horizontal tangent times cannot be dragged in R7.1. The handles are intentionally y-only. Fully free 2D cubic-bezier control handles need inversion of x(t) for rendering and are deferred. Both control heights are within [0, 1] relative to each interval's *starting and ending values*, not absolute volume or opacity. If both endpoints are equal, changing handle heights has no visible effect.

## Saved clip representation

Optional `ease: "bezier"` and required `handles: [y1, y2]` apply to the outgoing interval only:

```json
{
  "opacity_keyframe_points": [
    {"at": 0, "value": 0, "ease": "bezier", "handles": [0.15, 0.85]},
    {"at": 0.45, "value": 1, "ease": "ease-out"},
    {"at": 1, "value": 0.25}
  ]
}
```

The default custom Bézier handles are [0.25, 0.75]. The last point cannot have `ease` or `handles`. Every other point may carry handles only when `ease === "bezier"`. Each handle must be a finite number in [0, 1]. Existing R6.7 pairs, R6.9 multi-point arrays and R7.0 four named modes remain unchanged, still use the `paracut.studio.draft.v3` format and do not require migration.

For normalized time `u` inside one segment, let `v = 1-u`:

```text
bezier(u) = 3 v² u y1 + 3 v u² y2 + u³
value(t) = start + (end - start) * bezier(u)
```

Because the Bézier x controls are fixed at 1/3 and 2/3, **x(t) = t** exactly. The polynomial is evaluated identically for JS preview and generated FFmpeg audio/alpha expressions; browser rendering and FFmpeg still differ in timebase/pixel sampling, so output is not promised bit-identical.

## Technical restrictions

- 2–8 clip points, fixed start/end times, existing 1%-minimum point spacing.
- Preset easings are untouched. A Bézier point retains both handles if moved; newly inserted points default to linear until changed.
- The current insertion rule preserves the instantaneous value at the new keyframe but may change the shape of the affected existing segment.
- Generated FFmpeg expressions are composed strictly from allowlisted modes and validated numeric values. No arbitrary expression text is accepted.
- Browser recording and opt-in local FFmpeg MP4 both use the shared curve function. Full-resolution V2 `geq` remains potentially costly.
- No 2D tangent position, Bézier overshoot, freeform motion, extra tracks, new network service or new project format.

## Validation and browser acceptance

Run `pnpm typecheck && pnpm smoke:studio`; focused: `node scripts/studio-r71-smoke.mjs`.

Manual browser steps:
1. Open an older R7.0 project and confirm it still looks linear/preset-eased as before.
2. Select a V2 overlay, set an interval to Custom Bézier and drag each orange circle. Confirm a smooth curve and immediate Program scrub preview, with **one receipt per completed drag**.
3. Cancel a drag and verify the curve and receipts are unchanged. Change the control using keyboard arrows and confirm one receipt per step; Undo/Redo should restore it.
4. Set an A1 clip to Custom Bézier and verify opacity/audio ramp intent in browser playback, browser recording and local MP4.
5. Save/reopen the draft and verify the handle positions. Try a malformed imported `handles` array; the loader should reject it.
6. Change a Bézier interval back to a preset and use Inspector Start/End Apply; ensure no orphan control handles or stale Bézier metadata.
