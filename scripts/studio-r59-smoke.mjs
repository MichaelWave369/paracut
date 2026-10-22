import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,validate,undo,redo,exportDraft,importDraft,duration} from '../apps/desktop/public/studio-core.js';
const make=(id,type,duration)=>({asset_id:id,name:id,type,duration,size:100,lastModified:0});
let s=newStudio('R5.9 target-aware cutting');
for(const a of [make('a','video/mp4',4),make('b','video/mp4',4),
 make('overlay','video/mp4',3),make('music','audio/wav',8),make('voice','audio/wav',3)])
 s=change(s,{type:'asset.added',asset:a});
for(const asset_id of ['a','b','music'])s=change(s,{type:'clip.appended',asset_id});
s=change(s,{type:'clip.layer.added',asset_id:'overlay',track_id:'video-2',start:.5});
s=change(s,{type:'clip.layer.added',asset_id:'voice',track_id:'audio-2',start:.5});
const first=s.clips[0].clip_id,overlay=s.video2Clips[0].clip_id,voice=s.audio2Clips[0].clip_id,music=s.audioClips[0].clip_id;
s=change(s,{type:'clip.transition.updated',clip_id:first,seconds:.6});
assert.equal(duration(s),7.4);
assert.throws(()=>change(s,{type:'clip.split',clip_id:first,time:3.6}),/active V1 dissolve/);
assert.throws(()=>change(s,{type:'clip.split',clip_id:first,time:3.2}),/too near a V1 crossfade/);
assert.throws(()=>change(s,{type:'clip.split',clip_id:overlay,time:.51}),/inside the clip/);
assert.throws(()=>change(s,{type:'clip.split',clip_id:voice,time:100}),/inside the clip/);
const initialReceipts=s.receipts.length;
let v=change(s,{type:'clip.split',clip_id:first,time:1.5});
assert.equal(v.clips.length,3);
assert.equal(v.clips[0].timeline.end,1.5);
assert.equal(v.clips[1].timeline.start,1.5);
assert.equal(v.clips[1].source.start,1.5);
assert.equal(v.clips[1].transition_out_seconds,.6);
assert.equal(duration(v),7.4);
assert.equal(v.receipts.length,initialReceipts+1);
assert.equal(v.receipts.at(-1).action,'clip.split');
assert.equal(undo(v).clips.length,2);
assert.equal(redo(undo(v)).clips.length,3);
v=change(v,{type:'clip.split',clip_id:music,time:2});
assert.equal(v.audioClips.length,2);
v=change(v,{type:'clip.split',clip_id:overlay,time:1.8});
assert.equal(v.video2Clips.length,2);
assert.equal(v.video2Clips[1].timeline.start,1.8);
v=change(v,{type:'clip.split',clip_id:voice,time:1.8});
assert.equal(v.audio2Clips.length,2);
assert.equal(v.audio2Clips[1].timeline.start,1.8);
assert.equal(validate(v),true);
assert.equal(importDraft(exportDraft(v)).video2Clips.length,2);
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
for(const id of ['tool-select','tool-razor','target-v1','target-v2','target-a1','target-a2',
 'tool-feedback','jog-back','jog-stop','jog-forward'])assert.ok(html.includes('id="'+id+'"'),id);
for(const re of [/activeTool='select'/,/razorTargets=new Set\(\['video-1'\]\)/,
 /function actOnTimelineClip\(clip,event,button\)/,
 /clip\.timeline\.start\+fraction\*\(clip\.timeline\.end-clip\.timeline\.start\)/,
 /if\(!razorTargets\.has\(clip\.track_id\)\)/,/function setEditingTool\(mode\)/,
 /actOnTimelineClip\(clip,event,item\)/,/function applyTransportSpeed\(\)/,
 /transportSpeed===1\?2:1/,/for\(const \[key,mode\] of \[\['tool-select'/,
 /if\(key==='j'\)/,/if\(key==='k'\)/,/if\(key==='l'\)/,
 /item\.draggable = !exporting && activeTool==='select'/,
 /item\.draggable=!exporting && activeTool==='select'/])
 assert.match(js,re);
assert.match(html,/J jogs one 30fps frame backward/);
assert.match(css,/\.razor-mode \.timeline-clip/);
console.log('ParaCut R5.9 PASS: V1 transition-safe cuts, four-lane split, receipts, undo/redo, targeted razor and conservative JKL transport.');
