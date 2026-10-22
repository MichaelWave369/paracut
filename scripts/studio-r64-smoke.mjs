import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,validate,undo,redo,exportDraft,importDraft}
 from '../apps/desktop/public/studio-core.js';
import {matchedSourceFrame,captureAttributes,attributePasteCommand}
 from '../apps/desktop/public/studio-attributes.js';
import {COLOR_DEFAULTS} from '../apps/desktop/public/studio-color.js';
import {planLocalMp4} from './studio-local-export-core.mjs';

const asset=(id,type,duration)=>({asset_id:id,name:id+'.mp4',type,duration,size:100,lastModified:0});
let s=newStudio('Match Frame + attributes');
for(const a of [asset('main','video/mp4',10),asset('b','video/mp4',10),
 asset('overlay','video/mp4',5),asset('short','video/mp4',1),
 asset('music','audio/wav',8)])
 s=change(s,{type:'asset.added',asset:a});
for(const asset_id of ['main','b','music'])s=change(s,{type:'clip.appended',asset_id});
s=change(s,{type:'clip.layer.added',asset_id:'overlay',track_id:'video-2',start:2});
s=change(s,{type:'clip.layer.added',asset_id:'short',track_id:'video-2',start:10});
const [first,second]=s.clips, [over,short]=s.video2Clips;
const audio=s.audioClips[0];
const initial=exportDraft(s);
const matched=matchedSourceFrame(first,3.25);
assert.deepEqual(matched,{assetId:'main',clipId:first.clip_id,time:3.25,in:0,out:10});
assert.equal(matchedSourceFrame(second,15.5).time,5.5);
assert.equal(matchedSourceFrame(over,4.25).time,2.25);
assert.equal(matchedSourceFrame(over,-10).time,0);
assert.equal(matchedSourceFrame(over,999).time,5);
assert.throws(()=>matchedSourceFrame(audio,2),/requires a video/);
assert.throws(()=>matchedSourceFrame(over,NaN),/Invalid Program time/);
// Exact Match Frame math preserves source trim offsets (not just timeline start).
s=change(s,{type:'clip.trimmed',clip_id:first.clip_id,start:2,end:8});
const trim=s.clips[0];
assert.deepEqual(matchedSourceFrame(trim,2.5),{
 assetId:'main',clipId:first.clip_id,time:4.5,in:2,out:8});
assert.equal(matchedSourceFrame(trim,0).time,2);
assert.equal(matchedSourceFrame(trim,9).time,8);
assert.equal(s.receipts.at(-1).action,'clip.trimmed');
// Attribute copy is a read-only snapshot, so simply copying never creates receipt.
const beforeCopy=exportDraft(s),initialReceipts=s.receipts.length;
const neutral=captureAttributes(s.clips[0],'color');
assert.deepEqual(neutral.values,COLOR_DEFAULTS);
assert.equal(neutral.sourceClipId,first.clip_id);
assert.equal(exportDraft(s),beforeCopy);
assert.equal(s.receipts.length,initialReceipts);
assert.throws(()=>captureAttributes(audio,'color'),/requires a V1 or V2/);
assert.throws(()=>captureAttributes(first,'overlay'),/Overlay attributes require/);
assert.throws(()=>captureAttributes(null,'color'),/requires a V1 or V2/);

s=change(s,{type:'clip.color.updated',clip_id:first.clip_id,
 color:{brightness:1.12,contrast:1.2,saturation:.75,warmth:25}});
const savedColor=captureAttributes(s.clips[0],'color');
assert.equal(savedColor.values.brightness,1.12);
assert.notEqual(savedColor.values,s.clips[0].color);
const colorCmd=attributePasteCommand(savedColor,s.clips[1]);
assert.equal(colorCmd.type,'clip.color.updated');
assert.equal(colorCmd.clip_id,second.clip_id);
const beforePaste=s.receipts.length;
s=change(s,colorCmd);
assert.equal(s.receipts.length,beforePaste+1);
assert.equal(s.receipts.at(-1).action,'clip.color.updated');
assert.deepEqual(s.clips[1].color,savedColor.values);
assert.deepEqual(undo(s).clips[1].color,undefined);
assert.deepEqual(redo(undo(s)).clips[1].color,savedColor.values);
assert.deepEqual(importDraft(exportDraft(s)).clips[1].color,savedColor.values);
assert.deepEqual(importDraft(initial).clips[1].color,undefined);
assert.throws(()=>attributePasteCommand(savedColor,audio),/V1\/V2 video/);
// Changing the source after copy does not change the copied values.
s=change(s,{type:'clip.color.updated',clip_id:first.clip_id,
 color:{brightness:.75,contrast:1,saturation:2,warmth:-20}});
assert.equal(savedColor.values.brightness,1.12);
// Overlay presets: only V2 may copy and paste, without position, source, audio,
// layer transition or clip identity being overwritten.
s=change(s,{type:'clip.overlay.updated',clip_id:over.clip_id,
 layout:'full',opacity:.7,motion:'rise',fade_in:.4,fade_out:.6});
const snap=captureAttributes(s.video2Clips[0],'overlay');
assert.deepEqual(snap.values,{layout:'full',opacity:.7,motion:'rise',fade_in:.4,fade_out:.6});
const overTarget=s.video2Clips[1];
const unchangedBefore={...overTarget.timeline},startBefore=overTarget.source.start;
const cmd=attributePasteCommand(snap,overTarget);
assert.equal(cmd.type,'clip.overlay.updated');
assert.equal(cmd.clip_id,short.clip_id);
const count=s.receipts.length;
s=change(s,cmd);
assert.equal(s.receipts.length,count+1);
assert.equal(s.receipts.at(-1).action,'clip.overlay.updated');
assert.equal(s.video2Clips[1].overlay_motion,'rise');
assert.equal(s.video2Clips[1].overlay_opacity,.7);
assert.deepEqual(s.video2Clips[1].timeline,unchangedBefore);
assert.equal(s.video2Clips[1].source.start,startBefore);
assert.equal(validate(s),true);
assert.equal(undo(s).video2Clips[1].overlay_motion,'none');
assert.deepEqual(redo(undo(s)).video2Clips[1].timeline,unchangedBefore);
assert.throws(()=>attributePasteCommand(snap,s.clips[1]),/only be pasted onto V2/);
assert.throws(()=>attributePasteCommand(null,s.video2Clips[1]),/Copy attributes first/);
assert.throws(()=>attributePasteCommand({kind:'untrusted'},s.video2Clips[1]),/Unsupported/);
assert.throws(()=>attributePasteCommand(
 {kind:'overlay',values:{...snap.values,fade_in:2}},overTarget),/exceed target clip length/);
assert.throws(()=>attributePasteCommand(
 {kind:'color',values:{brightness:999}},s.clips[1]),/brightness/);
assert.equal(exportDraft(s).includes('attributeClipboard'),false);
assert.equal(exportDraft(s).includes('matchedSourceFrame'),false);
const linked=Object.fromEntries(s.assets.map(a=>[a.asset_id,{path:'/tmp/'+a.name,hasAudio:false}]));
const mp4=planLocalMp4(s,linked,'/tmp/r64.mp4');
assert.equal(mp4.overlayClips,2);
assert.match(mp4.graph,/colorbalance=/);
assert.match(mp4.graph,/overlay=x=/);
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
for(const id of ['source-match-frame','attribute-clipboard','copy-color','paste-color',
 'copy-overlay','paste-overlay','attribute-clipboard-status'])
 assert.match(html,new RegExp('id="'+id+'"'));
assert.match(js,/function matchFrame\(clip,time=playhead\)/);
assert.match(js,/const matchedTime=clipClickTime\(clip,event,item\)/);
assert.match(js,/matchFrame\(clip,matchedTime\)/);
assert.match(js,/if\(kind==='video'\)item\.addEventListener\('dblclick'/);
assert.match(js,/if\(!isAudio\)item\.addEventListener\('dblclick'/);
assert.match(js,/sourceVideo\.addEventListener\('loadedmetadata',seekMatched,\{once:true\}\)/);
assert.match(js,/attributePasteCommand\(attributeClipboard\[kind\],clip\)/);
assert.match(js,/captureAttributes\(clip,kind\)/);
assert.match(js,/if\(key==='f'\)/);
assert.match(css,/\.attribute-clipboard/);
assert.match(css,/#source-match-frame/);
console.log('ParaCut R6.4 PASS: trimmed source Match Frame, V1/V2 grade copy/paste, V2 style guards, one receipt/paste, Undo/Redo, old drafts and export compatibility.');
