# ParaCut Studio R8.3 — Motion Curve Studio

R8.3 extends the saved title movement introduced in R8.2 with **four motion easing choices**, **five safe travel distances**, and a **read-only movement graph** in the Creative Title Deck. The same bounded movement math drives Program Monitor, browser Canvas MP4/WebM and local FFmpeg ASS rendering.

## Creative controls

From the **Titles & Overlays** panel, set an existing animated title's Title motion to Float Up, Slide Left or Slide Right, then select:

| Motion curve | Progress |
| --- | --- |
| Linear | Straight, constant-speed progress, exactly R8.2 behavior |
| Ease In | Slow start, accelerate to end |
| Ease Out | Fast start, settle gently |
| Smooth (In/Out) | Slow start and finish with a faster middle |

Travel distance can be **50%, 75%, 100%, 125%, or 150%** of R8.2's fixed displacement (96 px vertically or 200 px horizontally at 100%). The motion direction stays allowlisted, the endpoint remains the title's original position, and all animation remains tied to its *existing fade-in and fade-out durations*. If no motion is selected or a fade is under 30 ms, the corresponding spatial animation is absent, while opacity fades continue.

The movement graph is a pure SVG path rebuilt from **the same easing function used by rendering**. It only auditions motion timing. As in R8.0–R8.2, changing controls never edits the project or creates a receipt until **Add Text Overlay / Save Title Changes** is pressed. Undo/Redo, title timing and all existing controls remain available.

## Shared rendering strategy

The browser Program Monitor scales the bounded 1280×720 displacement to its displayed dimensions. The browser canvas exporter translates its title drawing context by the same displacement. The Title Deck audition uses the same motion evaluation with its scrub time.

ASS subtitles do not natively animate non-linear `\\move` curves. For a non-Linear motion, the local FFmpeg plan now splits entrance and exit into **at most eight nonoverlapping, centisecond-aligned segments each**, minimum four centiseconds per segment. Each piece uses the sampled motion positions for a native ASS `\\move` and interpolates transparency with `\\alpha` plus `\\t`, avoiding a visible opacity reset at each segment boundary. The stationary hold retains its normal title event.

**This is a bounded piecewise-linear approximation**, not pixel-for-pixel equality. Different text engines, frame rates, font rendering and ASS's centisecond time precision can affect the final appearance. Very short motion phases retain the R8.2 linear event instead of emitting tiny invalid subtitle slices. Long-lived titles have a bounded filter/event count, not unbounded samples per frame.

## Old project behavior

Two optional, strictly validated title fields are introduced:

- `motion_ease`: `linear`, `ease-in`, `ease-out` or `smooth`, defaulting to `linear` if **absent**.
- `motion_distance`: one of the five approved whole-number percentages, defaulting to `100` if **absent**.

An explicitly supplied unknown, malformed or null value is rejected on save/import. No arbitrary CSS, JavaScript or FFmpeg expression is accepted. The existing `paracut.studio.draft.v3` structure remains compatible, and imported R8.2 titles without these fields still use **exactly the previous linear ASS event structure**. Titles without motion remain unchanged, including their native `\\fad` output.

All input and output are local; there are no external assets, telemetry hooks or model requests. The new UI only passes allowlisted numbers and identifiers to a pure motion helper.

## Verification

Run `pnpm typecheck && pnpm smoke:studio`, including the new `scripts/studio-r83-smoke.mjs`. It checks pure easing monotonicity/endpoints, supported distance limits, old R8.2 ASS byte parity, new segmented ASS motion plus continuous alpha, bounded phases, malformed draft rejection, title ledger receipts, Undo/Redo and browser UI wiring.

For visual acceptance: choose a four-second title with one-second entrance and exit fades, set Slide Left and Smooth at 125% distance, and scrub its entrance and exit in the Title Deck. Save, play in Program, then export with browser and local FFmpeg and compare the motion direction, timing and fading. Finally open an R8.2 project and verify its exported titles remain visually unchanged.

**GitHub source/plan tests are not a substitute for a real encoded-output comparison on the target computer.**
