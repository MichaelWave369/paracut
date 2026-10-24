# ParaCut Studio R8.7 — Multi-Title Studio

R8.7 builds on R8.0–R8.6's Creative Title Deck with **atomic, selective styling for several T1 titles at once**. Batch edits reuse the existing saved title fields and all existing renderers. A batch applies as **one undoable editor action and one human provenance receipt**; it never loops over multiple individual `title.updated` commands.

## Workflow

1. In **Titles & Overlays**, tick the checkboxes beside two or more T1 titles, or click **Select All T1**. You can clear the selection at any time.
2. Configure the **source settings** in the ordinary title editor. R8.6's nine alignment points, six layouts, copy/paste transform, custom X/Y dragging, and scaling controls can supply the position and scale. The existing color selector and Text Size selector supply appearance.
3. Choose a **Batch changes** mode:
   - **Position + scale only**: copies the editor's exact custom X/Y or anchor reset, plus title scale. Each target retains its original color and font-size category.
   - **Color + font size only**: copies the editor's color and three-way Small/Medium/Large font-size category. Each target retains its individual position and scale.
   - **Position, scale, color + font size**: copies both groups.
4. Review the live **batch preview**: selection count, affected fields, and the first three target names. This is a **read-only data preview**, not multi-title compositing or a rendered video preview.
5. Click **Apply to Selected Titles**. One atomic `title.batch.styled` action validates every candidate and updates the selected titles together.
6. **Undo** reverts the whole batch at once, and **Redo** reapplies it. Selections are local UI state, so you can keep selecting and applying separate looks.

The batch panel is unavailable during export and the Apply button is disabled until at least two real titles are selected. Deleted titles and loaded-project changes are reconciled against the current T1 list; stale selections cannot be applied.

## Field integrity

A batch **never changes** the title's text, T1 ID, start/end time, Top/Center/Bottom fallback anchor, entrance/exit fades, R8.2/R8.3 motion curves, motion distance, audio, video or timeline layers. Only the fields explicitly named by the chosen mode are changed.

- **Transform fields:** optional `title_x`, `title_y` (always an X/Y pair) and `title_scale` (50–200%, 5% increments). Copying an anchor-only transform deliberately removes custom XY from selected targets, restoring each target's own old Top/Center/Bottom fallback.
- **Appearance fields:** `color` from White/Mint/Gold and `size` from Small/Medium/Large.

All existing field validation is reused, with strict allowlisted batch modes and selection IDs. The action rejects duplicate IDs, unknown IDs, fewer than two titles, invalid scale/coordinates and unsupported colors/sizes. It evaluates the **entire candidate list before committing**, with no partial updates. No arbitrary CSS/ASS/FFmpeg snippets enter the project.

A successful batch creates exactly one `title.batch.styled` provenance receipt describing **`title_ids`**, **`title_count`**, **`mode`**, and the exact allowed fields touched. The current undo stack receives one checkpoint regardless of the number of titles selected.

## Output and compatibility

There are **no new saved draft fields or schema changes**. Normal title properties go to the existing Program Monitor, browser Canvas MP4/WebM renderer and local FFmpeg ASS subtitle events. Old titles not selected for a batch are byte-for-byte unchanged, and a draft without any R8.7 batch operation retains its previous output.

The title checkbox selection and active editing mode are **not stored** in project drafts, uploaded, or retained as background data. They never generate receipts. The batch planner is a pure local JavaScript module with no external dependencies.

## Verification

Run `pnpm typecheck && pnpm smoke:studio`, including `scripts/studio-r87-smoke.mjs`. Its checks cover strict selection bounds, unknown/duplicate targets, transform-only/appearance-only/both semantics, target text/timing/fade/motion invariants, anchor-only reset behavior, atomic failure, one receipt/undo checkpoint, Undo/Redo, draft roundtrip, export ASS position and font-size correctness, and accessible UI wiring. All previous R7.x and R8.0–R8.6 smoke suites remain registered.

**Manual acceptance:** Create three titles at different times with different text and motion. Select the first two, stage Hero Center with Gold / Large, then apply **Both**. Confirm the first two are aligned and resized while the third remains untouched and all three retain their text, timing and movement. Undo once, then Redo. Next apply **Appearance only** and verify original positions remain. Test Select All/Clear, a stale selection after deleting a title, and browser/local MP4 output. CI tests structural and mathematical behavior; it does not prove visual, encoded frame parity.
