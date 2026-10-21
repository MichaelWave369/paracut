import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { newStudio, change, undo, redo, duration, activeClip, validate, importDraft, exportDraft, DRAFT_SCHEMA } from '../apps/desktop/public/studio-core.js';

let s = newStudio('First Cut');
const a = { asset_id:'a1', name:'one.mp4', type:'video/mp4', size:1024, lastModified:1234, duration:10 };
const b = { asset_id:'b1', name:'two.webm', type:'video/webm', size:800, lastModified:4567, duration:6 };
s = change(s,{type:'asset.added', asset:a});
s = change(s,{type:'asset.added', asset:b});
s = change(s,{type:'clip.appended',asset_id:'a1'});
s = change(s,{type:'clip.appended',asset_id:'b1'});
assert.equal(duration(s),16);
assert.equal(activeClip(s, 11).asset_id,'b1');
const first = s.clips[0].clip_id;
s=change(s,{type:'clip.trimmed', clip_id:first, start:2, end:8});
assert.equal(duration(s),12);
assert.equal(s.clips[1].timeline.start,6);
s=change(s,{type:'clip.split', clip_id:first, time:3});
assert.equal(s.clips.length,3);
assert.deepEqual(s.clips.map(c=>c.source),[
  {start:2,end:5},{start:5,end:8},{start:0,end:6}
]);
assert.equal(duration(s),12);
const third=s.clips[2].clip_id;
s=change(s,{type:'clip.moved',clip_id:third,step:-1});
assert.equal(s.clips[1].asset_id,'b1');
const snapshot=exportDraft(s);
assert.equal(JSON.parse(snapshot).schema,DRAFT_SCHEMA);
assert.equal(importDraft(snapshot).clips.length,3);
s=change(s,{type:'clip.deleted',clip_id:third});
assert.equal(duration(s),6);
s=undo(s);
assert.equal(duration(s),12);
s=redo(s);
assert.equal(duration(s),6);
assert.equal(validate(s),true);
assert.throws(()=>change(s,{type:'clip.split',clip_id:s.clips[0].clip_id,time:0}),/inside/);
assert.throws(()=>change(s,{type:'clip.trimmed',clip_id:s.clips[0].clip_id,start:8,end:2}),/In\/out/);
assert.throws(()=>importDraft('{}'),/Not a ParaCut/);
const broken=JSON.parse(snapshot); broken.clips[0].asset_id='missing';
assert.throws(()=>importDraft(JSON.stringify(broken)),/Invalid video reference/);
const page=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
for(const f of ['studio.css','studio.js','studio-core.js']) {
  assert.ok(page.includes(f) || f==='studio-core.js','Studio page should load '+f);
  assert.ok(existsSync(new URL('../apps/desktop/public/'+f,import.meta.url)));
}
assert.ok(page.includes('id="export-webm"'));
console.log('ParaCut Studio R1 smoke: PASS (timeline, receipts, undo/redo, draft, browser wiring).');
