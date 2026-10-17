import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {health} from '../profile-lib.mjs';

test('profile readiness uses public scoped health before account initialization and sends no legacy credential',async t=>{
 const good={ok:true,mode:'multiuser-auth',authentication:'username-password',storageEpoch:5,protocol:{min:2,max:2}};
 let body=good,status=200;
 const server=createServer((req,res)=>{assert.equal(req.url,'/api/health');assert.equal(req.headers.authorization,undefined);res.writeHead(status,{'Content-Type':'application/json'});res.end(typeof body==='string'?body:JSON.stringify(body));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const profile={url:'http://127.0.0.1:'+server.address().port,env:{MOTE_TOKEN:'generated-retired-owner-credential'}};
 assert.equal(await health(profile),true);
 for(const invalid of [{...good,ok:false},{...good,mode:'single-owner'},{...good,authentication:'owner-token'},{...good,storageEpoch:4},{...good,protocol:{min:1,max:1}},'malformed']){body=invalid;assert.equal(await health(profile),false);}
 body=good;status=401;assert.equal(await health(profile),false);status=200;assert.equal(await health(profile),true);
});
