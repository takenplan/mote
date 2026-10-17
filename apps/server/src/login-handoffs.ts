import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { connectionServerUrl } from '@mote/shared';
import { ConnectionError } from './connection-error.js';
import type { Connections } from './connections.js';
const secret = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const loginDeviceSchema = z.object({serverUrl:z.string().transform((v,ctx)=>{try{return connectionServerUrl(v);}catch{ctx.addIssue({code:'custom',message:'Invalid server URL'});return z.NEVER;}}),deviceId:z.string().regex(/^[a-zA-Z0-9_.:-]{1,128}$/),deviceName:z.string().trim().min(1).max(128),platform:z.enum(['android','macos','windows','linux','other']),purpose:z.enum(['device','central']).default('device'),challenge:z.string().regex(/^[a-f0-9]{64}$/),durationMs:z.union([z.literal(0),z.literal(86400000),z.literal(604800000),z.literal(2592000000)]).default(2592000000)}).strict();
type Grant = Omit<Awaited<ReturnType<Connections['session']>>,'scope'> & {scope:'owner'|'client';deploymentId?:string;userId?:string};
export interface LoginConnections {
  session(server:string,label:string,device?:{deviceId:string;deviceName:string;platform:'android'|'macos'|'windows'|'linux'|'other'},durationMs?:number):Promise<Grant>;
  revoke(id:string):Promise<unknown>;
  authenticate(header:string|undefined):{id:string}|undefined;
  assertActive(credential:{id:string}):void;
  activate?(credentialId:string):void;
}
type Request = {input:z.infer<typeof loginDeviceSchema>;deadline:number;grant?:Grant;approval?:Promise<Grant>;authorize?:()=>void;ownerKey?:string;label?:string;cancelled?:boolean;acknowledged?:boolean;consent?:{authorize:()=>void;connections:LoginConnections}};
const invitationSchema=loginDeviceSchema.pick({serverUrl:true,deviceId:true,durationMs:true}).partial({deviceId:true}).extend({label:z.string().trim().min(1).max(128)}).strict();
const subjectSchema=z.object({deploymentId:z.string().min(1).max(128),userId:z.string().min(1).max(128),serverUrl:loginDeviceSchema.shape.serverUrl,purpose:z.literal('device')}).strict();
const redeemSchema=loginDeviceSchema.pick({deviceId:true,deviceName:true,platform:true,challenge:true}).extend({code:secret,expected:subjectSchema}).strict();
type Invitation={input:z.infer<typeof invitationSchema>;subject:z.infer<typeof subjectSchema>;deadline:number;authorize:()=>void;connections:LoginConnections;id?:string;claim?:string;cancelled?:boolean};
/** Short-lived authorization exchanges. Never put long-lived bearer credentials in links. */
export class LoginHandoffs {
  private tickets = new Map<string,{token:string;deadline:number;expiresAt?:number;authorize:()=>void}>();
  private requests = new Map<string,Request>();
  private invitations = new Map<string,Invitation>();
  constructor(private connections:LoginConnections,private clock=Date.now) {}
  private prune(){for(const [k,v] of this.invitations)if(v.deadline<=this.clock())this.invitations.delete(k);for(const [k,v] of this.tickets)if(v.deadline<=this.clock())this.tickets.delete(k);for(const [k,v] of this.requests)if(v.deadline<=this.clock())this.requests.delete(k);}
  ticket(token:string,authorize:()=>void,expiresAt?:number){
    authorize();this.prune();const code=randomBytes(32).toString('base64url');
    if(this.tickets.size>=512)throw new ConnectionError('login_capacity',429,'Login exchange capacity reached');
    this.tickets.set(hash(code),{token,authorize,deadline:this.clock()+60000,expiresAt});return {code};
  }
  exchange(raw:unknown){
    const {code}=z.object({code:secret}).strict().parse(raw);this.prune();const key=hash(code),ticket=this.tickets.get(key);
    if(!ticket)throw new ConnectionError('login_expired',410,'Login link expired');
    this.tickets.delete(key);if(ticket.expiresAt&&ticket.expiresAt<=this.clock())throw new ConnectionError('login_expired',410,'Login link expired');ticket.authorize();return {token:ticket.token,...(ticket.expiresAt?{expiresAt:ticket.expiresAt}:{})};
  }
  create(raw:unknown){this.prune();if(this.requests.size>=512)throw new ConnectionError('login_capacity',429,'Login exchange capacity reached');const input=loginDeviceSchema.parse(raw),id=randomBytes(32).toString('base64url');this.requests.set(hash(id),{input,deadline:this.clock()+10*60000});return {id};}
  private request(id:string){secret.parse(id);this.prune();const request=this.requests.get(hash(id));if(!request)throw new ConnectionError('login_expired',410,'Login request expired');return request;}
  detail(id:string,ownerKey?:string){const r=this.request(id);if(ownerKey!==undefined&&r.ownerKey!==undefined&&r.ownerKey!==ownerKey)throw new ConnectionError('login_owner_changed',403,'Login belongs to another account');return {deviceName:r.input.deviceName,platform:r.input.platform,serverUrl:r.input.serverUrl,expiresAt:r.deadline,...(r.input.purpose==='central'?{purpose:'central' as const}:{})};}
  async approve(id:string,authorize:()=>void,ownerKey?:string,connections:LoginConnections=this.connections){
    const r=this.request(id);authorize();if(r.cancelled||r.acknowledged)throw new ConnectionError('login_expired',410,'Login request expired');if(r.ownerKey!==undefined&&r.ownerKey!==ownerKey)throw new ConnectionError('login_owner_changed',403,'Login approval belongs to another account');r.ownerKey=ownerKey;if(r.consent){const current=authorize;authorize=()=>{current();r.consent!.authorize();};connections=r.consent.connections;}if(r.grant)return {approved:true};
    const approval=r.approval??=(async()=>{const {serverUrl,deviceId,deviceName,platform,durationMs,purpose}=r.input;const grant=await connections.session(serverUrl,r.label??deviceName,purpose==='central'?undefined:{deviceId,deviceName,platform},durationMs);
      try{authorize();if(r.cancelled||r.acknowledged||this.requests.get(hash(id))!==r||r.deadline<=this.clock())throw new ConnectionError('login_expired',410,'Login request expired');connections.activate?.(grant.credentialId);}
      catch(e){await connections.revoke(grant.credentialId);throw e;}
      r.grant=grant;r.authorize=()=>{const c=connections.authenticate('Bearer '+grant.token);if(!c)throw new ConnectionError('unauthorized',401,'Login revoked');connections.assertActive(c);};return grant;
    })();try{await approval;}finally{if(r.approval===approval)r.approval=undefined;}return {approved:true};
  }
  /** The authenticated invitation creation is the original explicit device consent.
   * A scan binds that short-lived authorization to one PKCE client, then uses the
   * same approval, account credential, poll and ACK lifecycle as native login. */
  invitation(raw:unknown,identity:{deploymentId:string;userId:string},authorize:()=>void,connections:LoginConnections){
    authorize();this.prune();
    if(this.invitations.size>=512)throw new ConnectionError('login_capacity',429,'Login exchange capacity reached');
    const input=invitationSchema.parse(raw),code=randomBytes(32).toString('base64url'),deadline=this.clock()+10*60000;
    const subject=subjectSchema.parse({deploymentId:identity.deploymentId,userId:identity.userId,serverUrl:input.serverUrl,purpose:'device'});
    this.invitations.set(hash(code),{input,subject,deadline,authorize,connections});
    const invitation={format:'mote.connection' as const,version:2 as const,...subject,code,expiresAt:new Date(deadline).toISOString(),...(input.deviceId?{deviceId:input.deviceId}:{})};
    return {invitation,uri:'mote://connect?data='+Buffer.from(JSON.stringify(invitation)).toString('base64url')};
  }
  async redeem(raw:unknown){
    const input=redeemSchema.parse(raw);this.prune();const invitation=this.invitations.get(hash(input.code));
    if(!invitation||invitation.cancelled)throw new ConnectionError('invitation_invalid_or_expired',410,'Invitation expired');
    const {expected,...claim}=input;
    if(Object.keys(invitation.subject).some(key=>invitation.subject[key as keyof typeof expected]!==expected[key as keyof typeof expected]))throw new ConnectionError('invitation_subject_mismatch',403,'Invitation subject mismatch');
    if(invitation.input.deviceId&&invitation.input.deviceId!==input.deviceId)throw new ConnectionError('invitation_device_mismatch',403,'Invitation device mismatch');
    const fingerprint=hash(JSON.stringify(claim));
    if(invitation.claim&&invitation.claim!==fingerprint)throw new ConnectionError('invitation_claim_changed',409,'Invitation already bound to another client');
    // Creation consent is live until the first grant commits; subsequent polls
    // use the independent device credential, matching existing M01 semantics.
    if(!invitation.id){
      invitation.authorize();
      const created=this.create({serverUrl:invitation.input.serverUrl,durationMs:invitation.input.durationMs,deviceId:input.deviceId,deviceName:input.deviceName,platform:input.platform,challenge:input.challenge,purpose:'device'});
      invitation.id=created.id;invitation.claim=fingerprint;
      const request=this.request(created.id);request.deadline=invitation.deadline;request.ownerKey=invitation.subject.userId;request.label=invitation.input.label;request.consent={authorize:invitation.authorize,connections:invitation.connections};
    }
    const request=this.request(invitation.id);
    if(request.cancelled||request.acknowledged)throw new ConnectionError('invitation_invalid_or_expired',410,'Invitation consumed');
    if(request.grant)request.authorize?.();
    else await this.approve(invitation.id,invitation.authorize,invitation.subject.userId,invitation.connections);
    return {id:invitation.id,expiresAt:invitation.deadline};
  }
  async revokeInvitation(raw:unknown,ownerKey:string){
    const {code}=z.object({code:secret}).strict().parse(raw);this.prune();const invitation=this.invitations.get(hash(code));
    if(!invitation||invitation.subject.userId!==ownerKey)throw new ConnectionError('invitation_not_found',404,'Invitation not found');
    const request=invitation.id?this.requests.get(hash(invitation.id)):undefined;
    // ACK is the linearization point: after it, manage the independent credential
    // through ordinary connection revocation, as in the original invitation flow.
    if(request?.acknowledged)return {revoked:true};
    invitation.cancelled=true;if(request)request.cancelled=true;
    if(request?.grant)await invitation.connections.revoke(request.grant.credentialId);
    return {revoked:true};
  }
  close(){for(const r of this.requests.values())r.cancelled=true;this.tickets.clear();this.requests.clear();this.invitations.clear();}
  poll(raw:unknown,ack=false){const {id,verifier}=z.object({id:secret,verifier:secret}).strict().parse(raw),r=this.request(id);
    if(hash(verifier)!==r.input.challenge)throw new ConnectionError('unauthorized',401,'Invalid login verifier');
    if(r.cancelled)throw new ConnectionError('login_expired',410,'Login request expired');
    // An ACK receipt contains no grant. Retain it only until the original deadline
    // so a lost ACK response can be retried without reviving a consumed login.
    if(r.acknowledged){if(ack)return {acknowledged:true};throw new ConnectionError('login_expired',410,'Login request consumed');}
    r.authorize?.();
    if(ack){if(!r.grant)throw new ConnectionError('login_pending',409,'Login pending');r.acknowledged=true;r.grant=undefined;r.authorize=undefined;return {acknowledged:true};}
    return r.grant?{ready:true,...r.grant,purpose:r.input.purpose,...(r.input.purpose==='device'?{deviceId:r.input.deviceId}:{})}:{ready:false};
  }
}
