import type {SourceStore} from './sources.js';
import type {MemoryStore} from './memory.js';

/** Owner archive overview. Each domain owns its queries; this read model owns
 * the cross-domain response shared by source transport and its consumers. */
export class LayersReadModel {
 constructor(private sources:Pick<SourceStore,'summary'>,private memories:Pick<MemoryStore,'count'>){}
 summary(){return {...this.sources.summary(),memories:this.memories.count()};}
}
