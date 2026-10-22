import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,validate,undo,redo,exportDraft,importDraft}
 from '../apps/desktop/public/studio-core.js';
import {clipColor,COLOR_DEFAULTS,validateClipColor,colorCSS,
  colorFFmpegFilters,hasColorAdjustment} from '../apps/desktop/public/studio-color.js';
import {planLocalMp4} from './studio-local-export-core.mjs';

assert.deepEqual(clipColor(null),COLOR_DEFAULTS);
assert.equal(hasColorAdjustment({}),false);
assert.deepEqual(colorFFmpegFilters({}),[]);
assert.match(colorCSS(null),/brightness\(1\) contrast\(1\) saturate\(1\)/);
assert.throws(()=>validateClipColor({brightness:2}),/brightness/);
assert.throws(()=>validateClipColor({brightness:'1'}),/brightness/);
assert.throws(()=>validateClipColor({contrast:NaN}),/contrast/);
assert.throws(()=>validateClipColor({saturation:-1}),/saturation/);
assert.throws(()=>validateClipColor({warmth:51}),/warmth/);
assert.throws(()=>validateClipColor({brightness:1,remoteFilter:'crop=iw/2'}),/Invalid clip color/);
assert.throws(()=>validateClipColor([]),/Invalid clip color/);

let s=newStudio('Clip grading');
for(const a of [
 {asset_id:'main',name:'main.mp4',type:'video/mp4',duration:8,size:100,lastModified:1},
 {asset_id:'over',name:'over.mp4',type:'video/mp4',duration:3,size:100,lastModified:1},
 {asset_id:'sound',name:'sound.wav',type:'audio/wav',duration:8,size:100,lastModified:1}
]) s=change(s,{type:'asset.added',asset:a});
for(const asset_id of ['main','sound'])s=change(s,{type:'clip.appended',asset_id});
s=change(s,{type:'clip.layer.added',asset_id:'over',track_id:'video-2',start:2});
const id1=s.clips[0].clip_id,id2=s.video2Clips[0].clip_id,aid=s.audioClips[0].clip_id;
const source=exportDraft(s);
const media=Object.fromEntries(s.assets.map(a=>[a.asset_id,{
 path:'/tmp/'+a.name,hasAudio:a.type.startsWith('audio/')
}]));
const neutral=planLocalMp4(s,media,'/tmp/neutral.mp4');
assert.doesNotMatch(neutral.graph,/colorbalance=|eq=brightness=/);
s=change(s,{type:'clip.color.updated',clip_id:id1,
 color:{brightness:1.2,contrast:1.15,saturation:.6,warmth:25}});
assert.equal(s.clips[0].color.brightness,1.2);
assert.equal(s.clips[0].color.saturation,.6);
assert.equal(s.receipts.at(-1).action,'clip.color.updated');
assert.equal(s.receipts.at(-1).details.color.warmth,25);
assert.equal(undo(s).clips[0].color,undefined);
assert.equal(redo(undo(s)).clips[0].color.warmth,25);
assert.equal(hasColorAdjustment(s.clips[0]),true);
assert.deepEqual(colorFFmpegFilters(s.clips[0]),[
 'eq=brightness=0.048:contrast=1.15:saturation=0.6',
 'colorbalance=rs=0.1:bs=-0.1'
]);
assert.match(colorCSS(s.clips[0]),/sepia\(/);
s=change(s,{type:'clip.color.updated',clip_id:id2,
 color:{brightness:.8,contrast:1,saturation:1.4,warmth:-15}});
assert.match(colorCSS(s.video2Clips[0]),/hue-rotate\(180deg\)/);
assert.equal(validate(s),true);
assert.deepEqual(importDraft(exportDraft(s)).video2Clips[0].color,s.video2Clips[0].color);
assert.deepEqual(importDraft(source).clips[0].color,undefined);
assert.throws(()=>change(s,{type:'clip.color.updated',clip_id:aid,color:COLOR_DEFAULTS}),/only for V1\/V2/);
assert.throws(()=>change(s,{type:'clip.color.updated',clip_id:id1,
 color:{brightness:9,contrast:1,saturation:1,warmth:0}}),/brightness/);
assert.throws(()=>change(s,{type:'clip.color.updated',clip_id:id1,
 color:{brightness:1,contrast:1,saturation:1,warmth:'warm'}}),/warmth/);
const tampered=JSON.parse(exportDraft(s));
tampered.video2Clips[0].color={warmth:999};
assert.throws(()=>importDraft(JSON.stringify(tampered)),/warmth/);
const badAudio=JSON.parse(exportDraft(s));
badAudio.audioClips[0].color={brightness:1};
assert.throws(()=>importDraft(JSON.stringify(badAudio)),/Audio tracks cannot have color effects/);
const rendered=planLocalMp4(s,media,'/tmp/color.mp4');
assert.match(rendered.graph,/eq=brightness=0\.048:contrast=1\.15:saturation=0\.6/);
assert.match(rendered.graph,/colorbalance=rs=0\.1:bs=-0\.1/);
assert.match(rendered.graph,/eq=brightness=-0\.048:contrast=1:saturation=1\.4/);
assert.match(rendered.graph,/colorbalance=rs=-0\.06:bs=0\.06/);
assert.match(rendered.graph,/overlay=x=/);
assert.ok(rendered.args.includes('libx264'));
const withoutLayer=change(change(s,{type:'clip.color.updated',clip_id:id2,color:COLOR_DEFAULTS}),
 {type:'clip.deleted',clip_id:id2});
const simplePlan=planLocalMp4(withoutLayer,media,'/tmp/legacy-color.mp4');
assert.match(simplePlan.graph,/eq=brightness=0\.048:contrast=1\.15:saturation=0\.6/);
assert.equal(simplePlan.overlayClips,undefined);
const ungraded=change(s,{type:'clip.color.updated',clip_id:id1,color:COLOR_DEFAULTS});
assert.equal(hasColorAdjustment(ungraded.clips[0]),false);

// Preview and browser MediaRecorder must apply color to each source before
// compositing, keeping titles and other sources unaffected.
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
for(const id of ['clip-color-control','color-brightness','color-contrast',
  'color-saturation','color-warmth','apply-clip-color','reset-clip-color'])
 assert.match(html,new RegExp('id="'+id+'"'));
assert.match(js,/el\.style\.filter=previewColorFor\(find\(el\.dataset\.clip\),selectedId,/);
assert.match(js,/g\.filter=colorCSS\(clip\)/);
assert.match(js,/drawVideoFrame\(encoderIncoming,fade.progress,fade.incoming\)/);
assert.match(js,/drawVideoFrame\(el,1,clip\)/);
assert.match(js,/function submitColor\(\)/);
assert.match(js,/clip\.color\.updated/);
assert.match(css,/\.clip-color-control/);
console.log('ParaCut R6.1 PASS: color bounds/security, V1+V2 preview/render wiring, local FFmpeg legacy+layered graph, receipts, draft and Undo/Redo.');
