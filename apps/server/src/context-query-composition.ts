import {ContextQuery} from './context-query.js';
import type {EvidenceReader} from './evidence-reader.js';
import type {SourceStore} from './sources.js';
import type {Store} from './store.js';

/** Composition binds the host implementations without giving ContextQuery a
 * reader implementation, database, Memory writer or provider binding. */
export function createContextQuery(store:Store,sources:SourceStore,reader:EvidenceReader){
  return new ContextQuery({
    records:reader.records.bind(reader),search:reader.search.bind(reader),
    evidence:reader.evidence.bind(reader),artifact:reader.artifact.bind(reader),
  },{
    memory:reader.memory.bind(reader),memoryPage:reader.memoryPage.bind(reader),
    memoryAsync:reader.memoryAsync.bind(reader),memoryPageAsync:reader.memoryPageAsync.bind(reader),
  },{
    archive:{stats:store.stats.bind(store)},sources:{listSources:sources.listSources.bind(sources)},
    latestMemoryCreatedAt:()=>{
      const latest=reader.memories.page({level:'overview',limit:1,includeStale:true}).items[0] as {createdAt?:string}|undefined;
      return latest?.createdAt??null;
    },
  },()=>reader.memoryBindings?.retainSnapshot());
}
