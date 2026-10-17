import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildApp} from '../src/app.js';
import {DatabaseSync} from 'node:sqlite';
const password='Synthetic-qr-password-012345';
const wire={'x-mote-protocol-version':'2'};
const headers=(token:string)=>({...wire,authorization:'Bearer '+token});
const serverUrl='https://qr-fixture.invalid';
async function fixture(t:TestContext){
 const root=mkdtempSync(join(tmpdir(),'mote-qr-')),node=await buildApp({dataDir:root});
 t.after(async()=>{await node.app.close();rmSync(root,{recursive:true,force:true});});
 await node.accounts.initialize('qr-admin',password);
 const call=(method:any,url:string,payload?:unknown,h:any=wire)=>node.app.inject({method,url,payload,headers:h});
 const login=async(username:string,mode='client')=>{const r=await call('POST','/api/auth/login',{username,password,mode,durationMs:86400000});assert.equal(r.statusCode,200,r.body);return {...r.json(),cookie:String(r.headers['set-cookie']??'').split(';')[0]};};
 const admin=await login('qr-admin');
 for(const username of ['qr-alice','qr-bob'])assert.equal((await call('POST','/api/admin/accounts',{username,password},headers(admin.token))).statusCode,200);
 const a=await login('qr-alice'),b=await login('qr-bob');
 const invite=async(token=a.token,extra={})=>{const r=await call('POST','/api/connections/invitations',{serverUrl,label:'Generated phone',...extra},headers(token));assert.equal(r.statusCode,200,r.body);return r.json();};
 const client=(inv:any,extra={})=>{const verifier=randomBytes(32).toString('base64url');return {verifier,input:{code:inv.code,expected:{serverUrl:inv.serverUrl,deploymentId:inv.deploymentId,userId:inv.userId,purpose:inv.purpose},deviceId:'same-device',deviceName:'Generated phone',platform:'android',challenge:createHash('sha256').update(verifier).digest('hex'),...extra}};};
 return {root,node,call,login,admin,a,b,invite,client};
}
test('production QR invitation preserves scan/connect, immutable subject, PKCE recovery and device-only grant',async t=>{
 const f=await fixture(t),{invitation,uri}=await f.invite();
 assert.equal(invitation.format,'mote.connection');assert.equal(invitation.version,2);assert.equal(invitation.purpose,'device');assert.equal(invitation.userId,f.a.userId);assert.equal(invitation.deploymentId,f.node.deploymentId);
 assert.equal(uri,'mote://connect?data='+Buffer.from(JSON.stringify(invitation)).toString('base64url'));
 assert.doesNotMatch(JSON.stringify(invitation),/token|verifier|challenge/);
 const c=f.client(invitation),r=await f.call('POST','/api/connections/redeem',c.input);assert.equal(r.statusCode,200,r.body);const {id}=r.json();
 const retry=await f.call('POST','/api/connections/redeem',c.input);assert.equal(retry.statusCode,200,retry.body);assert.equal(retry.json().id,id);
 for(const expected of [{...c.input.expected,userId:f.b.userId},{...c.input.expected,deploymentId:randomBytes(8).toString('hex')},{...c.input.expected,purpose:'central'},{...c.input.expected,serverUrl:'https://other.invalid'}])assert.notEqual((await f.call('POST','/api/connections/redeem',{...c.input,expected})).statusCode,200);
 for(const extra of [{deviceId:'other-device'},{challenge:'f'.repeat(64)},{deviceName:'Other phone'}])assert.equal((await f.call('POST','/api/connections/redeem',{...c.input,...extra})).statusCode,409);
 assert.equal((await f.call('POST',`/api/login/requests/${id}/approve`,{},headers(f.b.token))).statusCode,403);
 const poll=()=>f.call('POST','/api/login/poll',{id,verifier:c.verifier});const ready=await poll();assert.equal(ready.statusCode,200,ready.body);const grant=ready.json();assert.equal(grant.userId,f.a.userId);assert.equal(grant.purpose,'device');assert.equal(grant.deviceId,c.input.deviceId);assert.equal(grant.ready,true);
 assert.equal((await poll()).json().token,grant.token);
 const self=await f.call('GET','/api/connections/self',undefined,headers(grant.token));assert.equal(self.statusCode,200);assert.equal(self.json().credential.deviceId,c.input.deviceId);assert.equal(self.json().account.userId,f.a.userId);
 for(const url of ['/api/materials','/api/connections','/api/admin/accounts'])assert.equal((await f.call('GET',url,undefined,headers(grant.token))).statusCode,403,url);
 const ingressHeaders={...headers(grant.token),'x-mote-ingress-version':'3'};
 assert.equal((await f.call('POST','/api/ingress/devices',{id:c.input.deviceId,name:'Generated phone',platform:'android'},ingressHeaders)).statusCode,200);
 assert.equal((await f.call('POST','/api/ingress/devices',{id:'other-device',name:'Generated phone',platform:'android'},ingressHeaders)).statusCode,403);
 assert.equal((await f.call('POST','/api/connections/invitations',{serverUrl,label:'No'},headers(grant.token))).statusCode,403);
 assert.equal((await f.call('POST','/api/login/ticket',{},headers(grant.token))).statusCode,403);
 assert.equal((await f.call('POST','/api/login/ack',{id,verifier:'x'.repeat(43)})).statusCode,401);
 for(let i=0;i<2;i++)assert.equal((await f.call('POST','/api/login/ack',{id,verifier:c.verifier})).statusCode,200,'lost ACK response retry');
 assert.equal((await poll()).statusCode,410);assert.equal((await f.call('POST','/api/connections/redeem',c.input)).statusCode,410);
 const invb=(await f.invite(f.b.token)).invitation,cb=f.client(invb);const rb=await f.call('POST','/api/connections/redeem',cb.input);assert.equal(rb.statusCode,200,rb.body);const gb=(await f.call('POST','/api/login/poll',{id:rb.json().id,verifier:cb.verifier})).json();assert.equal(gb.userId,f.b.userId);assert.notEqual(gb.token,grant.token);
 assert.equal((await f.call('POST','/api/auth/logout',{},headers(grant.token))).statusCode,200);assert.equal((await f.call('GET','/api/connections/self',undefined,headers(grant.token))).statusCode,401);assert.equal((await f.call('GET','/api/connections/self',undefined,headers(gb.token))).statusCode,200);
});
test('QR cancellation, stale account tabs and account revocation fence claim, polling and late ACK',async t=>{
 const f=await fixture(t),{invitation}=await f.invite(),c=f.client(invitation);
 assert.equal((await f.call('POST','/api/connections/invitations/revoke',{code:invitation.code},headers(f.b.token))).statusCode,404);
 const redeemed=await f.call('POST','/api/connections/redeem',c.input);assert.equal(redeemed.statusCode,200,redeemed.body);const id=redeemed.json().id,grant=(await f.call('POST','/api/login/poll',{id,verifier:c.verifier})).json();
 assert.equal((await f.call('POST','/api/connections/invitations/revoke',{code:invitation.code},headers(f.a.token))).statusCode,200);
 assert.equal((await f.call('POST','/api/login/ack',{id,verifier:c.verifier})).statusCode,410);assert.equal((await f.call('GET','/api/connections/self',undefined,headers(grant.token))).statusCode,401);
 const pending=(await f.invite()).invitation,cp=f.client(pending);await f.call('POST','/api/auth/logout',{},headers(f.a.token));assert.equal((await f.call('POST','/api/connections/redeem',cp.input)).statusCode,401);
 const weba=await f.login('qr-alice','web'),webb=await f.login('qr-bob','web');
 assert.equal((await f.call('POST','/api/connections/invitations',{serverUrl,label:'Stale'},{...wire,cookie:webb.cookie,'x-mote-session-id':weba.credentialId,'x-mote-csrf':weba.csrfToken})).statusCode,409);
 const fresh=await f.login('qr-alice'),inv=(await f.invite(fresh.token,{deviceId:'same-device'})).invitation,cr=f.client(inv),rr=await f.call('POST','/api/connections/redeem',cr.input);assert.equal(rr.statusCode,200,rr.body);
 await f.call('PATCH','/api/admin/accounts/'+f.a.userId,{disabled:true},headers(f.admin.token));
 for(const endpoint of ['poll','ack'])assert.equal((await f.call('POST','/api/login/'+endpoint,{id:rr.json().id,verifier:cr.verifier})).statusCode,401);
 assert.equal((await f.call('GET','/api/auth/self',undefined,headers(f.b.token))).statusCode,200);
});
test('QR routes reject legacy payloads, insecure URLs, protocol downgrade, non-JSON and cross-origin redemption',async t=>{
 const f=await fixture(t),inv=(await f.invite()).invitation,c=f.client(inv);
 for(const serverUrl of ['http://remote.invalid','https://qr-fixture.invalid/path','https://a:b@qr-fixture.invalid'])assert.equal((await f.call('POST','/api/connections/invitations',{serverUrl,label:'Generated'},headers(f.a.token))).statusCode,400);
 assert.equal((await f.call('POST','/api/connections/invitations',{serverUrl,label:'Generated',purpose:'central'},headers(f.a.token))).statusCode,400);
 assert.equal((await f.call('POST','/api/connections/redeem',{code:inv.code,deviceId:'old',deviceName:'Legacy',platform:'android'})).statusCode,400);
 assert.equal((await f.call('POST','/api/connections/redeem',c.input,{})).statusCode,426);
 assert.equal((await f.call('POST','/api/connections/redeem','{}',{...wire,'content-type':'text/plain'})).statusCode,415);
 assert.equal((await f.call('POST','/api/connections/redeem',c.input,{...wire,origin:'https://attacker.invalid'})).statusCode,403);
});

test('QR reauthorization selects the original device, preserves invitation label and replaces only that account atomically',async t=>{
 const f=await fixture(t),device={serverUrl,deviceId:'same-device',deviceName:'Physical name',platform:'android'};
 const olda=(await f.call('POST','/api/login/session',device,headers(f.a.token))).json(),oldb=(await f.call('POST','/api/login/session',device,headers(f.b.token))).json();
 const unbound=f.client((await f.invite()).invitation);assert.equal((await f.call('POST','/api/connections/redeem',unbound.input)).statusCode,409);
 const inv=(await f.invite(f.a.token,{deviceId:'same-device'})).invitation,c=f.client(inv,{deviceName:'Client supplied name'});
 assert.equal((await f.call('POST','/api/connections/redeem',{...c.input,deviceId:'different-device'})).statusCode,403);
 const r=await f.call('POST','/api/connections/redeem',c.input);assert.equal(r.statusCode,200,r.body);
 assert.equal((await f.call('GET','/api/login/requests/'+r.json().id,undefined,headers(f.b.token))).statusCode,403);
 const grant=(await f.call('POST','/api/login/poll',{id:r.json().id,verifier:c.verifier})).json(),self=(await f.call('GET','/api/connections',undefined,headers(f.a.token))).json().items.find((item:any)=>item.id===grant.credentialId);
 assert.equal(self.label,'Generated phone');assert.equal(self.deviceName,'Client supplied name');
 assert.equal((await f.call('GET','/api/connections/self',undefined,headers(olda.token))).statusCode,401);assert.equal((await f.call('GET','/api/connections/self',undefined,headers(oldb.token))).statusCode,200);
 // Actual SQLite failure during replacement rolls back old-credential mutation;
 // the failed new issuance is retired and this same PKCE claim can recover.
 const failing=(await f.invite(f.a.token,{deviceId:'same-device'})).invitation,cf=f.client(failing);
 const database=new DatabaseSync(join(f.root,'mote.sqlite'));t.after(()=>database.close());
 database.exec("CREATE TRIGGER generated_pair_failure BEFORE UPDATE OF revoked_at ON auth_credentials WHEN OLD.id='"+grant.credentialId+"' BEGIN SELECT RAISE(ABORT,'generated failure'); END");
 assert.equal((await f.call('POST','/api/connections/redeem',cf.input)).statusCode,503);
 assert.equal((await f.call('GET','/api/connections/self',undefined,headers(grant.token))).statusCode,200);
 database.exec('DROP TRIGGER generated_pair_failure');
 assert.equal((await f.call('POST','/api/connections/redeem',cf.input)).statusCode,200);
 assert.equal((await f.call('GET','/api/connections/self',undefined,headers(grant.token))).statusCode,401);
 assert.equal((await f.call('GET','/api/connections/self',undefined,headers(oldb.token))).statusCode,200);
});

test('known device selection includes account-owned sources and ingress records before a credential or heartbeat exists',async t=>{
 const f=await fixture(t),ingress=(token:string)=>({...headers(token),'x-mote-ingress-version':'3'});
 assert.equal((await f.call('POST','/api/sources',{id:'source-only',name:'Generated source',kind:'mcp',deviceId:'source-device',platform:'import'},headers(f.a.token))).statusCode,200);
 assert.equal((await f.call('POST','/api/ingress/devices',{id:'ingress-only',name:'Generated device',platform:'android'},ingress(f.a.token))).statusCode,200);
 for(const deviceId of ['source-device','ingress-only']){
  const c=f.client((await f.invite()).invitation,{deviceId});assert.equal((await f.call('POST','/api/connections/redeem',c.input)).statusCode,409);
  const bound=f.client((await f.invite(f.a.token,{deviceId})).invitation,{deviceId});assert.equal((await f.call('POST','/api/connections/redeem',bound.input)).statusCode,200);
 }
 assert.equal((await f.call('POST','/api/sources',{id:'b-only-source',name:'Generated B source',kind:'mcp',deviceId:'b-only-device',platform:'import'},headers(f.b.token))).statusCode,200);
 const c=f.client((await f.invite()).invitation,{deviceId:'b-only-device'});assert.equal((await f.call('POST','/api/connections/redeem',c.input)).statusCode,200,'B source identity does not block A');
 assert.equal((await f.call('GET','/api/sources',undefined,headers(f.b.token))).json().items.length,1);
});
