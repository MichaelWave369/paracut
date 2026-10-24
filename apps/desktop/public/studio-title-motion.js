// R8.2 title motion in 1280x720 composition coordinates.
// Only allowlisted motion IDs; translation is tied to existing opacity fades,
// so legacy titles and clips without fades remain visually unchanged.
export const TITLE_MOTIONS=Object.freeze([
  'none','float-up','slide-left','slide-right'
]);
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
  if(enters)return {x:delta.x*(1-age/fi),y:delta.y*(1-age/fi)};
  if(exits)return {x:-delta.x*(1-remaining/fo),y:-delta.y*(1-remaining/fo)};
  return {x:0,y:0};
}
export function titleMotionPhases(title,exportEnd){
  const mode=titleMotionId(title);
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
  const delta=MOTION_DELTAS[mode];
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
