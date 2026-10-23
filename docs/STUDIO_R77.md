# ParaCut Studio R7.7 — Balanced Bézier Export Expressions

R7.7 improves the **search step inside FFmpeg's adaptive custom-X 2D cubic Bézier expressions**. It is an internal performance-oriented change to the *local MP4 export graph*. Nothing about how the application saves keyframes, evaluates browser previews, records edits, or validates draft files changes.

## Why this optimization

The R7.3 adaptive custom-X Bézier exporter samples a bounded number of chords between successive parametric curve points. The exporter must determine which chord contains the current normalized time. Until R7.6, the generated FFmpeg expression tested those chords **sequentially**, using nested `if(lt(...), ..., ...)` branches. A difficult curve with 64 pieces could require evaluating **up to 64 interval comparisons per alpha pixel** before reaching its chord.

R7.7 generates a **balanced binary interval tree** over the very same already-validated sample points.

- With `N` fitted chords, the previous worst-case interval-check count was **N**.
- The balanced tree's worst-case interval-check count is **ceil(log2 N)**.
- Example: **64 chords → at most 6 interval comparisons** to choose a chord, before evaluating the same linear interpolation expression as before.
- A one-chord approximation uses no interval comparison at all.
- Every split occurs at a precomputed, monotonically ordered X sample boundary. At a shared boundary, either neighboring chord yields the same mathematical value (up to rounding), so selecting the right-hand interval is safe.
- The compiler retains the previous **plain-decimal coefficients and leaf interpolation expression**, rather than recomputing or changing the adaptive curve.

The branch counts above describe **algorithmic interval selection**, not measured encoder speed. FFmpeg's expression language specifies that `if(x,y,z)` evaluates the relevant result branch (see [FFmpeg expression documentation](https://ffmpeg.org/ffmpeg-utils.html#Expression-Evaluation)). The renderer still incurs its existing GEQ pixel processing overhead, which can dominate wall-clock performance regardless of tree depth. The generated expression's total text size may stay broadly similar to the old version; it is not an output-file-size optimization.

## What stays unchanged

- The **R7.3 adaptive 2D Bézier fit**, its 0.0015 normalized probe-error target and its 64-chord cap.
- Fixed-X R7.1 Bézier polynomial, all easing presets, linear interpolation and R7.6 native constant-opacity/linear-alpha fastpaths.
- Opacity and audio volume curves; the tree compiler can be used in both filter types, retaining the existing source-local timestamp behavior.
- The R6.9–R7.6 `paracut.studio.draft.v3` schema and all receipt/Undo/Redo semantics.
- No user-supplied expression strings, remote rendering, background workers, credential access, external network calls or automatic overwrites.
- Browser previews still use the exact monotone-X inversion. FFmpeg custom-X curves **remain piecewise-linear approximations** of the true Bézier curve.

## New optional synthetic stress workload

The R7.5 Export Performance Lab now accepts `v2-bezier-stress`, a deterministic five-point curve with **four** custom-X segments. It uses the **same synthetic footage** generator as the other V2 workloads, and the default workload list is unchanged (V1, static V2, native-linear V2, ordinary Bézier V2).

Run the stress workload with the ordinary one for comparison:

```bash
node scripts/studio-export-lab.mjs --duration 3 --repeats 2 \
  --qualities balanced \
  --scenarios v2-bezier,v2-bezier-stress \
  --report ./paracut-r77-lab.json
```

The report includes real verified local FFmpeg render times and graph complexity. **The stress/ordinary ratio does not prove R7.7 is faster than R7.6**, since the curves differ. Controlled before/after speed claims require running the **same synthetic draft on both code versions**, with identical media, FFmpeg build and settings. No such measurement is claimed by the PR or CI.

## Verification

Run `pnpm typecheck && pnpm smoke:studio`. `scripts/studio-r77-smoke.mjs` exercises:
1. The generated balanced tree against the R7.3 left-to-right fitted chord reference, including sample boundaries, extreme X handles and thousands of normalized probe points.
2. Bounded interval comparisons, including difficult cases with at least 32 chords.
3. Preserved fixed-X and preset easing output, safe numeric coefficients and approximate browser parity.
4. Four-segment stress fixture validation, exact draft roundtrip, ledger receipts, Undo/Redo, source relinking and local FFmpeg graph planning.
5. Unchanged default performance-lab workload count, allowing the stress scenario only when selected.

CI checks the generated expression mathematics and plan wiring; it does **not** guarantee pixel-perfect FFmpeg video output or a runtime speedup on the user's computer. Actual local MP4 export/playback and benchmark comparisons remain manual acceptance tasks.
