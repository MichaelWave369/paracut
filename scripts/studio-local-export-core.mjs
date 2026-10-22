// ParaCut Studio R4.1: browser-draft -> local FFmpeg render plan.
// No shell command execution or network access in this module.
import { extname, resolve } from 'node:path';
import { colorFFmpegFilters } from '../apps/desktop/public/studio-color.js';
import {audioKeyframeFilter,overlayKeyframeFilter} from '../apps/desktop/public/studio-keyframes.js';
import { planLayeredMp4 } from './studio-r56-layer-graph.mjs';
import { applyExportOptions } from './studio-r57-export-options.mjs';

const n = x => String(Math.round(x * 1000) / 1000);
const seconds = c => c.source.end - c.source.start;
export const shellPreview = argv => argv.map(s => /^[a-zA-Z0-9_./:=+-]+$/.test(s) ? s : JSON.stringify(s)).join(' ');

export function buildAss(titles, length) {
  const rows=['[Script Info]','ScriptType: v4.00+','PlayResX: 1280','PlayResY: 720',
    'WrapStyle: 0','ScaledBorderAndShadow: yes','',
    '[V4+ Styles]',
    'Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding',
    'Style: Default,Arial,52,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,60,60,60,1','',
    '[Events]','Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text'];
  const at = sec => {
    const cs=Math.max(0,Math.round(sec*100)),h=Math.floor(cs/360000),
      m=Math.floor(cs%360000/6000),s=Math.floor(cs%6000/100),part=cs%100;
    return h+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+'.'+String(part).padStart(2,'0');
  };
  const positions={top:8,middle:5,bottom:2},sizes={small:36,medium:52,large:74};
  const colors={white:'FFFFFF',mint:'DFF087',gold:'8ADDFF'}; // BGR
  for(const t of titles) {
    if(t.start>=length)continue;
    const end=Math.min(t.end,length);
    if(end<=t.start)continue;
    const position=positions[t.position??'bottom'],size=sizes[t.size??'medium'],color=colors[t.color??'white'];
    if(!position||!size||!color)throw Error('Invalid title styling.');
    const fi=Math.min(t.fade_in??0,end-t.start),fo=Math.min(t.fade_out??0,end-t.start-fi);
    const fixed='{\\an'+position+'\\fs'+size+'\\c&H'+color+'&\\fad('+Math.round(fi*1000)+','+Math.round(fo*1000)+')}';
    const escaped=t.text.replace(/[\r\n]/g,' ').replaceAll('\\','＼').replaceAll('{','｛').replaceAll('}','｝');
    rows.push('Dialogue: 0,'+at(t.start)+','+at(end)+',Default,,0,0,0,,'+fixed+escaped);
  }
  return rows.join('\n')+'\n';
}

export function planLocalMp4(state, mediaByAsset, output, {ffmpeg='ffmpeg',quality='balanced',protectAudio=false}={}) {
  const mix=state?.audioMix;
  const advanced=Boolean(state?.video2Clips?.length || state?.audio2Clips?.length ||
    (mix && (mix.duckA1 || ['a1','a2'].some(k=>mix[k]?.gain!==1 ||
      mix[k]?.muted || mix[k]?.solo))));
  if(advanced)return applyExportOptions(planLayeredMp4(state,mediaByAsset,output,{ffmpeg,buildAss}),{quality,protectAudio});
  if(!state?.clips?.length)throw Error('A video clip is required.');
  if(state.clips.length>32||state.audioClips.length>32)throw Error('Local export limit: 32 clips per lane.');
  const length=state.clips.at(-1).timeline.end;
  if(!Number.isFinite(length)||length<=0||length>300)throw Error('Local export limit: five minutes.');
  if(extname(output).toLowerCase()!=='.mp4')throw Error('Output must end in .mp4.');
  const entries=[...state.clips,...state.audioClips].map((clip,index)=>{
    const media=mediaByAsset[clip.asset_id];
    if(!media?.path)throw Error('Source media not relinked: '+clip.asset_id);
    return {clip,index,media};
  });
  const graph=[],sources=[];
  // Repeated references use independent inputs: no accidental consumed pads.
  for(const entry of entries)sources.push('-i',resolve(entry.media.path));
  for(let i=0;i<state.clips.length;i++) {
    const c=state.clips[i],span=seconds(c);
    graph.push('['+i+':v:0]trim=start='+n(c.source.start)+':duration='+n(span)+
      ',setpts=PTS-STARTPTS,fps=30,scale=1280:720:force_original_aspect_ratio=decrease,'+
      'pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,'+
      (colorFFmpegFilters(c).length?colorFFmpegFilters(c).join(',')+',':'')+
      'format=yuv420p,settb=AVTB[v'+i+']');
  }
  let outputVideo='v0';
  for(let i=1;i<state.clips.length;i++) {
    const fade=state.clips[i-1].transition_out_seconds??0,label='merged'+i;
    if(fade)graph.push('['+outputVideo+'][v'+i+']xfade=transition=fade:duration='+n(fade)+
      ':offset='+n(state.clips[i].timeline.start)+'['+label+']');
    else graph.push('['+outputVideo+'][v'+i+']concat=n=2:v=1:a=0['+label+']');
    outputVideo=label;
  }
  const withTitles=state.titles.some(t=>t.start<length);
  graph.push('['+outputVideo+']'+(withTitles?'ass=filename=titles.ass':'null')+'[vout]');
  const aud=[];
  for(const {clip:c,index,media} of entries) {
    if(!media.hasAudio||c.source_audio_muted===true||(c.volume??1)===0)continue;
    const span=seconds(c),filters=[
      '['+index+':a:0]atrim=start='+n(c.source.start)+':duration='+n(span),
      'asetpts=PTS-STARTPTS','aresample=48000',
      'aformat=sample_fmts=fltp:channel_layouts=stereo','volume='+n(c.volume??1)];
    const animatedVolume=audioKeyframeFilter(c);
    if(animatedVolume)filters.push(animatedVolume);
    if(c.fade_in>0)filters.push('afade=t=in:st=0:d='+n(c.fade_in));
    if(c.fade_out>0)filters.push('afade=t=out:st='+n(span-c.fade_out)+':d='+n(c.fade_out));
    if(c.track_id==='video-1') {
      const ci=state.clips.findIndex(x=>x.clip_id===c.clip_id);
      const fi=ci>0?(state.clips[ci-1].transition_out_seconds??0):0;
      const fo=c.transition_out_seconds??0;
      if(fi>0)filters.push('afade=t=in:st=0:d='+n(fi));
      if(fo>0)filters.push('afade=t=out:st='+n(span-fo)+':d='+n(fo));
    }
    filters.push('adelay='+Math.round(c.timeline.start*1000)+':all=1');
    const id='a'+aud.length;
    graph.push(filters.join(',')+'['+id+']'); aud.push(id);
  }
  if(aud.length)graph.push(aud.map(id=>'['+id+']').join('')+
    'amix=inputs='+aud.length+':duration=longest:dropout_transition=0,'+
    'atrim=duration='+n(length)+',aresample=48000[aout]');
  else graph.push('anullsrc=r=48000:cl=stereo,atrim=duration='+n(length)+'[aout]');
  const args=['-hide_banner','-n',...sources,'-filter_complex_script','graph.txt','-map','[vout]',
    '-map','[aout]','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p',
    '-r','30','-c:a','aac','-b:a','192k','-movflags','+faststart','-t',n(length),'-f','mp4',resolve(output)];
  return applyExportOptions({ffmpeg,args,graph:graph.join(';\n')+'\n',
    ass:withTitles?buildAss(state.titles,length):null,duration:length,
    videoClips:state.clips.length,audioSegments:aud.length,
    transitions:state.clips.filter(c=>(c.transition_out_seconds??0)>0).length},{quality,protectAudio});
}
