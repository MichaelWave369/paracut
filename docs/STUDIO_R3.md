# ParaCut Studio R3 — Creative Timeline, first pass

R3 builds on the real-world verified Studio R2 editing and export loop. It adds **per-clip audio volume and linear fade controls**, plus a **timed text overlay lane**. The original Interop Room and canonical ParaCut TypeScript project/RenderPlan contracts remain unchanged.

## Editor workflow

1. Open `studio.html` in a supported desktop browser; import video into **V1** and audio into **A1**.
2. Select a clip in either lane. In Inspector, set **Audio volume (0–100%)**, **Fade in**, and **Fade out** in seconds; click **Apply Audio Settings**.
3. On a noisy source video, **Mute original video audio** still works. A1 music remains independent. The volume control applies to *that clip only*.
4. Under **Titles & Overlays**, enter text (up to 100 characters), start time and end time; click **Add Text Overlay**. The title appears on **T1**, over the preview at the scheduled time, and is composited over each WebM frame.
5. Delete a title from the title list; Undo/Redo also works for audio settings and title edits.
6. **Save Draft** creates a `paracut.studio.draft.v3` JSON containing the clip audio settings and titles. It contains **no video/audio bytes**. When reopening, import the originals to relink.

## Timing and sound

- Clip volume defaults to 100%, source mute defaults to false, fades to 0 seconds.
- Fade-in increases linearly across the clip's opening; fade-out decreases linearly at its ending. Fade lengths must fit inside the **trimmed clip duration**. When trimming or splitting, existing fade lengths are fitted to shorter pieces.
- In preview, volume is updated as the video playhead advances. In WebM beta export, the video source has its own **Web Audio gain node** and A1 audio has a **separate gain node**. The export mixer samples each clip's gain curve as the timeline advances.
- **Mute original video audio** takes precedence over volume/fades only for the selected video clip; it does not silence A1.
- Titles are plain user-entered text, never interpreted as HTML. In preview they are positioned bottom center; in export they are drawn onto the 1280 × 720 canvas with a high-contrast stroke. Video duration remains the master clock.

## Scope and caveats

- **WebM browser export is still beta.** It records in real time using MediaRecorder; supported browser/codecs and the visible-tab requirement still apply. Video/audio timing and fade quality must be checked in an actual exported file.
- Fade curves are applied to playback and export at browser callback/animation-frame granularity; **frame-accurate audio automation is not guaranteed**.
- One sequential video lane, one sequential soundtrack lane, and a bounded set (40) of title overlays. Titles are not yet draggable or style-customizable. They display above video and can overlap; the initial compositor draws the first active title at a time.
- **No transitions, MP4 export, subtitle editor, multichannel mixing or native FFmpeg renderer yet.** These remain separate future milestones requiring more complex render plumbing.
- R3 reads older **R1 (`v1`) and R2 (`v2`) browser drafts**. Older clips default to 100% audio/no fades, with an empty title list. R3's browser draft is not the native ParaCut project format.
- No media upload, AI authority, network acquisition, automatic publishing, or source-file modification.
- Receipts are human-readable local edit history, not third-party evidence or cryptographic approval.

## Testing

```bash
pnpm smoke:studio
pnpm typecheck
pnpm smoke
```

Verify manually: mute a generated video, set a 1.0 s fade-in and 2.0 s fade-out on your A1 song, add a title 2–5 s into the cut, export WebM, then check the beginning/end of the music and the title's timing. Reopen a saved draft and relink media. Check Undo/Redo and split/trim after adding fades.

## Next

R3.1: timeline visual handles and title styling. R3.2: dissolves/crossfades with a render graph rather than one sequential cut. R4: opt-in local FFmpeg desktop backend for repeatable MP4/H.264 exports subject to dependency and licensing review.
