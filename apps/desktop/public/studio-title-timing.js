// ParaCut Studio R8.1: read-only title timing math and staged form controls.
// All results use existing T1 title fields; no project or export schema change.
import {titleDeckSample} from './studio-title-deck.js';

export const TITLE_RHYTHMS=Object.freeze([
  Object.freeze({id:'cut',label:'Hard Cut',inRatio:0,outRatio:0}),
  Object.freeze({id:'punch',label:'Punch In',inRatio:.06,outRatio:.12}),
  Object.freeze({id:'flow',label:'Smooth Flow',inRatio:.2,outRatio:.2}),
  Object.freeze({id:'reveal',label:'Slow Reveal',inRatio:.42,outRatio:.12}),
  Object.freeze({id:'outro',label:'Lingering Exit',inRatio:.1,outRatio:.42})
]);
export const TITLE_DURATION_CHOICES=Object.freeze([1.5,3,5]);
const round=n=>Math.round(n*1000)/1000;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const within=(x,min,max)=>finite(x)&&x>=min&&x<=max;
function validRange(draft){
  if(!draft||!within(draft.start,0,86400)||!within(draft.end,0,86400)||
    draft.end<=draft.start||
    !within(draft.fade_in,0,86400)||!within(draft.fade_out,0,86400)||
    draft.fade_in+draft.fade_out>draft.end-draft.start+.002)
    throw Error('Correct the title timing and fade budget first.');
  return draft.end-draft.start;
}
function boundedFades(inside,outside,span){
  // Floors keep rounded values within the title's actual duration budget.
  const fadeIn=Math.floor(Math.min(span,Math.max(0,inside))*1000)/1000;
  const fadeOut=Math.floor(Math.min(Math.max(0,span-fadeIn),
    Math.max(0,outside))*1000)/1000;
  return {fade_in:fadeIn,fade_out:fadeOut};
}
export function titleRhythmFields(id,seconds){
  const rhythm=TITLE_RHYTHMS.find(r=>r.id===id);
  if(!rhythm)throw Error('Unknown title animation rhythm.');
  if(!within(seconds,.001,86400))throw Error('Invalid title animation duration.');
  return boundedFades(seconds*rhythm.inRatio,seconds*rhythm.outRatio,seconds);
}
export function retimeTitleDraft(draft,requestedSeconds,v1End){
  const oldSpan=validRange(draft);
  if(!within(requestedSeconds,.1,86400)||
    !within(v1End,.1,86400)||
    draft.start>v1End-.1)
    throw Error('Set a valid title duration within the V1 timeline.');
  const end=round(Math.min(v1End,draft.start+requestedSeconds));
  const span=end-draft.start;
  if(span<.1-.000001)throw Error('Title needs at least 0.1s remaining.');
  const fades=boundedFades(draft.fade_in*span/oldSpan,
    draft.fade_out*span/oldSpan,span);
  return {start:round(draft.start),end,...fades};
}
export function titleFadeFromPercent(draft,edge,percent){
  const span=validRange(draft);
  if(!['in','out'].includes(edge)||!within(percent,0,100))
    throw Error('Invalid title fade percent or edge.');
  const other=edge==='in'?draft.fade_out:draft.fade_in;
  const requested=span*percent/100;
  const selected=Math.min(requested,Math.max(0,span-other));
  return edge==='in'
    ?boundedFades(selected,other,span)
    :boundedFades(other,selected,span);
}
export function titlePhaseMap(draft){
  const seconds=validRange(draft);
  // Validate the other title fields through the existing audition contract.
  const frames=[0,25,50,75,100].map(progress=>
    titleDeckSample(draft,progress));
  const fadeIn=draft.fade_in,fadeOut=draft.fade_out;
  const hold=Math.max(0,seconds-fadeIn-fadeOut);
  const pct=value=>Number((100*value/seconds).toFixed(2));
  return {duration:round(seconds),fadeIn:round(fadeIn),
    hold:round(hold),fadeOut:round(fadeOut),
    inPercent:pct(fadeIn),holdPercent:pct(hold),
    outPercent:pct(fadeOut),frames};
}
export function titleTimingReadout(map){
  if(!map||![map.fadeIn,map.hold,map.fadeOut,map.duration].every(finite))
    throw Error('Invalid title timing map.');
  return 'In '+map.fadeIn.toFixed(2)+'s · Hold '+
    map.hold.toFixed(2)+'s · Out '+map.fadeOut.toFixed(2)+
    's · '+map.duration.toFixed(2)+'s total · draft only';
}
