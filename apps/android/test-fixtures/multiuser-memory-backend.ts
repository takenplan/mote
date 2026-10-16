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
const address=await fixture.node.app.listen({host:'127.0.0.1',port:0});
process.stdout.write(JSON.stringify({address,controlAddress:address,a:fixture.a,b:fixture.b,admin:fixture.admin,password:'Generated-memory-password-only-01',published,pid:process.pid})+'\n');
let closing=false;async function close(){if(closing)return;closing=true;for(const cleanup of cleanups.reverse())await cleanup();process.exit(0);}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
