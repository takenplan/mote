import sharp from 'sharp';
import {z} from 'zod';
import {FILE_PART_BYTES} from '@mote/shared';
import {registerUserRoute,type ScopedRuntime} from './http.js';
import {PrivateData,PRIVATE_DATA_DOMAIN} from './private-data.js';
import {type IngressHost} from './ingress.js';
import {missing} from './private-data-sql.js';

/** Browser reads retain the existing M02 record and M03 original authorities.
 * A private archive session is required; a device upload capability is not a
 * browser credential. No process-wide image cache can bypass retirement. */
export function registerCaptureBrowserReads(runtime:ScopedRuntime,ingress:IngressHost){
 const id=(value:unknown)=>z.object({id:z.string().uuid()}).parse(value).id;
 registerUserRoute(runtime,{scope:'user',method:'GET',url:'/api/capture-browser/:id',service:PRIVATE_DATA_DOMAIN,handle:({services,request})=>services.get<PrivateData>(PRIVATE_DATA_DOMAIN).captureBrowser().record(id(request.params),request.query)});
 registerUserRoute(runtime,{scope:'user',method:'GET',url:'/api/capture-browser/:id/image',service:PRIVATE_DATA_DOMAIN,handle:async({context,services,request,reply})=>{
  const {thumbnail,...scope}=z.object({thumbnail:z.enum(['1','true']).optional()}).passthrough().parse(request.query),data=services.get<PrivateData>(PRIVATE_DATA_DOMAIN),captureId=id(request.params),record=data.captureBrowser().record(captureId,scope);
  if(!record.blobHash)throw missing();const source=ingress.forUser(context),original=source.originalForCapture(captureId);
  if(original.hash!==record.blobHash||!['image/jpeg','image/png','image/webp'].includes(original.mime))throw missing();
  const chunks:Buffer[]=[];for(let offset=0;offset<original.bytes;offset+=FILE_PART_BYTES)chunks.push(source.readOriginal(original.ref,{offset,length:Math.min(FILE_PART_BYTES,original.bytes-offset)}).bytes);
  let bytes=Buffer.concat(chunks),mime=original.mime;
  if(thumbnail){bytes=await sharp(bytes,{limitInputPixels:24_000_000}).resize({width:480,height:480,fit:'inside',withoutEnlargement:true}).jpeg({quality:72}).toBuffer();mime='image/jpeg';}
  // The expensive image await must finish before the original context is
  // checked again, and before any response headers or payload are published.
  data.captureBrowser().record(captureId,scope);const current=source.originalForCapture(captureId);source.readOriginal(current.ref,{length:0});runtime.authority.assert(context);
  reply.type(mime).header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff');return bytes;
 }});
}
