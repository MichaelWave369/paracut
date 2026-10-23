# ParaCut Studio R7.3 — Precision Controls and Adaptive Bézier MP4 Export

R7.3 extends R7.2's two-dimensional cubic Bézier editor with **exact numeric X/Y editing** and a substantially smaller, adaptive FFmpeg approximation for many ordinary custom-X curves. R7.1 fixed-X Bézier curves retain their original, exact polynomial export path, and all R7.0 easing presets / R6.9 linear drafts retain their previous semantics.

## Precision authoring

1. Select a V2 Opacity or any media clip Volume lane, then select a **Custom Bézier** segment in the timeline.
2. Beneath the curve, choose **Handle 1** or **Handle 2**. The **X %** and **Y %** fields display its current control coordinates to one decimal place.
3. Enter numeric X and Y percentages between 0 and 100. Choose **Apply XY** to commit both coordinates as **one** validated `clip.keyframe.points.updated` receipt. Typing does not mutate project state.
4. Horizontal handles must stay ordered (X1 ≤ X2). The core rejects crossed handles, nonsensical values, and out-of-range entries without altering the project.
5. Save / reopen projects normally. Undo/Redo, existing 2D drag, keyboard controls and Inspector linear-reset remain unchanged.

The editor now samples 2D Bézier curves at 64 plot positions per interval, rather than the prior 20, to better show tight bends. These display samples never become persisted clip data.

## Faster local MP4 rendering

R7.2's generated FFmpeg expression always used **64 piecewise-linear intervals** for a Custom Bézier segment that had explicit `handles_x`. R7.3 computes an adaptive parameter-time approximation at export planning time:

- Starts with just the two endpoint samples.
- Measures a segment's difference from its chord at seven interior parameter-time probes.
- Bisects the segment with the greatest measured error until it meets a **0.0015 normalized easing difference target** at those probes or reaches a hard **64-interval** budget.
- Refuses further bisection when it would create tiny X denominators; builds numeric-only FFmpeg expressions with bounded, increasing X sample positions and no arbitrary user-provided expression strings.
- Returns a plan showing its number of segments and **observed probe error**, useful for testing. This error is **not an analytic worst-case guarantee** between probes, and numeric FFmpeg output remains an approximation of the browser's inverse solver.

For ordinary handle curves the generated graph is often much smaller, potentially reducing FFmpeg expression parsing/evaluation overhead. **No runtime-speed claim is made without measuring local FFmpeg on actual footage.** Pathological curves may still require most of the 64 allowed intervals, and full-resolution V2 alpha `geq` may remain very slow. Dense preview sampling also adds some UI computation during drags.

The planner retains R7.1's exact fixed-X polynomial when `handles_x` is absent, and all saved `draft.v3` projects remain backward compatible. Every numeric literal in the new expression is emitted as a plain decimal; no arbitrary FFmpeg filter snippets are accepted.

## Automated and manual acceptance

Run `pnpm typecheck && pnpm smoke:studio` (focused: `node scripts/studio-r73-smoke.mjs`).

The automated suite probes typical and extreme curves against the numerical inverse, verifies sample limits, invalid controls, shorter typical expressions, saved drafts, Undo/Redo, and precision editor ledger behavior.

For browser acceptance: select a custom Bézier interval, enter precise X/Y values and Apply; verify one receipt and that Undo/Redo restores both coordinates. Enter X1 greater than X2 and confirm a safe rejection. Save/reopen, play a preview and export a short MP4 to compare effects. Compare export time on the **same local footage, resolution, settings and hardware** against R7.2 before claiming a speedup.

No schema migration, expanded track count, unsupported cloud rendering or custom arbitrary scripts are introduced.
