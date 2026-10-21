// R5.3 local waveform geometry and approximate level guide.
// These are decoded asset peak samples, NOT real-time output meters.
import {activeAudioClip,activeAudio2Clip,audioLevelAt,audioMixLevelAt} from './studio-core.js';

export function sourceTimeAtFraction(fraction,duration) {
  if(!Number.isFinite(fraction)||!Number.isFinite(duration)||duration<=0)
    throw Error('Invalid waveform coordinate.');
  return Math.round(Math.max(0,Math.min(1,fraction))*duration*1000)/1000;
}
export function trimmedSourceSelection(sourceStart,sourceEnd,duration) {
  if(![sourceStart,sourceEnd,duration].every(Number.isFinite) || duration<=0 ||
      sourceStart<0 || sourceEnd>duration+.002 || sourceEnd-sourceStart<.079)
    throw Error('Invalid waveform trim bounds.');
  return {from:Math.max(0,Math.min(1,sourceStart/duration)),
    to:Math.max(0,Math.min(1,sourceEnd/duration))};
}
export function estimateTrackPeak(state,trackId,at,peaksByAsset) {
  if(!['audio-1','audio-2'].includes(trackId)||!Number.isFinite(at))
    throw Error('Invalid track meter request.');
  const clip=(trackId==='audio-1'?activeAudioClip:activeAudio2Clip)(state,at);
  if(!clip)return {available:false,active:false,peak:0};
  const peaks=peaksByAsset.get(clip.asset_id);
  const asset=state.assets.find(a=>a.asset_id===clip.asset_id);
  if(!Array.isArray(peaks)||!peaks.length||!asset?.duration)
    return {available:false,active:true,peak:0};
  const elapsed=Math.max(0,at-clip.timeline.start);
  const sourceAt=Math.min(clip.source.end,clip.source.start+elapsed);
  const position=Math.max(0,Math.min(peaks.length-1,
    Math.floor(sourceAt/asset.duration*peaks.length)));
  const sample=Math.max(0,Math.min(1,peaks[position]||0));
  const peak=Math.max(0,Math.min(1,sample*audioLevelAt(clip,at)*
    audioMixLevelAt(state,trackId,at)));
  return {available:true,active:true,peak};
}
export function paintTrimWaveform(canvas,peaks,duration,sourceStart,sourceEnd) {
  if(!canvas||!Array.isArray(peaks)||!peaks.length)return;
  const pixelRatio=globalThis.devicePixelRatio||1;
  const width=canvas.width=Math.max(160,Math.round((canvas.clientWidth||320)*pixelRatio));
  const height=canvas.height=Math.round(80*pixelRatio);
  const ctx=canvas.getContext('2d');
  if(!ctx)return;
  const selected=trimmedSourceSelection(sourceStart,sourceEnd,duration);
  ctx.clearRect(0,0,width,height);
  ctx.fillStyle='#142333';ctx.fillRect(0,0,width,height);
  const barWidth=width/peaks.length;
  peaks.forEach((raw,i)=>{
    const amplitude=Math.max(0,Math.min(1,Number(raw)||0));
    const mid=(i+.5)/peaks.length;
    ctx.fillStyle=mid>=selected.from&&mid<=selected.to?'#a5e7dd':'#40546f';
    const h=Math.max(2,amplitude*(height-12));
    ctx.fillRect(i*barWidth,(height-h)/2,Math.max(1,barWidth*.8),h);
  });
  ctx.strokeStyle='#ffe0a2';ctx.lineWidth=Math.max(2,pixelRatio);
  for(const edge of [selected.from,selected.to]){
    ctx.beginPath();ctx.moveTo(edge*width,0);ctx.lineTo(edge*width,height);ctx.stroke();
  }
  ctx.fillStyle='#ffe0a2';
  ctx.font=(10*pixelRatio)+'px system-ui, sans-serif';
  ctx.textAlign='left';ctx.fillText('IN',Math.min(selected.from*width+5,width-20),11*pixelRatio);
  ctx.textAlign='right';ctx.fillText('OUT',Math.max(selected.to*width-5,24),11*pixelRatio);
}
