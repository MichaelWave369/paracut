import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,undo,redo,validate,exportDraft,importDraft} from '../apps/desktop/public/studio-core.js';
import {titleBatchPlan,titleBatchAppearance,titleBatchSelection,titleBatchSummary,TITLE_BATCH_MODES}
  from '../apps/desktop/public/studio-title-batch.js';
import {buildAss,planLocalMp4} from './studio-local-export-core.mjs';

assert.deepEqual(TITLE_BATCH_MODES,['transform','appearance','both']);
const source=[
 {title_id:'a',text:'ONE',start:0,end:2,position:'top',size:'small',
  color:'white',fade_in:.3,fade_out:.2,motion:'float-up',title_x:256,title_y:144,title_scale:125},
 {title_id:'b',text:'TWO',start:2,end:4,position:'bottom',size:'large',
  color:'mint',fade_in:.5,fade_out:.3,motion:'slide-right',
  motion_distance:150,title_x:800,title_y:600,title_scale:75},
 {title_id:'c',text:'THREE',start:4,end:6,position:'middle',size:'medium',
  color:'gold',fade_in:0,fade_out:0,motion:'none'}
];
const baseline=JSON.stringify(source);
const ids=['a','b'];
assert.equal(titleBatchSelection(source,ids).size,2);
for(const bad of [[],['a'],['a','a'],['a','x'],['x','b'],['a',2],null]){
 assert.throws(()=>titleBatchSelection(source,bad),/Select|exists/);
}
assert.deepEqual(titleBatchAppearance({color:'mint',size:'large'}),
 {color:'mint',size:'large'});
for(const bad of [null,{},[],{color:'mint'},{size:'large'},
 {color:'mint',size:'huge'},{color:'red',size:'medium'},
 {color:'mint',size:'small',text:'overwrite'}]){
 assert.throws(()=>titleBatchAppearance(bad),/Invalid batch title appearance/);
}
const layout={placement:{x:640,y:360},scale:150};
const transformCommand={mode:'transform',title_ids:ids,transform:layout};
const transformed=titleBatchPlan(source,transformCommand);
assert.equal(transformed.count,2);
assert.equal(transformed.mode,'transform');
for(const [i,orig]of source.entries()){
 const next=transformed.titles[i];
 if(i===2)assert.deepEqual(next,orig);
 else{
   assert.equal(next.title_x,640);assert.equal(next.title_y,360);
   assert.equal(next.title_scale,150);
   for(const field of ['title_id','text','start','end','position','size','color',
     'fade_in','fade_out','motion','motion_distance'])
     assert.deepEqual(next[field],orig[field],field+' must remain unchanged');
 }
}
const appearanceCommand={mode:'appearance',title_ids:ids,
 appearance:{color:'gold',size:'small'}};
const restyled=titleBatchPlan(source,appearanceCommand);
for(let i=0;i<2;i++){
 assert.equal(restyled.titles[i].color,'gold');
 assert.equal(restyled.titles[i].size,'small');
 for(const field of ['title_x','title_y','title_scale','text','start','end','motion'])
  assert.deepEqual(restyled.titles[i][field],source[i][field]);
}
const bothCommand={mode:'both',title_ids:ids,
 transform:{placement:{x:1024,y:576},scale:85},
 appearance:{color:'mint',size:'medium'}};
const both=titleBatchPlan(source,bothCommand).titles;
assert.equal(both[0].title_x,1024);
assert.equal(both[1].title_scale,85);
assert.equal(both[0].color,'mint');
assert.equal(both[1].size,'medium');
assert.deepEqual(both[2],source[2]);
const reset=titleBatchPlan(source,{mode:'transform',title_ids:ids,
 transform:{placement:null,scale:100}}).titles;
for(const t of reset.slice(0,2)){
 assert.equal(t.title_x,undefined);
 assert.equal(t.title_y,undefined);
 assert.equal(t.title_scale,undefined);
}
assert.equal(JSON.stringify(source),baseline,'planning must never mutate saved titles');
const damaged=[
 {mode:'transform',title_ids:['a','b']},
 {mode:'transform',title_ids:['a','b'],transform:{placement:null,scale:101}},
 {mode:'appearance',title_ids:['a','b'],transform:layout,appearance:{color:'white',size:'small'}},
 {mode:'transform',title_ids:['a','b'],transform:layout,appearance:{color:'white',size:'small'}},
 {mode:'both',title_ids:['a','b'],transform:layout},
 {mode:'both',title_ids:['a','b'],transform:layout,appearance:{color:'red',size:'small'}},
 {mode:'appearance',title_ids:['a','b'],appearance:{color:'white',size:'bad'}},
 {mode:'unsafe',title_ids:['a','b'],appearance:{color:'white',size:'medium'}}
];
for(const cmd of damaged)assert.throws(()=>titleBatchPlan(source,cmd),/Batch|Invalid|Unknown/);
assert.match(titleBatchSummary(3,'transform'),/3 selected.*position and scale.*pending/);
assert.match(titleBatchSummary(3,'appearance'),/color and font size/);
assert.match(titleBatchSummary(3,'both'),/position, scale, color and font size/);
assert.throws(()=>titleBatchSummary(41,'both'),/Invalid title batch summary/);

let state=newStudio('R8.7 multi titles');
state=change(state,{type:'asset.added',asset:{
 asset_id:'v',name:'clip',type:'video/mp4',duration:8,size:300,lastModified:0
}});
state=change(state,{type:'clip.appended',asset_id:'v'});
for(const t of source){
 const {title_id,...input}=t;
 state=change(state,{type:'title.added',title:input});
}
const saved=state.titles.map(t=>({...t}));
const projectBefore=exportDraft(state),count=state.receipts.length,
 undoLength=state.undo.length;
const newIds=state.titles.slice(0,2).map(t=>t.title_id);
const changes={type:'title.batch.styled',mode:'both',
 title_ids:newIds,transform:{placement:{x:640,y:360},scale:150},
 appearance:{color:'gold',size:'large'}};
assert.equal(state.receipts.length,count);
assert.equal(exportDraft(state),projectBefore);
const next=change(state,changes);
assert.equal(next.receipts.length,count+1,'batch must make a single receipt');
assert.equal(next.receipts.at(-1).action,'title.batch.styled');
assert.equal(next.receipts.at(-1).source,'human');
assert.deepEqual(next.receipts.at(-1).details.title_ids,newIds);
assert.equal(next.receipts.at(-1).details.title_count,2);
assert.equal(next.receipts.at(-1).details.mode,'both');
assert.deepEqual(next.receipts.at(-1).details.fields,
 ['title_x','title_y','title_scale','color','size']);
assert.equal(next.undo.length,undoLength+1,'batch is one undo step');
assert.equal(next.redo.length,0);
assert.equal(validate(next),true);
for(let i=0;i<2;i++){
 assert.equal(next.titles[i].title_x,640);
 assert.equal(next.titles[i].title_y,360);
 assert.equal(next.titles[i].title_scale,150);
 assert.equal(next.titles[i].color,'gold');
 assert.equal(next.titles[i].size,'large');
 for(const key of ['text','start','end','fade_in','fade_out','motion','motion_distance'])
  assert.deepEqual(next.titles[i][key],saved[i][key]);
}
assert.deepEqual(next.titles[2],saved[2]);
assert.deepEqual(undo(next).titles,saved);
assert.deepEqual(redo(undo(next)).titles,next.titles);
assert.deepEqual(importDraft(exportDraft(next)).titles,next.titles);
assert.deepEqual(state.titles,saved,'original immutable state remains untouched');
const exportPlan=planLocalMp4(next,{v:{path:'/tmp/clip.mp4',hasAudio:false}},
 '/tmp/r87.mp4');
assert.ok(exportPlan.graph.includes('titles.ass'));
assert.ok(exportPlan.ass.includes('\\pos(640,360)'));
assert.ok(exportPlan.ass.includes('\\fs111')); // large (74) at 150%
assert.ok(exportPlan.ass.includes('THREE'));
const appearanceOnly=change(state,{type:'title.batch.styled',mode:'appearance',
 title_ids:newIds,appearance:{color:'white',size:'medium'}});
for(let i=0;i<2;i++){
 assert.equal(appearanceOnly.titles[i].color,'white');
 assert.equal(appearanceOnly.titles[i].size,'medium');
 assert.equal(appearanceOnly.titles[i].title_x,saved[i].title_x);
 assert.equal(appearanceOnly.titles[i].title_scale,saved[i].title_scale);
}
const anchorOnly=change(state,{type:'title.batch.styled',mode:'transform',
 title_ids:newIds,transform:{placement:null,scale:100}});
for(let i=0;i<2;i++){
 assert.equal(anchorOnly.titles[i].title_x,undefined);
 assert.equal(anchorOnly.titles[i].title_y,undefined);
 assert.equal(anchorOnly.titles[i].title_scale,undefined);
 assert.equal(anchorOnly.titles[i].text,saved[i].text);
}
assert.deepEqual(undo(anchorOnly).titles,saved);
const priorAss=buildAss(saved,8);
assert.equal(buildAss(state.titles,8),priorAss,'legacy title export not affected');
for(const bad of damaged.concat([
 {...changes,title_ids:[newIds[0],'missing']},
 {...changes,title_ids:[newIds[0],newIds[0]]}
])){
 assert.throws(()=>change(state,{type:'title.batch.styled',...bad}),/Batch|Invalid|Unknown|Select|exists/);
 assert.equal(exportDraft(state),projectBefore,'failed batch cannot modify project');
}

const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
assert.match(html,/R8\.7 · MULTI-TITLE STUDIO/);
for(const id of ['title-batch-panel','title-batch-count','title-batch-all',
 'title-batch-clear','title-batch-mode','title-batch-apply','title-batch-preview'])
 assert.ok(html.includes('id="'+id+'"'),id);
for(const mode of TITLE_BATCH_MODES)assert.ok(html.includes('value="'+mode+'"'));
assert.ok(html.includes('Select two or more T1 titles'));
assert.ok(js.includes("toggle.type='checkbox'"));
assert.ok(js.includes('multiTitleIds.add(title.title_id)'));
assert.ok(js.includes('multiTitleIds.delete(id)'));
assert.ok(js.includes('titleBatchPlan(state.titles,command)'));
assert.ok(js.includes('edit(command)'));
assert.ok(js.includes("'title.batch.styled'"));
assert.ok(js.includes('refreshTitleBatch();'));
assert.ok(css.includes('.title-item.batch-selected'));
assert.ok(css.includes('.title-batch-panel'));
console.log('ParaCut R8.7 PASS: atomic multi-title batch styling, strict fields, one Undo/receipt, preserved text/timing/motion, export, draft and UI.');
