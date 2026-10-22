// ParaCut R6.2 color workflow UI helpers. Preferences and comparisons are
// preview-only: all committed looks use the existing clip.color.updated ledger.
import {COLOR_DEFAULTS,clipColor,colorCSS,validateClipColor} from './studio-color.js';
export const COLOR_LOOKS=Object.freeze({
  neutral:Object.freeze({...COLOR_DEFAULTS}),
  warm:Object.freeze({brightness:1.06,contrast:1.05,saturation:1.12,warmth:28}),
  contrast:Object.freeze({brightness:.97,contrast:1.32,saturation:1.06,warmth:0}),
  mint:Object.freeze({brightness:1.04,contrast:1.14,saturation:1.22,warmth:-24})
});
export const COLOR_LOOK_NAMES=Object.freeze({
  neutral:'Neutral',warm:'Warm',contrast:'High Contrast',mint:'Phi Mint'
});
export function colorLook(key){
  if(typeof key!=='string'||!Object.hasOwn(COLOR_LOOKS,key))
    throw Error('Unknown color look.');
  return validateClipColor({...COLOR_LOOKS[key]});
}
export function previewColorFor(clip,selectedClipId,{before=false,pending=null}={}) {
  if(!clip)return colorCSS(null);
  if(clip.clip_id!==selectedClipId)return colorCSS(clip);
  if(before)return colorCSS({color:COLOR_DEFAULTS});
  return colorCSS(pending?{color:validateClipColor(pending)}:clip);
}
export function colorReceiptSummary(entry) {
  if(entry?.action!=='clip.color.updated'||!entry.details?.color)return '';
  const c=validateClipColor(entry.details.color);
  const pc=x=>Math.round(x*100)+'%';
  return ' B '+pc(c.brightness)+' · C '+pc(c.contrast)+
    ' · S '+pc(c.saturation)+' · W '+(c.warmth>0?'+':'')+c.warmth;
}
