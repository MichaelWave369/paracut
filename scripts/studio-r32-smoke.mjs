import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  newStudio, change, undo, redo, duration, maxCrossfade, crossfadeAt,
  activeClip, validate, exportDraft, importDraft
} from '../apps/desktop/public/studio-core.js';
const a=(asset_id,type,duration)=>({asset_id,name:asset_id,size:800,lastModified:123,type,duration});
let s=newStudio("Escher’s impossible movie");
for(const data of [a('one','video/mp4',9),a('two','video/mp4',6),
  a('three','video/mp4',12),a('music','audio/mpeg',24)])
  s=change(s,{type:'asset.added',asset:data});
for(const asset_id of ['one','two','three','music'])
  s=change(s,{type:'clip.appended',asset_id});
assert.equal(duration(s),27);
assert.equal(maxCrossfade(s.clips,0),1.5);
assert.equal(maxCrossfade(s.clips,2),0);
assert.equal(crossfadeAt(s,8.5),null);
const out0=s.clips[0].clip_id;
const out1=s.clips[1].clip_id;
s=change(s,{type:'clip.transition.updated',clip_id:out0,seconds:1});
assert.equal(duration(s),26);
assert.equal(s.clips[1].timeline.start,8);
assert.equal(s.clips[2].timeline.start,14);
assert.equal(s.audioClips[0].timeline.start,0);
assert.equal(s.audioClips[0].timeline.end,24);
assert.equal(activeClip(s,8.5).asset_id,'one'); // outgoing is the master
const mid=crossfadeAt(s,8.5);
assert.equal(mid.outgoing.asset_id,'one');
assert.equal(mid.incoming.asset_id,'two');
assert.equal(mid.progress,.5);
assert.equal(crossfadeAt(s,7),null);
assert.equal(crossfadeAt(s,9),null);
s=change(s,{type:'clip.transition.updated',clip_id:out1,seconds:.5});
assert.equal(duration(s),25.5);
assert.equal(s.clips[2].timeline.start,13.5);
assert.equal(crossfadeAt(s,13.75).progress,.5);
assert.equal(importDraft(exportDraft(s)).clips[0].transition_out_seconds,1);
assert.equal(validate(s),true);
let o=undo(s); assert.equal(duration(o),26);
o=redo(o); assert.equal(duration(o),25.5);
assert.throws(()=>change(s,{type:'clip.transition.updated',clip_id:out1,seconds:5}),/Crossfade must fit/);
assert.throws(()=>change(s,{type:'clip.transition.updated',clip_id:s.clips[2].clip_id,seconds:1}),/following video/);
assert.throws(()=>change(s,{type:'clip.transition.updated',clip_id:out0,seconds:NaN}),/Crossfade must fit/);

// Shrinking a source automatically clamps an existing crossfade.
s=change(s,{type:'clip.trimmed',clip_id:out0,start:0,end:1});
assert.equal(s.clips[0].transition_out_seconds,.333);
assert.ok(validate(s));
assert.equal(s.clips[1].timeline.start,.667);
const first = s.clips[0].clip_id;
let parts=change(s,{type:'clip.split',clip_id:first,time:.5});
assert.equal(parts.clips[0].transition_out_seconds,0);
assert.ok(parts.clips[1].transition_out_seconds>0);
assert.ok(validate(parts));
const poisoned=JSON.parse(exportDraft(s));
poisoned.clips[0].transition_out_seconds=6;
assert.throws(()=>importDraft(JSON.stringify(poisoned)),/Invalid crossfade duration/);
const old=JSON.parse(exportDraft(newStudio('legacy')));
delete old.clips; // ensure validation catches bad files, not accidental migration
assert.throws(()=>importDraft(JSON.stringify(old)),/Invalid ParaCut draft/);
const legacy=newStudio('Pre-transition');
let cl=change(legacy,{type:'asset.added',asset:a('only','video/mp4',5)});
cl=change(cl,{type:'clip.appended',asset_id:'only'});
delete cl.clips[0].transition_out_seconds;
assert.equal(importDraft(exportDraft(cl)).clips[0].transition_out_seconds,undefined);

const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const ui=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
assert.match(html,/id="crossfade-video"/);
assert.match(html,/id="apply-crossfade"/);
assert.match(ui,/const fade=crossfadeAt\(state,at\)/);
assert.match(ui,/drawVideoFrame\(encoderIncoming,fade.progress,fade.incoming\)/); // per-source color grading during moving V1 crossfade
assert.match(ui,/audioLevelAt\(fade.incoming,at\) \* audioMixLevelAt\(state,'video-1',at\) \* fade.progress/);
assert.match(ui,/videoSourceGain.gain.value = audioLevelAt\(clip,timelinePosition\) \*/);
assert.match(ui,/const skipped = index > 0/);
console.log('ParaCut R3.2 crossfade smoke PASS: overlap geometry, preview/export wiring, preservation, and transition invariants.');
