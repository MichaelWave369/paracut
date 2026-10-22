// ParaCut R6.4: source matching and clip-attribute clipboard.
// Clipboard is session-only, not OS clipboard, project JSON or receipt history.
// A paste returns an existing validated editor command which creates one receipt.
import {clipColor,validateClipColor} from './studio-color.js';
export function matchedSourceFrame(clip,timelineTime) {
  if(!clip?.track_id?.startsWith('video-')||!clip.source||!clip.timeline)
    throw Error('Match Frame requires a video clip.');
  if(typeof timelineTime!=='number'||!Number.isFinite(timelineTime))
    throw Error('Invalid Program time for Match Frame.');
  const pos=Math.max(clip.timeline.start,Math.min(clip.timeline.end,timelineTime));
  const sourceTime=clip.source.start+pos-clip.timeline.start;
  return {assetId:clip.asset_id,clipId:clip.clip_id,
    time:Math.round(Math.max(clip.source.start,
      Math.min(clip.source.end,sourceTime))*1000)/1000,
    in:clip.source.start,out:clip.source.end};
}
export function captureAttributes(clip,kind) {
  if(!clip?.track_id?.startsWith('video-'))
    throw Error('Copy attributes requires a V1 or V2 clip.');
  if(kind==='color'){
    return {kind:'color',sourceClipId:clip.clip_id,
      values:validateClipColor(clipColor(clip))};
  }
  if(kind==='overlay'&&clip.track_id==='video-2'){
    return {kind:'overlay',sourceClipId:clip.clip_id,
      values:{layout:clip.overlay_layout??'pip',opacity:clip.overlay_opacity??1,
        motion:clip.overlay_motion??'none',fade_in:clip.visual_fade_in??0,
        fade_out:clip.visual_fade_out??0}};
  }
  throw Error('Overlay attributes require a V2 video clip.');
}
export function attributePasteCommand(snapshot,target) {
  if(!snapshot||!target?.clip_id)throw Error('Copy attributes first and select a target clip.');
  if(snapshot.kind==='color'){
    if(!target.track_id?.startsWith('video-'))
      throw Error('Color attributes can only be pasted onto V1/V2 video.');
    return {type:'clip.color.updated',clip_id:target.clip_id,
      color:validateClipColor(snapshot.values)};
  }
  if(snapshot.kind==='overlay'){
    if(target.track_id!=='video-2')
      throw Error('Overlay style can only be pasted onto V2 video.');
    const v=snapshot.values;
    if(!v||typeof v!=='object'||!Number.isFinite(v.fade_in)||
      !Number.isFinite(v.fade_out)||v.fade_in<0||v.fade_out<0||
      v.fade_in+v.fade_out>target.source.end-target.source.start+.002)
      throw Error('Copied V2 fades exceed target clip length; trim or adjust source first.');
    return {type:'clip.overlay.updated',clip_id:target.clip_id,
      layout:v.layout,opacity:v.opacity,motion:v.motion,
      fade_in:v.fade_in,fade_out:v.fade_out};
  }
  throw Error('Unsupported clip attribute clipboard.');
}
