# ParaCut Studio R5.8 — Source Monitor & Three-Point V1 Editing

R5.8 starts the Premiere-style *workflow* upgrade without sacrificing the local-first timeline, receipts, or existing V1/V2/A1/A2/T1 editing and rendering.

## Two monitors

- **Source Monitor** shows the original video selected from Project Media. Its play/seek controls are independent of the Program Monitor. Import or relink the source file, then select **Source** beside it in Project Media.
- **Program Monitor** continues to display the edited multi-track movie. The Program playhead selects where a Source edit will land.
- When Source playback starts, Program playback pauses, and vice versa. Both are backed by local `blob:` URLs only, not cloud processing.

## Project Media improvements

Search by filename and sort by **import order, filename, shortest duration, or video/audio type**. Each linked video gets a **Source** button beside the existing append and V2/A2 controls. Unlinked originals visibly remain unavailable until relinked. Filters and sort are view-only and do not reorder or mutate saved assets.

## Source IN/OUT + Insert at Playhead

1. Select a linked original video from Project Media and click **Source**.
2. Play or scrub the original to a desired source moment. Mark **IN** and **OUT**, or type exact seconds. The interval must be at least 0.08 seconds and stay within the source duration.
3. In the Program Monitor, set the desired V1 playhead position.
4. Click **Insert at Playhead**. If the playhead falls in the middle of V1 footage, that clip is split into original-source-contiguous left and right halves, and the selected source range is inserted between them. Everything later on V1 ripples forward. If the playhead is at a cut or the end of V1, the new clip is inserted there. Insert at 0 is supported.
5. One validated `clip.source.inserted` edit is recorded with source asset ID, source IN/OUT, Program insertion time, and undo/redo history.

To protect existing V1 transitions, inserting inside an active crossfade is rejected. An insertion too close to an adjacent dissolve is also rejected instead of silently changing that dissolve. You can move the Program playhead to an ordinary hard cut or a safe interior position.

## Replace Selected V1

Select one V1 timeline clip and click **Replace Selected V1** with a Source interval ready. It swaps the selected clip's asset and source range while preserving the selected clip ID. Downstream V1 footage ripples if the duration changes; any affected incoming/outgoing V1 crossfade is explicitly cleared. Receipt, Undo/Redo, and source validation remain active.

**Important terminology:** This is *selected-clip replacement*, not Premiere's full range-overwrite feature that can replace pieces of multiple clips and preserve total timeline length. The button deliberately says what it does. Four-point editing, track targeting, match-frame and full overwrite can be built next.

## Shortcuts and boundaries

When focus is not in a text input:
- `I`: set Source IN (when a source is selected)
- `O`: set Source OUT
- Space: Program play/pause (unchanged)
- Undo/Redo and the existing Split/Delete keys remain unchanged.

Source selection/marks, Project search and sorting are ephemeral editor controls, not changes to the project draft. Only **Insert** or **Replace** writes a receipt. The saved draft stays `paracut.studio.draft.v3`, compatible with all prior projects and both browser and local FFmpeg exporters.

## Acceptance

1. Import two original videos. Open one in Source and mark 1.0s to 3.0s.
2. Add a 5s V1 clip and place Program playhead at 2s. Insert the marked range. Verify V1 becomes first 2s, inserted 2s, remaining 3s.
3. Preview the cut, Undo/Redo, save and reopen the draft, and verify the local MP4 exporter can still plan the four-lane project.
4. Test insertion at 0, an existing cut, and near an active crossfade. Unsafe inserts should fail without changing the project.
5. Select a V1 clip and **Replace Selected V1**; confirm later clips ripple if needed and a receipt appears.
6. Search/sort Project Media and try opening an unlinked video (should prompt relink).

`scripts/studio-r58-smoke.mjs` checks the core timing, validations, receipts, backward-compatible drafts and UI bindings. CI tests do not substitute for hands-on dual-monitor/browser interaction testing.
