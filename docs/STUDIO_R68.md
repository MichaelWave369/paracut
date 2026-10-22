# ParaCut Studio R6.8 — Visual Keyframe Lanes

R6.8 makes the existing R6.7 **Start/End keyframes** visible and directly editable in the timeline, while preserving the same ledger transactions, two-point linear math and browser/local FFmpeg export paths.

## Find the curves

Select any media clip in **Selection (V)** mode. A new **◆ Keyframes · Selected Clip** area appears below the A2 media track.

- **V2 video:** Two rows: V2 Opacity and Clip Volume.
- **V1 video / A1 or A2 audio:** Clip Volume row.
- **No clip selected:** Keyframe rows are hidden.
- **Razor (C)** and export in progress: keyframe handles are disabled to prevent accidental competing edits.
- Unanimated clips display a dashed, flat **100% guide**. Animated clips show solid curves.
- Clips with applied keyframes get a **◆ KF** badge on their original V1/V2/A1/A2 timeline bars.
- Uncheck **◆ Keyframe lanes** next to timeline zoom to hide the editor without deleting automation.

The curves are aligned to the same absolute horizontal timeline coordinate system as the clips, so source trim, timeline zoom and layer placement are reflected in the position and length of the selected clip's curve.

## Edit a diamond

Each curve has exactly **two diamonds**, one at the first frame (Start) and one at the last frame (End).

**Pointer:** Drag an endpoint vertically to preview its new 0–100% value. On release, ParaCut applies one `clip.keyframes.updated` command, creates **one receipt**, redraws the curve and updates the Effects Inspector values. Dragging itself does not mutate the saved project. Canceling a pointer gesture restores the previous curve without changing the project.

**Keyboard:** Tab to a diamond, then use arrow keys to change that endpoint by 5 percentage points; Shift+arrow changes by 10. Home sets it to 0%; End sets it to 100%. Keyboard focus returns to the same diamond after the receipt-backed edit.

A neutral, untouched 100% endpoint isn't recorded as a new edit. The **Apply keyframes** and **Clear animation** buttons in Effects Controls are still available, along with Undo/Redo.

These values are **multipliers** of the original base opacity/volume, existing fades and mixer bus settings. For example, an Opacity 0%→100% curve on a V2 clip with base opacity 70% produces an effective opacity ramp of 0%→70% before its visual fades and any transitions.

## Safety and compatibility

- R6.8 intentionally remains a **two-point linear editor**, not draggable arbitrary-time keyframe diamonds. You can adjust endpoint *values* but not their Start/End positions in time. The start/end positions follow the clip's current trimmed duration.
- The visual lane is an interface projection of `opacity_keyframes` and `volume_keyframes` already stored in compatible `paracut.studio.draft.v3` clip objects. No new project schema, media upload, arbitrary effects expressions or render filters.
- The same `clip.keyframes.updated` ledger command handles every pointer/keyboard edit. Failed or invalid commands must not modify the project.
- Browser preview/recording and local FFmpeg MP4 continue using R6.7 keyframe math. Export performance and browser-versus-FFmpeg fidelity limitations from R6.7 still apply.
- R6.8 also fixes an R6.7 Inspector wiring defect: selected clip keyframe fields previously refreshed from the timeline rendering loop rather than the Inspector's selected clip. They now refresh from the actual selection only.

## Testing

```sh
pnpm typecheck
pnpm smoke:studio
```

`scripts/studio-r68-smoke.mjs` covers timeline geometry, bounds, handle editing, simulated drag and keyboard actions, one receipt on pointer release, no receipt while dragging or for unchanged values, selected-clip focus restoration, Undo/Redo, draft round trips, and unchanged local MP4 effect planning.

**Manual browser acceptance:** Add a V2 clip with opacity Start 0%/End 100% and A1 audio with volume 100%→0%, select each and check curve alignment. Drag each handle, zoom the timeline, toggle visibility, use keyboard arrows and undo/redo. Confirm the Inspector values change for the **selected** clip (not a different clip), then save/reopen and export a short WebM and local MP4 to verify animation matches the intended ramp.
