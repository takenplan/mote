import test from 'node:test';
import assert from 'node:assert/strict';
import {createApi,ApiError} from '../src/api.js';
import {clearLogs,readLogs,setLogLevel,log,logCapacity,safeErrorName,routeCategory,installGlobalErrorLogging} from '../src/logger.js';

function quiet(t:test.TestContext) {
 for(const level of ['debug','info','warn','error'] as const)t.mock.method(console,level,()=>{});
 clearLogs();setLogLevel('warn');t.after(()=>{clearLogs();setLogLevel('warn');});
}
test('default warnings, explicit levels, opt-out and bounded retained copies preserve only the fixed schema',t=>{
 quiet(t);
 log('api.request_started','debug');log('auth.session_started','info');assert.equal(readLogs().length,0);
 const unsafe={method:'PRIVATE_METHOD',route:'PRIVATE_FILE',errorName:'PRIVATE_CLASS',code:'private_code',requestId:'PRIVATE_ID',status:Infinity,elapsedMs:-1,message:'PRIVATE_BODY',token:'PRIVATE_TOKEN'};
 log('api.request_failed','warn',unsafe);assert.deepEqual(Object.keys(readLogs()[0]).sort(),['atMs','event','level']);
 setLogLevel('debug');log('api.request_started','debug',{method:'POST',route:'files',elapsedMs:2.2});
 assert.equal(readLogs().at(-1)!.elapsedMs,2);
 setLogLevel('off');log('ui.unhandled_error','error');assert.equal(readLogs().length,2);
 setLogLevel('info');for(let i=0;i<logCapacity+5;i++)log('api.request_completed','info',{elapsedMs:i});
 assert.equal(readLogs().length,logCapacity);assert.equal(readLogs()[0].elapsedMs,5);
 readLogs()[0].route='PRIVATE_MUTATION';assert.equal(readLogs()[0].route,undefined);
 assert.doesNotMatch(JSON.stringify(readLogs()),/PRIVATE/);
});
test('API failure boundaries retain safe status and correlation while paths, bodies, credentials and throwable names stay private',async t=>{
 quiet(t);setLogLevel('debug');
 const api=createApi({token:'PRIVATE_OWNER_TOKEN'}),path='/api/files/PRIVATE_FILENAME?externalId=PRIVATE_EXTERNAL';
 assert.equal(routeCategory(path),'files');assert.equal(routeCategory('/api/PRIVATE_UNKNOWN/path'),'other');
 const requestId='c919bc95-272d-4094-92a1-7f9c0ae944ca';
 const mocked=t.mock.method(globalThis,'fetch',async()=>Response.json({error:'private_error_code',message:'PRIVATE_RESPONSE',requestId},{status:503}));
 await assert.rejects(api.request(path,{method:'POST',body:'PRIVATE_NOTE'}),ApiError);
 assert.deepEqual(readLogs().at(-1),{atMs:readLogs().at(-1)!.atMs,level:'warn',event:'api.request_rejected',route:'files',method:'POST',status:503,requestId,elapsedMs:readLogs().at(-1)!.elapsedMs});
 mocked.mock.restore();
 const network=Object.assign(new TypeError('PRIVATE_URL_AND_TOKEN'),{name:'PRIVATE_ERROR_NAME'});
 const failed=t.mock.method(globalThis,'fetch',async()=>{throw network;});
 await assert.rejects(api.request(path),e=>e===network);assert.equal(readLogs().at(-1)!.errorName,'OtherError');failed.mock.restore();
 t.mock.method(globalThis,'fetch',async()=>new Response('PRIVATE_INVALID_JSON'));
 await assert.rejects(api.request(path),ApiError);assert.equal(readLogs().at(-1)!.event,'api.response_invalid');
 assert.doesNotMatch(JSON.stringify(readLogs()),/PRIVATE|private_error_code/);
});
test('global browser errors never stringify rejected values or read error messages and can be detached',t=>{
 quiet(t);const target=new EventTarget(),dispose=installGlobalErrorLogging(target);
 const rejection=new Event('unhandledrejection');Object.defineProperty(rejection,'reason',{value:{name:'PRIVATE_CLASS',toString(){throw Error('Must never stringify');},get message(){throw Error('Must never read');}}});
 target.dispatchEvent(rejection);
 const error=new Event('error');Object.defineProperty(error,'error',{value:new RangeError('PRIVATE_BODY')});target.dispatchEvent(error);
 assert.deepEqual(readLogs().map(row=>row.errorName),['OtherError','RangeError']);
 assert.equal(safeErrorName({get name(){throw Error('PRIVATE_GETTER');}}),'OtherError');
 assert.equal(safeErrorName('PRIVATE_REJECTION'),undefined);
 dispose();target.dispatchEvent(error);assert.equal(readLogs().length,2);assert.doesNotMatch(JSON.stringify(readLogs()),/PRIVATE/);
});
