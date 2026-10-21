# ParaCut Studio R5.2 — A1/A2 Track Mixer & V2 Motion

R5.2 adds audio-bus controls and visual entrance/exit motion to the existing five-track local-first browser editor. V1 sequencing and crossfades, V2 overlays, A1/A2 audio clips, T1 title styling, snapping, undo/redo, and the browser recording path remain.

## Track Mixer

In the Inspector, scroll to **Track Mixer**:

- **A1 Soundtrack**: level 0–100%, Mute, Solo.
- **A2 Voice / FX**: independent level 0–100%, Mute, Solo.
- **Duck A1 when A2 plays**: when checked, A1 drops smoothly to **40% of its configured track gain** within 0.2s after A2 starts, then returns within 0.35s after A2 finishes. It requires A2 not to be muted, and disables the duck automatically while A1 is soloed. Two nearby A2 clips keep the maximum active duck envelope.

These track controls multiply each clip's existing gain and fade automation. They do **not** destructively change the media or clip volume settings. If any A1/A2 Solo is enabled, all unsoloed audio, including built-in source audio from V1/V2, is silenced. Unmute an individual V1/V2 source separately if you need its sound when no solo is active.

Every mixer change is an ordinary reversible edit, with receipts, Undo/Redo and browser draft persistence. Browser drafts remain **paracut.studio.draft.v3** using optional `audioMix`, so existing R1–R5.1 projects import at 100% levels with no solo/mute/duck.

## V2 entrance and exit motion

Select a V2 overlay and set its **Entrance/Exit Motion**:

- **Dissolve only**: original motionless visual fade.
- **Slide from left**: the overlay slides in from its left side and returns toward that side at fade-out.
- **Rise upward**: the overlay rises into place and moves downward as it fades away.

Use the existing **Fade in** and **Fade out** seconds to control animation duration. If both are zero, the overlay is stationary; the motion preset alone doesn't invent a duration. Visual opacity and source-audio controls remain independent. Both PiP and full-frame modes are supported. The preview uses a CSS transform derived from the same normalized `overlayMotionAt` curve as the canvas export. The compositor also fixes accidental double application of opacity to full-frame overlays.

## Boundaries

The R5.2 mixer and visual motion are wired into **live preview** and browser **WebM / native MP4 (if supported)**. Browser output remains real-time beta and may have playback/encoder drift; test actual exported media before publishing. These effects are not a full keyframe editor, equal-power audio crossfade, audio compression/limiting, pan automation, or a V2-to-V2 overlap transition. Presets use fixed geometries rather than arbitrary user-provided CSS.

The optional R4.1/R4.2 Windows **local FFmpeg companion cannot render the new bus mixer** and already cannot render V2/A2. It explicitly rejects projects containing nondefault bus mixer effects instead of silently changing audio. Use browser export for layered/mixed projects until a later local graph supports them.

No cloud upload, network media processing, new external services or installation required for the browser features. The existing native TypeScript project-core and Interop Room are unchanged.

## Verification

```sh
pnpm smoke:studio
pnpm typecheck
pnpm smoke
```

The added `studio-r52-smoke.mjs` covers mixer math, solo isolation, ducking envelopes, invalid state rejection, undo/redo, older drafts, V2 animation math, and browser rendering/mixer wiring. A successful CI run does not prove A/V quality on a specific device.

Suggested manual run: V1 video muted, A1 music playing, A2 voiceover beginning at 3s, track ducking on, and a 1s PiP slide. Play and export a 10–15s WebM, then listen/watch around the A2 start/end and overlay animation.
