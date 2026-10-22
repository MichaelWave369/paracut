// R6.8: pure layout and editing helpers for the R6.7 two-point keyframes.
// The visual curve works in clip-relative time, aligned to the timeline.
import {validateKeyframePair} from './studio-keyframes.js';
export const VISUAL_KEYFRAME_PROPERTIES=Object.freeze({
 opacity:Object.freeze({field:'opacity_keyframes',track:'video-2'}),
 volume:Object.freeze({field:'volume_keyframes',track:null})
});
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function keyframeLanePlan(clip,property,total){
  const config=VISUAL_KEYFRAME_PROPERTIES[property];
  if(!config||!clip||!Number.isFinite(total)||total<=0||
    (config.track!==null&&clip.track_id!==config.track)||
    !Number.isFinite(clip.timeline?.start)||!Number.isFinite(clip.timeline?.end)||
    clip.timeline.end<=clip.timeline.start)
    throw Error('Invalid visual keyframe lane.');
  const values=validateKeyframePair(clip[config.field]??{start:1,end:1});
  const left=clamp(100*clip.timeline.start/total,0,100);
  const width=clamp(100*(clip.timeline.end-clip.timeline.start)/total,0,100-left);
  return {field:config.field,property,values,left,width,active:clip[config.field]!==undefined};
}
export function keyframePercentFromY(clientY,rectTop,height){
  if(![clientY,rectTop,height].every(Number.isFinite)||height<=0)
    throw Error('Invalid keyframe pointer coordinates.');
  return Math.round(clamp(100*(1-(clientY-rectTop)/height),0,100));
}
export function editKeyframeEndpoint(pair,endpoint,percentage){
  if(!['start','end'].includes(endpoint)||!Number.isInteger(percentage)||
     percentage<0||percentage>100)throw Error('Invalid keyframe handle edit.');
  return validateKeyframePair({...validateKeyframePair(pair),
    [endpoint]:percentage/100});
}
export function lanePath(pair){
  const values=validateKeyframePair(pair);
  return 'M 0 '+(100-values.start*100)+' L 100 '+(100-values.end*100);
}
