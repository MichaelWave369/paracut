import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,validate,undo,redo,exportDraft,importDraft}
 from '../apps/desktop/public/studio-core.js';
import {keyframeLanePlan,keyframePercentFromY,editKeyframeEndpoint,
 lanePath} from '../apps/desktop/public/studio-keyframe-lanes.js';
import {renderVisualKeyframeLanes}
 from '../apps/desktop/public/studio-keyframe-view.js';
import {planLocalMp4} from './studio-local-export-core.mjs';

const dummy={clip_id:'v2',track_id:'video-2',timeline:{start:2,end:6},
 source:{start:0,end:4},opacity_keyframes:{start:0,end:1},
 volume_keyframes:{start:1,end:.5}};
const o=keyframeLanePlan(dummy,'opacity',10);
assert.equal(o.field,'opacity_keyframes');
assert.deepEqual(o.values,{start:0,end:1});
assert.equal(o.left,20);assert.equal(o.width,40);assert.equal(o.active,true);
assert.equal(keyframeLanePlan(dummy,'volume',10).values.end,.5);
assert.equal(keyframeLanePlan({...dummy,opacity_keyframes:undefined},'opacity',10).active,false);
assert.deepEqual(keyframeLanePlan({...dummy,opacity_keyframes:undefined},'opacity',10).values,
 {start:1,end:1});
assert.throws(()=>keyframeLanePlan({...dummy,track_id:'audio-1'},'opacity',10),/Invalid visual/);
assert.throws(()=>keyframeLanePlan(dummy,'evil',10),/Invalid visual/);
assert.throws(()=>keyframeLanePlan(dummy,'volume',0),/Invalid visual/);
assert.throws(()=>keyframeLanePlan(dummy,'volume',NaN),/Invalid visual/);
assert.equal(keyframePercentFromY(100,0,100),0);
assert.equal(keyframePercentFromY(0,0,100),100);
assert.equal(keyframePercentFromY(25,0,100),75);
assert.equal(keyframePercentFromY(-99,0,100),100);
assert.equal(keyframePercentFromY(999,0,100),0);
assert.throws(()=>keyframePercentFromY(10,0,0),/Invalid keyframe pointer/);
assert.throws(()=>keyframePercentFromY(Infinity,0,100),/Invalid keyframe pointer/);
assert.deepEqual(editKeyframeEndpoint({start:0,end:1},'start',75),{start:.75,end:1});
assert.deepEqual(editKeyframeEndpoint({start:0,end:1},'end',40),{start:0,end:.4});
assert.throws(()=>editKeyframeEndpoint({start:0,end:1},'nope',50),/Invalid keyframe handle/);
assert.throws(()=>editKeyframeEndpoint({start:0,end:1},'start',-1),/Invalid keyframe handle/);
assert.equal(lanePath({start:0,end:1}),'M 0 100 L 100 0');
assert.equal(lanePath({start:1,end:1}),'M 0 0 L 100 0');

// Compact fake DOM tests real event handlers without a browser runner.
class Element {
 constructor(tag){
  this.tag=tag;this.style={};this.dataset={};this.children=[];
  this.attrs={};this.handlers={};this.hidden=false;this.focused=false;
  this.classList={add:()=>{}};
 }
 append(...parts){this.children.push(...parts);}
 replaceChildren(...parts){this.children=[...parts];}
 setAttribute(k,v){this.attrs[k]=v;}
 getAttribute(k){return this.attrs[k];}
 addEventListener(name,fn){(this.handlers[name]??=[]).push(fn);}
 fire(name,event={}) {
  for(const h of this.handlers[name]||[])h({
    button:0,pointerId:2,clientY:25,shiftKey:false,
    stopPropagation(){},preventDefault(){},...event});
 }
 setPointerCapture(id){this.pointer=id;}
 hasPointerCapture(id){return this.pointer===id;}
 releasePointerCapture(id){if(this.pointer===id)this.pointer=null;}
 getBoundingClientRect(){return {top:0,height:100};}
 querySelector(q){
  const match=q.match(/data-keyframe-property="([^"]+)"\]\[data-keyframe-endpoint="([^"]+)"/);
  const all=[];
  const walk=e=>{all.push(e);for(const ch of e.children)walk(ch)};
  walk(this);
  return all.find(e=>e.dataset.keyframeProperty===match?.[1]&&
    e.dataset.keyframeEndpoint===match?.[2])||null;
 }
 focus(){this.focused=true;}
}
const doc={createElement:tag=>new Element(tag),createElementNS:(_ns,tag)=>new Element(tag)};
const root=new Element('div'),opacityLane=new Element('div'),volumeLane=new Element('div');
root.append(opacityLane,volumeLane);
const find=(prop,which)=>root.querySelector(
 '[data-keyframe-property="'+prop+'"][data-keyframe-endpoint="'+which+'"]');
let s=newStudio('Visual lane receipts');
for(const a of [
 {asset_id:'v1',name:'v1.mp4',type:'video/mp4',duration:6,size:100,lastModified:0},
 {asset_id:'over',name:'over.mp4',type:'video/mp4',duration:4,size:100,lastModified:0},
 {asset_id:'music',name:'music.wav',type:'audio/wav',duration:6,size:100,lastModified:0}
])s=change(s,{type:'asset.added',asset:a});
for(const asset_id of ['v1','music'])s=change(s,{type:'clip.appended',asset_id});
s=change(s,{type:'clip.layer.added',asset_id:'over',track_id:'video-2',start:1});
const overlayId=s.video2Clips[0].clip_id;
const a1Id=s.audioClips[0].clip_id;
let receipts=0,selectedClipId=overlayId;
function render(clip){
 selectedClipId=clip?.clip_id??null;
 renderVisualKeyframeLanes({
   root,opacityLane,volumeLane,clip,total:6,editable:true,document:doc,
   onCommit:command=>{
     const previous=s.receipts.length;
     s=change(s,command);
     assert.equal(s.receipts.length,previous+1);
     receipts++;
     render([...s.video2Clips,...s.audioClips].find(c=>c.clip_id===selectedClipId)||null);
   }
 });
}
render(s.video2Clips[0]);
assert.equal(root.hidden,false);
assert.equal(opacityLane.hidden,false);
assert.equal(volumeLane.hidden,false);
assert.equal(find('opacity','start').attrs['aria-valuenow'],'100');
const untouched=s.receipts.length;
find('opacity','start').fire('pointerdown');
find('opacity','start').fire('pointerup',{clientY:0});
assert.equal(s.receipts.length,untouched); // stationary neutral handle is not an edit
let start=find('opacity','start');
start.fire('pointerdown');
start.fire('pointermove',{clientY:100});
assert.equal(s.receipts.length,untouched); // audition remains UI-only
start.fire('pointerup',{clientY:100});
assert.equal(s.receipts.length,untouched+1);
assert.deepEqual(s.video2Clips[0].opacity_keyframes,{start:0,end:1});
assert.equal(find('opacity','start').focused,true); // redraw restores keyboard focus
let end=find('opacity','end');
end.fire('keydown',{key:'ArrowDown'});
assert.equal(s.video2Clips[0].opacity_keyframes.end,.95);
assert.equal(find('opacity','end').focused,true);
end=find('opacity','end');
end.fire('keydown',{key:'ArrowDown',shiftKey:true});
assert.equal(s.video2Clips[0].opacity_keyframes.end,.85);
end=find('opacity','end');
end.fire('keydown',{key:'Home'});
assert.equal(s.video2Clips[0].opacity_keyframes.end,0);
assert.equal(validate(s),true);
assert.equal(s.receipts.at(-1).action,'clip.keyframes.updated');
assert.equal(undo(s).video2Clips[0].opacity_keyframes.end,.85);
assert.equal(redo(undo(s)).video2Clips[0].opacity_keyframes.end,0);
assert.deepEqual(importDraft(exportDraft(s)).video2Clips[0].opacity_keyframes,
 {start:0,end:0});
render(s.audioClips[0]);
assert.equal(opacityLane.hidden,true);
assert.equal(volumeLane.hidden,false);
assert.equal(find('opacity','start'),null);
find('volume','end').fire('keydown',{key:'Home'});
assert.deepEqual(s.audioClips[0].volume_keyframes,{start:1,end:0});
assert.ok(receipts>=5);
render(null);
assert.equal(root.hidden,true);
const media=Object.fromEntries(s.assets.map(a=>[a.asset_id,{
 path:'/tmp/'+a.name,hasAudio:a.type.startsWith('audio/')
}]));
const exported=planLocalMp4(s,media,'/tmp/r68.mp4');
assert.match(exported.graph,/volume='1\+\(-1\)/);

const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
for(const id of ['visual-keyframe-lanes','keyframe-lane-opacity',
 'keyframe-lane-volume','show-keyframe-lanes'])
 assert.match(html,new RegExp('id="'+id+'"'));
assert.match(js,/renderVisualKeyframeLanes\(/);
assert.match(js,/function drawKeyframeLanes\(\)/);
assert.match(js,/drawKeyframeLanes\(\);\n}\n\nfunction showTitleAt/);
assert.match(js,/showKeyframeLanes=event.target.checked/);
const timelineBody=js.slice(js.indexOf('function drawTimeline()'),js.indexOf('function showTitleAt'));
assert.doesNotMatch(timelineBody,/keyframe-opacity-start/); // catches R6.7 wrong-clip bug
const inspectorBody=js.slice(js.indexOf('function drawInspector()'),js.indexOf('function drawReceipts'));
assert.match(inspectorBody,/keyframe-'\+property\+'-start|keyframe-'\+property\+'-'\+end/);
assert.match(css,/\.keyframe-diamond:disabled/);
assert.match(css,/\.keyframe-plot\.neutral/);
console.log('ParaCut R6.8 PASS: timeline-aligned visible curves, real drag and keyboard receipts, Undo/Redo, Inspector correction and export invariance.');
