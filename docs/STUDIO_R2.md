# ParaCut Studio R2 — Soundtrack + Waveform Lane

**Status:** functional browser editing increment; live preview and WebM recording require manual testing on supported browsers.

## Try it

1. Open `studio.html` via the deployed Pages site or local HTTP server.
2. Import one or more **video** files and add them to **Video 1** with the + control.
3. Import an **audio** file (e.g., WAV or MP3 supported by your browser). Its + control adds it to **Audio 1**.
4. Choose any clip to set source In/Out, split at the playhead, move earlier/later, delete, undo/redo.
5. Drag clips onto another clip in the **same track** to reorder. Drops near its left or right half insert before or after it.
6. Preview your cut with its soundtrack. Try **Export WebM β** to capture both streams locally, then listen to/watch the saved file.
7. Save a `paracut.studio.draft.v2` file; it contains edit references and history **but no media bytes**. Reimport your original videos and audio to relink after reopening.

## Compatibility

- R2 will **read v1 browser drafts**; the new JSON schema is `paracut.studio.draft.v2` and includes a separate `audioClips` lane.
- Browser draft projects are **not** the canonical ParaCut project-core format; this PR does not modify native timelines, protected overlays or Creative Interop.
- R1 receipts imported from an untrusted JSON file remain unverified historical text. No AI or agent can treat one as permission.

## Limits and security

- R2 supports a **single sequential video lane and a single independent sequential soundtrack lane**. Each starts at zero with ripple order; no gaps, fades, overlaps, automation, volume envelope, titles or draggable playhead in the lane itself yet.
- **Video remains the export master duration.** Any soundtrack portion beyond the video cut is not rendered.
- Audio in the original video is mixed with the additional audio lane during browser recording when Web Audio is available. Mixer uses a fixed basic overlay gain, not loudness normalization.
- Waveforms are generated **on-device** by the browser, only for files no larger than 32 MiB (larger files show no waveform). Unsupported audio codecs can still be referenced if their metadata is readable, but waveform decoding may fail independently.
- No content is uploaded. Blob URLs exist only while the page is open. Relinking uses name, byte size, media type and lastModified, **not a cryptographic fingerprint**.
- R2 browser export still records **real-time WebM beta** via Canvas + MediaRecorder + Web Audio at 1280×720. Up to 5 minutes; visible tab required, unsupported codecs/browser behavior may cause dropouts or sync drift; **review results** before distribution.
- No true frame accuracy, 4K rendering, MP4 export, backend, network access, auto publication or AI editing.

## Verification

```bash
pnpm smoke:studio
pnpm typecheck
pnpm smoke
```

The Studio smoke suite now covers v1 migration, audio lane isolation, split/trim, reorder, undo/redo, tampering, and browser module syntax. Human playback and recorded A/V sync must still be verified separately.

## Next

Build a canonical `packages/project-core` bridge and additive audio mixing engine, then waveform rendering/proxies in workers and a native FFmpeg renderer with explicit user approval.
