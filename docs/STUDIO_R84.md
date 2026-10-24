# ParaCut Studio R8.4 — Direct Title Placement

R8.4 adds **drag-and-place title positioning in the Program Monitor**, precision X/Y inputs, keyboard nudges, optional guide snapping and a Reset to Anchor control. It extends R8.0–R8.3's title workflows without changing the draft schema or replacing the existing title animation/export paths.

## How to position a title

1. Add a normal title in **Titles & Overlays**, then click **Edit** on that title in the T1 title list.
2. Click **Place Selected Title in Program**. If necessary, the playhead moves into the title's visible interval. The Program title becomes an interactive drag handle.
3. Drag the text. Its center follows the pointer delta, and optional snapping attracts X to the horizontal center and Y to the top/middle/bottom title guides within 14 composition pixels.
4. For precise positioning, edit **Center X** (80–1200) and **Center Y** (60–660). Or focus the title in Program and use arrow keys for **1-pixel nudges**, with Shift+Arrow for **10 pixels**.
5. **Stop Placing** disarms the handle without throwing away your staged coordinates; **Reset to Anchor** removes custom positioning and restores the previous Top/Center/Bottom behavior. Cancel Edit discards the pending edit.
6. Press the existing **Save Title Changes** to commit the title's optional absolute position to the project as a single normal `title.updated` receipt. Undo and Redo work as before.

For a new title, its normal Top/Center/Bottom anchor is still available. You may also enter the precise X/Y numbers in the editor before the first Save; direct Program dragging requires an existing selected T1 title.

## Position model and renderer compatibility

- Composition coordinates use **1280×720**, with X = 640 at center. Absolute placement is stored only when you intentionally customize it, as the two optional integer fields `title_x` and `title_y` on a T1 title. Both must be present together and within the bounded safe range.
- The Program Monitor converts the coordinates to relative screen positions, using a 50%/50% text anchor so movement remains centered even when the window is resized.
- Browser Canvas MP4/WebM output draws the title at the exact saved composition coordinate and applies the existing R8.2–R8.3 motion displacement.
- Local FFmpeg/ASS renders exact coordinates with `\\an5` and `\\pos(x,y)` for a stationary title, or a phase-relative `\\move` during an entrance/exit. Eased titles preserve their existing piecewise motion segments and alpha interpolation, centered around the selected position.
- **Older projects with no `title_x` and `title_y` generate unchanged ASS event text.** They retain historic Top/Center/Bottom positioning, standard fade tags, and the earlier R8.2–R8.3 motion behavior. A Reset to Anchor intentionally removes both custom fields on the next Save.

As in earlier versions, browser text and ASS fonts, wrapping, antialiasing, baseline alignment and centisecond timing can differ. Exact coordinates mean the same intended composition center, **not pixel-identical glyphs**. Long titles should be inspected for safe-area clipping; coordinate limits do not guarantee every font and line wrap fits.

## Interaction, safety, and evidence

- A title can be dragged only after explicitly arming Place Selected Title. This prevents accidentally moving footage or text during normal playback.
- Program placement uses Pointer Events and pointer capture so the drag remains controlled if the cursor briefly leaves the text bounds. Cancelled pointer input restores the location at drag start; Escape disarms placement (and aborts an active drag).
- No mutation, receipt or network event occurs during drag, nudge, numeric edits, snapping, preview or Reset to Anchor. Save is still the only project edit.
- Invalid, partial, non-integer and out-of-range coordinates are rejected on Save and on importing drafts, with no arbitrary CSS or ASS positioning instructions accepted.
- The numerical bounds and snap math live in a pure module, `apps/desktop/public/studio-title-placement.js`. No additional fonts, UI dependencies, remote services, telemetry, or new file formats.

## Regression verification

Run `pnpm typecheck && pnpm smoke:studio`, including `scripts/studio-r84-smoke.mjs`. The new suite covers pointer coordinate conversion, exact bounds, snapping thresholds, 1/10-pixel nudges, coordinate validation, old ASS byte parity, stationary/linear/eased title placement and local export plans, receipts, Undo/Redo, old-draft roundtrips, and UI connections. All earlier Studio milestones remain under the smoke suite.

Manual acceptance: create a 4-second text overlay with 1-second fades and Smooth Slide Left motion; edit and drag it to X=427, Y=298; check the animated preview and generated local MP4/Canvas output. Undo should restore its previous location, Redo should reapply it, and Reset to Anchor should restore the original layout. Test keyboard nudging and narrow/mobile Program resize. CI validates source and export plan behavior; visual output must be reviewed on a real encoder before publication.
