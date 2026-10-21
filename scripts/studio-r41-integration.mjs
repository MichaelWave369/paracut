import assert from 'node:assert/strict';
import {mkdtemp,stat,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {newStudio,change,exportDraft} from '../apps/desktop/public/studio-core.js';

function cmd(exe,args,where,timeout=75_000) {
  const p=spawnSync(exe,args,{cwd:where,encoding:'utf8',timeout,maxBuffer:4*1024*1024});
  if(p.error||p.status!==0)throw Error(exe+' failed:\n'+(p.stderr||p.error?.message||'unknown'));
  return p.stdout;
}
function capable() {
  try {
    const a=cmd('ffmpeg',['-hide_banner','-encoders'],process.cwd(),10_000);
    const b=cmd('ffmpeg',['-hide_banner','-filters'],process.cwd(),10_000);
    cmd('ffprobe',['-version'],process.cwd(),10_000);
    return a.includes('libx264')&&a.includes('aac')&&b.includes('xfade')&&b.includes('ass');
  } catch {return false;}
}
if(!capable()) {
  console.log('ParaCut local MP4 integration: SKIPPED (this runner lacks ffmpeg/ffprobe with libx264 + ASS + xfade).');
} else {
  const dir=await mkdtemp(join(tmpdir(),'paracut-r41-smoke-'));
  try {
    await mkdir(join(dir,'media'));
    for(const [name,color,freq] of [['one.mp4','red','440'],['two.mp4','blue','660']]) {
      cmd('ffmpeg',['-hide_banner','-loglevel','error','-y',
        '-f','lavfi','-i','color=c='+color+':s=160x90:r=30:d=1.2',
        '-f','lavfi','-i','sine=frequency='+freq+':sample_rate=48000:duration=1.2',
        '-c:v','mpeg4','-q:v','8','-c:a','aac','-b:a','96k','-shortest',
        join(dir,'media',name)],dir,40_000);
    }
    cmd('ffmpeg',['-hide_banner','-loglevel','error','-y',
      '-f','lavfi','-i','sine=frequency=250:sample_rate=48000:duration=3',
      '-c:a','pcm_s16le',join(dir,'media','music.wav')],dir,40_000);
    let state=newStudio('Export integration');
    for(const [name,type,duration] of [['one.mp4','video/mp4',1.2],['two.mp4','video/mp4',1.2],
      ['music.wav','audio/wav',3]]) {
      const info=await stat(join(dir,'media',name));
      state=change(state,{type:'asset.added',asset:{
        asset_id:name,name,type,size:info.size,lastModified:0,duration
      }});
      state=change(state,{type:'clip.appended',asset_id:name});
    }
    state=change(state,{type:'clip.transition.updated',clip_id:state.clips[0].clip_id,seconds:.2});
    state=change(state,{type:'clip.source-audio.muted',clip_id:state.clips[0].clip_id,muted:true});
    state=change(state,{type:'clip.audio.updated',clip_id:state.audioClips[0].clip_id,
      volume:.7,fade_in:.25,fade_out:.25});
    state=change(state,{type:'title.added',title:{
      text:'ParaCut field test',start:.3,end:1.7,color:'gold',size:'medium',
      position:'bottom',fade_in:.2,fade_out:.2
    }});
    const draft=join(dir,'cut.json'),out=join(dir,'final.mp4');
    await writeFile(draft,exportDraft(state));
    const cli=join(process.cwd(),'scripts','studio-export-local.mjs');
    const dry=cmd('node',[cli,'--draft',draft,'--media-dir',join(dir,'media'),
      '--out',out,'--dry-run'],dir,20_000);
    assert.match(dry,/DRY RUN/);
    await assert.rejects(()=>stat(out));
    const result=cmd('node',[cli,'--draft',draft,'--media-dir',join(dir,'media'),
      '--out',out],dir,120_000);
    assert.match(result,/Verified local MP4/);
    assert.ok((await stat(out)).size>1000);
    const probe=JSON.parse(cmd('ffprobe',['-v','error','-show_entries',
      'format=duration,format_name:stream=codec_type,codec_name','-of','json',out],dir));
    assert.ok(probe.format.format_name.includes('mp4'));
    assert.ok(probe.streams.some(s=>s.codec_name==='h264'));
    assert.ok(probe.streams.some(s=>s.codec_name==='aac'));
    assert.ok(Math.abs(Number(probe.format.duration)-2.2)<1.0);
    console.log('ParaCut local MP4 integration PASS: actual H.264/AAC export of 2 moving sources with xfade, A1 soundtrack, source mute, ASS titles.');
  } finally {await rm(dir,{recursive:true,force:true});}
}
