# ParaCut Studio R7.6 — Native Alpha Fastpaths

R7.6 targets a specific, verifiable source of unnecessary FFmpeg filter work: an animation using **constant opacity** or a **single full-range linear alpha ramp** previously took the same `geq` path as an arbitrary Bézier curve. `geq` can evaluate a complex expression for every pixel of every frame, even if the curve is trivially constant or linear.

The R7.6 export planner now selects an allowlisted native FFmpeg alpha filter when it is semantically appropriate.

## Alpha filter selection

| Curve | R7.6 FFmpeg output | Notes |
| --- | --- | --- |
| No opacity automation | No additional animation filter | No change |
| All animation keyframes have opacity 100% | No additional animation filter | Exact opacity identity |
| All animation keyframes have the same value under 100% | `colorchannelmixer=aa=N` | Constant alpha multiplication, independent of easing |
| Exactly 2 linear points, opacity 0 → 100% | `fade=t=in:st=0:d=D:alpha=1` | Native alpha fade-in spanning the source clip |
| Exactly 2 linear points, opacity 100 → 0% | `fade=t=out:st=0:d=D:alpha=1` | Native alpha fade-out spanning the source clip |
| Other two-point curves, partial ramps, multipoint, ease presets or Bézier | Existing generated `geq` alpha expression | No change to complex-curve semantics |

Selection works for both legacy `opacity_keyframes: {start, end}` projects and newer validated `opacity_keyframe_points`. A saved project is **not rewritten or migrated** merely because its export plan chooses a native FFmpeg filter. All core/preview math, source audio, timeline receipts and Undo/Redo behavior are unchanged.

The clip's separately configured `overlay_opacity`, visual fade-in/fade-out, V2 transitions and motion continue to apply **after** the animation filter, as before. Native fades may differ slightly from FFmpeg's previous timestamp-based `geq` implementation near individual frame boundaries. This is a qualified optimization, **not a promise of pixel-identical output**. Inspect a short MP4 for frame-level timing requirements.

## Performance evidence: the new linear workload

The existing [Export Performance Lab](STUDIO_R75.md) adds a fourth synthetic scenario: **`v2-linear`**, using the same generated V1 soundtrack and V2 overlay as the other workload scenarios, but animating the overlay from 0 to 100% opacity with the new native alpha fade.

Run the comparative experiment locally:

```bash
node scripts/studio-export-lab.mjs --duration 3 --repeats 2 \
  --qualities compact,balanced \
  --scenarios v2-static,v2-linear,v2-bezier \
  --report ./paracut-r76-alpha-benchmark.json
```

The lab now reports a **Bézier/native-linear encode-time ratio** for each shared quality. A value above 1 means the sampled Bézier workload encoded slower on that machine in that run. The ratio is a practical workload comparison, **not a controlled before/after benchmark of an identical curve**, because a native linear fade and a Bézier easing have different animation semantics. For definitive optimization speed evidence, compare an identical 0→1 linear project exported on both R7.5 and R7.6 with identical FFmpeg and settings.

Default lab scenarios are `v1`, `v2-static`, `v2-linear` and `v2-bezier`. At default settings this is **8 synthetic local exports** (4 scenarios × 2 qualities × 1 repeat). Full lab options, temporary file protections and report schema remain as documented in R7.5.

## Security and compatibility

- This is an export-plan-only fast path; no new arbitrary user input, shell interpolation, network access or edited project fields.
- Validated source-local duration is used for native fades; malformed points, invalid Bézier handles and unsupported animation properties still fail closed through existing validators.
- Fixed alpha uses `colorchannelmixer` only after the overlay is converted to RGBA, retaining source alpha semantics.
- Complex animations continue using their validated `geq` expressions, including adaptive two-dimensional Bézier approximation. The new shortcut does **not** optimize those complex cases.
- Existing `paracut.studio.draft.v3` projects work unchanged.

## Verification

Run `pnpm typecheck && pnpm smoke:studio`, including `node scripts/studio-r76-smoke.mjs`. Focused assertions test all fastpath cases, reject invalid curves, verify rendered graph selection, retain legacy drafts, receipts and Undo/Redo, and exercise the new lab scenario's verified planner and comparative report.

**Manual acceptance** still matters. Export a short constant-alpha, a full-range linear fade and a 2D Bézier scene using a real local FFmpeg installation. Check the output's overlay alpha timing and audio, compare encoding times on the **same local synthetic input**, and only then attribute any meaningful performance improvement.

No acceleration claims, absolute visual parity claims, GPU acceleration, non-linear filter rewrite or silent changes to old draft data are introduced.
