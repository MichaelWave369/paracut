import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  DRAFT_SCHEMA, PREVIOUS_DRAFT_SCHEMA, LEGACY_DRAFT_SCHEMA,
  newStudio, change, undo, redo, duration, audioLevelAt, visibleTitle,
  exportDraft, importDraft, validate
} from '../apps/desktop/public/studio-core.js';

const a=(asset_id,type,duration)=>({asset_id,type,duration,name:asset_id,size:100,lastModified:1234});
let s=newStudio('R3 cut');
for(const x of [a('grok','video/mp4',12),a('music','audio/mpeg',18)]) s=change(s,{type:'asset.added',asset:x});
for(const id of ['grok','music']) s=change(s,{type:'clip.appended',asset_id:id});
assert.equal(duration(s),12);
const vid=s.clips[0].clip_id, aud=s.audioClips[0].clip_id;
assert.equal(audioLevelAt(s.clips[0],4),1);
s=change(s,{type:'clip.audio.updated',clip_id:vid,volume:.6,fade_in:2,fade_out:3});
const v=s.clips[0];
assert.equal(audioLevelAt(v,0),0);
assert.equal(audioLevelAt(v,1),.3);
assert.equal(audioLevelAt(v,5),.6);
assert.ok(Math.abs(audioLevelAt(v,11) - .2) < 1e-9);
assert.equal(audioLevelAt(v,12),0);
s=change(s,{type:'clip.source-audio.muted',clip_id:vid,muted:true});
assert.equal(audioLevelAt(s.clips[0],6),0);
assert.equal(audioLevelAt(s.audioClips[0],6),1);
s=change(s,{type:'clip.audio.updated',clip_id:aud,volume:.75,fade_in:1,fade_out:2});
assert.equal(audioLevelAt(s.audioClips[0],.5),.375);
assert.equal(audioLevelAt(s.audioClips[0],17),.375);
assert.throws(()=>change(s,{type:'clip.audio.updated',clip_id:aud,volume:1.4,fade_in:0,fade_out:0}),/Audio settings/);
assert.throws(()=>change(s,{type:'clip.audio.updated',clip_id:aud,volume:.5,fade_in:10,fade_out:10}),/Audio settings/);
assert.throws(()=>change(s,{type:'clip.audio.updated',clip_id:aud,volume:'0.5',fade_in:0,fade_out:0}),/Audio settings/);

// Splits and trims cannot strand fades outside the shorter source range.
let split=change(s,{type:'clip.split',clip_id:vid,time:4});
assert.equal(split.clips.length,2);
split.clips.forEach(c=>assert.ok((c.fade_in || 0)+(c.fade_out || 0)<=c.source.end-c.source.start+.002));
const cutId=split.clips[0].clip_id;
split=change(split,{type:'clip.trimmed',clip_id:cutId,start:0,end:1.5});
assert.ok(split.clips[0].fade_in+split.clips[0].fade_out<=1.502);
assert.equal(validate(split),true);

// Titles are timed, copied with draft, and undoable.
s=change(s,{type:'title.added',title:{text:'Enter the Field',start:1,end:4}});
assert.equal(s.titles.length,1);
assert.equal(visibleTitle(s,0.5),null);
assert.equal(visibleTitle(s,2).text,'Enter the Field');
assert.equal(visibleTitle(s,4),null);
const persisted=importDraft(exportDraft(s));
assert.equal(persisted.titles.length,1);
assert.equal(persisted.clips[0].fade_out,3);
assert.equal(persisted.audioClips[0].volume,.75);
assert.equal(JSON.parse(exportDraft(s)).schema,DRAFT_SCHEMA);
let x=undo(s);
assert.equal(x.titles.length,0);
x=redo(x);
assert.equal(x.titles.length,1);
x=change(x,{type:'title.deleted',title_id:x.titles[0].title_id});
assert.equal(x.titles.length,0);
assert.throws(()=>change(s,{type:'title.added',title:{text:' ',start:0,end:2}}),/Title requires/);
assert.throws(()=>change(s,{type:'title.added',title:{text:'Too long',start:3,end:3}}),/Title requires/);

// R1 and R2 drafts remain valid; defaults are 100% sound, no fades/titles.
const old=JSON.parse(exportDraft(s));
old.schema=PREVIOUS_DRAFT_SCHEMA; delete old.titles;
for(const c of [...old.clips,...old.audioClips]) {
  delete c.volume; delete c.fade_in; delete c.fade_out;
}
const fromV2=importDraft(JSON.stringify(old));
assert.equal(fromV2.titles.length,0);
assert.equal(audioLevelAt(fromV2.audioClips[0],5),1);
old.schema=LEGACY_DRAFT_SCHEMA; delete old.audioClips;
const fromV1=importDraft(JSON.stringify(old));
assert.equal(fromV1.audioClips.length,0);
assert.equal(fromV1.titles.length,0);
const corrupt=JSON.parse(exportDraft(s));corrupt.titles[0].text='<'.repeat(101);
assert.throws(()=>importDraft(JSON.stringify(corrupt)),/Invalid title overlay/);
const badGain=JSON.parse(exportDraft(s));badGain.audioClips[0].volume=3;
assert.throws(()=>importDraft(JSON.stringify(badGain)),/Audio settings/);

// Guard the two output paths against feature regressions.
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
assert.ok(js.includes("video.volume = Math.min(1, audioLevelAt(v, at) * audioMixLevelAt(state,'video-1',at)"));
assert.ok(js.includes("setPreviewBusGain('a1',soundtrack,audioLevelAt(a,at)*audioMixLevelAt(state,'audio-1',at))"));
assert.ok(js.includes("videoSourceGain.gain.value = audioLevelAt(clip,timelinePosition) * audioMixLevelAt(state,'video-1',timelinePosition)"));
assert.ok(js.includes("soundtrackGain.gain.value = audioLevelAt(clip, at) * audioMixLevelAt(state,'audio-1',at)"));
assert.match(js,/drawTitleOnCanvas\(g, visibleTitle\(state,at\), at\)/);
assert.match(js,/node\.textContent = title\?\.text/);
assert.match(html,/id="clip-volume"/);
assert.match(html,/id="title-preview"/);
assert.match(html,/id="add-title"/);
console.log('ParaCut Studio R3 smoke PASS: audio gain/fades, title overlays, edit history, draft v1/v2 migration and preview/export wiring');
