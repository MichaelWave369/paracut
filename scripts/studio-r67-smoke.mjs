import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,undo,redo,validate,exportDraft,importDraft,
  overlayOpacityAt,audioLevelAt} from '../apps/desktop/public/studio-core.js';
import {validateKeyframePair,keyframeAt,clipKeyframeAt,keyframeTimeExpression,
  audioKeyframeFilter,overlayKeyframeFilter} from '../apps/desktop/public/studio-keyframes.js';
import {planLocalMp4} from './studio-local-export-core.mjs';

const nearly=(actual,expected)=>assert.ok(Math.abs(actual-expected)<0.001,
  'Expected '+actual+' to be near '+expected);
assert.deepEqual(validateKeyframePair({start:0,end:1}),{start:0,end:1});
for(const bad of [null,[],{start:0},{end:1},{start:-.01,end:1},
 {start:0,end:1.01},{start:NaN,end:1},{start:'0',end:1},
 {start:0,end:Infinity},{start:0,end:1,script:'unsafe'}])
 assert.throws(()=>validateKeyframePair(bad),/Keyframes require/);
nearly(keyframeAt(undefined,.4),1);
nearly(keyframeAt({start:.2,end:.8},0),.2);
nearly(keyframeAt({start:.2,end:.8},.5),.5);
nearly(keyframeAt({start:.2,end:.8},1),.8);
nearly(keyframeAt({start:.2,end:.8},-2),.2);
nearly(keyframeAt({start:.2,end:.8},8),.8);
assert.match(keyframeTimeExpression({start:.2,end:.8},4,'t'),/t\/4/);
assert.match(overlayKeyframeFilter({source:{start:0,end:4},
  opacity_keyframes:{start:0,end:1}}),/geq=r=r\(X\\,Y\).*T\/4/);
assert.match(audioKeyframeFilter({source:{start:0,end:4},
  volume_keyframes:{start:1,end:0}}),/volume='1\+\(-1\)\*min\(1,max\(0,t\/4\)\)':eval=frame/);
assert.equal(audioKeyframeFilter({}),null);
assert.equal(overlayKeyframeFilter({}),null);

const asset=(id,type,duration)=>({asset_id:id,name:id+'.mp4',type,duration,size:100,lastModified:0});
let s=newStudio('R6.7 Keyframed sequence');
for(const a of [asset('v1','video/mp4',6),asset('overlay','video/mp4',4),
  asset('music','audio/wav',6),asset('voice','audio/wav',3)])
 s=change(s,{type:'asset.added',asset:a});
for(const asset_id of ['v1','music'])s=change(s,{type:'clip.appended',asset_id});
s=change(s,{type:'clip.layer.added',asset_id:'overlay',track_id:'video-2',start:1});
s=change(s,{type:'clip.layer.added',asset_id:'voice',track_id:'audio-2',start:1});
const v2=s.video2Clips[0],a1=s.audioClips[0],a2=s.audio2Clips[0];
const neutralDraft=exportDraft(s);
const linked=Object.fromEntries(s.assets.map(a=>[a.asset_id,
 {path:'/tmp/'+a.name,hasAudio:true}]));
const neutralGraph=planLocalMp4(s,linked,'/tmp/out.mp4').graph;
assert.doesNotMatch(neutralGraph,/geq=r=r\(X|volume='0/);
const initialCount=s.receipts.length;
s=change(s,{type:'clip.keyframes.updated',clip_id:v2.clip_id,
 field:'opacity_keyframes',values:{start:0,end:1}});
assert.equal(s.receipts.length,initialCount+1);
assert.equal(s.receipts.at(-1).action,'clip.keyframes.updated');
assert.equal(s.receipts.at(-1).details.field,'opacity_keyframes');
assert.equal(s.receipts.at(-1).details.values.start,0);
nearly(overlayOpacityAt(s.video2Clips[0],1),0);
nearly(overlayOpacityAt(s.video2Clips[0],3),.5);
nearly(overlayOpacityAt(s.video2Clips[0],4.999),.99975);
assert.equal(undo(s).video2Clips[0].opacity_keyframes,undefined);
assert.equal(redo(undo(s)).video2Clips[0].opacity_keyframes.end,1);
s=change(s,{type:'clip.keyframes.updated',clip_id:a1.clip_id,
 field:'volume_keyframes',values:{start:1,end:0}});
nearly(audioLevelAt(s.audioClips[0],0),1);
nearly(audioLevelAt(s.audioClips[0],3),.5);
nearly(audioLevelAt(s.audioClips[0],5.999),.000167);
s=change(s,{type:'clip.keyframes.updated',clip_id:a2.clip_id,
 field:'volume_keyframes',values:{start:0,end:1}});
nearly(audioLevelAt(s.audio2Clips[0],1),0);
nearly(audioLevelAt(s.audio2Clips[0],2.5),.5);
assert.equal(validate(s),true);
assert.deepEqual(importDraft(exportDraft(s)).video2Clips[0].opacity_keyframes,
 {start:0,end:1});
assert.deepEqual(importDraft(exportDraft(s)).audioClips[0].volume_keyframes,
 {start:1,end:0});
assert.equal(importDraft(neutralDraft).video2Clips[0].opacity_keyframes,undefined);
assert.throws(()=>change(s,{type:'clip.keyframes.updated',
 clip_id:a1.clip_id,field:'opacity_keyframes',values:{start:0,end:1}}),/Opacity keyframes require/);
assert.throws(()=>change(s,{type:'clip.keyframes.updated',
 clip_id:v2.clip_id,field:'evil_keyframes',values:{start:0,end:1}}),/Opacity keyframes require/);
assert.throws(()=>change(s,{type:'clip.keyframes.updated',
 clip_id:v2.clip_id,field:'opacity_keyframes',values:{start:0,end:2}}),/Keyframes require/);
const corrupted=JSON.parse(exportDraft(s));
corrupted.video2Clips[0].opacity_keyframes={start:0,end:NaN};
assert.throws(()=>importDraft(JSON.stringify(corrupted)),/Keyframes require/);
const tampered=JSON.parse(exportDraft(s));
tampered.clips[0].opacity_keyframes={start:0,end:1};
assert.throws(()=>importDraft(JSON.stringify(tampered)),/Opacity keyframes only apply/);
const withAutomation=planLocalMp4(s,linked,'/tmp/out.mp4');
assert.match(withAutomation.graph,/geq=r=r\(X\\,Y\).*alpha\(X\\,Y\)/);
assert.match(withAutomation.graph,/T\/4/);
assert.match(withAutomation.graph,/volume='1\+\(-1\)/);
assert.match(withAutomation.graph,/volume='0\+\(1\)/);
assert.ok(withAutomation.args.includes('libx264'));
const cleared=change(s,{type:'clip.keyframes.updated',clip_id:v2.clip_id,
 field:'opacity_keyframes',values:null});
assert.equal(cleared.video2Clips[0].opacity_keyframes,undefined);
assert.equal(cleared.receipts.at(-1).details.values,null);
nearly(overlayOpacityAt(cleared.video2Clips[0],3),1);
assert.equal(undo(cleared).video2Clips[0].opacity_keyframes.end,1);
assert.equal(exportDraft(s).includes('clip.keyframe.preview'),false);

const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
for(const id of ['opacity-keyframe-editor','volume-keyframe-editor',
 'keyframe-opacity-start','keyframe-opacity-end','keyframe-volume-start',
 'keyframe-volume-end','apply-opacity-keyframes','clear-opacity-keyframes',
 'apply-volume-keyframes','clear-volume-keyframes'])
 assert.match(html,new RegExp('id="'+id+'"'));
assert.match(js,/clip\.keyframes\.updated/);
assert.match(js,/validateKeyframePair\(values\)/);
assert.match(js,/clear-'\+property\+'-keyframes/);
assert.match(js,/overlayOpacityAt\(clip,at\)\*weight/);
assert.match(js,/audioLevelAt\(clip,at\)/);
assert.match(css,/\.keyframe-editor\[hidden\]/);
console.log('ParaCut R6.7 PASS: two-endpoint opacity/audio animation, receipts, Undo/Redo, draft validation, browser and legacy/layered FFmpeg compatibility.');
