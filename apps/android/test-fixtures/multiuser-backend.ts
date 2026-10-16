import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {buildApp} from '../../server/src/app.js';
const directory=mkdtempSync(join(tmpdir(),'m15-kotlin-backend-'));
const node=await buildApp({dataDir:directory});
const password='Generated-M15-fixture-only-01';
await node.accounts!.initialize('generated-admin',password);
const headers={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
const login=async(username:string)=>(await node.app.inject({url:'/api/auth/login',method:'POST',headers,payload:{username,password,mode:'client'}})).json();
const admin=await login('generated-admin');
for(const username of ['generated-a','generated-b']){
 const response=await node.app.inject({url:'/api/admin/accounts',method:'POST',headers:{...headers,authorization:'Bearer '+admin.token},payload:{username,password}});
 if(response.statusCode!==200)throw new Error(response.body);
}
const a=await login('generated-a'),b=await login('generated-b');
const address=await node.app.listen({host:'127.0.0.1',port:0});
process.stdout.write(JSON.stringify({address,admin,a,b,password})+'\n');
let closing=false;async function close(){if(closing)return;closing=true;await node.app.close();rmSync(directory,{recursive:true,force:true});process.exit(0);}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
