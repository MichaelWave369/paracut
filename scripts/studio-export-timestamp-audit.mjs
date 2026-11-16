// Diagnose, never rewrite, the original WebM video packet timestamps.
// CLI: node scripts/studio-export-timestamp-audit.mjs path/to/export.webm
// ffprobe (optional on developer workstation) required only for CLI, not CI.
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export function summarizeVideoPackets(packets){
  if(!Array.isArray(packets)||!packets.length)throw Error('No video packets to assess.');
  const values=packets.map(p=>{
    const pts=Number(p?.pts),dts=Number(p?.dts);
    if(!Number.isFinite(pts)||!Number.isFinite(dts)||pts<0||dts<0)
      throw Error('Video packet must have finite nonnegative PTS and DTS.');
    return {pts,dts};
  });
  const gaps=values.slice(1).map((p,i)=>p.pts-values[i].pts);
  const dtsGaps=values.slice(1).map((p,i)=>p.dts-values[i].dts);
  const ordered=gaps.filter(v=>v>0).sort((a,b)=>a-b);
  const median=ordered.length?ordered[Math.floor(ordered.length/2)]:null;
  const ms=n=>n===null?null:Math.round(n*1000);
  return {
    videoPackets:values.length,ptsStrictlyIncreasing:gaps.every(n=>n>0),
    dtsStrictlyIncreasing:dtsGaps.every(n=>n>0),
    nonIncreasingPts:gaps.filter(n=>n<=0).length,
    nonIncreasingDts:dtsGaps.filter(n=>n<=0).length,
    firstFramePtsMs:ms(values[0].pts),
    initialGapMs:ms(gaps[0]??null),
    medianPositiveFrameGapMs:ms(median),
    maxFrameGapMs:ms(gaps.length?Math.max(...gaps):null),
    timingModel:'Browser canvas MediaRecorder may emit variable-frame-rate timestamps',
    note:'This audits source WebM packet order, not downstream CFR transcode warnings or physical playback.',
  };
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const file=process.argv[2];
  if(!file){console.error('Usage: node scripts/studio-export-timestamp-audit.mjs <export.webm>');process.exitCode=2;}
  else{
    try{
      const raw=execFileSync('ffprobe',[
        '-v','error','-select_streams','v:0','-show_entries','packet=pts_time,dts_time',
        '-of','csv=p=0',file
      ],{encoding:'utf8',timeout:30000,maxBuffer:8*1024*1024});
      const rows=raw.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
      const packets=rows.map(line=>{
        const [pts,dts]=line.split(',');return {pts:Number(pts),dts:Number(dts)};
      });
      const report=summarizeVideoPackets(packets);
      console.log(JSON.stringify(report,null,2));
      if(!report.ptsStrictlyIncreasing||!report.dtsStrictlyIncreasing)process.exitCode=1;
    }catch(err){console.error('Timestamp audit failed: '+err.message);process.exitCode=1;}
  }
}
