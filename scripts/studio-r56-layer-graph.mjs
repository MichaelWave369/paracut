// ParaCut R5.6: local FFmpeg layered render graph. Media must be pre-verified.
import {extname,resolve} from 'node:path';
import { colorFFmpegFilters } from '../apps/desktop/public/studio-color.js';
import {audioKeyframeFilter,overlayKeyframeFilter} from '../apps/desktop/public/studio-keyframes.js';
const n=x=>String(Math.round(x*1000)/1000);
const len=c=>c.source.end-c.source.start;
const esc=x=>x.replaceAll(',', '\\,');
function motion(c,full,w,h){
  const start=c.timeline.start,end=c.timeline.end,fi=c.visual_fade_in||0,fo=c.visual_fade_out||0;
  const x0=full?0:1280-w-42,y0=full?0:41,type=c.overlay_motion||'none';
  if(type==='none'||(!fi&&!fo))return [String(x0),String(y0)];
  const parts=[];
  if(fi>0)parts.push('if(lt(t,'+n(start+fi)+'),max(0,1-(t-'+n(start)+')/'+n(fi)+'),0)');
  if(fo>0)parts.push('if(gt(t,'+n(end-fo)+'),max(0,1-('+n(end)+'-t)/'+n(fo)+'),0)');
  const wave=esc(parts.length===2?'max('+parts.join(',')+')':parts[0]);
  if(type==='slide-left')return [x0+'-('+n(w*1.05)+')*('+wave+')',String(y0)];
  if(type==='rise')return [String(x0),y0+'+('+n(h*.75)+')*('+wave+')'];
  throw Error('Unsupported V2 motion.');
}
function overlayPart(c,i,input,lane,bezierLookup='balanced'){
  const full=(c.overlay_layout||'pip')==='full',w=full?1280:420,h=full?720:220;
  const filters=['['+input+':v:0]trim=start='+n(c.source.start)+':duration='+n(len(c)),
    'setpts=PTS-STARTPTS','fps=30','scale='+w+':'+h+':force_original_aspect_ratio=decrease',
    'pad='+w+':'+h+':(ow-iw)/2:(oh-ih)/2:color=black','setsar=1',
    ...colorFFmpegFilters(c),'format=rgba'];
  const animatedAlpha=overlayKeyframeFilter(c,{bezierLookup});
  if(animatedAlpha)filters.push(animatedAlpha);
  const prev=i>0?(lane[i-1].transition_out_seconds||0):0,next=c.transition_out_seconds||0;
  for(const [direction,d] of [['in',c.visual_fade_in||0],['out',c.visual_fade_out||0],['in',prev],['out',next]])
    if(d>0)filters.push('fade=t='+direction+':st='+(direction==='in'?0:n(len(c)-d))+':d='+n(d)+':alpha=1');
  if((c.overlay_opacity??1)<1)filters.push('colorchannelmixer=aa='+n(c.overlay_opacity??1));
  filters.push('setpts=PTS+'+n(c.timeline.start)+'/TB');
  return {graph:filters.join(',')+'[layer'+i+']',xy:motion(c,full,w,h)};
}
function envelope(state){
  const terms=[];
  for(const c of state.audio2Clips){
    const a=n(c.timeline.start),b=n(c.timeline.end),finish=n(c.timeline.end+.35);
    const attack='min(1,max(0,(t-'+a+')/0.2))',release='max(0,1-(t-'+b+')/0.35)';
    terms.push('if(between(t,'+a+','+b+'),'+attack+',if(between(t,'+b+','+finish+'),'+release+',0))');
  }
  if(!terms.length)return null;
  return esc('1-0.6*('+terms.reduce((a,b)=>a?'max('+a+','+b+')':b,'')+')');
}
function gain(state,track){
  const mix=state.audioMix||{a1:{gain:1,muted:false,solo:false},a2:{gain:1,muted:false,solo:false}};
  const ch=track==='audio-1'?mix.a1:track==='audio-2'?mix.a2:null;
  if((mix.a1.solo||mix.a2.solo)&&!ch?.solo)return 0;
  return ch?.muted?0:ch?.gain??1;
}
export function planLayeredMp4(state,mediaByAsset,output,{ffmpeg='ffmpeg',buildAss,bezierLookup='balanced'}={}){
  if(!state?.clips?.length)throw Error('A video clip is required.');
  for(const lane of [state.clips,state.audioClips,state.video2Clips,state.audio2Clips])
    if(lane.length>32)throw Error('Local export limit: 32 clips per lane.');
  const duration=state.clips.at(-1).timeline.end;
  if(!Number.isFinite(duration)||duration<=0||duration>300)throw Error('Local export limit: five minutes.');
  if(extname(output).toLowerCase()!=='.mp4')throw Error('Output must end in .mp4.');
  const clips=[...state.clips,...state.audioClips,...state.video2Clips,...state.audio2Clips];
  const entries=clips.map((clip,index)=>{
    const media=mediaByAsset[clip.asset_id];
    if(!media?.path)throw Error('Source media not relinked: '+clip.asset_id);
    return {clip,index,media};
  });
  const graph=[],sources=[];
  for(const item of entries)sources.push('-i',resolve(item.media.path));
  for(let i=0;i<state.clips.length;i++){
    const c=state.clips[i];
    graph.push('['+i+':v:0]trim=start='+n(c.source.start)+':duration='+n(len(c))+',setpts=PTS-STARTPTS,fps=30,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,'+
      (colorFFmpegFilters(c).length?colorFFmpegFilters(c).join(',')+',':'')+
      'format=yuv420p,settb=AVTB[v'+i+']');
  }
  let last='v0';
  for(let i=1;i<state.clips.length;i++){
    const label='merged'+i,fade=state.clips[i-1].transition_out_seconds||0;
    graph.push('['+last+'][v'+i+']'+(fade?'xfade=transition=fade:duration='+n(fade)+':offset='+n(state.clips[i].timeline.start):'concat=n=2:v=1:a=0')+'['+label+']');
    last=label;
  }
  const offset=state.clips.length+state.audioClips.length;
  for(let i=0;i<state.video2Clips.length;i++){
    const p=overlayPart(state.video2Clips[i],i,offset+i,state.video2Clips,bezierLookup),label='composited'+i;
    graph.push(p.graph);
    graph.push('['+last+'][layer'+i+']overlay=x=\''+p.xy[0]+'\':y=\''+p.xy[1]+'\':eval=frame:eof_action=pass:repeatlast=0:shortest=0['+label+']');
    last=label;
  }
  const withTitles=state.titles.some(t=>t.start<duration);
  graph.push('['+last+']'+(withTitles?'ass=filename=titles.ass':'null')+'[vout]');
  const mix=state.audioMix||{a1:{gain:1,muted:false,solo:false},a2:{gain:1,muted:false,solo:false},duckA1:false};
  const duck=mix.duckA1&&!mix.a2.muted&&!mix.a1.solo?envelope(state):null;
  const aud=[];
  for(const {clip:c,index,media} of entries){
    const bus=gain(state,c.track_id);
    if(!media.hasAudio||c.source_audio_muted===true||(c.volume??1)===0||bus===0)continue;
    const length=len(c);
    const filters=['['+index+':a:0]atrim=start='+n(c.source.start)+':duration='+n(length),
      'asetpts=PTS-STARTPTS','aresample=48000',
      'aformat=sample_fmts=fltp:channel_layouts=stereo','volume='+n((c.volume??1)*bus)];
    const animatedVolume=audioKeyframeFilter(c,{bezierLookup});
    if(animatedVolume)filters.push(animatedVolume);
    if(c.fade_in>0)filters.push('afade=t=in:st=0:d='+n(c.fade_in));
    if(c.fade_out>0)filters.push('afade=t=out:st='+n(length-c.fade_out)+':d='+n(c.fade_out));
    if(c.track_id==='video-1'||c.track_id==='video-2'){
      const lane=c.track_id==='video-1'?state.clips:state.video2Clips;
      const pos=lane.findIndex(x=>x.clip_id===c.clip_id);
      const prev=pos>0?lane[pos-1].transition_out_seconds||0:0,next=c.transition_out_seconds||0;
      if(prev>0)filters.push('afade=t=in:st=0:d='+n(prev));
      if(next>0)filters.push('afade=t=out:st='+n(length-next)+':d='+n(next));
    }
    filters.push('adelay='+Math.round(c.timeline.start*1000)+':all=1');
    if(c.track_id==='audio-1'&&duck)filters.push('volume=\''+duck+'\':eval=frame');
    const id='a'+aud.length;graph.push(filters.join(',')+'['+id+']');aud.push(id);
  }
  if(aud.length)graph.push(aud.map(id=>'['+id+']').join('')+'amix=inputs='+aud.length+':duration=longest:dropout_transition=0:normalize=0,atrim=duration='+n(duration)+',aresample=48000[aout]');
  else graph.push('anullsrc=r=48000:cl=stereo,atrim=duration='+n(duration)+'[aout]');
  const args=['-hide_banner','-n',...sources,'-filter_complex_script','graph.txt','-map','[vout]','-map','[aout]','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-r','30','-c:a','aac','-b:a','192k','-movflags','+faststart','-t',n(duration),'-f','mp4',resolve(output)];
  return {ffmpeg,args,graph:graph.join(';\n')+'\n',
    ass:withTitles?buildAss(state.titles,duration):null,duration,
    videoClips:state.clips.length,audioSegments:aud.length,
    transitions:state.clips.filter(c=>(c.transition_out_seconds??0)>0).length,
    overlayClips:state.video2Clips.length,voiceClips:state.audio2Clips.length,
    overlayCrossfades:state.video2Clips.filter(c=>(c.transition_out_seconds??0)>0).length};
}
