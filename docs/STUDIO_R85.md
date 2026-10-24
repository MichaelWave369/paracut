# ParaCut Studio R8.5 — Visual Title Transforms

R8.5 adds a **resize handle** for selected T1 titles, a precise percentage-based title scale slider, and optional **action/title safe-area guides** in Program Monitor. It also fixes an R8.4 bug in which staged custom X/Y coordinates did not reach the Add/Save Title command. The title model and prior motion features remain intact.

## Resize and place a title

1. Add a title to T1 and click **Edit** beside it. Choose **Place Selected Title in Program** to arm the interactive title tools.
2. Drag the text to stage new X/Y placement. The selected title now shows a separate **⤡ resize handle** near its right/lower edge.
3. Drag the handle horizontally to stage a bounded font scale, from **50% to 200%**, in **5% increments**. Or focus the handle with the keyboard and use the arrow keys for **5% steps**, Shift+arrow for **10% steps**. The numeric **Title scale** slider can do the same, including before adding a new title.
4. Enable **Show Safe-Area Guides** to overlay two preview-only boxes: an **action-safe 10% inset** and a **title-safe 20% inset**. Toggle off to hide them.
5. Click **Save Title Changes**. Only this explicit save commits a `title.updated` receipt, or `title.added` for a new title. Undo/Redo work normally. **Cancel Edit** discards pending changes.
6. **Reset to Anchor** stages removal of custom X/Y placement while retaining any selected scale. The preview now correctly shows the reset rather than the previously saved custom placement.

The safe guide overlays, resize affordance and edit handles are **editor-only**. They do not appear in the rendered browser or FFmpeg video.

## Cross-renderer behavior

- Title size is stored as an **optional** integer `title_scale`: 50, 55, 60, …, 195, 200. Missing or explicitly default 100% uses the previous behavior, and the saved schema remains `paracut.studio.draft.v3`.
- The Program preview computes a composition-scaled text font from the same base fonts used by the 1280×720 canvas exporter, while the existing responsive styling is preserved when the saved title is 100%.
- Browser Canvas MP4/WebM export scales the font size without changing placement, motion, opacity, text-wrapping budget, or video/audio track behavior.
- Local FFmpeg/ASS export scales each title's `\\fs` value, retaining the same previous ASS strings for titles without a non-default scale. Absolute XY placement still uses the existing R8.4 `\\pos` and `\\move` paths.
- Visual parity is approximate: CSS, Canvas and ASS use different font engines, layout, wrapping and antialiasing. The scaling factor and composition center are shared; character shapes and line breaks are not guaranteed identical.

## Integrity and compatibility

- Scale input is a bounded allowlisted integer in increments of five; missing legacy fields default to 100%, while null/strings/out-of-range/fractional values are rejected on save/import.
- Dragging, slider updates, keyboard nudging and safe-area toggles never create project receipts or modify saved drafts. Only the existing Add/Save action commits.
- The corrected Add/Save handler explicitly passes optional staged **`title_x` and `title_y`**, fixing the prior R8.4 issue. Reset-to-Anchor now also removes old custom coordinates from the live staged Program preview.
- Safe guides are a local, unsaved UI toggle; they are never sent to Canvas, ASS, exported projects, telemetry or media paths.
- R8.0–R8.4 title motions, timing, colors, old drafts and export diagnostics remain compatible.
- No new third-party dependencies, remote fonts, network calls, AI services or uploads.

## Verification

Run `pnpm typecheck && pnpm smoke:studio`. New `scripts/studio-r85-smoke.mjs` tests scale limits and resize math, safety guides, the X/Y Save regression, draft import protection, receipt count, Undo/Redo, legacy ASS byte parity, custom ASS font size, anchored/moving titles, and UI wiring. Earlier smoke suites remain in the full chain.

Manual test: select a title, arm Place, drag it to X=427/Y=298, resize it to 125% using the handle, and turn on guides. Save; reopen the title and verify its position/scale survived. Export from browser and local FFmpeg, checking text size and movement. Undo must restore the previous state; Reset to Anchor followed by Save must remove custom coordinates. The guides and resize handle must **not** appear in either export.

**Green CI means source tests passed, not that pixel-perfect video export was measured on your machine.**
