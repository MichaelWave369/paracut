// ParaCut R6.3: safe preview/validation for synchronized V1 ripple deletion.
// V1 already ripples on ordinary Delete. This opt-in command additionally shifts
// later absolute-time V2, A2 and title events. A1 stays independently timed.
const r=x=>Math.round(x*1000)/1000;
export function synchronizedRipplePlan(state,clipId) {
  const lane=state?.clips;
  if(!Array.isArray(lane)||typeof clipId!=='string')throw Error('Select a V1 clip to ripple delete.');
  const index=lane.findIndex(c=>c.clip_id===clipId);
  if(index<0)throw Error('Synchronized Ripple Delete requires a selected V1 clip.');
  const clip=lane[index];
  if((index>0&&(lane[index-1].transition_out_seconds??0)>0)||
     (clip.transition_out_seconds??0)>0)
    throw Error('Remove V1 dissolves touching this clip before synchronized Ripple Delete.');
  const start=clip.timeline.start,end=clip.timeline.end,span=r(end-start);
  if(!Number.isFinite(start)||!Number.isFinite(end)||span<.08)
    throw Error('Invalid V1 ripple deletion range.');
  const affected={v2:[],a2:[],titles:[]};
  const lanes=[
    [state.video2Clips,'v2'],[state.audio2Clips,'a2'],[state.titles,'titles']
  ];
  for(const [items,key] of lanes){
    if(!Array.isArray(items))throw Error('Invalid layered media for synchronized ripple.');
    for(const item of items) {
      const a=item.timeline?.start??item.start,b=item.timeline?.end??item.end;
      if(!Number.isFinite(a)||!Number.isFinite(b))throw Error('Invalid layer timing.');
      if(a<end-.001 && b>start+.001)
        throw Error('A '+key+' clip/title overlaps the removed V1 range. Move, trim or remove it first.');
      if(a>=end-.001)affected[key].push(key==='titles'?item.title_id:item.clip_id);
    }
  }
  return {start:r(start),end:r(end),span,clipId,affected,
    shiftCount:affected.v2.length+affected.a2.length+affected.titles.length};
}
