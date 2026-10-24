import type {UiContentObject,UiPageV3} from '@mote/shared';

/** Generated legacy fixture descriptions become the current producer shape. */
export function structuredObject(object:UiContentObject):UiPageV3['objects'][number]{
  return {kind:object.kind,fields:Object.entries(object).filter(([name])=>!['kind','identity'].includes(name)).flatMap(([name,value])=>{
    const texts=name==='body'?(value as {text:string}[]).map(part=>part.text):typeof value==='string'?[value]:[];
    return texts.length?[{name:name==='itemId'?'item_id':name,values:texts.map(text=>({text,source:'text' as const}))}]:[];
  })};
}
