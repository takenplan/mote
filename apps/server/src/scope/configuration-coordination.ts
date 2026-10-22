import {isDeepStrictEqual} from 'node:util';
import type {ConfigDomainView} from '@mote/shared';
import {ConfigServiceError,type ConfigDocument,type ConfigTransaction,type PreparedConfigChange} from '../config-service.js';
import type {UserContext} from './context.js';
import type {UserDataSubject} from './lifecycle.js';

export type ConfigurationChange=Readonly<{source:ConfigTransaction['source'];revision:number;context?:UserContext;requested:boolean;intentPaths:readonly string[];processingPreserveImagePlan:boolean}>;
export type ConfigurationEffect=(subject:UserDataSubject,next:unknown,previous:unknown,change:ConfigurationChange)=>PreparedConfigChange|Promise<PreparedConfigChange>;
export type ConfigurationPublicationEffect=(subject:UserDataSubject,next:Readonly<ConfigDocument>,previous:Readonly<ConfigDocument>,change:ConfigurationChange)=>PreparedConfigChange|Promise<PreparedConfigChange>;
export type ConfigurationRequestFacts=Readonly<{processingPreserveImagePlan?:true}>;
export type ConfigurationObservation=(context:UserContext)=>NonNullable<ConfigDomainView['automation']>;
type Mutation={context:UserContext;values:Record<string,unknown>;intent:readonly string[];processingPreserveImagePlan:boolean};
const paths:Readonly<Record<string,readonly string[]>>={actions:['enabled'],memory:['lifecycle.working.enabled','lifecycle.insights.enabled']};
/** Explicit enablement is distinct from a serialized enabled default. A host
 * session still has to prove its ordinary-owner capability at the effect. */
export function configurationEnables(change:ConfigurationChange,path:string,next:boolean,previous:boolean){return Boolean(change.context&&change.source==='update'&&change.requested&&next&&(!previous||change.intentPaths.includes(path)));}
/** Registered domains keep their normal prepare lifecycle. Effects coordinate
 * the same transaction, with opaque request provenance that files cannot copy. */
export class ConfigurationCoordination{
 private readonly effects=new Map<string,ConfigurationEffect[]>();
 private readonly publicationEffects:ConfigurationPublicationEffect[]=[];
 private readonly observations=new Map<string,ConfigurationObservation[]>();
 private readonly requests=new WeakMap<object,Mutation>();
 register(domain:string,effect:ConfigurationEffect,observe?:ConfigurationObservation){this.effects.set(domain,[...this.effects.get(domain)??[],effect]);if(observe)this.observations.set(domain,[...this.observations.get(domain)??[],observe]);}
 registerPublication(effect:ConfigurationPublicationEffect){this.publicationEffects.push(effect);}
 request(context:UserContext,values:Record<string,unknown>,intent:readonly string[]=[],facts:ConfigurationRequestFacts={}){
  if(Object.keys(facts).some(key=>key!=='processingPreserveImagePlan')||(facts.processingPreserveImagePlan!==undefined&&facts.processingPreserveImagePlan!==true))throw new ConfigServiceError('config_invalid');
  for(const path of intent){const separator=path.indexOf(':'),domain=path.slice(0,separator),field=path.slice(separator+1);if(separator<1||!Object.hasOwn(values,domain)||!paths[domain]?.includes(field))throw new ConfigServiceError('config_invalid');}
  const token=Object.freeze({});this.requests.set(token,{context,values,intent:[...new Set(intent)],processingPreserveImagePlan:facts.processingPreserveImagePlan===true});return token;
 }
 async prepare(subject:UserDataSubject,next:Readonly<ConfigDocument>,previous:Readonly<ConfigDocument>,transaction:ConfigTransaction):Promise<PreparedConfigChange>{
  const mutation=transaction.source==='update'&&transaction.request&&typeof transaction.request==='object'?this.requests.get(transaction.request):undefined,candidates:{candidate:PreparedConfigChange;applied:boolean;published:boolean}[]=[];
  const applied:typeof candidates=[];
  try{for(const [domain,effects] of this.effects){const requested=Boolean(mutation&&Object.hasOwn(mutation.values,domain));if(transaction.source!=='initialize'&&!requested&&isDeepStrictEqual(next[domain],previous[domain]))continue;
   const change:ConfigurationChange={source:transaction.source,revision:transaction.revision,requested,...(mutation?{context:mutation.context}:{}),intentPaths:mutation?.intent.filter(path=>path.startsWith(domain+':')).map(path=>path.slice(domain.length+1))??[],processingPreserveImagePlan:mutation?.processingPreserveImagePlan??false};
   for(const effect of effects)candidates.push({candidate:await effect(subject,structuredClone(next[domain]),structuredClone(previous[domain]),change),applied:false,published:false});
  }
   const change:ConfigurationChange={source:transaction.source,revision:transaction.revision,requested:Boolean(mutation),...(mutation?{context:mutation.context}:{}),intentPaths:mutation?.intent??[],processingPreserveImagePlan:mutation?.processingPreserveImagePlan??false};
   for(const effect of this.publicationEffects)candidates.push({candidate:await effect(subject,structuredClone(next),structuredClone(previous),change),applied:false,published:false});
  }catch(error){for(const {candidate} of [...candidates].reverse()){try{await candidate.dispose?.();}catch{/* Preserve the original preparation failure after all cleanup. */}}throw error;}
  return {apply:async()=>{for(const item of [...candidates].sort((a,b)=>(a.candidate.applyOrder??0)-(b.candidate.applyOrder??0))){item.applied=true;applied.push(item);await item.candidate.apply();}},publish:()=>{for(const item of candidates){if(!item.candidate.publish)continue;item.published=true;const result=item.candidate.publish() as unknown;if(result&&typeof (result as {then?:unknown}).then==='function'){void Promise.resolve(result).catch(()=>{});throw new ConfigServiceError('config_commit_uncertain');}}},rollback:()=>{
   const undo=[...candidates.filter(item=>item.published).reverse(),...applied.filter(item=>!item.published).reverse()];let pending:Promise<void>|undefined,failed:unknown;
   const rollback=(item:typeof candidates[number])=>{try{if(!item.candidate.rollback){if(item.published||!item.candidate.publish)throw new ConfigServiceError('config_commit_uncertain');return;}const result=item.candidate.rollback();if(result&&typeof result.then==='function')return Promise.resolve(result).catch(error=>{failed??=error;});}catch(error){failed??=error;}};
   for(const item of undo){if(pending)pending=pending.then(()=>rollback(item));else{const result=rollback(item);if(result)pending=result;}}
   // Keep a Promise visible: ConfigService awaits resource-only rollback and
   // rejects asynchronous rollback after publication as commit-uncertain.
   if(pending)return pending.then(()=>{if(failed)throw failed;});if(failed)throw failed;

  },dispose:async()=>{let failed:unknown;for(const {candidate} of candidates){try{await candidate.dispose?.();}catch(error){failed??=error;}}if(failed)throw failed;},complete:()=>{for(const {candidate} of candidates)candidate.complete?.();}};
 }

 observe(context:UserContext,domain:string){const items=this.observations.get(domain)?.flatMap(observe=>observe(context));return items?.length?items:undefined;}
}
