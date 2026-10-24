import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,undo,redo,exportDraft,importDraft,validate,titleStyle,titleOpacityAt}
 from '../apps/desktop/public/studio-core.js';
import {titleMotionId,titleMotionAt,titleMotionPhases,TITLE_MOTIONS}
 from '../apps/desktop/public/studio-title-motion.js';
import {buildAss,planLocalMp4} from './studio-local-export-core.mjs';

const close=(a,b)=>assert.ok(Math.abs(a-b)<.0001);
assert.deepEqual(TITLE_MOTIONS,['none','float-up','slide-left','slide-right']);
assert.equal(titleMotionId({}),'none');
for(const [motion,entry,exit] of [
 ['float-up',{x:0,y:96},{x:0,y:-96}],
 ['slide-left',{x:200,y:0},{x:-200,y:0}],
 ['slide-right',{x:-200,y:0},{x:200,y:0}],
 ['none',{x:0,y:0},{x:0,y:0}]
]){
 const title={text:'Field',start:1,end:5,fade_in:1,fade_out:1,motion};
 assert.deepEqual(titleMotionAt(title,1),entry);
 close(titleMotionAt(title,4.5).x,exit.x*.5);
 close(titleMotionAt(title,4.5).y,exit.y*.5);
 close(titleMotionAt(title,1.5).x,entry.x*.5);
 close(titleMotionAt(title,1.5).y,entry.y*.5);
 assert.deepEqual(titleMotionAt(title,3),{x:0,y:0});
 assert.deepEqual(titleMotionAt(title,5),{x:0,y:0});
 if(motion==='none')assert.equal(titleMotionPhases(title,5).length,1);
 else assert.deepEqual(titleMotionPhases(title,5).map(p=>p.kind),
   ['enter','hold','exit']);
}
for(const bad of [null,0,'rise','injection','\\move','slide-left+unsafe'])
 assert.throws(()=>titleMotionId({motion:bad}),/Invalid title motion/);
for(const title of [
 {start:0,end:0,motion:'float-up'},
 {start:0,end:3,fade_in:2,fade_out:2,motion:'float-up'},
 {start:NaN,end:3,motion:'float-up'},
 {start:0,end:3,fade_in:-1,motion:'float-up'}
])assert.throws(()=>titleMotionAt(title,1),/Invalid title motion timing/);
assert.deepEqual(titleMotionAt(
 {start:0,end:3,fade_in:.02,fade_out:.02,motion:'float-up'},.005),
 {x:0,y:0});
const base={text:'ENTER THE FIELD',start:1,end:5,position:'middle',
 size:'large',color:'mint',fade_in:1,fade_out:1};
const plain=buildAss([base],5);
assert.equal((plain.match(/Dialogue:/g)||[]).length,1);
assert.ok(plain.includes('\\fad(1000,1000)'));
assert.ok(!plain.includes('\\move('));
assert.equal(buildAss([{...base,motion:'none'}],5),plain);
const animated=buildAss([{...base,motion:'float-up'}],5);
const lines=animated.split('\n').filter(l=>l.startsWith('Dialogue:'));
assert.equal(lines.length,3);
assert.ok(lines[0].includes('\\move(640,456,640,360)'));
assert.ok(lines[0].includes('\\fad(1000,0)'));
assert.ok(lines[1].includes('\\pos(640,360)'));
assert.ok(lines[2].includes('\\move(640,360,640,264)'));
assert.ok(lines[2].includes('\\fad(0,1000)'));
const sliding=buildAss([{...base,position:'bottom',motion:'slide-left'}],5);
assert.ok(sliding.includes('\\move(840,660,640,660)'));
assert.ok(sliding.includes('\\move(640,660,440,660)'));
assert.equal((buildAss([{...base,motion:'float-up',fade_in:0,fade_out:0}],5)
 .match(/Dialogue:/g)||[]).length,1);
assert.deepEqual(titleMotionPhases({...base,motion:'slide-left'},.5),[]);

let state=newStudio('R8.2');
state=change(state,{type:'asset.added',asset:{asset_id:'v',name:'v',
 type:'video/mp4',duration:6,size:100,lastModified:0}});
state=change(state,{type:'clip.appended',asset_id:'v'});
const first=exportDraft(state),prior=state.receipts.length;
assert.equal(state.receipts.length,prior);
state=change(state,{type:'title.added',title:{...base,motion:'float-up'}});
assert.equal(state.receipts.at(-1).action,'title.added');
assert.equal(state.receipts.length,prior+1);
assert.equal(state.titles[0].motion,'float-up');
assert.equal(validate(state),true);
assert.deepEqual(titleStyle(state.titles[0]),titleStyle(base));
assert.equal(titleOpacityAt(state.titles[0],1.5),.5);
assert.deepEqual(undo(state).titles,[]);
assert.deepEqual(redo(undo(state)).titles,state.titles);
const id=state.titles[0].title_id;
state=change(state,{type:'title.updated',title_id:id,
 title:{...base,motion:'slide-left'}});
assert.equal(state.titles[0].motion,'slide-left');
assert.equal(undo(state).titles[0].motion,'float-up');
assert.equal(redo(undo(state)).titles[0].motion,'slide-left');
assert.deepEqual(importDraft(exportDraft(state)).titles,state.titles);
assert.equal(importDraft(first).titles.length,0);
const plan=planLocalMp4(state,{v:{path:'/tmp/v.mp4',hasAudio:false}},'/tmp/r82.mp4');
assert.ok(plan.graph.includes('titles.ass'));
assert.ok(plan.ass.includes('\\move(840,360,640,360)'));
assert.ok(plan.ass.includes('\\move(640,360,440,360)'));
const legacy=change(state,{type:'title.updated',title_id:id,title:base});
assert.equal(legacy.titles[0].motion,undefined);
assert.ok(!buildAss(legacy.titles,5).includes('\\move('));
const poisoned=JSON.parse(exportDraft(state));
poisoned.titles[0].motion='bad';
assert.throws(()=>importDraft(JSON.stringify(poisoned)),/Invalid title motion/);
assert.throws(()=>change(state,{type:'title.updated',title_id:id,
 title:{...base,motion:'evil'}}),/Invalid title motion/);

const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
assert.match(html,/R8\.(?:2 · TITLE MOTION|3 · MOTION CURVES)/);
assert.match(html,/id="title-motion"/);
assert.match(html,/(?:at least 0\.03s|under 0\.03s)/);
for(const value of TITLE_MOTIONS)assert.ok(html.includes('value="'+value+'"'));
assert.ok(js.includes('node.style.translate='));
assert.ok(js.includes('ctx.translate(motion.x,motion.y)'));
assert.ok(js.includes('text.style.translate='));
assert.ok(js.includes("titleMotionAt(titleDeckDraft()"));
assert.ok(js.includes("motion:$('title-motion').value"));
assert.ok(js.includes("titleMotionId(title)"));
console.log('ParaCut R8.2 PASS: shared motion, ASS phases, legacy title exports, safe drafts, receipts and browser wiring.');
