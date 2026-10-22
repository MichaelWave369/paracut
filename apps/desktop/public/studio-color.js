// R6.1 clip-scoped color adjustments; optional data in older drafts.
// Browser CSS/Canvas and local FFmpeg use the same values but slightly
// different processing. No user-supplied FFmpeg filter expressions.
export const COLOR_DEFAULTS=Object.freeze({brightness:1,contrast:1,saturation:1,warmth:0});
export const COLOR_RANGES=Object.freeze({brightness:[.5,1.5],contrast:[.5,1.5],
  saturation:[0,2],warmth:[-50,50]});
export function clipColor(clip) {
  return {...COLOR_DEFAULTS,...(clip?.color||{})};
}
export function validateClipColor(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||
    Object.keys(raw).some(k=>!Object.hasOwn(COLOR_RANGES,k)))
    throw Error('Invalid clip color controls.');
  const out={};
  for(const [key,[min,max]] of Object.entries(COLOR_RANGES)) {
    const value=raw[key]??COLOR_DEFAULTS[key];
    if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)
      throw Error('Invalid '+key+' color value.');
    out[key]=Math.round(value*1000)/1000;
  }
  return out;
}
export function hasColorAdjustment(clip) {
  const values=clipColor(clip);
  return Object.keys(COLOR_DEFAULTS).some(k=>values[k]!==COLOR_DEFAULTS[k]);
}
export function colorCSS(clip){
  const v=clipColor(clip);
  const temp=Math.abs(v.warmth)/50;
  // Small, approximate warm/cool tint for browser preview.
  const tint=v.warmth>0?'sepia('+Math.round(temp*23)+'%)':
    v.warmth<0?'sepia('+Math.round(temp*23)+'%) hue-rotate(180deg)':'';
  return 'brightness('+v.brightness+') contrast('+v.contrast+') saturate('+v.saturation+')'+(tint?' '+tint:'');
}
export function colorFFmpegFilters(clip) {
  if(!hasColorAdjustment(clip))return [];
  const c=clipColor(clip);
  // FFmpeg brightness is additive, CSS brightness multiplicative.
  const eq='eq=brightness='+Number(((c.brightness-1)*.24).toFixed(4))+
    ':contrast='+c.contrast+':saturation='+c.saturation;
  const result=[eq];
  if(c.warmth!==0){
    const value=Number((c.warmth/250).toFixed(4));
    result.push('colorbalance=rs='+value+':bs='+(-value));
  }
  return result;
}
