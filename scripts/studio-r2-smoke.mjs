import assert from 'node:assert/strict';
import { newStudio, change, undo, redo, activeAudioClip, activeClip,
  duration, validate, exportDraft, importDraft, DRAFT_SCHEMA, LEGACY_DRAFT_SCHEMA } from '../apps/desktop/public/studio-core.js';

const asset = (asset_id, type, duration) => ({
  asset_id, name: asset_id+'.'+(type.startsWith('audio/')?'mp3':'mp4'),
  type, duration, size:1024, lastModified:100
});
let s = newStudio('Soundtrack Cut');
for (const a of [
  asset('v1','video/mp4',10), asset('v2','video/mp4',6),
  asset('a1','audio/mpeg',5), asset('a2','audio/mpeg',3)
]) s = change(s,{type:'asset.added',asset:a});
for(const asset_id of ['v1','v2','a1','a2']) s = change(s,{type:'clip.appended',asset_id});
assert.equal(s.clips.length,2);
assert.equal(s.audioClips.length,2);
assert.equal(s.clips[0].track_id,'video-1');
assert.equal(s.audioClips[0].track_id,'audio-1');
assert.equal(duration(s),16); // video master duration
assert.equal(activeClip(s,12).asset_id,'v2');
assert.equal(activeAudioClip(s,6).asset_id,'a2');
assert.equal(activeAudioClip(s,9),null);

const aId=s.audioClips[0].clip_id;
s=change(s,{type:'clip.trimmed',clip_id:aId,start:1,end:4});
assert.equal(s.audioClips[1].timeline.start,3);
assert.equal(duration(s),16);
s=change(s,{type:'clip.split',clip_id:aId,time:1.5});
assert.equal(s.audioClips.length,3);
assert.equal(s.audioClips[0].source.end,2.5);
assert.equal(s.audioClips[1].source.start,2.5);
assert.equal(s.audioClips[2].timeline.start,3);
const idTwo=s.audioClips[2].clip_id;
const idOne=s.audioClips[0].clip_id;
const vId=s.clips[0].clip_id;
assert.throws(()=>change(s,{type:'clip.reordered',clip_id:idTwo,target_id:vId,after:false}),/same track/);
s=change(s,{type:'clip.reordered',clip_id:idTwo,target_id:idOne,after:false});
assert.equal(s.audioClips[0].asset_id,'a2');
assert.equal(s.audioClips[1].timeline.start,3);
s=undo(s);
assert.equal(s.audioClips[0].asset_id,'a1');
s=redo(s);
assert.equal(s.audioClips[0].asset_id,'a2');
const snapshot=JSON.parse(exportDraft(s));
assert.equal(snapshot.schema,DRAFT_SCHEMA);
assert.equal(importDraft(JSON.stringify(snapshot)).audioClips.length,3);

const tamper=structuredClone(snapshot);
tamper.audioClips[0].track_id='video-1';
assert.throws(()=>importDraft(JSON.stringify(tamper)),/Invalid audio reference/);
const duplicate=structuredClone(snapshot);
duplicate.audioClips[0].clip_id=duplicate.clips[0].clip_id;
assert.throws(()=>importDraft(JSON.stringify(duplicate)),/Duplicate clip ID/);
const old = newStudio('Legacy');
old.assets.push(asset('oldVideo','video/mp4',8));
old.clips.push({clip_id:'old-1',asset_id:'oldVideo',track_id:'video-1',
 timeline:{start:0,end:8},source:{start:0,end:8},enabled:true,effects:[]});
const legacyJson=JSON.parse(exportDraft(old));
legacyJson.schema=LEGACY_DRAFT_SCHEMA;
delete legacyJson.audioClips;
const migrated=importDraft(JSON.stringify(legacyJson));
assert.equal(migrated.schema,DRAFT_SCHEMA);
assert.equal(migrated.audioClips.length,0);
assert.equal(duration(migrated),8);
assert.equal(validate(migrated),true);
console.log('ParaCut Studio R2 smoke: PASS (audio lane, drag order contract, trim/split, undo/redo, v1 migration, tamper checks).');
