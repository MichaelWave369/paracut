// R7.4 read-only graph probe: no ledger edits, timers, media capture or network.
import {keyframePointsFor,keyframeCurveAt,pointsField} from './studio-keyframe-points.js';

const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function graphSample(clip,field,segmentIndex,clipProgress){
  pointsField(field); // allowlist the editor's two animated properties
  if(!clip||!clip.timeline||!Number.isFinite(clip.timeline.start)||
    !Number.isFinite(clip.timeline.end)||clip.timeline.end<=clip.timeline.start)
    throw Error('Invalid graph clip timing.');
  const points=keyframePointsFor(clip,field);
  if(!Number.isInteger(segmentIndex)||segmentIndex<0||segmentIndex>=points.length-1)
    throw Error('Invalid graph segment.');
  if(typeof clipProgress!=='number'||!Number.isFinite(clipProgress))
    throw Error('Invalid graph sample progress.');
  const a=points[segmentIndex],b=points[segmentIndex+1];
  const at=clamp(clipProgress,a.at,b.at),length=clip.timeline.end-clip.timeline.start;
  return {
    mode:a.ease||'linear',segmentIndex,
    startSec:clip.timeline.start+a.at*length,
    endSec:clip.timeline.start+b.at*length,
    timelineSec:clip.timeline.start+at*length,
    clipPercent:at*100,
    valuePercent:keyframeCurveAt(points,at)*100
  };
}
export function graphSampleLabel(data){
  if(!data||!['startSec','endSec','timelineSec','clipPercent','valuePercent']
    .every(key=>typeof data[key]==='number'&&Number.isFinite(data[key])))
    throw Error('Invalid graph sample data.');
  return 'Segment '+(data.segmentIndex+1)+' · '+data.startSec.toFixed(2)+'–'+
    data.endSec.toFixed(2)+'s · at '+data.timelineSec.toFixed(2)+'s / '+
    data.clipPercent.toFixed(1)+'% clip → '+data.valuePercent.toFixed(1)+'% value'+
    ' ('+String(data.mode)+')';
}
