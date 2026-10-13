/** Import exact ready screenshots from five actual generated product builds. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../..'),out=path.join(repo,'.mote/ui-art-direction-review');
const inputs=JSON.parse(fs.readFileSync(path.join(__dirname,'sources.json'),'utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(path.join(out,'assets'),{recursive:true});
const metrics=['Design quality','Originality','Craft','Functionality','首次理解与重要功能完整性','页面职责与任务聚焦','视觉一致性与平台适配','跨端统一美术风格'];
const scenes=[['home','首页'],['content','已有内容'],['note','随手记'],['detail','原文阅读'],['ask','问一问'],['settings','设置'],['connection','连接配置'],['import','导入文件']].map(([id,title])=>({id,title}));
const manifest={generatedOnly:true,artifactType:'five-round-art-direction-review',metrics,scenes,rounds:inputs.rounds,platforms:{web:{title:'Web',sizes:{normal:'1440 px',compact:'390 px'}},mac:{title:'Mac',sizes:{normal:'1140 × 808',compact:'820 × 620'}},android:{title:'Android',sizes:{normal:'411 dp',compact:'320 dp / 130% 字体'}}},assets:[]};
function add(round,platform,scene,variant,language,file,metadata){
 assert(metadata.readiness?.ready&&['content','empty','restriction'].includes(metadata.readiness.state)&&metadata.readiness.page,'Ready target content is required: '+file);
 assert.notEqual(metadata.captureKind,'dialog-fragment');
 const b=fs.readFileSync(file);assert.equal(b.subarray(1,4).toString(),'PNG');assert.equal(hash(b),metadata.sha256,'Original PNG hash');
 const name=[round.id,platform,scene,variant,language].join('-')+'.png';
 assert(!manifest.assets.some(a=>a.src==='assets/'+name),'Duplicate selected label');fs.writeFileSync(path.join(out,'assets',name),b);
 manifest.assets.push({round:round.id,platform,scene,variant,language,src:'assets/'+name,width:b.readUInt32BE(16),height:b.readUInt32BE(20),sha256:hash(b),readiness:metadata.readiness,captureKind:metadata.captureKind||'app-window',sourceCommit:round.sourceCommit,source:path.relative(repo,file),note:metadata.note||''});
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
  for(const c of data.captures.filter(c=>c.reviewSelection!==false&&['normal','compact'].includes(c.variant))){
   const scene=c.scene==='providers'?'connection':c.scene;if(!scenes.some(s=>s.id===scene))continue;
   add(round,'web',scene,c.variant,c.language,path.resolve(repo,round.web.root,c.name+'.png'),c);
  }
 }
 if(round.mac){
  const data=JSON.parse(fs.readFileSync(path.resolve(repo,round.mac.manifest)));assert(data.generatedOnly);
  for(const c of data.scenes){const scene=Object.keys(macScenes).find(key=>macScenes[key]===c.scene);if(!scene)continue;add(round,'mac',scene,c.size,c.locale==='en'?'en':'zh',c.path,c);}
 }
 if(round.android){
  const data=JSON.parse(fs.readFileSync(path.resolve(repo,round.android.manifest)));assert(data.generatedOnly);assert.equal(data.productApkSha256,round.android.apkSha256);
  const dirs={default:['normal','zh'],english:['normal','en'],compact:['compact','zh'],'compact-english':['compact','en']};
  for(const c of data.images){const parts=c.file.split('/'),[variant,language]=dirs[parts[0]]||[];if(!variant)continue;const scene=Object.keys(nativeScenes).find(key=>nativeScenes[key]+'.png'===parts.at(-1));if(!scene)continue;add(round,'android',scene,variant,language,path.resolve(repo,round.android.root,c.file),c);}
 }
 for(const platform of Object.keys(manifest.platforms))for(const s of scenes)for(const variant of ['normal','compact'])for(const language of ['zh','en'])assert(manifest.assets.some(a=>a.round===round.id&&a.platform===platform&&a.scene===s.id&&a.variant===variant&&a.language===language),'Candidate missing actual core scene: '+[round.id,platform,s.id,variant,language].join('/'));
}
for(const f of ['index.html','review.css','review.js','README.md'])fs.copyFileSync(path.join(__dirname,f),path.join(out,f));
for(const [file,target] of [['docs/design/ui-art-direction-five-rounds.md','design.md'],['docs/design/ui-art-direction-evaluation.md','evaluation.md']])fs.copyFileSync(path.join(repo,file),path.join(out,target));
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(path.join(out,'manifest.js'),'window.MOTE_ART_REVIEW='+JSON.stringify(manifest)+';\n');
console.log('Generated '+manifest.assets.length+' original ready images across '+manifest.rounds.length+' rounds: '+out);
