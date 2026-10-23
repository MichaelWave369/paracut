// R7.5 pure planning + statistical report. The runner alone may invoke FFmpeg.
// No real user media, telemetry, arbitrary shell flags, or persisted clip edits.
import {newStudio,change,exportDraft} from '../apps/desktop/public/studio-core.js';

export const LAB_SCENARIOS=Object.freeze([
  'v1','v2-static','v2-linear','v2-bezier','v2-bezier-stress'
]);
export const LAB_DEFAULT_SCENARIOS=Object.freeze([
  'v1','v2-static','v2-linear','v2-bezier'
]);
export const LAB_QUALITIES=Object.freeze(['compact','balanced','high']);
export const LAB_SCHEMA='paracut.export.lab.v1';
export const BENCH_SCHEMA='paracut.export.benchmark.v1';
export function parseLabOptions(argv){
  if(argv.includes('--help')||argv.includes('-h'))return {help:true};
  const known=new Set(['--duration','--repeats','--qualities','--scenarios',
    '--report','--ffmpeg','--ffprobe']),opts={};
  for(let i=0;i<argv.length;i++){
    const key=argv[i];
    if(!known.has(key)||!argv[i+1]||argv[i+1].startsWith('--')||opts[key]!==undefined)
      throw Error('Unknown, duplicate or missing export lab option: '+key);
    opts[key]=argv[++i];
  }
  const duration=Number(opts['--duration']??3);
  const repeats=Number(opts['--repeats']??1);
  if(!Number.isInteger(duration)||duration<2||duration>10)
    throw Error('Lab duration must be an integer from 2 to 10 seconds.');
  if(!Number.isInteger(repeats)||repeats<1||repeats>3)
    throw Error('Lab repeats must be an integer from 1 to 3.');
  function list(key,defaultValues,allow){
    const str=opts[key];
    if(str===undefined)return [...defaultValues];
    const values=str.split(',');
    if(values.length<1||values.length>allow.length||new Set(values).size!==values.length||
      values.some(v=>!allow.includes(v)))
      throw Error('Invalid export lab '+key+' selection.');
    return values;
  }
  const qualities=list('--qualities',['compact','balanced'],LAB_QUALITIES);
  const scenarios=list('--scenarios',LAB_DEFAULT_SCENARIOS,LAB_SCENARIOS);
  const report=opts['--report'];
  if(report!==undefined&&(!report.trim()||!report.endsWith('.json')))
    throw Error('Lab report output must be a .json path.');
  for(const key of ['--ffmpeg','--ffprobe'])if(opts[key]!==undefined&&!opts[key].trim())
    throw Error('Invalid local executable path.');
  return {duration,repeats,qualities,scenarios,report,
    ffmpeg:opts['--ffmpeg']??'ffmpeg',ffprobe:opts['--ffprobe']??'ffprobe'};
}
const asset=(id,name,size,duration)=>({
  asset_id:id,name,type:'video/mp4',size,lastModified:0,duration
});
export function buildLabDraft({duration,scenario,mainBytes,overlayBytes}){
  if(!Number.isInteger(duration)||duration<2||duration>10||
    !LAB_SCENARIOS.includes(scenario)||!Number.isSafeInteger(mainBytes)||
    mainBytes<=0||!Number.isSafeInteger(overlayBytes)||overlayBytes<=0)
    throw Error('Invalid local test fixture parameters.');
  let state=newStudio('Synthetic Export Performance Lab');
  state=change(state,{type:'asset.added',
    asset:asset('lab-main','lab-main.mp4',mainBytes,duration)});
  state=change(state,{type:'asset.added',
    asset:asset('lab-overlay','lab-overlay.mp4',overlayBytes,duration)});
  state=change(state,{type:'clip.appended',asset_id:'lab-main'});
  if(scenario!=='v1'){
    state=change(state,{type:'clip.layer.added',
      asset_id:'lab-overlay',track_id:'video-2',start:0});
    if(scenario==='v2-linear'){
      state=change(state,{type:'clip.keyframe.points.updated',
        clip_id:state.video2Clips[0].clip_id,field:'opacity_keyframes',
        points:[{at:0,value:0},{at:1,value:1}]});
    }
    if(scenario==='v2-bezier'){
      state=change(state,{type:'clip.keyframe.points.updated',
        clip_id:state.video2Clips[0].clip_id,field:'opacity_keyframes',
        points:[{at:0,value:.15,ease:'bezier',handles:[.12,.91],
          handles_x:[.1,.77]},{at:1,value:.95}]});
    }
    if(scenario==='v2-bezier-stress'){
      // Four strongly curved segments exercise a deeper search workload,
      // without introducing arbitrary source media or project expressions.
      state=change(state,{type:'clip.keyframe.points.updated',
        clip_id:state.video2Clips[0].clip_id,field:'opacity_keyframes',
        points:[
          {at:0,value:.05,ease:'bezier',handles:[1,0],handles_x:[0,1]},
          {at:.25,value:.95,ease:'bezier',handles:[0,1],handles_x:[.8,.98]},
          {at:.5,value:.15,ease:'bezier',handles:[1,0],handles_x:[.02,.2]},
          {at:.75,value:.85,ease:'bezier',handles:[0,0],handles_x:[.5,.5]},
          {at:1,value:.1}
        ]});
    }
  }
  return exportDraft(state);
}
export function acceptBenchReceipt(line){
  if(typeof line!=='string'||!line.startsWith('PARACUT_BENCH_JSON '))
    throw Error('Missing verified export benchmark receipt.');
  let record;
  try{record=JSON.parse(line.slice('PARACUT_BENCH_JSON '.length));}
  catch{throw Error('Malformed export benchmark JSON receipt.');}
  if(record?.schema!==BENCH_SCHEMA||!record.graph||
    !['mediaSeconds','probeMs','planMs','encodeMs','verifyMs','totalMs']
      .every(k=>typeof record[k]==='number'&&Number.isFinite(record[k])&&record[k]>=0)||
    !Number.isSafeInteger(record.graph.filterGraphChars)||
    !Number.isSafeInteger(record.graph.customXSegments)||
    !Number.isSafeInteger(record.graph.optimizedPieces)||
    !Number.isSafeInteger(record.graph.previousFixedPieces)||
    typeof record.graph.maxProbeError!=='number'||
    !Number.isFinite(record.graph.maxProbeError)||
    record.graph.maxProbeError<0||record.graph.maxProbeError>1||
    record.encodeMs<=0||record.mediaSeconds<=0)
    throw Error('Invalid export benchmark receipt values.');
  return record;
}
const median=ns=>{const a=[...ns].sort((x,y)=>x-y);
  return a.length%2?a[Math.floor(a.length/2)]:
    (a[a.length/2-1]+a[a.length/2])/2;};
export function summarizeLab({duration,repeats,qualities,scenarios},runs){
  if(!Number.isInteger(duration)||!Number.isInteger(repeats)||
    !Array.isArray(qualities)||!Array.isArray(scenarios)||!Array.isArray(runs))
    throw Error('Invalid lab result shape.');
  const cells=[];
  for(const scenario of scenarios)for(const quality of qualities){
    const entries=runs.filter(r=>r.scenario===scenario&&r.quality===quality);
    if(entries.length!==repeats||new Set(entries.map(x=>x.repeat)).size!==repeats||
      entries.some(x=>!Number.isInteger(x.repeat)||x.repeat<1||
        x.repeat>repeats||!Number.isFinite(x.encodeMs)||x.encodeMs<=0||
        !Number.isFinite(x.totalMs)||x.totalMs<=0||
        !Number.isFinite(x.mediaSeconds)||x.mediaSeconds<=0))
      throw Error('Incomplete or invalid export lab comparison cell.');
    const encodeMedianMs=median(entries.map(x=>x.encodeMs));
    cells.push({
      scenario,quality,repeats,
      medianEncodeMs:encodeMedianMs,
      medianTotalMs:median(entries.map(x=>x.totalMs)),
      realtimeFactor:Number((1000*duration/encodeMedianMs).toFixed(3)),
      graphChars:entries[0].graph.filterGraphChars,
      adaptivePieces:entries[0].graph.optimizedPieces,
      maxProbeError:entries[0].graph.maxProbeError
    });
  }
  if(runs.length!==scenarios.length*qualities.length*repeats)
    throw Error('Unexpected extra export lab results.');
  const comparisons=[];
  for(const quality of qualities){
    const flat=cells.find(c=>c.quality===quality&&c.scenario==='v2-static');
    const animated=cells.find(c=>c.quality===quality&&c.scenario==='v2-bezier');
    const linear=cells.find(c=>c.quality===quality&&c.scenario==='v2-linear');
    if(flat&&animated)comparisons.push({
      quality,staticMedianEncodeMs:flat.medianEncodeMs,
      animatedMedianEncodeMs:animated.medianEncodeMs,
      animatedVsStatic:Number((animated.medianEncodeMs/flat.medianEncodeMs).toFixed(3))
    });
    if(linear&&animated)comparisons.push({
      quality,kind:'bezier-vs-linear',linearMedianEncodeMs:linear.medianEncodeMs,
      animatedMedianEncodeMs:animated.medianEncodeMs,
      bezierVsLinear:Number((animated.medianEncodeMs/linear.medianEncodeMs).toFixed(3))
    });
  }
  return {schema:LAB_SCHEMA,synthetic:true,duration,repeats,qualities,
    scenarios,cells,comparisons,
    caveat:'Synthetic workloads are not isolated filter microbenchmarks. Compare only the same host, FFmpeg build, duration and settings. Medians are measured, not predicted.'};
}
export function formatLabReport(summary){
  if(summary?.schema!==LAB_SCHEMA||!Array.isArray(summary.cells))
    throw Error('Invalid lab summary.');
  const lines=['ParaCut R7.5 Export Performance Lab (synthetic, local only)',
    'Duration: '+summary.duration+'s; repeats per cell: '+summary.repeats,
    'Scenario | Quality | Median encode | Median total | Real-time | Graph chars | Bézier pieces'];
  for(const cell of summary.cells)lines.push(
    cell.scenario+' | '+cell.quality+' | '+(cell.medianEncodeMs/1000).toFixed(3)+
    's | '+(cell.medianTotalMs/1000).toFixed(3)+'s | '+
    cell.realtimeFactor.toFixed(2)+'x | '+cell.graphChars+' | '+cell.adaptivePieces);
  for(const c of summary.comparisons)
    lines.push(c.kind==='bezier-vs-linear'
      ?c.quality+' custom Bézier/native linear alpha encode ratio: '+
        c.bezierVsLinear.toFixed(2)+'x'
      :c.quality+' animated/static V2 encode ratio: '+
        c.animatedVsStatic.toFixed(2)+'x');
  lines.push(summary.caveat);
  return lines.join('\n');
}
