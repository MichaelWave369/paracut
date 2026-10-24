// R7.9: pure, local-only export diagnostics. Receives numerical summaries;
// does not ingest media, access files, mutate saved drafts, or send telemetry.
export const DIAGNOSTICS_SCHEMA='paracut.export.diagnostics.v1';
const AB_SCHEMA='paracut.export.ab.v1';
const LAB_SCHEMA='paracut.export.lab.v1';
const PHASES=Object.freeze(['probeMs','planMs','encodeMs','verifyMs']);
const MODES=Object.freeze(['linear','balanced']);
const nonnegative=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const positive=n=>nonnegative(n)&&n>0;
const rounded=(n,places=3)=>Number(n.toFixed(places));
function median(values){
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted.length%2?sorted[(sorted.length-1)/2]:
    (sorted[sorted.length/2-1]+sorted[sorted.length/2])/2;
}
export function diagnoseABRuns(opts,runs){
  if(!opts||!Number.isInteger(opts.repeats)||opts.repeats<1||opts.repeats>3||
    !Array.isArray(runs)||runs.length!==2*opts.repeats)
    throw Error('Invalid A/B diagnostic samples.');
  const stagesProvided=runs.some(row=>PHASES.slice(0,2).concat('verifyMs')
    .some(field=>row[field]!==undefined));
  const pairs=[];
  for(let repeat=1;repeat<=opts.repeats;repeat++){
    const rowByMode={};
    for(const mode of MODES){
      const matches=runs.filter(row=>row.repeat===repeat&&row.mode===mode);
      if(matches.length!==1)throw Error('Incomplete A/B diagnostic pair.');
      const row=matches[0];
      if(!positive(row.encodeMs)||!positive(row.totalMs)||row.totalMs<row.encodeMs||
        typeof row.framesMatch!=='boolean'||
        (stagesProvided&&PHASES.some(field=>!nonnegative(row[field]))))
        throw Error('Invalid A/B diagnostic stage or frame values.');
      if(stagesProvided){
        const tracked=PHASES.reduce((sum,field)=>sum+row[field],0);
        if(tracked>row.totalMs+Math.max(.01,row.totalMs*.000001))
          throw Error('A/B diagnostic phases exceed total elapsed time.');
      }
      rowByMode[mode]=row;
    }
    const ratio=rowByMode.linear.encodeMs/rowByMode.balanced.encodeMs;
    pairs.push({repeat,oldOverBalanced:rounded(ratio,4),
      decodedFramesMatch:rowByMode.linear.framesMatch&&rowByMode.balanced.framesMatch});
  }
  const ratios=pairs.map(pair=>pair.oldOverBalanced);
  const directions=ratios.map(r=>r>1.03?'balanced':r<1/1.03?'linear':'near-tie');
  const agreement=directions.every(d=>d===directions[0])?directions[0]:'mixed';
  const spread=rounded((Math.max(...ratios)-Math.min(...ratios))/median(ratios),4);
  const parity=pairs.every(pair=>pair.decodedFramesMatch);
  const stageBreakdown={};
  if(stagesProvided)for(const mode of MODES){
    const sample=runs.filter(r=>r.mode===mode);
    const total=median(sample.map(row=>row.totalMs));
    const times=Object.fromEntries(PHASES.map(field=>[
      field,rounded(median(sample.map(row=>row[field])),3)]));
    const accounted=Object.values(times).reduce((a,b)=>a+b,0);
    stageBreakdown[mode]={
      medianTotalMs:rounded(total,3),medianStagesMs:times,
      // Marginal medians need not sum to median total; don't present this
      // as an exact accounting identity or a profiler trace.
      medianEncodeShare:rounded(times.encodeMs/total,4),
      medianUnattributedApproxMs:rounded(Math.max(0,total-accounted),3),
      largestMeasuredPhase:PHASES.reduce((best,key)=>
        times[key]>times[best]?key:best,'probeMs')
    };
  }
  let priority='repeat-under-controlled-conditions',reason='';
  if(!parity){
    priority='inspect-frame-parity';
    reason='Decoded frame checks differ. Investigate frame-level output before performance claims.';
  }else if(opts.repeats<3){
    reason='Only '+opts.repeats+' paired comparison(s). Three pairs are still exploratory, not statistically conclusive.';
  }else if(agreement==='mixed'||spread>.15){
    reason='Pair ratios change direction or vary by more than 15% of their median. Re-run on an idle machine.';
  }else if(stagesProvided&&stageBreakdown.balanced.medianEncodeShare<.5){
    priority='inspect-nonencode-overhead';
    reason='Encoding accounts for under half the median balanced total. Inspect source checks, process startup and verification before rewriting Bézier expressions.';
  }else if(agreement==='near-tie'){
    priority='optimize-other-stage';
    reason='The two lookup modes were within 3% per pair. This short synthetic workload shows no clear lookup advantage.';
  }else{
    priority='confirm-with-longer-fixtures';
    reason='One lookup mode led consistently in the short synthetic runs. Confirm with identical longer footage before changing the default.';
  }
  return {schema:DIAGNOSTICS_SCHEMA,kind:'controlled-ab',
    pairs,parityVerified:parity,ratioDirection:agreement,
    pairRatioRelativeSpread:spread,stageBreakdown:stagesProvided?stageBreakdown:null,
    priority,reason,
    caveat:'Heuristic guidance only: 1–3 synthetic pairs cannot establish statistical confidence, end-to-end causality or general speedups.'};
}
function validateSavedAB(report){
  if(report?.schema!==AB_SCHEMA||report.synthetic!==true||
    !Number.isInteger(report.repeats)||report.repeats<1||report.repeats>3||
    !positive(report.duration)||!positive(report.balancedSpeedRatio)||
    !report.metrics||!MODES.every(mode=>
      positive(report.metrics[mode]?.medianEncodeMs)&&
      positive(report.metrics[mode]?.medianTotalMs))||
    typeof report.pairedVideoFramesMatch!=='boolean')
    throw Error('Invalid saved ParaCut A/B summary.');
}
export function diagnoseSavedReport(report){
  if(report?.schema===AB_SCHEMA){
    validateSavedAB(report);
    if(Array.isArray(report.diagnosticSamples)){
      const diagnostic=diagnoseABRuns({
        repeats:report.repeats
      },report.diagnosticSamples);
      const byMode=Object.fromEntries(MODES.map(mode=>[mode,median(
        report.diagnosticSamples.filter(row=>row.mode===mode).map(row=>row.encodeMs))]));
      if(MODES.some(mode=>Math.abs(byMode[mode]-
        report.metrics[mode].medianEncodeMs)>0.01)||
        diagnostic.parityVerified!==report.pairedVideoFramesMatch)
        throw Error('Saved ParaCut A/B summary conflicts with diagnostic samples.');
      return diagnostic;
    }
    return {schema:DIAGNOSTICS_SCHEMA,kind:'legacy-ab',
      priority:report.pairedVideoFramesMatch?'rerun-with-stage-records':'inspect-frame-parity',
      reason:report.pairedVideoFramesMatch?
        'This R7.8 A/B report only retains aggregate timings. Re-run with R7.9 to inspect per-pair consistency and export stages.':
        'A saved frame-parity mismatch takes priority over render speed.',
      aggregateOldOverBalanced:report.balancedSpeedRatio,
      parityVerified:report.pairedVideoFramesMatch,stageBreakdown:null,
      caveat:'Aggregate-only historical report. Pair-level stability and stage attribution cannot be reconstructed.'};
  }
  if(report?.schema===LAB_SCHEMA){
    if(report.synthetic!==true||!Number.isInteger(report.repeats)||
      report.repeats<1||report.repeats>3||
      !Array.isArray(report.cells)||!report.cells.length||
      report.cells.length>15||report.cells.some(cell=>
        typeof cell.scenario!=='string'||typeof cell.quality!=='string'||
        !positive(cell.medianEncodeMs)||!positive(cell.medianTotalMs)||
        cell.medianEncodeMs>cell.medianTotalMs))
      throw Error('Invalid saved ParaCut lab summary.');
    const cells=report.cells.map(c=>({
      scenario:c.scenario,quality:c.quality,
      measuredEncodeShare:rounded(c.medianEncodeMs/c.medianTotalMs,4)
    }));
    const peak=[...cells].sort((a,b)=>b.measuredEncodeShare-a.measuredEncodeShare)[0];
    return {schema:DIAGNOSTICS_SCHEMA,kind:'scenario-lab',
      priority:'run-controlled-ab',
      reason:'This lab compares different filter workloads, not the same curve with two lookup implementations. Use the controlled A/B lab before crediting a lookup optimization.',
      highestEncodeShare:peak,
      caveat:'Stage share uses medians from distinct runs; not an exact time decomposition. No causal bottleneck identified.'};
  }
  throw Error('Unsupported ParaCut export report schema.');
}
export function formatDiagnostics(result){
  if(result?.schema!==DIAGNOSTICS_SCHEMA||
    typeof result.reason!=='string'||typeof result.priority!=='string')
    throw Error('Invalid export diagnostics.');
  const lines=['ParaCut R7.9 Export Diagnostics Inspector',
    'Result type: '+result.kind,
    'Next action: '+result.priority,
    'Why: '+result.reason];
  if(result.kind==='controlled-ab'){
    lines.push('Decoded-video parity: '+(result.parityVerified?'MATCH':'MISMATCH'),
      'Pair direction: '+result.ratioDirection+
      '; relative ratio spread: '+(100*result.pairRatioRelativeSpread).toFixed(1)+'%');
    for(const pair of result.pairs)
      lines.push('  Pair '+pair.repeat+' old/new encode: '+
        pair.oldOverBalanced.toFixed(3)+'x; decoded frames: '+
        (pair.decodedFramesMatch?'MATCH':'MISMATCH'));
    if(result.stageBreakdown)for(const mode of MODES){
      const data=result.stageBreakdown[mode];
      lines.push('  '+mode+' median measured: probe '+data.medianStagesMs.probeMs.toFixed(1)+
        'ms, plan '+data.medianStagesMs.planMs.toFixed(1)+'ms, encode '+
        data.medianStagesMs.encodeMs.toFixed(1)+'ms, verify '+
        data.medianStagesMs.verifyMs.toFixed(1)+'ms. Encode/total median ratio '+
        (data.medianEncodeShare*100).toFixed(1)+'%');
    }
  }else if(result.kind==='legacy-ab'){
    lines.push('Old/new aggregate ratio: '+result.aggregateOldOverBalanced.toFixed(3)+'x');
  }else if(result.kind==='scenario-lab'){
    lines.push('Highest observed encode/total ratio: '+
      result.highestEncodeShare.scenario+' / '+result.highestEncodeShare.quality+
      ' / '+(result.highestEncodeShare.measuredEncodeShare*100).toFixed(1)+'%');
  }
  lines.push(result.caveat);
  return lines.join('\n');
}
