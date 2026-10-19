import {memorySearchQuery} from './memory-search-query.js';
import {ownerMemoryCorrectionSchema,prepareOwnerMemoryCorrection} from './memory-owner-correction.js';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {fileEvidenceSchema,noteCapture,type QueryResult} from '@mote/shared';
import {Store,StoreError,sha256} from './store.js';
import {MemoryDeletions} from './memory-deletions.js';
import {memorySchema,type Memory,type MemoryEvidence,type EvidenceRange,type MemoryReviewReceipt} from './memory-schema.js';
import {memoryImageInterpretation,memoryImageLocator} from './memory-image-grants.js';
import {MemoryOutputValidationError} from './memory-errors.js';
import {MEMORY_SKILL_VERSION,memoryEvidenceFingerprint,memoryEvidenceReference as reference,validateMemoryExtraction,type MemoryRecord,type MemoryExtractOptions,type PreparedMemoryExtraction} from './memory-contract.js';
export * from './memory-contract.js';
export * from './memory-errors.js';
export type {Memory,MemoryEvidence,EvidenceRange} from './memory-schema.js';
const initializedStores=new WeakSet<Store>();
export class MemoryStore {
  readonly deletions:MemoryDeletions;
  constructor(public store:Store,public readEvidence:(ids:string[])=>MemoryRecord[]=ids=>store.evidence(ids),private currentEvidence:(id:string)=>boolean=id=>store.isCurrentEvidence(id)){this.deletions=new MemoryDeletions(store,this.readEvidence);if(!initializedStores.has(store)){this.ensureIndex();this.ensureCatalog();initializedStores.add(store);}}
  private ensureIndex(){
    this.store.db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(id UNINDEXED,text,tokenize='trigram');
      CREATE TRIGGER IF NOT EXISTS memories_fts_insert AFTER INSERT ON memories BEGIN INSERT INTO memories_fts(id,text) VALUES(new.id,json_extract(new.json,'$.title')||' '||json_extract(new.json,'$.statement')||' '||json_extract(new.json,'$.uncertainty')); END;
      CREATE TRIGGER IF NOT EXISTS memories_fts_delete AFTER DELETE ON memories BEGIN DELETE FROM memories_fts WHERE id=old.id; END;
      CREATE TRIGGER IF NOT EXISTS memories_fts_update AFTER UPDATE ON memories BEGIN DELETE FROM memories_fts WHERE id=old.id; INSERT INTO memories_fts(id,text) VALUES(new.id,json_extract(new.json,'$.title')||' '||json_extract(new.json,'$.statement')||' '||json_extract(new.json,'$.uncertainty')); END;
`);
  }
  /** Metadata-only read model; maintained in the same transaction as every memory write. */
  private ensureCatalog(){
    const db=this.store.db;
    const projection=(v:string)=>`json_object('id',${v}.id,'title',json_extract(${v}.json,'$.title'),'admission',json_extract(${v}.json,'$.admission'),'reviewRunId',json_extract(${v}.json,'$.reviewRunId'),'domain',json_extract(${v}.json,'$.domain'),'coding',json_extract(${v}.json,'$.coding'),'scopeRefs',json_extract(${v}.json,'$.scopeRefs'),'tier',json_extract(${v}.json,'$.tier'),'kind',json_extract(${v}.json,'$.kind'),'status',json_extract(${v}.json,'$.status'),'createdAt',${v}.created_at,'revision',json_extract(${v}.json,'$.fingerprint'),'version',json_extract(${v}.json,'$.version'),'relations',json_extract(${v}.json,'$.relations'),'supersededBy',json_extract(${v}.json,'$.supersededBy'),'supersededAt',json_extract(${v}.json,'$.supersededAt'),'validFrom',json_extract(${v}.json,'$.validFrom'),'validUntil',json_extract(${v}.json,'$.validUntil'),'correction',json_extract(${v}.json,'$.correction'),'evidenceCount',json_array_length(${v}.json,'$.evidenceIds'))`;
    const insert=(v:string)=>`INSERT OR REPLACE INTO memory_catalog SELECT ${v}.id,${v}.created_at,json_extract(${v}.json,'$.status'),json_extract(${v}.json,'$.tier'),json_extract(${v}.json,'$.kind'),json_extract(${v}.json,'$.admission.layer'),${projection(v)};`;
    const scope=(v:string)=>`INSERT INTO memory_scopes SELECT ${v}.id,json_extract(e.value,'$.id'),coalesce(json_extract(e.value,'$.deviceId'),''),CASE json_extract(e.value,'$.timeBasis') WHEN 'occurred' THEN coalesce(json_extract(e.value,'$.occurredAt'),json_extract(e.value,'$.recordedAt'),json_extract(e.value,'$.capturedAt')) ELSE coalesce(json_extract(e.value,'$.recordedAt'),json_extract(e.value,'$.capturedAt')) END FROM json_each(${v}.json,'$.evidence') e;`;
    db.exec(`CREATE TABLE IF NOT EXISTS memory_catalog(id TEXT PRIMARY KEY REFERENCES memories(id) ON DELETE CASCADE,created_at TEXT NOT NULL,status TEXT NOT NULL,tier TEXT NOT NULL,kind TEXT NOT NULL,layer TEXT NOT NULL,json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS memory_catalog_page ON memory_catalog(status,created_at DESC,id DESC);
      CREATE TABLE IF NOT EXISTS memory_scopes(memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,evidence_id TEXT NOT NULL,device_id TEXT NOT NULL,at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS memory_scope_parent ON memory_scopes(memory_id,device_id,at);
      CREATE TRIGGER IF NOT EXISTS memory_catalog_insert AFTER INSERT ON memories BEGIN ${insert('new')} ${scope('new')} END;
      CREATE TRIGGER IF NOT EXISTS memory_catalog_update AFTER UPDATE OF json ON memories BEGIN ${insert('new')} DELETE FROM memory_scopes WHERE memory_id=new.id; ${scope('new')} END;
      CREATE TRIGGER IF NOT EXISTS memory_evidence_edited AFTER UPDATE OF json ON captures WHEN new.json!=old.json BEGIN
        UPDATE memories SET json=json_set(json,'$.status','stale','$.staleReason','evidence_changed') WHERE id IN (SELECT memory_id FROM memory_dependencies WHERE evidence_id=new.id);
      END;
      CREATE TRIGGER IF NOT EXISTS memory_evidence_removed BEFORE DELETE ON captures BEGIN DELETE FROM memories WHERE id IN (SELECT memory_id FROM memory_dependencies WHERE evidence_id=old.id); END;`);

  }
  isCurrentEvidence(id:string):boolean {
    const record=this.readEvidence([id])[0];
    return Boolean(record&&this.recordIsCurrent(record));
  }
  /** Read canonical originals once for this synchronous guard. Callers provide
   * only IDs; they cannot substitute their own records for current authority. */
  readCurrentEvidence(ids:readonly string[]):MemoryRecord[] {
    const seen=new Set<string>();
    return this.readEvidence([...new Set(ids)]).filter(record=>{
      if(seen.has(record.id))return false;seen.add(record.id);
      return this.recordIsCurrent(record);
    });
  }
  private recordIsCurrent(record:MemoryRecord):boolean {
    const id=record.id;
    if(!record||!this.currentEvidence(id))return false;
    // Formal Material anchors keep their immutable origin revision even when
    // Coding append reuses an unchanged prefix. The injected currentEvidence
    // resolver checks that the block is still active in the current head.
    if(record.appId==='mote.material'&&record.provenance?.uri?.startsWith('material:')){
      if(!this.store.db.prepare("SELECT 1 FROM sqlite_master WHERE name='material_evidence'").get())return false;
      const anchor=this.store.db.prepare(`SELECT e.material_id,e.revision,e.block_id FROM material_evidence e
        JOIN material_heads h ON h.id=e.material_id
        WHERE e.id=? AND h.retired=0`).get(id) as {material_id:string;revision:string;block_id:string}|undefined;
      return Boolean(anchor&&record.provenance.uri===`material:${anchor.material_id}@${anchor.revision}#${anchor.block_id}`);
    }
    if(record.provenance?.layer!=='derived')return true;
    const file=fileEvidenceSchema.safeParse(record.fileEvidence);
    // The injected host resolver verifies active, traceable file artifacts. Other
    // derived records (including model summaries and memories) are not evidence.
    return file.success&&file.data.chunkId===id&&file.data.captureId!==id;
  }
  dependencyIds(id:string):string[]{const record=this.readEvidence([id])[0],file=fileEvidenceSchema.safeParse(record?.fileEvidence),ids=new Set(file.success?[id,file.data.captureId]:[id]);
    if(this.store.db.prepare("SELECT 1 FROM sqlite_master WHERE name='material_evidence_dependencies'").get())for(const row of this.store.db.prepare('SELECT evidence_id FROM material_evidence_dependencies WHERE anchor_id=?').all(id))ids.add(String(row.evidence_id));
    return [...ids];
  }
  page(args:{includeHistory?:boolean;asOf?:string;sourceId?:string;projectKey?:string;repositoryKey?:string;provider?:string;sessionId?:string;id?:string;query?:string;tier?:Memory['tier'];kind?:Memory['kind'];status?:Memory['status'];layer?:'observation'|'memory';cursor?:string;level?:'overview'|'detail';limit?:number;includeStale?:boolean;deviceId?:string;after?:string;before?:string}={}) {
    const conditions:string[]=[],values:(string|number)[]=[],limit=Math.max(1,Math.min(args.limit??30,100));
    if(!args.includeStale)conditions.push("status!='stale'");
    if(!args.includeHistory){const at=args.asOf??new Date().toISOString();conditions.push("(json_extract(json,'$.supersededBy') IS NULL OR julianday(json_extract(json,'$.supersededAt'))>julianday(?))");values.push(at);conditions.push("(json_extract(json,'$.validFrom') IS NULL OR julianday(json_extract(json,'$.validFrom'))<=julianday(?)) AND (json_extract(json,'$.validUntil') IS NULL OR julianday(json_extract(json,'$.validUntil'))>julianday(?))");values.push(at,at);}
    for(const key of ['tier','kind','status','layer','id'] as const)if(args[key]){conditions.push(`${key}=?`);values.push(args[key]!);}
    if(args.sourceId){
      const materialTables=Boolean(this.store.db.prepare("SELECT 1 FROM sqlite_master WHERE name='material_evidence'").get());
      const materialJoin=materialTables?' LEFT JOIN material_evidence e ON e.id=d.evidence_id LEFT JOIN material_heads h ON h.id=e.material_id ':'';
      const source=materialTables?"coalesce(json_extract(c.json,'$.provenance.sourceId'),h.source_id,'')":"coalesce(json_extract(c.json,'$.provenance.sourceId'),'')";
      conditions.push(`EXISTS(SELECT 1 FROM memory_dependencies d WHERE d.memory_id=memory_catalog.id) AND NOT EXISTS(SELECT 1 FROM memory_dependencies d LEFT JOIN captures c ON c.id=d.evidence_id ${materialJoin} WHERE d.memory_id=memory_catalog.id AND ${source}!=?)`);values.push(args.sourceId);
    }
    if(args.query?.trim()){
      const {match,short}=memorySearchQuery(args.query);
      if(match){conditions.push('id IN (SELECT id FROM memories_fts WHERE memories_fts MATCH ?)');values.push(match);}
      for(const term of short){conditions.push('id IN (SELECT id FROM memories_fts WHERE instr(lower(text),lower(?))>0)');values.push(term);}
    }
    if(args.deviceId||args.after||args.before){
      const mismatch:string[]=[];
      if(args.deviceId){mismatch.push('device_id!=?');values.push(args.deviceId);}
      if(args.after){mismatch.push('at<?');values.push(new Date(args.after).toISOString());}
      if(args.before){mismatch.push('at>=?');values.push(new Date(args.before).toISOString());}
      conditions.push(`EXISTS(SELECT 1 FROM memory_scopes WHERE memory_id=memory_catalog.id) AND NOT EXISTS(SELECT 1 FROM memory_scopes WHERE memory_id=memory_catalog.id AND (${mismatch.join(' OR ')}))`);
    }
    const codingFilters=(['projectKey','repositoryKey','provider','sessionId'] as const).filter(key=>args[key]);
    if(codingFilters.length){
      conditions.push("json_array_length(json,'$.scopeRefs')>0");
      conditions.push(`NOT EXISTS(SELECT 1 FROM json_each(memory_catalog.json,'$.scopeRefs') scope WHERE ${codingFilters.map(key=>`coalesce(json_extract(scope.value,'$.${key}'),'')!=?`).join(' OR ')})`);
      values.push(...codingFilters.map(key=>args[key]!));
    }
    if(args.cursor){let position:{at:string;id:string};try{position=z.object({at:z.string().datetime(),id:z.string().uuid()}).strict().parse(JSON.parse(Buffer.from(args.cursor,'base64url').toString()));}catch{throw new StoreError('Invalid memory cursor');}conditions.push('(created_at<? OR (created_at=? AND id<?))');values.push(position.at,position.at,position.id);}
    const rows=this.store.db.prepare(`SELECT id,created_at,json FROM memory_catalog ${conditions.length?'WHERE '+conditions.join(' AND '):''} ORDER BY created_at DESC,id DESC LIMIT ?`).all(...values,limit+1);
    const page=rows.slice(0,limit),last=page.at(-1);
    return {items:page.map(row=>args.level==='detail'?this.get(String(row.id)):{...JSON.parse(String(row.json)),disclosure:{detail:'/api/memories/'+row.id,evidence:'/api/memories/'+row.id+'/evidence',text:'/api/memories/'+row.id+'/text'}}),nextCursor:rows.length>limit&&last?Buffer.from(JSON.stringify({at:last.created_at,id:last.id})).toString('base64url'):null};
  }
  list(args:Parameters<MemoryStore['page']>[0]={}){return this.page(args).items;}
  text(id:string){const m=this.get(id);return `# ${m.title}\n\n${m.statement}\n\n## Uncertainty\n\n${m.uncertainty}\n\n## Provenance\n\nStatus: ${m.status}\nTier: ${m.tier??'episode'}\nKind: ${m.kind??'episodic'}\nModel: ${m.model}\nSkill: ${m.skillVersion??'unknown'}\n\n${(m.evidence??[]).map(e=>`- ${e.id} (${e.occurredAt??e.recordedAt??e.capturedAt})${e.quote?'\n  '+e.quote.replaceAll('\n','\n  '):''}`).join('\n')}\n`;}
  get(id:string):Memory{const row=this.store.db.prepare('SELECT json FROM memories WHERE id=?').get(id) as {json:string}|undefined;if(!row)throw new StoreError('Memory not found',404);return memorySchema.parse(JSON.parse(row.json));}
  private validatedClaims=new Map<string,unknown>();
  /** Produce immutable reviewed bodies without publishing the control records.
   * The savepoint covers catalog, dependency and lifecycle trigger effects too. */
  prepareExtract(result:QueryResult,model:string,options:MemoryExtractOptions={}):PreparedMemoryExtraction {
    const db=this.store.db,at=new Date().toISOString(),deletionSnapshot=this.deletions.snapshot();db.exec('SAVEPOINT memory_provider_prepare');
    let items:Memory[],changed:Memory[];
    try{items=this.extract(result,model,{...options,at,onSaved:undefined,prepared:undefined}).items;
      const ids=new Set([...items.map(item=>item.id),...items.flatMap(item=>(item.relations??[]).filter(relation=>relation.kind==='supersedes').map(relation=>relation.memoryId))]);
      changed=[...ids].map(id=>this.get(id));
    }finally{db.exec('ROLLBACK TO memory_provider_prepare');db.exec('RELEASE memory_provider_prepare');}
    const expected=Object.fromEntries(changed.map(memory=>{const prior=db.prepare('SELECT json FROM memories WHERE id=?').get(memory.id);return [memory.id,prior?sha256(String(prior.json)):null];}));
    return {at,resultHash:sha256(result.answer),items,changed:changed.filter(memory=>expected[memory.id]!==sha256(JSON.stringify(memory))),expected,deletionSnapshot};
  }
  assertPrepared(prepared:PreparedMemoryExtraction,result:QueryResult){if(prepared.resultHash!==sha256(result.answer)||prepared.deletionSnapshot!==this.deletions.snapshot())throw new StoreError('Reviewed Memory publication changed before commit',409);
    for(const [id,expected] of Object.entries(prepared.expected)){const row=this.store.db.prepare('SELECT json FROM memories WHERE id=?').get(id);if((row?sha256(String(row.json)):null)!==expected)throw new StoreError('Memory changed while preparing its provider write',409);}
  }
  extract(result:QueryResult,model:string,options:MemoryExtractOptions={}) {
    if(options.prepared)this.assertPrepared(options.prepared,result);
    const now=options.prepared?.at??options.at??new Date().toISOString(),items:Memory[]=[];
    const own=!options.validateOnly&&!this.store.db.isTransaction;if(own)this.store.db.exec('BEGIN IMMEDIATE');
    try{
    const claims=validateMemoryExtraction(result,options,{readEvidence:this.readEvidence,isCurrentEvidence:id=>this.isCurrentEvidence(id),get:id=>this.get(id),imageLocator:id=>memoryImageLocator(this.store,id),imageInterpretation:id=>memoryImageInterpretation(this.store,id)});
      if(options.validateOnly){return {items:[] as Memory[],runId:result.runId};}
      const receipt=options.reviewReceipt;
      if(!options.validateOnly&&receipt?.resultHash&&receipt.resultHash!==sha256(result.answer))throw new StoreError('Memory review result changed before commit',409);
      if(!options.validateOnly&&this.deletions.snapshot()!==(receipt?.deletionSnapshot??this.deletions.snapshot()) )throw new StoreError('Memory deletion policy changed before commit',409);
      if(!options.validateOnly&&this.store.db.prepare('SELECT 1 FROM memory_deletions LIMIT 1').get()&&!receipt?.deletionSnapshot)throw new StoreError('Memory requires current deletion review before commit',409);
      for(const m of claims){
        const parents=m.relatedMemoryIds??[];
        if(options.tier==='consolidated'){
          for(const id of parents){const parent=this.get(id);if(parent.status==='stale'||parent.domain!==m.domain||!parent.evidenceIds.some(e=>m.evidenceIds.includes(e)))throw new MemoryOutputValidationError('scope','Each parent must contribute original evidence');}
          if(parents.some(id=>this.get(id).statement===m.statement))throw new MemoryOutputValidationError('schema','Consolidation must add value, not copy an input');
        }
        const fingerprint=sha256(JSON.stringify([...(options.integration?[options.integration]:[]),...(options.strategy?[options.strategy]:[]),options.tier??'episode',m.admission??null,m.coding??null,...(m.relations?.length||m.validFrom||m.validUntil?[m.relations??null,m.validFrom??null,m.validUntil??null]:[]),m.statement,[...m.evidenceIds].sort(),m.evidence.map(e=>[e.id,e.contentHash,e.offset,e.length,...(e.image?[e.image]:[])])]));
        const duplicate=this.store.db.prepare("SELECT json FROM memories WHERE json_extract(json,'$.fingerprint')=? AND json_extract(json,'$.status')!='stale'").get(fingerprint) as {json:string}|undefined;
        if(duplicate){const existing=JSON.parse(duplicate.json) as Memory;if(existing.status==='proposed'&&receipt?.reviewRunId&&receipt.resultHash){existing.reviewReceipt=receipt;existing.reviewRunId=receipt.reviewRunId;this.store.db.prepare('UPDATE memories SET json=? WHERE id=?').run(JSON.stringify(existing),existing.id);items.push(this.publish(existing.id,existing.version,now));}else items.push(existing);continue;}
        const value:Memory={...m,integration:options.integration,strategy:options.strategy,version:1,id:options.prepared?.items.find(item=>item.fingerprint===fingerprint)?.id??randomUUID(),tier:options.tier??'episode',kind:m.kind??'episodic',relatedMemoryIds:m.relatedMemoryIds,reviewRunId:options.reviewRunId,reviewReceipt:options.reviewReceipt,createdAt:now,status:'proposed',model:options.reviewReceipt?.model??result.usage?.model??model,runId:result.runId,skillVersion:options.skillVersion??MEMORY_SKILL_VERSION,fingerprint};
        this.store.reserveMetadata(Buffer.byteLength(JSON.stringify(value)));
        this.store.db.prepare('INSERT INTO memories(id,created_at,json) VALUES(?,?,?)').run(value.id,now,JSON.stringify(value));
        for(const id of new Set(value.evidenceIds.flatMap(id=>this.dependencyIds(id))))this.store.db.prepare('INSERT INTO memory_dependencies(memory_id,evidence_id) VALUES(?,?)').run(value.id,id);
        items.push(receipt?.reviewRunId&&receipt.resultHash?this.publish(value.id,value.version,now):value);
      }
      if(options.prepared){if(JSON.stringify(items)!==JSON.stringify(options.prepared.items)||options.prepared.changed.some(memory=>JSON.stringify(this.get(memory.id))!==JSON.stringify(memory)))throw new StoreError('The provider staged different Memory bodies than the host commit',409);}
      options.onSaved?.(items);
      if(own)this.store.db.exec('COMMIT');return {items,runId:result.runId};
    }catch(error){if(own)this.store.db.exec('ROLLBACK');throw error;}
  }
  publish(id:string,version?:number,at=new Date().toISOString()){
    const m=this.get(id);if(version!==undefined&&version!==m.version)throw new StoreError('Memory changed; refresh before activation',409);
    if(m.status==='published')return m;
    if(this.store.db.prepare('SELECT 1 FROM memory_deletions LIMIT 1').get()&&m.reviewReceipt?.deletionSnapshot!==this.deletions.snapshot())throw new StoreError('Memory requires current deletion review before activation',409);
    if(m.status==='stale'||m.supersededBy||m.evidenceIds.some(e=>!this.isCurrentEvidence(e)))throw new StoreError('Evidence has changed; extract again before publishing',409);
    if(m.relations?.length&&version===undefined)throw new StoreError('A reviewed memory version is required before applying relationships',409);
    const own=!this.store.db.isTransaction;if(own)this.store.db.exec('BEGIN IMMEDIATE');try{
      for(const relation of m.relations??[]){const target=this.get(relation.memoryId);if(target.status==='stale'||target.supersededBy||target.fingerprint!==relation.fingerprint||target.version!==relation.version||target.evidenceIds.some(id=>!this.isCurrentEvidence(id)))throw new StoreError('Related memory changed; review the relationship again',409);
        if(relation.kind==='supersedes'){target.supersededBy=m.id;target.supersededAt=m.validFrom??m.reviewReceipt?.contextTime??at;target.version=target.version+1;target.updatedAt=at;this.store.reserveMetadata(Buffer.byteLength(JSON.stringify(target)));this.store.db.prepare('UPDATE memories SET json=? WHERE id=?').run(JSON.stringify(target),target.id);}
      }
      m.status='published';m.version=m.version+1;m.updatedAt=at;this.store.db.prepare('UPDATE memories SET json=? WHERE id=?').run(JSON.stringify(m),id);if(own)this.store.db.exec('COMMIT');return m;
    }catch(error){if(own)this.store.db.exec('ROLLBACK');throw error;}
  }
  /** An explicit owner correction is original user evidence, never an automatic model overwrite. */
  async correct(id:string,raw:unknown,stage?: (records:Memory[],assert:()=>void)=>Promise<void>,identity?:{noteId:string;memoryId:string;at:string},committed?:()=>void){
    const input=ownerMemoryCorrectionSchema.parse(raw);
    const original=this.get(id);if(original.version!==input.version||original.supersededBy)throw new StoreError('Memory changed; refresh before correcting',409);
    if(input.validUntil&&Date.parse(input.validFrom??new Date().toISOString())>=Date.parse(input.validUntil))throw new StoreError('Correction validity dates are reversed',400);
    const noteId=identity?.noteId??randomUUID(),memoryId=identity?.memoryId??randomUUID(),now=identity?.at??new Date().toISOString();
    const text=input.statement;const capture=noteCapture({client:'web',id:noteId,deviceId:'mote-owner-review',deviceName:'Mote owner review',platform:'import',capturedAt:now,text,metadata:{version:1,observedAt:now,collector:{method:'manual'},memoryCorrection:{memoryId:id,domain:original.domain,scopeRefs:original.scopeRefs??[],...(original.coding?{coding:{...original.coding,validation:'user_confirmed'}}:{})}}});
    let saved:Memory|undefined;
    const apply=(persist=true)=>{
      const current=this.get(id);if(current.version!==input.version||current.supersededBy)throw new StoreError('Memory changed while saving correction',409);
      const evidence=this.readEvidence([noteId])[0];if(!evidence)throw new StoreError('Correction evidence unavailable',409);
      const prepared=prepareOwnerMemoryCorrection(current,input,evidence,{memoryId,at:now,fingerprint:sha256(JSON.stringify([id,current.fingerprint,input,noteId]))});saved=prepared.saved;Object.assign(current,prepared.current);
      if(persist){
        this.store.reserveMetadata(Buffer.byteLength(JSON.stringify(saved))+1024);this.store.db.prepare('INSERT INTO memories(id,created_at,json) VALUES(?,?,?)').run(memoryId,now,JSON.stringify(saved));this.store.db.prepare('INSERT INTO memory_dependencies(memory_id,evidence_id) VALUES(?,?)').run(memoryId,noteId);
        this.store.db.prepare('UPDATE memories SET json=? WHERE id=?').run(JSON.stringify(current),id);
        committed?.();
      }return [saved!,current];
    };
    if(!stage)await this.store.ingest(capture,()=>{apply();});
    else{
      await this.store.ingest(capture);const records=apply(false),assert=()=>{const current=this.get(id);if(current.version!==input.version||current.supersededBy||!this.isCurrentEvidence(noteId))throw new StoreError('Correction evidence or selected Memory changed',409);};
      await stage(records,assert);const db=this.store.db;db.exec('BEGIN IMMEDIATE');try{assert();apply();db.exec('COMMIT');}catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}
    }return saved!;
  }
  delete(id:string){
    const db=this.store.db,own=!db.isTransaction;if(own)db.exec('BEGIN IMMEDIATE');
    try{
      const row=db.prepare('SELECT json FROM memories WHERE id=?').get(id);if(!row){if(own)db.exec('COMMIT');return {deleted:0};}
      this.deletions.remember(JSON.parse(String(row.json)) as Memory);
      // Existing consolidations depend on the deleted interpretation. Retain
      // their history, but do not keep serving that claim through a child card.
      const deleted=this.deletions.revoke(id);
      if(own)db.exec('COMMIT');return {deleted};
    }catch(error){if(own)db.exec('ROLLBACK');throw error;}
  }
}
