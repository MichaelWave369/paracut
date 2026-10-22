# ParaCut Studio R6.9 — Multi-Point Linear Keyframes

R6.9 extends R6.7 and R6.8's visual clip automation to **2–8 points per property**: V2 opacity and any clip's volume. Curves use straight-line interpolation between points, preserving the existing base opacity, audio volume, mixer, fades, receipts and all other effects.

## Create and edit keyframes

Select a video/audio clip in **Selection (V)** and enable **◆ Keyframe lanes** on the timeline.

- V2 shows **Opacity** and **Volume**. V1, A1 and A2 show **Volume** only.
- Double-click empty graph space to add a point at that location, including its vertical value.
- Or position the **Program playhead** over a selected clip and press **+ Point at Playhead** in the desired lane. New points inherit the current interpolated value, so inserting a point alone does not abruptly change the curve.
- Drag an interior diamond **left/right** to change its clip-relative time and **up/down** to change its 0–100% value. Start and End remain anchored at their clip boundaries.
- With a diamond focused, use **Up/Down** to change value by 5%, or Shift+Up/Down for 10%. For interior points, Left/Right changes its time by 1% of the clip (Shift by 10%). For fixed endpoints, Left/Right continues to adjust value like R6.8. Home / End set value to 0% / 100%.
- **Delete / Backspace** while an interior diamond is focused removes that specific point. The event stays inside the keyframe editor, so it does not delete the underlying clip.
- Point spacing is at least 1% of the clip's normalized duration, and every curve has 2–8 points, including the Start and End anchors. Points must be sorted and values must be finite between 0 and 1. Untrusted or malformed arrays are rejected.

Every successful insertion, edit or deletion is one validated `clip.keyframe.points.updated` transaction with **one ledger receipt** and standard Undo/Redo. Pointer movement previews the line and does **not** update the project; release commits. Canceled gestures restore the last saved curve.

## Inspector compatibility

The original R6.7 Start/End number inputs remain valid. If you press **Apply keyframes** there, ParaCut intentionally *replaces the multi-point curve* with the chosen two-point linear ramp. **Clear animation** removes the selected property's automation entirely. Both create ordinary receipts; the Inspector displays the current curve's actual endpoint values.

The optional saved clip fields are:

```json
{
  "opacity_keyframe_points": [
    {"at":0,"value":0},
    {"at":0.3,"value":1},
    {"at":0.7,"value":0.4},
    {"at":1,"value":1}
  ],
  "volume_keyframe_points": [
    {"at":0,"value":1},
    {"at":0.5,"value":0.35},
    {"at":1,"value":0.8}
  ]
}
```

The `at` coordinate is 0–1 relative to the *trimmed clip's current duration*. The existing `paracut.studio.draft.v3` remains compatible; older projects with only `{start,end}` animation continue working. When point arrays are present, they take precedence. Start/End Apply clears that property's point array to avoid ambiguous precedence.

## Preview and exports

- Program Monitor and browser recording evaluate the same piecewise-linear values using the current clip-relative timeline progress.
- Local FFmpeg MP4 uses strictly generated, bounded nested linear expressions in the existing audio `volume` and V2 alpha `geq` filters. Each expression is derived from validated numeric points; no user-provided filter text or arbitrary code can enter the graph.
- Unanimated clips and R6.7 two-point-only clips retain their original render path and equations.
- The existing browser-versus-FFmpeg color/audio timing differences still apply. The FFmpeg `geq` alpha filter can be expensive on full-resolution V2 video. This is linear automation, not bezier easing or a sample-accurate DAW.

No arbitrary multi-track motion curves, source-frame-anchored keyframes, effect stacks, network processing or changes to original media are introduced.

## Acceptance

Run `pnpm typecheck && pnpm smoke:studio`. The new R6.9 smoke validates numeric safety, duplicate/too-close/unsorted points, editor pointer and keyboard events, receipt atomicity, Undo/Redo, draft compatibility, and the local FFmpeg graph.

For visual acceptance, add a V2 clip, create two interior opacity points, move one toward the center and another toward the end, then scrub the Program Monitor. Add two A1 music gain points, export a browser recording and local MP4, and verify the intended volume/opacity changes. Use the original Inspector Start/End Apply and check that the curve resets to two points. Test keyboard Delete on a focused interior keyframe and confirm the media clip remains.
