# ParaCut browser export cleanup · Framefield field-test follow-up

**Operator evidence:** A real, locally generated Framefield Turntable WebM
was SHA-256-matched and imported into ParaCut V1. Browser export initially
failed with `Export: colorCSS is not defined`; a Console-only binding
workaround allowed an actual WebM download.

## Fixes in this PR
1. Import the existing `colorCSS` helper from `studio-color.js` where the
   browser encoder calls it, for both V1 and V2. Add a source-level regression
   smoke test. No global-variable workaround needed after deployment.
2. Delay MediaRecorder startup until the first local decoder has produced
   current frame data; paint that frame before recording. This aims to avoid a
   leading black/startup gap while the source seeks. Browser recording still
   runs in real time and may be variable frame rate. Do not claim timestamp
   normalization or guaranteed codec support.
3. Add an **optional local audit** for the original WebM packet PTS/DTS:
   `node scripts/studio-export-timestamp-audit.mjs "Untitled-Cut.webm"`
   requires locally available `ffprobe`; never uploads or modifies video.

## What the supplied first recording actually demonstrated
- 148 VP9 packets, **all strictly increasing PTS and DTS**.
- Initial video packet gap: **693 ms**; typical gap roughly **35 ms**.
- FFmpeg's `non monotonically increasing dts` warning occurred when
  generating a downstream decoded/transcoded output, *not* as duplicate
  original WebM packet timestamps. Do not call the original corrupt.
- A new real-browser export is required to measure whether deferred startup
  reduces the initial gap and to verify downloaded audio/video playback.

## Field acceptance
1. After CI and a reviewed merge, hard-refresh ParaCut (no Console snippet).
2. Open saved `Untitled-Cut.paracut.json`, relink original, inspect Program.
3. Export WebM once with tab visible; observe completion in bottom status and
   verify download with Ctrl+J.
4. Replay exported video and inspect 0–1 seconds for black/startup gap.
5. Run optional packet audit on that new file and compare with 693 ms baseline;
   keep result with same-build evidence. Check MP4 independently.
6. Reopen and relink draft; altered source bytes must still be rejected.

**Boundary:** CI smoke is source-level and synthetic. Neither the field export
nor timing improvement is verified by CI; no publication authorization granted.
