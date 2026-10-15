import {createHash} from 'node:crypto';
import {zipSync,strToU8} from 'fflate';
import type {PluginManifest,PluginReleaseTransport} from '../../src/plugin-release.js';

const hash=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
const components=[{id:'generated.processor',version:'1',surface:'processing',capability:'processor'},{id:'generated.source',version:'1',surface:'ingress',capability:'source'},{id:'generated.memory',version:'1',surface:'data',capability:'repository'},{id:'generated.model',version:'1',surface:'agent',capability:'model'},{id:'generated.card',version:'1',surface:'card',capability:'ui'}] as const;
export const generatedScopedPluginSource=String.raw`
import {readFile,writeFile} from 'node:fs/promises';
export async function createMotePlugin(configuration){
 const read=async()=>{try{return JSON.parse(await readFile('records.json','utf8'));}catch{return [];}};
 const components=COMPONENTS;
 return {components:components.map(descriptor=>({...descriptor,async invoke(input,host){
  if(input.gate)await host.call('gate',[]);
  if(input.emit)await host.call('emit',{label:configuration.label});
  if(input.source)return host.call('receiveSourceItems',[input.source,input.batchId??'generated-batch',input.items]);
  if(input.method)return host.call(input.method,input.args??[]);
  if(input.model)return host.call('model',[]);
  if(input.put){const records=await read();records.push({key:input.put,label:configuration.label,namespace:await host.call('namespace',[])});await writeFile('records.json',JSON.stringify(records));}
  return {label:configuration.label,input,...(input.pid?{pid:process.pid}:{})};
 }})),async read(input){return {namespace:input.namespace,records:(await read()).filter(record=>JSON.stringify(record.namespace)===JSON.stringify(input.namespace)),label:configuration.label};},
 async export(input){return {namespace:input.namespace,records:(await read()).filter(record=>JSON.stringify(record.namespace)===JSON.stringify(input.namespace)),label:configuration.label};},
 async search(input){return {namespace:input.namespace,records:(await read()).filter(record=>JSON.stringify(record.namespace)===JSON.stringify(input.namespace)),label:configuration.label};},async close(){}};
}
`.replace('COMPONENTS',JSON.stringify(components));
export function generatedScopedPluginRelease(version='1',code=generatedScopedPluginSource){
 const archive=zipSync({'plugin.mjs':[strToU8(code),{mtime:new Date('2026-10-15T00:00:00Z')}]}),repository='generated-local/mote-plugins',tag='v'+version;
 const manifest:PluginManifest={schemaVersion:1,id:'generated.multiuser',name:'Generated local trusted plugin',version,runtime:'worker',entry:'plugin.mjs',archive:{asset:'plugin.zip',sha256:hash(archive)},capabilities:['source','processor','repository','retrieval','model','ui'],configuration:[{id:'label',label:'Label',type:'text',required:true},{id:'credential',label:'Credential reference',type:'secret-reference'}],dependencies:[],access:['Generated isolated fixture storage'],components:components.map(v=>({...v}))};
 const base=`https://github.com/${repository}/releases/download/${tag}/`;let failInstall=false,downloads=0;
 const transport:PluginReleaseTransport=async url=>{if(url===`https://api.github.com/repos/${repository}/releases/tags/${tag}`)return {bytes:strToU8(JSON.stringify({tag_name:tag,draft:false,assets:[{name:'mote-plugin.json',browser_download_url:base+'mote-plugin.json'},{name:'plugin.zip',browser_download_url:base+'plugin.zip'}]}))};if(url===`https://api.github.com/repos/${repository}/commits/${tag}`)return {bytes:strToU8(JSON.stringify({sha:version.padStart(40,'0')}))};if(url===base+'mote-plugin.json')return {bytes:strToU8(JSON.stringify(manifest))};if(url===base+'plugin.zip'){downloads++;if(failInstall)throw Error('Generated install interruption');return {bytes:archive};}throw Error('Network forbidden: '+url);};
 return {manifest,transport,repository,tag,fail(){failInstall=true;},downloads:()=>downloads};
}
