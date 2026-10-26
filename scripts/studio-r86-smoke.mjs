import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,undo,redo,validate,exportDraft,importDraft} from '../apps/desktop/public/studio-core.js';
import {buildAss,planLocalMp4} from './studio-local-export-core.mjs';
import {titleAnchor,titlePlacement} from '../apps/desktop/public/studio-title-placement.js';
import {titleScale} from '../apps/desktop/public/studio-title-transform.js';
import {
  TITLE_ALIGNMENTS,TITLE_TRANSFORM_PRESETS,titleAlignmentPoint,titleAlignmentId,
  titleTransformPreset,titleTransformClipboard,titleClipboardFromTitle,
  titleClipboardFields,titleTransformReadout
} from '../apps/desktop/public/studio-title-align.js';

const freeze=object=>JSON.stringify(object);
assert.equal(TITLE_ALIGNMENTS.length,9);
assert.equal(new Set(TITLE_ALIGNMENTS.map(a=>a.id)).size,9);
assert.equal(TITLE_TRANSFORM_PRESETS.length,6);
assert.equal(new Set(TITLE_TRANSFORM_PRESETS.map(a=>a.id)).size,6);
const xy=[256,640,1024], yy=[144,360,576];
for(const [i,item] of TITLE_ALIGNMENTS.entries()){
  assert.deepEqual(titleAlignmentPoint(item.id),{x:xy[i%3],y:yy[Math.floor(i/3)]});
  assert.equal(titleAlignmentId({x:item.x,y:item.y}),item.id);
  assert.ok(item.x>=256&&item.x<=1024);
  assert.ok(item.y>=144&&item.y<=576);
}
assert.equal(titleAlignmentId(null),null);
assert.equal(titleAlignmentId({x:635,y:359}),null);
assert.throws(()=>titleAlignmentPoint('unsafe'),/Unknown title alignment/);
assert.throws(()=>titleAlignmentPoint({}),/Unknown title alignment/);
assert.throws(()=>titleAlignmentId({x:9999,y:360}),/position/);
for(const preset of TITLE_TRANSFORM_PRESETS){
  const state=titleTransformPreset(preset.id);
  assert.equal(titleAlignmentId(state.placement),preset.align);
  assert.equal(state.scale,preset.scale);
  assert.ok(Number.isInteger(state.scale));
  assert.deepEqual(titleClipboardFields(state),{
    title_x:state.placement.x,title_y:state.placement.y,
    ...(state.scale===100?{}:{title_scale:state.scale})
  });
}
assert.deepEqual(titleTransformPreset('hero'),{
  placement:{x:640,y:360},scale:150
});
assert.deepEqual(titleTransformPreset('lower-third'),{
  placement:{x:640,y:576},scale:100
});
assert.deepEqual(titleTransformPreset('chapter'),{
  placement:{x:640,y:144},scale:125
});
assert.throws(()=>titleTransformPreset('arbitrary'),/Unknown title transform preset/);

const custom=titleTransformClipboard({x:427,y:298},125);
assert.deepEqual(custom,{placement:{x:427,y:298},scale:125});
assert.deepEqual(titleClipboardFields(custom),{title_x:427,title_y:298,title_scale:125});
assert.equal(titleTransformReadout(custom.placement,125),
  'X 427 / Y 298 · 125% size · draft only');
assert.equal(titleTransformReadout({x:640,y:576},100),
  'Bottom Center · 100% size · draft only');
assert.equal(titleTransformReadout(null,100),
  'Anchor · 100% size · draft only');
const reference=freeze(custom);
const pasted=titleTransformClipboard(custom.placement,custom.scale);
pasted.placement.x=500;
assert.equal(freeze(custom),reference,'copied clipboard does not alias pending edits');
assert.deepEqual(titleClipboardFields(titleTransformClipboard(null,100)),{});
assert.deepEqual(titleClipboardFromTitle({text:'legacy'}),{
  placement:null,scale:100
});
assert.deepEqual(titleClipboardFromTitle({
  text:'previous title',position:'top',title_x:256,title_y:144,title_scale:85
}),{placement:{x:256,y:144},scale:85});
for(const bad of [
  [null,0],[{x:10000,y:360},100],[{x:640,y:360},101],
  [{x:640,y:null},100],[{x:'640',y:360},100]
])assert.throws(()=>titleTransformClipboard(...bad),/scale|position/);
assert.throws(()=>titleClipboardFromTitle(null),/Invalid title transform source/);
assert.throws(()=>titleClipboardFromTitle({title_x:600}),/supplied together/);
assert.throws(()=>titleClipboardFromTitle({title_x:null,title_y:360}),/position/);
assert.throws(()=>titleClipboardFields(null),/No copied/);
assert.throws(()=>titleClipboardFields({placement:{x:9999,y:360},scale:100}),/position/);
assert.throws(()=>titleClipboardFields({placement:null,scale:0}),/scale/);

const base={text:'FIELD CENTER',start:1,end:4,size:'medium',
  position:'middle',color:'mint',fade_in:.5,fade_out:.5,motion:'none'};
const oldAss=buildAss([base],5);
assert.equal((oldAss.match(/Dialogue:/g)||[]).length,1);
assert.ok(oldAss.includes('\\fs52'));
assert.equal(buildAss([{...base,...titleClipboardFields(
  titleTransformClipboard(null,100))}],5),oldAss);
const hero=titleTransformPreset('hero'),heroTitle={
  ...base,...titleClipboardFields(hero),text:'HEADLINE'
};
assert.deepEqual(titlePlacement(heroTitle),{x:640,y:360});
assert.equal(titleScale(heroTitle),150);
const heroAss=buildAss([heroTitle],5);
assert.ok(heroAss.includes('\\an5'));
assert.ok(heroAss.includes('\\pos(640,360)'));
assert.ok(heroAss.includes('\\fs78'));
const lowerThird=titleTransformPreset('lower-third');
const lowerAss=buildAss([{...base,...titleClipboardFields(lowerThird)}],5);
assert.ok(lowerAss.includes('\\pos(640,576)'));
assert.ok(lowerAss.includes('\\fs52'));

let state=newStudio('R8.6 layout and reuse');
state=change(state,{type:'asset.added',asset:{
  asset_id:'media',name:'media',type:'video/mp4',size:100,duration:6,lastModified:0
}});
state=change(state,{type:'clip.appended',asset_id:'media'});
const unchangedDraft=exportDraft(state),originalReceipts=state.receipts.length;
const copiedFromNew=titleTransformClipboard(custom.placement,custom.scale);
const stagedSave={...base,...titleClipboardFields(copiedFromNew)};
assert.equal(state.receipts.length,originalReceipts,'staging created no ledger receipts');
assert.equal(exportDraft(state),unchangedDraft,'staging cannot mutate project state');
state=change(state,{type:'title.added',title:stagedSave});
assert.equal(state.receipts.length,originalReceipts+1);
assert.equal(state.receipts.at(-1).action,'title.added');
assert.equal(validate(state),true);
assert.equal(state.titles[0].title_x,427);
assert.equal(state.titles[0].title_y,298);
assert.equal(state.titles[0].title_scale,125);
assert.deepEqual(undo(state).titles,[]);
assert.deepEqual(redo(undo(state)).titles,state.titles);
const titleOne=state.titles[0];
const shared=titleClipboardFromTitle(titleOne);
assert.deepEqual(shared,{placement:{x:427,y:298},scale:125});
const titleTwo={...base,text:'PASTED TITLE',start:4,end:5.5,
  ...titleClipboardFields(shared)};
state=change(state,{type:'title.added',title:titleTwo});
assert.equal(state.receipts.at(-1).action,'title.added');
assert.equal(state.receipts.length,originalReceipts+2);
assert.equal(state.titles[1].title_x,427);
assert.equal(state.titles[1].title_scale,125);
assert.deepEqual(importDraft(exportDraft(state)).titles,state.titles);
const plan=planLocalMp4(state,{media:{path:'/tmp/media.mp4',hasAudio:false}},'/tmp/r86.mp4');
assert.ok(plan.graph.includes('titles.ass'));
assert.equal((plan.ass.match(/\\pos\(427,298\)/g)||[]).length,2);
assert.equal((plan.ass.match(/\\fs65/g)||[]).length,2);
const secondId=state.titles[1].title_id;
state=change(state,{type:'title.updated',title_id:secondId,
  title:{...titleTwo,...titleClipboardFields(titleTransformPreset('chapter'))}});
assert.equal(state.receipts.at(-1).action,'title.updated');
assert.equal(state.titles[1].title_y,144);
assert.equal(state.titles[1].title_scale,125);
assert.equal(undo(state).titles[1].title_y,298);
assert.equal(redo(undo(state)).titles[1].title_y,144);
assert.equal(state.titles[0].title_y,298,'first title is unchanged');
const reset=change(state,{type:'title.updated',title_id:secondId,title:base});
assert.equal(titlePlacement(reset.titles[1]),null);
assert.equal(titleScale(reset.titles[1]),100);
assert.equal(buildAss([reset.titles[1]],5).includes('\\pos('),false);
assert.equal(buildAss([base],5),oldAss);
assert.deepEqual(titleAnchor(reset.titles[1]),{x:640,y:360});
assert.equal(importDraft(unchangedDraft).titles.length,0);

const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
assert.match(html,/R8\.(?:6 · ALIGN & REUSE|7 · MULTI-TITLE STUDIO|8 · TITLE STYLE LIBRARY|9 · REEL ORIGINALS)/);
for(const a of TITLE_ALIGNMENTS){
  assert.ok(html.includes('data-title-align="'+a.id+'"'));
}
for(const p of TITLE_TRANSFORM_PRESETS){
  assert.ok(html.includes('data-title-layout="'+p.id+'"'));
}
for(const id of ['title-align-grid','title-layout-presets','title-transform-copy',
  'title-transform-paste','title-layout-readout'])
  assert.ok(html.includes('id="'+id+'"'));
assert.match(html,/aria-label="Place title on nine safe-area anchors"/);
assert.match(html,/aria-label="Reusable title size and placement presets"/);
assert.match(html,/aria-live="polite"/);
assert.match(js,/stageTitleTransform\(titleAlignmentPoint\(option\.id\),stagedTitleScale\)/);
assert.match(js,/stageTitleTransform\(staged\.placement,staged\.scale\)/);
assert.match(js,/copiedTitleTransform=titleTransformClipboard\(stagedTitlePlacement,stagedTitleScale\)/);
assert.match(js,/stageTitleTransform\(copiedTitleTransform\.placement,copiedTitleTransform\.scale\)/);
assert.match(js,/titleAlignmentId\(stagedTitlePlacement\)/);
assert.match(js,/titleTransformReadout\(stagedTitlePlacement,stagedTitleScale\)/);
assert.ok(js.includes('...titlePlacementFields(stagedTitlePlacement)'));
assert.ok(js.includes('...titleScaleFields(stagedTitleScale)'));
assert.ok(css.includes('.title-align-grid'));
assert.ok(css.includes('.title-layout-presets'));
assert.ok(css.includes('button[aria-pressed="true"]'));
console.log('ParaCut R8.6 PASS: nine alignments, six reusable layouts, safe transform copy/paste, ledger Undo/Redo, draft import, ASS parity and accessible UI.');
