import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,importDraft,exportDraft} from '../apps/desktop/public/studio-core.js';
import {planLocalMp4} from './studio-local-export-core.mjs';
import {LOCAL_EXPORT_QUALITY,normalizeExportOptions,applyExportOptions} from './studio-r57-export-options.mjs';

const mk=(asset_id,type,duration)=>({asset_id,name:asset_id, type, size:100,lastModified:0,duration});
let state=newStudio('R5.7 mastering controls');
for(const a of [mk('main','video/mp4',6),mk('overlay','video/mp4',2),
  mk('music','audio/wav',6),mk('voice','audio/wav',2)])
  state=change(state,{type:'asset.added',asset:a});
for(const asset_id of ['main','music'])state=change(state,{type:'clip.appended',asset_id});
const linked=Object.fromEntries(state.assets.map(a=>[a.asset_id,{
  path:'/tmp/'+a.name,hasAudio:true
}]));
const base=planLocalMp4(state,linked,'/tmp/balanced.mp4');
const defaultExplicit=planLocalMp4(state,linked,'/tmp/balanced.mp4',{quality:'balanced',protectAudio:false});
assert.deepEqual(defaultExplicit.args,base.args);
assert.equal(defaultExplicit.graph,base.graph);
assert.equal(base.quality,'balanced');
assert.equal(base.protectAudio,false);
assert.doesNotMatch(base.graph,/alimiter=/);
assert.deepEqual(normalizeExportOptions(),{quality:'balanced',protectAudio:false});
const expected={
 compact:['veryfast','26','128k'],
 balanced:['medium','20','192k'],
 high:['slow','17','256k']
};
for(const [quality,values] of Object.entries(expected)) {
 const plan=planLocalMp4(state,linked,'/tmp/film.mp4',{quality});
 assert.deepEqual(['-preset','-crf','-b:a'].map(k=>plan.args[plan.args.indexOf(k)+1]),values);
 assert.equal(plan.quality,quality);
 assert.deepEqual([LOCAL_EXPORT_QUALITY[quality].preset,LOCAL_EXPORT_QUALITY[quality].crf,
  LOCAL_EXPORT_QUALITY[quality].audioBitrate],values);
 assert.equal(plan.graph,planLocalMp4(state,linked,'/tmp/film.mp4').graph);
}
assert.throws(()=>normalizeExportOptions({quality:'fast'}),/Unknown MP4 quality/);
assert.throws(()=>normalizeExportOptions({quality:'__proto__'}),/Unknown MP4 quality/);
assert.throws(()=>normalizeExportOptions({protectAudio:'yes'}),/Audio protection must be/);
const safe=planLocalMp4(state,linked,'/tmp/safe.mp4',{quality:'high',protectAudio:true});
assert.match(safe.graph,/\[prelim-master\];\n\[prelim-master\]alimiter=limit=0.95:level=0:latency=1\[aout\]/);
assert.equal((safe.graph.match(/alimiter=/g)||[]).length,1);
assert.equal(safe.args[safe.args.indexOf('-preset')+1],'slow');
assert.equal(safe.protectAudio,true);
assert.ok(safe.args.includes('-n'));
assert.throws(()=>applyExportOptions({args:['-preset','medium'],graph:'x[aout]'},{}),/Missing -crf/);
assert.throws(()=>applyExportOptions({...base,graph:'no-master-label'},{protectAudio:true}),/not suitable/);
assert.equal(base.graph,defaultExplicit.graph); // input plan was never mutated

// Use a current layered draft, and confirm identical control behavior on the second graph.
state=change(state,{type:'clip.layer.added',asset_id:'overlay',track_id:'video-2',start:1});
state=change(state,{type:'clip.layer.added',asset_id:'voice',track_id:'audio-2',start:2});
state=change(state,{type:'mixer.updated',lane:'a1',gain:.6,muted:false,solo:false});
const reopen=importDraft(exportDraft(state));
const layered=planLocalMp4(reopen,linked,'/tmp/layered.mp4',{quality:'compact',protectAudio:true});
assert.equal(layered.overlayClips,1);
assert.equal(layered.voiceClips,1);
assert.match(layered.graph,/overlay=x='/);
assert.match(layered.graph,/amix=inputs=/);
assert.match(layered.graph,/alimiter=limit=0.95:level=0:latency=1/);
assert.equal(layered.args[layered.args.indexOf('-preset')+1],'veryfast');
assert.equal(layered.args[layered.args.indexOf('-crf')+1],'26');
assert.equal(layered.args[layered.args.indexOf('-b:a')+1],'128k');
assert.equal(layered.duration,6);
const untouched=planLocalMp4(reopen,linked,'/tmp/layered.mp4');
assert.doesNotMatch(untouched.graph,/alimiter=/);

// CLI and Windows launcher use exactly the same safe preset flags and argv
// for preflight and final render, with no shell interpolation.
const cli=readFileSync(new URL('./studio-export-local.mjs',import.meta.url),'utf8');
const ps=readFileSync(new URL('../tools/windows-export.ps1',import.meta.url),'utf8');
assert.match(cli,/--audio-protect/);
assert.match(cli,/--quality/);
assert.match(cli,/quality:opt.quality\|\|'balanced'/);
assert.match(cli,/protectAudio:opt.protectAudio===true/);
assert.match(ps,/function Select-RenderOptions/);
assert.match(ps,/ComboBoxStyle]::DropDownList/);
assert.match(ps,/'Balanced', 'Compact', 'High'/);
assert.match(ps,/if \(\$renderOptions.Protect\)/);
assert.match(ps,/\$renderArgs \+= '--audio-protect'/);
assert.match(ps,/& \$node.Source \$renderer @renderArgs --dry-run/);
assert.match(ps,/& \$node.Source \$renderer @renderArgs\s*\n/);
console.log('ParaCut R5.7 PASS: stable defaults, three quality presets, post-mix sample limiter, legacy+layered output, CLI and Windows argv parity.');
