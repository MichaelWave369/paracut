import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
const inspector=js.slice(js.indexOf('function drawInspector()'),js.indexOf('function drawReceipts()'));
assert.ok(inspector.includes("$(property+'-keyframe-editor').hidden=!allowed;"),
  'Inspector must look up DOM IDs defined by HTML, not reversed keyframe-X-editor');
assert.ok(!inspector.includes("'keyframe-'+property+'-editor'"));
for(const property of ['opacity','volume']){
  const panel=property+'-keyframe-editor';
  assert.ok(ids.has(panel),panel+' missing from HTML');
  for(const end of ['start','end'])
    assert.ok(ids.has('keyframe-'+property+'-'+end),'Missing '+property+' input');
  for(const action of ['apply','clear'])
    assert.ok(ids.has(action+'-'+property+'-keyframes'),'Missing '+property+' action');
}
const exportBody=js.slice(js.indexOf('async function renderVideo(format)'),
  js.indexOf("$('export-webm').addEventListener"));
const start=exportBody.indexOf('exporting=true;');
const tryStart=exportBody.indexOf('  try {\n    // UI refresh must be inside');
const redraw=exportBody.indexOf('    render();\n    const canvas',tryStart);
const catchStart=exportBody.indexOf("} catch(err) { status('Export: '+err.message,true); }");
const finallyStart=exportBody.indexOf('  finally {',catchStart);
const reset=exportBody.indexOf('exporting=false;activeExportFormat=null;cancelExport=false;',finallyStart);
assert.ok(start>=0&&tryStart>start&&redraw>tryStart&&redraw<catchStart,
  'First redraw must occur inside guarded try/catch, after exporting is activated');
assert.ok(finallyStart>catchStart&&reset>finallyStart,
  'Export lifecycle must reset flags in finally after a render error');
assert.ok(!exportBody.slice(start,tryStart).includes('  render();'),
  'No unguarded redraw may exist between starting and entering try');
console.log('ParaCut selected-clip inspector DOM IDs + guarded export lifecycle PASS');
