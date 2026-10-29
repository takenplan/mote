import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {buildApp} from '../src/app.js';
import {materialId,type MaterialDraft} from '../src/materials.js';
import {storedCaptureLibraryVersion} from '../src/capture-library-version.js';

async function fixture(t:import('node:test').TestContext){
 const dir=mkdtempSync(join(tmpdir(),'mote-owner-browse-')),token='generated-owner-browse-token-123456789';
 const node=await buildApp({dataDir:dir,token,tokenPath:'fixture',host:'127.0.0.1',port:0,maxStorageBytes:30_000_000,maxExportBytes:1_000_000,retentionDays:0,insightIntervalHours:0,allowedOrigins:[],model:'',modelBaseUrl:'',apiKey:'',allowUnauthenticatedLocal:false,embeddingModel:'',embeddingBaseUrl:'',embeddingApiKey:''},{backgroundWorker:false});
 t.after(async()=>{await node.app.close();rmSync(dir,{recursive:true,force:true});});
 const headers={authorization:'Bearer '+token,'x-mote-ingress-version':'2'};
 const note=async(index:number,at='2026-10-21T01:00:00.000Z')=>{const id=randomUUID(),text='Generated note '+index+' literal searchable body';const response=await node.app.inject({method:'POST',url:'/api/notes',headers,payload:{id,deviceId:'generated-note-device',deviceName:'Generated note device',platform:'import',capturedAt:at,text,metadata:{version:1,observedAt:at,ownerDescription:'PRIVATE DESCRIPTION must never become a browse preview'}}});assert.equal(response.statusCode,201,response.body);return {id,text,at};};
 const read=async(query:Record<string,string>={},status=200,auth=headers)=>{const response=await node.app.inject({url:'/api/library/browse?'+new URLSearchParams(query),headers:auth});assert.equal(response.statusCode,status,response.body);return response.json();};
 node.sources.register({id:'generated-source',name:'Generated source',kind:'custom',deviceId:'generated-material-device',platform:'import'});
 const material=(id:string,original:{id:string;text:string;at:string},extra:Partial<MaterialDraft>={})=>node.materials.publish({id:materialId('generated-source',id),kind:'mote.note',schemaVersion:1,title:'Generated material '+id,origin:{sourceId:'generated-source',externalId:id,firstAt:original.at,lastAt:original.at,deviceId:'generated-material-device'},members:[{id:original.id,kind:'capture',ref:'capture:'+original.id,revision:storedCaptureLibraryVersion(node.store,original.id)}],blocks:[{id:'body',kind:'text',format:'plain',text:original.text,memberIds:[original.id]}],coverage:{state:'complete'},fidelity:{state:'lossless'},retention:{original:'retained',policy:'keep'},...extra});
 return {node,headers,note,read,material};
}

test('real note intake appears immediately among existing materials with one complete chronological cursor',async t=>{
 const f=await fixture(t),originals=[];for(let i=0;i<29;i++)originals.push(await f.note(i,new Date(Date.parse('2026-10-21T01:00:00Z')+Math.floor(i/3)*60000).toISOString()));
 const pinned=f.material('exact',originals[0]),partial=f.material('partial',originals[1],{coverage:{state:'partial'}}),summary=f.material('summary',originals[2],{fidelity:{state:'summary-only'}});
 // Grouping and unpinned projections cannot replace the actual original note.
 const grouped=f.material('group',originals[3],{members:[{id:originals[3].id,kind:'capture',ref:'capture:'+originals[3].id},{id:originals[4].id,kind:'capture',ref:'capture:'+originals[4].id}]}),unpinned=f.material('unpinned',originals[5],{members:[{id:originals[5].id,kind:'capture',ref:'capture:'+originals[5].id}]});
 const seen:any[]=[];let cursor:string|undefined;do{const page=await f.read({limit:'7',...(cursor?{cursor}:{})});assert.ok(page.items.length<=7);seen.push(...page.items);cursor=page.nextCursor??undefined;}while(cursor);
 assert.equal(seen.length,33);assert.equal(new Set(seen.map(item=>item.ref)).size,33);assert.deepEqual(seen.map(item=>[item.contentAt,item.ref]),[...seen].sort((a,b)=>b.contentAt.localeCompare(a.contentAt)||b.ref.localeCompare(a.ref)).map(item=>[item.contentAt,item.ref]));
 assert.equal(seen.some(item=>item.ref==='capture:'+originals[0].id),false);assert.ok(seen.some(item=>item.ref===pinned.ref));for(const value of [partial,summary,grouped,unpinned])assert.ok(seen.some(item=>item.ref===value.ref));for(const i of [1,2,3,4,5])assert.ok(seen.some(item=>item.ref==='capture:'+originals[i].id));
 const original=seen.find(item=>item.ref==='capture:'+originals[28].id);assert.equal(original.entryType,'capture');assert.equal(original.capture.textPreview,originals[28].text);assert.equal(original.revision,storedCaptureLibraryVersion(f.node.store,originals[28].id));assert.doesNotMatch(JSON.stringify(seen),/PRIVATE DESCRIPTION/);
 const detail=await f.node.app.inject({url:'/api/capture-browser/'+originals[28].id,headers:f.headers});assert.equal(detail.statusCode,200);assert.equal(detail.json().ocrText,originals[28].text);
 assert.deepEqual((await f.read({query:'PRIVATE DESCRIPTION'})).items,[]);assert.equal((await f.read({type:'note',limit:'100'})).items.length,33);assert.deepEqual((await f.read({type:'image'})).items,[]);assert.equal((await f.read({origin:'notes',limit:'100'})).items.length,29);assert.ok((await f.read({sourceId:'generated-source',limit:'100'})).items.every((item:any)=>item.entryType==='material'));assert.ok((await f.read({deviceId:'generated-note-device',limit:'100'})).items.every((item:any)=>item.entryType==='capture'));
 // The distinct Material-only route still exposes only its five real materials.
 const catalog=await f.node.app.inject({url:'/api/library/catalog?limit=100',headers:f.headers});assert.equal(catalog.json().items.length,5);assert.ok(catalog.json().items.every((item:any)=>item.ref.startsWith('material:')));
});

test('browse privacy and deletion boundaries invalidate cursors and non-owner credentials stay denied',async t=>{
 const f=await fixture(t),first=await f.note(1),second=await f.note(2),page=await f.read({limit:'1'});assert.ok(page.nextCursor);
 await f.read({limit:'1',type:'note',cursor:page.nextCursor},409);await f.read({limit:'1',cursor:page.nextCursor+'tampered'},400);await f.read({limit:'1',origin:'notes',sourceId:'generated-source'},400);
 const removed=await f.node.app.inject({method:'DELETE',url:'/api/captures/'+first.id,headers:f.headers});assert.equal(removed.statusCode,200);await f.read({limit:'1',cursor:page.nextCursor},409);assert.equal((await f.read({limit:'100'})).items.some((item:any)=>item.ref==='capture:'+first.id),false);assert.equal((await f.node.app.inject({url:'/api/capture-browser/'+first.id,headers:f.headers})).statusCode,404);
 // Actual retention erasure uses the existing store boundary. It cannot be
 // reconstructed from an old browse page, original version, or cursor.
 f.node.store.prune('2026-10-22T00:00:00.000Z');assert.equal((await f.read()).items.length,0);assert.equal((await f.node.app.inject({url:'/api/capture-browser/'+second.id,headers:f.headers})).statusCode,404);
 const note=await f.note(3);const material=f.material('current',note);const before=await f.read({limit:'1'});f.node.materials.retire(material.id,{expectedRevision:material.revision});if(before.nextCursor)await f.read({limit:'1',cursor:before.nextCursor},409);assert.ok((await f.read()).items.some((item:any)=>item.ref==='capture:'+note.id));
 assert.equal((await f.node.app.inject('/api/library/browse')).statusCode,401);
 const invitation=await f.node.app.inject({method:'POST',url:'/api/connections/collector-invitations',headers:f.headers,payload:{serverUrl:'https://generated.invalid',label:'Generated collector'}});const redeemed=await f.node.app.inject({method:'POST',url:'/api/connections/redeem',payload:{code:invitation.json().invitation.code,deviceId:'generated-collector',deviceName:'Generated collector',platform:'android'}});await f.read({},403,{...f.headers,authorization:'Bearer '+redeemed.json().token});
 const readOnly=await f.node.connections.mintMcp({serverUrl:'https://generated.invalid',label:'Generated Agent',access:'read'},{directory:join(f.node.store.directory,'connectors'),mcpEnabled:true});const credential=Object.values(readOnly.config.mcpServers)[0].headers.Authorization;await f.read({},403,{...f.headers,authorization:credential});
});
