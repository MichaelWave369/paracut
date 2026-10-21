import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  newStudio, change, undo, redo, isSourceAudioMuted,
  exportDraft, importDraft, validate
} from '../apps/desktop/public/studio-core.js';

const asset = (asset_id, type, seconds = 10) => ({
  asset_id, name: asset_id + (type === 'video/mp4' ? '.mp4' : '.mp3'),
  type, duration: seconds, size: 100, lastModified: 123
});

let state = newStudio('Grok clip with music');
for (const a of [asset('grok','video/mp4',30), asset('cutaway','video/mp4',10), asset('music','audio/mpeg',40)]) {
  state = change(state, { type:'asset.added', asset:a });
}
for(const asset_id of ['grok','cutaway','music']) state = change(state,{type:'clip.appended',asset_id});

const grokId = state.clips[0].clip_id;
const otherId = state.clips[1].clip_id;
const audioId = state.audioClips[0].clip_id;
assert.equal(isSourceAudioMuted(state.clips[0]), false);
assert.equal(isSourceAudioMuted(state.clips[1]), false);
assert.equal(isSourceAudioMuted(state.audioClips[0]), false);

// Only the chosen video's original sound is muted. Separate A1 is untouched.
state = change(state, { type:'clip.source-audio.muted', clip_id:grokId, muted:true });
assert.equal(isSourceAudioMuted(state.clips[0]), true);
assert.equal(isSourceAudioMuted(state.clips[1]), false);
assert.equal(isSourceAudioMuted(state.audioClips[0]), false);
assert.equal(state.receipts.at(-1).action, 'clip.source-audio.muted');
assert.equal(state.receipts.at(-1).details.muted, true);
assert.throws(() => change(state,{type:'clip.source-audio.muted',clip_id:audioId,muted:true}),/only for video/);
assert.throws(() => change(state,{type:'clip.source-audio.muted',clip_id:grokId,muted:'yes'}),/true or false/);

// Split keeps the source audio preference on BOTH halves.
state = change(state, {type:'clip.split',clip_id:grokId,time:15});
assert.equal(isSourceAudioMuted(state.clips[0]), true);
assert.equal(isSourceAudioMuted(state.clips[1]), true);
assert.equal(isSourceAudioMuted(state.clips[2]), false);
state = undo(state);
assert.equal(isSourceAudioMuted(state.clips[0]), true);
state = undo(state);
assert.equal(isSourceAudioMuted(state.clips[0]), false);
state = redo(state);
assert.equal(isSourceAudioMuted(state.clips[0]), true);
state = change(state, {type:'clip.source-audio.muted',clip_id:grokId,muted:false});
assert.equal(isSourceAudioMuted(state.clips[0]),false);

// Save/open preserves the setting and old v2 drafts without the field remain audible.
state = change(state, {type:'clip.source-audio.muted',clip_id:otherId,muted:true});
const draft = JSON.parse(exportDraft(state));
const reopened = importDraft(JSON.stringify(draft));
assert.equal(isSourceAudioMuted(reopened.clips[1]),true);
delete draft.clips[1].source_audio_muted;
assert.equal(isSourceAudioMuted(importDraft(JSON.stringify(draft)).clips[1]), false);
draft.clips[1].source_audio_muted = 'true';
assert.throws(() => importDraft(JSON.stringify(draft)),/Invalid source audio mute flag/);
assert.equal(validate(state),true);

// The renderer's independent A1 input is kept, while V1 uses a zero-gain branch.
const ui = readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const html = readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
assert.match(html,/id="mute-source-audio"/);
assert.match(ui,/video\.muted = isSourceAudioMuted\(clip\)/);
assert.match(ui,/source\.connect\(videoSourceGain\)/);
assert.match(ui,/videoSourceGain\.connect\(dest\)/);
assert.match(ui,/videoSourceGain\.gain\.value = audioLevelAt\(clip,clip.timeline.start\)/);
assert.match(ui,/music\.connect\(soundtrackGain\)/);
assert.match(ui,/soundtrackGain\.connect\(dest\)/);
console.log('ParaCut Studio mute smoke: PASS (per-video mute, A1 isolation, preview/export wiring, split, undo/redo, old drafts).');
