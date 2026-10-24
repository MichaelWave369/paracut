# ParaCut Studio R8.0 — Creative Title Deck

R8.0 starts a new creative-editing milestone after the R7.x export performance/diagnostics work: a **one-click title look library**, **scrub-able read-only title audition**, and **playhead-aware timing** integrated with the existing T1 title editor.

The goal is to help editors make good-looking titles quickly without introducing incompatible effects, extra draft fields or untested export behavior.

## Where to find it

Open ParaCut Studio and switch to the **Titles** workspace (or scroll to **Titles & Overlays**). The Creative Title Deck appears above the normal text field.

Select one of six built-in looks:

| Look | Position | Size | Color | Animation |
| --- | --- | --- | --- | --- |
| Cinema | Center | Large | White | Gentle opening/closing fade |
| Lower Third | Bottom | Small | Phi Mint | Quick fade in, longer fade out |
| Chapter | Top | Large | Gold | Short bookend fades |
| Quote | Center | Medium | Gold | Balanced gentle fades |
| Caption | Bottom | Medium | White | No fades, immediate text |
| End Card | Center | Large | Phi Mint | Long entrance and exit fades |

Each recipe uses only existing validated title fields: `position`, `size`, `color`, `fade_in` and `fade_out`. Fade durations are derived from the title's currently entered start/end interval and rounded to milliseconds. **The deck never stores a recipe ID in project data.**

## Creative workflow

1. Type title text. A blank editor auditions the harmless placeholder **Your title**, which is never inserted into the project automatically.
2. Set the start and end time, or click **Start at Playhead** to fill these fields relative to the current Program playhead. This does not seek or change any clips. If the timing would extend past V1, End is clamped to the cut. If you are too close to the end for 0.1 seconds of title, the action fails without modifying the form.
3. Click a title look. Its position, size, color and duration-scaled fade settings populate the ordinary title controls. The text and timing remain yours. Manual changes to the controls are always allowed.
4. Move **Audition fade** from 0% to 100%. The miniature stage displays the title using the same `titleOpacityAt` calculation as the Program Monitor. The 100% endpoint samples just inside the title's exclusive end boundary, so the final fade can be inspected.
5. Only click **+ Add Text Overlay** (or **Save Title Changes** when editing a selected title) once you are satisfied. This uses the existing `title.added` / `title.updated` commands, with one normal, undoable human receipt.

**Audition is read-only:** selecting looks, scrubbing, changing pending controls and staging playhead timing do not create receipts or change saved projects. The miniature stage is not the actual Program Monitor; it presents an isolated approximation of text position, size, color and opacity. Final appearance in the footage still depends on the video underneath and should be reviewed in Program.

## Safety, editability and exports

- Uses `textContent` to present text safely. No title input can be interpreted as HTML in the audition stage.
- Built-in recipe identifiers are fixed and allowlisted. Sizes, positions and colors use the existing `TITLE_SIZE`, `TITLE_POSITION`, and `TITLE_COLOR` enums.
- Invalid duration, fade combination or style produces a readable audition warning rather than mutating the project or attempting a malformed export.
- Recipe buttons expose `aria-pressed`, audition position has a labeled range slider and live status, and keyboard users can operate the controls.
- After Save, titles use the **same** normal browser preview, canvas WebM/MP4 paths and local FFmpeg ASS export logic as before. We did not claim a new font system, glow effect, cinematic animation engine or renderer parity change.
- Older drafts remain compatible and import with existing title-style defaults. Title undo/redo, receipts and all other tracks are unaffected.
- No external CSS/images, remote services, AI calls, user tracking, persistent presets, uploads or paid models are involved.

## Verification

Run `pnpm typecheck && pnpm smoke:studio`. The new `scripts/studio-r80-smoke.mjs` verifies six recipes, validated style fields and fade budgets, safe audition time samples, hostile text as literal content, boundary-safe playhead placement, real `title.added`/`title.updated` commands, receipt count/Undo/Redo/draft roundtrip, and the normal local title export graph. Previous R7.0–R7.9 tests remain in the chain.

**Manual acceptance:** Open the Studio, type a title, pick each look, audition its fade, then Save. Confirm it appears on T1 and Program at the expected timing, Undo removes it, Redo restores it, and an exported movie shows the existing title treatment. Confirm clicking looks or scrubbing with an unsaved draft never adds a title to T1.

This milestone returns ParaCut to creative workflow development without discarding the R7.x export evidence and integrity work.
