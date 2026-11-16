import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change} from '../apps/desktop/public/studio-core.js';
import {findRecorderMime} from '../apps/desktop/public/studio-export-format.js';
import {assessExportReadiness} from '../apps/desktop/public/studio-export-readiness.js';
const fakeRecorder={isTypeSupported:m=>m==='video/webm'||m==='video/mp4'};
const mimes={mp4Mime:findRecorderMime('mp4',fakeRecorder),
 webmMime:findRecorderMime('webm',fakeRecorder),recordingReady:true};
const empty=newStudio('Readiness empty');
let e=assessExportReadiness(empty,new Map(),mimes);
assert.equal(e.mp4Disabled,true);assert.equal(e.webmDisabled,true);
assert.match(e.message,/Add a video clip/);
let project=change(empty,{type:'asset.added',asset:{
 asset_id:'source',name:'ball.webm',type:'video/webm',size:100,duration:4,lastModified:0,
}});
project=change(project,{type:'clip.appended',asset_id:'source'});
project=change(project,{type:'clip.source-audio.muted',clip_id:project.clips[0].clip_id,muted:true});
e=assessExportReadiness(project,new Map(),mimes);
assert.equal(e.missingSourceCount,1);assert.equal(e.webmDisabled,true);
assert.match(e.message,/need relinking/);
const media=new Map([['source',{file:{name:'ball.webm',size:100},url:'blob:local'}]]);
e=assessExportReadiness(project,media,mimes);
assert.equal(e.linked,true);
assert.equal(e.webmDisabled,false);assert.equal(e.mp4Disabled,false);
assert.match(e.message,/Ready to export/);
e=assessExportReadiness(project,media,{...mimes,mp4Mime:null});
assert.equal(e.webmDisabled,false);assert.equal(e.mp4Disabled,true);
e=assessExportReadiness(project,media,{...mimes,recordingReady:false});
assert.equal(e.webmDisabled,true);assert.match(e.message,/browser recording/);
e=assessExportReadiness(project,media,{...mimes,exporting:true,activeFormat:'webm'});
assert.equal(e.webmDisabled,false);assert.equal(e.mp4Disabled,true);
let withMissing=change(project,{type:'asset.added',asset:{
 asset_id:'unlinked-audio',name:'music.wav',type:'audio/wav',size:100,duration:4,lastModified:0,
}});
withMissing=change(withMissing,{type:'clip.appended',asset_id:'unlinked-audio'});
e=assessExportReadiness(withMissing,media,mimes);
assert.equal(e.missingSourceCount,1);assert.equal(e.webmDisabled,true);
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
assert.match(js,/import \{assessExportReadiness\} from '\.\/studio-export-readiness\.js'/);
const render=js.slice(js.indexOf('function render()'),js.indexOf('// Playback uses the video playhead'));
assert.ok(render.indexOf('refreshExportReadiness();')>=0);
assert.ok(render.indexOf('refreshExportReadiness();')<render.indexOf('drawMedia()'),
 'Readiness must refresh before potentially failing secondary UI redraws');
assert.match(js,/\$\('export-readiness'\)\.textContent=result\.message/);
assert.match(html,/id="export-readiness"/);
assert.match(js,/media\.set\(asset_id,\{file:candidate\.file,url\}\)/);
console.log('ParaCut export readiness PASS: verified V1 media, missing source, browser support, active export, early redraw.');
