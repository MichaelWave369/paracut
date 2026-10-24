import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {newStudio,change,exportDraft,importDraft,undo,redo,validate}
  from '../apps/desktop/public/studio-core.js';
import {keyframeCurveExpression,validateBezierLookup,
 BEZIER_LOOKUP_MODES,planBezierExportSegments}
 from '../apps/desktop/public/studio-keyframe-points.js';
import {audioKeyframeFilter,overlayKeyframeFilter}
 from '../apps/desktop/public/studio-keyframes.js';
import {planLocalMp4} from './studio-local-export-core.mjs';
import {graphDiagnostics} from './studio-export-benchmark.mjs';
import {BENCH_SCHEMA,buildLabDraft} from './studio-export-lab-core.mjs';
import {AB_SCHEMA,AB_MODES,parseABArgs,scheduleAB,acceptABReceipt,
 summarizeAB,formatABReport} from './studio-export-ab-core.mjs';

assert.deepEqual(BEZIER_LOOKUP_MODES,['balanced','linear']);
assert.equal(validateBezierLookup('balanced'),'balanced');
assert.equal(validateBezierLookup('linear'),'linear');
for(const invalid of ['',null,'sequential','l inear','if(1,2,3)'])
 assert.throws(()=>validateBezierLookup(invalid),/lookup mode/);
const p=[{at:0,value:0,ease:'bezier',handles:[.12,.91],
 handles_x:[.1,.77]},{at:1,value:1}];
const plan=planBezierExportSegments(p[0].handles,p[0].handles_x);
assert.ok(plan.segments>1);
const balanced=keyframeCurveExpression(p,3,'T');
const linear=keyframeCurveExpression(p,3,'T',{bezierLookup:'linear'});
assert.equal(balanced,keyframeCurveExpression(p,3,'T',{bezierLookup:'balanced'}));
assert.notEqual(balanced,linear);
assert.ok(linear.includes('if(lt('));
assert.ok(balanced.includes('if(lt('));
assert.ok(balanced.length<35000&&linear.length<35000);
assert.equal((linear.match(/if\(lt\(/g)||[]).length,
 plan.segments+1,'Original sequential compiler uses one decision per chord.');
assert.equal((balanced.match(/if\(lt\(/g)||[]).length,
 plan.segments,'Balanced tree uses N-1 knot decisions plus outer clip branch.');
for(const invalid of ['bad','0','alternate'])
 assert.throws(()=>keyframeCurveExpression(p,3,'T',{bezierLookup:invalid}),/lookup mode/);
const clip={source:{start:0,end:3},track_id:'video-2',
 opacity_keyframe_points:p,volume_keyframe_points:p};
assert.notEqual(overlayKeyframeFilter(clip,{bezierLookup:'linear'}),
 overlayKeyframeFilter(clip,{bezierLookup:'balanced'}));
assert.notEqual(audioKeyframeFilter(clip,{bezierLookup:'linear'}),
 audioKeyframeFilter(clip,{bezierLookup:'balanced'}));
const simple=[{at:0,value:0},{at:1,value:1}];
const ordinary={source:{start:0,end:3},track_id:'video-2',
 opacity_keyframe_points:simple};
assert.equal(overlayKeyframeFilter(ordinary,{bezierLookup:'linear'}),
 overlayKeyframeFilter(ordinary,{bezierLookup:'balanced'}));

const draft=buildLabDraft({duration:3,scenario:'v2-bezier-stress',
 mainBytes:1000,overlayBytes:800});
let state=importDraft(draft);
assert.equal(validate(state),true);
const id=state.video2Clips[0].clip_id;
const before=exportDraft(state);
const linked=Object.fromEntries(state.assets.map(a=>[a.asset_id,{
 path:'/tmp/'+a.name,hasAudio:a.asset_id==='lab-main'}]));
const old=planLocalMp4(state,linked,'/tmp/test.mp4',{bezierLookup:'linear'});
const next=planLocalMp4(state,linked,'/tmp/test.mp4');
assert.notEqual(old.graph,next.graph);
assert.deepEqual(old.args,next.args);
assert.deepEqual(old.ass,next.ass);
assert.equal(old.duration,next.duration);
assert.equal(old.quality,next.quality);
const oldInfo=graphDiagnostics(state,old.graph),
 nextInfo=graphDiagnostics(state,next.graph);
assert.equal(oldInfo.customXSegments,4);
assert.equal(oldInfo.optimizedPieces,nextInfo.optimizedPieces);
assert.equal(oldInfo.maxProbeError,nextInfo.maxProbeError);
assert.notEqual(oldInfo.filterGraphChars,nextInfo.filterGraphChars);
assert.throws(()=>planLocalMp4(state,linked,'/tmp/test.mp4',{bezierLookup:'arbitrary'}),
 /lookup mode/);
assert.equal(exportDraft(state),before,'Choosing lookup must never modify the draft.');
state=change(state,{type:'clip.keyframe.points.updated',clip_id:id,field:'opacity_keyframes',
 points:[{at:0,value:.2,ease:'bezier',handles:[.15,.85],
 handles_x:[.2,.8]},{at:1,value:.9}]});
assert.equal(state.receipts.at(-1).action,'clip.keyframe.points.updated');
assert.deepEqual(redo(undo(state)).video2Clips[0].opacity_keyframe_points,
 state.video2Clips[0].opacity_keyframe_points);
assert.equal(importDraft(before).video2Clips[0].opacity_keyframe_points.length,5);

const defaults=parseABArgs([]);
assert.equal(defaults.scenario,'v2-bezier-stress');
assert.equal(defaults.quality,'balanced');
assert.equal(defaults.duration,3);
assert.equal(defaults.repeats,2);
assert.deepEqual(parseABArgs(['--duration','6','--repeats','3',
 '--quality','high','--scenario','v2-bezier']).scenario,'v2-bezier');
assert.deepEqual(parseABArgs(['--help']),{help:true});
assert.deepEqual(AB_MODES,['linear','balanced']);
assert.deepEqual(scheduleAB(2),[
 {repeat:1,mode:'linear'},{repeat:1,mode:'balanced'},
 {repeat:2,mode:'balanced'},{repeat:2,mode:'linear'}]);
for(const input of [
 ['--quality','none'],['--scenario','v1'],['--duration','0'],
 ['--duration','11'],['--repeats','4'],['--repeats','1.5'],
 ['--ffmpeg',''],['--report','x.txt'],['--bad','foo'],
 ['--scenario','v2-bezier','--scenario','v2-bezier']
])assert.throws(()=>parseABArgs(input),/A\/B/);
assert.throws(()=>scheduleAB(0),/repeats/);
const receipt={schema:BENCH_SCHEMA,bezierLookup:'linear',
 mediaSeconds:3,probeMs:4,planMs:5,encodeMs:2000,verifyMs:10,totalMs:2100,
 graph:{filterGraphChars:5000,customXSegments:4,optimizedPieces:100,
 previousFixedPieces:256,maxProbeError:.001}};
const text='PARACUT_BENCH_JSON '+JSON.stringify(receipt);
assert.deepEqual(acceptABReceipt(text,'linear'),receipt);
for(const record of [
 {...receipt,bezierLookup:'balanced'}, {...receipt,encodeMs:0},
 {...receipt,graph:{...receipt.graph,customXSegments:0}},
 {...receipt,mediaSeconds:-1},
 {...receipt,graph:{...receipt.graph,maxProbeError:NaN}},
 {...receipt,schema:'invalid'}
])assert.throws(()=>acceptABReceipt('PARACUT_BENCH_JSON '+
 JSON.stringify(record),'linear'),/A\/B/);
assert.throws(()=>acceptABReceipt('not a receipt','linear'),/A\/B/);
const opts={scenario:'v2-bezier-stress',quality:'balanced',duration:3,repeats:2};
const runs=[
 {mode:'linear',repeat:1,encodeMs:2600,totalMs:2800,graph:receipt.graph,framesMatch:true},
 {mode:'balanced',repeat:1,encodeMs:1700,totalMs:1900,graph:receipt.graph,framesMatch:true},
 {mode:'balanced',repeat:2,encodeMs:1900,totalMs:2100,graph:receipt.graph,framesMatch:true},
 {mode:'linear',repeat:2,encodeMs:2400,totalMs:2600,graph:receipt.graph,framesMatch:true}
];
const report=summarizeAB(opts,runs);
assert.equal(report.schema,AB_SCHEMA);
assert.equal(report.metrics.linear.medianEncodeMs,2500);
assert.equal(report.metrics.balanced.medianEncodeMs,1800);
assert.equal(report.balancedSpeedRatio,1.3889);
assert.equal(report.pairedVideoFramesMatch,true);
assert.match(formatABReport(report),/1\.39x/);
const mismatch=summarizeAB(opts,runs.map(r=>r.repeat===2?{...r,framesMatch:false}:r));
assert.equal(mismatch.pairedVideoFramesMatch,false);
assert.match(formatABReport(mismatch),/NO; inspect output differences/);
assert.throws(()=>summarizeAB(opts,runs.slice(1)),/result set/);
assert.throws(()=>summarizeAB(opts,[...runs.slice(0,3),runs[0]]),/Incomplete/);
assert.throws(()=>summarizeAB(opts,runs.map(r=>({...r,framesMatch:undefined}))),/parity/);

const exporter=new URL('./studio-export-local.mjs',import.meta.url).pathname;
const abCli=new URL('./studio-export-ab.mjs',import.meta.url).pathname;
const usage=spawnSync(process.execPath,[exporter,'--help'],{encoding:'utf8'});
assert.equal(usage.status,0);
assert.match(usage.stdout,/--bezier-lookup balanced\|linear/);
const invalidMode=spawnSync(process.execPath,[exporter,
 '--draft','not-real.json','--media-dir','missing','--out','none.mp4',
 '--bezier-lookup','unsafe'],{encoding:'utf8'});
assert.equal(invalidMode.status,1);
assert.match(invalidMode.stderr,/lookup mode/);
const abHelp=spawnSync(process.execPath,[abCli,'--help'],{encoding:'utf8'});
assert.equal(abHelp.status,0);
assert.match(abHelp.stdout,/identical synthetic media/);
const folder=mkdtempSync(join(tmpdir(),'paracut-r78-smoke-'));
try{
 const dest=join(folder,'reserved.json');
 writeFileSync(dest,'DO NOT OVERWRITE');
 const denied=spawnSync(process.execPath,[abCli,'--report',dest],{encoding:'utf8'});
 assert.equal(denied.status,1);
 assert.match(denied.stderr,/refusing overwrite/);
 assert.equal(readFileSync(dest,'utf8'),'DO NOT OVERWRITE');
}finally{rmSync(folder,{force:true,recursive:true});}
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
assert.match(html,/R7\.(?:8 · CONTROLLED A\/B|9 · EXPORT DIAGNOSTICS)|R8\.(?:0 · CREATIVE TITLE DECK|1 · TITLE TIMING LAB|2 · TITLE MOTION|3 · MOTION CURVES|4 · DIRECT TITLE PLACEMENT|5 · VISUAL TITLE TRANSFORMS)/);
console.log('ParaCut R7.8 PASS: same-fit baseline, safe explicit mode, paired alternating A/B, decoded frame parity reporting, old projects and no-overwrite.');
