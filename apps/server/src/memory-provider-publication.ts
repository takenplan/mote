import {memoryBodyDigest,type MemoryProvider,type MemoryProviderWrite} from './memory-provider-contract.js';
import {StoreError} from './execution-storage.js';
/** Shared publication seam: callers durably journal intent before invoking it.
 * Every implementation verifies the literal immutable body after the write and
 * rechecks the same host fence before granting publication. */
export async function stageVerifiedMemoryWrite(provider:MemoryProvider,write:MemoryProviderWrite,assertAuthority:()=>void){
 assertAuthority();const receipt=await provider.put(write);assertAuthority();
 const exact=await provider.read({namespace:write.namespace,key:write.key});assertAuthority();
 if(!exact||memoryBodyDigest(exact)!==memoryBodyDigest(write.memory))throw new StoreError('The provider did not preserve a reviewed Memory body',502);
 return receipt;
}
