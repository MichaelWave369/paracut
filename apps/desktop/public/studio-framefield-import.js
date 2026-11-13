// Unsigned, offline Framefield WebM handoff checker for ParaCut.
export const FRAMEFIELD_SCHEMA='framefield.webm-handoff/v1';
export const FRAMEFIELD_TAG='FRAMEFIELD_UNSIGNED_WEBM_V1';
export const MAX_WEBM_BYTES=256*1024*1024;
export const MAX_SIDECAR_BYTES=64*1024;
const SHA=/^[0-9a-f]{64}$/;
const ebml=[0x1a,0x45,0xdf,0xa3];
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(o,keys)=>obj(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
const hashes=a=>Array.isArray(a)&&a.length<=100&&
  a.every(h=>typeof h==='string'&&SHA.test(h))&&new Set(a).size===a.length;
const safeName=n=>typeof n==='string'&&n.length<=180&&/^[a-z0-9][a-z0-9._-]*\.webm$/.test(n);
const hex=u=>Array.from(u,x=>x.toString(16).padStart(2,'0')).join('');

export function validateFramefieldTag(t){
  if(!exact(t,['schema','mediaSha256','mediaByteLength','projectName','fps',
      'durationFrames','originalGlbSha256','sourceRightsVerified',
      'publicReleaseAuthorized','originAuthenticated'])||
     t.schema!==FRAMEFIELD_TAG||!SHA.test(t.mediaSha256)||
     !int(t.mediaByteLength,16,MAX_WEBM_BYTES)||typeof t.projectName!=='string'||
     t.projectName.length>120||!int(t.fps,1,120)||
     !int(t.durationFrames,1,600)||!hashes(t.originalGlbSha256)||
     t.sourceRightsVerified!==false||t.publicReleaseAuthorized!==false||
     t.originAuthenticated!==false)
    throw Error('Invalid unsigned Framefield evidence tag.');
  return {...t,originalGlbSha256:[...t.originalGlbSha256]};
}
export function parseFramefieldSidecar(source){
  if(typeof source!=='string'||new TextEncoder().encode(source).length>MAX_SIDECAR_BYTES)
    throw Error('Framefield sidecar exceeds 64 KiB.');
  let r;try{r=JSON.parse(source)}catch{throw Error('Invalid Framefield JSON.')}
  if(!exact(r,['schema','media','project','recording','authority','notice'])||
     r.schema!==FRAMEFIELD_SCHEMA||
     !exact(r.media,['fileName','byteLength','sha256','container'])||
     !safeName(r.media.fileName)||!int(r.media.byteLength,16,MAX_WEBM_BYTES)||
     !SHA.test(r.media.sha256)||r.media.container!=='webm'||
     !exact(r.project,['name','fps','durationFrames','originalGlbSha256'])||
     typeof r.project.name!=='string'||r.project.name.length>120||
     !int(r.project.fps,1,120)||!int(r.project.durationFrames,1,600)||
     !hashes(r.project.originalGlbSha256)||
     !exact(r.recording,['mode','mediaDecodedByReceiver'])||
     r.recording.mode!=='browser-realtime-canvas'||
     r.recording.mediaDecodedByReceiver!==false||
     !exact(r.authority,['originAuthenticated','signaturePresent','sourceRightsVerified','publicReleaseAuthorized'])||
     r.authority.originAuthenticated!==false||r.authority.signaturePresent!==false||
     r.authority.sourceRightsVerified!==false||r.authority.publicReleaseAuthorized!==false||
     typeof r.notice!=='string'||r.notice.length<1||r.notice.length>512)
    throw Error('Invalid Framefield sidecar schema or authority flags.');
  return r;
}
async function digestFile(file,cryptoImpl){
  if(!file||!int(file.size,16,MAX_WEBM_BYTES)||
     typeof file.arrayBuffer!=='function'||typeof file.slice!=='function')
    throw Error('WebM must be 16 bytes to 256 MiB.');
  if(!cryptoImpl?.subtle?.digest)throw Error('Secure SHA-256 is required.');
  const magic=new Uint8Array(await file.slice(0,4).arrayBuffer());
  if(!ebml.every((v,i)=>magic[i]===v))throw Error('Not an EBML/WebM container.');
  return hex(new Uint8Array(await cryptoImpl.subtle.digest('SHA-256',await file.arrayBuffer())));
}
export async function inspectFramefieldWebm(file,json,cryptoImpl=globalThis.crypto){
  const e=parseFramefieldSidecar(json);
  if(file?.name!==e.media.fileName||file?.size!==e.media.byteLength)
    throw Error('Framefield filename or byte count mismatch.');
  const hash=await digestFile(file,cryptoImpl);
  if(hash!==e.media.sha256)throw Error('Framefield SHA-256 mismatch: changed media.');
  return {hash,assetTag:validateFramefieldTag({
    schema:FRAMEFIELD_TAG,mediaSha256:hash,mediaByteLength:file.size,
    projectName:e.project.name,fps:e.project.fps,durationFrames:e.project.durationFrames,
    originalGlbSha256:e.project.originalGlbSha256,
    sourceRightsVerified:false,publicReleaseAuthorized:false,originAuthenticated:false,
  }),originVerified:false,publicationAuthorized:false,mediaDecoded:false};
}
export async function verifyFramefieldRelink(file,tag,cryptoImpl=globalThis.crypto){
  const t=validateFramefieldTag(tag);
  if(file?.size!==t.mediaByteLength)throw Error('Framefield relink byte count mismatch.');
  if(await digestFile(file,cryptoImpl)!==t.mediaSha256)
    throw Error('Framefield relink SHA-256 mismatch; changed bytes refused.');
  return true;
}
