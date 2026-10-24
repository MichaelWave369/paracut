// R8.8 portable, strictly allowlisted title looks; no project edits or I/O here.
// Same-origin storage is handled by Studio UI; optional JSON export provides portability.
import {titlePlacement,titlePlacementFields} from './studio-title-placement.js';
import {titleScale,titleScaleFields} from './studio-title-transform.js';
import {titleMotionId,titleMotionEaseId,titleMotionDistance} from './studio-title-motion.js';

export const TITLE_LIBRARY_KEY='paracut.studio.title.styles.v1';
export const TITLE_LIBRARY_KIND='paracut-title-styles';
export const TITLE_LIBRARY_VERSION=1;
export const TITLE_LIBRARY_MAX=24;
export const TITLE_LIBRARY_MAX_BYTES=16384;
const POSITIONS=['top','middle','bottom'];
const SIZES=['small','medium','large'];
const COLORS=['white','mint','gold'];
const ALLOWED_LOOK=new Set(['position','size','color','motion','motion_ease',
 'motion_distance','title_x','title_y','title_scale']);
const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const validName=name=>{
 if(typeof name!=='string'||name.length>48||name.trim().length<1||
    /[\u0000-\u001F\u007F]/.test(name))
   throw Error('Style name must be 1–48 characters without control characters.');
 return name.trim();
};
const validId=id=>{
 if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(id))
   throw Error('Invalid saved style identifier.');
 return id;
};
export function titleStyleLook(source){
 if(!isRecord(source))throw Error('Invalid title style look.');
 for(const key of Object.keys(source))
   if(!ALLOWED_LOOK.has(key))throw Error('Unknown title style field: '+key);
 const position=source.position===undefined?'bottom':source.position;
 const size=source.size===undefined?'medium':source.size;
 const color=source.color===undefined?'white':source.color;
 if(!POSITIONS.includes(position)||!SIZES.includes(size)||!COLORS.includes(color))
   throw Error('Invalid title appearance.');
 const motion=titleMotionId(source),motion_ease=titleMotionEaseId(source);
 const motion_distance=titleMotionDistance(source);
 const custom=titlePlacement(source);
 const scale=titleScale(source);
 // Canonical normalized look, never includes text, IDs, time or fades.
 return {position,size,color,motion,motion_ease,motion_distance,
   ...titlePlacementFields(custom),...titleScaleFields(scale)};
}
export function titleStyleFromTitle(title){
 if(!isRecord(title))throw Error('Invalid title style source.');
 const source={};
 for(const key of ALLOWED_LOOK)if(own(title,key))source[key]=title[key];
 return titleStyleLook(source);
}
export function titleStyleFields(look){
 return titleStyleLook(look);
}
export function titleLibraryValidate(data){
 if(!isRecord(data)||data.kind!==TITLE_LIBRARY_KIND||
    data.version!==TITLE_LIBRARY_VERSION||!Array.isArray(data.styles)||
    data.styles.length>TITLE_LIBRARY_MAX||
    Object.keys(data).some(key=>!['kind','version','styles'].includes(key)))
   throw Error('Invalid ParaCut title style library version or structure.');
 const ids=new Set(),names=new Set();
 const styles=data.styles.map(item=>{
   if(!isRecord(item)||Object.keys(item).sort().join(',')!=='id,look,name')
     throw Error('Invalid title style library entry.');
   const id=validId(item.id),name=validName(item.name);
   const key=name.toLocaleLowerCase('en');
   if(ids.has(id)||names.has(key))throw Error('Duplicate title style ID or name.');
   ids.add(id);names.add(key);
   return {id,name,look:titleStyleLook(item.look)};
 });
 return {kind:TITLE_LIBRARY_KIND,version:TITLE_LIBRARY_VERSION,styles};
}
export function titleLibraryEmpty(){
 return {kind:TITLE_LIBRARY_KIND,version:TITLE_LIBRARY_VERSION,styles:[]};
}
export function titleLibraryAdd(library,{id,name,look}){
 const previous=titleLibraryValidate(library);
 if(previous.styles.length>=TITLE_LIBRARY_MAX)
   throw Error('Title style library is full (24 saved looks).');
 const entry={id:validId(id),name:validName(name),look:titleStyleLook(look)};
 if(previous.styles.some(item=>item.id===entry.id))
   throw Error('Duplicate title style ID.');
 if(previous.styles.some(item=>item.name.toLocaleLowerCase('en')===
   entry.name.toLocaleLowerCase('en')))
   throw Error('A saved look already uses that name.');
 return titleLibraryValidate({...previous,styles:[...previous.styles,entry]});
}
export function titleLibraryDelete(library,id){
 const previous=titleLibraryValidate(library);
 validId(id);
 if(!previous.styles.some(item=>item.id===id))
   throw Error('Title look no longer exists.');
 return {...previous,styles:previous.styles.filter(item=>item.id!==id)};
}
export function titleLibraryFind(library,id){
 const previous=titleLibraryValidate(library);
 validId(id);
 const item=previous.styles.find(item=>item.id===id);
 if(!item)throw Error('Title look no longer exists.');
 return {id:item.id,name:item.name,look:{...item.look}};
}
export function titleLibrarySerialize(library){
 const normalized=titleLibraryValidate(library);
 const text=JSON.stringify(normalized,null,2);
 if(new TextEncoder().encode(text).length>TITLE_LIBRARY_MAX_BYTES)
   throw Error('Title style library exceeds 16 KB.');
 return text;
}
export function titleLibraryParse(raw){
 if(typeof raw!=='string'||new TextEncoder().encode(raw).length>TITLE_LIBRARY_MAX_BYTES)
   throw Error('Title style library exceeds 16 KB.');
 let decoded;
 try{decoded=JSON.parse(raw);}
 catch{throw Error('Title style library is not valid JSON.');}
 return titleLibraryValidate(decoded);
}
// Import is an atomic replacement, never a partial merge or silent overwrite.
export function titleLibraryReplace(current,raw){
 titleLibraryValidate(current);
 return titleLibraryParse(raw);
}
