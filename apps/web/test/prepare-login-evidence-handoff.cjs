/** Explicit own-worktree preparation, never invoked by npm test or the browser.
 * Normal build:central only; dependencies/native ABI must be prepared separately. */
const {execFileSync,spawnSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {readFileSync,readdirSync,lstatSync,readlinkSync,rmSync,mkdirSync,writeFileSync}=require('node:fs');
const {resolve,join,dirname,relative}=require('node:path');
const assert=require('node:assert/strict');
const roots=['packages/shared/dist','packages/agent/dist','apps/server/dist','apps/web/dist'];
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(repo,...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8'}).trim();
function source(repo){assert.equal(git(repo,'status','--porcelain=v1'),'','Frozen preparation requires a clean worktree');const files=execFileSync('git',['ls-files','-z'],{cwd:repo,encoding:'utf8'}).split('\0').filter(Boolean).sort();return {head:git(repo,'rev-parse','HEAD'),tree:git(repo,'rev-parse','HEAD^{tree}'),sha256:digest(JSON.stringify(files.map(file=>[file,digest(lstatSync(join(repo,file)).isSymbolicLink()?readlinkSync(join(repo,file)):readFileSync(join(repo,file)))])))};}
function artifacts(repo){const result={};function visit(path){const info=lstatSync(path);assert.equal(info.isSymbolicLink(),false,'Build artifacts must belong to this worktree');if(info.isDirectory()){for(const name of readdirSync(path).sort())visit(join(path,name));}else if(info.isFile())result[relative(repo,path)]=digest(readFileSync(path));}for(const root of roots){visit(join(repo,root));assert.ok(Object.keys(result).some(file=>file.startsWith(root+'/')),'Missing normal workspace output');}return result;}
function verify(repo,path,head){const receipt=JSON.parse(readFileSync(path,'utf8'));assert.equal(receipt.version,1);assert.equal(receipt.source.head,head);assert.deepEqual(source(repo),receipt.source,'Executed source must match the clean source used by the completed normal build');assert.deepEqual(artifacts(repo),receipt.artifacts,'Executed artifacts must match the recorded completed build');return {...receipt,receiptSha256:digest(readFileSync(path))};}
if(require.main===module){
 const repo=resolve(__dirname,'../../..'),before=source(repo),path=process.env.MOTE_WEB_HANDOFF_BUILD_RECEIPT??join(repo,'.mote/evidence-handoff-build.json');
 assert.equal(before.head,process.env.MOTE_WEB_FIXTURE_EXPECTED_HEAD,'Explicit frozen head is required for preparation');
 // Remove only this checkout's four ignored generated output directories, so
 // a successful build receipt cannot include leftovers from another candidate.
 for(const root of roots)rmSync(join(repo,root),{recursive:true,force:true});
 const build=spawnSync('npm',['run','build:central'],{cwd:repo,stdio:'inherit'});assert.equal(build.status,0,'Normal Central build must succeed');
 assert.deepEqual(source(repo),before,'Source changed during build');
 const receipt={version:1,source:before,buildCommand:'npm run build:central',buildExit:0,buildRuntime:{version:process.version,abi:process.versions.modules,platform:process.platform,arch:process.arch},artifacts:artifacts(repo)};
 mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(receipt,null,2)+'\n');console.log('Prepared source-bound Central fixture build');
}
module.exports={verify};
