import { newStudio, change, undo, redo, duration, activeClip, activeAudioClip, activeOverlayClip, activeAudio2Clip, overlayOpacityAt, overlayMotionAt, isSourceAudioMuted, audioLevelAt, audioMixLevelAt, visibleTitle, titleStyle, titleOpacityAt, crossfadeAt, maxCrossfade, snapLayerTime, exportDraft, importDraft } from './studio-core.js';
import { extractWaveform, paintWaveform } from './studio-waveform.js';
import { findRecorderMime, recorderOutputFormat, checkExportContainer, expectedMime } from './studio-export-format.js';

const $ = id => document.getElementById(id);
let state = newStudio();
let selectedId = null, playhead = 0, playing = false, exporting = false, cancelExport = false, seekSerial = 0;
let activeExportFormat = null;
let timelineZoom=1; // local interface preference, not saved into media drafts
function timelineExtent(){
  return Math.max(duration(state),state.audioClips.at(-1)?.timeline.end||0,
    state.video2Clips.at(-1)?.timeline.end||0,
    state.audio2Clips.at(-1)?.timeline.end||0,
    ...state.titles.map(t=>t.end),.01);
}
function updateStoryPlayhead() {
  const total=timelineExtent(),line=$('storyboard-playhead');
  line.style.display=state.clips.length?'block':'none';
  line.style.left=(100*Math.min(playhead,total)/total)+'%';
}
function snapPlacement(start,span,track,excludeClipId=null) {
  if(!$('snap-enabled').checked) return {start,snapped:false};
  const total=timelineExtent(),px=$('storyboard-canvas').clientWidth||800;
  return snapLayerTime(state,{desiredStart:start,span,trackId:track,excludeClipId,
    extraAnchors:[playhead],threshold:Math.min(.75,Math.max(.05,12*total/px))});
}
function placeOnLayer(command) {
  const isAdd=command.type==='clip.layer.added';
  const clip=isAdd?null:[...state.video2Clips,...state.audio2Clips].find(c=>c.clip_id===command.clip_id);
  const asset=isAdd?state.assets.find(a=>a.asset_id===command.asset_id):null;
  const span=isAdd?asset?.duration:clip?.source.end-clip?.source.start;
  const track=isAdd?command.track_id:clip?.track_id;
  if(!Number.isFinite(span)||!track)return status('Select compatible layer media.',true);
  const snapped=snapPlacement(command.start,span,track,clip?.clip_id||null);
  const previous=state.receipts.length;
  edit({...command,start:snapped.start});
  $('snap-feedback').textContent = state.receipts.length>previous && snapped.snapped
    ? 'Snapped '+snapped.edge+' to '+fmt(snapped.anchor) : '';
}
const media = new Map(); // asset_id -> {file, url}; NEVER stored in JSON or uploaded
const video = $('preview-video');
const crossfadeVideo = $('crossfade-video');
const overlayVideo = $('overlay-video');
overlayVideo.preload = 'auto';
const audio2Player = document.createElement('audio');
audio2Player.preload = 'auto';
let layerVideoSerial=0,layerAudioSerial=0;
crossfadeVideo.preload = 'auto';
let previewTransitionSerial = 0, loadingTransition = null, transitionFrameHandle = 0;
let encoderVideo = document.createElement('video'); // fresh element per export
const soundtrack = document.createElement('audio');
soundtrack.preload = 'auto'; soundtrack.volume = .85;
const waveforms = new Map();
let soundSerial = 0;
let draggedClipId = null;
let editingTitleId = null;
const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const fmt = seconds => {
  const n = Math.max(0, Number(seconds) || 0);
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(Math.floor(n % 60)).padStart(2, '0')}.${String(Math.floor((n % 1) * 1000)).padStart(3, '0')}`;
};
const status = (message, error = false) => {
  $('status').textContent = message;
  $('status').className = error ? 'error' : '';
};
const uuid = () => globalThis.crypto?.randomUUID?.() || `media-${Date.now()}-${Math.random().toString(36).slice(2)}`;
function download(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
function clearMedia() {
  for (const entry of media.values()) URL.revokeObjectURL(entry.url);
  media.clear(); waveforms.clear();
  soundtrack.pause(); soundtrack.removeAttribute('src'); soundtrack.load(); delete soundtrack.dataset.clip;
  video.pause(); video.removeAttribute('src'); video.load(); delete video.dataset.asset; delete video.dataset.clip;
  ++previewTransitionSerial; loadingTransition = null;
  crossfadeVideo.pause(); crossfadeVideo.removeAttribute('src'); crossfadeVideo.load();
  delete crossfadeVideo.dataset.clip; crossfadeVideo.style.display='none';
  ++layerVideoSerial; ++layerAudioSerial;
  for(const el of [overlayVideo,audio2Player]){
    el.pause(); el.removeAttribute('src');el.load();delete el.dataset.clip;
  }
  overlayVideo.style.display='none';
}
function updateTimeUI() {
  const d = duration(state);
  $('current-time').textContent = fmt(playhead);
  $('total-time').textContent = fmt(d);
  $('timeline-total').textContent = fmt(d);
  $('seek').max = String(Math.max(d, 0.001));
  $('seek').value = String(Math.min(playhead, d));
  $('play').textContent = playing ? '❚❚' : '▶';
  showTitleAt(playhead);
  updateStoryPlayhead();
}
function drawMedia() {
  const list = $('media-list'); list.replaceChildren();
  $('asset-count').textContent = state.assets.length + ' files';
  for (const asset of state.assets) {
    const linked = media.has(asset.asset_id);
    const div = document.createElement('div'); div.className = 'media-item' + (linked ? '' : ' missing');
    const name = document.createElement('div');
    const isAudio = asset.type.startsWith('audio/');
    name.innerHTML = '<strong>' + esc(asset.name) + '</strong><small>' +
      (isAudio ? 'AUDIO · ' : 'VIDEO · ') + fmt(asset.duration) + ' · ' +
      (linked ? 'Ready' : 'Relink required') + '</small>';
    if (isAudio && waveforms.has(asset.asset_id)) {
      const canvas = document.createElement('canvas'); canvas.className = 'waveform';
      name.append(canvas);
      requestAnimationFrame(() => paintWaveform(canvas, waveforms.get(asset.asset_id)));
    }
    const add = document.createElement('button');
    add.textContent = '+'; add.className = 'add'; add.title = isAudio ? 'Append to soundtrack' : 'Append to video track';
    add.disabled = !linked || exporting;
    add.addEventListener('click', () => edit({ type:'clip.appended', asset_id: asset.asset_id }));
    const layer=document.createElement('button');
    layer.className='add layer-add';layer.textContent=isAudio?'+A2':'+V2';
    layer.title=isAudio?'Place audio on A2 at the playhead':'Place video overlay on V2 at the playhead';
    layer.disabled=!linked||exporting;
    layer.addEventListener('click',()=>placeOnLayer({type:'clip.layer.added',
      asset_id:asset.asset_id,track_id:isAudio?'audio-2':'video-2',start:playhead}));
    div.append(name,add,layer);list.append(div);
  }
}
function drawPrecisionRuler(total,width) {
  const el=$('precision-ruler'); el.replaceChildren();
  const ideal=65*total/Math.max(width,1);
  const intervals=[.1,.25,.5,1,2,5,10,15,30,60,120,300,600,1800,3600];
  const every=intervals.find(n=>n>=ideal)||3600;
  const maxTicks=Math.min(100,Math.floor(total/every)+1);
  for(let i=0;i<maxTicks;i++){
    const at=Math.round(i*every*1000)/1000;
    const tick=document.createElement('button');tick.type='button';
    tick.className='precision-tick';tick.style.left=String(100*at/total)+'%';
    tick.textContent=fmt(at).slice(0,-4);
    tick.title='Seek to '+fmt(at);tick.disabled=exporting;
    tick.addEventListener('click',()=>{stopPlayback();void seekTo(Math.min(at,duration(state)));});
    el.append(tick);
  }
}
function drawTimeline() {
  const lanes = [
    { el: $('timeline-track'), clips: state.clips, empty: 'Your video timeline is empty. Add video files.' },
    { el: $('audio-track'), clips: state.audioClips, empty: 'Add audio files for soundtrack or voiceover.' },
  ];
  const total=timelineExtent();
  const viewport=$('storyboard-scroll');
  const width=Math.round(Math.max(700,viewport.clientWidth-16)*timelineZoom);
  $('storyboard-canvas').style.width=width+'px';
  drawPrecisionRuler(total,width);
  for (const lane of lanes) {
    lane.el.replaceChildren();
    if (!lane.clips.length) {
      const msg = document.createElement('div'); msg.className = 'empty-timeline'; msg.textContent = lane.empty;
      lane.el.append(msg); continue;
    }
    for (const clip of lane.clips) {
      const asset = state.assets.find(a => a.asset_id === clip.asset_id);
      const isAudio = clip.track_id === 'audio-1';
      const item = document.createElement('button');
      item.type = 'button'; item.className = 'timeline-clip' + (isAudio ? ' audio' : '') + (clip.clip_id === selectedId ? ' selected' : '') + (isSourceAudioMuted(clip) ? ' source-muted' : '') + (clip.transition_out_seconds ? ' has-transition' : '');
      item.draggable = !exporting;
      item.style.left=String(100*clip.timeline.start/total)+'%';
      item.style.width=String(Math.max(.3,100*(clip.timeline.end-clip.timeline.start)/total))+'%';
      item.setAttribute('aria-pressed', String(clip.clip_id === selectedId));
      item.title = (asset?.name || 'Missing file') + ' · ' + fmt(clip.timeline.start) + ' to ' + fmt(clip.timeline.end);
      const label = document.createElement('span'); label.textContent = asset?.name || 'Missing file';
      const time = document.createElement('small'); time.textContent = fmt(clip.timeline.end - clip.timeline.start);
      item.append(label, time);
      if (!isAudio && clip.transition_out_seconds > 0) {
        const badge = document.createElement('small');
        badge.className = 'transition-caption';
        badge.textContent = '⇄ '+clip.transition_out_seconds.toFixed(2)+'s';
        item.append(badge);
      }
      if (isSourceAudioMuted(clip)) {
        const mutedLabel = document.createElement('small');
        mutedLabel.className = 'muted-indicator';
        mutedLabel.textContent = '🔇 Original muted';
        item.append(mutedLabel);
      }
      if (isAudio && waveforms.has(clip.asset_id)) {
        const canvas = document.createElement('canvas'); canvas.className = 'waveform'; item.append(canvas);
        requestAnimationFrame(() => paintWaveform(canvas, waveforms.get(clip.asset_id)));
      }
      item.addEventListener('click', () => {
        selectedId = clip.clip_id; drawTimeline(); drawInspector();
        void seekTo(Math.min(clip.timeline.start, duration(state)), { autoplay: playing });
      });
      item.addEventListener('dragstart', event => {
        draggedClipId = clip.clip_id;
        event.dataTransfer?.setData('text/plain', clip.clip_id);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragover', event => {
        if (!draggedClipId || draggedClipId === clip.clip_id) return;
        const source = lane.clips.find(c => c.clip_id === draggedClipId);
        if (!source) return; // no accidental cross-track move
        event.preventDefault(); item.classList.add('drag-target');
      });
      item.addEventListener('dragleave', () => item.classList.remove('drag-target'));
      item.addEventListener('drop', event => {
        event.preventDefault(); item.classList.remove('drag-target');
        if (!draggedClipId || draggedClipId === clip.clip_id) return;
        const after = event.clientX > item.getBoundingClientRect().left + item.clientWidth / 2;
        const fromId = draggedClipId; draggedClipId = null;
        edit({ type:'clip.reordered', clip_id:fromId, target_id:clip.clip_id, after });
      });
      item.addEventListener('dragend', () => {
        draggedClipId = null; document.querySelectorAll('.drag-target').forEach(el => el.classList.remove('drag-target'));
      });
      lane.el.append(item);
    }
  }
  const layerTotal=total;
  for(const [el,clips,kind] of [
    [$('video2-track'),state.video2Clips,'video'],
    [$('audio2-track'),state.audio2Clips,'audio']]){
    el.replaceChildren();
    if(!clips.length){const hint=document.createElement('span');
      hint.className='empty-timeline';hint.textContent='No '+kind+' overlays yet. Add a clip with +'+(kind==='video'?'V2':'A2')+'.';el.append(hint);}
    for(const clip of clips){
      const asset=state.assets.find(a=>a.asset_id===clip.asset_id);
      const item=document.createElement('button');
      item.type='button';item.className='layer-clip '+kind+(selectedId===clip.clip_id?' selected':'');
      item.style.left=String(Math.min(100,100*clip.timeline.start/layerTotal))+'%';
      item.style.width=String(Math.max(2,Math.min(100,100*(clip.timeline.end-clip.timeline.start)/layerTotal)))+'%';
      const name=document.createElement('span');
      name.textContent=(asset?.name||'Missing media')+' · '+fmt(clip.timeline.start);
      item.append(name);
      if(kind==='audio'&&waveforms.has(clip.asset_id)){
        const canvas=document.createElement('canvas');canvas.className='waveform';
        item.append(canvas);
        requestAnimationFrame(()=>paintWaveform(canvas,waveforms.get(clip.asset_id)));
      }
      item.title='Start '+fmt(clip.timeline.start)+' · Select, adjust or drag on the storyboard';
      item.addEventListener('click',()=>{selectedId=clip.clip_id;drawTimeline();drawInspector();
        void seekTo(Math.min(clip.timeline.start,duration(state)),{autoplay:playing});});
      item.draggable=!exporting;
      item.addEventListener('dragstart',e=>{e.dataTransfer?.setData('text/plain',clip.clip_id);
        if(e.dataTransfer)e.dataTransfer.effectAllowed='move';});
      el.append(item);
    }
    el.ondragover=event=>event.preventDefault();
    el.ondrop=event=>{
      event.preventDefault();const clip_id=event.dataTransfer?.getData('text/plain');
      if(!clips.some(c=>c.clip_id===clip_id))return;
      const rect=el.getBoundingClientRect();
      const x=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width));
      placeOnLayer({type:'clip.layer.moved',clip_id,start:Math.round(x*layerTotal*10)/10});
    };
  }
}

function showTitleAt(at) {
  const title = visibleTitle(state, at);
  const node = $('title-preview');
  node.hidden = !title;
  node.textContent = title?.text || '';
  if (!title) return;
  const style = titleStyle(title);
  node.dataset.position = style.position;
  node.dataset.size = style.size;
  node.dataset.color = style.color;
  node.style.opacity = String(titleOpacityAt(title, at));
}
function previewAudioAt(at) {
  const v = activeClip(state, Math.min(at, Math.max(0, duration(state) - .001)));
  const a = activeAudioClip(state, at);
  const dissolve = crossfadeAt(state, at);
  video.muted = isSourceAudioMuted(v);
  video.volume = Math.min(1, audioLevelAt(v, at) * audioMixLevelAt(state,'video-1',at) * (dissolve ? 1 - dissolve.progress : 1));
  crossfadeVideo.muted = isSourceAudioMuted(dissolve?.incoming);
  crossfadeVideo.volume = Math.min(1, dissolve ? audioLevelAt(dissolve.incoming, at) * audioMixLevelAt(state,'video-1',at) * dissolve.progress : 0);
  soundtrack.volume = Math.min(1, audioLevelAt(a, at) * audioMixLevelAt(state,'audio-1',at));
  audio2Player.volume = Math.min(1, audioLevelAt(activeAudio2Clip(state,at),at) * audioMixLevelAt(state,'audio-2',at));
  overlayVideo.muted = isSourceAudioMuted(activeOverlayClip(state,at));
  overlayVideo.volume = Math.min(1, audioLevelAt(activeOverlayClip(state,at),at) * audioMixLevelAt(state,'video-2',at));
}
// V2/A2 use independent timeline positions and decoder elements.
async function syncLayerPlayer(el,clip,at,autoplay,kind) {
  if(!clip||at>=duration(state)){
    el.pause();
    if(kind==='video'){el.style.display='none';el.style.transform='none';}
    return;
  }
  const ref=media.get(clip.asset_id);
  if(!ref){el.pause();return;}
  if(el.dataset.clip!==clip.clip_id){
    const serial=kind==='video'?++layerVideoSerial:++layerAudioSerial;
    el.pause();el.src=ref.url;el.dataset.clip=clip.clip_id;el.load();
    try{
      await new Promise((resolve,reject)=>{
        if(el.readyState>=1)return resolve();
        el.addEventListener('loadedmetadata',resolve,{once:true});
        el.addEventListener('error',()=>reject(Error(kind+' layer could not be decoded.')),{once:true});
      });
    }catch(e){status(e.message,true);return;}
    if(serial!==(kind==='video'?layerVideoSerial:layerAudioSerial))return;
  }
  const expected=Math.min(clip.source.end-.005,clip.source.start+at-clip.timeline.start);
  if(Math.abs(el.currentTime-expected)>.16) {
    try{el.currentTime=Math.max(0,expected)}catch{}
  }
  el.volume=Math.min(1,audioLevelAt(clip,at)*audioMixLevelAt(state,clip.track_id,at));
  if(kind==='video'){
    el.muted=isSourceAudioMuted(clip);
    el.style.display='block';
    el.style.opacity=String(overlayOpacityAt(clip,at));
    const motion=overlayMotionAt(clip,at);
    el.style.transform='translate('+motion.x*100+'%,'+motion.y*100+'%)';
    el.classList.toggle('full-overlay',(clip.overlay_layout??'pip')==='full');
  }
  if(autoplay&&playing&&el.paused){
    try{await el.play()}catch(e){status(kind+' layer preview: '+e.message,true);}
  }else if(!autoplay)el.pause();
}
function syncLayers(at,autoplay) {
  void syncLayerPlayer(overlayVideo,activeOverlayClip(state,at),at,autoplay,'video');
  void syncLayerPlayer(audio2Player,activeAudio2Clip(state,at),at,autoplay,'audio');
}
function hideCrossfadePreview() {
  crossfadeVideo.pause();
  crossfadeVideo.style.display = 'none';
  crossfadeVideo.style.opacity = '0';
}
// Loads the next video independently. Its first frames play simultaneously
// with the outgoing clip while the current V1 boundary dissolves.
async function syncCrossfadePreview(at, autoplay) {
  const fade = crossfadeAt(state,at);
  if (!fade) { hideCrossfadePreview(); return; }
  const ref = media.get(fade.incoming.asset_id);
  if (!ref) { hideCrossfadePreview(); return; }
  if (crossfadeVideo.dataset.clip !== fade.incoming.clip_id) {
    if (loadingTransition === fade.incoming.clip_id) return;
    const serial = ++previewTransitionSerial;
    loadingTransition = fade.incoming.clip_id;
    crossfadeVideo.pause(); crossfadeVideo.src = ref.url; crossfadeVideo.dataset.clip = fade.incoming.clip_id; crossfadeVideo.load();
    try {
      await new Promise((resolve, reject) => {
        if (crossfadeVideo.readyState >= 1) return resolve();
        crossfadeVideo.addEventListener('loadedmetadata',resolve,{once:true});
        crossfadeVideo.addEventListener('error',()=>reject(Error('Crossfade video could not be decoded.')),{once:true});
      });
    } catch(e) { status(e.message,true); return; }
    finally { if (serial === previewTransitionSerial) loadingTransition=null; }
    if (serial !== previewTransitionSerial) return;
  }
  const expected = fade.incoming.source.start + at - fade.incoming.timeline.start;
  if (Math.abs(crossfadeVideo.currentTime-expected) > .18) {
    try { crossfadeVideo.currentTime = Math.min(fade.incoming.source.end-.005,expected); } catch {}
  }
  previewAudioAt(at);
  crossfadeVideo.style.opacity=String(fade.progress);
  crossfadeVideo.style.display='block';
  if (autoplay && playing && crossfadeVideo.paused) {
    try { await crossfadeVideo.play(); } catch(e) { status('Crossfade preview: '+e.message,true); }
  } else if (!autoplay) crossfadeVideo.pause();
}
// Motion/opacity interpolates on animation frames, independently of the
// browser's low-frequency video 'timeupdate' events.
function transitionFrame() {
  transitionFrameHandle=0;
  if (!playing) return;
  const current=state.clips.find(c=>c.clip_id===video.dataset.clip);
  if (current) {
    const at=Math.min(current.timeline.end, current.timeline.start + Math.max(0,video.currentTime-current.source.start));
    const fade=crossfadeAt(state,at);
    if (fade) { previewAudioAt(at); void syncCrossfadePreview(at,true); }
    else if (crossfadeVideo.style.display !== 'none') hideCrossfadePreview();
    previewAudioAt(at); syncLayers(at,true);
  }
  transitionFrameHandle=requestAnimationFrame(transitionFrame);
}
function startTransitionFrames() {
  if (!transitionFrameHandle) transitionFrameHandle=requestAnimationFrame(transitionFrame);
}
function loadTitleForEdit(title) {
  editingTitleId = title.title_id;
  $('title-text').value = title.text;
  $('title-start').value = String(title.start);
  $('title-end').value = String(title.end);
  const style = titleStyle(title);
  $('title-position').value = style.position;
  $('title-size').value = style.size;
  $('title-color').value = style.color;
  $('title-fade-in').value = String(style.fade_in);
  $('title-fade-out').value = String(style.fade_out);
  $('add-title').textContent = 'Save Title Changes';
  $('cancel-title-edit').hidden = false;
  drawTitles();
}
function resetTitleEditor() {
  editingTitleId = null;
  $('title-text').value = '';
  $('title-position').value = 'bottom';
  $('title-size').value = 'medium';
  $('title-color').value = 'white';
  $('title-fade-in').value = '0';
  $('title-fade-out').value = '0';
  $('add-title').textContent = '+ Add Text Overlay';
  $('cancel-title-edit').hidden = true;
}
function drawTitles() {
  const list = $('title-list'), track = $('title-track');
  list.replaceChildren(); track.replaceChildren();
  if (!state.titles.length) {
    const empty = document.createElement('span');
    empty.className = 'empty-timeline'; empty.textContent = 'Add timed text in the Titles panel.';
    track.append(empty);
  }
  for (const title of state.titles) {
    const row = document.createElement('div'); row.className = 'title-item' + (title.title_id === editingTitleId ? ' editing' : '');
    const label = document.createElement('span'); label.textContent = title.text;
    const times = document.createElement('small'); times.textContent = fmt(title.start) + ' → ' + fmt(title.end);
    label.append(times);
    const editButton = document.createElement('button'); editButton.type = 'button'; editButton.textContent = 'Edit';
    editButton.title = 'Edit title style and timing'; editButton.disabled = exporting;
    editButton.addEventListener('click', () => loadTitleForEdit(title));
    const del = document.createElement('button'); del.type = 'button'; del.textContent = 'Delete';
    del.title = 'Delete title'; del.disabled = exporting;
    del.addEventListener('click', () => edit({type:'title.deleted',title_id:title.title_id}));
    row.append(label,editButton,del); list.append(row);
    const chip = document.createElement('button'); chip.type='button'; chip.className='title-chip';
    chip.textContent = title.text.length > 28 ? title.text.slice(0,28) + '…' : title.text;
    chip.title = 'Seek to ' + fmt(title.start); chip.disabled = exporting;
    chip.addEventListener('click', () => { stopPlayback(); void seekTo(Math.min(title.start,duration(state))); });
    chip.style.left=String(100*title.start/timelineExtent())+'%';
    chip.style.width=String(Math.max(.3,100*(title.end-title.start)/timelineExtent()))+'%';
    track.append(chip);
  }
}
function drawTitleOnCanvas(ctx, title, at) {
  if (!title) return;
  const style = titleStyle(title);
  const opacity = titleOpacityAt(title, at);
  if (opacity <= 0) return;
  const fontSizes = { small:36, medium:52, large:74 };
  const colors = { white:'#ffffff', mint:'#87f0df', gold:'#ffdd8a' };
  const words = title.text.split(/\s+/);
  ctx.save();
  ctx.globalAlpha = opacity;
  const size = fontSizes[style.size];
  ctx.font = 'bold ' + size + 'px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const lines = [], maxWidth = 1100;
  for (const word of words) {
    const idx = lines.length - 1;
    if (idx < 0 || ctx.measureText(lines[idx] + ' ' + word).width > maxWidth) lines.push(word);
    else lines[idx] += ' ' + word;
  }
  const shown = lines.slice(0,4);
  const center = style.position === 'top' ? 120 : style.position === 'middle' ? 360 : 620;
  const start = center - (shown.length - 1) * (size * 1.08 / 2);
  shown.forEach((line,i) => {
    const y = start + size * 1.08 * i;
    ctx.lineWidth = 8; ctx.strokeStyle = '#000d';
    ctx.strokeText(line, 640, y, maxWidth);
    ctx.fillStyle = colors[style.color]; ctx.fillText(line, 640, y, maxWidth);
  });
  ctx.restore();
}
function drawInspector() {
  const clip = [...state.clips, ...state.audioClips,...state.video2Clips,...state.audio2Clips].find(c => c.clip_id === selectedId);
  $('inspector-fields').hidden = !clip;
  $('inspector-empty').hidden = Boolean(clip);
  if (!clip) return;
  const asset = state.assets.find(a => a.asset_id === clip.asset_id);
  $('selected-name').textContent = asset?.name || 'Unknown asset';
  $('in-time').value = String(clip.source.start);
  $('out-time').value = String(clip.source.end);
  $('in-time').max = String(asset.duration);
  $('out-time').max = String(asset.duration);
  const nextBoundary = state.clips.findIndex(c => c.clip_id === clip.clip_id);
  const transitionAllowed = clip.track_id === 'video-1' && nextBoundary >= 0 && nextBoundary < state.clips.length-1;
  $('transition-control').hidden = !transitionAllowed;
  $('crossfade-seconds').value = String(clip.transition_out_seconds || 0);
  const allowedSeconds = transitionAllowed ? maxCrossfade(state.clips,nextBoundary) : 0;
  $('crossfade-seconds').max = String(allowedSeconds);
  $('apply-crossfade').disabled = exporting || !transitionAllowed;
  $('crossfade-note').textContent = '0 = hard cut · up to '+allowedSeconds.toFixed(2)+' seconds with the next V1 clip.';
  $('clip-volume').value = String(Math.round((clip.volume ?? 1) * 100));
  $('volume-number').textContent = Math.round((clip.volume ?? 1) * 100) + '%';
  $('fade-in').value = String(clip.fade_in ?? 0);
  $('fade-out').value = String(clip.fade_out ?? 0);
  $('apply-audio').disabled = exporting;
  const layerClip=['video-2','audio-2'].includes(clip.track_id);
  $('layer-start-control').hidden=!layerClip;
  $('layer-start').value=String(clip.timeline.start);
  $('apply-layer-start').disabled=exporting||!layerClip;
  $('overlay-style-control').hidden=clip.track_id!=='video-2';
  if(clip.track_id==='video-2'){
    $('overlay-layout').value=clip.overlay_layout??'pip';
    $('overlay-opacity').value=String(Math.round((clip.overlay_opacity??1)*100));
    $('overlay-motion').value=clip.overlay_motion??'none';
    $('overlay-fade-in').value=String(clip.visual_fade_in??0);
    $('overlay-fade-out').value=String(clip.visual_fade_out??0);
  }
  $('apply-overlay-style').disabled=exporting;
  $('source-audio-control').hidden = !clip.track_id.startsWith('video-');
  $('mute-source-audio').checked = isSourceAudioMuted(clip);
  $('mute-source-audio').disabled = exporting;
  $('selected-meta').innerHTML = '<dt>Track</dt><dd>' + ({'video-1':'Video 1','video-2':'Video 2','audio-1':'Audio 1','audio-2':'Audio 2'}[clip.track_id]) + '</dd><dt>Timeline start</dt><dd>' + fmt(clip.timeline.start) +
    '</dd><dt>Clip duration</dt><dd>' + fmt(clip.timeline.end - clip.timeline.start) +
    '</dd><dt>Source length</dt><dd>' + fmt(asset.duration) + '</dd>';
  const lane = {'video-1':state.clips,'video-2':state.video2Clips,'audio-1':state.audioClips,'audio-2':state.audio2Clips}[clip.track_id];
  const index = lane.findIndex(c => c.clip_id === selectedId);
  $('move-left').disabled = index === 0 || exporting || layerClip;
  $('move-right').disabled = index === lane.length - 1 || exporting || layerClip;
}
function drawReceipts() {
  $('receipt-count').textContent = String(state.receipts.length);
  const list = $('receipts'); list.replaceChildren();
  for (const entry of state.receipts.slice(-12).reverse()) {
    const li = document.createElement('li');
    li.textContent = String(entry.action || 'unknown').slice(0, 90) + ' · ' + String(entry.at || '').slice(11, 19);
    list.append(li);
  }
}
function drawMixer() {
  const mix=state.audioMix;
  for(const lane of ['a1','a2']) {
    const settings=mix[lane];
    $('mixer-'+lane+'-gain').value=String(Math.round(settings.gain*100));
    $('mixer-'+lane+'-value').textContent=Math.round(settings.gain*100)+'%';
    $('mixer-'+lane+'-mute').checked=settings.muted;
    $('mixer-'+lane+'-solo').checked=settings.solo;
    $('mixer-'+lane+'-gain').disabled=exporting;
    $('mixer-'+lane+'-mute').disabled=exporting;
    $('mixer-'+lane+'-solo').disabled=exporting;
    const el=document.querySelector('[data-mixer="'+lane+'"]');
    el.dataset.muted=String(settings.muted);
    el.dataset.solo=String(settings.solo);
  }
  $('mixer-duck').checked=mix.duckA1;
  $('mixer-duck').disabled=exporting;
}
function render() {
  $('project-name').value = state.name;
  drawMixer();
  drawMedia(); drawTimeline(); drawInspector(); drawTitles(); drawReceipts(); updateTimeUI();
  previewAudioAt(playhead);
  $('undo').disabled = !state.undo.length || exporting;
  $('redo').disabled = !state.redo.length || exporting;
  $('split').disabled = !selectedId || exporting;
  $('remove').disabled = !selectedId || exporting;
  const canExport = Boolean(state.clips.length) &&
    [...state.clips, ...state.audioClips,...state.video2Clips,...state.audio2Clips].every(c => media.has(c.asset_id));
  const recordingReady = Boolean(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream);
  const mp4Mime = recordingReady ? findRecorderMime('mp4') : null;
  const webmMime = recordingReady ? findRecorderMime('webm') : null;
  $('export-mp4').disabled = (exporting && activeExportFormat !== 'mp4') ||
    (!exporting && (!canExport || !mp4Mime));
  $('export-webm').disabled = (exporting && activeExportFormat !== 'webm') ||
    (!exporting && (!canExport || !webmMime));
  $('export-mp4').title = mp4Mime
    ? 'Export an actual MP4 container using this browser (beta)'
    : 'MP4 encoding is unavailable in this browser. Use WebM export.';
  $('mp4-support').textContent = mp4Mime ? '' :
    'MP4 unavailable here; WebM remains an option.';
  $('preview-label').textContent = selectedId ? 'Selected clip · ' + ([...state.clips, ...state.audioClips,...state.video2Clips,...state.audio2Clips].find(c=>c.clip_id===selectedId)?.clip_id?.slice(0,8) || '') : 'Program';
}
// Playback uses the video playhead as the master clock and keeps the
// independent music/voiceover element within ~150 ms. Browser beta, not frame sync.
let loadingAudioClip = null;
async function syncSoundtrack(at, autoplay) {
  const clip = activeAudioClip(state, Math.min(at, Math.max(0, duration(state) - .001)));
  if (!clip || at >= duration(state)) {
    soundtrack.pause(); soundtrack.dataset.clip = ''; loadingAudioClip = null; ++soundSerial; return;
  }
  const ref = media.get(clip.asset_id);
  if (!ref) { soundtrack.pause(); return; }
  if (soundtrack.dataset.clip !== clip.clip_id) {
    if (loadingAudioClip === clip.clip_id) return;
    const serial = ++soundSerial;
    loadingAudioClip = clip.clip_id;
    soundtrack.pause(); soundtrack.src = ref.url; soundtrack.dataset.clip = clip.clip_id; soundtrack.load();
    try {
      await new Promise((resolve, reject) => {
        if (soundtrack.readyState >= 1) return resolve();
        soundtrack.addEventListener('loadedmetadata', resolve, { once: true });
        soundtrack.addEventListener('error', () => reject(Error('Cannot decode soundtrack.')), { once: true });
      });
    } catch (e) { status(e.message, true); return; }
    finally { if (serial === soundSerial) loadingAudioClip = null; }
    if (serial !== soundSerial) return;
  }
  const expected = clip.source.start + Math.max(0, at - clip.timeline.start);
  if (Math.abs(soundtrack.currentTime - expected) > .15) {
    try { soundtrack.currentTime = Math.min(clip.source.end - .005, expected); } catch {}
  }
  soundtrack.volume = Math.min(1, audioLevelAt(clip, at) * audioMixLevelAt(state,'audio-1',at));
  if (autoplay && playing && soundtrack.paused) {
    try { await soundtrack.play(); } catch (e) { status('Soundtrack preview: ' + e.message, true); }
  } else if (!autoplay) soundtrack.pause();
}
async function seekTo(seconds, { autoplay = false } = {}) {
  const serial = ++seekSerial, d = duration(state);
  playhead = Math.max(0, Math.min(d, Number(seconds) || 0));
  updateTimeUI();
  let clip = activeClip(state, Math.min(playhead, Math.max(0,d-0.001)));
  if (!clip) {
    playing = false; video.pause(); soundtrack.pause(); overlayVideo.pause(); audio2Player.pause(); overlayVideo.style.display='none'; video.style.display = 'none';
    $('empty-preview').hidden = false; updateTimeUI(); return;
  }
  const ref = media.get(clip.asset_id);
  if (!ref) {
    playing = false; video.pause(); soundtrack.pause(); overlayVideo.pause(); audio2Player.pause(); overlayVideo.style.display='none'; video.style.display = 'none';
    $('empty-preview').hidden = false; status('Import the original video to relink the draft.', true);
    updateTimeUI(); return;
  }
  try {
    if (video.dataset.asset !== clip.asset_id) {
      video.pause(); video.src = ref.url; video.dataset.asset = clip.asset_id; video.load();
      await new Promise((resolve, reject) => {
        if (video.readyState >= 1) return resolve();
        video.addEventListener('loadedmetadata', resolve, { once:true });
        video.addEventListener('error', () => reject(Error('Video decode failed.')), { once:true });
      });
    }
    if (serial !== seekSerial) return;
    video.dataset.clip = clip.clip_id;
    // Apply on every seek, even when two clips share the same media asset.
    video.muted = isSourceAudioMuted(clip);
    previewAudioAt(playhead);
    const time = Math.min(clip.source.end - .005, clip.source.start + Math.max(0, playhead - clip.timeline.start));
    if (Math.abs(video.currentTime - time) > .035) video.currentTime = Math.max(0,time);
    video.style.display = 'block'; $('empty-preview').hidden = true;
    if (autoplay && playhead < d - .005) {
      await video.play(); playing = true;
    } else { video.pause(); playing = false; }
    void syncSoundtrack(playhead, playing);
    void syncCrossfadePreview(playhead, playing);
    syncLayers(playhead,playing);
    if (playing) startTransitionFrames();
    updateTimeUI();
  } catch (e) { playing = false; status('Preview failed: ' + e.message, true); updateTimeUI(); }
}
function stopPlayback() {
  playing = false; video.pause(); soundtrack.pause(); overlayVideo.pause(); audio2Player.pause(); hideCrossfadePreview();
  if (transitionFrameHandle) cancelAnimationFrame(transitionFrameHandle);
  transitionFrameHandle=0; updateTimeUI();
}
function edit(command) {
  if (exporting) return status('Finish or cancel export before editing.', true);
  try {
    if (['clip.source-audio.muted','clip.audio.updated','clip.overlay.updated','mixer.updated','mixer.duck.updated','title.added','title.updated','title.deleted'].includes(command.type)) {
      // Audio-only edit: update the currently audible clip without pausing playback.
      state = change(state, command);
      const onScreen = activeClip(state, Math.min(playhead, Math.max(0, duration(state) - .001)));
      video.muted = isSourceAudioMuted(onScreen);
      previewAudioAt(playhead);
      render();
      status(command.type === 'clip.source-audio.muted'
        ? (command.muted ? 'Original video audio muted. A1 stays on.' : 'Original video audio restored.')
        : command.type + ' ✓');
      return;
    }
    stopPlayback();
    state = change(state, command);
    if (selectedId && ![...state.clips, ...state.audioClips,...state.video2Clips,...state.audio2Clips].some(c=>c.clip_id===selectedId)) selectedId = null;
    playhead = Math.min(playhead, duration(state));
    render(); void seekTo(playhead); status(command.type + ' ✓');
  } catch (e) { status(e.message, true); }
}
async function probe(file) {
  const url = URL.createObjectURL(file);
  const test = document.createElement(file.type.startsWith('audio/') ? 'audio' : 'video'); test.preload = 'metadata'; test.src = url;
  try {
    const seconds = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Timed out reading media metadata.')), 15_000);
      test.addEventListener('loadedmetadata', () => { clearTimeout(timer); resolve(test.duration); }, { once:true });
      test.addEventListener('error', () => { clearTimeout(timer); reject(Error('Unsupported media or broken file.')); }, { once:true });
      test.load();
    });
    if (!Number.isFinite(seconds) || seconds < .1 || seconds > 86400) throw Error('Unsupported or unbounded media duration.');
    return { url, seconds };
  } catch (err) { URL.revokeObjectURL(url); throw err; }
}
async function importVideos(files) {
  if (exporting) return;
  for (const file of files) {
    if (!/^(audio|video)\//.test(file.type)) { status('Only audio/video files are supported: ' + file.name, true); continue; }
    try {
      const { url, seconds } = await probe(file);
      const existing = state.assets.find(a => a.name === file.name && a.type === file.type && a.size === file.size && a.lastModified === file.lastModified && !media.has(a.asset_id));
      if (existing) {
        if (Math.abs(existing.duration - seconds) > .5) { URL.revokeObjectURL(url); throw Error('Duration differs from the draft reference.'); }
        media.set(existing.asset_id, { file, url });
        status('Relinked ' + file.name);
      } else {
        const asset_id = uuid();
        state = change(state, { type: 'asset.added', asset: { asset_id, name: file.name,
          size:file.size, type:file.type, duration:seconds, lastModified:file.lastModified } });
        media.set(asset_id, { file, url }); status('Imported ' + file.name);
      }
      const waveId = existing?.asset_id || state.assets.at(-1).asset_id;
      if (file.type.startsWith('audio/')) {
        void extractWaveform(file).then(peaks => {
          if (peaks && media.get(waveId)?.file === file) { waveforms.set(waveId, peaks); render(); }
        }).catch(() => {});
      }
      render(); if (!video.src && state.clips.length) void seekTo(playhead);
    } catch (e) { status(file.name + ': ' + e.message, true); }
  }
}
video.addEventListener('timeupdate', () => {
  if (!playing) return;
  const clip = activeClip(state, playhead);
  if (!clip || video.dataset.asset !== clip.asset_id) return;
  playhead = Math.min(clip.timeline.end, clip.timeline.start + Math.max(0, video.currentTime - clip.source.start));
  updateTimeUI();
  previewAudioAt(playhead);
  void syncSoundtrack(playhead, true);
  void syncCrossfadePreview(playhead,true);
  syncLayers(playhead,true);
  if (video.currentTime >= clip.source.end - .045 || video.ended) {
    if (clip.timeline.end >= duration(state) - .005) { stopPlayback(); playhead = duration(state); updateTimeUI(); }
    else void seekTo(clip.timeline.end + .001, { autoplay:true });
  }
});
video.addEventListener('ended', () => {
  if (!playing) return;
  const clip = activeClip(state, Math.min(playhead, duration(state)-.001));
  if (clip) void seekTo(clip.timeline.end, { autoplay:clip.timeline.end < duration(state)-.001 });
});
$('play').addEventListener('click', async () => {
  if (!state.clips.length) return;
  if (playing) return stopPlayback();
  if (playhead >= duration(state) - .005) playhead = 0;
  await seekTo(playhead, { autoplay:true });
});
$('backward').addEventListener('click', () => { stopPlayback(); void seekTo(0); });
$('forward').addEventListener('click', () => { stopPlayback(); void seekTo(duration(state)); });
$('seek').addEventListener('input', event => { const autoplay = playing; stopPlayback(); void seekTo(Number(event.target.value), { autoplay }); });
$('drop-zone').addEventListener('click', () => $('video-input').click());
$('drop-zone').addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('video-input').click(); } });
$('video-input').addEventListener('change', async e => { await importVideos([...e.target.files]); e.target.value=''; });
for (const kind of ['dragenter', 'dragover']) $('drop-zone').addEventListener(kind, e => { e.preventDefault(); e.currentTarget.classList.add('drag'); });
for (const kind of ['dragleave', 'drop']) $('drop-zone').addEventListener(kind, e => { e.preventDefault(); e.currentTarget.classList.remove('drag'); });
$('drop-zone').addEventListener('drop', e => { void importVideos([...e.dataTransfer.files]); });
$('apply-trim').addEventListener('click', () => edit({ type:'clip.trimmed', clip_id:selectedId, start:Number($('in-time').value), end:Number($('out-time').value) }));
$('clip-volume').addEventListener('input', e => {
  $('volume-number').textContent = e.target.value + '%';
});
$('apply-crossfade').addEventListener('click', () => edit({
  type:'clip.transition.updated',clip_id:selectedId,seconds:Number($('crossfade-seconds').value)
}));
$('apply-layer-start').addEventListener('click',()=>placeOnLayer({type:'clip.layer.moved',
  clip_id:selectedId,start:Number($('layer-start').value)}));
$('apply-overlay-style').addEventListener('click',()=>edit({type:'clip.overlay.updated',
  clip_id:selectedId,layout:$('overlay-layout').value,
  opacity:Number($('overlay-opacity').value)/100,
  fade_in:Number($('overlay-fade-in').value),fade_out:Number($('overlay-fade-out').value),
  motion:$('overlay-motion').value}));
for(const lane of ['a1','a2']) {
  const read=()=>({gain:Number($('mixer-'+lane+'-gain').value)/100,
    muted:$('mixer-'+lane+'-mute').checked,
    solo:$('mixer-'+lane+'-solo').checked});
  // Sliders update their labels immediately, but commit once on change.
  $('mixer-'+lane+'-gain').addEventListener('input',e=>{
    $('mixer-'+lane+'-value').textContent=e.target.value+'%';
  });
  for(const suffix of ['gain','mute','solo']) {
    $('mixer-'+lane+'-'+suffix).addEventListener('change',()=>
      edit({type:'mixer.updated',lane,...read()}));
  }
}
$('mixer-duck').addEventListener('change',e=>
  edit({type:'mixer.duck.updated',enabled:e.target.checked}));
$('apply-audio').addEventListener('click', () => edit({
  type:'clip.audio.updated',clip_id:selectedId,volume:Number($('clip-volume').value)/100,
  fade_in:Number($('fade-in').value),fade_out:Number($('fade-out').value)
}));
$('add-title').addEventListener('click', () => {
  const title = {
    text: $('title-text').value.trim(),
    start: Number($('title-start').value), end: Number($('title-end').value),
    position: $('title-position').value, size: $('title-size').value, color: $('title-color').value,
    fade_in: Number($('title-fade-in').value), fade_out: Number($('title-fade-out').value)
  };
  const wasEditing = editingTitleId;
  const beforeReceipts = state.receipts.length;
  if (wasEditing) edit({type:'title.updated',title_id:wasEditing,title});
  else edit({type:'title.added',title});
  // Only clear editor following a committed, validated change.
  if (state.receipts.length > beforeReceipts) { resetTitleEditor(); drawTitles(); }
});
$('cancel-title-edit').addEventListener('click', () => { resetTitleEditor(); drawTitles(); });
$('mute-source-audio').addEventListener('change', event => edit({
  type: 'clip.source-audio.muted', clip_id: selectedId, muted: event.target.checked
}));
$('split').addEventListener('click', () => edit({ type:'clip.split', clip_id:selectedId, time:playhead }));
$('remove').addEventListener('click', () => edit({ type:'clip.deleted', clip_id:selectedId }));
$('move-left').addEventListener('click', () => edit({ type:'clip.moved', clip_id:selectedId, step:-1 }));
$('move-right').addEventListener('click', () => edit({ type:'clip.moved', clip_id:selectedId, step:1 }));
for(const [name, method] of [['undo',undo],['redo',redo]]) $(name).addEventListener('click', () => {
  if (exporting) return;
  stopPlayback(); state = method(state);
  if (selectedId && ![...state.clips, ...state.audioClips,...state.video2Clips,...state.audio2Clips].some(c=>c.clip_id===selectedId)) selectedId=null;
  playhead=Math.min(playhead,duration(state)); render(); void seekTo(playhead); status(name+' ✓');
});
$('project-name').addEventListener('change', e => edit({ type:'project.renamed', name:e.target.value }));
$('new-project').addEventListener('click', () => {
  if (exporting || !confirm('Start a new project? Export your draft first if you want to keep these edits.')) return;
  stopPlayback(); clearMedia(); state=newStudio(); selectedId=null; playhead=0; resetTitleEditor(); $('timeline-zoom').addEventListener('input',event=>{
  const scroll=$('storyboard-scroll'),total=timelineExtent();
  const relative=total>0?playhead/total:0;
  const oldWidth=$('storyboard-canvas').clientWidth||1;
  const screenX=relative*oldWidth-scroll.scrollLeft;
  timelineZoom=Number(event.target.value);
  $('zoom-label').textContent=Math.round(timelineZoom*100)+'%';
  drawTimeline(); drawTitles(); updateStoryPlayhead();
  const newWidth=$('storyboard-canvas').clientWidth;
  scroll.scrollLeft=Math.max(0,relative*newWidth-screenX);
});
$('fit-timeline').addEventListener('click',()=>{
  timelineZoom=1;$('timeline-zoom').value='1';
  $('zoom-label').textContent='100%';drawTimeline();drawTitles();
  $('storyboard-scroll').scrollLeft=0;updateStoryPlayhead();
});
$('snap-enabled').addEventListener('change',event=>{
  $('snap-feedback').textContent=event.target.checked?'Snap ON':'Snap OFF';
});
window.addEventListener('resize',()=>{drawTimeline();drawTitles();updateStoryPlayhead();});
render(); void seekTo(0); status('New project ready.');
});
$('save-draft').addEventListener('click', () => {
  const file = (state.name.replace(/[^a-z0-9_-]+/ig,'-').slice(0,60) || 'paracut') + '.paracut.json';
  download(file, new Blob([exportDraft(state)],{type:'application/json'}));
  status('Draft downloaded. Original videos are NOT embedded.');
});
$('open-draft').addEventListener('click', () => $('draft-input').click());
$('draft-input').addEventListener('change', async e => {
  const file = e.target.files?.[0]; e.target.value = ''; if(!file || exporting) return;
  try {
    const candidate=importDraft(await file.text());
    stopPlayback(); clearMedia(); state=candidate; selectedId=null; playhead=0; resetTitleEditor();
    render(); void seekTo(0); status('Draft opened. Import original video files to relink them.');
  } catch (err) { status('Could not open draft: ' + err.message,true); }
});
document.addEventListener('keydown', e => {
  if (['INPUT','TEXTAREA'].includes(document.activeElement?.tagName) || exporting) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); $('undo').click(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); $('redo').click(); return; }
  if (e.code === 'Space') { e.preventDefault(); $('play').click(); }
  else if (e.key.toLowerCase() === 's') $('split').click();
  else if (e.key === 'Delete' || e.key === 'Backspace') $('remove').click();
});
async function renderVideo(format) {
  if (exporting) {
    if (activeExportFormat === format) {
      cancelExport = true; status('Cancel requested. Stopping export…');
    }
    return;
  }
  expectedMime(format);
  if (!state.clips.length) return status('Timeline is empty.',true);
  if ([...state.clips, ...state.audioClips,...state.video2Clips,...state.audio2Clips].some(c=>!media.has(c.asset_id)))
    return status('Relink all media sources before exporting.',true);
  if (duration(state) > 300) return status('Browser export is limited to five minutes. Save a draft and use a shorter cut.',true);
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream)
    return status('This browser does not provide video recording. Try a recent desktop browser.',true);
  const mime = findRecorderMime(format);
  if (!mime) return status(format.toUpperCase() + ' recording is not supported by this browser. Try the other format.',true);
  stopPlayback();
  exporting=true; activeExportFormat=format; cancelExport=false;
  $(format === 'mp4' ? 'export-mp4' : 'export-webm').textContent='Cancel Export';
  render();
  let recorder, ctx, stream, videoStream, videoSourceGain, incomingVideoGain, soundtrackGain, overlayGain, audio2Gain;
  let encoderAudio = document.createElement('audio');
  encoderVideo = document.createElement('video');
  encoderVideo.playsInline = true;
  const encoderIncoming = document.createElement('video');
  encoderIncoming.playsInline = true;
  const encoderOverlay=document.createElement('video');
  encoderOverlay.playsInline=true;
  const encoderAudio2=document.createElement('audio');
  const chunks=[];
  try {
    const canvas = document.createElement('canvas'); canvas.width=1280; canvas.height=720;
    const g = canvas.getContext('2d',{alpha:false}); if(!g) throw Error('Canvas unavailable.');
    const drawVideoFrame = (el, alpha) => {
      const vw=el.videoWidth, vh=el.videoHeight;
      if (!vw || !vh || el.readyState < 2) return;
      const scale=Math.min(canvas.width/vw,canvas.height/vh), w=vw*scale,h=vh*scale;
      g.save(); g.globalAlpha = alpha;
      g.drawImage(el,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
      g.restore();
    };
    const paint = (at = 0) => {
      g.fillStyle='#05070b'; g.fillRect(0,0,canvas.width,canvas.height);
      drawVideoFrame(encoderVideo,1);
      const fade=crossfadeAt(state,at);
      if (fade && encoderIncoming.dataset.clip === fade.incoming.clip_id)
        drawVideoFrame(encoderIncoming,fade.progress);
      const overlay=activeOverlayClip(state,at);
      if(overlay && encoderOverlay.dataset.clip===overlay.clip_id && encoderOverlay.readyState>=2){
        const opacity=overlayOpacityAt(overlay,at);
        g.save();g.globalAlpha=opacity;
        const motion=overlayMotionAt(overlay,at);
        if((overlay.overlay_layout??'pip')==='full'){
          g.translate(motion.x*canvas.width,motion.y*canvas.height);
          drawVideoFrame(encoderOverlay,1);
        } else {
          const vw=encoderOverlay.videoWidth,vh=encoderOverlay.videoHeight;
          if(vw&&vh){const ratio=Math.min(420/vw,220/vh);
            const w=vw*ratio,h=vh*ratio;
            g.translate(motion.x*(w+12),motion.y*(h+12));
            g.fillStyle='#091321';g.fillRect(1210-w-12,35,w+12,h+12);
            g.drawImage(encoderOverlay,1210-w-6,41,w,h);}
        }
        g.restore();
      }
      drawTitleOnCanvas(g, visibleTitle(state,at), at);
    };
    paint(); videoStream=canvas.captureStream(30);
    const tracks=[...videoStream.getVideoTracks()];
    // Audio is captured from the decoded source through Web Audio, not the user's microphone.
    const AudioCtx=window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx && (state.audioClips.length || state.audio2Clips.length || state.video2Clips.length || state.clips.some(c=>c.transition_out_seconds>0)))
      throw Error('This browser cannot mix overlapping source audio. Try desktop Chrome/Edge.');
    if (AudioCtx) {
      ctx=new AudioCtx();
      const source=ctx.createMediaElementSource(encoderVideo);
      const dest=ctx.createMediaStreamDestination();
      // Web Audio may ignore an HTMLMediaElement's muted property at this
      // capture point. Mute original audio in the graph, NOT via the element.
      videoSourceGain = ctx.createGain();
      source.connect(videoSourceGain);
      videoSourceGain.connect(dest);
      const incomingSource = ctx.createMediaElementSource(encoderIncoming);
      incomingVideoGain = ctx.createGain(); incomingVideoGain.gain.value = 0;
      incomingSource.connect(incomingVideoGain);
      incomingVideoGain.connect(dest);
      const overlaySource=ctx.createMediaElementSource(encoderOverlay);
      overlayGain=ctx.createGain();overlayGain.gain.value=0;
      overlaySource.connect(overlayGain);overlayGain.connect(dest);
      if (state.audio2Clips.length) {
        const secondSource=ctx.createMediaElementSource(encoderAudio2);
        audio2Gain=ctx.createGain();audio2Gain.gain.value=0;
        secondSource.connect(audio2Gain);audio2Gain.connect(dest);
      }
      if (state.audioClips.length) {
        const music = ctx.createMediaElementSource(encoderAudio);
        soundtrackGain = ctx.createGain();
        music.connect(soundtrackGain);
        soundtrackGain.connect(dest);
      }
      tracks.push(...dest.stream.getAudioTracks());
      await ctx.resume();
    }
    stream=new MediaStream(tracks);
    recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3_500_000});
    const recordedMime = recorderOutputFormat(format, recorder.mimeType || mime);
    recorder.ondataavailable=e=>{if(e.data?.size) chunks.push(e.data);};
    const stopped=new Promise((resolve,reject)=>{
      recorder.onstop=resolve;
      recorder.onerror=e=>reject(e.error || Error('MediaRecorder failed.'));
    });
    recorder.start(1000);
    encoderVideo.muted = false;
    encoderIncoming.muted = false;
    encoderOverlay.muted=false;
    encoderAudio2.muted=false;
    encoderAudio.muted = false;
    encoderAudio.volume = 1;
    // Maintain one independent sequential soundtrack over the video cut.
    // Each source change is aligned to the video timeline position; in-browser
    // capture remains real-time beta and can drift by a few frames.
    async function syncExportSoundtrack(at) {
      const clip = activeAudioClip(state, at);
      if (soundtrackGain) soundtrackGain.gain.value = audioLevelAt(clip, at) * audioMixLevelAt(state,'audio-1',at);
      if (!clip) { encoderAudio.pause(); return; }
      const ref = media.get(clip.asset_id);
      if (!ref) throw Error('Missing audio source during export.');
      if (encoderAudio.dataset.clip !== clip.clip_id) {
        encoderAudio.pause(); encoderAudio.src = ref.url; encoderAudio.dataset.clip = clip.clip_id;
        encoderAudio.load();
        await new Promise((resolve, reject) => {
          if (encoderAudio.readyState >= 1) return resolve();
          encoderAudio.addEventListener('loadedmetadata', resolve, { once:true });
          encoderAudio.addEventListener('error', () => reject(Error('Cannot decode soundtrack for export.')), { once:true });
        });
      }
      const position = Math.min(clip.source.end - .005, clip.source.start + at - clip.timeline.start);
      if (Math.abs(encoderAudio.currentTime - position) > .16) encoderAudio.currentTime = position;
      if (encoderAudio.paused) await encoderAudio.play();
    }
    async function syncExportLayer(el,clip,at,level) {
      if(level)level.gain.value=audioLevelAt(clip,at)*audioMixLevelAt(state,clip?.track_id,at);
      if(!clip||at>=duration(state)){el.pause();return;}
      const ref=media.get(clip.asset_id);
      if(!ref)throw Error('Layer source missing during export.');
      if(el.dataset.clip!==clip.clip_id){
        el.pause();el.src=ref.url;el.dataset.clip=clip.clip_id;el.load();
        await new Promise((resolve,reject)=>{
          if(el.readyState>=1)return resolve();
          el.addEventListener('loadedmetadata',resolve,{once:true});
          el.addEventListener('error',()=>reject(Error('Cannot decode layered export source.')),{once:true});
        });
      }
      const expected=Math.min(clip.source.end-.005,clip.source.start+at-clip.timeline.start);
      if(Math.abs(el.currentTime-expected)>.20)el.currentTime=Math.max(0,expected);
      if(el.paused)await el.play();
    }
    async function prepareIncoming(clip, at) {
      const ref=media.get(clip.asset_id);
      if (!ref) throw Error('Relink the incoming crossfade source.');
      if (encoderIncoming.dataset.clip !== clip.clip_id) {
        encoderIncoming.pause();
        encoderIncoming.src = ref.url;
        encoderIncoming.dataset.clip = clip.clip_id;
        encoderIncoming.load();
        await new Promise((resolve,reject) => {
          if (encoderIncoming.readyState >= 1) return resolve();
          encoderIncoming.addEventListener('loadedmetadata',resolve,{once:true});
          encoderIncoming.addEventListener('error',()=>reject(Error('Cannot decode crossfade source.')),{once:true});
        });
      }
      const expected=clip.source.start + Math.max(0,at-clip.timeline.start);
      if (Math.abs(encoderIncoming.currentTime-expected) > .04) {
        encoderIncoming.currentTime=expected;
        await new Promise((resolve,reject) => {
          if (!encoderIncoming.seeking) return resolve();
          encoderIncoming.addEventListener('seeked',resolve,{once:true});
          encoderIncoming.addEventListener('error',()=>reject(Error('Crossfade source seek failed.')),{once:true});
        });
      }
    }
    async function syncExportCrossfade(at) {
      const fade=crossfadeAt(state,at);
      if (!fade) {
        if (incomingVideoGain) incomingVideoGain.gain.value=0;
        encoderIncoming.pause();
        return;
      }
      // The second player displays a *moving* incoming scene, not a still.
      if (encoderIncoming.dataset.clip !== fade.incoming.clip_id)
        await prepareIncoming(fade.incoming,at);
      const expected=fade.incoming.source.start + at - fade.incoming.timeline.start;
      if (Math.abs(encoderIncoming.currentTime-expected) > .22)
        encoderIncoming.currentTime = Math.min(fade.incoming.source.end-.005,expected);
      if (incomingVideoGain) incomingVideoGain.gain.value =
        audioLevelAt(fade.incoming,at) * audioMixLevelAt(state,'video-1',at) * fade.progress;
      if (encoderIncoming.paused) await encoderIncoming.play();
    }
    for (let index=0; index<state.clips.length; index++) {
      if(cancelExport) throw Error('Export cancelled.');
      const clip=state.clips[index], ref=media.get(clip.asset_id);
      // This branch reaches the recorder's actual mix, while the A1 audio
      // source stays independently connected to the output destination.
      if (videoSourceGain) videoSourceGain.gain.value = audioLevelAt(clip,clip.timeline.start) * audioMixLevelAt(state,'video-1',clip.timeline.start);
      if (incomingVideoGain) incomingVideoGain.gain.value = 0;
      encoderIncoming.pause();
      encoderAudio.pause();
      encoderVideo.pause(); encoderVideo.src=ref.url; encoderVideo.load();
      await new Promise((resolve,reject)=>{
        encoderVideo.addEventListener('loadedmetadata',resolve,{once:true});
        encoderVideo.addEventListener('error',()=>reject(Error('Cannot decode source.')),{once:true});
      });
      const skipped = index > 0 ? (state.clips[index-1].transition_out_seconds || 0) : 0;
      encoderVideo.currentTime=clip.source.start+skipped;
      await new Promise(resolve=> {
        if (encoderVideo.seeked || Math.abs(encoderVideo.currentTime - clip.source.start)<.04) return resolve();
        encoderVideo.addEventListener('seeked',resolve,{once:true});
      });
      // Preload the next decoder before playback, so a visual dissolve doesn't
      // start from a black frame while the next file is still loading.
      if (clip.transition_out_seconds > 0 && state.clips[index+1])
        await prepareIncoming(state.clips[index+1],state.clips[index+1].timeline.start);
      await encoderVideo.play();
      await syncExportSoundtrack(clip.timeline.start+skipped);
      while (encoderVideo.currentTime < clip.source.end - .015 && !encoderVideo.ended) {
        if(cancelExport) throw Error('Export cancelled.');
        if(document.hidden) throw Error('Keep this tab visible during R3 recording.');
        const timelinePosition = clip.timeline.start + Math.max(0, encoderVideo.currentTime - clip.source.start);
        await syncExportSoundtrack(timelinePosition);
        await syncExportCrossfade(timelinePosition);
        await syncExportLayer(encoderOverlay,activeOverlayClip(state,timelinePosition),timelinePosition,overlayGain);
        await syncExportLayer(encoderAudio2,activeAudio2Clip(state,timelinePosition),timelinePosition,audio2Gain);
        const fade = crossfadeAt(state,timelinePosition);
        if (videoSourceGain) videoSourceGain.gain.value = audioLevelAt(clip,timelinePosition) * audioMixLevelAt(state,'video-1',timelinePosition) *
          (fade ? 1-fade.progress : 1);
        paint(timelinePosition);
        $('render-status').textContent = `Recording clip ${index+1}/${state.clips.length} · ${fmt(encoderVideo.currentTime - clip.source.start)}`;
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
      paint(clip.timeline.end - .001);
      encoderVideo.pause(); encoderIncoming.pause(); encoderAudio.pause(); encoderOverlay.pause();encoderAudio2.pause();
    }
    recorder.stop(); await stopped;
    if (cancelExport) throw Error('Export cancelled.');
    const blob = new Blob(chunks,{type:recordedMime});
    if(blob.size < 1000) throw Error('Encoder produced no usable video.');
    // Never give a WebM stream an .mp4 filename: inspect its header first.
    await checkExportContainer(blob, format);
    download((state.name.replace(/[^a-z0-9_-]+/ig,'-').slice(0,60) || 'paracut')+'.'+format,blob);
    state.receipts.push({receipt_id:uuid(),action:'render.'+format+'.exported',at:new Date().toISOString(),source:'human',details:{
      bytes:blob.size,duration_seconds:duration(state),audio_clips:state.audioClips.length,
      audio2_clips:state.audio2Clips.length,video2_clips:state.video2Clips.length,title_count:state.titles.length,
      crossfades:state.clips.filter(c=>c.transition_out_seconds>0).length,mime:recordedMime,
      container_signature_verified:true,format:'browser-beta'}});
    status(format.toUpperCase()+' downloaded ('+(blob.size/1048576).toFixed(1)+' MiB). Watch and listen before sharing.');
  } catch(err) { status('Export: '+err.message,true); }
  finally {
    if(recorder?.state==='recording') { recorder.onstop=null; recorder.stop(); }
    encoderVideo.pause(); encoderVideo.removeAttribute('src'); encoderVideo.load();
    encoderIncoming.pause(); encoderIncoming.removeAttribute('src'); encoderIncoming.load();
    encoderAudio.pause(); encoderAudio.removeAttribute('src'); encoderAudio.load();
    encoderOverlay.pause();encoderOverlay.removeAttribute('src');encoderOverlay.load();
    encoderAudio2.pause();encoderAudio2.removeAttribute('src');encoderAudio2.load();
    stream?.getTracks().forEach(t=>t.stop()); videoStream?.getTracks().forEach(t=>t.stop());
    await ctx?.close();
    exporting=false;activeExportFormat=null;cancelExport=false;
    $('export-webm').textContent='Export WebM β';$('export-mp4').textContent='Export MP4 β';
    $('render-status').textContent='';render();
  }
}
$('export-webm').addEventListener('click',()=>{void renderVideo('webm');});
$('export-mp4').addEventListener('click',()=>{void renderVideo('mp4');});
render(); void seekTo(0);
