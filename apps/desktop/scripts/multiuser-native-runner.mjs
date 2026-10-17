import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {buildApp} from '../../server/src/app.ts';
import {createServer} from 'node:http';
import {createHash,randomUUID} from 'node:crypto';
import {respond as actionResponse} from '../../server/test/fixtures/scoped-actions.ts';
import {defaultModelSettings} from '../../server/src/model-settings.ts';
import {defaultMemorySettings} from '../../server/src/scope/memory-schema.ts';
import {defaultProcessingSettings} from '../../server/src/scope/processing-schema.ts';
import {writeMessagesResponse} from '../../../scripts/fixtures/messages-provider.ts';
const repository=fileURLToPath(new URL('../../../',import.meta.url));process.chdir(repository);
const require=createRequire(import.meta.url),electron=require('electron'),directory=await mkdtemp(join(tmpdir(),'mote-m14-native-')),profile=join(directory,'profile'),password='Generated-native-Desktop-01';
let child,node;const protocol={'x-mote-protocol-version':'2','x-mote-ingress-version':'3'};
const providerRequests=[];
const provider=createServer((req,res)=>{void(async()=>{let raw='';for await(const part of req)raw+=part;const body=JSON.parse(raw);providerRequests.push({key:req.headers['x-api-key'],raw});try{const first=body.messages[0].content,envelope=JSON.parse(typeof first==='string'?first:first[0].text);if(envelope.untrustedEvidence){actionResponse(body,raw,res,'A');return;}}catch{}
 const uses=body.messages.flatMap(message=>Array.isArray(message.content)?message.content.filter(part=>part.type==='tool_use'):[]),stage=uses.length+1;
 if(!uses.some(use=>use.name==='material_catalog'))return writeMessagesResponse(res,{stage,tool:{name:'material_catalog',args:{limit:30}}});
 const ref=raw.match(/material:mat_[a-f0-9]{64}@[a-f0-9]{64}/)?.[0];if(ref&&!uses.some(use=>use.name==='material_read'))return writeMessagesResponse(res,{stage,tool:{name:'material_read',args:{ref,length:12000}}});
 const id=raw.match(/capture:([0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12})/)?.[1];writeMessagesResponse(res,{stage,text:JSON.stringify({answer:'Generated native Ask answer'+(id?' ['+id+']':''),citationIds:id?[id]:[]})});})().catch(()=>res.destroy());});
try{
 await new Promise(resolve=>provider.listen(0,'127.0.0.1',resolve));
 node=await buildApp({dataDir:join(directory,'central')});await node.accounts.initialize('generated-admin',password);
 const request=(token,url,method='GET',payload)=>node.app.inject({url,method,headers:{...protocol,...(token?{authorization:'Bearer '+token}:{})},...(payload===undefined?{}:{payload})});
 const login=async(username)=>{const r=await request(undefined,'/api/auth/login','POST',{username,password,mode:'client'});assert.equal(r.statusCode,200,r.body);return r.json();};
 const admin=await login('generated-admin');for(const username of ['generated-a','generated-b'])assert.equal((await request(admin.token,'/api/admin/accounts','POST',{username,password})).statusCode,200);
 const users={a:await login('generated-a'),b:await login('generated-b')};
 const configure=async(domain,value)=>{const view=await request(users.a.token,'/api/configuration'),saved=await request(users.a.token,'/api/configuration/'+domain,'PUT',{revision:view.json().revision,value});assert.equal(saved.statusCode,200,saved.body);};
 await configure('models',{profiles:[{id:'generated-native-model',name:'Generated native provider',settings:{...defaultModelSettings(),provider:'custom',protocol:'anthropic-messages',model:'generated-native',baseUrl:'http://127.0.0.1:'+provider.address().port+'/v1',apiKey:'GENERATED_A_NATIVE_KEY',headers:{},extraBody:{}}}],selections:{chat:{kind:'personal',id:'generated-native-model'},memory:{kind:'personal',id:'generated-native-model'}}});await configure('memory',{...defaultMemorySettings(),automatic:false});await configure('processing',{...defaultProcessingSettings(),automatic:false,understandingEnabled:false});
 const sourceId='generated-native-evidence',externalId='same-original',source={id:sourceId,name:'Generated',kind:'custom',deviceId:'generated-context-device',platform:'import',retention:'snapshot'};assert.equal((await request(users.a.token,'/api/ingress/sources','POST',source)).statusCode,200);
 const producer=node.ingress.bindSource(await node.authority.authenticate(users.a.token),[sourceId],()=>{}),capture=producer.receiveSourceItems(sourceId,'generated-native-batch',[{externalId,revision:'generated-revision',observedAt:'2026-01-01T00:00:00Z',title:'Generated A original',text:'GENERATED_A_PRIVATE_APPOINTMENT',kind:'file',layer:'original'}]).captures[0];const materialDraft={id:'mat_'+createHash('sha256').update(JSON.stringify([sourceId,externalId])).digest('hex'),kind:'document',schemaVersion:1,title:'Generated native Material',origin:{sourceId,externalId},members:[{id:'original',kind:'capture',ref:'capture:'+capture.id}],blocks:[{id:'body',kind:'text',format:'plain',text:'GENERATED_A_PRIVATE_APPOINTMENT',memberIds:['original']}],coverage:{state:'complete'},fidelity:{state:'lossless'},retention:{original:'retained',policy:'keep'}};const material=producer.publishMaterial(materialDraft);
 async function launch(){
  child=spawn(electron,[resolve('apps/desktop/scripts/multiuser-native.cjs'),profile],{cwd:process.cwd(),env:{...process.env,MOTE_PROFILE:'default'},stdio:['ignore','pipe','pipe','ipc']});
  const running=child,pending=new Map(),nativeCalls=[];let next=0,error='',loaded=0,exited=false,opened;
  running.stderr.on('data',chunk=>{error+=chunk.toString();});running.stdout.on('data',chunk=>process.stdout.write(chunk));running.on('exit',()=>{exited=true;});
  running.on('message',async message=>{if(message.type==='generated-calendar')nativeCalls.push(message);if(message.type==='open-browser')opened=message.url;if(message.type==='loaded')loaded++;if(message.type==='result'){const task=pending.get(message.id);pending.delete(message.id);if(message.error)task?.reject(Error(message.error));else task?.resolve(message.value);}if(message.type==='fetch')try{const url=new URL(message.url),r=await node.app.inject({url:url.pathname+url.search,method:message.method,headers:message.headers,...(message.body?{payload:Buffer.from(message.body,'base64')}:{})});if(!exited)running.send({type:'fetch-response',id:message.id,status:r.statusCode,headers:r.headers,body:r.rawPayload.toString('base64')});}catch(cause){if(!exited)running.send({type:'fetch-response',id:message.id,error:String(cause)});}});
  const js=code=>new Promise((resolve,reject)=>{if(exited)return reject(Error('Desktop exited: '+error));const id=++next;pending.set(id,{resolve,reject});running.send({type:'execute',id,code});});
  const until=async(read,accept,label)=>{const deadline=Date.now()+20000;let last;for(;;){if(exited)throw Error('Desktop exited '+label+': '+error);try{last=await read();if(accept(last))return last;}catch(cause){last=String(cause);}assert(Date.now()<deadline,label+': '+JSON.stringify(last)+' '+error);await delay(20);}};
  await until(()=>Promise.resolve(loaded),value=>value>0,'initial document load');await until(()=>js('Boolean(window.mote&&document.querySelector("#ask-login"))'),Boolean,'real preload and renderer');
  return {running,js,until,nativeCalls,get opened(){return opened;},status:()=>js('window.mote.status()'),async login(label){await js(`(()=>{document.querySelector('#ask-username').value='generated-${label}';document.querySelector('#ask-password').value=${JSON.stringify(password)};document.querySelector('#ask-login').click();return true;})()`);return until(()=>js('window.mote.status()'),value=>value.config.account?.userId===users[label].userId,'login '+label);},async kill(){running.kill('SIGKILL');await new Promise(resolve=>running.once('exit',resolve));}};
 }
 let desktop=await launch();await desktop.js('(async()=>{const s=await window.mote.status();await window.mote.configure({...s.config,syncMode:"manual",metadataEnabled:false,defaultCollection:"activity"});})()').catch(()=>{});await desktop.login('a');await desktop.js('(async()=>{const s=await window.mote.status();await window.mote.configure({...s.config,syncMode:"manual",metadataEnabled:false});})()');
 await desktop.js('document.querySelector("#ask-central").click();true');await desktop.until(()=>desktop.js('!document.querySelector("#ask-send").disabled'),Boolean,'Ask controls ready');await desktop.js('document.querySelector("#ask-question").value="Generated canonical question";document.querySelector("#ask-form").requestSubmit();true');await desktop.until(()=>desktop.js('Boolean(document.querySelector("#ask-messages .ask-evidence button"))'),Boolean,'actual Ask publication and citation');await desktop.js('document.querySelector("#ask-messages .ask-evidence button").click();true');await desktop.until(()=>Promise.resolve(desktop.opened),Boolean,'actual citation browser handoff');
 const citation=new URLSearchParams(new URL(desktop.opened).hash.split('?')[1]).get('evidence');assert.match(citation,/^context:capture:/);assert.equal((await request(users.a.token,'/api/captures/'+citation.slice(16))).statusCode,404);assert.equal((await request(users.a.token,'/api/context/read','POST',{refs:[citation.slice(8)]})).statusCode,200);assert.equal((await request(users.b.token,'/api/context/read','POST',{refs:[citation.slice(8)]})).statusCode,404);assert(providerRequests.length>=3&&providerRequests.every(value=>value.key==='GENERATED_A_NATIVE_KEY'));
 // The actual Desktop buttons connect the native target, hand off review, and
 // deliver only after the real owner-fixed review was approved by M12/M05.
 await desktop.js(`document.querySelector('[data-nav="sources"]').click();document.querySelector('.source-connect-panel').open=true;document.querySelector('#calendar-actions-connect').click();true`);
 await desktop.until(async()=>{const r=await request(users.a.token,'/api/actions');return r.json().targets.length;},n=>n===1,'native target registration');
 await desktop.until(()=>desktop.js('!document.querySelector("#calendar-actions-connect").disabled'),Boolean,'native connection UI settled');
 const deviceId=(await desktop.status()).config.deviceId,view=(await request(users.a.token,'/api/actions')).json();
 assert.equal((await request(users.a.token,'/api/actions/settings','PUT',{revision:view.revision,authorizationRevision:view.authorizationRevision,settings:{enabled:true,timeZone:'UTC',reviewDeviceIds:[deviceId]}})).statusCode,200);
 const proposal=await desktop.until(async()=>{const r=await request(users.a.token,'/api/actions');return r.json().items[0];},value=>value?.status==='proposed','real generated Actions proposal');
 const review=await request(users.a.token,'/api/actions/'+proposal.id+'/review','POST',{version:proposal.version,event:proposal.event,target:{deviceId,calendarId:'generated-calendar'}});assert.equal(review.statusCode,200,review.body);
 const question=review.json();assert.equal((await request(users.a.token,'/api/owner-questions/'+question.id+'/reply','POST',{requestId:randomUUID(),expectedRevision:question.revision,action:'answer',choiceId:'approve'})).statusCode,200);
 await desktop.js('document.querySelector("#calendar-actions-deliver").click();true');
 await desktop.until(async()=>{const r=await request(users.a.token,'/api/actions');return r.json().items.find(item=>item.id===proposal.id)?.status;},value=>value==='succeeded','actual native calendar receipt');
 assert.deepEqual(desktop.nativeCalls.map(value=>value.command),['calendar-permission','calendar-create']);assert.equal(desktop.nativeCalls[1].input.createAllowed,true);
 await desktop.until(()=>desktop.js('!document.querySelector("#calendar-actions-review").disabled'),Boolean,'native delivery UI settled');
 await desktop.js('document.querySelector("#calendar-actions-review").click();true');
 await desktop.until(()=>Promise.resolve(desktop.opened),value=>new URL(value).hash.startsWith('#/actions?'),'owner Actions browser handoff');
 // Reopen the original saved-history control for each actual server state.
 // Model-authored prose/citations survive ordinary revision with a notice;
 // explicit deletion omits result entirely and must show the existing notice.
 const savedHistory=async()=>{
  await desktop.js('document.querySelector("#ask-central").click();true');
  await desktop.until(()=>desktop.js('Boolean(document.querySelector("#ask-history button"))&&!document.querySelector("#ask-send").disabled'),Boolean,'actual saved history list');
  await desktop.js('document.querySelector("#ask-history button").click();true');
  await desktop.until(()=>desktop.js('!document.querySelector("#ask-send").disabled&&Boolean(document.querySelector("#ask-messages article"))'),Boolean,'actual saved conversation response');
  return desktop.js(`(()=>{const root=document.querySelector('#ask-messages'),text=root.textContent;return {answer:text.includes('Generated native Ask answer'),excerpt:text.includes('GENERATED_A_PRIVATE_APPOINTMENT'),citations:root.querySelectorAll('.ask-evidence').length,stale:['这是历史版本，当前资料已更新。','This is a historical version. The current material has been updated.'].some(notice=>text.includes(notice)),deleted:['相关证据已删除，这条历史回答已清除。可以继续提问查阅现有记录。','Related evidence was deleted, so this historical answer was cleared. Ask another question about available records.'].some(notice=>text.includes(notice))};})()`);
 };
 const currentHistory=await savedHistory();assert.deepEqual(currentHistory,{answer:true,excerpt:true,citations:1,stale:false,deleted:false});
 producer.publishMaterial({...materialDraft,blocks:[{...materialDraft.blocks[0],text:'GENERATED_NATIVE_REVISED_MATERIAL'}]},material.revision);
 const staleHistory=await savedHistory();
 const historyList=(await request(users.a.token,'/api/conversations')).json();const historicalId=historyList.items[0].id;
 const staleDto=(await request(users.a.token,'/api/conversations/'+historicalId)).json();assert(staleDto.turns.every(turn=>turn.evidenceStale&&turn.result&&!turn.evidenceDeleted));
 assert.equal((await request(users.a.token,'/api/sources/'+sourceId,'DELETE')).statusCode,200);
 const deletedHistory=await savedHistory();const deletedDto=(await request(users.a.token,'/api/conversations/'+historicalId)).json();assert(deletedDto.turns.every(turn=>turn.evidenceDeleted&&!turn.result&&!turn.evidenceStale));
 console.log(JSON.stringify({generatedHistoricalUi:{current:currentHistory,stale:staleHistory,deleted:deletedHistory},wire2HistoricalDtoVerified:true}));
 assert.deepEqual(staleHistory,{answer:true,excerpt:true,citations:1,stale:true,deleted:false});
 assert.deepEqual(deletedHistory,{answer:false,excerpt:false,citations:0,stale:false,deleted:true});
 const aDocument=await desktop.js('location.href');
 await desktop.js(`document.querySelector('[data-nav=settings]').click();true`);await desktop.until(()=>desktop.js('document.querySelector("#appearance").getClientRects().length>0'),Boolean,'actual appearance settings visible for A');
 await desktop.js(`(()=>{const select=document.querySelector('#appearance');select.value='dark';select.dispatchEvent(new Event('change'));return true;})()`);
 await desktop.until(()=>desktop.js('({selected:document.querySelector("#appearance").value,scheme:document.documentElement.dataset.colorScheme})'),value=>value.selected==='dark'&&value.scheme==='dark','A changes actual appearance selector');
 const aNote=await desktop.js('(async()=>{const d=await window.mote.noteDraft();await window.mote.saveNote({...d,text:"Generated A native queued note",revision:1});return d.id;})()');
 await desktop.js('(async()=>{const d=await window.mote.noteDraft();return window.mote.updateNoteDraft({...d,text:"Generated A native editable draft",revision:1});})()');assert.equal((await desktop.status()).queueDepth,1);
 await desktop.login('b');assert.notEqual(await desktop.js('location.href'),aDocument,'Account switch must create a new document');
 assert.deepEqual(await desktop.js('({preference:window.mote.initialAppearance.preference,scheme:document.documentElement.dataset.colorScheme})'),{preference:'dark',scheme:'dark'},'B document must bootstrap the profile appearance before private UI');
 let status=await desktop.status();assert.equal(status.queueDepth,0);assert.equal(status.running,false);assert.equal((await desktop.js('window.mote.noteDraft()')).text,'');
 await desktop.js('(async()=>{const s=await window.mote.status();await window.mote.configure({...s.config,syncMode:"manual",metadataEnabled:false});})()');
 await desktop.js(`document.querySelector('[data-nav=settings]').click();true`);await desktop.until(()=>desktop.js('document.querySelector("#appearance").getClientRects().length>0'),Boolean,'actual appearance settings visible for B');
 await desktop.js(`(()=>{const select=document.querySelector('#appearance');select.value='light';select.dispatchEvent(new Event('change'));return true;})()`);
 await desktop.until(()=>desktop.js('document.documentElement.dataset.colorScheme'),value=>value==='light','B changes actual appearance selector');
 const bNote=await desktop.js('(async()=>{const d=await window.mote.noteDraft();await window.mote.saveNote({...d,text:"Generated B native queued note",revision:1});return d.id;})()');assert.equal((await desktop.status()).queueDepth,1);await desktop.kill();
 desktop=await launch();assert.deepEqual(await desktop.js('({preference:window.mote.initialAppearance.preference,scheme:document.documentElement.dataset.colorScheme})'),{preference:'light',scheme:'light'},'New process bootstraps persisted appearance alongside B account');status=await desktop.status();assert.equal(status.config.account.userId,users.b.userId);assert.equal(status.queueDepth,1);assert.equal(status.running,false);await desktop.js('window.mote.retry()');assert.equal((await desktop.status()).queueDepth,0);
 await desktop.login('a');assert.deepEqual(await desktop.js('({preference:window.mote.initialAppearance.preference,scheme:document.documentElement.dataset.colorScheme})'),{preference:'light',scheme:'light'},'Profile appearance survives restored A document');assert.equal((await desktop.status()).queueDepth,1);assert.equal((await desktop.js('window.mote.noteDraft()')).text,'Generated A native editable draft');await desktop.js('window.mote.retry()');assert.equal((await desktop.status()).queueDepth,0);
 await desktop.until(()=>desktop.js('document.querySelector("#settings-connection-summary").textContent'),value=>value.includes('generated-a'),'actual account label');
 const a=await login('generated-a'),b=await login('generated-b');assert.equal((await request(a.token,'/api/captures/'+aNote)).statusCode,200);assert.equal((await request(b.token,'/api/captures/'+aNote)).statusCode,404);assert.equal((await request(b.token,'/api/captures/'+bNote)).statusCode,200);assert.equal((await request(a.token,'/api/captures/'+bNote)).statusCode,404);
 console.log(JSON.stringify({ok:true,actualElectronMainPreloadRenderer:true,generatedExternalIOOnly:true,nativeAskCitationContext:true,nativeCalendarFixedApprovalAndReceipt:true,scriptedProviderRequests:providerRequests.length,offlineA:true,bStartsStopped:true,sigkillRestartB:true,aDraftAndQueueResume:true,backendAccountIsolation:true,appearanceAcrossAccountDocumentsAndSigkill:true,nativeHistoricalCurrentStaleDeletedNotice:true}));
 desktop.running.send({type:'quit'});await new Promise(resolve=>desktop.running.once('exit',resolve));
}finally{if(child&&child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await new Promise(resolve=>child.once('exit',resolve));}await node?.app.close();provider.closeAllConnections();if(provider.listening)await new Promise(resolve=>provider.close(resolve));await rm(directory,{recursive:true,force:true});}
