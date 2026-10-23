# ParaCut Studio R7.2 — Two-Dimensional Cubic Bézier Handles

R7.2 extends R7.1's Custom Bézier mode from vertical-only handles into two-dimensional handle editing. **Each of the two control points can now move horizontally (normalized time) and vertically (normalized effect value).** Existing linear/easing modes, R7.1 custom Bézier with y-only handles, and all older projects keep their original semantics.

## Editing

1. Select a V2 overlay's **Opacity** lane, or any clip's **Volume** lane, and enable ◆ Keyframe lanes.
2. Choose the outgoing segment (for example 1→2) and select **Custom Bézier** under the graph.
3. Drag the numbered orange control points in **X and Y**. X changes the temporal curve; Y changes relative progress toward the next keyframe.
4. To use the keyboard, focus a control: **Left/Right** changes X ±2.5%, **Up/Down** changes Y ±5%; **Shift** increases both respective steps; **Home/End** sets Y to 0%/100%.
5. The horizontal positions are ordered: control 1 cannot pass control 2. Controls may touch. This keeps the cubic x(t) monotonically nondecreasing and allows safe inversion.
6. Pointer moves preview locally without changing draft/receipts. Releasing commits exactly one validated `clip.keyframe.points.updated` receipt with Undo/Redo. A canceled drag restores the committed curve.
7. Start/End Apply in the Inspector still resets the selected property to a linear two-point curve.

## Saved data

On an outgoing Bézier keyframe, optional `handles_x` stores two normalized time coordinates. Existing `handles` remains the two vertical coordinates. Values are finite numbers between 0 and 1, including endpoints; x1 must not exceed x2.

```json
{
  "opacity_keyframe_points": [
    {"at": 0, "value": 0, "ease": "bezier", "handles": [0.2, 0.85],
      "handles_x": [0.12, 0.76]},
    {"at": 1, "value": 1}
  ]
}
```

If `handles_x` is absent, its interpretation is **exactly the old R7.1 fixed x positions [1/3,2/3]**. Simply opening an older project does not change its stored keyframe objects. When moving an X handle, the edited segment gets an explicit `handles_x`. Replacing Bézier easing with a preset or Linear strips both handle fields. Keys are restricted to `at`, `value`, `ease`, `handles` and `handles_x`, subject to existing 2–8 point and spacing limits. Untrusted drafts with unsorted x handles, nonnumeric entries, orphan fields or text expressions are rejected.

## Mathematical behavior

The normalized cubic control polygon is **(0,0), (x1,y1), (x2,y2), (1,1)**. To evaluate easing at normalized segment time `u`, the Program/browser path solves `x(t) = u` by bounded bisection, then computes `y(t)`. This is a deterministic inversion of the monotone x component. The resulting easing output stays inside 0–1; an interval between descending keyframes stays within those endpoint values as well.

The legacy R7.1 path without an explicit `handles_x` still uses its exact polynomial `y(u)`, preserving old behavior and FFmpeg expressions.

## Export precision and performance

FFmpeg expression filters do not have a suitable safe, portable inverse-cubic primitive. For **new 2D curves**, the local renderer therefore generates a fixed 64-interval piecewise-linear approximation of the cubic sampled uniformly in Bézier parameter time, not evenly in X. This strategy improves fidelity around very steep beginnings and endings. The expression is generated only from validated numeric data; arbitrary filter or script text never enters the graph.

**Important:** FFmpeg's custom-X output is an approximation, not mathematically identical to Program/browser output. Very sharp or extreme handle settings can produce visible differences, especially near endpoints. Large filter expressions also add encoding cost, and 2D animated V2 alpha with `geq` may be *particularly* slow. Compare a short local MP4 with browser preview before relying on an effect-heavy full-length export. Both paths clamp values to [0,1], but browser-to-FFmpeg sample and frame timing are not bit-identical.

Browser recording uses the browser's numerical inverse path. No automatic cloud transfer or third-party render service is involved.

## Verification

Automated: `pnpm typecheck && pnpm smoke:studio` (focused: `node scripts/studio-r72-smoke.mjs`).

Manual acceptance:
1. Open saved R7.0/R7.1 drafts and verify their old appearance and curves are unchanged.
2. Set an outgoing segment on V2 Opacity to Custom Bézier; drag control 1 right/up and control 2 left/down, without crossing; verify the graph and Program Monitor.
3. Keyboard-edit X and Y, cancel a pointer drag, Undo/Redo and save/reopen. Confirm one receipt per successful edit, none for previews/cancellation or no-op edits.
4. Add A1 Volume 2D control points, record in browser, then export a short local MP4. Evaluate visible/audible timing, especially with extreme curves.
5. Import tampered `handles_x` arrays and confirm refusal without altering the project.
6. Revert a custom segment to Linear and confirm control handles/data are removed.

### Not included

No velocity editor, free overshoot, out-of-order X handles, unlimited points, effect-stack keyframing or guaranteed matching pixels between FFmpeg and the browser. Improving FFmpeg approximation and export performance is a separate planned task.
