/**
 * REEL P001 → ParaCut Studio R8.9.
 * Strict client-side inspection of a user-selected master MP4 and
 * separately exported UNSIGNED CineSwarm evidence. No network, no authority
 * from the JSON, no real codec/ffprobe claims from simple MP4 sniffing.
 */
export const REEL_EVIDENCE_SCHEMA='REEL_P001_REAL_MEDIA_EVIDENCE_V1';
export const REEL_MAX_MASTER_BYTES=256*1024*1024;
export const REEL_MAX_JSON_BYTES=64*1024;
export const REEL_ASSET_TAG='REEL_P001_UNSIGNED_CINESWARM_EVIDENCE_V1';
const HEX=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,fields)=>obj(v)&&Object.keys(v).length===fields.length&&fields.every(k=>Object.hasOwn(v,k));
const same=(v,n)=>Number.isFinite(v)&&v===n;

export function validateReelAssetTag(tag){
  if(!exact(tag,[
    'schema','masterSha256','nativeSha256','sourceHash','planHash',
    'reviewDecision','recordedBackend','publicReleaseAuthorized',
  ])||
    tag.schema!==REEL_ASSET_TAG||
    !HEX.test(tag.masterSha256)||!HEX.test(tag.nativeSha256)||
    !HEX.test(tag.sourceHash)||!HEX.test(tag.planHash)||
    !['PENDING_REVIEW','ACCEPT','REJECT','REVISION_REQUESTED'].includes(tag.reviewDecision)||
    tag.recordedBackend!=='wan21-t2v-1.3b'||
    tag.publicReleaseAuthorized!==false){
    throw Error('Invalid unsigned REEL evidence tag; cannot attach to ParaCut asset.');
  }
  return {...tag};
}

function validateMedia(metadata,role,width,height,fps){
  if(!exact(metadata,[
    'artifactId','sha256','sizeBytes','role','width','height','fps','durationSeconds',
  ])||!UUID.test(metadata.artifactId)||!HEX.test(metadata.sha256)||
    !Number.isSafeInteger(metadata.sizeBytes)||metadata.sizeBytes<=0||
    metadata.role!==role||!same(metadata.width,width)||!same(metadata.height,height)||
    !same(metadata.fps,fps)||typeof metadata.durationSeconds!=='number'||
    !Number.isFinite(metadata.durationSeconds)||metadata.durationSeconds<=0||
    metadata.durationSeconds>30){
    throw Error('Invalid '+role+' details in unsigned REEL evidence.');
  }
}

export function validateReelEvidence(source){
  if(typeof source!=='string'||new TextEncoder().encode(source).byteLength>REEL_MAX_JSON_BYTES)
    throw Error('REEL evidence JSON exceeds the 64 KiB limit.');
  let r;
  try { r=JSON.parse(source); } catch { throw Error('REEL evidence is not valid JSON.'); }
  if(!exact(r,[
    'schema','classification','shotId','lineage','model','master','native',
    'review','integrity','authority','notice',
  ])||r.schema!==REEL_EVIDENCE_SCHEMA||
    r.classification!=='LOCAL_UNSIGNED_MEDIA_EVIDENCE_NOT_PUBLIC_RELEASE'||
    r.shotId!=='reel-p001-s01')
    throw Error('Unknown REEL first-shot evidence envelope.');
  if(!exact(r.lineage,['sourceHash','planHash','jobId','taskId'])||
    !HEX.test(r.lineage.sourceHash)||!HEX.test(r.lineage.planHash)||
    !UUID.test(r.lineage.jobId)||!UUID.test(r.lineage.taskId))
    throw Error('REEL job/shot lineage is invalid.');
  if(!exact(r.model,[
    'backendId','modelId','recordedCheckpointHash','runtimeCheckpointRecheckedOnExport',
  ])||r.model.backendId!=='wan21-t2v-1.3b'||
    r.model.modelId!=='Wan-AI/Wan2.1-T2V-1.3B'||
    !HEX.test(r.model.recordedCheckpointHash)||
    r.model.runtimeCheckpointRecheckedOnExport!==false)
    throw Error('Model identity or checkpoint verification flag does not match the first-shot policy.');
  validateMedia(r.master,'master',1280,720,24);
  validateMedia(r.native,'native',832,480,16);
  if(r.master.sha256===r.native.sha256)
    throw Error('Native source and delivery master must be different MP4 assets.');
  if(!exact(r.review,['decision','exactHashDecisionRecorded'])||
    !['PENDING_REVIEW','ACCEPT','REJECT','REVISION_REQUESTED'].includes(r.review.decision)||
    r.review.exactHashDecisionRecorded!==(r.review.decision!=='PENDING_REVIEW'))
    throw Error('REEL exact-hash review status is inconsistent.');
  if(!exact(r.integrity,[
    'localReceiptChainVerified','receiptCount','receiptHeadHash',
    'masterMediaBytesRehashed','nativeMediaBytesRehashed',
    'bothMediaProbesPassed','signaturePresent',
  ])||r.integrity.localReceiptChainVerified!==true||
    !Number.isSafeInteger(r.integrity.receiptCount)||r.integrity.receiptCount<1||
    !HEX.test(r.integrity.receiptHeadHash)||
    r.integrity.masterMediaBytesRehashed!==true||
    r.integrity.nativeMediaBytesRehashed!==true||
    r.integrity.bothMediaProbesPassed!==true||
    r.integrity.signaturePresent!==false)
    throw Error('REEL sidecar integrity assertions are incomplete or claim a signature.');
  if(!exact(r.authority,[
    'sourceRightsVerified','musicRightsVerified','voiceConsentVerified',
    'publishingAuthorized','rctvChannelAssigned',
  ])||Object.values(r.authority).some(v=>v!==false))
    throw Error('Unsigned REEL JSON cannot confer rights, voice consent or publishing authority.');
  if(typeof r.notice!=='string'||r.notice.length<40||r.notice.length>1500)
    throw Error('Missing unsigned REEL evidence warning.');
  return r;
}

export async function inspectReelMaster(file, source, cryptoImpl=globalThis.crypto){
  const evidence=validateReelEvidence(source);
  if(!file||typeof file.slice!=='function'||typeof file.arrayBuffer!=='function'||
    file.size<16||file.size>REEL_MAX_MASTER_BYTES)
    throw Error('Select a master MP4 between 16 bytes and 256 MiB.');
  if(file.size!==evidence.master.sizeBytes)
    throw Error('Selected MP4 byte count differs from the claimed master.');
  const head=new Uint8Array(await file.slice(0,16).arrayBuffer());
  if(String.fromCharCode(...head.slice(4,8))!=='ftyp'){
    throw Error('Selected file does not have an MP4 ftyp signature.');
  }
  const declaredSize=(head[0]*0x1000000 + (head[1]<<16) + (head[2]<<8) + head[3])>>>0;
  if(declaredSize<12||declaredSize>file.size)
    throw Error('MP4 ftyp box has an invalid declared size.');
  if(!cryptoImpl?.subtle?.digest)
    throw Error('Secure WebCrypto SHA-256 is required for local MP4 verification.');
  const sum=await cryptoImpl.subtle.digest('SHA-256',await file.arrayBuffer());
  const hash=[...new Uint8Array(sum)].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(hash!==evidence.master.sha256)
    throw Error('The selected MP4 SHA-256 does NOT match the CineSwarm master; import denied.');
  const tag=validateReelAssetTag({
    schema:REEL_ASSET_TAG,masterSha256:hash,
    nativeSha256:evidence.native.sha256,
    sourceHash:evidence.lineage.sourceHash,
    planHash:evidence.lineage.planHash,
    reviewDecision:evidence.review.decision,
    recordedBackend:evidence.model.backendId,
    publicReleaseAuthorized:false,
  });
  return {
    schema:REEL_EVIDENCE_SCHEMA,hash,sizeBytes:file.size,
    claimedDuration:evidence.master.durationSeconds,
    reviewDecision:evidence.review.decision,
    isSigned:false,
    originVerified:false,
    mediaDecoded:false,
    publicationAuthorized:false,
    assetTag:tag,
  };
}

/**
 * Existing ParaCut drafts do not embed video files. On relink, recheck the
 * ACTUAL selected MP4 bytes against the saved unsigned REEL asset hash.
 * A matching filename, last-modified timestamp and size is never sufficient.
 */
export async function verifyReelRelink(file,tag,cryptoImpl=globalThis.crypto){
  const evidence=validateReelAssetTag(tag);
  if(!file||typeof file.arrayBuffer!=='function'||file.size<16||
    file.size>REEL_MAX_MASTER_BYTES)
    throw Error('REEL relink requires a bounded original MP4.');
  if(!cryptoImpl?.subtle?.digest)
    throw Error('Secure SHA-256 is required before restoring a REEL-linked source.');
  const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
  if(String.fromCharCode(...bytes.slice(4,8))!=='ftyp')
    throw Error('Selected REEL relink media has no MP4 ftyp signature.');
  const digest=await cryptoImpl.subtle.digest('SHA-256',await file.arrayBuffer());
  const current=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(current!==evidence.masterSha256)
    throw Error('REEL relink FAILED: these media bytes do not match the saved original master hash.');
  return true;
}
