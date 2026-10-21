import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  newStudio,change,validate,duration,snapLayerTime,exportDraft,importDraft,
  crossfadeAt
} from '../apps/desktop/public/studio-core.js';
const asset=(id,type,duration)=>({asset_id:id,name:id+'.mp4',size:100,lastModified:1,type,duration});
let s=newStudio('Precision Storyboard');
for(const a of [asset('v1','video/mp4',8),asset('vnext','video/mp4',8),
  asset('overlay','video/mp4',2),asset('song','audio/mpeg',2)])s=change(s,{type:'asset.added',asset:a});
for(const asset_id of ['v1','vnext'])s=change(s,{type:'clip.appended',asset_id});
s=change(s,{type:'clip.transition.updated',clip_id:s.clips[0].clip_id,seconds:1});
assert.equal(duration(s),15);
assert.equal(s.clips[1].timeline.start,7);
const startSnap=snapLayerTime(s,{desiredStart:7.18,span:2,trackId:'audio-2',threshold:.25});
assert.deepEqual(startSnap,{start:7,snapped:true,anchor:7,edge:'start'});
const endSnap=snapLayerTime(s,{desiredStart:5.12,span:2,trackId:'audio-2',threshold:.2});
assert.equal(endSnap.start,5);
assert.equal(endSnap.snapped,true);
// V2 media at 3-5. Same-lane snapping cannot suggest an overlapping placement.
s=change(s,{type:'clip.layer.added',asset_id:'overlay',track_id:'video-2',start:3});
const occupied=snapLayerTime(s,{desiredStart:2.92,span:2,trackId:'video-2',threshold:.15});
assert.equal(occupied.snapped,false);
assert.equal(occupied.start,2.92);
assert.throws(()=>change(s,{type:'clip.layer.added',asset_id:'overlay',track_id:'video-2',start:occupied.start}),/already has media/);
const edge=snapLayerTime(s,{desiredStart:5.13,span:2,trackId:'video-2',threshold:.2});
assert.equal(edge.start,5);
assert.equal(edge.snapped,true);
const clipId=s.video2Clips[0].clip_id;
const own=snapLayerTime(s,{desiredStart:4.89,span:2,trackId:'video-2',excludeClipId:clipId,extraAnchors:[5],threshold:.2});
assert.equal(own.start,5);
const nearPlayhead=snapLayerTime(s,{desiredStart:10.19,span:2,trackId:'audio-2',
  extraAnchors:[10],threshold:.25});
assert.equal(nearPlayhead.start,10);
assert.equal(nearPlayhead.snapped,true);
assert.equal(snapLayerTime(s,{desiredStart:10.19,span:2,trackId:'audio-2',
  extraAnchors:[10],threshold:0}).snapped,false);
assert.throws(()=>snapLayerTime(s,{desiredStart:1,span:2,trackId:'audio-1'}),/Invalid snap request/);
assert.throws(()=>snapLayerTime(s,{desiredStart:1,span:2,trackId:'audio-2',threshold:999}),/Invalid snap request/);
// A snap suggestion never mutates project, transition, source media or receipts.
const original=exportDraft(s);
snapLayerTime(s,{desiredStart:8.2,span:2,trackId:'audio-2'});
assert.equal(exportDraft(s),original);
const reopened=importDraft(original);
assert.ok(validate(reopened));
assert.ok(crossfadeAt(reopened,7.5));
assert.equal(snapLayerTime(reopened,{desiredStart:7.17,span:2,trackId:'audio-2'}).start,7);

const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
for(const id of ['timeline-zoom','zoom-label','fit-timeline','snap-enabled',
  'precision-ruler','storyboard-scroll','storyboard-canvas','storyboard-playhead',
  'snap-feedback','video2-track','audio2-track'])assert.match(html,new RegExp('id="'+id+'"'));
assert.match(js,/function drawPrecisionRuler\(total,width\)/);
assert.match(js,/const total=timelineExtent\(\)/);
assert.match(js,/item\.style\.left=String\(100\*clip\.timeline\.start\/total\)/);
assert.match(js,/placeOnLayer\(\{type:'clip\.layer\.moved'/);
assert.match(js,/placeOnLayer\(\{type:'clip\.layer\.added'/);
assert.match(js,/snapLayerTime\(state,/);
assert.match(js,/drawTimeline\(\); drawTitles\(\); updateStoryPlayhead\(\)/);
assert.match(css,/\.storyboard-scroll\{overflow-x:auto/);
assert.match(css,/\.storyboard-canvas \.title-track/);
console.log('ParaCut R5.1 PASS: start/end/occupied snap, playhead, no mutation, crossfade compatibility, aligned zoom/ruler UI.');
