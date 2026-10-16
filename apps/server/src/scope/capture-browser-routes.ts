import sharp from 'sharp';
import {z} from 'zod';
import {FILE_PART_BYTES} from '@mote/shared';
import {registerUserRoute,type ScopedRuntime} from './http.js';
import {PrivateData,PRIVATE_DATA_DOMAIN} from './private-data.js';
import {type IngressHost} from './ingress.js';
import type {ProcessingHost} from './processing.js';
import {missing,PrivateDataError} from './private-data-sql.js';
import {ScopeError} from './baseline.js';

/** Browser reads retain the existing M02 record and M03 original authorities.
 * A private archive session is required; a device upload capability is not a
 * browser credential. No process-wide image cache can bypass retirement. */
export function registerCaptureBrowserReads(runtime:ScopedRuntime,ingress:IngressHost,processing?:ProcessingHost){
 const id=(value:unknown)=>z.object({id:z.string().uuid()}).parse(value).id;
 const browser=(services:ReturnType<ScopedRuntime['services']['forUser']>)=>services.get<PrivateData>(PRIVATE_DATA_DOMAIN).captureBrowser(Boolean(processing));
 for(const [path,read]of [['','previews'],['/albums','albums'],['/album-images','images'],['/sessions','sessions']] as const)registerUserRoute(runtime,{scope:'user',method:'GET',url:'/api/capture-browser'+path,service:PRIVATE_DATA_DOMAIN,handle:({services,request})=>{const data=browser(services);return read==='previews'?data.previews(request.query):read==='sessions'?data.sessions(request.query):data.gallery(request.query,read==='albums');}});
 const updates=z.object({deviceId:z.string().min(1).max(128),cursor:z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),limit:z.coerce.number().int().min(1).max(100).default(100)}).strict();
 registerUserRoute(runtime,{scope:'user',method:'GET',url:'/api/capture-browser/updates',service:PRIVATE_DATA_DOMAIN,handle:({services,request})=>{const q=updates.parse(request.query);return browser(services).updates(q.deviceId,q.cursor,q.limit);}});
 registerUserRoute(runtime,{scope:'user',method:'GET',url:'/api/ingress/devices/:id/updates',service:'ingress',handle:({context,services,request})=>{
  if(request.headers['x-mote-ingress-version']!=='3')throw new ScopeError('incompatible_protocol',426);
  const deviceId=z.object({id:z.string().min(1).max(128)}).parse(request.params).id,q=updates.omit({deviceId:true}).parse(request.query),bound=runtime.accounts?.credentialInfo(context,runtime.authority).deviceId;
  if(bound&&bound!==deviceId)throw new ScopeError('invalid_identity',403);return browser(services).updates(deviceId,q.cursor,q.limit);
 }});
 processing?.onMaterialPublished((run,material)=>browser(runtime.services.forUser(run.context)).published(material.id));
 registerUserRoute(runtime,{scope:'user',method:'GET',url:'/api/capture-browser/:id',service:PRIVATE_DATA_DOMAIN,handle:({services,request})=>browser(services).record(id(request.params),request.query)});
 registerUserRoute(runtime,{scope:'user',method:'GET',url:'/api/capture-browser/:id/image',service:PRIVATE_DATA_DOMAIN,handle:async({context,services,request,reply})=>{
  const {thumbnail,...scope}=z.object({thumbnail:z.enum(['1','true']).optional()}).passthrough().parse(request.query),data=browser(services),captureId=id(request.params),record=data.record(captureId,scope);
  if(!record.blobHash)throw missing();const source=ingress.forUser(context),original=source.originalForCapture(captureId);
  if(original.hash!==record.blobHash||!['image/jpeg','image/png','image/webp'].includes(original.mime))throw missing();
  const chunks:Buffer[]=[];for(let offset=0;offset<original.bytes;offset+=FILE_PART_BYTES)chunks.push(source.readOriginal(original.ref,{offset,length:Math.min(FILE_PART_BYTES,original.bytes-offset)}).bytes);
  let bytes=Buffer.concat(chunks),mime=original.mime;
  if(thumbnail){bytes=await sharp(bytes,{limitInputPixels:24_000_000}).resize({width:480,height:480,fit:'inside',withoutEnlargement:true}).jpeg({quality:72}).toBuffer();mime='image/jpeg';}
  // The expensive image await must finish before the original context is
  // checked again, and before any response headers or payload are published.
  const currentRecord=data.record(captureId,scope),current=source.originalForCapture(captureId);
  if(current.ref!==original.ref||current.hash!==original.hash||currentRecord.blobHash!==original.hash)throw new PrivateDataError('conflict',409);
  // A metadata-only read permits expired snapshots. One byte reuses M03's
  // actual availability/pin check before publishing any previously read bytes.
  source.readOriginal(current.ref,{length:Math.min(1,current.bytes)});runtime.authority.assert(context);
  reply.type(mime).header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff');return bytes;
 }});
}
