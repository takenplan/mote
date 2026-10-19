/** One generated public-HTTP locator smoke. No Electron, model or personal data. */
const {fork,execFileSync}=require('node:child_process');
const {mkdirSync,writeFileSync,readFileSync}=require('node:fs');
const {join,resolve}=require('node:path');
const {createHash}=require('node:crypto');
const repo=resolve(__dirname,'../../..'),output=process.env.MOTE_WEB_LOCATOR_OUTPUT;
if(!output)throw Error('Explicit external smoke output is required');
mkdirSync(output,{recursive:true});
const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8'}).trim();
const candidate=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}');
if(candidate!==process.env.MOTE_WEB_FIXTURE_EXPECTED_HEAD||git('status','--porcelain'))throw Error('Clean exact frozen source is required');
const sourceSha256=Object.fromEntries(['apps/web/test/fixtures/multiuser-host.ts','apps/web/test/login-evidence-locator-smoke.cjs'].map(path=>[path,createHash('sha256').update(readFileSync(join(repo,path))).digest('hex')]));
let phase='generated-host-start',ready=false,next=0,passed=false,closed=false,exitState,hostError=false;const stages=[],pending=new Map();
const host=fork(join(__dirname,'fixtures/multiuser-host.ts'),[],{cwd:repo,execPath:process.execPath,execArgv:['--import','tsx'],stdio:['ignore','ignore','ignore','ipc']});
const exited=new Promise(resolve=>host.once('exit',(code,signal)=>{exitState={code,signal};resolve(exitState);}));host.on('error',()=>{hostError=true;});
host.on('message',message=>{if(message.id){const request=pending.get(message.id);pending.delete(message.id);if(request){clearTimeout(request.timer);message.error?request.reject(Error('LOCATOR_OPERATION_FAILED')):request.resolve(message.result);}}else if(message.event==='ready')ready=true;else if(message.event==='locator-stage'){stages.push(message);console.log(JSON.stringify(message));}});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function command(command){return new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error('LOCATOR_COMMAND_TIMEOUT'));},30000);pending.set(id,{resolve,reject,timer});host.send({id,command});});}
(async()=>{
 try{const deadline=Date.now()+25000;while(!ready){if(hostError||exitState||Date.now()>=deadline)throw Error('LOCATOR_HOST_UNAVAILABLE');await delay(20);}phase='public-canonical-locator';const targets=await command('evidence-targets');passed=targets.sameRawPublicId===true&&targets.crossOwnerCanonicalStatus===404&&targets.a.reference!==targets.b.reference;if(!passed)throw Error('LOCATOR_IDENTITY_FAILED');phase='locator-complete';}
 catch{passed=false;}
 finally{if(!exitState){try{const ack=await command('close'),state=await Promise.race([exited,delay(5000).then(()=>null)]);closed=ack===true&&state?.code===0&&state?.signal===null;}catch{}if(!closed&&!exitState){host.kill('SIGKILL');await exited;}}const sourceUnchanged=git('rev-parse','HEAD')===candidate&&git('status','--porcelain')==='';passed=passed&&closed&&sourceUnchanged;writeFileSync(join(output,'result.json'),JSON.stringify({candidate,tree,sourceSha256,classification:passed?'PUBLIC_LOCATOR_CONTRACT_PASS':'FIRST_SMOKE_FAILURE_NO_AUTO_RETRY',passed,phase,stages,hostPid:host.pid,hostExit:exitState,hostClosedNaturally:closed,freshGeneratedHostProfileRemoved:closed,sourceUnchanged,generatedOnly:true,publicHttp:true,electron:false,modelCalls:false,browserProof:false},null,2)+'\n');console.log(JSON.stringify({stage:'locator-smoke-finished',passed,hostClosedNaturally:closed,sourceUnchanged}));process.exitCode=passed?0:1;}
})();
