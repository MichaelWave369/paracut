// R2 waveform extraction is local only; audio bytes are never uploaded.
// decodeAudioData is intentionally bounded so large source files do not pin the tab.
export async function extractWaveform(file, options = {}) {
  const bins = Math.max(16, Math.min(160, Math.round(options.bins || 80)));
  const maxBytes = options.maxBytes || 32 * 1024 * 1024;
  if (file.size > maxBytes) return null;
  const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioCtx) return null;
  const ctx = new AudioCtx();
  try {
    const array = await file.arrayBuffer();
    const sound = await ctx.decodeAudioData(array);
    const data = sound.getChannelData(0), step = Math.max(1, Math.floor(data.length / bins));
    const peaks = [];
    for (let i = 0; i < bins; i++) {
      const start = Math.floor((i * data.length) / bins);
      const end = Math.min(data.length, start + step);
      const stride = Math.max(1, Math.floor((end - start) / 128));
      let max = 0;
      for (let j = start; j < end; j += stride) max = Math.max(max, Math.abs(data[j]));
      peaks.push(Math.min(1, max));
    }
    return peaks;
  } finally {
    await ctx.close();
  }
}
export function paintWaveform(canvas, peaks) {
  if (!canvas || !Array.isArray(peaks) || !peaks.length) return;
  const width = canvas.width = Math.max(60, canvas.clientWidth * (globalThis.devicePixelRatio || 1) || 200);
  const height = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#b8a3ff';
  const bw = width / peaks.length;
  peaks.forEach((peak,i) => {
    const h = Math.max(2, Math.min(1, peak) * (height - 4));
    ctx.fillRect(i * bw, (height-h)/2, Math.max(1,bw * .75), h);
  });
}
