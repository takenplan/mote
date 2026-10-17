import {gunzipSync} from 'node:zlib';
import {z} from 'zod';
import {captureSchema} from '@mote/shared';
import {CAPTURE_BATCH_MAX_BYTES,CAPTURE_BATCH_MAX_RECORDS} from '../capture-limits.js';
import {PrivateDataError} from './private-data-sql.js';

/** Preserve the collector's gzip JSONL transport; decode into the unchanged Ingress3 transaction. */
export function decodeIngressBundle(body:Buffer,batch:unknown){
 const batchId=z.string().min(1).max(256).parse(batch);
 let text:string;
 try{text=new TextDecoder('utf-8',{fatal:true}).decode(gunzipSync(body,{maxOutputLength:CAPTURE_BATCH_MAX_BYTES}));}
 catch{throw new PrivateDataError('invalid_data');}
 const lines=(text.endsWith('\n')?text.slice(0,-1):text).split('\n');
 if(lines.length<1||lines.length>CAPTURE_BATCH_MAX_RECORDS||lines.some(line=>!line))throw new PrivateDataError('invalid_data');
 try{return {batchId,items:lines.map(line=>captureSchema.parse(JSON.parse(line)))};}
 catch{throw new PrivateDataError('invalid_data');}
}
