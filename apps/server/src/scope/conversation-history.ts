import type {DatabaseSync} from 'node:sqlite';
import type {EvidencePin,MaterialPin} from './ask-schema.js';
import type {AskEvidence} from './ask-evidence.js';
import {exactProofs} from './ask-proof.js';
import {PrivateSql,PrivateDataError,missing} from './private-data-sql.js';

type Root={kind:'capture'|'material'|'source';id:string;incarnation:string;measurement?:true};
export type HistoryRoots={version:1;roots:Root[]};
type Proof=HistoryRoots&{pins:EvidencePin[];materials:MaterialPin[]};
const decode=<T>(value:unknown):T=>JSON.parse(String(value));

/** Persisted SQL, rather than connection-local callbacks, also protects offline
 * writers. Dependencies are owner-bound and include inherited dialogue roots. */
export function installConversationHistory(db:DatabaseSync){
 db.exec(`CREATE TABLE IF NOT EXISTS ma_history_materials(user_id TEXT NOT NULL,id TEXT NOT NULL,incarnation TEXT NOT NULL,PRIMARY KEY(user_id,id));
 INSERT OR IGNORE INTO ma_history_materials SELECT user_id,id,lower(hex(randomblob(16))) FROM pd_materials;
 CREATE TRIGGER IF NOT EXISTS ma_history_material_created AFTER INSERT ON pd_materials BEGIN INSERT INTO ma_history_materials VALUES(new.user_id,new.id,lower(hex(randomblob(16)))) ON CONFLICT(user_id,id) DO UPDATE SET incarnation=excluded.incarnation; END;
 CREATE TRIGGER IF NOT EXISTS ma_history_material_removed AFTER DELETE ON pd_materials BEGIN DELETE FROM ma_history_materials WHERE user_id=old.user_id AND id=old.id; END;
 CREATE TABLE IF NOT EXISTS ma_history_turns(user_id TEXT NOT NULL,turn_id TEXT NOT NULL,proof TEXT NOT NULL,stale INTEGER NOT NULL DEFAULT 0,deleted INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,turn_id),FOREIGN KEY(user_id,turn_id) REFERENCES ma_turns(user_id,id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS ma_history_dependencies(user_id TEXT NOT NULL,turn_id TEXT NOT NULL,kind TEXT NOT NULL,root_id TEXT NOT NULL,PRIMARY KEY(user_id,turn_id,kind,root_id),FOREIGN KEY(user_id,turn_id) REFERENCES ma_history_turns(user_id,turn_id) ON DELETE CASCADE);
 CREATE INDEX IF NOT EXISTS ma_history_root ON ma_history_dependencies(user_id,kind,root_id,turn_id);
 CREATE TABLE IF NOT EXISTS ma_history_runs(user_id TEXT NOT NULL,run_id TEXT NOT NULL,proof TEXT NOT NULL,PRIMARY KEY(user_id,run_id),FOREIGN KEY(user_id,run_id) REFERENCES ma_runs(user_id,id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS ma_history_run_dependencies(user_id TEXT NOT NULL,run_id TEXT NOT NULL,kind TEXT NOT NULL,root_id TEXT NOT NULL,PRIMARY KEY(user_id,run_id,kind,root_id),FOREIGN KEY(user_id,run_id) REFERENCES ma_history_runs(user_id,run_id) ON DELETE CASCADE);
 CREATE INDEX IF NOT EXISTS ma_history_run_root ON ma_history_run_dependencies(user_id,kind,root_id,run_id);`);
 const matching=(owner:string,kind:Root['kind'],id:string)=>`SELECT t.id FROM ma_turns t WHERE t.user_id=${owner} AND (EXISTS(SELECT 1 FROM ma_history_dependencies d WHERE d.user_id=t.user_id AND d.turn_id=t.id AND d.kind='${kind}' AND d.root_id=${id}) OR NOT EXISTS(SELECT 1 FROM ma_history_turns h WHERE h.user_id=t.user_id AND h.turn_id=t.id))`;
 const matchingRuns=(owner:string,kind:Root['kind'],id:string)=>`SELECT r.id FROM ma_runs r WHERE r.user_id=${owner} AND (EXISTS(SELECT 1 FROM ma_history_run_dependencies d WHERE d.user_id=r.user_id AND d.run_id=r.id AND d.kind='${kind}' AND d.root_id=${id}) OR NOT EXISTS(SELECT 1 FROM ma_history_runs h WHERE h.user_id=r.user_id AND h.run_id=r.id))`;
 const change=(owner:string,turns:string,deleted:boolean,runs:string)=>{
  const condition=`user_id=${owner} AND id IN (${turns})`;
  return `UPDATE ma_conversations SET summary=NULL,revision=revision+1 WHERE user_id=${owner} AND id IN(SELECT conversation_id FROM ma_turns WHERE ${condition});
   ${deleted?`UPDATE ma_runs SET result=NULL,context='{}',events='[]',generation=generation+1,status=CASE WHEN status='running' THEN 'failed' ELSE status END WHERE user_id=${owner} AND id IN (${runs});
    UPDATE user_tasks SET checkpoints='{}',progress='null' WHERE user_id=${owner} AND task_id IN(SELECT task_id FROM ma_fragments WHERE user_id=${owner} AND run_id IN (${runs}) UNION SELECT task_id FROM ma_runs WHERE user_id=${owner} AND id IN (${runs}));
    DELETE FROM ma_artifacts WHERE user_id=${owner} AND run_id IN (${runs});
    DELETE FROM ma_traces WHERE user_id=${owner} AND run_id IN (${runs});
    UPDATE ma_units SET input='{}' WHERE user_id=${owner} AND run_id IN (${runs});
    UPDATE ma_turns SET result=json_object('answer','','citations',json('[]'),'trace',json('[]'),'runId',coalesce(json_extract(result,'$.runId'),'')) WHERE ${condition};`:''}
   UPDATE ma_history_turns SET ${deleted?'deleted=1,stale=0':'stale=1'} WHERE user_id=${owner} AND turn_id IN (${turns});
   ${deleted?`INSERT OR IGNORE INTO ma_history_turns SELECT user_id,id,'{"version":1,"roots":[],"pins":[],"materials":[]}',0,1 FROM ma_turns WHERE ${condition};`:''}`;
 };
 for(const [name,table,event,owner,kind,id,when,deleted] of [
  ['capture_deleted','pd_captures','BEFORE DELETE','old.user_id','capture','old.id','',true],
  ['material_deleted','pd_materials','BEFORE DELETE','old.user_id','material','old.id','',true],
  ['source_deleted','pd_sources','BEFORE DELETE','old.user_id','source','old.id','',true],
  ['capture_changed','pd_captures','AFTER UPDATE OF json,fingerprint','new.user_id','capture','new.id','WHEN new.json!=old.json OR new.fingerprint!=old.fingerprint',false],
  ['material_changed','pd_materials','AFTER UPDATE OF revision,min_visible_sequence','new.user_id','material','new.id','WHEN new.revision!=old.revision OR new.min_visible_sequence!=old.min_visible_sequence',false],
  ['source_changed','pd_sources','AFTER UPDATE OF json','new.user_id','source','new.id',"WHEN json_extract(new.json,'$.enabled') IS NOT json_extract(old.json,'$.enabled') OR json_extract(new.json,'$.retention') IS NOT json_extract(old.json,'$.retention') OR json_extract(new.json,'$.ownerRelation') IS NOT json_extract(old.json,'$.ownerRelation') OR json_extract(new.json,'$.ownerRelationVersion') IS NOT json_extract(old.json,'$.ownerRelationVersion') OR json_extract(new.json,'$.sourceContext') IS NOT json_extract(old.json,'$.sourceContext') OR json_extract(new.json,'$.name') IS NOT json_extract(old.json,'$.name')",false],
 ] as const){db.exec(`DROP TRIGGER IF EXISTS ma_history_${name};CREATE TRIGGER ma_history_${name} ${event} ON ${table} ${when} BEGIN ${change(owner,matching(owner,kind,id),deleted,matchingRuns(owner,kind,id))} END;`);}
 // M07 anchors are disposable interpretation cache. Withdraw prepared context
 // and summaries before their lineage disappears, retaining historical prose.
 db.exec(`DROP TRIGGER IF EXISTS ma_history_cache_removed;CREATE TRIGGER ma_history_cache_removed BEFORE DELETE ON mm_evidence BEGIN ${change('old.user_id',matching('old.user_id','material','old.material_id'),false,matchingRuns('old.user_id','material','old.material_id'))} END;`);
 // Ordinary cache/projection withdrawal may hide a head until rebuilding.
 // Only the explicit owner/privacy retirement event erases historical prose.
 for(const event of ['INSERT','UPDATE OF epoch'] as const){const name=event==='INSERT'?'insert':'update';db.exec(`DROP TRIGGER IF EXISTS ma_history_retire_${name};CREATE TRIGGER ma_history_retire_${name} AFTER ${event} ON pd_material_retirements BEGIN ${change('new.user_id',matching('new.user_id','material','new.material_id'),true,matchingRuns('new.user_id','material','new.material_id'))} UPDATE ma_history_materials SET incarnation=lower(hex(randomblob(16))) WHERE user_id=new.user_id AND id=new.material_id; END;`);}
 // Tombstones retract all retained versions of that source item, not merely its
 // latest capture. Later recreation must never make erased prose reappear.
 for(const event of ['INSERT','UPDATE OF capture_id'] as const){
  const turns=`SELECT t.id FROM ma_turns t WHERE t.user_id=new.user_id AND (EXISTS(SELECT 1 FROM ma_history_dependencies d JOIN pd_captures c ON c.user_id=d.user_id AND c.id=d.root_id WHERE d.user_id=t.user_id AND d.turn_id=t.id AND d.kind='capture' AND c.source_id=new.source_id AND c.external_id=new.external_id) OR NOT EXISTS(SELECT 1 FROM ma_history_turns h WHERE h.user_id=t.user_id AND h.turn_id=t.id))`;
  const runs=`SELECT r.id FROM ma_runs r WHERE r.user_id=new.user_id AND (EXISTS(SELECT 1 FROM ma_history_run_dependencies d JOIN pd_captures c ON c.user_id=d.user_id AND c.id=d.root_id WHERE d.user_id=r.user_id AND d.run_id=r.id AND d.kind='capture' AND c.source_id=new.source_id AND c.external_id=new.external_id) OR NOT EXISTS(SELECT 1 FROM ma_history_runs h WHERE h.user_id=r.user_id AND h.run_id=r.id))`;
  const name=event==='INSERT'?'insert':'update';db.exec(`DROP TRIGGER IF EXISTS ma_history_tombstone_${name};CREATE TRIGGER ma_history_tombstone_${name} AFTER ${event} ON pd_source_heads WHEN coalesce((SELECT json_extract(json,'$.provenance.deleted') FROM pd_captures WHERE user_id=new.user_id AND id=new.capture_id),0)=1 BEGIN ${change('new.user_id',turns,true,runs)} END;`);
 }
}

/** Host-only receipts authorize retained dialogue, never original/tool reads or
 * citations. New evidence still uses AskEvidence.validate without relaxation. */
export class ConversationHistory{
 constructor(private readonly sql:PrivateSql,private readonly reader:AskEvidence){}
 private source(id:string,roots:Map<string,Root>){this.reader.historySource(id);const row=this.sql.get('SELECT incarnation FROM ma_sources WHERE user_id=$user AND id=?',id);if(!row)throw missing();roots.set('source:'+id,{kind:'source',id,incarnation:String(row.incarnation)});}
 private capture(id:string,roots:Map<string,Root>,measurement=false){const row=this.sql.get('SELECT o.incarnation,c.json,c.source_id FROM pd_captures c JOIN ma_originals o ON o.user_id=c.user_id AND o.id=c.id WHERE c.user_id=$user AND o.user_id=$user AND c.id=?',id);if(!row)throw missing();const value=decode<{provenance?:{sourceId:string;deleted?:boolean};privacy?:{excluded?:boolean;redacted?:boolean};ingressSourceId?:string}>(row.json);if(value.provenance?.deleted||value.privacy?.excluded||!measurement&&value.privacy?.redacted)throw missing();const sourceId=value.provenance?.sourceId??value.ingressSourceId??row.source_id??this.sql.get('SELECT source_id FROM ig_capture_scopes WHERE user_id=$user AND capture_id=?',id)?.source_id;if(typeof sourceId!=='string')throw missing();this.source(sourceId,roots);const previous=roots.get('capture:'+id);roots.set('capture:'+id,{kind:'capture',id,incarnation:String(row.incarnation),...(measurement&&(!previous||previous.measurement)?{measurement:true as const}:{})});}
 private material(id:string,revision:string,roots:Map<string,Root>){
  const rows=this.sql.all(`WITH RECURSIVE tree(id,revision) AS(SELECT ?,? UNION SELECT p.input_material_id,p.input_revision FROM pd_material_inputs p JOIN tree t ON p.material_id=t.id AND p.revision=t.revision WHERE p.user_id=$user) SELECT t.id,t.revision,m.incarnation,v.json FROM tree t LEFT JOIN pd_material_versions v ON v.material_id=t.id AND v.revision=t.revision AND v.user_id=$user LEFT JOIN ma_history_materials m ON m.user_id=v.user_id AND m.id=v.material_id AND m.user_id=$user ORDER BY t.id,t.revision`,id,revision);
  if(!rows.some(row=>row.id===id&&row.revision===revision)||rows.some(row=>!row.incarnation||!row.json))throw missing();
  for(const row of rows){roots.set('material:'+row.id,{kind:'material',id:String(row.id),incarnation:String(row.incarnation)});const sources=this.sql.all('SELECT source_id FROM pd_material_sources WHERE user_id=$user AND material_id=? AND revision=?',row.id,row.revision);if(!sources.length)throw missing();for(const source of sources)this.source(String(source.source_id),roots);for(const capture of this.sql.all('SELECT capture_id FROM pd_material_captures WHERE user_id=$user AND material_id=? AND revision=?',row.id,row.revision))this.capture(String(capture.capture_id),roots);}
 }
 proof(pins:EvidencePin[],materials:MaterialPin[],inherited:HistoryRoots={version:1,roots:[]}):Proof{
  pins=exactProofs(pins);materials=exactProofs(materials);
  const roots=new Map(this.combine([inherited]).roots.map(root=>[root.kind+':'+root.id,root]));
  for(const material of materials){if(material.sourceContext)this.source(material.sourceContext.sourceId,roots);else this.material(material.id,material.revision,roots);}
  for(const pin of pins){if(!pin.receipt||this.reader.originalReceipt(pin.id)!==pin.receipt)throw missing();const anchor=this.sql.get('SELECT material_id,material_revision FROM mm_evidence WHERE user_id=$user AND id=?',pin.id);if(anchor)this.material(String(anchor.material_id),String(anchor.material_revision),roots);else this.capture(pin.id,roots,pin.kind==='measurement');if(pin.source){this.source(pin.source.id,roots);if(roots.get('source:'+pin.source.id)?.incarnation!==pin.source.incarnation)throw missing();}}
  const proof:Proof={version:1,roots:[...roots.values()].sort((a,b)=>(a.kind+':'+a.id).localeCompare(b.kind+':'+b.id)),pins,materials};this.validate(proof);return proof;
 }
 validate(proof:HistoryRoots){
  if(proof.version!==1||!Array.isArray(proof.roots))throw missing();
  for(const root of proof.roots){if(root.kind==='source'){this.reader.historySource(root.id);if(this.sql.get('SELECT incarnation FROM ma_sources WHERE user_id=$user AND id=?',root.id)?.incarnation!==root.incarnation)throw missing();}
   else if(root.kind==='material'){this.reader.historyMaterial(root.id);if(this.sql.get('SELECT incarnation FROM ma_history_materials WHERE user_id=$user AND id=?',root.id)?.incarnation!==root.incarnation)throw missing();}
   else if(root.kind==='capture'){const row=this.sql.get('SELECT o.incarnation,c.json,c.source_id,c.external_id FROM pd_captures c JOIN ma_originals o ON o.user_id=c.user_id AND o.id=c.id WHERE c.user_id=$user AND o.user_id=$user AND c.id=?',root.id);if(!row||row.incarnation!==root.incarnation)throw missing();const capture=decode<{provenance?:{deleted?:boolean};privacy?:{excluded?:boolean;redacted?:boolean}}>(row.json);if(capture.privacy?.excluded||!root.measurement&&capture.privacy?.redacted||capture.provenance?.deleted)throw missing();if(row.source_id&&row.external_id){const head=this.sql.get('SELECT c.json FROM pd_source_heads h JOIN pd_captures c ON c.user_id=h.user_id AND c.id=h.capture_id WHERE h.user_id=$user AND c.user_id=$user AND h.source_id=? AND h.external_id=?',row.source_id,row.external_id);if(!head||decode<{provenance?:{deleted?:boolean}}>(head.json).provenance?.deleted)throw missing();}}
   else throw missing();
  }
 }
 save(turnId:string,proof:Proof,stale=false){this.sql.run('INSERT INTO ma_history_turns VALUES($user,?,?,?,0) ON CONFLICT(user_id,turn_id) DO UPDATE SET proof=excluded.proof,stale=max(stale,excluded.stale)',turnId,JSON.stringify(proof),Number(stale));for(const root of proof.roots)this.sql.run('INSERT OR IGNORE INTO ma_history_dependencies VALUES($user,?,?,?)',turnId,root.kind,root.id);}
 /** Data-only recovery rebuilds receipts from canonical retained parents. It
  * never grants current original/tool access or revives an execution snapshot. */
 restore(pins:EvidencePin[],materials:MaterialPin[],inherited:HistoryRoots={version:1,roots:[]}):Proof{
  const roots=new Map<string,Root>();
  for(const root of inherited.roots){if(root.kind==='capture')this.capture(root.id,roots,root.measurement);else if(root.kind==='source')this.source(root.id,roots);else{this.reader.historyMaterial(root.id);const row=this.sql.get('SELECT incarnation FROM ma_history_materials WHERE user_id=$user AND id=?',root.id);if(!row)throw missing();roots.set('material:'+root.id,{kind:'material',id:root.id,incarnation:String(row.incarnation)});}}
  const reboundPins=pins.map(pin=>{if(this.reader.historyPinHash(pin.id)!==pin.hash)throw missing();const source=pin.source?{id:pin.source.id,incarnation:String(this.sql.get('SELECT incarnation FROM ma_sources WHERE user_id=$user AND id=?',pin.source.id)?.incarnation)}:undefined;return {...pin,receipt:this.reader.originalReceipt(pin.id),...(source?{source}:{})};});
  const reboundMaterials=materials.map(pin=>{if(pin.sourceContext){this.reader.historyDeclaration(pin.sourceContext);return {...pin,sources:[{id:pin.sourceContext.sourceId,incarnation:String(this.sql.get('SELECT incarnation FROM ma_sources WHERE user_id=$user AND id=?',pin.sourceContext.sourceId)?.incarnation)}]};}const sources=this.sql.all('SELECT s.source_id,p.incarnation FROM pd_material_sources s JOIN ma_sources p ON p.user_id=s.user_id AND p.id=s.source_id WHERE s.user_id=$user AND p.user_id=$user AND s.material_id=? AND s.revision=?',pin.id,pin.revision);if(!sources.length)throw missing();return {...pin,sources:sources.map(row=>({id:String(row.source_id),incarnation:String(row.incarnation)}))};});
  return this.proof(reboundPins,reboundMaterials,{version:1,roots:[...roots.values()]});
 }
 erase(turnId:string){this.sql.run('INSERT INTO ma_history_turns VALUES($user,?,?,0,1) ON CONFLICT(user_id,turn_id) DO UPDATE SET proof=excluded.proof,stale=0,deleted=1',turnId,JSON.stringify({version:1,roots:[],pins:[],materials:[]}));}
 retained(turnId:string):HistoryRoots{const row=this.sql.get('SELECT proof FROM ma_history_turns WHERE user_id=$user AND turn_id=?',turnId);return row?decode<Proof>(row.proof):{version:1,roots:[]};}
 state(row:Record<string,unknown>,inherited:HistoryRoots={version:1,roots:[]}){
  let saved=this.sql.get('SELECT proof,stale,deleted FROM ma_history_turns WHERE user_id=$user AND turn_id=?',String(row.id));
  if(!saved){try{const proof=this.proof(decode(row.pins),decode(row.materials),inherited);this.sql.transaction(()=>{if(!this.sql.get('SELECT 1 FROM ma_history_turns WHERE user_id=$user AND turn_id=?',String(row.id)))this.save(String(row.id),proof);});saved=this.sql.get('SELECT proof,stale,deleted FROM ma_history_turns WHERE user_id=$user AND turn_id=?',String(row.id));}catch(error){if(!(error instanceof PrivateDataError))throw error;return {deleted:true as const,stale:false};}}
  if(!saved||saved.deleted)return {deleted:true as const,stale:false};
  const proof=decode<Proof>(saved.proof);try{this.validate(proof);}catch(error){if(!(error instanceof PrivateDataError))throw error;return {deleted:true as const,stale:false};}
  let stale=Boolean(saved.stale);try{this.reader.validate(proof.pins,proof.materials);}catch(error){if(!(error instanceof PrivateDataError))throw error;stale=true;}
  return {deleted:false as const,stale,proof};
 }
 combine(proofs:readonly HistoryRoots[]):HistoryRoots{const roots=new Map<string,Root>();for(const proof of proofs){this.validate(proof);for(const root of proof.roots){const key=root.kind+':'+root.id,prior=roots.get(key);if(prior&&prior.incarnation!==root.incarnation)throw missing();roots.set(key,prior&&!prior.measurement?prior:root);}}return {version:1,roots:[...roots.values()]};}
 admit(runId:string,proof:HistoryRoots){this.validate(proof);this.sql.run('INSERT INTO ma_history_runs VALUES($user,?,?) ON CONFLICT(user_id,run_id) DO UPDATE SET proof=excluded.proof',runId,JSON.stringify(proof));for(const root of proof.roots)this.sql.run('INSERT OR IGNORE INTO ma_history_run_dependencies VALUES($user,?,?,?)',runId,root.kind,root.id);}
 run(runId:string,context?:string):HistoryRoots{const row=this.sql.get('SELECT proof FROM ma_history_runs WHERE user_id=$user AND run_id=?',runId);if(!row){if(context&&(decode<{turns?:unknown[]}>(context).turns?.length??0)>0)throw missing();return {version:1,roots:[]};}const proof=decode<HistoryRoots>(row.proof);this.validate(proof);return proof;}
}
