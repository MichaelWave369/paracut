import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {inspectFramefieldWebm,verifyFramefieldRelink,parseFramefieldSidecar,
  FRAMEFIELD_TAG,FRAMEFIELD_SCHEMA} from '../apps/desktop/public/studio-framefield-import.js';
import {newStudio,change,exportDraft,importDraft,undo,redo} from '../apps/desktop/public/studio-core.js';
const b=new Uint8Array([0x1a,0x45,0xdf,0xa3,0x9f,0x42,0x86,0x81,1,0x42,0xf7,0x81,1,0x42,0xf2,0x81,4]);
const f=new Blob([b],{type:'video/webm'});Object.defineProperty(f,'name',{value:'turntable.webm'});
const digest=Buffer.from(await webcrypto.subtle.digest('SHA-256',b)).toString('hex');
const receipt={
 schema:FRAMEFIELD_SCHEMA,
 media:{fileName:f.name,byteLength:f.size,sha256:digest,container:'webm'},
 project:{name:'Turntable',fps:24,durationFrames:48,originalGlbSha256:['a'.repeat(64)]},
 recording:{mode:'browser-realtime-canvas',mediaDecodedByReceiver:false},
 authority:{originAuthenticated:false,signaturePresent:false,sourceRightsVerified:false,publicReleaseAuthorized:false},
 notice:'Unsigned local media identity only.',
};
const inspection=await inspectFramefieldWebm(f,JSON.stringify(receipt),webcrypto);
assert.equal(inspection.hash,digest);
assert.equal(inspection.assetTag.schema,FRAMEFIELD_TAG);
assert.equal(inspection.publicationAuthorized,false);
assert.equal(await verifyFramefieldRelink(f,inspection.assetTag,webcrypto),true);
const x=b.slice();x[x.length-1]^=1;const bad=new Blob([x],{type:'video/webm'});
Object.defineProperty(bad,'name',{value:f.name});
await assert.rejects(inspectFramefieldWebm(bad,JSON.stringify(receipt),webcrypto),/SHA-256 mismatch/);
await assert.rejects(verifyFramefieldRelink(bad,inspection.assetTag,webcrypto),/SHA-256 mismatch/);
assert.throws(()=>parseFramefieldSidecar(JSON.stringify({...receipt,authority:{...receipt.authority,publicReleaseAuthorized:true}})),/authority flags/);
assert.throws(()=>parseFramefieldSidecar(JSON.stringify({...receipt,media:{...receipt.media,sha256:'z'.repeat(64)}})),/authority flags/);
let state=newStudio('Framefield');
state=change(state,{type:'asset.added',asset:{asset_id:'a1',name:f.name,type:'video/webm',
 size:f.size,duration:2,lastModified:0,framefieldEvidence:inspection.assetTag}});
state=change(state,{type:'clip.appended',asset_id:'a1'});
state=change(state,{type:'clip.source-audio.muted',clip_id:state.clips[0].clip_id,muted:true});
assert.equal(state.receipts.length,3);
assert.equal(state.receipts[0].details.framefield_webm_sha256,digest);
assert.equal(state.clips[0].source_audio_muted,true);
assert.equal(importDraft(exportDraft(state)).assets[0].framefieldEvidence.mediaSha256,digest);
assert.equal(redo(undo(state)).clips[0].source_audio_muted,true);
assert.throws(()=>change(newStudio(),{type:'asset.added',asset:{asset_id:'x',name:f.name,
 type:'video/webm',size:f.size,duration:2,framefieldEvidence:{
 ...inspection.assetTag,publicReleaseAuthorized:true}}}),/evidence tag/);
const js=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
for(const id of ['framefield-evidence-input','framefield-webm-input','framefield-verify-media',
 'framefield-import-status','framefield-add-v1']){
 assert.ok(js.includes(id));assert.ok(html.includes('id="'+id+'"'));
}
console.log('Framefield -> ParaCut verified-byte handoff smoke passed');
