import {createInterface} from 'node:readline';
import {pathToFileURL} from 'node:url';

// Trusted plugin code runs with host permissions. This process boundary is a
// lifecycle boundary; it is deliberately not advertised as a security sandbox.
const pending=new Map();
const hostPending=new Map();let hostSequence=0;
let runtime;
const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
const input=createInterface({input:process.stdin,crlfDelay:Infinity});
input.on('line',async line=>{
 let message;try{message=JSON.parse(line);}catch{return;}
 if(message?.hostResult){const call=hostPending.get(message.hostResult);if(!call)return;hostPending.delete(message.hostResult);message.error?call.reject(Error('host_capability_rejected')):call.resolve(message.result);return;}
 if(!message||typeof message.id!=='number')return;
 try{
  if(message.method==='initialize'){
   if(runtime)throw Error('already_initialized');
   const module=await import(pathToFileURL(message.params.entry).href);
   const create=module.createMotePlugin??module.createMemoryProvider;
   if(typeof create!=='function')throw Error('plugin_factory_missing');
   runtime=await create(message.params.configuration);
   send({id:message.id,result:{initialized:true}});return;
  }
  if(!runtime)throw Error('runtime_unavailable');
  if(message.method==='describe'){if((runtime.components??[]).some(c=>typeof c.invoke!=='function'))throw Error('component_callback_missing');send({id:message.id,result:{components:(runtime.components??[]).map(({invoke,...descriptor})=>descriptor)}});return;}
  const controller=new AbortController();pending.set(message.id,controller);
  let result;
  if(message.method==='invoke'){
   const component=runtime.components?.find(component=>component.id===message.params.componentId);
   if(typeof component?.invoke!=='function')throw Error('component_unavailable');
   const host=Object.freeze({call:(method,params)=>new Promise((resolve,reject)=>{const id=++hostSequence;hostPending.set(id,{resolve,reject});send({id:message.id,hostCall:{id,method,params}});})});
   result=await component.invoke(message.params.input,host,controller.signal);
  }else{
   if(!['health','put','read','remove','search','export','close','lifecycle'].includes(message.method)||typeof runtime[message.method]!=='function')throw Error('method_unavailable');
   result=await runtime[message.method](message.params,controller.signal);
  }
  send({id:message.id,result});
 }catch(error){send({id:message.id,error:{code:typeof error?.code==='string'?error.code:'plugin_operation_failed'}});}
 finally{pending.delete(message.id);}
});
input.on('close',()=>{for(const controller of pending.values())controller.abort();for(const call of hostPending.values())call.reject(Error('host_closed'));void Promise.resolve(runtime?.close?.()).finally(()=>process.exit(0));});
