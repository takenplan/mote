/** Inject before built main. Passive test observations only: native lock calls
 * receive the same arguments and callers receive the identical native Promise.
 * No auth request, credential mutation, route mutation or promise replacement. */
module.exports=function observeHandoffSettlement(){
 const records=[],roots=new Set();let rendererId=0;
 const hook={supportsFiber:true,renderers:new Map(),inject(renderer){const id=++rendererId;hook.renderers.set(id,renderer);return id;},onCommitFiberRoot(_id,root){roots.add(root);},onCommitFiberUnmount(){},checkDCE(){}};
 Object.defineProperty(window,'__REACT_DEVTOOLS_GLOBAL_HOOK__',{value:hook});
 const locks=navigator.locks;
 const supported=!!locks&&typeof locks.request==='function';
 if(supported){
  const request=locks.request;
  Object.defineProperty(locks,'request',{value:function(...args){
   const promise=Reflect.apply(request,this,args);
   if(args[0]==='mote.web-auth'){
    const record={settled:false,drained:false,outcome:undefined};records.push(record);
    const finished=outcome=>{
     record.settled=true;record.outcome=outcome;
     // Lock settlement is after the real auth callback (including its finally
     // announcement). The task runs after its original adoption/publication
     // Promise reactions; no new auth is used to flush an older operation.
     const channel=new MessageChannel();
     channel.port1.onmessage=()=>{record.drained=true;channel.port1.close();channel.port2.close();};
     channel.port2.postMessage(null);
    };
    Promise.prototype.then.call(promise,()=>finished('fulfilled'),()=>finished('rejected'));
   }
   return promise;
  }});
 }
 Object.defineProperty(window,'__moteHandoffObservation',{value:{snapshot(){return {supported,requests:records.map(record=>({...record})),reactRoots:roots.size,reactIdle:roots.size>0&&[...roots].every(root=>root.pendingLanes===0&&root.callbackNode===null)};}}});
};
