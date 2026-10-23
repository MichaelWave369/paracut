import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,undo,redo,exportDraft,importDraft,validate,
  overlayOpacityAt,audioLevelAt} from '../apps/desktop/public/studio-core.js';
import {KEYFRAME_EASES,validateKeyframePoints,setKeyframeSegmentEase,
  keyframeCurveAt,keyframeCurveExpression,addKeyframePoint,
  moveKeyframePoint} from '../apps/desktop/public/studio-keyframe-points.js';
import {audioKeyframeFilter,overlayKeyframeFilter}
  from '../apps/desktop/public/studio-keyframes.js';
import {curvePathFor,renderMultiPointKeyframeLanes}
  from '../apps/desktop/public/studio-multipoint-view.js';
import {planLocalMp4} from './studio-local-export-core.mjs';

const eq=(a,b)=>assert.ok(Math.abs(a-b)<.001,'Expected '+a+' ~= '+b);
const pair=[{at:0,value:0},{at:1,value:1}];
assert.deepEqual(KEYFRAME_EASES.slice(0,4),['linear','ease-in','ease-out','ease-in-out']);
assert.deepEqual(validateKeyframePoints(pair),pair);
assert.deepEqual(setKeyframeSegmentEase(pair,0,'linear'),pair);
const easeIn=setKeyframeSegmentEase(pair,0,'ease-in');
const easeOut=setKeyframeSegmentEase(pair,0,'ease-out');
const smooth=setKeyframeSegmentEase(pair,0,'ease-in-out');
eq(keyframeCurveAt(pair,.25),.25);
eq(keyframeCurveAt(easeIn,.5),.25);
eq(keyframeCurveAt(easeOut,.5),.75);
eq(keyframeCurveAt(smooth,.25),.15625);
eq(keyframeCurveAt(smooth,.5),.5);
eq(keyframeCurveAt(smooth,.75),.84375);
eq(keyframeCurveAt(smooth,-100),0);
eq(keyframeCurveAt(smooth,100),1);
assert.ok(curvePathFor(smooth).split(' L ').length>15);
assert.equal(curvePathFor(pair),'M 0 100 L 100 0');
assert.deepEqual(setKeyframeSegmentEase(smooth,0,'linear'),pair);
assert.throws(()=>setKeyframeSegmentEase(pair,1,'ease-in'),/segment index/);
assert.throws(()=>setKeyframeSegmentEase(pair,0,'__proto__'),/easing mode/);
assert.throws(()=>validateKeyframePoints([{at:0,value:0,ease:'evil()'},pair[1]]),/Invalid keyframe/);
assert.throws(()=>validateKeyframePoints([pair[0],{at:1,value:1,ease:'ease-in'}]),/Invalid keyframe/);
assert.throws(()=>validateKeyframePoints([{at:0,value:0,ease:'linear',extra:true},pair[1]]),/Invalid keyframe/);
const withMiddle=addKeyframePoint(smooth,.5,.5);
assert.equal(withMiddle[0].ease,'ease-in-out');
assert.equal(withMiddle[1].ease,undefined);
const moved=moveKeyframePoint(withMiddle,0,0,.2);
assert.equal(moved[0].ease,'ease-in-out');
const multipoint=validateKeyframePoints([
  {at:0,value:0,ease:'ease-in'},{at:.4,value:1,ease:'ease-out'},
  {at:1,value:.5}
]);
eq(keyframeCurveAt(multipoint,.2),.25);
eq(keyframeCurveAt(multipoint,.7),.625);
const ff=keyframeCurveExpression(multipoint,4,'t');
assert.match(ff,/if\(lt\(t,1\.6\)/);
assert.match(ff,/1-\(1-/); // ease-out uses bounded numeric math
assert.ok(ff.includes('min(1,max(0,'));
assert.equal(keyframeCurveExpression(pair,4,'t').includes('if(lt(t,'),true);

const asset=(id,type,duration)=>({asset_id:id,name:id,type,duration,size:100,lastModified:0});
let state=newStudio('R7.0 Easing');
for(const a of [asset('main','video/mp4',5),asset('overlay','video/mp4',4),
  asset('song','audio/wav',5)]) state=change(state,{type:'asset.added',asset:a});
state=change(state,{type:'clip.appended',asset_id:'main'});
state=change(state,{type:'clip.appended',asset_id:'song'});
state=change(state,{type:'clip.layer.added',asset_id:'overlay',track_id:'video-2',start:.5});
const v2=state.video2Clips[0].clip_id,a1=state.audioClips[0].clip_id;
const oldDraft=exportDraft(state);
const links=Object.fromEntries(state.assets.map(a=>[a.asset_id,
  {path:'/tmp/'+a.name,hasAudio:a.type.startsWith('audio/')}]));
const baseGraph=planLocalMp4(state,links,'/tmp/r70-original.mp4').graph;
let before=state.receipts.length;
state=change(state,{type:'clip.keyframe.points.updated',clip_id:v2,
  field:'opacity_keyframes',points:smooth});
assert.equal(state.receipts.length,before+1);
assert.equal(state.receipts.at(-1).action,'clip.keyframe.points.updated');
assert.deepEqual(state.receipts.at(-1).details.points,smooth);
eq(overlayOpacityAt(state.video2Clips[0],.5+4*.25),.15625);
assert.deepEqual(undo(state).video2Clips[0].opacity_keyframe_points,undefined);
assert.deepEqual(redo(undo(state)).video2Clips[0].opacity_keyframe_points,smooth);
state=change(state,{type:'clip.keyframe.points.updated',clip_id:a1,
  field:'volume_keyframes',points:easeOut});
eq(audioLevelAt(state.audioClips[0],2.5),.75);
assert.equal(validate(state),true);
assert.deepEqual(importDraft(exportDraft(state)).video2Clips[0].opacity_keyframe_points,smooth);
assert.equal(importDraft(oldDraft).video2Clips[0].opacity_keyframe_points,undefined);
const tampered=JSON.parse(exportDraft(state));
tampered.audioClips[0].volume_keyframe_points[0].ease="1);[evil]";
assert.throws(()=>importDraft(JSON.stringify(tampered)),/Invalid keyframe/);
const original=exportDraft(state);
assert.throws(()=>change(state,{type:'clip.keyframe.points.updated',clip_id:a1,
  field:'volume_keyframes',points:[{at:0,value:1,ease:'bad'},{at:1,value:1}]}),/Invalid keyframe/);
assert.equal(exportDraft(state),original);
const graph=planLocalMp4(state,links,'/tmp/r70-eased.mp4').graph;
assert.notEqual(graph,baseGraph);
assert.match(graph,/geq=r=r\(X\\,Y\)/);
assert.ok(graph.includes('1-(1-(')); // ease-out source-local audio expression
assert.ok(overlayKeyframeFilter(state.video2Clips[0]).includes('min(1'));
assert.ok(audioKeyframeFilter(state.audioClips[0]).includes('1-(1-('));
const flatten=change(state,{type:'clip.keyframes.updated',clip_id:v2,
  field:'opacity_keyframes',values:{start:0,end:1}});
assert.equal(flatten.video2Clips[0].opacity_keyframe_points,undefined);

// DOM select acceptance: switch segment and commit exactly one receipt.
// Mock also verifies R6.9 DOM-level pointer and keyboard tests remain separate.
class El {
  constructor(tag){this.tag=tag;this.dataset={};this.style={};this.attrs={};
    this.children=[];this.handlers={};this.hidden=false;this.classList={add(){}};}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(event,fn){(this.handlers[event]??=[]).push(fn);}
  fire(event){for(const fn of this.handlers[event]||[])fn({
    stopPropagation(){},preventDefault(){},target:this});}
  querySelector(){return null;}
  getBoundingClientRect(){return {left:0,top:0,width:200,height:100};}
}
const doc={createElement:t=>new El(t),createElementNS:(_ns,t)=>new El(t)};
const root=new El('div'),opacityLane=new El('div'),volumeLane=new El('div');
root.append(opacityLane,volumeLane);
let edits=0,errors=[];
function render(){
  renderMultiPointKeyframeLanes({root,opacityLane,volumeLane,
    clip:state.video2Clips[0],total:5,playhead:1,editable:true,document:doc,
    onCommit:command=>{state=change(state,command);edits++;render();},
    onError:message=>errors.push(message)});
}
render();
assert.equal(opacityLane.children.at(-1).className.startsWith('keyframe-plot'),true);
let controls=opacityLane.children[2];
let segment=controls.children[0].children[0];
let mode=controls.children[1].children[0];
assert.equal(segment.value,'0');
assert.equal(mode.value,'ease-in-out');
mode.value='ease-in';mode.fire('change');
assert.equal(edits,1);
assert.equal(state.video2Clips[0].opacity_keyframe_points[0].ease,'ease-in');
assert.equal(state.receipts.at(-1).details.points[0].ease,'ease-in');
controls=opacityLane.children[2];
segment=controls.children[0].children[0];
mode=controls.children[1].children[0];
mode.value='ease-in';mode.fire('change');
assert.equal(edits,1); // no-op is not a receipt
assert.deepEqual(errors,[]);
assert.equal(validate(state),true);

const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
assert.match(html,/R7\.(?:0 · EASING CURVES|1 · CUSTOM BÉZIER|2 · 2D BÉZIER|3 · PRECISION & EXPORT|4 · GRAPH & BENCHMARK|5 · EXPORT LAB)/);
assert.match(css,/\.keyframe-easing-controls/);
console.log('ParaCut R7.0 PASS: eased math, visual curve sampling, safe FFmpeg, saved drafts, UI segment changes, receipts and Undo/Redo.');
