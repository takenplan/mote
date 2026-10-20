import type {DatabaseSync} from 'node:sqlite';
import type {ModelPrice,UsageReceipt} from '@mote/shared';
import {usageQuerySchema} from '../usage-query.js';
import {summarizeUsage} from '../usage-summary.js';

/** The account is supplied by Configurations' authenticated context, never a
 * query parameter. Prepared/nonexecuted fragments are not consumption. */
export function scopedUsageSummary(db:DatabaseSync,userId:string,prices:ModelPrice[],query:unknown){
 const {from,to,timeZone,groupBy,page,pageSize,...filters}=usageQuerySchema.parse(query);
 const candidates=db.prepare("SELECT json FROM user_model_usage WHERE user_id=? AND json_extract(json,'$.issuance.issuedAt') IS NOT NULL AND json_extract(json,'$.issuance.executionStarted') IS NOT 0 AND json_extract(json,'$.createdAt')>=? AND json_extract(json,'$.createdAt')<? ORDER BY json_extract(json,'$.createdAt') DESC,id DESC").all(userId,new Date(Date.parse(from)-86400000).toISOString(),new Date(Date.parse(to)+172800000).toISOString()).map(row=>JSON.parse(String(row.json)) as UsageReceipt);
 return summarizeUsage(candidates,prices,from,to,timeZone,filters,groupBy,page,pageSize);
}
