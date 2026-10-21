// ParaCut Studio R1: dependency-free browser timeline model.
// This is a browser draft format, NOT the canonical ParaCut project-core format.
export const DRAFT_SCHEMA = 'paracut.studio.draft.v1';
const id = () => (globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const copy = value => JSON.parse(JSON.stringify(value));
const round = n => Math.round(n * 1000) / 1000;
const finite = value => typeof value === 'number' && Number.isFinite(value);

export function newStudio(name = 'Untitled Cut') {
  return { schema: DRAFT_SCHEMA, name, assets: [], clips: [], receipts: [], undo: [], redo: [] };
}
export function duration(state) {
  return state.clips.length ? state.clips[state.clips.length - 1].timeline.end : 0;
}
export function activeClip(state, time) {
  return state.clips.find(clip => time >= clip.timeline.start && time < clip.timeline.end) || null;
}
export function reflow(clips) {
  let t = 0;
  return clips.map(clip => {
    const seconds = round(clip.source.end - clip.source.start);
    const next = { ...clip, track_id: 'video-1', timeline: { start: round(t), end: round(t + seconds) } };
    t += seconds;
    return next;
  });
}
function checkpoint(state) { return { assets: copy(state.assets), clips: copy(state.clips), name: state.name }; }
function receipt(action, details = {}) {
  return { receipt_id: id(), action, at: new Date().toISOString(), source: 'human', details };
}
export function change(state, command) {
  validate(state);
  const before = checkpoint(state);
  let assets = copy(state.assets), clips = copy(state.clips), name = state.name;
  const { type } = command;
  if (type === 'asset.added') {
    const a = command.asset;
    if (!a || !a.name || !finite(a.duration) || a.duration < 0.1 || a.duration > 86400) throw Error('Invalid media duration.');
    if (!finite(a.size) || a.size < 0) throw Error('Invalid media size.');
    if (!String(a.type).startsWith('video/')) throw Error('Studio R1 accepts video files only.');
    if (assets.some(item => item.asset_id === a.asset_id)) throw Error('Duplicate media ID.');
    if (assets.length >= 200) throw Error('This R1 project has reached its 200-file safety limit.');
    assets.push({ asset_id: a.asset_id || id(), name: String(a.name).slice(0, 240), type: a.type, size: a.size, lastModified: a.lastModified, duration: round(a.duration) });
  } else if (type === 'clip.appended') {
    const asset = assets.find(item => item.asset_id === command.asset_id);
    if (!asset) throw Error('Media not found.');
    if (clips.length >= 400) throw Error('This R1 timeline has reached its 400-clip safety limit.');
    clips.push({ clip_id: id(), asset_id: asset.asset_id, track_id: 'video-1',
      timeline: { start: 0, end: 0 }, source: { start: 0, end: asset.duration }, enabled: true, effects: [] });
  } else if (type === 'clip.trimmed') {
    const c = clips.find(item => item.clip_id === command.clip_id);
    if (!c) throw Error('Select a clip first.');
    const asset = assets.find(a => a.asset_id === c.asset_id);
    const start = Number(command.start), end = Number(command.end);
    if (!finite(start) || !finite(end) || start < 0 || end > asset.duration + 0.001 || end - start < 0.08) {
      throw Error('In/out must be inside the source and at least 0.08 seconds apart.');
    }
    c.source = { start: round(start), end: round(end) };
  } else if (type === 'clip.split') {
    const index = clips.findIndex(item => item.clip_id === command.clip_id);
    if (index < 0) throw Error('Select a clip first.');
    const c = clips[index], t = Number(command.time);
    const offset = t - c.timeline.start;
    if (!finite(t) || offset < 0.08 || c.timeline.end - t < 0.08) throw Error('Move the playhead inside the clip to split.');
    const at = round(c.source.start + offset);
    clips.splice(index, 1,
      { ...c, clip_id: id(), source: { start: c.source.start, end: at } },
      { ...c, clip_id: id(), source: { start: at, end: c.source.end } });
  } else if (type === 'clip.moved') {
    const index = clips.findIndex(item => item.clip_id === command.clip_id);
    if (index < 0) throw Error('Select a clip first.');
    const nextIndex = index + command.step;
    if (![-1, 1].includes(command.step) || nextIndex < 0 || nextIndex >= clips.length) throw Error('Cannot move clip farther.');
    [clips[index], clips[nextIndex]] = [clips[nextIndex], clips[index]];
  } else if (type === 'clip.deleted') {
    if (!clips.some(item => item.clip_id === command.clip_id)) throw Error('Clip not found.');
    clips = clips.filter(item => item.clip_id !== command.clip_id);
  } else if (type === 'project.renamed') {
    name = String(command.name || '').trim().slice(0, 100);
    if (!name) throw Error('Project name cannot be empty.');
  } else throw Error('Unknown studio edit.');
  clips = reflow(clips);
  const next = { ...state, assets, clips, name, undo: [...state.undo.slice(-39), before], redo: [],
    receipts: [...state.receipts, receipt(type, { clip_id: command.clip_id || null, asset_id: command.asset_id || command.asset?.asset_id || null })] };
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
  if (!state || !Array.isArray(state.assets) || !Array.isArray(state.clips) || state.assets.length > 200 || state.clips.length > 400) throw Error('Invalid ParaCut draft.');
  const ids = new Set(state.assets.map(a => a.asset_id));
  if (ids.size !== state.assets.length) throw Error('Duplicate media IDs.');
  const clipIds = new Set(), normalized = reflow(state.clips);
  for (let i = 0; i < state.clips.length; i++) {
    const c = state.clips[i], a = state.assets.find(item => item.asset_id === c.asset_id);
    if (!a || !finite(a.duration) || !finite(a.size) || !String(a.type).startsWith('video/')) throw Error('Invalid video reference.');
    if (clipIds.has(c.clip_id)) throw Error('Duplicate clip ID.');
    clipIds.add(c.clip_id);
    if (!finite(c.source?.start) || !finite(c.source?.end) || c.source.start < 0 || c.source.end > a.duration + 0.002 || c.source.end - c.source.start < 0.079) throw Error('Invalid clip source range.');
    if (Math.abs(c.timeline?.start - normalized[i].timeline.start) > 0.003 || Math.abs(c.timeline?.end - normalized[i].timeline.end) > 0.003) throw Error('Timeline is not sequential.');
  }
  return true;
}
export function exportDraft(state) {
  validate(state);
  const { name, assets, clips, receipts } = state;
  return JSON.stringify({ schema: DRAFT_SCHEMA, name, assets, clips, receipts: receipts.slice(-500),
    note: 'Video files are NOT embedded. Relink the originals when reopening.' }, null, 2);
}
export function importDraft(json) {
  if (String(json).length > 4_000_000) throw Error('Draft file is too large.');
  const input = JSON.parse(json);
  if (input.schema !== DRAFT_SCHEMA) throw Error('Not a ParaCut Studio R1 draft.');
  const state = { schema: DRAFT_SCHEMA, name: String(input.name || 'Recovered Cut').slice(0, 100),
    assets: input.assets, clips: input.clips, receipts: Array.isArray(input.receipts) ? input.receipts.slice(-500) : [],
    undo: [], redo: [] };
  validate(state);
  state.receipts.push(receipt('project.draft.opened', { imported_receipts_unverified: true }));
  return state;
}
