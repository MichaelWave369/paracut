// R8.5: bounded visual T1 sizing. All sizes are percentage integers
// 50..200 in steps of five; missing legacy field means 100%.
export const TITLE_SCALE_MIN=50,TITLE_SCALE_MAX=200,TITLE_SCALE_STEP=5;
export const TITLE_BASE_FONT=Object.freeze({small:36,medium:52,large:74});
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function titleScale(title){
  const scale=title?.title_scale===undefined?100:title.title_scale;
  if(!Number.isInteger(scale)||scale<TITLE_SCALE_MIN||
    scale>TITLE_SCALE_MAX||scale%TITLE_SCALE_STEP!==0)
    throw Error('Invalid title scale (50–200% in 5% increments).');
  return scale;
}
export function titleScaledFont(title){
  const base=TITLE_BASE_FONT[title?.size??'medium'];
  if(!base)throw Error('Invalid title size.');
  return Math.round(base*titleScale(title)/100);
}
export function titleScaleFields(scale){
  const valid=titleScale({title_scale:scale});
  return valid===100?{}:{title_scale:valid};
}
export function titleResizeDelta(startScale,deltaClientX,screenWidth){
  const current=titleScale({title_scale:startScale});
  if(!finite(deltaClientX)||!finite(screenWidth)||screenWidth<=0)
    throw Error('Invalid title resize geometry.');
  // Each 2 composition pixels of horizontal drag changes size by 1%.
  const compositionDelta=deltaClientX*1280/screenWidth;
  const next=Math.round((current+compositionDelta/2)/5)*5;
  return Math.min(TITLE_SCALE_MAX,Math.max(TITLE_SCALE_MIN,next));
}
export const TITLE_SAFE_GUIDES=Object.freeze([
  Object.freeze({id:'action',inset:10}),
  Object.freeze({id:'title',inset:20})
]);
