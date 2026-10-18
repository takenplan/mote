import type {LarkCommand,LarkRunner} from '../../src/connectors/lark-cli.js';
import {ConnectorError} from '../../src/connectors/types.js';
import {larkDocumentJourneys,type LarkJourneyDocument} from './lark-document-journeys.js';

/** The upstream boundary is synthetic; all Mote HTTP/storage/model paths are real. */
export function larkJourneyRunner(options:{now?:()=>number}={}){
  const now=options.now??Date.now,providerAt=new Date(now()-3600000).toISOString();
  // Provider discovery dates are synthetic and remain inside the rolling test
  // window. The original authored/event dates stay explicit in each document.
  const documents=new Map<string,LarkJourneyDocument>(larkDocumentJourneys.map(item=>[item.document.id,{...item.document,createdAt:providerAt,modifiedAt:providerAt}]));
  const calls:LarkCommand[]=[];
  const failed=new Set<string>();
  const runner:LarkRunner=async(command,options={})=>{
    options.signal?.throwIfAborted();calls.push(command);
    switch(command.kind){
      case 'version':return 'lark-cli version 1.0.98';
      case 'status':return JSON.stringify({appId:'cli_generated_journey',identities:{user:{available:true,openId:'generated-owner-lincheng',userName:'生成角色林澄',scope:'docx:document:readonly wiki:wiki:readonly search:docs:read drive:drive:readonly calendar:calendar:readonly'}}});
      case 'login':return JSON.stringify({verification_url:'https://accounts.feishu.cn/authorize?generated=fixture-only',device_code:'generated-not-a-real-device-code',expires_in:600});
      case 'complete':return JSON.stringify({ok:true});
      case 'documents-search':{
        const rows=[...documents.values()].filter(doc=>doc.action===command.action&&
          Date.parse(command.start)<=Date.parse(doc.action==='created'?doc.createdAt:doc.modifiedAt)&&
          Date.parse(command.end)>Date.parse(doc.action==='created'?doc.createdAt:doc.modifiedAt));
        const offset=command.pageToken?Number(command.pageToken):0,page=rows.slice(offset,offset+3);
        return JSON.stringify({ok:true,data:{results:page.map(doc=>({title:doc.title,result_meta:{url:`https://fixture.feishu.cn/docx/${doc.id}`,token:doc.id}})),has_more:offset+3<rows.length,...(offset+3<rows.length?{page_token:String(offset+3)}:{})}});
      }
      case 'document':{
        const id=command.document.startsWith('https:')?new URL(command.document).pathname.split('/').at(-1)!:command.document;
        if(failed.has(id))throw new ConnectorError('lark_command_failed',502);
        const doc=documents.get(id);if(!doc)throw new ConnectorError('lark_document_not_found',404);
        return JSON.stringify({ok:true,data:{document:{document_id:doc.id,revision_id:doc.revision,title:doc.title,content:doc.content}}});
      }
      case 'folder-list':return JSON.stringify({data:{files:[],has_more:false}});
      case 'wiki-node':throw new ConnectorError('lark_document_not_found',404);
      case 'wiki-list':return JSON.stringify({data:{items:[],has_more:false}});
      case 'calendars':return JSON.stringify({data:{calendar_list:[],has_more:false}});
      case 'events':return JSON.stringify({data:{items:[]}});
      default:throw new Error('Unexpected generated journey command: '+command.kind);
    }
  };
  return {runner,calls,documents,failed,advance(){for(const item of larkDocumentJourneys)if(item.next)documents.set(item.document.id,{...documents.get(item.document.id)!,...item.next,modifiedAt:new Date(now()).toISOString(),action:'edited'});}};
}
