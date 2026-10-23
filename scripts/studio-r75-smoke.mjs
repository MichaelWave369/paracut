import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync,writeFileSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {importDraft,validate} from '../apps/desktop/public/studio-core.js';
import {graphDiagnostics} from './studio-export-benchmark.mjs';
import {planLocalMp4} from './studio-local-export-core.mjs';
import {LAB_QUALITIES,LAB_SCENARIOS,LAB_SCHEMA,BENCH_SCHEMA,
 parseLabOptions,buildLabDraft,acceptBenchReceipt,summarizeLab,formatLabReport}
 from './studio-export-lab-core.mjs';

const defaults=parseLabOptions([]);
assert.deepEqual(defaults.qualities,['compact','balanced']);
assert.deepEqual(defaults.scenarios,LAB_SCENARIOS);
assert.deepEqual(LAB_QUALITIES,['compact','balanced','high']);
assert.equal(defaults.duration,3);
assert.equal(defaults.repeats,1);
assert.deepEqual(parseLabOptions(['--duration','7','--repeats','3',
 '--qualities','high,compact','--scenarios','v2-bezier,v1']).scenarios,
 ['v2-bezier','v1']);
assert.deepEqual(parseLabOptions(['--help']),{help:true});
for(const args of [
 ['--duration','0'],['--duration','11'],['--duration','5.5'],
 ['--repeats','0'],['--repeats','4'],['--repeats','2.5'],
 ['--qualities','danger'],['--qualities','compact,compact'],
 ['--scenarios','v1,v1'],['--scenarios','v3'],
 ['--report','output.txt'],['--report',''],['--ffmpeg',''],
 ['--unknown','x'],['--repeats','1','--repeats','2'],
 ['--repeats'],['--duration','NaN']
])assert.throws(()=>parseLabOptions(args),/lab|option|executable/);

const valid=buildLabDraft({duration:3,scenario:'v2-bezier',
 mainBytes:12345,overlayBytes:321});
const parsed=importDraft(valid);
assert.equal(validate(parsed),true);
assert.equal(parsed.clips.length,1);
assert.equal(parsed.video2Clips.length,1);
assert.equal(parsed.video2Clips[0].opacity_keyframe_points[0].ease,'bezier');
assert.deepEqual(parsed.video2Clips[0].opacity_keyframe_points[0].handles_x,[.1,.77]);
const flat=importDraft(buildLabDraft({duration:3,scenario:'v2-static',
 mainBytes:12345,overlayBytes:321}));
assert.equal(flat.video2Clips.length,1);
assert.equal(flat.video2Clips[0].opacity_keyframe_points,undefined);
const v1=importDraft(buildLabDraft({duration:3,scenario:'v1',
 mainBytes:12345,overlayBytes:321}));
assert.equal(v1.video2Clips.length,0);
for(const bad of [
 {duration:1,scenario:'v1',mainBytes:5,overlayBytes:2},
 {duration:3,scenario:'v3',mainBytes:5,overlayBytes:2},
 {duration:3,scenario:'v1',mainBytes:-1,overlayBytes:2},
 {duration:3,scenario:'v1',mainBytes:5,overlayBytes:NaN}
])assert.throws(()=>buildLabDraft(bad),/fixture/);
for(const state of [v1,flat,parsed]){
 const linked=Object.fromEntries(state.assets.map(a=>[a.asset_id,
  {path:'/tmp/'+a.name,hasAudio:a.asset_id==='lab-main'}]));
 const plan=planLocalMp4(state,linked,'/tmp/lab.mp4');
 assert.ok(plan.graph.length>0);
 const metrics=graphDiagnostics(state,plan.graph);
 assert.equal(metrics.customXSegments,state===parsed?1:0);
 if(state===parsed)assert.ok(metrics.optimizedPieces>0&&metrics.optimizedPieces<=64);
}
const bench={schema:BENCH_SCHEMA,mediaSeconds:3,probeMs:100,planMs:10,
 encodeMs:2400,verifyMs:30,totalMs:2700,
 graph:{filterGraphChars:1100,customXSegments:1,optimizedPieces:12,
 previousFixedPieces:64,maxProbeError:.0012}};
const read=acceptBenchReceipt('PARACUT_BENCH_JSON '+JSON.stringify(bench));
assert.deepEqual(read,bench);
for(const line of [
 'fake','PARACUT_BENCH_JSON x',
 'PARACUT_BENCH_JSON '+JSON.stringify({...bench,schema:'evil'}),
 'PARACUT_BENCH_JSON '+JSON.stringify({...bench,encodeMs:-1}),
 'PARACUT_BENCH_JSON '+JSON.stringify({...bench,graph:null}),
 'PARACUT_BENCH_JSON '+JSON.stringify({...bench,mediaSeconds:0})
])assert.throws(()=>acceptBenchReceipt(line),/receipt/);

const opts={duration:3,repeats:3,qualities:['compact','balanced'],
 scenarios:['v2-static','v2-bezier']};
const runs=[];
for(const scenario of opts.scenarios)for(const quality of opts.qualities)
 for(let repeat=1;repeat<=3;repeat++)
  runs.push({scenario,quality,repeat,mediaSeconds:3,
   encodeMs:quality==='compact'?
     (scenario==='v2-static'?1000+repeat*100:2000+repeat*100):
     (scenario==='v2-static'?2000+repeat*100:3000+repeat*100),
   totalMs:4000+repeat*100,graph:{...bench.graph}});
const summary=summarizeLab(opts,runs);
assert.equal(summary.schema,LAB_SCHEMA);
assert.equal(summary.synthetic,true);
assert.equal(summary.cells.length,4);
assert.equal(summary.comparisons.length,2);
assert.equal(summary.cells[0].medianEncodeMs,1200);
assert.equal(summary.cells[0].realtimeFactor,2.5);
assert.equal(summary.comparisons[0].animatedVsStatic,Number((2200/1200).toFixed(3)));
assert.match(formatLabReport(summary),/v2-bezier \| balanced/);
assert.match(formatLabReport(summary),/Synthetic workloads are not isolated/);
assert.throws(()=>summarizeLab(opts,runs.slice(1)),/Incomplete/);
assert.throws(()=>summarizeLab(opts,[...runs,runs[0]]),/Invalid|Unexpected/);

// CLI contracts require no FFmpeg installation, media, network or actual render.
const cli=new URL('./studio-export-lab.mjs',import.meta.url).pathname;
const out=spawnSync(process.execPath,[cli,'--help'],{encoding:'utf8'});
assert.equal(out.status,0);
assert.match(out.stdout,/synthetic footage/);
const invalid=spawnSync(process.execPath,[cli,'--duration','50'],{encoding:'utf8'});
assert.equal(invalid.status,1);
assert.match(invalid.stderr,/duration/);
const folder=mkdtempSync(join(tmpdir(),'paracut-r75-smoke-'));
try{
 const dest=join(folder,'existing.json');
 writeFileSync(dest,'DO NOT TOUCH');
 const blocked=spawnSync(process.execPath,[cli,'--report',dest],{encoding:'utf8'});
 assert.equal(blocked.status,1);
 assert.match(blocked.stderr,/refusing overwrite/);
 assert.equal(readFileSync(dest,'utf8'),'DO NOT TOUCH');
 assert.equal(statSync(dest).size,12);
}finally{rmSync(folder,{recursive:true,force:true});}
const exporter=new URL('./studio-export-local.mjs',import.meta.url).pathname;
const usage=spawnSync(process.execPath,[exporter,'--help'],{encoding:'utf8'});
assert.equal(usage.status,0);
assert.match(usage.stdout,/--benchmark-json/);
const blockedDry=spawnSync(process.execPath,[exporter,
 '--draft','missing.json','--media-dir','missing','--out','absent.mp4',
 '--benchmark-json','--dry-run'],{encoding:'utf8'});
assert.equal(blockedDry.status,1);
assert.match(blockedDry.stderr,/cannot be used with --dry-run/);
const readme=readFileSync(new URL('../README.md',import.meta.url),'utf8');
assert.match(readme,/R7\.5/);
console.log('ParaCut R7.5 PASS: synthetic fixture schema, real render plans, receipt validation, comparable medians, local-only CLI, and no-overwrite report.');
