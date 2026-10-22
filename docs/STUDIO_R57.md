# ParaCut Studio R5.7 — Local MP4 Quality & Master Audio Safety

This release improves the **explicitly launched local FFmpeg renderer**, for both ordinary V1/A1 cuts and the R5.6 V1/V2/A1/A2 layered graph. It does not change the browser project format, browser MediaRecorder exports, or original footage.

## Windows workflow

Open your local repository copy and double-click **`ParaCut Export MP4.cmd`**. Select the saved project JSON, original media directory, and new MP4 destination as before. A new **MP4 Render Quality** window offers a fixed preset and an optional audio-protection checkbox. Confirm your choices, review the CLI dry-run, and explicitly approve the render.

The launcher sends **one fixed argument list to both dry-run and final render**, so the settings shown during preflight are the settings executed. No paths are interpolated into shell commands. Nothing installs or downloads. FFmpeg and FFprobe still need to be available locally.

## Video quality presets

| Preset | x264 preset | CRF | AAC bitrate | Use |
|---|---|---|---|---|
| Compact | veryfast | 26 | 128 kbps | Faster/smaller review files |
| **Balanced (default)** | medium | 20 | 192 kbps | Existing R5.6 output behavior |
| High | slow | 17 | 256 kbps | Higher-quality final master, usually slower/larger |

CRF controls perceptual video quality for libx264, where lower values generally mean higher quality and larger files. The AAC bitrate applies to the encoded audio stream. These choices **do not increase the current 1280×720 resolution or 30fps**, and High is **not** a guarantee of visually lossless encoding. GPU-accelerated encoding is **not** part of R5.7.

## Optional master sample-peak protection

Turn on **Protect master audio** to insert a single FFmpeg `alimiter` stage *after* all video-source sound, A1/A2 music and voiceover have been mixed:

```
[prelim-master]alimiter=limit=0.95:level=0:latency=1[aout]
```

This offers a ceiling for **decoded sample peaks at the limiter output**, using FFmpeg lookahead. Disabling automatic makeup gain is intentional so the limiter does not amplify the audio just to hit the limit.

**Limitations:** It is not LUFS loudness normalization, broadcast compliance, intersample *true-peak* certification, a loudness match to commercial releases, or a cure for an already distorted source. AAC encoding and later playback/processing can create small intersample overs. For high-stakes audio masters, analyze the finished decoded MP4 with specialized loudness/true-peak tools.

The limiter is **off by default** to preserve existing mixes. When off, projects use their previous audio graph unchanged.

## CLI use

```sh
# Existing behavior; identical output settings to R5.6
node scripts/studio-export-local.mjs --draft cut.json --media-dir originals --out result.mp4 --dry-run

# Compact review export with sample-peak protection
node scripts/studio-export-local.mjs --draft cut.json --media-dir originals --out review.mp4 --quality compact --audio-protect

# High-quality final encode with limiter
node scripts/studio-export-local.mjs --draft cut.json --media-dir originals --out final.mp4 --quality high --audio-protect
```

Accepted values for `--quality`: `compact`, `balanced`, and `high` only. Any other preset is rejected, not passed through to FFmpeg. `--audio-protect` is a boolean flag, not an arbitrary filter string. Existing input source verification, fail-closed output checks, shell-free process launch and no-overwrite semantics stay in place.

## Testing and compatibility

R5.7 uses a shared post-planning export-quality transformer, so the original legacy graph and new R5.6 layered graph both receive the exact same fixed options. It does not add a saved draft field and is compatible with previous ParaCut Studio drafts.

```sh
pnpm smoke:studio
pnpm typecheck
```

- `studio-r57-smoke.mjs` checks **unchanged default graph/encoder arguments**, all three preset mappings, one-and-only-one post-mix limiter, invalid-setting rejection, legacy/layered parity, and Windows dry-run/final argv identity.
- `studio-r57-integration.mjs` conditionally generates original test media, builds a layered A1+A2 soundtrack, performs a CLI dry-run and real H.264/AAC MP4 render with sample-peak protection, and verifies codecs/duration. It reports **SKIPPED** if the runner lacks a compatible FFmpeg build.
- Windows CI parses the PowerShell file for syntax. Automated checks do not guarantee that every specific Windows desktop FFmpeg build supports the required codecs/filters or that your rendered master sounds balanced.

A useful first manual test is a 10-second cut with loud A1 music and a voiceover on A2. Render a **Balanced** MP4 first with protection off, then a **High + Protect** version to a separate output filename. Listen to both and inspect the resulting audio before publishing.
