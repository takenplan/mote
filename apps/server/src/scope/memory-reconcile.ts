import {memoryHash} from './memory-data.js';
import type {PrivateSql} from './private-data-sql.js';
import {memoryBindingSchema} from './memory-schema.js';
import type {ScopedMemoryProviders} from './memory-providers.js';
import type {UserDataSubject} from './lifecycle.js';
import {memoryProviderNamespaceSchema,memoryProviderKeySchema} from '../memory-provider-contract.js';
/** Queue only host-known exact writes; no caller-supplied namespace is accepted.
 * Keep minimal identifiers after revoking visibility, not the private body. */
export function queueMemoryErases(sql:PrivateSql,filter?:{jobId?:string;memoryId?:string}){
 for(const row of sql.all('SELECT id,json,state,key_json FROM mm_provider_journal WHERE user_id=$user')){
  const value=JSON.parse(String(row.json)),key=memoryProviderKeySchema.parse(JSON.parse(String(row.key_json)));
  if(filter?.jobId&&value.opId!==filter.jobId&&sql.get('SELECT job_id FROM mm_provider_journal WHERE user_id=$user AND id=?',row.id)?.job_id!==filter.jobId||filter?.memoryId&&key.memoryId!==filter.memoryId)continue;
  if(filter?.jobId&&sql.get('SELECT 1 FROM mm_records WHERE user_id=$user AND id=? AND version=? AND binding=?',key.memoryId,key.version,JSON.stringify(value.binding)))continue;
  if(['erased','erase_pending'].includes(String(row.state)))continue;
  sql.run("UPDATE mm_provider_journal SET state='erase_submitted',json=? WHERE user_id=$user AND id=?",JSON.stringify({binding:value.binding,previousState:value.previousState??row.state}),row.id);
 }
}
export function queueNativeCleanup(sql:PrivateSql,jobId?:string){for(const row of sql.all("SELECT job_id AS id,input,tasks FROM mm_job_batches WHERE user_id=$user AND NOT(state='deleted' AND input='{}')")){if(jobId&&row.id!==jobId)continue;const input=JSON.parse(String(row.input)),binding=memoryBindingSchema.parse(input.binding),tasks=JSON.parse(String(row.tasks));if(binding.kind!=='plugin'||!tasks.batch||!sql.get('SELECT 1 FROM mm_provider_config WHERE user_id=$user AND namespace_hash=?',memoryHash({ownerId:sql.userId,instanceId:binding.instanceId,bindingRevision:binding.revision})))continue;sql.run("INSERT OR IGNORE INTO mm_native_cleanup VALUES($user,?,?,?,'pending')",String(tasks.batch),JSON.stringify(binding),String(input.phase));}}
export async function reconcileMemory(sql:PrivateSql,providers:ScopedMemoryProviders,subject:UserDataSubject){
 let unknown=false;
 for(const row of sql.all("SELECT * FROM mm_native_cleanup WHERE user_id=$user AND state='pending'")){let provider:Awaited<ReturnType<ScopedMemoryProviders['maintenance']>>|undefined;try{const binding=memoryBindingSchema.parse(JSON.parse(String(row.binding)));if(binding.kind!=='plugin')continue;provider=await providers.maintenance(subject,binding,'delete');await provider.discardPrepared({namespace:{ownerId:subject.userId,instanceId:binding.instanceId,bindingRevision:binding.revision},opId:String(row.id),phase:zPhase(row.phase)});sql.run("UPDATE mm_native_cleanup SET state='complete' WHERE user_id=$user AND id=?",row.id);}catch{unknown=true;}finally{await provider?.close().catch(()=>{});}}

 for(const row of sql.all("SELECT * FROM mm_provider_journal WHERE user_id=$user AND state IN ('erase_submitted','erase_pending') ORDER BY id")){
  const value=JSON.parse(String(row.json)),binding=memoryBindingSchema.parse(value.binding);if(binding.kind!=='plugin')continue;
  let provider:Awaited<ReturnType<ScopedMemoryProviders['maintenance']>>|undefined;
  try{provider=await providers.maintenance(subject,binding,'delete');const namespace=memoryProviderNamespaceSchema.parse(JSON.parse(String(row.namespace))),key=memoryProviderKeySchema.parse(JSON.parse(String(row.key_json))),observed=await provider.observe({namespace,key});
   if(row.state==='erase_pending'&&!observed.present){unknown ||= value.previousState==='submitted';continue;}
   const attempt=Number(value.attempt??0)+1,receipt=await provider.remove({namespace,key,opId:'memory-erase:'+memoryHash([row.id,namespace,key,attempt])}),uncertain=value.previousState==='submitted'&&!observed.present;
   unknown ||= uncertain;sql.run('UPDATE mm_provider_journal SET state=?,json=? WHERE user_id=$user AND id=?',receipt.eraseVerified&&!uncertain?'erased':'erase_pending',JSON.stringify({binding,previousState:uncertain?'submitted':'observed',attempt,receipt}),row.id);
  }catch{unknown=true;}finally{await provider?.close().catch(()=>{});}
 }
 const pending=Number(sql.get("SELECT count(*) n FROM mm_provider_journal WHERE user_id=$user AND state IN ('submitted','erase_submitted','erase_pending')")!.n);return {status:unknown?'result_unknown':pending?'pending':'complete',pending} as const;
}

function zPhase(value:unknown):'extract'|'integrate'{if(value==='extract'||value==='integrate')return value;throw new Error('Invalid retained Memory phase');}
