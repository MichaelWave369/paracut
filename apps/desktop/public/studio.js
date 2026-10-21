import { newStudio, change, undo, redo, duration, activeClip, activeAudioClip, exportDraft, importDraft } from './studio-core.js';
import { extractWaveform, paintWaveform } from './studio-waveform.js';

const $ = id => document.getElementById(id);
let state = newStudio();
let selectedId = null, playhead = 0, playing = false, exporting = false, cancelExport = false, seekSerial = 0;
const media = new Map(); // asset_id -> {file, url}; NEVER stored in JSON or uploaded
const video = $('preview-video');
let encoderVideo = document.createElement('video'); // fresh element per WebM export
const soundtrack = document.createElement('audio');
soundtrack.preload = 'auto'; soundtrack.volume = .85;
const waveforms = new Map();
let soundSerial = 0;
let draggedClipId = null;
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
  video.pause(); video.removeAttribute('src'); video.load(); delete video.dataset.asset;
}
function updateTimeUI() {
  const d = duration(state);
  $('current-time').textContent = fmt(playhead);
  $('total-time').textContent = fmt(d);
  $('timeline-total').textContent = fmt(d);
  $('seek').max = String(Math.max(d, 0.001));
  $('seek').value = String(Math.min(playhead, d));
  $('play').textContent = playing ? '❚❚' : '▶';
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
    div.append(name, add); list.append(div);
  }
}
function drawTimeline() {
  const lanes = [
    { el: $('timeline-track'), clips: state.clips, empty: 'Your video timeline is empty. Add video files.' },
    { el: $('audio-track'), clips: state.audioClips, empty: 'Add audio files for soundtrack or voiceover.' },
  ];
  const total = Math.max(duration(state), state.audioClips.at(-1)?.timeline.end || 0, .01);
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
      item.type = 'button'; item.className = 'timeline-clip' + (isAudio ? ' audio' : '') + (clip.clip_id === selectedId ? ' selected' : '');
      item.draggable = !exporting;
      item.style.flex = String(Math.max((clip.timeline.end - clip.timeline.start) / total, .04)) + ' 0 68px';
      item.setAttribute('aria-pressed', String(clip.clip_id === selectedId));
      item.title = (asset?.name || 'Missing file') + ' · ' + fmt(clip.timeline.start) + ' to ' + fmt(clip.timeline.end);
      const label = document.createElement('span'); label.textContent = asset?.name || 'Missing file';
      const time = document.createElement('small'); time.textContent = fmt(clip.timeline.end - clip.timeline.start);
      item.append(label, time);
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
}
function drawInspector() {
  const clip = [...state.clips, ...state.audioClips].find(c => c.clip_id === selectedId);
  $('inspector-fields').hidden = !clip;
  $('inspector-empty').hidden = Boolean(clip);
  if (!clip) return;
  const asset = state.assets.find(a => a.asset_id === clip.asset_id);
  $('selected-name').textContent = asset?.name || 'Unknown asset';
  $('in-time').value = String(clip.source.start);
  $('out-time').value = String(clip.source.end);
  $('in-time').max = String(asset.duration);
  $('out-time').max = String(asset.duration);
  $('selected-meta').innerHTML = '<dt>Track</dt><dd>' + (clip.track_id === 'audio-1' ? 'Audio 1' : 'Video 1') + '</dd><dt>Timeline start</dt><dd>' + fmt(clip.timeline.start) +
    '</dd><dt>Clip duration</dt><dd>' + fmt(clip.timeline.end - clip.timeline.start) +
    '</dd><dt>Source length</dt><dd>' + fmt(asset.duration) + '</dd>';
  const lane = clip.track_id === 'audio-1' ? state.audioClips : state.clips;
  const index = lane.findIndex(c => c.clip_id === selectedId);
  $('move-left').disabled = index === 0 || exporting;
  $('move-right').disabled = index === lane.length - 1 || exporting;
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
function render() {
  $('project-name').value = state.name;
  drawMedia(); drawTimeline(); drawInspector(); drawReceipts(); updateTimeUI();
  $('undo').disabled = !state.undo.length || exporting;
  $('redo').disabled = !state.redo.length || exporting;
  $('split').disabled = !selectedId || exporting;
  $('remove').disabled = !selectedId || exporting;
  $('export-webm').disabled = (!state.clips.length || [...state.clips, ...state.audioClips].some(c => !media.has(c.asset_id))) && !exporting;
  $('preview-label').textContent = selectedId ? 'Selected clip · ' + ([...state.clips, ...state.audioClips].find(c=>c.clip_id===selectedId)?.clip_id?.slice(0,8) || '') : 'Program';
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
    playing = false; video.pause(); soundtrack.pause(); video.style.display = 'none';
    $('empty-preview').hidden = false; updateTimeUI(); return;
  }
  const ref = media.get(clip.asset_id);
  if (!ref) {
    playing = false; video.pause(); soundtrack.pause(); video.style.display = 'none';
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
    const time = Math.min(clip.source.end - .005, clip.source.start + Math.max(0, playhead - clip.timeline.start));
    if (Math.abs(video.currentTime - time) > .035) video.currentTime = Math.max(0,time);
    video.style.display = 'block'; $('empty-preview').hidden = true;
    if (autoplay && playhead < d - .005) {
      await video.play(); playing = true;
    } else { video.pause(); playing = false; }
    void syncSoundtrack(playhead, playing);
    updateTimeUI();
  } catch (e) { playing = false; status('Preview failed: ' + e.message, true); updateTimeUI(); }
}
function stopPlayback() { playing = false; video.pause(); soundtrack.pause(); updateTimeUI(); }
function edit(command) {
  if (exporting) return status('Finish or cancel export before editing.', true);
  try {
    stopPlayback();
    state = change(state, command);
    if (selectedId && ![...state.clips, ...state.audioClips].some(c=>c.clip_id===selectedId)) selectedId = null;
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
  void syncSoundtrack(playhead, true);
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
$('split').addEventListener('click', () => edit({ type:'clip.split', clip_id:selectedId, time:playhead }));
$('remove').addEventListener('click', () => edit({ type:'clip.deleted', clip_id:selectedId }));
$('move-left').addEventListener('click', () => edit({ type:'clip.moved', clip_id:selectedId, step:-1 }));
$('move-right').addEventListener('click', () => edit({ type:'clip.moved', clip_id:selectedId, step:1 }));
for(const [name, method] of [['undo',undo],['redo',redo]]) $(name).addEventListener('click', () => {
  if (exporting) return;
  stopPlayback(); state = method(state);
  if (selectedId && ![...state.clips, ...state.audioClips].some(c=>c.clip_id===selectedId)) selectedId=null;
  playhead=Math.min(playhead,duration(state)); render(); void seekTo(playhead); status(name+' ✓');
});
$('project-name').addEventListener('change', e => edit({ type:'project.renamed', name:e.target.value }));
$('new-project').addEventListener('click', () => {
  if (exporting || !confirm('Start a new project? Export your draft first if you want to keep these edits.')) return;
  stopPlayback(); clearMedia(); state=newStudio(); selectedId=null; playhead=0; render(); void seekTo(0); status('New project ready.');
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
    stopPlayback(); clearMedia(); state=candidate; selectedId=null; playhead=0;
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
function supportedWebm() {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return null;
  for (const mime of ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm']) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return null;
}
async function renderWebm() {
  if (exporting) { cancelExport = true; status('Cancel requested. Stopping export…'); return; }
  if (!state.clips.length) return status('Timeline is empty.',true);
  if (state.clips.some(c=>!media.has(c.asset_id))) return status('Relink all video sources before exporting.',true);
  if (duration(state) > 300) return status('R1 browser export is limited to 5 minutes. Save a draft and use a shorter cut.',true);
  const mime = supportedWebm();
  if (!mime) return status('This browser cannot record WebM. Try desktop Chrome/Edge.',true);
  stopPlayback(); exporting=true; cancelExport=false; $('export-webm').textContent='Cancel Export'; render();
  let recorder, ctx, stream, videoStream;
  const chunks=[];
  try {
    const canvas = document.createElement('canvas'); canvas.width=1280; canvas.height=720;
    const g = canvas.getContext('2d',{alpha:false}); if(!g) throw Error('Canvas unavailable.');
    const paint = () => {
      g.fillStyle='#05070b'; g.fillRect(0,0,canvas.width,canvas.height);
      if (encoderVideo.readyState < 2) return;
      const vw=encoderVideo.videoWidth, vh=encoderVideo.videoHeight; if(!vw||!vh) return;
      const scale=Math.min(canvas.width/vw,canvas.height/vh), w=vw*scale,h=vh*scale;
      g.drawImage(encoderVideo,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
    };
    paint(); videoStream=canvas.captureStream(30);
    const tracks=[...videoStream.getVideoTracks()];
    // Audio is captured from the decoded source through Web Audio, not the user's microphone.
    const AudioCtx=window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      ctx=new AudioCtx();
      const source=ctx.createMediaElementSource(encoderVideo);
      const dest=ctx.createMediaStreamDestination();
      source.connect(dest);
      tracks.push(...dest.stream.getAudioTracks());
      await ctx.resume();
    }
    stream=new MediaStream(tracks);
    recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3_500_000});
    recorder.ondataavailable=e=>{if(e.data?.size) chunks.push(e.data);};
    const stopped=new Promise((resolve,reject)=>{
      recorder.onstop=resolve;
      recorder.onerror=e=>reject(e.error || Error('MediaRecorder failed.'));
    });
    recorder.start(1000);
    encoderVideo.muted=false;
    for (let index=0; index<state.clips.length; index++) {
      if(cancelExport) throw Error('Export cancelled.');
      const clip=state.clips[index], ref=media.get(clip.asset_id);
      encoderVideo.pause(); encoderVideo.src=ref.url; encoderVideo.load();
      await new Promise((resolve,reject)=>{
        encoderVideo.addEventListener('loadedmetadata',resolve,{once:true});
        encoderVideo.addEventListener('error',()=>reject(Error('Cannot decode source.')),{once:true});
      });
      encoderVideo.currentTime=clip.source.start;
      await new Promise(resolve=> {
        if (encoderVideo.seeked || Math.abs(encoderVideo.currentTime - clip.source.start)<.04) return resolve();
        encoderVideo.addEventListener('seeked',resolve,{once:true});
      });
      await encoderVideo.play();
      while (encoderVideo.currentTime < clip.source.end - .015 && !encoderVideo.ended) {
        if(cancelExport) throw Error('Export cancelled.');
        if(document.hidden) throw Error('Keep this tab visible during R1 recording.');
        paint();
        $('render-status').textContent = `Recording clip ${index+1}/${state.clips.length} · ${fmt(encoderVideo.currentTime - clip.source.start)}`;
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
      paint(); encoderVideo.pause();
    }
    recorder.stop(); await stopped;
    if (cancelExport) throw Error('Export cancelled.');
    const blob = new Blob(chunks,{type:mime});
    if(blob.size < 1000) throw Error('Encoder produced no usable video.');
    download((state.name.replace(/[^a-z0-9_-]+/ig,'-').slice(0,60) || 'paracut')+'.webm',blob);
    state.receipts.push({receipt_id:uuid(),action:'render.webm.exported',at:new Date().toISOString(),source:'human',details:{bytes:blob.size,duration_seconds:duration(state),mime,format:'browser-beta'}});
    status('WebM downloaded ('+(blob.size/1048576).toFixed(1)+' MiB). Check the file before sharing.');
  } catch(err) { status('Export: '+err.message,true); }
  finally {
    if(recorder?.state==='recording') { recorder.onstop=null; recorder.stop(); }
    encoderVideo.pause(); encoderVideo.removeAttribute('src'); encoderVideo.load();
    stream?.getTracks().forEach(t=>t.stop()); videoStream?.getTracks().forEach(t=>t.stop());
    await ctx?.close();
    exporting=false;cancelExport=false;$('export-webm').textContent='Export WebM β';$('render-status').textContent='';render();
  }
}
$('export-webm').addEventListener('click',()=>{void renderWebm();});
render(); void seekTo(0);
