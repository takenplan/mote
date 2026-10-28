import {createServer} from 'node:http';
import type {AddressInfo} from 'node:net';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {ContextToolError} from './tool-errors.js';
import type {BridgeToolHandler} from './bridge-contracts.js';

/** Loopback HTTP adapter; it cannot grant tools or register evidence. */
export async function startBridgeTransport(handle:BridgeToolHandler) {
  const token=randomBytes(32).toString('hex');
  const server=createServer(async(req,res)=>{
    const given=Buffer.from(req.headers.authorization??'');
    const expected=Buffer.from(`Bearer ${token}`);
    res.setHeader('Content-Type','application/json');
    if(given.length!==expected.length||!timingSafeEqual(given,expected)){
      res.writeHead(401).end('{"error":"Unauthorized"}');
      return;
    }
    if(req.method!=='POST'){
      res.writeHead(405).end('{"error":"Method not allowed"}');
      return;
    }
    await handle({
      tool:req.url?.slice(1)??'',
      async readArguments(){
        let raw='';
        for await(const part of req){
          raw+=part.toString();
          if(Buffer.byteLength(raw)>65_536)
            throw new ContextToolError('invalid_tool_arguments','Request too large','correct_arguments');
        }
        const args=raw?JSON.parse(raw):{};
        if(!args||Array.isArray(args)||typeof args!=='object')
          throw new ContextToolError('invalid_tool_arguments','Expected object arguments','correct_arguments');
        return args;
      },
    },res);
  });
  server.requestTimeout=30_000;
  await new Promise<void>((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',()=>{
      server.off('error',reject);
      resolve();
    });
  });
  return {
    url:`http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    token,
    async close(){
      server.closeAllConnections();
      await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
    },
  };
}
