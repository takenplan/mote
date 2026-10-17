import {createHash} from 'node:crypto';
import {z} from 'zod';
import type {LarkSelection,LarkDocumentSyncStatus,SourceItem,SourceItemRecord,SourceDocument} from '@mote/shared';
import {ConnectorError,type ConnectorContext} from './types.js';
import {authorizationUrl,larkJson,type LarkCommand} from './lark-cli.js';

export const larkHash=(value:string)=>createHash('sha256').update(value).digest('hex');
const iso=(at:number)=>new Date(at).toISOString();
const HOUR=3600000,DAY=86400000;
type Action='created'|'edited'|'opened';
type Activity={action:Action;start:string;end:string;observedAt:string};
type Pending={reference:string;title?:string;activities:Activity[];error?:string};
type Window={start:number;end:number;pageToken?:string;seen:string[]};
type Progress={through:number;window?:Window};
const tokenSchema=z.string().regex(/^[A-Za-z0-9]{8,100}$/);
export function larkReference(value:string,kind:'document'|'folder'|'wiki'='document'):string {
  if(tokenSchema.safeParse(value).success)return value;
  try{const u=new URL(value),path=kind==='folder'?/^\/drive\/folder\/([a-zA-Z0-9]{8,100})\/?$/:kind==='wiki'?/^\/wiki\/([a-zA-Z0-9]{8,100})\/?$/:/^\/(?:docx|wiki)\/([a-zA-Z0-9]{8,100})\/?$/;
    if(!authorizationUrl(value)||!path.test(u.pathname))throw Error();return `${u.origin}${u.pathname.replace(/\/$/,'')}`;
  }catch{throw new ConnectorError(`lark_${kind}_invalid`);}
}
export function larkToken(reference:string){return reference.startsWith('https:')?new URL(reference).pathname.split('/').at(-1)!:reference;}
export const discoverySchema=z.object({created:z.boolean(),edited:z.boolean(),opened:z.boolean(),firstSyncDays:z.number().int().min(1).refine(days=>Number.isFinite(new Date(Date.now()-days*DAY).getTime()))}).strict();
export const documentSelectionSchema={
  documents:z.array(z.string().trim().min(1).max(4000).transform(v=>larkReference(v))),
  documentDiscovery:discoverySchema.optional(),
  folders:z.array(z.string().trim().min(1).max(4000).transform(v=>larkReference(v,'folder'))).optional(),
  wikiRoots:z.array(z.string().trim().min(1).max(4000).transform(v=>larkReference(v,'wiki'))).optional(),
  excludedDocuments:z.array(z.string().trim().min(1).max(4000).transform(v=>larkReference(v))).optional(),
};
export function documentScope(selection:LarkSelection){return larkHash(JSON.stringify({documents:selection.documents,discovery:selection.documentDiscovery,folders:selection.folders??[],wikiRoots:selection.wikiRoots??[],excluded:selection.excludedDocuments??[]}));}
export function hasDocumentSelection(s:LarkSelection){return s.documents.length>0||Boolean(s.folders?.length)||Boolean(s.wikiRoots?.length)||Boolean(s.documentDiscovery&&(s.documentDiscovery.created||s.documentDiscovery.edited||s.documentDiscovery.opened));}
export function documentRevision(item:Omit<SourceItem,'revision'>,prior?:SourceItemRecord):SourceItem {
  const {observedAt:_,...content}=item;
  const evidenceDocument=(document:SourceItem['document'])=>{
    if(document?.originalMetadata?.provider!=='lark')return document;
    const {revisionId:_,...metadata}=document.originalMetadata;
    return {...document,originalMetadata:metadata};
  };
  const old=prior?JSON.stringify({externalId:prior.externalId,title:prior.title,text:prior.text,kind:prior.kind,layer:prior.layer,deleted:prior.deleted,calendar:prior.calendar,document:evidenceDocument(prior.document),uri:prior.uri,mimeType:prior.mimeType,modifiedAt:prior.modifiedAt}):'';
  const current=JSON.stringify({externalId:item.externalId,title:item.title,text:item.text,kind:item.kind,layer:item.layer,deleted:item.deleted,calendar:item.calendar,document:evidenceDocument(item.document),uri:item.uri,mimeType:item.mimeType,modifiedAt:item.modifiedAt});
  // A provider counter is not evidence of a changed exported body. Reuse the
  // entire immutable document metadata too: changing it under the old revision
  // would violate SourceStore's content hash and break replay with a 409.
  return old===current?{...item,document:prior!.document,revision:prior!.revision}:{...item,revision:larkHash(`${JSON.stringify(content)}:${prior?.revision??''}`)};
}
const docSchema=z.object({document_id:z.string().min(1).max(1000),revision_id:z.union([z.number(),z.string()]),title:z.string().max(2000).optional(),content:z.string()});
const wikiNodeSchema=z.object({node_token:z.string().min(1),obj_token:z.string().optional(),obj_type:z.string(),space_id:z.string().optional(),has_child:z.boolean().optional(),title:z.string().optional()});

/** A per-account, per-scope transport ledger. It contains no semantic classification.
 * Every discovery page is durable before its cursor advances; document failures
 * remain queued independently. The archive remains the authoritative evidence. */
export class LarkDocumentSync {
  readonly scope:string;
  constructor(private ctx:ConnectorContext,readonly account:string,readonly sourceId:string,readonly selection:LarkSelection,
    private run:(command:LarkCommand)=>Promise<string>,private fence:()=>Promise<void>,private authorize:()=>void) {
    this.scope=documentScope(selection);
    ctx.store.db.exec('CREATE TABLE IF NOT EXISTS lark_document_sync(account TEXT NOT NULL,scope TEXT NOT NULL,key TEXT NOT NULL,json TEXT NOT NULL,PRIMARY KEY(account,scope,key));');
  }
  private get<T>(key:string):T|undefined {const row=this.ctx.store.db.prepare('SELECT json FROM lark_document_sync WHERE account=? AND scope=? AND key=?').get(this.account,(key.startsWith('alias:')||key.startsWith('signal:'))?'identity':this.scope,key) as {json:string}|undefined;return row?JSON.parse(row.json) as T:undefined;}
  private set(key:string,value:unknown){this.ctx.store.db.prepare('INSERT INTO lark_document_sync VALUES(?,?,?,?) ON CONFLICT(account,scope,key) DO UPDATE SET json=excluded.json').run(this.account,(key.startsWith('alias:')||key.startsWith('signal:'))?'identity':this.scope,key,JSON.stringify(value));}
  private drop(key:string){this.ctx.store.db.prepare('DELETE FROM lark_document_sync WHERE account=? AND scope=? AND key=?').run(this.account,this.scope,key);}
  private rows<T>(prefix:string,limit=-1,errorOnly=false):Array<{key:string;value:T}>{return (this.ctx.store.db.prepare(`SELECT key,json FROM lark_document_sync WHERE account=? AND scope=? AND key LIKE ?${errorOnly?" AND json_extract(json,'$.error') IS NOT NULL":''} ORDER BY key LIMIT ?`).all(this.account,prefix.startsWith('signal:')?'identity':this.scope,`${prefix}%`,limit) as {key:string;json:string}[]).map(row=>({key:row.key,value:JSON.parse(row.json) as T}));}
  private count(prefix:string,errorOnly=false){return Number((this.ctx.store.db.prepare(`SELECT COUNT(*) AS count FROM lark_document_sync WHERE account=? AND scope=? AND key LIKE ?${errorOnly?" AND json_extract(json,'$.error') IS NOT NULL":''}`).get(this.account,this.scope,`${prefix}%`) as {count:number}).count);}
  confirmed(){return this.get<boolean>('confirmed')===true;}
  confirm(){this.set('confirmed',true);}
  private forgotten(id:string){return Boolean(this.ctx.store.db.prepare('SELECT 1 FROM file_forgotten WHERE source_id=? AND external_id=?').get(this.sourceId,id));}
  private suppressed(reference:string,id?:string){return this.forgotten(id??this.get<string>(`alias:${larkToken(reference)}`)??larkToken(reference));}
  private sweepForgotten(){
    const rows=this.ctx.store.db.prepare('SELECT external_id FROM file_forgotten WHERE source_id=?').all(this.sourceId) as {external_id:string}[];
    for(const row of rows){const aliases=this.ctx.store.db.prepare("SELECT key FROM lark_document_sync WHERE account=? AND scope='identity' AND key LIKE 'alias:%' AND json=?").all(this.account,JSON.stringify(row.external_id)) as {key:string}[];
      for(const token of [row.external_id,...aliases.map(alias=>alias.key.slice(6))])for(const prefix of ['pending:','found:'])this.ctx.store.db.prepare('DELETE FROM lark_document_sync WHERE account=? AND key=?').run(this.account,prefix+token);
    }
  }
  private excluded(reference:string,id?:string){const alias=this.get<string>(`alias:${larkToken(reference)}`);return (this.selection.excludedDocuments??[]).some(ref=>larkToken(ref)===larkToken(reference)||larkToken(ref)===id||this.get<string>(`alias:${larkToken(ref)}`)===(id??alias)&&Boolean(id??alias));}
  private enqueue(reference:string,title?:string,activity?:Activity){
    reference=larkReference(reference);
    if(this.excluded(reference)||this.suppressed(reference)){this.sweepForgotten();return;}
    const key=`pending:${larkToken(reference)}`,prior=this.get<Pending>(key),activities=prior?.activities??[];
    if(activity&&!activities.some(a=>a.action===activity.action&&a.start===activity.start&&a.end===activity.end))activities.push(activity);
    this.set(key,{reference,title:title?.slice(0,2000)??prior?.title,activities,...(prior?.error?{error:prior.error}:{})});
    this.set(`found:${larkToken(reference)}`,{reference,title:title?.slice(0,2000)});
  }
  status():LarkDocumentSyncStatus {
    this.sweepForgotten();
    const errors=this.rows<Pending>('pending:',100,true).map(row=>({reference:row.value.reference,code:row.value.error!})),found=this.rows<{reference:string;title?:string}>('found:',50);
    const counts=this.ctx.store.db.prepare("SELECT json_extract(c.json,'$.source') AS kind,COUNT(*) AS count FROM source_heads h JOIN captures c ON c.id=h.capture_id WHERE h.source_id=? AND h.deleted=0 GROUP BY kind").all(this.sourceId) as {kind:string;count:number}[];
    return {...(this.ctx.store.db.prepare('SELECT 1 FROM source_connections WHERE id=?').get(this.sourceId)?{sourceId:this.sourceId}:{}),confirmed:this.confirmed(),documents:counts.find(row=>row.kind==='file')?.count??0,activities:counts.find(row=>row.kind==='event')?.count??0,failed:this.count('pending:',true),pending:this.count('pending:'),errors,...(this.get<string>('attempt')?{lastAttemptAt:this.get<string>('attempt')}:{}),...(this.get<string>('previewAt')?{preview:found.map(row=>row.value),previewTotal:this.count('found:'),previewAt:this.get<string>('previewAt')}:{})};
  }
  async discover(){
    this.authorize();this.set('attempt',new Date().toISOString());const discovery=this.selection.documentDiscovery;
    for(const reference of this.selection.excludedDocuments??[])if(reference.includes('/wiki/')){this.authorize();const raw=larkJson(await this.run({kind:'wiki-node',node:larkToken(reference)})),node=wikiNodeSchema.parse((raw.data??raw).node);await this.fence();if(node.obj_token)this.set(`alias:${larkToken(reference)}`,node.obj_token);}
    for(const action of ['created','edited','opened'] as const)if(discovery?.[action])await this.discoverAction(action,discovery.firstSyncDays);
    for(const ref of this.selection.documents)this.enqueue(ref);
    for(const ref of this.selection.folders??[])await this.folder(ref);
    for(const ref of this.selection.wikiRoots??[])await this.wiki(ref);
    this.set('previewAt',new Date().toISOString());
  }
  private async discoverAction(action:Action,days:number){
    const at=Date.now(),upper=Math.ceil(at/HOUR)*HOUR,completed=Math.floor(at/HOUR)*HOUR,initial=completed-days*DAY;
    let progress=this.get<Progress>(`progress:${action}`)??{through:initial};
    // Revisit the preceding complete hour for delayed provider indexing. Fixed
    // window identities deduplicate that overlap and repeated current-hour polls.
    let from=progress.window?.start??Math.max(initial,progress.through-HOUR);
    while(from<upper){
      this.authorize();let window=progress.window??{start:from,end:Math.min(from+90*DAY,upper),seen:[]};
      progress={...progress,window};this.set(`progress:${action}`,progress);
      // Page tokens are valid only with this persisted absolute predicate.
      const envelope=larkJson(await this.run({kind:'documents-search',action,start:iso(window.start),end:iso(window.end),pageToken:window.pageToken}));
      const data=z.object({results:z.array(z.object({title:z.string().optional(),result_meta:z.object({url:z.string().optional(),token:z.string().optional()}).passthrough().optional()}).passthrough()),has_more:z.boolean(),page_token:z.string().nullable().optional()}).parse(envelope.data??envelope);
      await this.fence();
      for(const row of data.results){const ref=row.result_meta?.url??row.result_meta?.token;if(!ref)throw new ConnectorError('lark_response_invalid',502);let reference:string;try{reference=larkReference(ref);}catch{continue;}this.enqueue(reference,row.title,{action,start:iso(window.start),end:iso(window.end),observedAt:new Date().toISOString()});}
      if(data.has_more){if(!data.page_token||window.seen.includes(data.page_token))throw new ConnectorError('lark_search_pagination_invalid',502);window={...window,pageToken:data.page_token,seen:[...window.seen,data.page_token]};progress={...progress,window};this.set(`progress:${action}`,progress);continue;}
      from=window.end;progress={through:Math.max(progress.through,Math.min(from,completed))};this.set(`progress:${action}`,progress);
    }
  }
  private async folder(reference:string){
    // Breadth-first native listing preserves explicit root membership; no
    // search-term approximation and no whole-account expansion.
    const queue=[larkToken(reference)],visited=new Set<string>();
    for(let index=0;index<queue.length;index++){
      const folder=queue[index];if(visited.has(folder))continue;visited.add(folder);
      let pageToken:string|undefined;const seen=new Set<string>();
      do {this.authorize();const raw=larkJson(await this.run({kind:'folder-list',folder,pageToken}));const data=z.object({files:z.array(z.object({token:z.string(),name:z.string().optional(),type:z.string(),url:z.string().optional(),shortcut_info:z.object({target_token:z.string(),target_type:z.string()}).optional()})),has_more:z.boolean(),next_page_token:z.string().optional()}).parse(raw.data??raw);
        await this.fence();
        for(const item of data.files){const type=item.shortcut_info?.target_type??item.type,token=item.shortcut_info?.target_token??item.token;if(type==='folder')queue.push(token);else if(type==='docx')this.enqueue(item.shortcut_info?token:item.url??token,item.name);}
        if(!data.has_more)break;if(!data.next_page_token||seen.has(data.next_page_token))throw new ConnectorError('lark_search_pagination_invalid',502);seen.add(data.next_page_token);pageToken=data.next_page_token;
      }while(true);
    }
  }
  private async wiki(reference:string){
    this.authorize();const raw=larkJson(await this.run({kind:'wiki-node',node:larkToken(reference)})),root=wikiNodeSchema.parse((raw.data??raw).node);
    await this.fence();
    if(!root.space_id)throw new ConnectorError('lark_response_invalid',502);
    const queue=[root],seenNodes=new Set<string>();
    for(let index=0;index<queue.length;index++){
      const node=queue[index];if(seenNodes.has(node.node_token))continue;seenNodes.add(node.node_token);
      if(node.obj_type==='docx'&&node.obj_token)this.enqueue(node.obj_token,node.title);
      if(node.has_child===false)continue;
      let pageToken:string|undefined;const seen=new Set<string>();
      do {this.authorize();const dataRaw=larkJson(await this.run({kind:'wiki-list',spaceId:root.space_id,parent:node.node_token,pageToken}));const data=z.object({items:z.array(wikiNodeSchema),has_more:z.boolean(),page_token:z.string().optional()}).parse(dataRaw.data??dataRaw);await this.fence();queue.push(...data.items);
        if(!data.has_more)break;if(!data.page_token||seen.has(data.page_token))throw new ConnectorError('lark_search_pagination_invalid',502);seen.add(data.page_token);pageToken=data.page_token;
      }while(true);
    }
  }
  private async activities(pending:Pending,documentId:string,write:(item:SourceItem)=>Promise<boolean>,uri?:string){
    let count=0;
        for(const activity of pending.activities){
          const signals=this.rows<{start:string;end:string}>(`signal:${activity.action}:${larkHash(documentId)}:`);
          // A provider predicate supplies no action identifier. Overlapping
          // positive ranges may describe the same action, so retain the first
          // immutable observation and keep refreshing the body without creating
          // another activity. Adjacent inclusive boundaries are conservative too.
          if(signals.some(row=>activity.action==='created'||Date.parse(activity.start)<=Date.parse(row.value.end)&&Date.parse(activity.end)>=Date.parse(row.value.start)))continue;
          const externalId=`activity:${activity.action}:${larkHash(JSON.stringify([documentId,activity.start,activity.end]))}`;
          // The first observation is immutable. Repeated overlapping searches
          // neither replace its observedAt nor imply another human action.
          const signalKey=`signal:${activity.action}:${larkHash(documentId)}:${larkHash(JSON.stringify([activity.start,activity.end]))}`;
          if(this.ctx.store.db.prepare('SELECT 1 FROM source_versions WHERE source_id=? AND external_id=?').get(this.sourceId,externalId)){this.set(signalKey,{start:activity.start,end:activity.end});continue;}
          const value:NonNullable<SourceDocument['activity']>={version:1,provider:'lark',documentId:documentId,actor:{accountId:this.account},action:activity.action,evidenceBasis:'search-predicate',time:{precision:'range',start:activity.start,end:activity.end},observedAt:activity.observedAt,...(activity.action==='opened'?{limitations:['provider-open-may-include-connector-access' as const]}:{})};
          const text=`Feishu provider search matched this account's ${activity.action} filter for document ${documentId} in [${activity.start}, ${activity.end}]. This is a bounded provider-filter observation, not a complete action history. It does not establish reading duration, reading completion, agreement, content authorship, or the version the person saw.${activity.action==='opened'?' Provider open signals may include connector/API access; human reading is not established.':''}`;
          const item:SourceItem={externalId,revision:larkHash(JSON.stringify(value)),observedAt:activity.observedAt,title:pending.title??documentId,text,kind:'event',layer:'derived',deleted:false,...(uri?{uri}:{}),document:{timeBasis:'unknown',contentRole:'other',activity:value}};
          if(await write(item))count++;this.set(signalKey,{start:activity.start,end:activity.end});
        }
    return count;
  }
  async archive(write:(item:SourceItem,bytes?:Buffer)=>Promise<boolean>,reference?:string){
    const results={activities:0,documentFailures:0};
    const target=reference?larkReference(reference):undefined,queue=this.rows<Pending>('pending:').filter(row=>!target||larkToken(row.value.reference)===larkToken(target));
    if(target&&!queue.length)throw new ConnectorError('lark_document_not_selected',400);
    for(const row of queue){
      try {
        this.authorize();const pending=row.value,known=this.get<string>(`alias:${larkToken(pending.reference)}`);
        if(this.excluded(pending.reference,known)||this.suppressed(pending.reference,known)){this.drop(row.key);continue;}
        let canonical=known??(pending.reference.includes('/docx/')?larkToken(pending.reference):undefined);
        if(!canonical&&pending.reference.includes('/wiki/')){const nodeRaw=larkJson(await this.run({kind:'wiki-node',node:larkToken(pending.reference)})),node=wikiNodeSchema.parse((nodeRaw.data??nodeRaw).node);await this.fence();if(node.obj_type==='docx'&&node.obj_token){canonical=node.obj_token;this.set(`alias:${larkToken(pending.reference)}`,canonical);}}
        let activityPublished=false;
        if(canonical&&this.suppressed(pending.reference,canonical)){this.drop(row.key);this.sweepForgotten();continue;}
        if(canonical&&!this.excluded(pending.reference,canonical)){
          await this.fence();const uri=pending.reference.startsWith('https:')?`${new URL(pending.reference).origin}/docx/${canonical}`:undefined;
          results.activities+=await this.activities(pending,canonical,item=>write(item),uri);activityPublished=true;
        }
        const raw=larkJson(await this.run({kind:'document',document:pending.reference})),doc=docSchema.parse((raw.data??raw).document);
        await this.fence();this.authorize();
        this.set(`alias:${larkToken(pending.reference)}`,doc.document_id);this.set(`alias:${doc.document_id}`,doc.document_id);
        if(this.excluded(pending.reference,doc.document_id)||this.suppressed(pending.reference,doc.document_id)){this.drop(row.key);continue;}
        const prior=this.ctx.sources.getItem(this.sourceId,doc.document_id),uri=prior?prior.uri:(pending.reference.startsWith('https:')?`${new URL(pending.reference).origin}/docx/${doc.document_id}`:undefined);
        await write(documentRevision({externalId:doc.document_id,observedAt:new Date().toISOString(),title:doc.title??prior?.title??pending.title??doc.document_id,text:doc.content.length>100000?'':doc.content,kind:'file',layer:doc.content.length>100000?'original':'snapshot',deleted:false,mimeType:'text/markdown',...(uri?{uri}:{}),document:{timeBasis:'unknown',contentRole:'other',originalMetadata:{provider:'lark',documentId:doc.document_id,revisionId:doc.revision_id,embeddedAssets:'references-only',...(doc.content.length>100000?{bodyHash:larkHash(doc.content)}:{})}}},prior),doc.content.length>100000?Buffer.from(doc.content,'utf8'):undefined);
        if(!activityPublished)results.activities+=await this.activities(pending,doc.document_id,item=>write(item),uri);
        this.drop(row.key);
      }catch(error){
        // Authorization/cancellation fences stop all work. A single inaccessible
        // or malformed document remains retryable while peers continue.
        try{this.authorize();}catch{throw error;}
        if(error instanceof ConnectorError&&['lark_not_connected','lark_account_changed','lark_operation_cancelled','lark_document_scope_changed'].includes(error.code))throw error;
        this.set(row.key,{...row.value,error:error instanceof ConnectorError?error.code:error instanceof z.ZodError?'lark_response_invalid':'lark_operation_failed'});results.documentFailures++;
      }
    }
    return results;
  }
}
