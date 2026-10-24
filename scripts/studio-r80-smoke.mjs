import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,undo,redo,importDraft,exportDraft,validate,
 titleStyle,titleOpacityAt,TITLE_POSITION,TITLE_SIZE,TITLE_COLOR}
 from '../apps/desktop/public/studio-core.js';
import {
 TITLE_RECIPES,titleRecipeFields,titlePlacementAtPlayhead,
 titleDeckSample,titleDeckReadout
} from '../apps/desktop/public/studio-title-deck.js';
import {planLocalMp4} from './studio-local-export-core.mjs';

assert.equal(TITLE_RECIPES.length,6);
assert.equal(new Set(TITLE_RECIPES.map(r=>r.id)).size,6);
assert.deepEqual(TITLE_RECIPES.map(r=>r.id),
 ['cinema','lower-third','chapter','quote','caption','end-card']);
for(const r of TITLE_RECIPES){
 const style=titleRecipeFields(r.id,3);
 assert.ok(TITLE_POSITION.includes(style.position));
 assert.ok(TITLE_SIZE.includes(style.size));
 assert.ok(TITLE_COLOR.includes(style.color));
 assert.ok(style.fade_in>=0&&style.fade_out>=0);
 assert.ok(style.fade_in+style.fade_out<=3);
 const sample=titleDeckSample({text:r.label,start:1,end:4,...style},50);
 assert.equal(sample.text,r.label);
 assert.equal(sample.position,style.position);
 assert.equal(sample.size,style.size);
 assert.equal(sample.color,style.color);
 assert.ok(sample.opacity>=0&&sample.opacity<=1);
 assert.match(titleDeckReadout(sample),/draft only/);
}
const gold=titleRecipeFields('chapter',2);
assert.deepEqual(gold,{position:'top',size:'large',color:'gold',
 fade_in:.32,fade_out:.3});
const short=titleRecipeFields('end-card',.15);
assert.ok(short.fade_in+short.fade_out<=.15);
for(const invalid of [
 ['unknown',3],['cinema',0],['cinema',-2],['cinema',Infinity],
 ['cinema',NaN],['cinema',86401],['chapter','3']
])assert.throws(()=>titleRecipeFields(...invalid),/look|duration/);
assert.deepEqual(titlePlacementAtPlayhead(2,9,3),{start:2,end:5});
assert.deepEqual(titlePlacementAtPlayhead(8,9,3),{start:8,end:9});
assert.deepEqual(titlePlacementAtPlayhead(0,2,3),{start:0,end:2});
assert.deepEqual(titlePlacementAtPlayhead(1.111,4,1.333),
 {start:1.111,end:2.444});
for(const values of [
 [9,9,3],[9.001,9,3],[-1,9,3],[0,0,3],[0,.05,3],
 [0,9,-1],[0,9,Infinity],[NaN,9,3],[0,9,'3']
])assert.throws(()=>titlePlacementAtPlayhead(...values),/timeline|duration|playhead/i);

const base={text:'Sample',start:2,end:6,position:'bottom',
 size:'medium',color:'mint',fade_in:1,fade_out:1};
const initial=titleDeckSample(base,0);
assert.equal(initial.opacity,0);
assert.equal(initial.seconds,2);
assert.equal(titleDeckSample(base,25).opacity,1);
assert.equal(titleDeckSample(base,50).opacity,1);
assert.equal(titleDeckSample(base,75).opacity,1);
assert.ok(titleDeckSample(base,99).opacity<.1);
assert.ok(titleDeckSample(base,100).opacity>=0);
assert.equal(titleDeckSample({...base,text:''},50).text,'Your title');
assert.equal(titleDeckSample({...base,text:'<b>Not HTML</b>'},50).text,
 '<b>Not HTML</b>');
assert.equal(titleDeckReadout(titleDeckSample(base,35)),
 '35% · 3.40s · 100% visible · draft only');
assert.throws(()=>titleDeckReadout({}),/Invalid/);
for(const draft of [
 {...base,start:-1},{...base,end:2},{...base,end:Infinity},
 {...base,fade_in:-1},{...base,fade_out:5},
 {...base,size:'enormous'},{...base,color:'url(script)'},
 {...base,position:'behind'}, {...base,text:'x'.repeat(101)}
])assert.throws(()=>titleDeckSample(draft,50),/Correct|exceeds/);
for(const progress of [-1,101,NaN,Infinity])
 assert.throws(()=>titleDeckSample(base,progress),/progress/);

// A recipe is composed entirely of the established title command fields,
// with normal core validation, receipt, draft import/export and Undo/Redo.
const asset=(id,type,duration)=>({asset_id:id,name:id,type,duration,size:100,
 lastModified:0});
let state=newStudio('R8.0 title deck');
for(const a of [asset('video','video/mp4',8)])
 state=change(state,{type:'asset.added',asset:a});
state=change(state,{type:'clip.appended',asset_id:'video'});
const before=exportDraft(state),beforeReceipts=state.receipts.length;
const recipe=titleRecipeFields('lower-third',3);
const placement=titlePlacementAtPlayhead(2,8,3);
const title={text:'PARACUT R8',...placement,...recipe};
const staged=titleDeckSample(title,50);
assert.equal(validate(state),true);
assert.equal(state.receipts.length,beforeReceipts);
assert.equal(exportDraft(state),before);
assert.ok(staged.opacity>0);
state=change(state,{type:'title.added',title});
assert.equal(state.receipts.length,beforeReceipts+1);
assert.equal(state.receipts.at(-1).action,'title.added');
assert.equal(state.titles.length,1);
assert.equal(state.titles[0].text,'PARACUT R8');
assert.deepEqual(titleStyle(state.titles[0]),recipe);
assert.equal(titleOpacityAt(state.titles[0],2),0);
assert.deepEqual(undo(state).titles,[]);
assert.deepEqual(redo(undo(state)).titles,state.titles);
const changedStyle=titleRecipeFields('quote',3);
state=change(state,{type:'title.updated',title_id:state.titles[0].title_id,
 title:{...title,...changedStyle}});
assert.equal(state.receipts.at(-1).action,'title.updated');
assert.equal(state.titles[0].color,'gold');
assert.equal(undo(state).titles[0].color,'mint');
assert.equal(redo(undo(state)).titles[0].color,'gold');
assert.deepEqual(importDraft(exportDraft(state)).titles[0],state.titles[0]);
assert.equal(importDraft(before).titles.length,0);
const linked={video:{path:'/tmp/video',hasAudio:false}};
const exportPlan=planLocalMp4(state,linked,'/tmp/r80.mp4');
assert.ok(exportPlan.graph.includes('titles.ass'));
assert.ok(exportPlan.ass.includes('PARACUT R8'));
const legacy=JSON.parse(exportDraft(state));
delete legacy.titles[0].fade_in;delete legacy.titles[0].fade_out;
assert.equal(importDraft(JSON.stringify(legacy)).titles[0].fade_in,undefined);

const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
assert.match(html,/R8\.(?:0 · CREATIVE TITLE DECK|1 · TITLE TIMING LAB|2 · TITLE MOTION|3 · MOTION CURVES|4 · DIRECT TITLE PLACEMENT)/);
for(const r of TITLE_RECIPES)
 assert.ok(html.includes('data-title-recipe="'+r.id+'"'),'Missing recipe '+r.id);
for(const id of ['title-deck-recipes','title-deck-stage','title-deck-text',
 'title-deck-scrub','title-deck-readout','title-deck-at-playhead'])
 assert.ok(html.includes('id="'+id+'"'),id);
assert.match(html,/aria-label="Audition title fade position"/);
assert.match(html,/aria-live="polite"/);
assert.match(js,/titleRecipeFields\(recipe\.id,form\.end-form\.start\)/);
assert.match(js,/titleDeckSample\(titleDeckDraft\(\)/);
assert.match(js,/text\.textContent=sample\.text/);
assert.match(js,/selectedTitleRecipe=null/);
assert.match(js,/titlePlacementAtPlayhead\(playhead,duration\(state\),seconds\)/);
assert.match(js,/status\('Title timing staged at playhead/);
assert.match(js,/if\(exporting\)return;/);
assert.match(css,/\.title-deck-stage/);
assert.match(css,/\.title-deck-recipes button\[aria-pressed="true"\]/);
assert.match(css,/\.title-deck-text\[data-color="gold"\]/);
console.log('ParaCut R8.0 PASS: six creative title looks, fade sampling, preview-only safety, playhead placement, draft/Undo/Redo, export title plan and UI accessibility.');
