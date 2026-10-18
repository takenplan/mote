import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const entry=process.env.MOTE_PROCESSING_PROCESS_ENTRY??fileURLToPath(new URL('../src/app.ts',import.meta.url));
test('actual process death and natural M05 lease recovery retain A/B ASR checkpoints, media snapshots and private Material publication',async t=>{
 const root=mkdtempSync(join(tmpdir(),'mote-m06-process-')),script=join(root,'journey.mjs'),receipt=join(root,'receipt.json');let restarted=false,extracts=0,diarizes=0;
 const server=createServer((req,res)=>{void(async()=>{for await(const _ of req){}res.setHeader('X-Mote-Execution','local');if(req.url==='/transcribe'){extracts++;res.end(JSON.stringify({durationMs:1000,segments:[{startMs:0,endMs:1000,text:'GENERATED_EQUAL_ASR_EVIDENCE'}],engine:'generated-asr'}));}else if(req.url==='/diarize'){diarizes++;if(!restarted){res.writeHead(503,{'Retry-After':'30','X-Mote-Execution-Started':'false'});res.end('Generated dependency wait');}else res.end(JSON.stringify({durationMs:1000,engine:'generated-diarizer',expectedSpeakers:null,observedSpeakers:1,overlapDetection:'unknown',segments:[{startMs:0,endMs:1000,speaker:'SPEAKER_0'}],samples:[],warnings:[]}));}else res.writeHead(404).end();})().catch(()=>res.destroy());});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');
 const children:ReturnType<typeof spawn>[]=[];t.after(async()=>{for(const child of children)if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');await new Promise<void>(resolve=>server.close(()=>resolve()));rmSync(root,{recursive:true,force:true});});
 const settings=fileURLToPath(new URL('../src/model-settings.ts',import.meta.url));
 writeFileSync(script,`
import {buildApp} from ${JSON.stringify('file://'+entry)};
import {defaultModelSettings} from ${JSON.stringify('file://'+settings)};
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync} from 'node:fs';
const directory=${JSON.stringify(join(root,'vault'))},node=await buildApp({dataDir:directory}),db=new DatabaseSync(directory+'/mote.sqlite'),protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
const request=async(token,url,method='GET',payload)=>{const response=await node.app.inject({url,method,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});if(response.statusCode!==200)throw Error(url+' '+response.statusCode+' '+response.body);return response.json();};
const configure=async(token,domain,value)=>request(token,'/api/configuration/'+domain,'PUT',{revision:(await request(token,'/api/configuration')).revision,value});
const model=(key,name)=>({profiles:[{id:'same-profile',name:'Generated media',settings:{...defaultModelSettings(),provider:'custom',protocol:'mote-media',baseUrl:${JSON.stringify('http://127.0.0.1:'+address.port+'/transcribe')},model:name,apiKey:key,reasoningEffort:'auto'}}],selections:{asr:{kind:'personal',id:'same-profile'}}});
const until=async(check)=>{const end=Date.now()+65000;while(!await check()){if(Date.now()>end)throw Error('Generated recovery deadline');await new Promise(resolve=>setTimeout(resolve,10));}};
let saved;
try{
 if(process.env.GENERATED_M06_PHASE==='first'){
  const password='Generated-process-m06-01';await node.accounts.initialize('generated-admin',password);const admin=await request(undefined,'/api/auth/login','POST',{username:'generated-admin',password,mode:'client'});saved=[];
  for(const label of ['a','b']){
   const username='generated-'+label,account=await request(admin.token,'/api/admin/accounts','POST',{username,password}),login=await request(undefined,'/api/auth/login','POST',{username,password,mode:'client'}),token=login.token;
   await configure(token,'models',model('GENERATED_'+label+'_KEY','admitted-media'));
   await configure(token,'processing',{enabled:true,automatic:false,audioProcessor:'audio.local-dialogue',diarizationProcessor:'audio.diarize',speakerCount:null,speakerMin:null,speakerMax:null,maxAudioMinutes:120,timeoutMs:3600000});
   await request(token,'/api/ingress/sources','POST',{id:'same-source',name:'Generated source',kind:'local-files',deviceId:'same-device',platform:'import',retention:'archive'});
   const bytes=Buffer.from('GENERATED_EQUAL_WAV_BYTES'),hash=createHash('sha256').update(bytes).digest('hex'),upload=await request(token,'/api/ingress/sources/same-source/uploads','POST',{batchId:'same-batch',revision:{sourceId:'same-source',item:{externalId:'same-file',revision:'same-revision',observedAt:'2026-10-15T00:00:00Z',title:'Generated ASR',text:'',kind:'file',layer:'original',mimeType:'audio/wav'},sizeBytes:bytes.length,sha256:hash,relativePath:'generated.wav'}});
   await request(token,'/api/ingress/uploads/'+upload.id+'/parts/0','PUT',{bytes:bytes.toString('base64'),checksum:hash});const received=await request(token,'/api/ingress/uploads/'+upload.id+'/commit','POST',{}),ref=received.captures[0].original.ref,task=await request(token,'/api/processing','POST',{originalRef:ref,operationId:'same-operation'});saved.push({token,userId:account.userId,ref,taskId:task.id});
  }
  await until(()=>Number(db.prepare("SELECT count(*) n FROM execution_steps WHERE kind='processing.asr' AND state='waiting' AND error='provider_unavailable'").get().n)===2);
  await configure(saved[0].token,'models',model('GENERATED_a_KEY','current-media'));
  writeFileSync(${JSON.stringify(receipt)},JSON.stringify(saved));console.log(JSON.stringify({phase:'ready',checkpoints:Number(db.prepare('SELECT count(*) n FROM mp_artifacts').get().n)}));setInterval(()=>{},1000);await new Promise(()=>{});
 }else{
  saved=JSON.parse(readFileSync(${JSON.stringify(receipt)},'utf8'));await node.app.ready();
  await until(async()=>{for(const item of saved)if((await request(item.token,'/api/tasks/'+item.taskId)).state!=='succeeded')return false;return true;});
  const artifacts=[];for(const item of saved){const state=await request(item.token,'/api/processing/originals/'+item.ref.slice(9));if(!state.saved||!state.processed||!state.indexed)throw Error('Invalid recovered phase state');const text=await request(item.token,'/api/materials/'+state.materialId+'/read');if(text.text!=='GENERATED_EQUAL_ASR_EVIDENCE')throw Error('Recovered evidence changed');const usage=await request(item.token,'/api/usage');if(usage.items.length!==2||usage.items.some(item=>item.status!=='completed'||item.operation!=='asr'||item.model!=='admitted-media'))throw Error('Original ASR and diarization consumption fragments were not retained');if(new Set(usage.items.map(item=>item.id)).size!==2||new Set(usage.items.map(item=>item.attribution.requestId)).size!==2)throw Error('Independent media requests reused a usage fragment identity');artifacts.push(state.artifactId);}
  const foreign=await node.app.inject({url:'/api/processing/artifacts/'+artifacts[0],headers:{...protocol,authorization:'Bearer '+saved[1].token}});if(foreign.statusCode!==404||artifacts[0]===artifacts[1])throw Error('Recovered artifact owner mismatch');
  console.log(JSON.stringify({phase:'recovered',users:saved.length,foreign:foreign.statusCode}));
 }
}finally{db.close();await node.app.close();}
 `);
 const launch=(phase:string)=>{const child=spawn(process.execPath,['--import','tsx',script],{env:{...process.env,GENERATED_M06_PHASE:phase},stdio:['ignore','pipe','pipe']});children.push(child);let output='',errors='';child.stderr!.on('data',part=>errors+=String(part).slice(0,8192));const closed=new Promise<{code:number|null;signal:NodeJS.Signals|null}>(resolve=>child.once('close',(code,signal)=>resolve({code,signal})));return {child,closed,ready:new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Generated M06 process timeout '+errors));},75000);child.once('error',reject);child.once('exit',code=>{if(code!==0){clearTimeout(timer);reject(Error('Generated process exited '+code+' '+errors));}});child.stdout!.on('data',part=>{output+=part;for(const line of output.split('\n'))try{const value=JSON.parse(line);if(value.phase==='ready'||value.phase==='recovered'){clearTimeout(timer);resolve(value);}}catch{}});})};};
 const first=launch('first');assert.deepEqual(await first.ready,{phase:'ready',checkpoints:2});first.child.kill('SIGKILL');assert.equal((await first.closed).signal,'SIGKILL');restarted=true;const second=launch('second');assert.deepEqual(await second.ready,{phase:'recovered',users:2,foreign:404});assert.equal((await second.closed).code,0);assert.equal(extracts,2,'completed ASR must not replay after actual death');assert.equal(diarizes,4,'only the interrupted dependency is retried');
});
