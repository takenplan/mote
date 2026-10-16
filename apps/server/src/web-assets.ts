import type {FastifyInstance} from 'fastify';
import staticFiles from '@fastify/static';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {repositoryRoot} from './config.js';

/** Public application assets contain no account data. Private APIs keep their scoped resolver. */
export async function registerWebAssets(app:FastifyInstance,root=join(repositoryRoot,'apps/web/dist')){
 if(!existsSync(root))return;
 const serverVersion=(JSON.parse(readFileSync(join(repositoryRoot,'apps/server/package.json'),'utf8')) as {version:string}).version;
 let webVersion:string|undefined;try{webVersion=JSON.parse(readFileSync(join(root,'build-info.json'),'utf8')).version;}catch{}
 app.addHook('onRequest',async(request,reply)=>{
  if(!request.url.startsWith('/api/')&&webVersion!==serverVersion)return reply.code(503).type('text/plain').send('Web/server build mismatch. Run npm run build -w @mote/web and restart the server.');
 });
 await app.register(staticFiles,{root,prefix:'/',wildcard:false});
 app.addHook('onSend',async(request,reply,payload)=>{
  if(!request.url.startsWith('/api/')){
   reply.header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self' https: http://localhost:* http://127.0.0.1:*; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
   if(String(reply.getHeader('Content-Type')??'').startsWith('text/html'))reply.header('Cache-Control','no-store');
  }
  return payload;
 });
}
