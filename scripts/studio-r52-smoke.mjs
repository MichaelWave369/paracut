import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  newStudio,change,validate,undo,redo,exportDraft,importDraft,defaultAudioMix,
  audioMixLevelAt,overlayMotionAt,overlayOpacityAt
} from '../apps/desktop/public/studio-core.js';
import {planLocalMp4} from './studio-local-export-core.mjs';
const asset=(asset_id,type,duration)=>({asset_id,name:asset_id,size:100,lastModified:123,type,duration});
let state=newStudio('Layered Mixing');
for(const a of [asset('base','video/mp4',9),asset('overlay','video/mp4',4),
  asset('bed','audio/mpeg',9),asset('voice','audio/mpeg',3)])
  state=change(state,{type:'asset.added',asset:a});
for(const asset_id of ['base','bed'])state=change(state,{type:'clip.appended',asset_id});
state=change(state,{type:'clip.layer.added',track_id:'video-2',asset_id:'overlay',start:1});
state=change(state,{type:'clip.layer.added',track_id:'audio-2',asset_id:'voice',start:3});
assert.deepEqual(state.audioMix,defaultAudioMix());
assert.equal(audioMixLevelAt(state,'audio-1',4),1);
assert.equal(audioMixLevelAt(state,'video-1',4),1);
state=change(state,{type:'mixer.updated',lane:'a1',gain:.8,muted:false,solo:false});
assert.equal(audioMixLevelAt(state,'audio-1',4),.8);
state=change(state,{type:'mixer.duck.updated',enabled:true});
assert.equal(audioMixLevelAt(state,'audio-1',2.5),.8);
assert.ok(Math.abs(audioMixLevelAt(state,'audio-1',3.1)-.56)<1e-9);
assert.ok(Math.abs(audioMixLevelAt(state,'audio-1',4)-.32)<1e-9);
assert.ok(Math.abs(audioMixLevelAt(state,'audio-1',6.175)-.56)<1e-9);
assert.equal(audioMixLevelAt(state,'audio-1',7),.8);
state=change(state,{type:'mixer.updated',lane:'a2',gain:.65,muted:true,solo:false});
assert.equal(audioMixLevelAt(state,'audio-1',4),.8);
assert.equal(audioMixLevelAt(state,'audio-2',4),0);
state=change(state,{type:'mixer.updated',lane:'a2',gain:.65,muted:false,solo:true});
assert.equal(audioMixLevelAt(state,'audio-2',4),.65);
assert.equal(audioMixLevelAt(state,'audio-1',4),0);
assert.equal(audioMixLevelAt(state,'video-1',4),0);
assert.equal(audioMixLevelAt(state,'video-2',4),0);
assert.equal(undo(state).audioMix.a2.solo,false);
assert.equal(redo(undo(state)).audioMix.a2.solo,true);
assert.throws(()=>change(state,{type:'mixer.updated',lane:'a2',gain:1.5,muted:false,solo:false}),/mixer settings/);
assert.throws(()=>change(state,{type:'mixer.updated',lane:'a2',gain:'1',muted:false,solo:false}),/mixer settings/);
assert.throws(()=>change(state,{type:'mixer.updated',lane:'a3',gain:1,muted:false,solo:false}),/Mixer supports/);
assert.throws(()=>change(state,{type:'mixer.duck.updated',enabled:'yes'}),/Ducking must/);
let overlayId=state.video2Clips[0].clip_id;
state=change(state,{type:'clip.overlay.updated',clip_id:overlayId,
  layout:'pip',opacity:.8,fade_in:1,fade_out:1,motion:'slide-left'});
assert.equal(overlayOpacityAt(state.video2Clips[0],1),0);
assert.equal(overlayMotionAt(state.video2Clips[0],1).x,-1.05);
assert.equal(overlayMotionAt(state.video2Clips[0],2).x,0);
assert.equal(overlayMotionAt(state.video2Clips[0],4).x,0);
assert.equal(overlayMotionAt(state.video2Clips[0],4.5).x,-.525);
state=change(state,{type:'clip.overlay.updated',clip_id:overlayId,
  layout:'full',opacity:1,fade_in:1,fade_out:1,motion:'rise'});
assert.ok(Math.abs(overlayMotionAt(state.video2Clips[0],1.5).y-.375)<1e-9);
assert.equal(overlayMotionAt(state.video2Clips[0],2).y,0);
assert.throws(()=>change(state,{type:'clip.overlay.updated',clip_id:overlayId,
  layout:'pip',opacity:1,fade_in:0,fade_out:0,motion:'rotate(90deg)'}),/Invalid V2 overlay/);
assert.equal(validate(state),true);
assert.equal(importDraft(exportDraft(state)).video2Clips[0].overlay_motion,'rise');
assert.equal(importDraft(exportDraft(state)).audioMix.a2.solo,true);
// Additive defaults preserve R5 drafts and prior mixer behavior.
const legacy=JSON.parse(exportDraft(state));
delete legacy.audioMix;
delete legacy.video2Clips[0].overlay_motion;
const reopened=importDraft(JSON.stringify(legacy));
assert.deepEqual(reopened.audioMix,defaultAudioMix());
assert.equal(overlayMotionAt(reopened.video2Clips[0],1.2).x,0);
const bad=JSON.parse(exportDraft(state));
bad.audioMix.a1.gain=9;
assert.throws(()=>importDraft(JSON.stringify(bad)),/mixer settings/);
assert.throws(()=>planLocalMp4(state,{},'/tmp/out.mp4'),/cannot render R5.2 bus mixing/);

const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const ui=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
for(const id of ['track-mixer','mixer-a1-gain','mixer-a2-gain','mixer-a1-mute',
  'mixer-a2-solo','mixer-duck','overlay-motion'])assert.ok(html.includes('id="'+id+'"'),id);
assert.match(ui,/audioMixLevelAt\(state,'audio-1',at\)/);
assert.match(ui,/audioMixLevelAt\(state,'audio-2',at\)/);
assert.match(ui,/audioMixLevelAt\(state,'video-1',timelinePosition\)/);
assert.match(ui,/audioMixLevelAt\(state,clip\?\.track_id,at\)/);
assert.match(ui,/const motion=overlayMotionAt\(overlay,at\)/);
assert.match(ui,/paintOverlay\(encoderOverlayIncoming,overlayFade.incoming,overlayFade.progress\)/);
assert.match(ui,/el\.style\.transform='translate\('/);
console.log('ParaCut R5.2 PASS: A1/A2 gain/mute/solo, ducking ramps, V2 motion, undo/redo, old drafts, local fail-closed and render wiring.');
