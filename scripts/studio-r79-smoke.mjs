import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {summarizeAB,formatABReport,AB_SCHEMA}
 from './studio-export-ab-core.mjs';
import {summarizeLab,LAB_SCHEMA} from './studio-export-lab-core.mjs';
import {DIAGNOSTICS_SCHEMA,diagnoseABRuns,diagnoseSavedReport,formatDiagnostics}
 from './studio-export-diagnostics-core.mjs';

const opts={scenario:'v2-bezier-stress',quality:'balanced',duration:3,repeats:2};
const graph={filterGraphChars:4400,customXSegments:4,
 optimizedPieces:75,previousFixedPieces:256,maxProbeError:.001};
const runs=[
 {mode:'linear',repeat:1,probeMs:90,planMs:20,encodeMs:2500,
  verifyMs:60,totalMs:2800,framesMatch:true,graph},
 {mode:'balanced',repeat:1,probeMs:92,planMs:21,encodeMs:2200,
  verifyMs:63,totalMs:2510,framesMatch:true,graph},
 {mode:'balanced',repeat:2,probeMs:98,planMs:19,encodeMs:2100,
  verifyMs:65,totalMs:2430,framesMatch:true,graph},
 {mode:'linear',repeat:2,probeMs:95,planMs:22,encodeMs:2300,
  verifyMs:70,totalMs:2640,framesMatch:true,graph}
];
const diagnosed=diagnoseABRuns(opts,runs);
assert.equal(diagnosed.schema,DIAGNOSTICS_SCHEMA);
assert.equal(diagnosed.kind,'controlled-ab');
assert.equal(diagnosed.priority,'repeat-under-controlled-conditions');
assert.equal(diagnosed.parityVerified,true);
assert.equal(diagnosed.ratioDirection,'balanced');
assert.equal(diagnosed.pairs.length,2);
assert.equal(diagnosed.pairs[0].oldOverBalanced,1.1364);
assert.equal(diagnosed.pairs[1].oldOverBalanced,1.0952);
assert.ok(diagnosed.stageBreakdown.balanced.medianEncodeShare>.8);
assert.equal(diagnosed.stageBreakdown.balanced.largestMeasuredPhase,'encodeMs');
assert.match(formatDiagnostics(diagnosed),/Pair 1 old\/new encode/);
assert.match(formatDiagnostics(diagnosed),/probe .*plan .*encode .*verify/);

const report=summarizeAB(opts,runs);
assert.equal(report.schema,AB_SCHEMA);
assert.deepEqual(report.diagnostics,diagnosed);
assert.equal(report.diagnosticSamples.length,4);
assert.equal(report.diagnosticSamples[0].mode,'linear');
assert.equal(report.diagnosticSamples[0].probeMs,90);
assert.deepEqual(diagnoseSavedReport(JSON.parse(JSON.stringify(report))),diagnosed);
assert.match(formatABReport(report),/ParaCut R7\.9 Export Diagnostics Inspector/);
assert.equal(JSON.stringify(report).includes('tmp/'),false);
assert.equal(JSON.stringify(report).includes('lab-main'),false);
// A historical R7.8 aggregate can be interpreted, not reverse-engineered.
const legacy={...report};
delete legacy.diagnosticSamples;
assert.equal(diagnoseSavedReport(legacy).kind,'legacy-ab');
assert.equal(diagnoseSavedReport(legacy).priority,'rerun-with-stage-records');
assert.match(formatDiagnostics(diagnoseSavedReport(legacy)),
 /Aggregate-only historical report/);

const mismatch=runs.map(r=>r.repeat===2?{...r,framesMatch:false}:r);
const mismatchDiag=diagnoseABRuns(opts,mismatch);
assert.equal(mismatchDiag.priority,'inspect-frame-parity');
assert.equal(mismatchDiag.parityVerified,false);
assert.match(formatDiagnostics(mismatchDiag),/MISMATCH/);
assert.equal(diagnoseSavedReport(summarizeAB(opts,mismatch)).parityVerified,false);
const tampered=JSON.parse(JSON.stringify(report));
tampered.metrics.linear.medianEncodeMs=1200;
assert.throws(()=>diagnoseSavedReport(tampered),/conflicts/);
const forgedParity=JSON.parse(JSON.stringify(report));
forgedParity.pairedVideoFramesMatch=false;
assert.throws(()=>diagnoseSavedReport(forgedParity),/conflicts/);

const stable3={...opts,repeats:3};
const pair3=[
 {mode:'linear',repeat:3,probeMs:100,planMs:20,encodeMs:2400,
  verifyMs:70,totalMs:2660,framesMatch:true,graph},
 {mode:'balanced',repeat:3,probeMs:102,planMs:18,encodeMs:2150,
  verifyMs:65,totalMs:2470,framesMatch:true,graph}
];
const more=diagnoseABRuns(stable3,[...runs,...pair3]);
assert.equal(more.priority,'confirm-with-longer-fixtures');
const noisy=diagnoseABRuns(stable3,[...runs,
 {...pair3[0],encodeMs:1700},{...pair3[1],encodeMs:2450,totalMs:2900}]);
assert.equal(noisy.priority,'repeat-under-controlled-conditions');
assert.equal(noisy.ratioDirection,'mixed');

const overhead=[
 {mode:'linear',repeat:1,probeMs:600,planMs:600,encodeMs:300,
  verifyMs:300,totalMs:2000,framesMatch:true,graph},
 {mode:'balanced',repeat:1,probeMs:600,planMs:600,encodeMs:250,
  verifyMs:300,totalMs:2000,framesMatch:true,graph},
 {mode:'balanced',repeat:2,probeMs:600,planMs:600,encodeMs:250,
  verifyMs:300,totalMs:2000,framesMatch:true,graph},
 {mode:'linear',repeat:2,probeMs:600,planMs:600,encodeMs:300,
  verifyMs:300,totalMs:2000,framesMatch:true,graph},
 {mode:'linear',repeat:3,probeMs:600,planMs:600,encodeMs:300,
  verifyMs:300,totalMs:2000,framesMatch:true,graph},
 {mode:'balanced',repeat:3,probeMs:600,planMs:600,encodeMs:250,
  verifyMs:300,totalMs:2000,framesMatch:true,graph}
];
assert.equal(diagnoseABRuns(stable3,overhead).priority,'inspect-nonencode-overhead');
const tied=overhead.map(r=>({...r,probeMs:100,planMs:100,
 encodeMs:1000,totalMs:1300,verifyMs:100}));
assert.equal(diagnoseABRuns(stable3,tied).priority,'optimize-other-stage');
for(const input of [
 runs.slice(1),
 runs.map(r=>({...r,framesMatch:undefined})),
 runs.map((r,i)=>i? r:{...r,probeMs:-1}),
 runs.map((r,i)=>i? r:{...r,planMs:undefined}),
 runs.map((r,i)=>i? r:{...r,totalMs:r.encodeMs-1}),
 runs.map((r,i)=>i? r:{...r,verifyMs:Infinity}),
 runs.map((r,i)=>i? r:{...r,probeMs:9000})
])assert.throws(()=>diagnoseABRuns(opts,input),/A\/B/);

// Pre-R7.9 summaries omit detailed phase measurements and remain accepted.
const thin=runs.map(({probeMs,planMs,verifyMs,...rest})=>rest);
const old=summarizeAB(opts,thin);
assert.equal(Object.hasOwn(old,'diagnosticSamples'),false);
assert.equal(old.diagnostics.stageBreakdown,null);

const labOptions={duration:3,repeats:1,
 scenarios:['v1','v2-bezier'],qualities:['balanced']};
const lab=summarizeLab(labOptions,[
 {scenario:'v1',quality:'balanced',repeat:1,encodeMs:1600,totalMs:2200,
  mediaSeconds:3,graph},
 {scenario:'v2-bezier',quality:'balanced',repeat:1,encodeMs:2400,totalMs:2800,
  mediaSeconds:3,graph}
]);
assert.equal(lab.schema,LAB_SCHEMA);
const labDiagnosis=diagnoseSavedReport(lab);
assert.equal(labDiagnosis.kind,'scenario-lab');
assert.equal(labDiagnosis.priority,'run-controlled-ab');
assert.match(formatDiagnostics(labDiagnosis),/not the same curve/);
assert.throws(()=>diagnoseSavedReport({schema:'unknown'}),/Unsupported/);
assert.throws(()=>diagnoseSavedReport({
 ...lab,cells:[{scenario:'v1',quality:'balanced',medianEncodeMs:NaN,
 medianTotalMs:1}]
}),/Invalid saved/);
assert.throws(()=>formatDiagnostics({schema:'invalid'}),/Invalid/);

// CLI is read-only: existing fixtures are unchanged; no FFmpeg or media used.
const cli=new URL('./studio-export-diagnose.mjs',import.meta.url).pathname;
const help=spawnSync(process.execPath,[cli,'--help'],{encoding:'utf8'});
assert.equal(help.status,0);
assert.match(help.stdout,/read-only/);
const badArgs=spawnSync(process.execPath,[cli,'--output','wrong.json'],
 {encoding:'utf8'});
assert.equal(badArgs.status,1);
assert.match(badArgs.stderr,/exactly one --input/);
const temp=mkdtempSync(join(tmpdir(),'paracut-r79-smoke-'));
try{
 const path=join(temp,'report.json');
 const fixture=JSON.stringify(report,null,2);
 writeFileSync(path,fixture);
 const inspected=spawnSync(process.execPath,[cli,'--input',path],
  {encoding:'utf8'});
 assert.equal(inspected.status,0);
 assert.match(inspected.stdout,/Pair 2 old\/new/);
 assert.equal(readFileSync(path,'utf8'),fixture);
 const legacyPath=join(temp,'legacy.json');
 writeFileSync(legacyPath,JSON.stringify(legacy));
 const legacyOutput=spawnSync(process.execPath,[cli,'--input',legacyPath],
  {encoding:'utf8'});
 assert.equal(legacyOutput.status,0);
 assert.match(legacyOutput.stdout,/Aggregate-only historical/);
 const labPath=join(temp,'lab.json');
 writeFileSync(labPath,JSON.stringify(lab));
 const labOutput=spawnSync(process.execPath,[cli,'--input',labPath],
  {encoding:'utf8'});
 assert.equal(labOutput.status,0);
 assert.match(labOutput.stdout,/scenario-lab/);
 const badPath=join(temp,'broken.json');
 writeFileSync(badPath,'{{');
 const malformed=spawnSync(process.execPath,[cli,'--input',badPath],
  {encoding:'utf8'});
 assert.equal(malformed.status,1);
 assert.match(malformed.stderr,/not valid UTF-8 JSON/);
}finally{rmSync(temp,{recursive:true,force:true});}

const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
assert.match(html,/(?:R7\.9 · EXPORT DIAGNOSTICS|R8\.(?:0 · CREATIVE TITLE DECK|1 · TITLE TIMING LAB|2 · TITLE MOTION|3 · MOTION CURVES|4 · DIRECT TITLE PLACEMENT|5 · VISUAL TITLE TRANSFORMS))/);
console.log('ParaCut R7.9 PASS: conservative phase analysis, pair stability, parity gate, old/new reports, read-only CLI and no project mutation.');
