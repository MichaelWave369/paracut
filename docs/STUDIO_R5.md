# ParaCut Studio R5 — Layered Storyboard (V1/V2 + A1/A2)

The browser Studio gains two independent layered lanes, without breaking the sequential video edit flow that already exports real movies.

## What's new

- **V1** stays the master ripple video cut with real adjacent-clip crossfades, source audio mute and trim/split/reorder.
- **V2** is a second video layer for timed moving **picture-in-picture** or **full-frame translucent overlays**, with opacity and visual fade-in/fade-out. Its built-in audio starts **muted by default**, so generated footage cannot unexpectedly overpower your soundtrack. Unmute it from the Inspector if needed.
- **A1** stays the existing sequential background music/soundtrack lane.
- **A2** is an independent audio lane for voiceovers, FX or another music layer, each with an absolute timeline start time, volume and audio fades.
- **T1** titles remain above both video layers, with their existing color/position/fade controls.

## How to use

1. Import videos and audio to the **Media Shelf** as before.
2. Press **+** to append video to V1 or audio to A1.
3. Put the playhead where a new overlay should begin. Choose **+V2** next to a video or **+A2** next to an audio asset.
4. In the new **V2** and **A2** storyboard lanes, select or drag a clip to change its position. In Inspector you can precisely set **Layer start time (seconds)**.
5. On a V2 clip, set **Picture-in-picture** or **Full-frame**, opacity percentage and visual fade-in/out. Its source audio has its own mute switch and gain controls.
6. On A2, use the existing volume/fade Inspector controls to mix the extra audio with A1.
7. Play, save the browser draft, and try an exported **WebM β** or supported browser-native **MP4 β**. Listen and check the overlay throughout.

## Timeline rules

- V2/A2 are absolute-time lanes, not ripple edits. Adding or moving a V2/A2 clip **does not push** later V1 or A1 clips.
- Clips **within the same new layer cannot overlap**, initially. V2 can overlap V1 and A2 can overlap A1. Dragging or moving a clip onto occupied time is rejected with an error, not auto-deleted.
- The full movie length remains determined by V1. A layer extending beyond V1 is preserved in the draft but only the portion covered by V1 is previewed/exported.
- V2 and A2 can be split/trimmed with undo/redo. V2 overlays are limited to 80 clips, A2 to 80 clips.
- Source clips and settings stay in the existing additive `paracut.studio.draft.v3` JSON, with optional `video2Clips` and `audio2Clips` arrays. Older R1–R4 drafts open with those lanes empty.
- Existing V1 transitions are preserved. V2 has **independent visual opacity fades**, but no arbitrary V2-to-V2 dissolves or multi-layer keyframes yet.

## Export boundaries

The **browser renderer** includes V2 moving video over the V1 crossfade, plus independent gain-controlled V2 sound and A2 audio through Web Audio, mixed with the existing A1. It remains a real-time browser **beta**: foreground tab required, 1280×720, max 5 minutes, and browser-dependent codecs/timing. A real exported file on the intended PC should be checked before publishing.

**Important:** R4.1 and R4.2 **local FFmpeg MP4 companion** cannot yet render V2/A2 faithfully. It now **rejects layered drafts** with an explicit error instead of silently dropping those tracks. For layered cuts, use browser WebM or browser-native MP4 if your browser supports it. Future work will add real multilayer FFmpeg graph support and a better desktop timeline.

## Tests

```sh
pnpm smoke:studio
pnpm typecheck
pnpm smoke
```

New regression checks cover positions, layer conflict rejection, opacity and volume automation, V1 transition persistence, source mute, undo/redo, browser draft migration and explicit unsupported handling in the legacy local renderer. These automated tests check state and render wiring, **not a complete real-browser synchronized A/V export**.
