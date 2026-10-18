import {attachmentVisible} from './ingress-attachments.js';
import {captureIncarnationGeneration,fileOriginalGeneration} from './ingress-file-forget.js';
import {Readable} from 'node:stream';
import {z} from 'zod';
import {exportTar,transcriptMarkdown,transcriptCsv,csvCell,type ExportTarEntry} from '../file-export-tar.js';
import {fileTypePattern,transcriptSchema} from '@mote/shared';
import {executionEnvelope} from '@mote/shared/execution';
import type {DatabaseSync} from 'node:sqlite';
import type {UserContext} from './context.js';
import type {IngressHost} from './ingress.js';
import {identityHash} from './originals.js';
import {PrivateSql, PrivateCursor, PrivateDataError, missing} from './private-data-sql.js';
import {registerUserRoute, type ScopedRuntime} from './http.js';
import type {ProcessingHost} from './processing.js';
import {PROCESSING_DOMAIN} from './processing.js';
import {imageProductSchema,imageProductTranscript} from './processing-image-products.js';
import {DEFAULT_IMAGE_RECIPE} from '../image-recipes.js';
import type {TaskExecution} from './task-execution.js';
import {evidenceId as chunkId} from './processing-analysis.js';

const listSchema = z.object({sourceId:z.string().max(128).optional(),query:z.string().max(2000).optional(),type:fileTypePattern.optional(),mimePrefix:z.enum(['audio/','text/','image/']).optional(),limit:z.coerce.number().int().min(1).max(100).default(50),cursor:z.string().max(8192).optional()}).strict();

/** Owned presentation of existing M03 originals and M06 publications. This has
 * no data store, processor, scheduler, model call or inferred default owner. */
export function registerProcessingFiles(runtime:ScopedRuntime,db:DatabaseSync,processing:ProcessingHost,ingress:IngressHost,execution:TaskExecution,key:string){
  const bind=(context:UserContext)=>{
    const assert=()=>runtime.authority.assert(context),sql=new PrivateSql(db,context.userId,assert),cursor=new PrivateCursor(key,context.deploymentId,context.userId),originals=ingress.forUser(context),service=processing.forUser(context);
    // File metadata is a catalog entry even when no original was uploaded.
    // Historical originals remain reader capabilities; current heads alone
    // decide processing authority and the one-row-per-file catalog view.
    const base=`FROM pd_captures c JOIN pd_sources s ON s.user_id=c.user_id AND s.id=c.source_id
      JOIN pd_source_heads h ON h.user_id=c.user_id AND h.source_id=c.source_id AND h.external_id=c.external_id
      JOIN pd_captures head ON head.user_id=h.user_id AND head.id=h.capture_id
      LEFT JOIN ig_file_heads fh ON fh.user_id=c.user_id AND fh.source_id=c.source_id AND fh.external_id=c.external_id
      LEFT JOIN ig_originals r ON r.user_id=c.user_id AND r.capture_id=c.id
      LEFT JOIN mp_original_formats f ON f.user_id=r.user_id AND f.original_id=r.id
      WHERE c.user_id=$user AND s.user_id=$user AND h.user_id=$user AND head.user_id=$user
      AND COALESCE(json_extract(s.json,'$.enabled'),1)=1 AND COALESCE(json_extract(c.json,'$.privacy.excluded'),0)=0
      AND COALESCE(json_extract(c.json,'$.provenance.deleted'),0)=0 AND json_extract(c.json,'$.source')='file'
      AND (f.format IN ('file','recording-audio-backup') OR instr(f.format,'processor:')=1 OR json_extract(c.json,'$.provenance.layer')='reference' OR json_type(c.json,'$.provenance.document.fileIndex') IS NOT NULL)
      AND ${attachmentVisible()}`;
    const entry=(id:string)=>{
      z.string().uuid().parse(id);const row=sql.get(`SELECT r.*,f.format original_format,c.id capture_id,h.capture_id current_capture_id,c.json capture,json_extract(head.json,'$.provenance.deleted') origin_missing ${base} AND c.user_id=$user AND c.id=?`,id);if(!row)throw missing();
      return {row,capture:JSON.parse(String(row.capture))};
    };
    const owned=(id:string)=>{
      const {row,capture}=entry(id);if(!row.id||!['file','recording-audio-backup'].includes(String(row.original_format))&&!String(row.original_format).startsWith('processor:'))throw missing();
      const ref='original:'+row.id,info=originals.readOriginal(ref,{length:0}),status=service.fileStatus(ref);
      return {row,ref,info,capture,status};
    };
    const detail=(id:string,includeAcoustics=true)=>{
      const entryValue=entry(id);
      if(!entryValue.row.id||!['file','recording-audio-backup'].includes(String(entryValue.row.original_format))&&!String(entryValue.row.original_format).startsWith('processor:')){
        const {row,capture}=entryValue;
        return {captureId:id,originalGeneration:captureIncarnationGeneration(sql,id),sourceId:capture.provenance.sourceId,sizeBytes:capture.provenance.metadata?.file?.sizeBytes??0,hasOriginal:false,originMissing:!!row.origin_missing,
          cancellation:{canCancel:false,wait:null},item:{...capture.provenance,title:capture.windowTitle,observedAt:capture.capturedAt,mimeType:capture.provenance.mimeType??'application/octet-stream'},processing:{current:row.current_capture_id===id,saved:true,processingRequired:false,processed:false,indexed:false,index:{material:false,memory:false},derivations:[]},job:null,artifacts:[]};
      }
      const {row,ref,info,capture,status}=owned(id),taskRow=sql.get('SELECT a.task_id FROM mp_admissions a JOIN execution_steps e ON e.user_id=a.user_id AND e.id=a.task_id WHERE a.user_id=$user AND e.user_id=$user AND a.original_id=? ORDER BY e.updated_at DESC,e.id LIMIT 1',String(row.id));
      const task=taskRow?execution.forUser(context).get(String(taskRow.task_id)):undefined,diarization=includeAcoustics?service.fileDiarization(ref):undefined,error=task?.failure?.code??task?.error??null;
      return {captureId:id,originalGeneration:fileOriginalGeneration(sql,ref),sourceId:info.sourceId,originalRef:ref,sizeBytes:info.totalBytes,sha256:info.hash,hasOriginal:info.available!==false,originMissing:!!row.origin_missing,
        rawArtifactId:service.fileStageIds(ref).raw,cancellation:service.cancellation(ref),calendarLink:status.current?service.fileCalendar(ref):undefined,item:{...capture.provenance,title:capture.windowTitle,observedAt:capture.capturedAt,mimeType:info.mime},processing:status,
        job:task?{state:task.state,stage:task.kind,attempts:task.attempts,error,execution:executionEnvelope({state:task.state,attempts:task.attempts,errorCode:error})}:null,
        artifacts:[...(diarization?[{...diarization,kind:'diarization',complete:true}]:[]),...(status.artifactId?[{id:status.artifactId,kind:'transcript',complete:true}]:[]),...status.derivations.map(x=>({id:x.artifactId,kind:x.kind==='turns'?'dialogue':x.kind,complete:true}))]};
    };
    return {owned,entry,detail,
      proof:(id:string)=>{const {ref}=owned(id);return identityHash({detail:detail(id,false),control:sql.get('SELECT generation,cancelled FROM mp_file_controls WHERE user_id=$user AND original_id=?',ref.slice(9)),tasks:sql.all('SELECT u.task_id,e.state,e.updated_at FROM user_tasks u JOIN execution_steps e ON e.user_id=u.user_id AND e.id=u.task_id WHERE u.user_id=$user AND e.user_id=$user AND json_extract(u.input,\'$.originalRef\')=? ORDER BY u.task_id',ref)});},
      list:(raw:unknown)=>{
        const {cursor:token,limit,...filters}=listSchema.parse(raw),query={collection:'processing-files',...filters,limit},position=token?z.object({at:z.string(),id:z.string().uuid()}).strict().parse(cursor.decodeCompact(token,query)):undefined,args:(string|number)[]=[],where:string[]=[`(c.id=h.capture_id OR (COALESCE(json_extract(head.json,'$.provenance.deleted'),0)=1 AND c.id=fh.capture_id))`];
        if(filters.sourceId){where.push('c.source_id=?');args.push(filters.sourceId);}
        if(filters.query){where.push("(instr(lower(json_extract(c.json,'$.windowTitle')),lower(?))>0 OR instr(lower(json_extract(c.json,'$.provenance.document.path')),lower(?))>0)");args.push(filters.query,filters.query);}
        if(filters.mimePrefix){where.push("instr(COALESCE(json_extract(c.json,'$.provenance.mimeType'),r.mime),?)=1");args.push(filters.mimePrefix);}
        if(filters.type&&filters.type!=='*/*'){where.push("COALESCE(json_extract(c.json,'$.provenance.mimeType'),r.mime) LIKE ?");args.push(filters.type.replace('*','%'));}
        if(position){where.push('(c.context_at<? OR(c.context_at=? AND c.id>?))');args.push(position.at,position.at,position.id);}
        const rows=sql.all(`SELECT c.id,c.context_at ${base} AND c.user_id=$user ${where.length?' AND '+where.join(' AND '):''} ORDER BY c.context_at DESC,c.id LIMIT ?`,...args,limit+1),page=rows.slice(0,limit),last=page.at(-1);
        return {items:page.map(row=>detail(String(row.id),false)),nextCursor:rows.length>limit&&last?cursor.encodeCompact(query,{at:String(last.context_at),id:String(last.id)}):null};
      },
      chunks:(id:string,raw:unknown)=>{
        const {offset}=z.object({offset:z.coerce.number().int().min(0).default(0)}).strict().parse(raw),{capture,status}=owned(id);
        if(!status.artifactId)return {items:[],nextOffset:null};
        const artifact=service.artifact(status.artifactId),transcript=transcriptSchema.parse(artifact.payload),segments=transcript.segments.slice(offset,offset+100),names=service.fileSpeakerNames('original:'+status.original.ref.slice(9),artifact.id);
        const items=segments.map((segment,index)=>{const id=chunkId(context.userId,artifact.id,offset+index);return {...capture,id,ocrText:segment.text,source:'file',fileEvidence:{captureId:capture.id,revision:capture.provenance.revision,artifactId:artifact.id,chunkId:id,startMs:segment.startMs,endMs:segment.endMs,...(segment.speaker?{speaker:segment.speaker}:{}),...(segment.uncertain!==undefined?{uncertain:segment.uncertain}:{}),...(segment.overlap!==undefined?{overlap:segment.overlap}:{}),...(segment.documentLocation?{documentLocation:segment.documentLocation}:{}),...(segment.imageLocation?{imageLocation:segment.imageLocation}:{})}};});
        for(const item of items){const label=item.fileEvidence.speaker;if(label&&names[label])Object.assign(item.fileEvidence,{speakerAttribution:names[label]});}
        assert();return {items,nextOffset:offset+segments.length<transcript.segments.length?offset+segments.length:null};
      },
      playback:(id:string)=>{const {ref}=owned(id),ticket=originals.ticket(ref,'play');return {url:'/api/ingress/originals/'+ref.slice(9)+'/content?ticket='+encodeURIComponent(ticket.ticket)};},
      export:(id:string)=>{
        const {capture,status,ref,row,info}=owned(id),extracted=service.rawFileArtifact(ref),selected=status.appliedPolicy?.profile.imageRecipe,explicitImage=status.original.mime.startsWith('image/')&&selected&&(selected.id!==DEFAULT_IMAGE_RECIPE.id||selected.version!==DEFAULT_IMAGE_RECIPE.version),currentId=status.artifactId??(explicitImage?undefined:extracted?.id),backupOnly=!currentId&&!status.derivations.length&&!extracted&&row.original_format==='recording-audio-backup'&&info.available!==false;if(!currentId&&!status.derivations.length&&!extracted&&!backupOnly)throw missing();
        const transcript=currentId?transcriptSchema.parse(service.artifact(currentId).payload):undefined,raw=currentId?service.originalFileArtifact(status.original.ref,currentId):undefined,uncorrected=raw?transcriptSchema.parse(raw.payload):undefined,diarization=service.fileDiarization(ref);
        const entries:ExportTarEntry[]=[{name:'manifest.json',bytes:Buffer.from(JSON.stringify({version:1,captureId:id,sourceId:capture.provenance.sourceId,artifactId:currentId,rawExtractionArtifactId:extracted?.id,diarizationArtifactId:diarization?.id,processed:status.processed,indexed:status.indexed,originalRef:status.original.ref,originalSha256:status.original.hash,uncorrectedPreserved:Boolean(raw),uncorrectedArtifactId:raw?.id,...(backupOnly?{originalFile:'original',originalMime:info.mime}:{}),...(status.derivations.some(item=>item.kind.startsWith('image:')||item.kind.startsWith('image-ocr:'))?{imageProducts:status.derivations.filter(item=>item.kind.startsWith('image:')||item.kind.startsWith('image-ocr:')).map(item=>({...item,path:item.kind.replace(':','/')+'.json'}))}:{})}))}];
        if(transcript)entries.push({name:'transcript.md',bytes:Buffer.from(transcriptMarkdown(transcript,capture.windowTitle))},{name:'transcript.csv',bytes:Buffer.from(transcriptCsv(transcript))},{name:'transcript.json',bytes:Buffer.from(JSON.stringify(transcript,null,2))});
        if(uncorrected)entries.push({name:'uncorrected-transcript.json',bytes:Buffer.from(JSON.stringify(uncorrected,null,2))},{name:'uncorrected-transcript.md',bytes:Buffer.from(transcriptMarkdown(uncorrected,capture.windowTitle))},{name:'uncorrected-transcript.csv',bytes:Buffer.from(transcriptCsv(uncorrected))});
        if(extracted){const original=transcriptSchema.parse(extracted.payload),prefix=status.original.mime.startsWith('audio/')?'raw-asr-transcript':'raw-extraction';entries.push({name:prefix+'.json',bytes:Buffer.from(JSON.stringify(original,null,2))},{name:prefix+'.md',bytes:Buffer.from(transcriptMarkdown(original,capture.windowTitle))},{name:prefix+'.csv',bytes:Buffer.from(transcriptCsv(original))});}
        if(diarization){entries.push({name:'diarization.json',bytes:Buffer.from(JSON.stringify(diarization,null,2))},{name:'diarization.rttm',bytes:Buffer.from(diarization.segments.map(segment=>`SPEAKER ${id} 1 ${(segment.startMs/1000).toFixed(3)} ${((segment.endMs-segment.startMs)/1000).toFixed(3)} <NA> <NA> ${segment.speaker} <NA> <NA>`).join('\n')+'\n')},{name:'diarization.csv',bytes:Buffer.from([['start_ms','end_ms','speaker'],...diarization.segments.map(segment=>[segment.startMs,segment.endMs,segment.speaker])].map(row=>row.map(csvCell).join(',')).join('\r\n'))});for(const sample of diarization.samples){const name='speaker_samples/'+sample.speaker+'.wav';entries.push({name,bytes:service.fileAsset(ref,diarization.id,name)});}}
        const calendarLink=status.current?service.fileCalendar(ref):undefined;if(calendarLink)entries.push({name:'confirmed-calendar.json',bytes:Buffer.from(JSON.stringify(calendarLink,null,2))});
        const names=currentId?service.fileSpeakerNames(status.original.ref,currentId):{};if(Object.keys(names).length)entries.push({name:'confirmed-speakers.json',bytes:Buffer.from(JSON.stringify({inputArtifact:currentId,attributions:names},null,2))});
        for(const item of status.derivations){const payload=service.artifact(item.artifactId).payload,typed=imageProductSchema.safeParse(payload),view=typed.success?imageProductTranscript(typed.data):transcriptSchema.parse(payload),name=item.kind.replace(':','/');if(typed.success&&(typed.data.original.sha256!==status.original.hash||typed.data.original.mime!==status.original.mime))throw new PrivateDataError('conflict',409);entries.push({name:name+'.json',bytes:Buffer.from(JSON.stringify(typed.success?typed.data:view,null,2))},{name:name+'.md',bytes:Buffer.from(transcriptMarkdown(view,capture.windowTitle))},{name:name+'.csv',bytes:Buffer.from(transcriptCsv(view))});}
        if(entries.reduce((size,item)=>size+('bytes' in item?item.bytes.length:0),0)>64*1024*1024)throw new PrivateDataError('invalid_data',413);
        // A retained backup has no transcript until its owner requests one.
        // Stream the original through the same per-block authority fences.
        if(backupOnly)entries.push({name:'original',sizeBytes:info.totalBytes,chunks:function*(){for(let offset=0;offset<info.totalBytes;offset+=64*1024)yield originals.readOriginal(ref,{offset,length:Math.min(64*1024,info.totalBytes-offset)}).bytes;}});
        const proof=identityHash([status.original.ref,status.original.hash,status.artifactId,status.revision,status.derivations,{raw:extracted?.id,diarization:diarization?.id},calendarLink]);
        const current=()=>{assert();const value=owned(id);if(identityHash([value.status.original.ref,value.status.original.hash,value.status.artifactId,value.status.revision,value.status.derivations,service.fileStageIds(ref),value.status.current?service.fileCalendar(ref):undefined])!==proof)throw new PrivateDataError('conflict',409);};
        current();return exportTar(entries,current);
      },
    };
  };
  registerUserRoute(runtime,{scope:'user',service:PROCESSING_DOMAIN,method:'POST',url:'/api/records/:id/attachments/:attachmentId/processing',handle:async({context,request})=>{const input=z.object({id:z.string().uuid(),attachmentId:z.string().uuid()}).parse(request.params);const result=await ingress.forUser(context).prepareAttachment(input.id,input.attachmentId,request.body);return {...result,processing:bind(context).detail(result.captureId,false).job};}});
  registerUserRoute(runtime,{scope:'user',service:PROCESSING_DOMAIN,method:'GET',url:'/api/files',handle:({context,request})=>bind(context).list(request.query)});
  registerUserRoute(runtime,{scope:'user',service:PROCESSING_DOMAIN,method:'GET',url:'/api/files/:id',handle:({context,request})=>bind(context).detail(z.object({id:z.string().uuid()}).parse(request.params).id)});
  registerUserRoute(runtime,{scope:'user',service:PROCESSING_DOMAIN,method:'GET',url:'/api/files/:id/chunks',handle:({context,request})=>bind(context).chunks(z.object({id:z.string().uuid()}).parse(request.params).id,request.query)});
  registerUserRoute(runtime,{scope:'user',service:PROCESSING_DOMAIN,method:'POST',url:'/api/files/:id/playback',handle:({context,request})=>{z.object({}).strict().parse(request.body??{});return bind(context).playback(z.object({id:z.string().uuid()}).parse(request.params).id);}});
  registerUserRoute(runtime,{scope:'user',service:PROCESSING_DOMAIN,method:'GET',url:'/api/files/:id/export',handle:({context,request,reply})=>reply.type('application/gzip').header('Cache-Control','no-store').header('Content-Disposition','attachment; filename="mote-recording.tar.gz"').send(bind(context).export(z.object({id:z.string().uuid()}).parse(request.params).id))});
  registerUserRoute(runtime,{scope:'user',service:PROCESSING_DOMAIN,method:'DELETE',url:'/api/files/:id',handle:({context,request})=>{const id=z.object({id:z.string().uuid()}).parse(request.params).id,service=ingress.forUser(context),receipt=service.fileForgetReceipt(id,request.body);if(receipt)return receipt;const file=bind(context).entry(id);return service.forgetFile(file.capture.id,request.body);}});
  registerUserRoute(runtime,{scope:'user',service:PROCESSING_DOMAIN,method:'GET',url:'/api/files/:id/forgotten',handle:({context,request})=>ingress.forUser(context).forgottenFile(z.object({id:z.string().uuid()}).parse(request.params).id)});
  registerUserRoute(runtime,{scope:'user',service:PROCESSING_DOMAIN,method:'POST',url:'/api/files/:id/allow-again',handle:({context,request})=>ingress.forUser(context).allowFileAgain(z.object({id:z.string().uuid()}).parse(request.params).id,request.body)});
  registerUserRoute(runtime,{scope:'user',service:PROCESSING_DOMAIN,method:'GET',url:'/api/files/:id/reviews',handle:({context,request})=>{const file=bind(context).owned(z.object({id:z.string().uuid()}).parse(request.params).id);return processing.forUser(context).fileReviews(file.ref);}});
  registerUserRoute(runtime,{scope:'user',service:PROCESSING_DOMAIN,method:'POST',url:'/api/files/:id/reviews',handle:({context,request})=>{const file=bind(context).owned(z.object({id:z.string().uuid()}).parse(request.params).id);return processing.forUser(context).reviewFile(file.ref,request.body);}});
  registerUserRoute(runtime,{scope:'user',service:PROCESSING_DOMAIN,method:'POST',url:'/api/files/:id/reviews/:reviewId',handle:({context,request})=>{const input=z.object({id:z.string().uuid(),reviewId:z.string().uuid()}).parse(request.params),file=bind(context).owned(input.id);return processing.forUser(context).confirmFileReview(file.ref,input.reviewId,request.body);}});
  registerUserRoute(runtime,{scope:'user',service:PROCESSING_DOMAIN,method:'GET',url:'/api/files/:id/assets',handle:({context,request,reply})=>{const file=bind(context).owned(z.object({id:z.string().uuid()}).parse(request.params).id),query=z.object({artifactId:z.string().regex(/^[a-f0-9]{64}$/),name:z.string().max(100)}).strict().parse(request.query);const service=processing.forUser(context),bytes=service.fileAsset(file.ref,query.artifactId,query.name),current=()=>{bind(context).owned(file.capture.id);if(service.fileStageIds(file.ref).diarization!==query.artifactId)throw missing();};
    // Start reading only after Fastify's response hooks. Every emitted block
    // retains the exact source and acoustic publication, including slow reads.
    function* blocks(){for(let offset=0;offset<bytes.length;offset+=64*1024){current();yield bytes.subarray(offset,offset+64*1024);}current();}
    return reply.header('Cache-Control','no-store').type('audio/wav').send(Readable.from(blocks()));}});
  registerUserRoute(runtime,{scope:'user',service:PROCESSING_DOMAIN,method:'POST',url:'/api/files/:id/cancel',handle:({context,request})=>{z.object({}).strict().parse(request.body??{});const file=bind(context).owned(z.object({id:z.string().uuid()}).parse(request.params).id);return processing.forUser(context).cancelFile(file.ref);}});
  registerUserRoute(runtime,{scope:'user',service:PROCESSING_DOMAIN,method:'POST',url:'/api/files/:id/retry',handle:({context,request})=>{const file=bind(context).owned(z.object({id:z.string().uuid()}).parse(request.params).id);return processing.forUser(context).retryFile(file.ref,request.body);}});
  registerUserRoute(runtime,{scope:'user',service:PROCESSING_DOMAIN,method:'POST',url:'/api/files/:id/corrections',handle:({context,request})=>{const file=bind(context).owned(z.object({id:z.string().uuid()}).parse(request.params).id);return processing.forUser(context).correctFile(file.ref,request.body);}});
  registerUserRoute(runtime,{scope:'user',service:PROCESSING_DOMAIN,method:'POST',url:'/api/files/:id/speakers',handle:({context,request})=>{const file=bind(context).owned(z.object({id:z.string().uuid()}).parse(request.params).id);return processing.forUser(context).nameFileSpeakers(file.ref,request.body);}});
  return bind;
}
