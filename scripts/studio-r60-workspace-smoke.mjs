import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  WORKSPACE_STORAGE_KEY,WORKSPACE_PRESETS,WORKSPACE_LIMITS,
  workspacePreset,validateWorkspace,resizeWorkspace,loadWorkspace,saveWorkspace
} from '../apps/desktop/public/studio-workspaces.js';
import {newStudio,change,exportDraft,importDraft,validate} from '../apps/desktop/public/studio-core.js';
assert.equal(Object.keys(WORKSPACE_PRESETS).length,4);
for(const id of ['editing','audio','color','titles']){
  const ws=workspacePreset(id);
  assert.equal(ws.preset,id);
  assert.deepEqual(validateWorkspace(ws),ws);
  assert.ok(ws.left>=WORKSPACE_LIMITS.left[0]&&ws.left<=WORKSPACE_LIMITS.left[1]);
  assert.ok(ws.right>=WORKSPACE_LIMITS.right[0]&&ws.right<=WORKSPACE_LIMITS.right[1]);
  assert.ok(ws.monitor>=WORKSPACE_LIMITS.monitor[0]&&ws.monitor<=WORKSPACE_LIMITS.monitor[1]);
}
assert.equal(workspacePreset('editing').showSource,true);
assert.equal(workspacePreset('audio').showSource,false);
assert.equal(workspacePreset('color').showSource,false);
assert.throws(()=>workspacePreset('__proto__'),/Unknown/);
assert.throws(()=>workspacePreset('notreal'),/Unknown/);
assert.throws(()=>validateWorkspace({preset:'editing',left:NaN}),/Invalid left/);
assert.throws(()=>validateWorkspace({preset:'editing',right:'500'}),/Invalid right/);
assert.throws(()=>validateWorkspace({preset:'editing',showSource:'false'}),/Invalid Source/);
assert.throws(()=>validateWorkspace([]),/Invalid workspace/);
const ws=workspacePreset('editing');
const custom=resizeWorkspace(ws,'left',100);
assert.equal(custom.left,350);
assert.equal(ws.left,250); // no mutation
assert.equal(resizeWorkspace(ws,'left',9999).left,440);
assert.equal(resizeWorkspace(ws,'right',9999).right,500);
assert.equal(resizeWorkspace(ws,'right',-9999).right,220);
assert.equal(resizeWorkspace(ws,'monitor',9999).monitor,680);
assert.equal(resizeWorkspace(ws,'monitor',-9999).monitor,230);
assert.throws(()=>resizeWorkspace(ws,'secret',10),/Invalid workspace resize/);
assert.throws(()=>resizeWorkspace(ws,'left',NaN),/Invalid workspace resize/);
const values=new Map();
const storage={setItem:(key,value)=>values.set(key,value),
  getItem:key=>values.get(key)??null};
assert.equal(loadWorkspace(storage).preset,'editing');
assert.equal(saveWorkspace(storage,{...custom,showSource:false}),true);
assert.equal(values.has(WORKSPACE_STORAGE_KEY),true);
assert.equal(loadWorkspace(storage).showSource,false);
assert.equal(loadWorkspace(storage).left,350);
values.set(WORKSPACE_STORAGE_KEY,'{not json');
assert.equal(loadWorkspace(storage).preset,'editing');
values.set(WORKSPACE_STORAGE_KEY,JSON.stringify({preset:'external',showSource:true}));
assert.equal(loadWorkspace(storage).preset,'editing');
const blocked={getItem(){throw Error('denied')},setItem(){throw Error('denied')}};
assert.equal(loadWorkspace(blocked).preset,'editing');
assert.equal(saveWorkspace(blocked,ws),false);
// Layout preferences are separate from draft data and receipt history.
let project=newStudio('Workspace independence');
project=change(project,{type:'asset.added',asset:{
  asset_id:'clip1',name:'clip1.mp4',size:1,type:'video/mp4',duration:4,lastModified:0}});
project=change(project,{type:'clip.appended',asset_id:'clip1'});
const before=exportDraft(project);
saveWorkspace(storage,workspacePreset('titles'));
assert.equal(exportDraft(project),before);
assert.equal(validate(importDraft(before)),true);
assert.equal(before.includes(WORKSPACE_STORAGE_KEY),false);
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
for(const id of ['workspace-preset','workspace-source-visible','workspace-reset',
  'editor-workspace','resize-media','resize-inspector','resize-monitors',
  'studio-inspector','audio-workspace-anchor','titles-workspace-anchor'])
  assert.match(html,new RegExp('id="'+id+'"'));
assert.match(html,/Color \(layout only\)/);
assert.match(js,/loadWorkspace\(availableWorkspaceStorage\(\)\)/);
assert.match(js,/saveWorkspace\(availableWorkspaceStorage\(\),pref\)/);
assert.match(js,/function installWorkspaceResize\(id,key,sign,axis\)/);
assert.match(js,/el\.setPointerCapture\(e\.pointerId\)/);
assert.match(js,/e\.key==='ArrowRight'/);
assert.match(js,/requestAnimationFrame\(\(\)=>\{drawTimeline\(\);drawTitles\(\);updateStoryPlayhead\(\);\}\)/);
assert.match(js,/if\(!pref\.showSource\)sourceVideo\.pause\(\)/);
assert.match(css,/\.workspace\{grid-template-columns:minmax\(180px,var\(--workspace-left/);
assert.match(css,/@media\(max-width:760px\)/);
assert.match(css,/\.workspace\[data-source-visible="false"\] \.source-preview\{display:none\}/);
console.log('ParaCut R6.0 PASS: valid presets, constrained dividers, persistence fallback, responsive/source layout and total draft/ledger independence.');
