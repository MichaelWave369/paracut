# ParaCut

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
