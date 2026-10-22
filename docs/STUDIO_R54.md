# ParaCut Studio R5.4 — Measured Live A1/A2 Preview Meters

R5.3 provided a source-waveform *estimate*. R5.4 adds **real time-domain Web Audio peak measurement** for the two audio buses in the browser Studio: A1 soundtrack and A2 voiceover/FX.

## How the audio meter works

1. Place an audio file on A1 and/or A2 as before. Optionally adjust individual clip volume/fades and A1/A2 mixer level, mute, solo and A2 voiceover ducking.
2. Press **Play**. On browsers with usable Web Audio support, ParaCut creates an `AudioContext` from this user gesture. Each existing preview player has its own persistent `MediaElementAudioSourceNode → GainNode → AnalyserNode → speakers` chain.
3. As the movie plays, the level indicators read actual **post-gain A1/A2 preview samples** with `AnalyserNode.getFloatTimeDomainData()`. The numerical output is **sample peak dBFS**. For example, 0.5 full-scale amplitude is approximately −6.0 dBFS; silence is −∞ dBFS.
4. While paused, or if Web Audio cannot be initialized, the UI identifies and displays **estimated source waveform peaks** from the prior R5.3 system. It does not pass those estimates off as measured playback data.

The Web Audio GainNodes replace the corresponding `HTMLMediaElement.volume` controls for A1/A2 preview *after the graph is created*. This is intentional to avoid applying the bus gain twice; the gain comes from the same `audioLevelAt × audioMixLevelAt` functions used by the browser exporter. The separate video players and MediaRecorder audio graph are unchanged.

## What the meters do and do not measure

- **Measured:** PCM sample peaks on the **A1 and A2 preview paths**, downstream of each track's clip gain, fade, track level, mute, solo and duck envelope.
- **Not included:** original video soundtrack from V1/V2, the combined master output after all source mixing, monitor/system volume, plugins, external devices or samples after browser/OS audio processing.
- **Not certified:** these are **sample peak meters**, not intersample true-peak, LUFS, RMS loudness compliance, a hard clipping limiter, or an automated audio mix/mastering stage. Peaks are read from the analyser buffer on UI animation frames; short transients can fall between reads.
- **Not part of export:** the preview meter taps only the A1/A2 players. The export already creates separate decoder and Web Audio mixing nodes; R5.4 deliberately leaves the recorder and H.264/AAC local CLI alone. Verify a finished movie's audio with your preferred playback or mastering tool.
- **Browser support:** if `AudioContext` is missing, the estimate view remains. Browsers may suspend or refuse audio until a user-initiated gesture. The UI reports when live metering is not running.
- **Local only:** no audio uploads, microphone permission, background service, external analytics, source file edits or new saved-project schema.

## Regression and acceptance

```sh
pnpm smoke:studio
pnpm typecheck
pnpm smoke
```

`studio-r54-smoke.mjs` tests peak/RMS/dBFS calculations, source-to-gain-to-analyser-to-speakers connections with a fake Web Audio context, mixer-dependent gain settings, and the explicit UI live-vs-estimate paths. Tests cannot demonstrate that every browser decodes and sounds identical.

Suggested real-world test: put A1 music and A2 voiceover in a 12-second project, start playback and confirm the mode changes to **Measured A1/A2 playback peaks** with dBFS numbers. Mute A2, adjust A1 gain and enable voiceover ducking, then listen and watch the measured levels move. Pause and confirm the UI relabels the fallback as an **estimate**. Export a short WebM and verify sound stays unchanged.

Next separate milestone: **V2-to-V2 overlay transitions** using two simultaneous V2 decoders, with preview, draft, browser recording and local exporter compatibility carefully handled.
