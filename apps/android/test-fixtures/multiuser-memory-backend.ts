import {createServer} from 'node:http';
import type {TestContext} from 'node:test';
import {scopedMemoryFixture} from '../../server/test/fixtures/scoped-memory-host.js';
const cleanups:Array<()=>unknown>=[];
const fixture=await scopedMemoryFixture({after:(callback:()=>unknown)=>cleanups.push(callback)} as unknown as TestContext);
const published:Record<string,{memoryId:string;materialId:string;revision:string}>={};
for(const [name,label,user] of [['a','A',fixture.a],['b','B',fixture.b]] as const){
 const view=(await fixture.request(user.token,'/api/configuration')).json();
 await fixture.replace(user.token,'memory',{...view.domains.find((domain:any)=>domain.id==='memory').saved,automatic:false,integration:false});
 const material=await fixture.publish(user,label),job=await fixture.submit(user,[material.id]);
 await fixture.wait(user,job.id);
 const page=(await fixture.request(user.token,'/api/memories?limit=30')).json();
 if(page.items.length!==1)throw Error('Expected one generated published Memory');
 published[name]={memoryId:page.items[0].id,materialId:material.id,revision:material.revision};
}
// External HTTP fault boundary only; all application requests still enter the real Fastify app.
const admissions:Array<{token:string;body:unknown}>=[],loseNext=new Set<string>();
const http=createServer(async(req,res)=>{
 try {
  const token=String(req.headers.authorization??'').replace(/^Bearer /,'');
  let raw='';for await(const chunk of req)raw+=chunk;
  if(req.url==='/api/test/m15/memory-admissions') {
   if(![fixture.a.token,fixture.b.token].includes(token)){res.writeHead(401).end();return;}
   if(req.method==='POST'){loseNext.add(token);res.writeHead(200,{'Content-Type':'application/json'}).end('{}');return;}
   res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({items:admissions.filter(item=>item.token===token).map(item=>item.body)}));return;
  }
  const admission=req.method==='POST'&&req.url==='/api/memory/jobs';
  if(admission)admissions.push({token,body:JSON.parse(raw)});
  const response=await fixture.node.app.inject({method:req.method as any,url:req.url!,headers:req.headers,...(raw?{payload:raw}:{})});
  if(admission&&response.statusCode===200&&loseNext.delete(token)){res.writeHead(503,{'Content-Type':'application/json'}).end('{"error":"generated_lost_admission_ack"}');return;}
  res.writeHead(response.statusCode,response.headers);res.end(response.rawPayload);
 } catch {res.writeHead(500,{'Content-Type':'application/json'}).end('{"error":"generated_fixture_fault"}');}
});
await new Promise<void>(resolve=>http.listen(0,'127.0.0.1',resolve));
cleanups.push(()=>new Promise<void>((resolve,reject)=>http.close(error=>error?reject(error):resolve())));
const address='http://127.0.0.1:'+(http.address() as {port:number}).port;
process.stdout.write(JSON.stringify({address,controlAddress:address,a:fixture.a,b:fixture.b,admin:fixture.admin,password:'Generated-memory-password-only-01',published,pid:process.pid})+'\n');
let closing=false;async function close(){if(closing)return;closing=true;for(const cleanup of cleanups.reverse())await cleanup();process.exit(0);}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
