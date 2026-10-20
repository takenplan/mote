import {z} from 'zod';
import type {Configurations} from './configuration.js';
import {registerAuthenticatedRoute,type ScopedRuntime} from './http.js';

const values=z.object({retentionDays:z.number().min(0).max(36500),maxStorageBytes:z.number().min(1024*1024).max(1000000*1024*1024)}).strict();
/** Administrator controls the existing instance storage policy. Personal
 * encryption remains in its original owner-scoped settings. */
export function registerStorageSettings(runtime:ScopedRuntime,configuration:Configurations){
 const view=()=>{const domain=configuration.instance.view().domains.find(value=>value.id==='storage')!;return {scope:'instance',revision:configuration.instance.revision,saved:values.parse(Object.fromEntries(Object.entries(domain.saved as object).filter(([key])=>key==='retentionDays'||key==='maxStorageBytes'))),effective:values.parse(Object.fromEntries(Object.entries(domain.effective as object).filter(([key])=>key==='retentionDays'||key==='maxStorageBytes'))),status:domain.status};};
 registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/admin/storage-settings',administrator:true,handle:(_context,request)=>{z.object({}).strict().parse(request.query);return view();}});
 registerAuthenticatedRoute(runtime,{method:'PUT',url:'/api/admin/storage-settings',administrator:true,handle:async(context,request)=>{
  const {revision,...input}=values.extend({revision:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)}).strict().parse(request.body);
  await configuration.instance.update('storage',{...configuration.instance.saved<Record<string,unknown>>('storage'),...input},revision,()=>runtime.authority.assertAdministrator(context));return view();
 }});
}
