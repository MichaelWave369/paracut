import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newStudio, change, undo, redo, exportDraft, importDraft, titleStyle,
  titleOpacityAt, visibleTitle, validate } from '../apps/desktop/public/studio-core.js';

let s = newStudio('Title Designer');
const classic = { text:'Enter the Field',start:1,end:5 };
s=change(s,{type:'title.added',title:classic});
assert.deepEqual(titleStyle(s.titles[0]), {
  position:'bottom',size:'medium',color:'white',fade_in:0,fade_out:0
});
assert.equal(titleOpacityAt(s.titles[0],0),0);
assert.equal(titleOpacityAt(s.titles[0],2),1);
const id=s.titles[0].title_id;
s=change(s,{type:'title.updated',title_id:id,title:{
  text:'PARACUT', start:2,end:8,position:'top',size:'large',
  color:'mint',fade_in:1,fade_out:2
}});
assert.equal(s.titles[0].title_id,id);
assert.equal(s.titles[0].position,'top');
assert.equal(s.titles[0].color,'mint');
assert.equal(s.titles[0].text,'PARACUT');
assert.equal(titleOpacityAt(s.titles[0],2),0);
assert.equal(titleOpacityAt(s.titles[0],2.5),.5);
assert.equal(titleOpacityAt(s.titles[0],4),1);
assert.equal(titleOpacityAt(s.titles[0],7),.5);
assert.equal(titleOpacityAt(s.titles[0],8),0);
assert.equal(visibleTitle(s,3).title_id,id);
assert.equal(s.receipts.at(-1).action,'title.updated');
assert.equal(undo(s).titles[0].text,'Enter the Field');
assert.equal(redo(undo(s)).titles[0].color,'mint');
assert.equal(importDraft(exportDraft(s)).titles[0].fade_out,2);
const legacy=JSON.parse(exportDraft(s));
delete legacy.titles[0].position;delete legacy.titles[0].size;
delete legacy.titles[0].color;delete legacy.titles[0].fade_in;delete legacy.titles[0].fade_out;
const back=importDraft(JSON.stringify(legacy));
assert.deepEqual(titleStyle(back.titles[0]),titleStyle({}));
assert.equal(validate(back),true);

function invalid(edit,pattern=/Invalid title style/) {
  assert.throws(()=>change(s,{type:'title.updated',title_id:id,title:{...s.titles[0],...edit}}),pattern);
}
invalid({color:'url(javascript:alert(1))'});
invalid({position:'left'});
invalid({size:'huge'});
invalid({fade_in:4,fade_out:3});
invalid({fade_out:-1});
invalid({fade_in:NaN});
assert.throws(()=>change(s,{type:'title.updated',title_id:'missing',title:s.titles[0]}),/Title not found/);
assert.throws(()=>change(s,{type:'title.added',title:{text:' ',start:0,end:3}}),/Title requires/);
const poisoned=JSON.parse(exportDraft(s));
poisoned.titles[0].color='red'; // only the approved palette is accepted
assert.throws(()=>importDraft(JSON.stringify(poisoned)),/Invalid title style/);
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const ui=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
for (const id of ['title-position','title-size','title-color','title-fade-in','title-fade-out',
  'cancel-title-edit','add-title','title-preview']) assert.ok(html.includes('id="'+id+'"'),id);
assert.match(ui,/node\.dataset\.position = style\.position/);
assert.match(ui,/node\.style\.opacity = String\(titleOpacityAt\(title, at\)\)/);
assert.match(ui,/ctx\.globalAlpha = opacity/);
assert.match(ui,/drawTitleOnCanvas\(g, visibleTitle\(state,at\), at\)/);
assert.match(ui,/node\.textContent = title\?\.text/);
console.log('ParaCut Studio R3.1 title designer smoke: PASS (style presets, animation, edit receipts, undo, v3 legacy compatibility, unsafe styles).');
