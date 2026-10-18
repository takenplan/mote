import {randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import type {TokenUsage,UsageReceipt,ModelPrice,UsageAttribution} from '@mote/shared';
import {estimateCost,priceSchema} from '../usage-metrics.js';
import {ConfigServiceError} from '../config-service.js';
import {validScopeId} from './baseline.js';

const count=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const modelTokensSchema=z.object({measurement:z.literal('thread_cumulative').optional(),complete:z.boolean().optional(),requests:count,reportedRequests:count,inputTokens:count,outputTokens:count,totalTokens:count,cacheReadTokens:count.optional(),cacheWriteTokens:count.optional(),reasoningTokens:count.optional()}).strict().refine(value=>value.reportedRequests<=value.requests&&value.totalTokens===value.inputTokens+value.outputTokens&&(value.cacheReadTokens??0)+(value.cacheWriteTokens??0)<=value.inputTokens&&(value.reasoningTokens??0)<=value.outputTokens,'Invalid model usage');
const identity=z.string().refine(validScopeId);
const label=z.union([identity,z.literal('__unknown__')]);
const attributionSchema=z.object({jobId:identity.optional(),requestId:identity.optional(),agentId:label.optional(),moduleId:label.optional(),skillId:identity.nullable().optional()}).strict();
const receiptAttributionSchema=attributionSchema.extend({operationId:identity,agentId:label,moduleId:label,skillId:identity.nullable()});
export type ModelUsageStart={id?:string;attribution?:Partial<Omit<UsageAttribution,'operationId'>>};
export type ModelUsageMeter={readonly id:string;issued():void;update(tokens:TokenUsage):void;finish(status:'completed'|'failed',facts?:{executionStarted:false}):UsageReceipt;interrupt():UsageReceipt|undefined};
export const modelUsageReceiptSchema=z.object({id:z.string().uuid(),provider:z.string().max(128),model:z.string().max(512),operation:z.string().refine(validScopeId),attribution:receiptAttributionSchema,createdAt:z.string().datetime(),durationMs:count,status:z.enum(['running','completed','failed']),tokens:modelTokensSchema.optional(),estimatedCost:z.number().finite().nonnegative().nullable(),currency:z.enum(['USD','CNY']),price:priceSchema.optional(),issuance:z.object({leaseId:z.string().uuid(),state:z.enum(['prepared','issued','settled']),issuedAt:z.string().datetime().optional(),executionStarted:z.literal(false).optional()}).strict()}).strict();
/** A portable snapshot carries observations, never an active accounting owner. */
export function portableUsageReceipt(receipt:UsageReceipt):UsageReceipt{
 const copy=structuredClone(receipt);if(copy.status==='running'){copy.status='failed';copy.issuance!.state='settled';if(copy.tokens?.measurement==='thread_cumulative')copy.tokens={...copy.tokens,complete:false};copy.estimatedCost=null;}return copy;
}
type Binding={userId:string;leaseId:string;provider:string;model:string;operation:string;operationId:string;price?:ModelPrice};
const liveOwners=new Set<string>();
const processAlive=(pid:number)=>{try{process.kill(pid,0);return true;}catch(error){return (error as NodeJS.ErrnoException).code!=='ESRCH';}};

/** Safe numeric accounting only. Receipts cannot authorize model access. */
export class ModelUsageLedger {
 private readonly owner=randomUUID();
 private closed=false;
 constructor(private readonly db:DatabaseSync,private readonly now=Date.now){
  db.exec('CREATE TABLE IF NOT EXISTS user_model_usage_owners(user_id TEXT NOT NULL,id TEXT NOT NULL,owner_id TEXT NOT NULL,process_id INTEGER NOT NULL,PRIMARY KEY(user_id,id),FOREIGN KEY(user_id,id) REFERENCES user_model_usage(user_id,id) ON DELETE CASCADE)');
  liveOwners.add(this.owner);
  this.interrupt(row=>Number(row.process_id)===process.pid?!liveOwners.has(String(row.owner_id)):!processAlive(Number(row.process_id)));
 }
 private interrupt(select:(row:Record<string,unknown>)=>boolean){
  for(const row of this.db.prepare("SELECT u.user_id,u.id,u.json,o.owner_id,o.process_id FROM user_model_usage u JOIN user_model_usage_owners o ON u.user_id=o.user_id AND u.id=o.id WHERE json_extract(u.json,'$.status')='running'").all()){
   if(!select(row))continue;
   const receipt=modelUsageReceiptSchema.parse(JSON.parse(String(row.json)));
   receipt.status='failed';receipt.issuance.state='settled';
   if(receipt.tokens?.measurement==='thread_cumulative')receipt.tokens={...receipt.tokens,complete:false};
   receipt.estimatedCost=null;
   this.db.prepare('UPDATE user_model_usage SET json=? WHERE user_id=? AND id=?').run(JSON.stringify(receipt),row.user_id,row.id);
  }
 }
 close(){if(this.closed)return;this.closed=true;this.interrupt(row=>row.owner_id===this.owner);liveOwners.delete(this.owner);}
 private transaction<T>(work:()=>T):T{const own=!this.db.isTransaction;if(own)this.db.exec('BEGIN IMMEDIATE');try{const value=work();if(own)this.db.exec('COMMIT');return value;}catch(error){if(own&&this.db.isTransaction)this.db.exec('ROLLBACK');throw error;}}
 start(binding:Binding,assert:()=>void,options:ModelUsageStart={}):ModelUsageMeter{
  if(this.closed)throw new ConfigServiceError('config_unavailable');assert();const id=z.string().uuid().parse(options.id??randomUUID()),extra=attributionSchema.parse(options.attribution??{}),attribution=receiptAttributionSchema.parse({agentId:'__unknown__',moduleId:'__unknown__',skillId:null,...extra,operationId:binding.operationId}),createdAt=new Date(this.now()).toISOString();
  const receipt:UsageReceipt={id,provider:binding.provider,model:binding.model,operation:binding.operation,attribution,createdAt,durationMs:0,status:'running',estimatedCost:null,currency:binding.price?.currency??'USD',...(binding.price?{price:structuredClone(binding.price)}:{}),issuance:{leaseId:binding.leaseId,state:'prepared'}};
  this.transaction(()=>{assert();const prior=this.db.prepare('SELECT json FROM user_model_usage WHERE user_id=? AND id=?').get(binding.userId,id);if(prior){const old=modelUsageReceiptSchema.parse(JSON.parse(String(prior.json)));if(old.issuance.leaseId!==binding.leaseId||JSON.stringify(old.attribution)!==JSON.stringify(attribution))throw new ConfigServiceError('config_conflict');}else{this.db.prepare('INSERT INTO user_model_usage VALUES(?,?,?)').run(binding.userId,id,JSON.stringify(receipt));this.db.prepare('INSERT INTO user_model_usage_owners VALUES(?,?,?,?)').run(binding.userId,id,this.owner,process.pid);}});
  const change=<T>(work:(receipt:z.infer<typeof modelUsageReceiptSchema>)=>T):T=>{if(this.closed)throw new ConfigServiceError('config_unavailable');return this.transaction(()=>{assert();const row=this.db.prepare('SELECT json FROM user_model_usage WHERE user_id=? AND id=?').get(binding.userId,id);if(!row)throw new ConfigServiceError('config_unavailable');const current=modelUsageReceiptSchema.parse(JSON.parse(String(row.json)));if(current.issuance.leaseId!==binding.leaseId)throw new ConfigServiceError('config_conflict');const result=work(current);this.db.prepare('UPDATE user_model_usage SET json=? WHERE user_id=? AND id=?').run(JSON.stringify(current),binding.userId,id);return result;});};
  // An already-issued host capability may retire only its own existing numeric
  // observation after authority is lost. It cannot revive deleted rows, accept
  // late samples, dispatch a request or regain the former business grant.
  const interrupt=()=>{if(this.closed||!this.db.isOpen)return;return this.transaction(()=>{const row=this.db.prepare('SELECT u.json FROM user_model_usage u JOIN user_model_usage_owners o ON u.user_id=o.user_id AND u.id=o.id WHERE u.user_id=? AND u.id=? AND o.owner_id=?').get(binding.userId,id,this.owner);if(!row)return;const current=modelUsageReceiptSchema.parse(JSON.parse(String(row.json)));if(current.issuance.leaseId!==binding.leaseId)return;if(current.status==='running'){current.status='failed';current.issuance.state='settled';if(current.tokens?.measurement==='thread_cumulative')current.tokens={...current.tokens,complete:false};current.estimatedCost=null;this.db.prepare('UPDATE user_model_usage SET json=? WHERE user_id=? AND id=?').run(JSON.stringify(current),binding.userId,id);}return structuredClone(current);});};
  return Object.freeze({id,interrupt,issued:()=>change(current=>{if(current.status!=='running')throw new ConfigServiceError('config_conflict');if(!current.issuance.issuedAt){current.issuance.issuedAt=new Date(this.now()).toISOString();current.issuance.state='issued';}}),update:(tokens:TokenUsage)=>change(current=>{const sample=modelTokensSchema.parse(tokens);if(current.status!=='running'||!current.issuance.issuedAt)throw new ConfigServiceError('config_conflict');current.tokens=structuredClone(sample);current.durationMs=Math.max(0,this.now()-Date.parse(current.issuance.issuedAt));current.estimatedCost=estimateCost(sample,current.price);}),finish:(status:'completed'|'failed',facts?:{executionStarted:false})=>change(current=>{if(current.status!=='running')return structuredClone(current);if(facts){z.object({executionStarted:z.literal(false)}).strict().parse(facts);if(!current.tokens||current.tokens.totalTokens===0&&current.tokens.requests<=1)current.issuance.executionStarted=false;}current.status=status;current.issuance.state='settled';current.durationMs=current.issuance.issuedAt&&current.issuance.executionStarted!==false?Math.max(0,this.now()-Date.parse(current.issuance.issuedAt)):0;return structuredClone(current);})});
 }
}
