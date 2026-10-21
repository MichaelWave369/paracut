# ParaCut Studio R5.3 — Waveform Trim & Level Guide

R5.3 improves precision audio editing in the browser while preserving the R5.2 track mixer, ducking, V1 crossfades, V2 overlays, A1/A2 soundtrack clips, T1 titles, snapping and the existing export paths.

## Audio waveform source trimming

1. Import an audio file and add it to **A1** or **A2**.
2. Select the audio clip. The Inspector shows the locally decoded **source waveform**, with vertical **IN** and **OUT** markers. Bright waveform bars are included in the pending selection, gray bars excluded.
3. Drag near either marker to revise the source **IN** or **OUT** point; or type the exact source seconds into the existing numeric inputs.
4. You can also select **IN ← Playhead** or **OUT ← Playhead** to map the playhead through the selected clip's timeline position onto its original audio source.
5. Select **Apply Trim** to commit. Pending drag/numeric edits do **not** alter the project until applied. Undo/Redo and saved drafts work as before.

The minimum allowed audio selection is **0.08 seconds**; existing source trims are validated by the Studio edit model. A2 trims keep the clip's timeline start fixed and adjust its duration without rippling V1 or A1.

Waveforms are produced **locally** by the existing Web Audio decoder from the original imported/relinked audio file. Files above the existing 32 MiB decoding limit, unsupported codecs, or files that are not relinked may have no waveform. The numeric time inputs still work without one. Peers should not treat waveform decoding as bit-perfect sample-level alignment.

## Approximate level guide (not true output meters)

Beneath the A1/A2 mixer, a new **A1 peak estimate** and **A2 peak estimate** view updates with playback. This samples the existing coarse source waveform peak bins and multiplies them by the active clip gain/fades and the track mixer/duck/solo envelope.

**Important:** This is an editing guide, **not a true live audio signal meter**, calibrated LUFS/RMS measurement, clipping detector, or reliable proof of the sound in the exported file. Sampling can miss transients. The display shows **—** if peak data is missing or no audio clip is active. Source audio from V1/V2 is not included in these two guides. For reliable levels and sync, listen to the actual output using a media player or dedicated audio meter.

## Compatibility and safety

- Browser draft format remains `paracut.studio.draft.v3`. No new stored fields or media files.
- Zoom/snap, source mute, track mixer and A2 voice ducking remain intact.
- The canvas trim graph uses fixed drawing code, never user-provided HTML, shaders or remote audio processing.
- Browser WebM and conditional native MP4 export continue unchanged. They retain the real-time browser beta limitations, including possible codec and sync issues.
- The separate local Windows FFmpeg companion continues to reject multilayer/mixer effects it cannot faithfully reproduce.

## Verification

```sh
pnpm smoke:studio
pnpm typecheck
pnpm smoke
```

The R5.3 smoke suite checks waveform coordinate conversion, trim constraints, A1/A2 peak estimates under fades/mixer/duck/solo, canvas marker geometry, source trim undo/redo, backward-compatible drafts and the Inspector controls.

### Hands-on test

Place an A1 song and A2 voiceover on a V1 movie. Trim 0.5 seconds from A2's beginning using the waveform, set A1 to duck under A2, inspect the approximate levels and export a short WebM. Check playback and confirm the new vocal entrance and the music's recovery.

**Next:** Add true Web Audio output metering with measured audio samples, richer waveform peak caches, and eventually local FFmpeg rendering of layered/mixed projects.
