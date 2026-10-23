import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {newStudio,change,validate,undo,redo,importDraft,exportDraft}
 from '../apps/desktop/public/studio-core.js';
import {graphSample,graphSampleLabel}
 from '../apps/desktop/public/studio-graph-inspector.js';
import {renderMultiPointKeyframeLanes}
 from '../apps/desktop/public/studio-multipoint-view.js';
import {graphDiagnostics,renderBenchmarkReport}
 from './studio-export-benchmark.mjs';
import {planLocalMp4} from './studio-local-export-core.mjs';

const mock={clip_id:'overlay',track_id:'video-2',
 timeline:{start:2,end:6},source:{start:0,end:4},
 opacity_keyframe_points:[
   {at:0,value:0,ease:'ease-in'},
   {at:.5,value:.8,ease:'ease-out'},
   {at:1,value:1}
 ]};
const first=graphSample(mock,'opacity_keyframes',0,.25);
assert.equal(first.startSec,2);
assert.equal(first.endSec,4);
assert.equal(first.timelineSec,3);
assert.equal(first.mode,'ease-in');
assert.equal(first.valuePercent,20);
assert.match(graphSampleLabel(first),/at 3.00s \/ 25.0% clip → 20.0% value/);
const second=graphSample(mock,'opacity_keyframes',1,.75);
assert.equal(second.startSec,4);
assert.equal(second.endSec,6);
assert.ok(second.valuePercent>.9*100);
assert.equal(graphSample(mock,'opacity_keyframes',0,3).clipPercent,50);
assert.throws(()=>graphSample(mock,'evil',0,.5),/Unsupported/);
assert.throws(()=>graphSample(mock,'opacity_keyframes',2,.5),/segment/);
assert.throws(()=>graphSample(mock,'opacity_keyframes',0,NaN),/progress/);
assert.throws(()=>graphSample({...mock,timeline:{start:1,end:1}},
 'opacity_keyframes',0,.5),/timing/);
assert.throws(()=>graphSampleLabel({}),/sample/);

const mk=(id,type,duration)=>({asset_id:id,name:id,type,duration,size:100,lastModified:0});
let state=newStudio('R7.4 benchmark');
for(const asset of [mk('v1','video/mp4',5),mk('v2','video/mp4',4),
 mk('a1','audio/wav',5)])state=change(state,{type:'asset.added',asset});
for(const asset_id of ['v1','a1'])state=change(state,{type:'clip.appended',asset_id});
state=change(state,{type:'clip.layer.added',asset_id:'v2',track_id:'video-2',start:.5});
const v2Id=state.video2Clips[0].clip_id,a1Id=state.audioClips[0].clip_id;
const old=exportDraft(state);
const points=[{at:0,value:0,ease:'bezier',handles:[.25,.75],handles_x:[.15,.76]},
 {at:1,value:1}];
state=change(state,{type:'clip.keyframe.points.updated',clip_id:v2Id,
 field:'opacity_keyframes',points});
state=change(state,{type:'clip.keyframe.points.updated',clip_id:a1Id,
 field:'volume_keyframes',points});
assert.equal(validate(state),true);
assert.deepEqual(importDraft(exportDraft(state)).video2Clips[0].opacity_keyframe_points,points);
assert.equal(importDraft(old).video2Clips[0].opacity_keyframe_points,undefined);
assert.deepEqual(undo(state).audioClips[0].volume_keyframe_points,undefined);
assert.deepEqual(redo(undo(state)).audioClips[0].volume_keyframe_points,points);
const linked=Object.fromEntries(state.assets.map(a=>[a.asset_id,{
 path:'/tmp/'+a.name,hasAudio:a.type.startsWith('audio/')}]));
const mp4=planLocalMp4(state,linked,'/tmp/r74.mp4');
const diag=graphDiagnostics(state,mp4.graph);
assert.equal(diag.customXSegments,2);
assert.equal(diag.previousFixedPieces,128);
assert.ok(diag.optimizedPieces>0&&diag.optimizedPieces<128);
assert.ok(diag.maxProbeError<.003);
assert.equal(diag.filterGraphChars,mp4.graph.length);
assert.deepEqual(graphDiagnostics(importDraft(old),'test'),{
 filterGraphChars:4,customXSegments:0,optimizedPieces:0,
 previousFixedPieces:0,maxProbeError:0
});
assert.throws(()=>graphDiagnostics(state,null),/graph/);
const summary=renderBenchmarkReport({
 mediaSeconds:8,probeMs:100,planMs:20,encodeMs:4000,verifyMs:80,totalMs:4200,
 graph:diag
});
assert.match(summary,/encode \/ realtime: 2.00x/);
assert.match(summary,/Actual FFmpeg encode: 4.000s/);
assert.match(summary,/Source relink \+ ffprobe: 0.100s/);
assert.match(summary,/Custom-X Bézier intervals: 2/);
assert.match(summary,/Total measured: 4.200s/);
assert.ok(!summary.includes('/tmp/'),'No private file path in benchmark.');
assert.throws(()=>renderBenchmarkReport({
 mediaSeconds:2,probeMs:-1,planMs:0,encodeMs:0,verifyMs:0,totalMs:0,graph:diag
}),/benchmark probeMs/);
assert.throws(()=>renderBenchmarkReport({
 mediaSeconds:2,probeMs:0,planMs:0,encodeMs:0,verifyMs:0,totalMs:0,
 graph:{...diag,maxProbeError:NaN}
}),/graph diagnostics/);
const cli=new URL('./studio-export-local.mjs',import.meta.url).pathname;
const help=spawnSync(process.execPath,[cli,'--help'],{encoding:'utf8'});
assert.equal(help.status,0);
assert.match(help.stdout,/--benchmark/);
const invalid=spawnSync(process.execPath,[cli,'--draft','missing.json',
 '--out','x.mp4','--media-dir','missing','--dry-run','--benchmark'],
 {encoding:'utf8'});
assert.equal(invalid.status,1);
assert.match(invalid.stderr,/cannot be used with --dry-run/);

// Read-only scrubber acceptance: changing segment/sample must not create receipts.
class E{
 constructor(tag){this.tag=tag;this.dataset={};this.style={};this.attrs={};
  this.children=[];this.handlers={};this.hidden=false;this.classList={add(){}};}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=[...children];}
 setAttribute(k,v){this.attrs[k]=v;}
 addEventListener(name,fn){(this.handlers[name]??=[]).push(fn);}
 fire(name){for(const fn of this.handlers[name]||[])fn({
  preventDefault(){},stopPropagation(){},target:this});}
 getBoundingClientRect(){return {left:0,top:0,width:200,height:100};}
 querySelector(){return null;}
}
const doc={createElement:t=>new E(t),createElementNS:(_ns,t)=>new E(t)};
const root=new E('div'),opacityLane=new E('div'),volumeLane=new E('div');
root.append(opacityLane,volumeLane);
let edits=0,errors=[];
function render(){
 renderMultiPointKeyframeLanes({root,opacityLane,volumeLane,
   clip:state.video2Clips[0],total:5,getPlayhead:()=>2.5,editable:true,document:doc,
   onCommit:cmd=>{state=change(state,cmd);edits++;render();},
   onError:msg=>errors.push(msg)});
}
render();
const probe=()=>opacityLane.children[4];
assert.equal(probe().className,'keyframe-graph-probe');
const range=()=>probe().children[0],readout=()=>probe().children[1];
assert.match(readout().textContent,/at 2.50s \/ 50.0% clip/);
range().value='250';range().fire('input');
assert.match(readout().textContent,/at 1.50s \/ 25.0% clip/);
assert.equal(edits,0);
assert.deepEqual(errors,[]);
assert.equal(validate(state),true);
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
assert.match(html,/R7\.(?:4 · GRAPH & BENCHMARK|5 · EXPORT LAB|6 · ALPHA FASTPATHS|7 · BALANCED BÉZIER)/);
assert.match(css,/\.keyframe-graph-probe/);
console.log('ParaCut R7.4 PASS: read-only graph probe, safe benchmark stats, real-encode flag contract, draft/undo and FFmpeg diagnostics.');
