import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,undo,redo,exportDraft,importDraft,validate}
 from '../apps/desktop/public/studio-core.js';
import {buildAss,planLocalMp4} from './studio-local-export-core.mjs';
import {
 TITLE_LIBRARY_KEY,TITLE_LIBRARY_KIND,TITLE_LIBRARY_VERSION,TITLE_LIBRARY_MAX,
 TITLE_LIBRARY_MAX_BYTES,titleLibraryEmpty,titleLibraryValidate,titleLibraryAdd,
 titleLibraryDelete,titleLibraryFind,titleLibrarySerialize,titleLibraryParse,
 titleLibraryReplace,titleStyleLook,titleStyleFromTitle,titleStyleFields
} from '../apps/desktop/public/studio-title-style-library.js';

const defaultLook={position:'bottom',size:'medium',color:'white',motion:'none',
 motion_ease:'linear',motion_distance:100};
assert.equal(TITLE_LIBRARY_KEY,'paracut.studio.title.styles.v1');
assert.equal(TITLE_LIBRARY_KIND,'paracut-title-styles');
assert.equal(TITLE_LIBRARY_VERSION,1);
assert.equal(TITLE_LIBRARY_MAX,24);
assert.equal(TITLE_LIBRARY_MAX_BYTES,16384);
assert.deepEqual(titleStyleLook({}),defaultLook);
assert.deepEqual(titleStyleLook(defaultLook),defaultLook);
const detailed={
 position:'top',size:'large',color:'mint',
 motion:'slide-right',motion_ease:'smooth',motion_distance:125,
 title_x:427,title_y:298,title_scale:150
};
assert.deepEqual(titleStyleLook(detailed),detailed);
assert.deepEqual(titleStyleFields(detailed),detailed);
const projectData={title_id:'abc',text:'HELLO',start:1,end:5,
 fade_in:1,fade_out:1,motion:'slide-right',...detailed};
assert.deepEqual(titleStyleFromTitle(projectData),detailed);
assert.ok(!Object.hasOwn(titleStyleFromTitle(projectData),'text'));
for(const invalid of [
 {text:'injected'}, {start:1},{fade_in:3},{style:'color:red'},
 {title_x:640},{title_y:360},{title_x:50,title_y:360},
 {title_x:640,title_y:700},{title_scale:101},
 {title_scale:'150'}, {motion:'javascript:'},{motion_ease:'bezier(...)'},
 {motion_distance:300},{color:'red'}, {size:'huge'},
 {position:'left'}, {position:null},{size:null},{color:null},{motion:null},
 null,[],45
])assert.throws(()=>titleStyleLook(invalid));
assert.throws(()=>titleStyleFromTitle(null),/Invalid title style source/);
const original=titleLibraryEmpty();
assert.deepEqual(original,{kind:'paracut-title-styles',version:1,styles:[]});
const unchanged=JSON.stringify(original);
const a=titleLibraryAdd(original,{id:'test_a',name:'Field Hero',look:detailed});
assert.equal(a.styles.length,1);
assert.equal(JSON.stringify(original),unchanged,'mutating library should be pure');
const b=titleLibraryAdd(a,{id:'test_b',name:'Moon Caption',
 look:{position:'bottom',color:'gold',size:'small',title_scale:75}});
assert.equal(b.styles.length,2);
assert.deepEqual(titleLibraryFind(a,'test_a'),{
 id:'test_a',name:'Field Hero',look:detailed
});
assert.deepEqual(titleLibraryFind(b,'test_b').look,{
 ...defaultLook,size:'small',color:'gold',title_scale:75
});
assert.throws(()=>titleLibraryFind(b,'missing'),/no longer exists/);
assert.throws(()=>titleLibraryDelete(b,'missing'),/no longer exists/);
assert.throws(()=>titleLibraryAdd(b,{id:'test_c',name:'Field Hero',look:{}}),/already uses/);
assert.throws(()=>titleLibraryAdd(b,{id:'test_c',name:'field hero',look:{}}),/already uses/);
assert.throws(()=>titleLibraryAdd(b,{id:'test_a',name:'Unique',look:{}}),/Duplicate/);
for(const name of ['', '   ', '\n', 'x'.repeat(49), 40]){
 assert.throws(()=>titleLibraryAdd(b,{id:'xyz',name,look:{}}),/name/);
}
for(const id of ['', 'a.b','script<script>','a'.repeat(65),null]){
 assert.throws(()=>titleLibraryAdd(b,{id,name:'Unique',look:{}}),/identifier/);
}
const afterDelete=titleLibraryDelete(b,'test_a');
assert.equal(afterDelete.styles.length,1);
assert.equal(afterDelete.styles[0].id,'test_b');
assert.equal(b.styles.length,2,'delete creates a new library');
const json=titleLibrarySerialize(b);
assert.ok(json.includes('"version": 1'));
assert.deepEqual(titleLibraryParse(json),b);
assert.deepEqual(titleLibraryReplace(a,json),b,'import replaces, never silently merges');
assert.deepEqual(titleLibraryParse(titleLibrarySerialize(original)),original);
for(const bad of [
 '{}','[]','null','{', '"string"',
 JSON.stringify({...b,kind:'unknown'}),
 JSON.stringify({...b,version:2}),
 JSON.stringify({...b,version:0}),
 JSON.stringify({...b,styles:{}}),
 JSON.stringify({...b,unsafe:true}),
 JSON.stringify({...b,styles:[...b.styles,{...b.styles[0]}]}),
 JSON.stringify({...b,styles:[b.styles[0],{
   ...b.styles[1],id:'test_b',name:'New Name'}]}),
 JSON.stringify({...b,styles:[{id:'x',name:'Injected',
   look:{...detailed,onclick:'attack'}}]}),
 JSON.stringify({...b,styles:[{id:'x',name:'Injected',look:{title_scale:null}}]}),
 JSON.stringify({...b,styles:[{id:'x',name:'Injected',
   look:{...detailed,title_y:null}}]}),
 JSON.stringify({...b,styles:[{id:'x',name:'Injected',look:{}} ,{id:'y',name:'injected',look:{}, extra:true}]}),
 'x'.repeat(TITLE_LIBRARY_MAX_BYTES+1)
])assert.throws(()=>titleLibraryParse(bad));
assert.throws(()=>titleLibraryReplace(a,'not json'),/valid JSON/);
assert.equal(a.styles.length,1,'failed import is atomic');
let full=original;
for(let i=0;i<TITLE_LIBRARY_MAX;i++)
 full=titleLibraryAdd(full,{id:'i_'+i,name:'Look '+i,look:{}});
assert.equal(full.styles.length,24);
assert.ok(titleLibrarySerialize(full).length<TITLE_LIBRARY_MAX_BYTES);
assert.throws(()=>titleLibraryAdd(full,{id:'more',name:'Extra',look:{}}),/full/);
assert.throws(()=>titleLibraryValidate({...full,styles:[...full.styles,full.styles[0]]}),
 /version or structure/);
const roundtrip=titleLibraryParse(titleLibrarySerialize(full));
assert.deepEqual(roundtrip,full);
const spaced=titleLibraryAdd(original,{id:'trim',name:'  Trimmed  ',look:{}});
assert.equal(spaced.styles[0].name,'Trimmed');
assert.deepEqual(titleLibraryParse(titleLibrarySerialize(spaced)),spaced);

let project=newStudio('R8.8 project one');
project=change(project,{type:'asset.added',asset:{
 asset_id:'video',name:'video',type:'video/mp4',duration:7,size:123,lastModified:0
}});
project=change(project,{type:'clip.appended',asset_id:'video'});
const baseTitle={text:'UNIQUE WORDS',start:1,end:4,fade_in:.5,fade_out:.25,
 position:'middle',size:'small',color:'white',motion:'float-up'};
project=change(project,{type:'title.added',title:baseTitle});
const beforeReceipt=project.receipts.length;
const beforeDraft=exportDraft(project),beforeAss=buildAss(project.titles,7);
const selected=titleLibraryFind(b,'test_a').look;
const stagedTitle={...baseTitle,...titleStyleFields(selected)};
assert.equal(project.receipts.length,beforeReceipt);
assert.equal(exportDraft(project),beforeDraft,
 'Previewing a look must not modify the project');
const staged=change(project,{type:'title.updated',
 title_id:project.titles[0].title_id,title:stagedTitle});
assert.equal(staged.receipts.length,beforeReceipt+1);
assert.equal(staged.receipts.at(-1).action,'title.updated');
assert.equal(staged.titles[0].text,baseTitle.text);
assert.equal(staged.titles[0].start,baseTitle.start);
assert.equal(staged.titles[0].end,baseTitle.end);
assert.equal(staged.titles[0].fade_in,baseTitle.fade_in);
assert.equal(staged.titles[0].fade_out,baseTitle.fade_out);
assert.equal(staged.titles[0].title_scale,150);
assert.equal(staged.titles[0].title_x,427);
assert.equal(staged.titles[0].title_y,298);
assert.equal(staged.titles[0].motion,'slide-right');
assert.equal(validate(staged),true);
assert.deepEqual(undo(staged).titles,project.titles);
assert.deepEqual(redo(undo(staged)).titles,staged.titles);
assert.deepEqual(importDraft(exportDraft(staged)).titles,staged.titles);
const plan=planLocalMp4(staged,{video:{path:'/tmp/video.mp4',hasAudio:false}},
 '/tmp/styled.mp4');
assert.ok(plan.ass.includes('\\fs111'));
assert.ok(plan.ass.includes('\\pos(427,298)'));
assert.ok(plan.graph.includes('titles.ass'));
assert.equal(buildAss(project.titles,7),beforeAss,'original export is unchanged');
// A second project reuses the same look, without importing or changing draft schema.
let second=newStudio('R8.8 second project');
second=change(second,{type:'asset.added',asset:{
 asset_id:'v2',name:'second',type:'video/mp4',duration:7,size:200,lastModified:0
}});
second=change(second,{type:'clip.appended',asset_id:'v2'});
second=change(second,{type:'title.added',title:{
 text:'OTHER WORDS',start:2,end:5,fade_in:0,fade_out:0,
 ...titleStyleFields(titleLibraryFind(titleLibraryParse(json),'test_a').look)
}});
assert.equal(second.titles[0].text,'OTHER WORDS');
assert.equal(second.titles[0].start,2);
assert.equal(second.titles[0].title_scale,150);
assert.equal(second.titles[0].title_x,427);
assert.equal(second.titles[0].title_y,298);
assert.ok(!exportDraft(second).includes('title.style.library'));
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
assert.match(html,/R8\.8 · TITLE STYLE LIBRARY/);
for(const id of ['title-style-library','title-style-save','title-style-name',
 'title-style-select','title-style-apply','title-style-delete','title-style-export',
 'title-style-import','title-style-import-file','title-library-count',
 'title-style-library-status'])
 assert.ok(html.includes('id="'+id+'"'),id);
assert.ok(html.includes('aria-live="polite"'));
assert.ok(js.includes('window.localStorage.getItem(TITLE_LIBRARY_KEY)'));
assert.ok(js.includes('window.localStorage.setItem(TITLE_LIBRARY_KEY,data)'));
assert.ok(js.includes('titleStyleFromTitle({'));
assert.ok(js.includes('titleLibraryAdd(titleLookLibrary'));
assert.ok(js.includes('titleLibraryDelete(titleLookLibrary'));
assert.ok(js.includes('titleLibraryFind(titleLookLibrary'));
assert.ok(js.includes('titleLibraryReplace(titleLookLibrary,raw)'));
assert.ok(js.includes('titleLibrarySerialize(titleLookLibrary)'));
assert.ok(js.includes('if(file.size>TITLE_LIBRARY_MAX_BYTES)'));
assert.ok(js.includes('stagedTitlePlacement=titlePlacement(look)'));
assert.ok(js.includes('stagedTitleScale=titleScale(look)'));
assert.ok(js.includes('refreshPlacementUI();refreshTitleDeck();showTitleAt(playhead)'));
assert.ok(!js.includes("edit({type:'title.style.applied'"));
assert.ok(css.includes('.title-style-library'));
assert.ok(css.includes('.title-style-library-actions'));
console.log('ParaCut R8.8 PASS: local look library, versioned safe JSON, bounded import/export, no project mutation, cross-project reuse, ledgers and export.');
