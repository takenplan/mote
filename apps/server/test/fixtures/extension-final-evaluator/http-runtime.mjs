import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,appendFile} from 'node:fs/promises';
import {existsSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {join,dirname,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {setTimeout as delay} from 'node:timers/promises';

export const FIXTURES = dirname(fileURLToPath(import.meta.url));
export const ROOT = process.env.R5_OUTPUT_DIR ?? mkdtempSync(join(tmpdir(),'mote-r5-evaluator-'));
export const CANDIDATE = process.env.R5_CANDIDATE ?? resolve(FIXTURES,'../../../../..');
export const requireCandidate = createRequire(join(CANDIDATE,'package.json'));
const {zipSync,strToU8} = requireCandidate('fflate');
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export {assert,delay,randomUUID};
export async function verifyCandidate() {
  const manifest=JSON.parse(await readFile(join(FIXTURES,'frozen-production-sha256.json'),'utf8'));
  const differences=[];
  for(const [path,expected] of Object.entries(manifest.files)){
    let actual=null,error;
    try {actual=sha256(await readFile(join(CANDIDATE,path)));}catch(failure){error=failure.code??failure.message;}
    if(actual!==expected)differences.push({path,expected,actual,...(error?{error}:{})});
  }
  const strict=process.env.R5_REQUIRE_FROZEN_SOURCE==='1';
  if(strict)assert.deepEqual(differences,[],'strict replay requires frozen production bytes');
  return {verified:differences.length===0,strict,candidateCommit:manifest.candidateCommit,files:Object.keys(manifest.files).length,differences};
}

export const redact = value => {
  if(Array.isArray(value)) return value.map(redact);
  if(value&&typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,/^(?:token|password|authorization|csrfToken|csrf|secret|cookie|refreshToken)$/i.test(k)?'[redacted]':redact(v)]));
  return value;
};

export class HttpRuntime {
  constructor(name) {
    this.name=name; this.dir=join(ROOT,'runs',name); this.table={}; this.http=[]; this.processes=[];
    this.credentials={username:'evaluator_a',password:randomBytes(24).toString('base64url')};
    this.env={...process.env,MOTE_CONFIG_FILE:join(this.dir,'mote.json'),R5_RELEASE_TABLE:join(this.dir,'release-table.json'),R5_OUTBOUND_LEDGER:join(this.dir,'outbound.jsonl')};
    this.env.PATH=dirname(process.execPath)+':'+(process.env.PATH??'');
    delete this.env.MOTE_ENV_FILE;
  }
  async initialize() {
    await mkdir(this.dir,{recursive:true});
    await writeFile(this.env.MOTE_CONFIG_FILE,JSON.stringify({version:1,revision:0,server:{host:'127.0.0.1',port:0,profile:'benchmark',runtime:'native'},storage:{dataDir:join(this.dir,'vault')}},null,2));
    await writeFile(this.env.R5_RELEASE_TABLE,'{}');
    const processResult=await this.oneShot(['--import','tsx','apps/server/src/scope/initialize-admin.ts'],JSON.stringify(this.credentials));
    assert.equal(processResult.code,0,'public administrator bootstrap');
    this.bootstrap=JSON.parse(processResult.stdout.trim());
    return this;
  }
  async oneShot(args,stdin='') {
    const child=spawn(process.execPath,args,{cwd:CANDIDATE,env:this.env,stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
    child.stdin.end(stdin);
    const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
    await appendFile(join(this.dir,'process-log.jsonl'),JSON.stringify({args,code,stdout,stderr})+'\n');
    return {code,stdout,stderr};
  }
  async start() {
    assert(!this.child,'server already running');
    const child=spawn(process.execPath,['--import','tsx','--import',join(FIXTURES,'release-preload.mjs'),'apps/server/src/index.ts'],{cwd:CANDIDATE,env:this.env,stdio:['ignore','pipe','pipe']});
    this.child=child;let buffer='',stderr='';
    const started=Date.now();
    const info=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('server startup timed out: '+stderr)),30000);
      child.stdout.on('data',chunk=>{
        buffer+=chunk;
        for(const line of buffer.split('\n')) {try {const parsed=JSON.parse(line);if(parsed.event==='server.listening'){clearTimeout(timer);resolve(parsed);}} catch{}}
      });
      child.stderr.on('data',chunk=>stderr+=chunk);
      child.once('error',error=>{clearTimeout(timer);reject(error);});
      child.once('exit',code=>{clearTimeout(timer);reject(new Error('server exited '+code+': '+stderr));});
    });
    this.url='http://127.0.0.1:'+info.port;
    this.processes.push({pid:child.pid,startedAt:new Date(started).toISOString(),url:this.url});
    child.once('exit',(code,signal)=>{this.processes.at(-1).exit={code,signal};void appendFile(join(this.dir,'server-log.jsonl'),JSON.stringify({pid:child.pid,stdout:buffer,stderr,code,signal})+'\n');});
    const health=await this.request(null,'GET','/api/health');assert.equal(health.status,200);assert.equal(health.body.mode,'multiuser-auth');
    return info;
  }
  async stop(signal='SIGTERM') {
    if(!this.child)return;
    const child=this.child;this.child=null;
    if(child.exitCode===null&&child.signalCode===null){
      const ended=new Promise(resolve=>child.once('exit',(code,sig)=>resolve({code,signal:sig})));
      child.kill(signal);
      const result=await Promise.race([ended,delay(20000,undefined,{ref:false}).then(()=>null)]);
      if(result===null){child.kill('SIGKILL');await ended;throw new Error('server failed to stop within 20 seconds');}
    }
    await this.save();
  }
  async request(token,method,path,body,expected) {
    const headers={'x-mote-protocol-version':'2','x-mote-ingress-version':'3',...(token?{authorization:'Bearer '+token}:{})};
    if(body!==undefined)headers['content-type']='application/json';
    const response=await fetch(this.url+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
    const text=await response.text();let parsed;try{parsed=JSON.parse(text);}catch{parsed=text;}
    const entry={at:new Date().toISOString(),method,path,status:response.status,request:redact(body),body:redact(parsed)};
    this.http.push(entry);
    if(expected!==undefined)assert.equal(response.status,expected,method+' '+path+' '+JSON.stringify(parsed));
    return {status:response.status,body:parsed,headers:response.headers};
  }
  async login(username=this.credentials.username,password=this.credentials.password) {
    const response=await this.request(null,'POST','/api/auth/login',{username,password,mode:'client'},200);assert(response.body.token);return response.body.token;
  }
  async secondUser(admin) {
    const username='evaluator_b',password=randomBytes(24).toString('base64url');
    const result=await this.request(admin,'POST','/api/admin/accounts',{username,password,administrator:false},200);
    return {token:await this.login(username,password),user:result.body};
  }
  async addRelease({repo,tag='v1.0.0',manifest,files}) {
    const zip=zipSync(Object.fromEntries(Object.entries(files).map(([name,value])=>[name,typeof value==='string'?strToU8(value):new Uint8Array(value)])),{level:0});
    const digest=sha256(zip),releaseDir=join(this.dir,'releases',repo.replace('/','--'),tag);await mkdir(releaseDir,{recursive:true});
    const complete={...manifest,archive:{asset:'plugin.zip',sha256:digest}};
    const commit=sha256(JSON.stringify({repo,tag,digest})).slice(0,40);
    const base='https://github.com/'+repo+'/releases/download/'+encodeURIComponent(tag);
    const assets=[{name:'mote-plugin.json',browser_download_url:base+'/mote-plugin.json'},{name:'plugin.zip',browser_download_url:base+'/plugin.zip'}];
    const map=[['https://api.github.com/repos/'+repo+'/releases/tags/'+encodeURIComponent(tag),'release.json',JSON.stringify({tag_name:tag,draft:false,assets})],['https://api.github.com/repos/'+repo+'/commits/'+encodeURIComponent(tag),'commit.json',JSON.stringify({sha:commit})],[base+'/mote-plugin.json','mote-plugin.json',JSON.stringify(complete)],[base+'/plugin.zip','plugin.zip',zip]];
    for(const [url,name,bytes] of map){const path=join(releaseDir,name);await writeFile(path,bytes);this.table[url]={path,type:name.endsWith('.json')?'application/json':'application/octet-stream'};}
    await writeFile(this.env.R5_RELEASE_TABLE,JSON.stringify(this.table,null,2));
    return {repo,tag,commit,digest,manifest:complete,releaseDir};
  }
  async install(token,release) {
    const preview=await this.request(token,'POST','/api/plugins/resolve',{repository:release.repo,tag:release.tag},200);
    const catalog=await this.request(token,'GET','/api/admin/plugins',undefined,200);
    const installation=await this.request(token,'POST','/api/plugins/install',{previewId:preview.body.id,expectedRevision:catalog.body.revision,operationId:randomUUID()},200);
    const deadline=Date.now()+15000;
    while(Date.now()<deadline){const next=await this.request(token,'GET','/api/admin/plugins',undefined,200);const pkg=next.body.packages.find(p=>p.source?.digest===release.digest);if(pkg?.state==='installed')return pkg;if(pkg&&['error','failed'].includes(pkg.state))throw new Error('installation failed: '+JSON.stringify(pkg));await delay(25);}
    throw new Error('installation timeout '+JSON.stringify(installation.body));
  }
  async configure(token,pkg,sourceIds,{id='same-instance',configuration={},capabilities=pkg.declaredCapabilities??pkg.capabilities?.map(c=>c.id)??['source']}={}) {
    const before=await this.request(token,'GET','/api/plugins',undefined,200);
    const response=await this.request(token,'POST','/api/plugin-instances',{expectedRevision:before.body.revision,instance:{id,packageId:pkg.id,name:'Independent R05 '+id,configuration,desired:false,grants:{capabilities,sourceIds,history:true}}},200);
    const check=await this.request(token,'POST','/api/plugin-instances/'+id+'/check',{},200);
    const enabled=await this.action(token,id,'enable');
    return {id,configured:response.body,check:check.body,enabled};
  }
  async action(token,id,action) {
    const before=await this.request(token,'GET','/api/plugins',undefined,200);
    return (await this.request(token,'POST','/api/plugin-instances/'+id+'/'+action,{expectedRevision:before.body.revision},200)).body;
  }
  async snapshot(token,id='same-instance',expected=200) {return this.request(token,'POST','/api/plugin-instances/'+id+'/snapshots',{},expected);}
  async invoke(token,snapshotId,componentId,payload,operationId=randomUUID(),expected=200) {return this.request(token,'POST','/api/plugin-snapshots/'+snapshotId+'/invoke',{componentId,payload,operationId},expected);}
  async task(token,id,{terminal=true,timeoutMs=20000}={}) {
    const deadline=Date.now()+timeoutMs;
    while(Date.now()<deadline){const response=await this.request(token,'GET','/api/tasks/'+id,undefined,200);const state=response.body.state??response.body.task?.state;if(!terminal||['succeeded','failed','cancelled','stale','blocked','unknown'].includes(state))return response.body;await delay(30);}
    throw new Error('task timeout '+id);
  }
  async source(token,id,name=id) {
    await this.request(token,'POST','/api/ingress/devices',{id:'r5-device',name:'Generated R05 device',platform:'import'},200);
    return (await this.request(token,'POST','/api/ingress/sources',{id,name,kind:'custom',deviceId:'r5-device',platform:'import',retention:'archive',enabled:true},200)).body;
  }
  async originals(token,sourceId,limit=7) {
    let after='',all=[],pages=0;
    do {const response=await this.request(token,'GET','/api/ingress/sources/'+sourceId+'/originals?limit='+limit+(after?'&after='+after:''),undefined,200);all.push(...response.body.items);after=response.body.nextCursor;++pages;}while(after);
    return {items:all,pages};
  }
  async material(token,id) {
    let offset=0,text='',pages=[],material;
    do {const response=await this.request(token,'GET','/api/materials/'+id+'/read?offset='+offset+'&length=12000',undefined,200);material=response.body.material;pages.push(response.body);text+=response.body.text;offset=response.body.textRange.nextOffset;}while(offset!==null);
    const members=(await this.request(token,'GET','/api/materials/'+id+'/members?limit=200',undefined,200)).body.items;
    return {material,text,body:JSON.parse(text),pages,members};
  }
  async save() {
    await writeFile(join(this.dir,'http-observations.json'),JSON.stringify(this.http,null,2));
    await writeFile(join(this.dir,'process-observations.json'),JSON.stringify(this.processes,null,2));
  }
}
