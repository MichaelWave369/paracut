import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,validate,undo,redo,exportDraft,importDraft,duration}
 from '../apps/desktop/public/studio-core.js';
import {MARKER_COLORS,MARKER_LIMIT,validateMarker,markerFromInput,
 sortedMarkers,navigateMarker} from '../apps/desktop/public/studio-markers.js';
import {planLocalMp4} from './studio-local-export-core.mjs';
assert.deepEqual(MARKER_COLORS,['mint','gold','blue','coral']);
assert.equal(MARKER_LIMIT,100);
assert.deepEqual(newStudio().markers,[]);
const one=markerFromInput({time:2.12349,label:'  Review mix  ',note:'Audio peak?',color:'gold'},'mark-one');
assert.deepEqual(one,{marker_id:'mark-one',time:2.123,label:'Review mix',note:'Audio peak?',color:'gold'});
assert.equal(validateMarker(one),true);
for(const invalid of [
 {time:-1,label:'Early',color:'mint'},
 {time:86401,label:'Late',color:'mint'},
 {time:Infinity,label:'Infinite',color:'mint'},
 {time:1,label:'   ',color:'mint'},
 {time:1,label:'x'.repeat(61),color:'mint'},
 {time:1,label:'Fine',note:'x'.repeat(281),color:'mint'},
 {time:1,label:'Fine',note:44,color:'mint'},
 {time:1,label:'Fine',color:'hacker'},
 {time:1,label:'Fine',color:'mint',evil:'video=delete'}
])assert.throws(()=>markerFromInput(invalid,'test'),/Invalid timeline marker|Unsupported timeline marker/);
assert.throws(()=>validateMarker({...one,extra:'untrusted'}),/Unsupported timeline marker/);
assert.throws(()=>validateMarker({...one,marker_id:''}),/Invalid timeline marker/);
assert.deepEqual(sortedMarkers([{...one,time:3,marker_id:'b'},{...one,time:2,marker_id:'a'}]).map(m=>m.marker_id),['a','b']);
assert.equal(navigateMarker([one],0,'next').marker_id,'mark-one');
assert.equal(navigateMarker([one],3,'previous').marker_id,'mark-one');
assert.equal(navigateMarker([one],one.time,'next'),null);
assert.equal(navigateMarker([one],one.time,'previous'),null);
assert.throws(()=>navigateMarker([one],NaN,'next'),/Invalid marker navigation/);
assert.throws(()=>navigateMarker([one],2,'wrap'),/Invalid marker navigation/);

let s=newStudio('Markers and review ledger');
for(const a of [
 {asset_id:'v1',name:'main.mp4',type:'video/mp4',duration:5,size:100,lastModified:0},
 {asset_id:'v2',name:'other.mp4',type:'video/mp4',duration:5,size:100,lastModified:0}
])s=change(s,{type:'asset.added',asset:a});
s=change(s,{type:'clip.appended',asset_id:'v1'});
s=change(s,{type:'clip.appended',asset_id:'v2'});
const linked=Object.fromEntries(s.assets.map(a=>[a.asset_id,{path:'/tmp/'+a.name,hasAudio:false}]));
const noMarkers=planLocalMp4(s,linked,'/tmp/example.mp4');
assert.equal(duration(s),10);
const oldDraft=JSON.parse(exportDraft(s));
delete oldDraft.markers; // R6.4 draft with no marker property
assert.deepEqual(importDraft(JSON.stringify(oldDraft)).markers,[]);
assert.equal(importDraft(JSON.stringify(oldDraft)).schema,s.schema);
const before=exportDraft(s),initialReceipts=s.receipts.length;
s=change(s,{type:'marker.added',marker:{time:6.5,label:'Review B',note:'Check shot 2',color:'gold'}});
assert.equal(s.markers.length,1);
assert.equal(s.receipts.length,initialReceipts+1);
assert.equal(s.receipts.at(-1).action,'marker.added');
assert.equal(s.receipts.at(-1).details.time,6.5);
assert.equal(s.receipts.at(-1).details.note,'Check shot 2');
assert.ok(s.receipts.at(-1).details.marker_id);
const idB=s.markers[0].marker_id;
s=change(s,{type:'marker.added',marker:{time:1.25,label:'Review A',note:'Early cut',color:'mint'}});
assert.deepEqual(s.markers.map(m=>m.time),[1.25,6.5]);
const idA=s.markers[0].marker_id;
assert.equal(navigateMarker(s.markers,0,'next').marker_id,idA);
assert.equal(navigateMarker(s.markers,2,'next').marker_id,idB);
assert.equal(navigateMarker(s.markers,8,'previous').marker_id,idB);
assert.equal(navigateMarker(s.markers,4,'previous').marker_id,idA);
assert.equal(s.clips.length,2);
assert.equal(undo(s).markers.length,1);
assert.equal(redo(undo(s)).markers.length,2);
assert.equal(importDraft(exportDraft(s)).markers.length,2);
assert.deepEqual(importDraft(exportDraft(s)).markers,s.markers);
const firstMarkers=JSON.stringify(s.markers);
const beforeUpdate=s.receipts.length;
s=change(s,{type:'marker.updated',marker_id:idB,
 marker:{time:.5,label:'Opening idea',note:'Try slower cut',color:'coral'}});
assert.equal(s.receipts.length,beforeUpdate+1);
assert.deepEqual(s.markers.map(m=>m.time),[.5,1.25]);
assert.equal(s.markers[0].marker_id,idB);
assert.equal(s.markers[0].label,'Opening idea');
assert.equal(s.receipts.at(-1).details.marker_id,idB);
assert.equal(undo(s).markers[1].time,6.5);
assert.equal(redo(undo(s)).markers[0].time,.5);
assert.throws(()=>change(s,{type:'marker.updated',marker_id:'missing',
 marker:{time:0,label:'No',note:'',color:'mint'}}),/Marker not found/);
const count=s.receipts.length;
s=change(s,{type:'marker.deleted',marker_id:idA});
assert.equal(s.receipts.length,count+1);
assert.equal(s.receipts.at(-1).action,'marker.deleted');
assert.equal(s.receipts.at(-1).details.marker_id,idA);
assert.equal(s.markers.length,1);
assert.equal(undo(s).markers.length,2);
assert.equal(redo(undo(s)).markers.length,1);
assert.throws(()=>change(s,{type:'marker.deleted',marker_id:idA}),/Marker not found/);
// Fail closed: malicious imported marker fields/IDs cannot be accepted.
const draft=JSON.parse(exportDraft(s));
for(const bad of [
 {...one,marker_id:'x',color:'invalid'},
 {...one,marker_id:'x',time:NaN}, // JSON serializes NaN to null
 {...one,marker_id:'x',note:'note',unknown:'script'}
]){
 const test=structuredClone(draft);
 test.markers=[bad];
 assert.throws(()=>importDraft(JSON.stringify(test)),/Invalid timeline marker|Unsupported timeline marker/);
}
const dup=structuredClone(draft);dup.markers=[one,one];
assert.throws(()=>importDraft(JSON.stringify(dup)),/Duplicate timeline marker ID/);
const unsorted=structuredClone(draft);unsorted.markers=[
 {...one,time:2,marker_id:'b'},{...one,time:1,marker_id:'a'}
];
assert.throws(()=>importDraft(JSON.stringify(unsorted)),/sorted by time/);
const corrupted=structuredClone(draft);corrupted.markers='bad';
assert.throws(()=>importDraft(JSON.stringify(corrupted)),/Invalid ParaCut draft/);
const rejected=exportDraft(s);
assert.throws(()=>change(s,{type:'marker.added',
 marker:{time:-5,label:'Bad',note:'',color:'mint'}}),/Invalid timeline marker/);
assert.equal(exportDraft(s),rejected);
const exported=planLocalMp4(s,linked,'/tmp/example.mp4');
assert.equal(exported.graph,noMarkers.graph);
assert.deepEqual(exported.args,noMarkers.args);
assert.equal(duration(s),10);
assert.notEqual(exportDraft(s),before);
assert.equal(validate(s),true);

const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
for(const id of ['marker-track','marker-add','marker-prev','marker-next','marker-list',
 'marker-count','marker-label','marker-time','marker-note','marker-color','marker-save',
 'marker-delete','marker-cancel','marker-edit'])
 assert.match(html,new RegExp('id="'+id+'"'));
assert.match(html,/Shift\+M Next marker/);
assert.match(js,/function drawMarkers\(\)/);
assert.match(js,/function jumpToMarker\(marker\)/);
assert.match(js,/if\(e.shiftKey\)\$\('marker-next'\)\.click\(\)/);
assert.match(js,/marker\.added/);
assert.match(js,/marker\.updated/);
assert.match(js,/marker\.deleted/);
assert.match(css,/\.marker-pin/);
assert.match(css,/\.marker-list/);
console.log('ParaCut R6.5 PASS: timeline marker Add/Edit/Delete, notes/colors, navigation, receipts, Undo/Redo, old drafts and unchanged MP4 planning.');
