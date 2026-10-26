import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {
  inspectReelMaster,validateReelAssetTag,
  REEL_ASSET_TAG,REEL_EVIDENCE_SCHEMA,REEL_MAX_MASTER_BYTES,
} from '../apps/desktop/public/studio-reel-import.js';
import {
  newStudio,change,undo,redo,exportDraft,importDraft,
} from '../apps/desktop/public/studio-core.js';

const rawBytes=new Uint8Array([
  0,0,0,24,102,116,121,112,105,115,111,109,0,0,0,0,
  ...new TextEncoder().encode('SYNTHETIC-TEST-FILE-NOT-REAL-WAN-MEDIA'),
]);
const testFile=new Blob([rawBytes],{type:'video/mp4'});
const hash=async bytes => Buffer.from(
  await webcrypto.subtle.digest('SHA-256',await bytes.arrayBuffer()),
).toString('hex');
const sidecar=async()=>{
  const digest=await hash(testFile);
  return {
    schema:REEL_EVIDENCE_SCHEMA,
    classification:'LOCAL_UNSIGNED_MEDIA_EVIDENCE_NOT_PUBLIC_RELEASE',
    shotId:'reel-p001-s01',
    lineage:{
      sourceHash:'a'.repeat(64),planHash:'b'.repeat(64),
      jobId:'11111111-1111-4111-8111-111111111111',
      taskId:'22222222-2222-4222-8222-222222222222',
    },
    model:{
      backendId:'wan21-t2v-1.3b',modelId:'Wan-AI/Wan2.1-T2V-1.3B',
      recordedCheckpointHash:'c'.repeat(64),runtimeCheckpointRecheckedOnExport:false,
    },
    master:{
      artifactId:'33333333-3333-4333-8333-333333333333',
      sha256:digest,sizeBytes:testFile.size,role:'master',
      width:1280,height:720,fps:24,durationSeconds:8,
    },
    native:{
      artifactId:'44444444-4444-4444-8444-444444444444',
      sha256:'d'.repeat(64),sizeBytes:900,role:'native',
      width:832,height:480,fps:16,durationSeconds:8,
    },
    review:{decision:'PENDING_REVIEW',exactHashDecisionRecorded:false},
    integrity:{
      localReceiptChainVerified:true,receiptCount:8,receiptHeadHash:'e'.repeat(64),
      masterMediaBytesRehashed:true,nativeMediaBytesRehashed:true,
      bothMediaProbesPassed:true,signaturePresent:false,
    },
    authority:{
      sourceRightsVerified:false,musicRightsVerified:false,
      voiceConsentVerified:false,publishingAuthorized:false,
      rctvChannelAssigned:false,
    },
    notice:'This is an editable, unsigned local evidence summary, never proof of authorized model rendering or public release.',
  };
};
const manifest=await sidecar();
const json=JSON.stringify(manifest);
const inspected=await inspectReelMaster(testFile,json,webcrypto);
assert.equal(inspected.hash,manifest.master.sha256);
assert.equal(inspected.assetTag.masterSha256,manifest.master.sha256);
assert.equal(inspected.assetTag.publicReleaseAuthorized,false);
assert.equal(inspected.publicationAuthorized,false);
assert.equal(inspected.originVerified,false);
assert.equal(inspected.mediaDecoded,false);
assert.equal(inspected.isSigned,false);

for(const changeData of [
  e=>e.authority.publishingAuthorized=true,
  e=>e.authority.sourceRightsVerified=true,
  e=>e.model.backendId='fixture-video',
  e=>e.model.runtimeCheckpointRecheckedOnExport=true,
  e=>e.integrity.signaturePresent=true,
  e=>e.review.decision='ACCEPT',
  e=>e.master.width=832,
  e=>e.native.sha256=e.master.sha256,
  e=>e.extra='inject',
]){
  const altered=structuredClone(manifest);
  changeData(altered);
  await assert.rejects(()=>inspectReelMaster(testFile,JSON.stringify(altered),webcrypto));
}
const accepted=structuredClone(manifest);
accepted.review={decision:'ACCEPT',exactHashDecisionRecorded:true};
const acceptedResult=await inspectReelMaster(testFile,JSON.stringify(accepted),webcrypto);
assert.equal(acceptedResult.reviewDecision,'ACCEPT');
assert.equal(acceptedResult.assetTag.publicReleaseAuthorized,false);

const mismatched=structuredClone(manifest);
mismatched.master.sha256='1'.repeat(64);
await assert.rejects(
  ()=>inspectReelMaster(testFile,JSON.stringify(mismatched),webcrypto),
  /SHA-256/,
);
const length=structuredClone(manifest);
length.master.sizeBytes+=1;
await assert.rejects(()=>inspectReelMaster(testFile,JSON.stringify(length),webcrypto),/byte count/);
const noFtyp=new Blob([new Uint8Array(32)],{type:'video/mp4'});
const wrong=structuredClone(manifest);
wrong.master.sha256=await hash(noFtyp);
wrong.master.sizeBytes=noFtyp.size;
await assert.rejects(()=>inspectReelMaster(noFtyp,JSON.stringify(wrong),webcrypto),/ftyp/);
const huge=new Blob([new Uint8Array(20)]);
Object.defineProperty(huge,'size',{value:REEL_MAX_MASTER_BYTES+1});
await assert.rejects(()=>inspectReelMaster(huge,json,webcrypto),/256 MiB/);

let state=newStudio('REEL Pilot 001');
const assetId='reel-p001-master';
state=change(state,{type:'asset.added',asset:{
  asset_id:assetId,name:'p001-real-master.mp4',type:'video/mp4',
  duration:8,size:testFile.size,lastModified:1,reelEvidence:inspected.assetTag,
}});
state=change(state,{type:'clip.appended',asset_id:assetId});
state=change(state,{type:'clip.source-audio.muted',clip_id:state.clips[0].clip_id,muted:true});
assert.equal(state.clips[0].track_id,'video-1');
assert.equal(state.clips[0].source_audio_muted,true);
assert.equal(state.assets[0].reelEvidence.schema,REEL_ASSET_TAG);
assert.equal(state.assets[0].reelEvidence.masterSha256,manifest.master.sha256);
assert.equal(state.receipts.length,3);
assert.equal(state.receipts[0].details.reel_master_sha256,manifest.master.sha256);
assert.equal(state.receipts[0].details.publicReleaseAuthorized,false);
const reloaded=importDraft(exportDraft(state));
assert.equal(reloaded.assets[0].reelEvidence.masterSha256,manifest.master.sha256);
assert.equal(reloaded.clips.length,1);
assert.equal(reloaded.clips[0].source_audio_muted,true);
assert.equal(undo(state).clips[0].source_audio_muted,false);
assert.equal(redo(undo(state)).clips[0].source_audio_muted,true);
assert.throws(()=>validateReelAssetTag({...inspected.assetTag,publicReleaseAuthorized:true}),/Invalid/);
const tamperedDraft=JSON.parse(exportDraft(state));
tamperedDraft.assets[0].reelEvidence.publicReleaseAuthorized=true;
assert.throws(()=>importDraft(JSON.stringify(tamperedDraft)),/Invalid unsigned REEL evidence tag/);

const html=readFileSync(new URL('../apps/desktop/public/studio.html',import.meta.url),'utf8');
const ui=readFileSync(new URL('../apps/desktop/public/studio.js',import.meta.url),'utf8');
for(const id of ['reel-intake-panel','reel-evidence-input','reel-master-input','reel-verify-media','reel-add-v1','reel-import-status'])
  assert.ok(html.includes('id="'+id+'"'));
assert.match(ui,/await inspectReelMaster\(file,await sidecar\.text\(\)\)/);
assert.match(ui,/staged=change\(staged,\{type:'clip\.appended',asset_id\}\)/);
assert.match(ui,/type:'clip\.source-audio\.muted'/);
assert.match(html,/id="reel-add-v1"[^>]*disabled/);
assert.doesNotMatch(ui,/fetch\(.+reel/i);
console.log('ParaCut Studio R8.9 REEL native edit path PASS (selected MP4 bytes, denied publication, native V1, receipts, undo and draft).');
