# ParaCut Studio R8.2 — Shared Title Motion

R8.2 expands the R8.0 Creative Title Deck and R8.1 Title Timing Lab with a **bounded, fade-linked title movement system**, integrated into the existing Program Monitor, browser canvas export, and local FFmpeg ASS subtitles. This is a real saved editing effect, not just a visual preview. No remote services, external asset dependencies, new codecs or arbitrary motion expressions.

## Four safe motion choices

Select **Title motion** in the Titles & Overlays panel. The dropdown offers:

| Mode | During fade-in | During fade-out |
| --- | --- | --- |
| Still (fade only) | No displacement | No displacement |
| Float Up | Moves upward into the normal position | Moves upward off its normal position |
| Slide Left | Moves left into position | Moves left out |
| Slide Right | Moves right into position | Moves right out |

Movement is attached to the existing **Fade in (sec)** and **Fade out (sec)** durations. After entrance, the title holds its normal position. If an edge's fade is zero, the corresponding edge has no movement. For fades shorter than **0.03 seconds**, movement is suppressed across all paths to avoid sub-centisecond or sub-frame jitter while still preserving the original opacity fade.

Displacement is bounded in the common 1280×720 composition space: 96 pixels vertically for Float Up, and 200 pixels horizontally for Slide Left and Slide Right. Values are fixed allowlisted presets, not arbitrary strings or expressions. This prevents a user project from injecting an FFmpeg filter, CSS rule or ASS escape sequence.

## Editing workflow

1. Choose a title, or begin a new one in the Creative Title Deck.
2. Set an animation rhythm in R8.1 to create meaningful fade-in and/or fade-out durations.
3. Set Title motion to Float Up, Slide Left or Slide Right.
4. Scrub the Creative Title Deck preview and Program Monitor. The mini preview and the actual Program Monitor use the same normalized movement helper (scaled to their displayed sizes).
5. Click **Save Title Changes** or **+ Add Text Overlay** to commit. Only this step changes the project and creates one normal title edit receipt.

The motion selection is editable on a saved title, and can be undone or redone normally. **Changing the dropdown or scrubbing the audition alone never creates a receipt.** Existing title recipes, rhythm controls, duration buttons, text, color and placement remain supported.

## How output paths match

The motion helper `studio-title-motion.js` evaluates each title's elapsed time using its fade-in, hold and fade-out periods. It produces a pixel displacement in a standard **1280×720** composition space.

- **Program Monitor:** Scales these displacements to the displayed monitor and applies CSS's independent translate property, preserving the title's existing vertical centering transform.
- **Browser canvas MP4/WebM:** Applies the same x/y pixel translation to the 1280×720 title drawing context.
- **Local FFmpeg/ASS:** Emits explicit subtitle events for **entrance, stationary hold, and exit**. Moving phases use ASS `\move`, stationary phases use `\pos`, and each phase's native `\fad` is confined to that phase. The event writer escapes the original user title text exactly as before, retains palette/size/position settings, and uses the existing ASS filter graph.

The browser and ASS text engines have inherently different font/layout, antialiasing and **ASS centisecond time resolution**. R8.2 targets equivalent **movement distances and timing**, not pixel-exact render equality. Very short fade boundaries and video-frame sampling may differ at the final frame; review the rendered video before sharing.

## Preservation / security

- New saved title data uses one **optional** `motion` field, allowed values `none`, `float-up`, `slide-left`, `slide-right`. The current **`paracut.studio.draft.v3` schema remains unchanged**, and legacy drafts **without** a motion field retain exactly their old ASS subtitle output.
- Unknown values (including CSS, JavaScript, ASS and FFmpeg fragments) fail validation before save/import.
- The existing `titleStyle` shape is unchanged, preserving older title presets and API callers.
- Existing title opacity fades, T1 track positions, source clips, audio, receipts, export telemetry behavior and undo/redo remain unchanged.
- All motion offsets are computed locally. The title preview uses `textContent` and never injects markup.

## Verification / manual acceptance

Run `pnpm typecheck && pnpm smoke:studio`. R8.2 adds `scripts/studio-r82-smoke.mjs` with mathematical entrance/exit/hold assertions, event-level ASS checks, legacy ASS byte-for-byte invariance, invalid-input rejection, saved title commands, receipts, Undo/Redo and old draft compatibility. All earlier R8.0/R8.1 and R7.x regressions remain in the full smoke suite.

Manually: create a 4-second title with 1-second fades, choose Float Up, and check the mini audition and Program Monitor. Save it, export short MP4/WebM and local FFmpeg MP4, and confirm it moves into position, holds still and moves out. Also test a fade of zero (still text), and import a pre-R8.2 draft to confirm its unchanged styling.

**CI checks the calculations and generated export plan, not visual pixel parity on a user's local FFmpeg install.**
