// Deterministic, read-only checks for export control state.
// Never enable recording if the timeline has no V1 video or any source is unlinked.
export function assessExportReadiness(state,media,{recordingReady,mp4Mime,webmMime,exporting=false,activeFormat=null}){
  const lanes=[state.clips,state.audioClips,state.video2Clips,state.audio2Clips];
  const clips=lanes.flat();
  const missing=clips.filter(clip=>!media.has(clip.asset_id));
  const hasVideo=state.clips.length>0;
  const linked=hasVideo&&missing.length===0;
  const mp4Ready=Boolean(linked&&recordingReady&&mp4Mime);
  const webmReady=Boolean(linked&&recordingReady&&webmMime);
  const mp4Disabled=exporting?activeFormat!=='mp4':!mp4Ready;
  const webmDisabled=exporting?activeFormat!=='webm':!webmReady;
  const message=exporting?'Export in progress.':
    !hasVideo?'Add a video clip to V1 before exporting.':
    missing.length?'Export blocked: '+missing.length+' timeline source(s) need relinking.':
    !recordingReady?'Export blocked: browser recording or canvas capture is unavailable.':
    !mp4Mime&&!webmMime?'Export blocked: browser has no supported recording format.':
    'Ready to export'+(mp4Mime&&webmMime?' MP4 or WebM.':
      mp4Mime?' MP4.':' WebM.');
  return {hasVideo,linked,missingSourceCount:missing.length,recordingReady,
    mp4Disabled,webmDisabled,message};
}
