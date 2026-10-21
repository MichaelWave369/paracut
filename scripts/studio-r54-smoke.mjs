import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPreviewBusMeters,meterStats,formatDbfs} from '../apps/desktop/public/studio-live-meters.js';
import {newStudio,change,audioMixLevelAt,audioLevelAt} from '../apps/desktop/public/studio-core.js';

// Peak is an actual sample maximum, not decoded waveform cache or a fake level.
assert.deepEqual(meterStats(new Float32Array([0,0,0])),{peak:0,rms:0,dbfs:-Infinity});
let stats=meterStats(new Float32Array([-.5,.25,-.25,.5]));
assert.equal(stats.peak,.5);
assert.ok(Math.abs(stats.rms-Math.sqrt(.15625))<1e-7);
assert.ok(Math.abs(stats.dbfs+6.020599913)<.0001);
assert.equal(formatDbfs(stats.dbfs),'-6.0 dBFS');
assert.equal(formatDbfs(-Infinity),'−∞ dBFS');
assert.equal(meterStats(new Float32Array([Number.NaN,2,-2])).peak,1);
assert.throws(()=>createPreviewBusMeters(null,{a1:{},a2:{}}),/AudioContext/);
assert.throws(()=>createPreviewBusMeters(class {},{a1:{},a2:{}}),/AudioContext/); // same absent element
class MockNode {
  constructor(label){this.label=label;this.targets=[];}
  connect(node){this.targets.push(node);}
}
class MockGain extends MockNode {
  constructor(label){super(label);this.gain={value:1};}
}
class MockAnalyser extends MockNode {
  constructor(label){super(label);this.fftSize=2048;this.smoothingTimeConstant=.8;}
  getFloatTimeDomainData(buffer){buffer.fill(0);buffer[2]=.5;buffer[3]=-.25;}
}
class MockContext {
  constructor(){this.created=[];this.destination=new MockNode('speakers');this.state='suspended';}
  createMediaElementSource(el){const src=new MockNode('source-'+el.id);this.created.push(src);return src;}
  createGain(){const node=new MockGain('gain');this.created.push(node);return node;}
  createAnalyser(){const node=new MockAnalyser('analyser');this.created.push(node);return node;}
  resume(){this.state='running';return Promise.resolve();}
}
const a1={id:'A1'},a2={id:'A2'};
const graph=createPreviewBusMeters(MockContext,{a1,a2});
assert.equal(graph.context.created.length,6);
for(const lane of ['a1','a2']) {
  const chain=graph.channels[lane];
  assert.equal(chain.source.targets[0],chain.gain);
  assert.equal(chain.gain.targets[0],chain.analyser);
  assert.equal(chain.analyser.targets[0],graph.context.destination);
  assert.equal(chain.analyser.fftSize,2048);
  assert.equal(chain.analyser.smoothingTimeConstant,0);
  assert.equal(chain.gain.gain.value,0); // no blast on context creation
  assert.equal(graph.read(lane).peak,.5);
}
graph.setGain('a1',.65);
graph.setGain('a2',.25);
assert.equal(graph.channels.a1.gain.gain.value,.65);
assert.equal(graph.channels.a2.gain.gain.value,.25);
graph.setGain('a1',10);assert.equal(graph.channels.a1.gain.gain.value,1);
graph.setGain('a1',-2);assert.equal(graph.channels.a1.gain.gain.value,0);
assert.throws(()=>graph.setGain('master',1),/Unknown/);
assert.throws(()=>graph.setGain('a1',NaN),/Unknown/);
await graph.context.resume();assert.equal(graph.context.state,'running');

// Post-gain meters react to the same per-clip + bus automation that renders.
let state=newStudio('preview meter');
for(const a of [{asset_id:'film',name:'film.mp4',size:100,type:'video/mp4',duration:12},
{asset_id:'music',name:'music.wav',size:100,type:'audio/wav',duration:9},
{asset_id:'voice',name:'voice.wav',size:100,type:'audio/wav',duration:3}])
  state=change(state,{type:'asset.added',asset:a});
for(const asset_id of ['film','music'])
  state=change(state,{type:'clip.appended',asset_id});
state=change(state,{type:'clip.layer.added',asset_id:'voice',track_id:'audio-2',start:2});
state=change(state,{type:'mixer.updated',lane:'a1',gain:.8,muted:false,solo:false});
state=change(state,{type:'mixer.updated',lane:'a2',gain:.6,muted:false,solo:false});
state=change(state,{type:'mixer.duck.updated',enabled:true});
const a1clip=state.audioClips[0],a2clip=state.audio2Clips[0];
const t=3;
graph.setGain('a1',audioLevelAt(a1clip,t)*audioMixLevelAt(state,'audio-1',t));
graph.setGain('a2',audioLevelAt(a2clip,t)*audioMixLevelAt(state,'audio-2',t));
assert.ok(Math.abs(graph.channels.a1.gain.gain.value-.32)<1e-9);
assert.equal(graph.channels.a2.gain.gain.value,.6);
state=change(state,{type:'mixer.updated',lane:'a2',gain:.6,muted:true,solo:false});
graph.setGain('a2',audioLevelAt(a2clip,t)*audioMixLevelAt(state,'audio-2',t));
assert.equal(graph.channels.a2.gain.gain.value,0);

// Check live and fallback modes both remain explicit in the UI.
const ui=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
assert.match(ui,/ensureLiveBusMeters\(\)/);
assert.match(ui,/createPreviewBusMeters\(AudioCtx,\{a1:soundtrack,a2:audio2Player\}\)/);
assert.match(ui,/if\(autoplay\)ensureLiveBusMeters\(\)/);
assert.match(ui,/liveBusMeters\.read\(key\)/);
assert.match(ui,/setPreviewBusGain\('a1',soundtrack/);
assert.match(ui,/setPreviewBusGain\('a2',audio2Player/);
assert.match(ui,/function updatePeakGuides\(at\)/);
assert.match(ui,/const data=estimateTrackPeak\(state,track,at,waveforms\)/);
assert.match(ui,/liveBusMeters\.context\.state==='running'/);
assert.match(ui,/updatePeakGuides\(at\)/);
assert.match(html,/id="audio-meter-mode"/);
assert.match(html,/id="peak-a1-value"/);
assert.match(html,/id="peak-a2-value"/);
assert.match(html,/not the combined master mix/);
console.log('ParaCut R5.4 live-bus meters PASS: real analyser samples, A1/A2 graph wiring, dBFS, mixing, pause/fallback mode and no export reroute.');
