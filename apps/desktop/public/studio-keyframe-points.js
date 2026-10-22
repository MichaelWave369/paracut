// ParaCut R6.9: bounded multi-point linear automation, optional alongside
// existing R6.7 Start/End pairs. All times are normalized clip progress.
// Two fixed endpoints, up to six editable interior diamonds.
export const KEYFRAME_POINT_LIMIT=8;
export const KEYFRAME_EASES=Object.freeze(['linear','ease-in','ease-out','ease-in-out','bezier']);
export const DEFAULT_BEZIER_HANDLES=Object.freeze([.25,.75]);
function bezierFactor(u,handles){
  const v=1-u;
  return 3*v*v*u*handles[0]+3*v*u*u*handles[1]+u*u*u;
}
function bezierExpression(u,handles){
  const v='(1-('+u+'))';
  return '(3*'+v+'*'+v+'*('+u+')*'+n(handles[0])+
    '+3*'+v+'*('+u+')*('+u+')*'+n(handles[1])+
    '+('+u+')*('+u+')*('+u+'))';
}

function easingAt(u,kind='linear',handles=DEFAULT_BEZIER_HANDLES){
  if(kind==='bezier')return bezierFactor(u,handles);
  if(kind==='ease-in')return u*u;
  if(kind==='ease-out')return 1-(1-u)*(1-u);
  if(kind==='ease-in-out')return u*u*(3-2*u);
  return u;
}
function easingExpression(u,kind='linear',handles=DEFAULT_BEZIER_HANDLES){
  if(kind==='bezier')return bezierExpression(u,handles);
  if(kind==='ease-in')return '('+u+')*('+u+')';
  if(kind==='ease-out')return '1-(1-('+u+'))*(1-('+u+'))';
  if(kind==='ease-in-out')return '('+u+')*('+u+')*(3-2*('+u+'))';
  return u;
}

const round=n=>Math.round(n*1000)/1000;
const n=v=>String(Number(v.toFixed(5)));
export function pointsField(field){
  if(field==='opacity_keyframes')return 'opacity_keyframe_points';
  if(field==='volume_keyframes')return 'volume_keyframe_points';
  throw Error('Unsupported keyframe property.');
}
export function validateKeyframePoints(raw){
  if(!Array.isArray(raw)||raw.length<2||raw.length>KEYFRAME_POINT_LIMIT)
    throw Error('Keyframe curve must contain 2–8 points.');
  const points=raw.map((p,index)=>{
    if(!p||typeof p!=='object'||Array.isArray(p)||
      (Object.keys(p).length<2||Object.keys(p).length>4)||
      Object.keys(p).some(k=>!['at','value','ease','handles'].includes(k))||
      (p.ease==='bezier'
        ?(!Array.isArray(p.handles)||p.handles.length!==2||
          p.handles.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>1))
        :p.handles!==undefined)||
      (p.ease!==undefined&&(!KEYFRAME_EASES.includes(p.ease)||
        index===raw.length-1))||
      typeof p.at!=='number'||!Number.isFinite(p.at)||
      typeof p.value!=='number'||!Number.isFinite(p.value)||
      p.at<0||p.at>1||p.value<0||p.value>1)
      throw Error('Invalid keyframe curve point.');
    return {at:round(p.at),value:round(p.value),
      ...(p.ease!==undefined&&p.ease!=='linear'?{ease:p.ease}:{}) ,
      ...(p.ease==='bezier'?{handles:p.handles.map(round)}:{})};
  });
  if(points[0].at!==0||points.at(-1).at!==1)
    throw Error('Keyframe curve endpoints must be at 0 and 1.');
  for(let i=1;i<points.length;i++)
    if(points[i].at-points[i-1].at<.01-.000001)
      throw Error('Keyframe points must be sorted and separated by at least 1%.');
  return points;
}
export function keyframePointsFor(clip,field){
  const key=pointsField(field);
  if(clip?.[key]!==undefined)return validateKeyframePoints(clip[key]);
  const pair=clip?.[field];
  if(pair!==undefined){
    const keys=Object.keys(pair||{});
    if(keys.length!==2||!keys.includes('start')||!keys.includes('end'))
      throw Error('Invalid original keyframe pair.');
    return validateKeyframePoints([{at:0,value:pair.start},{at:1,value:pair.end}]);
  }
  return [{at:0,value:1},{at:1,value:1}];
}
export function keyframeCurveAt(raw,progress){
  const points=validateKeyframePoints(raw);
  if(typeof progress!=='number'||!Number.isFinite(progress))
    throw Error('Invalid keyframe curve progress.');
  const u=Math.max(0,Math.min(1,progress));
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    if(u<=b.at)return a.value+(b.value-a.value)*
      easingAt((u-a.at)/(b.at-a.at),a.ease,a.handles);
  }
  return points.at(-1).value;
}
function validatePoint(at,value){
  if(typeof at!=='number'||!Number.isFinite(at)||typeof value!=='number'||
    !Number.isFinite(value)||at<0||at>1||value<0||value>1)
    throw Error('Invalid keyframe point values.');
  return {at:round(at),value:round(value)};
}
export function addKeyframePoint(raw,at,value){
  const points=validateKeyframePoints(raw);
  if(points.length>=KEYFRAME_POINT_LIMIT)throw Error('Maximum eight keyframe points.');
  const candidate=validatePoint(at,value);
  if(candidate.at<=0||candidate.at>=1)
    throw Error('Interior keyframes must be inside the clip.');
  return validateKeyframePoints([...points,candidate].sort((a,b)=>a.at-b.at));
}
export function moveKeyframePoint(raw,index,at,value){
  const points=validateKeyframePoints(raw);
  if(!Number.isInteger(index)||index<0||index>=points.length)
    throw Error('Invalid keyframe index.');
  const candidate=validatePoint(at,value);
  if((index===0&&candidate.at!==0)||
    (index===points.length-1&&candidate.at!==1))
    throw Error('Start and End keyframe times are fixed.');
  points[index]={...candidate,...(points[index].ease?{ease:points[index].ease}:{}),
    ...(points[index].handles?{handles:[...points[index].handles]}:{})};
  return validateKeyframePoints(points);
}
export function setKeyframeSegmentEase(raw,index,ease){
  const points=validateKeyframePoints(raw);
  if(!Number.isInteger(index)||index<0||index>=points.length-1)
    throw Error('Invalid keyframe segment index.');
  if(!KEYFRAME_EASES.includes(ease))throw Error('Invalid keyframe easing mode.');
  const {ease:oldEase,handles:oldHandles,...base}=points[index];
  points[index]=ease==='linear'?base:ease==='bezier'
    ?{...base,ease,handles:oldEase==='bezier'?oldHandles:[...DEFAULT_BEZIER_HANDLES]}
    :{...base,ease};
  return validateKeyframePoints(points);
}
export function setKeyframeBezierHandle(raw,index,which,value){
  const points=validateKeyframePoints(raw);
  if(!Number.isInteger(index)||index<0||index>=points.length-1||
    points[index].ease!=='bezier')
    throw Error('Invalid Bézier segment index or easing mode.');
  if(!Number.isInteger(which)||which<0||which>1||
    typeof value!=='number'||!Number.isFinite(value)||value<0||value>1)
    throw Error('Invalid Bézier handle value.');
  const handles=[...points[index].handles];
  handles[which]=round(value);
  points[index]={...points[index],handles};
  return validateKeyframePoints(points);
}
export function removeKeyframePoint(raw,index){
  const points=validateKeyframePoints(raw);
  if(!Number.isInteger(index)||index<=0||index>=points.length-1)
    throw Error('Only interior keyframes can be removed.');
  points.splice(index,1);
  return validateKeyframePoints(points);
}
export function keyframeCurveExpression(raw,duration,variable='t'){
  const points=validateKeyframePoints(raw);
  if(typeof duration!=='number'||!Number.isFinite(duration)||duration<=0||
    !['t','T'].includes(variable))throw Error('Invalid keyframe expression duration.');
  let expression=n(points.at(-1).value);
  for(let i=points.length-2;i>=0;i--){
    const a=points[i],b=points[i+1];
    const left=a.at*duration,right=b.at*duration;
    const slope=n(b.value-a.value),width=n(right-left);
    const rel=left===0?variable:'('+variable+'-'+n(left)+')';
    const u='min(1,max(0,'+rel+'/'+width+'))';
    const line=n(a.value)+'+('+slope+')*('+easingExpression(u,a.ease,a.handles)+')';
    expression='if(lt('+variable+','+n(right)+'),'+line+','+expression+')';
  }
  return expression;
}
