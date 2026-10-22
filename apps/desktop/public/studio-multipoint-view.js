// R6.9: multi-point visual editor. A gesture previews in DOM; one release
// creates one receipt through the existing validated change() pipeline.
import {pointsField,keyframePointsFor,keyframeCurveAt,addKeyframePoint,
  moveKeyframePoint,removeKeyframePoint,validateKeyframePoints,
  KEYFRAME_POINT_LIMIT} from './studio-keyframe-points.js';
import {keyframeLanePlan,keyframePercentFromY}
  from './studio-keyframe-lanes.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const round=n=>Math.round(n*1000)/1000;
const pathFor=points=>'M '+points.map(p=>(p.at*100)+' '+(100-p.value*100)).join(' L ');
export function renderMultiPointKeyframeLanes({
  root,opacityLane,volumeLane,clip,total,playhead,getPlayhead=()=>playhead,editable,onCommit,onError=()=>{},
  document:doc=document
}){
  root.hidden=!clip;
  for(const [property,lane] of [['opacity',opacityLane],['volume',volumeLane]]){
    lane.replaceChildren();
    const allowed=Boolean(clip)&&(property==='volume'||clip.track_id==='video-2');
    lane.hidden=!allowed;
    if(!allowed)continue;
    const plan=keyframeLanePlan(clip,property,total);
    const points=keyframePointsFor(clip,plan.field);
    const hasPoints=clip[pointsField(plan.field)]!==undefined;
    const marker=doc.createElement('span');
    marker.className='keyframe-lane-name';
    marker.textContent=(property==='opacity'?'V2 OPACITY':'CLIP VOLUME')+
      ' · '+points.length+' points';
    lane.append(marker);
    const plot=doc.createElement('div');
    plot.className='keyframe-plot'+(hasPoints||plan.active?' active':' neutral');
    plot.style.left=plan.left+'%';plot.style.width=plan.width+'%';
    const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 100 100');
    svg.setAttribute('preserveAspectRatio','none');
    svg.classList.add('keyframe-svg');
    const path=doc.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',pathFor(points));svg.append(path);plot.append(svg);
    const handles=[];
    function preview(next){
      path.setAttribute('d',pathFor(next));
      next.forEach((p,i)=>{
        handles[i].style.left=(p.at*100)+'%';
        handles[i].style.top=(100-p.value*100)+'%';
        handles[i].setAttribute('aria-valuenow',String(Math.round(p.value*100)));
        handles[i].title=property+' point '+(i+1)+': '+Math.round(p.at*100)+
          '% time / '+Math.round(p.value*100)+'% value';
      });
    }
    function commit(next,focusIndex=null){
      if(!editable)return;
      try{
        const v=validateKeyframePoints(next);
        if(JSON.stringify(v)===JSON.stringify(points))return;
        onCommit({type:'clip.keyframe.points.updated',clip_id:clip.clip_id,
          field:plan.field,points:v});
        if(focusIndex!==null)root.querySelector(
          '[data-keyframe-property="'+property+'"][data-point-index="'+focusIndex+'"]'
        )?.focus({preventScroll:true});
      }catch(e){onError(e.message);}
    }
    function add(at,value){
      try{
        const next=addKeyframePoint(points,at,value);
        const index=next.findIndex(p=>p.at===round(at));
        commit(next,index);
      }catch(e){onError(e.message);}
    }
    const addButton=doc.createElement('button');
    addButton.type='button';addButton.className='keyframe-add';
    addButton.textContent='+ Point at Playhead';
    addButton.disabled=!editable||points.length>=KEYFRAME_POINT_LIMIT;
    addButton.addEventListener('click',event=>{
      event.stopPropagation();
      const at=round((getPlayhead()-clip.timeline.start)/
        (clip.timeline.end-clip.timeline.start));
      add(at,round(keyframeCurveAt(points,at)));
    });
    lane.append(addButton);
    plot.addEventListener('dblclick',event=>{
      if(!editable||event.target!==plot)return;
      const rect=plot.getBoundingClientRect();
      const at=round(clamp((event.clientX-rect.left)/rect.width,0,1));
      const value=keyframePercentFromY(event.clientY,rect.top,rect.height)/100;
      add(at,value);
    });
    for(let index=0;index<points.length;index++){
      const isEndpoint=index===0||index===points.length-1;
      const handle=doc.createElement('button');handles.push(handle);
      handle.type='button';handle.className='keyframe-diamond'+
        (isEndpoint?' keyframe-'+(index===0?'start':'end'):' keyframe-middle');
      handle.textContent='◆';handle.dataset.keyframeProperty=property;
      handle.dataset.pointIndex=String(index);
      // Retain R6.8-compatible endpoint hooks for keyboard/browser automation.
      if(isEndpoint)handle.dataset.keyframeEndpoint=index===0?'start':'end';
      handle.disabled=!editable;
      handle.setAttribute('role','slider');
      handle.setAttribute('aria-label',property+' point '+(index+1)+' of '+points.length);
      handle.setAttribute('aria-valuemin','0');handle.setAttribute('aria-valuemax','100');
      handle.setAttribute('aria-orientation','vertical');
      let drag=null;
      function adjusted(event,current){
        const rect=plot.getBoundingClientRect();
        const value=keyframePercentFromY(event.clientY,rect.top,rect.height)/100;
        const min=isEndpoint?points[index].at:points[index-1].at+.01;
        const max=isEndpoint?points[index].at:points[index+1].at-.01;
        const at=isEndpoint?points[index].at:
          round(clamp((event.clientX-rect.left)/rect.width,min,max));
        return moveKeyframePoint(current,index,at,value);
      }
      handle.addEventListener('pointerdown',event=>{
        if(event.button!==0||handle.disabled)return;
        drag={id:event.pointerId,points:points.map(p=>({...p}))};
        handle.setPointerCapture(event.pointerId);
        event.stopPropagation();event.preventDefault();
      });
      handle.addEventListener('pointermove',event=>{
        if(!drag||drag.id!==event.pointerId)return;
        drag.points=adjusted(event,drag.points);
        preview(drag.points);
      });
      handle.addEventListener('pointerup',event=>{
        if(!drag||drag.id!==event.pointerId)return;
        const next=adjusted(event,drag.points);
        drag=null;
        if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
        event.stopPropagation();
        commit(next,index);
      });
      handle.addEventListener('pointercancel',()=>{drag=null;preview(points);});
      handle.addEventListener('lostpointercapture',()=>{
        if(drag){drag=null;preview(points);}
      });
      handle.addEventListener('dblclick',event=>event.stopPropagation());
      handle.addEventListener('keydown',event=>{
        if(handle.disabled)return;
        const up=['ArrowUp','ArrowRight'].includes(event.key);
        const down=['ArrowDown','ArrowLeft'].includes(event.key);
        let next;
        if(!isEndpoint&&(event.key==='Delete'||event.key==='Backspace')){
          event.preventDefault();event.stopPropagation();
          try{commit(removeKeyframePoint(points,index));}catch(e){onError(e.message);}
          return;
        }
        if(event.key==='Home'||event.key==='End'){
          next=moveKeyframePoint(points,index,points[index].at,
            event.key==='Home'?0:1);
        }else if(!isEndpoint&&['ArrowLeft','ArrowRight'].includes(event.key)){
          const step=event.shiftKey ? 0.1 : 0.01;
          const at=clamp(round(points[index].at+(event.key==='ArrowRight'?step:-step)),
            points[index-1].at+.01,points[index+1].at-.01);
          next=moveKeyframePoint(points,index,at,points[index].value);
        }else if(up||down){
          const delta=(event.shiftKey ? 0.1 : 0.05)*(up?1:-1);
          next=moveKeyframePoint(points,index,points[index].at,
            clamp(round(points[index].value+delta),0,1));
        }else return;
        event.preventDefault();event.stopPropagation();
        commit(next,index);
      });
      plot.append(handle);
    }
    preview(points);
    lane.append(plot);
  }
}
