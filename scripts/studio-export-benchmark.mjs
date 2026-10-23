// R7.4: local-only, opt-in export diagnostics. No output path or media name
// is exposed in the benchmark summary and no telemetry leaves this process.
import {planBezierExportSegments} from '../apps/desktop/public/studio-keyframe-points.js';

export function graphDiagnostics(state,graph){
  if(typeof graph!=='string')throw Error('Invalid FFmpeg graph.');
  const clips=[
    ...(state?.clips||[]),...(state?.video2Clips||[]),
    ...(state?.audioClips||[]),...(state?.audio2Clips||[])
  ];
  let customXSegments=0,optimizedPieces=0,maxProbeError=0;
  for(const clip of clips){
    for(const key of ['opacity_keyframe_points','volume_keyframe_points']){
      if(key==='opacity_keyframe_points'&&clip.track_id!=='video-2')continue;
      const points=clip[key];
      if(points===undefined)continue;
      for(const point of points){
        if(point.ease!=='bezier'||point.handles_x===undefined)continue;
        const fit=planBezierExportSegments(point.handles,point.handles_x);
        customXSegments++;
        optimizedPieces+=fit.segments;
        maxProbeError=Math.max(maxProbeError,fit.observedMaxError);
      }
    }
  }
  return {
    filterGraphChars:graph.length,customXSegments,optimizedPieces,
    previousFixedPieces:customXSegments*64,maxProbeError
  };
}

function checkedDuration(n,key){
  if(typeof n!=='number'||!Number.isFinite(n)||n<0)
    throw Error('Invalid export benchmark '+key+'.');
  return n;
}
export function renderBenchmarkReport({mediaSeconds,probeMs,planMs,encodeMs,verifyMs,totalMs,graph}){
  const values={mediaSeconds,probeMs,planMs,encodeMs,verifyMs,totalMs};
  for(const [key,value]of Object.entries(values))checkedDuration(value,key);
  if(!graph||!Number.isSafeInteger(graph.filterGraphChars)||graph.filterGraphChars<0||
     !Number.isSafeInteger(graph.customXSegments)||graph.customXSegments<0||
     !Number.isSafeInteger(graph.optimizedPieces)||graph.optimizedPieces<0||
     !Number.isSafeInteger(graph.previousFixedPieces)||graph.previousFixedPieces<0||
     typeof graph.maxProbeError!=='number'||!Number.isFinite(graph.maxProbeError)||
     graph.maxProbeError<0||graph.maxProbeError>1)
    throw Error('Invalid export graph diagnostics.');
  const f=ms=>(ms/1000).toFixed(3)+'s';
  const ratio=encodeMs>0?(1000*mediaSeconds/encodeMs).toFixed(2)+'x':'n/a';
  const saved=graph.previousFixedPieces-graph.optimizedPieces;
  return [
    'ParaCut R7.4 local export benchmark (measured on this computer):',
    '  Source duration: '+mediaSeconds.toFixed(3)+'s; encode / realtime: '+ratio,
    '  Source relink + ffprobe: '+f(probeMs),
    '  FFmpeg plan: '+f(planMs),
    '  Actual FFmpeg encode: '+f(encodeMs),
    '  Output verification: '+f(verifyMs),
    '  Total measured: '+f(totalMs),
    '  Filter graph characters: '+graph.filterGraphChars,
    '  Custom-X Bézier intervals: '+graph.customXSegments+
      '; adaptive filter pieces: '+graph.optimizedPieces+
      ' (previous fixed: '+graph.previousFixedPieces+
      ', reduction: '+saved+')',
    '  Largest observed adaptive-fit probe difference: '+
      graph.maxProbeError.toFixed(6)+' normalized',
    '  These figures are for one local render; no cloud telemetry or guaranteed speedup.'
  ].join('\n');
}
