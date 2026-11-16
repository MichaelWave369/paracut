import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {colorCSS} from '../apps/desktop/public/studio-color.js';
import {summarizeVideoPackets} from './studio-export-timestamp-audit.mjs';
const src=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const block=src.slice(src.indexOf('async function renderVideo(format)'),
 src.indexOf("$('export-webm').addEventListener"));
assert.match(src,/import\s*\{[^}]*\bcolorCSS\b[^}]*\}\s*from\s*'\.\/studio-color\.js'/);
assert.match(block,/g\.filter=colorCSS\(clip\)/);
assert.match(colorCSS(null),/brightness\(1\)/);
assert.equal((block.match(/recorder\.start\(1000\)/g)||[]).length,1);
const firstSource=block.indexOf('encoderVideo.src=ref.url');
const awaitFrame=block.indexOf('await waitForFirstExportFrame(encoderVideo)');
const paint=block.indexOf('paint(clip.timeline.start+skipped)');
const start=block.indexOf('recorder.start(1000)');
const play=block.indexOf('await encoderVideo.play()');
assert.ok(firstSource>=0&&firstSource<awaitFrame&&awaitFrame<paint&&paint<start&&start<play,
  'Decoder preparation and first-frame paint must precede recorder startup');
const good=summarizeVideoPackets([
 {pts:0,dts:0},{pts:.033,dts:.033},{pts:.067,dts:.067},{pts:.100,dts:.100},
]);
assert.equal(good.videoPackets,4);
assert.equal(good.ptsStrictlyIncreasing,true);
assert.equal(good.dtsStrictlyIncreasing,true);
assert.equal(good.initialGapMs,33);
const vfr=summarizeVideoPackets([
 {pts:0,dts:0},{pts:.693,dts:.693},{pts:.717,dts:.717},
 {pts:.752,dts:.752},
]);
assert.equal(vfr.ptsStrictlyIncreasing,true);
assert.equal(vfr.initialGapMs,693);
assert.equal(vfr.maxFrameGapMs,693);
const wrong=summarizeVideoPackets([
 {pts:0,dts:0},{pts:.033,dts:.033},{pts:.033,dts:.033},
]);
assert.equal(wrong.ptsStrictlyIncreasing,false);
assert.equal(wrong.dtsStrictlyIncreasing,false);
assert.equal(wrong.nonIncreasingDts,1);
assert.throws(()=>summarizeVideoPackets([{pts:NaN,dts:1}]),/finite/);
assert.throws(()=>summarizeVideoPackets([]),/No video/);
console.log('ParaCut R9.0 export cleanup PASS: colorCSS binding, deferred first-frame recorder, original WebM timing audit.');
