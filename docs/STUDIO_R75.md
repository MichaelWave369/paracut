# ParaCut Studio R7.5 — Local Export Performance Lab

R7.5 introduces a **repeatable local FFmpeg performance lab** that manufactures its own short synthetic media. It requires no user clips, uploads, credentials or internet. This is an explicit command-line experiment, not a background service or a performance claim about the user's machine.

## Quick start

Install the repository dependencies as usual, and ensure `ffmpeg` and `ffprobe` are available in your PATH. FFmpeg must support source generation with `lavfi`, MPEG-4/AAC test-source encoders, plus the project's existing H.264/AAC output codecs and layered video filters.

```bash
node scripts/studio-export-lab.mjs --duration 3 --repeats 1 \
  --qualities compact,balanced \
  --scenarios v1,v2-static,v2-bezier
```

Optional report file (never overwrites an existing file):

```bash
node scripts/studio-export-lab.mjs --duration 3 --repeats 2 \
  --qualities compact,balanced,high --report ./paracut-lab-r75.json
```

`--duration` accepts integer seconds 2–10; `--repeats` accepts 1–3. Qualities are `compact`, `balanced` and `high`; scenarios can be a subset of `v1`, `v2-static`, `v2-bezier`. `--ffmpeg` and `--ffprobe` can specify local executable paths. Repeats and workloads multiply: the default is six real exports (three scenarios × two qualities × one repeat). Running on a system without the required FFmpeg codec/filter support fails safely with a descriptive error, not a fabricated measurement.

## What the lab actually does

1. Creates a new uniquely named OS temporary directory.
2. Generates two short **synthetic** MP4 fixture sources locally: a video test pattern with a sine-wave soundtrack and a red video overlay. Nothing personal is read or included.
3. Generates valid ParaCut Studio draft data via the existing validated `newStudio`, `change` and `exportDraft` APIs.
4. Uses the **existing local MP4 exporter** for each selected scenario and quality, with `--benchmark-json` enabled. A record is accepted **only after the real FFmpeg encode succeeds and the local MP4 passes H.264/AAC verification**.
5. Computes per-scenario-and-quality median encode time, median total time, effective real-time multiple, graph character count and adaptive Bézier approximation complexity. When both V2 workloads are selected, compares their median encoding times for the same quality.
6. Prints a human-readable table. If `--report` was explicitly provided, writes an isolated JSON summary with exclusive file creation (`wx`). Otherwise nothing is saved.
7. Deletes **only its own** temporary synthetic media, draft files and rendered MP4s in `finally`, whether the run succeeds or fails.

## Workloads

| Scenario | Workload |
| --- | --- |
| `v1` | Baseline synthetic V1 clip with its own soundtrack |
| `v2-static` | Same V1 footage with the same synthetic V2 overlay, static opacity |
| `v2-bezier` | Same V1 + V2 media with a 2D cubic Bézier animated opacity curve |

A V2 animated/static ratio includes the cost of the selected overlay/alpha filter path, not just the Bézier expression evaluation in isolation. `v1` vs V2 also changes compositing workload. These are practical export scenarios, not controlled single-filter CPU benchmarks. Compare runs only on the **same machine, FFmpeg build, duration, quality and hardware state**. Repetitions produce median values, not statistical significance with 1–3 samples.

## R7.4/7.5 machine-readable benchmark contract

The existing `scripts/studio-export-local.mjs` CLI gains an opt-in `--benchmark-json` flag that emits a single `PARACUT_BENCH_JSON` line **only after verified successful export**. It includes a versioned schema, source timeline duration, elapsed probe/planning/encode/verify/total times, and graph complexity. No filenames, filesystem paths, account data, media bytes or identifiers are embedded in the structured record. Existing `--benchmark` human-readable output remains available. Both flags may be used together for a real export; combining either with `--dry-run` is rejected.

The lab validates the structured record before including it in results, and validates that each requested workload/quality/repetition has exactly one result. A run that fails at any stage produces **no misleading completed report**.

## Security and limits

- The lab never reads the user's source footage. All fixture files are generated in its own isolated, newly created temporary directory.
- No shell interpolation, shell scripts, `sudo`, network upload, replacement of existing files, arbitrary FFmpeg expression text or persistent media caching is introduced.
- `--report` is the **only** persistent output, explicitly opt-in and exclusively created. It contains aggregate metrics and workload names only. It does not save the raw exporter logs, generated project IDs, original filenames or machine identity.
- Fixture generation and each child process have bounded timeouts and memory-limited console capture. A failed subprocess aborts the experiment with no summary.
- Synthetic, low-resolution 640×360 footage is intentionally modest; results do **not** establish throughput for 4K, long-form projects or the user's specific creative footage.
- FFmpeg support differs by operating system and distribution. On CI hosts without all required filters/codecs, the **static/mock and pure API regression tests** still run; a real export lab run remains a manual acceptance step.

## Verification

Run `pnpm typecheck && pnpm smoke:studio`. The R7.5 suite covers options, rejects invalid or duplicate workload selectors, constructs valid drafts for all three workloads, checks export plan structure and graph diagnostics, validates machine-readable benchmark records and report medians, rejects overwriting a report, and verifies that `--benchmark-json --dry-run` fails early.

**Manual acceptance:** Run the lab locally using the quick-start command. Verify the table contains only completed real exports; compare V2 workloads at the same quality, optionally generate a JSON report with a new filename, and verify the temporary sources are deleted. A second run using the same report filename must refuse to overwrite it.

R7.5 intentionally does **not** claim a runtime improvement. It provides the repeatable measurements that can justify targeted FFmpeg optimization in R7.6.
