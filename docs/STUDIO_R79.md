# ParaCut Studio R7.9 — Export Diagnostics Inspector

R7.9 turns local export benchmark data into **conservative, actionable diagnostics** without changing the renderer's output, requiring user footage, modifying saved project drafts, or collecting telemetry.

The previous milestones established a measured local pipeline: R7.4 collects export phases, R7.5 creates synthetic workloads, R7.7 balances Bézier interval lookups, and R7.8 makes a **same-project** old-vs-new test. R7.9 helps interpret those results without confusing an observed ratio with a universally proven acceleration.

## 1. Read existing reports without rendering

```bash
node scripts/studio-export-diagnose.mjs --input ./paracut-ab-r78.json
```

The inspector accepts existing versioned `paracut.export.ab.v1` and `paracut.export.lab.v1` JSON summaries. It does **not** require FFmpeg, read video content, edit the source file, or write any new report. The report must be a regular JSON file no larger than 500 KiB. Unknown report formats and malformed values fail closed. No paths or personally identifying data are printed in the analysis.

**Historical R7.8 A/B reports contain aggregate medians but no individual measurements.** Those reports are still read: the inspector can examine the overall ratio and saved frame-parity status, but explicitly labels pair-level stability and detailed phase attribution **unavailable**. It does not manufacture missing data.

Reports from the broader scenario lab are also supported, but their different workflows are **not** treated as a controlled Bézier lookup experiment. The inspector recommends a same-project A/B before attributing a speed change to the lookup algorithm.

## 2. Collect richer measurements with the unchanged controlled A/B runner

The R7.8 command is still supported:

```bash
node scripts/studio-export-ab.mjs --duration 3 --repeats 3 \
  --quality balanced --scenario v2-bezier-stress \
  --report ./paracut-r79-ab.json
```

All existing safety boundaries remain: FFmpeg generates one synthetic 640×360 footage set and one validated draft, each test actually encodes and verifies H.264/AAC MP4 output, run order alternates, FFmpeg `framemd5` checks decoded-frame equality, and the temporary fixture/output folder is removed at the end. The optional JSON report uses exclusive file creation and refuses overwrite. There is no network upload, user video access, or editor project mutation.

In R7.9, **new reports additionally retain**, for each verified export, the safe numeric fields `repeat`, `mode`, `probeMs`, `planMs`, `encodeMs`, `verifyMs`, `totalMs` and `framesMatch`. No paths, raw decoder frames, footage names or hardware identifiers are stored. All previous aggregate fields remain intact. A derived `diagnostics` section includes:

- **Decoded-frame parity gate:** a mismatch takes precedence over claims of performance success.
- **Per-pair old/new encode ratios:** makes opposite directions and inconsistent observations visible instead of hiding them behind medians.
- **Relative spread of pair ratios:** a heuristic flag for visibly variable observations; more than 15% variation is treated as a reason to re-run.
- **Stage medians:** source probe/relink, filter planning, FFmpeg encoding and final verification, plus the median encode-time / total-time ratio.
- **Unattributed time:** an *approximate* residual of total time after stage medians, which is not a full profiler or exact accounting identity.
- **Next action:** investigate frame parity, repeat noisy/limited experiments, investigate non-encode overhead, compare other stages, or confirm a consistent trend on longer fixtures.

These are qualitative **heuristics**, not statistically rigorous confidence intervals or root-cause identification. One to three pairs are not enough to certify a general performance improvement. A high encode share identifies a stage where wall time is spent; it does not isolate a single GEQ expression or establish CPU/GPU causality.

## 3. What the inspector does not claim

- It does **not** prove R7.7 is faster than R7.6 until a verified local A/B actually runs.
- It does **not** presume that changing synthetic data filters produces an equal result for 1080p/4K/long-form real footage.
- It does **not** claim measured FFmpeg phases add up perfectly: source I/O, subprocess setup, scheduling and stage medians can leave a residual.
- It does **not** ignore decoded-frame mismatches in the name of a favorable benchmark number.
- It does **not** persist diagnostics by default. Only the explicitly requested A/B `--report` file is durable.

## Regression verification

Run `pnpm typecheck && pnpm smoke:studio`, which now includes `scripts/studio-r79-smoke.mjs`. It checks consistency and phase classifications, mismatched frames, incomplete or forged data, historical A/B and multi-workload report migration, duplicate comparisons, CLI input validation, old project and animation tests, and read-only inspection of temporary JSON files.

Real FFmpeg exports are deliberately **not simulated as measurements** by CI. The practical acceptance test remains to run the opt-in A/B on the target computer and inspect the resulting report. ParaCut's default balanced Bézier FFmpeg exporter, animation preview, receipt ledger, Undo/Redo, and `paracut.studio.draft.v3` stay unchanged.
