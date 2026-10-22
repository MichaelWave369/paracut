# ParaCut Studio R6.0 — Resizable Workspaces

R6.0 upgrades ParaCut's **editor workspace only**. The original V1/V2/A1/A2/T1 editing, Program and Source Monitor, ledger/receipts, Source IN/OUT, Razor, audio mixer and browser/local MP4 exports are left intact.

## Four workspace presets

Choose from the Workspace selector just below the main app toolbar:

| Preset | Default arrangement | Intended use |
|---|---|---|
| Editing | Source + Program monitors, wider Project Media | General footage assembly and source-to-V1 insertion |
| Audio | Program Monitor, taller Inspector/Track Mixer and more timeline area | Mixing A1/A2 and reviewing track gain and ducking |
| Color (layout only) | Program Monitor and wider Inspector | A monitor-centric starting layout for future color grading |
| Titles | Program Monitor, wider Inspector and Titles focus | Text overlays, title styling and timing |

**Color is a layout preset only in R6.0.** There is **no real color correction panel or video color effect** yet. That will be a separate implementation with render parity tests.

Use the **Source Monitor** checkbox independently to show/hide the Source panel inside any preset. Hiding it pauses source playback; the actual Source IN/OUT marks and media selections are kept for when you show it again.

## Resizing

On desktop:
- **Project Media divider:** drag the vertical separator immediately to its right. Range 180–440 px.
- **Inspector divider:** drag the separator immediately left of Inspector. Range 220–500 px.
- **Monitor / Timeline divider:** drag the horizontal separator between monitors and timeline. Range 230–680 px for the monitor row.
- **Accessible keyboard resizing:** focus a divider with Tab. Press arrow keys to adjust its width or height in 16-pixel steps, or Shift+arrow for 32-pixel steps.
- **Reset layout:** resets the active preset's widths, monitor height and default Source visibility.

On narrow viewports the panels stack in a sensible reading order and separators are hidden. The layout never forces oversized, inaccessible sidebars on mobile.

## Persistence and provenance

Workspace presets, divider sizes and Source visibility are written to `localStorage` under **`paracut.studio.workspace.v1`**. This is **local UI preference state**, not a project edit.

- It is *never* written to saved ParaCut project drafts, edit receipts, undo stacks, local export JSON or FFmpeg commands.
- Stored values are validated, clamped to safe ranges, and restricted to supported presets. Invalid or tampered JSON resets to Editing.
- If browser storage is denied or unavailable, the editor continues using safe defaults without failing.
- There is no user identity, cloud sync, advertising telemetry or upload.
- Each preset is an arrangement of existing panels. This does **not** implement arbitrary drag-to-dock, detachable floating panels, tab groups or a separate Color grading engine yet.

## Verification and acceptance

```sh
pnpm smoke:studio
pnpm typecheck
```

The R6.0 smoke suite checks valid/default presets, boundaries, malicious/invalid preference fallback, blocked storage, workspace UI wiring, keyboard resizing and project/receipt separation. Other smoke suites continue validating V1/V2/A1/A2/T1 render behavior.

**Hands-on browser acceptance:**
1. Open Editing, drag both side separators and the monitor/timeline divider; confirm the Program and Source monitors remain usable.
2. Switch to Audio and Titles, and confirm the selected focus and increased Inspector space; return to Editing.
3. In Color, verify it only changes layout, without claiming unavailable effects.
4. Hide Source Monitor, toggle it back on, and confirm the linked source and marks remain. Try keyboard arrow resizing.
5. Reload the editor. Your chosen workspace/measurements should persist in the same browser.
6. Load a saved draft and export a short movie; verify no new project settings or edit receipts were created just by resizing.

A successful CI run verifies state logic and static UI wiring, not every browser's actual pointer layout or responsive screenshot. Inspect on your own desktop after merge.
