import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,undo,redo,validate,exportDraft,importDraft,overlayOpacityAt}
 from '../apps/desktop/public/studio-core.js';
import {overlayKeyframeFilter,overlayAlphaStrategy}
 from '../apps/desktop/public/studio-keyframes.js';
import {LAB_SCENARIOS,buildLabDraft,parseLabOptions,summarizeLab,formatLabReport}
 from './studio-export-lab-core.mjs';
import {planLocalMp4} from './studio-local-export-core.mjs';

const make=(points)=>({source:{start:0,end:4},timeline:{start:2,end:6},
 track_id:'video-2',opacity_keyframe_points:points});
const pair=(a,b)=>[{at:0,value:a},{at:1,value:b}];
assert.deepEqual(overlayAlphaStrategy({}),{kind:'none'});
assert.equal(overlayKeyframeFilter({}),null);
// Constants are exact alpha multipliers. Unit value avoids a filter entirely.
for(const v of [0,.125,.7,1]){
 const clip=make([{at:0,value:v},{at:.5,value:v,ease:'ease-in'},
 {at:1,value:v}]);
 const result=overlayAlphaStrategy(clip);
 assert.equal(result.kind,v===1?'identity':'constant');
 assert.equal(overlayKeyframeFilter(clip),v===1?null:
  'colorchannelmixer=aa='+String(v));
}
for(const [a,b,expected]of [
 [0,1,'fade=t=in:st=0:d=4:alpha=1'],
 [1,0,'fade=t=out:st=0:d=4:alpha=1']
]){
 const clip=make(pair(a,b));
 assert.equal(overlayKeyframeFilter(clip),expected);
 const legacy={source:{start:0,end:4},opacity_keyframes:{start:a,end:b}};
 assert.equal(overlayKeyframeFilter(legacy),expected);
 for(const t of [0,.1,.5,.9,1]){
   // Saved draft interpretation never changes; the fastpath targets export.
   const expectedValue=a+(b-a)*t;
   const at=overlayOpacityAt({...clip,clip_id:'v2'},2+4*t);
   if(t<1)assert.ok(Math.abs(at-expectedValue)<.001);
 }
}
// Nontrivial ramps still use the proven pixel-accurate GEQ alpha expression.
for(const pts of [
 pair(.2,.8),[{at:0,value:0,ease:'ease-in'},{at:1,value:1}],
 [{at:0,value:0},{at:.3,value:1},{at:1,value:0}],
 [{at:0,value:0,ease:'bezier',handles:[.2,.8],
  handles_x:[.15,.76]},{at:1,value:1}]
]){
 const filter=overlayKeyframeFilter(make(pts));
 assert.match(filter,/^geq=r=r\(X\\,Y\)/);
 assert.match(filter,/alpha\(X\\,Y\)/);
}
for(const bad of [
 make([{at:0,value:0},{at:1,value:2}]),
 make([{at:0,value:0,ease:'bezier',handles:[.3,.9],
  handles_x:[.8,.2]},{at:1,value:1}]),
 {...make(pair(0,1)),source:{start:4,end:4}}
])assert.throws(()=>overlayKeyframeFilter(bad),/Invalid keyframe|duration/);

const a=(id,type,duration)=>({asset_id:id,name:id,type,duration,size:100,lastModified:0});
let s=newStudio('R7.6 native alpha');
for(const asset of [a('main','video/mp4',5),a('layer','video/mp4',4)])
 s=change(s,{type:'asset.added',asset});
s=change(s,{type:'clip.appended',asset_id:'main'});
s=change(s,{type:'clip.layer.added',asset_id:'layer',
 track_id:'video-2',start:.5});
const id=s.video2Clips[0].clip_id;
const old=exportDraft(s);
const linked=Object.fromEntries(s.assets.map(asset=>[asset.asset_id,
 {path:'/tmp/'+asset.name,hasAudio:false}]));
s=change(s,{type:'clip.keyframe.points.updated',clip_id:id,
 field:'opacity_keyframes',points:pair(0,1)});
assert.equal(validate(s),true);
assert.equal(s.receipts.at(-1).action,'clip.keyframe.points.updated');
const fadeGraph=planLocalMp4(s,linked,'/tmp/alpha-r76.mp4').graph;
assert.match(fadeGraph,/fade=t=in:st=0:d=4:alpha=1/);
assert.doesNotMatch(fadeGraph,/geq=r=r\(X\\,Y\)/);
const faded=s;
assert.deepEqual(undo(s).video2Clips[0].opacity_keyframe_points,undefined);
assert.deepEqual(redo(undo(s)).video2Clips[0].opacity_keyframe_points,pair(0,1));
assert.deepEqual(importDraft(exportDraft(s)).video2Clips[0].opacity_keyframe_points,pair(0,1));
assert.equal(importDraft(old).video2Clips[0].opacity_keyframe_points,undefined);
s=change(s,{type:'clip.keyframe.points.updated',clip_id:id,
 field:'opacity_keyframes',points:pair(.3,.3)});
const staticGraph=planLocalMp4(s,linked,'/tmp/static-r76.mp4').graph;
assert.match(staticGraph,/colorchannelmixer=aa=0\.3/);
assert.doesNotMatch(staticGraph,/geq=r=r\(X\\,Y\)/);
s=change(s,{type:'clip.keyframe.points.updated',clip_id:id,
 field:'opacity_keyframes',points:pair(.2,.8)});
const complexGraph=planLocalMp4(s,linked,'/tmp/complex-r76.mp4').graph;
assert.match(complexGraph,/geq=r=r\(X\\,Y\)/);
assert.notEqual(fadeGraph,complexGraph);
assert.equal(validate(s),true);
assert.equal(faded.receipts.length+2,s.receipts.length);

// The lab adds a native linear V2 case, using precisely the same synthetic
// clip/overlay as the constant V2 and Bézier cases.
assert.deepEqual(LAB_SCENARIOS.slice(0,4),['v1','v2-static','v2-linear','v2-bezier']);
assert.deepEqual(parseLabOptions(['--scenarios','v2-linear,v2-bezier']).scenarios,
 ['v2-linear','v2-bezier']);
const draft=importDraft(buildLabDraft({
 duration:3,scenario:'v2-linear',mainBytes:500,overlayBytes:250}));
assert.deepEqual(draft.video2Clips[0].opacity_keyframe_points,pair(0,1));
const fakeLinks=Object.fromEntries(draft.assets.map(asset=>[
 asset.asset_id,{path:'/tmp/'+asset.name,hasAudio:asset.asset_id==='lab-main'}]));
const labGraph=planLocalMp4(draft,fakeLinks,'/tmp/lab-linear.mp4').graph;
assert.match(labGraph,/fade=t=in:st=0:d=3:alpha=1/);
assert.doesNotMatch(labGraph,/geq=r=r\(X\\,Y\)/);
const opts={duration:3,repeats:2,qualities:['balanced'],
 scenarios:['v2-linear','v2-bezier']};
const runs=[];
for(const scenario of opts.scenarios)for(let repeat=1;repeat<=2;repeat++)
 runs.push({scenario,quality:'balanced',repeat,mediaSeconds:3,
 encodeMs:(scenario==='v2-linear'?1000:1800)+repeat*200,
 totalMs:(scenario==='v2-linear'?1100:1900)+repeat*200,
 graph:{filterGraphChars:2000,customXSegments:scenario==='v2-linear'?0:1,
 optimizedPieces:scenario==='v2-linear'?0:12,
 previousFixedPieces:scenario==='v2-linear'?0:64,
 maxProbeError:scenario==='v2-linear'?0:.001}});
const report=summarizeLab(opts,runs);
assert.equal(report.comparisons.length,1);
assert.equal(report.comparisons[0].kind,'bezier-vs-linear');
assert.equal(report.comparisons[0].bezierVsLinear,1.615);
assert.match(formatLabReport(report),/custom Bézier\/native linear alpha encode ratio/);

const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
assert.match(html,/R7\.(?:6 · ALPHA FASTPATHS|7 · BALANCED BÉZIER|8 · CONTROLLED A\/B|9 · EXPORT DIAGNOSTICS)|R8\.0 · CREATIVE TITLE DECK/);
console.log('ParaCut R7.6 PASS: constant/fade native alpha, GEQ fallback, validated drafts, receipt parity, and reproducible linear-vs-Bézier lab.');
