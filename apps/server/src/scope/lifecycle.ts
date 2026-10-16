import type {UserContext} from './context.js';
import {ScopeError,validScopeId} from './baseline.js';

declare const lifecycleBrand:unique symbol;
export type LifecyclePurpose='export'|'delete'|'restore';
/** Host control-plane grant, including cleanup after account disable. It cannot
 * be passed to forUser() or used to read arbitrary private services. */
export interface LifecycleContext {
  readonly [lifecycleBrand]:true;
  readonly deploymentId:string;
  readonly userId:string;
  readonly domain:string;
  readonly operationId:string;
  readonly purpose:LifecyclePurpose;
}
export class LifecycleAuthority {
  private readonly issued=new WeakSet<object>();
  constructor(private readonly deploymentId:string,private readonly verifier:{verify(grant:string):Promise<Omit<LifecycleContext,typeof lifecycleBrand>|undefined>;isCurrent(context:LifecycleContext):boolean}){}
  async authorize(grant:string){
    const subject=await this.verifier.verify(grant);
    if(!subject||subject.deploymentId!==this.deploymentId||![subject.userId,subject.domain,subject.operationId].every(validScopeId)||!['export','delete','restore'].includes(subject.purpose))throw new ScopeError('invalid_identity',403);
    const context=Object.freeze({...subject}) as LifecycleContext;this.issued.add(context);this.assert(context);return context;
  }
  assert(context:LifecycleContext){if(!context||!this.issued.has(context)||!this.verifier.isCurrent(context))throw new ScopeError('invalid_identity',403);}
}
export type UserDataSubject=UserContext|LifecycleContext;

export interface UserExport {
  readonly domain:string;
  readonly version:number;
  readonly deploymentId:string;
  readonly userId:string;
  readonly payload:unknown;
}
export interface DeletionReceipt {
  readonly status:'complete'|'pending'|'result_unknown';
  readonly operationId:string;
}
/** Every private domain (including extensions) declares these at registration.
 * M16 coordinates durable operation ids, fences and incomplete external results.
 * Restore validates the envelope's user/deployment before touching domain data.
 * Exports exclude credentials; this is not a single-user point-in-time backup. */
export interface DomainLifecycle {
  /** Personal archive data only. A synchronous hook composes with the host's
   * single SQLite publication transaction; false explicitly preserves current
   * settings/operational state. Missing policy blocks personal import. */
  importUser?:false|((context:UserContext,archive:UserExport,operationId:string)=>void|(()=>void));
  exportUser(context:UserDataSubject):Promise<UserExport>;
  deleteUser(context:UserDataSubject,operationId:string):Promise<DeletionReceipt>;
  restoreUser(context:UserDataSubject,archive:UserExport,operationId:string):Promise<void>;
}
