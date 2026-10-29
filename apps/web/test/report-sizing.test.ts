import test from 'node:test';
import assert from 'node:assert/strict';
import {REPORT_SIZE_MESSAGE,acceptedReportHeight} from '../src/report-sizing';
import {reportDocument} from '../src/report-document';

test('the report remains scriptless by default; resizing allows only one host nonce before untrusted markup',()=>{
 const html='<script>window.generatedAttack=true</script><p>Generated report</p>',plain=reportDocument(html);
 assert.match(plain,/script-src 'none';/);assert.doesNotMatch(plain,/<script nonce=/);
 const token='a'.repeat(32),sized=reportDocument(html,[],'light',{token,parentOrigin:'http://127.0.0.1:54321'});
 assert.ok(sized.indexOf('Content-Security-Policy')<sized.indexOf('window.generatedAttack'));
 assert.match(sized,/script-src 'nonce-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; script-src-attr 'none';/);
 assert.equal((sized.match(/<script nonce=/g)??[]).length,1,'A nonce is never added to model-supplied script elements');
 assert.doesNotMatch(sized,/unsafe-eval|strict-dynamic|script-src 'unsafe-inline'/);assert.match(sized,/connect-src 'none'/);
 assert.throws(()=>reportDocument('',[],'light',{token:'untrusted',parentOrigin:'http://127.0.0.1:54321'}));
 assert.throws(()=>reportDocument('',[],'light',{token,parentOrigin:'javascript:alert(1)'}));
});

test('only the exact current frame and document may supply a bounded numeric height',()=>{
 const source={} as Window,other={} as Window,token='b'.repeat(32);
 const message=(height:unknown,nextSource:Window=source,nextToken=token)=>({source:nextSource,data:{type:REPORT_SIZE_MESSAGE,token:nextToken,height}} as MessageEvent);
 assert.equal(acceptedReportHeight(message(172.2),source,token),173);assert.equal(acceptedReportHeight(message(999999),source,token),16000);
 for(const height of ['200',true,null,NaN,Infinity,-1,0])assert.equal(acceptedReportHeight(message(height),source,token),undefined);
 assert.equal(acceptedReportHeight(message(200,other),source,token),undefined);assert.equal(acceptedReportHeight(message(200,source,'old-document'),source,token),undefined);
 assert.equal(acceptedReportHeight(message(200),null,token),undefined);
});
