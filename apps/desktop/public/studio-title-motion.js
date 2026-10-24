// R8.2 title motion in 1280x720 composition coordinates.
// Only allowlisted motion IDs; translation is tied to existing opacity fades,
// so legacy titles and clips without fades remain visually unchanged.
export const TITLE_MOTIONS=Object.freeze([
  'none','float-up','slide-left','slide-right'
]);
// New fields are optional; absent values preserve R8.2 output byte for byte.
export const TITLE_MOTION_EASES=Object.freeze(['linear','ease-in','ease-out','smooth']);
export const TITLE_MOTION_DISTANCES=Object.freeze([50,75,100,125,150]);
export function titleMotionEaseId(title){
  const value=title?.motion_ease===undefined?'linear':title.motion_ease;
  if(!TITLE_MOTION_EASES.includes(value))throw Error('Invalid title motion easing.');
  return value;
}
export function titleMotionDistance(title){
  const value=title?.motion_distance===undefined?100:title.motion_distance;
  if(!TITLE_MOTION_DISTANCES.includes(value))throw Error('Invalid title motion distance.');
  return value;
}
export function titleMotionProgress(progress,easing='linear'){
  if(!Number.isFinite(progress)||progress<0||progress>1||
    !TITLE_MOTION_EASES.includes(easing))throw Error('Invalid title motion progress.');
  if(easing==='ease-in')return progress*progress;
  if(easing==='ease-out')return progress*(2-progress);
  if(easing==='smooth')return progress*progress*(3-2*progress);
  return progress;
}
const MOTION_DELTAS=Object.freeze({
  'none':Object.freeze({x:0,y:0}),
  'float-up':Object.freeze({x:0,y:96}),
  'slide-left':Object.freeze({x:200,y:0}),
  'slide-right':Object.freeze({x:-200,y:0})
});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function titleMotionId(title){
  // Only an absent legacy field defaults to Still. Explicit null is invalid.
  const id=title?.motion===undefined?'none':title.motion;
  if(!TITLE_MOTIONS.includes(id))throw Error('Invalid title motion preset.');
  return id;
}
export function titleMotionAt(title,time){
  const motion=titleMotionId(title);
  const ease=titleMotionEaseId(title),distance=titleMotionDistance(title)/100;
  if(!title||!finite(time)||!finite(title.start)||!finite(title.end)||
    !finite(title.fade_in??0)||!finite(title.fade_out??0)||
    title.end<=title.start||title.start<0||
    (title.fade_in??0)<0||(title.fade_out??0)<0||
    (title.fade_in??0)+(title.fade_out??0)>title.end-title.start+.002)
    throw Error('Invalid title motion timing.');
  if(time<title.start||time>=title.end||motion==='none')return {x:0,y:0};
  const fi=title.fade_in??0,fo=title.fade_out??0;
  const age=time-title.start,remaining=title.end-time;
  // ASS event precision is centiseconds. Below 30ms, retain opacity fades
  // but skip spatial motion in *all* three paths to avoid sub-frame jitter.
  const enters=fi>=.03&&age<fi;
  const exits=fo>=.03&&remaining<fo;
  const delta=MOTION_DELTAS[motion];
  if(enters){
    const factor=distance*(1-titleMotionProgress(Math.max(0,Math.min(1,age/fi)),ease));
    return {x:delta.x*factor,y:delta.y*factor};
  }
  if(exits){
    const factor=distance*titleMotionProgress(Math.max(0,Math.min(1,1-remaining/fo)),ease);
    const x=-delta.x*factor,y=-delta.y*factor;
    return {x:x||0,y:y||0}; // Canonicalize negative zero on stationary axes.
  }
  return {x:0,y:0};
}
export function titleMotionPhases(title,exportEnd){
  const mode=titleMotionId(title),distance=titleMotionDistance(title)/100;
  titleMotionEaseId(title);
  if(!finite(exportEnd)||exportEnd<=0||!title||
    !finite(title.start)||!finite(title.end)||
    !finite(title.fade_in??0)||!finite(title.fade_out??0)||
    title.end<=title.start||(title.fade_in??0)<0||(title.fade_out??0)<0||
    (title.fade_in??0)+(title.fade_out??0)>title.end-title.start+.002)
    throw Error('Invalid title motion export duration.');
  if(title.start>=exportEnd)return [];
  const end=Math.min(exportEnd,title.end);
  if(end<=title.start)return [];
  const fi=Math.min(title.fade_in??0,end-title.start);
  const fo=Math.min(title.fade_out??0,end-title.start-fi);
  if(mode==='none')return [{kind:'legacy',start:title.start,end,fadeIn:fi,fadeOut:fo,
    from:{x:0,y:0},to:{x:0,y:0}}];
  const phases=[];
  const start=title.start,middleStart=start+fi,middleEnd=end-fo;
  const original=MOTION_DELTAS[mode];
  const delta={x:original.x*distance,y:original.y*distance};
  if(fi>=.01)phases.push({kind:fi>=.03?'enter':'still-enter',
    start,end:middleStart,fadeIn:fi,fadeOut:0,
    from:fi>=.03?delta:{x:0,y:0},to:{x:0,y:0}});
  if(middleEnd-middleStart>=.01)phases.push({kind:'hold',
    start:middleStart,end:middleEnd,fadeIn:0,fadeOut:0,
    from:{x:0,y:0},to:{x:0,y:0}});
  if(fo>=.01)phases.push({kind:fo>=.03?'exit':'still-exit',
    start:middleEnd,end,fadeIn:0,fadeOut:fo,
    from:{x:0,y:0},to:fo>=.03?{x:-delta.x,y:-delta.y}:{x:0,y:0}});
  // Tiny opacity-only intervals can be smaller than one ASS centisecond.
  // In that case retain the old single event to avoid dropping the text.
  if(!phases.length||phases.some(p=>p.end-p.start<.01-1e-9))
    return [{kind:'legacy',start,end,fadeIn:fi,fadeOut:fo,
      from:{x:0,y:0},to:{x:0,y:0}}];
  return phases;
}


// Eased ASS cannot tween \move nonlinearly. Generate bounded, nonoverlapping
// centisecond segments and interpolate ASS \alpha across each segment.
// Legacy R8.2 linear phases use the old \move+\fad path unchanged.
function titleMotionOpacity(title,time){
  if(time<=title.start)return (title.fade_in??0)>0?0:1;
  if(time>=title.end)return 0;
  const fi=title.fade_in??0,fo=title.fade_out??0;
  return Math.max(0,Math.min(1,fi>0?(time-title.start)/fi:1,
    fo>0?(title.end-time)/fo:1));
}
export function titleMotionExportPhases(title,exportEnd){
  const phases=titleMotionPhases(title,exportEnd);
  if(titleMotionEaseId(title)==='linear'||titleMotionId(title)==='none')
    return phases;
  const result=[];
  for(const phase of phases){
    if(phase.kind!=='enter'&&phase.kind!=='exit'){
      result.push(phase);continue;
    }
    const first=Math.round(phase.start*100),last=Math.round(phase.end*100);
    const whole=last-first;
    // At most 8 short ASS pieces per animated phase. Enforce >=4cs
    // per piece for a bounded graph and avoid zero-duration events.
    const count=Math.min(8,Math.floor(whole/4));
    if(count<2){result.push(phase);continue;}
    for(let k=0;k<count;k++){
      const beginCs=first+Math.round(whole*k/count);
      const finishCs=first+Math.round(whole*(k+1)/count);
      if(finishCs<=beginCs)continue;
      const start=beginCs/100,end=finishCs/100;
      const from=titleMotionAt(title,start);
      const to=titleMotionAt(title,Math.min(end,title.end-1e-9));
      result.push({kind:'eased-piece',start,end,from,to,
        opacityFrom:titleMotionOpacity(title,start),
        opacityTo:titleMotionOpacity(title,end)});
    }
  }
  return result;
}
