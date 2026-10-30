import {StoreError} from './store.js';
export type EvidenceDeletionCapability={available:boolean;kind:'capture'|'file'|null};
type Alias={virtual:boolean;captureId?:string};
/** The HTTP entrypoint chooses no tables: each domain resolves and deletes its own identities. */
export class EvidenceDeletion {
 constructor(private captures:{delete(id:string,assertCurrent?:()=>void):{deleted:number};evidence(ids:string[]):unknown[]},private files:{captureForEvidence(id:string):string|undefined;remove(id:string):{deleted:number}},private aliases:{resolve(id:string):Alias}){}
 capability(id:string):EvidenceDeletionCapability{
  if(this.files.captureForEvidence(id))return {available:true,kind:'file'};
  const alias=this.aliases.resolve(id),available=alias.virtual?Boolean(alias.captureId):this.captures.evidence([id]).length===1;
  return {available,kind:available?'capture':null};
 }
 delete(id:string){
  const file=this.files.captureForEvidence(id);if(file)return this.files.remove(file);
  const alias=this.aliases.resolve(id);
  if(!alias.virtual)return this.captures.delete(id);
  if(!alias.captureId)throw new StoreError('This reference cannot directly delete an original record',409);
  return this.captures.delete(alias.captureId,()=>{
   if(this.aliases.resolve(id).captureId!==alias.captureId)throw new StoreError('Original record changed; refresh before deleting',409);
  });
 }
}
