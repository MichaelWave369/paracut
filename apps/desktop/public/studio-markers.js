// ParaCut R6.5: bounded, explicit timeline review markers.
// Markers annotate an absolute project time. They are NOT clips and do not
// retime with ordinary V1 Ripple Delete or alter the exported media.
export const MARKER_COLORS=Object.freeze(['mint','gold','blue','coral']);
export const MARKER_LIMIT=100;
const round=n=>Math.round(n*1000)/1000;
export function validateMarker(marker) {
  if(!marker||typeof marker!=='object'||Array.isArray(marker)||
    typeof marker.marker_id!=='string'||!marker.marker_id||
    marker.marker_id.length>100||
    !Number.isFinite(marker.time)||marker.time<0||marker.time>86400||
    typeof marker.label!=='string'||!marker.label.trim()||marker.label.length>60||
    typeof marker.note!=='string'||marker.note.length>280||
    !MARKER_COLORS.includes(marker.color))
    throw Error('Invalid timeline marker: time, label, note or color.');
  if(Object.keys(marker).some(k=>!['marker_id','time','label','note','color'].includes(k)))
    throw Error('Unsupported timeline marker field.');
  return true;
}
export function markerFromInput(raw,markerId) {
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||
    Object.keys(raw).some(k=>!['time','label','note','color'].includes(k)))
    throw Error('Unsupported timeline marker field.');
  if(typeof raw.time!=='number'||!Number.isFinite(raw.time))
    throw Error('Invalid timeline marker time.');
  const marker={marker_id:markerId,time:round(raw.time),
    label:raw?.label?.trim(),note:raw?.note??'',color:raw?.color??'mint'};
  validateMarker(marker);
  return marker;
}
export function sortedMarkers(markers) {
  return [...markers].sort((a,b)=>a.time-b.time||a.marker_id.localeCompare(b.marker_id));
}
export function navigateMarker(markers,from,direction) {
  if(!Number.isFinite(from)||!['previous','next'].includes(direction))
    throw Error('Invalid marker navigation.');
  const sorted=sortedMarkers(markers);
  return direction==='next'
    ? sorted.find(m=>m.time>from+.001)||null
    : sorted.reverse().find(m=>m.time<from-.001)||null;
}
