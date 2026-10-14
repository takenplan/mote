import type {EvidenceDependencies} from '@mote/shared';
import type {Store} from './store.js';

export function combineDependencies(values:(EvidenceDependencies|undefined)[]):EvidenceDependencies|undefined {
  if(values.some(value=>!value))return;
  return {version:1,complete:values.every(value=>value!.complete),ids:[...new Set(values.flatMap(value=>value!.ids))]};
}

/** Resolve derived disclosures while their lineage still exists, before deletion can cascade. */
export function resolveDependencies(store:Store,value:EvidenceDependencies|undefined):EvidenceDependencies|undefined {
  if(!value)return;
  // The graph is installed by file processing in a full node. The fallback
  // covers lightweight Store/Conversations consumers without that service.
  const graph=store.db.prepare("SELECT 1 FROM sqlite_master WHERE name='evidence_dependency_edges'").get();
  const materialInputs=store.db.prepare("SELECT 1 FROM sqlite_master WHERE name='artifact_material_inputs'").get();
  // Traverse the same graph and fallback edges as one set operation. UNION
  // retains every ancestor and terminates cycles without a per-ID SQL loop.
  const rows=store.db.prepare(`WITH RECURSIVE ancestors(id) AS (
    SELECT value FROM json_each(?)
    ${graph?'UNION SELECT e.parent_id FROM evidence_dependency_edges e JOIN ancestors a ON e.child_id=a.id':''}
    UNION SELECT d.evidence_id FROM memory_dependencies d JOIN ancestors a ON d.memory_id=a.id
    UNION SELECT d.parent_id FROM file_evidence_links d JOIN ancestors a ON d.capture_id=a.id
    UNION SELECT d.capture_id FROM file_chunks d JOIN ancestors a ON d.id=a.id
    ${materialInputs?'UNION SELECT e.id FROM artifact_material_inputs i JOIN ancestors a ON i.artifact_id=a.id JOIN material_evidence e ON e.material_id=i.material_id AND e.revision=i.revision':''}
  ) SELECT id FROM ancestors`).all(JSON.stringify(value.ids));
  return {...value,ids:rows.map(row=>String(row.id))};
}
