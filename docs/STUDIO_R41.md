# ParaCut R4.1: Local FFmpeg MP4 Companion

This is an **opt-in local command-line exporter for ParaCut Studio browser drafts**, not a native browser capability. GitHub Pages cannot launch an executable on your computer. It never uploads footage or opens a network listener.

## Prerequisites

- Node.js 20+; system-installed FFmpeg and FFprobe in your PATH. The FFmpeg build needs libx264, AAC encoding, xfade and libass (the ass subtitle filter for titles). FFmpeg/codec licensing is separate from ParaCut's MIT license.
- Save your project from the web Studio with **Save Draft**. The JSON references media but contains no media bytes.
- Put the **exact original local media files** in one folder. The companion matches the source **filename and byte size**, checks duration and the expected audio/video stream. If they do not match, it fails instead of guessing.

## Basic workflow

From the cloned ParaCut repository, run:

```sh
node scripts/studio-export-local.mjs --draft ./my-cut.json --media-dir ./my-media --out ./my-movie.mp4 --dry-run
node scripts/studio-export-local.mjs --draft ./my-cut.json --media-dir ./my-media --out ./my-movie.mp4
```

On Windows PowerShell, replace the relative paths with Windows paths and quote any path containing spaces. Run commands **on your computer**, not in the browser. The media directory is read non-recursively.

To map renamed or dispersed media explicitly, create a JSON object whose keys are the `asset_id` values inside your browser draft and whose values are filesystem paths. Relative paths in the map resolve from the map file's folder.

```json
{
  "asset-from-my-saved-draft": "D:/Videos/original.mp4"
}
```

Use `--media-map ./paths.json` instead of or together with `--media-dir`. Optional `--ffmpeg` and `--ffprobe` allow pointing to a non-PATH installation.

## Render features

- **1280 × 720, 30 fps H.264 (libx264) + AAC MP4**, up to five minutes and 32 clips per video/audio lane in this first release.
- V1 hard cuts and real overlap crossfades; V1 source mute and per-clip volume/fades; A1 soundtrack clips independently mixed with existing gain/fades.
- Styled timed titles with top/middle/bottom, small/medium/large, white/mint/gold, and fade-in/out via local libass/ASS. Appearance can differ slightly from the browser's system font.
- Browser drafts v1/v2/v3 are read through the existing Studio validation code. The editor, browser MP4/WebM buttons, native TypeScript RenderPlan and Interop Room are unchanged.
- No overwrite (`ffmpeg -n` plus an existence check). Uses argument-array process spawning, not shell execution. A temporary filter graph and subtitle file are removed after the render. Failed/invalid new exports are removed.
- FFprobe verifies that the final file has an MP4 container with H.264 video and AAC audio and roughly the expected duration.

## Important boundaries

This is **not integrated with the GitHub Pages buttons**; the user must invoke the CLI. It requires FFmpeg installed manually. Codec licensing/patent terms and FFmpeg build licenses depend on the user's local installation; no FFmpeg binary is bundled. The command only works with local original media files; do not supply untrusted draft files or scripts.

Audio gain and crossfades are linear; source audio from videos with missing audio streams is skipped. A silent AAC track is written when nothing produces sound. Title overlaps use libass's normal layering and may not perfectly match the single-active-title browser preview. The renderer is CPU intensive and output may differ in timing or font selection from the browser beta; review final audio/video before distributing.

## Tests

```sh
pnpm smoke:studio
pnpm typecheck
```

The integrated FFmpeg smoke test generates two small synthetic videos and an audio file, renders a crossfade plus title/music, and verifies MP4 streams. On CI hosts without required FFmpeg capabilities, that integration test reports SKIPPED while pure planning and safety tests still run.

Next: make a Windows-friendly one-click local companion, with explicit browser-to-desktop handoff. That should be built separately with a carefully designed permission boundary, not a silent HTTP bridge.
