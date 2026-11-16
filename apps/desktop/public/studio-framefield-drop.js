// Framefield two-file drop intake. Selection is local only; hashing and timeline
// mutations happen ONLY after the separate Verify and Add buttons are pressed.
import {MAX_WEBM_BYTES,MAX_SIDECAR_BYTES} from './studio-framefield-import.js';

export function acceptFramefieldDrop(previous, files){
  if(!Array.isArray(files)||!files.length||files.length>2)
    throw Error('Drop one WebM and/or one Framefield handoff JSON only.');
  const next={webm:previous?.webm??null,sidecar:previous?.sidecar??null};
  const seen=new Set();
  for(const file of files){
    if(typeof file?.name!=='string'||!Number.isSafeInteger(file.size)||file.size<1)
      throw Error('Invalid dropped file.');
    let kind,limit;
    if(/^[a-z0-9][a-z0-9._-]*\.webm$/.test(file.name)){
      kind='webm';limit=MAX_WEBM_BYTES;
    }else if(/^[a-z0-9][a-z0-9._-]*\.webm\.framefield-handoff\.json$/.test(file.name)){
      kind='sidecar';limit=MAX_SIDECAR_BYTES;
    }else{
      throw Error('Drop the original .webm and its .webm.framefield-handoff.json receipt.');
    }
    if(seen.has(kind))throw Error('Drop only one '+kind+' at a time.');
    if(file.size>limit||file.size<(kind==='webm'?16:2))
      throw Error('Dropped '+kind+' is outside the allowed size range.');
    seen.add(kind);next[kind]=file;
  }
  return next;
}
