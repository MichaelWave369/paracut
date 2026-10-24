// R7.8 controlled A/B reporting. Pure validated statistics, no filesystem,
// arbitrary filter expressions, device IDs, user media or network calls.
import {BENCH_SCHEMA} from './studio-export-lab-core.mjs';
export const AB_SCHEMA='paracut.export.ab.v1';
export const AB_MODES=Object.freeze(['linear','balanced']);
export const AB_SCENARIOS=Object.freeze(['v2-bezier','v2-bezier-stress']);
export const AB_QUALITIES=Object.freeze(['compact','balanced','high']);
export function parseABArgs(argv){
  if(argv.includes('--help')||argv.includes('-h'))return {help:true};
  const known=new Set(['--duration','--repeats','--quality','--scenario',
    '--report','--ffmpeg','--ffprobe']),opts={};
  for(let i=0;i<argv.length;i++){
    const key=argv[i];
    if(!known.has(key)||opts[key]!==undefined||!argv[i+1]||
      argv[i+1].startsWith('--'))throw Error('Unknown, duplicate or missing A/B option: '+key);
    opts[key]=argv[++i];
  }
  const duration=Number(opts['--duration']??3),
    repeats=Number(opts['--repeats']??2);
  if(!Number.isInteger(duration)||duration<2||duration>10)
    throw Error('A/B duration must be integer seconds 2–10.');
  if(!Number.isInteger(repeats)||repeats<1||repeats>3)
    throw Error('A/B repeats must be integer 1–3.');
  const quality=opts['--quality']??'balanced',
    scenario=opts['--scenario']??'v2-bezier-stress';
  if(!AB_QUALITIES.includes(quality))throw Error('Invalid A/B quality.');
  if(!AB_SCENARIOS.includes(scenario))throw Error('Invalid A/B scenario.');
  const report=opts['--report'];
  if(report!==undefined&&(!report.trim()||!report.endsWith('.json')))
    throw Error('A/B report must be a JSON filename.');
  for(const k of ['--ffmpeg','--ffprobe'])
    if(opts[k]!==undefined&&!opts[k].trim())throw Error('Invalid A/B executable.');
  return {duration,repeats,quality,scenario,report,
    ffmpeg:opts['--ffmpeg']??'ffmpeg',ffprobe:opts['--ffprobe']??'ffprobe'};
}
export function scheduleAB(repeats){
  if(!Number.isInteger(repeats)||repeats<1||repeats>3)
    throw Error('Invalid A/B repeats.');
  const out=[];
  for(let repeat=1;repeat<=repeats;repeat++){
    const modes=repeat%2?AB_MODES:[...AB_MODES].reverse();
    for(const mode of modes)out.push({repeat,mode});
  }
  return out;
}
export function acceptABReceipt(line,mode){
  if(!AB_MODES.includes(mode))throw Error('Invalid A/B mode.');
  if(typeof line!=='string'||!line.startsWith('PARACUT_BENCH_JSON '))
    throw Error('Missing A/B export receipt.');
  let record;
  try{record=JSON.parse(line.slice('PARACUT_BENCH_JSON '.length));}
  catch{throw Error('Malformed A/B export receipt.');}
  if(record?.schema!==BENCH_SCHEMA||record.bezierLookup!==mode||
    !record.graph||
    !['mediaSeconds','probeMs','planMs','encodeMs','verifyMs','totalMs']
      .every(k=>typeof record[k]==='number'&&Number.isFinite(record[k])&&record[k]>=0)||
    record.mediaSeconds===0||record.encodeMs===0||
    !['filterGraphChars','customXSegments','optimizedPieces','previousFixedPieces']
      .every(k=>Number.isSafeInteger(record.graph[k])&&record.graph[k]>=0)||
    record.graph.customXSegments<1||record.graph.optimizedPieces<1||
    typeof record.graph.maxProbeError!=='number'||
    !Number.isFinite(record.graph.maxProbeError)||
    record.graph.maxProbeError<0||record.graph.maxProbeError>1)
      throw Error('Invalid or mislabeled A/B export receipt.');
  return record;
}
function median(values){
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted.length%2?sorted[(sorted.length-1)/2]:
    (sorted[sorted.length/2-1]+sorted[sorted.length/2])/2;
}
export function summarizeAB(opts,runs){
  if(!opts||!AB_SCENARIOS.includes(opts.scenario)||
    !AB_QUALITIES.includes(opts.quality)||!Number.isInteger(opts.duration)||
    opts.duration<2||opts.duration>10||
    !Number.isInteger(opts.repeats)||opts.repeats<1||opts.repeats>3||
    !Array.isArray(runs)||runs.length!==2*opts.repeats)
    throw Error('Invalid A/B result set.');
  const metrics={};
  for(const mode of AB_MODES){
    const group=runs.filter(r=>r.mode===mode);
    if(group.length!==opts.repeats||
      new Set(group.map(r=>r.repeat)).size!==opts.repeats||
      group.some(r=>!Number.isInteger(r.repeat)||r.repeat<1||
        r.repeat>opts.repeats||
        typeof r.encodeMs!=='number'||!Number.isFinite(r.encodeMs)||r.encodeMs<=0||
        typeof r.totalMs!=='number'||!Number.isFinite(r.totalMs)||r.totalMs<=0||
        !r.graph||!Number.isSafeInteger(r.graph.filterGraphChars)||
        !Number.isSafeInteger(r.graph.customXSegments)||
        r.graph.customXSegments<1||!Number.isSafeInteger(r.graph.optimizedPieces)))
      throw Error('Incomplete A/B mode results.');
    metrics[mode]={
      medianEncodeMs:median(group.map(x=>x.encodeMs)),
      medianTotalMs:median(group.map(x=>x.totalMs)),
      graphChars:group[0].graph.filterGraphChars,
      customXSegments:group[0].graph.customXSegments,
      adaptivePieces:group[0].graph.optimizedPieces
    };
  }
  const frameMatches=runs.filter(r=>r.framesMatch===true).length;
  if(runs.some(r=>typeof r.framesMatch!=='boolean'))
    throw Error('Incomplete A/B decoded frame parity checks.');
  // Every pair is either verified matching or explicitly reported as a difference.
  const paired=Array.from({length:opts.repeats},(_,i)=>{
    const a=runs.find(r=>r.repeat===i+1&&r.mode==='linear');
    const b=runs.find(r=>r.repeat===i+1&&r.mode==='balanced');
    return {repeat:i+1,framesMatch:a.framesMatch&&b.framesMatch};
  });
  const allFrameMatches=paired.every(p=>p.framesMatch);
  const speedRatio=metrics.linear.medianEncodeMs/metrics.balanced.medianEncodeMs;
  return {schema:AB_SCHEMA,synthetic:true,scenario:opts.scenario,
    quality:opts.quality,duration:opts.duration,repeats:opts.repeats,
    alternatingOrder:true,metrics,
    balancedSpeedRatio:Number(speedRatio.toFixed(4)),
    pairedVideoFramesMatch:allFrameMatches,
    decodedFramePairs:paired,
    caveat:'Same generated media and draft; only Bézier lookup mode differs. Local encode ratios are measured, sensitive to host noise, and not guaranteed across machines.'};
}
export function formatABReport(s){
  if(s?.schema!==AB_SCHEMA)throw Error('Invalid A/B report.');
  return [
    'ParaCut R7.8 controlled synthetic Bézier lookup A/B',
    'Workload '+s.scenario+' | '+s.quality+' | '+s.duration+
      's | '+s.repeats+' alternating-order pairs',
    'Old sequential lookup median encode: '+
      (s.metrics.linear.medianEncodeMs/1000).toFixed(3)+'s',
    'Balanced lookup median encode: '+
      (s.metrics.balanced.medianEncodeMs/1000).toFixed(3)+'s',
    'Old / new median encode ratio: '+s.balancedSpeedRatio.toFixed(2)+'x',
    'Decoded video-frame hashes match for all pairs: '+
      (s.pairedVideoFramesMatch?'YES':'NO; inspect output differences'),
    'Old graph chars: '+s.metrics.linear.graphChars+
      ' | New graph chars: '+s.metrics.balanced.graphChars,
    s.caveat
  ].join('\n');
}
