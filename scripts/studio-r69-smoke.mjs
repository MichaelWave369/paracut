import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,validate,undo,redo,exportDraft,importDraft,
  overlayOpacityAt,audioLevelAt} from '../apps/desktop/public/studio-core.js';
import {pointsField,validateKeyframePoints,keyframePointsFor,keyframeCurveAt,
  addKeyframePoint,moveKeyframePoint,removeKeyframePoint,keyframeCurveExpression,
  KEYFRAME_POINT_LIMIT} from '../apps/desktop/public/studio-keyframe-points.js';
import {audioKeyframeFilter,overlayKeyframeFilter}
  from '../apps/desktop/public/studio-keyframes.js';
import {renderMultiPointKeyframeLanes}
  from '../apps/desktop/public/studio-multipoint-view.js';
import {planLocalMp4} from './studio-local-export-core.mjs';
const eq=(a,b)=>assert.ok(Math.abs(a-b)<.001,'Expected '+a+' ~= '+b);
const points=[{at:0,value:0},{at:.3,value:1},{at:.7,value:.4},{at:1,value:1}];
assert.equal(KEYFRAME_POINT_LIMIT,8);
assert.equal(pointsField('volume_keyframes'),'volume_keyframe_points');
assert.equal(pointsField('opacity_keyframes'),'opacity_keyframe_points');
assert.throws(()=>pointsField('custom'),/Unsupported/);
assert.deepEqual(validateKeyframePoints(points),points);
assert.deepEqual(keyframePointsFor({},'volume_keyframes'),
 [{at:0,value:1},{at:1,value:1}]);
assert.deepEqual(keyframePointsFor({volume_keyframes:{start:.2,end:.8}},'volume_keyframes'),
 [{at:0,value:.2},{at:1,value:.8}]);
eq(keyframeCurveAt(points,.15),.5);
eq(keyframeCurveAt(points,.5),.7);
eq(keyframeCurveAt(points,.85),.7);
eq(keyframeCurveAt(points,-99),0);
eq(keyframeCurveAt(points,99),1);
for(const bad of [[],[points[0]],Array(9).fill({at:0,value:1}),
 [{at:0,value:1},{at:0,value:.5},{at:1,value:1}],
 [{at:0,value:1},{at:.005,value:.5},{at:1,value:1}],
 [{at:0,value:1},{at:1,value:NaN}],
 [{at:0,value:1},{at:1,value:'1'}],
 [{at:0,value:1},{at:1,value:1,script:'x'}],
 [{at:.1,value:1},{at:1,value:1}],
 [{at:0,value:1},{at:.9,value:1}]
])assert.throws(()=>validateKeyframePoints(bad),/Keyframe/);
const inserted=addKeyframePoint(points,.5,.7);
assert.equal(inserted.length,5);
assert.equal(inserted[2].at,.5);
assert.throws(()=>addKeyframePoint(points,.3,.4),/separated/);
assert.throws(()=>addKeyframePoint(points,0,.4),/Interior/);
assert.throws(()=>addKeyframePoint(points,1,.4),/Interior/);
assert.throws(()=>addKeyframePoint(validateKeyframePoints([
 {at:0,value:1},...Array.from({length:6},(_,i)=>({at:(i+1)/7,value:.5})),
 {at:1,value:1}]),.5,.7),/Maximum eight/);
assert.deepEqual(moveKeyframePoint(inserted,2,.6,.3)[2],{at:.6,value:.3});
assert.throws(()=>moveKeyframePoint(inserted,2,.71,.5),/sorted/);
assert.throws(()=>moveKeyframePoint(inserted,0,.2,.5),/fixed/);
assert.throws(()=>moveKeyframePoint(inserted,999,.5,.5),/index/);
assert.equal(removeKeyframePoint(inserted,2).length,4);
assert.throws(()=>removeKeyframePoint(inserted,0),/interior/);
assert.throws(()=>removeKeyframePoint(inserted,inserted.length-1),/interior/);
assert.match(keyframeCurveExpression(points,4,'t'),/if\(lt\(t,1\.2\)/);
assert.match(keyframeCurveExpression(points,4,'T'),/if\(lt\(T,1\.2\)/);
assert.throws(()=>keyframeCurveExpression(points,0,'t'),/duration/);
assert.throws(()=>keyframeCurveAt(points,Infinity),/progress/);

const mk=(id,type,secs)=>({asset_id:id,name:id,type,duration:secs,size:100,lastModified:0});
let s=newStudio('R6.9 multi-point');
for(const a of [mk('main','video/mp4',5),mk('over','video/mp4',4),
  mk('song','audio/wav',5),mk('voice','audio/wav',3)])
 s=change(s,{type:'asset.added',asset:a});
for(const asset_id of ['main','song'])s=change(s,{type:'clip.appended',asset_id});
s=change(s,{type:'clip.layer.added',asset_id:'over',track_id:'video-2',start:.5});
s=change(s,{type:'clip.layer.added',asset_id:'voice',track_id:'audio-2',start:1});
const v1=s.clips[0].clip_id,v2=s.video2Clips[0].clip_id,a1=s.audioClips[0].clip_id;
const originals=exportDraft(s);
const linked=Object.fromEntries(s.assets.map(a=>[a.asset_id,{
 path:'/tmp/'+a.name,hasAudio:a.type.startsWith('audio/')
}]));
const baseGraph=planLocalMp4(s,linked,'/tmp/r69.mp4').graph;
const count=s.receipts.length;
s=change(s,{type:'clip.keyframe.points.updated',clip_id:v2,
 field:'opacity_keyframes',points});
assert.equal(s.receipts.length,count+1);
assert.equal(s.receipts.at(-1).action,'clip.keyframe.points.updated');
assert.deepEqual(s.receipts.at(-1).details.points,points);
assert.deepEqual(s.video2Clips[0].opacity_keyframe_points,points);
eq(overlayOpacityAt(s.video2Clips[0],.5+4*.15),.5);
eq(overlayOpacityAt(s.video2Clips[0],.5+4*.5),.7);
assert.deepEqual(undo(s).video2Clips[0].opacity_keyframe_points,undefined);
assert.deepEqual(redo(undo(s)).video2Clips[0].opacity_keyframe_points,points);
s=change(s,{type:'clip.keyframe.points.updated',clip_id:a1,
 field:'volume_keyframes',points:[{at:0,value:1},{at:.5,value:.25},{at:1,value:.8}]});
eq(audioLevelAt(s.audioClips[0],2.5),.25);
assert.equal(validate(s),true);
assert.deepEqual(importDraft(exportDraft(s)).video2Clips[0].opacity_keyframe_points,points);
assert.deepEqual(importDraft(originals).clips[0].opacity_keyframe_points,undefined);
assert.throws(()=>change(s,{type:'clip.keyframe.points.updated',
 clip_id:v1,field:'opacity_keyframes',points}),/Opacity points require V2/);
assert.throws(()=>change(s,{type:'clip.keyframe.points.updated',
 clip_id:v2,field:'position',points}),/Opacity points require V2/);
assert.throws(()=>change(s,{type:'clip.keyframe.points.updated',
 clip_id:v2,field:'opacity_keyframes',points:[{at:0,value:1},{at:0,value:.2},{at:1,value:1}]}),/sorted/);
const tamper=JSON.parse(exportDraft(s));
tamper.audioClips[0].volume_keyframe_points=[{at:0,value:1},{at:1,value:99}];
assert.throws(()=>importDraft(JSON.stringify(tamper)),/Invalid keyframe/);
const audioTamper=JSON.parse(exportDraft(s));
audioTamper.audioClips[0].opacity_keyframe_points=points;
assert.throws(()=>importDraft(JSON.stringify(audioTamper)),/Opacity points only apply to V2/);
const unchanged=exportDraft(s);
assert.throws(()=>change(s,{type:'clip.keyframe.points.updated',
 clip_id:a1,field:'volume_keyframes',points:[{at:0,value:1},{at:.001,value:.3},{at:1,value:0}]}),/separated/);
assert.equal(exportDraft(s),unchanged);
const mp4=planLocalMp4(s,linked,'/tmp/r69.mp4');
assert.match(mp4.graph,/if\(lt\(t,2\.5\)/);
assert.match(mp4.graph,/if\(lt\(T\\,1\.2\)/);
assert.match(mp4.graph,/geq=r=r\(X\\,Y\)/);
assert.notEqual(mp4.graph,baseGraph);
assert.ok(audioKeyframeFilter(s.audioClips[0]).includes('if(lt(t,'));
assert.ok(overlayKeyframeFilter(s.video2Clips[0]).includes('if(lt(T\\,'));
const oldPair=change(s,{type:'clip.keyframes.updated',clip_id:v2,
 field:'opacity_keyframes',values:{start:.1,end:.9}});
assert.equal(oldPair.video2Clips[0].opacity_keyframe_points,undefined);
assert.deepEqual(oldPair.video2Clips[0].opacity_keyframes,{start:.1,end:.9});
const cleared=change(s,{type:'clip.keyframes.updated',clip_id:v2,
 field:'opacity_keyframes',values:null});
assert.equal(cleared.video2Clips[0].opacity_keyframes,undefined);
assert.equal(cleared.video2Clips[0].opacity_keyframe_points,undefined);

// DOM event acceptance: interior point creation, drag, arrow/time moves, delete.
// Each completed user action calls the core once; preview-only moves call it zero times.
class E {
 constructor(tag){this.tag=tag;this.dataset={};this.style={};this.attrs={};this.children=[];
  this.handlers={};this.hidden=false;this.focused=false;this.classList={add(){}};
 }
 append(...kids){this.children.push(...kids);}
 replaceChildren(...kids){this.children=[...kids];}
 setAttribute(key,value){this.attrs[key]=value;}
 addEventListener(name,fn){(this.handlers[name]??=[]).push(fn);}
 fire(name,over={}){for(const fn of this.handlers[name]||[])fn({
   button:0,pointerId:4,clientX:100,clientY:50,key:'',
   shiftKey:false,stopPropagation(){},preventDefault(){},target:this,...over
 });}
 setPointerCapture(id){this.ptr=id;}
 hasPointerCapture(id){return this.ptr===id;}
 releasePointerCapture(id){if(this.ptr===id)this.ptr=null;}
 getBoundingClientRect(){return {left:0,top:0,width:200,height:100};}
 focus(){this.focused=true;}
 querySelector(selector) {
  const p=selector.match(/data-keyframe-property="([^"]+)"/)?.[1];
  const ix=selector.match(/data-point-index="([^"]+)"/)?.[1];
  const visit=node=>{
   if(node.dataset.keyframeProperty===p&&node.dataset.pointIndex===ix)return node;
   for(const ch of node.children){const f=visit(ch);if(f)return f;}
   return null;
  };
  return visit(this);
 }
}
const doc={createElement:t=>new E(t),createElementNS:(_ns,t)=>new E(t)};
const root=new E('div'),opacityLane=new E('div'),volumeLane=new E('div');
root.append(opacityLane,volumeLane);
let selection=v2,currentTime=1.5,changes=0,errors=[];
const currentClip=()=>[...s.video2Clips,...s.audioClips].find(c=>c.clip_id===selection);
function render(clip=currentClip()) {
  renderMultiPointKeyframeLanes({root,opacityLane,volumeLane,clip,
    total:5,playhead:0,getPlayhead:()=>currentTime,editable:true,document:doc,
    onCommit:command=>{s=change(s,command);changes++;render();},
    onError:err=>errors.push(err)});
}
render();
const plot=()=>opacityLane.children.at(-1);
const point=i=>root.querySelector('[data-keyframe-property="opacity"][data-point-index="'+i+'"]');
assert.equal(opacityLane.hidden,false);
assert.equal(volumeLane.hidden,false);
assert.equal(point(0).attrs['aria-valuenow'],'0');
const origChanges=changes;
plot().fire('dblclick',{clientX:50,clientY:25});
assert.equal(changes,origChanges+1);
assert.ok(point(2)); // new point at 25% time
const addedCount=s.video2Clips[0].opacity_keyframe_points.length;
let handle=point(1);
handle.fire('pointerdown');
handle.fire('pointermove',{clientX:70,clientY:50});
assert.equal(changes,origChanges+1);
handle.fire('pointerup',{clientX:70,clientY:50});
assert.equal(changes,origChanges+2);
assert.equal(point(1).focused,true);
assert.equal(s.video2Clips[0].opacity_keyframe_points.length,addedCount);
handle=point(1);
handle.fire('keydown',{key:'ArrowRight'});
assert.equal(changes,origChanges+3);
assert.equal(point(1).focused,true);
handle=point(1);
handle.fire('keydown',{key:'Home'});
assert.equal(s.video2Clips[0].opacity_keyframe_points[1].value,0);
currentTime=2;
const plus=opacityLane.children[1];
plus.fire('click');
assert.ok(s.video2Clips[0].opacity_keyframe_points.some(p=>p.at===.375)); // overlay starts .5, span 4
handle=point(1);
const prior=s.receipts.length;
handle.fire('keydown',{key:'Delete'});
assert.equal(s.receipts.length,prior+1);
assert.ok(errors.length===0,errors.join(','));
assert.equal(validate(s),true);
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
assert.match(js,/renderMultiPointKeyframeLanes\(/);
assert.match(js,/getPlayhead:\(\)=>playhead/);
assert.match(js,/clip\.keyframe\.points\.updated/);
assert.match(js,/keyframePointsFor\(clip,field\)/);
assert.match(html,/R6\.9 · MULTI-POINT KEYFRAMES/);
assert.match(html,/Double-click the curve/);
assert.match(css,/\.keyframe-diamond\.keyframe-middle/);
console.log('ParaCut R6.9 PASS: 2–8 point validation, interpolated preview/FFmpeg, receipts, Undo/Redo, old drafts, and interactive drag/add/remove.');
