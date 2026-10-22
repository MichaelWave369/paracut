import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,exportDraft,importDraft,undo,redo,validate}
  from '../apps/desktop/public/studio-core.js';
import {EFFECTS_SECTIONS,EFFECTS_DEFAULTS,EFFECTS_STORAGE_KEY,
  validateEffectsView,readEffectsView,writeEffectsView,setEffectsSection,
  allEffectsSections,effectsVisibility,effectsSummaries}
  from '../apps/desktop/public/studio-effects-layout.js';
import {planLocalMp4} from './studio-local-export-core.mjs';

assert.deepEqual(EFFECTS_SECTIONS,
 ['timing','motion','opacity','color','audio','attributes','metadata']);
assert.equal(EFFECTS_SECTIONS.length,new Set(EFFECTS_SECTIONS).size);
assert.deepEqual(validateEffectsView({}),EFFECTS_DEFAULTS);
assert.equal(Object.keys(EFFECTS_DEFAULTS).length,EFFECTS_SECTIONS.length);
assert.deepEqual(validateEffectsView({color:false}),{...EFFECTS_DEFAULTS,color:false});
assert.throws(()=>validateEffectsView(null),/Invalid effects panel/);
assert.throws(()=>validateEffectsView([]),/Invalid effects panel/);
assert.throws(()=>validateEffectsView({color:'false'}),/Invalid color section/);
assert.throws(()=>validateEffectsView({__proto__:null,script:true}),/Invalid effects panel/);
assert.throws(()=>setEffectsSection(EFFECTS_DEFAULTS,'arbitrary',true),/Invalid effects section/);
assert.throws(()=>setEffectsSection(EFFECTS_DEFAULTS,'color','yes'),/Invalid effects section/);
assert.throws(()=>allEffectsSections(1),/Invalid effects section/);
const modified=setEffectsSection(EFFECTS_DEFAULTS,'color',false);
assert.equal(modified.color,false);
assert.equal(EFFECTS_DEFAULTS.color,true); // never mutate template object
assert.deepEqual(allEffectsSections(true),
 Object.fromEntries(EFFECTS_SECTIONS.map(k=>[k,true])));
assert.deepEqual(allEffectsSections(false),
 Object.fromEntries(EFFECTS_SECTIONS.map(k=>[k,false])));

const values=new Map();
const storage={getItem:key=>values.get(key)??null,
 setItem:(key,value)=>values.set(key,value)};
assert.deepEqual(readEffectsView(storage),EFFECTS_DEFAULTS);
assert.equal(writeEffectsView(storage,modified),true);
assert.equal(values.has(EFFECTS_STORAGE_KEY),true);
assert.deepEqual(readEffectsView(storage),modified);
values.set(EFFECTS_STORAGE_KEY,'{bad');
assert.deepEqual(readEffectsView(storage),EFFECTS_DEFAULTS);
values.set(EFFECTS_STORAGE_KEY,JSON.stringify({color:false,onclick:'execute'}));
assert.deepEqual(readEffectsView(storage),EFFECTS_DEFAULTS);
const blocked={getItem(){throw Error('Storage denied')},setItem(){throw Error('Storage denied')}};
assert.deepEqual(readEffectsView(blocked),EFFECTS_DEFAULTS);
assert.equal(writeEffectsView(blocked,modified),false);

const mk=(id,type,duration)=>({asset_id:id,name:id,type,duration,
 size:100,lastModified:0});
let s=newStudio('R6.6 Effects Controls');
for(const a of [mk('video','video/mp4',6),mk('overlay','video/mp4',3),
 mk('audio','audio/wav',6)])s=change(s,{type:'asset.added',asset:a});
for(const asset_id of ['video','audio'])s=change(s,{type:'clip.appended',asset_id});
s=change(s,{type:'clip.layer.added',asset_id:'overlay',track_id:'video-2',start:1});
const clip=s.clips[0],layer=s.video2Clips[0],audio=s.audioClips[0];
assert.deepEqual(effectsVisibility(null),{
 timing:false,motion:false,opacity:false,color:false,audio:false,
 attributes:false,metadata:false});
assert.deepEqual(effectsVisibility(clip),{
 timing:true,motion:false,opacity:false,color:true,audio:true,
 attributes:true,metadata:true});
assert.deepEqual(effectsVisibility(layer),{
 timing:true,motion:true,opacity:true,color:true,audio:true,
 attributes:true,metadata:true});
assert.deepEqual(effectsVisibility(audio),{
 timing:true,motion:false,opacity:false,color:false,audio:true,
 attributes:false,metadata:true});
assert.equal(effectsSummaries(clip).color,'Neutral');
assert.equal(effectsSummaries(clip).timing,'Source 6.00s');
assert.equal(effectsSummaries(layer).opacity,'100%');
assert.match(effectsSummaries(layer).motion,/PiP/);
const original=exportDraft(s);
const linked=Object.fromEntries(s.assets.map(a=>[a.asset_id,{path:'/tmp/'+a.name,
 hasAudio:a.type.startsWith('audio/')}]));
const originalPlan=planLocalMp4(s,linked,'/tmp/r66.mp4');
const receiptCount=s.receipts.length;
writeEffectsView(storage,allEffectsSections(false));
assert.equal(exportDraft(s),original);
assert.equal(s.receipts.length,receiptCount);
s=change(s,{type:'clip.color.updated',clip_id:clip.clip_id,color:{
 brightness:1.15,contrast:1.2,saturation:.75,warmth:20
}});
s=change(s,{type:'clip.overlay.updated',clip_id:layer.clip_id,
 layout:'full',opacity:.7,motion:'rise',fade_in:.3,fade_out:.3});
assert.equal(effectsSummaries(s.clips[0]).color,'Adjusted');
assert.equal(effectsSummaries(s.video2Clips[0]).opacity,'70%');
assert.match(effectsSummaries(s.video2Clips[0]).motion,/Full · rise/);
assert.equal(undo(s).video2Clips[0].overlay_opacity,1);
assert.equal(redo(undo(s)).video2Clips[0].overlay_opacity,.7);
assert.deepEqual(importDraft(exportDraft(s)).video2Clips[0].overlay_opacity,.7);
assert.equal(validate(s),true);
assert.equal(originalPlan.graph,planLocalMp4(importDraft(original),linked,'/tmp/r66.mp4').graph);
assert.equal(exportDraft(s).includes(EFFECTS_STORAGE_KEY),false);

const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
for(const key of EFFECTS_SECTIONS) {
 assert.match(html,new RegExp('id="effects-'+key+'"'));
 assert.match(html,new RegExp('id="effects-'+key+'-summary"'));
 assert.match(html,new RegExp('data-effects-section="'+key+'"'));
}
assert.equal((html.match(/data-effects-section=/g)||[]).length,EFFECTS_SECTIONS.length);
assert.equal((html.match(/class="effects-section-name"/g)||[]).length,EFFECTS_SECTIONS.length);
for(const id of ['effects-expand-all','effects-collapse-all','effects-view-status',
 'overlay-layout','overlay-opacity','overlay-motion','overlay-fade-in','overlay-fade-out',
 'apply-overlay-style','crossfade-seconds','v2-dissolve-seconds','source-audio-control',
 'apply-clip-color','apply-audio','selected-meta','selected-name']){
 assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
}
const timing=html.indexOf('id="effects-timing"');
const motion=html.indexOf('id="effects-motion"');
const opacity=html.indexOf('id="effects-opacity"');
const color=html.indexOf('id="effects-color"');
const audioSectionIndex=html.indexOf('id="effects-audio"');
assert.ok(timing<motion&&motion<opacity&&opacity<color&&color<audioSectionIndex);
assert.match(js,/readEffectsView\(effectsStorage\(\)\)/);
assert.match(js,/writeEffectsView\(effectsStorage\(\),effectsView\)/);
assert.match(js,/setEffectsSection\(effectsView,name,el\.open\)/);
assert.match(js,/allEffectsSections\(open\)/);
assert.match(js,/refreshEffectsSections\(clip\)/);
assert.match(js,/effectsVisibility\(clip\)/);
assert.match(js,/effectsSummaries\(clip\)/);
assert.match(js,/setEffectsSection\(effectsView,'color',true\)/);
assert.match(css,/\.effects-section\[hidden\]/);
assert.match(css,/\.effects-section>summary:focus-visible/);
console.log('ParaCut R6.6 PASS: seven native effects accordions, local-only preferences, clip-context visibility, untouched edit actions/drafts and MP4 behavior.');
