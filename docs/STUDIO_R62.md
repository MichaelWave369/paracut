# ParaCut Studio R6.2 — Color Workflow & Visual Edit Feedback

This milestone turns the R6.1 working V1/V2 color controls into a faster editing experience, while retaining the current project draft, Undo/Redo, original media and browser/local MP4 rendering.

## Apply looks to footage

Select a **V1 or V2** clip, then open the Color controls in Inspector. Four preset buttons apply fixed values immediately through the existing `clip.color.updated` transaction:

| Look | Brightness | Contrast | Saturation | Warmth |
|---|---:|---:|---:|---:|
| Neutral | 100% | 100% | 100% | 0 |
| Warm | 106% | 105% | 112% | +28 |
| High Contrast | 97% | 132% | 106% | 0 |
| Phi Mint | 104% | 114% | 122% | −24 |

Every preset is just a validated combination of the current four controls. **One click = one edit receipt**, fully undoable, and no new effects engine or format change. The exact color values appear on color edit entries in the receipt panel. These looks are aesthetic starting points, not calibrated transforms.

## Live audition and Before/After

- Drag a Color slider and the selected clip's appearance changes **temporarily in the Program Monitor**. This is an uncommitted audition; choose **Apply Color** to save it with a receipt.
- The **Before/After** button on the Program Monitor toggles the selected V1/V2 clip between its original neutral color and its adjusted appearance. During a V1 or V2 dissolve, only the selected video is neutralized; other clips keep their own independent corrections.
- The comparison is **preview only**. It does not modify the project, source media, saved draft, receipt ledger, browser recording or local MP4. When you change selected clips, comparison resets to the adjusted view.
- Changing values or looks does not recolor T1 titles. Preview uses the existing per-video CSS filters; exports continue to use the current Canvas/FFmpeg per-source filters. Browser preview and FFmpeg output remain **approximate, not pixel-matched**.

## At-a-glance timeline labels

A V1 or V2 video with non-neutral color receives a visible **COLOR** badge and thin tinted edge. V2 video overlays with non-default motion, opacity or visual fades also display an **FX** indicator. Existing clip filenames, dissolve labels, timing and audio waveforms are kept.

This is a fast signal about clips with adjustments, not a filmstrip thumbnail generator or a full effect-stack inspection.

## Color workspace is now functional

The workspace selector simply reads **Color**, instead of the out-of-date **Color (layout only)** label. Choosing Color focuses the existing Inspector color section when a video is selected. The wider workspace panels remain resizable and their preferences persist locally.

## Validation / limits

- All look values are validated by the existing `validateClipColor` rules; unknown looks or unsafe properties are rejected.
- Slider audition and Before/After are ephemeral browser UI state. Only Apply Color, Reset or a named look changes the edit ledger.
- Saved drafts remain `paracut.studio.draft.v3`; exported video always uses committed grades, not temporary preview.
- The Color panel is still in the Inspector. This release does **not** introduce arbitrary drag-to-dock, new keyframes, LUTs, ACES/scene-linear processing, calibrated scopes or more advanced effect parameters.

## Test plan

```sh
pnpm smoke:studio
pnpm typecheck
```

The new `studio-r62-color-workflow-smoke.mjs` checks exact look values, preset immutability and validation, selected-only comparison, pending audition, clear receipt detail, Undo/Redo, backward-compatible drafts, timeline badges and an unchanged export pipeline.

Manual browser acceptance: color-correct two V1 clips differently, select one and toggle Before/After through their dissolve. Apply Phi Mint to one V2 clip and Warm to another, inspect the COLOR and FX badges, save and reopen, then render a short WebM/local MP4. The exported file must use the committed grades even if Before mode was active in the Program Monitor.
