import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildApp} from '../../server/src/app.js';
import {codexModels} from '../../server/src/model-catalog.js';
import {defaultModelDomain,defaultModelSettings} from '../../server/src/model-settings.js';
import {DEPLOYMENT_MODEL_PROFILE_ID} from '@mote/shared/models';
import {queryHttp,queryAccounts,password} from '../../server/test/fixtures/scoped-query-accounts.js';

// Explicit opt-in live regression. Existing local Codex login only; no model
// replacement or provider credentials are created. The host, Mote accounts and question are
// generated. Never point this fixture at a real central data directory.
if(process.env.MOTE_M15_CODEX_REGRESSION!=='1')throw Error('Explicit generated-data Codex regression opt-in required');
const model='gpt-6.1-sol',catalog=await codexModels(undefined,{executable:'/opt/homebrew/bin/codex'});
if(!catalog.items.some(item=>item.id===model))throw Error('Requested local Codex model unavailable; no fallback');
const directory=mkdtempSync(join(tmpdir(),'m15-live-codex-regression-'));
const host=await buildApp({dataDir:directory}),{ok}=queryHttp(()=>host),{admin,a,b}=await queryAccounts(host,ok);
const view=await ok(admin.token,'/api/admin/configuration/models');
await ok(admin.token,'/api/admin/configuration/models','PUT',{revision:view.revision,value:{...defaultModelDomain(),deployment:{...defaultModelSettings(),provider:'codex',protocol:'codex-app-server',baseUrl:'',model,apiKey:'',reasoningEffort:'low',serviceTier:'fast',modelRequestTimeoutMs:null,agentTimeoutMs:null}}});
for(const actor of [a,b]){
 let view=await ok(actor.token,'/api/configuration');const processing=view.domains.find((domain:any)=>domain.id==='processing').effective;
 await ok(actor.token,'/api/configuration/processing','PUT',{revision:view.revision,value:{...processing,automatic:false,summarize:false,semanticTurns:false,understandingEnabled:false}});
 view=await ok(actor.token,'/api/configuration');const memory=view.domains.find((domain:any)=>domain.id==='memory').effective;
 await ok(actor.token,'/api/configuration/memory','PUT',{revision:view.revision,value:{...memory,automatic:false,integration:false,lifecycle:{...memory.lifecycle,insights:{...memory.lifecycle.insights,enabled:false},working:{...memory.lifecycle.working,enabled:false},consolidation:{...memory.lifecycle.consolidation,enabled:false}}}});
 view=await ok(actor.token,'/api/configuration');await ok(actor.token,'/api/configuration/models','PUT',{revision:view.revision,value:{profiles:[],selections:{chat:{kind:'shared',id:DEPLOYMENT_MODEL_PROFILE_ID}}}});
}
const address=await host.app.listen({host:'127.0.0.1',port:0});
process.stdout.write(JSON.stringify({address,controlAddress:address,a,b,admin,password,model,pid:process.pid})+'\n');
let closing=false;async function close(){if(closing)return;closing=true;await host.app.close();rmSync(directory,{recursive:true,force:true});process.exit(0);}
process.on('SIGINT',()=>void close());process.on('SIGTERM',()=>void close());
