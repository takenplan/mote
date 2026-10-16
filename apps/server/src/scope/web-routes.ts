import {FeatureRegistry} from '@mote/shared';
import {registerAuthenticatedRoute,type ScopedRuntime} from './http.js';

/** The existing Web dependency protocol observes actual Fastify registrations.
 * No manifest can turn a missing legacy route or provider into a capability. */
export function registerWebInventory(runtime:ScopedRuntime){
 const registry=new FeatureRegistry<unknown>(),seen=new Set<string>();
 registry.install({id:'mote.scoped-http',version:'1',components:[]},{completeTrustedTopology:true});
 runtime.app.addHook('onRoute',route=>{
  if(!route.url.startsWith('/api/'))return;
  for(const method of [route.method].flat()){
   const id=`http:${method}:${route.url}`;if(seen.has(id))continue;seen.add(id);
   registry.register('mote.scoped-http',{id,version:'1',surface:method==='GET'||method==='HEAD'?'data':'command'},{method,path:route.url});
  }
 });
 registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/features',handle:context=>{
  const inventory=registry.inventory();let administrator=false;
  try{runtime.authority.assertAdministrator(context);administrator=true;}catch{}
  if(administrator)return inventory;
  const visible=(id:string)=>!/^http:[^:]+:\/api\/admin(?:\/|$)/.test(id);
  return {...inventory,features:inventory.features.map(feature=>({...feature,components:feature.components.filter(component=>visible(component.id))})),capabilities:inventory.capabilities.filter(capability=>visible(capability.id))};
 }});
}
