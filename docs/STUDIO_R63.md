# ParaCut Studio R6.3 — Synchronized Ripple Delete & Precision Shortcuts

R6.3 extends the existing **V1-only Delete** operation with a separate, clearly labeled **Sync Ripple** command. Its purpose is to close a V1 gap **and** shift later, independently timed layers that belong after the cut, without silently discarding other media.

## What's different from ordinary Delete?

**Delete (Delete / Backspace)** still removes the selected clip only. On the sequential V1 track, the core already reflows later V1 clips to close the gap. It does not shift independent V2, A2, or T1 entries.

**Sync Ripple (Shift+Delete / Shift+Backspace)** is available only when a V1 clip is selected and the removal is safe. It:

1. Removes exactly that V1 clip.
2. Reflows the remaining V1 clips, closing the gap.
3. Moves any V2 overlay, A2 voiceover/FX clip, or T1 title whose start is **at or after** the removed clip's original end earlier by the exact removed duration.
4. Keeps source IN/OUT, source IDs, colors, source-volume automation, overlay motion and V2-to-V2 dissolve lengths unchanged.
5. Leaves the **A1 music/soundtrack lane** on its independent sequential clock. It does not modify A1 clips or insert silence. This is **not** global sync lock.
6. Creates one `clip.ripple.deleted` edit receipt with cut start/end, removed seconds, and counts of shifted V2, A2, and title events. Undo/Redo restores the entire transaction.

The editor shows an explicit confirmation describing how many layers will shift before committing.

### Safety boundaries

The sync command refuses the operation rather than silently editing material when:

- A moving V1 crossfade touches the V1 clip being deleted. Remove that dissolve first, or use an ordinary delete with care.
- Any V2 clip, A2 clip, or T1 title overlaps the removed V1 interval, including clips that start inside it or bridge across either boundary. Move, trim, or delete those elements deliberately first.
- The resulting repositioned overlays would violate lane timing or overlap constraints. The entire operation is validated atomically, and an invalid edit produces no new receipt or partial state change.

V2 paired crossfades entirely **after** the removed interval move together and preserve their overlap. Media sources are never edited; only timeline positions change. Save/reopen drafts still use `paracut.studio.draft.v3`; the browser and local FFmpeg exporters read the resulting validated timeline without additional changes.

## Keyboard editing

| Shortcut | Effect |
|---|---|
| Delete / Backspace | Existing selected-clip Delete |
| **Shift+Delete / Shift+Backspace** | New confirmed synchronized V1 Ripple Delete |
| **, (comma)** | Jog Program one 1/30-second frame backward |
| **. (period)** | Jog Program one 1/30-second frame forward |
| J | Same backward frame jog |
| K | Stop |
| L | Forward playback, toggle 1×/2× |
| V / C | Selection / targeted Razor |
| S | Split selected clip at playhead |
| I / O | Mark IN/OUT in Source Monitor |
| Ctrl/⌘ Z / Y | Undo / Redo |

These shortcuts do not activate while typing in an input, textarea, or select, or during export. A collapsible **⌨ Shortcuts** reference is available in the timeline itself. Frame stepping snaps to the 30-fps timeline clock; this is not source-frame-accurate for every possible input frame rate, nor does J provide reverse audio shuttle.

## Example

Given three V1 clips spanning 0–3, 3–6, 6–9 seconds, plus a V2 overlay and voiceover that both begin after 6 seconds, deleting the middle clip with Sync Ripple produces V1 of 0–3 and 3–6 seconds. The overlay, voiceover, and later titles move earlier by three seconds. A1 music stays at its original time. If an overlay ran through the 3–6-second segment, the operation is refused, rather than chopping or colliding with that overlay.

## Test coverage

```sh
pnpm smoke:studio
pnpm typecheck
```

`scripts/studio-r63-smoke.mjs` checks three-second synchronized moves, intact V2 transition pairs, retained A1, unchanged ordinary Delete, crossfade/overlap safety, receipt details, Undo/Redo, draft compatibility, UI shortcuts and help.

**Manual acceptance:** Build a 9-second V1 cut with overlays and titles after the middle 3 seconds. Use Shift+Delete, confirm the affected counts, inspect that all relevant events move three seconds, and Undo/Redo. Test an overlay crossing the deleted region to confirm failure is safe. Export a short movie on your chosen browser or local FFmpeg installation and verify audio sync visually and by ear. Some projects will need deliberate A1 soundtrack edits after sync deletion because A1 is intentionally unaffected.

Future work: explicit global sync locks, multi-track Q/W ripple trims, precise source-frame stepping and richer overwrite track patching.
