# ParaCut Studio R6.4 — Match Frame and Copy/Paste Attributes

R6.4 adds a Premiere-style **Match Frame** workflow and safe, in-editor **Color** and **V2 visual-style** attribute copying to the existing five-track, ledger-first ParaCut Studio.

## Match Frame: timeline to original source

Double-click a **V1 or V2** video clip while using the **Selection (V)** tool. The Source Monitor opens that clip's original video at the exact project-time position you clicked. Match Frame respects its original **Source IN/OUT trim**.

For example, a V1 clip using source seconds 12–18, placed at project seconds 3–9, will match source second 14 when double-clicked at project second 5. It does **not** open second zero. The existing **↗ Match Frame** button or **F** key matches the selected clip using the Program playhead, clamped to the selected clip's timeline span.

The Source Monitor is revealed if hidden and the matched source's IN/OUT marks are set to the selected clip's source range. The original file must be **relinked locally** first. If metadata is not loaded, ParaCut waits for it before seeking. Match Frame does not move media on the edit timeline, create a receipt or change the draft; the Program frame and Source frame are different views of the same original footage.

**Boundaries:** This first release works on V1/V2 video only. It doesn't match audio samples, titles, proxy generations, compound/nested sequences or true multi-camera footage. Frame timing follows the saved clip's millisecond project positions; frame-accurate results on non-30fps footage depend on browser decoding and the source file's native frame timestamps.

## Copy and paste clip attributes

Select a clip, open the Inspector's **Copy / Paste Attributes** section, and choose:

| Command | Copy from | Paste to | Saved effect |
|---|---|---|---|
| Copy Color / Paste Color | V1 or V2 | V1 or V2 | Brightness, contrast, saturation, warmth |
| Copy V2 Style / Paste V2 Style | V2 only | V2 only | PiP/full-frame layout, opacity, motion preset, visual fade IN/OUT |

After copying, select a target clip and paste. Every **paste** runs the same validated `clip.color.updated` or `clip.overlay.updated` command already used by Inspector controls. One paste means **one receipt** and standard Undo/Redo.

Copying itself is temporary UI memory only, never a media edit. These attribute snapshots **do not use the OS clipboard**, and they are not stored in the project JSON or carried between browser sessions. Color copies read the clip's **committed** grade, not uncommitted slider audition.

V2 style pasting checks that copied fade lengths fit the destination clip. A style too long for the target is refused rather than silently trimming media or compressing the animation. Color cannot be pasted onto audio; visual overlay style cannot be pasted onto V1 or audio. Source media, original IN/OUT, V2 timeline placement, V2-to-V2 transitions, audio tracks and titles are left unchanged.

## How to test

1. Import a video and trim it to a non-zero Source IN/OUT. Place it on V1, then double-click halfway through its timeline bar using Selection (V). Verify Source Monitor opens at the corresponding original frame.
2. Repeat on a V2 overlay. Hide Source Monitor, then use F to reveal and match. Check that Source IN/OUT reflects the selected trim.
3. Apply **Phi Mint** to a V1 clip, select **Copy Color**, choose another V1 or V2 video, and **Paste Color**. Verify identical grades, one paste receipt, Undo/Redo and save/reopen draft.
4. Apply V2 opacity, motion and fades. Copy V2 Style and paste onto a sufficiently long second V2 clip; verify original source and timeline positions are unchanged.
5. Try pasting a style with long fades onto a too-short V2 clip, or V2 style onto V1. It must be refused without any edit receipt.
6. Render a short browser WebM/MP4 and optional local FFmpeg MP4: only the **committed** pasted clip attributes affect the final file.

## Compatibility

No project-schema migration, new network service, arbitrary script execution, proxy generation or encoder changes. Both browser and local MP4 renderers consume the same existing clip attributes. Existing drafts and receipts work unchanged. Source and attribute clipboard controls are session UI state and cannot corrupt export plans.

Automated coverage: `scripts/studio-r64-smoke.mjs` tests source-to-timeline arithmetic (including trimmed assets), typed clipboard snapshots, rejected mismatched pastes, one receipt per successful paste, Undo/Redo, existing draft import/export, local MP4 plan compatibility and UI wiring. CI checks do not replace hands-on Source Monitor frame seeking and browser playback.
