// R8.4 title placement in fixed 1280×720 composition pixels.
// Optional coordinates are a complete x/y pair. Legacy titles never gain
// implicit coordinates and keep their historical native renderer styling.
export const TITLE_PLACEMENT_BOUNDS=Object.freeze({
  minX:80,maxX:1200,minY:60,maxY:660,width:1280,height:720
});
const ANCHORS=Object.freeze({top:120,middle:360,bottom:620});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
export function titlePlacement(title){
  if(!title||typeof title!=='object')throw Error('Invalid title placement.');
  const hasX=Object.hasOwn(title,'title_x')&&title.title_x!==undefined;
  const hasY=Object.hasOwn(title,'title_y')&&title.title_y!==undefined;
  if(hasX!==hasY)throw Error('Title X and Y must be provided together.');
  if(!hasX)return null;
  const {title_x:x,title_y:y}=title;
  const b=TITLE_PLACEMENT_BOUNDS;
  if(!Number.isInteger(x)||!Number.isInteger(y)||
     x<b.minX||x>b.maxX||y<b.minY||y>b.maxY)
    throw Error('Invalid title position (X 80–1200, Y 60–660).');
  return {x,y};
}
export function titleAnchor(title){
  if(!title||!Object.hasOwn(ANCHORS,title.position??'bottom'))
    throw Error('Invalid title anchor.');
  return titlePlacement(title)||{x:640,y:ANCHORS[title.position??'bottom']};
}
export function titlePlacementAtPointer(rect,clientX,clientY,{snap=true}={}){
  if(!rect||![rect.left,rect.top,rect.width,rect.height,clientX,clientY].every(finite)||
     rect.width<=0||rect.height<=0)throw Error('Invalid Program Monitor geometry.');
  const b=TITLE_PLACEMENT_BOUNDS;
  const x=(clientX-rect.left)*b.width/rect.width;
  const y=(clientY-rect.top)*b.height/rect.height;
  return titleNudgePlacement({x:640,y:360},x-640,y-360,{snap});
}
export function titleNudgePlacement(point,dx,dy,{snap=false}={}){
  const b=TITLE_PLACEMENT_BOUNDS;
  if(!point||![point.x,point.y,dx,dy].every(finite))
    throw Error('Invalid title placement movement.');
  let x=clamp(Math.round(point.x+dx),b.minX,b.maxX);
  let y=clamp(Math.round(point.y+dy),b.minY,b.maxY);
  if(snap){
    if(Math.abs(x-640)<=14)x=640;
    for(const guide of [120,360,620])
      if(Math.abs(y-guide)<=14){y=guide;break;}
  }
  return {x,y};
}
export function titlePlacementFields(point){
  if(!point)return {};
  const checked=titlePlacement({title_x:point.x,title_y:point.y});
  return {title_x:checked.x,title_y:checked.y};
}
