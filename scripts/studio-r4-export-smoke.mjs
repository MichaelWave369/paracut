import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MIME_CANDIDATES, findRecorderMime, expectedMime, recorderOutputFormat,
  sniffContainer, checkExportContainer } from '../apps/desktop/public/studio-export-format.js';

const fakeRecorder = (formats) => ({ isTypeSupported: mime => formats.includes(mime) });
assert.equal(MIME_CANDIDATES.mp4.length >= 3,true);
assert.equal(findRecorderMime('mp4',fakeRecorder(['video/mp4'])), 'video/mp4');
assert.equal(findRecorderMime('webm',fakeRecorder(['video/webm'])), 'video/webm');
assert.equal(findRecorderMime('mp4',fakeRecorder(['video/webm'])),null);
assert.equal(findRecorderMime('mov',fakeRecorder(['video/mp4'])),null);
assert.equal(findRecorderMime('mp4',{isTypeSupported(){throw Error('unsupported');}}),null);
assert.equal(expectedMime('mp4'),'video/mp4');
assert.equal(expectedMime('webm'),'video/webm');
assert.throws(()=>expectedMime('avi'),/Unknown export/);
assert.equal(recorderOutputFormat('mp4','video/mp4;codecs=avc1.42E01E'),'video/mp4');
assert.equal(recorderOutputFormat('webm','video/webm;codecs=vp8,opus'),'video/webm');
assert.throws(()=>recorderOutputFormat('mp4','video/webm'),/Browser returned/);
assert.throws(()=>recorderOutputFormat('webm','video/mp4'),/Browser returned/);

const mp4Start = Uint8Array.from([
  0,0,0,24, 0x66,0x74,0x79,0x70, 0x69,0x73,0x6f,0x6d,
  0,0,0,1,0,0,0,0,0x69,0x73,0x6f,0x6d
]);
const webmStart = Uint8Array.from([
  0x1a,0x45,0xdf,0xa3,0x9f,0x42,0x86,0x81,0x01,
  0x42,0xf7,0x81,0x01,0x42,0xf2,0x81,0x04
]);
const mp4 = new Blob([mp4Start,new Uint8Array(2048)],{type:'video/mp4'});
const webm = new Blob([webmStart,new Uint8Array(2048)],{type:'video/webm'});
assert.equal(await sniffContainer(mp4),'mp4');
assert.equal(await sniffContainer(webm),'webm');
assert.equal(await checkExportContainer(mp4,'mp4'),true);
assert.equal(await checkExportContainer(webm,'webm'),true);
await assert.rejects(()=>checkExportContainer(webm,'mp4'),/detected WEBM/);
await assert.rejects(()=>checkExportContainer(mp4,'webm'),/detected MP4/);
assert.equal(await sniffContainer(new Blob([new Uint8Array(2000)],{type:'video/mp4'})),null);
// MIME labels are untrusted. The header check rejects a fake .mp4.
await assert.rejects(()=>checkExportContainer(new Blob([webmStart,new Uint8Array(2000)],{
  type:'video/mp4'
}),'mp4'),/container check failed/);
const malformed = new Uint8Array(mp4Start); malformed[3]=4; // invalid ftyp box length
assert.equal(await sniffContainer(new Blob([malformed,new Uint8Array(2000)])),null);

const ui = readFileSync(new URL('../apps/desktop/public/studio.js', import.meta.url),'utf8');
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
assert.match(html,/id="export-mp4"/);
assert.match(html,/id="export-webm"/);
assert.match(html,/id="mp4-support"/);
assert.match(ui,/findRecorderMime\(format\)/);
assert.match(ui,/recorderOutputFormat\(format, recorder\.mimeType \|\| mime\)/);
assert.match(ui,/await checkExportContainer\(blob, format\)/);
assert.match(ui,/renderVideo\('mp4'\)/);
assert.match(ui,/renderVideo\('webm'\)/);
assert.match(ui,/crossfadeAt\(state,at\)/);
assert.match(ui,/drawTitleOnCanvas\(g, visibleTitle\(state,at\), at\)/);
console.log('ParaCut Studio R4 export-format smoke: PASS (codec capability, MIME agreement, signatures, file integrity, UI paths).');
