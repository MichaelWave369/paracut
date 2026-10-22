# ParaCut Studio R5.5 — V2-to-V2 moving video dissolves

> **Current update (R5.6):** The local FFmpeg companion now supports V2/A2 layered rendering, V2 dissolves, track mixing, ducking and titles. The older limitation descriptions below document their original release scope. See [Studio R5.6](STUDIO_R56.md) for current requirements, fidelity limits and testing.


The second video track now supports **real two-source crossfades** between two touching V2 overlays. Both original videos advance during the overlap in the browser preview and browser WebM / supported native MP4 export.

## Create a V2 dissolve

1. Add V1 main footage as usual. Choose two short video sources and use **+V2** to place them on the overlay storyboard at adjacent times. For example, place a 3-second overlay at 1s and a second 3-second overlay at 4s.
2. Select the **outgoing V2 clip**, not the incoming one.
3. Under the V2 overlay Inspector, find **Dissolve to next V2 overlay**. Set a duration between 0 and its displayed maximum. For two three-second clips the maximum is 1 second.
4. Select **Apply V2 Dissolve**. The incoming clip moves back into an **explicitly validated overlap**. For the example above, a 0.8-second dissolve shifts the second V2 clip's start to 3.2s.
5. Preview and browser-export a short clip. Both V2 video sources animate during their shared interval, with their individual opacity, PiP/full-screen layout, source-mute and audio gain settings respected. T1 titles remain above the overlays.
6. Set the transition to **0 seconds** to restore the hard cut. The incoming clip moves back to its original touching start time, with its source IN/OUT unchanged.

## Important safety and editing limits

- This first release requires **touching, sequential V2 overlays**. It does not add an arbitrary timeline gap filler or overlap clips just because they happen to be nearby. V1 crossfades are independent; A1/A2 soundtrack timing and ducking are unaffected.
- Dissolves are attached to the outgoing V2 clip as optional `transition_out_seconds`, the same additive concept already used on V1. Maximum is **1.5 seconds** or one third of either V2 clip's source duration, whichever is smaller.
- **No chained V2 dissolves yet.** A clip cannot simultaneously be in the incoming half of one V2 dissolve and the outgoing half of another. The editor rejects triple-source overlaps. Unrelated V2 overlaps without an explicit transition remain invalid.
- **Remove a dissolve before moving, splitting, trimming or deleting either joined V2 clip.** The editor rejects those edits instead of corrupting the paired timeline. You can still edit the overlay style or original audio mix and undo/redo the transition normally.
- Source audio on V2 is still **muted by default** when clips are first added. If explicitly unmuted, each V2 source audio signal is gain-weighted during the dissolve. This is a **linear crossfade**, not an equal-power or loudness-normalized blend.
- Existing PiP and full-frame overlays are retained. During a transition, both are drawn with each clip's own layout/style and crossfade alpha. When different layouts are used the effect is a composited dissolve, **not a geometric morph** between layouts.
- The movie length remains determined by V1. A V2 overlay extending beyond the V1 master cut is preserved in the draft but only its portion within the movie is exported.

## Export and compatibility

- The live browser preview uses two independent V2 video elements during overlap. Export uses two separate video decoders and Web Audio gain nodes for moving incoming/outgoing media, alongside the V1 crossfade, A1/A2 mixer, voice ducking and animated T1 titles.
- Browser WebM and native-MP4-where-supported output remain **real-time beta** with foreground-tab requirement, 1280×720 and a five-minute project length limit. Check actual exported motion, audio levels and timing before publishing.
- The browser project stays at `paracut.studio.draft.v3`. Optional V2 transition fields add no new schema requirement; old R1–R5.4 drafts import with hard cuts and are validated against the old rules.
- **The separately launched local Windows FFmpeg companion still rejects V2/A2 projects** rather than silently omitting transitions, picture-in-picture or sound tracks. This PR does not yet teach the local FFmpeg graph how to composite layered media.

## Verification

```sh
pnpm smoke:studio
pnpm smoke
pnpm typecheck
```

`studio-r55-smoke.mjs` verifies explicit-join state, validated overlaps, transition progression, maximum durations, no triple overlays, removal to a hard cut, Undo/Redo, old drafts, and dual video/video-audio paths in browser preview/export.

CI does **not** replace a real browser acceptance test. Test a 10–15 second edit with two V2 overlays dissolving, V1 music and/or A2 voice, and at least one T1 title. Watch the downloaded WebM or MP4 to verify that both incoming/outgoing scenes are moving while the dissolve happens.
