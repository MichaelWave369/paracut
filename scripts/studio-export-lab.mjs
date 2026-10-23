#!/usr/bin/env node
// Synthetic, local-only, opt-in real FFmpeg throughput experiments.
// All fixture media and MP4 outputs live inside one fresh temporary folder.
import {mkdtemp,rm,stat,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {parseLabOptions,LAB_SCENARIOS,LAB_QUALITIES,buildLabDraft,
  acceptBenchReceipt,summarizeLab,formatLabReport} from './studio-export-lab-core.mjs';

const HELP=[
 'ParaCut R7.5 Export Performance Lab: generates its own short synthetic footage.',
 'node scripts/studio-export-lab.mjs [--duration 3] [--repeats 1]',
 '  [--qualities compact,balanced] [--scenarios v1,v2-static,v2-bezier]',
 '  [--report ./result.json] [--ffmpeg /path/to/ffmpeg] [--ffprobe /path/to/ffprobe]',
 'Options: duration 2–10s; repeats 1–3; quality compact|balanced|high.',
 'Report is opt-in and refuses overwrite. Temporary footage and MP4s are removed.',
 'A real local FFmpeg with x264/AAC and required filters is needed; no cloud calls.'
].join('\n');
const cli=fileURLToPath(new URL('./studio-export-local.mjs',import.meta.url));
async function processCommand(exe,args,{maxOutput=100000,timeoutMs=300000}={}){
  return new Promise((ok,fail)=>{
    const child=spawn(exe,args,{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='',settled=false;
    const timer=setTimeout(()=>child.kill(),timeoutMs);
    function settle(error,response){
      if(settled)return;
      settled=true;clearTimeout(timer);
      if(error)fail(error);else ok(response);
    }
    child.stdout.on('data',chunk=>{
      stdout+=String(chunk);
      if(stdout.length>maxOutput){child.kill();settle(Error('Lab child stdout exceeded safety limit.'));}
    });
    child.stderr.on('data',chunk=>{
      stderr=(stderr+String(chunk)).slice(-12000);
    });
    child.once('error',err=>settle(Error('Local tool could not launch: '+err.message)));
    child.once('close',(code,signal)=>{
      if(code!==0)settle(Error('Local tool failed ('+(signal||code)+'): '+
        stderr.slice(-1800)));
      else settle(null,{stdout,stderr});
    });
  });
}
async function main(){
  const opts=parseLabOptions(process.argv.slice(2));
  if(opts.help){console.log(HELP);return;}
  const report=opts.report?resolve(opts.report):null;
  if(report&&existsSync(report))
    throw Error('Report exists: refusing overwrite '+report);
  const directory=await mkdtemp(join(tmpdir(),'paracut-lab-r75-'));
  const started=performance.now();
  try{
    console.log('Generating synthetic footage locally; no personal videos are read.');
    const sources=[
      {name:'lab-main.mp4',args:[
        '-f','lavfi','-i','testsrc2=size=640x360:rate=30:duration='+opts.duration,
        '-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration='+opts.duration,
        '-c:v','mpeg4','-q:v','5','-pix_fmt','yuv420p',
        '-c:a','aac','-b:a','128k','-shortest','-movflags','+faststart']},
      {name:'lab-overlay.mp4',args:[
        '-f','lavfi','-i','color=c=red:s=640x360:r=30:d='+opts.duration,
        '-c:v','mpeg4','-q:v','4','-pix_fmt','yuv420p','-an']}
    ];
    for(const source of sources){
      await processCommand(opts.ffmpeg,[
        '-hide_banner','-loglevel','error','-nostdin','-n',
        ...source.args,join(directory,source.name)
      ]);
    }
    const mainBytes=(await stat(join(directory,'lab-main.mp4'))).size;
    const overlayBytes=(await stat(join(directory,'lab-overlay.mp4'))).size;
    const drafts=new Map();
    for(const scenario of opts.scenarios){
      const file=join(directory,'draft-'+scenario+'.json');
      await writeFile(file,buildLabDraft({
        duration:opts.duration,scenario,mainBytes,overlayBytes
      }),{flag:'wx'});
      drafts.set(scenario,file);
    }
    const runs=[];
    for(const scenario of opts.scenarios)for(const quality of opts.qualities)
      for(let repeat=1;repeat<=opts.repeats;repeat++){
        console.log('Export '+scenario+' / '+quality+' / repeat '+repeat+
          ' of '+opts.repeats);
        const output=join(directory,'render-'+scenario+'-'+quality+'-'+repeat+'.mp4');
        const result=await processCommand(process.execPath,[
          cli,'--draft',drafts.get(scenario),'--media-dir',directory,
          '--out',output,'--quality',quality,'--ffmpeg',opts.ffmpeg,
          '--ffprobe',opts.ffprobe,'--benchmark-json'
        ],{timeoutMs:600000});
        const marker=result.stdout.split(/\r?\n/).filter(line=>
          line.startsWith('PARACUT_BENCH_JSON '));
        if(marker.length!==1)
          throw Error('Expected exactly one verified local export benchmark receipt.');
        const record=acceptBenchReceipt(marker[0]);
        // Retain only measured metrics and scenario selectors. No paths, IDs,
        // source file names or output movie names are persisted in the report.
        runs.push({scenario,quality,repeat,mediaSeconds:record.mediaSeconds,
          probeMs:record.probeMs,planMs:record.planMs,
          encodeMs:record.encodeMs,verifyMs:record.verifyMs,
          totalMs:record.totalMs,graph:record.graph});
      }
    const summary=summarizeLab(opts,runs);
    const reportBody={...summary,labWallMs:performance.now()-started};
    console.log('\n'+formatLabReport(summary));
    if(report){
      // Atomic exclusive creation; still refuses overwrite if a file appears
      // during this run. The synthetic media stays in temporary storage only.
      await writeFile(report,JSON.stringify(reportBody,null,2)+'\n',{flag:'wx'});
      console.log('Report saved to the explicitly requested local JSON destination.');
    }
  } finally{
    await rm(directory,{recursive:true,force:true});
  }
}
main().catch(e=>{console.error('ParaCut export lab:',e.message);process.exitCode=1;});
