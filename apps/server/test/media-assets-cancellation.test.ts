import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {MEDIA_CATALOG,MediaAssets} from '../src/media-assets.js';

test('model download cancel retains only a partial cache; retry resumes verified bytes and publishes once',async t=>{
 const root=await mkdtemp(join(tmpdir(),'mote-model-cancel-')),original=MEDIA_CATALOG.dialogue,data=Buffer.alloc(256*1024,42);
 const files=['model.bin','config.json','tokenizer.json','vocabulary.txt','segmentation.onnx','speaker.onnx'];
 MEDIA_CATALOG.dialogue={version:'generated-cancel-fixture',files:files.map(name=>({name,size:data.length,sha256:createHash('sha256').update(data).digest('hex'),official:'https://fixture.invalid/'+name}))};
 const offsets:number[]=[];let slow=true;
 const server=createServer((req,res)=>{const offset=Number(req.headers.range?.match(/bytes=(\d+)-/)?.[1]??0);offsets.push(offset);res.writeHead(offset?206:200,{'content-length':data.length-offset,...(offset?{'content-range':`bytes ${offset}-${data.length-1}/${data.length}`}:{})});if(slow){res.write(data.subarray(offset,offset+1024));}else res.end(data.subarray(offset));});
 server.listen(0,'127.0.0.1');await once(server,'listening');const port=(server.address() as {port:number}).port,fetchOriginal=fetch;
 t.mock.method(globalThis,'fetch',(url:Parameters<typeof fetch>[0],init?:RequestInit)=>fetchOriginal(`http://127.0.0.1:${port}${new URL(String(url)).pathname}`,init));
 const assets=new MediaAssets(root);t.after(async()=>{await assets.close();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));MEDIA_CATALOG.dialogue=original;await rm(root,{recursive:true,force:true});});
 const controller=new AbortController(),pending=assets.installAsync('dialogue','official',controller.signal);void pending.catch(()=>{});
 for(let index=0;assets.status('dialogue').bytes===0;index++){assert.ok(index<100);await new Promise(resolve=>setTimeout(resolve,10));}
 assert.throws(()=>assets.install('dialogue'),/already running/);controller.abort();await assert.rejects(pending);
 assert.equal(assets.status('dialogue').state,'cancelled');assert.equal(assets.ready('dialogue'),false);assert.equal((await readFile(join(root,'dialogue.downloads/model.bin.part'))).length,1024);
 slow=false;await assets.installAsync('dialogue','official');assert.equal(offsets[1],1024);assert.equal(assets.ready('dialogue'),true);assert.equal(assets.status('dialogue').state,'ready');
 assert.deepEqual(await readFile(join(root,'dialogue/model.bin')),data);const requests=offsets.length;await assets.installAsync('dialogue');assert.equal(offsets.length,requests);
});
