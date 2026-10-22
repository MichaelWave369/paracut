// ParaCut R5.7: explicit output quality and optional master audio limiter.
// Defaults reproduce R5.6 exactly. Apply to either legacy or layered plans.
export const LOCAL_EXPORT_QUALITY = Object.freeze({
  compact:{preset:'veryfast',crf:'26',audioBitrate:'128k'},
  balanced:{preset:'medium',crf:'20',audioBitrate:'192k'},
  high:{preset:'slow',crf:'17',audioBitrate:'256k'}
});
export function normalizeExportOptions({quality='balanced',protectAudio=false}={}) {
  if(typeof quality!=='string'||!Object.hasOwn(LOCAL_EXPORT_QUALITY,quality))
    throw Error('Unknown MP4 quality. Choose compact, balanced or high.');
  if(typeof protectAudio!=='boolean')throw Error('Audio protection must be on or off.');
  return {quality,protectAudio};
}
function setArg(args,flag,value) {
  const i=args.indexOf(flag);
  if(i<0||i+1===args.length)throw Error('Missing '+flag+' in local encoder command.');
  args[i+1]=value;
}
export function applyExportOptions(plan,options={}) {
  const {quality,protectAudio}=normalizeExportOptions(options);
  const preset=LOCAL_EXPORT_QUALITY[quality];
  const args=[...plan.args];
  setArg(args,'-preset',preset.preset);
  setArg(args,'-crf',preset.crf);
  setArg(args,'-b:a',preset.audioBitrate);
  let graph=plan.graph;
  if(protectAudio) {
    // Single post-sum sample-peak limiter, AFTER A1/A2 ducking and all source buses.
    // level=0 prevents alimiter's automatic makeup gain from raising the level.
    // latency=1 enables FFmpeg's lookahead-delay compensation when supported.
    if(!/\[aout\]\s*$/.test(graph) || graph.includes('[prelim-master]'))
      throw Error('Master audio graph output is not suitable for protection.');
    graph=graph.replace(/\[aout\]\s*$/,'[prelim-master]')+
      ';\n[prelim-master]alimiter=limit=0.95:level=0:latency=1[aout]\n';
  }
  return {...plan,args,graph,quality,protectAudio};
}
