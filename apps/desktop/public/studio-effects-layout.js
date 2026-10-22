// ParaCut R6.6: Inspector panel open/closed preferences.
// Pure view state: no clip changes, edit receipts or saved-draft fields.
export const EFFECTS_STORAGE_KEY='paracut.studio.effects.v1';
export const EFFECTS_SECTIONS=Object.freeze([
  'timing','motion','opacity','color','audio','attributes','metadata'
]);
export const EFFECTS_DEFAULTS=Object.freeze({
  timing:true,motion:true,opacity:true,color:true,audio:true,
  attributes:false,metadata:false
});
export function validateEffectsView(value) {
  if(!value||typeof value!=='object'||Array.isArray(value)||
     Object.keys(value).some(k=>!EFFECTS_SECTIONS.includes(k)))
    throw Error('Invalid effects panel preferences.');
  const out={...EFFECTS_DEFAULTS};
  for(const [key,open] of Object.entries(value)){
    if(typeof open!=='boolean')throw Error('Invalid '+key+' section visibility.');
    out[key]=open;
  }
  return out;
}
export function readEffectsView(storage){
  try{
    const raw=storage?.getItem(EFFECTS_STORAGE_KEY);
    return raw?validateEffectsView(JSON.parse(raw)):{...EFFECTS_DEFAULTS};
  }catch{return {...EFFECTS_DEFAULTS};}
}
export function writeEffectsView(storage,view){
  const safe=validateEffectsView(view);
  try{storage?.setItem(EFFECTS_STORAGE_KEY,JSON.stringify(safe));return true;}
  catch{return false;}
}
export function setEffectsSection(view,section,open){
  if(!EFFECTS_SECTIONS.includes(section)||typeof open!=='boolean')
    throw Error('Invalid effects section change.');
  return {...validateEffectsView(view),[section]:open};
}
export function allEffectsSections(open){
  if(typeof open!=='boolean')throw Error('Invalid effects section change.');
  return Object.fromEntries(EFFECTS_SECTIONS.map(key=>[key,open]));
}
export function effectsVisibility(clip){
  const video2=clip?.track_id==='video-2',video=Boolean(clip?.track_id?.startsWith('video-'));
  return {
    timing:Boolean(clip),motion:video2,opacity:video2,color:video,
    audio:Boolean(clip),attributes:video,metadata:Boolean(clip)
  };
}
export function effectsSummaries(clip) {
  const color=clip?.color||{};
  const graded=Boolean(clip&&(
    (color.brightness??1)!==1||(color.contrast??1)!==1||
    (color.saturation??1)!==1||(color.warmth??0)!==0));
  return {
    timing:clip?'Source '+Number(clip.source.end-clip.source.start).toFixed(2)+'s':'',
    motion:clip?.track_id==='video-2'
      ?((clip.overlay_layout??'pip')==='pip'?'PiP':'Full')+' · '+(clip.overlay_motion??'none'):'',
    opacity:clip?.track_id==='video-2'
      ?Math.round((clip.overlay_opacity??1)*100)+'%':'',
    color:graded?'Adjusted':'Neutral',
    audio:clip?Math.round((clip.volume??1)*100)+'%'+
      (clip.source_audio_muted?' · source muted':''):'',
    attributes:'Color / V2 style',
    metadata:'Read-only'
  };
}
