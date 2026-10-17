import type {EvidencePin,MaterialPin} from './ask-schema.js';
import type {AskEvidence} from './ask-evidence.js';
import {exactProofs} from './ask-proof.js';
import {PrivateSql,PrivateDataError,missing} from './private-data-sql.js';

type Root={kind:'capture'|'material'|'source';id:string;incarnation:string;measurement?:true};
export type HistoryRoots={version:1;roots:Root[]};
type Proof=HistoryRoots&{pins:EvidencePin[];materials:MaterialPin[]};
const decode=<T>(value:unknown):T=>JSON.parse(String(value));

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
