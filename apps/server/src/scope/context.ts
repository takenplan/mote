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

export class UserContextAuthority {
  private readonly issued=new WeakMap<object,Readonly<VerifiedIdentity>>();
  constructor(readonly deploymentId:string,private readonly verifier:IdentityVerifier){
    if(!validScopeId(deploymentId))throw new ScopeError('invalid_identity',401);
  }
  async authenticate(credential:unknown):Promise<UserContext>{
    if(typeof credential!=='string'||!credential)throw new ScopeError('identity_required',401);
    const identity=await this.verifier.verify(credential);
    if(!identity||identity.deploymentId!==this.deploymentId||![identity.userId,identity.credentialId].every(validScopeId)||typeof identity.administrator!=='boolean'||!Number.isSafeInteger(identity.authorizationEpoch)||identity.authorizationEpoch<0)throw new ScopeError('invalid_identity',401);
    const saved=Object.freeze({...identity});
    const context=Object.freeze({deploymentId:saved.deploymentId,userId:saved.userId,credentialId:saved.credentialId,authorizationEpoch:saved.authorizationEpoch}) as UserContext;
    this.issued.set(context,saved);this.assert(context);return context;
  }
  assert(context:unknown):asserts context is UserContext {
    const identity=context&&typeof context==='object'?this.issued.get(context):undefined;
    if(!identity||!this.verifier.isCurrent(identity))throw new ScopeError('invalid_identity',401);
  }
  assertAdministrator(context:unknown){this.assert(context);if(!this.issued.get(context)!.administrator)throw new ScopeError('invalid_identity',403);}
}
