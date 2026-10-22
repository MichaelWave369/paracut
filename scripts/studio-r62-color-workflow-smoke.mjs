import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,exportDraft,importDraft,undo,redo,validate}
  from '../apps/desktop/public/studio-core.js';
import {COLOR_DEFAULTS,hasColorAdjustment,colorCSS} from '../apps/desktop/public/studio-color.js';
import {COLOR_LOOKS,COLOR_LOOK_NAMES,colorLook,previewColorFor,colorReceiptSummary}
  from '../apps/desktop/public/studio-color-workflow.js';
import {planLocalMp4} from './studio-local-export-core.mjs';

assert.deepEqual(Object.keys(COLOR_LOOKS),['neutral','warm','contrast','mint']);
assert.deepEqual(Object.keys(COLOR_LOOK_NAMES),Object.keys(COLOR_LOOKS));
assert.deepEqual(colorLook('neutral'),COLOR_DEFAULTS);
for(const name of Object.keys(COLOR_LOOKS)){
  const grade=colorLook(name);
  assert.deepEqual(grade,COLOR_LOOKS[name]);
  assert.notEqual(grade,COLOR_LOOKS[name]); // editable copy, never mutate shared preset
  assert.equal(Object.keys(grade).length,4);
}
assert.throws(()=>colorLook('__proto__'),/Unknown color look/);
assert.throws(()=>colorLook('not-a-grade'),/Unknown color look/);
assert.throws(()=>colorLook(null),/Unknown color look/);
const ungraded={clip_id:'first'};
const graded={clip_id:'first',color:colorLook('mint')};
const other={clip_id:'other',color:colorLook('warm')};
assert.equal(previewColorFor(ungraded,'first'),colorCSS(ungraded));
assert.equal(previewColorFor(graded,'first'),colorCSS(graded));
assert.equal(previewColorFor(graded,'first',{before:true}),colorCSS(null));
assert.equal(previewColorFor(graded,'first',{pending:colorLook('contrast')}),
  colorCSS({color:colorLook('contrast')}));
assert.equal(previewColorFor(graded,'first',{pending:colorLook('contrast'),before:true}),
  colorCSS(null)); // Before always means original
assert.equal(previewColorFor(other,'first',{pending:colorLook('mint'),before:true}),
  colorCSS(other)); // never suppress a different clip's grade
assert.equal(previewColorFor(null,'first',{before:true}),colorCSS(null));
assert.throws(()=>previewColorFor(graded,'first',{pending:{brightness:99}}),/brightness/);
assert.equal(colorReceiptSummary({action:'clip.split'}),'');
assert.equal(colorReceiptSummary({action:'clip.color.updated'}),'');
assert.equal(colorReceiptSummary({
  action:'clip.color.updated',details:{color:colorLook('warm')}
}),' B 106% · C 105% · S 112% · W +28');
assert.equal(colorReceiptSummary({
  action:'clip.color.updated',details:{color:colorLook('mint')}
}),' B 104% · C 114% · S 122% · W -24');
let s=newStudio('R6.2 color looks');
for(const a of [
  {asset_id:'v1',name:'v1.mp4',type:'video/mp4',size:100,lastModified:0,duration:5},
  {asset_id:'v2',name:'v2.mp4',type:'video/mp4',size:100,lastModified:0,duration:4}
])s=change(s,{type:'asset.added',asset:a});
s=change(s,{type:'clip.appended',asset_id:'v1'});
s=change(s,{type:'clip.layer.added',asset_id:'v2',track_id:'video-2',start:.5});
const main=s.clips[0].clip_id,layer=s.video2Clips[0].clip_id;
const originals=exportDraft(s),assetMap=Object.fromEntries(
  s.assets.map(a=>[a.asset_id,{path:'/tmp/'+a.name,hasAudio:false}]));
const unchangedPlan=planLocalMp4(s,assetMap,'/tmp/unchanged.mp4');
s=change(s,{type:'clip.color.updated',clip_id:main,color:colorLook('mint')});
s=change(s,{type:'clip.color.updated',clip_id:layer,color:colorLook('warm')});
assert.equal(s.receipts.at(-1).action,'clip.color.updated');
assert.equal(colorReceiptSummary(s.receipts.at(-1)),
  ' B 106% · C 105% · S 112% · W +28');
assert.equal(hasColorAdjustment(s.clips[0]),true);
assert.equal(hasColorAdjustment(s.video2Clips[0]),true);
assert.equal(validate(s),true);
assert.deepEqual(importDraft(exportDraft(s)).video2Clips[0].color,colorLook('warm'));
assert.deepEqual(undo(s).video2Clips[0].color,undefined);
assert.deepEqual(redo(undo(s)).video2Clips[0].color,colorLook('warm'));
assert.equal(importDraft(originals).clips[0].color,undefined);
assert.doesNotMatch(unchangedPlan.graph,/colorbalance=|eq=brightness=/);
const result=planLocalMp4(s,assetMap,'/tmp/look.mp4');
assert.match(result.graph,/colorbalance=/);
assert.match(result.graph,/overlay=x=/);
const files=['studio.js','studio.html','studio.css'];
const [js,html,css]=files.map(name=>readFileSync(
  new URL('../apps/desktop/public/'+name,import.meta.url),'utf8'));
for(const look of Object.keys(COLOR_LOOKS))
  assert.match(html,new RegExp('data-color-look="'+look+'"'));
for(const id of ['program-grade-compare','color-compare-note','clip-color-control'])
  assert.match(html,new RegExp('id="'+id+'"'));
assert.match(html,/<option value="color">Color<\/option>/);
assert.match(js,/colorPreviewPending=true/);
assert.match(js,/applyPreviewColor\(\)/);
assert.match(js,/colorCompareBefore=!colorCompareBefore/);
assert.match(js,/el\.style\.filter=previewColorFor\(find\(el\.dataset\.clip\),selectedId/);
assert.match(js,/colorLook\(key\)/);
assert.match(js,/edit\(\{type:'clip.color.updated',clip_id:selectedId,color:colorLook\(key\)\}\)/);
assert.match(js,/colorReceiptSummary\(entry\)/);
assert.match(js,/if\(!isAudio&&hasColorAdjustment\(clip\)\)/);
assert.match(js,/if\(kind==='video'&&hasColorAdjustment\(clip\)\)/);
assert.match(js,/fx\.textContent='FX'/);
assert.match(js,/program-grade-compare.*setAttribute\('aria-pressed'/);
assert.match(css,/\.grade-compare\[aria-pressed=true\]/);
assert.match(css,/\.grade-indicator/);
assert.match(css,/\.graded-clip/);
console.log('ParaCut R6.2 PASS: four looks, before/after scope, pending audition, receipts, badges, old drafts, local export unaffected by UI compare.');
