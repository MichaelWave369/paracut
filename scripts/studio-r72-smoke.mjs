import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,validate,exportDraft,importDraft,undo,redo,
 overlayOpacityAt,audioLevelAt} from '../apps/desktop/public/studio-core.js';
import {DEFAULT_BEZIER_X,validateKeyframePoints,keyframeCurveAt,bezier2dAt,
 keyframeCurveExpression,setKeyframeSegmentEase,setKeyframeBezierHandle,
 setKeyframeBezierHandlePosition,moveKeyframePoint}
 from '../apps/desktop/public/studio-keyframe-points.js';
import {renderMultiPointKeyframeLanes,curvePathFor}
 from '../apps/desktop/public/studio-multipoint-view.js';
import {audioKeyframeFilter,overlayKeyframeFilter}
 from '../apps/desktop/public/studio-keyframes.js';
import {planLocalMp4} from './studio-local-export-core.mjs';
const approx=(a,b,epsilon=.001)=>assert.ok(Math.abs(a-b)<epsilon, a+' != '+b);
const old=[{at:0,value:0,ease:'bezier',handles:[.2,.8]},{at:1,value:1}];
const altered=setKeyframeBezierHandlePosition(old,0,0,.15,.3);
assert.deepEqual(DEFAULT_BEZIER_X,[1/3,2/3]);
assert.deepEqual(altered[0].handles_x,[.15,.667]);
assert.deepEqual(altered[0].handles,[.3,.8]);
assert.deepEqual(validateKeyframePoints(altered),altered);
assert.deepEqual(setKeyframeBezierHandle(altered,0,1,.9)[0].handles_x,[.15,.667]);
assert.deepEqual(moveKeyframePoint(altered,0,0,.25)[0].handles_x,[.15,.667]);
assert.deepEqual(setKeyframeSegmentEase(altered,0,'linear'),[
 {at:0,value:0},{at:1,value:1}
]);
approx(keyframeCurveAt(old,.5),.5);
approx(bezier2dAt(0,[.2,.8],[.8,.95]),0);
approx(bezier2dAt(1,[.2,.8],[.8,.95]),1);
const different=setKeyframeBezierHandlePosition(old,0,1,.95,.8);
const strong=setKeyframeBezierHandlePosition(different,0,0,.8,.2);
assert.ok(keyframeCurveAt(strong,.25)<keyframeCurveAt(old,.25)-.05);
assert.ok(curvePathFor(strong).split(' L ').length>15);
assert.match(keyframeCurveExpression(strong,4,'t'),/if\(lt\(min\(1,max\(0,t\/4\)\)/);
assert.ok(keyframeCurveExpression(strong,4,'t').length>1500);
for(let i=0;i<=100;i++){
 const u=i/100,value=keyframeCurveAt(strong,u);
 assert.ok(value>=0&&value<=1);
}
for(const bad of [
 [{at:0,value:0,ease:'bezier',handles:[.2,.8],handles_x:[.9,.1]},{at:1,value:1}],
 [{at:0,value:0,ease:'bezier',handles:[.2,.8],handles_x:[0,Infinity]},{at:1,value:1}],
 [{at:0,value:0,ease:'bezier',handles:[.2,.8],handles_x:['.2',.8]},{at:1,value:1}],
 [{at:0,value:0,ease:'bezier',handles:[.2,.8],handles_x:[.2]},{at:1,value:1}],
 [{at:0,value:0,ease:'ease-in',handles_x:[.2,.8]},{at:1,value:1}],
 [{at:0,value:0,ease:'bezier',handles:[.2,.8],handles_x:[.2,.8],formula:'evil'},{at:1,value:1}],
 [{at:0,value:0},{at:1,value:1,handles_x:[.2,.8]}]
])assert.throws(()=>validateKeyframePoints(bad),/Invalid keyframe/);
assert.throws(()=>setKeyframeBezierHandlePosition(old,0,0,.99,.5),/ordered/);
assert.throws(()=>setKeyframeBezierHandlePosition(old,0,1,.01,.5),/ordered/);
assert.throws(()=>setKeyframeBezierHandlePosition(old,0,0,NaN,.5),/coordinates/);
assert.throws(()=>setKeyframeBezierHandlePosition(old,0,0,.1,1.1),/coordinates/);
assert.throws(()=>setKeyframeBezierHandlePosition(old,1,0,.1,.2),/segment/);
assert.throws(()=>setKeyframeBezierHandlePosition(old,0,3,.1,.2),/coordinates/);
// Boundary ordering is permitted. Mathematical inverse remains defined.
const extreme=[{at:0,value:0,ease:'bezier',handles:[1,0],handles_x:[0,0]},
 {at:1,value:1}];
assert.ok(keyframeCurveAt(extreme,.0001)>=0);
assert.ok(keyframeCurveAt(extreme,.9999)<=1);

const mk=(id,type,length)=>({asset_id:id,name:id,type,duration:length,size:100,lastModified:0});
let s=newStudio('R7.2 full 2D');
for(const a of [mk('main','video/mp4',5),mk('overlay','video/mp4',4),
 mk('music','audio/wav',5)])s=change(s,{type:'asset.added',asset:a});
for(const asset_id of ['main','music'])s=change(s,{type:'clip.appended',asset_id});
s=change(s,{type:'clip.layer.added',asset_id:'overlay',track_id:'video-2',start:.5});
const videoId=s.video2Clips[0].clip_id,audioId=s.audioClips[0].clip_id;
const legacy=exportDraft(s);
const linked=Object.fromEntries(s.assets.map(a=>[a.asset_id,{
 path:'/tmp/'+a.name,hasAudio:a.type.startsWith('audio/')}]));
const baseGraph=planLocalMp4(s,linked,'/tmp/pre-r72.mp4').graph;
const beforeReceipt=s.receipts.length;
s=change(s,{type:'clip.keyframe.points.updated',clip_id:videoId,
 field:'opacity_keyframes',points:strong});
assert.equal(s.receipts.length,beforeReceipt+1);
assert.deepEqual(s.receipts.at(-1).details.points,strong);
approx(overlayOpacityAt(s.video2Clips[0],.5+4*.25),keyframeCurveAt(strong,.25));
assert.equal(undo(s).video2Clips[0].opacity_keyframe_points,undefined);
assert.deepEqual(redo(undo(s)).video2Clips[0].opacity_keyframe_points,strong);
s=change(s,{type:'clip.keyframe.points.updated',clip_id:audioId,
 field:'volume_keyframes',points:altered});
approx(audioLevelAt(s.audioClips[0],2.5),keyframeCurveAt(altered,.5));
assert.equal(validate(s),true);
assert.deepEqual(importDraft(exportDraft(s)).video2Clips[0].opacity_keyframe_points,strong);
assert.equal(importDraft(legacy).video2Clips[0].opacity_keyframe_points,undefined);
const tampered=JSON.parse(exportDraft(s));
tampered.video2Clips[0].opacity_keyframe_points[0].handles_x=[.95,.1];
assert.throws(()=>importDraft(JSON.stringify(tampered)),/Invalid keyframe/);
const graph=planLocalMp4(s,linked,'/tmp/r72.mp4').graph;
assert.notEqual(graph,baseGraph);
assert.match(graph,/geq=r=r\(X\\,Y\)/);
assert.ok(graph.includes('if(lt('));
assert.ok(graph.length>baseGraph.length+1000);
assert.ok(audioKeyframeFilter(s.audioClips[0]).includes('if(lt('));
assert.ok(overlayKeyframeFilter(s.video2Clips[0]).includes('if(lt('));

// Fake DOM checks use the actual selected-clip renderer and core change pipeline.
class El{
 constructor(tag){this.tag=tag;this.dataset={};this.style={};this.attrs={};
  this.children=[];this.handlers={};this.hidden=false;this.focused=false;
  this.classList={add(){}};}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=[...nodes];}
 setAttribute(k,v){this.attrs[k]=v;}
 addEventListener(e,fn){(this.handlers[e]??=[]).push(fn);}
 fire(name,options={}){for(const fn of this.handlers[name]||[])fn({
  button:0,pointerId:12,clientX:100,clientY:60,key:'',shiftKey:false,
  preventDefault(){},stopPropagation(){},target:this,...options});}
 focus(){this.focused=true;}
 setPointerCapture(id){this.ptr=id;}
 hasPointerCapture(id){return this.ptr===id;}
 releasePointerCapture(id){if(this.ptr===id)this.ptr=null;}
 getBoundingClientRect(){return {left:0,top:0,width:200,height:100};}
 querySelector(q){
  const property=q.match(/data-keyframe-bezier="([^"]+)"/)?.[1];
  const ix=q.match(/data-control-index="([^"]+)"/)?.[1];
  const nodes=[this];
  while(nodes.length){
   const n=nodes.pop();
   if(n.dataset.keyframeBezier===property&&n.dataset.controlIndex===ix)return n;
   nodes.push(...n.children);
  }
  return null;
 }
}
const doc={createElement:t=>new El(t),createElementNS:(_ns,t)=>new El(t)};
const root=new El('div'),opacityLane=new El('div'),volumeLane=new El('div');
root.append(opacityLane,volumeLane);
let edits=0,errors=[];
function render(){
 renderMultiPointKeyframeLanes({root,opacityLane,volumeLane,
  clip:s.video2Clips[0],total:5,playhead:1,editable:true,document:doc,
  onCommit:command=>{s=change(s,command);edits++;render();},
  onError:message=>errors.push(message)});
}
const handles=()=>opacityLane.children.at(-1).children[1].children;
render();
assert.equal(handles().length,2);
let h=handles()[0];
const xBefore=s.video2Clips[0].opacity_keyframe_points[0].handles_x[0];
h.fire('pointerdown');
h.fire('pointermove',{clientX:106,clientY:55});
assert.equal(edits,0);
h.fire('pointercancel');
assert.equal(edits,0);
assert.equal(s.video2Clips[0].opacity_keyframe_points[0].handles_x[0],xBefore);
h=handles()[0];
h.fire('pointerdown');
h.fire('pointermove',{clientX:106,clientY:55});
assert.equal(edits,0);
h.fire('pointerup',{clientX:106,clientY:55});
assert.equal(edits,1);
assert.equal(s.receipts.at(-1).action,'clip.keyframe.points.updated');
assert.equal(s.video2Clips[0].opacity_keyframe_points[0].handles_x[0],
 Math.round((xBefore+.03)*1000)/1000);
assert.equal(handles()[0].focused,true);
h=handles()[0];h.fire('keydown',{key:'ArrowLeft'});
assert.equal(edits,2);
assert.equal(s.video2Clips[0].opacity_keyframe_points[0].handles_x[0],
 Math.round((xBefore+.005)*1000)/1000);
h=handles()[0];h.fire('keydown',{key:'ArrowUp'});
assert.equal(edits,3);
h=handles()[0];h.fire('keydown',{key:'ArrowUp',shiftKey:true});
assert.equal(edits,4);
assert.deepEqual(errors,[]);
assert.equal(validate(s),true);
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
assert.match(html,/R7\\.(?:2 · 2D BÉZIER|3 · PRECISION & EXPORT)/);
assert.match(css,/\.keyframe-bezier-handle/);
console.log('ParaCut R7.2 PASS: 2D handle bounds/inversion, sample FFmpeg graph, old drafts, and pointer/keyboard receipts.');
