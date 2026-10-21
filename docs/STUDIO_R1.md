# ParaCut Studio R1 — browser vertical slice

**Status:** first working, deliberately bounded editor. The Interop Room remains a separate experimental surface at `index.html`.

## Open

Open `studio.html` through GitHub Pages (or an HTTP server serving `apps/desktop/public`). ES modules may not load correctly via `file://`.

## What actually works

1. Import browser-decodable local video files (the original bytes remain on the user's device).
2. Add sources to a single sequential video track.
3. Select clips, set source In/Out ranges, split at the playhead, move earlier/later, delete.
4. Undo and redo up to 40 state checkpoints, with a separate human-edit receipt stream.
5. Play/scrub the cut in a video element, advancing between clip references.
6. Save an explicit `paracut.studio.draft.v1` JSON project, reopen it, and manually relink the original videos by file metadata.
7. **Beta:** export a real WebM file using native canvas capture, Web Audio, and MediaRecorder on supported browsers. Requires the tab to remain visible; the export runs in real time, maximum five minutes, 1280×720 output. Cancel from the same export button.

## Honest limitations

- This is **not** a replacement for Premiere or ParaCut's native project format yet.
- Video only, one sequential track, hard cuts. No image/audio lanes, effects, titles, keyframes, timeline drag reordering, proxies, or background renders yet.
- The browser renders a **WebM beta**, not MP4. Depending on browser and video codec, source audio, timing, transition gaps, or encoding may fail or drift; review output before distribution.
- The export recaptures decoded video at approximately 30 FPS and can take as long as the cut itself. There is no frame-accurate render guarantee.
- Local video bytes are never put in the JSON draft. After reopening, press Import and select your original files again. Missing media is explicitly labeled. File references are matched by name, byte length and modification time; this is **not cryptographic verification**.
- Receipt entries in a user-editable JSON file are a change log, **not trusted proof**.
- Existing `packages/timeline-core` and `packages/project-core` remain authoritative for the native ParaCut project. Studio R1's static browser adapter mirrors their clip shape (asset_id, clip_id, source, timeline, track_id), but its draft schema is intentionally separate until a future explicit conversion adapter is built.
- No AI actions, publishing rights, network acquisition, or background upload authority.

## Test

```sh
node scripts/studio-smoke.mjs
pnpm typecheck
pnpm smoke
```

## Next milestones

- R2: compile/browser bridge to the canonical TypeScript timeline/project core; native project adapter with explicit validation and asset relink protocol
- R3: independent tracks with video/audio overlays, volume, waveform, drag/drop editing, snap, proxy generation
- R4: worker-backed FFmpeg/Tauri desktop encoder with MP4 presets, progress/cancel and reproducible rendering receipts
- R5: human-approved AI suggestions, captions, scene detection, transitions and creative-bridge ingress

## Deployment

The existing Pages workflow publishes `apps/desktop/public`. R1 adds `studio.html` there without replacing the Interop Room or changing its contract and smoke test.

**Authority remains human-only.** Export is always an explicit click. Recording a receipt is not approval.
