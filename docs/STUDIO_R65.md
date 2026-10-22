# ParaCut Studio R6.5 — Timeline Review Markers

This release adds **color-coded timeline markers** to the existing ParaCut Studio timeline and Inspector, with a project-ledger receipt for every Add, Update and Delete. Markers are annotations for editing/review, **not video or audio content**.

## Use markers

- Move the Program playhead to a moment, then click **+ Marker at Playhead** or press **M**.
- ParaCut adds a named marker at that time. Click a colored diamond on the ruler, or an entry in the Inspector's **Timeline Markers** list, to select it and seek to its time.
- Edit the selected marker's **Label**, **Time**, **Color** (Phi Mint, Gold, Blue, Coral), and **Notes**, then press **Save Marker**. Press **Delete Marker** to remove it. **Deselect** hides the marker editor without changing the timeline.
- Jump with **Shift+M** for the next marker, or **Alt+M** for the previous marker. Buttons are also provided. Marker navigation is strictly forward/backward, and does not wrap around.
- Markers are visible on their own ruler lane. Their time positions are also used as optional snapping anchors when moving V2/A2 clips while Snap is enabled.

Markers are stored as `{ marker_id, time, label, note, color }`. Times have millisecond precision and a 0–86400 second validation range; labels can hold 1–60 nonblank characters, notes up to 280 characters, and colors are a fixed whitelist. The project is capped at 100 markers. Malformed entries, unexpected fields, duplicate IDs, and unsorted marker lists are rejected at import/validation. No HTML in labels or notes is executed; the UI uses text nodes.

## Ledger and project persistence

Every marker Add, Update, and Delete uses the existing `change(state, command)` pipeline, with one edit receipt per successful operation and ordinary **Undo/Redo** snapshots. The receipt includes a marker ID and, when applicable, time, label, color and note.

`paracut.studio.draft.v3` is retained without schema migration. Older drafts without a `markers` property load with an empty marker list. New saves include marker annotations. The original media files are still referenced externally and are never embedded or uploaded.

## Timing and editing boundaries

**R6.5 markers anchor to absolute project time**, not to clip identities or original-source frames. Existing ripple delete, trimming or replacement does **not silently retime** them. Check your notes after moving footage and manually update any marker whose creative meaning has changed.

A marker that lies beyond the current V1 movie duration is still preserved and listed. Clicking it stops the Program Monitor at the end of the movie and displays an explanatory status. Its ruler position remains visible on the extended timeline.

Markers do **not** appear as graphics in the Program Monitor, WebM recording or local MP4 export. They also do not affect audio mixing, source IN/OUT, video transitions or title overlays. Clip-attached markers that follow source media, marker export interchange, and complex shared-review workflows are future features.

## Test plan

```sh
pnpm smoke:studio
pnpm typecheck
```

`scripts/studio-r65-smoke.mjs` validates marker shape and content bounds, ordering/navigation, receipts, Undo/Redo, saved draft compatibility, tampered-data rejection, UI controls, and unchanged local MP4 rendering.

Manual acceptance: add 3–4 markers at different times, assign different colors and review notes, use Shift+M/Alt+M and the ruler pins, edit/reorder their times, Undo/Redo, save and reopen, then render a short movie and verify that the annotations do not appear in the output. Try deleting a V1 clip and confirm marker times remain absolute.
