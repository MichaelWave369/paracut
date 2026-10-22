import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,exportDraft,importDraft,undo,redo,validate} from '../apps/desktop/public/studio-core.js';
import {planLocalMp4} from './studio-local-export-core.mjs';
const asset=(id,type,duration)=>({asset_id:id,name:id+'.'+(type.startsWith('audio')?'wav':'mp4'),type,size:100,duration,lastModified:1});
let s=newStudio('Layered local MP4');
for(const item of [
  asset('main','video/mp4',5),asset('next','video/mp4',5),
  asset('pip','video/mp4',3),asset('full','video/mp4',3),
  asset('music','audio/wav',10),asset('voice','audio/wav',2)])
  s=change(s,{type:'asset.added',asset:item});
for(const id of ['main','next','music'])s=change(s,{type:'clip.appended',asset_id:id});
s=change(s,{type:'clip.transition.updated',clip_id:s.clips[0].clip_id,seconds:.5});
s=change(s,{type:'clip.layer.added',track_id:'video-2',asset_id:'pip',start:1});
s=change(s,{type:'clip.layer.added',track_id:'video-2',asset_id:'full',start:4});
s=change(s,{type:'clip.overlay.transition.updated',clip_id:s.video2Clips[0].clip_id,seconds:.7});
s=change(s,{type:'clip.layer.added',track_id:'audio-2',asset_id:'voice',start:2});
s=change(s,{type:'clip.overlay.updated',clip_id:s.video2Clips[0].clip_id,
  layout:'pip',opacity:.75,fade_in:.25,fade_out:.15,motion:'slide-left'});
s=change(s,{type:'clip.overlay.updated',clip_id:s.video2Clips[1].clip_id,
  layout:'full',opacity:.8,fade_in:.2,fade_out:.25,motion:'rise'});
s=change(s,{type:'clip.source-audio.muted',clip_id:s.video2Clips[1].clip_id,muted:false});
s=change(s,{type:'mixer.updated',lane:'a1',gain:.7,muted:false,solo:false});
s=change(s,{type:'mixer.updated',lane:'a2',gain:.8,muted:false,solo:false});
s=change(s,{type:'mixer.duck.updated',enabled:true});
s=change(s,{type:'title.added',title:{
  text:'ParaCut layers',start:1.2,end:4,position:'top',size:'medium',
  color:'gold',fade_in:.3,fade_out:.3}});
const saved=importDraft(exportDraft(s));
assert.equal(validate(saved),true);
const sources=Object.fromEntries(saved.assets.map(a=>[a.asset_id,{path:'/example/'+a.name,hasAudio:true}]));
const plan=planLocalMp4(saved,sources,'/tmp/layers.mp4');
assert.equal(plan.videoClips,2);
assert.equal(plan.overlayClips,2);
assert.equal(plan.voiceClips,1);
assert.equal(plan.transitions,1);
assert.equal(plan.overlayCrossfades,1);
assert.equal(plan.duration,9.5);
assert.equal(plan.audioSegments,5); // two V1, A1, unmuted incoming V2, A2
assert.match(plan.graph,/xfade=transition=fade:duration=0\.5:offset=4\.5/);
assert.match(plan.graph,/colorchannelmixer=aa=0\.75/);
assert.match(plan.graph,/fade=t=in:st=0:d=0\.7:alpha=1/);
assert.match(plan.graph,/fade=t=out:st=2\.3:d=0\.7:alpha=1/);
assert.match(plan.graph,/overlay=x='/);
assert.match(plan.graph,/composited1/);
assert.match(plan.graph,/adelay=2000:all=1/);
assert.match(plan.graph,/volume=0\.7/);
assert.match(plan.graph,/between\(t\\,2\\,4\)/);
assert.match(plan.graph,/amix=inputs=5:duration=longest:dropout_transition=0:normalize=0/);
assert.match(plan.graph,/ass=filename=titles.ass/);
assert.ok(plan.ass.includes('ParaCut layers'));
assert.equal(plan.args.filter(x=>x==='-i').length,6);
assert.ok(plan.args.includes('libx264')&&plan.args.includes('aac'));
assert.throws(()=>planLocalMp4(saved,{},'/tmp/test.mp4'),/Source media not relinked/);
assert.throws(()=>planLocalMp4(saved,sources,'/tmp/test.webm'),/end in .mp4/);
const base=change(s,{type:'mixer.updated',lane:'a2',gain:.8,muted:false,solo:true});
const solo=planLocalMp4(base,sources,'/tmp/solo.mp4');
assert.equal(solo.audioSegments,1); // V1+V2 source and A1 isolated by A2 Solo
assert.doesNotMatch(solo.graph,/between\(t\\,2\\,4\)/); // no active A1 bed
const muted=change(s,{type:'mixer.updated',lane:'a2',gain:.8,muted:true,solo:false});
const noVoice=planLocalMp4(muted,sources,'/tmp/mute.mp4');
assert.equal(noVoice.audioSegments,4);
assert.doesNotMatch(noVoice.graph,/between\(t\\,2\\,4\)/);
assert.equal(redo(undo(s)).video2Clips[0].transition_out_seconds,.7);
// Real Windows GUI uses CLI, and the CLI must relink all four tracks.
const cli=readFileSync(new URL('./studio-export-local.mjs',import.meta.url),'utf8');
assert.match(cli,/state\.video2Clips,\.\.\.state\.audio2Clips/);
assert.match(cli,/Media byte-size mismatch/);
assert.match(cli,/Output already exists: refusing overwrite/);
assert.match(cli,/spawn\(plan\.ffmpeg,plan\.args,\{cwd:working,stdio:'inherit',shell:false/);
console.log('ParaCut R5.6 PASS: V1/V2 video, A1/A2 sound, real V2 fades, motion, opacity, solo, ducking, titles and media relink.');
