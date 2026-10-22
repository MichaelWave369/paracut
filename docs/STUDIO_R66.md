# ParaCut Studio R6.6 — Organized Effects Controls

R6.6 turns the busy Inspector into a collapsible, keyboard-accessible **Effects Controls** workspace without changing the editing engine, source material, color grading math or either export path.

## Inspector sections

Select a clip and open its relevant sections:

| Section | Contents | Available on |
|---|---|---|
| **Timing** | Source IN/OUT, trim waveform, Apply Trim, clip reorder and layer start, V1/V2 transitions | All media clips (controls depend on lane) |
| **Motion** | V2 PiP/full-frame placement, entrance/exit motion and visual fade durations | V2 video |
| **Opacity** | V2 transparency | V2 video |
| **Color** | Brightness, contrast, saturation, warmth, four looks and Reset | V1 / V2 video |
| **Audio** | Clip volume and fades; original-video sound mute | All media clips; mute only on video |
| **Copy / Paste** | Stored in-session Color and V2 Style attributes | V1 / V2 video; V2 Style only on overlays |
| **Clip Information** | Track ID, timing and original source metadata | All media clips |

A section header displays contextual information, such as the clip's color status, source length, V2 motion and opacity, and volume. Sections are hidden when irrelevant, avoiding decorative controls that can't operate on the selected clip.

### Important Motion / Opacity behavior

The existing **Apply Overlay Style** button stays below the Motion and Opacity sections because layout, motion, fade duration and opacity still belong to one validated `clip.overlay.updated` transaction. Changing either section's controls does not save an edit until you click **Apply Overlay Style**, which creates one ledger receipt and supports normal Undo/Redo.

Color continues using the existing **Apply Color** button and named looks. Audio uses **Apply Audio Settings**. Timing uses its original source trim, transition and movement commands. This release is an *organization* upgrade: it does **not** add a new effect engine, keyframe automation, per-property receipts, arbitrary drag-to-dock or new render filters.

## Working with the layout

- Click or keyboard-activate a native disclosure heading to expand/collapse that section.
- Use **Expand all** and **Collapse all** to change all sections at once.
- The selected clip's relevant sections appear; unsupported ones disappear. Hidden controls are not deleted and their existing commands remain intact.
- Opening the **Color workspace** automatically reveals Color controls for the selected video, even if Color was collapsed before.
- Each section's open/closed state is remembered under `paracut.studio.effects.v1` in local browser storage. The seven values are whitelisted booleans, with safe defaults. Invalid or inaccessible local storage falls back without stopping the editor.

The open/closed settings are **not** included in `paracut.studio.draft.v3`, the edit ledger, Undo/Redo or exported media. Different editors can open the same cut with independent screen preferences.

## Manual acceptance

1. Open a V1 clip: Timing, Color, Audio, Copy/Paste and Clip Information should be available, while V2 Motion/Opacity should be absent.
2. Open a V2 clip: all seven sections should be available. Change opacity and motion in their separate sections, then click the **shared Apply Overlay Style** button. Verify one receipt and that the V2 visual change remains undoable.
3. Open an A1/A2 clip: Timing, Audio and Clip Information should remain; Color/Motion/Opacity/Copy/Paste should disappear.
4. Collapse Color, switch to the Color workspace and verify the grading controls reopen. Reload the page and check that other section open/closed preferences persist.
5. Use keyboard Tab/Enter/Space on disclosure headers and Expand/Collapse buttons. Confirm controls remain reachable when expanded.
6. Perform an original-source trim, copy/paste color, apply Phi Mint, create a crossfade, and save/reopen a draft. Check original receipts, undo history, browser WebM, and local FFmpeg MP4 output.

## Verification

```sh
pnpm typecheck
pnpm smoke:studio
```

`scripts/studio-r66-effects-smoke.mjs` validates seven fixed section IDs, local preference bounds and fallback, correct applicability for V1/V2/A1/A2, contextual summaries, intact control IDs, Color workspace focus, draft/ledger independence and unchanged MP4 filter planning. GitHub CI cannot prove physical browser accessibility and CSS layout on your own screen, so the hands-on check is still part of acceptance.

**Next:** once the layout is stable, build actual opacity and volume keyframes in a separate audited milestone.
