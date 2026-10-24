#!/usr/bin/env node
// R7.8 controlled local A/B. One synthetic draft, same footage/settings,
// alternating old sequential and new balanced FFmpeg lookup compilers.
// No real user media, shell execution, telemetry, or implicit report saving.
import {mkdtemp,rm,stat,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildLabDraft} from './studio-export-lab-core.mjs';
import {parseABArgs,scheduleAB,acceptABReceipt,summarizeAB,formatABReport}
 from './studio-export-ab-core.mjs';

const cli=fileURLToPath(new URL('./studio-export-local.mjs',import.meta.url));
const HELP=[
  'ParaCut R7.8 controlled synthetic FFmpeg Bézier lookup A/B',
  'node scripts/studio-export-ab.mjs [--duration 3] [--repeats 2]',
  '  [--quality balanced] [--scenario v2-bezier-stress]',
  '  [--report ./ab-results.json] [--ffmpeg ffmpeg] [--ffprobe ffprobe]',
  'Compare old sequential vs balanced lookup on identical synthetic media',
  'and identical validated Bézier points; each output is verified H264/AAC.',
  'Checks the decoded video frames for exact hash equality. Requires real FFmpeg.',
  'No media uploads; results printed locally. Report opt-in/no overwrite.'
].join('\n');
function run(executable,args,timeoutMs=600000){
  return new Promise((resolveResult,reject)=>{
    const child=spawn(executable,args,{
      shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']
    });
    let stdout='',stderr='',complete=false;
    const timer=setTimeout(()=>child.kill(),timeoutMs);
    const settle=(error,result)=>{
      if(complete)return;
      complete=true;clearTimeout(timer);
      if(error)reject(error);else resolveResult(result);
    };
    child.stdout.on('data',chunk=>{
      stdout+=String(chunk);
      if(stdout.length>150000){
        child.kill();settle(Error('Export A/B output exceeded safety limit.'));
      }
    });
    child.stderr.on('data',chunk=>{stderr=(stderr+String(chunk)).slice(-12000);});
    child.once('error',error=>settle(Error('Unable to launch local tool: '+error.message)));
    child.once('close',(code,signal)=>{
      if(code!==0)settle(Error('Local A/B tool failed ('+(signal||code)+'): '+
        stderr.slice(-2400)));
      else settle(null,{stdout,stderr});
    });
  });
}
async function frameDigest(ffmpeg,file){
  // FFmpeg's framemd5 hashes decoded pixel planes, not container metadata.
  // This is stronger than comparing the bytes of two separately muxed MP4s.
  const result=await run(ffmpeg,[
    '-hide_banner','-loglevel','error','-nostdin',
    '-i',file,'-map','0:v:0','-f','framemd5','-'
  ],120000);
  if(!result.stdout.includes('#format: frame checksums')&&
    !result.stdout.includes('#format: frame checksums, version'))
    throw Error('No valid decoded frame checksum stream.');
  return createHash('sha256').update(result.stdout.replace(/\r\n/g,'\n')).digest('hex');
}
async function main(){
  const opts=parseABArgs(process.argv.slice(2));
  if(opts.help){console.log(HELP);return;}
  const report=opts.report?resolve(opts.report):null;
  if(report&&existsSync(report))throw Error('Report exists: refusing overwrite '+report);
  const folder=await mkdtemp(join(tmpdir(),'paracut-ab-r78-'));
  try{
    // Exactly one synthetic media fixture set and one project draft for all
    // A/B renders. Shared source files are immutable for the duration of test.
    const fixtures=[
      {name:'lab-main.mp4',args:[
        '-f','lavfi','-i','testsrc2=size=640x360:rate=30:duration='+opts.duration,
        '-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration='+opts.duration,
        '-c:v','mpeg4','-q:v','5','-pix_fmt','yuv420p',
        '-c:a','aac','-b:a','128k','-shortest','-movflags','+faststart']},
      {name:'lab-overlay.mp4',args:[
        '-f','lavfi','-i','color=c=red:s=640x360:r=30:d='+opts.duration,
        '-c:v','mpeg4','-q:v','4','-pix_fmt','yuv420p','-an']}
    ];
    console.log('Preparing synthetic A/B fixtures. Real personal media is not read.');
    for(const fixture of fixtures)
      await run(opts.ffmpeg,['-hide_banner','-loglevel','error','-nostdin',
        '-n',...fixture.args,join(folder,fixture.name)],120000);
    const mainBytes=(await stat(join(folder,'lab-main.mp4'))).size;
    const overlayBytes=(await stat(join(folder,'lab-overlay.mp4'))).size;
    const draft=join(folder,'shared-project.json');
    await writeFile(draft,buildLabDraft({
      duration:opts.duration,scenario:opts.scenario,mainBytes,overlayBytes
    }),{flag:'wx'});
    const runs=[],outputs=new Map(),hashes=new Map();
    for(const {repeat,mode} of scheduleAB(opts.repeats)){
      const file=join(folder,'ab-'+repeat+'-'+mode+'.mp4');
      console.log('Pair '+repeat+'/'+opts.repeats+' · '+mode+' lookup · '+opts.quality);
      const result=await run(process.execPath,[
        cli,'--draft',draft,'--media-dir',folder,'--out',file,
        '--quality',opts.quality,'--ffmpeg',opts.ffmpeg,'--ffprobe',opts.ffprobe,
        '--bezier-lookup',mode,'--benchmark-json'
      ]);
      const receipts=result.stdout.split(/\r?\n/).filter(
        line=>line.startsWith('PARACUT_BENCH_JSON '));
      if(receipts.length!==1)
        throw Error('A/B export did not emit exactly one verified benchmark receipt.');
      const benchmark=acceptABReceipt(receipts[0],mode);
      if(Math.abs(benchmark.mediaSeconds-opts.duration)>0.01||
        benchmark.graph.customXSegments<1)
        throw Error('A/B export lacks the expected synthetic Bézier workload.');
      const digest=await frameDigest(opts.ffmpeg,file);
      outputs.set(repeat+':'+mode,file);
      hashes.set(repeat+':'+mode,digest);
      runs.push({
        mode,repeat,mediaSeconds:benchmark.mediaSeconds,
        encodeMs:benchmark.encodeMs,totalMs:benchmark.totalMs,graph:benchmark.graph
      });
    }
    for(let repeat=1;repeat<=opts.repeats;repeat++){
      const match=hashes.get(repeat+':linear')===
        hashes.get(repeat+':balanced');
      for(const row of runs)if(row.repeat===repeat)row.framesMatch=match;
    }
    const summary=summarizeAB(opts,runs);
    console.log('\n'+formatABReport(summary));
    if(report){
      // Exclusive creation also protects against races since the initial
      // existence check. No paths, generated media or personal metadata saved.
      await writeFile(report,JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
      console.log('Explicit local A/B report saved.');
    }
  }finally{
    await rm(folder,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error('ParaCut export A/B:',error.message);process.exitCode=1;});
