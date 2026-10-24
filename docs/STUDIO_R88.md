# ParaCut Studio R8.8 — Title Style Library

R8.8 adds a **local-first, portable library of reusable title looks**, on top of the existing R8.0–R8.7 T1 title editor. It is intended for reusing a consistent visual identity between projects in the **same browser**, or between devices via an explicit exported JSON file. It does not introduce a remote service, a new project schema, or automatic edits.

## Saving and reusing looks

1. Prepare any title in the normal editor (or click Edit on a title) and set its alignment, custom X/Y if desired, scale, color, Small/Medium/Large font-size category, motion preset, easing curve, and travel distance.
2. Enter a name of **1–48 characters** under **R8.8 · My Title Looks**, then click **Save Current Look**. The normalized look is stored locally in the browser, not in the project.
3. Open a different ParaCut project in that browser and choose the name under **Saved looks**. Click **Preview Look** to stage its style in the title editor.
4. Review the Creative Title Deck preview and Program placement, then press **Add Text Overlay** or **Save Title Changes** to commit a title edit.
5. Use **Delete Look** if a stored style is no longer needed. Deletion requires confirmation and never changes existing titles.

A saved look records **only** these allowlisted style fields: `position` (top/middle/bottom), `size` (small/medium/large), `color` (white/mint/gold), `motion`, `motion_ease`, `motion_distance`, optional paired `title_x`+`title_y`, and optional `title_scale`. The captured form excludes all title text, title IDs, title times, fade durations, project filenames, imported media, receipts, or audio information.

Applying a look preserves the current title's **text, start/end, fade-in and fade-out**. Motion and placement settings *are* deliberately replaced by the chosen look. Saving a look changes local browser storage only. Previewing a look changes staged editor controls only, without project mutation or receipts. The standard title Add/Save action remains the only commit point; Undo/Redo and the existing human provenance receipts behave exactly as before.

The existing **R8.7 multi-title panel** can apply the newly staged layout or appearance to several selected titles in one atomic edit. The batch panel's selective modes still govern which fields are applied. A batch never copies one title's text or timing.

## Persistence, backup and import

- Storage key: `paracut.studio.title.styles.v1`, in the browser's **same-origin localStorage**. The library follows that browser profile and origin, not a user account, cloud drive, repository or individual project. Clearing site data or switching device/origin can remove access to it.
- Up to **24 named looks**, no duplicate IDs or case-insensitively duplicate names.
- **Export Library JSON** creates a validated, versioned, portable file named `paracut-title-styles-v1.json`.
- **Import Library JSON** validates the **entire** file before asking whether to replace the current library. Import is deliberately an **atomic replacement**, not a merge; export your local library first if you need a backup.
- Every imported file must match the exact `kind: "paracut-title-styles"`, `version: 1`, `styles` array structure. Imported entries contain only `id`, `name`, and `look`, and each style is normalized to the same approved values.
- A **16 KiB input/output limit** bounds storage parsing and portable exports. The browser file picker never sends the file to a server. Invalid/oversized JSON, unknown fields, unsupported values, partial XY pairs, bad names, and duplicates fail without replacing the live library.
- Browser storage write failures (private mode, quota or blocked storage) are reported; a look is not declared saved until its write succeeds.

## Export behavior and backward compatibility

There are **no new title fields in project drafts**. Saved looks apply the R8.2–R8.6 fields already understood by Program, Creative Title Deck, browser Canvas MP4/WebM and local FFmpeg ASS. Titles and projects not edited with the library stay exactly as they were. The library does **not** write itself or its names into project drafts. The schema stays `paracut.studio.draft.v3`.

Scale, position, motion, alpha and font differences across Canvas, CSS and ASS still apply. Green source/plan tests do not guarantee pixel-identical video across encoders or fonts.

## Tests

Run `pnpm typecheck && pnpm smoke:studio`. The new `scripts/studio-r88-smoke.mjs` checks the versioned format, source sanitization, allowed values, name uniqueness, 24-look cap, file size, strict import rejection, atomic replacement, cross-project use, unchanged project receipts until Save, Undo/Redo, draft imports, local MP4/ASS export planning and UI wiring. The earlier R7.x–R8.7 Studio suites remain in the command.

**Manual acceptance:** Create a title, use custom X/Y, scale 150%, Phi Mint and Smooth Slide Right. Save a named look. Open a different project without refreshing the origin, stage it on another title, inspect the preview and Save. Export library JSON, delete that look, import the same file, confirm restored settings, and verify no project title or receipt changes during library management. Reload and confirm local looks persist, test a bad JSON file, and verify browser/export restrictions remain in place.
