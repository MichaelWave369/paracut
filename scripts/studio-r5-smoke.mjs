import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,undo,redo,validate,exportDraft,importDraft,duration,
  activeOverlayClip,activeAudio2Clip,overlayOpacityAt,isSourceAudioMuted,
  audioLevelAt,crossfadeAt} from '../apps/desktop/public/studio-core.js';
import {planLocalMp4} from './studio-local-export-core.mjs';
const asset=(id,type,duration)=>({asset_id:id,name:id,size:100,lastModified:1,type,duration});
let s=newStudio('Layered Storyboard');
for(const a of [asset('v1','video/mp4',10),asset('v2','video/mp4',3),
  asset('v3','video/mp4',8),asset('music','audio/mpeg',10),asset('voice','audio/mpeg',4)])
  s=change(s,{type:'asset.added',asset:a});
s=change(s,{type:'clip.appended',asset_id:'v1'});
s=change(s,{type:'clip.appended',asset_id:'v3'});
s=change(s,{type:'clip.appended',asset_id:'music'});
const v1=s.clips[0].clip_id;
s=change(s,{type:'clip.transition.updated',clip_id:v1,seconds:1});
assert.equal(duration(s),17);
s=change(s,{type:'clip.layer.added',asset_id:'v2',track_id:'video-2',start:2});
s=change(s,{type:'clip.layer.added',asset_id:'voice',track_id:'audio-2',start:4});
assert.equal(duration(s),17); // layers don't ripple V1
assert.equal(s.audioClips[0].timeline.start,0);
assert.equal(s.audio2Clips[0].timeline.start,4);
assert.equal(s.video2Clips[0].timeline.end,5);
assert.equal(activeOverlayClip(s,3)?.asset_id,'v2');
assert.equal(activeOverlayClip(s,6),null);
assert.equal(activeAudio2Clip(s,5)?.asset_id,'voice');
assert.equal(activeAudio2Clip(s,2),null);
assert.equal(isSourceAudioMuted(s.video2Clips[0]),true); // generated-video noise muted
assert.equal(audioLevelAt(s.video2Clips[0],3),0);
const overlayId=s.video2Clips[0].clip_id;
const audio2Id=s.audio2Clips[0].clip_id;
s=change(s,{type:'clip.overlay.updated',clip_id:overlayId,
  layout:'full',opacity:.7,fade_in:.5,fade_out:.5});
assert.equal(overlayOpacityAt(s.video2Clips[0],2),0);
assert.ok(Math.abs(overlayOpacityAt(s.video2Clips[0],2.25)-.35)<1e-9);
assert.equal(overlayOpacityAt(s.video2Clips[0],3),.7);
assert.equal(overlayOpacityAt(s.video2Clips[0],5),0);
assert.throws(()=>change(s,{type:'clip.overlay.updated',clip_id:overlayId,
  layout:'shader()',opacity:1,fade_in:0,fade_out:0}),/Invalid V2 overlay/);
assert.throws(()=>change(s,{type:'clip.overlay.updated',clip_id:overlayId,
  layout:'full',opacity:1.5,fade_in:0,fade_out:0}),/Invalid V2 overlay/);
assert.throws(()=>change(s,{type:'clip.overlay.updated',clip_id:overlayId,
  layout:'full',opacity:1,fade_in:2,fade_out:2}),/Invalid V2 overlay/);
s=change(s,{type:'clip.source-audio.muted',clip_id:overlayId,muted:false});
assert.equal(isSourceAudioMuted(s.video2Clips[0]),false);
s=change(s,{type:'clip.audio.updated',clip_id:audio2Id,volume:.5,fade_in:.5,fade_out:.5});
assert.equal(audioLevelAt(s.audio2Clips[0],5),.5);
s=change(s,{type:'clip.layer.moved',clip_id:audio2Id,start:8});
assert.equal(s.audio2Clips[0].timeline.start,8);
assert.equal(s.audioClips[0].timeline.start,0);
const saved=importDraft(exportDraft(s));
assert.equal(saved.video2Clips[0].overlay_opacity,.7);
assert.equal(saved.audio2Clips[0].timeline.start,8);
assert.equal(undo(s).audio2Clips[0].timeline.start,4);
assert.equal(redo(undo(s)).audio2Clips[0].timeline.start,8);
assert.equal(validate(s),true);
assert.throws(()=>change(s,{type:'clip.layer.added',asset_id:'v2',track_id:'audio-2',start:0}),/compatible/);
assert.throws(()=>change(s,{type:'clip.layer.added',asset_id:'voice',track_id:'audio-2',start:9}),/already has media/);
assert.throws(()=>change(s,{type:'clip.layer.added',asset_id:'v2',track_id:'video-2',start:3}),/already has media/);
const full=JSON.parse(exportDraft(s));full.video2Clips[0].timeline.start=1;
assert.throws(()=>importDraft(JSON.stringify(full)),/Layer clip needs|source range|Invalid clip|Timeline is not sequential/);
const old=JSON.parse(exportDraft(s));delete old.video2Clips;delete old.audio2Clips;
const past=importDraft(JSON.stringify(old));
assert.equal(past.video2Clips.length,0);
assert.equal(past.audio2Clips.length,0);
assert.equal(duration(past),17);
assert.ok(crossfadeAt(past,9.5));
assert.throws(()=>planLocalMp4(saved,{},'/tmp/out.mp4'),/does not support V2\/A2/);
const ui=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
for(const id of ['video2-track','audio2-track','overlay-video','overlay-layout',
  'overlay-opacity','overlay-fade-in','overlay-fade-out','apply-layer-start'])assert.ok(html.includes('id="'+id+'"'));
assert.match(ui,/activeOverlayClip\(state,timelinePosition\)/);
assert.match(ui,/activeAudio2Clip\(state,timelinePosition\)/);
assert.match(ui,/overlayGain\.gain\.value=0/);
assert.match(ui,/audio2Gain\.gain\.value=0/);
assert.match(ui,/await syncExportLayer\(encoderAudio2,activeAudio2Clip\(state,timelinePosition\),timelinePosition,audio2Gain\)/);
assert.match(ui,/paintOverlay\(encoderOverlay,activeOverlayClip\(state,at\),overlayFade\?1-overlayFade.progress:1\)/); // real outgoing source
assert.match(ui,/syncLayers\(playhead,playing\)/);
assert.match(ui,/clip\.layer\.added/);
assert.match(ui,/clip\.layer\.moved/);
console.log('ParaCut R5 smoke PASS: V2/A2 placement, V1 crossfade preserved, source mute, audio + opacity fades, undo, migration and browser export wiring.');
