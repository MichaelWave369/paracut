# ParaCut Studio R8.1 — Creative Title Timing Lab

R8.1 extends the R8.0 Creative Title Deck with an editable **entrance / hold / exit** timing experience. All operations stage values in the familiar T1 form and use the existing title fade-in and fade-out model. Nothing alters the browser or FFmpeg title renderer, saved draft schema, export codecs, or ledger behavior.

## Animation rhythms

Five rhythm buttons set **the proportions of the title's duration** occupied by fade-in and fade-out:

| Rhythm | In | Out | Creative use |
| --- | ---: | ---: | --- |
| Hard Cut | 0% | 0% | Immediate captions and punchy moments |
| Punch In | 6% | 12% | Tight introductions |
| Smooth Flow | 20% | 20% | General-purpose cinematic pacing |
| Slow Reveal | 42% | 12% | Dramatic entrances |
| Lingering Exit | 10% | 42% | Reflective conclusions |

For a three-second title, Smooth Flow gives **0.60s in, 1.80s hold, 0.60s out**. These are existing linear opacity fades. No unimplemented movement, font animation, easing curve, or extra export filter is implied.

## Flexible timing and fade handles

**Duration buttons** offer 1.5, 3 or 5 seconds, anchored to the current title Start field. They stop at the end of the V1 cut, and require at least 0.1 seconds of title duration. The entered fade proportions are preserved when title length changes, rather than the incoming/outgoing fades becoming accidentally too long.

**Entrance and Exit sliders** let you adjust how much of the title duration each fade consumes (0–100% of the available budget). One fade can never push the total fade duration beyond the title. Both sliders keep the corresponding existing `Fade in (sec)` and `Fade out (sec)` fields synchronized. You can also edit these numeric fields directly.

The **In → Hold → Out** strip updates in real time. The status summarizes the exact duration of each section, and five buttons (0%, 25%, 50%, 75%, 100%) sample the same `titleOpacityAt` helper used by Program Monitor and existing title export. The preview stage is not a new renderer and is not a claim of pixel-for-pixel video output parity.

## Ledger-safe workflow

1. Open Titles and select a saved title for editing, or begin a new title in the existing panel.
2. Choose a title look from R8.0, then select a new animation rhythm if desired.
3. Adjust Entrance and Exit, pick a title duration, and use the phase strip and audition buttons to inspect the timing.
4. Optionally use **Start at Playhead** from R8.0.
5. Press the existing **+ Add Text Overlay** / **Save Title Changes** button to commit **one ordinary `title.added` / `title.updated` edit receipt**.

Every recipe choice, duration button, fade slider move, and audition-frame selection is **pending editor state only**. They do not create titles, change saved draft data, touch source media or export, or create receipts. Cancel Edit discards the pending timing changes, and Undo/Redo works on saved titles as before.

## Safety and export compatibility

- The five animation rhythms and three duration choices are fixed allowlisted values; unexpected durations or invalid fade budgets fail closed.
- Duration and fade arithmetic is rounded to milliseconds, with conservative clipping at boundaries to avoid exceeding the allowed span.
- Titles remain `paracut.studio.draft.v3`, with existing `position`, `size`, `color`, `fade_in` and `fade_out` fields.
- The renderer remains ParaCut's existing browser title fade / Canvas title export and local ASS + FFmpeg path. No proprietary animation engine, remote fonts, telemetry, model invocation, or uploads.
- Controls use native buttons and range inputs, `aria-pressed` for selected animation rhythms and frame buttons, a labeled phase bar, live readouts, accessible focus styles, and reduced-motion compatibility.
- An invalid title form displays a preview warning and creates no project edits; the original Save action remains guarded by the core validator.

## Automated and manual acceptance

Run `pnpm typecheck && pnpm smoke:studio` to include `scripts/studio-r81-smoke.mjs`. It verifies rhythm proportions, title-length scaling and clamping, fade budget enforcement, exact phase sampling, invalid numeric values, title commit receipts, Undo/Redo, draft roundtrip, ASS export planning, UI element wiring, and all previous R8.0/R7 smoke suites.

For manual visual acceptance, open the Studio and pick Slow Reveal, then retime a title near the end of V1, adjust both fade handles, scrub the mini preview and check the phase widths. Confirm that T1 remains unchanged before Add/Save, then commit, play the Program Monitor and export a short title segment. Browser and FFmpeg output must still be reviewed on an actual encoder; GitHub smoke checks don't prove rendered-media parity.
