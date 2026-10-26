import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,undo,redo,exportDraft,importDraft,validate,
 titleOpacityAt,titleStyle} from '../apps/desktop/public/studio-core.js';
import {planLocalMp4} from './studio-local-export-core.mjs';
import {titleDeckSample} from '../apps/desktop/public/studio-title-deck.js';
import {TITLE_RHYTHMS,TITLE_DURATION_CHOICES,titleRhythmFields,
 retimeTitleDraft,titleFadeFromPercent,titlePhaseMap,titleTimingReadout}
 from '../apps/desktop/public/studio-title-timing.js';

const close=(got,expected,tolerance=.0011)=>assert.ok(
 Math.abs(got-expected)<=tolerance,'Expected '+got+' ~= '+expected);
const base={text:'FIELD TITLE',start:2,end:5,position:'middle',size:'large',
 color:'gold',fade_in:.6,fade_out:.6};
assert.deepEqual(TITLE_RHYTHMS.map(r=>r.id),
 ['cut','punch','flow','reveal','outro']);
assert.deepEqual(TITLE_DURATION_CHOICES,[1.5,3,5]);
for(const rhythm of TITLE_RHYTHMS){
 const fields=titleRhythmFields(rhythm.id,3);
 assert.ok(fields.fade_in>=0&&fields.fade_out>=0);
 assert.ok(fields.fade_in+fields.fade_out<=3);
 const sample=titleDeckSample({...base,...fields},50);
 assert.ok(sample.opacity>=0&&sample.opacity<=1);
}
assert.deepEqual(titleRhythmFields('cut',3),{fade_in:0,fade_out:0});
assert.deepEqual(titleRhythmFields('flow',3),{fade_in:.6,fade_out:.6});
assert.deepEqual(titleRhythmFields('reveal',5),{fade_in:2.1,fade_out:.6});
for(const opts of [
 ['invalid',3],['flow',0],['flow',-1],['flow',Infinity],
 ['flow','3'],['flow',86401]
])assert.throws(()=>titleRhythmFields(...opts),/rhythm|duration/);
const longer=retimeTitleDraft(base,5,12);
assert.deepEqual(longer,{start:2,end:7,fade_in:1,fade_out:1});
assert.deepEqual(retimeTitleDraft(base,5,6),{
 start:2,end:6,fade_in:.8,fade_out:.8});
assert.deepEqual(retimeTitleDraft(base,1.5,12),{
 start:2,end:3.5,fade_in:.3,fade_out:.3});
const readOnly=JSON.stringify(base);
assert.equal(JSON.stringify(base),readOnly);
for(const args of [
 [{...base,start:8,end:11},3,8.05],
 [base,0,12],[base,-2,12],[base,3,2.09],[base,3,Infinity],
 [base,3,86401],[{...base,end:2},3,12],
 [{...base,fade_in:2,fade_out:2},3,12]
])assert.throws(()=>retimeTitleDraft(...args),/valid|budget|timeline|remaining|timing/);
close(retimeTitleDraft({...base,start:2.123,end:5.123},1.5,5.4).end,3.623);
const atNinety=titleFadeFromPercent(base,'in',90);
close(atNinety.fade_in+atNinety.fade_out,3);
close(atNinety.fade_out,.6);
const atExit=titleFadeFromPercent(base,'out',50);
close(atExit.fade_in,.6);
close(atExit.fade_out,1.5);
assert.deepEqual(titleFadeFromPercent(base,'in',0),
 {fade_in:0,fade_out:.6});
assert.deepEqual(titleFadeFromPercent(base,'out',0),
 {fade_in:.6,fade_out:0});
for(const opts of [
 [base,'unknown',10],[base,'in',-1],[base,'out',101],
 [base,'in',NaN],[base,'out','50'],
 [{...base,fade_in:3,fade_out:3},'in',10]
])assert.throws(()=>titleFadeFromPercent(...opts),/Invalid|Correct/);

const map=titlePhaseMap(base);
assert.equal(map.duration,3);
assert.equal(map.fadeIn,.6);
assert.equal(map.fadeOut,.6);
close(map.hold,1.8);
close(map.inPercent+map.holdPercent+map.outPercent,100);
assert.deepEqual(map.frames.map(s=>s.progress),[0,25,50,75,100]);
for(const sample of map.frames){
 const expected=titleDeckSample(base,sample.progress);
 close(sample.opacity,expected.opacity);
 close(sample.seconds,expected.seconds);
}
assert.equal(map.frames[0].opacity,0);
assert.equal(map.frames[2].opacity,1);
assert.ok(map.frames[4].opacity<.01);
assert.equal(titleTimingReadout(map),
 'In 0.60s · Hold 1.80s · Out 0.60s · 3.00s total · draft only');
assert.deepEqual(titlePhaseMap({...base,fade_in:0,fade_out:0})
 .frames.map(x=>x.opacity),[1,1,1,1,1]);
assert.throws(()=>titlePhaseMap({...base,fade_in:4}),/timing|fades/);
assert.throws(()=>titleTimingReadout({}),/Invalid/);

// The same title data still runs through the saved T1 core and the local
// ASS/FFmpeg exporter. Only the existing title.added command creates a receipt.
const asset={asset_id:'main',name:'main',type:'video/mp4',
 duration:10,size:100,lastModified:0};
let state=newStudio('R8.1 title timing');
state=change(state,{type:'asset.added',asset});
state=change(state,{type:'clip.appended',asset_id:'main'});
const original=exportDraft(state),count=state.receipts.length;
const title={text:'FIELD TITLE',start:2,end:7,
 position:'middle',size:'large',color:'gold',
 ...titleRhythmFields('reveal',5)};
assert.ok(titlePhaseMap(title).fadeIn>titlePhaseMap(title).fadeOut);
assert.equal(exportDraft(state),original);
assert.equal(state.receipts.length,count);
state=change(state,{type:'title.added',title});
assert.equal(state.receipts.at(-1).action,'title.added');
assert.equal(state.receipts.length,count+1);
assert.equal(validate(state),true);
assert.equal(state.titles.length,1);
assert.equal(state.titles[0].text,'FIELD TITLE');
const current=state.titles[0];
const newFields=retimeTitleDraft(current,1.5,10);
state=change(state,{type:'title.updated',title_id:current.title_id,
 title:{...current,...newFields}});
assert.equal(state.receipts.at(-1).action,'title.updated');
assert.equal(state.receipts.length,count+2);
assert.equal(state.titles[0].end,3.5);
assert.equal(undo(state).titles[0].end,7);
assert.equal(redo(undo(state)).titles[0].end,3.5);
assert.deepEqual(importDraft(exportDraft(state)).titles,state.titles);
assert.equal(importDraft(original).titles.length,0);
const plan=planLocalMp4(state,{main:{path:'/tmp/main.mp4',hasAudio:false}},
 '/tmp/r81.mp4');
assert.ok(plan.graph.includes('titles.ass'));
assert.ok(plan.ass.includes('FIELD TITLE'));
assert.ok(titleOpacityAt(state.titles[0],2.05)<1);
assert.equal(titleStyle(state.titles[0]).color,'gold');

// The UI never creates commands for timing audition. Existing title Save
// remains the only commit hook, so no new schema or export path is introduced.
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
assert.match(html,/R8\.(?:1 · TITLE TIMING LAB|2 · TITLE MOTION|3 · MOTION CURVES|4 · DIRECT TITLE PLACEMENT|5 · VISUAL TITLE TRANSFORMS|6 · ALIGN & REUSE|7 · MULTI-TITLE STUDIO|8 · TITLE STYLE LIBRARY|9 · REEL ORIGINALS)/);
for(const rhythm of TITLE_RHYTHMS)
 assert.ok(html.includes('data-title-rhythm="'+rhythm.id+'"'));
for(const seconds of TITLE_DURATION_CHOICES)
 assert.ok(html.includes('data-title-duration="'+seconds+'"'));
for(const id of ['title-timing-rhythms','title-timing-durations',
 'title-timing-phase','title-timing-entry','title-timing-hold','title-timing-exit',
 'title-timing-in','title-timing-out','title-timing-in-label','title-timing-out-label',
 'title-timing-readout','title-timing-frames'])
 assert.ok(html.includes('id="'+id+'"'),id);
for(const percent of [0,25,50,75,100])
 assert.ok(html.includes('data-title-frame="'+percent+'"'));
assert.match(html,/aria-label="Title animation timing presets"/);
assert.match(html,/aria-label="Title fade rhythm and duration"/);
assert.match(html,/aria-live="polite"/);
assert.match(js,/titleRhythmFields\(rhythm\.id,draft\.end-draft\.start\)/);
assert.match(js,/retimeTitleDraft\(titleDeckDraft\(\),seconds,duration\(state\)\)/);
assert.match(js,/titleFadeFromPercent\(titleDeckDraft\(\),edge,/);
assert.match(js,/titlePhaseMap\(draft\)/);
assert.match(js,/selectedTitleRhythm=null/);
assert.match(js,/if\(exporting\)return/);
assert.match(js,/title\.added/);
assert.match(css,/\.title-timing-phase/);
assert.match(css,/\.title-phase-entry/);
assert.match(css,/prefers-reduced-motion/);
console.log('ParaCut R8.1 PASS: five timing rhythms, three durations, constrained fade handles, phase preview, ledger, drafts, title exports and UI wiring.');
