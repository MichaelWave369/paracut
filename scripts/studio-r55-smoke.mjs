import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  newStudio,change,validate,undo,redo,exportDraft,importDraft,
  overlayCrossfadeAt,maxOverlayCrossfade,activeOverlayClip,crossfadeAt,duration
} from '../apps/desktop/public/studio-core.js';
const a=(id,type,len)=>({asset_id:id,name:id+'.mp4',type,size:100,duration:len,lastModified:1});
let state=newStudio('V2 moving dissolves');
for(const asset of [a('main','video/mp4',14),a('red','video/mp4',3),
  a('blue','video/mp4',3),a('green','video/mp4',2),a('music','audio/wav',12)])
  state=change(state,{type:'asset.added',asset});
state=change(state,{type:'clip.appended',asset_id:'main'});
state=change(state,{type:'clip.appended',asset_id:'music'});
for(const [asset_id,start] of [['red',1],['blue',4],['green',7]])
  state=change(state,{type:'clip.layer.added',asset_id,track_id:'video-2',start});
const red=state.video2Clips[0].clip_id,blue=state.video2Clips[1].clip_id;
assert.equal(duration(state),14);
assert.equal(maxOverlayCrossfade(state.video2Clips,0),1);
assert.equal(maxOverlayCrossfade(state.video2Clips,1),.667);
assert.equal(overlayCrossfadeAt(state,3.5),null);
assert.equal(activeOverlayClip(state,3.5)?.asset_id,'red');
assert.throws(()=>change(state,{type:'clip.overlay.transition.updated',clip_id:red,seconds:1.2}),/V2 dissolve must fit/);
state=change(state,{type:'clip.overlay.transition.updated',clip_id:red,seconds:1});
assert.equal(validate(state),true);
assert.equal(state.video2Clips[1].timeline.start,3);
assert.equal(state.video2Clips[1].timeline.end,6);
assert.equal(state.audioClips[0].timeline.start,0);
assert.equal(duration(state),14); // independent of master video
const at=overlayCrossfadeAt(state,3.5);
assert.equal(at.outgoing.asset_id,'red');
assert.equal(at.incoming.asset_id,'blue');
assert.equal(at.progress,.5);
assert.equal(overlayCrossfadeAt(state,2.99),null);
assert.equal(overlayCrossfadeAt(state,4),null);
assert.equal(activeOverlayClip(state,3.5).asset_id,'red');
assert.equal(activeOverlayClip(state,4.1).asset_id,'blue');
assert.equal(maxOverlayCrossfade(state.video2Clips,0),1);
// A pair is joined: no moving, trimming, splitting or deleting either participant.
assert.throws(()=>change(state,{type:'clip.layer.moved',clip_id:blue,start:4}),/Remove the V2 dissolve/);
assert.throws(()=>change(state,{type:'clip.trimmed',clip_id:red,start:0,end:2}),/Remove the V2 dissolve/);
assert.throws(()=>change(state,{type:'clip.split',clip_id:blue,time:4}),/Remove the V2 dissolve/);
assert.throws(()=>change(state,{type:'clip.deleted',clip_id:red}),/Remove the V2 dissolve/);
assert.throws(()=>change(state,{type:'clip.overlay.transition.updated',clip_id:blue,seconds:.4}),/maximum 0 seconds/);
// Strictly guard unannotated overlaps and tampered draft data.
const tampered=JSON.parse(exportDraft(state));
tampered.video2Clips[0].transition_out_seconds=0;
assert.throws(()=>importDraft(JSON.stringify(tampered)),/V2 overlap must match/);
const wrong=JSON.parse(exportDraft(state));
wrong.video2Clips[1].timeline.start=2.8;
wrong.video2Clips[1].timeline.end=5.8;
assert.throws(()=>importDraft(JSON.stringify(wrong)),/V2 overlap must match/);
const restored=importDraft(exportDraft(state));
assert.equal(overlayCrossfadeAt(restored,3.5).progress,.5);
assert.equal(undo(state).video2Clips[1].timeline.start,4);
assert.equal(redo(undo(state)).video2Clips[1].timeline.start,3);
// Change an existing transition, then remove it; source ranges stay unchanged.
state=change(state,{type:'clip.overlay.transition.updated',clip_id:red,seconds:.5});
assert.equal(state.video2Clips[1].timeline.start,3.5);
assert.equal(overlayCrossfadeAt(state,3.75).progress,.5);
state=change(state,{type:'clip.overlay.transition.updated',clip_id:red,seconds:0});
assert.equal(state.video2Clips[1].timeline.start,4);
assert.equal(overlayCrossfadeAt(state,3.8),null);
assert.equal(state.video2Clips[1].source.start,0);
assert.equal(state.video2Clips[1].source.end,3);
state=change(state,{type:'clip.layer.moved',clip_id:blue,start:10});
assert.equal(state.video2Clips.find(c=>c.clip_id===blue).timeline.start,10);
assert.throws(()=>change(state,{type:'clip.overlay.transition.updated',clip_id:red,seconds:0}),/requires two touching clips/);
assert.equal(validate(state),true);
// Original projects remain valid with no additional draft key.
const legacy=JSON.parse(exportDraft(state));
for(const c of legacy.video2Clips)delete c.transition_out_seconds;
assert.equal(validate(importDraft(JSON.stringify(legacy))),true);
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
for(const id of ['overlay-incoming','v2-transition-control','v2-dissolve-seconds','apply-v2-dissolve'])
  assert.match(html,new RegExp('id="'+id+'"'));
assert.match(js,/overlayCrossfadeAt\(state,at\)/);
assert.match(js,/syncLayerPlayer\(overlayIncoming,dissolve\?\.incoming\|\|null,at,autoplay,'incoming'\)/);
assert.match(js,/encoderOverlayIncoming=document.createElement\('video'\)/);
assert.match(js,/overlaySecondSource=ctx.createMediaElementSource\(encoderOverlayIncoming\)/);
assert.match(js,/paintOverlay\(encoderOverlayIncoming,overlayFade.incoming,overlayFade.progress\)/);
assert.match(js,/await syncExportLayer\(encoderOverlayIncoming,v2Fade\?\.incoming\|\|null/);
assert.match(js,/overlay_crossfades:state.video2Clips.filter/);
assert.match(css,/\.screen #overlay-incoming/);
assert.match(js,/type:'clip.overlay.transition.updated'/);
console.log('ParaCut R5.5 PASS: valid V2 overlap, moving dissolve math, joined edits protected, old drafts, undo/redo, 2 moving preview/export decoders.');
