import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,undo,redo,validate,exportDraft,importDraft} from '../apps/desktop/public/studio-core.js';
import {titleMotionAt,titleMotionPhases,titleMotionExportPhases,titleMotionId,titleMotionEaseId,titleMotionDistance,titleMotionProgress,TITLE_MOTION_EASES,TITLE_MOTION_DISTANCES} from '../apps/desktop/public/studio-title-motion.js';
import {buildAss,planLocalMp4} from './studio-local-export-core.mjs';
const near=(a,b,epsilon=.003)=>assert.ok(Math.abs(a-b)<=epsilon,'Expected '+a+' near '+b);
const base={text:'HELLO FIELD',start:1,end:5,position:'middle',size:'large',color:'gold',fade_in:1,fade_out:1,motion:'slide-left'};
assert.deepEqual(TITLE_MOTION_EASES,['linear','ease-in','ease-out','smooth']);
assert.deepEqual(TITLE_MOTION_DISTANCES,[50,75,100,125,150]);
assert.equal(titleMotionEaseId({}),'linear');
assert.equal(titleMotionDistance({}),100);
for(const bad of [null,NaN,0,100.1,49,151,'100',{},'linear'])
 assert.throws(()=>titleMotionDistance({motion_distance:bad}),/distance/);
for(const bad of [null,0,'cubic-bezier(1,2,3,4)','if(1,2,3)',{},'in-out'])
 assert.throws(()=>titleMotionEaseId({motion_ease:bad}),/easing/);
assert.deepEqual(titleMotionAt(base,1),{x:200,y:0});
assert.deepEqual(titleMotionAt(base,1.5),{x:100,y:0});
assert.deepEqual(titleMotionAt(base,4.5),{x:-100,y:0});
assert.equal(titleMotionPhases(base,5).length,3);
const oldAss=buildAss([base],5);
assert.ok(oldAss.includes('\\move(840,360,640,360)'));
assert.ok(oldAss.includes('\\move(640,360,440,360)'));
const defaults={...base,motion_ease:'linear',motion_distance:100};
assert.deepEqual(titleMotionAt(defaults,1.5),titleMotionAt(base,1.5));
assert.equal(buildAss([defaults],5),oldAss);
assert.deepEqual(titleMotionExportPhases(defaults,5),titleMotionPhases(base,5));
for(const easing of TITLE_MOTION_EASES){
 assert.equal(titleMotionProgress(0,easing),0);
 assert.equal(titleMotionProgress(1,easing),1);
 let prev=-1;
 for(let i=0;i<=100;i++){
   const value=titleMotionProgress(i/100,easing);
   assert.ok(value>=prev&&value>=0&&value<=1);
   prev=value;
 }
 const title={...base,motion_ease:easing};
 near(titleMotionAt(title,1.25).x,200*(1-titleMotionProgress(.25,easing)));
 near(titleMotionAt(title,1.75).x,200*(1-titleMotionProgress(.75,easing)));
 near(titleMotionAt(title,4.25).x,-200*titleMotionProgress(.25,easing));
}
near(titleMotionProgress(.5,'ease-in'),.25);
near(titleMotionProgress(.5,'ease-out'),.75);
near(titleMotionProgress(.5,'smooth'),.5);
for(const bad of [-1,1.1,Infinity,NaN,'0.5'])
 assert.throws(()=>titleMotionProgress(bad),/progress/);
assert.throws(()=>titleMotionProgress(.5,'unsafe'),/progress/);
for(const distance of TITLE_MOTION_DISTANCES){
 const factor=distance/100,title={...base,motion_distance:distance};
 near(titleMotionAt(title,1).x,200*factor);
 near(titleMotionAt(title,4.5).x,-100*factor);
 near(titleMotionPhases(title,5)[0].from.x,200*factor);
 near(titleMotionPhases(title,5)[2].to.x,-200*factor);
 if(distance!==100)assert.notEqual(buildAss([title],5),oldAss);
}
const ease={...base,motion_distance:125,motion_ease:'smooth'};
const phases=titleMotionExportPhases(ease,5);
assert.ok(phases.length>3&&phases.length<=17);
assert.equal(phases.filter(p=>p.kind==='hold').length,1);
const entering=phases.filter(p=>p.kind==='eased-piece'&&p.start<2);
const exiting=phases.filter(p=>p.kind==='eased-piece'&&p.start>=4);
assert.ok(entering.length>=2&&exiting.length>=2);
near(entering[0].from.x,250);
near(entering.at(-1).to.x,0);
near(exiting[0].from.x,0);
near(exiting.at(-1).to.x,-250,.01);
near(entering[0].opacityFrom,0);
near(entering.at(-1).opacityTo,1);
near(exiting[0].opacityFrom,1);
near(exiting.at(-1).opacityTo,0);
for(let i=0;i<phases.length-1;i++){
 near(phases[i].end,phases[i+1].start,.01);
 assert.ok(phases[i].end>phases[i].start);
}
for(const p of phases)assert.ok(p.end-p.start>=.01);
const ass=buildAss([ease],5);
const rows=ass.split('\n').filter(x=>x.startsWith('Dialogue:'));
assert.equal(rows.length,phases.length);
assert.ok(rows.filter(row=>row.includes('\\t(0,')).length>=4);
assert.ok(rows.some(row=>row.includes('\\alpha&HFF&')));
assert.ok(rows.some(row=>row.includes('\\alpha&H00&')));
assert.ok(rows.some(row=>row.includes('\\move(')));
assert.ok(rows.some(row=>row.includes('\\pos(640,360)')));
assert.ok(ass.length<7000);
const stationary={...ease,motion:'none'};
assert.equal(buildAss([stationary],5),buildAss([{...base,motion:'none'}],5));
assert.equal(titleMotionExportPhases(stationary,5).length,1);
const short={...ease,start:0,end:.08,fade_in:.04,fade_out:.04};
assert.ok(titleMotionExportPhases(short,.08).length<=3);
assert.ok(buildAss([short],.08).length<1100);
let state=newStudio('R8.3 title curves');
state=change(state,{type:'asset.added',asset:{asset_id:'media',name:'media',duration:6,size:200,type:'video/mp4',lastModified:0}});
state=change(state,{type:'clip.appended',asset_id:'media'});
const baseline=exportDraft(state),receipts=state.receipts.length;
state=change(state,{type:'title.added',title:ease});
assert.equal(state.receipts.at(-1).action,'title.added');
assert.equal(state.receipts.length,receipts+1);
assert.equal(validate(state),true);
assert.equal(state.titles[0].motion_distance,125);
assert.equal(state.titles[0].motion_ease,'smooth');
assert.deepEqual(undo(state).titles,[]);
assert.deepEqual(redo(undo(state)).titles,state.titles);
const id=state.titles[0].title_id;
state=change(state,{type:'title.updated',title_id:id,title:{...base,motion_ease:'ease-out',motion_distance:50}});
assert.equal(state.receipts.at(-1).action,'title.updated');
assert.equal(undo(state).titles[0].motion_distance,125);
assert.equal(redo(undo(state)).titles[0].motion_ease,'ease-out');
assert.deepEqual(importDraft(exportDraft(state)).titles,state.titles);
assert.equal(importDraft(baseline).titles.length,0);
for(const delta of [{motion_ease:null},{motion_distance:null},{motion_ease:'t(0,5)'},{motion_distance:125.5},{motion_ease:'linear',motion_distance:Infinity}]){
 assert.throws(()=>change(state,{type:'title.updated',title_id:id,title:{...base,...delta}}),/motion/);
 const unsafe=JSON.parse(exportDraft(state));
 Object.assign(unsafe.titles[0],delta);
 assert.throws(()=>importDraft(JSON.stringify(unsafe)),/motion/);
}
const plan=planLocalMp4(state,{media:{path:'/tmp/media.mp4',hasAudio:false}},'/tmp/r83.mp4');
assert.ok(plan.ass.includes('\\t(0,'));
assert.ok(plan.graph.includes('titles.ass'));
assert.equal(titleMotionId(state.titles[0]),'slide-left');
const historic=change(state,{type:'title.updated',title_id:id,title:base});
assert.equal(historic.titles[0].motion_distance,undefined);
assert.equal(historic.titles[0].motion_ease,undefined);
assert.equal(buildAss(historic.titles,5),oldAss);
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
assert.match(html,/R8\.(?:3 · MOTION CURVES|4 · DIRECT TITLE PLACEMENT|5 · VISUAL TITLE TRANSFORMS|6 · ALIGN & REUSE)/);
for(const value of TITLE_MOTION_EASES)assert.ok(html.includes('value="'+value+'"'));
for(const id of ['title-motion-ease','title-motion-distance','title-motion-distance-value','title-motion-curve-line','title-motion-curve-graph','title-motion-curve-readout'])
 assert.ok(html.includes('id="'+id+'"'),'Missing '+id);
assert.ok(js.includes('titleMotionProgress(progress,ease)'));
assert.ok(js.includes('titleMotionDistance(title)'));
assert.ok(js.includes('titleMotionEaseId(title)'));
assert.ok(js.includes('titleMotionAt(title,at)'));
assert.ok(js.includes('ctx.translate(motion.x,motion.y)'));
assert.ok(js.includes("motion_ease:$('title-motion-ease').value"));
assert.ok(js.includes("motion_distance:Number($('title-motion-distance').value)"));
assert.ok(css.includes('.title-motion-curve-line'));
console.log('ParaCut R8.3 PASS: safe ease and travel presets, piecewise alpha-motion, legacy output and receipts.');
