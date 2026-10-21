# ParaCut Studio R3.1 — Title Designer

This increment enhances the existing T1 timed-text overlay workflow without changing the working video/audio editor or the native ParaCut interoperability contracts.

## Using the Title Designer

1. Open **ParaCut Studio** and load a video into V1.
2. In **Titles & Overlays**, enter text and its timeline start/end.
3. Choose **Position** (Top, Center, Bottom), **Text Size** (Small, Medium, Large), and **Color** (White, Phi Mint, Gold).
4. Set **Fade in** and **Fade out** in seconds. Their sum must not exceed the title's duration.
5. Select **Add Text Overlay** to add the title to T1.
6. To revise an existing title, click **Edit** on the title in the inspector list. Adjust wording, start/end or style, then choose **Save Title Changes**. **Cancel Edit** discards unsaved form inputs.
7. Export a short **WebM β** to confirm the new title style and opacity transitions appear in the rendered file.

All title edits are non-destructive and appear in the local receipts. Undo/Redo reverts add/update/delete operations. The project draft stays `paracut.studio.draft.v3` because this is a backward-compatible *additive* extension: old v3 titles default to Bottom/Medium/White/no fade. R1/R2 drafts continue to import through the existing migration logic.

## Rendering

- The preview uses escaped text via `textContent`, fixed CSS style presets, and CSS opacity calculated from the title's active timeline interval.
- The WebM canvas compositor renders the same approved color, font-size tier, alignment zone and opacity curve using `globalAlpha`; no user-entered CSS or HTML is evaluated.
- Up to 40 titles per draft. If titles overlap, the existing first-active-title policy is unchanged; overlapping titles do *not* render simultaneously.
- The existing 1280×720 real-time WebM beta limitations remain: visible tab, supported codecs, no frame-accurate timing guarantee, and manual output verification.
- This feature does not include imported fonts, image overlays, transitions between video clips, MP4 or desktop FFmpeg rendering.

## Regression checks

```sh
pnpm smoke:studio
pnpm typecheck
pnpm smoke
```

The new `studio-r31-smoke.mjs` tests style validation, animation boundaries, updates and receipts, undo/redo, old title compatibility, and rejection of arbitrary style values. The existing R1–R3 and interop tests remain in CI.

## Roadmap

R3.2: crossfade transitions between real video clips, requiring an overlapping video render graph. R4: desktop FFmpeg output and an MP4 pipeline, respecting licensing and local execution permissions.
