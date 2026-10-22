import {ScopeError,validScopeId} from './baseline.js';

declare const userContextBrand:unique symbol;
/** Never deserialize this type from a request or a persisted job. */
export interface UserContext {
  readonly [userContextBrand]:true;
  readonly deploymentId:string;
  readonly userId:string;
  readonly credentialId:string;
  readonly authorizationEpoch:number;
}
/** Returned only by the host's credential verifier (M01), never by a route body. */
export interface VerifiedIdentity {
  readonly deploymentId:string;
  readonly userId:string;
  readonly credentialId:string;
  readonly authorizationEpoch:number;
  readonly administrator:boolean;
}
export interface IdentityVerifier {
  verify(credential:string):Promise<VerifiedIdentity|undefined>;
  /** Must consult current account/credential state, including at publication. */
  isCurrent(identity:Readonly<VerifiedIdentity>):boolean;
}
/** Host-only durable grant lookup. Implementations load an admitted task's
 * persisted identity and account epoch; an ordinary request never supplies one.
 * Session logout does not revoke this grant, but account/reset/delete fences do. */
export interface DurableIdentityVerifier {
  verify(grantId:string):Promise<VerifiedIdentity|undefined>;
  isCurrent(identity:Readonly<VerifiedIdentity>):boolean;
}
export interface OperationClaim {
  readonly id:string;
  readonly purpose:'personal-import';
  readonly digest:string;
  readonly readDomains:readonly string[];
  readonly writeDomains:readonly string[];
}
export interface VerifiedOperationIdentity extends VerifiedIdentity {readonly operation:OperationClaim}
export interface OperationIdentityVerifier {
  verify(grantId:string):Promise<VerifiedOperationIdentity|undefined>;
  isCurrent(identity:Readonly<VerifiedOperationIdentity>):boolean;
}
type IssuedIdentity={identity:Readonly<VerifiedIdentity>;mode:'session'|'task'|'mcp'|'operation';operation?:OperationClaim};

export class UserContextAuthority {
  private readonly issued=new WeakMap<object,IssuedIdentity>();
  constructor(readonly deploymentId:string,private readonly verifier:IdentityVerifier,private readonly taskVerifier?:DurableIdentityVerifier,private readonly mcpVerifier?:IdentityVerifier,private readonly operationVerifier?:OperationIdentityVerifier){
    if(!validScopeId(deploymentId))throw new ScopeError('invalid_identity',401);
  }
  async authenticate(credential:unknown):Promise<UserContext>{
    if(typeof credential!=='string'||!credential)throw new ScopeError('identity_required',401);
    const identity=await this.verifier.verify(credential);
    return this.issue(identity,'session');
  }
  /** Separate host verifier: possession of an MCP token never authenticates an
   * ordinary HTTP session. Only the MCP host retains the resulting context. */
  async authenticateMcp(credential:unknown):Promise<UserContext>{
    if(typeof credential!=='string'||!credential||!this.mcpVerifier)throw new ScopeError('invalid_identity',401);
    return this.issue(await this.mcpVerifier.verify(credential),'mcp');
  }
  /** Restore only a host-verified durable task grant, never a serialized context.
   * Task identities can use their own private services but cannot administer the
   * instance, even if the account that admitted them is an administrator. */
  async restoreTask(grantId:unknown):Promise<UserContext>{
    if(typeof grantId!=='string'||!validScopeId(grantId)||!this.taskVerifier)throw new ScopeError('invalid_identity',401);
    const identity=await this.taskVerifier.verify(grantId);
    return this.issue(identity,'task');
  }
  /** Host-only, purpose-bound accepted operation. It is neither a login nor a
   * task capability, and cannot acquire further execution authority. */
  async restoreOperation(grantId:unknown):Promise<UserContext>{
    if(typeof grantId!=='string'||!validScopeId(grantId)||!this.operationVerifier)throw new ScopeError('invalid_identity',401);
    const identity=await this.operationVerifier.verify(grantId);
    return this.issue(identity,'operation',identity?.operation);
  }
  private issue(identity:VerifiedIdentity|undefined,mode:IssuedIdentity['mode'],claim?:OperationClaim):UserContext{
    if(!identity||identity.deploymentId!==this.deploymentId||![identity.userId,identity.credentialId].every(validScopeId)||typeof identity.administrator!=='boolean'||!Number.isSafeInteger(identity.authorizationEpoch)||identity.authorizationEpoch<0)throw new ScopeError('invalid_identity',401);
    if(mode==='operation'&&(!claim||!validScopeId(claim.id)||claim.purpose!=='personal-import'||!/^[a-f0-9]{64}$/.test(claim.digest)||![...claim.readDomains,...claim.writeDomains].every(domain=>typeof domain==='string'&&/^[a-z][a-z0-9-]*$/.test(domain))))throw new ScopeError('invalid_identity',401);
    const operation=claim?Object.freeze({...claim,readDomains:Object.freeze([...claim.readDomains]),writeDomains:Object.freeze([...claim.writeDomains])}):undefined;
    const saved=Object.freeze({...identity,...(mode==='task'||mode==='operation'?{administrator:false}:{})});
    const context=Object.freeze({deploymentId:saved.deploymentId,userId:saved.userId,credentialId:saved.credentialId,authorizationEpoch:saved.authorizationEpoch}) as UserContext;
    this.issued.set(context,{identity:saved,mode,...(operation?{operation}:{})});this.assert(context);return context;
  }
  assert(context:unknown):asserts context is UserContext {
    const issued=context&&typeof context==='object'?this.issued.get(context):undefined;
    if(!issued||!(issued.mode==='operation'?this.operationVerifier?.isCurrent({...issued.identity,operation:issued.operation!}):issued.mode==='task'?this.taskVerifier?.isCurrent(issued.identity):issued.mode==='mcp'?this.mcpVerifier?.isCurrent(issued.identity):this.verifier.isCurrent(issued.identity)))throw new ScopeError('invalid_identity',401);
  }
  operation(context:UserContext):OperationClaim|undefined{this.assert(context);return this.issued.get(context)!.operation;}
  assertNotOperation(context:UserContext){if(this.operation(context))throw new ScopeError('invalid_identity',403);}
  assertOperationDomain(context:UserContext,domain:string,purpose:'export'|'restore'){
    const claim=this.operation(context);if(claim&&!(purpose==='export'?claim.readDomains:claim.writeDomains).includes(domain))throw new ScopeError('invalid_identity',403);
  }
  assertOperationImport(context:UserContext,domain:string,operationId:string){
    const claim=this.operation(context);if(claim&&(claim.id!==operationId||!claim.writeDomains.includes(domain)))throw new ScopeError('invalid_identity',403);
  }
  assertAdministrator(context:unknown){this.assert(context);const issued=this.issued.get(context)!;if(issued.mode!=='session'||!issued.identity.administrator)throw new ScopeError('invalid_identity',403);}
  isSession(context:UserContext){this.assert(context);return this.issued.get(context)!.mode==='session';}
  isTask(context:UserContext){this.assert(context);return this.issued.get(context)!.mode==='task';}
}
