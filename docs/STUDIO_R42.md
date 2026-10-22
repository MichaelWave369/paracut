# ParaCut R4.2 — Windows one-click local MP4 companion

> **Current update (R5.6):** The local FFmpeg companion now supports V2/A2 layered rendering, V2 dissolves, track mixing, ducking and titles. The older limitation descriptions below document their original release scope. See [Studio R5.6](STUDIO_R56.md) for current requirements, fidelity limits and testing.


R4.2 makes the [R4.1 local FFmpeg exporter](STUDIO_R41.md) easier to use on Windows. It adds a **double-click launcher with native Windows file pickers**, so you no longer have to type the export command or quote file paths.

This is a **user-initiated desktop operation**, not a feature the GitHub Pages website can run by itself. There is no local HTTP server, installer, browser extension, or automatic media upload.

## One-time setup

1. Have the **complete ParaCut repository** on your Windows PC. Download its ZIP from GitHub and extract it, or clone it with Git. Do not run the script from an isolated copy that lacks the `scripts` folder.
2. Install **Node.js 20 or newer** and make `node.exe` available on PATH.
3. Have an FFmpeg build with **ffmpeg.exe and ffprobe.exe**, H.264/libx264 and AAC encoding, and the **xfade** and **ass** filters. If both are on PATH, the launcher finds them automatically. Otherwise it lets you select your own `ffmpeg.exe` and looks for `ffprobe.exe` next to it.
4. Open ParaCut Studio in your browser and use **Save Draft**. Keep the original video/audio files (the JSON doesn't contain them). Ideally put the original files together in one folder.

FFmpeg and Node.js are **not bundled** or silently downloaded. They are installed separately with their own licensing/security considerations. ParaCut remains MIT-licensed; this does not relicense an FFmpeg build.

## Three-pick Windows workflow

1. Double-click **`ParaCut Export MP4.cmd`** in the ParaCut repository folder.
2. Select your saved **ParaCut JSON draft** using the file picker.
3. Select the folder containing the **exact original media files**, then choose a **new .mp4 output name and folder**.

The launcher now calls the existing CLI with **`--dry-run`**, which validates draft/media mapping and prints the FFmpeg plan without encoding anything. When that succeeds, a final dialog asks you to **confirm the local render**. Choose *No* to cancel with no output; choose *Yes* to start the explicit FFmpeg render.

At completion, the CLI checks with FFprobe that the MP4 includes **H.264 video, AAC audio, and approximately the expected duration**. The launcher shows the output path. The console remains open afterward so you can review any problems.

## Safety and limitations

- Windows PowerShell 5.1 with a normal, interactive Windows desktop is required. The `.cmd` file launches the project PowerShell script with a **process-scoped execution-policy override**; it does not change machine policy, request administrative rights, install an application, or create a service. Review scripts before running them.
- The launcher **refuses to overwrite existing MP4 files**. Canceling the file dialogs or confirmation never starts encoding.
- It passes each selected filename as an individual argument, with no shell interpolation of media paths and no command or PowerShell code evaluation.
- Original files remain local and are matched by **exact filename, byte size, duration and expected stream type**. It does not search subfolders. If your files are spread across folders or renamed, use the advanced CLI and `--media-map` described in [R4.1](STUDIO_R41.md).
- Local exports are initially **720p/30fps, at most five minutes**, with a limit of 32 clips per lane. The renderer supports hard cuts/crossfades, A1 music, source audio mute, audio fades, and T1 styled titles. Real rendering depends on the local FFmpeg installation. Final quality, subtitle fonts and A/V timing need a playback check.
- There is **no automatic one-click handoff from the browser**. The website's MP4 and WebM beta buttons remain as they were. R4.2 is a separately launched desktop companion.
- The command window displays draft path, media directory, output location and FFmpeg's output. Don't share the log if its local paths contain private information.

## Troubleshooting

**Node.js is not available:** install Node.js 20+ and reopen the launcher. If Node was just installed, reopen the Windows session or terminal so PATH updates.

**FFmpeg missing:** choose *Yes* when prompted and browse to `ffmpeg.exe`. Keep `ffprobe.exe` in the same folder.

**Cannot match source:** select the media directory containing the original files, not re-exported copies. Use `--media-map` for files in different directories.

**Output already exists:** select a different filename; the application deliberately doesn't overwrite.

**Encoder/filter missing or render fails:** verify your installed FFmpeg supports `libx264`, `aac`, `xfade`, and `ass`. The console prints failure details. No cloud fallback is attempted.

## Verification

The existing cross-platform smoke suite checks launcher structure, argument boundaries, dry-run-first flow, and fail-closed output behavior. A separate `windows-latest` GitHub Actions job **parses the PowerShell script** for syntax errors. These tests do **not** exercise real Windows GUI dialogs or prove your local FFmpeg can render. Complete acceptance is a successful short MP4 export on your machine.

For the next iteration, a true signed desktop application with an explicit local UI could replace the command window, but that should go through its own installer/security review.
