// R6.7: two linear endpoint keyframes over normalized clip duration.
// Separate modifiers from legacy base opacity/volume and existing fades.
export const KEYFRAME_FIELDS=Object.freeze(['opacity_keyframes','volume_keyframes']);
export function validateKeyframePair(value) {
  if(!value||typeof value!=='object'||Array.isArray(value)||
    Object.keys(value).length!==2||
    Object.keys(value).some(k=>!['start','end'].includes(k))||
    !['start','end'].every(k=>typeof value[k]==='number'&&
      Number.isFinite(value[k])&&value[k]>=0&&value[k]<=1))
    throw Error('Keyframes require Start/End values between 0 and 1.');
  return {start:Math.round(value.start*1000)/1000,end:Math.round(value.end*1000)/1000};
}
export function keyframeAt(pair,relativeProgress){
  if(pair===undefined)return 1;
  const p=validateKeyframePair(pair);
  const u=Math.max(0,Math.min(1,Number.isFinite(relativeProgress)?relativeProgress:0));
  return p.start+(p.end-p.start)*u;
}
export function clipKeyframeAt(clip,field,timelineTime){
  if(!clip||clip[field]===undefined)return 1;
  if(!KEYFRAME_FIELDS.includes(field))throw Error('Unsupported keyframe property.');
  const span=clip.timeline.end-clip.timeline.start;
  return keyframeAt(clip[field],span>0?(timelineTime-clip.timeline.start)/span:0);
}
const n=value=>String(Number(value.toFixed(5)));
export function keyframeTimeExpression(pair,duration,variable='t') {
  const p=validateKeyframePair(pair);
  if(!Number.isFinite(duration)||duration<=0||
    !['t','T'].includes(variable))throw Error('Invalid keyframe expression duration.');
  if(p.start===p.end)return n(p.start);
  // For use in FFmpeg filtergraph expressions: quotes/escapes supplied by caller.
  return n(p.start)+'+('+n(p.end-p.start)+')*min(1,max(0,'+
    variable+'/'+n(duration)+'))';
}
export function audioKeyframeFilter(clip){
  if(clip.volume_keyframes===undefined)return null;
  const span=clip.source.end-clip.source.start;
  return "volume='"+keyframeTimeExpression(clip.volume_keyframes,span,"t")+
    "':eval=frame";
}
export function overlayKeyframeFilter(clip){
  if(clip.opacity_keyframes===undefined)return null;
  const duration=clip.source.end-clip.source.start;
  // FFmpeg geq alpha evaluates in source-local time before setpts timeline shift.
  // Commas in geq function calls require escaping at the filtergraph level.
  const expr=keyframeTimeExpression(clip.opacity_keyframes,duration,'T')
    .replace(/,/g,'\\,');
  return 'geq=r=r(X\\,Y):g=g(X\\,Y):b=b(X\\,Y):a=alpha(X\\,Y)*('+expr+')';
}
