import {ArchivedFileStore} from '../archived-files.js';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import type {ConnectorContext} from './types.js';
import type {GoogleDependencies} from './google.js';
import {GmailAdapter,gmailMessageEvidence} from './gmail-adapter.js';
export {gmailItems,gmailScope} from './gmail-adapter.js';
/** Quarantined single-owner algorithm fixture adapter. Production uses GmailAdapter. */
export class GmailConnector extends GmailAdapter {
 constructor(ctx:ConnectorContext,dependencies:GoogleDependencies={}){
  const archives=new ArchivedFileStore(ctx.store);
  ctx.store.db.exec('CREATE TABLE IF NOT EXISTS gmail_sync_members(source_id TEXT NOT NULL,message_id TEXT NOT NULL,epoch TEXT NOT NULL,PRIMARY KEY(source_id,message_id))');
  super(ctx,{
   parts:(source,id)=>(ctx.store.db.prepare('SELECT external_id FROM source_heads WHERE source_id=? AND substr(external_id,1,?)=? AND deleted=0').all(source,id.length+1,`${id}:`) as {external_id:string}[]).map(r=>r.external_id),
   stale:(source,epoch)=>(ctx.store.db.prepare('SELECT message_id FROM gmail_sync_members WHERE source_id=? AND epoch!=?').all(source,epoch) as {message_id:string}[]).map(r=>r.message_id),
   member:(source,id,epoch)=>{if(epoch)ctx.store.db.prepare('INSERT INTO gmail_sync_members VALUES(?,?,?) ON CONFLICT(source_id,message_id) DO UPDATE SET epoch=excluded.epoch').run(source,id,epoch);else ctx.store.db.prepare('DELETE FROM gmail_sync_members WHERE source_id=? AND message_id=?').run(source,id);},
   publish:async(source,id,message,items,authorize)=>{
    authorize();
    const priorFile=items.map(item=>ctx.sources.getItem(source,item.externalId)?.document?.fileId).find(Boolean);
    const original=message?priorFile&&isDeepStrictEqual(gmailMessageEvidence(JSON.parse(archives.read(priorFile).toString('utf8'))),gmailMessageEvidence(message))?{id:priorFile}:archives.put({name:`gmail-${id}.json`,mimeType:'application/json',bytes:Buffer.from(JSON.stringify(message))}):undefined;
    for(const item of items){if(original)item.document={...item.document,fileId:original.id};const prior=ctx.sources.getItem(source,item.externalId),content=(v:typeof item)=>({title:v.title,text:v.text,layer:v.layer,deleted:v.deleted,document:v.document,uri:v.uri});if(prior)item.revision=isDeepStrictEqual(content(prior),content(item))?prior.revision:createHash('sha256').update(JSON.stringify([item.revision,original?.id,prior.revision])).digest('hex');}
    return ctx.sources.upsertBatch(source,items,authorize,receipt=>{if(original)archives.attach(receipt.id,[original.id]);});
   },
  },dependencies);
 }
}
