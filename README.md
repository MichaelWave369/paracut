# ParaCut

## ◆ ParaCut Studio R7.8 — Controlled A/B Export Proof Lab

R7.8 lets you compare the **same synthetic Bézier footage and animation** with both the historical R7.6 sequential chord lookup and R7.7's balanced tree. An opt-in `studio-export-ab.mjs` runner alternates experiment order, uses the exact same draft/settings, verifies every real H.264/AAC MP4, compares **decoded video-frame MD5 streams**, and reports median measured encoder times and the old/new ratio. Normal editing/export remains balanced by default; no new draft fields, telemetry or source-media access. The report is optional and never overwrites another file. [R7.8 guide](docs/STUDIO_R78.md).


## ◆ ParaCut Studio R7.7 — Balanced Bézier Export Expressions

Complex custom-X Bézier MP4 exports now use a balanced FFmpeg decision tree to find the appropriate adaptive chord. Worst-case interval comparisons drop from **N** to **ceil(log2 N)**, e.g. 64 chords require at most six branch decisions instead of 64, while **the same validated fit and interpolation leaves remain in place**. The synthetic export lab adds an opt-in `v2-bezier-stress` workload with four challenging curve segments; default lab scenarios stay unchanged. No saved draft, receipt or browser preview changes, and no unmeasured wall-clock speedup is claimed. [R7.7 guide](docs/STUDIO_R77.md).


## ◆ ParaCut Studio R7.6 — Faster Native Alpha Paths

R7.6 makes simple V2 opacity automation cheaper to render: completely constant opacity uses a native alpha mixer (or no extra filter at 100%), and exactly linear 0→100% / 100→0% ramps use FFmpeg's built-in `fade=...:alpha=1` instead of evaluating `geq` per pixel. **All complex easing, multi-point and Bézier animation still uses the original validated GEQ path.** The synthetic Export Performance Lab now offers `v2-linear` beside static and Bézier workloads for local measurements; no speedup is claimed without running the comparison on real hardware. Saved drafts, browser animation and edit receipts remain unchanged. [R7.6 guide](docs/STUDIO_R76.md).


## ◆ ParaCut Studio R7.5 — Synthetic Export Performance Lab

R7.5 introduces a repeatable, opt-in **local FFmpeg performance lab**. It creates disposable 640×360 test footage and compares V1, static V2 and animated 2D Bézier V2 exports across selected quality presets, reporting measured median encode times and graph complexity. Nothing from your actual videos is read. The normal local exporter also gains a verified machine-readable `--benchmark-json` receipt. Reports are optional, path-free and never overwrite an existing file; all synthetic media and temporary MP4s are cleaned up. No performance claims are made until a real machine completes the benchmarks. [R7.5 guide](docs/STUDIO_R75.md).


## ◆ ParaCut Studio R7.4 — Graph Inspector & Real Export Benchmarks

The selected clip's keyframe lane now includes a **read-only Graph Probe**: scrub within an animation segment and inspect its absolute timeline time, clip-relative position, interpolated value and easing type. Sampling creates **no edits or ledger receipts**. Local FFmpeg exports gain an optional `--benchmark` switch that times source probing, planning, real encoding and verification and reports adaptive-Bézier graph complexity without transmitting or storing performance telemetry. Benchmarking requires a real export; dry-run combinations are deliberately rejected. Existing drafts, render behavior, animation curves and Undo/Redo remain unchanged. [R7.4 guide](docs/STUDIO_R74.md).


## ◆ ParaCut Studio R7.3 — Precision Controls & Adaptive MP4 Curves

Enter exact Bézier handle **X and Y percentages** in the selected keyframe lane, then **Apply XY** for one validated, undoable receipt. Timeline graphs sample 2D Bézier curves more densely. Opt-in local MP4 export now adaptively fits custom-X curves to reduce the usual fixed 64-piece FFmpeg expression, retaining a 64-segment ceiling and approximate fidelity. Older R7.1 fixed-X and preset curves keep their existing math. Real-world encoder speedups depend on hardware and content. [R7.3 guide](docs/STUDIO_R73.md).


## ◆ ParaCut Studio R7.2 — Two-Dimensional Bézier Curves

Custom Bézier keyframe controls now move in **time (X) and value (Y)** on the timeline graph. R7.2 preserves the old R7.1 fixed-X behavior for saved curves without `handles_x`; newly dragged horizontal positions become bounded, ordered, receipt-backed optional point data. Program/browser recording inverts the X curve numerically. Local FFmpeg uses a **64-piece sampled approximation** for edited X curves, so export may differ at extreme tangents and complex V2 overlays can cost more CPU. Old drafts, Undo/Redo and validation remain supported. [R7.2 guide](docs/STUDIO_R72.md).


## ◆ ParaCut Studio R7.1 — Editable Custom Bézier Easing

R7.1 adds **Custom Bézier** as a fifth per-segment animation mode, with two orange vertical-control handles directly on the keyframe graph. Drag or keyboard-adjust the handles, then release to commit one validated receipt; Undo/Redo, saved drafts, Program preview, browser recording and local FFmpeg MP4 all retain bounded cubic easing behavior. Handles have fixed one-third/two-thirds horizontal placement for exact, secure render math; full 2D tangents are deferred. Older R7.0 easing presets and legacy linear projects are unchanged. [R7.1 guide](docs/STUDIO_R71.md).


## ◆ ParaCut Studio R7.0 — Segment Easing Curves

The R6.9 2–8-point V2 opacity and clip volume automation now supports **per-segment Linear, Ease In, Ease Out, and Ease In/Out**. Select an interval and easing mode beneath the timeline curve: edits are validated, receipt-backed, Undo/Redo-safe and preserved in existing `draft.v3` projects. Preview, browser recording and local MP4 use the same bounded easing math; older linear projects render as before. No Bézier handles or new schema migration. [R7.0 guide](docs/STUDIO_R70.md).


## ◆ ParaCut Studio R6.9 — Multi-Point Animation

The selected clip's visual keyframe lanes now support **2–8 draggable points** per V2 Opacity or clip Volume curve. Double-click the graph or press **+ Point at Playhead**, drag interior diamonds in **time and value**, or use keyboard arrows and Delete. Every completed edit produces one validated receipt with Undo/Redo, and saved piecewise-linear curves flow through Program preview, browser recording and local FFmpeg MP4. Older two-point drafts still work; Inspector Start/End Apply intentionally resets that property to two points. [R6.9 guide](docs/STUDIO_R69.md).


## ◆ ParaCut Studio R6.8 — Visual Keyframe Lanes

The R6.7 two-point V2 Opacity and clip Volume animation now has **timeline-aligned curves and draggable Start/End diamonds**. A pointer release makes one validated, undoable ledger edit; arrows, Shift+arrows and Home/End provide keyboard access. Every automated clip shows a **◆ KF** badge, and the Keyframe Lanes view is toggleable. Also fixes an R6.7 Inspector selection bug. Draft schema and browser/local FFmpeg export engines remain unchanged. [R6.8 visual keyframe guide](docs/STUDIO_R68.md).


## ◆ ParaCut Studio R6.7 — First Real Keyframes

Animate a V2 clip's **Opacity** and any media clip's **Audio Volume** with two validated Start/End keyframes and linear interpolation. Controls appear in the collapsible Effects Inspector; Apply/Clear are ledger-backed and Undo/Redo-safe. Program preview, browser recording and local FFmpeg MP4 graphs all evaluate saved animation. Older drafts and neutral clips keep their existing behavior. This is **two-point animation**, not yet a multi-point timeline or bezier editor. [R6.7 guide](docs/STUDIO_R67.md).


## 🎛️ ParaCut Studio R6.6 — Organized Effects Controls

The clip Inspector now provides collapsible, **context-aware Timing, Motion, Opacity, Color, Audio, Copy/Paste and Clip Information** sections. Expand/Collapse All and local section preferences make the studio easier to navigate; the Color workspace reopens its actual grading controls. Existing editing commands, receipts, Undo/Redo, saved drafts, browser recording, and local FFmpeg MP4 exports are preserved. [R6.6 Effects Controls guide](docs/STUDIO_R66.md).


## 📍 ParaCut Studio R6.5 — Timeline Review Markers

Add **colored, named markers with review notes** at any Program playhead position. Navigate with **Shift+M / Alt+M**, click marker pins in the timeline, edit timing and comments in Inspector, and use marker positions as optional snapping anchors. Marker edits have ledger receipts and Undo/Redo, and persist in compatible Studio drafts; browser and local MP4 video renders ignore these annotations. [R6.5 marker guide](docs/STUDIO_R65.md).


## 🎞️ ParaCut Studio R6.4 — Match Frame + Copy/Paste Attributes

Double-click a V1/V2 clip to load its **original video at the corresponding trimmed source frame** into Source Monitor, or press **F** to match the selected clip at the Program playhead. Copy/paste **Color** attributes across V1/V2 clips or **visual V2 Style** across overlays. Copying remains private session UI state; each validated paste creates one ledger receipt with Undo/Redo. No changes to source files, draft format, or browser/local render engines. [R6.4 guide](docs/STUDIO_R64.md).


## ✂️ ParaCut Studio R6.3 — Synchronized Ripple Delete

A new **Sync Ripple** action (`Shift+Delete`) removes a V1 clip and moves later **V2 overlays, A2 audio, and T1 titles** earlier with it. Unlike ordinary Delete, it keeps downstream layers in step; it refuses ambiguous overlaps and touching V1 crossfades rather than silently destroying media. **A1 remains on its own soundtrack timeline.** Edits create receipts and support Undo/Redo. Program frame stepping now supports **comma/period**, with an in-editor shortcut reference. [R6.3 guide and limitations](docs/STUDIO_R63.md).


## 🎨 ParaCut Studio R6.2 — Color Looks + Before/After

The Color workspace now offers four **receipt-backed looks** (Neutral, Warm, High Contrast and Phi Mint), **temporary live slider preview**, selected-clip **Before/After comparison** in Program Monitor, and **COLOR/FX timeline indicators**. Color-edit receipts display their exact correction values. Program comparison is preview-only and does **not** alter browser or local MP4 output. [R6.2 guide](docs/STUDIO_R62.md).


## 🎨 ParaCut Studio R6.1 — Real Color Controls

Select a V1/V2 video clip and adjust **brightness, contrast, saturation and warmth** in the Inspector. Apply and Reset are validated, undoable, receipt-backed edits that survive project saves. Individually graded sources flow through the Program Monitor, browser exports and the local FFmpeg MP4 companion. Browser CSS and FFmpeg color math are **approximations, not pixel-perfect matches**. [R6.1 grading guide](docs/STUDIO_R61.md).


## 🖥️ ParaCut Studio R6.0 — Editor Workspaces

ParaCut's five-track editing cockpit now has **resizable Project Media and Inspector columns**, a draggable **monitor/timeline divider**, and four **locally saved layout presets**: Editing, Audio, Color (layout only), and Titles. Source Monitor visibility is independently toggleable. All settings live outside the project draft, ledger and rendering pipeline. No color grading tools or floating dockable windows are claimed yet. [R6.0 workspace guide](docs/STUDIO_R60.md).


## ✂️ ParaCut Studio R5.9 — Razor Tools + JKL Editing

The Source/Program studio adds **V/C Selection/Razor tools**, explicit V1/V2/A1/A2 **Razor target buttons**, and **J/K/L transport** (one-frame backward jog, stop, and 1×/2× forward playback). Click a targeted clip in Razor mode to split exactly where you click; cuts are validated, receipt-backed and undoable. All prior edits, drafts, browser export and local MP4 rendering are preserved. [R5.9 editing tools guide](docs/STUDIO_R59.md).


## 🎞️ ParaCut Studio R5.8 — Source + Program Editing

Our first Premiere-style **dual-monitor workflow** has arrived: independently preview original footage in a **Source Monitor**, mark IN/OUT, then **Insert at the Program playhead** with V1 ripple or **Replace Selected V1**. The Project Media shelf now supports search and sorting. Every committed edit is validated, undoable and captured as a ledger receipt. Existing V1/V2/A1/A2/T1 browser and local MP4 exports remain unchanged. [R5.8 guide and limitations](docs/STUDIO_R58.md).


## 🎛️ ParaCut Studio R5.7 — Export Quality & Audio Protection

The locally launched Windows/Node.js MP4 exporter adds **Compact, Balanced and High** encoding presets and an **optional post-mix audio sample limiter**. Balanced with protection off matches the old R5.6 output settings. Windows file pickers now include a quality/safety dialog; CLI options are `--quality compact|balanced|high` and `--audio-protect`. All footage stays local, with no file overwrites. [R5.7 quality/mastering guide](docs/STUDIO_R57.md).


## 🎬 ParaCut Studio R5.6 — Layered Local MP4

The opt-in Windows/Node.js FFmpeg companion now supports the full **V1/V2 video and A1/A2 audio storyboard**, including moving V2 dissolves, PiP/full overlays, voiceover ducking, track gain/mute/solo, source audio and timed T1 titles. It still uses your own installed FFmpeg, with explicit dry-run validation, exact media relinking and no overwrites. [R5.6 local rendering guide](docs/STUDIO_R56.md).


## 🎞️ ParaCut Studio R5.5 — V2 overlay crossfades

The five-track browser editor now supports **two moving V2 video sources dissolving together** in live preview and browser WebM / supported MP4 output. Select the first of two touching V2 clips, choose a dissolve duration, and ParaCut creates a controlled overlap with independently gain-weighted V2 original audio. Old drafts still work. The standalone Windows FFmpeg companion continues to refuse layered edits until its engine supports them. [R5.5 guide](docs/STUDIO_R55.md).


## 🎚️ ParaCut Studio R5.4 — Live Audio Bus Meters

During playback, **A1/A2 level indicators now read measured Web Audio sample peaks (dBFS)** after the existing clip volume/fades and track mixer. Paused/unsupported browsers retain clearly labeled R5.3 waveform *estimates*. These are A1/A2 preview-bus readings, **not a master meter or LUFS measurement**. Browser exports and drafts are unchanged. [R5.4 behavior and limitations](docs/STUDIO_R54.md).


## 🎧 ParaCut Studio R5.3 — Waveform Precision

Audio clips on **A1/A2** now expose a source waveform with draggable IN/OUT trim markers, numeric timing and playhead-to-trim shortcuts. A clearly labeled **estimated level guide** shows coarse A1/A2 waveform levels with current track mixer/duck/solo effects. These are not calibrated live meters. No draft or export format changes. [R5.3 guide](docs/STUDIO_R53.md).


## 🎚️ ParaCut Studio R5.2 — Audio Mixing & Overlay Motion

The five-track browser storyboard gains **A1/A2 track gain, mute, solo and voiceover ducking**, plus V2 entrance/exit motion presets (dissolve, slide, rise). Preview and browser WebM/conditional MP4 export use shared mixer/motion math. Older project drafts remain supported; the opt-in local FFmpeg CLI refuses mixer settings it cannot represent. [R5.2 guide](docs/STUDIO_R52.md).


## 🎚️ ParaCut Studio R5.1 — Precision Timeline

The browser editor now has **100–400% zoom**, a clickable time ruler, a shared scrolling scale for **V1/V2/A1/A2/T1**, and optional **smart snapping** for layered clips. V1 crossfades keep their actual overlapping positions, and A2 audio waveforms can be shown when decoded. No media upload or draft-format migration. [R5.1 usage and limits](docs/STUDIO_R51.md).


## 🎥 ParaCut Studio R5 — Layered Storyboard

The browser editor now has **V2 video overlays** (picture-in-picture or full-frame, with opacity fades) and **A2 audio** for voiceover/FX, alongside the existing V1 cuts/crossfades and A1 soundtrack. Add at the playhead, position clips in independent storyboard lanes, preview and export in the browser. The old local FFmpeg companion refuses unsupported layered drafts rather than silently dropping tracks. [R5 guide and constraints](docs/STUDIO_R5.md).


## 🎬 ParaCut Studio R4.2 — Windows double-click MP4 companion

**No terminal commands for everyday local exports:** on Windows, double-click **`ParaCut Export MP4.cmd`** in your local ParaCut repository folder. Pick a saved Studio draft, the folder of original media, and a new MP4 filename. It runs a dry-run validation, asks for explicit confirmation, then uses your installed Node.js + FFmpeg to render locally. No cloud upload, server, installation script, or silent overwrites. The existing browser MP4/WebM buttons remain separate. [Windows setup and limitations](docs/STUDIO_R42.md).


## 🎞️ ParaCut Studio R4.1 — Opt-in local H.264/AAC MP4 export

For browsers without built-in MP4 encoding, R4.1 adds a **standalone local FFmpeg companion** that can render saved Studio drafts with real video transitions, soundtrack audio, source mute, fades and styled titles. It is a manual Node CLI, **not** an in-browser action or bundled encoder. Media stays local; the browser editor and WebM fallback stay unchanged. [Setup and limitations](docs/STUDIO_R41.md).


## 🎞️ ParaCut Studio R4 — native browser MP4 beta

In the local-first video editor, **Export MP4 β** is now offered when the user's browser reports an available MP4 recording encoder. ParaCut records an actual MP4 container and checks the file signature before download; unsupported browsers keep **Export WebM β**. The existing video/audio timeline, crossfades, titles and interop room remain intact. [Read R4 export limitations](docs/STUDIO_R4.md).


## 🎞️ ParaCut Studio R3.2 — Video Crossfades

The browser editor now supports **true overlapping video dissolves** between adjacent V1 clips, including a second moving video decoder and WebM beta export blending with independent gain-controlled source audio. Select an outgoing clip in V1, set **Crossfade to next video**, and preview the blend. R1/R2/R3 drafts remain readable; source media stays local. [R3.2 guide and limitations](docs/STUDIO_R32.md).


## 🎨 ParaCut Studio R3.1 — Title Designer

Customize timed T1 titles with placement (top/middle/bottom), size, color presets, and fade-in/out animations. Edit existing titles and export them in WebM; older R1/R2/R3 browser drafts still open. The original video/audio and Interop Room behavior remains unchanged. [Title Designer guide](docs/STUDIO_R31.md).


## 🎬 ParaCut Studio R3 — Creative Timeline

The browser video editor now adds **per-clip volume and fade-in/out**, plus **timed title overlays** in preview and beta WebM exports. R1/R2 browser drafts can still be opened; the original files remain local and the Interop Room is preserved. [R3 guide and current limits](docs/STUDIO_R3.md).


## 🔇 Video source-audio mute

For videos with unwanted built-in audio, select a V1 clip, then check **Mute original video audio** in the Inspector. Preview and WebM beta export exclude that clip's sound while the A1 soundtrack keeps playing. The setting is saved with browser drafts, can be undone, and does not modify the source video.

## 🎧 ParaCut Studio R2 — soundtrack lane, waveforms and drag reordering

Our live local-first editing studio now supports a separate soundtrack/voiceover lane beside the video track, visual waveforms for decodable audio, clip drag-to-reorder, playback with soundtrack, and **experimental mixed-audio WebM export**. Open `apps/desktop/public/studio.html` through Pages or HTTP. The Interop Room and native project-core remain unchanged. [R2 guide and limits](docs/STUDIO_R2.md).


## 🎬 ParaCut Studio R1 — usable browser editing slice

Open [ParaCut Studio](apps/desktop/public/studio.html) on GitHub Pages (or a local HTTP server) to import video, build a sequential cut, trim/split/reorder clips, undo/redo, preview, save/reopen a draft, and try real-time **WebM beta** export on supported browsers. The original files remain local. See [Studio R1 scope and limitations](docs/STUDIO_R1.md). The original Interop Room remains available separately.


## ParaCut Interop Room v0.1

The browser-facing Interop Room makes the Creative Interop v2 lineage path live:

```text
Creative Bridge v2
→ verified ParaCut references
→ deterministic timeline
→ native RenderPlan hash
→ WaveForge v2 handoff
```

It installs `window.ParaCut`, exposes bounded native site tools when available, and is deployed from `apps/desktop/public` through GitHub Pages.

See [Interop Room v0.1](docs/INTEROP_ROOM_V01.md).

## Parallax Creative Interop v2

ParaCut now has a candidate v2 creative-lineage path connecting the protected Domistika/Auralith handoff to the native ParaCut RenderPlan and onward to WaveForgeStudio.

```text
Creative Bridge v2
→ verify base / overlays / manifest
→ separate ParaCut media references
→ native RenderPlan
→ lineage-bound parallax.bridge.v2
→ WaveForgeStudio
```

The v2 handoff preserves semantic-overlay hashes, optional Auralith capture/receipt hashes, ParaCut asset hashes, RenderPlan hash, and monotonic `planRevision` without granting render, network, subprocess, automatic-import, or publish authority.

The optional CineSwarm extension is currently **unratified on the receiver side** and is not part of the owned canonical scope.

See [Parallax Creative Interop v2](docs/PARALLAX_CREATIVE_INTEROP_V2.md).

**The timeline is a ledger.**

ParaCut is a local-first, AI-assisted video editor built around a clean timeline core, reversible edit receipts, creator memory, auditable render plans, portable project folders, a desktop shell, runtime command wiring, local app settings, safe media import references, media probe metadata contracts, probe cache adapters, source fingerprints, probe planning, cached probe application, probe executor boundaries, safe probe runner stubs, probe plan runner bridges, probe progress events, live probe progress callbacks, probe progress persistence, and human-approved automation.

This repository starts ParaCut as a ground-up build inspired by the open-source creator-editor space, but designed around a Parallax-style ledger spine from day one.

## Product Promise

ParaCut helps creators make videos fast without losing control of their files, edits, style, or provenance.

It is not only a timeline UI. It is a creator workbench where every meaningful action can be saved, replayed, audited, reverted, persisted, reloaded, and exported with context.

## Core Ideas

- **Local-first projects**: project folders remain readable and portable.
- **Timeline as data**: clips, tracks, captions, effects, and exports live in structured project files.
- **Receipts for every edit**: cuts, trims, moves, AI suggestions, approvals, render plans, media imports, media probes, probe cache applications, probe executor outcomes, probe plan runner passes, progress summaries, progress persistence, and exports are logged or stored as readable local records.
- **Human-approved AI**: AI may suggest edits, captions, scenes, or exports, but the creator stays in control.
- **Auditable render plans**: a queued render becomes an inspectable FFmpeg-style plan before execution.
- **Portable folder spine**: `project.json`, `receipts.jsonl`, and `manifest.json` form the v0.4 persistence contract.
- **Desktop shell first**: v0.5 proves project summary, active panel state, command readiness, and static workspace layout before a heavy GUI runtime.
- **Assistant suggestion inbox**: v0.6 stores AI proposals in project state and logs proposal, approval, rejection, and application receipts.
- **Desktop runtime bridge**: v0.7 wires open/save/save-as project folder commands over the file adapter for a future Tauri command layer.
- **Local app settings**: v0.8 adds `settings.json`, default panel/preset preferences, autosave preference, and recent-project memory.
- **Safe media references**: v0.9 imports media as references, infers kind/name/intent, preserves rights notes, and prepares future proxy/thumbnail/waveform/cache targets without copying large files.
- **Media probe contracts**: v0.10 defines duration, dimensions, codecs, audio, bitrate, stream, warning, and error metadata without running FFmpeg yet.
- **Probe cache adapter**: v0.11 saves and reloads probe results under `.paracut/probes/` so unchanged media can avoid re-probing later.
- **Source fingerprints**: v0.12 derives local file fingerprints from filesystem stats so probe cache lookup can be automatic.
- **Probe planning bridge**: v0.13 plans each media asset as `cache-hit`, `needs-probe`, `missing-source`, or `unsupported-source` before any real probing runs.
- **Cached probe application**: v0.14 applies only valid `cache-hit` probe metadata to project media assets and records a summary receipt.
- **Probe executor interface**: v0.15 defines the FFprobe request/result/receipt boundary before spawning any external process.
- **Probe runner stub**: v0.16 adds an injectable runner harness and deterministic mock runner without spawning FFprobe.
- **Probe plan runner bridge**: v0.17 feeds only `needs-probe` plan items through an injected runner, applies successful metadata, caches successful probe results, and records a summary receipt.
- **Probe progress model**: v0.18 turns probe runner output into queued/running/applied/cached/failed/skipped progress events and batch counts for a future UI.
- **Probe runner progress bridge**: v0.19 wires optional progress batch output and live progress callbacks directly into the probe plan runner bridge.
- **Probe progress persistence**: v0.20 saves and reloads progress batches under `.paracut/progress/`, including `latest.json` recovery for the last probe run.
- **Creator memory**: preferred styles, caption formats, pacing, and export presets can be remembered.
- **Plugin-ready future**: effects, transitions, render presets, caption styles, and AI tools should become modular.

## Current Status

**Stage:** v0.20 probe progress persistence adapter

ParaCut is not a working editor yet, but it now has a typed foundation for:

1. Creating a project.
2. Importing media.
3. Creating timeline tracks.
4. Adding, trimming, splitting, moving, and deleting clips.
5. Queueing render jobs.
6. Converting timeline + media + export preset into an auditable render plan.
7. Recording each meaningful action, including render-plan creation, as a receipt.
8. Saving a project folder with `project.json`, `receipts.jsonl`, and `manifest.json`.
9. Loading a project folder and validating manifest/project/receipt consistency.
10. Holding desktop shell state for a loaded project.
11. Summarizing project counts for UI panels.
12. Building command readiness states for open/save/import/render/receipts.
13. Opening a project folder through the desktop runtime.
14. Saving the loaded runtime project back to its attached folder.
15. Saving the loaded runtime project as a new folder.
16. Replacing the in-memory runtime project after command mutations.
17. Storing assistant suggestions on the project.
18. Logging AI proposal, approval, rejection, and application receipts.
19. Creating, saving, loading, and normalizing app settings.
20. Tracking default panel, default export preset, autosave preference, and recent projects.
21. Creating safe media import references with inferred kind/name/intent.
22. Preparing proxy, thumbnail, waveform, and cache target paths for later adapters.
23. Applying a media import batch to a project with individual import receipts and a batch receipt.
24. Creating media probe results for duration, dimensions, codecs, audio properties, bitrate, streams, warnings, and errors.
25. Applying successful probe metadata to project media assets and recording probe receipts.
26. Recording failed/skipped probe receipts without corrupting existing asset metadata.
27. Saving and loading media probe cache records from `.paracut/probes/`.
28. Deriving local source fingerprints from file size and modified time.
29. Using source fingerprints to hit or miss probe cache records.
30. Planning media probe work as cache hits, probe-needed assets, missing sources, or unsupported sources.
31. Recording a probe-plan receipt without running FFprobe or mutating media metadata.
32. Applying cached probe metadata for cache-hit plan items only.
33. Skipping needs-probe, missing-source, and unsupported-source plan items without mutating media.
34. Recording a cached-probe application summary receipt.
35. Building canonical FFprobe request args without spawning FFprobe.
36. Normalizing executor stdout/stderr/exit/timeout results.
37. Parsing FFprobe JSON into ParaCut probe metadata.
38. Recording probe executor completed/failed/timed-out/skipped receipts.
39. Running probe executor requests through an injectable runner interface.
40. Using a deterministic mock probe runner for success, failure, timeout, skipped, and thrown-runner cases.
41. Feeding only `needs-probe` plan items through an injected probe runner.
42. Applying successful runner probe metadata to project media assets.
43. Caching successful runner probe results for future cache-hit planning.
44. Recording a probe-plan runner summary receipt.
45. Translating probe-plan runner output into UI-ready progress events.
46. Summarizing probe progress batches by queued, running, applied, cached, failed, skipped, and terminal event counts.
47. Returning optional progress batches directly from the probe plan runner bridge.
48. Emitting optional live probe progress callbacks during probe plan runner execution.
49. Saving and loading probe progress batches from `.paracut/progress/`.
50. Recovering the latest saved probe progress batch from `.paracut/progress/latest.json`.
51. Running smoke tests against the core loop, file adapter loop, desktop shell loop, desktop runtime loop, settings loop, AI approval loop, media import loop, media probe loop, probe cache loop, source fingerprint loop, probe planning loop, cached probe application loop, probe executor loop, probe runner loop, probe plan runner loop, probe progress loop, probe runner progress bridge loop, and probe progress persistence loop.
