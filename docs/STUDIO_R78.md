# ParaCut Studio R7.8 — Controlled Bézier Export A/B Lab

R7.7 reduced the *theoretical* number of interval comparisons needed to choose an adaptive custom-X Bézier chord in FFmpeg, but did not establish a runtime performance improvement. **R7.8 provides a fair, actual-encoder A/B comparison** of the old R7.6 sequential lookup against R7.7's balanced decision tree, with both rendering exactly the same validated synthetic project on the same computer.

## Run a controlled experiment

Requires an installed FFmpeg and FFprobe with the codecs/filters already needed for ParaCut local export.

```bash
node scripts/studio-export-ab.mjs --duration 3 --repeats 2 \
  --quality balanced --scenario v2-bezier-stress
```

To explicitly write an aggregate JSON report:

```bash
node scripts/studio-export-ab.mjs --duration 3 --repeats 2 \
  --quality balanced --scenario v2-bezier-stress \
  --report ./paracut-ab-r78.json
```

The new runner accepts `--duration` (2–10 whole seconds), `--repeats` (1–3 pairs), `--quality` (`compact`, `balanced`, `high`), `--scenario` (`v2-bezier`, `v2-bezier-stress`), and optional local `--ffmpeg` / `--ffprobe` paths. The default is **two pairs, four real exports**. Each experiment generates **one** disposable synthetic footage set and **one** validated ParaCut draft. The same assets, project, 2D curve, output resolution, encode settings and codec paths are used for both modes.

## How the comparison works

The local MP4 exporter now supports an allowlisted diagnostic switch:

```bash
node scripts/studio-export-local.mjs --draft cut.json \
  --media-dir ./sources --out ./comparison.mp4 \
  --bezier-lookup linear --benchmark-json
```

Here `linear` is **the historical R7.6 sequential filter-expression compiler**, and `balanced` is the R7.7 default (and the default for every normal export). Both are compiled **from the same R7.3 adaptive chord samples and identical numeric leaf interpolation**. Only the knot-selection expression tree changes. These are local diagnostic options; unrecognized lookup modes are rejected before media is opened.

For each pair, the runner alternates the order to reduce a simple warm-cache / time-order bias:

- Pair 1: old sequential, new balanced
- Pair 2: new balanced, old sequential
- Pair 3: old sequential, new balanced

The runner executes the existing local exporter without a shell. Every output must pass its normal FFprobe H.264/AAC validation and emit exactly one validated, mode-labeled benchmark receipt. After each encode, FFmpeg decodes the video stream and emits **`framemd5` hashes of actual decoded frames**. The runner compares the complete hash streams within each pair and explicitly reports whether they match byte-for-byte in decoded picture data. A mismatch is reported prominently as **NO**, not hidden or counted as an exact parity claim.

After successfully completing all runs, it displays median *actual FFmpeg encode* time, median total time, filter graph size, the ratio **old median / balanced median**, and the decoded-video-frame parity status. A ratio above 1 is an observed speed advantage for balanced lookup on that experiment; a ratio below 1 means the old scan was quicker on that run. Small sample counts, system noise and differing machines can still change outcomes. This method deliberately avoids extrapolating a synthetic ratio to long-form or 4K footage.

## Safety / provenance boundaries

- The experiment creates its own two **640×360 synthetic** MP4 media sources and a synthetic validated draft; it does not read or request personal source video.
- The sole persistent artifact is an **opt-in** JSON summary at the explicit `--report` destination. It uses exclusive file creation (`wx`) and refuses to overwrite existing paths. No generated file path, asset name, media payload, personal identifier, user clip or device fingerprint is stored in the summary.
- All generated media, intermediate projects and output MP4s live in one unique OS temporary directory that is recursively deleted in `finally`. No deletion is performed outside this newly allocated directory.
- Local FFmpeg/FFprobe run without `shell:true`; the runner enforces time limits and bounded subprocess output. There is no cloud dependency or outgoing telemetry.
- Structured `PARACUT_BENCH_JSON` records are accepted **only after verified outputs**. The record contains the selected allowlisted `bezierLookup` mode; a label mismatch fails the experiment.
- Existing projects retain their `paracut.studio.draft.v3` schema, keyframes, undo/redo, receipts and preview. Normal exports use the same balanced tree as R7.7.
- No speedup or bit-exact video parity is claimed until the user runs this lab on a real FFmpeg installation. The CI suite checks math and safety contracts, not full codec equivalence on the user's hardware.

## Manual acceptance

Run the first command above locally. Check that all four MP4s actually encode, pass FFprobe verification, and report a decoded-frame parity result. Repeat during idle hardware conditions for more stable timings. Compare the **old/new median ratio** and graph sizes; where decoded frames differ, inspect the output separately before trusting the optimization. Optionally save a new JSON report, and confirm a second run with that same report destination refuses overwrite.

The earlier [R7.5 scenario lab](STUDIO_R75.md) remains available for broader static/linear/Bézier workload comparisons. R7.8's new A/B is more tightly controlled because the same curve is rendered by both old and new lookup strategies, rather than comparing two different curves.
