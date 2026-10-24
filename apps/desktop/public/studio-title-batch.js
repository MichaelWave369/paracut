// R8.7 atomic multi-title style/layout transformations.
// An explicitly chosen mode controls exactly which properties change.
// Text, IDs, timing, fades, motion and other title styling are untouched.
import {titleTransformClipboard} from './studio-title-align.js';
import {titlePlacementFields} from './studio-title-placement.js';
import {titleScaleFields} from './studio-title-transform.js';

export const TITLE_BATCH_MODES=Object.freeze(['transform','appearance','both']);
const COLORS=Object.freeze(['white','mint','gold']);
const SIZES=Object.freeze(['small','medium','large']);
export function titleBatchSelection(titles,ids){
  if(!Array.isArray(titles)||!Array.isArray(ids)||ids.length<2||ids.length>40||
     ids.some(id=>typeof id!=='string'||!id)||
     new Set(ids).size!==ids.length)
    throw Error('Select 2 to 40 unique titles for batch styling.');
  const validIds=new Set(titles.map(t=>t.title_id));
  if(ids.some(id=>!validIds.has(id)))
    throw Error('A selected title no longer exists.');
  return new Set(ids);
}
export function titleBatchAppearance(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||
     Object.keys(input).sort().join(',')!=='color,size'||
     !COLORS.includes(input.color)||!SIZES.includes(input.size))
    throw Error('Invalid batch title appearance.');
  return {color:input.color,size:input.size};
}
export function titleBatchPlan(titles,command){
  if(!Array.isArray(titles)||!command||typeof command!=='object'||
     !TITLE_BATCH_MODES.includes(command.mode))
    throw Error('Invalid title batch mode.');
  const ids=titleBatchSelection(titles,command.title_ids);
  const usesTransform=command.mode!=='appearance';
  const usesAppearance=command.mode!=='transform';
  if(usesTransform!==Object.hasOwn(command,'transform')||
     usesAppearance!==Object.hasOwn(command,'appearance'))
    throw Error('Batch payload does not match its mode.');
  const layout=usesTransform?
    titleTransformClipboard(command.transform?.placement,command.transform?.scale):null;
  const appearance=usesAppearance?titleBatchAppearance(command.appearance):null;
  const next=titles.map(title=>{
    if(!ids.has(title.title_id))return {...title};
    let changed={...title};
    if(layout){
      // Always discard stale XY/scale first, allowing copied Anchor layouts.
      delete changed.title_x;delete changed.title_y;delete changed.title_scale;
      Object.assign(changed,
        layout.placement?titlePlacementFields(layout.placement):{},
        titleScaleFields(layout.scale));
    }
    if(appearance)Object.assign(changed,appearance);
    return changed;
  });
  return {titles:next,count:ids.size,mode:command.mode};
}
export function titleBatchSummary(count,mode){
  if(!Number.isInteger(count)||count<0||count>40||!TITLE_BATCH_MODES.includes(mode))
    throw Error('Invalid title batch summary.');
  return count+' selected · '+({
    transform:'position and scale',appearance:'color and font size',
    both:'position, scale, color and font size'
  })[mode]+' · pending until Apply';
}
