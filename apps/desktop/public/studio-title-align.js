// ParaCut R8.6: local-only title placement presets and reusable transforms.
// All coordinates target center points inside the 20% title-safe grid.
import {titlePlacementFields,titleAnchor} from './studio-title-placement.js';
import {titleScale,titleScaleFields} from './studio-title-transform.js';

export const TITLE_ALIGNMENTS=Object.freeze([
  Object.freeze({id:'top-left',label:'Top Left',x:256,y:144}),
  Object.freeze({id:'top-center',label:'Top Center',x:640,y:144}),
  Object.freeze({id:'top-right',label:'Top Right',x:1024,y:144}),
  Object.freeze({id:'middle-left',label:'Middle Left',x:256,y:360}),
  Object.freeze({id:'middle-center',label:'Center',x:640,y:360}),
  Object.freeze({id:'middle-right',label:'Middle Right',x:1024,y:360}),
  Object.freeze({id:'bottom-left',label:'Bottom Left',x:256,y:576}),
  Object.freeze({id:'bottom-center',label:'Bottom Center',x:640,y:576}),
  Object.freeze({id:'bottom-right',label:'Bottom Right',x:1024,y:576})
]);
export const TITLE_TRANSFORM_PRESETS=Object.freeze([
  Object.freeze({id:'hero',label:'Hero Center',align:'middle-center',scale:150}),
  Object.freeze({id:'lower-third',label:'Lower Third',align:'bottom-center',scale:100}),
  Object.freeze({id:'chapter',label:'Chapter Heading',align:'top-center',scale:125}),
  Object.freeze({id:'left-label',label:'Left Label',align:'middle-left',scale:85}),
  Object.freeze({id:'right-note',label:'Right Note',align:'middle-right',scale:85}),
  Object.freeze({id:'end-card',label:'End Card',align:'middle-center',scale:125})
]);
const copyPoint=point=>{
  const checked=titlePlacementFields(point);
  return {x:checked.title_x,y:checked.title_y};
};
export function titleAlignmentPoint(id){
  const hit=TITLE_ALIGNMENTS.find(item=>item.id===id);
  if(!hit)throw Error('Unknown title alignment.');
  return {x:hit.x,y:hit.y};
}
export function titleAlignmentId(point){
  if(!point)return null;
  const checked=copyPoint(point);
  return TITLE_ALIGNMENTS.find(item=>item.x===checked.x&&item.y===checked.y)?.id??null;
}
export function titleTransformPreset(id){
  const p=TITLE_TRANSFORM_PRESETS.find(item=>item.id===id);
  if(!p)throw Error('Unknown title transform preset.');
  return {placement:titleAlignmentPoint(p.align),scale:titleScale({title_scale:p.scale})};
}
export function titleTransformClipboard(point,scale){
  const saved=point===null?null:copyPoint(point);
  return {placement:saved,scale:titleScale({title_scale:scale})};
}
export function titleClipboardFromTitle(title){
  if(!title||typeof title!=='object')throw Error('Invalid title transform source.');
  const hasX=title.title_x!==undefined,hasY=title.title_y!==undefined;
  if(hasX!==hasY)throw Error('Title coordinates must be supplied together.');
  const point=hasX?{x:title.title_x,y:title.title_y}:null;
  return titleTransformClipboard(point,titleScale(title));
}
export function titleClipboardFields(clipboard){
  if(!clipboard||typeof clipboard!=='object')
    throw Error('No copied title transform.');
  const snapshot=titleTransformClipboard(clipboard.placement,clipboard.scale);
  return {...(snapshot.placement?titlePlacementFields(snapshot.placement):{}),
    ...titleScaleFields(snapshot.scale)};
}
export function titleTransformReadout(point,scale){
  const normalized=titleTransformClipboard(point,scale);
  if(!normalized.placement)return 'Anchor · '+normalized.scale+'% size · draft only';
  const align=titleAlignmentId(normalized.placement);
  return (align
    ?TITLE_ALIGNMENTS.find(a=>a.id===align).label
    :'X '+normalized.placement.x+' / Y '+normalized.placement.y)+
    ' · '+normalized.scale+'% size · draft only';
}
