import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,undo,redo,validate,exportDraft,importDraft,overlayOpacityAt}
  from '../apps/desktop/public/studio-core.js';
import {planBezierExportSegments,approximateBezierExportAt,bezier2dAt,
  BEZIER_EXPORT_MAX_SEGMENTS,BEZIER_EXPORT_TARGET_ERROR,keyframeCurveAt,
  keyframeCurveExpression,setKeyframeBezierHandlePosition}
  from '../apps/desktop/public/studio-keyframe-points.js';
import {renderMultiPointKeyframeLanes,curvePathFor}
  from '../apps/desktop/public/studio-multipoint-view.js';
import {planLocalMp4} from './studio-local-export-core.mjs';
const eq=(a,b,eps=.001)=>assert.ok(Math.abs(a-b)<eps,a+' vs '+b);
assert.equal(BEZIER_EXPORT_MAX_SEGMENTS,64);
assert.equal(BEZIER_EXPORT_TARGET_ERROR,.0015);
const usual=planBezierExportSegments([.25,.75],[.15,.76]);
assert.ok(usual.segments<30);
assert.ok(usual.observedMaxError<.002);
assert.equal(usual.points.length,usual.segments+1);
for(const [hy,hx] of [
  [[.25,.75],[.15,.76]],[[0,0],[.2,.8]],[[1,0],[.8,.95]],
  [[1,0],[0,1]],[[1,0],[0,0]],[[0,1],[1,1]],[[1,1],[.001,.001]]
]){
  const plan=planBezierExportSegments(hy,hx);
  assert.ok(plan.segments>=1&&plan.segments<=64);
  assert.ok(Number.isFinite(plan.observedMaxError));
  for(let k=0;k<=1000;k++){
    const x=k/1000,a=approximateBezierExportAt(plan,x);
    assert.ok(Number.isFinite(a)&&a>=0&&a<=1);
    eq(a,bezier2dAt(x,hy,hx),.01);
  }
  for(let k=1;k<plan.points.length;k++)
    assert.ok(plan.points[k].x>plan.points[k-1].x);
}
for(const bad of [
 [[.2,.8],[.9,.1]],[[0,NaN],[.2,.8]],[[0,1],[.2,2]],
 [[0,1],null],[[0,1],[0]]
])assert.throws(()=>planBezierExportSegments(...bad),/Invalid Bézier export/);
assert.throws(()=>approximateBezierExportAt(usual,Infinity),/progress/);
const old=[{at:0,value:0,ease:'bezier',handles:[.25,.75]},{at:1,value:1}];
const moved=setKeyframeBezierHandlePosition(old,0,0,.15,.25);
assert.ok(curvePathFor(moved).split(' L ').length>=64);
const oldExpr=keyframeCurveExpression(old,5),expr=keyframeCurveExpression(moved,5);
assert.ok(expr.length>oldExpr.length&&expr.length<13000);
assert.ok((expr.match(/if\(lt\(/g)||[]).length<30);
assert.ok(!/NaN|Infinity|__proto__/.test(expr));
const asset=(id,type,duration)=>({asset_id:id,name:id,type,duration,size:100,lastModified:0});
let s=newStudio('R7.3');
for(const a of [asset('main','video/mp4',5),asset('over','video/mp4',4)])
 s=change(s,{type:'asset.added',asset:a});
s=change(s,{type:'clip.appended',asset_id:'main'});
s=change(s,{type:'clip.layer.added',asset_id:'over',track_id:'video-2',start:.5});
const id=s.video2Clips[0].clip_id,oldDraft=exportDraft(s);
const linked=Object.fromEntries(s.assets.map(a=>[a.asset_id,{
 path:'/tmp/'+a.name,hasAudio:false}]));
const baseline=planLocalMp4(s,linked,'/tmp/base.mp4').graph;
s=change(s,{type:'clip.keyframe.points.updated',clip_id:id,field:'opacity_keyframes',points:moved});
eq(overlayOpacityAt(s.video2Clips[0],2.5),keyframeCurveAt(moved,.5));
assert.equal(undo(s).video2Clips[0].opacity_keyframe_points,undefined);
assert.deepEqual(redo(undo(s)).video2Clips[0].opacity_keyframe_points,moved);
assert.notEqual(planLocalMp4(s,linked,'/tmp/r73.mp4').graph,baseline);
assert.equal(validate(s),true);
assert.deepEqual(importDraft(exportDraft(s)).video2Clips[0].opacity_keyframe_points,moved);
assert.equal(importDraft(oldDraft).video2Clips[0].opacity_keyframe_points,undefined);
class E{
 constructor(tag){this.tag=tag;this.dataset={};this.style={};this.attrs={};
  this.children=[];this.handlers={};this.hidden=false;this.classList={add(){}};}
 append(...x){this.children.push(...x);}
 replaceChildren(...x){this.children=[...x];}
 setAttribute(k,v){this.attrs[k]=v;}
 addEventListener(n,fn){(this.handlers[n]??=[]).push(fn);}
 fire(n){for(const fn of this.handlers[n]||[])fn({
  stopPropagation(){},preventDefault(){},target:this});}
 querySelector(){return null;}
 getBoundingClientRect(){return {left:0,top:0,width:200,height:100};}
}
const doc={createElement:t=>new E(t),createElementNS:(_ns,t)=>new E(t)};
const root=new E('div'),opacityLane=new E('div'),volumeLane=new E('div');
root.append(opacityLane,volumeLane);
let edits=0,errors=[];
function render(){
 renderMultiPointKeyframeLanes({root,opacityLane,volumeLane,
  clip:s.video2Clips[0],total:5,playhead:1,editable:true,document:doc,
  onCommit:cmd=>{s=change(s,cmd);edits++;render();},
  onError:err=>errors.push(err)});
}
render();
const fields=()=>opacityLane.children[3];
const x=()=>fields().children[1].children[0];
const y=()=>fields().children[2].children[0];
const apply=()=>fields().children[3];
assert.equal(fields().hidden,false);
assert.equal(x().value,'15');
assert.equal(y().value,'25');
x().value='18.4';y().value='32.5';
apply().fire('click');
assert.equal(edits,1);
assert.deepEqual(s.video2Clips[0].opacity_keyframe_points[0].handles_x,[.184,.667]);
assert.deepEqual(s.video2Clips[0].opacity_keyframe_points[0].handles,[.325,.75]);
assert.equal(s.receipts.at(-1).action,'clip.keyframe.points.updated');
apply().fire('click');
assert.equal(edits,1);
x().value='99';y().value='10';apply().fire('click');
assert.equal(edits,1);
assert.ok(errors.some(err=>/ordered/.test(err)));
assert.equal(validate(s),true);
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
assert.match(html,/R7\.(?:3 · PRECISION & EXPORT|4 · GRAPH & BENCHMARK)/);
assert.match(css,/\.keyframe-precision-controls/);
console.log('ParaCut R7.3 PASS: adaptive export fit, precise XY controls, receipts, drafts and Undo/Redo.');
