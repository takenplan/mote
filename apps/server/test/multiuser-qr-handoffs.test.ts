import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {LoginHandoffs,type LoginConnections} from '../src/login-handoffs.js';
import {Accounts} from '../src/scope/accounts.js';
import {UserContextAuthority} from '../src/scope/context.js';

const password='Generated-QR-only-password-001';
const serverUrl='https://generated-qr.invalid';
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const pkce=()=>{const verifier=randomBytes(32).toString('base64url');return {verifier,challenge:digest(verifier)};};
function barrier(){let enter!:()=>void,release!:()=>void;return {entered:new Promise<void>(resolve=>enter=resolve),wait:new Promise<void>(resolve=>release=resolve),enter:()=>enter(),release:()=>release()};}

/** The handoff is isolated in memory, but credentials and all revocation checks
 * use production Accounts, its actual SQLite schema and host-issued contexts. */
async function fixture(t:TestContext){
 const directory=mkdtempSync(join(tmpdir(),'mote-qr-handoffs-')),db=new DatabaseSync(join(directory,'mote.sqlite'));
 let now=Date.now();const deploymentId=randomUUID(),accounts=new Accounts(db,deploymentId,()=>now),authority=new UserContextAuthority(deploymentId,accounts);
 const a=await accounts.initialize('generated-qr-a',password),parent=await accounts.login(a.username,password,'127.0.0.1','client',86400000),context=await authority.authenticate(parent.token);
 const b=await accounts.createAccount(context,authority,{username:'generated-qr-b',password,administrator:false}),bgrant=await accounts.login(b.username,password,'127.0.0.2','client',86400000);
 const connections=accounts.handoffConnections(context,authority),handoffs=new LoginHandoffs(connections,()=>now);
 t.after(()=>{handoffs.close();accounts.close();db.close();rmSync(directory,{recursive:true,force:true});});
 const owner={deploymentId,userId:a.userId},authorize=()=>authority.assert(context);
 const invitation=(adapter:LoginConnections=connections,deviceId?:string)=>handoffs.invitation({serverUrl,label:'Generated central label',...(deviceId?{deviceId}:{})},owner,authorize,adapter);
 const claim=(code:string,challenge:string,deviceId='generated-qr-device')=>({code,expected:{...owner,serverUrl,purpose:'device' as const},deviceId,deviceName:'Generated scanner name',platform:'android' as const,challenge});
 const issued=()=>db.prepare('SELECT id,user_id,revoked_at,metadata FROM auth_credentials WHERE id NOT IN (?,?) ORDER BY id').all(parent.credentialId,bgrant.credentialId);
 return {db,accounts,authority,a,b,parent,bgrant,context,connections,handoffs,owner,authorize,invitation,claim,issued,advance:(ms:number)=>{now+=ms;},clock:()=>now};
}

test('QR claims freeze one device/account/deployment/PKCE identity and retry one real grant',async t=>{
 const f=await fixture(t),invite=f.invitation(),{verifier,challenge}=pkce();
 assert.equal(invite.invitation.version,2);assert.equal(invite.invitation.purpose,'device');assert.equal(invite.invitation.deploymentId,f.owner.deploymentId);assert.equal(invite.invitation.userId,f.owner.userId);
 assert.equal(f.issued().length,0,'creating a QR does not pre-mint a bearer credential');
 const input=f.claim(invite.invitation.code,challenge);
 for(const expected of [{...input.expected,userId:f.b.userId},{...input.expected,deploymentId:randomUUID()},{...input.expected,serverUrl:'https://wrong-generated.invalid'},{...input.expected,purpose:'central'}]){
  await assert.rejects(async()=>f.handoffs.redeem({...input,expected}));assert.equal(f.issued().length,0);
 }
 const [one,two]=await Promise.all([f.handoffs.redeem(input),f.handoffs.redeem(input)]);assert.equal(one.id,two.id);assert.equal(one.expiresAt,two.expiresAt);assert.equal(f.issued().length,1);
 for(const change of [{challenge:pkce().challenge},{deviceId:'different-device'},{deviceName:'Different scanner'},{platform:'other'}])await assert.rejects(async()=>f.handoffs.redeem({...input,...change}));
 const grant=f.handoffs.poll({id:one.id,verifier}) as any;assert.equal(grant.ready,true);assert.equal(grant.userId,f.a.userId);assert.equal(grant.deploymentId,f.owner.deploymentId);assert.equal(grant.scope,'client');
 const selected=await f.authority.authenticate(grant.token);assert.equal(f.accounts.credentialInfo(selected,f.authority).deviceId,input.deviceId);
 assert.equal((f.issued()[0] as any).user_id,f.a.userId);assert.equal(JSON.parse(String((f.issued()[0] as any).metadata)).label,'Generated central label');
 assert.doesNotMatch(JSON.stringify(invite),new RegExp(grant.token));assert.doesNotMatch(JSON.stringify(f.db.prepare('SELECT * FROM auth_credentials').all()),new RegExp(grant.token));
 await assert.rejects(async()=>f.handoffs.invitation({serverUrl,label:'Generated',purpose:'central'},f.owner,f.authorize,f.connections));
 assert.ok(await f.accounts.verify(f.bgrant.token),'A pairing does not change B');
});

test('QR expiry, restart and creator revocation refuse new credentials',async t=>{
 const f=await fixture(t),expired=f.invitation(),first=pkce();f.advance(10*60000);
 await assert.rejects(async()=>f.handoffs.redeem(f.claim(expired.invitation.code,first.challenge)));assert.equal(f.issued().length,0);
 const lost=f.invitation(),restarted=new LoginHandoffs(f.connections,f.clock);t.after(()=>restarted.close());
 await assert.rejects(async()=>restarted.redeem(f.claim(lost.invitation.code,first.challenge)));assert.equal(f.issued().length,0);
 const revoked=f.invitation();f.accounts.revoke(f.context,f.authority,f.parent.credentialId);
 await assert.rejects(async()=>f.handoffs.redeem(f.claim(revoked.invitation.code,first.challenge)));assert.equal(f.issued().length,0);
 assert.ok(await f.accounts.verify(f.bgrant.token));
});

test('only the original QR account cancels, and cancellation revokes an unacknowledged real grant',async t=>{
 const f=await fixture(t),invite=f.invitation(),{verifier,challenge}=pkce(),request=await f.handoffs.redeem(f.claim(invite.invitation.code,challenge));
 const grant=f.handoffs.poll({id:request.id,verifier}) as any;
 await assert.rejects(async()=>f.handoffs.revokeInvitation({code:invite.invitation.code},f.b.userId));assert.ok(await f.accounts.verify(grant.token));
 await f.handoffs.revokeInvitation({code:invite.invitation.code},f.a.userId);
 assert.equal(await f.accounts.verify(grant.token),undefined);assert.throws(()=>f.handoffs.poll({id:request.id,verifier}));assert.throws(()=>f.handoffs.poll({id:request.id,verifier},true));
 await f.handoffs.revokeInvitation({code:invite.invitation.code},f.a.userId);
 await assert.rejects(async()=>f.handoffs.redeem(f.claim(invite.invitation.code,challenge)));assert.equal(f.issued().length,1);assert.ok(await f.accounts.verify(f.bgrant.token));
});

test('cancel during awaited credential publication fences the captured request and revokes its actual SQLite grant',async t=>{
 const f=await fixture(t),held=barrier();t.after(()=>held.release());
 const adapter:LoginConnections={...f.connections,session:async(...args)=>{const grant=await f.connections.session(...args);held.enter();await held.wait;return grant;}};
 const invite=f.invitation(adapter),{challenge}=pkce(),input=f.claim(invite.invitation.code,challenge);
 const outcome=f.handoffs.redeem(input).then(value=>({value}),error=>({error}));await held.entered;assert.equal(f.issued().length,1);
 const cancel=f.handoffs.revokeInvitation({code:invite.invitation.code},f.a.userId);held.release();await cancel;
 assert.ok('error' in await outcome,'a canceled captured request cannot publish a usable login request');
 assert.equal(f.issued().filter(row=>row.revoked_at===null).length,0);await assert.rejects(async()=>f.handoffs.redeem(input));assert.ok(await f.accounts.verify(f.bgrant.token));
});

test('revocation before ACK is rejected and cannot create an acknowledged tombstone',async t=>{
 const f=await fixture(t),invite=f.invitation(),{verifier,challenge}=pkce(),request=await f.handoffs.redeem(f.claim(invite.invitation.code,challenge));
 const grant=f.handoffs.poll({id:request.id,verifier}) as any;f.accounts.revoke(f.context,f.authority,grant.credentialId);
 assert.throws(()=>f.handoffs.poll({id:request.id,verifier},true));assert.throws(()=>f.handoffs.poll({id:request.id,verifier},true));assert.throws(()=>f.handoffs.poll({id:request.id,verifier}));
 assert.equal(f.issued().length,1);assert.ok(await f.accounts.verify(f.bgrant.token));
});

test('lost ACK retries only its matching tombstone, never redeliver a token or cancel a later pairing',async t=>{
 const f=await fixture(t),invite=f.invitation(),first=pkce(),request=await f.handoffs.redeem(f.claim(invite.invitation.code,first.challenge));
 const grant=f.handoffs.poll({id:request.id,verifier:first.verifier}) as any;
 assert.deepEqual(f.handoffs.poll({id:request.id,verifier:first.verifier},true),{acknowledged:true});assert.deepEqual(f.handoffs.poll({id:request.id,verifier:first.verifier},true),{acknowledged:true});
 assert.throws(()=>f.handoffs.poll({id:request.id,verifier:first.verifier}));assert.throws(()=>f.handoffs.poll({id:request.id,verifier:pkce().verifier},true));
 await f.handoffs.revokeInvitation({code:invite.invitation.code},f.a.userId);assert.ok(await f.accounts.verify(grant.token),'ACK makes the independent client require credential revocation');
 const next=f.invitation(),second=pkce(),nextRequest=await f.handoffs.redeem(f.claim(next.invitation.code,second.challenge,'generated-qr-device-2'));
 assert.deepEqual(f.handoffs.poll({id:request.id,verifier:first.verifier},true),{acknowledged:true});assert.equal((f.handoffs.poll({id:nextRequest.id,verifier:second.verifier}) as any).ready,true);
 f.handoffs.close();assert.throws(()=>f.handoffs.poll({id:request.id,verifier:first.verifier},true));assert.throws(()=>f.handoffs.poll({id:nextRequest.id,verifier:second.verifier}));assert.ok(await f.accounts.verify(grant.token));
});

test('closing while a real credential is awaiting publication cannot leave its grant usable',async t=>{
 const f=await fixture(t),held=barrier();t.after(()=>held.release());
 const adapter:LoginConnections={...f.connections,session:async(...args)=>{const grant=await f.connections.session(...args);held.enter();await held.wait;return grant;}};
 const invite=f.invitation(adapter),{challenge}=pkce(),input=f.claim(invite.invitation.code,challenge);
 const outcome=f.handoffs.redeem(input).then(value=>({value}),error=>({error}));await held.entered;f.handoffs.close();held.release();
 assert.ok('error' in await outcome);assert.equal(f.issued().filter(row=>row.revoked_at===null).length,0);assert.ok(await f.accounts.verify(f.bgrant.token));
});
