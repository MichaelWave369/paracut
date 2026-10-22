// ParaCut R6.0 workspace-only preferences. Never stores media, clip timing or receipts.
export const WORKSPACE_STORAGE_KEY='paracut.studio.workspace.v1';
export const WORKSPACE_PRESETS=Object.freeze({
  editing:{left:250,right:310,monitor:400,showSource:true},
  audio:{left:225,right:380,monitor:285,showSource:false},
  color:{left:230,right:400,monitor:450,showSource:false},
  titles:{left:215,right:370,monitor:360,showSource:false}
});
export const WORKSPACE_LIMITS=Object.freeze({
  left:[180,440],right:[220,500],monitor:[230,680]
});
const validName=name=>typeof name==='string'&&Object.hasOwn(WORKSPACE_PRESETS,name);
const clamp=(n,[min,max])=>Math.max(min,Math.min(max,n));
export function workspacePreset(name) {
  if(!validName(name))throw Error('Unknown workspace preset.');
  return {preset:name,...WORKSPACE_PRESETS[name]};
}
export function validateWorkspace(raw) {
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||!validName(raw.preset))
    throw Error('Invalid workspace settings.');
  const defaults=WORKSPACE_PRESETS[raw.preset],out={preset:raw.preset};
  for(const key of ['left','right','monitor']){
    const number=raw[key];
    if(number===undefined)out[key]=defaults[key];
    else {
      if(typeof number!=='number'||!Number.isFinite(number))
        throw Error('Invalid '+key+' workspace dimension.');
      out[key]=Math.round(clamp(number,WORKSPACE_LIMITS[key]));
    }
  }
  if(raw.showSource!==undefined && typeof raw.showSource!=='boolean')
    throw Error('Invalid Source Monitor visibility.');
  out.showSource=raw.showSource??defaults.showSource;
  return out;
}
export function loadWorkspace(storage) {
  try{
    const raw=storage?.getItem(WORKSPACE_STORAGE_KEY);
    return raw?validateWorkspace(JSON.parse(raw)):workspacePreset('editing');
  }catch{return workspacePreset('editing');}
}
export function saveWorkspace(storage,value) {
  const state=validateWorkspace(value);
  try{storage?.setItem(WORKSPACE_STORAGE_KEY,JSON.stringify(state));return true;}
  catch{return false;} // private-browsing/blocked storage must not break the editor
}
export function resizeWorkspace(value,key,delta) {
  if(!Object.hasOwn(WORKSPACE_LIMITS,key)||!Number.isFinite(delta))
    throw Error('Invalid workspace resize.');
  const state=validateWorkspace(value);
  return validateWorkspace({...state,[key]:state[key]+delta});
}
