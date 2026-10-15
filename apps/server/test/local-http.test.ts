import {ProviderFailure} from '@mote/shared';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {requestLocalJson} from '../src/local-http.js';

test('direct local health requests remain bounded, abortable and reject redirects before following them',async t=>{
  let redirects=0;
  const server=createServer((req,res)=>{
    req.resume();
    if(req.url==='/redirect'){res.writeHead(302,{Location:'/destination'});res.end();return;}
    if(req.url==='/destination'){redirects++;res.end('{}');return;}
    if(req.url==='/large'){res.end(JSON.stringify({generated:'x'.repeat(5000)}));return;}
    if(req.url==='/held')return;
    if(req.url==='/missing-offline'){res.end('{}');return;}
    res.end(JSON.stringify({execution:'local'}));
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});
  const endpoint=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  assert.deepEqual(await requestLocalJson(endpoint+'/health',{signal:AbortSignal.timeout(1000),limit:4096}),{execution:'local'});
  await assert.rejects(requestLocalJson(endpoint+'/large',{signal:AbortSignal.timeout(1000),limit:4096}),/exceeds limit/);
  await assert.rejects(requestLocalJson(endpoint+'/redirect',{signal:AbortSignal.timeout(1000),limit:4096}));assert.equal(redirects,0);
  await assert.rejects(requestLocalJson(endpoint+'/held',{signal:AbortSignal.timeout(30),limit:4096}),{name:'AbortError'});
  await assert.rejects(requestLocalJson(endpoint+'/missing-offline',{signal:AbortSignal.timeout(1000),requireOfflineExecution:true}),/did not confirm offline execution/);
  assert.throws(()=>requestLocalJson('https://worker.fixture.invalid/health',{signal:AbortSignal.timeout(1000)}),/loopback service/);
});

test('only explicit local not-started receipts release an unavailable-provider guard',async t=>{
 const server=createServer((req,res)=>{req.resume();res.writeHead(503,req.url==='/known'?{'X-Mote-Execution':'local','X-Mote-Execution-Started':'false'}:req.url==='/untrusted'?{'X-Mote-Execution-Started':'false'}:{});res.end('{}');});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise<void>(r=>server.close(()=>r())));
 const url='http://127.0.0.1:'+(server.address() as {port:number}).port;
 for(const [path,offline,known] of [['/known',true,true],['/known',false,true],['/untrusted',true,false],['/ambiguous',true,false]] as const)await assert.rejects(requestLocalJson(url+path,{signal:AbortSignal.timeout(1000),requireOfflineExecution:offline}),(error:any)=>error instanceof ProviderFailure&&error.details.code==='provider_unavailable'&&(error.details.executionStarted===false)===known);
});

test('an early worker busy response stops original streaming and retains its typed receipt',async t=>{
 let yielded=0,closed=false;
 const server=createServer((_req,res)=>{res.writeHead(429,{'X-Mote-Execution':'local','X-Mote-Execution-Started':'false','Retry-After':'5'});res.end('{}');});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));});
 const body=(async function*(){try{for(let i=0;i<100;i++){yielded++;yield Buffer.alloc(64*1024);await new Promise(r=>setTimeout(r,2));}}finally{closed=true;}})();
 await assert.rejects(requestLocalJson('http://127.0.0.1:'+(server.address() as {port:number}).port+'/ocr',{method:'POST',headers:{'Content-Length':String(100*64*1024)},body,signal:AbortSignal.timeout(2000)}),e=>e instanceof ProviderFailure&&e.details.code==='rate_limited'&&e.details.executionStarted===false&&e.details.retryAfterMs===5000);
 for(let i=0;i<20&&!closed;i++)await new Promise(r=>setTimeout(r,5));
 assert.equal(closed,true);assert.ok(yielded<100,'A rejected request must not continue consuming the original');
});
