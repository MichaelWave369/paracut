import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,validate,undo,redo,duration,exportDraft,importDraft} from '../apps/desktop/public/studio-core.js';
import {planLocalMp4} from './studio-local-export-core.mjs';

const asset=(id,length)=>({asset_id:id,name:id+'.mp4',type:'video/mp4',size:100,lastModified:0,duration:length});
let s=newStudio('Source / Program edit');
for(const a of [asset('v1',5),asset('v2',6),asset('take',10)])
  s=change(s,{type:'asset.added',asset:a});
for(const id of ['v1','v2'])s=change(s,{type:'clip.appended',asset_id:id});
assert.equal(duration(s),11);
const firstId=s.clips[0].clip_id;
s=change(s,{type:'clip.source.inserted',asset_id:'take',start:1.1,end:2.9,at:2});
assert.equal(s.clips.length,4);
assert.deepEqual(s.clips.map(c=>c.asset_id),['v1','take','v1','v2']);
assert.deepEqual(s.clips.map(c=>[c.timeline.start,c.timeline.end]),[
 [0,2],[2,3.8],[3.8,6.8],[6.8,12.8]]);
assert.deepEqual(s.clips.map(c=>[c.source.start,c.source.end]),[
 [0,2],[1.1,2.9],[2,5],[0,6]]);
assert.ok(s.receipts.at(-1).action==='clip.source.inserted');
assert.equal(s.receipts.at(-1).details.asset_id,'take');
assert.equal(s.receipts.at(-1).details.source_in,1.1);
assert.equal(s.receipts.at(-1).details.source_out,2.9);
assert.equal(s.receipts.at(-1).details.at,2);
assert.equal(validate(s),true);
assert.equal(undo(s).clips.length,2);
assert.equal(redo(undo(s)).clips.length,4);
const reopened=importDraft(exportDraft(s));
assert.equal(reopened.clips[1].source.start,1.1);
assert.equal(reopened.clips[2].source.start,2);
// Insertion exactly at the beginning or an edit boundary needs no split.
const front=change(reopened,{type:'clip.source.inserted',asset_id:'take',start:5,end:5.8,at:0});
assert.equal(front.clips.length,5);
assert.equal(front.clips[0].asset_id,'take');
const atCut=change(reopened,{type:'clip.source.inserted',asset_id:'take',start:5,end:6,at:3.8});
assert.equal(atCut.clips.length,5);
assert.equal(atCut.clips[2].asset_id,'take');
const atEnd=change(reopened,{type:'clip.source.inserted',asset_id:'take',start:7,end:8,at:duration(reopened)});
assert.equal(atEnd.clips.at(-1).asset_id,'take');
assert.equal(duration(atEnd),13.8);
// Cannot split active transitions or create invalid source IN / OUT.
let fading=newStudio();
for(const a of [asset('left',4),asset('right',4),asset('take',10)])
 fading=change(fading,{type:'asset.added',asset:a});
for(const id of ['left','right'])fading=change(fading,{type:'clip.appended',asset_id:id});
fading=change(fading,{type:'clip.transition.updated',clip_id:fading.clips[0].clip_id,seconds:1});
assert.throws(()=>change(fading,{type:'clip.source.inserted',asset_id:'take',start:0,end:2,at:3.5}),/active crossfade/);
assert.throws(()=>change(fading,{type:'clip.source.inserted',asset_id:'take',start:0,end:2,at:2.98}),/too close|at a cut/);
assert.throws(()=>change(fading,{type:'clip.source.inserted',asset_id:'take',start:2,end:2.02,at:0}),/Source IN\/OUT/);
assert.throws(()=>change(fading,{type:'clip.source.inserted',asset_id:'take',start:2,end:11,at:0}),/Source IN\/OUT/);
assert.throws(()=>change(fading,{type:'clip.source.inserted',asset_id:'take',start:0,end:1,at:-1}),/playhead/);
// Replace one selected V1 clip, update source range, clear conflicting fades,
// ripple V1, preserve identity for selection and leave other lanes untouched.
const target=fading.clips[1].clip_id;
const replaced=change(fading,{type:'clip.source.replaced',
 clip_id:target,asset_id:'take',start:1.25,end:3.25});
assert.equal(replaced.clips[1].clip_id,target);
assert.equal(replaced.clips[1].asset_id,'take');
assert.deepEqual(replaced.clips[1].source,{start:1.25,end:3.25});
assert.equal(replaced.clips[0].transition_out_seconds,0);
assert.equal(duration(replaced),6);
assert.ok(replaced.receipts.at(-1).action==='clip.source.replaced');
assert.equal(undo(replaced).clips[0].transition_out_seconds,1);
assert.throws(()=>change(fading,{type:'clip.source.replaced',clip_id:'invalid',asset_id:'take',start:0,end:2}),/Select a V1/);
// Old drafts remain valid and source edits are rendered through existing path.
const media=Object.fromEntries(reopened.assets.map(a=>[a.asset_id,{
 path:'/tmp/'+a.name,hasAudio:false
}]));
const plan=planLocalMp4(reopened,media,'/tmp/r58.mp4');
assert.equal(plan.videoClips,4);
assert.equal(plan.duration,12.8);
assert.equal(plan.args.filter(a=>a==='-i').length,4);
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
for(const id of ['source-video','source-seek','source-mark-in','source-mark-out',
 'source-in','source-out','source-insert','source-replace','media-search','media-sort']) {
 assert.match(html,new RegExp('id="'+id+'"'));
}
assert.match(js,/function chooseSource\(assetId\)/);
assert.match(js,/function applySourceEdit\(type\)/);
assert.match(js,/clip\.source\.inserted/);
assert.match(js,/clip\.source\.replaced/);
assert.match(js,/sourceVideo\.pause\(\)/);
assert.match(css,/\.monitor-bank\{display:grid/);
assert.match(js,/sort==='duration'/);
console.log('ParaCut R5.8 PASS: dual Source Monitor, three-point ripple insert, selected replace, crossfade safety, undo/redo, receipt and MP4 draft compatibility.');
