# ParaCut Studio R8.6 — Align & Reuse

R8.6 extends the R8.4 direct title-placement workflow and R8.5 scale controls with a **nine-point title-safe alignment grid**, **six reusable position/scale recipes**, and **Copy/Paste Transform** between titles in the same Studio browser session.

All actions stage changes in the existing title form. Only **Add Text Overlay** or **Save Title Changes** creates a project edit receipt. This release does not introduce new saved title fields, schema versions, renderers, network requests, or user-configurable scripting.

## Nine-point alignment

A 3×3 grid places the **center** of the title on the inner 20%-inset title-safe guide intersections:

| | Left | Center | Right |
| --- | ---: | ---: | ---: |
| Top | (256, 144) | (640, 144) | (1024, 144) |
| Middle | (256, 360) | (640, 360) | (1024, 360) |
| Bottom | (256, 576) | (640, 576) | (1024, 576) |

Coordinates are integer pixels in the existing **1280 × 720** composition, using the established optional `title_x` / `title_y` fields. The grid uses `aria-pressed` on the active position. A custom drag, numeric position, or keyboard nudge can move the title off-grid, clearing the pressed grid indicator.

These are *title-center* safe guides, not automatic measurements of text bounding boxes. Long text and large fonts can still cross a safe-area line or the edge of the screen. Use the existing safe-area preview overlay to check appearance.

## Six reusable layout recipes

| Layout | Center | Scale | Typical use |
| --- | --- | --- | --- |
| Hero Center | (640, 360) | 150% | Opening statements |
| Lower Third | (640, 576) | 100% | Lower-screen captions |
| Chapter Heading | (640, 144) | 125% | Section titles |
| Left Label | (256, 360) | 85% | Left-side tags |
| Right Note | (1024, 360) | 85% | Side annotations |
| End Card | (640, 360) | 125% | Closing titles |

Choosing a layout sets **only the existing staged custom X/Y and title scale**, without overwriting text, duration, color, selected font-size category, opacity fades, motion curve, or audio/video material. The title resize handle and numeric inputs remain available for further adjustment. Clicking a recipe does not itself save, create a receipt, or alter project media.

## Copy/Paste Transform

1. Select **Edit** on a saved T1 title or prepare a title in the form.
2. Set a layout, drag the title, or adjust its size; click **Copy Transform**.
3. Edit another title (or prepare a new one), then click **Paste Transform**.
4. The copied placement and scale are restored to the form as a **pending edit**; the original text, timing and appearance fields of the destination title are retained.
5. Click **Save Title Changes** or **Add Text Overlay** to commit exactly one normal title edit.

Copy is a **local, session-only in-memory snapshot**, not the system clipboard, project schema, persisted settings, or a network transfer. The Paste button remains disabled until a transform is copied. An original **anchor-only** title can be copied too; pasting removes a destination title's custom XY while preserving its specified Top/Middle/Bottom anchor, and applies the copied scale. The clipboard snapshot does not alias subsequently changed pending coordinates.

The active alignment and layout buttons have appropriate `aria-pressed` states and are regular keyboard-operable buttons. The status readout describes pending X/Y and scale. Editor buttons are disabled during export.

## Validation and output parity

- The 9 alignments and 6 layouts have fixed allowlisted IDs and bounded, integer coordinates, always within the existing R8.4 placement validator.
- Copied scale goes through the R8.5 50–200% increment-of-5 validator.
- Unknown recipes, invalid positions, partial XY pairs, and invalid scales fail closed in the pure helper and the existing project validator.
- The legacy `paracut.studio.draft.v3` format remains unchanged. Titles that never receive custom X/Y or scaling retain their old saved shape and **byte-identical ASS output**.
- The Program Monitor, Title Deck preview, browser Canvas and local FFmpeg ASS export already use these exact saved fields from R8.4/R8.5, so no additional renderer or remote asset is required.
- All preview-only safe-area guides and UI controls remain absent from the final rendered video.

## Automated and visual checks

Run `pnpm typecheck && pnpm smoke:studio`. The new `scripts/studio-r86-smoke.mjs` checks all grid coordinates, recipe mappings, scale limits, local clipboard isolation, invalid-input rejection, pending edit invariants, normal title Save receipts, Undo/Redo, draft round trips, export ASS positions and scaled font sizes, legacy parity, and control wiring. The existing R7.x–R8.5 regression suites remain in the same test chain.

Manual acceptance: select a saved title, choose **Left Label**, then drag to a custom off-grid position. Copy Transform, edit another title, paste, and Save. Confirm that the new position and scale survive reopening the draft and FFmpeg/browser export, while the destination text and timing are unchanged. Repeat with an anchor-only copied transform. Verify the safe-area guide overlay is preview-only.

**Automated tests validate the code and export planning, not visual pixel equivalence on a real encoder.**
