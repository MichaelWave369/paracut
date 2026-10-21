// ParaCut Studio R3: local-first editor with video/audio automation and timed titles.
// This is a browser draft format, NOT the canonical ParaCut project-core format.
export const DRAFT_SCHEMA = 'paracut.studio.draft.v3';
export const PREVIOUS_DRAFT_SCHEMA = 'paracut.studio.draft.v2';
export const LEGACY_DRAFT_SCHEMA = 'paracut.studio.draft.v1';
const id = () => (globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const copy = value => JSON.parse(JSON.stringify(value));
const round = n => Math.round(n * 1000) / 1000;
const finite = value => typeof value === 'number' && Number.isFinite(value);

export function newStudio(name = 'Untitled Cut') {
  return { schema: DRAFT_SCHEMA, name, assets: [], clips: [], audioClips: [], titles: [], receipts: [], undo: [], redo: [] };
}
export function duration(state) {
  return state.clips.length ? state.clips[state.clips.length - 1].timeline.end : 0;
}
export function activeClip(state, time) {
  return state.clips.find(clip => time >= clip.timeline.start && time < clip.timeline.end) || null;
}
// Older v1/v2 drafts have no source_audio_muted flag; their default is audible.
export function isSourceAudioMuted(clip) {
  return clip?.track_id === 'video-1' && clip.source_audio_muted === true;
}
export function activeAudioClip(state, time) {
  return state.audioClips.find(clip => time >= clip.timeline.start && time < clip.timeline.end) || null;
}
export function reflow(clips, trackId = 'video-1') {
  let t = 0;
  return clips.map(clip => {
    const seconds = round(clip.source.end - clip.source.start);
    const next = { ...clip, track_id: trackId, timeline: { start: round(t), end: round(t + seconds) } };
    t += seconds;
    return next;
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
function checkpoint(state) { return { assets: copy(state.assets), clips: copy(state.clips), audioClips: copy(state.audioClips), titles: copy(state.titles), name: state.name }; }
function receipt(action, details = {}) {
  return { receipt_id: id(), action, at: new Date().toISOString(), source: 'human', details };
}
export function change(state, command) {
  validate(state);
  const before = checkpoint(state);
  let assets = copy(state.assets), clips = copy(state.clips), audioClips = copy(state.audioClips), titles = copy(state.titles), name = state.name;
  const { type } = command;
  const laneFor = clipId => clips.some(c => c.clip_id === clipId) ? clips
    : audioClips.some(c => c.clip_id === clipId) ? audioClips : null;
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
  } else if (type === 'clip.trimmed') {
    const c = laneFor(command.clip_id)?.find(item => item.clip_id === command.clip_id);
    if (!c) throw Error('Select a clip first.');
    const asset = assets.find(a => a.asset_id === c.asset_id);
    const start = Number(command.start), end = Number(command.end);
    if (!finite(start) || !finite(end) || start < 0 || end > asset.duration + 0.001 || end - start < 0.08) {
      throw Error('In/out must be inside the source and at least 0.08 seconds apart.');
    }
    c.source = { start: round(start), end: round(end) };
    Object.assign(c, fitFades(c));
  } else if (type === 'clip.source-audio.muted') {
    const clip = clips.find(item => item.clip_id === command.clip_id);
    if (!clip) throw Error('Source audio mute is available only for video clips.');
    if (typeof command.muted !== 'boolean') throw Error('Source audio mute must be true or false.');
    clip.source_audio_muted = command.muted;
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
    const offset = t - c.timeline.start;
    if (!finite(t) || offset < 0.08 || c.timeline.end - t < 0.08) throw Error('Move the playhead inside the clip to split.');
    const at = round(c.source.start + offset);
    lane.splice(index, 1,
      fitFades({ ...c, clip_id: id(), source: { start: c.source.start, end: at } }),
      fitFades({ ...c, clip_id: id(), source: { start: at, end: c.source.end } }));
  } else if (type === 'clip.moved' || type === 'clip.reordered') {
    const lane = laneFor(command.clip_id);
    if (!lane) throw Error('Select a clip first.');
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
    clips = clips.filter(item => item.clip_id !== command.clip_id);
    audioClips = audioClips.filter(item => item.clip_id !== command.clip_id);
  } else if (type === 'project.renamed') {
    name = String(command.name || '').trim().slice(0, 100);
    if (!name) throw Error('Project name cannot be empty.');
  } else throw Error('Unknown studio edit.');
  clips = reflow(clips, 'video-1');
  audioClips = reflow(audioClips, 'audio-1');
  const next = { ...state, assets, clips, audioClips, titles, name, undo: [...state.undo.slice(-39), before], redo: [],
    receipts: [...state.receipts, receipt(type, { clip_id: command.clip_id || null,
      asset_id: command.asset_id || command.asset?.asset_id || null,
      ...(type === 'clip.source-audio.muted' ? { muted: command.muted } : {}),
      ...(type === 'clip.audio.updated' ? { volume: command.volume, fade_in: command.fade_in, fade_out: command.fade_out } : {}),
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
  if (!state || !Array.isArray(state.assets) || !Array.isArray(state.clips) || !Array.isArray(state.audioClips) || !Array.isArray(state.titles)
      || state.titles.length > 40 || state.assets.length > 200 || state.clips.length > 400 || state.audioClips.length > 400) {
    throw Error('Invalid ParaCut draft.');
  }
  const ids = new Set();
  for (const a of state.assets) {
    if (!a || typeof a.asset_id !== 'string' || !a.asset_id || ids.has(a.asset_id)
        || typeof a.name !== 'string' || !finite(a.duration) || a.duration < 0.1 || a.duration > 86400
        || !finite(a.size) || a.size < 0 || !/^(audio|video)\//.test(a.type)) throw Error('Invalid media reference.');
    ids.add(a.asset_id);
  }
  const clipIds = new Set();
  for (const [lane, trackId, kind] of [[state.clips, 'video-1','video/'],[state.audioClips, 'audio-1','audio/']]) {
    const normalized = reflow(lane, trackId);
    for (let i = 0; i < lane.length; i++) {
      const c = lane[i], a = state.assets.find(item => item.asset_id === c?.asset_id);
      if (!a || !a.type.startsWith(kind) || c.track_id !== trackId) throw Error('Invalid ' + kind.slice(0, -1) + ' reference.');
      if (!c.clip_id || clipIds.has(c.clip_id)) throw Error('Duplicate clip ID.');
      if (c.source_audio_muted !== undefined &&
          (trackId !== 'video-1' || typeof c.source_audio_muted !== 'boolean')) {
        throw Error('Invalid source audio mute flag.');
      }
      const seconds = c.source?.end - c.source?.start;
      assertAudioValues(c.volume === undefined ? 1 : c.volume,
        c.fade_in === undefined ? 0 : c.fade_in,
        c.fade_out === undefined ? 0 : c.fade_out, seconds);
      clipIds.add(c.clip_id);
      if (!finite(c.source?.start) || !finite(c.source?.end) || c.source.start < 0
          || c.source.end > a.duration + 0.002 || c.source.end - c.source.start < 0.079) throw Error('Invalid clip source range.');
      if (!finite(c.timeline?.start) || !finite(c.timeline?.end)
          || Math.abs(c.timeline.start - normalized[i].timeline.start) > 0.003
          || Math.abs(c.timeline.end - normalized[i].timeline.end) > 0.003) throw Error('Timeline is not sequential.');
    }
  }
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
  const { name, assets, clips, audioClips, titles, receipts } = state;
  return JSON.stringify({ schema: DRAFT_SCHEMA, name, assets, clips, audioClips, titles, receipts: receipts.slice(-500),
    note: 'Media files are NOT embedded. Relink the originals when reopening.' }, null, 2);
}
export function importDraft(json) {
  if (String(json).length > 4_000_000) throw Error('Draft file is too large.');
  const input = JSON.parse(json);
  if (![DRAFT_SCHEMA, PREVIOUS_DRAFT_SCHEMA, LEGACY_DRAFT_SCHEMA].includes(input.schema)) throw Error('Not a ParaCut Studio draft.');
  const state = { schema: DRAFT_SCHEMA, name: String(input.name || 'Recovered Cut').slice(0, 100),
    assets: input.assets, clips: input.clips, audioClips: input.schema === LEGACY_DRAFT_SCHEMA ? [] : input.audioClips,
    titles: input.schema === DRAFT_SCHEMA ? input.titles : [], receipts: Array.isArray(input.receipts) ? input.receipts.filter(r => r && typeof r === 'object' && typeof r.action === 'string').slice(-500) : [],
    undo: [], redo: [] };
  validate(state);
  state.receipts.push(receipt('project.draft.opened', { imported_receipts_unverified: true }));
  return state;
}
