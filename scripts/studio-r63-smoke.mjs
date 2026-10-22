import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,validate,undo,redo,duration,exportDraft,importDraft,overlayCrossfadeAt}
 from '../apps/desktop/public/studio-core.js';
import {synchronizedRipplePlan} from '../apps/desktop/public/studio-ripple.js';
const asset=(id,type,secs)=>({asset_id:id,name:id+'.'+(type.startsWith('audio')?'wav':'mp4'),
  type,size:100,duration:secs,lastModified:0});
let s=newStudio('R6.3 sync ripple');
for(const a of [asset('a','video/mp4',3),asset('b','video/mp4',3),
  asset('c','video/mp4',3),asset('over1','video/mp4',1.5),
  asset('over2','video/mp4',1.5),asset('bed','audio/wav',9),
  asset('voice','audio/wav',1)])s=change(s,{type:'asset.added',asset:a});
for(const asset_id of ['a','b','c','bed'])
 s=change(s,{type:'clip.appended',asset_id});
assert.equal(duration(s),9);
const target=s.clips[1].clip_id,audioId=s.audioClips[0].clip_id;
const base=s;
s=change(s,{type:'clip.layer.added',asset_id:'over1',track_id:'video-2',start:6});
s=change(s,{type:'clip.layer.added',asset_id:'over2',track_id:'video-2',start:7.5});
s=change(s,{type:'clip.overlay.transition.updated',
  clip_id:s.video2Clips[0].clip_id,seconds:.4});
s=change(s,{type:'clip.layer.added',asset_id:'voice',track_id:'audio-2',start:6.5});
s=change(s,{type:'title.added',title:{
  text:'After the removal',start:6.75,end:8.3,position:'bottom',
  size:'medium',color:'mint',fade_in:.1,fade_out:.1}});
const original=exportDraft(s);
const overlayBefore=s.video2Clips.map(c=>[c.timeline.start,c.timeline.end]);
const plan=synchronizedRipplePlan(s,target);
assert.deepEqual([plan.start,plan.end,plan.span],[3,6,3]);
assert.deepEqual(plan.affected.v2,s.video2Clips.map(c=>c.clip_id));
assert.equal(plan.affected.a2.length,1);
assert.equal(plan.affected.titles.length,1);
assert.equal(plan.shiftCount,4);
const r=change(s,{type:'clip.ripple.deleted',clip_id:target});
assert.equal(validate(r),true);
assert.deepEqual(r.clips.map(c=>c.asset_id),['a','c']);
assert.equal(duration(r),6);
assert.deepEqual(r.video2Clips.map(c=>[c.timeline.start,c.timeline.end]),
  overlayBefore.map(([start,end])=>[start-3,end-3]));
assert.equal(r.video2Clips[0].transition_out_seconds,.4);
assert.ok(overlayCrossfadeAt(r,4.25));
assert.equal(r.audio2Clips[0].timeline.start,3.5);
assert.equal(r.titles[0].start,3.75);
assert.equal(r.titles[0].end,5.3);
assert.equal(r.audioClips[0].clip_id,audioId);
assert.equal(r.audioClips[0].timeline.end,9); // A1 is intentionally NOT sync shifted
assert.equal(r.receipts.at(-1).action,'clip.ripple.deleted');
assert.deepEqual(r.receipts.at(-1).details,{
 clip_id:target,asset_id:null,start:3,end:6,seconds_removed:3,
 shifted_v2:2,shifted_a2:1,shifted_titles:1,a1_unchanged:true
});
assert.equal(undo(r).clips.length,3);
assert.equal(undo(r).video2Clips[0].timeline.start,6);
assert.equal(redo(undo(r)).video2Clips[0].timeline.start,3);
assert.equal(importDraft(exportDraft(r)).video2Clips[0].timeline.start,3);
assert.equal(importDraft(original).video2Clips[0].timeline.start,6);

// Delete remains old lane-local behavior, while the distinct sync command shifts layers.
const normal=change(s,{type:'clip.deleted',clip_id:target});
assert.equal(duration(normal),6);
assert.equal(normal.video2Clips[0].timeline.start,6);
assert.equal(normal.audio2Clips[0].timeline.start,6.5);
assert.equal(normal.titles[0].start,6.75);
// Fail closed if any V1 dissolve touches the removed clip.
const leftJoined=change(base,{type:'clip.transition.updated',
 clip_id:base.clips[0].clip_id,seconds:.5});
assert.throws(()=>synchronizedRipplePlan(leftJoined,target),/Remove V1 dissolves/);
assert.throws(()=>change(leftJoined,{type:'clip.ripple.deleted',clip_id:target}),/Remove V1 dissolves/);
const rightJoined=change(base,{type:'clip.transition.updated',
 clip_id:target,seconds:.5});
assert.throws(()=>synchronizedRipplePlan(rightJoined,target),/Remove V1 dissolves/);
// Fail closed when V2/A2/T1 overlaps the removal, instead of silently deleting content.
const overlapV2=change(base,{type:'clip.layer.added',
 asset_id:'over1',track_id:'video-2',start:2.5});
assert.throws(()=>change(overlapV2,{type:'clip.ripple.deleted',clip_id:target}),/v2 clip\/title overlaps/);
const overlapA2=change(base,{type:'clip.layer.added',
 asset_id:'voice',track_id:'audio-2',start:4});
assert.throws(()=>change(overlapA2,{type:'clip.ripple.deleted',clip_id:target}),/a2 clip\/title overlaps/);
const overlapT=change(base,{type:'title.added',title:{
  text:'During cut',start:4,end:4.7,position:'bottom',size:'medium',color:'white'}});
assert.throws(()=>change(overlapT,{type:'clip.ripple.deleted',clip_id:target}),/titles clip\/title overlaps/);
assert.throws(()=>change(base,{type:'clip.ripple.deleted',clip_id:audioId}),/selected V1 clip/);
// Rejection does not mutate original state or its edit receipt history.
const immutable=exportDraft(overlapV2);
assert.throws(()=>change(overlapV2,{type:'clip.ripple.deleted',clip_id:target}),/overlaps/);
assert.equal(exportDraft(overlapV2),immutable);
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
for(const id of ['ripple-delete','jog-next','shortcut-reference'])
 assert.match(html,new RegExp('id="'+id+'"'));
assert.match(html,/Shift\+Delete/);
assert.match(js,/synchronizedRipplePlan\(state,selectedId\)/);
assert.match(js,/edit\(\{type:'clip.ripple.deleted',clip_id:selectedId\}\)/);
assert.match(js,/if\(command.type==='clip.ripple.deleted'\)playhead=state.receipts.at\(-1\).details.start/);
assert.match(js,/function frameJog\(step\)/);
assert.match(js,/Math.round\(playhead\*30\+step\)\/30/);
assert.match(js,/e.key===','/);
assert.match(js,/e\.key==='\.'/);
assert.match(css,/\.shortcut-reference/);
console.log('ParaCut R6.3 PASS: synchronized V1 ripple, safe V2/A2/title shift, transition guard, exact frame jog, Undo/Redo and legacy delete.');
