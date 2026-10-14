/** Import exact ready screenshots from five actual generated product builds. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const repo=path.resolve(__dirname,'../../..'),out=path.join(repo,'.mote/ui-art-direction-review');
const inputs=JSON.parse(fs.readFileSync(path.join(__dirname,'sources.json'),'utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(path.join(out,'assets'),{recursive:true});
const metrics=['Design quality','Originality','Craft','Functionality','首次理解与重要功能完整性','页面职责与任务聚焦','视觉一致性与平台适配','跨端统一美术风格'];
const scenes=[['home','首页'],['content','已有内容'],['note','随手记'],['detail','原文阅读'],['ask','问一问'],['settings','设置'],['connection','连接配置'],['import','导入文件']].map(([id,title])=>({id,title}));
const manifest={generatedOnly:true,artifactType:'five-round-art-direction-review',metrics,scenes,rounds:inputs.rounds,platforms:{web:{title:'Web',sizes:{normal:'1440 px',compact:'390 px'}},mac:{title:'Mac',sizes:{normal:'1140 × 808',compact:'820 × 588'}},android:{title:'Android',sizes:{normal:'411 dp',compact:'320 dp / 130% 字体'}}},assets:[]};
function add(round,platform,scene,variant,language,file,metadata){
 assert(metadata.readiness?.ready&&['content','empty','restriction'].includes(metadata.readiness.state)&&metadata.readiness.page,'Ready target content is required: '+file);
 assert.notEqual(metadata.captureKind,'dialog-fragment');
 const b=fs.readFileSync(file);assert.equal(b.subarray(1,4).toString(),'PNG');assert.equal(hash(b),metadata.sha256,'Original PNG hash');
 const name=[round.id,platform,scene,variant,language].join('-')+'.png';
 assert(!manifest.assets.some(a=>a.src==='assets/'+name),'Duplicate selected label');fs.writeFileSync(path.join(out,'assets',name),b);
 manifest.assets.push({round:round.id,platform,scene,variant,language,src:'assets/'+name,width:b.readUInt32BE(16),height:b.readUInt32BE(20),sha256:hash(b),readiness:metadata.readiness,captureKind:metadata.captureKind||'app-window',sourceCommit:round[platform]?.sourceCommit||round.sourceCommit,candidateCommit:round.sourceCommit,source:path.relative(repo,file),note:metadata.note||''});
}
function verifyProducer(round,platform,data){
 const producer=round[platform].sourceCommit||round.sourceCommit;assert.equal(data.sourceCommit,producer,platform+' actual producer identity');
 if(producer!==round.sourceCommit){
  const result=spawnSync('git',['diff','--name-only',producer,round.sourceCommit],{cwd:repo,encoding:'utf8'});assert.equal(result.status,0);
  const changed=result.stdout.trim().split('\n').filter(Boolean),otherApps=['web','desktop','android'].filter(p=>p!==({mac:'desktop'}[platform]||platform));
  const fixtureOnly=['scripts/test-ui-iterations.cjs'];
  assert(changed.every(f=>f.startsWith('docs/')||fixtureOnly.includes(f)||otherApps.some(p=>f.startsWith('apps/'+p+'/'))),'Unchanged platform and all common build inputs are required');
  round[platform].equivalence={verified:true,producerCommit:producer,candidateCommit:round.sourceCommit,changedPaths:changed,nonProductFixturePaths:changed.filter(f=>fixtureOnly.includes(f)),boundary:'Same-round repair only: platform source and all common production build inputs unchanged. Original producer manifest and PNG identities are retained; fixture orchestration is separately identified.'};
 }
}
const nativeScenes={home:'home',content:'content-populated',note:'note',detail:'home-note-original',ask:'ask',settings:'settings',connection:'connection',import:'import-local-task'};
const macScenes={home:'home',content:'content',note:'note-composer',detail:'reader',ask:'ask-disconnected',settings:'settings',connection:'connection',import:'import'};
for(const round of inputs.rounds){
 assert(round.id&&round.sourceCommit,'Every candidate is bound to its actual source commit');
 if(round.id==='baseline'){
  const root=path.resolve(repo,round.root),old=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
  for(const platform of Object.keys(manifest.platforms))for(const scene of scenes)for(const variant of ['normal','compact'])for(const language of ['zh','en']){
   const originalScene=platform==='android'&&scene.id==='content'?'populated-content':platform==='web'&&scene.id==='connection'?'providers':scene.id;
   const a=old.assets.find(a=>a.platform===platform&&a.revision==='candidate'&&a.scene===originalScene&&a.variant===variant&&a.language===language);
   if(a)add(round,platform,scene.id,variant,language,path.join(root,a.src),a);
  }continue;
 }
 if(round.web){
  const data=JSON.parse(fs.readFileSync(path.resolve(repo,round.web.manifest)));assert(data.passed&&data.generatedOnly);
  verifyProducer(round,'web',data);
  for(const c of data.coreCaptures||data.captures.filter(c=>c.reviewSelection!==false&&['normal','compact'].includes(c.variant))){
   const scene=c.scene==='providers'?'connection':c.scene;if(!scenes.some(s=>s.id===scene))continue;
   add(round,'web',scene,c.variant,c.language,path.resolve(repo,round.web.root,c.name+'.png'),c);
  }
 }
 if(round.mac){
  const data=JSON.parse(fs.readFileSync(path.resolve(repo,round.mac.manifest)));assert(data.generatedOnly&&data.passed);
  verifyProducer(round,'mac',data);
  for(const c of data.coreCaptures||data.captures){const scene=Object.keys(macScenes).find(key=>macScenes[key]===c.scene);if(!scene)continue;add(round,'mac',scene,c.variant,c.language==='en'?'en':'zh',path.resolve(repo,round.mac.root,c.file),c);}
 }
 if(round.android){
  const data=JSON.parse(fs.readFileSync(path.resolve(repo,round.android.manifest)));assert(data.generatedOnly);assert.equal(data.productApkSha256,round.android.apkSha256);
  verifyProducer(round,'android',data);
  assert.equal(data.matrix.length,4);assert(data.matrix.every(c=>c.passed===3&&c.skipped===0),'Four actual Android conditions');
  const dirs={default:['normal','zh'],english:['normal','en'],compact:['compact','zh'],'compact-english':['compact','en']};
  for(const c of data.images){const parts=c.path.split('/'),[variant,language]=dirs[parts[0]]||[];if(!variant)continue;const scene=Object.keys(nativeScenes).find(key=>nativeScenes[key]+'.png'===parts.at(-1));if(!scene)continue;add(round,'android',scene,variant,language,path.resolve(repo,round.android.root,c.path),c);}
 }
 for(const platform of Object.keys(manifest.platforms))for(const s of scenes)for(const variant of ['normal','compact'])for(const language of ['zh','en'])assert(manifest.assets.some(a=>a.round===round.id&&a.platform===platform&&a.scene===s.id&&a.variant===variant&&a.language===language),'Candidate missing actual core scene: '+[round.id,platform,s.id,variant,language].join('/'));
}
for(const f of ['index.html','review.css','review.js','README.md'])fs.copyFileSync(path.join(__dirname,f),path.join(out,f));
function portable(text){return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g,(all,label,target)=>{
 if(/^(https?:|#)/.test(target))return all;
 const mapped={'ui-focus-and-consistency-2026-10-13.md':'criteria.md','ui-art-direction-five-rounds.md':'design.md','ui-art-direction-evaluation.md':'evaluation.md'}[target];
 return mapped?'['+label+']('+mapped+')':label+'（仓库参考：`'+target+'`）';
});}
for(const [file,target] of [['docs/design/ui-art-direction-five-rounds.md','design.md'],['docs/design/ui-art-direction-evaluation.md','evaluation.md']])fs.writeFileSync(path.join(out,target),portable(fs.readFileSync(path.join(repo,file),'utf8')));
const original=fs.readFileSync(path.join(repo,'docs/design/ui-iteration-evaluator-2026-10-13.md'),'utf8').split('## Review method')[0];
const additions=fs.readFileSync(path.join(repo,'docs/design/ui-focus-and-consistency-2026-10-13.md'),'utf8').split('## 用户旅程与范围')[0];
fs.writeFileSync(path.join(out,'criteria.md'),portable('# 原七项量表（历史合同）\n\n以下保留原有量表；五轮共同风格合同见 [design.md](ui-art-direction-five-rounds.md)，新评分见 [evaluation.md](ui-art-direction-evaluation.md)。历史接受或旧目标不表示用户接受当前候选。\n\n'+original+'\n'+additions));
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(path.join(out,'manifest.js'),'window.MOTE_ART_REVIEW='+JSON.stringify(manifest)+';\n');
console.log('Generated '+manifest.assets.length+' original ready images across '+manifest.rounds.length+' rounds: '+out);
