import {z} from 'zod';
import type {FastifyRequest,FastifyReply} from 'fastify';
import {LoginHandoffs} from '../login-handoffs.js';
import {Accounts,AuthError,digest,usernameSchema,passwordSchema,durationSchema} from './accounts.js';
import {registerAuthenticatedRoute,SESSION_COOKIE,cookieCredential,rejectIdentitySelectors,type ScopedRuntime} from './http.js';
import {connectionServerUrl} from '@mote/shared';
import type {PrivateData} from './private-data.js';
import type {ScopedMcp} from './mcp.js';
import type {UserContext} from './context.js';

const id=(request:FastifyRequest)=>(request.params as {id:string}).id;
const serverUrl=z.string().transform((value,ctx)=>{try{return connectionServerUrl(value);}catch{ctx.addIssue({code:'custom',message:'Invalid server URL'});return z.NEVER;}});
const device=z.object({serverUrl,deviceId:z.string().regex(/^[A-Za-z0-9_.:-]{1,128}$/),deviceName:z.string().trim().min(1).max(128),platform:z.enum(['android','macos','windows','linux','other']),durationMs:durationSchema.default(2592000000)}).strict();
function sessionCookie(reply:FastifyReply,token:string,durationMs:number){reply.header('Set-Cookie',`${SESSION_COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict${durationMs?`; Max-Age=${Math.floor(durationMs/1000)}`:''}`);}
const clearCookie=(reply:FastifyReply)=>reply.header('Set-Cookie',`${SESSION_COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`);
/** Same-origin JSON protects login/exchange against login-CSRF. Mutations using
 * a cookie also require the per-session secret in the common resolver. */
export function registerAuthentication(runtime:ScopedRuntime&{accounts:Accounts},publicUrl?:string|null,onPasswordLogin?:(context:UserContext)=>void){
  const {app,authority,accounts}=runtime;
  app.addHook('onRequest',async(req,reply)=>{
    reply.header('Cache-Control','no-store');reply.header('Pragma','no-cache');
    if((req.url.startsWith('/api/auth/')||req.url.startsWith('/api/login/')||req.url.split('?')[0]==='/api/connections/redeem')&&req.headers['x-mote-protocol-version']!=='2')throw new AuthError('incompatible_protocol',426);
    if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.url.startsWith('/api/')){
      if(['/api/auth/login','/api/login/exchange','/api/login/requests','/api/login/poll','/api/login/ack','/api/connections/redeem'].includes(req.url.split('?')[0])&&!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']??''))throw new AuthError('json_required',415);
      const origin=req.headers.origin;
      if(origin){let expected:string;try{expected=new URL(publicUrl||`${req.protocol}://${req.headers.host}`).origin;}catch{throw new AuthError('origin_denied',403);}if(origin!==expected)throw new AuthError('origin_denied',403);}
      if(req.headers['sec-fetch-site']==='cross-site')throw new AuthError('origin_denied',403);
    }
  });
  const unavailable=()=>{throw new AuthError('identity_required',401);};
  const handoffs=new LoginHandoffs({session:unavailable,revoke:unavailable,authenticate:unavailable,assertActive:unavailable});
  app.addHook('onClose',async()=>handoffs.close());
  const log=(event:string,fields:Parameters<NonNullable<typeof runtime.diagnostics>['record']>[1]={},level:'debug'|'info'|'warn'|'error'='info')=>runtime.diagnostics?.record(event,fields,level);
  app.post('/api/auth/login',{bodyLimit:8192},async(req,reply)=>{
    rejectIdentitySelectors(req);
    const input=z.object({username:usernameSchema,password:z.string().max(1024),mode:z.enum(['web','client']).default('web'),durationMs:durationSchema.default(0)}).strict().parse(req.body);
    let grant;
    try{grant=await accounts.login(input.username,input.password,req.ip,input.mode,input.durationMs);}
    catch(error){log('auth.login_failed',{kind:input.mode,category:error instanceof AuthError?error.code:undefined,errorName:error instanceof Error?error.name:undefined},'warn');throw error;}
    const context=await authority.authenticate(grant.token);
    log('auth.login',{userId:context.userId,credentialId:context.credentialId,kind:input.mode});
    onPasswordLogin?.(context);
    if(input.mode==='web'){sessionCookie(reply,grant.token,input.durationMs);const {token:_,...result}=grant;return result;}return grant;
  });
  registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/auth/self',discoverSession:true,handle:(c,req)=>({...accounts.self(c,authority),expiresAt:accounts.credentialInfo(c,authority).expiresAt,...(cookieCredential(req)?{csrfToken:digest('csrf:'+cookieCredential(req))}:{})})});
  registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/auth/logout',revokesSelf:true,handle:(c,_req,reply)=>{const result=accounts.revoke(c,authority,c.credentialId);log('auth.logout',{userId:c.userId,credentialId:c.credentialId});clearCookie(reply);return result;}});
  registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/auth/password',revokesSelf:true,handle:async(c,req,reply)=>{const input=z.object({currentPassword:z.string().max(1024),password:passwordSchema}).strict().parse(req.body);const result=await accounts.changePassword(c,authority,input.currentPassword,input.password,req.ip);log('auth.password_changed',{userId:c.userId});clearCookie(reply);return result;}});
  registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/admin/accounts',administrator:true,handle:c=>accounts.listAccounts(c,authority)});
  registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/admin/accounts',administrator:true,handle:async(c,req)=>{const input=z.object({username:usernameSchema,password:passwordSchema,administrator:z.boolean().default(false)}).strict().parse(req.body);const created=await accounts.createAccount(c,authority,input);log('auth.account_created',{userId:c.userId,accountId:created.userId,kind:input.administrator?'administrator':'member'});return created;}});
  registerAuthenticatedRoute(runtime,{method:'PATCH',url:'/api/admin/accounts/:id',administrator:true,revokesSelf:(c,req)=>c.userId===id(req)&&(req.body as {disabled?:boolean})?.disabled===true,handle:(c,req)=>{const input=z.object({disabled:z.boolean()}).strict().parse(req.body);const result=accounts.disable(c,authority,id(req),input.disabled);log(input.disabled?'auth.account_disabled':'auth.account_enabled',{userId:c.userId,accountId:id(req)});return result;}});
  registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/admin/accounts/:id/password',administrator:true,revokesSelf:(c,req)=>c.userId===id(req),handle:async(c,req)=>{const result=await accounts.resetPassword(c,authority,id(req),z.object({password:passwordSchema}).strict().parse(req.body).password);log('auth.password_reset',{userId:c.userId,accountId:id(req)});return result;}});
  registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/connections',handle:c=>accounts.credentials(c,authority)});
  registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/connections/self',discoverSession:true,handle:c=>({account:accounts.self(c,authority),credential:accounts.credentialInfo(c,authority),protocol:{min:2,max:2},capabilities:{authentication:true,ingest:true,ingressVersion:3,archiveRead:false}})});
  registerAuthenticatedRoute(runtime,{method:'DELETE',url:'/api/connections/:id',revokesSelf:(c,req)=>c.credentialId===id(req),handle:(c,req)=>{const result=accounts.revoke(c,authority,id(req));log('auth.credential_revoked',{userId:c.userId,credentialId:id(req)});return result;}});
  registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/connections/mcp',handle:(c,req)=>{const input=z.object({access:z.enum(['read','write']),sourceIds:z.array(z.string().regex(/^[a-zA-Z0-9_.:-]{1,128}$/)).max(500).optional(),label:z.string().trim().min(1).max(120),durationMs:durationSchema.default(2592000000)}).strict().parse(req.body),sourceIds=[...new Set(input.sourceIds)].sort();for(const id of sourceIds)runtime.services.forUser(c).get<PrivateData>('private-data').source(id);const sourcePins=runtime.services.forUser(c).get<ReturnType<ScopedMcp['forUser']>>('mcp').pinSources(sourceIds);const grant=accounts.mintMcp(c,authority,{...input,sourceIds,sourcePins});log('auth.mcp_minted',{userId:c.userId,credentialId:grant.credentialId,kind:input.access,sources:sourceIds.length});return grant;}});
  registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/login/session',handle:(c,req)=>{const input=device.parse(req.body);const grant=accounts.issueClient(c,authority,{...input,label:input.deviceName});log('auth.client_issued',{userId:c.userId,credentialId:grant.credentialId,name:input.deviceName,kind:input.platform});return grant;}});
  registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/login/ticket',handle:(c,req)=>{
    z.object({}).strict().parse(req.body??{});const token=cookieCredential(req)??req.headers.authorization!.slice(7),deadline=accounts.credentialInfo(c,authority).expiresAt;
    log('auth.ticket_issued',{userId:c.userId,credentialId:c.credentialId},'debug');
    return handoffs.ticket(token,()=>authority.assert(c),deadline);
  }});
  app.post('/api/login/exchange',{bodyLimit:8192},async(req,reply)=>{const exchanged=handoffs.exchange(req.body),grant=accounts.exchangeWeb(exchanged.token);const context=await authority.authenticate(grant.token);log('auth.login_exchanged',{userId:context.userId,credentialId:context.credentialId});sessionCookie(reply,grant.token,0);const {token:_,...result}=grant;return result;});
  registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/connections/invitations',handle:(c,req)=>{
    const input=z.object({serverUrl,label:z.string().trim().min(1).max(128),deviceId:device.shape.deviceId.optional(),durationMs:durationSchema.default(2592000000)}).strict().parse(req.body);
    const result=handoffs.invitation(input,c,()=>authority.assert(c),accounts.pairingConnections(c,authority,input.deviceId,deviceId=>runtime.services.forUser(c).get<{devices:()=>{items:Array<{id:string}>}}>('ingress').devices().items.some(d=>d.id===deviceId)||runtime.services.forUser(c).get<PrivateData>('private-data').sources().some(s=>s.deviceId===deviceId)));
    log('auth.invitation_created',{userId:c.userId,name:input.label});
    return result;
  }});
  registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/connections/invitations/revoke',handle:(c,req)=>{const result=handoffs.revokeInvitation(req.body,c.userId);log('auth.invitation_revoked',{userId:c.userId});return result;}});
  app.post('/api/connections/redeem',{bodyLimit:8192},req=>{const result=handoffs.redeem(req.body);log('auth.redeemed');return result;});
  app.post('/api/login/requests',{bodyLimit:8192},req=>{const result=handoffs.create(req.body);log('auth.login_requested',{},'debug');return result;});
  registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/login/requests/:id',handle:(c,req)=>handoffs.detail(id(req),c.userId)});
  registerAuthenticatedRoute(runtime,{method:'POST',url:'/api/login/requests/:id/approve',handle:async(c,req)=>{
    const result=await handoffs.approve(id(req),()=>authority.assert(c),c.userId,accounts.handoffConnections(c,authority));
    log('auth.login_approved',{userId:c.userId});
    return result;
  }});
  app.post('/api/login/poll',{bodyLimit:8192},req=>handoffs.poll(req.body));
  app.post('/api/login/ack',{bodyLimit:8192},req=>handoffs.poll(req.body,true));
}
