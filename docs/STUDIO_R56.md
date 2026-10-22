# ParaCut Studio R5.6 — Local MP4 Rendering for All Four Media Tracks

**R5.6 gives the manually launched Windows/local FFmpeg companion a real multilayer rendering path.** Save your ParaCut browser Studio draft and keep its original media files. Launch `ParaCut Export MP4.cmd` on Windows, or run the established CLI from the repository:

```sh
node scripts/studio-export-local.mjs --draft my-cut.json --media-dir originals --out my-cut.mp4 --dry-run
node scripts/studio-export-local.mjs --draft my-cut.json --media-dir originals --out my-cut.mp4
```

Requires your own local Node.js 20+, FFmpeg and FFprobe with **libx264, AAC, xfade, overlay, fade, colorchannelmixer and ass filters**. No binaries are bundled or downloaded. The local project stays on your PC, does not upload footage, and never silently overwrites a destination file. Review licensing of your FFmpeg build separately from ParaCut's MIT license.

## Supported Studio features

- **V1**: sequential footage with adjacent moving crossfades and source-audio trim/fades/mute.
- **V2**: overlaid moving video; picture-in-picture or full-frame, opacity and visual fade-in/out. The supported motion presets **Dissolve only**, **Slide from left**, and **Rise upward** use FFmpeg's per-frame overlay positioning.
- **V2-to-V2 transitions**: explicit two-video overlaps from R5.5, composited with independent transparency and source-audio fades. Source audio remains muted by default when the V2 clip was first added.
- **A1**: sequential main music bed, source trim, clip gain/fades, track gain, mute/solo.
- **A2**: additional absolute-time voiceover/soundtrack/FX clips, trim, clip gain/fades, track gain, mute/solo.
- **Ducking**: if enabled and A2 not muted, A1 lowers toward **40%** during A2, attacks over 200 ms and recovers over 350 ms after A2. This is timeline-envelope automation, not signal-driven compression.
- **T1**: local ASS/libass timed titles, placement/color/size presets and fades. Font rendering can differ slightly from browser CSS.

The renderer uses separate inputs for repeated source clips, aligns audio in the global timeline, and mixes the clips as separate streams. It verifies the finished file's **MP4 / H.264 / AAC streams and approximate duration** with FFprobe.

## Render fidelity and limitations

- **This is the first local layered implementation.** Picture-in-picture uses a fixed **420×220** letterboxed region placed near the upper-right, and the motion geometry approximates the browser's responsive picture-in-picture preview. Font, borders and fade timing can look a little different from the browser beta. Check every important title, dissolve and audio cue in the produced movie.
- The graph uses **linear source-audio fades** and a non-normalizing audio sum. Several loud tracks can add up to distortion or clipping; there is no limiter, LUFS normalization, or guaranteed broadcast mastering.
- A1 ducking uses FFmpeg per-frame gain automation, so its envelope granularity may differ slightly from the browser's continuous Web Audio calculation.
- Maximum **five-minute movie, 32 clips per lane**. Input codecs must be supported by the installed FFmpeg, which remains an explicit prerequisite.
- Titles use ASS/libass. PiP visual geometry and motion are modeled from the current editor presets, not arbitrary user-defined keyframes or animated video masks.
- Only an actual exported video on the destination computer proves compatibility with that FFmpeg build and the source codecs.
- Old browser drafts remain compatible, and projects without V2/A2 or advanced mixing still take the original R4.1 local render path.
- The GitHub Pages website **still cannot execute FFmpeg on your PC**. This is a user-initiated CLI/Windows launcher workflow, never an automatic browser-to-desktop service.

## Source safety

The CLI reads the validated draft, then relinks **V1, A1, V2, A2** media against exact original filenames and **byte sizes**, checks codec/stream type and source duration with FFprobe, and fails on mismatches. Use `--media-map` for renamed or dispersed sources. FFmpeg is launched with `spawn(..., {shell:false})` and argv tokens, not with interpreted shell input. Outputs already present are rejected; failed new outputs are cleaned up.

## Testing

```sh
pnpm smoke:studio
pnpm typecheck
```

- `studio-r56-local-smoke.mjs`: a real R5.5 Studio draft with a V1 and V2 crossfade, PiP/full overlays, clip gain, A2 ducking, track solo/mute, titles, source relinking, undo/redo and graph assertions.
- `studio-r56-integration.mjs`: generates synthetic videos and sound, invokes the **actual local CLI with `--dry-run` first**, produces a movie, and checks H.264/AAC stream and duration. The integration only runs if this machine's FFmpeg has all required capabilities; otherwise it explicitly reports **SKIPPED**.
- Existing Studio, codec validation and Windows PowerShell parsing regressions also remain active.

### Manual acceptance

Create two V1 videos, two V2 clips joined by a dissolve, A1 music, A2 speech and a T1 title. Save a draft. Run the Windows MP4 launcher, inspect its dry-run summary, confirm export and watch/listen to the output. Check the V2 transition in motion, PiP positioning, speech ducking, and audio mute/solo settings against the browser preview. If anything differs unexpectedly, keep the original draft and report the source-codecs and exact issue for the next pass.
