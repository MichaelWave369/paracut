import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,undo,redo,validate,exportDraft,importDraft} from '../apps/desktop/public/studio-core.js';
import {titleScale,titleScaleFields,titleScaledFont,titleResizeDelta,
  TITLE_SCALE_MIN,TITLE_SCALE_MAX,TITLE_SCALE_STEP,TITLE_BASE_FONT,
  TITLE_SAFE_GUIDES} from '../apps/desktop/public/studio-title-transform.js';
import {titleAnchor,titlePlacement} from '../apps/desktop/public/studio-title-placement.js';
import {buildAss,planLocalMp4} from './studio-local-export-core.mjs';

const base={text:'THE FIELD',start:1,end:5,position:'middle',size:'medium',
 color:'gold',fade_in:1,fade_out:1,motion:'slide-left',
 motion_ease:'smooth',motion_distance:100};
assert.deepEqual([TITLE_SCALE_MIN,TITLE_SCALE_MAX,TITLE_SCALE_STEP],[50,200,5]);
assert.deepEqual(TITLE_BASE_FONT,{small:36,medium:52,large:74});
assert.equal(titleScale(base),100);
assert.equal(titleScaledFont(base),52);
assert.deepEqual(titleScaleFields(100),{});
assert.deepEqual(titleScaleFields(125),{title_scale:125});
assert.equal(titleScaledFont({...base,title_scale:125}),65);
assert.equal(titleScaledFont({...base,size:'large',title_scale:125}),93);
assert.equal(titleScaledFont({...base,size:'small',title_scale:50}),18);
assert.equal(titleScaledFont({...base,size:'large',title_scale:200}),148);
assert.deepEqual(TITLE_SAFE_GUIDES,[{id:'action',inset:10},{id:'title',inset:20}]);
for(const scale of [50,55,75,100,125,150,175,195,200]){
 assert.equal(titleScale({title_scale:scale}),scale);
 assert.ok(titleScaledFont({...base,title_scale:scale})>=18);
}
for(const scale of [-1,0,49,51,100.5,201,205,'100',null,Infinity,NaN,{},true]){
 assert.throws(()=>titleScale({title_scale:scale}),/Invalid title scale/);
 assert.throws(()=>titleScaleFields(scale),/Invalid title scale/);
}
assert.throws(()=>titleScaledFont({size:'enormous'}),/Invalid title size/);
assert.equal(titleResizeDelta(100,0,640),100);
assert.equal(titleResizeDelta(100,20,640),120);
assert.equal(titleResizeDelta(100,-20,640),80);
assert.equal(titleResizeDelta(125,20,1280),135);
assert.equal(titleResizeDelta(100,10000,640),200);
assert.equal(titleResizeDelta(100,-10000,640),50);
for(const args of [[100,Infinity,640],[100,0,0],[100,10,NaN],
 [110.5,20,640],[100,'20',640],[0,0,640]]){
 assert.throws(()=>titleResizeDelta(...args),/Invalid/);
}
const defaultAss=buildAss([base],5);
assert.equal(buildAss([{...base,title_scale:100}],5),defaultAss);
assert.ok(defaultAss.includes('\\fs52'));
const sized=buildAss([{...base,title_scale:125}],5);
assert.ok(sized.includes('\\fs65'));
assert.ok(!sized.includes('\\fs52'));
assert.ok(sized.includes('\\move('));
assert.ok(sized.includes('\\alpha&H'));
const fixed=buildAss([{...base,title_x:427,title_y:298,title_scale:150}],5);
assert.ok(fixed.includes('\\fs78'));
assert.ok(fixed.includes('\\an5'));
assert.ok(fixed.includes('\\pos(427,298)'));
assert.ok(fixed.includes('\\move('));
assert.ok(!fixed.includes('title_scale'));
assert.equal(buildAss([{...base,size:'small',title_scale:50}],5).includes('\\fs18'),true);
assert.equal(buildAss([{...base,motion:'none',fade_in:0,fade_out:0}],5),
 buildAss([{...base,motion:'none',fade_in:0,fade_out:0,title_scale:100}],5));
assert.deepEqual(titleAnchor(base),{x:640,y:360});
assert.equal(titlePlacement(base),null);

let state=newStudio('R8.5 visual transform');
state=change(state,{type:'asset.added',asset:{
 asset_id:'v',name:'v',type:'video/mp4',duration:6,size:100,lastModified:0
}});
state=change(state,{type:'clip.appended',asset_id:'v'});
const snapshot=exportDraft(state),receipts=state.receipts.length;
const staged={...base,title_x:427,title_y:298,title_scale:125};
assert.equal(state.receipts.length,receipts,'preview-only staging cannot create receipts');
assert.equal(exportDraft(state),snapshot);
state=change(state,{type:'title.added',title:staged});
assert.equal(state.receipts.at(-1).action,'title.added');
assert.equal(state.receipts.length,receipts+1);
assert.equal(validate(state),true);
assert.equal(state.titles[0].title_x,427);
assert.equal(state.titles[0].title_y,298);
assert.equal(state.titles[0].title_scale,125);
assert.deepEqual(undo(state).titles,[]);
assert.deepEqual(redo(undo(state)).titles,state.titles);
const id=state.titles[0].title_id;
state=change(state,{type:'title.updated',title_id:id,title:{
 ...base,title_x:640,title_y:120,title_scale:150}});
assert.equal(state.receipts.at(-1).action,'title.updated');
assert.equal(state.receipts.length,receipts+2);
assert.equal(state.titles[0].title_scale,150);
assert.equal(state.titles[0].title_y,120);
assert.equal(undo(state).titles[0].title_x,427);
assert.equal(undo(state).titles[0].title_scale,125);
assert.equal(redo(undo(state)).titles[0].title_scale,150);
assert.deepEqual(importDraft(exportDraft(state)).titles,state.titles);
const plan=planLocalMp4(state,{v:{path:'/tmp/video.mp4',hasAudio:false}},'/tmp/r85.mp4');
assert.ok(plan.ass.includes('\\fs78'));
assert.ok(plan.ass.includes('\\pos(640,120)'));
assert.ok(plan.graph.includes('titles.ass'));
const reset=change(state,{type:'title.updated',title_id:id,title:base});
assert.equal(reset.titles[0].title_x,undefined);
assert.equal(reset.titles[0].title_y,undefined);
assert.equal(reset.titles[0].title_scale,undefined);
assert.equal(buildAss(reset.titles,5),defaultAss,'old output must be byte-identical');
const pct100=change(state,{type:'title.updated',title_id:id,
 title:{...base,title_scale:100}});
assert.equal(pct100.titles[0].title_scale,undefined);
assert.equal(buildAss(pct100.titles,5),defaultAss);
for(const badScale of [null,45,105.5,201,'125',Infinity]){
 assert.throws(()=>change(state,{type:'title.updated',title_id:id,
 title:{...base,title_scale:badScale}}),/Invalid title scale/);
 const poison=JSON.parse(exportDraft(state));
 poison.titles[0].title_scale=badScale;
 assert.throws(()=>importDraft(JSON.stringify(poison)),/Invalid title scale/);
}
const old=JSON.parse(exportDraft(state));
delete old.titles[0].title_scale;
delete old.titles[0].title_x;
delete old.titles[0].title_y;
assert.equal(titleScale(importDraft(JSON.stringify(old)).titles[0]),100);
assert.equal(importDraft(snapshot).titles.length,0);

const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
assert.match(html,/R8\.(?:5 · VISUAL TITLE TRANSFORMS|6 · ALIGN & REUSE|7 · MULTI-TITLE STUDIO|8 · TITLE STYLE LIBRARY|9 · REEL ORIGINALS)/);
for(const id of ['title-resize-handle','title-safe-guides','title-scale',
 'title-scale-value','title-safe-toggle'])assert.ok(html.includes('id="'+id+'"'));
assert.match(html,/aria-label="Title font scaling percent"/);
assert.match(html,/aria-pressed="false"/);
assert.ok(html.includes('title-guide-action'));
assert.ok(html.includes('title-guide-title'));
assert.ok(js.includes('titleResizeDelta(titleResizeDrag.scale'));
assert.ok(js.includes('resizeHandle.setPointerCapture(event.pointerId)'));
assert.ok(js.includes('resizeHandle.releasePointerCapture(event.pointerId)'));
assert.ok(js.includes('titleScaleFields(stagedTitleScale)'));
assert.ok(js.includes('...titlePlacementFields(stagedTitlePlacement)'));
assert.ok(js.includes("...plainTitle,...titlePlacementFields(stagedTitlePlacement)"));
assert.ok(js.includes('const size = titleScale(title)===100?fontSizes[style.size]:titleScaledFont(title)'));
assert.ok(js.includes('safeGuidesVisible=!safeGuidesVisible'));
assert.ok(js.includes("event.shiftKey?10:5"));
assert.ok(css.includes('.title-safe-guides[hidden]'));
assert.ok(css.includes('.screen #title-resize-handle'));
assert.ok(css.includes('.title-guide-title'));
console.log('ParaCut R8.5 PASS: scale math and safety, custom XY Save repair, resize UI, safe guides, ASS size/position, receipts, Undo/Redo and unchanged old projects.');
