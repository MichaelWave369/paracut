import { newStudio, change, undo, redo, duration, activeClip, activeAudioClip, activeOverlayClip, activeAudio2Clip, overlayCrossfadeAt, maxOverlayCrossfade, overlayOpacityAt, overlayMotionAt, isSourceAudioMuted, audioLevelAt, audioMixLevelAt, visibleTitle, titleStyle, titleOpacityAt, crossfadeAt, maxCrossfade, snapLayerTime, exportDraft, importDraft } from './studio-core.js';
import { extractWaveform, paintWaveform } from './studio-waveform.js';
import { paintTrimWaveform, sourceTimeAtFraction, estimateTrackPeak } from './studio-audio-visual.js';
import { createPreviewBusMeters, formatDbfs } from './studio-live-meters.js';
import { findRecorderMime, recorderOutputFormat, checkExportContainer, expectedMime } from './studio-export-format.js';
import { workspacePreset,loadWorkspace,saveWorkspace,resizeWorkspace } from './studio-workspaces.js';
import { clipColor, hasColorAdjustment, COLOR_DEFAULTS } from './studio-color.js';
import { colorLook, COLOR_LOOK_NAMES, previewColorFor, colorReceiptSummary } from './studio-color-workflow.js';
import { synchronizedRipplePlan } from './studio-ripple.js';
import { matchedSourceFrame, captureAttributes, attributePasteCommand } from './studio-attributes.js';
import {navigateMarker,sortedMarkers} from './studio-markers.js';
import {TITLE_RECIPES,titleRecipeFields,titlePlacementAtPlayhead,titleDeckSample,titleDeckReadout} from './studio-title-deck.js';
import {titleMotionAt,titleMotionId,titleMotionEaseId,titleMotionDistance,titleMotionProgress} from './studio-title-motion.js';
import {titlePlacement,titleAnchor,titlePlacementFields,titleNudgePlacement} from './studio-title-placement.js';
import {titleScale,titleScaleFields,titleScaledFont,titleResizeDelta} from './studio-title-transform.js';
import {titleBatchPlan,titleBatchSummary,TITLE_BATCH_MODES} from './studio-title-batch.js';
import {TITLE_ALIGNMENTS,TITLE_TRANSFORM_PRESETS,titleAlignmentPoint,titleAlignmentId,
  titleTransformPreset,titleTransformClipboard,titleTransformReadout}
  from './studio-title-align.js';
import {TITLE_RHYTHMS,TITLE_DURATION_CHOICES,titleRhythmFields,
  retimeTitleDraft,titleFadeFromPercent,titlePhaseMap,titleTimingReadout}
  from './studio-title-timing.js';
import {validateKeyframePair} from './studio-keyframes.js';
import {renderMultiPointKeyframeLanes} from './studio-multipoint-view.js';
import {keyframePointsFor,pointsField} from './studio-keyframe-points.js';
import {EFFECTS_SECTIONS,readEffectsView,writeEffectsView,
  setEffectsSection,allEffectsSections,effectsVisibility,effectsSummaries}
  from './studio-effects-layout.js';

const $ = id => document.getElementById(id);
let state = newStudio();
let selectedId = null, selectedMarkerId=null, playhead = 0, playing = false, exporting = false, cancelExport = false, seekSerial = 0;
let activeExportFormat = null;
let activeTool='select'; // editor preference only; never stored in draft
let colorCompareBefore=false, colorPreviewPending=false, lastColorSelectedId=null;
const razorTargets=new Set(['video-1']);
let transportSpeed=1;
const attributeClipboard={color:null,overlay:null};
let timelineZoom=1; // local interface preference, not saved into media drafts
let showKeyframeLanes=true;
function timelineExtent(){
  return Math.max(duration(state),state.audioClips.at(-1)?.timeline.end||0,
    state.video2Clips.at(-1)?.timeline.end||0,
    state.audio2Clips.at(-1)?.timeline.end||0,
    ...state.titles.map(t=>t.end),...state.markers.map(m=>m.time),.01);
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
const sourceVideo=$('source-video');
let sourceAssetId=null, sourceIn=0, sourceOut=0;
const crossfadeVideo = $('crossfade-video');
const overlayVideo = $('overlay-video');
overlayVideo.preload = 'auto';
const overlayIncoming = $('overlay-incoming');
overlayIncoming.preload='auto';
const audio2Player = document.createElement('audio');
audio2Player.preload = 'auto';
let layerVideoSerial=0,layerAudioSerial=0,layerIncomingSerial=0;
crossfadeVideo.preload = 'auto';
let previewTransitionSerial = 0, loadingTransition = null, transitionFrameHandle = 0;
let encoderVideo = document.createElement('video'); // fresh element per export
const soundtrack = document.createElement('audio');
soundtrack.preload = 'auto'; soundtrack.volume = .85;
const waveforms = new Map();
let soundSerial = 0;
let liveBusMeters=null,liveMeterUnavailable=false;
let draggedClipId = null;
let editingTitleId = null;
let selectedTitleRecipe=null; // audition only, never stored in project drafts
let selectedTitleRhythm=null; // staged local animation preset only
let stagedTitlePlacement=null,titlePlacementArmed=false,titleDrag=null;
let stagedTitleScale=100,titleResizeDrag=null,safeGuidesVisible=false;
let copiedTitleTransform=null; // clipboard lives only in this Studio session
const multiTitleIds=new Set(); // local T1 selection; never saved in project
let draggingTrimEdge = null;
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
  sourceVideo.pause(); sourceVideo.removeAttribute('src');sourceVideo.load();
  sourceAssetId=null;sourceIn=0;sourceOut=0;
  for (const entry of media.values()) URL.revokeObjectURL(entry.url);
  media.clear(); waveforms.clear();
  soundtrack.pause(); soundtrack.removeAttribute('src'); soundtrack.load(); delete soundtrack.dataset.clip;
  video.pause(); video.removeAttribute('src'); video.load(); delete video.dataset.asset; delete video.dataset.clip;
  ++previewTransitionSerial; loadingTransition = null;
  crossfadeVideo.pause(); crossfadeVideo.removeAttribute('src'); crossfadeVideo.load();
  delete crossfadeVideo.dataset.clip; crossfadeVideo.style.display='none';
  ++layerVideoSerial; ++layerAudioSerial; ++layerIncomingSerial;
  for(const el of [overlayVideo,overlayIncoming,audio2Player]){
    el.pause(); el.removeAttribute('src');el.load();delete el.dataset.clip;
  }
  overlayVideo.style.display='none'; overlayIncoming.style.display='none';
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
  applyPreviewColor();
  updateStoryPlayhead();
  $('marker-prev').disabled=exporting||!navigateMarker(state.markers,playhead,'previous');
  $('marker-next').disabled=exporting||!navigateMarker(state.markers,playhead,'next');
}
function currentSource() {
  const asset=state.assets.find(a=>a.asset_id===sourceAssetId);
  return asset?.type?.startsWith('video/')?asset:null;
}
function refreshSourceMonitor() {
  const asset=currentSource(),ref=asset&&media.get(asset.asset_id);
  const linked=Boolean(ref);
  $('source-label').textContent=asset?asset.name+' · '+(linked?'Ready':'Relink original'):'Choose a video in Project Media';
  $('source-empty').hidden=linked;
  sourceVideo.style.display=linked?'block':'none';
  if(linked && sourceVideo.dataset.asset!==asset.asset_id) {
    sourceVideo.pause();sourceVideo.src=ref.url;sourceVideo.dataset.asset=asset.asset_id;
    sourceVideo.load();
  } else if(!linked && sourceVideo.src){
    sourceVideo.pause();sourceVideo.removeAttribute('src');delete sourceVideo.dataset.asset;sourceVideo.load();
  }
  const max=asset?.duration||0;
  $('source-seek').max=String(Math.max(.001,max));
  $('source-seek').value=String(Math.min(sourceVideo.currentTime||0,max));
  $('source-time').textContent=fmt(Math.min(sourceVideo.currentTime||0,max));
  $('source-total').textContent=fmt(max);
  for(const key of ['source-seek','source-play','source-mark-in','source-mark-out','source-in','source-out'])
    $(key).disabled=!linked||exporting;
  $('source-in').value=String(sourceIn);
  $('source-out').value=String(sourceOut);
  $('source-play').textContent=!sourceVideo.paused?'❚❚':'▶';
  $('source-insert').disabled=!linked||exporting;
  const sel=state.clips.find(c=>c.clip_id===selectedId);
  $('source-replace').disabled=!linked||!sel||exporting;
}
function chooseSource(assetId) {
  const asset=state.assets.find(a=>a.asset_id===assetId);
  if(!asset?.type.startsWith('video/')||!media.has(assetId))return status('Relink the video before opening Source.',true);
  stopPlayback();sourceVideo.pause();
  sourceAssetId=assetId;sourceIn=0;sourceOut=asset.duration;
  refreshSourceMonitor();
  status('Source ready: '+asset.name+'. Mark IN and OUT, then insert at V1 playhead.');
}
function selectedClip() {
  return [...state.clips,...state.audioClips,...state.video2Clips,...state.audio2Clips]
    .find(c=>c.clip_id===selectedId)||null;
}
function matchFrame(clip,time=playhead) {
  if(exporting||!clip?.track_id.startsWith('video-'))return;
  if(!media.has(clip.asset_id))return status('Relink the original video before Match Frame.',true);
  try{
    const frame=matchedSourceFrame(clip,time);
    chooseSource(frame.assetId);
    sourceIn=frame.in;sourceOut=frame.out;
    if(!$('workspace-source-visible').checked){
      $('workspace-source-visible').checked=true;
      $('workspace-source-visible').dispatchEvent(new Event('change'));
    }
    refreshSourceMonitor();
    // Source media metadata can resolve asynchronously after changing src.
    const seekMatched=()=>{
      if(sourceAssetId!==frame.assetId)return;
      try{sourceVideo.currentTime=frame.time;}catch(e){
        status('Match Frame seek: '+e.message,true);
      }
      refreshSourceMonitor();
    };
    if(sourceVideo.readyState>=1)seekMatched();
    else sourceVideo.addEventListener('loadedmetadata',seekMatched,{once:true});
    status('Match Frame: '+state.assets.find(a=>a.asset_id===frame.assetId).name+
      ' at '+fmt(frame.time)+' (preview-only).');
  }catch(e){status('Match Frame: '+e.message,true);}
}
function clipClickTime(clip,event,item) {
  const rect=item.getBoundingClientRect();
  const fraction=Math.max(0,Math.min(1,(event.clientX-rect.left)/Math.max(1,rect.width)));
  return clip.timeline.start+fraction*(clip.timeline.end-clip.timeline.start);
}
function matchTimelineDoubleClick(clip,event,item) {
  if(activeTool!=='select'||!clip.track_id.startsWith('video-'))return;
  event.preventDefault();
  const matchedTime=clipClickTime(clip,event,item);
  selectedId=clip.clip_id;
  drawTimeline();drawInspector();
  matchFrame(clip,matchedTime);
}
function refreshAttributes() {
  const clip=selectedClip(),video=Boolean(clip?.track_id.startsWith('video-'));
  $('attribute-clipboard').hidden=!video;
  $('source-match-frame').disabled=!video||exporting||!media.has(clip?.asset_id);
  $('copy-color').disabled=!video||exporting;
  $('paste-color').disabled=!video||exporting||!attributeClipboard.color;
  $('copy-overlay').disabled=clip?.track_id!=='video-2'||exporting;
  $('paste-overlay').disabled=clip?.track_id!=='video-2'||exporting||
    !attributeClipboard.overlay;
}
function copyAttributes(kind) {
  const clip=selectedClip();
  if(!clip)return status('Select a video clip first.',true);
  try{
    attributeClipboard[kind]=captureAttributes(clip,kind);
    $('attribute-clipboard-status').textContent=
      'Copied '+(kind==='color'?'color':'V2 style')+
      ' from '+(state.assets.find(a=>a.asset_id===clip.asset_id)?.name||'video')+
      '. Select another video and paste.';
    refreshAttributes();
  }catch(e){status(e.message,true);}
}
function pasteAttributes(kind) {
  const clip=selectedClip();
  try{
    const command=attributePasteCommand(attributeClipboard[kind],clip);
    const count=state.receipts.length;
    edit(command);
    if(state.receipts.length>count)status('Pasted '+kind+' attributes · receipt saved.');
  }catch(e){status(e.message,true);}
}
function applySourceEdit(type) {
  const asset=currentSource();
  if(!asset||!media.has(asset.asset_id))return status('Open a linked video in Source Monitor.',true);
  const start=Number($('source-in').value),end=Number($('source-out').value);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||
    end>asset.duration+.001||end-start<.08)
    return status('Source OUT must be after IN by at least 0.08 seconds.',true);
  const clip=state.clips.find(c=>c.clip_id===selectedId);
  if(type==='clip.source.replaced'&&!clip)return status('Select a V1 clip to replace.',true);
  sourceIn=start;sourceOut=end;
  const before=state.receipts.length;
  edit({type,asset_id:asset.asset_id,start,end,
    ...(type==='clip.source.inserted'?{at:playhead}:{clip_id:clip.clip_id})});
  if(state.receipts.length>before)status((type==='clip.source.inserted'?'Inserted':'Replaced')+
    ' '+fmt(end-start)+' of '+asset.name+' · edit receipt saved');
}
function drawMedia() {
  const list = $('media-list'); list.replaceChildren();
  $('asset-count').textContent = state.assets.length + ' files';
  const filter=$('media-search').value.trim().toLowerCase();
  const sort=$('media-sort').value;
  const assets=state.assets.filter(a=>a.name.toLowerCase().includes(filter));
  if(sort==='name')assets.sort((a,b)=>a.name.localeCompare(b.name));
  else if(sort==='duration')assets.sort((a,b)=>a.duration-b.duration);
  else if(sort==='type')assets.sort((a,b)=>a.type.localeCompare(b.type)||a.name.localeCompare(b.name));
  for (const asset of assets) {
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
    const select=document.createElement('button');
    select.className='source-load';select.textContent='Source';
    select.title='Open video in Source Monitor';
    select.disabled=isAudio||!linked||exporting;
    select.addEventListener('click',()=>chooseSource(asset.asset_id));
    if(asset.asset_id===sourceAssetId)div.classList.add('source-active');
    div.append(name,select,add,layer);list.append(div);
  }
  refreshSourceMonitor();
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
function updateToolUI() {
  $('tool-select').setAttribute('aria-pressed',String(activeTool==='select'));
  $('tool-razor').setAttribute('aria-pressed',String(activeTool==='razor'));
  $('storyboard-canvas').classList.toggle('razor-mode',activeTool==='razor');
  for(const [tag,track] of [['v1','video-1'],['v2','video-2'],['a1','audio-1'],['a2','audio-2']]){
    $('target-'+tag).setAttribute('aria-pressed',String(razorTargets.has(track)));
    $('target-'+tag).disabled=exporting;
  }
  $('tool-select').disabled=exporting;
  $('tool-razor').disabled=exporting;
  $('tool-feedback').textContent=(activeTool==='razor'?'Razor':'Selection')+
    ' · '+([...razorTargets].map(x=>x.replace('video-','V').replace('audio-','A')).join(', ')||'no targeted tracks');
}
function setEditingTool(mode) {
  if(exporting)return;
  if(!['select','razor'].includes(mode))return;
  activeTool=mode;
  updateToolUI();
  drawTimeline();
  status(mode==='razor'?'Razor: click a targeted clip at its desired cut.':'Selection tool enabled.');
}
function actOnTimelineClip(clip,event,button) {
  if(exporting)return;
  if(activeTool==='razor'){
    if(!razorTargets.has(clip.track_id))return status('Track '+clip.track_id+' is not targeted for Razor.',true);
    const r=button.getBoundingClientRect(),fraction=Math.max(0,Math.min(1,
      (event.clientX-r.left)/Math.max(1,r.width)));
    const time=Math.round((clip.timeline.start+fraction*(clip.timeline.end-clip.timeline.start))*1000)/1000;
    selectedId=clip.clip_id;
    edit({type:'clip.split',clip_id:clip.clip_id,time});
    return;
  }
  selectedId=clip.clip_id;drawTimeline();drawInspector();refreshSourceMonitor();
  void seekTo(Math.min(clip.timeline.start,duration(state)),{autoplay:playing});
}
function applyTransportSpeed() {
  for(const el of [video,crossfadeVideo,overlayVideo,overlayIncoming,soundtrack,audio2Player])
    el.playbackRate=transportSpeed;
}
function appendKeyframeBadge(clip,item){
  if(clip.opacity_keyframes===undefined&&clip.volume_keyframes===undefined&&
    clip.opacity_keyframe_points===undefined&&clip.volume_keyframe_points===undefined)return;
  const badge=document.createElement('small');
  badge.className='keyframe-indicator';
  badge.textContent='◆ KF';
  badge.title=(clip.opacity_keyframes||clip.opacity_keyframe_points?'Opacity ':'')+
    (clip.volume_keyframes||clip.volume_keyframe_points?'Volume ':'')+'animation applied';
  item.append(badge);
}
function drawKeyframeLanes(){
  const clip=[...state.clips,...state.audioClips,...state.video2Clips,
    ...state.audio2Clips].find(c=>c.clip_id===selectedId);
  renderMultiPointKeyframeLanes({
    root:$('visual-keyframe-lanes'),
    opacityLane:$('keyframe-lane-opacity'),
    volumeLane:$('keyframe-lane-volume'),
    clip:showKeyframeLanes?clip:null,
    total:timelineExtent(),playhead,getPlayhead:()=>playhead,
    editable:!exporting&&activeTool==='select',
    onCommit:command=>edit(command),onError:message=>status(message,true)
  });
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
      item.draggable = !exporting && activeTool==='select';
      item.style.left=String(100*clip.timeline.start/total)+'%';
      item.style.width=String(Math.max(.3,100*(clip.timeline.end-clip.timeline.start)/total))+'%';
      item.setAttribute('aria-pressed', String(clip.clip_id === selectedId));
      item.title = (asset?.name || 'Missing file') + ' · ' + fmt(clip.timeline.start) + ' to ' + fmt(clip.timeline.end);
      const label = document.createElement('span'); label.textContent = asset?.name || 'Missing file';
      const time = document.createElement('small'); time.textContent = fmt(clip.timeline.end - clip.timeline.start);
      item.append(label, time);
      appendKeyframeBadge(clip,item);
      if(!isAudio&&hasColorAdjustment(clip)){
        item.classList.add('graded-clip');
        const grade=document.createElement('small');grade.className='grade-indicator';
        grade.textContent='COLOR';grade.title='This clip has color corrections';
        item.append(grade);
      }
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
      item.addEventListener('click',event=>actOnTimelineClip(clip,event,item));
      if(!isAudio)item.addEventListener('dblclick',event=>
        matchTimelineDoubleClick(clip,event,item));
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
      appendKeyframeBadge(clip,item);
      if(kind==='video'&&hasColorAdjustment(clip)){
        item.classList.add('graded-clip');
        const grade=document.createElement('small');grade.className='grade-indicator';
        grade.textContent='COLOR';grade.title='V2 color correction applied';
        item.append(grade);
      }
      if(kind==='video'&&((clip.overlay_motion??'none')!=='none'||
        (clip.overlay_opacity??1)!==1||(clip.visual_fade_in??0)>0||(clip.visual_fade_out??0)>0)){
        const fx=document.createElement('small');fx.className='motion-indicator';
        fx.textContent='FX';fx.title='Overlay motion, opacity or visual fades applied';
        item.append(fx);
      }
      if(kind==='video'&&(clip.transition_out_seconds??0)>0){
        item.classList.add('has-overlay-transition');
        const mark=document.createElement('small');
        mark.className='overlay-transition-caption';
        mark.textContent='⇄ '+Number(clip.transition_out_seconds).toFixed(2)+'s';
        item.append(mark);
      }
      if(kind==='audio'&&waveforms.has(clip.asset_id)){
        const canvas=document.createElement('canvas');canvas.className='waveform';
        item.append(canvas);
        requestAnimationFrame(()=>paintWaveform(canvas,waveforms.get(clip.asset_id)));
      }
      item.title='Start '+fmt(clip.timeline.start)+' · Select, adjust or drag on the storyboard';
      item.addEventListener('click',event=>actOnTimelineClip(clip,event,item));
      if(kind==='video')item.addEventListener('dblclick',event=>
        matchTimelineDoubleClick(clip,event,item));
      item.draggable=!exporting && activeTool==='select';
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
  drawKeyframeLanes();
}

function showTitleAt(at) {
  const title = visibleTitle(state, at);
  const node = $('title-preview');
  node.hidden = !title;
  node.textContent = title?.text || '';
  const resizeHandle=$('title-resize-handle');
  resizeHandle.hidden=!title||!titlePlacementArmed||
    editingTitleId!==title?.title_id;
  if(!title)return;
  // Staged reset-to-anchor must discard prior custom coordinates in preview.
  const {title_x:priorX,title_y:priorY,...plainTitle}=title;
  const preview=editingTitleId===title.title_id
    ?{...plainTitle,...titlePlacementFields(stagedTitlePlacement),
      title_scale:stagedTitleScale}:title;
  const style = titleStyle(preview);
  const motion=titleMotionAt(preview,at),rect=node.parentElement;
  node.style.translate=(motion.x*(rect?.clientWidth||1280)/1280)+'px '+
    (motion.y*(rect?.clientHeight||720)/720)+'px';
  const custom=titlePlacement(preview);
  node.style.fontSize=titleScale(preview)!==100
    ?(titleScaledFont(preview)*(rect?.clientHeight||720)/720)+'px':'';
  const anchorPoint=titleAnchor(preview);
  const measure=titleScaledFont(preview);
  const handleX=Math.min(1200,anchorPoint.x+
    Math.max(65,Math.min(225,title.text.length*measure*.27)));
  const handleY=Math.min(660,anchorPoint.y+Math.max(30,measure*.7));
  resizeHandle.style.left=(100*handleX/1280)+'%';
  resizeHandle.style.top=(100*handleY/720)+'%';
  resizeHandle.setAttribute('aria-label',
    'Resize '+title.text.slice(0,32)+'. Current '+titleScale(preview)+
    ' percent. Arrow keys adjust five percent; Shift ten.');
  if(custom){
    node.style.left=(100*custom.x/1280)+'%';
    node.style.top=(100*custom.y/720)+'%';
    node.style.right='auto';node.style.bottom='auto';
    node.style.width='84%';node.style.transform='translate(-50%,-50%)';
  }else{
    for(const key of ['left','top','right','bottom','width','transform'])
      node.style[key]='';
  }
  node.classList.toggle('placing',titlePlacementArmed&&editingTitleId===title.title_id);
  node.tabIndex=titlePlacementArmed&&editingTitleId===title.title_id?0:-1;
  node.setAttribute('aria-label',titlePlacementArmed
    ?'Drag title to place. Arrow keys nudge by one pixel, Shift by ten.'
    :'Title preview');
  node.dataset.position = style.position;
  node.dataset.size = style.size;
  node.dataset.color = style.color;
  node.style.opacity = String(titleOpacityAt(title, at));
}
// Only the A1/A2 preview elements pass through this Web Audio meter graph.
// The browser export uses separate players and a separate audio context.
function ensureLiveBusMeters() {
  if(liveBusMeters) {
    if(liveBusMeters.context.state==='suspended')
      void liveBusMeters.context.resume().catch(e=>status('Live audio context: '+e.message,true));
    return;
  }
  if(liveMeterUnavailable)return;
  const AudioCtx=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!AudioCtx){liveMeterUnavailable=true;return;}
  try{
    liveBusMeters=createPreviewBusMeters(AudioCtx,{a1:soundtrack,a2:audio2Player});
    // The actual track volume now lives in the Web Audio GainNode;
    // avoid applying its gain twice through HTMLMediaElement.volume.
    soundtrack.volume=1;audio2Player.volume=1;
    previewAudioAt(playhead);
    void liveBusMeters.context.resume().catch(e=>
      status('Live audio metering could not resume: '+e.message,true));
  }catch(e){
    liveMeterUnavailable=true;
    status('Web Audio meters unavailable: '+e.message,true);
  }
}
function setPreviewBusGain(lane,element,value) {
  const safe=Math.max(0,Math.min(1,value));
  if(liveBusMeters) {
    element.volume=1;
    liveBusMeters.setGain(lane,safe);
  } else element.volume=safe;
}
function previewAudioAt(at) {
  const v = activeClip(state, Math.min(at, Math.max(0, duration(state) - .001)));
  const a = activeAudioClip(state, at);
  const dissolve = crossfadeAt(state, at);
  video.muted = isSourceAudioMuted(v);
  video.volume = Math.min(1, audioLevelAt(v, at) * audioMixLevelAt(state,'video-1',at) * (dissolve ? 1 - dissolve.progress : 1));
  crossfadeVideo.muted = isSourceAudioMuted(dissolve?.incoming);
  crossfadeVideo.volume = Math.min(1, dissolve ? audioLevelAt(dissolve.incoming, at) * audioMixLevelAt(state,'video-1',at) * dissolve.progress : 0);
  setPreviewBusGain('a1',soundtrack,audioLevelAt(a,at)*audioMixLevelAt(state,'audio-1',at));
  setPreviewBusGain('a2',audio2Player,audioLevelAt(activeAudio2Clip(state,at),at)*audioMixLevelAt(state,'audio-2',at));
  overlayVideo.muted = isSourceAudioMuted(activeOverlayClip(state,at));
  const overlayFade=overlayCrossfadeAt(state,at);
  overlayVideo.volume=Math.min(1,audioLevelAt(activeOverlayClip(state,at),at)*
    audioMixLevelAt(state,'video-2',at)*(overlayFade?1-overlayFade.progress:1));
  overlayIncoming.muted=isSourceAudioMuted(overlayFade?.incoming);
  overlayIncoming.volume=Math.min(1,overlayFade?audioLevelAt(overlayFade.incoming,at)*
    audioMixLevelAt(state,'video-2',at)*overlayFade.progress:0);
}
// V2/A2 use independent timeline positions and decoder elements.
async function syncLayerPlayer(el,clip,at,autoplay,kind) {
  if(!clip||at>=duration(state)){
    el.pause();
    if(kind==='video'||kind==='incoming'){el.style.display='none';el.style.transform='none';}
    return;
  }
  const ref=media.get(clip.asset_id);
  if(!ref){el.pause();return;}
  if(el.dataset.clip!==clip.clip_id){
    const serial=kind==='video'?++layerVideoSerial:kind==='incoming'?++layerIncomingSerial:++layerAudioSerial;
    el.pause();el.src=ref.url;el.dataset.clip=clip.clip_id;el.load();
    if(kind==='video'||kind==='incoming')applyPreviewColor();
    try{
      await new Promise((resolve,reject)=>{
        if(el.readyState>=1)return resolve();
        el.addEventListener('loadedmetadata',resolve,{once:true});
        el.addEventListener('error',()=>reject(Error(kind+' layer could not be decoded.')),{once:true});
      });
    }catch(e){status(e.message,true);return;}
    if(serial!==(kind==='video'?layerVideoSerial:kind==='incoming'?layerIncomingSerial:layerAudioSerial))return;
  }
  const expected=Math.min(clip.source.end-.005,clip.source.start+at-clip.timeline.start);
  if(Math.abs(el.currentTime-expected)>.16) {
    try{el.currentTime=Math.max(0,expected)}catch{}
  }
  const dissolveForAudio=kind==='video'||kind==='incoming'?overlayCrossfadeAt(state,at):null;
  const audioWeight=dissolveForAudio?(kind==='incoming'?dissolveForAudio.progress:1-dissolveForAudio.progress):1;
  const effectiveGain=audioLevelAt(clip,at)*audioMixLevelAt(state,clip.track_id,at)*audioWeight;
  if(el===audio2Player)setPreviewBusGain('a2',el,effectiveGain);
  else el.volume=Math.min(1,effectiveGain);
  if(kind==='video'||kind==='incoming'){
    el.muted=isSourceAudioMuted(clip);
    el.style.display='block';
    const overlayFade=overlayCrossfadeAt(state,at);
    const weight=overlayFade ? (kind==='incoming'?overlayFade.progress:1-overlayFade.progress) : 1;
    el.style.opacity=String(overlayOpacityAt(clip,at)*weight);
    const motion=overlayMotionAt(clip,at);
    el.style.transform='translate('+motion.x*100+'%,'+motion.y*100+'%)';
    el.classList.toggle('full-overlay',(clip.overlay_layout??'pip')==='full');
  }
  if(autoplay&&playing&&el.paused){
    try{await el.play()}catch(e){status(kind+' layer preview: '+e.message,true);}
  }else if(!autoplay)el.pause();
}
function pendingColorValues(){
  const values={};
  for(const key of ['brightness','contrast','saturation','warmth'])
    values[key]=Number($('color-'+key).value)/(key==='warmth'?1:100);
  return values;
}
function applyPreviewColor() {
  const find=id=>[...state.clips,...state.video2Clips].find(c=>c.clip_id===id);
  const pending=colorPreviewPending?pendingColorValues():null;
  // Before/After only affects the selected source's PROGRAM preview;
  // exports and every other clip keep their fully committed grade.
  for(const el of [video,crossfadeVideo,overlayVideo,overlayIncoming])
    el.style.filter=previewColorFor(find(el.dataset.clip),selectedId,
      {before:colorCompareBefore,pending});
}
function syncLayers(at,autoplay) {
  const dissolve=overlayCrossfadeAt(state,at);
  void syncLayerPlayer(overlayVideo,activeOverlayClip(state,at),at,autoplay,'video');
  void syncLayerPlayer(overlayIncoming,dissolve?.incoming||null,at,autoplay,'incoming');
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
    applyPreviewColor();
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
    previewAudioAt(at); syncLayers(at,true); updatePeakGuides(at);
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
  titlePlacementArmed=false;titleDrag=null;titleResizeDrag=null;
  stagedTitlePlacement=titlePlacement(title);stagedTitleScale=titleScale(title);
  $('title-position').value = style.position;
  $('title-size').value = style.size;
  $('title-color').value = style.color;
  $('title-motion').value = titleMotionId(title);
  $('title-motion-ease').value=titleMotionEaseId(title);
  $('title-motion-distance').value=String(titleMotionDistance(title));
  $('title-fade-in').value = String(style.fade_in);
  $('title-fade-out').value = String(style.fade_out);
  $('add-title').textContent = 'Save Title Changes';
  $('cancel-title-edit').hidden = false;
  selectedTitleRecipe=null;selectedTitleRhythm=null;
  refreshPlacementUI();refreshTitleDeck();showTitleAt(playhead);
  drawTitles();
}
function resetTitleEditor() {
  editingTitleId = null;
  titlePlacementArmed=false;titleDrag=null;titleResizeDrag=null;
  stagedTitlePlacement=null;stagedTitleScale=100;
  $('title-text').value = '';
  $('title-position').value = 'bottom';
  $('title-size').value = 'medium';
  $('title-color').value = 'white';
  $('title-motion').value='none';
  $('title-motion-ease').value='linear';
  $('title-motion-distance').value='100';
  $('title-fade-in').value = '0';
  $('title-fade-out').value = '0';
  $('add-title').textContent = '+ Add Text Overlay';
  $('cancel-title-edit').hidden = true;
  selectedTitleRecipe=null;selectedTitleRhythm=null;
  refreshPlacementUI();showTitleAt(playhead);
  $('title-deck-scrub').value='50';
  refreshTitleDeck();
}
function jumpToMarker(marker){
  if(!marker||exporting)return;
  selectedMarkerId=marker.marker_id;
  stopPlayback();
  drawMarkers();
  const time=Math.min(marker.time,duration(state));
  void seekTo(time);
  if(marker.time>duration(state))
    status('Marker at '+fmt(marker.time)+' lies after V1 end; Program stopped at '+fmt(time)+'.');
}
function drawMarkers(){
  const markers=sortedMarkers(state.markers),list=$('marker-list'),
    track=$('marker-track'),total=timelineExtent();
  list.replaceChildren();track.replaceChildren();
  if(selectedMarkerId&&!markers.some(m=>m.marker_id===selectedMarkerId))
    selectedMarkerId=null;
  $('marker-count').textContent=markers.length+' marker'+(markers.length===1?'':'s');
  $('marker-add').disabled=exporting||markers.length>=100||!state.clips.length;
  $('marker-prev').disabled=exporting||!navigateMarker(markers,playhead,'previous');
  $('marker-next').disabled=exporting||!navigateMarker(markers,playhead,'next');
  for(const marker of markers){
    const pin=document.createElement('button');
    pin.type='button';pin.className='marker-pin marker-'+marker.color+
      (selectedMarkerId===marker.marker_id?' selected':'');
    pin.style.left=String(Math.min(100,100*marker.time/total))+'%';
    pin.title=marker.label+' · '+fmt(marker.time)+(marker.note?' · '+marker.note:'');
    pin.setAttribute('aria-label','Marker '+marker.label+' at '+fmt(marker.time));
    pin.textContent='◆';pin.disabled=exporting;
    pin.addEventListener('click',()=>jumpToMarker(marker));track.append(pin);

    const li=document.createElement('li');li.className='marker-item';
    if(selectedMarkerId===marker.marker_id)li.classList.add('selected');
    const nav=document.createElement('button');nav.type='button';nav.disabled=exporting;
    nav.className='marker-select marker-'+marker.color;
    nav.textContent=fmt(marker.time)+' · '+marker.label;
    nav.title=marker.note||'Click to navigate and edit';
    nav.addEventListener('click',()=>jumpToMarker(marker));
    const note=document.createElement('span');note.className='marker-note';
    note.textContent=marker.note;
    li.append(nav,note);list.append(li);
  }
  const selected=markers.find(m=>m.marker_id===selectedMarkerId);
  $('marker-edit').hidden=!selected;
  if(selected){
    $('marker-label').value=selected.label;
    $('marker-time').value=String(selected.time);
    $('marker-note').value=selected.note;
    $('marker-color').value=selected.color;
  }
  for(const name of ['marker-label','marker-time','marker-note','marker-color',
    'marker-save','marker-delete','marker-cancel'])$(name).disabled=exporting||!selected;
}
function markerFormValues(){
  return {time:Number($('marker-time').value),
    label:$('marker-label').value,note:$('marker-note').value,
    color:$('marker-color').value};
}
function drawTitles() {
  // Reconcile selection on deletes, draft imports, Undo/Redo or project reset.
  const existing=new Set(state.titles.map(t=>t.title_id));
  for(const id of multiTitleIds)if(!existing.has(id))multiTitleIds.delete(id);
  const list = $('title-list'), track = $('title-track');
  list.replaceChildren(); track.replaceChildren();
  if (!state.titles.length) {
    const empty = document.createElement('span');
    empty.className = 'empty-timeline'; empty.textContent = 'Add timed text in the Titles panel.';
    track.append(empty);
  }
  for (const title of state.titles) {
    const row = document.createElement('div');
    row.className = 'title-item' + (title.title_id === editingTitleId ? ' editing' : '')+
      (multiTitleIds.has(title.title_id)?' batch-selected':'');
    const toggleLabel=document.createElement('label');
    toggleLabel.className='title-batch-check';
    const toggle=document.createElement('input');
    toggle.type='checkbox';toggle.className='title-batch-select';
    toggle.checked=multiTitleIds.has(title.title_id);toggle.disabled=exporting;
    toggle.setAttribute('aria-label','Select title '+title.text.slice(0,50)+' for batch styling');
    toggle.addEventListener('change',()=>{
      if(toggle.checked)multiTitleIds.add(title.title_id);
      else multiTitleIds.delete(title.title_id);
      row.classList.toggle('batch-selected',toggle.checked);
      refreshTitleBatch();
    });
    toggleLabel.append(toggle);
    const label = document.createElement('span'); label.textContent = title.text;
    const times = document.createElement('small'); times.textContent = fmt(title.start) + ' → ' + fmt(title.end);
    label.append(times);
    const editButton = document.createElement('button'); editButton.type = 'button'; editButton.textContent = 'Edit';
    editButton.title = 'Edit title style and timing'; editButton.disabled = exporting;
    editButton.addEventListener('click', () => loadTitleForEdit(title));
    const del = document.createElement('button'); del.type = 'button'; del.textContent = 'Delete';
    del.title = 'Delete title'; del.disabled = exporting;
    del.addEventListener('click', () => edit({type:'title.deleted',title_id:title.title_id}));
    row.append(toggleLabel,label,editButton,del); list.append(row);
    const chip = document.createElement('button'); chip.type='button'; chip.className='title-chip';
    chip.textContent = title.text.length > 28 ? title.text.slice(0,28) + '…' : title.text;
    chip.title = 'Seek to ' + fmt(title.start); chip.disabled = exporting;
    chip.addEventListener('click', () => { stopPlayback(); void seekTo(Math.min(title.start,duration(state))); });
    chip.style.left=String(100*title.start/timelineExtent())+'%';
    chip.style.width=String(Math.max(.3,100*(title.end-title.start)/timelineExtent()))+'%';
    track.append(chip);
  }
  refreshTitleBatch();
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
  const motion=titleMotionAt(title,at);
  ctx.translate(motion.x,motion.y);
  const size = titleScale(title)===100?fontSizes[style.size]:titleScaledFont(title);
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
  const placement=titleAnchor(title);
  const center=placement.y;
  const start = center - (shown.length - 1) * (size * 1.08 / 2);
  shown.forEach((line,i) => {
    const y = start + size * 1.08 * i;
    ctx.lineWidth = 8; ctx.strokeStyle = '#000d';
    ctx.strokeText(line, placement.x, y, maxWidth);
    ctx.fillStyle = colors[style.color]; ctx.fillText(line, placement.x, y, maxWidth);
  });
  ctx.restore();
}
function selectedAudioClip() {
  return [...state.audioClips,...state.audio2Clips].find(c=>c.clip_id===selectedId) || null;
}
function drawTrimWaveform() {
  const clip=selectedAudioClip();
  $('waveform-trim-panel').hidden=!clip;
  if(!clip)return;
  const peaks=waveforms.get(clip.asset_id),asset=state.assets.find(a=>a.asset_id===clip.asset_id);
  const canvas=$('waveform-trim-canvas');
  const ready=Array.isArray(peaks)&&peaks.length>0&&asset?.duration>0;
  canvas.hidden=!ready;
  $('waveform-trim-note').textContent=ready
    ? 'Drag near an IN or OUT marker, or edit the source seconds above. Press Apply Trim to save.'
    : 'Waveform unavailable (large/unsupported audio or source not relinked). Use the numeric source times.';
  if(!ready)return;
  try{
    paintTrimWaveform(canvas,peaks,asset.duration,
      Number($('in-time').value),Number($('out-time').value));
  }catch{ /* leave numeric invalid input visible for correction */ }
}
function updatePeakGuides(at) {
  const live=Boolean(liveBusMeters && playing &&
    liveBusMeters.context.state==='running');
  $('audio-meter-mode').textContent=live?'Measured A1/A2 playback peaks':'Estimated source peaks';
  $('audio-meter-status').textContent=live
    ? 'Live • Web Audio post-track-gain'
    : liveMeterUnavailable?'Web Audio unavailable; showing estimates'
      : 'Press Play to activate live bus meters';
  for(const [key,track] of [['a1','audio-1'],['a2','audio-2']]) {
    if(live) {
      const result=liveBusMeters.read(key);
      $('peak-'+key).value=result.peak;
      $('peak-'+key+'-value').textContent=formatDbfs(result.dbfs);
      $('peak-'+key+'-label').textContent=key.toUpperCase()+' live peak';
    } else {
      const data=estimateTrackPeak(state,track,at,waveforms);
      $('peak-'+key).value=data.peak;
      $('peak-'+key+'-value').textContent=data.available
        ? Math.round(data.peak*100)+'%' : '—';
      $('peak-'+key+'-label').textContent=key.toUpperCase()+' estimate';
    }
  }
}
function adjustTrimAtFraction(edge,fraction) {
  const clip=selectedAudioClip();
  if(!clip || exporting)return;
  const asset=state.assets.find(a=>a.asset_id===clip.asset_id);
  if(!asset)return;
  const time=sourceTimeAtFraction(fraction,asset.duration);
  const start=Number($('in-time').value),end=Number($('out-time').value);
  const min=.08;
  const value=edge==='in'?Math.min(time,end-min):Math.max(time,start+min);
  if(edge==='in')$('in-time').value=String(Math.max(0,Math.round(value*1000)/1000));
  else $('out-time').value=String(Math.min(asset.duration,Math.round(value*1000)/1000));
  drawTrimWaveform();
}
// R6.6 Effects Controls are UI preferences, not saved project edits.
function effectsStorage(){
  try{return window.localStorage;}catch{return null;}
}
let effectsView=readEffectsView(effectsStorage());
function applyEffectsView(){
  for(const name of EFFECTS_SECTIONS){
    $('effects-'+name).open=effectsView[name];
  }
  const expanded=EFFECTS_SECTIONS.filter(name=>effectsView[name]).length;
  $('effects-view-status').textContent=expanded+' / '+EFFECTS_SECTIONS.length+' sections open · local preference';
}
function refreshEffectsSections(clip){
  const visible=effectsVisibility(clip),summaries=effectsSummaries(clip);
  for(const name of EFFECTS_SECTIONS){
    $('effects-'+name).hidden=!visible[name];
    $('effects-'+name+'-summary').textContent=summaries[name];
  }
}
for(const name of EFFECTS_SECTIONS){
  const el=$('effects-'+name);
  el.addEventListener('toggle',()=>{
    if(effectsView[name]===el.open)return;
    effectsView=setEffectsSection(effectsView,name,el.open);
    writeEffectsView(effectsStorage(),effectsView);
    applyEffectsView();
  });
}
for(const [id,open] of [['effects-expand-all',true],['effects-collapse-all',false]]){
  $(id).addEventListener('click',()=>{
    effectsView=allEffectsSections(open);
    applyEffectsView();
    writeEffectsView(effectsStorage(),effectsView);
  });
}
function drawInspector() {
  const clip = [...state.clips, ...state.audioClips,...state.video2Clips,...state.audio2Clips].find(c => c.clip_id === selectedId);
  if(lastColorSelectedId!==selectedId){
    colorCompareBefore=false;colorPreviewPending=false;
    lastColorSelectedId=selectedId;
  }
  const isVideo=Boolean(clip?.track_id.startsWith('video-'));
  refreshEffectsSections(clip);
  $('program-grade-compare').disabled=!isVideo||exporting;
  $('program-grade-compare').setAttribute('aria-pressed',String(colorCompareBefore));
  $('program-grade-compare').textContent=colorCompareBefore?'Showing Before':'Before/After';
  $('program-grade-compare').title='Compare selected clip only; no export or ledger changes';
  for(const look of Object.keys(COLOR_LOOK_NAMES)){
    const button=document.querySelector('[data-color-look="'+look+'"]');
    if(button)button.disabled=!isVideo||exporting;
  }
  $('inspector-fields').hidden = !clip;
  $('inspector-empty').hidden = Boolean(clip);
  $('clip-color-control').hidden=!clip||!clip.track_id.startsWith('video-');
  refreshAttributes();
  if (!clip) return;
  if(clip.track_id.startsWith('video-')) {
    colorPreviewPending=false;
    const values=clipColor(clip);
    for(const key of ['brightness','contrast','saturation','warmth']){
      const display=key==='warmth'?Math.round(values[key]):Math.round(values[key]*100);
      $('color-'+key).value=String(display);
      $('color-'+key+'-value').textContent=display+(key==='warmth'?'':'%');
      $('color-'+key).disabled=exporting;
    }
    $('apply-clip-color').disabled=exporting;
    $('reset-clip-color').disabled=exporting;
  }
for(const [property,field,allowed] of [
    ['opacity','opacity_keyframes',clip.track_id==='video-2'],
    ['volume','volume_keyframes',true]]){
    $('keyframe-'+property+'-editor').hidden=!allowed;
    const points=keyframePointsFor(clip,field);
    const values={start:points[0].value,end:points.at(-1).value};
    for(const end of ['start','end'])
      $('keyframe-'+property+'-'+end).value=String(Math.round(values[end]*100));
    $('apply-'+property+'-keyframes').disabled=exporting||!allowed;
    $('clear-'+property+'-keyframes').disabled=exporting||!allowed||
      (!clip[field]&&!clip[pointsField(field)]);
  }

    const asset = state.assets.find(a => a.asset_id === clip.asset_id);
  $('selected-name').textContent = asset?.name || 'Unknown asset';
  $('in-time').value = String(clip.source.start);
  $('out-time').value = String(clip.source.end);
  $('in-time').max = String(asset.duration);
  $('out-time').max = String(asset.duration);
  const nextBoundary = state.clips.findIndex(c => c.clip_id === clip.clip_id);
  const transitionAllowed = clip.track_id === 'video-1' && nextBoundary >= 0 && nextBoundary < state.clips.length-1;
  const overlayIndex=state.video2Clips.findIndex(c=>c.clip_id===clip.clip_id);
  const overlayAllowed=overlayIndex>=0 && overlayIndex<state.video2Clips.length-1;
  const overlayMax=overlayAllowed?maxOverlayCrossfade(state.video2Clips,overlayIndex):0;
  $('v2-transition-control').hidden=!overlayAllowed;
  $('v2-dissolve-seconds').value=String(clip.transition_out_seconds??0);
  $('v2-dissolve-seconds').max=String(overlayMax);
  $('apply-v2-dissolve').disabled=exporting||!overlayAllowed;
  $('v2-dissolve-note').textContent=overlayMax>0
    ? '0 = hard cut · maximum '+overlayMax.toFixed(2)+'s. Remove before moving either joined clip.'
    : 'Requires two touching, unjoined V2 clips with enough duration.';
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
  drawTrimWaveform();
}
function drawReceipts() {
  $('receipt-count').textContent = String(state.receipts.length);
  const list = $('receipts'); list.replaceChildren();
  for (const entry of state.receipts.slice(-12).reverse()) {
    const li = document.createElement('li');
    li.textContent = String(entry.action || 'unknown').slice(0, 90) +
      ' · ' + String(entry.at || '').slice(11, 19) + colorReceiptSummary(entry);
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
  updateToolUI();
  drawMixer();
  drawMedia(); drawTimeline(); drawInspector(); drawTitles(); drawMarkers(); drawReceipts(); updateTimeUI();
  previewAudioAt(playhead);
  updatePeakGuides(playhead);
  $('undo').disabled = !state.undo.length || exporting;
  $('redo').disabled = !state.redo.length || exporting;
  $('split').disabled = !selectedId || exporting;
  $('remove').disabled = !selectedId || exporting;
  try {
    const plan=synchronizedRipplePlan(state,selectedId);
    $('ripple-delete').disabled=exporting;
    $('ripple-delete').title='Remove '+fmt(plan.span)+
      ' from V1; move '+plan.affected.v2.length+' V2, '+
      plan.affected.a2.length+' A2 and '+plan.affected.titles.length+
      ' title(s). A1 is unchanged.';
  }catch(e){
    $('ripple-delete').disabled=true;
    $('ripple-delete').title=e.message;
  }
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
  setPreviewBusGain('a1',soundtrack,audioLevelAt(clip,at)*audioMixLevelAt(state,'audio-1',at));
  if (autoplay && playing && soundtrack.paused) {
    try { await soundtrack.play(); } catch (e) { status('Soundtrack preview: ' + e.message, true); }
  } else if (!autoplay) soundtrack.pause();
}
async function seekTo(seconds, { autoplay = false } = {}) {
  // Start/resume the preview AudioContext before any async metadata awaits.
  // Browsers generally require this to happen inside the user gesture.
  if(autoplay)ensureLiveBusMeters();
  applyTransportSpeed();
  const serial = ++seekSerial, d = duration(state);
  playhead = Math.max(0, Math.min(d, Number(seconds) || 0));
  updateTimeUI();
  let clip = activeClip(state, Math.min(playhead, Math.max(0,d-0.001)));
  if (!clip) {
    playing = false; video.pause(); soundtrack.pause(); overlayVideo.pause();overlayIncoming.pause(); audio2Player.pause(); overlayVideo.style.display='none'; video.style.display = 'none';
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
      ensureLiveBusMeters();
      await video.play(); playing = true;
    } else { video.pause(); playing = false; }
    applyTransportSpeed();
    void syncSoundtrack(playhead, playing);
    void syncCrossfadePreview(playhead, playing);
    syncLayers(playhead,playing);
    if (playing) startTransitionFrames();
    updateTimeUI();
  } catch (e) { playing = false; status('Preview failed: ' + e.message, true); updateTimeUI(); }
}
function stopPlayback() {
  transportSpeed=1;applyTransportSpeed();
  playing = false; video.pause(); soundtrack.pause(); overlayVideo.pause();overlayIncoming.pause(); audio2Player.pause(); hideCrossfadePreview();
  if (transitionFrameHandle) cancelAnimationFrame(transitionFrameHandle);
  transitionFrameHandle=0; updateTimeUI();updatePeakGuides(playhead);
}
function edit(command) {
  if (exporting) return status('Finish or cancel export before editing.', true);
  try {
    if (['clip.source-audio.muted','clip.audio.updated','clip.overlay.updated','clip.color.updated','clip.keyframes.updated','clip.keyframe.points.updated','mixer.updated','mixer.duck.updated','title.added','title.updated','title.deleted','title.batch.styled','marker.added','marker.updated','marker.deleted'].includes(command.type)) {
      // Audio-only edit: update the currently audible clip without pausing playback.
      state = change(state, command);
      const onScreen = activeClip(state, Math.min(playhead, Math.max(0, duration(state) - .001)));
      video.muted = isSourceAudioMuted(onScreen);
      previewAudioAt(playhead);
      applyPreviewColor();
      render();
      if(['clip.keyframes.updated','clip.keyframe.points.updated'].includes(command.type))syncLayers(playhead,playing);
      status(command.type === 'clip.source-audio.muted'
        ? (command.muted ? 'Original video audio muted. A1 stays on.' : 'Original video audio restored.')
        : command.type + ' ✓');
      return;
    }
    stopPlayback();
    state = change(state, command);
    if(command.type==='clip.ripple.deleted')playhead=state.receipts.at(-1).details.start;
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
for(const [key,mode] of [['tool-select','select'],['tool-razor','razor']]){
  $(key).addEventListener('click',()=>setEditingTool(mode));
}
for(const [key,track] of [['v1','video-1'],['v2','video-2'],['a1','audio-1'],['a2','audio-2']]){
  $('target-'+key).addEventListener('click',()=>{
    if(exporting)return;
    if(razorTargets.has(track))razorTargets.delete(track);
    else razorTargets.add(track);
    updateToolUI();
  });
}
function frameJog(step) {
  if(exporting||!state.clips.length)return;
  stopPlayback();
  const next=Math.max(0,Math.min(duration(state),
    Math.round(playhead*30+step)/30));
  void seekTo(Math.round(next*1000)/1000);
}
$('jog-back').addEventListener('click',()=>frameJog(-1));
$('jog-next').addEventListener('click',()=>frameJog(1));
$('jog-stop').addEventListener('click',()=>{if(!exporting)stopPlayback();});
$('jog-forward').addEventListener('click',async()=>{
  if(exporting||!state.clips.length)return;
  if(playing){
    transportSpeed=transportSpeed===1?2:1;
    applyTransportSpeed();
    status('Forward playback '+transportSpeed+'×');
    return;
  }
  sourceVideo.pause();
  transportSpeed=1;
  if(playhead>=duration(state)-.005)playhead=0;
  await seekTo(playhead,{autoplay:true});
  applyTransportSpeed();
  if(playing)status('Forward playback 1×');
});
$('play').addEventListener('click', async () => {
  if (!state.clips.length) return;
  if (playing) return stopPlayback();
  if (playhead >= duration(state) - .005) playhead = 0;
  sourceVideo.pause();
  await seekTo(playhead, { autoplay:true });
});
$('backward').addEventListener('click', () => { stopPlayback(); void seekTo(0); });
$('forward').addEventListener('click', () => { stopPlayback(); void seekTo(duration(state)); });
$('seek').addEventListener('input', event => { const autoplay = playing; stopPlayback(); void seekTo(Number(event.target.value), { autoplay }); });
$('media-search').addEventListener('input',drawMedia);
$('media-sort').addEventListener('change',drawMedia);
sourceVideo.addEventListener('timeupdate',refreshSourceMonitor);
sourceVideo.addEventListener('play',()=>{
  if(playing)stopPlayback();
  refreshSourceMonitor();
});
sourceVideo.addEventListener('pause',refreshSourceMonitor);
$('source-play').addEventListener('click',async()=>{
  if(!currentSource()||exporting)return;
  if(!sourceVideo.paused){sourceVideo.pause();return;}
  stopPlayback();
  try{await sourceVideo.play();}catch(e){status('Source playback: '+e.message,true);}
});
$('source-seek').addEventListener('input',e=>{
  if(!currentSource())return;
  sourceVideo.pause();
  const max=currentSource().duration;
  try{sourceVideo.currentTime=Math.max(0,Math.min(max,Number(e.target.value)));}
  catch(e){status('Source seek: '+e.message,true);}
  refreshSourceMonitor();
});
$('source-mark-in').addEventListener('click',()=>{
  const asset=currentSource();if(!asset)return;
  sourceIn=Math.min(asset.duration,Math.max(0,Math.round(sourceVideo.currentTime*1000)/1000));
  refreshSourceMonitor();
});
$('source-mark-out').addEventListener('click',()=>{
  const asset=currentSource();if(!asset)return;
  sourceOut=Math.min(asset.duration,Math.max(0,Math.round(sourceVideo.currentTime*1000)/1000));
  refreshSourceMonitor();
});
for(const [field,prop] of [['source-in','in'],['source-out','out']])
  $(field).addEventListener('change',e=>{
    if(!currentSource())return;
    const val=Number(e.target.value);
    if(prop==='in')sourceIn=val;else sourceOut=val;
    refreshSourceMonitor();
  });
$('source-insert').addEventListener('click',()=>applySourceEdit('clip.source.inserted'));
$('source-replace').addEventListener('click',()=>applySourceEdit('clip.source.replaced'));
$('source-match-frame').addEventListener('click',()=>matchFrame(selectedClip()));
for(const kind of ['color','overlay']){
  $('copy-'+kind).addEventListener('click',()=>copyAttributes(kind));
  $('paste-'+kind).addEventListener('click',()=>pasteAttributes(kind));
}
$('drop-zone').addEventListener('click', () => $('video-input').click());
$('drop-zone').addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('video-input').click(); } });
$('video-input').addEventListener('change', async e => { await importVideos([...e.target.files]); e.target.value=''; });
for (const kind of ['dragenter', 'dragover']) $('drop-zone').addEventListener(kind, e => { e.preventDefault(); e.currentTarget.classList.add('drag'); });
for (const kind of ['dragleave', 'drop']) $('drop-zone').addEventListener(kind, e => { e.preventDefault(); e.currentTarget.classList.remove('drag'); });
$('drop-zone').addEventListener('drop', e => { void importVideos([...e.dataTransfer.files]); });
$('apply-trim').addEventListener('click', () => edit({ type:'clip.trimmed', clip_id:selectedId, start:Number($('in-time').value), end:Number($('out-time').value) }));
for(const id of ['in-time','out-time'])$(''+id).addEventListener('input',drawTrimWaveform);
for(const edge of ['in','out']) {
  $('waveform-'+edge+'-playhead').addEventListener('click',()=>{
    const clip=selectedAudioClip();if(!clip)return;
    const asset=state.assets.find(a=>a.asset_id===clip.asset_id);
    if(!asset)return;
    const sourceAt=clip.source.start+(playhead-clip.timeline.start);
    adjustTrimAtFraction(edge,Math.max(0,Math.min(1,sourceAt/asset.duration)));
  });
}
const trimCanvas=$('waveform-trim-canvas');
function trimFraction(event) {
  const r=trimCanvas.getBoundingClientRect();
  return Math.max(0,Math.min(1,(event.clientX-r.left)/Math.max(1,r.width)));
}
trimCanvas.addEventListener('pointerdown',event=>{
  if(exporting||!selectedAudioClip())return;
  const clip=selectedAudioClip(),asset=state.assets.find(a=>a.asset_id===clip.asset_id);
  if(!asset)return;
  const f=trimFraction(event),start=Number($('in-time').value)/asset.duration;
  const end=Number($('out-time').value)/asset.duration;
  draggingTrimEdge=Math.abs(f-start)<=Math.abs(f-end)?'in':'out';
  trimCanvas.setPointerCapture(event.pointerId);
  adjustTrimAtFraction(draggingTrimEdge,f);
  event.preventDefault();
});
trimCanvas.addEventListener('pointermove',event=>{
  if(draggingTrimEdge&&trimCanvas.hasPointerCapture(event.pointerId))
    adjustTrimAtFraction(draggingTrimEdge,trimFraction(event));
});
for(const type of ['pointerup','pointercancel','lostpointercapture'])
  trimCanvas.addEventListener(type,()=>{draggingTrimEdge=null;});
$('clip-volume').addEventListener('input', e => {
  $('volume-number').textContent = e.target.value + '%';
});
$('apply-v2-dissolve').addEventListener('click',()=>edit({
  type:'clip.overlay.transition.updated',clip_id:selectedId,
  seconds:Number($('v2-dissolve-seconds').value)
}));
$('apply-crossfade').addEventListener('click', () => edit({
  type:'clip.transition.updated',clip_id:selectedId,seconds:Number($('crossfade-seconds').value)
}));
$('apply-layer-start').addEventListener('click',()=>placeOnLayer({type:'clip.layer.moved',
  clip_id:selectedId,start:Number($('layer-start').value)}));
for(const key of ['brightness','contrast','saturation','warmth']) {
  $('color-'+key).addEventListener('input',e=>{
    $('color-'+key+'-value').textContent=e.target.value+(key==='warmth'?'':'%');
    colorPreviewPending=true;
    applyPreviewColor();
  });
}
function submitColor() {
  colorCompareBefore=false;
  colorPreviewPending=false;
  edit({type:'clip.color.updated',clip_id:selectedId,color:pendingColorValues()});
}
$('apply-clip-color').addEventListener('click',submitColor);
$('program-grade-compare').addEventListener('click',()=>{
  const clip=[...state.clips,...state.video2Clips].find(c=>c.clip_id===selectedId);
  if(!clip||exporting)return;
  colorCompareBefore=!colorCompareBefore;
  $('program-grade-compare').setAttribute('aria-pressed',String(colorCompareBefore));
  $('program-grade-compare').textContent=colorCompareBefore?'Showing Before':'Before/After';
  applyPreviewColor();
});
for(const key of Object.keys(COLOR_LOOK_NAMES)){
  const button=document.querySelector('[data-color-look="'+key+'"]');
  button.addEventListener('click',()=>{
    const clip=[...state.clips,...state.video2Clips].find(c=>c.clip_id===selectedId);
    if(!clip||exporting)return;
    colorCompareBefore=false;colorPreviewPending=false;
    edit({type:'clip.color.updated',clip_id:selectedId,color:colorLook(key)});
    status(COLOR_LOOK_NAMES[key]+' look applied · edit receipt saved');
  });
}
$('reset-clip-color').addEventListener('click',()=>{
  const clip=[...state.clips,...state.video2Clips].find(c=>c.clip_id===selectedId);
  if(clip){colorCompareBefore=false;colorPreviewPending=false;
    edit({type:'clip.color.updated',clip_id:selectedId,color:{...COLOR_DEFAULTS}});}
});
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
for(const [property,field] of [['opacity','opacity_keyframes'],['volume','volume_keyframes']]){
  $('apply-'+property+'-keyframes').addEventListener('click',()=>{
    if(!selectedId)return;
    const values={
      start:Number($('keyframe-'+property+'-start').value)/100,
      end:Number($('keyframe-'+property+'-end').value)/100
    };
    try{validateKeyframePair(values);}
    catch(e){return status(e.message,true);}
    edit({type:'clip.keyframes.updated',clip_id:selectedId,field,values});
  });
  $('clear-'+property+'-keyframes').addEventListener('click',()=>{
    if(!selectedId)return;
    edit({type:'clip.keyframes.updated',clip_id:selectedId,field,values:null});
  });
}
$('apply-audio').addEventListener('click', () => edit({
  type:'clip.audio.updated',clip_id:selectedId,volume:Number($('clip-volume').value)/100,
  fade_in:Number($('fade-in').value),fade_out:Number($('fade-out').value)
}));
$('marker-add').addEventListener('click',()=>{
  if(exporting||!state.clips.length)return;
  const ids=new Set(state.markers.map(m=>m.marker_id)),before=state.receipts.length;
  edit({type:'marker.added',marker:{time:Math.round(playhead*1000)/1000,
    label:'Marker '+(state.markers.length+1),note:'',color:'mint'}});
  if(state.receipts.length>before){
    const created=state.markers.find(m=>!ids.has(m.marker_id));
    selectedMarkerId=created?.marker_id||null;drawMarkers();
  }
});
$('marker-save').addEventListener('click',()=>{
  if(!selectedMarkerId)return;
  edit({type:'marker.updated',marker_id:selectedMarkerId,marker:markerFormValues()});
});
$('marker-delete').addEventListener('click',()=>{
  if(!selectedMarkerId)return;
  edit({type:'marker.deleted',marker_id:selectedMarkerId});
});
$('marker-cancel').addEventListener('click',()=>{selectedMarkerId=null;drawMarkers();});
$('marker-prev').addEventListener('click',()=>
  jumpToMarker(navigateMarker(state.markers,playhead,'previous')));
$('marker-next').addEventListener('click',()=>
  jumpToMarker(navigateMarker(state.markers,playhead,'next')));
// R8.4: Position a selected saved T1 title directly in Program.
// Pointer, numeric and keyboard changes are pending form state ONLY.
function refreshPlacementUI(){
  const point=stagedTitlePlacement||titleAnchor({position:$('title-position').value});
  $('title-x').value=String(point.x);
  $('title-y').value=String(point.y);
  $('title-place-toggle').disabled=exporting||!editingTitleId;
  $('title-place-reset').disabled=exporting;
  $('title-scale').disabled=exporting;
  $('title-scale').value=String(stagedTitleScale);
  $('title-scale-value').textContent=stagedTitleScale+'%';
  $('title-safe-guides').hidden=!safeGuidesVisible;
  $('title-safe-toggle').setAttribute('aria-pressed',String(safeGuidesVisible));
  $('title-safe-toggle').textContent=safeGuidesVisible?'Hide Safe-Area Guides':'Show Safe-Area Guides';
  $('title-x').disabled=exporting;
  $('title-y').disabled=exporting;
  $('title-place-toggle').setAttribute('aria-pressed',String(titlePlacementArmed));
  $('title-place-toggle').textContent=titlePlacementArmed
    ?'Stop Placing (Keep Draft)':'Place Selected Title in Program';
  $('title-place-status').textContent=stagedTitlePlacement
    ?'Custom X '+point.x+' · Y '+point.y+
      ' · not saved. Drag selected title in Program or Save Title to commit.'
    :'Anchor position (no custom coordinates). Use X/Y or Place to set a draft.';
  refreshTitleLayoutUI();
}
function refreshTitleLayoutUI(){
  const active=titleAlignmentId(stagedTitlePlacement);
  for(const item of TITLE_ALIGNMENTS){
    const button=document.querySelector('[data-title-align="'+item.id+'"]');
    button.disabled=exporting;
    button.setAttribute('aria-pressed',String(active===item.id));
  }
  for(const p of TITLE_TRANSFORM_PRESETS){
    const expected=titleTransformPreset(p.id);
    const selected=stagedTitlePlacement!==null&&
      stagedTitlePlacement.x===expected.placement.x&&
      stagedTitlePlacement.y===expected.placement.y&&stagedTitleScale===expected.scale;
    const button=document.querySelector('[data-title-layout="'+p.id+'"]');
    button.disabled=exporting;
    button.setAttribute('aria-pressed',String(selected));
  }
  $('title-transform-copy').disabled=exporting;
  $('title-transform-paste').disabled=exporting||!copiedTitleTransform;
  $('title-layout-readout').textContent=titleTransformReadout(stagedTitlePlacement,stagedTitleScale);
}
function stageTitleTransform(point,scale){
  const snapshot=titleTransformClipboard(point,scale);
  stagedTitlePlacement=snapshot.placement;
  stagedTitleScale=snapshot.scale;
  selectedTitleRecipe=null;
  refreshPlacementUI();
  refreshTitleDeck();
  showTitleAt(playhead);
}
function stageTitlePlacement(point){
  const checked=titlePlacementFields(point);
  stagedTitlePlacement={x:checked.title_x,y:checked.title_y};
  refreshPlacementUI();
  showTitleAt(playhead);
  refreshTitleDeck();
}
$('title-place-toggle').addEventListener('click',()=>{
  if(exporting||!editingTitleId)return;
  titlePlacementArmed=!titlePlacementArmed;
  titleDrag=null;titleResizeDrag=null;
  if(titlePlacementArmed){
    const title=state.titles.find(t=>t.title_id===editingTitleId);
    if(!title){titlePlacementArmed=false;refreshPlacementUI();return;}
    if(!stagedTitlePlacement)stagedTitlePlacement=titleAnchor(title);
    stopPlayback();
    // Seek into the title's interior, not its fully transparent first frame.
    const center=(title.start+title.end)/2;
    if(!visibleTitle(state,playhead)||visibleTitle(state,playhead)?.title_id!==title.title_id)
      void seekTo(Math.min(center,Math.max(0,duration(state)-.001)));
    else showTitleAt(playhead);
  }
  refreshPlacementUI();refreshTitleDeck();showTitleAt(playhead);
  if(titlePlacementArmed)$('title-preview').focus({preventScroll:true});
});
$('title-place-reset').addEventListener('click',()=>{
  if(exporting)return;
  stagedTitlePlacement=null;titlePlacementArmed=false;titleDrag=null;titleResizeDrag=null;
  refreshPlacementUI();refreshTitleDeck();showTitleAt(playhead);
  status('Original anchored title position staged. Save Title to commit.');
});
for(const id of ['title-x','title-y']){
  $(id).addEventListener('change',()=>{
    if(exporting)return;
    try{
      const x=Number($('title-x').value),y=Number($('title-y').value);
      stageTitlePlacement({x,y});
    }catch(e){status(e.message,true);refreshPlacementUI();}
  });
}
const titleHandle=$('title-preview');
titleHandle.addEventListener('pointerdown',event=>{
  const visible=visibleTitle(state,playhead);
  if(!titlePlacementArmed||exporting||event.button!==0||
    visible?.title_id!==editingTitleId)return;
  event.preventDefault();
  titleDrag={pointer:event.pointerId,
    sx:event.clientX,sy:event.clientY,
    original:stagedTitlePlacement||titleAnchor(visible)};
  titleHandle.setPointerCapture(event.pointerId);
  titleHandle.classList.add('dragging');
});
titleHandle.addEventListener('pointermove',event=>{
  if(!titleDrag||titleDrag.pointer!==event.pointerId||exporting)return;
  const rect=titleHandle.parentElement.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  try{
    const moved=titleNudgePlacement(titleDrag.original,
      (event.clientX-titleDrag.sx)*1280/rect.width,
      (event.clientY-titleDrag.sy)*720/rect.height,
      {snap:$('title-place-snap').checked});
    stageTitlePlacement(moved);
  }catch(e){status(e.message,true);}
});
function finishPlacementDrag(event,abort=false){
  if(!titleDrag||titleDrag.pointer!==event.pointerId)return;
  const original=titleDrag.original;titleDrag=null;
  titleHandle.classList.remove('dragging');
  if(titleHandle.hasPointerCapture(event.pointerId))
    titleHandle.releasePointerCapture(event.pointerId);
  if(abort)stageTitlePlacement(original);
  status(abort?'Title drag canceled; original pending location restored.':
    'Title location staged. Save Title Changes to commit.');
}
titleHandle.addEventListener('pointerup',event=>finishPlacementDrag(event));
titleHandle.addEventListener('pointercancel',event=>finishPlacementDrag(event,true));
titleHandle.addEventListener('keydown',event=>{
  if(!titlePlacementArmed||exporting||!editingTitleId)return;
  if(event.key==='Escape'){
    event.preventDefault();
    if(titleDrag){stageTitlePlacement(titleDrag.original);titleDrag=null;}
    titlePlacementArmed=false;titleResizeDrag=null;
    $('title-resize-handle').classList.remove('dragging');
    titleHandle.classList.remove('dragging');
    refreshPlacementUI();showTitleAt(playhead);return;
  }
  const move={ArrowLeft:[-1,0],ArrowRight:[1,0],
    ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
  if(!move)return;
  event.preventDefault();
  const visible=state.titles.find(t=>t.title_id===editingTitleId);
  if(!visible)return;
  const base=stagedTitlePlacement||titleAnchor(visible),step=event.shiftKey?10:1;
  stageTitlePlacement(titleNudgePlacement(base,move[0]*step,move[1]*step));
});

// R8.6: a persistent-in-session clipboard and static, allowlisted layouts.
// None of these controls commits a project action; Add/Save Title still does.
for(const option of TITLE_ALIGNMENTS){
  document.querySelector('[data-title-align="'+option.id+'"]')
    .addEventListener('click',()=>{
      if(exporting)return;
      try{
        stageTitleTransform(titleAlignmentPoint(option.id),stagedTitleScale);
        status(option.label+' alignment staged. Save Title to commit.');
      }catch(e){status(e.message,true);refreshPlacementUI();}
    });
}
for(const preset of TITLE_TRANSFORM_PRESETS){
  document.querySelector('[data-title-layout="'+preset.id+'"]')
    .addEventListener('click',()=>{
      if(exporting)return;
      try{
        const staged=titleTransformPreset(preset.id);
        stageTitleTransform(staged.placement,staged.scale);
        status(preset.label+' layout staged. Save Title to commit.');
      }catch(e){status(e.message,true);refreshPlacementUI();}
    });
}
$('title-transform-copy').addEventListener('click',()=>{
  if(exporting)return;
  try{
    copiedTitleTransform=titleTransformClipboard(stagedTitlePlacement,stagedTitleScale);
    refreshPlacementUI();
    status('Title position and size copied for this Studio session.');
  }catch(e){status(e.message,true);}
});
$('title-transform-paste').addEventListener('click',()=>{
  if(exporting||!copiedTitleTransform)return;
  try{
    stageTitleTransform(copiedTitleTransform.placement,copiedTitleTransform.scale);
    status('Copied title transform staged. Save Title to commit.');
  }catch(e){status(e.message,true);refreshPlacementUI();}
});

// R8.5: Safe guides never touch project media, canvas or export.
$('title-safe-toggle').addEventListener('click',()=>{
  safeGuidesVisible=!safeGuidesVisible;
  refreshPlacementUI();
});
function stageTitleScale(value){
  stagedTitleScale=titleScale({title_scale:value});
  refreshPlacementUI();
  refreshTitleDeck();
  showTitleAt(playhead);
}
$('title-scale').addEventListener('input',event=>{
  if(exporting)return;
  try{stageTitleScale(Number(event.target.value));}
  catch(e){status(e.message,true);refreshPlacementUI();}
});
const resizeHandle=$('title-resize-handle');
resizeHandle.addEventListener('pointerdown',event=>{
  const visible=visibleTitle(state,playhead);
  if(!titlePlacementArmed||exporting||event.button!==0||
    visible?.title_id!==editingTitleId)return;
  event.preventDefault();event.stopPropagation();
  titleResizeDrag={pointer:event.pointerId,sx:event.clientX,scale:stagedTitleScale};
  resizeHandle.setPointerCapture(event.pointerId);
  resizeHandle.classList.add('dragging');
});
resizeHandle.addEventListener('pointermove',event=>{
  if(!titleResizeDrag||titleResizeDrag.pointer!==event.pointerId||exporting)return;
  const rect=resizeHandle.parentElement.getBoundingClientRect();
  try{stageTitleScale(titleResizeDelta(titleResizeDrag.scale,
    event.clientX-titleResizeDrag.sx,rect.width));}
  catch(e){status(e.message,true);}
});
function finishTitleResize(event,cancel=false){
  if(!titleResizeDrag||titleResizeDrag.pointer!==event.pointerId)return;
  const original=titleResizeDrag.scale;titleResizeDrag=null;
  resizeHandle.classList.remove('dragging');
  if(resizeHandle.hasPointerCapture(event.pointerId))
    resizeHandle.releasePointerCapture(event.pointerId);
  if(cancel)stageTitleScale(original);
  status(cancel?'Title resize canceled; prior draft scale restored.':
    'Title size staged. Save Title Changes to commit.');
}
resizeHandle.addEventListener('pointerup',e=>finishTitleResize(e));
resizeHandle.addEventListener('pointercancel',e=>finishTitleResize(e,true));
resizeHandle.addEventListener('keydown',event=>{
  if(exporting||!titlePlacementArmed||!editingTitleId)return;
  if(event.key==='Escape'){
    event.preventDefault();
    if(titleResizeDrag){stageTitleScale(titleResizeDrag.scale);titleResizeDrag=null;}
    titlePlacementArmed=false;resizeHandle.classList.remove('dragging');
    refreshPlacementUI();showTitleAt(playhead);return;
  }
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
  event.preventDefault();
  const sign=['ArrowRight','ArrowUp'].includes(event.key)?1:-1;
  const step=event.shiftKey?10:5;
  stageTitleScale(Math.min(200,Math.max(50,stagedTitleScale+sign*step)));
});

// R8.0 Creative Title Deck: controls remain pending until explicit Add/Save.
function titleDeckDraft(){
  return {text:$('title-text').value,
    start:Number($('title-start').value),end:Number($('title-end').value),
    position:$('title-position').value,size:$('title-size').value,
    color:$('title-color').value,motion:$('title-motion').value,
    motion_ease:$('title-motion-ease').value,
    motion_distance:Number($('title-motion-distance').value),
    title_scale:stagedTitleScale,
    fade_in:Number($('title-fade-in').value),fade_out:Number($('title-fade-out').value)};
}
function refreshTitleTiming(draft){
  const map=titlePhaseMap(draft);
  $('title-timing-entry').style.width=map.inPercent+'%';
  $('title-timing-hold').style.width=map.holdPercent+'%';
  $('title-timing-exit').style.width=map.outPercent+'%';
  $('title-timing-phase').setAttribute('aria-label',
    'Fade in '+map.fadeIn+' seconds, hold '+map.hold+
    ' seconds, fade out '+map.fadeOut+' seconds');
  $('title-timing-readout').textContent=titleTimingReadout(map);
  $('title-timing-in').max=String(Math.max(0,Math.floor(100-map.outPercent)));
  $('title-timing-out').max=String(Math.max(0,Math.floor(100-map.inPercent)));
  $('title-timing-in').value=String(Math.min(100,Math.round(map.inPercent)));
  $('title-timing-out').value=String(Math.min(100,Math.round(map.outPercent)));
  $('title-timing-in-label').textContent=Math.round(map.inPercent)+'%';
  $('title-timing-out-label').textContent=Math.round(map.outPercent)+'%';
  for(const rhythm of TITLE_RHYTHMS){
    const button=document.querySelector('[data-title-rhythm="'+rhythm.id+'"]');
    button.disabled=exporting;
    button.setAttribute('aria-pressed',String(selectedTitleRhythm===rhythm.id));
  }
  for(const seconds of TITLE_DURATION_CHOICES){
    const button=document.querySelector('[data-title-duration="'+seconds+'"]');
    button.disabled=exporting||!state.clips.length;
  }
  for(const frame of map.frames){
    const button=document.querySelector('[data-title-frame="'+frame.progress+'"]');
    button.disabled=exporting;
    button.setAttribute('aria-pressed',
      String(Number($('title-deck-scrub').value)===frame.progress));
    button.title=frame.seconds.toFixed(2)+'s · '+
      Math.round(frame.opacity*100)+'% visible';
  }
  for(const edge of ['in','out'])$('title-timing-'+edge).disabled=exporting;
}
function refreshTitleDeck(){
  for(const recipe of TITLE_RECIPES){
    const button=document.querySelector('[data-title-recipe="'+recipe.id+'"]');
    if(button){
      button.setAttribute('aria-pressed',String(selectedTitleRecipe===recipe.id));
      button.disabled=exporting;
    }
  }
  $('title-deck-at-playhead').disabled=exporting||!state.clips.length;
  const text=$('title-deck-text'),readout=$('title-deck-readout');
  try{
    const sample=titleDeckSample(titleDeckDraft(),Number($('title-deck-scrub').value));
    text.textContent=sample.text;
    text.dataset.position=sample.position;
    text.dataset.size=sample.size;
    text.dataset.color=sample.color;
    text.style.opacity=String(sample.opacity);
    text.style.fontSize=stagedTitleScale===100?'':
      Math.round(({small:13,medium:18,large:24}[sample.size])*stagedTitleScale/100)+'px';
    const absolute=titlePlacement(titleDeckDraft());
    if(absolute){
      text.style.left=(100*absolute.x/1280)+'%';
      text.style.top=(100*absolute.y/720)+'%';
      text.style.right='auto';text.style.bottom='auto';
      text.style.width='82%';text.style.transform='translate(-50%,-50%)';
    }else{
      for(const key of ['left','top','right','bottom','width','transform'])
        text.style[key]='';
    }
    const offset=titleMotionAt(titleDeckDraft(),sample.seconds>=titleDeckDraft().end
      ?titleDeckDraft().end-.001:sample.seconds);
    const stage=$('title-deck-stage');
    text.style.translate=(offset.x*(stage.clientWidth||1280)/1280)+'px '+
      (offset.y*(stage.clientHeight||720)/720)+'px';
    readout.textContent=titleDeckReadout(sample);
    const form=titleDeckDraft();
    const ease=titleMotionEaseId(form),dist=titleMotionDistance(form);
    $('title-motion-distance-value').textContent=dist+'%';
    const points=Array.from({length:21},(_,i)=>{
      const progress=i/20;
      return (i===0?'M ':'L ')+(18+204*progress).toFixed(2)+' '+
        (92-80*titleMotionProgress(progress,ease)).toFixed(2);
    }).join(' ');
    $('title-motion-curve-line').setAttribute('d',points);
    $('title-motion-curve-readout').textContent=
      ease+' · '+dist+'% travel · draft only';
    refreshTitleTiming(form);
  }catch(e){
    text.textContent='Check title settings';
    text.style.opacity='0.35';
    text.style.fontSize='';
    text.style.translate='0px 0px';
    readout.textContent=e.message+' · no project changes';
    $('title-motion-curve-readout').textContent=e.message+' · draft only';
    $('title-timing-readout').textContent=e.message+' · no project changes';
    for(const id of ['title-timing-entry','title-timing-hold','title-timing-exit'])
      $(id).style.width='0%';
    for(const rhythm of TITLE_RHYTHMS)
      document.querySelector('[data-title-rhythm="'+rhythm.id+'"]')
        .setAttribute('aria-pressed','false');
  }
}
for(const recipe of TITLE_RECIPES){
  const button=document.querySelector('[data-title-recipe="'+recipe.id+'"]');
  button.addEventListener('click',()=>{
    if(exporting)return;
    try{
      const form=titleDeckDraft();
      const style=titleRecipeFields(recipe.id,form.end-form.start);
      for(const [key,value] of Object.entries({
        'title-position':style.position,'title-size':style.size,
        'title-color':style.color,'title-fade-in':style.fade_in,
        'title-fade-out':style.fade_out
      }))$(key).value=String(value);
      selectedTitleRecipe=recipe.id;selectedTitleRhythm=null;
      refreshTitleDeck();
      status(recipe.label+' look auditioned. Add/Save Title to commit.');
    }catch(e){status(e.message,true);refreshTitleDeck();}
  });
}
for(const id of ['title-text','title-start','title-end',
  'title-position','title-size','title-color','title-motion','title-motion-ease',
  'title-motion-distance','title-fade-in','title-fade-out']){
  $(id).addEventListener('input',()=>{selectedTitleRecipe=null;selectedTitleRhythm=null;refreshPlacementUI();refreshTitleDeck();});
  $(id).addEventListener('change',refreshTitleDeck);
}
$('title-deck-scrub').addEventListener('input',refreshTitleDeck);
$('title-deck-at-playhead').addEventListener('click',()=>{
  if(exporting||!state.clips.length)return;
  try{
    const form=titleDeckDraft();
    const seconds=form.end>form.start?form.end-form.start:3;
    const placement=titlePlacementAtPlayhead(playhead,duration(state),seconds);
    $('title-start').value=String(placement.start);
    $('title-end').value=String(placement.end);
    const fades=form.fade_in+form.fade_out,span=placement.end-placement.start;
    if(Number.isFinite(fades)&&fades>span&&
       form.fade_in>=0&&form.fade_out>=0){
      const scale=span/fades;
      const inFade=Math.min(span,Math.floor(form.fade_in*scale*1000)/1000);
      $('title-fade-in').value=String(inFade);
      $('title-fade-out').value=String(Math.max(0,Math.floor((span-inFade)*1000)/1000));
    }
    selectedTitleRecipe=null;selectedTitleRhythm=null;refreshTitleDeck();
    status('Title timing staged at playhead. Add/Save Title to commit.');
  }catch(e){status(e.message,true);refreshTitleDeck();}
});
// R8.1 timing controls only stage the existing title form values.
for(const rhythm of TITLE_RHYTHMS){
  document.querySelector('[data-title-rhythm="'+rhythm.id+'"]')
    .addEventListener('click',()=>{
      if(exporting)return;
      try{
        const draft=titleDeckDraft();
        const timing=titleRhythmFields(rhythm.id,draft.end-draft.start);
        $('title-fade-in').value=String(timing.fade_in);
        $('title-fade-out').value=String(timing.fade_out);
        selectedTitleRhythm=rhythm.id;
        refreshTitleDeck();
        status(rhythm.label+' entrance/exit staged. Save Title to commit.');
      }catch(e){status(e.message,true);refreshTitleDeck();}
    });
}
for(const seconds of TITLE_DURATION_CHOICES){
  document.querySelector('[data-title-duration="'+seconds+'"]')
    .addEventListener('click',()=>{
      if(exporting||!state.clips.length)return;
      try{
        const placement=retimeTitleDraft(titleDeckDraft(),seconds,duration(state));
        for(const [field,value] of Object.entries({
          'title-start':placement.start,'title-end':placement.end,
          'title-fade-in':placement.fade_in,'title-fade-out':placement.fade_out
        }))$(field).value=String(value);
        selectedTitleRhythm=null;selectedTitleRecipe=null;
        refreshTitleDeck();
        status(seconds+'s title length staged (clamped to V1). Save Title to commit.');
      }catch(e){status(e.message,true);refreshTitleDeck();}
    });
}
for(const edge of ['in','out']){
  $('title-timing-'+edge).addEventListener('input',event=>{
    if(exporting)return;
    try{
      const fade=titleFadeFromPercent(titleDeckDraft(),edge,
        Number(event.target.value));
      $('title-fade-in').value=String(fade.fade_in);
      $('title-fade-out').value=String(fade.fade_out);
      selectedTitleRhythm=null;selectedTitleRecipe=null;
      refreshTitleDeck();
    }catch(e){status(e.message,true);refreshTitleDeck();}
  });
}
for(const percent of [0,25,50,75,100]){
  document.querySelector('[data-title-frame="'+percent+'"]')
    .addEventListener('click',()=>{
      if(exporting)return;
      $('title-deck-scrub').value=String(percent);
      refreshTitleDeck();
    });
}
$('add-title').addEventListener('click', () => {
  const title = {
    text: $('title-text').value.trim(),
    start: Number($('title-start').value), end: Number($('title-end').value),
    position: $('title-position').value, size: $('title-size').value, color: $('title-color').value,
    motion:$('title-motion').value,
    motion_ease:$('title-motion-ease').value,
    motion_distance:Number($('title-motion-distance').value),
    ...titlePlacementFields(stagedTitlePlacement),
    ...titleScaleFields(stagedTitleScale),
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
$('ripple-delete').addEventListener('click',()=>{
  if(exporting)return;
  try{
    const plan=synchronizedRipplePlan(state,selectedId);
    const msg='Synchronize Ripple Delete '+fmt(plan.span)+' of V1 footage?\n\n'+
      'Later events shifted: '+plan.affected.v2.length+' V2, '+
      plan.affected.a2.length+' A2, '+plan.affected.titles.length+' titles.\n'+
      'A1 soundtrack remains independently timed. This can be undone.';
    if(!confirm(msg))return;
    edit({type:'clip.ripple.deleted',clip_id:selectedId});
  }catch(e){status(e.message,true);}
});
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
  stopPlayback(); clearMedia(); state=newStudio(); selectedId=null; playhead=0; resetTitleEditor(); $('show-keyframe-lanes').addEventListener('change',event=>{
  showKeyframeLanes=event.target.checked;
  drawKeyframeLanes();
});
$('timeline-zoom').addEventListener('input',event=>{
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
// Layout is local UI state. It never changes the edit ledger, media, or drafts.
function availableWorkspaceStorage() {
  try{return window.localStorage;}catch{return null;}
}
let workspaceSettings=loadWorkspace(availableWorkspaceStorage());
function applyWorkspaceSettings({persist=true,focus=false}={}) {
  const pref=workspaceSettings,root=document.documentElement,host=$('editor-workspace');
  root.style.setProperty('--workspace-left',pref.left+'px');
  root.style.setProperty('--workspace-right',pref.right+'px');
  root.style.setProperty('--workspace-monitor',pref.monitor+'px');
  host.dataset.workspace=pref.preset;
  host.dataset.sourceVisible=String(pref.showSource);
  $('workspace-preset').value=pref.preset;
  $('workspace-source-visible').checked=pref.showSource;
  for(const [id,key] of [['resize-media','left'],['resize-inspector','right'],
    ['resize-monitors','monitor']])
    $(id).setAttribute('aria-valuenow',String(pref[key]));
  const labels={editing:'Editing',audio:'Audio',color:'Color grading',titles:'Titles'};
  $('workspace-feedback').textContent=labels[pref.preset]+' · '+pref.left+'/'+pref.right+' px · monitor '+pref.monitor+' px';
  if(!pref.showSource)sourceVideo.pause();
  if(persist)saveWorkspace(availableWorkspaceStorage(),pref);
  if(focus && pref.preset==='audio')$('audio-workspace-anchor').scrollIntoView({block:'start',behavior:'smooth'});
  if(focus && pref.preset==='titles')$('titles-workspace-anchor').scrollIntoView({block:'start',behavior:'smooth'});
  if(focus && pref.preset==='color'){
    effectsView=setEffectsSection(effectsView,'color',true);
    applyEffectsView();writeEffectsView(effectsStorage(),effectsView);
    const panel=$('clip-color-control');
    if(!panel.hidden)panel.scrollIntoView({block:'start',behavior:'smooth'});
    else $('studio-inspector').scrollTop=0;
  }
  // Ruler tick density and canvas width follow the actual workspace viewport.
  requestAnimationFrame(()=>{drawTimeline();drawTitles();updateStoryPlayhead();});
}
function applyWorkspacePreset(name) {
  workspaceSettings=workspacePreset(name);
  applyWorkspaceSettings({focus:true});
}
function installWorkspaceResize(id,key,sign,axis) {
  const el=$(id);let pointer=null;
  el.addEventListener('pointerdown',e=>{
    if(e.button!==0 || el.offsetParent===null)return;
    pointer={id:e.pointerId,at:axis==='x'?e.clientX:e.clientY,initial:workspaceSettings};
    el.setPointerCapture(e.pointerId);el.classList.add('is-dragging');e.preventDefault();
  });
  el.addEventListener('pointermove',e=>{
    if(!pointer || e.pointerId!==pointer.id)return;
    const delta=sign*((axis==='x'?e.clientX:e.clientY)-pointer.at);
    workspaceSettings=resizeWorkspace(pointer.initial,key,delta);
    applyWorkspaceSettings({persist:false});
  });
  const stop=e=>{
    if(!pointer || e.pointerId!==pointer.id)return;
    pointer=null;el.classList.remove('is-dragging');
    saveWorkspace(availableWorkspaceStorage(),workspaceSettings);
  };
  el.addEventListener('pointerup',stop);
  el.addEventListener('pointercancel',stop);
  el.addEventListener('lostpointercapture',()=>{pointer=null;el.classList.remove('is-dragging');});
  el.addEventListener('keydown',e=>{
    const direction=e.key==='ArrowRight'||e.key==='ArrowDown'?1:
      e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:0;
    if(!direction)return;
    e.preventDefault();
    workspaceSettings=resizeWorkspace(workspaceSettings,key,sign*direction*(e.shiftKey?32:16));
    applyWorkspaceSettings();
  });
}
$('workspace-preset').addEventListener('change',e=>applyWorkspacePreset(e.target.value));
$('workspace-source-visible').addEventListener('change',e=>{
  workspaceSettings={...workspaceSettings,showSource:e.target.checked};
  applyWorkspaceSettings();
});
$('workspace-reset').addEventListener('click',()=>applyWorkspacePreset(workspaceSettings.preset));
installWorkspaceResize('resize-media','left',1,'x');
installWorkspaceResize('resize-inspector','right',-1,'x');
installWorkspaceResize('resize-monitors','monitor',1,'y');
applyWorkspaceSettings({persist:false});
applyEffectsView();
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
  if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable || exporting) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); $('undo').click(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); $('redo').click(); return; }
  if(!e.ctrlKey&&!e.metaKey&&!e.altKey && e.key.toLowerCase()==='i' && sourceAssetId){
    e.preventDefault();$('source-mark-in').click();return;
  }
  if(!e.ctrlKey&&!e.metaKey&&!e.altKey && e.key.toLowerCase()==='o' && sourceAssetId){
    e.preventDefault();$('source-mark-out').click();return;
  }
  if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.key.toLowerCase()==='m'){
    e.preventDefault();
    if(e.shiftKey)$('marker-next').click();
    else $('marker-add').click();
    return;
  }
  if(!e.ctrlKey&&!e.metaKey&&e.altKey&&e.key.toLowerCase()==='m'){
    e.preventDefault();$('marker-prev').click();return;
  }
  if(!e.ctrlKey&&!e.metaKey&&!e.altKey){
    const key=e.key.toLowerCase();
    if(key==='f'){e.preventDefault();matchFrame(selectedClip());return;}
    if(key==='v'){e.preventDefault();setEditingTool('select');return;}
    if(key==='c'){e.preventDefault();setEditingTool('razor');return;}
    if(e.key===','||key==='j'){e.preventDefault();$('jog-back').click();return;}
    if(e.key==='.'){e.preventDefault();$('jog-next').click();return;}
    if(key==='k'){e.preventDefault();$('jog-stop').click();return;}
    if(key==='l'){e.preventDefault();if(!e.repeat)$('jog-forward').click();return;}
  }
  if(e.shiftKey && (e.key==='Delete'||e.key==='Backspace')){
    e.preventDefault();$('ripple-delete').click();return;
  }
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
  let recorder, ctx, stream, videoStream, videoSourceGain, incomingVideoGain, soundtrackGain, overlayGain, overlayIncomingGain, audio2Gain;
  let encoderAudio = document.createElement('audio');
  encoderVideo = document.createElement('video');
  encoderVideo.playsInline = true;
  const encoderIncoming = document.createElement('video');
  encoderIncoming.playsInline = true;
  const encoderOverlay=document.createElement('video');
  encoderOverlay.playsInline=true;
  const encoderOverlayIncoming=document.createElement('video');
  encoderOverlayIncoming.playsInline=true;
  const encoderAudio2=document.createElement('audio');
  const chunks=[];
  try {
    const canvas = document.createElement('canvas'); canvas.width=1280; canvas.height=720;
    const g = canvas.getContext('2d',{alpha:false}); if(!g) throw Error('Canvas unavailable.');
    const drawVideoFrame = (el, alpha, clip) => {
      const vw=el.videoWidth, vh=el.videoHeight;
      if (!vw || !vh || el.readyState < 2) return;
      const scale=Math.min(canvas.width/vw,canvas.height/vh), w=vw*scale,h=vh*scale;
      g.save(); g.globalAlpha = alpha;
      g.filter=colorCSS(clip);
      g.drawImage(el,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
      g.restore();
    };
    const paint = (at = 0) => {
      g.fillStyle='#05070b'; g.fillRect(0,0,canvas.width,canvas.height);
      drawVideoFrame(encoderVideo,1,state.clips.find(c=>c.clip_id===encoderVideo.dataset.clip));
      const fade=crossfadeAt(state,at);
      if (fade && encoderIncoming.dataset.clip === fade.incoming.clip_id)
        drawVideoFrame(encoderIncoming,fade.progress,fade.incoming);
      const overlayFade=overlayCrossfadeAt(state,at);
      const paintOverlay=(el,clip,weight)=>{
        if(!clip || el.dataset.clip!==clip.clip_id || el.readyState<2)return;
        const opacity=overlayOpacityAt(clip,at)*weight;
        if(opacity<=0)return;
        g.save();g.globalAlpha=opacity;
        const motion=overlayMotionAt(clip,at);
        if((clip.overlay_layout??'pip')==='full'){
          g.translate(motion.x*canvas.width,motion.y*canvas.height);
          drawVideoFrame(el,1,clip);
        } else {
          const vw=el.videoWidth,vh=el.videoHeight;
          if(vw&&vh){const ratio=Math.min(420/vw,220/vh);
            const w=vw*ratio,h=vh*ratio;
            g.translate(motion.x*(w+12),motion.y*(h+12));
            g.fillStyle='#091321';g.fillRect(1210-w-12,35,w+12,h+12);
            g.filter=colorCSS(clip);
            g.drawImage(el,1210-w-6,41,w,h);}
        }
        g.restore();
      };
      paintOverlay(encoderOverlay,activeOverlayClip(state,at),overlayFade?1-overlayFade.progress:1);
      if(overlayFade)paintOverlay(encoderOverlayIncoming,overlayFade.incoming,overlayFade.progress);
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
      const overlaySecondSource=ctx.createMediaElementSource(encoderOverlayIncoming);
      overlayIncomingGain=ctx.createGain();overlayIncomingGain.gain.value=0;
      overlaySecondSource.connect(overlayIncomingGain);overlayIncomingGain.connect(dest);
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
    encoderOverlayIncoming.muted=false;
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
    async function syncExportLayer(el,clip,at,level,weight=1) {
      if(level)level.gain.value=audioLevelAt(clip,at)*audioMixLevelAt(state,clip?.track_id,at)*weight;
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
        const v2Fade=overlayCrossfadeAt(state,timelinePosition);
        await syncExportLayer(encoderOverlay,activeOverlayClip(state,timelinePosition),
          timelinePosition,overlayGain,v2Fade?1-v2Fade.progress:1);
        await syncExportLayer(encoderOverlayIncoming,v2Fade?.incoming||null,
          timelinePosition,overlayIncomingGain,v2Fade?v2Fade.progress:0);
        await syncExportLayer(encoderAudio2,activeAudio2Clip(state,timelinePosition),timelinePosition,audio2Gain);
        const fade = crossfadeAt(state,timelinePosition);
        if (videoSourceGain) videoSourceGain.gain.value = audioLevelAt(clip,timelinePosition) * audioMixLevelAt(state,'video-1',timelinePosition) *
          (fade ? 1-fade.progress : 1);
        paint(timelinePosition);
        $('render-status').textContent = `Recording clip ${index+1}/${state.clips.length} · ${fmt(encoderVideo.currentTime - clip.source.start)}`;
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
      paint(clip.timeline.end - .001);
      encoderVideo.pause(); encoderIncoming.pause(); encoderAudio.pause(); encoderOverlay.pause();encoderOverlayIncoming.pause();encoderAudio2.pause();
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
      crossfades:state.clips.filter(c=>c.transition_out_seconds>0).length,
      overlay_crossfades:state.video2Clips.filter(c=>c.transition_out_seconds>0).length,mime:recordedMime,
      container_signature_verified:true,format:'browser-beta'}});
    status(format.toUpperCase()+' downloaded ('+(blob.size/1048576).toFixed(1)+' MiB). Watch and listen before sharing.');
  } catch(err) { status('Export: '+err.message,true); }
  finally {
    if(recorder?.state==='recording') { recorder.onstop=null; recorder.stop(); }
    encoderVideo.pause(); encoderVideo.removeAttribute('src'); encoderVideo.load();
    encoderIncoming.pause(); encoderIncoming.removeAttribute('src'); encoderIncoming.load();
    encoderAudio.pause(); encoderAudio.removeAttribute('src'); encoderAudio.load();
    encoderOverlay.pause();encoderOverlay.removeAttribute('src');encoderOverlay.load();
    encoderOverlayIncoming.pause();encoderOverlayIncoming.removeAttribute('src');encoderOverlayIncoming.load();
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
