// ParaCut Studio R3: local-first editor with video/audio automation and timed titles.
// This is a browser draft format, NOT the canonical ParaCut project-core format.
export const DRAFT_SCHEMA = 'paracut.studio.draft.v3';
export const PREVIOUS_DRAFT_SCHEMA = 'paracut.studio.draft.v2';
export const LEGACY_DRAFT_SCHEMA = 'paracut.studio.draft.v1';
const id = () => (globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const copy = value => JSON.parse(JSON.stringify(value));
const round = n => Math.round(n * 1000) / 1000;
const finite = value => typeof value === 'number' && Number.isFinite(value);

export function defaultAudioMix() {
  return { a1:{gain:1,muted:false,solo:false},
    a2:{gain:1,muted:false,solo:false}, duckA1:false };
}
function validateAudioMix(mix) {
  if(!mix || typeof mix!=='object' || Array.isArray(mix) ||
     typeof mix.duckA1!=='boolean') throw Error('Invalid track mixer settings.');
  for(const lane of ['a1','a2']) {
    const c=mix[lane];
    if(!c || typeof c!=='object' || Array.isArray(c) || !finite(c.gain) ||
      c.gain<0 || c.gain>1 || typeof c.muted!=='boolean' ||
      typeof c.solo!=='boolean') throw Error('Invalid '+lane.toUpperCase()+' mixer settings.');
  }
}
export function audioMixLevelAt(state,trackId,time) {
  const mix=state.audioMix??defaultAudioMix();
  const soloed=mix.a1.solo||mix.a2.solo;
  const lane=trackId==='audio-1'?mix.a1:trackId==='audio-2'?mix.a2:null;
  if(lane?.muted || (soloed && !(lane?.solo)))return 0;
  let gain=lane?.gain??1;
  if(trackId==='audio-1' && mix.duckA1 && !mix.a2.muted && !mix.a1.solo) {
    // The A1 bed dips to 40% as A2 enters, and recovers after A2 ends.
    // Evaluating this as a pure time curve keeps preview/export in agreement.
    let envelope=0;
    for(const c of state.audio2Clips) {
      const start=c.timeline.start,end=c.timeline.end;
      if(time>=start && time<end)envelope=Math.max(envelope,Math.min(1,(time-start)/.2));
      else if(time>=end && time<end+.35)
        envelope=Math.max(envelope,Math.max(0,1-(time-end)/.35));
    }
    gain*=1-.6*envelope;
  }
  return gain;
}
export const OVERLAY_MOTIONS=['none','slide-left','rise'];
export function overlayMotionAt(clip,time) {
  if(!clip || time<clip.timeline.start || time>=clip.timeline.end)return {x:0,y:0};
  const fi=clip.visual_fade_in??0,fo=clip.visual_fade_out??0;
  const age=time-clip.timeline.start,remaining=clip.timeline.end-time;
  const intro=fi>0?1-Math.min(1,age/fi):0;
  const outro=fo>0?1-Math.min(1,remaining/fo):0;
  const progress=Math.max(0,Math.min(1,Math.max(intro,outro)));
  if(progress===0)return {x:0,y:0};
  if(clip.overlay_motion==='slide-left')return {x:-progress*1.05,y:0};
  if(clip.overlay_motion==='rise')return {x:0,y:progress*.75};
  return {x:0,y:0};
}
export function newStudio(name = 'Untitled Cut') {
  return { schema: DRAFT_SCHEMA, name, assets: [], clips: [], audioClips: [], video2Clips: [], audio2Clips: [], audioMix: defaultAudioMix(), titles: [], receipts: [], undo: [], redo: [] };
}
export function duration(state) {
  return state.clips.length ? state.clips[state.clips.length - 1].timeline.end : 0;
}
export function activeClip(state, time) {
  return state.clips.find(clip => time >= clip.timeline.start && time < clip.timeline.end) || null;
}
// Older v1/v2 drafts have no source_audio_muted flag; their default is audible.
export function isSourceAudioMuted(clip) {
  return clip?.track_id?.startsWith('video-') && clip.source_audio_muted === true;
}
export function overlayCrossfadeAt(state,time) {
  if(!state || !finite(time))return null;
  const lane=state.video2Clips;
  for(let i=0;i<lane.length-1;i++){
    const outgoing=lane[i],incoming=lane[i+1];
    const seconds=outgoing.transition_out_seconds??0;
    if(seconds>0 && time>=incoming.timeline.start && time<outgoing.timeline.end) {
      return {outgoing,incoming,seconds,progress:Math.max(0,Math.min(1,
        (time-incoming.timeline.start)/seconds))};
    }
  }
  return null;
}
export function maxOverlayCrossfade(lane,index) {
  if(index<0 || index>=lane.length-1)return 0;
  const a=lane[index],b=lane[index+1];
  const aLength=a.source.end-a.source.start,bLength=b.source.end-b.source.start;
  if(index>0 && (lane[index-1].transition_out_seconds??0)>0)return 0;
  if((b.transition_out_seconds??0)>0)return 0;
  // Restrict the first release to touching V2 clips (or a pair already linked).
  const current=a.transition_out_seconds??0;
  if(Math.abs(b.timeline.start+current-a.timeline.end)>.004)return 0;
  return round(Math.max(0,Math.min(1.5,aLength/3,bLength/3)));
}
export function activeOverlayClip(state, time) {
  return state.video2Clips.find(c => time >= c.timeline.start && time < c.timeline.end) || null;
}
export function activeAudio2Clip(state, time) {
  return state.audio2Clips.find(c => time >= c.timeline.start && time < c.timeline.end) || null;
}
export function overlayOpacityAt(clip, time) {
  if (!clip || time < clip.timeline.start || time >= clip.timeline.end) return 0;
  const opacity=clip.overlay_opacity ?? 1;
  const fi=clip.visual_fade_in ?? 0, fo=clip.visual_fade_out ?? 0;
  const age=time-clip.timeline.start, remaining=clip.timeline.end-time;
  return Math.max(0,Math.min(opacity,fi>0?opacity*age/fi:opacity,
    fo>0?opacity*remaining/fo:opacity));
}
export function activeAudioClip(state, time) {
  return state.audioClips.find(clip => time >= clip.timeline.start && time < clip.timeline.end) || null;
}
// A transition is attached to the outgoing clip. Only adjacent V1 clips
// overlap; the A1 soundtrack remains on its independent absolute timeline.
export function maxCrossfade(clips, index) {
  if (index < 0 || index >= clips.length - 1) return 0;
  const a = clips[index], b = clips[index + 1];
  const aLen = a.source.end - a.source.start, bLen = b.source.end - b.source.start;
  return round(Math.max(0, Math.min(1.5, aLen / 3, bLen / 3)));
}
export function reflow(clips, trackId = 'video-1') {
  let t = 0;
  return clips.map((clip, index) => {
    if (trackId === 'video-1' && index > 0) t -= clips[index-1].transition_out_seconds || 0;
    const seconds = round(clip.source.end - clip.source.start);
    const next = { ...clip, track_id: trackId, timeline: { start: round(t), end: round(t + seconds) } };
    t += seconds;
    return next;
  });
}
// R5.1 editor snapping: pure suggestions, never changes saved project data.
// Snap a layer START or END to a visible boundary only when the proposed
// placement is legal on its own lane (no overlapping existing clips).
export function snapLayerTime(state, {desiredStart, span, trackId, excludeClipId=null,
  extraAnchors=[], threshold=.25} = {}) {
  validate(state);
  if(!['video-2','audio-2'].includes(trackId)||!finite(desiredStart)||
     !finite(span)||span<.079||!finite(threshold)||threshold<0||threshold>5||
     !Array.isArray(extraAnchors)||extraAnchors.length>50 ||
     extraAnchors.some(t=>!finite(t))) throw Error('Invalid snap request.');
  const lane=trackId==='video-2'?state.video2Clips:state.audio2Clips;
  const validStart = x => finite(x) && x>=0 && x+span<=86400 &&
    lane.every(c=>c.clip_id===excludeClipId ||
      x>=c.timeline.end-.001 || x+span<=c.timeline.start+.001);
  const anchors=[0,duration(state),...extraAnchors];
  for(const c of [...state.clips,...state.audioClips,...state.video2Clips,...state.audio2Clips]) {
    if(c.clip_id===excludeClipId) continue;
    anchors.push(c.timeline.start,c.timeline.end);
  }
  for(const t of state.titles) anchors.push(t.start,t.end);
  const options=[];
  for(const anchor of anchors) for(const edge of ['start','end']) {
    const x=edge==='start'?anchor:anchor-span;
    const delta=Math.abs(x-desiredStart);
    if(delta<=threshold+.00001 && validStart(x))
      options.push({start:round(x),snapped:true,anchor:round(anchor),edge,delta});
  }
  options.sort((a,b)=>a.delta-b.delta || (a.edge==='start'?-1:1));
  if(options.length) {
    const {start,snapped,anchor,edge}=options[0];
    return {start,snapped,anchor,edge};
  }
  return {start:round(desiredStart),snapped:false,anchor:null,edge:null};
}
export function crossfadeAt(state, time) {
  if (!state || !Number.isFinite(time)) return null;
  for (let i = 0; i < state.clips.length - 1; i++) {
    const outgoing = state.clips[i], incoming = state.clips[i+1];
    const seconds = outgoing.transition_out_seconds || 0;
    if (seconds > 0 && time >= incoming.timeline.start && time < outgoing.timeline.end) {
      return { outgoing, incoming, start:incoming.timeline.start, end:outgoing.timeline.end,
        progress: Math.max(0,Math.min(1,(time-incoming.timeline.start)/seconds)),seconds };
    }
  }
  return null;
}
function normalizeTransitions(clips) {
  return clips.map((clip,index) => {
    const limit = maxCrossfade(clips,index);
    const amount = Math.max(0,Math.min(limit,clip.transition_out_seconds || 0));
    return {...clip, transition_out_seconds:round(amount)};
  });
}
// Browser clip audio automation; defaults preserve older R1/R2 project sound.
export function audioLevelAt(clip, timelineTime) {
  if (!clip || isSourceAudioMuted(clip)) return 0;
  const volume = clip.volume === undefined ? 1 : clip.volume;
  const fadeIn = clip.fade_in === undefined ? 0 : clip.fade_in;
  const fadeOut = clip.fade_out === undefined ? 0 : clip.fade_out;
  const elapsed = Math.max(0, timelineTime - clip.timeline.start);
  const remaining = Math.max(0, clip.timeline.end - timelineTime);
  return Math.max(0, Math.min(1, volume,
    fadeIn > 0 ? volume * Math.min(1, elapsed / fadeIn) : volume,
    fadeOut > 0 ? volume * Math.min(1, remaining / fadeOut) : volume));
}
export const TITLE_POSITION = ['top','middle','bottom'];
export const TITLE_SIZE = ['small','medium','large'];
export const TITLE_COLOR = ['white','mint','gold'];
export function titleStyle(title) {
  return {
    position: title?.position ?? 'bottom',
    size: title?.size ?? 'medium',
    color: title?.color ?? 'white',
    fade_in: title?.fade_in ?? 0,
    fade_out: title?.fade_out ?? 0,
  };
}
export function titleOpacityAt(title, time) {
  if (!title || time < title.start || time >= title.end) return 0;
  const style = titleStyle(title);
  const age = time - title.start, remaining = title.end - time;
  return Math.max(0, Math.min(1,
    style.fade_in > 0 ? age / style.fade_in : 1,
    style.fade_out > 0 ? remaining / style.fade_out : 1));
}
function validateTitle(title) {
  if (!title || typeof title.title_id !== 'string' || !title.title_id ||
      typeof title.text !== 'string' || !title.text.trim() || title.text.length > 100 ||
      !finite(title.start) || !finite(title.end) || title.start < 0 || title.end <= title.start ||
      title.end > 86400) throw Error('Invalid title overlay.');
  const style = titleStyle(title);
  if (!TITLE_POSITION.includes(style.position) || !TITLE_SIZE.includes(style.size) ||
      !TITLE_COLOR.includes(style.color) || !finite(style.fade_in) ||
      !finite(style.fade_out) || style.fade_in < 0 || style.fade_out < 0 ||
      style.fade_in + style.fade_out > title.end - title.start + 0.002) {
    throw Error('Invalid title style or fade duration.');
  }
}
function titleFromInput(data, titleId) {
  if (!data || typeof data.text !== 'string' || !data.text.trim() ||
      data.text.length > 100 || !finite(data.start) || !finite(data.end) ||
      data.start < 0 || data.end <= data.start || data.end > 86400)
    throw Error('Title requires text and a positive timeline range.');
  const style = titleStyle(data);
  const title = { title_id:titleId, text: data?.text?.trim(), start:round(data?.start),
    end:round(data?.end), position:style.position, size:style.size, color:style.color,
    fade_in:round(style.fade_in), fade_out:round(style.fade_out) };
  validateTitle(title);
  return title;
}
export function visibleTitle(state, timelineTime) {
  return state.titles.find(title => timelineTime >= title.start && timelineTime < title.end) || null;
}
function assertAudioValues(volume, fadeIn, fadeOut, length) {
  if (![volume, fadeIn, fadeOut].every(finite) || volume < 0 || volume > 1 ||
      fadeIn < 0 || fadeOut < 0 || fadeIn + fadeOut > length + .002)
    throw Error('Audio settings must be volume 0–100% with fades fitting the clip duration.');
}
function fitFades(clip) {
  const duration = clip.source.end - clip.source.start;
  const fadeIn = clip.fade_in || 0, fadeOut = clip.fade_out || 0;
  const scale = fadeIn + fadeOut > duration ? duration / (fadeIn + fadeOut) : 1;
  return { ...clip, fade_in: round(fadeIn * scale), fade_out: round(fadeOut * scale) };
}
function checkpoint(state) {
  return { assets:copy(state.assets),clips:copy(state.clips),audioClips:copy(state.audioClips),
    video2Clips:copy(state.video2Clips),audio2Clips:copy(state.audio2Clips),
    titles:copy(state.titles),audioMix:copy(state.audioMix),name:state.name };
}
function assertLayerPosition(lane, candidate, idToSkip=null) {
  if(!finite(candidate.timeline.start)||candidate.timeline.start<0||
     !finite(candidate.timeline.end)||candidate.timeline.end>86400||
     candidate.timeline.end<=candidate.timeline.start)
    throw Error('Layer clip needs a positive start and end.');
  if(lane.some(c=>c.clip_id!==idToSkip&&
     candidate.timeline.start<c.timeline.end-0.001&&
     candidate.timeline.end>c.timeline.start+0.001))
    throw Error('This layer already has media at that time; move it to an empty section.');
}
function validateVideo2Overlaps(lane) {
  for(let i=0;i<lane.length;i++) {
    const clip=lane[i],seconds=clip.transition_out_seconds??0;
    if(!finite(seconds)||seconds<0||seconds>maxCrossfade(lane,i)+.002)
      throw Error('Invalid V2 crossfade length.');
    if(seconds>0 && ((i>0 && (lane[i-1].transition_out_seconds??0)>0) ||
       (lane[i+1]?.transition_out_seconds??0)>0))
      throw Error('Chained V2 crossfades are not supported yet.');
    if(i>0){
      const before=lane[i-1];
      const overlap=Math.max(0,before.timeline.end-clip.timeline.start);
      const expected=before.transition_out_seconds??0;
      if(Math.abs(overlap-expected)>.003)
        throw Error('V2 overlap must match an explicit crossfade.');
      if(clip.timeline.start<before.timeline.start+0.079 ||
         (i>1 && clip.timeline.start<lane[i-2].timeline.end-.001))
        throw Error('V2 triple overlaps are not supported.');
    } else if(lane.length===1 && seconds>0)
      throw Error('Last V2 clip has no transition partner.');
  }
}
function joinedOverlay(lane,clipId) {
  const index=lane.findIndex(c=>c.clip_id===clipId);
  return index>=0 && ((lane[index].transition_out_seconds??0)>0 ||
    (index>0 && (lane[index-1].transition_out_seconds??0)>0));
}
function assertOverlayStyle(c) {
  if(!['pip','full'].includes(c.overlay_layout??'pip')||
     !OVERLAY_MOTIONS.includes(c.overlay_motion??'none')||
     !finite(c.overlay_opacity??1) || (c.overlay_opacity??1)<0 ||
     (c.overlay_opacity??1)>1 || !finite(c.visual_fade_in??0) ||
     !finite(c.visual_fade_out??0) || (c.visual_fade_in??0)<0||
     (c.visual_fade_out??0)<0||
     (c.visual_fade_in??0)+(c.visual_fade_out??0)>c.source.end-c.source.start+0.002)
    throw Error('Invalid V2 overlay style/fades.');
}
function receipt(action, details = {}) {
  return { receipt_id: id(), action, at: new Date().toISOString(), source: 'human', details };
}
export function change(state, command) {
  validate(state);
  const before = checkpoint(state);
  let assets = copy(state.assets), clips = copy(state.clips), audioClips = copy(state.audioClips), video2Clips=copy(state.video2Clips), audio2Clips=copy(state.audio2Clips), audioMix=copy(state.audioMix), titles = copy(state.titles), name = state.name;
  const { type } = command;
  const laneFor = clipId => [clips,audioClips,video2Clips,audio2Clips].find(
    lane => lane.some(c=>c.clip_id===clipId)) || null;
  if (type === 'asset.added') {
    const a = command.asset;
    if (!a || !a.name || !finite(a.duration) || a.duration < 0.1 || a.duration > 86400) throw Error('Invalid media duration.');
    if (!finite(a.size) || a.size < 0) throw Error('Invalid media size.');
    if (!String(a.type).startsWith('video/') && !String(a.type).startsWith('audio/')) throw Error('R2 accepts video and audio files only.');
    if (!a.asset_id || assets.some(item => item.asset_id === a.asset_id)) throw Error('Missing or duplicate media ID.');
    if (assets.length >= 200) throw Error('This project has reached its 200-file safety limit.');
    assets.push({ asset_id: a.asset_id, name: String(a.name).slice(0, 240), type: a.type,
      size: a.size, lastModified: a.lastModified, duration: round(a.duration) });
  } else if (type === 'clip.appended') {
    const asset = assets.find(item => item.asset_id === command.asset_id);
    if (!asset) throw Error('Media not found.');
    const isAudio = asset.type.startsWith('audio/');
    const lane = isAudio ? audioClips : clips;
    if (lane.length >= 400) throw Error('This track has reached its 400-clip safety limit.');
    lane.push({ clip_id: id(), asset_id: asset.asset_id, track_id: isAudio ? 'audio-1' : 'video-1',
      timeline: { start: 0, end: 0 }, source: { start: 0, end: asset.duration }, enabled: true, effects: [], volume: 1, fade_in: 0, fade_out: 0,
      ...(isAudio ? {} : { source_audio_muted: false }) });
  } else if (type === 'clip.source.inserted') {
    // Three-point source edit: Source IN + OUT, and Program playhead as V1 insertion.
    // A cut in an existing V1 clip is split into source-contiguous halves.
    const asset=assets.find(a=>a.asset_id===command.asset_id);
    if(!asset?.type.startsWith('video/'))throw Error('Source insertion requires a video asset.');
    const from=Number(command.start),to=Number(command.end),at=Number(command.at);
    if(!finite(from)||!finite(to)||from<0||to>asset.duration+.001||to-from<.08)
      throw Error('Select a valid Source IN/OUT range of at least 0.08 seconds.');
    if(!finite(at)||at<0||at>duration(state)+.002)throw Error('Insert playhead must be inside V1.');
    if(crossfadeAt(state,at))throw Error('Insert cannot split an active crossfade. Seek outside the dissolve.');
    if(clips.length>=398)throw Error('V1 needs room to insert or split clips.');
    const insertion={clip_id:id(),asset_id:asset.asset_id,track_id:'video-1',
      timeline:{start:0,end:0},source:{start:round(from),end:round(to)},
      enabled:true,effects:[],volume:1,fade_in:0,fade_out:0,source_audio_muted:false,
      transition_out_seconds:0};
    const t=round(at);
    const index=clips.findIndex(clip=>Math.abs(clip.timeline.start-t)<.004);
    if(index>=0)clips.splice(index,0,insertion);
    else if(Math.abs(t-duration(state))<.004)clips.push(insertion);
    else {
      const n=clips.findIndex(clip=>t>clip.timeline.start+.079&&t<clip.timeline.end-.079);
      if(n<0)throw Error('Place V1 playhead at a cut or safely inside a clip.');
      const original=clips[n],sourceAt=round(original.source.start+t-original.timeline.start);
      const inFade=n>0?(clips[n-1].transition_out_seconds||0):0;
      const outFade=original.transition_out_seconds||0;
      if(sourceAt-original.source.start<inFade+.079 ||
        original.source.end-sourceAt<outFade+.079)
        throw Error('Insert is too close to a V1 transition; move playhead away.');
      const left={...original,clip_id:id(),
        source:{start:original.source.start,end:sourceAt},transition_out_seconds:0};
      const right={...original,clip_id:id(),
        source:{start:sourceAt,end:original.source.end}};
      clips.splice(n,1,fitFades(left),insertion,fitFades(right));
    }
  } else if (type === 'clip.source.replaced') {
    // Explicit selected-clip source replacement. Ripple downstream as necessary;
    // not a general four-point Premiere overwrite across multiple clips.
    const asset=assets.find(a=>a.asset_id===command.asset_id);
    if(!asset?.type.startsWith('video/'))throw Error('Source replacement requires video.');
    const clip=clips.find(c=>c.clip_id===command.clip_id);
    if(!clip)throw Error('Select a V1 clip to replace.');
    const from=Number(command.start),to=Number(command.end);
    if(!finite(from)||!finite(to)||from<0||to>asset.duration+.001||to-from<.08)
      throw Error('Select valid Source IN/OUT for replacement.');
    clip.asset_id=asset.asset_id;
    clip.source={start:round(from),end:round(to)};
    clip.volume=1;clip.fade_in=0;clip.fade_out=0;clip.source_audio_muted=false;
    clip.transition_out_seconds=0;
    // Adjacent crossfades are cleared explicitly rather than silently clamped.
    const n=clips.indexOf(clip);
    if(n>0)clips[n-1].transition_out_seconds=0;
  } else if (type === 'mixer.updated') {
    if(!['a1','a2'].includes(command.lane))throw Error('Mixer supports A1 and A2 only.');
    audioMix[command.lane]={gain:command.gain,muted:command.muted,solo:command.solo};
    validateAudioMix(audioMix);
  } else if (type === 'mixer.duck.updated') {
    if(typeof command.enabled!=='boolean')throw Error('Ducking must be enabled or disabled.');
    audioMix.duckA1=command.enabled;
  } else if (type === 'clip.layer.added') {
    const asset=assets.find(a=>a.asset_id===command.asset_id);
    if (!asset) throw Error('Media not found.');
    const track=command.track_id;
    if(!['video-2','audio-2'].includes(track)||
        !asset.type.startsWith(track==='video-2'?'video/':'audio/'))
      throw Error('Choose a compatible V2 or A2 track.');
    const lane=track==='video-2'?video2Clips:audio2Clips;
    if(lane.length>=80)throw Error('Layer has reached its 80-clip limit.');
    const start=command.start;
    if(!finite(start)||start<0||start>=86400)throw Error('Invalid layer start time.');
    const end=round(start+asset.duration);
    const clip={clip_id:id(),asset_id:asset.asset_id,track_id:track,
      timeline:{start:round(start),end},source:{start:0,end:asset.duration},
      enabled:true,effects:[],volume:1,fade_in:0,fade_out:0,
      ...(track==='video-2'?{source_audio_muted:true,overlay_layout:'pip',
        overlay_opacity:1,visual_fade_in:0,visual_fade_out:0,overlay_motion:'none'}:{})};
    assertLayerPosition(lane,clip);
    lane.push(clip);
    lane.sort((a,b)=>a.timeline.start-b.timeline.start);
  } else if (type === 'clip.overlay.transition.updated') {
    const index=video2Clips.findIndex(c=>c.clip_id===command.clip_id);
    if(index<0||index>=video2Clips.length-1)
      throw Error('Select a V2 clip with a following V2 clip.');
    const max=maxOverlayCrossfade(video2Clips,index);
    const prior=video2Clips[index].transition_out_seconds??0;
    if(Math.abs(video2Clips[index+1].timeline.start+prior-video2Clips[index].timeline.end)>.004)
      throw Error('V2 dissolve requires two touching clips. Move them together first.');
    const seconds=command.seconds;
    if(!finite(seconds)||seconds<0||seconds>max+.0001)
      throw Error('V2 dissolve must fit two touching clips; maximum '+max+' seconds.');
    const outgoing=video2Clips[index],incoming=video2Clips[index+1];
    const start=round(outgoing.timeline.end-seconds);
    incoming.timeline={start,end:round(start+incoming.source.end-incoming.source.start)};
    outgoing.transition_out_seconds=round(seconds);
    validateVideo2Overlaps(video2Clips);
  } else if (type === 'clip.layer.moved') {
    const lane=laneFor(command.clip_id);
    const clip=lane?.find(c=>c.clip_id===command.clip_id);
    if(!clip||!['video-2','audio-2'].includes(clip.track_id))
      throw Error('Only V2/A2 clips can be moved to absolute times.');
    if(clip.track_id==='video-2'&&joinedOverlay(video2Clips,clip.clip_id))
      throw Error('Remove the V2 dissolve before moving its clips.');
    const start=command.start;
    if(!finite(start)||start<0||start+clip.source.end-clip.source.start>86400)
      throw Error('Invalid layer start time.');
    const candidate={...clip,timeline:{start:round(start),
      end:round(start+clip.source.end-clip.source.start)}};
    assertLayerPosition(lane,candidate,clip.clip_id);
    Object.assign(clip,candidate);
    lane.sort((a,b)=>a.timeline.start-b.timeline.start);
  } else if (type === 'clip.overlay.updated') {
    const clip=video2Clips.find(c=>c.clip_id===command.clip_id);
    if(!clip)throw Error('Overlay styling is only available for V2 clips.');
    Object.assign(clip,{overlay_layout:command.layout,overlay_opacity:command.opacity,
      visual_fade_in:command.fade_in,visual_fade_out:command.fade_out,
      overlay_motion:command.motion??'none'});
    assertOverlayStyle(clip);
  } else if (type === 'clip.trimmed') {
    const c = laneFor(command.clip_id)?.find(item => item.clip_id === command.clip_id);
    if (!c) throw Error('Select a clip first.');
    if(c.track_id==='video-2'&&joinedOverlay(video2Clips,c.clip_id))
      throw Error('Remove the V2 dissolve before trimming its clips.');
    const asset = assets.find(a => a.asset_id === c.asset_id);
    const start = Number(command.start), end = Number(command.end);
    if (!finite(start) || !finite(end) || start < 0 || end > asset.duration + 0.001 || end - start < 0.08) {
      throw Error('In/out must be inside the source and at least 0.08 seconds apart.');
    }
    c.source = { start: round(start), end: round(end) };
    Object.assign(c, fitFades(c));
    if(c.track_id==='video-2') {
      const max=c.source.end-c.source.start;
      const sum=(c.visual_fade_in||0)+(c.visual_fade_out||0);
      if(sum>max){const scale=max/sum;c.visual_fade_in=round(c.visual_fade_in*scale);
        c.visual_fade_out=round(c.visual_fade_out*scale);}
    }
    if(['video-2','audio-2'].includes(c.track_id)) {
      c.timeline.end=round(c.timeline.start+c.source.end-c.source.start);
      assertLayerPosition(laneFor(c.clip_id),c,c.clip_id);
    }
  } else if (type === 'clip.source-audio.muted') {
    const clip = [...clips,...video2Clips].find(item => item.clip_id === command.clip_id);
    if (!clip) throw Error('Source audio mute is available only for video clips.');
    if (typeof command.muted !== 'boolean') throw Error('Source audio mute must be true or false.');
    clip.source_audio_muted = command.muted;
  } else if (type === 'clip.transition.updated') {
    const index = clips.findIndex(c=>c.clip_id === command.clip_id);
    if (index < 0 || index >= clips.length-1) throw Error('Select a video clip with a following video.');
    const seconds = command.seconds;
    if (!finite(seconds) || seconds < 0 || seconds > maxCrossfade(clips,index) + 0.0001)
      throw Error('Crossfade must fit both adjacent clips (maximum '+maxCrossfade(clips,index)+' seconds).');
    clips[index].transition_out_seconds = round(seconds);
  } else if (type === 'clip.audio.updated') {
    const clip = laneFor(command.clip_id)?.find(c => c.clip_id === command.clip_id);
    if (!clip) throw Error('Select a clip first.');
    const length = clip.source.end - clip.source.start;
    assertAudioValues(command.volume, command.fade_in, command.fade_out, length);
    clip.volume = round(command.volume);
    clip.fade_in = round(command.fade_in);
    clip.fade_out = round(command.fade_out);
  } else if (type === 'title.added') {
    if (titles.length >= 40) throw Error('R3 supports up to 40 title overlays.');
    const fresh = titleFromInput(command.title, id());
    titles.push(fresh);
    titles.sort((a,b) => a.start - b.start);
  } else if (type === 'title.updated') {
    const index = titles.findIndex(t => t.title_id === command.title_id);
    if (index < 0) throw Error('Title not found.');
    titles[index] = titleFromInput(command.title, command.title_id);
    titles.sort((a,b) => a.start - b.start);
  } else if (type === 'title.deleted') {
    if (!titles.some(t => t.title_id === command.title_id)) throw Error('Title not found.');
    titles = titles.filter(t => t.title_id !== command.title_id);
  } else if (type === 'clip.split') {
    const lane = laneFor(command.clip_id);
    if (!lane) throw Error('Select a clip first.');
    const index = lane.findIndex(item => item.clip_id === command.clip_id);
    const c = lane[index], t = Number(command.time);
    if(lane===video2Clips&&joinedOverlay(video2Clips,c.clip_id))
      throw Error('Remove the V2 dissolve before splitting its clips.');
    const offset = t - c.timeline.start;
    if (!finite(t) || offset < 0.08 || c.timeline.end - t < 0.08) throw Error('Move the playhead inside the clip to split.');
    if(lane===clips) {
      const atFade=crossfadeAt(state,t);
      if(atFade)throw Error('Razor cannot split an active V1 dissolve. Cut outside the transition.');
      const earlier=index>0?(clips[index-1].transition_out_seconds||0):0;
      const later=c.transition_out_seconds||0;
      if(offset<earlier+.08 || c.timeline.end-t<later+.08)
        throw Error('Razor cut is too near a V1 crossfade.');
    }
    const at = round(c.source.start + offset);
    const first = fitFades({ ...c, clip_id: id(), source: { start: c.source.start, end: at },
      ...(lane === clips ? {transition_out_seconds:0} : {}) });
    const second = fitFades({ ...c, clip_id: id(), source: { start: at, end: c.source.end } });
    if(lane===video2Clips||lane===audio2Clips){
      first.timeline={start:c.timeline.start,end:round(t)};
      second.timeline={start:round(t),end:c.timeline.end};
      if(lane===video2Clips){
        for(const part of [first,second]){
          const len=part.source.end-part.source.start, sum=(part.visual_fade_in||0)+(part.visual_fade_out||0);
          if(sum>len){part.visual_fade_in=round(part.visual_fade_in*len/sum);
            part.visual_fade_out=round(part.visual_fade_out*len/sum);}
        }
      }
    }
    lane.splice(index, 1, first, second);
  } else if (type === 'clip.moved' || type === 'clip.reordered') {
    const lane = laneFor(command.clip_id);
    if (!lane) throw Error('Select a clip first.');
    if(lane===video2Clips||lane===audio2Clips)throw Error('Layered clips use Start Time to move, not ripple order.');
    const index = lane.findIndex(item => item.clip_id === command.clip_id);
    if (type === 'clip.moved') {
      const nextIndex = index + command.step;
      if (![-1, 1].includes(command.step) || nextIndex < 0 || nextIndex >= lane.length) throw Error('Cannot move clip farther.');
      [lane[index], lane[nextIndex]] = [lane[nextIndex], lane[index]];
    } else {
      if (command.clip_id === command.target_id) throw Error('Drop onto a different clip.');
      if (!lane.some(c => c.clip_id === command.target_id)) throw Error('Clip reorder must stay on the same track.');
      const [clip] = lane.splice(index, 1);
      const targetIndex = lane.findIndex(c => c.clip_id === command.target_id);
      lane.splice(targetIndex + (command.after ? 1 : 0), 0, clip);
    }
  } else if (type === 'clip.deleted') {
    if (!laneFor(command.clip_id)) throw Error('Clip not found.');
    if(joinedOverlay(video2Clips,command.clip_id))
      throw Error('Remove the V2 dissolve before deleting either clip.');
    clips = clips.filter(item => item.clip_id !== command.clip_id);
    audioClips = audioClips.filter(item => item.clip_id !== command.clip_id);
    video2Clips = video2Clips.filter(item => item.clip_id !== command.clip_id);
    audio2Clips = audio2Clips.filter(item => item.clip_id !== command.clip_id);
  } else if (type === 'project.renamed') {
    name = String(command.name || '').trim().slice(0, 100);
    if (!name) throw Error('Project name cannot be empty.');
  } else throw Error('Unknown studio edit.');
  clips = reflow(normalizeTransitions(clips), 'video-1');
  audioClips = reflow(audioClips, 'audio-1');
  const next = { ...state, assets, clips, audioClips, video2Clips, audio2Clips, audioMix, titles, name, undo: [...state.undo.slice(-39), before], redo: [],
    receipts: [...state.receipts, receipt(type, { clip_id: command.clip_id || null,
      asset_id: command.asset_id || command.asset?.asset_id || null,
      ...(type === 'clip.source.inserted'||type === 'clip.source.replaced' ?
        {source_in:command.start,source_out:command.end,at:command.at??null,source_edit:'video-1'} : {}),
      ...(type === 'clip.source-audio.muted' ? { muted: command.muted } : {}),
      ...(type === 'clip.audio.updated' ? { volume: command.volume, fade_in: command.fade_in, fade_out: command.fade_out } : {}),
      ...(type === 'clip.transition.updated'||type === 'clip.overlay.transition.updated' ? {seconds:command.seconds} : {}),
      ...(type==='mixer.updated'?{lane:command.lane,gain:command.gain,muted:command.muted,solo:command.solo}:{}),
      ...(type==='mixer.duck.updated'?{enabled:command.enabled}:{}),
      ...(type==='clip.layer.added'||type==='clip.layer.moved'?{start:command.start,track_id:command.track_id||null}:{}),
      ...(type === 'title.added' || type === 'title.updated' ? { title: command.title.text.slice(0,100) } : {}) })] };
  validate(next);
  return next;
}
export function undo(state) {
  if (!state.undo.length) return state;
  const old = state.undo[state.undo.length - 1];
  return { ...state, ...copy(old), undo: state.undo.slice(0, -1), redo: [...state.redo, checkpoint(state)],
    receipts: [...state.receipts, receipt('edit.undone')] };
}
export function redo(state) {
  if (!state.redo.length) return state;
  const next = state.redo[state.redo.length - 1];
  return { ...state, ...copy(next), redo: state.redo.slice(0, -1), undo: [...state.undo, checkpoint(state)],
    receipts: [...state.receipts, receipt('edit.redone')] };
}
export function validate(state) {
  if (!state || !Array.isArray(state.assets) || !Array.isArray(state.clips) || !Array.isArray(state.audioClips) || !Array.isArray(state.video2Clips) || !Array.isArray(state.audio2Clips) || !Array.isArray(state.titles)
      || state.titles.length > 40 || state.assets.length > 200 || state.clips.length > 400 || state.audioClips.length > 400 || state.video2Clips.length > 80 || state.audio2Clips.length > 80) {
    throw Error('Invalid ParaCut draft.');
  }
  validateAudioMix(state.audioMix);
  const ids = new Set();
  for (const a of state.assets) {
    if (!a || typeof a.asset_id !== 'string' || !a.asset_id || ids.has(a.asset_id)
        || typeof a.name !== 'string' || !finite(a.duration) || a.duration < 0.1 || a.duration > 86400
        || !finite(a.size) || a.size < 0 || !/^(audio|video)\//.test(a.type)) throw Error('Invalid media reference.');
    ids.add(a.asset_id);
  }
  const clipIds = new Set();
  // Verify transition ranges and that stored positions reflect the overlaps.
  for (let i=0;i<state.clips.length;i++) {
    const seconds=state.clips[i].transition_out_seconds ?? 0;
    if (!finite(seconds) || seconds < 0 || seconds > maxCrossfade(state.clips,i)+.0001)
      throw Error('Invalid crossfade duration.');
  }
  for (const [lane, trackId, kind] of [[state.clips, 'video-1','video/'],
    [state.audioClips, 'audio-1','audio/'],[state.video2Clips,'video-2','video/'],
    [state.audio2Clips,'audio-2','audio/']]) {
    const normalized = reflow(lane, trackId);
    for (let i = 0; i < lane.length; i++) {
      const c = lane[i], a = state.assets.find(item => item.asset_id === c?.asset_id);
      if (!a || !a.type.startsWith(kind) || c.track_id !== trackId) throw Error('Invalid ' + kind.slice(0, -1) + ' reference.');
      if (!c.clip_id || clipIds.has(c.clip_id)) throw Error('Duplicate clip ID.');
      if (c.source_audio_muted !== undefined &&
          (!trackId.startsWith('video-') || typeof c.source_audio_muted !== 'boolean')) {
        throw Error('Invalid source audio mute flag.');
      }
      const seconds = c.source?.end - c.source?.start;
      assertAudioValues(c.volume === undefined ? 1 : c.volume,
        c.fade_in === undefined ? 0 : c.fade_in,
        c.fade_out === undefined ? 0 : c.fade_out, seconds);
      if(trackId==='video-2')assertOverlayStyle(c);
      if(trackId==='video-2'||trackId==='audio-2'){
        if(trackId==='audio-2')assertLayerPosition(lane,c,c.clip_id);
        if(i>0&&lane[i-1].timeline.start>c.timeline.start)throw Error('Layer clips must be sorted.');
      }
      clipIds.add(c.clip_id);
      if (!finite(c.source?.start) || !finite(c.source?.end) || c.source.start < 0
          || c.source.end > a.duration + 0.002 || c.source.end - c.source.start < 0.079) throw Error('Invalid clip source range.');
      if (!finite(c.timeline?.start) || !finite(c.timeline?.end)
          || (trackId==='video-1'||trackId==='audio-1') &&
          (Math.abs(c.timeline.start-normalized[i].timeline.start)>0.003 ||
           Math.abs(c.timeline.end-normalized[i].timeline.end)>0.003) ||
          (trackId==='video-2'||trackId==='audio-2') &&
          Math.abs(c.timeline.end-c.timeline.start-(c.source.end-c.source.start))>0.003) throw Error('Timeline is not sequential.');
    }
  }
  validateVideo2Overlaps(state.video2Clips);
  const titleIds = new Set();
  for (const title of state.titles) {
    validateTitle(title);
    if (titleIds.has(title.title_id)) throw Error('Duplicate title ID.');
    titleIds.add(title.title_id);
  }
  return true;
}
export function exportDraft(state) {
  validate(state);
  const { name, assets, clips, audioClips, video2Clips, audio2Clips, audioMix, titles, receipts } = state;
  return JSON.stringify({ schema: DRAFT_SCHEMA, name, assets, clips, audioClips, video2Clips, audio2Clips, audioMix, titles, receipts: receipts.slice(-500),
    note: 'Media files are NOT embedded. Relink the originals when reopening.' }, null, 2);
}
export function importDraft(json) {
  if (String(json).length > 4_000_000) throw Error('Draft file is too large.');
  const input = JSON.parse(json);
  if (![DRAFT_SCHEMA, PREVIOUS_DRAFT_SCHEMA, LEGACY_DRAFT_SCHEMA].includes(input.schema)) throw Error('Not a ParaCut Studio draft.');
  const state = { schema: DRAFT_SCHEMA, name: String(input.name || 'Recovered Cut').slice(0, 100),
    assets: input.assets, clips: input.clips, audioClips: input.schema === LEGACY_DRAFT_SCHEMA ? [] : input.audioClips,
    titles: input.schema === DRAFT_SCHEMA ? input.titles : [],
    video2Clips: input.video2Clips === undefined ? [] : input.video2Clips,
    audio2Clips: input.audio2Clips === undefined ? [] : input.audio2Clips,
    audioMix: input.audioMix === undefined ? defaultAudioMix() : input.audioMix, receipts: Array.isArray(input.receipts) ? input.receipts.filter(r => r && typeof r === 'object' && typeof r.action === 'string').slice(-500) : [],
    undo: [], redo: [] };
  validate(state);
  state.receipts.push(receipt('project.draft.opened', { imported_receipts_unverified: true }));
  return state;
}
