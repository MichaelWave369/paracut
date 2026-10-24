import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,undo,redo,exportDraft,importDraft,validate,
 overlayOpacityAt,audioLevelAt} from '../apps/desktop/public/studio-core.js';
import {KEYFRAME_EASES,DEFAULT_BEZIER_HANDLES,validateKeyframePoints,
 setKeyframeSegmentEase,setKeyframeBezierHandle,keyframeCurveAt,
 keyframeCurveExpression,addKeyframePoint,moveKeyframePoint,
 removeKeyframePoint} from '../apps/desktop/public/studio-keyframe-points.js';
import {audioKeyframeFilter,overlayKeyframeFilter}
 from '../apps/desktop/public/studio-keyframes.js';
import {curvePathFor,renderMultiPointKeyframeLanes}
 from '../apps/desktop/public/studio-multipoint-view.js';
import {planLocalMp4} from './studio-local-export-core.mjs';

const eq=(actual,expected,epsilon=.001)=>assert.ok(
 Math.abs(actual-expected)<epsilon,'Expected '+actual+' ~= '+expected);
assert.equal(KEYFRAME_EASES.at(-1),'bezier');
assert.deepEqual(DEFAULT_BEZIER_HANDLES,[.25,.75]);
const old=[{at:0,value:0},{at:1,value:1}];
const custom=setKeyframeSegmentEase(old,0,'bezier');
assert.deepEqual(custom,[{at:0,value:0,ease:'bezier',handles:[.25,.75]},{at:1,value:1}]);
assert.deepEqual(validateKeyframePoints(old),old);
assert.deepEqual(validateKeyframePoints(custom),custom);
eq(keyframeCurveAt(custom,0),0);
eq(keyframeCurveAt(custom,1),1);
eq(keyframeCurveAt(custom,.5),.5);
let ramp=setKeyframeBezierHandle(custom,0,0,0);
ramp=setKeyframeBezierHandle(ramp,0,1,0);
eq(keyframeCurveAt(ramp,.5),.125);
eq(keyframeCurveAt(ramp,.25),.015625);
assert.equal(setKeyframeBezierHandle(ramp,0,1,.5)[0].handles[1],.5);
assert.deepEqual(setKeyframeSegmentEase(custom,0,'linear'),old);
assert.deepEqual(setKeyframeSegmentEase(custom,0,'ease-in'),
 [{at:0,value:0,ease:'ease-in'},{at:1,value:1}]);
assert.deepEqual(setKeyframeSegmentEase(custom,0,'bezier'),custom);
assert.deepEqual(moveKeyframePoint(custom,0,0,.2)[0].handles,[.25,.75]);
assert.equal(addKeyframePoint(custom,.5,.5)[0].ease,'bezier');
assert.equal(removeKeyframePoint(addKeyframePoint(custom,.5,.5),1).length,2);
for(const bad of [
 [{at:0,value:0,ease:'bezier'},{at:1,value:1}],
 [{at:0,value:0,ease:'bezier',handles:[.3]},{at:1,value:1}],
 [{at:0,value:0,ease:'bezier',handles:[0,2]},{at:1,value:1}],
 [{at:0,value:0,ease:'bezier',handles:[NaN,.5]},{at:1,value:1}],
 [{at:0,value:0,ease:'bezier',handles:[0,'1']},{at:1,value:1}],
 [{at:0,value:0,ease:'ease-in',handles:[.5,.5]},{at:1,value:1}],
 [{at:0,value:0,handles:[.5,.5]},{at:1,value:1}],
 [{at:0,value:0},{at:1,value:1,ease:'bezier',handles:[0,1]}],
 [{at:0,value:0,ease:'bezier',handles:[0,1],script:'bad'},{at:1,value:1}]
])assert.throws(()=>validateKeyframePoints(bad),/Invalid keyframe/);
assert.throws(()=>setKeyframeBezierHandle(old,0,0,.5),/Bézier segment/);
assert.throws(()=>setKeyframeBezierHandle(custom,1,0,.5),/Bézier segment/);
assert.throws(()=>setKeyframeBezierHandle(custom,0,2,.5),/handle value/);
assert.throws(()=>setKeyframeBezierHandle(custom,0,0,Infinity),/handle value/);
assert.throws(()=>setKeyframeBezierHandle(custom,0,0,-.1),/handle value/);
assert.throws(()=>setKeyframeBezierHandle(custom,0,0,1.1),/handle value/);
const varied=[
 {at:0,value:.2,ease:'bezier',handles:[1,0]},
 {at:.5,value:.9,ease:'ease-out'}, {at:1,value:.4}
];
for(let i=0;i<=100;i++){
 const v=keyframeCurveAt(varied,i/100);
 assert.ok(v>=.2-1e-10&&v<=.9+1e-10);
}
assert.ok(curvePathFor(custom).split(' L ').length>15);
assert.match(keyframeCurveExpression(custom,4,'t'),/3\*/);
assert.match(keyframeCurveExpression(custom,4,'T'),/min\(1,max\(0,T\/4\)\)/);
assert.ok(!keyframeCurveExpression(custom,4,'t').includes('NaN'));
assert.throws(()=>keyframeCurveExpression(custom,0,'t'),/duration/);

const asset=(id,type,duration)=>({asset_id:id,name:id,type,duration,size:100,lastModified:0});
let s=newStudio('R7.1 bounded Bézier');
for(const a of [asset('main','video/mp4',5),asset('over','video/mp4',4),
 asset('music','audio/wav',5)])s=change(s,{type:'asset.added',asset:a});
for(const id of ['main','music'])s=change(s,{type:'clip.appended',asset_id:id});
s=change(s,{type:'clip.layer.added',asset_id:'over',track_id:'video-2',start:.5});
const overlay=s.video2Clips[0].clip_id,music=s.audioClips[0].clip_id;
const oldDraft=exportDraft(s);
const linked=Object.fromEntries(s.assets.map(a=>[a.asset_id,
 {path:'/tmp/'+a.name,hasAudio:a.type.startsWith('audio/') }]));
const baselineGraph=planLocalMp4(s,linked,'/tmp/pre-r71.mp4').graph;
let receipts=s.receipts.length;
s=change(s,{type:'clip.keyframe.points.updated',clip_id:overlay,
 field:'opacity_keyframes',points:ramp});
assert.equal(s.receipts.length,receipts+1);
assert.deepEqual(s.receipts.at(-1).details.points,ramp);
eq(overlayOpacityAt(s.video2Clips[0],.5+4*.5),.125);
assert.deepEqual(undo(s).video2Clips[0].opacity_keyframe_points,undefined);
assert.deepEqual(redo(undo(s)).video2Clips[0].opacity_keyframe_points,ramp);
s=change(s,{type:'clip.keyframe.points.updated',clip_id:music,
 field:'volume_keyframes',points:custom});
eq(audioLevelAt(s.audioClips[0],2.5),.5);
assert.equal(validate(s),true);
assert.deepEqual(importDraft(exportDraft(s)).video2Clips[0].opacity_keyframe_points,ramp);
assert.equal(importDraft(oldDraft).video2Clips[0].opacity_keyframe_points,undefined);
const tampered=JSON.parse(exportDraft(s));
tampered.video2Clips[0].opacity_keyframe_points[0].handles=['x',1];
assert.throws(()=>importDraft(JSON.stringify(tampered)),/Invalid keyframe/);
const before=exportDraft(s);
assert.throws(()=>change(s,{type:'clip.keyframe.points.updated',
 clip_id:music,field:'volume_keyframes',
 points:[{at:0,value:0,ease:'bezier',handles:[3,4]},{at:1,value:1}]}),/Invalid keyframe/);
assert.equal(exportDraft(s),before);
const graph=planLocalMp4(s,linked,'/tmp/r71.mp4').graph;
assert.notEqual(graph,baselineGraph);
assert.match(graph,/geq=r=r\(X\\,Y\)/);
assert.ok(graph.includes('*0.25')||graph.includes('*0.75'));
assert.ok(audioKeyframeFilter(s.audioClips[0]).includes('*0.25'));
assert.ok(overlayKeyframeFilter(s.video2Clips[0]).includes('3*'));
const flattened=change(s,{type:'clip.keyframes.updated',clip_id:overlay,
 field:'opacity_keyframes',values:{start:0,end:1}});
assert.equal(flattened.video2Clips[0].opacity_keyframe_points,undefined);

// Control acceptance: select Bézier, keyboard nudges, drag previews only,
// cancellation leaves draft untouched, release creates exactly one receipt.
class E{
 constructor(tag){this.tag=tag;this.dataset={};this.style={};this.attrs={};
  this.children=[];this.handlers={};this.hidden=false;this.classList={add(){}};
  this.focused=false;}
 append(...x){this.children.push(...x);}
 replaceChildren(...x){this.children=[...x];}
 setAttribute(k,v){this.attrs[k]=v;}
 addEventListener(event,fn){(this.handlers[event]??=[]).push(fn);}
 fire(name,over={}){for(const fn of this.handlers[name]||[])fn({
  button:0,pointerId:9,clientX:100,clientY:60,key:'',shiftKey:false,
  stopPropagation(){},preventDefault(){},target:this,...over
 });}
 focus(){this.focused=true;}
 setPointerCapture(id){this.pointer=id;}
 hasPointerCapture(id){return this.pointer===id;}
 releasePointerCapture(id){if(this.pointer===id)this.pointer=null;}
 getBoundingClientRect(){return {left:0,top:0,width:200,height:100};}
 querySelector(selector){
  const prop=selector.match(/data-keyframe-bezier="([^"]+)"/)?.[1];
  const ix=selector.match(/data-control-index="([^"]+)"/)?.[1];
  const stack=[this];
  while(stack.length){
   const x=stack.pop();
   if(x.dataset.keyframeBezier===prop&&x.dataset.controlIndex===ix)return x;
   stack.push(...x.children);
  }
  return null;
 }
}
const doc={createElement:t=>new E(t),createElementNS:(_ns,t)=>new E(t)};
const root=new E('div'),opacityLane=new E('div'),volumeLane=new E('div');
root.append(opacityLane,volumeLane);
let edits=0,errors=[];
function render(){
 renderMultiPointKeyframeLanes({root,opacityLane,volumeLane,
  clip:s.video2Clips[0],total:5,playhead:1,editable:true,document:doc,
  onCommit:cmd=>{s=change(s,cmd);edits++;render();},
  onError:msg=>errors.push(msg)});
}
const controls=()=>opacityLane.children[2];
const select=()=>controls().children[1].children[0];
const plot=()=>opacityLane.children.at(-1);
const handles=()=>plot().children[1].children;
render();
assert.equal(select().value,'bezier');
assert.equal(handles().length,2);
let h=handles()[0];
h.fire('keydown',{key:'ArrowUp'});
assert.equal(edits,1);
assert.equal(s.video2Clips[0].opacity_keyframe_points[0].handles[0],.05);
assert.equal(handles()[0].focused,true);
h=handles()[1];
h.fire('pointerdown');
h.fire('pointermove',{clientY:30});
assert.equal(edits,1,'drag preview must not write to ledger');
h.fire('pointercancel');
assert.equal(edits,1,'cancel must not write to ledger');
assert.equal(s.video2Clips[0].opacity_keyframe_points[0].handles[1],0);
h=handles()[1];
h.fire('pointerdown');
h.fire('pointermove',{clientY:25});
assert.equal(edits,1);
h.fire('pointerup',{clientY:25});
assert.equal(edits,2);
assert.equal(s.receipts.at(-1).action,'clip.keyframe.points.updated');
assert.equal(s.video2Clips[0].opacity_keyframe_points[0].handles[1],.35);
assert.equal(handles()[1].focused,true);
h=handles()[1];h.fire('keydown',{key:'End'});
assert.equal(s.video2Clips[0].opacity_keyframe_points[0].handles[1],1);
h=handles()[1];h.fire('keydown',{key:'End'});
assert.equal(edits,3,'no-op handle input must not write receipt');
assert.deepEqual(errors,[]);
assert.equal(validate(s),true);
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
assert.match(html,/R7\.(?:1 · CUSTOM BÉZIER|2 · 2D BÉZIER|3 · PRECISION & EXPORT|4 · GRAPH & BENCHMARK|5 · EXPORT LAB|6 · ALPHA FASTPATHS|7 · BALANCED BÉZIER|8 · CONTROLLED A\/B|9 · EXPORT DIAGNOSTICS)|R8\.(?:0 · CREATIVE TITLE DECK|1 · TITLE TIMING LAB|2 · TITLE MOTION|3 · MOTION CURVES|4 · DIRECT TITLE PLACEMENT)/);
assert.match(css,/\.keyframe-bezier-handle/);
console.log('ParaCut R7.1 PASS: bounded Bézier math, FFmpeg, project validation, drag/cancel, keyboard, receipts and Undo/Redo.');
