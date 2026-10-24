#!/usr/bin/env node
// Opt-in local renderer for ParaCut Studio browser drafts.
// No servers, hidden network calls, or shell interpolation.
import { readFile, readdir, stat, writeFile, mkdtemp, rm, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname, basename, isAbsolute, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import {graphDiagnostics,renderBenchmarkReport} from './studio-export-benchmark.mjs';
import {validateBezierLookup} from '../apps/desktop/public/studio-keyframe-points.js';
import { importDraft } from '../apps/desktop/public/studio-core.js';
import { planLocalMp4, shellPreview } from './studio-local-export-core.mjs';

function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('ParaCut local MP4:\nnode scripts/studio-export-local.mjs --draft cut.json --media-dir ./sources --out ./movie.mp4 [--dry-run]\nOptional: --media-map paths.json --ffmpeg /path/to/ffmpeg --ffprobe /path/to/ffprobe --quality compact|balanced|high --audio-protect --benchmark --benchmark-json --bezier-lookup balanced|linear');
    process.exit(0);
  }
  const opt={},known=new Set(['--draft','--media-dir','--out','--media-map','--ffmpeg','--ffprobe','--quality','--bezier-lookup']);
  for (let i=0;i<argv.length;i++) {
    if(argv[i]==='--dry-run'){opt.dryRun=true;continue;}
    if(argv[i]==='--audio-protect'){opt.protectAudio=true;continue;}
    if(argv[i]==='--benchmark'){opt.benchmark=true;continue;}
    if(argv[i]==='--benchmark-json'){opt.benchmarkJson=true;continue;}
    const key=argv[i];
    if(!known.has(key)||!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Unknown/missing option: '+key);
    opt[key.slice(2).replaceAll('-','_')]=argv[++i];
  }
  if(!opt.draft||!opt.out||(!opt.media_dir&&!opt.media_map))throw Error('Required: --draft, --out and --media-dir or --media-map.');
  if(opt.dryRun&&(opt.benchmark||opt.benchmarkJson))throw Error('Benchmarking measures a real encode and cannot be used with --dry-run.');
  validateBezierLookup(opt.bezier_lookup??'balanced');
  return opt;
}
function probe(file,executable) {
  const p=spawnSync(executable,['-v','error','-show_entries',
    'format=duration,format_name:stream=codec_type,codec_name','-of','json',file],
    {encoding:'utf8',timeout:20_000,maxBuffer:1024*1024,windowsHide:true});
  if(p.error)throw Error('ffprobe failed for '+basename(file)+': '+p.error.message);
  if(p.status!==0)throw Error('ffprobe cannot read '+basename(file)+': '+(p.stderr||'bad media'));
  try{return JSON.parse(p.stdout)}catch{throw Error('Invalid ffprobe result for '+basename(file));}
}
async function relink(state,opt) {
  const dir=opt.media_dir?resolve(opt.media_dir):null;
  const mapPath=opt.media_map?resolve(opt.media_map):null;
  const map=mapPath?JSON.parse(await readFile(mapPath,'utf8')):{};
  if(!map||typeof map!=='object'||Array.isArray(map))throw Error('Media map must be an object keyed by asset ID.');
  const names=dir?await readdir(dir):[],out={};
  const wanted=new Set([...state.clips,...state.audioClips,...state.video2Clips,...state.audio2Clips].map(c=>c.asset_id));
  for(const a of state.assets.filter(x=>wanted.has(x.asset_id))) {
    let path;
    if(Object.hasOwn(map,a.asset_id)) {
      const given=map[a.asset_id];
      if(typeof given!=='string'||!given.trim())throw Error('Invalid path for asset '+a.asset_id);
      path=isAbsolute(given)?given:resolve(dirname(mapPath),given);
    } else {
      if(!dir||names.filter(n=>n===a.name).length!==1)
        throw Error('Cannot match source '+a.name+'. Use --media-map to specify the path.');
      path=join(dir,a.name);
    }
    path=resolve(path);
    const info=await stat(path);
    if(!info.isFile()||info.size!==a.size)
      throw Error('Media byte-size mismatch for '+a.name+'. Use the exact original.');
    if(path===resolve(opt.out))throw Error('Input media must not equal the output.');
    const metadata=probe(path,opt.ffprobe||'ffprobe');
    const kind=a.type.startsWith('video/')?'video':'audio';
    if(!metadata.streams?.some(s=>s.codec_type===kind))
      throw Error('Missing '+kind+' stream in '+a.name);
    if(metadata.format?.duration &&
       Math.abs(Number(metadata.format.duration)-a.duration)>1)
      throw Error('Duration differs from saved project for '+a.name);
    out[a.asset_id]={path,hasAudio:metadata.streams.some(s=>s.codec_type==='audio')};
  }
  return out;
}
function verify(file,ffprobe,expectedDuration) {
  const m=probe(file,ffprobe);
  if(!m.format?.format_name?.includes('mp4')||
     !m.streams?.some(s=>s.codec_type==='video'&&s.codec_name==='h264')||
     !m.streams?.some(s=>s.codec_type==='audio'&&s.codec_name==='aac'))
    throw Error('Rendered file is not verified H.264/AAC MP4.');
  if(!Number.isFinite(Number(m.format.duration))||
     Math.abs(Number(m.format.duration)-expectedDuration)>1.25)
    throw Error('Rendered movie duration differs from project.');
}
async function main() {
  const opt=parseArgs(process.argv.slice(2));
  const started=performance.now();
  const target=resolve(opt.out);
  if(extname(target).toLowerCase()!=='.mp4')throw Error('Output must end in .mp4.');
  if(existsSync(target))throw Error('Output already exists: refusing overwrite '+target);
  const state=importDraft(await readFile(resolve(opt.draft),'utf8'));
  const linked=await relink(state,opt);
  const relinkedAt=performance.now();
  const plan=planLocalMp4(state,linked,target,{ffmpeg:opt.ffmpeg||'ffmpeg',quality:opt.quality||'balanced',protectAudio:opt.protectAudio===true,bezierLookup:opt.bezier_lookup??'balanced'});
  const plannedAt=performance.now();
  const diagnostics=(opt.benchmark||opt.benchmarkJson)?graphDiagnostics(state,plan.graph):null;
  console.log('ParaCut local MP4: '+plan.videoClips+' video clips, '+plan.audioSegments+
    ' audio segments, '+plan.transitions+' V1 transitions, '+(plan.overlayClips||0)+' V2 overlays, '+(plan.overlayCrossfades||0)+' V2 transitions, '+(plan.voiceClips||0)+' A2 clips, '+plan.duration+' seconds.');
  console.log('Export quality: '+plan.quality+'; master audio protection: '+(plan.protectAudio?'ON (0.95 sample peak limiter)':'OFF')+'.');
  if(opt.dryRun) {
    console.log('DRY RUN: no file written and no encoder executed.');
    console.log(shellPreview([plan.ffmpeg,...plan.args]));
    console.log('\nFilter graph:\n'+plan.graph);
    return;
  }
  const working=await mkdtemp(join(tmpdir(),'paracut-local-'));
  let ok=false;
  try {
    await writeFile(join(working,'graph.txt'),plan.graph,'utf8');
    if(plan.ass)await writeFile(join(working,'titles.ass'),plan.ass,'utf8');
    console.log('Rendering locally:',target);
    const encodeStarted=performance.now();
    const code=await new Promise((done,fail)=>{
      const child=spawn(plan.ffmpeg,plan.args,{cwd:working,stdio:'inherit',shell:false,windowsHide:true});
      child.once('error',fail);
      child.once('close',(exit,signal)=>done({exit,signal}));
    });
    if(code.exit!==0)throw Error('FFmpeg exit '+code.exit+(code.signal?' ('+code.signal+')':''));
    const encodedAt=performance.now();
    verify(target,opt.ffprobe||'ffprobe',plan.duration);
    const verifiedAt=performance.now();
    ok=true;
    console.log('Verified local MP4:',target);
    if(opt.benchmark||opt.benchmarkJson){
      const record={mediaSeconds:plan.duration,probeMs:relinkedAt-started,
        planMs:plannedAt-relinkedAt,encodeMs:encodedAt-encodeStarted,
        verifyMs:verifiedAt-encodedAt,totalMs:verifiedAt-started,
        graph:diagnostics};
      // Validate once before either representation can be emitted.
      const report=renderBenchmarkReport(record);
      if(opt.benchmark)console.log(report);
      if(opt.benchmarkJson)console.log('PARACUT_BENCH_JSON '+JSON.stringify({
        schema:'paracut.export.benchmark.v1',bezierLookup:opt.bezier_lookup??'balanced',...record
      }));
    }
  } finally {
    await rm(working,{recursive:true,force:true});
    if(!ok&&existsSync(target))await unlink(target);
  }
}
main().catch(e=>{console.error('ParaCut local export:',e.message);process.exitCode=1;});
