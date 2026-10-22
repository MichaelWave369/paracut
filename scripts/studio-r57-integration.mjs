import assert from 'node:assert/strict';
import {mkdtemp,mkdir,stat,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {newStudio,change,exportDraft} from '../apps/desktop/public/studio-core.js';
const run=(exe,args,cwd,timeout=80000)=>{
  const x=spawnSync(exe,args,{cwd,encoding:'utf8',timeout,maxBuffer:5e6});
  if(x.error||x.status!==0)throw Error(exe+' error '+(x.stderr||x.error?.message||x.status));
  return x.stdout;
};
let compatible=false;
try{
 const enc=run('ffmpeg',['-hide_banner','-encoders'],process.cwd(),15000);
 const filters=run('ffmpeg',['-hide_banner','-filters'],process.cwd(),15000);
 run('ffprobe',['-version'],process.cwd(),15000);
 compatible=['libx264','aac'].every(x=>enc.includes(x)) && filters.includes('alimiter');
}catch{}
if(!compatible){
 console.log('ParaCut R5.7 integration SKIPPED (no FFmpeg libx264/AAC/alimiter combination).');
}else{
 const dir=await mkdtemp(join(tmpdir(),'paracut-r57-'));
 try{
  const media=join(dir,'media');await mkdir(media);
  run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i',
    'color=c=blue:s=160x90:r=30:d=1.6','-c:v','mpeg4','-q:v','7',join(media,'base.mp4')],dir);
  for(const [name,freq] of [['bed.wav',440],['voice.wav',660]]){
   run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i',
     'sine=frequency='+freq+':sample_rate=48000:duration=1.6',
     '-filter:a','volume=8','-c:a','pcm_s16le',join(media,name)],dir);
  }
  let s=newStudio('Master limiter test');
  for(const [name,type,len] of [
   ['base.mp4','video/mp4',1.6],['bed.wav','audio/wav',1.6],['voice.wav','audio/wav',1.6]]){
    const info=await stat(join(media,name));
    s=change(s,{type:'asset.added',asset:{asset_id:name,name,type,
      duration:len,size:info.size,lastModified:0}});
  }
  s=change(s,{type:'clip.appended',asset_id:'base.mp4'});
  s=change(s,{type:'clip.appended',asset_id:'bed.wav'});
  s=change(s,{type:'clip.layer.added',track_id:'audio-2',asset_id:'voice.wav',start:0});
  const draft=join(dir,'cut.json'),out=join(dir,'safe.mp4'),cli=resolve('scripts/studio-export-local.mjs');
  await writeFile(draft,exportDraft(s));
  const params=['--draft',draft,'--media-dir',media,'--out',out,
    '--quality','compact','--audio-protect'];
  const dry=run('node',[cli,...params,'--dry-run'],dir,25000);
  assert.match(dry,/master audio protection: ON/);
  assert.match(dry,/alimiter=limit=0.95:level=0:latency=1/);
  const done=run('node',[cli,...params],dir,120000);
  assert.match(done,/Verified local MP4/);
  assert.ok((await stat(out)).size>1000);
  const stream=JSON.parse(run('ffprobe',['-v','error','-show_entries',
    'stream=codec_name:format=duration','-of','json',out],dir));
  assert.ok(stream.streams.some(x=>x.codec_name==='h264'));
  assert.ok(stream.streams.some(x=>x.codec_name==='aac'));
  assert.ok(Math.abs(Number(stream.format.duration)-1.6)<.3);
  console.log('ParaCut R5.7 integration PASS: actual 2-track AAC master limiter MP4, compact preset, CLI preflight and verified output.');
 }finally{await rm(dir,{recursive:true,force:true})}
}
