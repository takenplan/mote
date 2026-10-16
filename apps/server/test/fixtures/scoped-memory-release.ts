import {zipSync,strToU8} from 'fflate';
import {generatedScopedPluginRelease} from './scoped-plugin-release.js';
const components=[{id:'generated.memory.repository',version:'4',surface:'data',capability:'repository'},{id:'generated.memory.retrieval',version:'4',surface:'data',capability:'retrieval'}] as const;
/** Actual generated worker installed through M09; its storage/transport is the
 * external provider fixture. Mote Memory, grants and publication remain real. */
export function generatedMemoryRelease(){
 const code=String.raw`
import {readFile,writeFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const exists=path=>access(path).then(()=>true,()=>false);
export async function createMotePlugin(){
 const read=async()=>{try{return JSON.parse(await readFile('memory-records.json','utf8'));}catch{return {records:{},operations:{}};}};
 const save=value=>writeFile('memory-records.json',JSON.stringify(value));
 const tag=input=>digest([input.namespace,input.key]);
 return {components:COMPONENTS.map(c=>({...c,invoke:async()=>{throw Error('Use the host Memory domain');}})),
  async put(input){const state=await read(),record={namespace:input.namespace,key:input.key,memory:input.memory},key=tag(input),prior=state.records[key];if(prior&&digest(prior)!==digest(record))throw Error('Immutable conflict');state.records[key]=record;const receipt={opId:input.opId,namespace:input.namespace,key:input.key,payloadDigest:digest(record),state:'applied',eraseVerified:false,recordedAt:new Date().toISOString()};state.operations[input.opId]=receipt;if(await exists('hold-before-put')){await writeFile('put-started','yes');while(!await exists('release-put'))await new Promise(r=>setTimeout(r,5));}await save(state);if(await exists('hold-put')){await writeFile('put-started','yes');while(!await exists('release-put'))await new Promise(r=>setTimeout(r,5));}return receipt;},
  async read(input){await writeFile('read-observation.json',JSON.stringify(input));if(await exists('hold-read-'+input.key.memoryId)){await writeFile('read-started-'+input.key.memoryId,'yes');while(!await exists('release-read-'+input.key.memoryId))await new Promise(r=>setTimeout(r,5));}if(await exists('fail-read'))throw Error('Generated external read failure');return (await read()).records[tag(input)]?.memory??null;},
  async search(input){await writeFile('search-observation.json',JSON.stringify({keys:input.keys,namespace:input.namespace}));if(await exists('fail-search'))throw Error('Generated external search failure');const records=Object.values((await read()).records).filter(r=>digest(r.namespace)===digest(input.namespace)&&(!input.keys||input.keys.some(key=>digest(key)===digest(r.key))));return records.filter(r=>r.memory.statement.includes(input.query)).map((r,index)=>({...r,score:1-index/100})).slice(0,input.limit??20);},
  async export(input){return Object.values((await read()).records).filter(r=>digest(r.namespace)===digest(input.namespace));},
  async remove(input){const state=await read();delete state.records[tag(input)];await save(state);return {opId:input.opId,namespace:input.namespace,key:input.key,payloadDigest:digest(input),state:'removed',currentRemoved:true,historyRetained:false,eraseVerified:false,recordedAt:new Date().toISOString()};},
  async health(){return {providerId:'generated-scoped-memory',version:'4',ready:true,verified:{persistentCrud:true,scopedRetrieval:true,immutableRecords:true,idempotentReplay:true,history:true,physicalErase:false},problems:[]};},async close(){} };
}
`.replace('COMPONENTS',JSON.stringify(components));
 const release=generatedScopedPluginRelease('4',code);release.manifest.components=components.map(value=>({...value}));release.manifest.capabilities=['repository','retrieval'];return release;
}

export function generatedMem0Release(){
 const release=generatedMemoryRelease(),original=release.transport,upstream=zipSync({'generated-upstream/README.md':strToU8('Generated pinned Mem0 source provenance fixture; never executed')});
 release.repository='mem0ai/mem0';release.tag='ts-v3.3.1';release.manifest.version='3.3.1';
 release.transport=async url=>url.endsWith('/releases/tags/ts-v3.3.1')?{bytes:strToU8(JSON.stringify({tag_name:'ts-v3.3.1',draft:false,assets:[]}))}:url.endsWith('/commits/ts-v3.3.1')?{bytes:strToU8(JSON.stringify({sha:'a'.repeat(40)}))}:url.endsWith('/zipball/'+'a'.repeat(40))?{bytes:upstream}:original(url);
 return release;
}

export function generatedHindsightRelease(){
 const release=generatedMemoryRelease(),original=release.transport,upstream=zipSync({'hindsight_api/server.py':strToU8('# Generated pinned native API provenance fixture; never executed\n')}),repository='vectorize-io/hindsight',tag='v0.10.2',name='hindsight_api_slim-0.10.2-py3-none-any.whl';
 release.repository=repository;release.tag=tag;release.manifest.version='0.10.2';
 release.transport=async url=>url.endsWith('/releases/tags/'+tag)?{bytes:strToU8(JSON.stringify({tag_name:tag,draft:false,assets:[{id:170,name,browser_download_url:'https://github.com/'+repository+'/releases/download/'+tag+'/'+name}]}))}:url.endsWith('/commits/'+tag)?{bytes:strToU8(JSON.stringify({sha:'b'.repeat(40)}))}:url==='https://api.github.com/repos/'+repository+'/releases/assets/170'?{bytes:upstream}:original(url);
 return release;
}
