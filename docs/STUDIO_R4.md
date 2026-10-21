# ParaCut Studio R4 — browser-native MP4 export (beta)

R4 keeps the proven local-first ParaCut browser timeline and WebM encoder. It adds **Export MP4 β** only when `MediaRecorder.isTypeSupported()` reports an MP4 recording option. The edit/render source pipeline is unchanged: clips, audio gain/fades, video source mute, T1 title styles, and two-video crossfades use the same canvas/Web Audio recording path.

## How to try it

1. Load ParaCut Studio over HTTP/HTTPS; import your own videos and audio.
2. Edit the movie, including title animations, sound mixing, and crossfades.
3. Check the export toolbar. If your browser exposes an MP4 encoder, **Export MP4 β** is enabled. Otherwise you will see **MP4 unavailable here; WebM remains an option.** The app does not ask you to install an encoder or upload video to a server.
4. Click **Export MP4 β**. The movie is rendered in real time to a genuine MP4 container, **if** the browser can produce one. This is not a conversion from WebM.
5. Check the downloaded movie by playing it in your media player, including sound, title fades, and transitions.
6. **Export WebM β** remains available separately. Cancel either export using its own button during recording.

## Integrity / failure behavior

- The app first checks actual MP4 support with `MediaRecorder.isTypeSupported()`. It tries known AVC/AAC MIME combinations followed by generic `video/mp4` as a final option.
- During export it verifies the `MediaRecorder.mimeType` container matches the user-requested format, then inspects the first bytes of the recording to distinguish MP4 (`ftyp` ISO BMFF box) from WebM (EBML header). If the recorded container is wrong or unknown, it **does not download or label the file as MP4**.
- This container signature check is **not** a complete playback-validation or security proof. The user still needs to listen/watch the exported video.
- A browser can report MP4 MIME support but fail at runtime because of system codec availability, resource limits, or the chosen audio codec. In that case ParaCut reports a failure and preserves your project. WebM remains available if supported.
- Without a specified codec, generic MP4 may contain codec combinations that some players cannot open. This is **MP4 container output**, not a universal H.264/AAC compatibility guarantee.

## What does not change

- Files stay on the user's device. No media upload, network encoder, or cloud rendering.
- Still **real-time beta export** at 1280×720 with a 5-minute timeline limit and foreground tab requirement. Timing and synchronization may drift; frame-accurate editing isn't promised.
- No FFmpeg.wasm or mandatory third-party script downloads. No native desktop transcoder or universal MP4 support yet.
- Browser draft schema, video/audio editor, interop room, ledger receipts, project-core, and license remain unchanged.
- WebM output is also signature-verified in R4, so it cannot silently download a mislabeled MP4.

## Tests

```sh
pnpm smoke:studio
pnpm smoke
pnpm typecheck
```

`scripts/studio-r4-export-smoke.mjs` covers supported/unsupported recorder capabilities, actual vs requested MIME, MP4 and WebM binary magic, rejection of mislabeled files, and the MP4/WebM UI wiring. A successful CI run does **not** prove a user's specific browser can encode MP4. Test one short real-world output on your own machine.

## Next

R4.1 should add an optional local desktop FFmpeg/H.264 export backend for browsers without native MP4 support, with explicit local-only permissions and codec/licensing review. The browser should never silently fetch a massive encoder or upload a project's sources.
