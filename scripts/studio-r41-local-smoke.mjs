import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newStudio, change, exportDraft, importDraft } from '../apps/desktop/public/studio-core.js';
import { planLocalMp4, buildAss } from './studio-local-export-core.mjs';
const mk=(asset_id,type,duration)=>({asset_id,name:asset_id+(type.startsWith('audio/')?'.wav':'.mp4'),
  type,size:150,lastModified:1,duration});
let state=newStudio('Two scenes + music');
for(const asset of [mk('first','video/mp4',3),mk('second','video/mp4',4),
  mk('music','audio/wav',7)])state=change(state,{type:'asset.added',asset});
for(const asset_id of ['first','second','music'])state=change(state,{type:'clip.appended',asset_id});
state=change(state,{type:'clip.transition.updated',clip_id:state.clips[0].clip_id,seconds:.5});
state=change(state,{type:'clip.source-audio.muted',clip_id:state.clips[0].clip_id,muted:true});
state=change(state,{type:'clip.audio.updated',clip_id:state.audioClips[0].clip_id,
  volume:.75,fade_in:1,fade_out:1});
state=change(state,{type:'title.added',title:{text:'Enter {the} \\ Field',start:1,end:3,
  position:'top',size:'large',color:'mint',fade_in:.5,fade_out:.5}});
const clean=importDraft(exportDraft(state));
const map={first:{path:'/example/red.mp4',hasAudio:true},
  second:{path:'/example/blue.mp4',hasAudio:false},
  music:{path:'/example/music.wav',hasAudio:true}};
const plan=planLocalMp4(clean,map,'/example/done.mp4');
assert.equal(plan.duration,6.5);
assert.equal(plan.videoClips,2);
assert.equal(plan.transitions,1);
assert.equal(plan.audioSegments,1); // original muted, second silent
assert.match(plan.graph,/xfade=transition=fade:duration=0.5:offset=2.5/);
assert.match(plan.graph,/ass=filename=titles.ass/);
assert.match(plan.graph,/volume=0.75/);
assert.match(plan.graph,/afade=t=in:st=0:d=1/);
assert.match(plan.graph,/amix=inputs=1/);
assert.match(plan.graph,/adelay=0:all=1/);
assert.ok(plan.ass.includes('\\an8\\fs74\\c&HDFF087&')); // fixed ASS syntax
assert.match(plan.ass,/Enter ｛the｝ ＼ Field/);
assert.ok(!plan.ass.includes('{the}'));
assert.ok(plan.args.includes('libx264'));
assert.ok(plan.args.includes('aac'));
assert.ok(plan.args.includes('-n'));
assert.ok(!plan.args.some(s=>s.includes(';rm -rf')));
assert.throws(()=>planLocalMp4(clean,{},'/example/done.mp4'),/Source media not relinked/);
assert.throws(()=>planLocalMp4(clean,map,'/example/done.webm'),/end in .mp4/);
const hard=change(state,{type:'clip.transition.updated',clip_id:state.clips[0].clip_id,seconds:0});
const noTitles=change(hard,{type:'title.deleted',title_id:hard.titles[0].title_id});
const simple=planLocalMp4(noTitles,map,'/tmp/x.mp4');
assert.match(simple.graph,/concat=n=2/);
assert.match(simple.graph,/null\[vout\]/);
assert.equal(simple.ass,null);
assert.equal(buildAss([{text:'Hello',start:1,end:2}],3).includes('Dialogue:'),true);
const cli=readFileSync(new URL('./studio-export-local.mjs',import.meta.url),'utf8');
assert.match(cli,/spawn\(plan.ffmpeg,plan.args,\{cwd:working,stdio:'inherit',shell:false/);
assert.match(cli,/Output already exists: refusing overwrite/);
assert.match(cli,/Media byte-size mismatch/);
assert.match(cli,/Verified local MP4/);
console.log('ParaCut R4.1 local export planner: PASS (real transition graph, source mute, audio fades, titles, safety, draft compatibility).');
