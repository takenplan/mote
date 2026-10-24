import {describe,it,expect} from 'vitest';
import {extractWechatPages,WECHAT_APP_ID,WECHAT_VERSION} from '../src/wechat-page';
import {uiPageText,type UiSnapshot} from '@mote/shared';
const at='2026-10-24T00:00:00.000Z',bounds={x:0,y:0,width:10,height:10};
const snapshot=():UiSnapshot=>({appId:WECHAT_APP_ID,appVersion:WECHAT_VERSION,activity:'',observedAt:at,truncated:false,nodes:[
 {id:'name',resourceId:'current_chat_name_label',role:'AXStaticText',text:'Generated conversation',bounds},
 {id:'count',resourceId:'current_chat_count_label',role:'AXStaticText',text:'3 members',bounds},
 {id:'list',resourceId:'chat_message_list',role:'AXList',text:'',bounds},
 {id:'row1',parentId:'list',childIndex:0,resourceId:'chat_bubble_item_view',role:'AXStaticText',text:'First generated message',bounds},
 {id:'row2',parentId:'list',childIndex:1,resourceId:'chat_bubble_item_view',role:'AXStaticText',text:'',description:'Generated attachment description',bounds},
]});
describe('versioned WeChat visible message evidence',()=>{
 it('keeps messages separate, description provenance and conversation while inventing no sender or platform ID',()=>{
  const pages=extractWechatPages(snapshot(),at);expect(pages).toHaveLength(2);
  expect(pages.map(uiPageText)).toEqual(['Generated conversation\n3 members\nFirst generated message','Generated conversation\n3 members\nGenerated attachment description']);
  expect(pages[1].objects[0].fields.find(f=>f.name==='description')?.values).toEqual([{text:'Generated attachment description',source:'description'}]);
  expect(pages.every(p=>p.adapterId==='macos.wechat.message'&&p.version===3&&p.observations.count===1)).toBe(true);
  for(const page of pages)expect(page.objects[0].fields.map(f=>f.name)).not.toEqual(expect.arrayContaining(['sender','message_id']));
 });
 it('reads generated AppKit text leaves beneath duplicate-ID blank wrappers and rejects multiple readable leaves',()=>{
  const value=snapshot();value.nodes.splice(0,1,{...value.nodes[0],id:'name-wrapper',role:'AXUnknown',text:''},{...value.nodes[0],parentId:'name-wrapper',childIndex:0});
  value.nodes.splice(2,1,{...value.nodes[2],id:'count-wrapper',role:'AXUnknown',text:''},{...value.nodes[2],parentId:'count-wrapper',childIndex:0});
  expect(extractWechatPages(value,at)).toHaveLength(2);
  value.nodes.push({id:'other-name',resourceId:'current_chat_name_label',role:'AXStaticText',text:'Different readable conversation',bounds});expect(extractWechatPages(value,at)).toEqual([]);
 });
 it('refuses unsupported versions, ambiguous scopes and uncertain sibling order',()=>{
  const wrong=snapshot();wrong.appVersion='4.1.16';expect(extractWechatPages(wrong,at)).toEqual([]);
  const ambiguous=snapshot();ambiguous.nodes.push({...ambiguous.nodes[2],id:'other-list'});expect(extractWechatPages(ambiguous,at)).toEqual([]);
  const bad=snapshot();bad.nodes[4].childIndex=0;expect(extractWechatPages(bad,at)).toEqual([]);
  const missing=snapshot();delete missing.nodes[3].childIndex;expect(extractWechatPages(missing,at)).toEqual([]);
 });
 it('never includes unrelated UI or aggregate parent descriptions',()=>{
  const value=snapshot();value.nodes[2].description='Generated aggregate private parent';value.nodes.push({id:'other',resourceId:'chat_bubble_item_view',role:'AXStaticText',text:'Generated unrelated sidebar',bounds});
  expect(extractWechatPages(value,at).map(uiPageText).join('\n')).not.toMatch(/aggregate|sidebar/);
 });
});
