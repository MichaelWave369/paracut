// ParaCut R5.4: measured A1/A2 preview-bus metering.
// A MediaElementSource is connected exactly ONCE per persistent preview player.
// The graph is user-gesture activated and never used by the export recorder.
export function meterStats(buffer) {
  if(!buffer || typeof buffer.length!=='number'||!buffer.length)
    return {peak:0,rms:0,dbfs:-Infinity};
  let peak=0,sumSquares=0;
  for(const raw of buffer) {
    const v=Number.isFinite(raw)?Math.max(-1,Math.min(1,raw)):0;
    peak=Math.max(peak,Math.abs(v));
    sumSquares+=v*v;
  }
  return {peak,rms:Math.sqrt(sumSquares/buffer.length),
    dbfs:peak>0?20*Math.log10(peak):-Infinity};
}
export function formatDbfs(value) {
  return Number.isFinite(value)?value.toFixed(1)+' dBFS':'−∞ dBFS';
}
export function createPreviewBusMeters(AudioContextType,elements) {
  if(typeof AudioContextType!=='function' ||
      !elements?.a1 || !elements?.a2 || elements.a1===elements.a2)
    throw Error('AudioContext and two independent audio players are required.');
  const ctx=new AudioContextType();
  const channels={};
  try{
    for(const lane of ['a1','a2']) {
      const el=elements[lane];
      const source=ctx.createMediaElementSource(el);
      const gain=ctx.createGain();gain.gain.value=0;
      const analyser=ctx.createAnalyser();
      analyser.fftSize=2048;
      analyser.smoothingTimeConstant=0;
      source.connect(gain);gain.connect(analyser);analyser.connect(ctx.destination);
      channels[lane]={source,gain,analyser,
        data:new Float32Array(analyser.fftSize)};
    }
  }catch(e) {
    // MediaElementSource ownership cannot be reversed on the same element.
    // Do not close/destroy a partly connected graph and claim fallback sound.
    throw Error('Live bus meter setup failed: '+e.message);
  }
  return {
    context:ctx,channels,
    setGain(lane,value) {
      if(!channels[lane] || !Number.isFinite(value))throw Error('Unknown meter bus/gain.');
      channels[lane].gain.gain.value=Math.max(0,Math.min(1,value));
    },
    read(lane) {
      const entry=channels[lane];
      if(!entry)throw Error('Unknown meter bus.');
      entry.analyser.getFloatTimeDomainData(entry.data);
      return meterStats(entry.data);
    }
  };
}
