/** Generated-only bridge for the final C original browser journey.
 * Reuses the existing scoped fixture over IPC; no product route/runtime is added.
 * JSON lines on stdin are forwarded to that fixture (e.g. hold/release/models).
 */
import assert from 'node:assert/strict';
import {fork,execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,realpathSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline';

const root=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'../..'));
const args=process.argv.slice(2);
assert.equal(args.length,1,'Pass the exact clean candidate C SHA');
const candidate=args[0];assert.match(candidate,/^[a-f0-9]{40}$/);
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
assert.equal(git('rev-parse','HEAD'),candidate,'The bridge must belong to candidate C');
assert.equal(git('status','--porcelain'),'','Candidate C must be clean');
const fixture=resolve(root,'apps/web/test/fixtures/multiuser-host.ts');
const web=resolve(root,'apps/web/dist/index.html');
assert.ok(existsSync(web),'Build the Web app from C before starting the browser fixture');
assert.equal(realpathSync(fixture),fixture,'Use this candidate fixture, not a peer symlink');
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const emit=value=>process.stdout.write(JSON.stringify(value)+'\n');
const fixtureHostname='mote-e2e6-'+randomUUID().slice(0,8)+'.localhost';
const child=fork(fixture,[],{cwd:root,execPath:process.execPath,execArgv:['--import','tsx'],env:{...process.env,MOTE_WEB_FIXTURE_HOSTNAME:fixtureHostname},stdio:['ignore','pipe','pipe','ipc']});
let closing=false,exitReceived=false,nextId=1;
const timers=new Map();
const input=createInterface({input:process.stdin,crlfDelay:Infinity});
const readyTimer=setTimeout(()=>{emit({event:'error',message:'Existing scoped fixture did not become ready within 30s'});process.exitCode=1;void close();},30000);
child.stdout.on('data',data=>process.stderr.write(data));
child.stderr.on('data',data=>process.stderr.write(data));
child.on('message',message=>{
 if(message.id){clearTimeout(timers.get(message.id));timers.delete(message.id);}
 if(message.error)process.exitCode=1;
 if(message.event==='ready'){clearTimeout(readyTimer);emit({...message,candidate,generatedOnly:true,fixtureHostname,node:process.version,fixtureSha256:sha(fixture),webIndexSha256:sha(web)});}
 else emit(message);
});
child.on('error',error=>{emit({event:'error',message:error.message});process.exitCode=1;void close();});
child.on('exit',(code,signal)=>{
 exitReceived=true;clearTimeout(readyTimer);for(const timer of timers.values())clearTimeout(timer);timers.clear();input.close();
 emit({event:'closed',candidate,code,signal});process.exitCode=process.exitCode|| (signal?1:code??1);
});
function send(command){
 assert.ok(child.connected&&!closing,'Fixture is not accepting commands');
 assert.ok(command&&typeof command==='object'&&!Array.isArray(command));
 assert.equal(typeof command.command,'string');
 const id=nextId++;child.send({...command,id});
 timers.set(id,setTimeout(()=>{emit({id,error:'Existing fixture command exceeded its 20s observation window'});process.exitCode=1;timers.delete(id);},20000));
}
input.on('line',line=>{
 try{const command=JSON.parse(line);if(command.command==='close')void close();else send(command);}
 catch(error){emit({event:'command-error',message:error.message});process.exitCode=1;}
});
async function close(){
 if(closing||exitReceived)return;closing=true;
 if(child.connected)child.send({id:nextId++,command:'close'});
 const timeout=setTimeout(()=>{if(!exitReceived)child.kill('SIGTERM');},20000);timeout.unref();
}
input.on('close',()=>void close());
process.on('SIGINT',()=>void close());process.on('SIGTERM',()=>void close());
