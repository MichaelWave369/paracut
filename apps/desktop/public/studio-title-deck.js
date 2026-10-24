// ParaCut Studio R8.0: creative title recipes and audition are editor-only.
// Use the existing title fields: no new draft schema, permissions or telemetry.
import {titleOpacityAt,TITLE_POSITION,TITLE_SIZE,TITLE_COLOR}
  from './studio-core.js';

export const TITLE_RECIPES=Object.freeze([
  Object.freeze({id:'cinema',label:'Cinema',position:'middle',size:'large',
    color:'white',fadeIn:.19,fadeOut:.21}),
  Object.freeze({id:'lower-third',label:'Lower Third',position:'bottom',size:'small',
    color:'mint',fadeIn:.12,fadeOut:.2}),
  Object.freeze({id:'chapter',label:'Chapter',position:'top',size:'large',
    color:'gold',fadeIn:.16,fadeOut:.15}),
  Object.freeze({id:'quote',label:'Quote',position:'middle',size:'medium',
    color:'gold',fadeIn:.25,fadeOut:.25}),
  Object.freeze({id:'caption',label:'Caption',position:'bottom',size:'medium',
    color:'white',fadeIn:0,fadeOut:0}),
  Object.freeze({id:'end-card',label:'End Card',position:'middle',size:'large',
    color:'mint',fadeIn:.28,fadeOut:.3})
]);
const n3=n=>Math.round(n*1000)/1000;
export function titleRecipeFields(id,seconds){
  const recipe=TITLE_RECIPES.find(r=>r.id===id);
  if(!recipe)throw Error('Unknown title look.');
  if(typeof seconds!=='number'||!Number.isFinite(seconds)||
    seconds<=0||seconds>86400)throw Error('Set a valid title duration first.');
  return {position:recipe.position,size:recipe.size,color:recipe.color,
    fade_in:n3(seconds*recipe.fadeIn),fade_out:n3(seconds*recipe.fadeOut)};
}
export function titlePlacementAtPlayhead(playhead,total,seconds=3){
  if(![playhead,total,seconds].every(x=>typeof x==='number'&&Number.isFinite(x))||
    total<.1||total>86400||playhead<0||playhead>total||
    seconds<=0||seconds>86400)
    throw Error('A valid V1 timeline and title duration are required.');
  if(playhead>total-.1)
    throw Error('Move the playhead earlier to leave at least 0.1s for a title.');
  return {start:n3(playhead),end:n3(Math.min(total,playhead+seconds))};
}
export function titleDeckSample(draft,percent){
  if(!draft||typeof draft!=='object'||!Number.isFinite(percent)||
    percent<0||percent>100)throw Error('Invalid title audition progress.');
  const {text,start,end,position,size,color,fade_in,fade_out}=draft;
  if(![start,end,fade_in,fade_out].every(n=>typeof n==='number'&&Number.isFinite(n))||
    start<0||end<=start||end>86400||fade_in<0||fade_out<0||
    fade_in+fade_out>end-start+.002||
    !TITLE_POSITION.includes(position)||!TITLE_SIZE.includes(size)||
    !TITLE_COLOR.includes(color))
    throw Error('Correct the title range, style or fades to preview.');
  if(typeof text!=='string'||text.length>100)
    throw Error('Title text exceeds 100 characters.');
  const time=start+(end-start)*percent/100;
  // The 100% end boundary is exclusive in the actual timeline; sample just
  // inside the last frame to audition fade-out rather than snap to invisible.
  const safeTime=Math.min(time,end-0.001);
  const opacity=titleOpacityAt({...draft,start,end},safeTime);
  return {text:text.trim()||'Your title',position,size,color,
    opacity,seconds:n3(time),progress:percent,
    fadeIn:fade_in,fadeOut:fade_out};
}
export function titleDeckReadout(sample){
  if(!sample||!Number.isFinite(sample.opacity)||!Number.isFinite(sample.seconds))
    throw Error('Invalid title audition sample.');
  return sample.progress+'% · '+sample.seconds.toFixed(2)+'s · '+
    Math.round(sample.opacity*100)+'% visible · draft only';
}
