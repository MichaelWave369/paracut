import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,undo,redo,exportDraft,importDraft,duration} from '../apps/desktop/public/studio-core.js';
import {sourceTimeAtFraction,trimmedSourceSelection,estimateTrackPeak,paintTrimWaveform}
  from '../apps/desktop/public/studio-audio-visual.js';

assert.equal(sourceTimeAtFraction(0,10),0);
assert.equal(sourceTimeAtFraction(.125,10),1.25);
assert.equal(sourceTimeAtFraction(1.7,10),10);
assert.equal(sourceTimeAtFraction(-2,10),0);
assert.throws(()=>sourceTimeAtFraction(NaN,10),/Invalid waveform/);
assert.throws(()=>sourceTimeAtFraction(.5,0),/Invalid waveform/);
assert.deepEqual(trimmedSourceSelection(2,8,10),{from:.2,to:.8});
assert.throws(()=>trimmedSourceSelection(3,3.01,10),/Invalid waveform trim/);
assert.throws(()=>trimmedSourceSelection(-1,3,10),/Invalid waveform trim/);

let state=newStudio('R5.3 waveform trim');
const asset=(asset_id,duration)=>({asset_id,name:asset_id+'.wav',type:'audio/wav',size:1024,lastModified:1,duration});
const video={asset_id:'film',name:'film.mp4',type:'video/mp4',duration:12,size:900,lastModified:1};
for(const a of [video,asset('bed',10),asset('voice',5)])
  state=change(state,{type:'asset.added',asset:a});
state=change(state,{type:'clip.appended',asset_id:'film'});
state=change(state,{type:'clip.appended',asset_id:'bed'});
state=change(state,{type:'clip.layer.added',asset_id:'voice',track_id:'audio-2',start:2});
const clipA1=state.audioClips[0].clip_id,clipA2=state.audio2Clips[0].clip_id;
const peaks=new Map([['bed',Array(10).fill(.8)],['voice',Array(5).fill(.6)]]);
assert.deepEqual(estimateTrackPeak(state,'audio-1',1,peaks),{available:true,active:true,peak:.8});
assert.deepEqual(estimateTrackPeak(state,'audio-2',1,peaks),{available:false,active:false,peak:0});
assert.equal(estimateTrackPeak(state,'audio-2',3,peaks).peak,.6);
state=change(state,{type:'mixer.updated',lane:'a1',gain:.5,muted:false,solo:false});
state=change(state,{type:'mixer.duck.updated',enabled:true});
assert.equal(estimateTrackPeak(state,'audio-1',1,peaks).peak,.4);
assert.ok(Math.abs(estimateTrackPeak(state,'audio-1',3,peaks).peak-.16)<1e-9);
assert.equal(estimateTrackPeak(state,'audio-2',3,peaks).peak,.6);
state=change(state,{type:'mixer.updated',lane:'a2',gain:.3,muted:false,solo:true});
assert.equal(estimateTrackPeak(state,'audio-1',3,peaks).peak,0);
assert.ok(Math.abs(estimateTrackPeak(state,'audio-2',3,peaks).peak-.18)<1e-9);
assert.equal(estimateTrackPeak(state,'audio-1',1,new Map()).available,false);
assert.throws(()=>estimateTrackPeak(state,'video-1',1,peaks),/Invalid track meter/);
assert.throws(()=>estimateTrackPeak(state,'audio-1',NaN,peaks),/Invalid track meter/);

const timeBefore=duration(state);
state=change(state,{type:'clip.trimmed',clip_id:clipA2,start:1.25,end:4.25});
assert.equal(state.audio2Clips[0].source.start,1.25);
assert.equal(state.audio2Clips[0].source.end,4.25);
assert.equal(state.audio2Clips[0].timeline.start,2);
assert.equal(state.audio2Clips[0].timeline.end,5);
assert.equal(duration(state),timeBefore); // A2 trim never ripples V1
assert.equal(undo(state).audio2Clips[0].source.start,0);
assert.equal(redo(undo(state)).audio2Clips[0].source.start,1.25);
assert.equal(importDraft(exportDraft(state)).audio2Clips[0].source.start,1.25);
assert.equal(estimateTrackPeak(state,'audio-2',2.5,peaks).active,true);

// Canvas rendering test without a browser: no audio resources or network needed.
const fills=[],lines=[];
const ctx={
 clearRect(){},fillRect(...args){fills.push(args);},
 beginPath(){},moveTo(x){lines.push(x)},lineTo(){},stroke(){},fillText(){},
 set fillStyle(v){this._color=v},set strokeStyle(v){this._stroke=v},
 set lineWidth(v){this._lineWidth=v},set font(v){this._font=v},
 set textAlign(v){this._align=v}
};
const canvas={clientWidth:240,getContext:()=>ctx};
paintTrimWaveform(canvas,[.2,.8,.5,.1],10,2,7);
assert.equal(canvas.height,80);
assert.ok(canvas.width>=240);
assert.ok(fills.length>=5);
assert.equal(lines.length,2);
assert.ok(Math.abs(lines[0]-canvas.width*.2)<1e-9);
assert.ok(Math.abs(lines[1]-canvas.width*.7)<1e-9);

const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
for(const id of ['waveform-trim-panel','waveform-trim-canvas',
  'waveform-in-playhead','waveform-out-playhead','peak-a1','peak-a2'])
  assert.ok(html.includes('id="'+id+'"'),id);
assert.match(html,/Not a calibrated or live signal meter/);
assert.match(js,/paintTrimWaveform\(canvas,peaks,asset\.duration/);
assert.match(js,/trimCanvas\.addEventListener\('pointerdown'/);
assert.match(js,/trimCanvas\.addEventListener\('pointermove'/);
assert.match(js,/clip\.source\.start\+\(playhead-clip\.timeline\.start\)/);
assert.match(js,/estimateTrackPeak\(state,track,at,waveforms\)/);
assert.match(js,/updatePeakGuides\(at\)/);
assert.match(js,/edit\(\{ type:'clip\.trimmed'/);
console.log('ParaCut R5.3 PASS: waveform geometry, source trim editing, undo/redo, A1/A2 gain/duck/solo estimates, canvas/inspector wiring.');
