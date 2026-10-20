import {makeRelease} from '/app/plugins/extension-benchmark/final-pack/release.mjs';
import {appendFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

const release=await makeRelease(),directory=join(process.env.REPRO_RUN,'generated-release');mkdirSync(directory,{recursive:true});
const manifest=[];
for(const [url,bytes]of release.responses){
 const name=url.endsWith('plugin.zip')?'plugin.zip':url.endsWith('mote-plugin.json')?'mote-plugin.json':url.includes('/commits/')?'commit.json':'release.json';
 writeFileSync(join(directory,name),bytes,{mode:0o600});manifest.push({url,name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
writeFileSync(join(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
globalThis.fetch=async input=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url,bytes=release.responses.get(url);
 appendFileSync(join(process.env.REPRO_RUN,'outbound-metadata.jsonl'),JSON.stringify({at:new Date().toISOString(),url,allowed:!!bytes})+'\n',{mode:0o600});
 if(!bytes)throw new Error('UNEXPECTED_NETWORK_TARGET');
 return new Response(bytes,{status:200,headers:{'content-type':url.endsWith('.zip')?'application/zip':'application/json'}});
};
