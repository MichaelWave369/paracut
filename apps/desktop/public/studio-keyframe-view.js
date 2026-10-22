// R6.8: accessible, clip-aligned two-point curves in a dedicated timeline lane.
// Drag previews locally; one released handle creates one validated core receipt.
import {validateKeyframePair} from './studio-keyframes.js';
import {keyframeLanePlan,keyframePercentFromY,editKeyframeEndpoint,lanePath}
 from './studio-keyframe-lanes.js';
export function renderVisualKeyframeLanes({
  root,opacityLane,volumeLane,clip,total,editable,onCommit,document:doc=document
}) {
  root.hidden=!clip;
  for(const [property,lane] of [['opacity',opacityLane],['volume',volumeLane]]) {
    lane.replaceChildren();
    const allowed=Boolean(clip)&&(property==='volume'||clip.track_id==='video-2');
    lane.hidden=!allowed;
    if(!allowed)continue;
    const plan=keyframeLanePlan(clip,property,total);
    const legend=doc.createElement('span');
    legend.className='keyframe-lane-name';
    legend.textContent=property==='opacity'?'V2 OPACITY':'CLIP VOLUME';
    lane.append(legend);
    const plot=doc.createElement('div');
    plot.className='keyframe-plot'+(plan.active?' active':' neutral');
    plot.style.left=plan.left+'%';plot.style.width=plan.width+'%';
    plot.setAttribute('aria-label',property+' automation curve for selected clip');
    const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 100 100');
    svg.setAttribute('preserveAspectRatio','none');
    svg.classList.add('keyframe-svg');
    const path=doc.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',lanePath(plan.values));svg.append(path);plot.append(svg);
    const handles={};
    function updateView(values) {
      path.setAttribute('d',lanePath(values));
      for(const endpoint of ['start','end']){
        handles[endpoint].style.top=String(100-values[endpoint]*100)+'%';
        handles[endpoint].setAttribute('aria-valuenow',String(Math.round(values[endpoint]*100)));
        handles[endpoint].title=property+' '+endpoint+': '+Math.round(values[endpoint]*100)+'%';
      }
    }
    function commit(values){
      if(!editable)return;
      const v=validateKeyframePair(values);
      if(plan.active&&v.start===plan.values.start&&v.end===plan.values.end)return;
      onCommit({type:'clip.keyframes.updated',clip_id:clip.clip_id,
        field:plan.field,values:v});
    }
    for(const endpoint of ['start','end']){
      const handle=doc.createElement('button');handles[endpoint]=handle;
      handle.type='button';handle.className='keyframe-diamond keyframe-'+endpoint;
      handle.textContent='◆';
      handle.style.left=endpoint==='start'?'0%':'100%';
      handle.disabled=!editable;
      handle.setAttribute('aria-label',property+' '+endpoint+' keyframe');
      handle.setAttribute('aria-valuemin','0');
      handle.setAttribute('aria-valuemax','100');
      handle.setAttribute('aria-valuenow',String(Math.round(plan.values[endpoint]*100)));
      handle.setAttribute('role','slider');handle.setAttribute('aria-orientation','vertical');
      let drag=null;
      handle.addEventListener('pointerdown',event=>{
        if(event.button!==0||handle.disabled)return;
        drag={id:event.pointerId,values:{...plan.values}};
        handle.setPointerCapture(event.pointerId);
        event.stopPropagation();event.preventDefault();
      });
      handle.addEventListener('pointermove',event=>{
        if(!drag||drag.id!==event.pointerId)return;
        const rect=plot.getBoundingClientRect();
        drag.values=editKeyframeEndpoint(drag.values,endpoint,
          keyframePercentFromY(event.clientY,rect.top,rect.height));
        updateView(drag.values);
      });
      handle.addEventListener('pointerup',event=>{
        if(!drag||drag.id!==event.pointerId)return;
        const rect=plot.getBoundingClientRect();
        const v=editKeyframeEndpoint(drag.values,endpoint,
          keyframePercentFromY(event.clientY,rect.top,rect.height));
        drag=null;
        // Releasing pointer capture before committing avoids destroying a captured DOM node.
        if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
        event.stopPropagation();
        commit(v);
      });
      handle.addEventListener('pointercancel',()=>{
        drag=null;updateView(plan.values);
      });
      handle.addEventListener('lostpointercapture',()=>{
        if(drag){drag=null;updateView(plan.values);}
      });
      handle.addEventListener('keydown',event=>{
        if(handle.disabled)return;
        const base=Math.round(plan.values[endpoint]*100);
        let v;
        if(['ArrowUp','ArrowRight'].includes(event.key))
          v=Math.min(100,base+(event.shiftKey?10:5));
        else if(['ArrowDown','ArrowLeft'].includes(event.key))
          v=Math.max(0,base-(event.shiftKey?10:5));
        else if(event.key==='Home')v=0;
        else if(event.key==='End')v=100;
        else return;
        event.preventDefault();event.stopPropagation();
        commit(editKeyframeEndpoint(plan.values,endpoint,v));
      });
      plot.append(handle);
    }
    updateView(plan.values);
    lane.append(plot);
  }
}
