import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {writeMessagesResponse} from '../../../../scripts/fixtures/messages-provider.js';

/** External model I/O only. The real Ask Harness chooses tools, validates
 * citations, stores conversations/reports and checks every owner boundary. */
export async function generatedWebProvider(){
 const requests:{owner:string;model:string;tools:string[];foreign:boolean}[]=[];
 let held:string|undefined,release:(()=>void)|undefined;
 const server=createServer((req,res)=>{void(async()=>{
  let raw='';for await(const part of req)raw+=part;
  const body=JSON.parse(raw),owner=String(req.headers['x-api-key']).includes('_A_')?'A':'B';
  const uses=body.messages.flatMap((message:any)=>Array.isArray(message.content)?message.content.filter((part:any)=>part.type==='tool_use'):[]),stage=uses.length+1;
  const foreign=raw.includes('GENERATED_PRIVATE_'+(owner==='A'?'B':'A'));requests.push({owner,model:String(body.model),tools:uses.map((use:any)=>use.name),foreign});assert.equal(foreign,false,'provider must never receive the other generated account');
  if(!uses.some((use:any)=>use.name==='material_catalog')){writeMessagesResponse(res,{stage,tool:{name:'material_catalog',args:{limit:30}}});return;}
  const ref=raw.match(/material:mat_[a-f0-9]{64}@[a-f0-9]{64}/)?.[0];
  if(ref&&!uses.some((use:any)=>use.name==='material_read')){writeMessagesResponse(res,{stage,tool:{name:'material_read',args:{ref,length:12000}}});return;}
  if(held===owner){held=undefined;process.send?.({event:'provider-entered',owner});await new Promise<void>(resolve=>{release=resolve;});}
  const id=raw.match(/capture:([0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12})/)?.[1]??raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}/)?.[0];
  const answer='GENERATED_IAB_ANSWER_'+owner+(id?' ['+id+']':'');
  const report={title:'GENERATED_IAB_INSIGHT_'+owner,markdown:answer,html:'<main><h1>GENERATED_IAB_INSIGHT_'+owner+'</h1><p>'+answer+'</p></main>'};
  writeMessagesResponse(res,{stage,text:JSON.stringify({answer:raw.includes('GENERATED_IAB_INSIGHT_REQUEST')?JSON.stringify(report):answer,citationIds:id?[id]:[]})});
 })().catch(()=>res.destroy());});
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return {url:'http://127.0.0.1:'+(server.address() as {port:number}).port+'/v1',requests,hold:(owner:string)=>{held=owner;},release:()=>{release?.();release=undefined;},close:async()=>{release?.();await new Promise<void>(resolve=>server.close(()=>resolve()));}};
}
