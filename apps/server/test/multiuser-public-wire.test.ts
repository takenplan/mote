import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {MOTE_PROTOCOL_HEADERS,requireCompatibleProtocol} from '@mote/shared/protocol';
import {buildApp} from '../src/app.js';

test('public wire consumer authenticates real M01 and receives only M03 Ingress3 account receipts',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'m15-public-wire-'));const node=await buildApp({dataDir:directory});
 t.after(async()=>{await node.app.close();rmSync(directory,{recursive:true,force:true});});
 const password='Generated-public-wire-password-01';await node.accounts!.initialize('generated-admin',password);
 const request=(url:string,method:any='GET',payload?:unknown,token?:string,headers={})=>node.app.inject({url,method,...(payload===undefined?{}:{payload}),headers:{...MOTE_PROTOCOL_HEADERS,'x-mote-ingress-version':'3',...(token?{authorization:'Bearer '+token}:{}),...headers}});
 const health=await request('/api/health');assert.deepEqual(requireCompatibleProtocol(health.json().protocol),{min:2,max:2});
 const body={username:'generated-admin',password,mode:'client'};
 assert.equal((await request('/api/auth/login','POST',body,undefined,{'x-mote-protocol-version':'1'})).statusCode,426);
 const login=await request('/api/auth/login','POST',body);assert.equal(login.statusCode,200,login.body);const {token}=login.json();
 const self=await request('/api/connections/self','GET',undefined,token);assert.equal(self.statusCode,200,self.body);const account=self.json().account;
 assert.deepEqual(requireCompatibleProtocol(self.json().protocol),{min:2,max:2});assert.equal(self.json().capabilities.ingressVersion,3);
 const source={id:'same-source',deviceId:'same-device',platform:'android',kind:'custom',name:'Synthetic Android',retention:'snapshot'};
 assert.equal((await request('/api/ingress/sources','POST',source,token,{'x-mote-ingress-version':'2'})).statusCode,426);
 assert.equal((await request('/api/ingress/sources','POST',source,token)).statusCode,200);
 const capture={id:randomUUID(),deviceId:'same-device',deviceName:'Synthetic Android',platform:'android',capturedAt:'2026-01-01T00:00:00Z',durationMs:0,source:'note',ocrText:'Generated note bytes'};
 const result=await request('/api/ingress/sources/same-source/captures','POST',{batchId:'same-batch',items:[capture]},token);assert.equal(result.statusCode,200,result.body);
 const receipt=result.json();assert.equal(receipt.version,3);assert.equal(receipt.deploymentId,account.deploymentId);assert.equal(receipt.userId,account.userId);assert.equal(receipt.sourceId,source.id);assert.equal(receipt.batchId,'same-batch');assert.deepEqual(receipt.captures,[{id:capture.id,duplicate:false}]);
});
