# ParaCut Studio R5.1 — Timeline Precision

R5.1 adds an accurate **shared storyboard time scale** and optional snapping for the layered V2/A2 tracks while preserving existing V1 video crossfades, A1 soundtrack, animated T1 titles, and browser rendering.

## Using the new controls

1. Open ParaCut Studio and load or build a V1 cut.
2. Use **Timeline zoom** (100–400%) to expand the ruler and all five tracks. The ruler shows time marks and can be clicked to seek. **Fit** restores 100%.
3. Leave **Snap boundaries** enabled to align V2/A2 clip starts or ends near an existing boundary, a title cue, or the current playhead. Turn it off for unrestricted placement.
4. Add a media asset with **+V2 / +A2** at the playhead, or drag an existing V2/A2 clip along its storyboard lane. The Inspector's **Layer start time** also uses snapping when enabled.
5. Place a second video over V1, and voiceover on A2 over A1. Listen/watch in the preview, then export a short browser WebM or native MP4 if supported.

## Timeline rules and safety

- **One coordinate system** for V1, V2, A1, A2 and T1. The sequence clips show their actual absolute timeline start/end positions, including overlapping V1 crossfades. Titles are also positioned by their scheduled intervals, not evenly spaced badges.
- Timeline zoom changes **only the editor's view**, not any saved timing, media or rendered output. Scroll horizontally when zoomed in. All five lanes scroll together.
- Snapping is a **suggestion** applied only when a candidate clip's start or end is within a screen-scale threshold of a boundary (or the playhead) and the candidate is legal on its layer. It never changes other clips or allows same-lane overlaps.
- Snap candidates include the sequence start/end, V1/V2/A1/A2 clip boundaries and T1 title starts/ends. Existing V2/A2 clips being moved are excluded from their own candidate list.
- A2 clips can show a waveform when the imported source has already been decoded by the existing waveform code.
- Saved ParaCut browser draft format remains **v3**, with no schema changes in this release. R1–R5 projects still open, and existing Undo/Redo operates on actual edits. Zoom and snap preferences reset on reload.
- The local FFmpeg Windows companion still deliberately refuses V2/A2 layered projects until a future local render graph supports them. This is unchanged.

## What this release does not include

It does not add new arbitrary video transitions, draggable V1 trims, animated visual keyframes, track grouping, or unlimited lanes. The browser WebM/MP4 export is still **real-time beta** and should be checked by playing the resulting movie.

## Verification

```sh
pnpm smoke:studio
pnpm smoke
pnpm typecheck
```

`studio-r51-smoke.mjs` covers start/end snapping, legal placement, non-overlap enforcement, playhead anchors, no mutation without an edit, backward-compatible draft behavior, and ruler/zoom wiring. CI cannot prove browser drag interactions or A/V export quality; those still require user acceptance.
