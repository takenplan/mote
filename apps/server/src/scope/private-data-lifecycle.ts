import {importDeclarationSchema} from './import-attribution.js';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {sourceConnectionSchema,sourceContentTime,sourceContextUpdateSchema,sourceItemSchema,type AttributionContext} from '@mote/shared';
import {materialDraftSchema,materialOwnerDeclarationBodyHash,materialOwnerStatementSchema} from './material-model.js';
import {storedCaptureSchema} from './capture-original.js';
import {PrivateDataError,type PrivateSql} from './private-data-sql.js';
import type {DomainLifecycle,LifecyclePurpose,UserDataSubject,UserExport} from './lifecycle.js';

const DOMAIN='private-data';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const date=z.string().datetime({offset:true});
const digest=z.string().regex(/^[a-f0-9]{64}$/);
const identifier=z.string().min(1);
const materialId=z.string().regex(/^mat_[a-f0-9]{64}$/);
const sequence=z.number().int().positive().safe();
const sourceRow=z.object({id:identifier,json:z.string(),created_at:date,updated_at:date}).strict();
const contextRow=z.object({source_id:identifier,version:sequence,fingerprint:digest,description:sourceContextUpdateSchema.shape.description,updated_at:date}).strict();
const captureRow=z.object({id:z.string().uuid(),source_id:identifier.nullable(),external_id:identifier.nullable(),revision:identifier.nullable(),fingerprint:digest,context_at:date,received_at:date,json:z.string()}).strict();
const headRow=z.object({source_id:identifier,external_id:identifier,capture_id:z.string().uuid(),observed_at:date}).strict();
const materialRow=z.object({id:materialId,source_id:identifier,external_id:identifier,revision:digest,sequence,created_at:date,updated_at:date,min_visible_sequence:sequence}).strict();
const versionRow=z.object({material_id:materialId,revision:digest,sequence,json:z.string(),text:z.string(),created_at:date}).strict();
const captureLinkRow=z.object({material_id:materialId,revision:digest,member_id:identifier,capture_id:z.string().uuid()}).strict();
const inputRow=z.object({material_id:materialId,revision:digest,member_id:identifier,input_material_id:materialId,input_revision:digest}).strict();
const contextLinkRow=z.object({material_id:materialId,revision:digest,source_id:identifier,version:sequence,fingerprint:digest}).strict();
const sourceLinkRow=z.object({material_id:materialId,revision:digest,source_id:identifier}).strict();
const declarationRow=z.object({material_id:materialId,id:z.string().uuid(),version:sequence,base_hash:digest,fingerprint:digest,json:z.string()}).strict();
const importRow=z.object({id:z.string().uuid(),version:sequence,source_id:identifier,fingerprint:digest,instruction:importDeclarationSchema.shape.instruction}).strict();
const importCaptureRow=z.object({capture_id:z.string().uuid(),id:z.string().uuid(),version:sequence}).strict();
const canonicalTables=['import_declarations','capture_imports','material_declarations','sources','source_contexts','captures','source_heads','materials','material_versions','material_captures','material_inputs','material_contexts','material_sources'] as const;
const coverage={canonicalTables:[...canonicalTables],excluded:['assets','credentials','other-domains'],indexes:'rebuilt-from-canonical-rows'} as const;
const coverageSchema=z.object({canonicalTables:z.array(z.enum(canonicalTables)),excluded:z.array(z.string()),indexes:z.literal(coverage.indexes)}).strict().refine(value=>JSON.stringify(value)===JSON.stringify(coverage));
const payloadSchema=z.object({
  format:z.literal('mote-private-data-v1'),coverage:coverageSchema,
  import_declarations:z.array(importRow),capture_imports:z.array(importCaptureRow),material_declarations:z.array(declarationRow),sources:z.array(sourceRow),source_contexts:z.array(contextRow),captures:z.array(captureRow),source_heads:z.array(headRow),
  materials:z.array(materialRow),material_versions:z.array(versionRow),material_captures:z.array(captureLinkRow),
  material_inputs:z.array(inputRow),material_contexts:z.array(contextLinkRow),material_sources:z.array(sourceLinkRow),
}).strict();
type Payload=z.infer<typeof payloadSchema>;
const envelopeSchema=z.object({domain:z.literal(DOMAIN),version:z.literal(1),deploymentId:identifier,userId:identifier,payload:payloadSchema}).strict();
const sourceJsonSchema=sourceConnectionSchema.extend({createdAt:date,updatedAt:date});
function invalid():never{throw new PrivateDataError('invalid_data');}

/** Compare JSON values independently of object member order, without accepting
 * non-JSON numbers, unknown schema fields or implicit parser defaults. */
function canonical(value:unknown):string{
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number')return Number.isFinite(value)?JSON.stringify(value):invalid();
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object'&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null))return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical((value as Record<string,unknown>)[key])).join(',')+'}';
  return invalid();
}
function decode<S extends z.ZodTypeAny>(schema:S,json:string):z.output<S>{
  try{const raw:unknown=JSON.parse(json),value=schema.parse(raw);if(canonical(raw)!==canonical(value))invalid();return value;}
  catch{return invalid();}
}
const key=(...parts:unknown[])=>JSON.stringify(parts);
function unique<T>(rows:T[],identity:(row:T)=>string){
  const result=new Map<string,T>();
  for(const row of rows){const id=identity(row);if(result.has(id))invalid();result.set(id,row);}
  return result;
}
function grouped<T>(rows:T[],identity:(row:T)=>string){
  const result=new Map<string,T[]>();
  for(const row of rows){const id=identity(row),group=result.get(id)??[];group.push(row);result.set(id,group);}
  return result;
}

function validate(payload:Payload){
  const sources=unique(payload.sources,row=>row.id),contexts=unique(payload.source_contexts,row=>key(row.source_id,row.version));
  const captures=unique(payload.captures,row=>row.id),heads=unique(payload.source_heads,row=>key(row.source_id,row.external_id));
  const materials=unique(payload.materials,row=>row.id),versions=unique(payload.material_versions,row=>key(row.material_id,row.revision));
  unique(payload.captures.filter(row=>row.source_id!==null),row=>key(row.source_id,row.external_id,row.revision));
  unique(payload.materials,row=>key(row.source_id,row.external_id));
  unique(payload.material_versions,row=>key(row.material_id,row.sequence));
  const captureLinks=unique(payload.material_captures,row=>key(row.material_id,row.revision,row.member_id));
  const inputs=unique(payload.material_inputs,row=>key(row.material_id,row.revision,row.member_id));
  const contextLinks=unique(payload.material_contexts,row=>key(row.material_id,row.revision,row.source_id));
  const sourceLinks=unique(payload.material_sources,row=>key(row.material_id,row.revision,row.source_id));
  const contextHistory=grouped(payload.source_contexts,row=>row.source_id),versionHistory=grouped(payload.material_versions,row=>row.material_id);
  const declarations=unique(payload.material_declarations,row=>key(row.material_id,row.id,row.version)),declarationHistory=grouped(payload.material_declarations,row=>key(row.material_id,row.id));
  for(const row of declarations.values()){const statement=decode(materialOwnerStatementSchema,row.json);if(!materials.has(row.material_id)||statement.id!==row.id||hash(statement)!==row.fingerprint)invalid();}
  for(const rows of declarationHistory.values())if(rows.sort((a,b)=>a.version-b.version).some((row,index)=>row.version!==index+1))invalid();
  const usedDeclarations=new Set<string>();
  const parsedSources=new Map(payload.sources.map(row=>{
    const source=decode(sourceJsonSchema,row.json);
    if(source.id!==row.id||source.createdAt!==row.created_at||source.updatedAt!==row.updated_at)invalid();
    return [row.id,source] as const;
  }));
  for(const row of contexts.values())if(!sources.has(row.source_id)||row.fingerprint!==hash({sourceId:row.source_id,version:row.version,description:row.description}))invalid();
  for(const source of parsedSources.values()){
    const history=(contextHistory.get(source.id)??[]).sort((a,b)=>a.version-b.version);
    if(history.some((row,index)=>row.version!==index+1))invalid();
    const latest=history.at(-1),pin=source.sourceContext;
    if(latest?(!pin||pin.version!==latest.version||pin.fingerprint!==latest.fingerprint):Boolean(pin))invalid();
  }
  const parsedCaptures=new Map(payload.captures.map(row=>{
    const capture=decode(storedCaptureSchema,row.json),provenance=capture.provenance;
    if(capture.id!==row.id||new Date(sourceContentTime(capture)).toISOString()!==row.context_at||capture.capturedAt!==new Date(capture.capturedAt).toISOString())invalid();
    if((provenance?.sourceId??null)!==row.source_id||(provenance?.externalId??null)!==row.external_id||(provenance?.revision??null)!==row.revision)invalid();
    if(capture.ingressSourceId){const source=parsedSources.get(capture.ingressSourceId);if(provenance||!source||capture.deviceId!==source.deviceId||capture.platform!==source.platform)invalid();}
    if(provenance){
      const source=parsedSources.get(provenance.sourceId);if(!source||capture.deviceId!==source.deviceId||capture.platform!==source.platform)invalid();
      const item=sourceItemSchema.parse({externalId:provenance.externalId,revision:provenance.revision,observedAt:capture.capturedAt,
        modifiedAt:provenance.modifiedAt,title:capture.windowTitle,text:capture.ocrText,uri:provenance.uri,kind:capture.source,layer:provenance.layer,
        mimeType:provenance.mimeType,calendar:provenance.calendar,deleted:provenance.deleted,metadata:provenance.metadata,document:provenance.document});
      const {observedAt:_,...semantic}=item;if(hash(semantic)!==row.fingerprint)invalid();
    }else if(hash(capture)!==row.fingerprint)invalid();
    return [row.id,capture] as const;
  }));
  const imports=unique(payload.import_declarations,row=>key(row.id,row.version)),importCaptures=unique(payload.capture_imports,row=>row.capture_id);
  for(const row of imports.values())if(!sources.has(row.source_id)||!row.instruction.trim()||row.fingerprint!==hash({id:row.id,version:row.version,instruction:row.instruction,sourceId:row.source_id}))invalid();
  for(const row of importCaptures.values()){const declaration=imports.get(key(row.id,row.version)),capture=parsedCaptures.get(row.capture_id);if(!declaration||!capture||(capture.provenance?.sourceId??capture.ingressSourceId)!==declaration.source_id)invalid();}
  const originalIds=(id:string,revision:string,seen=new Set<string>()):string[]=>{const identity=key(id,revision);if(seen.has(identity))invalid();const next=new Set([...seen,identity]);return [...new Set([...payload.material_captures.filter(row=>row.material_id===id&&row.revision===revision).map(row=>row.capture_id),...payload.material_inputs.filter(row=>row.material_id===id&&row.revision===revision).flatMap(row=>originalIds(row.input_material_id,row.input_revision,next))])];};
  const expectedImports=(captureIds:string[])=>{const grouped=new Map<string,{id:string;version:number;fingerprint:string;instruction:string;captureIds:string[]}>();for(const captureId of [...new Set(captureIds)].sort()){const link=importCaptures.get(captureId);if(!link)continue;const declaration=imports.get(key(link.id,link.version))!,identity=key(link.id,link.version);if(!grouped.has(identity))grouped.set(identity,{id:declaration.id,version:declaration.version,fingerprint:declaration.fingerprint,instruction:declaration.instruction,captureIds:[]});grouped.get(identity)!.captureIds.push(captureId);}const values=[...grouped.values()].sort((a,b)=>a.id.localeCompare(b.id)||a.version-b.version);return {importDeclarations:values.map(({instruction:_,...pin})=>pin),importStatements:values.map(({fingerprint:_,...statement})=>statement)};};
  const latestObservation=new Map<string,number>();
  for(const row of payload.captures)if(row.source_id!==null){
    const id=key(row.source_id,row.external_id),observed=Date.parse(parsedCaptures.get(row.id)!.capturedAt);
    latestObservation.set(id,Math.max(latestObservation.get(id)??observed,observed));
  }
  for(const row of heads.values()){
    const capture=captures.get(row.capture_id),parsed=parsedCaptures.get(row.capture_id);
    if(!capture||!parsed||capture.source_id!==row.source_id||capture.external_id!==row.external_id||row.observed_at!==parsed.capturedAt)invalid();
    if(latestObservation.get(key(row.source_id,row.external_id))!==Date.parse(row.observed_at))invalid();
  }
  const seenCaptureLinks=new Set<string>(),seenInputs=new Set<string>(),seenContexts=new Set<string>(),seenSources=new Set<string>();
  const expectedSources=new Map<string,Set<string>>(),inputVersions=new Map<string,string[]>();
  const visibleVersions=new Set<string>();
  for(const row of versions.values()){
    const material=materials.get(row.material_id),draft=decode(materialDraftSchema,row.json);
    if(!material||draft.id!==row.material_id||draft.origin.sourceId!==material.source_id||draft.origin.externalId!==material.external_id||
      draft.id!=='mat_'+hash([draft.origin.sourceId,draft.origin.externalId])||hash(draft)!==row.revision||!sources.has(draft.origin.sourceId)||
      draft.blocks.some(block=>block.kind==='asset'&&!block.memberIds.length)||draft.blocks.flatMap(block=>block.kind==='text'?[block.text]:[]).join('\n')!==row.text)invalid();
    // Match publication: the strict Material schema admits only text and asset
    // metadata. Assets require owned input members; bytes remain gated by M03.
    const visible=material.revision===row.revision&&material.sequence>=material.min_visible_sequence;
    if(visible)visibleVersions.add(key(row.material_id,row.revision));
    const members=unique(draft.members,member=>member.id);unique(draft.blocks,block=>block.id);
    const captureIds=new Set<string>();
    const sourcesForVersion=new Set([draft.origin.sourceId]),dependencies:string[]=[];
    for(const member of members.values()){
      const id=key(row.material_id,row.revision,member.id);
      if(member.kind==='capture'){
        const link=captureLinks.get(id),capture=link&&parsedCaptures.get(link.capture_id);
        if(!link||member.ref!=='capture:'+link.capture_id||!capture||capture.provenance?.deleted||member.revision&&member.revision!==capture.provenance?.revision)invalid();
        if(visible&&capture.provenance&&heads.get(key(capture.provenance.sourceId,capture.provenance.externalId))?.capture_id!==capture.id)invalid();
        captureIds.add(link.capture_id);seenCaptureLinks.add(id);
        if(capture.provenance)sourcesForVersion.add(capture.provenance.sourceId);
        if(capture.ingressSourceId)sourcesForVersion.add(capture.ingressSourceId);
      }else if(member.kind==='material'){
        const link=inputs.get(id);
        if(!link||![`material:${link.input_material_id}@${link.input_revision}`,`${link.input_material_id}@${link.input_revision}`].includes(member.ref)||member.revision&&member.revision!==link.input_revision||link.input_material_id===row.material_id||!versions.has(key(link.input_material_id,link.input_revision)))invalid();
        const input=materials.get(link.input_material_id);
        if(visible&&(!input||input.revision!==link.input_revision||input.sequence<input.min_visible_sequence))invalid();
        seenInputs.add(id);dependencies.push(key(link.input_material_id,link.input_revision));
      }else invalid();
    }
    for(const block of draft.blocks)if(block.memberIds.some(id=>!members.has(id))||block.evidenceIds?.some(id=>!captureIds.has(id)))invalid();
    const requireContext=(sourceId:string,version:number,fingerprint:string)=>{
      const id=key(row.material_id,row.revision,sourceId),link=contextLinks.get(id),context=contexts.get(key(sourceId,version));
      const current=parsedSources.get(sourceId)?.sourceContext;
      if(!link||link.version!==version||link.fingerprint!==fingerprint||!context||context.fingerprint!==fingerprint||visible&&(current?.version!==version||current.fingerprint!==fingerprint))invalid();
      seenContexts.add(id);
    };
    // All description links must match explicit immutable draft pins. Only a
    // currently visible head must pin the source's latest description; hidden
    // and historical revisions retain their original exact provenance.
    const checkAttribution=(value:AttributionContext|undefined,selected=originalIds(row.material_id,row.revision))=>{
      const expected=expectedImports(selected);if(!value){if(expected.importDeclarations.length)invalid();return;}
      if(value.materialDeclarations||canonical(value.importDeclarations??[])!==canonical(expected.importDeclarations)||canonical(value.importStatements??[])!==canonical(expected.importStatements))invalid();
      const declared=unique(value.declarations??[],pin=>pin.id),statements=unique(value.ownerStatements??[],statement=>statement.id);
      if(declared.size!==statements.size)invalid();
      for(const pin of declared.values()){const id=key(row.material_id,pin.id,pin.version),declaration=declarations.get(id),statement=statements.get(pin.id);if(!declaration||declaration.fingerprint!==pin.fingerprint||declaration.base_hash!==materialOwnerDeclarationBodyHash(draft)||!statement||canonical(statement)!==canonical(JSON.parse(declaration.json)))invalid();usedDeclarations.add(id);}

      if(value.sourceDeclaration){
        const pin=value.sourceDeclaration,source=parsedSources.get(pin.sourceId);
        if(!source||pin.version>(source.ownerRelationVersion??0)||visible&&(source.ownerRelationVersion!==pin.version||(source.ownerRelation??null)!==pin.ownerRelation))invalid();
        sourcesForVersion.add(pin.sourceId);
      }
      for(const pin of value.sourceContextDeclarations??[]){requireContext(pin.sourceId,pin.version,pin.fingerprint);sourcesForVersion.add(pin.sourceId);}
      for(const statement of value.sourceContextStatements??[]){
        const context=contexts.get(key(statement.sourceId,statement.version));
        if(!context||context.description!==statement.description)invalid();
        requireContext(statement.sourceId,statement.version,context.fingerprint);
        sourcesForVersion.add(statement.sourceId);
      }
    };
    checkAttribution(draft.attributionContext);
    for(const block of draft.blocks)if(block.kind==='text')checkAttribution(block.evidenceContext?.attributionContext,draft.members.filter(member=>block.memberIds.includes(member.id)).flatMap(member=>{if(member.kind==='capture')return [member.ref.slice(8)];const link=inputs.get(key(row.material_id,row.revision,member.id))!;return originalIds(link.input_material_id,link.input_revision);}));
    expectedSources.set(key(row.material_id,row.revision),sourcesForVersion);inputVersions.set(key(row.material_id,row.revision),dependencies);
  }
  if(usedDeclarations.size!==declarations.size)invalid();
  if(seenCaptureLinks.size!==captureLinks.size||seenInputs.size!==inputs.size)invalid();
  for(const row of materials.values()){
    const history=(versionHistory.get(row.id)??[]).sort((a,b)=>a.sequence-b.sequence),latest=history.at(-1);
    if(!latest||history.some((version,index)=>version.sequence!==index+1)||latest.sequence!==row.sequence||latest.revision!==row.revision||history[0].created_at!==row.created_at||Date.parse(row.updated_at)<Date.parse(latest.created_at)||row.min_visible_sequence>row.sequence+1)invalid();
  }
  // Resolve the dependency DAG iteratively. Long valid chains do not consume
  // the JavaScript call stack, and unrelated rows are never rescanned per head.
  const remaining=new Map<string,number>(),dependents=new Map<string,string[]>(),ready:string[]=[];
  for(const [id,dependencies] of inputVersions){
    const inputs=new Set(dependencies);remaining.set(id,inputs.size);if(!inputs.size)ready.push(id);
    for(const input of inputs){const children=dependents.get(input)??[];children.push(id);dependents.set(input,children);}
  }
  let resolved=0;
  while(ready.length){
    const id=ready.pop()!;resolved++;
    for(const child of dependents.get(id)??[]){
      for(const source of expectedSources.get(id)!)expectedSources.get(child)!.add(source);
      const count=remaining.get(child)!-1;remaining.set(child,count);if(!count)ready.push(child);
    }
  }
  if(resolved!==versions.size)invalid();
  for(const row of versions.values())for(const source of expectedSources.get(key(row.material_id,row.revision))!){
    const id=key(row.material_id,row.revision,source);if(!sourceLinks.has(id))invalid();seenSources.add(id);
    const current=parsedSources.get(source)?.sourceContext;
    if(current&&visibleVersions.has(key(row.material_id,row.revision))){
      const context=contextLinks.get(id);
      if(!context||context.version!==current.version||context.fingerprint!==current.fingerprint||!seenContexts.has(id))invalid();
    }
  }
  if(seenSources.size!==sourceLinks.size||seenContexts.size!==contextLinks.size)invalid();
}

const tables=[
  {key:'sources',name:'pd_sources',columns:['id','json','created_at','updated_at']},
  {key:'source_contexts',name:'pd_source_contexts',columns:['source_id','version','fingerprint','description','updated_at']},
  {key:'captures',name:'pd_captures',columns:['id','source_id','external_id','revision','fingerprint','context_at','received_at','json']},
  {key:'import_declarations',name:'pd_import_declarations',columns:['id','version','source_id','fingerprint','instruction']},
  {key:'capture_imports',name:'pd_capture_imports',columns:['capture_id','id','version']},
  {key:'source_heads',name:'pd_source_heads',columns:['source_id','external_id','capture_id','observed_at']},
  {key:'materials',name:'pd_materials',columns:['id','source_id','external_id','revision','sequence','created_at','updated_at','min_visible_sequence']},
  {key:'material_versions',name:'pd_material_versions',columns:['material_id','revision','sequence','json','text','created_at']},
  {key:'material_captures',name:'pd_material_captures',columns:['material_id','revision','member_id','capture_id']},
  {key:'material_inputs',name:'pd_material_inputs',columns:['material_id','revision','member_id','input_material_id','input_revision']},
  {key:'material_contexts',name:'pd_material_contexts',columns:['material_id','revision','source_id','version','fingerprint']},
  {key:'material_sources',name:'pd_material_sources',columns:['material_id','revision','source_id']},
  {key:'material_declarations',name:'pd_material_declarations',columns:['material_id','id','version','base_hash','fingerprint','json']},
] as const;
function read(sql:PrivateSql):Payload{
  const rows=Object.fromEntries(tables.map(table=>[table.key,sql.all(`SELECT ${table.columns.join(',')} FROM ${table.name} WHERE user_id=$user ORDER BY ${table.columns.join(',')}`)]));
  const payload=payloadSchema.parse({format:'mote-private-data-v1',coverage,...rows});validate(payload);return payload;
}

/** Merge only this domain's canonical rows. Immutable histories conflict rather
 * than being overwritten; source and Material heads follow their own monotonic
 * observation/version identities. Existing hidden heads stay hidden. */
function mergeCanonical(sql:PrivateSql,archive:UserExport){
 const value=envelopeSchema.parse(archive);if(value.userId!==sql.userId)invalid();validate(value.payload);
 const current=read(sql),merged=structuredClone(current),keys:Record<keyof typeof current,string[]>={format:[],coverage:[],sources:['id'],source_contexts:['source_id','version'],captures:['id'],import_declarations:['id','version'],capture_imports:['capture_id'],source_heads:['source_id','external_id'],materials:['id'],material_versions:['material_id','revision'],material_captures:['material_id','revision','member_id'],material_inputs:['material_id','revision','member_id'],material_contexts:['material_id','revision','source_id'],material_sources:['material_id','revision','source_id'],material_declarations:['material_id','id','version']};
 const conflict=():never=>{throw new PrivateDataError('conflict',409);};
 for(const table of tables){const identity=(row:Record<string,unknown>)=>canonical(keys[table.key].map(key=>row[key])),rows=new Map((merged[table.key] as Record<string,unknown>[]).map(row=>[identity(row),row]));
  for(const incoming of value.payload[table.key] as Record<string,unknown>[]){const id=identity(incoming),before=rows.get(id);if(!before){if(table.key==='sources'){const source=sourceJsonSchema.parse(JSON.parse(String(incoming.json)));rows.set(id,{...incoming,json:JSON.stringify({...source,enabled:false})});}else rows.set(id,incoming);continue;}if(canonical(before)===canonical(incoming))continue;
   if(table.key==='sources'){const old=sourceJsonSchema.parse(JSON.parse(String(before.json))),next=sourceJsonSchema.parse(JSON.parse(String(incoming.json)));if(old.deviceId!==next.deviceId||old.platform!==next.platform||old.kind!==next.kind)conflict();const oldContext=old.sourceContext?.version??0,nextContext=next.sourceContext?.version??0,description=nextContext>oldContext?next.sourceContext:old.sourceContext,declaration=(next.ownerRelationVersion??0)>(old.ownerRelationVersion??0)?next:old,updatedAt=Date.parse(next.updatedAt)>Date.parse(old.updatedAt)?next.updatedAt:old.updatedAt;rows.set(id,{...before,updated_at:updatedAt,json:JSON.stringify({...old,sourceContext:description,ownerRelation:declaration.ownerRelation,ownerRelationVersion:declaration.ownerRelationVersion,updatedAt})});}
   else if(table.key==='source_heads'){const delta=Date.parse(String(incoming.observed_at))-Date.parse(String(before.observed_at));if(delta===0&&incoming.capture_id!==before.capture_id)conflict();if(delta>0)rows.set(id,incoming);}
   else if(table.key==='materials'){if(incoming.source_id!==before.source_id||incoming.external_id!==before.external_id||incoming.sequence===before.sequence&&incoming.revision!==before.revision)conflict();if(Number(incoming.sequence)>Number(before.sequence))rows.set(id,incoming);}
   else if(table.key==='captures'){const {received_at:_old,...a}=before,{received_at:_new,...b}=incoming;if(canonical(a)!==canonical(b))conflict();}
   else conflict();
  }
  (merged[table.key] as unknown[])=Array.from(rows.values());
 }
 // Existing published views that no longer name current input heads must be
 // hidden together with their dependants, as in normal source publication.
 const captures=new Map(merged.captures.map(row=>[row.id,storedCaptureSchema.parse(JSON.parse(row.json))])),heads=new Map(merged.source_heads.map(row=>[key(row.source_id,row.external_id),row.capture_id])),sources=new Map(merged.sources.map(row=>[row.id,sourceJsonSchema.parse(JSON.parse(row.json))])),materials=new Map(merged.materials.map(row=>[row.id,row]));
 let changed=true;while(changed){changed=false;for(const material of merged.materials){if(material.sequence<material.min_visible_sequence)continue;const captureChanged=merged.material_captures.filter(row=>row.material_id===material.id&&row.revision===material.revision).some(row=>{const capture=captures.get(row.capture_id);return !capture||capture.provenance&&(capture.provenance.deleted||heads.get(key(capture.provenance.sourceId,capture.provenance.externalId))!==capture.id);}),inputChanged=merged.material_inputs.filter(row=>row.material_id===material.id&&row.revision===material.revision).some(row=>{const input=materials.get(row.input_material_id);return !input||input.revision!==row.input_revision||input.sequence<input.min_visible_sequence;}),contextChanged=merged.material_contexts.filter(row=>row.material_id===material.id&&row.revision===material.revision).some(row=>{const context=sources.get(row.source_id)?.sourceContext;return !context||context.version!==row.version||context.fingerprint!==row.fingerprint;});if(captureChanged||inputChanged||contextChanged){material.min_visible_sequence=material.sequence+1;changed=true;}}}
 validate(merged);
 for(const table of tables){const primary=keys[table.key],identity=(row:Record<string,unknown>)=>canonical(primary.map(key=>row[key])),old=new Map((current[table.key] as Record<string,unknown>[]).map(row=>[identity(row),row]));for(const row of merged[table.key] as Record<string,string|number|null>[]){const previous=old.get(identity(row));if(previous){if(canonical(previous)===canonical(row))continue;const changed=table.columns.filter(column=>!primary.includes(column));sql.run(`UPDATE ${table.name} SET ${changed.map(column=>column+'=?').join(',')} WHERE user_id=$user AND ${primary.map(column=>column+'=?').join(' AND ')}`,...changed.map(column=>row[column]),...primary.map(column=>row[column]));}else sql.run(`INSERT INTO ${table.name}(user_id,${table.columns.join(',')}) VALUES($user,${table.columns.map(()=>'?').join(',')})`,...table.columns.map(column=>row[column]));}}
 read(sql);
}

/** Canonical domain lifecycle only. M16 supplies durable authorization and
 * operation reconciliation; these hooks neither grant identity nor export
 * originals, credentials or data owned by another domain. */
export function privateDataLifecycle(sqlFor:(subject:UserDataSubject,purpose:LifecyclePurpose)=>PrivateSql):DomainLifecycle{
  return {
    importUser:(subject,archive)=>{if(archive.deploymentId!==subject.deploymentId||archive.userId!==subject.userId)invalid();const sql=sqlFor(subject,'restore');sql.transaction(()=>mergeCanonical(sql,archive));},
    exportUser:async subject=>{
      const sql=sqlFor(subject,'export'),payload=sql.transaction(()=>read(sql));
      return {domain:DOMAIN,version:1,deploymentId:subject.deploymentId,userId:subject.userId,payload};
    },
    deleteUser:async(subject,operationId)=>{
      const sql=sqlFor(subject,'delete');
      sql.transaction(()=>{
        for(const table of ['pd_capture_imports','pd_import_declarations','pd_material_declarations','pd_material_inputs','pd_material_captures','pd_material_contexts','pd_material_sources','pd_material_versions','pd_materials','pd_source_heads','pd_captures','pd_source_contexts','pd_sources','pd_fts'])sql.run(`DELETE FROM ${table} WHERE user_id=$user`);
      });
      return {status:'complete',operationId};
    },
    restoreUser:async(subject,archive:UserExport)=>{
      const sql=sqlFor(subject,'restore');
      let payload:Payload;
      try{const envelope=envelopeSchema.parse(archive);if(envelope.userId!==subject.userId||envelope.deploymentId!==subject.deploymentId)invalid();payload=envelope.payload;validate(payload);}catch{return invalid();}
      sql.transaction(()=>{
        const current=read(sql);
        if(canonicalTables.every(table=>canonical(current[table].map(canonical).sort())===canonical(payload[table].map(canonical).sort())))return;
        if(canonicalTables.some(table=>current[table].length>0))throw new PrivateDataError('conflict',409);
        for(const table of tables)for(const row of payload[table.key]){
          const values=table.columns.map(column=>(row as Record<string,string|number|null>)[column]);
          sql.run(`INSERT INTO ${table.name}(user_id,${table.columns.join(',')}) VALUES($user,${table.columns.map(()=>'?').join(',')})`,...values);
        }
      });
    },
  };
}
