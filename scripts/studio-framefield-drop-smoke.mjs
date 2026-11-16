import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {acceptFramefieldDrop} from '../apps/desktop/public/studio-framefield-drop.js';
import {inspectFramefieldWebm} from '../apps/desktop/public/studio-framefield-import.js';
const videoBytes=new Uint8Array([0x1a,0x45,0xdf,0xa3,0x9f,0x42,0x86,0x81,
  1,0x42,0xf7,0x81,1,0x42,0xf2,0x81,4]);
const file=(name,data)=>{const blob=new Blob([data]);Object.defineProperty(blob,'name',{value:name});return blob;};
const webm=file('turntable-study.webm',videoBytes);
const sha=Buffer.from(await webcrypto.subtle.digest('SHA-256',videoBytes)).toString('hex');
const receipt={schema:'framefield.webm-handoff/v1',
 media:{fileName:webm.name,byteLength:webm.size,sha256:sha,container:'webm'},
 project:{name:'Turntable Study',fps:24,durationFrames:120,originalGlbSha256:[]},
 recording:{mode:'browser-realtime-canvas',mediaDecodedByReceiver:false},
 authority:{originAuthenticated:false,signaturePresent:false,sourceRightsVerified:false,publicReleaseAuthorized:false},
 notice:'Unsigned local exact-byte receipt only.'};
const json=file('turntable-study.webm.framefield-handoff.json',JSON.stringify(receipt));
const empty={webm:null,sidecar:null};
const single=acceptFramefieldDrop(empty,[webm]);
assert.equal(single.webm,webm);assert.equal(single.sidecar,null);
const pair=acceptFramefieldDrop(single,[json]);
assert.equal(pair.webm,webm);assert.equal(pair.sidecar,json);
const both=acceptFramefieldDrop(empty,[webm,json]);
assert.equal(both.webm,webm);assert.equal(both.sidecar,json);
assert.equal(single.sidecar,null,'Drop must not invent the required receipt');
const inspected=await inspectFramefieldWebm(both.webm,await both.sidecar.text(),webcrypto);
assert.equal(inspected.hash,sha);
assert.equal(inspected.originVerified,false);
assert.equal(inspected.publicationAuthorized,false);
assert.throws(()=>acceptFramefieldDrop(empty,[json,json]),/only one sidecar/);
assert.throws(()=>acceptFramefieldDrop(empty,[webm,webm]),/only one webm/);
assert.throws(()=>acceptFramefieldDrop(empty,[]),/one WebM/);
assert.throws(()=>acceptFramefieldDrop(empty,[file('misc.mp4',videoBytes)]),/original/);
assert.throws(()=>acceptFramefieldDrop(empty,[file('turntable-study.webm',new Uint8Array(2))]),/size range/);
assert.deepEqual(empty,{webm:null,sidecar:null},'Pure selection must not mutate caller');
const bad=webm.name+'.framefield-handoff.json';
const wrongJson=file(bad,JSON.stringify({...receipt,media:{...receipt.media,sha256:'f'.repeat(64)}}));
const badPair=acceptFramefieldDrop(empty,[webm,wrongJson]);
await assert.rejects(inspectFramefieldWebm(badPair.webm,await badPair.sidecar.text(),webcrypto),/SHA-256 mismatch/);
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../apps/desktop/public/studio.css',import.meta.url),'utf8');
assert.match(html,/id="framefield-drop-zone"/);
assert.match(html,/id="framefield-drop-selected"/);
assert.match(js,/acceptFramefieldDrop\(framefieldSelection/);
assert.match(js,/framefieldZone\.addEventListener\('drop'/);
assert.match(js,/const sidecar=framefieldSelection\.sidecar/);
assert.match(js,/const file=framefieldSelection\.webm/);
assert.match(js,/framefieldSelection\.webm!==candidate\.file/);
assert.match(js,/framefieldSelection\.sidecar!==candidate\.sidecar/);
assert.match(css,/#framefield-drop-zone\.drag/);
console.log('Framefield two-file drag-and-drop PASS: selection only, explicit hash gate, changed bytes refused');
