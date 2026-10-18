/** Generated-only instance authorizations. No vendor CLI, account or model calls. */
import type {TestContext} from 'node:test';
import {connectorAuthorizationFixture} from '../apps/server/test/fixtures/scoped-connector-auth.js';
const provider=process.argv[2];if(provider!=='feishu-recordings'&&provider!=='dingtalk-recordings')throw Error('Generated provider required');
const cleanup:(()=>unknown)[]=[];
const fixture=await connectorAuthorizationFixture({after:(callback:()=>unknown)=>{cleanup.push(callback);}} as unknown as TestContext,provider);
process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>{for(const action of String(chunk).trim().split('\n')){const value=fixture.authorizations.at(-1);if(action==='finish')value?.finish();else if(action==='expire')value?.expire();}});
await fixture.f.host.app.listen({host:'127.0.0.1',port:0});
console.log(JSON.stringify({generatedOnly:true,provider,server:fixture.f.host.app.server.address(),username:'generated-a',password:'Generated-M13-archive-only-01',modelCalls:0,vendorCalls:0}));
process.on('SIGTERM',()=>{void(async()=>{for(const close of cleanup)await close();process.exit(0);})();});
