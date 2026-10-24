import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newStudio,change,undo,redo,validate,exportDraft,importDraft}
 from '../apps/desktop/public/studio-core.js';
import {
  planBezierExportSegments,bezierExportDecisionStats,approximateBezierExportAt,
  keyframeCurveExpression,keyframeCurveAt,BEZIER_EXPORT_MAX_SEGMENTS
} from '../apps/desktop/public/studio-keyframe-points.js';
import {buildLabDraft,parseLabOptions,LAB_SCENARIOS,LAB_DEFAULT_SCENARIOS}
 from './studio-export-lab-core.mjs';
import {planLocalMp4} from './studio-local-export-core.mjs';
import {graphDiagnostics} from './studio-export-benchmark.mjs';

// Tests evaluate only expressions generated internally from fixed, validated
// numeric fixtures. This test-only evaluator is not exposed to input/media.
function compileGeneratedExpression(expr,variable='T'){
  assert.match(expr,/^[a-zA-Z0-9_+\-*/().,\s]+$/);
  const text=expr.replace(/\bif\(/g,'choose(');
  const fn=new Function('T','t','choose','lt','min','max',
    'return ('+text+');');
  return (seconds)=>fn(variable==='T'?seconds:0,variable==='t'?seconds:0,
    (condition,yes,no)=>condition?yes:no,
    (a,b)=>a<b?1:0,Math.min,Math.max);
}
function oldScan(points,u){
  if(u>=1)return 1;
  const pos=Math.max(0,Math.min(1,u));
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1];
    if(pos<b.x){
      return a.y+(b.y-a.y)*(pos-a.x)/(b.x-a.x);
    }
  }
  return 1;
}
const cases=[
  {y:[.25,.75],x:[.15,.76]},
  {y:[1,0],x:[0,1]},
  {y:[1,0],x:[0,0]},
  {y:[0,1],x:[1,1]},
  {y:[.2,.8],x:[.8,.95]},
  {y:[0,0],x:[.5,.5]},
  {y:[1,1],x:[.001,.001]},
  {y:[0,1],x:[0,1]}
];
let largestPieces=0;
for(const {y,x} of cases){
  const curve=[{at:0,value:0,ease:'bezier',handles:y,handles_x:x},
    {at:1,value:1}];
  const plan=planBezierExportSegments(y,x);
  const stats=bezierExportDecisionStats(y,x);
  assert.equal(stats.pieces,plan.segments);
  assert.equal(stats.linearWorstCaseComparisons,plan.segments);
  assert.equal(stats.balancedWorstCaseComparisons,
    Math.ceil(Math.log2(plan.segments)));
  assert.ok(stats.balancedWorstCaseComparisons<=6);
  largestPieces=Math.max(largestPieces,stats.pieces);
  const expr=keyframeCurveExpression(curve,4,'T');
  const evaluate=compileGeneratedExpression(expr);
  const internalTests=[0,4];
  for(const node of plan.points){
    internalTests.push(node.x*4,
      Math.max(0,(node.x-1e-9)*4),
      Math.min(4,(node.x+1e-9)*4));
  }
  for(let i=0;i<=1000;i++)internalTests.push(i*4/1000);
  for(const second of internalTests){
    const u=second/4;
    const actual=evaluate(second);
    const prior=oldScan(plan.points,u);
    assert.ok(Number.isFinite(actual),
      'No NaNs/Infinities in compiled expression.');
    assert.ok(Math.abs(actual-prior)<.00002,
      'R7.7 decision tree changed R7.3 fitted curve at '+u+
      ': '+actual+' vs '+prior);
    const againstPreview=keyframeCurveAt(curve,u);
    assert.ok(Math.abs(actual-againstPreview)<.012,
      'Approximation drift exceeded existing quality envelope.');
    assert.ok(actual>=-0.00002&&actual<=1.00002);
  }
  assert.ok(expr.length<30000);
  assert.ok(expr.includes('if(lt(')||plan.segments===1);
  assert.ok(Math.abs(approximateBezierExportAt(plan,.5)-
    oldScan(plan.points,.5))<1e-8);
}
assert.ok(largestPieces>=32,'Ensure worst-case examples exercise deep lookup.');
for(const bad of [
 [[.1,.8],[.9,.1]],[[NaN,.7],[.2,.6]],
 [[.3,1],[0,2]],[[],[]]
])assert.throws(()=>bezierExportDecisionStats(...bad),/Invalid Bézier/);

// Old fixed-X polynomial and preset easing are unchanged by the new compiler.
for(const points of [
  [{at:0,value:.1,ease:'bezier',handles:[.3,.85]},{at:1,value:.9}],
  [{at:0,value:.1,ease:'ease-in'},{at:1,value:.9}],
  [{at:0,value:0},{at:.5,value:.8,ease:'ease-out'},{at:1,value:1}]
]){
  for(const variable of ['t','T']){
    const evaluate=compileGeneratedExpression(
      keyframeCurveExpression(points,4,variable),variable);
    for(let i=0;i<=100;i++){
      const at=i/100;
      assert.ok(Math.abs(evaluate(at*4)-keyframeCurveAt(points,at))<.00001);
    }
  }
}
// Multipoint mixed Bézier intervals remain serialized and receipt-backed.
const stress=parseLabOptions(['--scenarios','v2-bezier-stress']);
assert.deepEqual(stress.scenarios,['v2-bezier-stress']);
assert.ok(LAB_SCENARIOS.includes('v2-bezier-stress'));
assert.deepEqual(parseLabOptions([]).scenarios,LAB_DEFAULT_SCENARIOS);
assert.equal(LAB_DEFAULT_SCENARIOS.length,4);
const draft=buildLabDraft({
 duration:3,scenario:'v2-bezier-stress',mainBytes:500,overlayBytes:200});
const loaded=importDraft(draft);
assert.equal(validate(loaded),true);
const points=loaded.video2Clips[0].opacity_keyframe_points;
assert.equal(points.length,5);
assert.equal(points.filter(p=>p.handles_x).length,4);
assert.deepEqual(importDraft(exportDraft(loaded)).video2Clips[0].opacity_keyframe_points,points);
const linked=Object.fromEntries(loaded.assets.map(a=>[a.asset_id,{
 path:'/tmp/'+a.name,hasAudio:a.asset_id==='lab-main'
}]));
const plan=planLocalMp4(loaded,linked,'/tmp/r77-stress.mp4');
assert.match(plan.graph,/geq=r=r\(X\\,Y\)/);
const diag=graphDiagnostics(loaded,plan.graph);
assert.equal(diag.customXSegments,4);
assert.ok(diag.optimizedPieces>4);
assert.ok(diag.optimizedPieces<=4*BEZIER_EXPORT_MAX_SEGMENTS);
assert.ok(diag.filterGraphChars>3000);

let state=newStudio('R7.7 regression');
for(const item of [
 {asset_id:'main',name:'main',type:'video/mp4',duration:3,size:100,lastModified:0},
 {asset_id:'overlay',name:'overlay',type:'video/mp4',duration:3,size:100,lastModified:0}
])state=change(state,{type:'asset.added',asset:item});
state=change(state,{type:'clip.appended',asset_id:'main'});
state=change(state,{type:'clip.layer.added',asset_id:'overlay',
 track_id:'video-2',start:0});
const id=state.video2Clips[0].clip_id,initial=exportDraft(state);
state=change(state,{type:'clip.keyframe.points.updated',clip_id:id,
 field:'opacity_keyframes',points});
assert.equal(validate(state),true);
assert.deepEqual(undo(state).video2Clips[0].opacity_keyframe_points,undefined);
assert.deepEqual(redo(undo(state)).video2Clips[0].opacity_keyframe_points,points);
assert.deepEqual(importDraft(exportDraft(state)).video2Clips[0].opacity_keyframe_points,points);
assert.equal(importDraft(initial).video2Clips[0].opacity_keyframe_points,undefined);
const body=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
assert.match(body,/R7\.(?:7 · BALANCED BÉZIER|8 · CONTROLLED A\/B|9 · EXPORT DIAGNOSTICS)|R8\.(?:0 · CREATIVE TITLE DECK|1 · TITLE TIMING LAB|2 · TITLE MOTION|3 · MOTION CURVES|4 · DIRECT TITLE PLACEMENT)/);
console.log('ParaCut R7.7 PASS: balanced FFmpeg expression parity to prior samples, logarithmic decision bounds, multipoint lab and old draft/receipt invariants.');
