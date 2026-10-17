import {afterEach,expect,it,vi} from 'vitest';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {DesktopPairing} from '../src/connection-pairing';
import {parseDesktopConnectionInvitation} from '../src/connection-invitation';
import {ConfigStore,defaultConfig} from '../src/config';
import type {Config} from '../src/contracts';

const repository=fileURLToPath(new URL('../../../',import.meta.url));
const nativeImport=createRequire(import.meta.url)('./native-backend.cjs') as (url:string)=>Promise<any>;
const networkFetch=globalThis.fetch;
const cleanups:(()=>Promise<unknown>)[]=[];
afterEach(async()=>{for(const cleanup of cleanups.splice(0).reverse())await cleanup();});
const wire={'X-Mote-Protocol-Version':'2'};
const secrets={available:()=>true,encrypt:(value:string)=>Buffer.from(value).map(byte=>byte^0xa5),decrypt:(value:Buffer)=>Buffer.from(value.map(byte=>byte^0xa5)).toString('utf8')};
type Trace={path:string;body:any;headers:Headers;status?:number;response?:any};

async function fixture(){
 const {buildApp}=await nativeImport(pathToFileURL(resolve(repository,'apps/server/src/app.ts')).href) as typeof import('../../server/src/app');
 const directory=await mkdtemp(join(tmpdir(),'mote-desktop-v2-generated-')),vault=join(directory,'central');
 cleanups.push(()=>rm(directory,{recursive:true,force:true}));
 let node=await buildApp({dataDir:vault});cleanups.push(()=>node.app.close());
 await node.accounts!.initialize('generated-qr-admin','Generated-qr-desktop-01');
 let serverUrl=await node.app.listen({host:'127.0.0.1',port:0});
 const request=async(token:string|undefined,path:string,method='GET',body?:unknown)=>{
  const response=await networkFetch(serverUrl+path,{method,headers:{...wire,...(token?{Authorization:'Bearer '+token}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  return {status:response.status,body:await response.json() as any};
 };
 const login=async(username:string)=>{const response=await request(undefined,'/api/auth/login','POST',{username,password:'Generated-qr-desktop-01',mode:'client'});expect(response.status).toBe(200);return response.body;};
 const admin=await login('generated-qr-admin');
 for(const username of ['generated-qr-a','generated-qr-b'])expect((await request(admin.token,'/api/admin/accounts','POST',{username,password:'Generated-qr-desktop-01'})).status).toBe(200);
 const a=await login('generated-qr-a'),b=await login('generated-qr-b');
 const config:Config={...defaultConfig(),serverUrl,deviceId:'generated-desktop-qr',deviceName:'Generated Desktop QR',token:undefined,authSignedOut:true,syncMode:'manual'};
 const invite=async(extra={},owner=a)=>{const response=await request(owner.token,'/api/connections/invitations','POST',{serverUrl,label:'Generated Desktop invitation',...extra});expect(response.status).toBe(200);return parseDesktopConnectionInvitation(response.body.uri);};
 const trace:Trace[]=[];
 let before:((trace:Trace)=>Promise<void>)|undefined,after:((trace:Trace,response:Response)=>Promise<Response>)|undefined;
 const fetcher:typeof fetch=async(input,init={})=>{
  const entry:Trace={path:new URL(String(input)).pathname,body:init.body?JSON.parse(String(init.body)):undefined,headers:new Headers(init.headers)};trace.push(entry);
  expect(new URL(String(input)).origin).toBe(serverUrl);expect(init.redirect).toBe('error');
  await before?.(entry);
  let response=await networkFetch(input,init);entry.status=response.status;entry.response=await response.clone().json();
  if(after)response=await after(entry,response);return response;
 };
 const pairing=()=>new DesktopPairing(join(directory,'desktop'),secrets,fetcher);
 const journal=async()=>JSON.parse(secrets.decrypt(await readFile(join(directory,'desktop','connection-pending.enc'))));
 const restart=async(deploymentId?:string)=>{
  const port=Number(new URL(serverUrl).port);await node.app.close();
  if(deploymentId){const db=new DatabaseSync(join(vault,'mote.sqlite'));try{db.prepare('UPDATE scope_meta SET deployment_id=?').run(deploymentId);}finally{db.close();}}
  node=await buildApp({dataDir:vault});serverUrl=await node.app.listen({host:'127.0.0.1',port});expect(serverUrl).toBe(config.serverUrl);
 };
 return {directory,get node(){return node;},get serverUrl(){return serverUrl;},config,a,b,request,invite,trace,pairing,journal,restart,set before(value:typeof before){before=value;},set after(value:typeof after){after=value;}};
}

it('persists the original encrypted PKCE and every checkpoint before real HTTP, then publishes only after exact self and ACK',async()=>{
 const f=await fixture(),invitation=await f.invite(),pairing=f.pairing(),publish=vi.fn(async()=>{});
 await pairing.begin(invitation,f.config,'macos',()=>{});expect(f.trace).toHaveLength(0);
 const intent=await f.journal(),bytes=await readFile(pairing.path);
 expect(intent.invitation).toEqual(invitation);expect(intent.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
 expect(bytes.includes(Buffer.from(invitation.code))).toBe(false);expect(bytes.includes(Buffer.from(intent.verifier))).toBe(false);
 f.before=async call=>{
  const durable=await f.journal();
  if(call.path==='/api/connections/redeem'){
   expect(call.headers.get('Authorization')).toBeNull();expect(durable.verifier).toBe(intent.verifier);
   expect(call.body.challenge).toBe(createHash('sha256').update(intent.verifier).digest('hex'));
   expect(call.body.expected).toEqual({deploymentId:invitation.deploymentId,userId:invitation.userId,serverUrl:invitation.serverUrl,purpose:'device'});
  }
  if(call.path==='/api/login/poll')expect(durable.requestId).toBe(call.body.id);
  if(call.path==='/api/login/ack'){expect(durable.grant.credentialId).toBeTypeOf('string');expect(publish).not.toHaveBeenCalled();}
 };
 await pairing.resume(f.config,()=>{},publish);
 expect(f.trace.map(value=>value.path)).toEqual(['/api/connections/redeem','/api/login/poll','/api/connections/self','/api/login/ack','/api/connections/self']);
 expect(publish).toHaveBeenCalledOnce();const [grant,identity]=publish.mock.calls[0] as any;
 expect(identity.account.credentialId).toBe(grant.credentialId);expect(identity.credential.deviceId).toBe(f.config.deviceId);
 await expect(readFile(pairing.path)).rejects.toHaveProperty('code','ENOENT');
 for(const path of ['/api/captures','/api/connections','/api/admin/accounts'])expect((await f.request(grant.token,path)).status).toBe(403);
 expect((await f.request(grant.token,'/api/login/ticket','POST',{})).status).toBe(403);
});

it.each(['redeem','poll','ack'])('recovers a lost %s response after client restart using the same durable claim and one credential',async phase=>{
 const f=await fixture(),invitation=await f.invite();let pairing=f.pairing();const publish=vi.fn(async()=>{});
 await pairing.begin(invitation,f.config,'macos',()=>{});const first=await f.journal();let dropped=false;
 f.after=async(call,response)=>{if(!dropped&&call.path.endsWith('/'+phase)){dropped=true;throw Error('Generated lost '+phase+' response');}return response;};
 await expect(pairing.resume(f.config,()=>{},publish)).rejects.toThrow();expect(dropped).toBe(true);expect(publish).not.toHaveBeenCalled();
 expect((await f.journal()).verifier).toBe(first.verifier);
 pairing=f.pairing();await pairing.resume(f.config,()=>{},publish);expect(publish).toHaveBeenCalledOnce();
 const claims=f.trace.filter(call=>call.path==='/api/connections/redeem');for(const claim of claims)expect(claim.body.challenge).toBe(createHash('sha256').update(first.verifier).digest('hex'));
 if(phase==='redeem'){expect(claims).toHaveLength(2);expect(claims[0].body).toEqual(claims[1].body);expect(claims[0].response.id).toBe(claims[1].response.id);}
 const credentials=await f.request(f.a.token,'/api/connections');expect(credentials.body.items.filter((credential:any)=>credential.deviceId===f.config.deviceId)).toHaveLength(1);
 await expect(readFile(pairing.path)).rejects.toHaveProperty('code','ENOENT');
});

it.each([false,true])('handles an ACK lost before server restart only through the exact credential current authority (revoked=%s)',async revoked=>{
 const f=await fixture(),invitation=await f.invite();let pairing=f.pairing();const publish=vi.fn(async()=>{});
 await pairing.begin(invitation,f.config,'macos',()=>{});let dropped=false;
 f.after=async(call,response)=>{if(!dropped&&call.path==='/api/login/ack'){dropped=true;throw Error('Generated lost successful ACK');}return response;};
 await expect(pairing.resume(f.config,()=>{},publish)).rejects.toThrow();const pending=await f.journal();expect(pending.grant).toHaveProperty('credentialId');
 await f.restart();if(revoked)expect((await f.request(f.a.token,'/api/connections/'+pending.grant.credentialId,'DELETE')).status).toBe(200);
 pairing=f.pairing();
 if(revoked){await expect(pairing.resume(f.config,()=>{},publish)).rejects.toThrow();expect(publish).not.toHaveBeenCalled();expect((await f.journal()).grant.credentialId).toBe(pending.grant.credentialId);}
 else{
  await pairing.resume(f.config,()=>{},publish);expect(publish).toHaveBeenCalledOnce();
  const receipts=f.trace.filter(call=>call.path==='/api/login/ack');expect(receipts.map(call=>call.status)).toEqual([200,410]);expect(receipts[1].response.error).toBe('login_expired');
  expect(publish.mock.calls[0][0].token).toBe(pending.grant.token);await expect(readFile(pairing.path)).rejects.toHaveProperty('code','ENOENT');
 }
});

it.each([{status:400,error:'bad_request'},{status:410,error:'invitation_invalid_or_expired'}])('does not publish after a non-receipt ACK failure $status/$error',async failure=>{
 const f=await fixture(),pairing=f.pairing(),publish=vi.fn(async()=>{});await pairing.begin(await f.invite(),f.config,'macos',()=>{});
 // Replace only this external transport response; redeem, poll, self and Accounts remain real.
 f.after=async(call,response)=>call.path==='/api/login/ack'?new Response(JSON.stringify({error:failure.error}),{status:failure.status,headers:{'Content-Type':'application/json'}}):response;
 await expect(pairing.resume(f.config,()=>{},publish)).rejects.toThrow();expect(publish).not.toHaveBeenCalled();expect(await f.journal()).toHaveProperty('grant');
});

it('never publishes after the original account cancels between fresh self and ACK',async()=>{
 const f=await fixture(),pairing=f.pairing(),publish=vi.fn(async()=>{}),invitation=await f.invite();await pairing.begin(invitation,f.config,'macos',()=>{});
 f.before=async call=>{if(call.path==='/api/login/ack')expect((await f.request(f.a.token,'/api/connections/invitations/revoke','POST',{code:invitation.code})).status).toBe(200);};
 await expect(pairing.resume(f.config,()=>{},publish)).rejects.toThrow();expect(publish).not.toHaveBeenCalled();expect(await f.journal()).toHaveProperty('grant');
 expect(f.trace.filter(call=>call.path==='/api/connections/self').map(call=>call.status)).toEqual([200,401]);
});

it.each(['credential','deployment','account','device','missing-device','kind','ingest'])('rejects a changed real self %s binding before ACK and publication',async field=>{
 const f=await fixture(),pairing=f.pairing(),publish=vi.fn(async()=>{});await pairing.begin(await f.invite(),f.config,'macos',()=>{});
 f.after=async(call,response)=>{
  if(call.path!=='/api/connections/self')return response;const body=await response.json();
  if(field==='credential')body.account.credentialId='generated-other-credential';
  if(field==='deployment')body.account.deploymentId='generated-other-deployment';
  if(field==='account')body.account.userId=f.b.userId;
  if(field==='device')body.credential.deviceId='generated-other-device';
  if(field==='missing-device')delete body.credential.deviceId;
  if(field==='kind')body.credential.kind='web';if(field==='ingest')body.capabilities.ingest=false;
  return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
 };
 await expect(pairing.resume(f.config,()=>{},publish)).rejects.toThrow();expect(publish).not.toHaveBeenCalled();expect(f.trace.some(call=>call.path==='/api/login/ack')).toBe(false);expect(await f.journal()).toHaveProperty('grant');
});

it('rejects a late A self after the current generation changes and will not resume that journal under B',async()=>{
 const f=await fixture(),pairing=f.pairing(),publish=vi.fn(async()=>{});await pairing.begin(await f.invite(),f.config,'macos',()=>{});
 let current=true;const assertCurrent=()=>{if(!current)throw Error('Desktop account changed');};
 f.after=async(call,response)=>{if(call.path==='/api/connections/self')current=false;return response;};
 await expect(pairing.resume(f.config,assertCurrent,publish)).rejects.toThrow('account changed');expect(publish).not.toHaveBeenCalled();expect(f.trace.some(call=>call.path==='/api/login/ack')).toBe(false);
 const bConfig={...f.config,token:f.b.token,authSignedOut:false,account:{origin:f.serverUrl,deploymentId:f.b.deploymentId,userId:f.b.userId,username:'generated-qr-b'}};
 const count=f.trace.length;expect(await pairing.preview(bConfig)).toBeUndefined();await expect(pairing.resume(bConfig,()=>{},publish)).rejects.toThrow('another connection');expect(f.trace).toHaveLength(count);
});

it('rejects the same URL after its actual production deployment changes while retaining the old durable grant',async()=>{
 const f=await fixture(),pairing=f.pairing(),publish=vi.fn(async()=>{});await pairing.begin(await f.invite(),f.config,'macos',()=>{});let dropped=false;
 f.after=async(call,response)=>{if(!dropped&&call.path==='/api/login/ack'){dropped=true;throw Error('Generated lost successful ACK');}return response;};
 await expect(pairing.resume(f.config,()=>{},publish)).rejects.toThrow();const pending=await f.journal();await f.restart('generated-replacement-instance');
 await expect(f.pairing().resume(f.config,()=>{},publish)).rejects.toThrow();expect(publish).not.toHaveBeenCalled();expect((await f.journal()).grant.credentialId).toBe(pending.grant.credentialId);
});

it('requires explicit original-device reauthorization and replaces only that account credential',async()=>{
 const f=await fixture(),device={serverUrl:f.serverUrl,deviceId:f.config.deviceId,deviceName:'Generated previous Desktop',platform:'macos'};
 const oldA=await f.request(f.a.token,'/api/login/session','POST',device),oldB=await f.request(f.b.token,'/api/login/session','POST',device);expect(oldA.status).toBe(200);expect(oldB.status).toBe(200);
 const pairing=f.pairing(),publish=vi.fn(async()=>{});await pairing.begin(await f.invite(),f.config,'macos',()=>{});
 await expect(pairing.resume(f.config,()=>{},publish)).rejects.toThrow();expect(f.trace.at(-1)!.status).toBe(409);expect(publish).not.toHaveBeenCalled();
 expect((await f.request(oldA.body.token,'/api/connections/self')).status).toBe(200);expect((await f.request(oldB.body.token,'/api/connections/self')).status).toBe(200);
 const bound=await f.invite({deviceId:f.config.deviceId});
 await expect(pairing.begin(bound,{...f.config,deviceId:'generated-other-device'},'macos',()=>{})).rejects.toThrow();
 await pairing.begin(bound,f.config,'macos',()=>{});await pairing.resume(f.config,()=>{},publish);expect(publish).toHaveBeenCalledOnce();
 expect((await f.request(oldA.body.token,'/api/connections/self')).status).toBe(401);expect((await f.request(oldB.body.token,'/api/connections/self')).status).toBe(200);
 expect(publish.mock.calls[0][0].deviceId).toBe(f.config.deviceId);
});

it('does not issue the first POST when encrypted PKCE persistence fails',async()=>{
 const f=await fixture(),fetcher=vi.fn(networkFetch),unwritable=new DesktopPairing(join(f.directory,'desktop'),{...secrets,encrypt:()=>{throw Error('Generated encrypted storage failure');}},fetcher);
 await expect(unwritable.begin(await f.invite(),f.config,'macos',()=>{})).rejects.toThrow('storage failure');expect(fetcher).not.toHaveBeenCalled();
 await expect(readFile(unwritable.path)).rejects.toHaveProperty('code','ENOENT');
});

it('retries its same real issued claim when the durable request-ID checkpoint write fails',async()=>{
 const f=await fixture(),invitation=await f.invite();let encryptions=0;
 const failingSecrets={...secrets,encrypt:(value:string)=>{if(++encryptions===2)throw Error('Generated checkpoint persistence failure');return secrets.encrypt(value);}};
 // Use the real TCP adapter while failing only the local encrypted-store I/O.
 const calls:any[]=[];const fetcher:typeof fetch=async(input,init)=>{calls.push({path:new URL(String(input)).pathname,body:init?.body?JSON.parse(String(init.body)):undefined});return networkFetch(input,init);};
 let pairing=new DesktopPairing(join(f.directory,'desktop'),failingSecrets,fetcher);const publish=vi.fn(async()=>{});await pairing.begin(invitation,f.config,'macos',()=>{});const before=await f.journal();
 await expect(pairing.resume(f.config,()=>{},publish)).rejects.toThrow('checkpoint persistence failure');expect((await f.journal()).verifier).toBe(before.verifier);expect(await f.journal()).not.toHaveProperty('requestId');
 pairing=new DesktopPairing(join(f.directory,'desktop'),secrets,fetcher);await pairing.resume(f.config,()=>{},publish);expect(publish).toHaveBeenCalledOnce();
 const claims=calls.filter(call=>call.path==='/api/connections/redeem');expect(claims).toHaveLength(2);expect(claims[0].body).toEqual(claims[1].body);
});

it('replaces an expired unclaimed local intent only through a newly confirmed invitation',async()=>{
 const f=await fixture(),old=await f.invite(),fresh=await f.invite();let now=Date.now();
 const pairing=new DesktopPairing(join(f.directory,'desktop'),secrets,networkFetch,()=>now);
 const short=parseDesktopConnectionInvitation(JSON.stringify({...old,expiresAt:new Date(now+50).toISOString()}),now);await pairing.begin(short,f.config,'macos',()=>{});now+=100;
 await expect(pairing.resume(f.config,()=>{},async()=>{})).rejects.toThrow();await pairing.begin(fresh,f.config,'macos',()=>{});
 expect((await f.journal()).invitation.code).toBe(fresh.code);expect(f.trace).toHaveLength(0);
});

it('rechecks revocation after successful ACK before publishing any connection',async()=>{
 const f=await fixture(),pairing=f.pairing(),publish=vi.fn(async()=>{});await pairing.begin(await f.invite(),f.config,'macos',()=>{});
 f.after=async(call,response)=>{if(call.path==='/api/login/ack'){const pending=await f.journal();expect((await f.request(f.a.token,'/api/connections/'+pending.grant.credentialId,'DELETE')).status).toBe(200);}return response;};
 await expect(pairing.resume(f.config,()=>{},publish)).rejects.toThrow();expect(publish).not.toHaveBeenCalled();expect(f.trace.filter(call=>call.path==='/api/connections/self').map(call=>call.status)).toEqual([200,401]);expect(await f.journal()).toHaveProperty('grant');
});

it('reconciles the same installed credential after local publication succeeds but its caller loses the completion',async()=>{
 const f=await fixture();let pairing=f.pairing(),installed:Config|undefined;await pairing.begin(await f.invite(),f.config,'macos',()=>{});
 await expect(pairing.resume(f.config,()=>{},async(grant,identity)=>{installed={...f.config,token:grant.token,account:identity.account,authExpiresAt:grant.expiresAt,authSignedOut:false};throw Error('Generated crash after connection publication');})).rejects.toThrow('after connection publication');
 expect(installed).toBeDefined();const original=await f.journal();pairing=f.pairing();expect(await pairing.preview(installed!)).toHaveProperty('userId',f.a.userId);
 const publish=vi.fn(async()=>{});await pairing.resume(installed!,()=>{},publish);expect(publish).toHaveBeenCalledOnce();expect(publish.mock.calls[0][0].token).toBe(original.grant.token);
 expect(f.trace.filter(call=>call.path==='/api/connections/redeem')).toHaveLength(1);expect(f.trace.filter(call=>call.path==='/api/login/poll')).toHaveLength(1);await expect(readFile(pairing.path)).rejects.toHaveProperty('code','ENOENT');
});

it('rejects a poll grant widened to central purpose before fresh self, ACK or publication',async()=>{
 const f=await fixture(),pairing=f.pairing(),publish=vi.fn(async()=>{});await pairing.begin(await f.invite(),f.config,'macos',()=>{});
 f.after=async(call,response)=>{if(call.path!=='/api/login/poll')return response;const grant=await response.json();grant.purpose='central';return new Response(JSON.stringify(grant),{status:200,headers:{'Content-Type':'application/json'}});};
 await expect(pairing.resume(f.config,()=>{},publish)).rejects.toThrow();expect(publish).not.toHaveBeenCalled();expect(f.trace.map(call=>call.path)).toEqual(['/api/connections/redeem','/api/login/poll']);expect(await f.journal()).not.toHaveProperty('grant');
});

it('publishes the durably claimed device name after restart while the active configuration still has its old name',async()=>{
 const f=await fixture(),named={...f.config,deviceName:'Generated confirmed QR device name'},publish=vi.fn(async()=>{});
 await f.pairing().begin(await f.invite(),named,'macos',()=>{});expect((await f.journal()).device.deviceName).toBe(named.deviceName);
 // Recreate the consumer before redeeming. The current saved config still names
 // the original device; claim and publication must use the same durable metadata.
 await f.pairing().resume(f.config,()=>{},publish);
 expect(f.trace.find(call=>call.path==='/api/connections/redeem')!.body.deviceName).toBe(named.deviceName);
 expect(publish.mock.calls[0][2]).toEqual({deviceId:named.deviceId,deviceName:named.deviceName,platform:'macos'});
});

it('recovers original-device replacement after its old source credential is signed out, while rejecting signed-out B',async()=>{
 const f=await fixture(),old=await f.request(f.a.token,'/api/login/session','POST',{serverUrl:f.serverUrl,deviceId:f.config.deviceId,deviceName:f.config.deviceName,platform:'macos'});expect(old.status).toBe(200);
 const source:Config={...f.config,token:old.body.token,authExpiresAt:old.body.expiresAt,authSignedOut:false,credentialScope:'client',account:{origin:f.serverUrl,deploymentId:f.a.deploymentId,userId:f.a.userId,username:'generated-qr-a'}};
 let pairing=f.pairing();await pairing.begin(await f.invite({deviceId:source.deviceId}),source,'macos',()=>{});let dropped=false;const publish=vi.fn(async()=>{});
 f.after=async(call,response)=>{if(!dropped&&call.path==='/api/connections/redeem'){dropped=true;throw Error('Generated loss after replacement revoked old source credential');}return response;};
 await expect(pairing.resume(source,()=>{},publish)).rejects.toThrow();expect(dropped).toBe(true);expect((await f.request(source.token,'/api/connections/self')).status).toBe(401);const original=await f.journal();
 // This is exactly endLogin's configuration transformation. The account and
 // original expiry remain; only the old usable token is retired.
 const signedOutA={...source,token:undefined,authSignedOut:true};
 const signedOutB={...signedOutA,account:{origin:f.serverUrl,deploymentId:f.b.deploymentId,userId:f.b.userId,username:'generated-qr-b'}};
 pairing=f.pairing();const before=f.trace.length;expect(await pairing.preview(signedOutB)).toBeUndefined();await expect(pairing.resume(signedOutB,()=>{},publish)).rejects.toThrow('another connection');expect(f.trace).toHaveLength(before);
 expect((await pairing.preview(signedOutA))?.userId).toBe(f.a.userId);
 await pairing.resume(signedOutA,()=>{},publish);expect(publish).toHaveBeenCalledOnce();expect(publish.mock.calls[0][0].userId).toBe(f.a.userId);expect(publish.mock.calls[0][0].token).not.toBe(source.token);
 const claims=f.trace.filter(call=>call.path==='/api/connections/redeem');expect(claims).toHaveLength(2);expect(claims[0].body).toEqual(claims[1].body);expect(claims[0].response.id).toBe(claims[1].response.id);expect(claims[1].body.challenge).toBe(createHash('sha256').update(original.verifier).digest('hex'));
});

it('recovers its PKCE after real ConfigStore session-only save/load omits the source token without flipping authSignedOut',async()=>{
 const f=await fixture(),deviceId=defaultConfig().deviceId,old=await f.request(f.a.token,'/api/login/session','POST',{serverUrl:f.serverUrl,deviceId,deviceName:f.config.deviceName,platform:'macos',durationMs:0});expect(old.status).toBe(200);
 const source:Config={...f.config,deviceId,token:old.body.token,authExpiresAt:old.body.expiresAt,authSignedOut:false,authSessionOnly:true,credentialScope:'client',account:{origin:f.serverUrl,deploymentId:f.a.deploymentId,userId:f.a.userId,username:'generated-qr-a'}};
 const store=new ConfigStore(join(f.directory,'saved-profile-a'),secrets);await store.save(source);
 const persisted=JSON.parse(await readFile(join(f.directory,'saved-profile-a','config.json'),'utf8'));expect(persisted).not.toHaveProperty('encryptedToken');expect(persisted.config.authSignedOut).toBe(false);expect(persisted.config.authSessionOnly).toBe(true);
 let pairing=f.pairing();await pairing.begin(await f.invite({deviceId}),source,'macos',()=>{});let dropped=false;const publish=vi.fn(async()=>{});
 f.after=async(call,response)=>{if(!dropped&&call.path==='/api/connections/redeem'){dropped=true;throw Error('Generated lost redeem before local session-only restart');}return response;};
 await expect(pairing.resume(source,()=>{},publish)).rejects.toThrow();expect(dropped).toBe(true);expect((await f.request(source.token,'/api/connections/self')).status).toBe(401);const original=await f.journal();
 const loaded=await store.load();expect(loaded.token).toBeUndefined();expect(loaded.authSignedOut).toBe(false);expect(loaded.authSessionOnly).toBe(true);expect(loaded.account?.userId).toBe(f.a.userId);
 const storeB=new ConfigStore(join(f.directory,'saved-profile-b'),secrets);await storeB.save({...source,token:f.b.token,account:{origin:f.serverUrl,deploymentId:f.b.deploymentId,userId:f.b.userId,username:'generated-qr-b'}});const loadedB=await storeB.load();expect(loadedB.token).toBeUndefined();expect(loadedB.authSignedOut).toBe(false);
 pairing=f.pairing();const before=f.trace.length;expect(await pairing.preview(loadedB)).toBeUndefined();await expect(pairing.resume(loadedB,()=>{},publish)).rejects.toThrow('another connection');expect(f.trace).toHaveLength(before);
 expect((await pairing.preview(loaded))?.userId).toBe(f.a.userId);
 await pairing.resume(loaded,()=>{},publish);expect(publish).toHaveBeenCalledOnce();expect(publish.mock.calls[0][0].userId).toBe(f.a.userId);
 const claims=f.trace.filter(call=>call.path==='/api/connections/redeem');expect(claims).toHaveLength(2);expect(claims[0].body).toEqual(claims[1].body);expect(claims[0].response.id).toBe(claims[1].response.id);expect(claims[1].body.challenge).toBe(createHash('sha256').update(original.verifier).digest('hex'));
});

async function lostClaim(f:Awaited<ReturnType<typeof fixture>>,source:Config,invitation:ReturnType<typeof parseDesktopConnectionInvitation>){
 const pairing=f.pairing();await pairing.begin(invitation,source,'macos',()=>{});let dropped=false;const publish=vi.fn(async()=>{});
 f.after=async(call,response)=>{if(!dropped&&call.path==='/api/connections/redeem'){dropped=true;throw Error('Generated response loss after production invitation claim');}return response;};
 await expect(pairing.resume(source,()=>{},publish)).rejects.toThrow();expect(dropped).toBe(true);expect(publish).not.toHaveBeenCalled();
 const original=await f.journal(),sealed=await readFile(pairing.path);expect(original.requestId===undefined).toBe(true);
 return {pairing,original,sealed};
}

it('same-invitation rename preserves the sealed original claim after a real lost redeem',async()=>{
 const f=await fixture(),invitation=await f.invite(),source=f.config,{pairing,original,sealed}=await lostClaim(f,source,invitation);
 const calls=f.trace.length;await expect(pairing.begin(invitation,{...source,deviceName:'Generated renamed retry'},'macos',()=>{})).rejects.toThrow();
 expect((await readFile(pairing.path)).equals(sealed)).toBe(true);expect((await f.journal()).verifier===original.verifier).toBe(true);expect(f.trace).toHaveLength(calls);
 const publish=vi.fn(async()=>{});await f.pairing().resume(source,()=>{},publish);expect(publish).toHaveBeenCalledOnce();expect(publish.mock.calls[0][2].deviceName).toBe(source.deviceName);
 const claims=f.trace.filter(call=>call.path==='/api/connections/redeem');expect(claims).toHaveLength(2);expect(claims[0].body.challenge===claims[1].body.challenge).toBe(true);expect(claims[0].response.id===claims[1].response.id).toBe(true);
});

it('same-invitation source sign-out preserves the sealed original-device claim instead of rotating PKCE',async()=>{
 const f=await fixture(),old=await f.request(f.a.token,'/api/login/session','POST',{serverUrl:f.serverUrl,deviceId:f.config.deviceId,deviceName:f.config.deviceName,platform:'macos'});expect(old.status).toBe(200);
 const source:Config={...f.config,token:old.body.token,authExpiresAt:old.body.expiresAt,authSignedOut:false,credentialScope:'client',account:{origin:f.serverUrl,deploymentId:f.a.deploymentId,userId:f.a.userId,username:'generated-qr-a'}};
 const invitation=await f.invite({deviceId:source.deviceId}),{pairing,original,sealed}=await lostClaim(f,source,invitation);expect((await f.request(source.token,'/api/connections/self')).status).toBe(401);
 const projected={...source,token:undefined,authSignedOut:true};await f.pairing().begin(invitation,projected,'macos',()=>{});
 expect((await readFile(pairing.path)).equals(sealed)).toBe(true);expect((await f.journal()).verifier===original.verifier).toBe(true);
 const publish=vi.fn(async()=>{});await f.pairing().resume(projected,()=>{},publish);expect(publish).toHaveBeenCalledOnce();
 const claims=f.trace.filter(call=>call.path==='/api/connections/redeem');expect(claims).toHaveLength(2);expect(claims[0].body.challenge===claims[1].body.challenge).toBe(true);expect(claims[0].response.id===claims[1].response.id).toBe(true);
});

it('same-invitation B source rejects begin without replacing or borrowing A sealed claim',async()=>{
 const f=await fixture(),sourceA:Config={...f.config,token:f.a.token,authExpiresAt:f.a.expiresAt,authSignedOut:false,account:{origin:f.serverUrl,deploymentId:f.a.deploymentId,userId:f.a.userId,username:'generated-qr-a'}};
 const invitation=await f.invite(),{pairing,original,sealed}=await lostClaim(f,sourceA,invitation);
 const sourceB:Config={...sourceA,token:f.b.token,authExpiresAt:f.b.expiresAt,account:{origin:f.serverUrl,deploymentId:f.b.deploymentId,userId:f.b.userId,username:'generated-qr-b'}};
 const calls=f.trace.length;await expect(f.pairing().begin(invitation,sourceB,'macos',()=>{})).rejects.toThrow();
 expect((await readFile(pairing.path)).equals(sealed)).toBe(true);expect((await f.journal()).verifier===original.verifier).toBe(true);expect(f.trace).toHaveLength(calls);
 const publish=vi.fn(async()=>{});expect(await pairing.preview(sourceB)).toBeUndefined();await expect(pairing.resume(sourceB,()=>{},publish)).rejects.toThrow('another connection');expect(f.trace).toHaveLength(calls);
 await pairing.resume(sourceA,()=>{},publish);expect(publish).toHaveBeenCalledOnce();expect(publish.mock.calls[0][0].userId).toBe(f.a.userId);
});
