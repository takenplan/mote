import {namedPage,uiSnapshotSchema,type UiPageV3,type UiSnapshot} from '@mote/shared';

export const WECHAT_APP_ID='com.tencent.xinWeChat';
export const WECHAT_VERSION='4.1.15';
/** Versioned AX IDs are observed fields only; row order is local to this snapshot. */
export function extractWechatPages(input: UiSnapshot, at: string): UiPageV3[] {
  const snapshot=uiSnapshotSchema.parse(input);
  if(snapshot.appId!==WECHAT_APP_ID||snapshot.appVersion!==WECHAT_VERSION)return [];
  const byId=new Map(snapshot.nodes.map(node=>[node.id,node]));
  const matching=(id:string)=>snapshot.nodes.filter(node=>node.resourceId===id);
  const readable=(id:string)=>matching(id).filter(node=>node.text.trim()&&!snapshot.nodes.some(child=>child.parentId===node.id));
  const lists=matching('chat_message_list'),names=readable('current_chat_name_label');
  if(lists.length!==1||names.length!==1||!names[0].text.trim())return [];
  const root=lists[0],within=(node:UiSnapshot['nodes'][number],ancestor:string):boolean=>{
    for(let cursor:UiSnapshot['nodes'][number]|undefined=node;cursor;cursor=cursor.parentId?byId.get(cursor.parentId):undefined)if(cursor.id===ancestor)return true;
    return false;
  };
  const bubbles=matching('chat_bubble_item_view').filter(node=>within(node,root.id));
  if(bubbles.length>64)return [];
  const counts=readable('current_chat_count_label');if(counts.length>1)return [];
  const siblingIndices=new Map<string,Set<number>>();
  for(const node of snapshot.nodes.filter(node=>within(node,root.id)&&node.id!==root.id)){
    if(node.childIndex===undefined||!node.parentId)return [];
    const indices=siblingIndices.get(node.parentId)??new Set<number>();
    if(indices.has(node.childIndex))return [];
    indices.add(node.childIndex);siblingIndices.set(node.parentId,indices);
  }
  const path=(node:UiSnapshot['nodes'][number]):number[]=>{const parts:number[]=[];for(let cursor:UiSnapshot['nodes'][number]|undefined=node;cursor&&cursor.id!==root.id;cursor=cursor.parentId?byId.get(cursor.parentId):undefined)parts.unshift(cursor.childIndex!);return parts;};
  bubbles.sort((a,b)=>{const left=path(a),right=path(b);for(let i=0;i<Math.min(left.length,right.length);i++)if(left[i]!==right[i])return left[i]-right[i];return left.length-right.length;});
  return bubbles.flatMap(bubble=>{
    const observed=snapshot.nodes.filter(node=>within(node,bubble.id));
    const values=(key:'text'|'description'|'state')=>observed.filter(node=>node[key]?.trim()&&(key!=='description'||!snapshot.nodes.some(child=>child.parentId===node.id))).map(node=>({text:node[key]!,source:key}));
    const text=values('text'),description=values('description'),state=values('state');
    if(!text.length&&!description.length&&!state.length)return [];
    const fields=[{name:'conversation',values:[{text:names[0].text,source:'text' as const}]},...(counts[0]?.text.trim()?[{name:'conversation_count',values:[{text:counts[0].text,source:'text' as const}]}]:[]),...(text.length?[{name:'text',values:text}]:[]),...(description.length?[{name:'description',values:description}]:[]),...(state.length?[{name:'state',values:state}]:[])];
    return [namedPage(snapshot,{id:'macos.wechat.message',version:'1',kind:'message'},fields,at)];
  });
}
