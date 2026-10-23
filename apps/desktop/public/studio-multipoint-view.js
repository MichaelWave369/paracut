// R6.9: multi-point visual editor. A gesture previews in DOM; one release
// creates one receipt through the existing validated change() pipeline.
import {pointsField,keyframePointsFor,keyframeCurveAt,addKeyframePoint,
  moveKeyframePoint,removeKeyframePoint,validateKeyframePoints,
  KEYFRAME_POINT_LIMIT,KEYFRAME_EASES,setKeyframeSegmentEase,
  setKeyframeBezierHandle,setKeyframeBezierHandlePosition,DEFAULT_BEZIER_X} from './studio-keyframe-points.js';
import {keyframeLanePlan,keyframePercentFromY}
  from './studio-keyframe-lanes.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const round=n=>Math.round(n*1000)/1000;
const selectedEaseSegments=new Map(); // view preference only; never part of the draft
const selectedPrecisionHandles=new Map(); // UI only, never saved
export function curvePathFor(points){
  // Linear curves retain their original path. Eased sections are sampled for
  // SVG only; the actual Program/export values use the shared curve math.
  if(points.every(p=>!p.ease))return 'M '+points.map(
    p=>(p.at*100)+' '+(100-p.value*100)).join(' L ');
  const xy=(at,value)=>(Math.round(at*100000)/1000)+' '+
    (Math.round((1-value)*100000)/1000);
  let path='M '+xy(points[0].at,points[0].value);
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1],steps=a.handles_x?64:a.ease?24:1;
    for(let step=1;step<=steps;step++){
      const at=a.at+(b.at-a.at)*step/steps;
      path+=' L '+xy(at,keyframeCurveAt(points,at));
    }
  }
  return path;
}
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
    path.setAttribute('d',curvePathFor(points));svg.append(path);
    const bezierGuide=doc.createElementNS('http://www.w3.org/2000/svg','path');
    bezierGuide.classList.add('keyframe-bezier-guide');
    svg.append(bezierGuide);plot.append(svg);
    const bezierOverlay=doc.createElement('div');
    bezierOverlay.className='keyframe-bezier-overlay';plot.append(bezierOverlay);
    let bezierButtons=[];
    const bezierPosition=(curve,index,which)=>{
      const a=curve[index],b=curve[index+1];
      const u=(a.handles_x??DEFAULT_BEZIER_X)[which];
      return {at:a.at+(b.at-a.at)*u,
        value:a.value+(b.value-a.value)*a.handles[which]};
    };
    function previewBezier(curve){
      const index=selectedEaseSegments.get(clip.clip_id+':'+property)??0;
      if(index<0||index>=curve.length-1||curve[index].ease!=='bezier'){
        bezierGuide.setAttribute('d','');return;
      }
      const a=curve[index],b=curve[index+1];
      const p=bezierPosition(curve,index,0),q=bezierPosition(curve,index,1);
      const xy=point=>(point.at*100)+' '+((1-point.value)*100);
      bezierGuide.setAttribute('d','M '+xy(a)+' L '+xy(p)+' M '+xy(q)+' L '+xy(b));
      bezierButtons.forEach((button,which)=>{
        const pos=which===0?p:q;
        button.style.left=(pos.at*100)+'%';
        button.style.top=((1-pos.value)*100)+'%';
        button.setAttribute('aria-valuenow',String(Math.round(a.handles[which]*100)));
        const xx=(a.handles_x??DEFAULT_BEZIER_X)[which];
        button.title='Control '+(which+1)+': X '+Math.round(xx*100)+'% / Y '+
          Math.round(a.handles[which]*100)+'%';
        button.setAttribute('aria-valuetext',button.title);
      });
    }

    const handles=[];
    function preview(next){
      path.setAttribute('d',curvePathFor(next));
      previewBezier(next);
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
    // One compact editor for the outgoing segment selected by the user.
    // Each dropdown change is exactly one receipt-backed clip update.
    const easeTools=doc.createElement('div');
    easeTools.className='keyframe-easing-controls';
    const segmentLabel=doc.createElement('label');
    segmentLabel.textContent='Segment ';
    const segmentSelect=doc.createElement('select');
    segmentSelect.setAttribute('aria-label',property+' easing segment');
    const selectionKey=clip.clip_id+':'+property;
    let segment=clamp(selectedEaseSegments.get(selectionKey)??0,0,points.length-2);
    selectedEaseSegments.set(selectionKey,segment);
    for(let i=0;i<points.length-1;i++){
      const option=doc.createElement('option');
      option.value=String(i);option.textContent=(i+1)+'→'+(i+2);
      segmentSelect.append(option);
    }
    segmentSelect.value=String(segment);
    segmentSelect.disabled=!editable;
    segmentLabel.append(segmentSelect);
    const easeLabel=doc.createElement('label');
    easeLabel.textContent='Ease ';
    const easeSelect=doc.createElement('select');
    easeSelect.dataset.keyframeEasing=property;
    easeSelect.setAttribute('aria-label',property+' segment easing');
    for(const value of KEYFRAME_EASES){
      const option=doc.createElement('option');option.value=value;
      option.textContent=value==='linear'?'Linear':
        value==='ease-in'?'Ease In':value==='ease-out'?'Ease Out':
        value==='ease-in-out'?'Ease In/Out':'Custom Bézier';
      easeSelect.append(option);
    }
    easeSelect.value=points[segment].ease||'linear';
    easeSelect.disabled=!editable;
    segmentSelect.addEventListener('change',()=>{
      segment=Number(segmentSelect.value);
      if(!Number.isInteger(segment)||segment<0||segment>=points.length-1)return;
      selectedEaseSegments.set(selectionKey,segment);
      easeSelect.value=points[segment].ease||'linear';
      buildBezierHandles();
      syncPrecision();
    });
    easeSelect.addEventListener('change',()=>{
      if(!editable)return;
      const index=selectedEaseSegments.get(selectionKey)??0;
      try{
        commit(setKeyframeSegmentEase(points,index,easeSelect.value));
        root.querySelector('[data-keyframe-easing="'+property+'"]')
          ?.focus({preventScroll:true});
      }catch(e){onError(e.message);}
    });
    easeLabel.append(easeSelect);
    easeTools.append(segmentLabel,easeLabel);
    lane.append(easeTools);
    // Exact handle coordinates are committed only on Apply, not on typing.
    // Selection and in-progress fields are local UI state, not project data.
    const precise=doc.createElement('div');
    precise.className='keyframe-precision-controls';
    const handleLabel=doc.createElement('label');
    handleLabel.textContent='Handle ';
    const handlePick=doc.createElement('select');
    handlePick.setAttribute('aria-label',property+' precision handle');
    for(let i=0;i<2;i++){
      const option=doc.createElement('option');option.value=String(i);
      option.textContent=String(i+1);handlePick.append(option);
    }
    handleLabel.append(handlePick);
    const axisField=(axis)=>{
      const label=doc.createElement('label');
      label.textContent=axis+' % ';
      const input=doc.createElement('input');
      input.type='number';input.min='0';input.max='100';input.step='.1';
      input.setAttribute('aria-label',property+' Bézier '+axis+' percentage');
      label.append(input);
      return {label,input};
    };
    const px=axisField('X'),py=axisField('Y');
    const apply=doc.createElement('button');apply.type='button';
    apply.className='keyframe-precision-apply';apply.textContent='Apply XY';
    const readSelection=()=>selectedEaseSegments.get(selectionKey)??0;
    function syncPrecision(){
      const index=readSelection(),segmentPoint=points[index];
      precise.hidden=!(segmentPoint?.ease==='bezier');
      if(precise.hidden)return;
      const which=selectedPrecisionHandles.get(selectionKey)??0;
      handlePick.value=String(which);
      px.input.value=String(Math.round(
        (segmentPoint.handles_x??DEFAULT_BEZIER_X)[which]*10000)/100);
      py.input.value=String(Math.round(segmentPoint.handles[which]*10000)/100);
      for(const element of [handlePick,px.input,py.input,apply])
        element.disabled=!editable;
    }
    handlePick.addEventListener('change',()=>{
      const which=Number(handlePick.value);
      if(!Number.isInteger(which)||which<0||which>1)return;
      selectedPrecisionHandles.set(selectionKey,which);syncPrecision();
    });
    apply.addEventListener('click',event=>{
      event.stopPropagation();
      if(!editable)return;
      try{
        if(String(px.input.value).trim()===''||String(py.input.value).trim()==='')
          throw Error('Enter both Bézier handle coordinates.');
        const x=Number(px.input.value)/100,y=Number(py.input.value)/100;
        const index=readSelection();
        const which=selectedPrecisionHandles.get(selectionKey)??0;
        const next=setKeyframeBezierHandlePosition(points,index,which,x,y);
        commit(next);
        root.querySelector('[data-keyframe-precision="'+property+'"]')
          ?.focus({preventScroll:true});
      }catch(error){onError(error.message);}
    });
    apply.dataset.keyframePrecision=property;
    precise.append(handleLabel,px.label,py.label,apply);
    lane.append(precise);
    syncPrecision();
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
    function buildBezierHandles(){
      bezierOverlay.replaceChildren();bezierButtons=[];
      const index=selectedEaseSegments.get(selectionKey)??0;
      if(index>=points.length-1||points[index]?.ease!=='bezier'){
        bezierGuide.setAttribute('d','');return;
      }
      for(let which=0;which<2;which++){
        const control=doc.createElement('button');
        control.type='button';
        control.className='keyframe-bezier-handle';
        control.dataset.keyframeBezier=property;
        control.dataset.controlIndex=String(which);
        control.textContent=which===0?'1':'2';
        control.disabled=!editable;
        control.setAttribute('role','slider');
        control.setAttribute('aria-label',property+' cubic Bézier control '+(which+1)+
          ' — left/right time and up/down value');
        control.setAttribute('aria-valuemin','0');
        control.setAttribute('aria-valuemax','100');
        // A 2D control: arrow left/right adjusts time, up/down adjusts value.
        let drag=null;
        const startX=()=>((points[index].handles_x??DEFAULT_BEZIER_X)[which]);
        const restrictX=value=>{
          const pair=points[index].handles_x??DEFAULT_BEZIER_X;
          return clamp(round(value),which===0?0:pair[0],which===0?pair[1]:1);
        };
        function editXY(x,y){
          return setKeyframeBezierHandlePosition(points,index,which,
            restrictX(x),clamp(round(y),0,1));
        }
        function editValue(value){
          return setKeyframeBezierHandle(points,index,which,
            clamp(round(value),0,1));
        }
        control.addEventListener('pointerdown',event=>{
          if(event.button!==0||control.disabled)return;
          drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,
            x:startX(),y:points[index].handles[which],next:points};
          control.setPointerCapture(event.pointerId);
          event.preventDefault();event.stopPropagation();
        });
        function moved(event){
          const rect=plot.getBoundingClientRect();
          const span=points[index+1].at-points[index].at;
          if(!Number.isFinite(rect.height)||rect.height<=0||
            !Number.isFinite(rect.width)||rect.width<=0||span<=0)
            throw Error('Invalid Bézier editor geometry.');
          const x=drag.x+(event.clientX-drag.startX)/(rect.width*span);
          const y=drag.y+(drag.startY-event.clientY)/rect.height;
          return editXY(x,y);
        }
        control.addEventListener('pointermove',event=>{
          if(!drag||drag.id!==event.pointerId)return;
          try{
            drag.next=moved(event);
            path.setAttribute('d',curvePathFor(drag.next));
            previewBezier(drag.next);
          }catch(e){onError(e.message);}
        });
        control.addEventListener('pointerup',event=>{
          if(!drag||drag.id!==event.pointerId)return;
          let next=drag.next;
          try{next=moved(event);}catch(e){onError(e.message);}
          drag=null;
          if(control.hasPointerCapture(event.pointerId))
            control.releasePointerCapture(event.pointerId);
          event.preventDefault();event.stopPropagation();
          commit(next);
          root.querySelector('[data-keyframe-bezier="'+property+
            '"][data-control-index="'+which+'"]')?.focus({preventScroll:true});
        });
        control.addEventListener('pointercancel',()=>{
          drag=null;path.setAttribute('d',curvePathFor(points));previewBezier(points);
        });
        control.addEventListener('lostpointercapture',()=>{
          if(drag){
            drag=null;path.setAttribute('d',curvePathFor(points));previewBezier(points);
          }
        });
        control.addEventListener('dblclick',event=>event.stopPropagation());
        control.addEventListener('keydown',event=>{
          if(control.disabled)return;
          const up=event.key==='ArrowUp',down=event.key==='ArrowDown';
          const right=event.key==='ArrowRight',left=event.key==='ArrowLeft';
          if(!up&&!down&&!right&&!left&&event.key!=='Home'&&event.key!=='End')return;
          event.preventDefault();event.stopPropagation();
          try{
            if(left||right){
              const x=startX()+(right?1:-1)*(event.shiftKey?0.1:0.025);
              commit(editXY(x,points[index].handles[which]));
            }else{
              const v=event.key==='Home'?0:event.key==='End'?1:
                points[index].handles[which]+(up?1:-1)*(event.shiftKey ? 0.1 : 0.05);
              commit(editValue(v));
            }
            root.querySelector('[data-keyframe-bezier="'+property+
              '"][data-control-index="'+which+'"]')?.focus({preventScroll:true});
          }catch(e){onError(e.message);}
        });
        bezierButtons.push(control);bezierOverlay.append(control);
      }
      previewBezier(points);
    }
    buildBezierHandles();
    preview(points);
    lane.append(plot);
  }
}
