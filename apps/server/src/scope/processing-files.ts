import {z} from 'zod';
import {exportTar,transcriptMarkdown,transcriptCsv} from '../file-export-tar.js';
import {transcriptSchema} from '@mote/shared';
import {executionEnvelope} from '@mote/shared/execution';
import type {DatabaseSync} from 'node:sqlite';
import type {UserContext} from './context.js';
import type {IngressHost} from './ingress.js';
import {identityHash} from './originals.js';
import {PrivateSql, PrivateCursor, PrivateDataError, missing} from './private-data-sql.js';
import {registerUserRoute, type ScopedRuntime} from './http.js';
import type {ProcessingHost} from './processing.js';
import {PROCESSING_DOMAIN} from './processing.js';
import type {TaskExecution} from './task-execution.js';
import {evidenceId as chunkId} from './processing-analysis.js';

const listSchema = z.object({sourceId:z.string().max(128).optional(),query:z.string().max(2000).optional(),mimePrefix:z.enum(['audio/','text/','image/']).optional(),limit:z.coerce.number().int().min(1).max(100).default(50),cursor:z.string().max(8192).optional()}).strict();

/** Owned presentation of existing M03 originals and M06 publications. This has
 * no data store, processor, scheduler, model call or inferred default owner. */
export function registerProcessingFiles(runtime:ScopedRuntime,db:DatabaseSync,processing:ProcessingHost,ingress:IngressHost,execution:TaskExecution,key:string){
  const bind=(context:UserContext)=>{
    const assert=()=>runtime.authority.assert(context),sql=new PrivateSql(db,context.userId,assert),cursor=new PrivateCursor(key,context.deploymentId,context.userId),originals=ingress.forUser(context),service=processing.forUser(context);
    const base=`FROM ig_originals r JOIN pd_captures c ON c.user_id=r.user_id AND c.id=r.capture_id JOIN pd_sources s ON s.user_id=r.user_id AND s.id=r.source_id JOIN pd_source_heads h ON h.user_id=r.user_id AND h.capture_id=c.id JOIN mp_original_formats f ON f.user_id=r.user_id AND f.original_id=r.id
      WHERE r.user_id=$user AND c.user_id=$user AND s.user_id=$user AND h.user_id=$user AND f.user_id=$user AND (f.format='file' OR instr(f.format,'processor:')=1) AND COALESCE(json_extract(s.json,'$.enabled'),1)=1 AND COALESCE(json_extract(c.json,'$.provenance.deleted'),0)=0 AND json_extract(c.json,'$.source')='file'`;
    const owned=(id:string)=>{
      z.string().uuid().parse(id); const row=sql.get(`SELECT r.*,c.json capture ${base} AND r.user_id=$user AND c.id=?`,id); if(!row)throw missing();
      const ref='original:'+row.id,info=originals.readOriginal(ref,{length:0}),capture=JSON.parse(String(row.capture)),status=service.status(ref);
      return {row,ref,info,capture,status};
    };
    const detail=(id:string)=>{
      const {row,ref,info,capture,status}=owned(id),taskRow=sql.get('SELECT a.task_id FROM mp_admissions a JOIN execution_steps e ON e.user_id=a.user_id AND e.id=a.task_id WHERE a.user_id=$user AND e.user_id=$user AND a.original_id=? ORDER BY e.updated_at DESC,e.id LIMIT 1',String(row.id));
      const task=taskRow?execution.forUser(context).get(String(taskRow.task_id)):undefined;
      return {captureId:id,sourceId:info.sourceId,originalRef:ref,sizeBytes:info.totalBytes,sha256:info.hash,hasOriginal:info.available!==false,originMissing:!status.current,
        item:{...capture.provenance,title:capture.windowTitle,observedAt:capture.capturedAt,mimeType:info.mime},processing:status,
        job:task?{state:task.state,stage:task.kind,attempts:task.attempts,error:task.failure?.code??null,execution:executionEnvelope({state:task.state,attempts:task.attempts,errorCode:task.failure?.code})}:null,
        artifacts:[...(status.artifactId?[{id:status.artifactId,kind:'transcript',complete:true}]:[]),...status.derivations.map(x=>({id:x.artifactId,kind:x.kind==='turns'?'dialogue':x.kind,complete:true}))]};
    };
    return {owned,detail,
      list:(raw:unknown)=>{
        const {cursor:token,limit,...filters}=listSchema.parse(raw),query={collection:'processing-files',...filters,limit},position=token?z.object({at:z.string(),id:z.string().uuid()}).strict().parse(cursor.decodeCompact(token,query)):undefined,args:(string|number)[]=[],where:string[]=[];
        if(filters.sourceId){where.push('r.source_id=?');args.push(filters.sourceId);}
        if(filters.query){where.push("instr(lower(json_extract(c.json,'$.windowTitle')),lower(?))>0");args.push(filters.query);}
        if(filters.mimePrefix){where.push('instr(r.mime,?)=1');args.push(filters.mimePrefix);}
        if(position){where.push('(c.context_at<? OR(c.context_at=? AND c.id>?))');args.push(position.at,position.at,position.id);}
        const rows=sql.all(`SELECT c.id,c.context_at ${base} AND r.user_id=$user ${where.length?' AND '+where.join(' AND '):''} ORDER BY c.context_at DESC,c.id LIMIT ?`,...args,limit+1),page=rows.slice(0,limit),last=page.at(-1);
        return {items:page.map(row=>detail(String(row.id))),nextCursor:rows.length>limit&&last?cursor.encodeCompact(query,{at:String(last.context_at),id:String(last.id)}):null};
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
        const {capture,status}=owned(id);if(!status.artifactId)throw missing();
        const transcript=transcriptSchema.parse(service.artifact(status.artifactId).payload),raw=service.originalFileArtifact(status.original.ref,status.artifactId),uncorrected=transcriptSchema.parse(raw.payload);
        const entries=[{name:'transcript.md',bytes:Buffer.from(transcriptMarkdown(transcript,capture.windowTitle))},{name:'transcript.csv',bytes:Buffer.from(transcriptCsv(transcript))},{name:'transcript.json',bytes:Buffer.from(JSON.stringify(transcript,null,2))},{name:'manifest.json',bytes:Buffer.from(JSON.stringify({version:1,captureId:id,sourceId:capture.provenance.sourceId,artifactId:status.artifactId,originalRef:status.original.ref,originalSha256:status.original.hash,uncorrectedPreserved:true,uncorrectedArtifactId:raw.id}))}];
        entries.push({name:'uncorrected-transcript.json',bytes:Buffer.from(JSON.stringify(uncorrected,null,2))},{name:'uncorrected-transcript.md',bytes:Buffer.from(transcriptMarkdown(uncorrected,capture.windowTitle))},{name:'uncorrected-transcript.csv',bytes:Buffer.from(transcriptCsv(uncorrected))});
        const names=service.fileSpeakerNames(status.original.ref,status.artifactId);if(Object.keys(names).length)entries.push({name:'confirmed-speakers.json',bytes:Buffer.from(JSON.stringify({inputArtifact:status.artifactId,attributions:names},null,2))});
        for(const item of status.derivations){const payload=transcriptSchema.parse(service.artifact(String(item.artifactId)).payload);entries.push({name:item.kind+'.json',bytes:Buffer.from(JSON.stringify(payload,null,2))},{name:item.kind+'.md',bytes:Buffer.from(transcriptMarkdown(payload,capture.windowTitle))},{name:item.kind+'.csv',bytes:Buffer.from(transcriptCsv(payload))});}
        if(entries.reduce((size,item)=>size+item.bytes.length,0)>64*1024*1024)throw new PrivateDataError('invalid_data',413);
        assert();return exportTar(entries,assert);
      },
    };
  };
  registerUserRoute(runtime,{scope:'user',service:PROCESSING_DOMAIN,method:'GET',url:'/api/files',handle:({context,request})=>bind(context).list(request.query)});
  registerUserRoute(runtime,{scope:'user',service:PROCESSING_DOMAIN,method:'GET',url:'/api/files/:id',handle:({context,request})=>bind(context).detail(z.object({id:z.string().uuid()}).parse(request.params).id)});
  registerUserRoute(runtime,{scope:'user',service:PROCESSING_DOMAIN,method:'GET',url:'/api/files/:id/chunks',handle:({context,request})=>bind(context).chunks(z.object({id:z.string().uuid()}).parse(request.params).id,request.query)});
  registerUserRoute(runtime,{scope:'user',service:PROCESSING_DOMAIN,method:'POST',url:'/api/files/:id/playback',handle:({context,request})=>{z.object({}).strict().parse(request.body??{});return bind(context).playback(z.object({id:z.string().uuid()}).parse(request.params).id);}});
  registerUserRoute(runtime,{scope:'user',service:PROCESSING_DOMAIN,method:'GET',url:'/api/files/:id/export',handle:({context,request,reply})=>reply.type('application/gzip').header('Cache-Control','no-store').header('Content-Disposition','attachment; filename="mote-recording.tar.gz"').send(bind(context).export(z.object({id:z.string().uuid()}).parse(request.params).id))});
  registerUserRoute(runtime,{scope:'user',service:PROCESSING_DOMAIN,method:'POST',url:'/api/files/:id/corrections',handle:({context,request})=>{const file=bind(context).owned(z.object({id:z.string().uuid()}).parse(request.params).id);return processing.forUser(context).correctFile(file.ref,request.body);}});
  registerUserRoute(runtime,{scope:'user',service:PROCESSING_DOMAIN,method:'POST',url:'/api/files/:id/speakers',handle:({context,request})=>{const file=bind(context).owned(z.object({id:z.string().uuid()}).parse(request.params).id);return processing.forUser(context).nameFileSpeakers(file.ref,request.body);}});
}
