/** Pure built-in organizers shared by legacy and scoped production hosts. */
import {createHash} from 'node:crypto';
import {sourceContentTime,type CaptureRecord,type Transcript,type UiContentObject} from '@mote/shared';
import {codingProjectContext} from './coding-project.js';
import {uiPageCaptureSource} from './capture-memory-source.js';
import type {MaterialDraft,MaterialEvidenceContext} from './scope/material-model.js';
import type {ImageMaterialProjection} from './image-materials.js';
import type {readFileSpeakerAttributions} from './file-speaker-attribution.js';
const materialId=(sourceId:string,externalId:string)=>'mat_'+createHash('sha256').update(JSON.stringify([sourceId,externalId])).digest('hex');
/** Organizers select declared source shapes, never infer a topic or user intent. */
export interface MaterialOrganizerFile {
  image?:ImageMaterialProjection;
  extraction?:{complete?:boolean;coverage?:string};
  processingRequired?:boolean;
  providerTranscript?:boolean;
  objectHash?:string;
  attachments:{id:string;hash:string;mimeType:string;relativePath?:string}[];
  chunks:{id:string;text:string;startMs:number|null;endMs:number|null;kind:string;speaker?:string;
    imageLocation?:Transcript['segments'][number]['imageLocation'];
    speakerAttribution?:ReturnType<typeof readFileSpeakerAttributions>[string];artifact:{complete?:boolean;coverage?:string}}[];
  job?:{state:string;error:string|null};
  attachmentsTruncated:boolean;
  attachedFiles?:{fileId:string;record:CaptureRecord;file:MaterialOrganizerFile}[];
}

/** A build receives only evidence selected by its declared group. It has no SQL or write access. */
export interface MaterialOrganizerReader {
  capture():CaptureRecord|undefined;
  sourceHead():CaptureRecord|undefined;
  codingSession():{records:CaptureRecord[];truncated:boolean};
  screenGroup():{records:CaptureRecord[];truncated:boolean};
  uiPageGroup():{records:CaptureRecord[];truncated:boolean};
  file(captureId:string):MaterialOrganizerFile|undefined;
}

export interface MaterialOrganizer {
  id:string;
  version:string;
  /** Only one matching organizer in a structural slot runs. A trusted plugin may replace a fallback. */
  slot?:string;
  priority?:number;
  /** Suppress matching organizers in other slots when this organizer owns the source shape. */
  exclusive?:boolean;
  select(record:CaptureRecord):Record<string,string>|undefined;
  identity(group:Record<string,string>):string|undefined;
  build(reader:MaterialOrganizerReader,group:Record<string,string>):MaterialDraft|undefined;
}

export const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const member=(record:CaptureRecord)=>({id:record.id,kind:'capture' as const,ref:`capture:${record.id}`,revision:record.provenance?.revision});
const iso=(value:string)=>new Date(value).toISOString();
export const uiPageObservation=(r:CaptureRecord)=>{
  const page=r.metadata?.uiPage;if(page?.version!==2)throw Error('Expected structured page evidence');
  return {captureId:r.id,appVersion:page.appVersion,adapterId:page.adapterId,adapterVersion:page.adapterVersion,
    activity:page.activity,status:page.status,truncated:page.truncated,...page.observations};
};
const sourceKey=(prefix:string,deviceId:string)=>`${prefix}:${digest(deviceId)}`;
export const canonicalGroup=(group:Record<string,string>):Record<string,string>=>Object.fromEntries(Object.entries(group).sort(([a],[b])=>a.localeCompare(b)));
/** Source declarations and processor contracts, never fields parsed from prose. */
const evidenceContext=(record:CaptureRecord,role?:MaterialEvidenceContext['document']['contentRole']):MaterialEvidenceContext=>{
  const document=record.provenance?.document;
  return {observedAt:record.capturedAt,document:{recordedAt:document?.recordedAt,occurredAt:document?.occurredAt,
    timeBasis:document?.timeBasis??'unknown',contentRole:role??document?.contentRole??'other'}};
};
/** Model-facing material text is an allowlist, not the stored capture JSON. The
 * latter can contain local file URIs, document paths and provider metadata. */
const captureText=(record:CaptureRecord)=>{
  const provenance=record.provenance,document=provenance?.document,coding=document?.coding,fileIndex=document?.fileIndex,activity=document?.activity;
  const media=record.metadata?.media;
  return JSON.stringify({
    captureId:record.id,capturedAt:record.capturedAt,source:record.source,
    ...(record.appName?{appName:record.appName}:{}),
    ...(record.durationMs?{durationMs:record.durationMs}:{}),
    ...(record.ocrText?{text:record.ocrText}:{}),
    ...(record.ocr?{ocrStatus:record.ocr.status}:{}),
    ...(record.stateSeries?{stateSeries:record.stateSeries}:{}),
    ...(record.metadata?.state?{state:record.metadata.state}:{}),
    ...(record.metadata?.deviceEvent?{deviceEvent:record.metadata.deviceEvent}:{}),
    ...(record.metadata?.notification?{notification:record.metadata.notification}:{}),
    ...(media?{media:{status:media.status,observedAt:media.observedAt,sessions:media.sessions.map(session=>({
      appId:session.appId,appName:session.appName,playbackState:session.playbackState,
      appVisibility:session.appVisibility,playbackType:session.playbackType,
      title:session.title,artist:session.artist,album:session.album,displaySubtitle:session.displaySubtitle,
      durationMs:session.durationMs,positionMs:session.positionMs,playbackSpeed:session.playbackSpeed,
    }))}}:{}),
    ...(provenance?{sourceVersion:{revision:provenance.revision,layer:provenance.layer,
      deleted:provenance.deleted,modifiedAt:provenance.modifiedAt,
      ...(provenance.calendar?{calendar:provenance.calendar}:{})}}:{}),
    ...(document?{documentTime:{recordedAt:document.recordedAt,occurredAt:document.occurredAt,
      timeBasis:document.timeBasis,contentRole:document.contentRole}}:{}),
    ...(activity?{documentActivity:{...activity,documentTitle:record.windowTitle,
      qualification:activity.evidenceBasis==='search-predicate'?'The provider matched the connected account activity predicate in this interval. This is not a complete human event log or an exact action timestamp.':'The provider returned activity metadata; preserve its stated precision and actor scope.',
      ...(activity.action==='opened'?{readingScope:'Opening does not establish reading duration, finished reading, understanding or agreement. Provider open matching may include connector access.'}:{}),
      revisionScope:activity.exactRevision?'The provider verified only the explicitly linked revision.':'The content fetched by the connector is the current body, not proof of the revision seen at this activity.',
    }}:{}),
    ...(fileIndex?{fileIndex:{mode:fileIndex.mode,coverage:fileIndex.coverage,parser:fileIndex.parser,
      status:fileIndex.status,totalCharacters:fileIndex.totalCharacters,offset:fileIndex.offset,length:fileIndex.length}}:{}),
    ...(coding?{coding:{provider:coding.provider,projectKey:coding.projectKey,sessionId:coding.sessionId,
      eventId:coding.eventId,role:coding.role,
      callId:coding.callId,parentSessionId:coding.parentSessionId,part:coding.part,parts:coding.parts}}:{}),
  });
};
/** Exact host projection used by the built-in authored Material. */
export const authoredRecordProjection=captureText;
const origin=(sourceId:string,externalId:string,records:CaptureRecord[],extra:Partial<MaterialDraft['origin']>={})=>{
  const times=records.map(sourceContentTime).map(iso).sort();
  return {sourceId,externalId,deviceId:records[0]?.deviceId,firstAt:times[0],lastAt:times.at(-1),...extra};
};
export const MAX_BLOCKS=2000,MAX_MEMBERS=2000,MAX_BLOCK_TEXT=250_000,MAX_TEXT=4_000_000;

/** Structural size accounting; a limit always appears in the material coverage. */
class MaterialBody {
  constructor(private readonly maxBlocks=MAX_BLOCKS,private readonly maxText=MAX_TEXT){}
  readonly blocks:MaterialDraft['blocks']=[];
  readonly members:MaterialDraft['members']=[];
  readonly limitations=new Set<string>();
  private characters=0;
  get limited(){return this.limitations.size>0;}
  get full(){return this.blocks.length>=this.maxBlocks||this.characters>=this.maxText;}
  addMember(record:CaptureRecord){
    if(this.members.length>=MAX_MEMBERS){this.limitations.add('member_limit');return false;}
    this.members.push(member(record));return true;
  }
  text(id:string,text:string,memberId:string|string[],format:'plain'|'json'|'transcript'|'speech-text'='plain',locator?:Record<string,unknown>,evidenceIds?:string[],context?:MaterialEvidenceContext){
    if(!text)return;
    let position=0,part=0;
    while(position<text.length){
      const room=Math.min(MAX_BLOCK_TEXT,this.maxText-this.characters);
      if(this.blocks.length>=this.maxBlocks||room<=0){this.limitations.add(this.blocks.length>=this.maxBlocks?'block_limit':'text_limit');return;}
      let end=Math.min(text.length,position+room);
      if(end<text.length&&/[\uD800-\uDBFF]/.test(text[end-1])&&/[\uDC00-\uDFFF]/.test(text[end]))end--;
      if(end===position){this.limitations.add('text_limit');return;}
      const slice=text.slice(position,end);
      this.blocks.push({id:part?`${id}:${part}`:id,kind:'text',format,text:slice,memberIds:Array.isArray(memberId)?memberId:[memberId],
        ...(evidenceIds?{evidenceIds}:{}),
        ...(context?{evidenceContext:context}:{}),
        ...(locator||part?{locator:{...locator,textStart:position,textEnd:end}}:{})});
      this.characters+=slice.length;position=end;part++;
    }
  }
  asset(id:string,hash:string,mimeType:string,memberId:string,locator?:Record<string,unknown>){
    if(this.blocks.length>=this.maxBlocks){this.limitations.add('block_limit');return;}
    this.blocks.push({id,kind:'asset',hash,mimeType,memberIds:[memberId],...(locator?{locator}:{})});
  }
  coverage(state:'complete'|'pending'|'partial'='complete',reason?:string):MaterialDraft['coverage'] {
    const limit=[...this.limitations][0];
    return limit?{state:'partial',reason:limit}:reason?{state,reason}:{state};
  }
  fidelity(base:'lossless'|'derived'='lossless',limitations:string[]=[]):MaterialDraft['fidelity'] {
    const all=[...limitations,...this.limitations];
    return {state:all.length&&base==='lossless'?'derived':base,...(all.length?{limitations:all}:{})};
  }
}

const codingExternalId=(g:Record<string,string>)=>JSON.stringify([g.provider,g.projectKey,g.sessionId]);
function imageBlocks(body:MaterialBody,record:CaptureRecord,image:ImageMaterialProjection|undefined,prefix='image'):NonNullable<MaterialDraft['artifacts']>{
  if(!image||image.archiveOnly)return [];
  const originals:NonNullable<MaterialDraft['artifacts']>=[];
  if(image.original){
    const start=body.blocks.length;
    body.text(`${prefix}:original`,JSON.stringify({originalImage:{sha256:image.original.sha256},evidenceKind:'original_image_reference',
      instruction:'This locator contains no image contents. Use read_image on this evidence ID only when OCR cannot establish the needed visual fact. Interpretation text is navigation, never original proof.'}),record.id,'json',
      {memoryImageOriginal:image.original},undefined,evidenceContext(record,'reference'));
    originals.push({key:prefix==='image'?'image-original':`${prefix}/original-image`,state:'ready',revision:image.original.sha256,blockIds:body.blocks.slice(start).map(block=>block.id)});
  }
  if(prefix.startsWith('frame/')&&record.ocrText){
    const start=body.blocks.length;body.text(`${prefix}:ocr`,record.ocrText,record.id,'plain',undefined,undefined,evidenceContext(record,'other'));
    originals.push({key:`${prefix}/ocr`,state:'ready',blockIds:body.blocks.slice(start).map(block=>block.id)});
  }
  return [...originals,...image.jobs.filter(job=>job.name!=='ocr').map(job=>{
    const product=image.products.find(p=>p.name===job.name),start=body.blocks.length;
    if(product?.text)body.text(`${prefix}:${job.name}`,JSON.stringify({imageInterpretation:product.text,regions:product.regions,originalEvidence:product.evidence,productVersion:product.revision,
      evidenceKind:'model_interpretation',attribution:'Preserve the depicted author and uncertainty; this is not a verbatim original or an owner statement.'}),record.id,'json',
      {imageEvidence:product.evidence,productVersion:product.revision},undefined,evidenceContext(record,'summary'));
    return {key:prefix==='image'?`image-${job.name}`:`${prefix}/${job.name}`,state:job.state,blockIds:body.blocks.slice(start).map(b=>b.id),...(product?{revision:product.revision}:{}),...(job.reason?{reason:job.reason}:{})};
  })];
}

/** A source item keeps its own identity; a coding session is assembled separately. */
export const sourceItem:MaterialOrganizer={
  id:'mote.source-item',version:'13',slot:'source-item',
  select:r=>r.provenance&&!r.provenance.document?.coding?{sourceId:r.provenance.sourceId,externalId:r.provenance.externalId}:undefined,
  identity:g=>materialId(g.sourceId,g.externalId),
  build(reader,g){
    const r=reader.sourceHead();if(!r)return;
    const file=reader.file(r.id);if(!file)return;
    const {attachments,chunks,job}=file;
    const body=file.providerTranscript?new MaterialBody(20000,16*1024*1024):new MaterialBody();body.addMember(r);
    const {text:_body,...metadata}=JSON.parse(captureText(r));
    body.text('source-record',r.ocrText,r.id,'plain',undefined,undefined,evidenceContext(r));
    const sourceBodyBlocks=body.blocks.map(block=>block.id);
    const metadataStart=body.blocks.length;
    body.text('source-metadata',JSON.stringify(metadata),r.ocrText&&!r.provenance?.document?.activity?[]:r.id,'json',undefined,undefined,evidenceContext(r));
    const sourceBlocks=body.blocks.map(block=>block.id),sourceMetadataBlocks=body.blocks.slice(metadataStart).map(block=>block.id);
    for(const c of chunks){
      const structured=c.speaker!==undefined||c.imageLocation!==undefined;
      const text=structured?JSON.stringify({...(c.speaker!==undefined?{speaker:c.speaker}:{}),...(c.speakerAttribution?{speakerAttribution:c.speakerAttribution}:{}),...(c.imageLocation?{imageLocation:c.imageLocation}:{})})+'\n'+c.text:c.text;
      // The chunk writer preserves a real media timeline across corrections.
      // A corrected-dialogue container can also contain untimed document text.
      body.text(`chunk:${c.id}`,text,r.id,structured?'speech-text':c.startMs===null?'plain':'transcript',
        {chunkId:c.id,...(c.imageLocation?{imageLocation:c.imageLocation}:{}),...(c.startMs===null?{}:{startMs:c.startMs,endMs:c.endMs})},[c.id],
        evidenceContext(r,c.startMs===null?undefined:'transcript'));
    }
    const extractedBlocks=body.blocks.filter(block=>!sourceBlocks.includes(block.id)).map(block=>block.id);
    const imageArtifacts=imageBlocks(body,r,file.image);
    const attachedArtifacts:NonNullable<MaterialDraft['artifacts']>=[];
    let attachmentPartial=false;
    for(const {fileId,record:attached,file:processed} of file.attachedFiles??[]){
      if(!body.addMember(attached))break;
      if(processed.attachmentsTruncated)body.limitations.add('attachment_processing_truncated');
      if(processed.chunks.some(c=>c.artifact.complete===false||c.artifact.coverage==='partial'))attachmentPartial=true;
      const blockIds:string[]=[];
      for(const c of processed.chunks){
        const before=body.blocks.length;
        body.text(`attachment:${fileId}:${c.id}`,JSON.stringify({attachment:{fileId,captureId:attached.id,parentCaptureId:r.id},
          ...(c.speaker?{speaker:c.speaker}:{}),...(c.speakerAttribution?{speakerAttribution:c.speakerAttribution}:{}),
          ...(c.imageLocation?{imageLocation:c.imageLocation}:{}),text:c.text}),[r.id,attached.id],'json',
          {fileId,captureId:attached.id,chunkId:c.id,...(c.imageLocation?{imageLocation:c.imageLocation}:{}),...(c.startMs===null?{}:{startMs:c.startMs,endMs:c.endMs})},[c.id],evidenceContext(attached,c.startMs===null?'other':'transcript'));
        blockIds.push(...body.blocks.slice(before).map(b=>b.id));
      }
      const waiting=['waiting','running'].includes(processed.job?.state??'waiting'),failed=['blocked','failed'].includes(processed.job?.state??'');
      attachedArtifacts.push({key:`attachment/${fileId}/text`,blockIds,state:processed.extraction?'ready':waiting?'pending':failed?'failed':'unavailable',...(!processed.extraction&&processed.job?.error?{reason:processed.job.error}:{})});
      attachedArtifacts.push(...imageBlocks(body,attached,processed.image,`attachment/${fileId}`));
    }
    for(const attachment of attachments.filter(a=>a.mimeType.startsWith('image/')&&!(file.attachedFiles??[]).some(f=>f.fileId===a.id))){
      attachedArtifacts.push({key:`attachment/${attachment.id}/text`,state:'pending',blockIds:[],reason:'attachment_admission_pending'});
      attachedArtifacts.push({key:`attachment/${attachment.id}/understanding`,state:'pending',blockIds:[],reason:'attachment_admission_pending'});
    }
    if(file.objectHash)body.asset('original',file.objectHash,r.provenance?.mimeType??'application/octet-stream',r.id);
    for(const attachment of attachments){
      body.asset(`attachment:${attachment.id}`,attachment.hash,attachment.mimeType,r.id,
        {fileId:attachment.id,...(attachment.relativePath?{relativePath:attachment.relativePath}:{})});
    }
    if(file.attachmentsTruncated)body.limitations.add('attachment_limit');
    if(file.providerTranscript&&chunks.length>=19991)body.limitations.add('recording_segment_limit');
    const artifact=file.extraction??chunks[0]?.artifact;
    let state:'complete'|'pending'|'partial'='complete',reason:string|undefined;
    if(file.processingRequired){
      if(['waiting','running'].includes(job?.state??'waiting')){state='pending';reason='processing_pending';}
      else if(job?.state==='blocked'||job?.state==='failed'){state='partial';reason=`processing_${job.state}`;}
      else if(job?.state==='succeeded'&&!artifact&&!file.image?.archiveOnly){state='partial';reason='processed_body_missing';}
      else if(artifact&&(artifact.complete===false||artifact.coverage==='partial')){state='partial';reason='processor_partial';}
    }
    if(r.provenance?.document?.fileIndex&&r.provenance.document.fileIndex.coverage!=='full'){state='partial';reason='source_index_partial';}
    if(attachmentPartial||attachedArtifacts.some(a=>a.state!=='ready')){state='partial';reason='attachment_processing_incomplete';}
    const reference=r.provenance?.layer==='reference'||r.provenance?.layer==='derived';
    const hasSourceBody=Boolean(r.ocrText?.trim());
    // Processing readiness belongs to coverage/artifacts. Changing an unrelated
    // processor's state must not change the identity of the authored body.
    const limitations=['metadata_projected',...(reference?['original_body_not_collected']:[])];
    const activity=r.provenance?.document?.activity;
    const artifacts:MaterialDraft['artifacts']=[
      ...(activity?[{key:'daily-events',state:'ready' as const,blockIds:sourceMetadataBlocks}]:[]),
      {key:'source-record',blockIds:sourceBodyBlocks.length?sourceBodyBlocks:sourceBlocks,state:'ready'},
      {key:'source-body',blockIds:sourceBodyBlocks,state:reference||!hasSourceBody?'unavailable':'ready',
        ...(reference?{reason:'original_body_not_collected'}:!hasSourceBody?{reason:'source_body_empty'}:{})},
      ...(file.objectHash?[{key:'original',blockIds:body.blocks.filter(b=>b.id==='original').map(b=>b.id),state:'ready' as const,revision:file.objectHash}]:[]),
      ...(file.processingRequired?[{key:'extracted-text',blockIds:extractedBlocks,state:artifact&&artifact.complete!==false&&artifact.coverage!=='partial'?'ready' as const:['waiting','running'].includes(job?.state??'waiting')?'pending' as const:['blocked','failed','cancelled'].includes(job?.state??'')?'failed' as const:'unavailable' as const,...(!artifact&&job?.error?{reason:job.error}:{})}]:[]),
      ...imageArtifacts,
      ...attachedArtifacts,
    ];
    const start=r.provenance?.calendar?.start??sourceContentTime(r),end=r.provenance?.calendar?.end??start;
    return {id:materialId(g.sourceId,g.externalId),kind:r.source==='file'?'mote.file':`mote.${r.source}`,schemaVersion:2,
      title:r.windowTitle||r.appName||r.source,origin:origin(g.sourceId,g.externalId,[r],{firstAt:iso(start),lastAt:iso(end)}),
      blocks:body.blocks,members:body.members,coverage:body.coverage(state,reason),artifacts,fidelity:body.fidelity('derived',limitations),
      retention:{original:!!file.objectHash||attachments.length>0||!file.processingRequired&&!reference?'retained':'unavailable',policy:'keep'}};
  },
};

export const codingSession:MaterialOrganizer={
  id:'mote.coding-session',version:'3',slot:'coding-session',
  select:r=>{const c=r.provenance?.document?.coding;return c?{sourceId:r.provenance!.sourceId,provider:c.provider,projectKey:c.projectKey,sessionId:c.sessionId}:undefined;},
  identity:g=>materialId(g.sourceId,codingExternalId(g)),
  build(reader,g){
    const {records,truncated}=reader.codingSession();
    if(!records.length)return;
    const externalId=codingExternalId(g),body=new MaterialBody();
    // Consume newest first when the session exceeds one bounded revision. Display remains chronological.
    for(const [index,r] of records.entries()){
      if(body.full){body.limitations.add('session_text_limit');break;}
      if(!body.addMember(r))break;
      body.text(`event:${r.id}`,captureText(r),r.id,'json',{newestIndex:index},undefined,evidenceContext(r,'transcript'));
    }
    const order=new Map(records.map((r,index)=>[r.id,index]));
    body.blocks.sort((a,b)=>(order.get(b.memberIds[0]!)??0)-(order.get(a.memberIds[0]!)??0));
    body.members.reverse();
    if(truncated)body.limitations.add('session_member_limit');
    const byId=new Map(records.map(r=>[r.id,r]));
    const included=body.members.map(m=>byId.get(m.id)!).filter(Boolean);
    const project=codingProjectContext(included.map(r=>r.provenance!.document!.coding!));
    return {id:materialId(g.sourceId,externalId),kind:'mote.coding-session',schemaVersion:1,
      title:project.projectName??g.sessionId,
      origin:origin(g.sourceId,externalId,included,{provider:g.provider,projectKey:g.projectKey,sessionId:g.sessionId,...project}),
      blocks:body.blocks,members:body.members,coverage:body.coverage(),fidelity:body.fidelity('derived',['metadata_projected']),retention:{original:'retained',policy:'keep'}};
  },
};

/** Identity is declared by a versioned field adapter. Titles never identify an object. */
const uiPageExternalId=(g:Record<string,string>)=>digest([g.appId,g.kind,g.identityType,g.identityValue,g.captureId]);
export const uiPageObject:MaterialOrganizer={
  id:'mote.ui-page-object',version:'2',slot:'ui-page-object',priority:10,
  select(r){
    const page=r.metadata?.uiPage;if(r.source!=='ui_page'||page?.version!==2||!r.appId)return;
    const object=page.objects[0]!;
    return {deviceId:r.deviceId,appId:r.appId,kind:object.kind,...(object.identity?
      {identityType:object.identity.type,identityValue:object.identity.value}:{captureId:r.id})};
  },
  identity:g=>materialId(uiPageCaptureSource(g.deviceId),uiPageExternalId(g)),
  build(reader,g){
    const {records:input,truncated}=reader.uiPageGroup();
    const records=input.sort((a,b)=>Date.parse(a.capturedAt)-Date.parse(b.capturedAt)||a.id.localeCompare(b.id));
    if(!records.length)return;
    const byId=new Map(records.map(record=>[record.id,record]));
    const body=new MaterialBody();
    type Segment={fields:Omit<UiContentObject,'body'|'identity'>;key:string;headerMembers:string[];paragraphs:{text:string;members:string[]}[]};
    const segments:Segment[]=[],observations:unknown[]=[];
    const addProof=(ids:string[],id:string)=>{if(!ids.includes(id)){if(ids.length<32)ids.push(id);else body.limitations.add('block_evidence_limit');}};
    for(const r of records){
      const page=r.metadata?.uiPage;if(page?.version!==2)continue;
      body.addMember(r);const object=page.objects[0]!,{body:paragraphs,identity:_,...fields}=object,key=digest(fields);
      observations.push(uiPageObservation(r));
      const previous=segments.at(-1),texts=paragraphs.map(p=>p.text);
      let offset=-1;
      if(previous?.key===key){
        // Exact contiguous containment or suffix/prefix overlap only. Disjoint fragments remain separate.
        const existing=previous.paragraphs.map(p=>p.text);
        if(texts.length===0)offset=existing.length;
        else for(let start=0;start<=existing.length-texts.length;start++){
          if(texts.every((text,i)=>text===existing[start+i])){offset=start;break;}
        }
        if(offset<0)for(let size=Math.min(existing.length,texts.length);size>0;size--){
          if(texts.slice(0,size).every((text,i)=>text===existing[existing.length-size+i])){offset=existing.length-size;break;}
        }
      }
      if(previous&&offset>=0){
        addProof(previous.headerMembers,r.id);
        texts.forEach((text,i)=>{const found=previous.paragraphs[offset+i];if(found)addProof(found.members,r.id);else previous.paragraphs.push({text,members:[r.id]});});
      }else segments.push({fields,key,headerMembers:[r.id],paragraphs:texts.map(text=>({text,members:[r.id]}))});
    }
    if(!body.members.length)return;
    if(truncated)body.limitations.add('ui_page_group_limit');
    for(const [index,segment] of segments.entries()){
      body.text(`page:${index}:fields`,JSON.stringify(segment.fields),segment.headerMembers,'json',{appId:g.appId,kind:g.kind},undefined,evidenceContext(byId.get(segment.headerMembers[0]!)!));
      segment.paragraphs.forEach((paragraph,i)=>body.text(`page:${index}:body:${i}`,paragraph.text,paragraph.members,'plain',
        {segment:index,paragraph:i},undefined,evidenceContext(byId.get(paragraph.members[0]!)!)));
    }
    body.text('observations',JSON.stringify(observations),records[0]!.id,'json',undefined,undefined,evidenceContext(records[0]!));
    const pages=records.map(r=>r.metadata!.uiPage!).filter(p=>p.version===2);
    const sourceId=uiPageCaptureSource(g.deviceId),externalId=uiPageExternalId(g);
    return {id:materialId(sourceId,externalId),kind:'mote.ui-page-object',schemaVersion:1,title:segments.at(-1)!.fields.title.slice(0,500),
      origin:origin(sourceId,externalId,records,{firstAt:pages.map(p=>iso(p.observations.firstAt)).sort()[0],lastAt:pages.map(p=>iso(p.observations.lastAt)).sort().at(-1)}),
      blocks:body.blocks,members:body.members,coverage:body.coverage('partial','visible_window'),
      fidelity:body.fidelity('derived',['selected_page_fields','exact_overlap_only']),retention:{original:'retained',policy:'keep'},
      artifacts:[{key:'source-body',state:'ready',blockIds:body.blocks.map(b=>b.id)}]};
  },
};

export const screenGroup:MaterialOrganizer={
  id:'mote.screen-segment',version:'4',slot:'screen-segment',
  select:r=>{if(r.source!=='screen'&&r.source!=='ui_page'||r.metadata?.uiPage?.version===2)return;const row=(r as CaptureRecord&{groupKey?:string}).groupKey;return {deviceId:r.deviceId,groupKey:row??''};},
  identity:g=>g.groupKey?materialId(sourceKey('screen',g.deviceId),g.groupKey):undefined,
  build(reader,g){
    if(!g.groupKey)return;
    const {records,truncated}=reader.screenGroup();
    if(!records.length)return;
    const sourceId=sourceKey('screen',g.deviceId),externalId=g.groupKey,body=new MaterialBody();
    for(const r of records)body.addMember(r);
    if(truncated)body.limitations.add('screen_group_member_limit');
    const frameIndices=[...new Set([0,Math.floor((records.length-1)/2),records.length-1])];
    const durationMs=records.reduce((sum,r)=>sum+Math.max(0,r.durationMs??0),0);
    const applications=new Map<string,{appId:string;appName:string;samples:number;durationMs:number}>();
    const distinctOcr=new Map<string,string>();
    const imageArtifacts:NonNullable<MaterialDraft['artifacts']>=[];
    for(const r of records){
      const appId=r.appId??'',appName=r.appName??'',key=JSON.stringify([appId,appName]);
      const item=applications.get(key)??{appId,appName,samples:0,durationMs:0};
      item.samples++;item.durationMs+=Math.max(0,r.durationMs??0);applications.set(key,item);
      const ocr=(r.ocrText??'').trim().replace(/\s+/g,' ');
      if(ocr&&!distinctOcr.has(ocr))distinctOcr.set(ocr,ocr);
      imageArtifacts.push(...imageBlocks(body,r,reader.file(r.id)?.image,`frame/${r.id}`));
    }
    const apps=[...applications.values()].sort((a,b)=>b.durationMs-a.durationMs||a.appId.localeCompare(b.appId));
    body.text('overview',JSON.stringify({sampleCount:records.length,firstAt:sourceContentTime(records[0]!),lastAt:sourceContentTime(records.at(-1)!),
      observedDurationMs:durationMs,applicationCount:apps.length,applications:apps.slice(0,8),distinctOcrCount:distinctOcr.size,
      keyframeCount:frameIndices.length,originalsRetained:true}),records[0]!.id,'json',undefined,undefined,
      {observedAt:records[0]!.capturedAt,document:{timeBasis:'unknown',contentRole:'summary'}});
    for(const [index,position] of frameIndices.entries()){
      const r=records[position]!;
      body.text(`keyframe:${index}`,JSON.stringify({capturedAt:r.capturedAt,appId:r.appId,appName:r.appName,
        ocrText:(r.ocrText??'').trim().slice(0,800),hasImage:Boolean(r.blobHash)}),r.id,'json',{capturedAt:r.capturedAt},undefined,evidenceContext(r));
    }
    body.text('ocr-distinct',JSON.stringify({items:[...distinctOcr.values()].slice(0,12).map(text=>text.slice(0,500)),
      total:distinctOcr.size,truncated:distinctOcr.size>12}),records[0]!.id,'json',undefined,undefined,
      {observedAt:records[0]!.capturedAt,document:{timeBasis:'unknown',contentRole:'other'}});
    const ocrPending=records.some(r=>r.ocr?.status==='pending'),ocrFailed=records.some(r=>r.ocr?.status==='failed');
    return {id:materialId(sourceId,externalId),kind:'mote.screen-segment',schemaVersion:1,title:records.at(-1)?.appName||'Screen',
      origin:origin(sourceId,externalId,records),blocks:body.blocks,members:body.members,
      coverage:body.coverage(ocrFailed?'partial':ocrPending?'pending':'complete',ocrFailed?'ocr_failed':ocrPending?'ocr_pending':undefined),
      artifacts:[{key:'screen-observations',state:'ready'},{key:'ocr',state:ocrFailed?'failed':ocrPending?'pending':'ready',...(ocrFailed?{reason:'ocr_failed'}:ocrPending?{reason:'ocr_pending'}:{})},...imageArtifacts,
        ...(['image-original','image-ocr','image-understanding'] as const).flatMap(key=>{const selected=imageArtifacts.filter(artifact=>key==='image-original'?artifact.key.endsWith('/original-image'):key==='image-ocr'?artifact.key.endsWith('/ocr'):!artifact.key.endsWith('/original-image')&&!artifact.key.endsWith('/ocr'));return selected.length?[{key,state:selected.some(a=>a.state==='failed')?'failed' as const:selected.every(a=>a.state==='ready')?'ready' as const:'pending' as const,blockIds:selected.flatMap(a=>a.blockIds??[])}]:[];})],
      fidelity:body.fidelity('derived',['metadata_projected','screen_samples_compressed']),retention:{original:'retained',policy:'keep'}};
  },
};

/** Immutable observation identity: article overlap and screen grouping cannot
 * replace another day's event proof. Semantics remain entirely model-owned. */
export const captureEvent:MaterialOrganizer={
  id:'mote.capture-event',version:'1',slot:'capture-event',
  select:r=>r.source==='ui_page'&&r.metadata?.uiPage?.version===2||r.source==='screen'&&Boolean(r.blobHash)?{deviceId:r.deviceId,captureId:r.id,sourceId:r.source==='ui_page'?uiPageCaptureSource(r.deviceId):sourceKey('screen',r.deviceId)}:undefined,
  identity:g=>materialId(g.sourceId,JSON.stringify(['daily-event',g.captureId])),
  build(reader,g){
    const r=reader.capture();if(!r)return;
    const page=r.metadata?.uiPage,structured=page?.version===2,sourceId=g.sourceId;
    const image=reader.file(r.id)?.image,body=new MaterialBody();body.addMember(r);
    body.text('observation',JSON.stringify({capture:JSON.parse(captureText(r)),...(structured?{uiPage:page}:{}),
      ...(image?{imageProducts:image.products.filter(product=>product.kind!=='ocr').map(product=>({text:product.text,evidence:product.evidence,role:'model_interpretation'}))}:{})}),r.id,'json',undefined,undefined,evidenceContext(r));
    const ready=structured||Boolean(image&&image.jobs.length&&image.jobs.every(job=>job.state==='ready'));
    const state=ready?'ready' as const:image?.jobs.some(job=>job.state==='failed')?'failed' as const:image?.jobs.some(job=>job.state==='unavailable')?'unavailable' as const:'pending' as const;
    return {id:materialId(sourceId,JSON.stringify(['daily-event',r.id])),kind:'mote.capture-event',schemaVersion:1,title:r.windowTitle||r.appName||'Capture event',
      origin:origin(sourceId,JSON.stringify(['daily-event',r.id]),[r]),blocks:body.blocks,members:body.members,
      coverage:body.coverage(structured?'partial':ready?'complete':'pending',structured?'visible_window':ready?undefined:'image_processing'),
      artifacts:[{key:'daily-events',state,blockIds:body.blocks.map(block=>block.id)}],fidelity:body.fidelity('derived',['captured_observation']),retention:{original:'retained',policy:'keep'}};
  },
};

export const stateSeries:MaterialOrganizer={
  id:'mote.state-series',version:'2',slot:'state-series',
  select:r=>r.stateSeries||['activity','media','device_event'].includes(r.source)?{deviceId:r.deviceId,captureId:r.id}:undefined,
  identity:g=>materialId(sourceKey('state',g.deviceId),g.captureId),
  build(reader,g){
    const r=reader.capture();if(!r)return;
    const sourceId=sourceKey('state',r.deviceId),body=new MaterialBody();body.addMember(r);
    body.text('samples',captureText(r),r.id,'json',undefined,undefined,evidenceContext(r));
    return {id:materialId(sourceId,r.id),kind:'mote.state-series',schemaVersion:1,title:r.appName||r.source,
      origin:origin(sourceId,r.id,[r],{firstAt:iso(r.capturedAt),lastAt:iso(r.stateSeries?.samples.at(-1)?.at??r.capturedAt)}),
      blocks:body.blocks,members:body.members,coverage:body.coverage(),artifacts:[{key:'state-series',state:'ready'}],fidelity:body.fidelity('derived',['metadata_projected']),retention:{original:'retained',policy:'keep'}};
  },
};

export const authored:MaterialOrganizer={
  id:'mote.authored-record',version:'4',slot:'authored-record',
  select:r=>r.provenance||['screen','ui_page','activity','media','device_event'].includes(r.source)?undefined:{deviceId:r.deviceId,captureId:r.id},
  identity:g=>materialId(sourceKey('authored',g.deviceId),g.captureId),
  build(reader,g){
    const r=reader.capture();if(!r)return;
    const sourceId=sourceKey('authored',r.deviceId),body=new MaterialBody();body.addMember(r);
    body.text('record',r.ocrText,r.id,'plain',undefined,undefined,evidenceContext(r,r.source==='note'?'authored':undefined));
    const {text:_body,...metadata}=JSON.parse(captureText(r));
    body.text('record-metadata',JSON.stringify(metadata),r.ocrText?[]:r.id,'json',undefined,undefined,evidenceContext(r,r.source==='note'?'authored':undefined));
    const file=reader.file(r.id);if(!file)return;
    for(const attachment of file.attachments)body.asset(`attachment:${attachment.id}`,attachment.hash,attachment.mimeType,r.id,{fileId:attachment.id,...(attachment.relativePath?{relativePath:attachment.relativePath}:{})});
    if(file.attachmentsTruncated)body.limitations.add('attachment_limit');
    return {id:materialId(sourceId,r.id),kind:`mote.${r.source}`,schemaVersion:2,title:r.windowTitle||r.metadata?.notification?.title?.slice(0,500)||r.appName||r.source,
      origin:origin(sourceId,r.id,[r]),blocks:body.blocks,members:body.members,coverage:body.coverage(),artifacts:[{key:'authored-record',state:'ready'}],fidelity:body.fidelity('derived',['metadata_projected']),retention:{original:'retained',policy:'keep'}};
  },
};

export class MaterialOrganizerRegistry {
  private organizers=new Map<string,MaterialOrganizer>();
  constructor(private readonly onRegister?:(organizer:MaterialOrganizer)=>void){}
  register(organizer:MaterialOrganizer){
    if(!/^[a-z0-9.-]+$/.test(organizer.id)||!organizer.version||this.organizers.has(organizer.id)||
      organizer.slot!==undefined&&!/^[a-z0-9.-]+$/.test(organizer.slot)||
      organizer.priority!==undefined&&(!Number.isSafeInteger(organizer.priority)||Math.abs(organizer.priority)>1000))throw Error('Invalid or duplicate material organizer');
    this.organizers.set(organizer.id,organizer);
    try{this.onRegister?.(organizer);}catch(error){this.organizers.delete(organizer.id);throw error;}
    return ()=>{if(this.organizers.get(organizer.id)===organizer)this.organizers.delete(organizer.id);};
  }
  get(id:string){return this.organizers.get(id);}
  select(record:CaptureRecord){
    const candidates=[...this.organizers.values()].flatMap(organizer=>{const group=organizer.select(record);return group?[{organizer,group:canonicalGroup(group)}]:[]});
    candidates.sort((a,b)=>(b.organizer.priority??0)-(a.organizer.priority??0)||a.organizer.id.localeCompare(b.organizer.id));
    const exclusive=candidates.filter(candidate=>candidate.organizer.exclusive);
    if(exclusive.length){if(exclusive.length>1&&(exclusive[0].organizer.priority??0)===(exclusive[1].organizer.priority??0))throw Error('Ambiguous exclusive material organizers');return [exclusive[0]];}
    const selected=new Map<string,(typeof candidates)[number]>();
    for(const candidate of candidates){
      const slot=candidate.organizer.slot??candidate.organizer.id,prior=selected.get(slot);
      if(prior){if((prior.organizer.priority??0)===(candidate.organizer.priority??0))throw Error(`Ambiguous material organizer slot: ${slot}`);continue;}
      selected.set(slot,candidate);
    }
    return [...selected.values()];
  }
  list(){return [...this.organizers.values()].map(({id,version,slot,priority,exclusive})=>({id,version,slot:slot??id,priority:priority??0,exclusive:Boolean(exclusive)}));}
}

