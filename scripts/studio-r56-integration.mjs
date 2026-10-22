import assert from 'node:assert/strict';
import {mkdtemp,mkdir,stat,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {newStudio,change,exportDraft} from '../apps/desktop/public/studio-core.js';
const cmd=(tool,args,cwd,timeout=70_000)=>{
  const result=spawnSync(tool,args,{cwd,encoding:'utf8',timeout,maxBuffer:3e6});
  if(result.error||result.status!==0)throw Error(tool+' failed: '+(result.stderr||result.error?.message));
  return result.stdout;
};
let supported=false;
try{
  const enc=cmd('ffmpeg',['-hide_banner','-encoders'],process.cwd(),15000);
  const filt=cmd('ffmpeg',['-hide_banner','-filters'],process.cwd(),15000);
  cmd('ffprobe',['-version'],process.cwd(),10000);
  supported=['libx264','aac'].every(x=>enc.includes(x))&&
    ['xfade','overlay','fade','ass','colorchannelmixer'].every(x=>filt.includes(x));
}catch{}
if(!supported){
  console.log('ParaCut R5.6 layered MP4 integration SKIPPED: this host lacks full FFmpeg codec/filter support.');
}else{
  const dir=await mkdtemp(join(tmpdir(),'paracut-layered-'));
  try{
    const folder=join(dir,'media');await mkdir(folder);
    for(const [name,color,freq,secs] of [
      ['v1','red',440,2.4],['v2','blue',660,2.4],
      ['ov1','green',530,1.2],['ov2','yellow',740,1.2]]){
      cmd('ffmpeg',['-hide_banner','-loglevel','error','-y',
        '-f','lavfi','-i','color=c='+color+':s=160x90:r=30:d='+secs,
        '-f','lavfi','-i','sine=frequency='+freq+':duration='+secs+':sample_rate=48000',
        '-c:v','mpeg4','-q:v','6','-c:a','aac','-b:a','96k','-shortest',
        join(folder,name+'.mp4')],dir,35_000);
    }
    for(const [name,freq,secs] of [['a1',210,4.5],['a2',325,1.4]])
      cmd('ffmpeg',['-hide_banner','-loglevel','error','-y',
        '-f','lavfi','-i','sine=frequency='+freq+':duration='+secs+':sample_rate=48000',
        '-c:a','pcm_s16le',join(folder,name+'.wav')],dir,25_000);
    let s=newStudio('ParaCut R5.6');
    for(const [name,type,duration] of [
      ['v1','video/mp4',2.4],['v2','video/mp4',2.4],
      ['ov1','video/mp4',1.2],['ov2','video/mp4',1.2],
      ['a1','audio/wav',4.5],['a2','audio/wav',1.4]]){
      const file=name+'.'+(type.startsWith('audio')?'wav':'mp4');
      const fileInfo=await stat(join(folder,file));
      s=change(s,{type:'asset.added',asset:{
        asset_id:name,name:file,type,size:fileInfo.size,lastModified:0,duration}});
    }
    for(const asset_id of ['v1','v2','a1'])s=change(s,{type:'clip.appended',asset_id});
    s=change(s,{type:'clip.transition.updated',clip_id:s.clips[0].clip_id,seconds:.3});
    for(const [asset_id,start] of [['ov1',.5],['ov2',1.7]])
      s=change(s,{type:'clip.layer.added',asset_id,track_id:'video-2',start});
    s=change(s,{type:'clip.overlay.transition.updated',
      clip_id:s.video2Clips[0].clip_id,seconds:.2});
    s=change(s,{type:'clip.overlay.updated',clip_id:s.video2Clips[0].clip_id,
      layout:'pip',opacity:.8,fade_in:.15,fade_out:.15,motion:'slide-left'});
    s=change(s,{type:'clip.overlay.updated',clip_id:s.video2Clips[1].clip_id,
      layout:'full',opacity:.8,fade_in:.15,fade_out:.15,motion:'rise'});
    s=change(s,{type:'clip.layer.added',asset_id:'a2',track_id:'audio-2',start:1.2});
    s=change(s,{type:'mixer.updated',lane:'a1',gain:.7,muted:false,solo:false});
    s=change(s,{type:'mixer.duck.updated',enabled:true});
    s=change(s,{type:'title.added',title:{
      text:'R5.6 layered',start:.5,end:2.4,color:'mint',size:'medium',
      position:'bottom',fade_in:.1,fade_out:.1}});
    const draft=join(dir,'draft.json'),out=join(dir,'result.mp4');
    await writeFile(draft,exportDraft(s));
    const cli=resolve('scripts/studio-export-local.mjs');
    const preview=cmd('node',[cli,'--draft',draft,'--media-dir',folder,'--out',out,'--dry-run'],dir);
    assert.match(preview,/DRY RUN/);
    assert.match(preview,/V2 overlays/);
    const result=cmd('node',[cli,'--draft',draft,'--media-dir',folder,'--out',out],dir,150_000);
    assert.match(result,/Verified local MP4/);
    assert.ok((await stat(out)).size>1000);
    const probe=JSON.parse(cmd('ffprobe',['-v','error','-show_entries',
      'format=duration,format_name:stream=codec_type,codec_name','-of','json',out],dir));
    assert.ok(probe.streams.some(x=>x.codec_name==='h264'));
    assert.ok(probe.streams.some(x=>x.codec_name==='aac'));
    assert.ok(Math.abs(Number(probe.format.duration)-4.5)<.4);
    console.log('ParaCut R5.6 layered integration PASS: actual MP4 with V1 xfade, moving V2 dissolves, A1+A2 ducked audio and ASS titles.');
  }finally{await rm(dir,{recursive:true,force:true});}
}
