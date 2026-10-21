# ParaCut Studio R3.2 — True video crossfades (browser beta)

This pass introduces **overlapping two-video dissolves** on the existing V1 video track. It does not fake a dissolve with a black screen or a static poster frame: two video sources play during the transition, and the editor blends the incoming clip over the outgoing clip.

## Quick start

1. Import and append **at least two video clips** to V1.
2. Select the **outgoing** video clip, which must have a video immediately after it.
3. In the Inspector under **Crossfade to next video**, enter a duration in seconds and select **Apply**. Use **0** to restore a hard cut.
4. Preview the overlap. You should see the next scene gradually becoming visible over the previous one.
5. Add soundtrack audio to A1 and titles to T1 as before. Export WebM β and check both moving scenes and audio.
6. Save Draft and reopen/relink media later. The setting is saved with the outgoing clip; Undo/Redo reverses edits.

### Transition geometry

An outgoing clip with a 1-second crossfade overlaps the incoming clip by **1 second**. If clips are 9 and 6 seconds, the total cut becomes 14 seconds instead of 15. The incoming source begins at its own first frame at the beginning of the overlap; after the transition the incoming clip continues 1 second into its source. The video has no repeated starting second.

The maximum overlap is **1.5 seconds**, limited further to one-third of the outgoing and incoming trimmed lengths. This prevents triple overlaps in a sequence. Trimming, splitting or reordering a clip may automatically reduce transition duration to remain valid. A split places the old outgoing transition on the **second** fragment. The selected boundary's fade duration is recorded and the timeline geometry is validated.

### Audio and graphics

- The preview uses a second `HTMLVideoElement`; both moving frames are composited by opacity. Source audio is weighted by the same transition progress. Existing **Mute original video audio** settings still apply to each clip independently.
- The WebM export uses a second decoder and an independent **Web Audio gain node** for incoming source audio. During the transition, outgoing audio ramps down and incoming ramps up. A1's soundtrack keeps its own separate volume/fades path.
- T1 titles remain on the absolute final timeline. A crossfade shortens the cut and can shift where a title appears relative to later video footage; adjust title timing if desired.
- Audio mixing is linear gain, not equal-power crossfade, and has no loudness normalization.

### What this does *not* claim

This is a **browser-beta**, real-time export pass, not a frame-accurate offline render engine. Crossfade onset can stutter on some devices/codecs while the incoming decoder starts, playback may drift, audio fades may not be sample-accurate and unsupported sources may fail to decode. Exports still require a visible tab and supported browser WebM encoder (Chrome/Edge recommended). Manually inspect the exported output, especially the transition and audio levels. **MP4 export, GPU composition, background rendering, arbitrary effects, multiple video layers and native FFmpeg are not implemented here.**

The existing Interop Room and canonical TypeScript `project-core` representation are unchanged; browser drafts still use `paracut.studio.draft.v3` with an additive optional `transition_out_seconds` on V1 clips. R1/R2/R3/R3.1 drafts without transitions continue to open as hard cuts. Source assets stay local; no upload, agent auto-edits or publishing.

## Verification

```sh
pnpm smoke:studio
pnpm typecheck
pnpm smoke
```

The added `studio-r32-smoke.mjs` verifies overlap calculations, no-transition compatibility, edit receipts/undo, trimming and splitting, bounds checking, sound mixing plumbing and the presence of the dual-video compositor. A real exported WebM still needs a human acceptance pass.

## Next

R3.3: more flexible transition curve presets and predecoded proxies if current browser tests are stable. R4: a local desktop/native encoder for reproducible H.264/MP4 and precise A/V timing.
