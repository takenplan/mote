import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';

export const proofDigest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Independent fixture oracle: callers supply the known dependency graph, rather
 * than deriving it from the admission under test or calling Ask's private code. */
export function expectedIndexProof(db:DatabaseSync,userId:string,authorizationEpoch:number,event:unknown,known:{sourceIds:string[];materials:{id:string;revision:string}[];originalIds:string[]}){
 const sources=[...known.sourceIds].sort().map(id=>{const row=db.prepare('SELECT incarnation FROM ma_sources WHERE user_id=? AND id=?').get(userId,id);assert.ok(row);return {id,incarnation:String(row.incarnation)};});
 const materials=[...known.materials].sort((a,b)=>a.id.localeCompare(b.id)||a.revision.localeCompare(b.revision)).map(pin=>{const row=db.prepare('SELECT incarnation FROM ma_history_materials WHERE user_id=? AND id=?').get(userId,pin.id);assert.ok(row);return {...pin,incarnation:String(row.incarnation)};});
 const originals=[...known.originalIds].sort().map(id=>{assert.equal(db.prepare('SELECT count(*) n FROM mm_evidence WHERE user_id=? AND id=?').get(userId,id)!.n,0,'fixture originals use the raw capture receipt path');const row=db.prepare('SELECT o.incarnation,c.fingerprint,c.json FROM pd_captures c JOIN ma_originals o ON o.user_id=c.user_id AND o.id=c.id WHERE c.user_id=? AND o.user_id=? AND c.id=?').get(userId,userId,id);assert.ok(row);return {id,receipt:proofDigest({...row})};});
 return {format:'mote-ask-index-event-v1',authorizationEpoch,event,sources,materials,originals};
}
