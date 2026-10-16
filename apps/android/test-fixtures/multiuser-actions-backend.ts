import {type TestContext} from 'node:test';
import {modelFixture} from '../../server/test/fixtures/scoped-actions.js';
import {password,waitForState} from '../../server/test/fixtures/scoped-query-accounts.js';

// Reuse M12's actual M01/M03/M04/M05/M08 producer and generated HTTP model.
// No proposal SQL, native calendar, system permissions or external provider.
const cleanups:Array<()=>unknown>=[];
const f=await modelFixture({after:(callback:()=>unknown)=>cleanups.push(callback)} as unknown as TestContext);
for(const [actor,label,count] of [[f.a,'A',21],[f.b,'B',2]] as const){
 for(let index=0;index<count;index++)await f.ingest(actor,label,'generated-native-action-'+index);
 await f.enable(actor);
 // The real single executor intentionally processes these 21 independent jobs
 // in sequence. Its observed ~5.5s/job exceeds the former 90s setup budget.
 await waitForState(()=>f.ok(actor.token,'/api/actions?limit=100'),value=>value.items.length===count,'generated native Actions publication',180000);
}
const address=await f.node.app.listen({host:'127.0.0.1',port:0});
process.stdout.write(JSON.stringify({address,controlAddress:address,a:f.a,b:f.b,admin:f.admin,password,pid:process.pid,actions:{a:21,b:2}})+'\n');
let closing=false;
async function close(){if(closing)return;closing=true;for(const cleanup of cleanups.reverse())await cleanup();process.exit(0);}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
