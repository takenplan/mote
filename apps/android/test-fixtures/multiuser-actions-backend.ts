import {type TestContext} from 'node:test';
import {modelFixture,event} from '../../server/test/fixtures/scoped-actions.js';
import {password,waitForState,item} from '../../server/test/fixtures/scoped-query-accounts.js';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.js';

// Reuse M12's actual M01/M03/M04/M05/M08 producer and generated HTTP model.
// No proposal SQL, native calendar, system permissions or external provider.
const cleanups:Array<()=>unknown>=[];
const f=await modelFixture({after:(callback:()=>unknown)=>cleanups.push(callback)} as unknown as TestContext);
for(const [actor,label,count] of [[f.a,'A',21],[f.b,'B',2]] as const){
 const quotes=Array.from({length:count},(_,index)=>'GENERATED_'+label+'_PRIVATE_APPOINTMENT #'+index);
 f.scripts.set(label,(body,_raw,res)=>{
  const envelope=JSON.parse(typeof body.messages[0].content==='string'?body.messages[0].content:body.messages[0].content[0].text);
  const uses=body.messages.flatMap((message:any)=>Array.isArray(message.content)?message.content.filter((part:any)=>part.type==='tool_use'):[]);
  const id=envelope.untrustedEvidence[0].id;
  if(!uses.some((use:any)=>use.name==='evidence'))return writeMessagesResponse(res,{stage:uses.length+1,tool:{name:'evidence',args:{ids:[id]}}});
  writeMessagesResponse(res,{stage:uses.length+1,text:JSON.stringify({answer:JSON.stringify({actions:quotes.map((quote,index)=>({kind:'calendar.create',event:{...event,title:'Generated '+label,description:'Generated fixture appointment '+index},uncertainty:'Generated proposal',sameAs:null,evidence:[{id,quote}]}))}),citationIds:[id]})});
 });
 // One genuine original explicitly lists all appointments. The fake model
 // returns them together; M08/M12 still verify every quote and publish every
 // proposal. Pagination does not need 21 independent extraction jobs.
 const receipt=await f.ok(actor.token,'/api/ingress/sources/same-source/items','POST',{batchId:'native-actions-'+label,items:[item(quotes.join('\n'),'generated-native-actions')]});
 await waitForState(async()=>f.read(db=>Boolean(db.prepare('SELECT 1 FROM pd_materials h JOIN pd_material_captures c ON c.user_id=h.user_id AND c.material_id=h.id AND c.revision=h.revision WHERE h.user_id=? AND c.capture_id=? AND h.sequence>=h.min_visible_sequence').get(actor.userId,receipt.captures[0].id))),value=>value,'actual native Actions formal Material');
 await f.enable(actor);
 await waitForState(()=>f.ok(actor.token,'/api/actions?limit=100'),value=>value.items.length===count,'generated native Actions publication',180000);
}
const address=await f.node.app.listen({host:'127.0.0.1',port:0});
process.stdout.write(JSON.stringify({address,controlAddress:address,a:f.a,b:f.b,admin:f.admin,password,pid:process.pid,actions:{a:21,b:2}})+'\n');
let closing=false;
async function close(){if(closing)return;closing=true;for(const cleanup of cleanups.reverse())await cleanup();process.exit(0);}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
