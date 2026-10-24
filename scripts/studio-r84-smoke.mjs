import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,undo,redo,exportDraft,importDraft,validate} from '../apps/desktop/public/studio-core.js';
import {titlePlacement,titleAnchor,titlePlacementFields,titlePlacementAtPointer,
 titleNudgePlacement,TITLE_PLACEMENT_BOUNDS} from '../apps/desktop/public/studio-title-placement.js';
import {titleMotionAt} from '../apps/desktop/public/studio-title-motion.js';
import {buildAss,planLocalMp4} from './studio-local-export-core.mjs';
const base={text:'MOVE ME',start:1,end:5,position:'middle',size:'large',
 color:'mint',fade_in:1,fade_out:1,motion:'slide-left',
 motion_ease:'smooth',motion_distance:125};
assert.deepEqual(TITLE_PLACEMENT_BOUNDS,{
 minX:80,maxX:1200,minY:60,maxY:660,width:1280,height:720
});
assert.equal(titlePlacement(base),null);
assert.deepEqual(titleAnchor(base),{x:640,y:360});
assert.deepEqual(titleAnchor({position:'top'}),{x:640,y:120});
assert.deepEqual(titleAnchor({position:'bottom'}),{x:640,y:620});
const actual={...base,title_x:427,title_y:298};
assert.deepEqual(titlePlacement(actual),{x:427,y:298});
assert.deepEqual(titleAnchor(actual),{x:427,y:298});
assert.deepEqual(titlePlacementFields({x:427,y:298}),{
 title_x:427,title_y:298});
assert.deepEqual(titlePlacementFields(null),{});
for(const coords of [
 {title_x:80,title_y:60},{title_x:1200,title_y:660}
])assert.deepEqual(titlePlacement(coords),{
 x:coords.title_x,y:coords.title_y});
for(const invalid of [
 {title_x:500},{title_y:500},{title_x:null,title_y:300},
 {title_x:0,title_y:300},{title_x:1201,title_y:300},
 {title_x:640,title_y:0},{title_x:640,title_y:661},
 {title_x:'640',title_y:360},{title_x:640.5,title_y:360},
 {title_x:640,title_y:NaN},{title_x:640,title_y:Infinity}
])assert.throws(()=>titlePlacement(invalid),/position|provided together/);
assert.throws(()=>titleAnchor({position:'unsafe'}),/anchor/);
assert.deepEqual(titlePlacementAtPointer(
 {left:10,top:20,width:640,height:360},330,200),
 {x:640,y:360});
assert.deepEqual(titlePlacementAtPointer(
 {left:10,top:20,width:640,height:360},20,30),
 {x:80,y:60});
assert.deepEqual(titlePlacementAtPointer(
 {left:10,top:20,width:640,height:360},650,380),
 {x:1200,y:660});
assert.deepEqual(titlePlacementAtPointer(
 {left:0,top:0,width:1280,height:720},628,350),
 {x:640,y:360});
assert.deepEqual(titlePlacementAtPointer(
 {left:0,top:0,width:1280,height:720},628,350,{snap:false}),
 {x:628,y:350});
assert.deepEqual(titleNudgePlacement({x:640,y:360},12,11,{snap:true}),
 {x:640,y:360});
assert.deepEqual(titleNudgePlacement({x:640,y:360},15,16,{snap:true}),
 {x:655,y:376});
assert.deepEqual(titleNudgePlacement({x:100,y:100},-200,-200),
 {x:80,y:60});
assert.deepEqual(titleNudgePlacement({x:1100,y:600},400,300),
 {x:1200,y:660});
assert.deepEqual(titleNudgePlacement({x:640,y:360},-1,0),
 {x:639,y:360});
assert.deepEqual(titleNudgePlacement({x:640,y:360},0,-10),
 {x:640,y:350});
for(const pair of [
 [null,1,2],[{x:NaN,y:200},1,2],[{x:500,y:200},Infinity,0],
 [{x:500,y:200},0,'2']
])assert.throws(()=>titleNudgePlacement(...pair),/Invalid/);
assert.throws(()=>titlePlacementAtPointer({width:0,height:720,left:0,top:0},
 1,1),/geometry/);

const historic=buildAss([base],5);
assert.ok(!historic.includes('\\pos('));
const legacyMotion=buildAss([{...base,motion:'slide-left',
 motion_ease:'linear',motion_distance:100}],5);
assert.ok(legacyMotion.includes('\\move(840,360,640,360)'));
assert.ok(legacyMotion.includes('\\move(640,360,440,360)'));
const fixed=buildAss([{...base,motion:'none',title_x:427,title_y:298}],5);
assert.ok(fixed.includes('\\an5'));
assert.ok(fixed.includes('\\pos(427,298)'));
assert.ok(!fixed.includes('\\move('));
const centered=buildAss([{...base,motion:'slide-left',
 motion_ease:'linear',motion_distance:100,title_x:427,title_y:298}],5);
assert.ok(centered.includes('\\move(627,298,427,298)'));
assert.ok(centered.includes('\\pos(427,298)'));
assert.ok(centered.includes('\\move(427,298,227,298)'));
const eased=buildAss([actual],5);
assert.ok(eased.includes('\\move(677,298,'));
assert.ok(eased.includes('\\pos(427,298)'));
assert.ok(eased.includes('\\alpha&H'));
assert.ok(eased.includes('\\t(0,'));
assert.ok(eased.length<7500);
assert.deepEqual(titleMotionAt(actual,1.5),
 titleMotionAt(base,1.5),'placement does not change movement displacement');
assert.equal(buildAss([base],5),historic,'legacy ASS remains byte-identical');

let state=newStudio('R8.4 placing titles');
state=change(state,{type:'asset.added',asset:{
 asset_id:'v',name:'v',type:'video/mp4',duration:6,size:200,lastModified:0
}});
state=change(state,{type:'clip.appended',asset_id:'v'});
const before=exportDraft(state),count=state.receipts.length;
const staged=titleNudgePlacement({x:640,y:360},-213,-62,{snap:false});
assert.deepEqual(staged,{x:427,y:298});
assert.equal(state.receipts.length,count,'staging is pure local math');
assert.equal(exportDraft(state),before);
state=change(state,{type:'title.added',title:{...base,...titlePlacementFields(staged)}});
assert.equal(state.receipts.length,count+1);
assert.equal(state.receipts.at(-1).action,'title.added');
assert.equal(validate(state),true);
assert.deepEqual(titlePlacement(state.titles[0]),staged);
assert.deepEqual(undo(state).titles,[]);
assert.deepEqual(redo(undo(state)).titles,state.titles);
const id=state.titles[0].title_id;
state=change(state,{type:'title.updated',title_id:id,title:{
 ...base,title_x:640,title_y:120}});
assert.equal(state.receipts.at(-1).action,'title.updated');
assert.equal(state.receipts.length,count+2);
assert.deepEqual(titlePlacement(state.titles[0]),{x:640,y:120});
assert.deepEqual(titlePlacement(undo(state).titles[0]),staged);
assert.deepEqual(titlePlacement(redo(undo(state)).titles[0]),{x:640,y:120});
assert.deepEqual(importDraft(exportDraft(state)).titles,state.titles);
assert.equal(importDraft(before).titles.length,0);
const plan=planLocalMp4(state,{v:{path:'/tmp/video.mp4',hasAudio:false}},
 '/tmp/r84.mp4');
assert.ok(plan.graph.includes('ass=filename=titles.ass'));
assert.ok(plan.ass.includes('\\pos(640,120)'));
assert.ok(plan.ass.includes('\\an5'));
const anchored=change(state,{type:'title.updated',title_id:id,title:base});
assert.equal(titlePlacement(anchored.titles[0]),null);
assert.equal(buildAss(anchored.titles,5),historic);
for(const payload of [
 {title_x:200},{title_x:500,title_y:null},
 {title_x:-1,title_y:100},{title_x:100,title_y:100.1}
]){
 assert.throws(()=>change(state,{type:'title.updated',title_id:id,
 title:{...base,...payload}}),/position|provided together/);
 const bad=JSON.parse(exportDraft(state));
 for(const prop of ['title_x','title_y'])delete bad.titles[0][prop];
 Object.assign(bad.titles[0],payload);
 assert.throws(()=>importDraft(JSON.stringify(bad)),/position|provided together/);
}
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
assert.match(html,/R8\.4 · DIRECT TITLE PLACEMENT/);
for(const name of ['title-x','title-y','title-place-toggle','title-place-reset',
 'title-place-snap','title-place-status'])assert.ok(html.includes('id="'+name+'"'));
assert.ok(html.includes('aria-pressed="false"'));
assert.ok(html.includes('aria-live="polite"'));
assert.ok(js.includes('titleNudgePlacement(titleDrag.original'));
assert.ok(js.includes('setPointerCapture(event.pointerId)'));
assert.ok(js.includes('releasePointerCapture(event.pointerId)'));
assert.ok(js.includes("event.key==='Escape'"));
assert.ok(js.includes('event.shiftKey?10:1'));
assert.ok(js.includes('titlePlacementFields(stagedTitlePlacement)'));
assert.ok(js.includes('stagedTitlePlacement=null'));
assert.ok(js.includes('ctx.strokeText(line, placement.x'));
assert.ok(js.includes('node.style.left=(100*custom.x/1280)'));
assert.ok(css.includes('.screen #title-preview.placing'));
console.log('ParaCut R8.4 PASS: bounded XY, snap/keyboard math, Program drag wiring, unchanged legacy ASS, local export, draft/receipt and Undo/Redo.');
