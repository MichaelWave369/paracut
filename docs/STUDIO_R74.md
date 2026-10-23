# ParaCut Studio R7.4 — Graph Probe & Measured Local Export Benchmark

R7.4 improves animation inspection and export diagnosis without adding new effect data, cloud calls, or project schema changes.

## 1. Read-only graph inspector

For any selected V2 overlay opacity or clip-volume keyframe lane, R7.4 displays a **Graph Probe** slider below the animated graph.

- The slider is constrained to the selected easing interval. It begins near the current playhead position, clamped into the interval.
- The readout shows **segment number**, **absolute timeline start/end seconds**, the sampled **timeline time**, **clip-relative percentage**, **interpolated property percentage**, and **easing mode**.
- Switching a segment updates the sample range and readout. Sliding the probe does **not** move the Program playhead, change a media file, change the underlying saved curve, or create a ledger receipt.
- The current graph can still be edited with diamonds, 2D Bézier control points and R7.3 exact X/Y Apply, all preserving existing receipts and Undo/Redo.
- The probe is refreshed when the selected-clip lane is rerendered. It is **not an always-live playback meter**; use its slider to inspect a particular time precisely.

## 2. Optional measured local FFmpeg export benchmark

Use ParaCut's existing opt-in local exporter, supplying the same draft and verified original local media you would normally export:

```bash
node scripts/studio-export-local.mjs --draft cut.json --media-dir ./sources --out ./render.mp4 --benchmark
```

Available existing options include `--media-map`, `--quality`, `--ffmpeg`, `--ffprobe` and `--audio-protect`. Run `node scripts/studio-export-local.mjs --help` for the usage line. The destination must not already exist; ParaCut continues to reject overwrites and requires valid source media and an H.264/AAC MP4 output.

Benchmarking requires an **actual encode**. Combining `--benchmark` with `--dry-run` is rejected to avoid suggesting a filter-planning microbenchmark represents the speed of a video render. Without the opt-in flag, the exporter behaves as before.

After a successfully encoded and verified local MP4, a console summary reports:

- Original project video duration and achieved real-time multiple (project seconds divided by *actual encode* elapsed seconds).
- Source relink/FFprobe checks, export plan time, FFmpeg encode time, output verification time and total observed time.
- Planned FFmpeg filter graph character count.
- Number of explicit custom-X Bézier intervals, total adaptive fit pieces, the old 64-piece-per-interval baseline and the largest **sampled** planner probe difference.

A representative real-time factor above `1x` means the encoder processed source timeline time faster than elapsed encode time. **No benchmark results are claimed until the tool is actually run on real footage on the user's hardware.** Measurements vary with CPU/GPU, codec build, frame size, media properties, other programs and thermal limits.

The report is printed locally to stdout. It intentionally contains **no file paths, asset names, user metadata, network requests or automatic upload**. You can redirect it into your own local log if desired.

## 3. What has not changed

- Saved `paracut.studio.draft.v3` data and all earlier R6.9/R7.0/R7.1/R7.2/R7.3 easing modes.
- Existing 2D Bézier preview inversion, adaptive FFmpeg approximation and validation.
- Browser export flow and its existing media-locality guarantees.
- All receipt and Undo/Redo rules for actual edits.
- FFmpeg's underlying `geq` performance limits. The benchmark diagnoses runtime; it does **not** automatically optimize filters or prove a speedup.

## Verification

`pnpm typecheck && pnpm smoke:studio` includes `node scripts/studio-r74-smoke.mjs` and checks the benchmark CLI.

Manual acceptance:
1. Select a two- or multi-point V2 opacity curve and move the Graph Probe slider; verify the displayed time and interpolated percentage. Verify no receipt appears.
2. Select another interval and confirm the permitted sample range and easing description update.
3. Use an A1 soundtrack Volume lane. Confirm the readout uses its own clip duration and animation.
4. Apply a real Bézier edit, Undo/Redo, and save/reopen. Ensure the new inspection UI changes none of this.
5. Run one **short** local MP4 with `--benchmark` and verified original media. Inspect the reported timings and actual rendered video/audio. Compare runs only with the same clip, hardware and settings.
6. Run the same command with both `--dry-run --benchmark` and confirm it rejects the combination rather than reporting a fake speedup.

Next candidate: an export performance lab that compares fixed source fixtures and quality modes on the user's own machine, with explicit media authorization and repeatable baseline logs.
