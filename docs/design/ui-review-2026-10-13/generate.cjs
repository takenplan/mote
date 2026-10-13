/** Copy allowlisted generated PNG evidence byte-for-byte into the offline review. */
const {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync,readdirSync,unlinkSync,realpathSync}=require('node:fs');
const {resolve,join,relative}=require('node:path');
const {createHash}=require('node:crypto');
const assert=require('node:assert/strict');
const folder=__dirname,repo=resolve(folder,'../../..'),output=join(repo,'.mote','ui-review-2026-10-13');
const sources=JSON.parse(readFileSync(join(folder,'review-sources.json'),'utf8'));
assert.equal(sources.generatedOnly,true);
const args=process.argv.slice(2),refreshPlatforms=new Set();let frozenFolder;
for(let index=0;index<args.length;index++){
 const argument=args[index];
 if(argument==='--frozen'){assert.ok(args[index+1],'--frozen requires an artifact directory');assert.ok(!frozenFolder,'Pass --frozen only once');frozenFolder=resolve(args[++index]);}
 else if(argument==='--refresh-platform'){const platform=args[++index];assert.ok(['web','mac','android'].includes(platform),'Unknown refresh platform');refreshPlatforms.add(platform);}
 else throw Error('Unknown argument: '+argument);
}
assert.ok(frozenFolder||refreshPlatforms.size===0,'--refresh-platform requires --frozen');
assert.ok(frozenFolder||!sources.baseline.originManifestSha256,'Feedback baseline requires --frozen with preserved original evidence; legacy fixture directories cannot reconstruct its provenance');
let frozenManifest,frozenManifestHash;const frozenAssets=[];
if(frozenFolder){
 const bytes=readFileSync(join(frozenFolder,'manifest.json'));frozenManifest=JSON.parse(bytes);
 assert.equal(frozenManifest.generatedOnly,true);assert.equal(frozenManifest.artifactType,'offline-screenshot-review');
 assert.deepEqual(frozenManifest.source.baseline,sources.baseline,'Frozen baseline sources and scores must remain unchanged');
 assert.ok(frozenManifest.assets.length>0,'Frozen artifact must contain actual evidence');
 for(const platform of ['web','mac','android'])if(!refreshPlatforms.has(platform)){
  const previous=frozenManifest.source.candidate,current=sources.candidate;
  for(const key of ['scores','platformLabels'])assert.deepEqual(previous[key]?.[platform],current[key]?.[platform],'Unrefreshed '+platform+' '+key+' must remain unchanged');
  for(const key of platform==='web'?['webRoot','webSceneManifest','webBuildManifest']:platform==='mac'?['macRoot','macSceneManifest']:['androidRoot','androidApkSha256','androidSceneManifest','androidVariantDirectories'])assert.deepEqual(previous[key],current[key],'Unrefreshed '+platform+' '+key+' must remain unchanged');
 }
 const seen=new Set(),root=realpathSync(frozenFolder);
 for(const asset of frozenManifest.assets){
  assert.equal(asset.generatedOnly,true);assert.equal(asset.evidence,'actual-fixture-screenshot');
  assert.ok(['web','mac','android'].includes(asset.platform));assert.ok(['baseline','candidate'].includes(asset.revision));
  assert.ok(frozenManifest.scenes.some(scene=>scene.id===asset.scene));assert.ok(frozenManifest.platforms[asset.platform].variants.includes(asset.variant));assert.ok(['zh','en'].includes(asset.language));
  assert.equal(asset.src,'assets/'+[asset.platform,asset.revision,asset.scene,asset.variant,asset.language].join('-')+'.png','Frozen scene labels must match the original asset name');
  assert.ok(/^assets\/[a-z0-9-]+\.png$/.test(asset.src),'Frozen asset must be an allowlisted PNG');assert.ok(!seen.has(asset.src),'Duplicate frozen asset');seen.add(asset.src);
  const assetPath=realpathSync(join(frozenFolder,asset.src));assert.ok(assetPath.startsWith(root+'/'),'Frozen PNG stays inside the artifact');
  const png=readFileSync(assetPath);assert.equal(createHash('sha256').update(png).digest('hex'),asset.sha256,'Frozen PNG hash: '+asset.src);
  assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),asset.width);assert.equal(png.readUInt32BE(20),asset.height);
  if(asset.revision==='candidate'&&refreshPlatforms.has(asset.platform))continue;
  frozenAssets.push({asset,png});
 }
 frozenManifestHash=createHash('sha256').update(bytes).digest('hex');
}
for(const platform of refreshPlatforms){
 const root=sources.candidate[platform+'Root'];assert.ok(root&&existsSync(resolve(repo,root)),'Fresh '+platform+' screenshot directory is required');
 if(platform==='mac'&&sources.candidate.macSceneManifest)assert.ok(existsSync(resolve(repo,sources.candidate.macSceneManifest)),'Fresh Mac scene manifest is required');
}
let androidHashes;const freshEvidence=new Map();
if((!frozenManifest||refreshPlatforms.has('android'))&&sources.candidate.androidSceneManifest){
 const evidence=JSON.parse(readFileSync(resolve(repo,sources.candidate.androidSceneManifest),'utf8'));assert.equal(evidence.generatedOnly,true);
 assert.equal(evidence.productApkSha256,sources.candidate.androidApkSha256,'Selected Android scenes belong to the declared product APK');
 const root=resolve(repo,sources.candidate.androidRoot);androidHashes=new Map();
 for(const record of evidence.images){
  const path=resolve(root,record.file);assert.ok(path.startsWith(root+'/'),'Android evidence stays inside its selected root');
  assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),record.sha256,'Selected Android PNG hash: '+record.file);androidHashes.set(path,record.sha256);
  const metadata=record.metadata||record.capture||((existsSync(path.replace(/\.png$/,'.json')))?JSON.parse(readFileSync(path.replace(/\.png$/,'.json'),'utf8')):{});
  freshEvidence.set(path,{...record,...metadata,readiness:record.readiness||metadata.readiness});
 }
}
const assetFolder=join(output,'assets');mkdirSync(assetFolder,{recursive:true});
const scenes=[
 ['home','首页','说明用途，保存方式与回看入口是否形成清楚的关系。'],
 ['populated','已有内容首页','内容存在之后，记录的索引、来源和后续用途能否一起读懂。'],
 ['add','四种添加方式','四个平等动作可发现，编号不是必须依次执行的步骤。'],
 ['populated-content','已有内容列表','通过实际生成笔记与文件观察内容、来源和状态层级。'],
 ['empty','首次空库','没有资料时，从哪个动作开始，保存之后去哪里。'],
 ['signedout','未登录','没有登录时是否仍能理解产品与下一步。'],
 ['settings-signedout','设置 · 未登录','身份验证属于当前设置任务，不引导开始记录。'],
 ['login','登录与验证','从当前任务进入身份验证，并保留返回上下文。'],
 ['content','内容 / 资料库','已保存内容的阅读入口与本机、中央边界。'],
 ['detail','原文 / 笔记详情','打开真实生成正文，保留返回与原始证据入口。'],
 ['note','随手记','本机离线保存与中央发送的差别。'],
 ['import','导入文件','一次导入与持续同步是否可区分。'],
 ['ask','问一问','未连接或未配置模型时的真实限制与下一步。'],
 ['guide','全部功能 / 功能目录','重要功能能找到，原生仅列出已有支持范围。'],
 ['memory','记忆','可更正的事实与偏好，不能以已接收代替已生成。'],
 ['insights','洞察','基于证据的回顾，缺模型时保持明确限制。'],
 ['activity','后台工作','传输、处理、索引的状态不能相互冒充。'],
 ['settings','设置','能力设置与本机权限继续采用已有流程。'],
 ['models','模型与服务设置','只处理模型连接、选择与验证，不虚构一个新记录或提问任务。'],
 ['privacy','隐私与保留设置','配置保护和保留范围，保留当前设置任务。'],
 ['storage','存储与恢复设置','存储、备份和恢复属于维护职责。'],
 ['providers','模型连接设置','配置与验证提供商连接，不混入创建任务。'],
 ['modules','能力模块设置','配置已有能力及其处理范围。'],
 ['storage-failure','存储读取失败','显式展示维护读取限制，不冒充加载后的正常页面。'],
 ['connection','连接设置','配置节点和设备，保持设置草稿与返回。'],
 ['sync-status','同步状态','本机发送与中央接收、处理分开说明。'],
 ['collection-status','首页 · 采集状态','实际采集控制归入首页来源区，操作范围清楚。'],
 ['record-list','原文关闭后的记录页','关闭对话框回实际来源与日期记录，再通过原生返回回首页。'],
 ['record-empty','指定日期 · 无笔记','没有笔记时说明日期与添加动作，不要求采集授权。'],
 ['sources','来源','持续来源的范围和状态。'],
 ['screen','屏幕范围','先选范围再授权；这份评审不启动采集。']
].map(([id,title,purpose])=>({id,title,purpose}));
const manifest={generatedOnly:true,artifactType:'offline-screenshot-review',
 boundary:'截图来自已说明的生成 fixture；HTML 交互仅切换静态场景，不保存、上传、提问、授权或调用后端。',
 metrics:sources.evaluation?.metrics||['Design quality','Originality','Craft','Functionality','首次理解与重要功能完整性'],
 metricDescriptions:sources.evaluation?.descriptions,
 invalidHistoricalEvidence:sources.invalidHistoricalEvidence||[],
 baselineTargets:[7,7,7,8,8],currentNativeAcceptance:{designQuality:8,originalityStrictlyAbove:7,craft:8.5,functionality:8.5,clarityAndCompleteness:8.5},source:sources,scenes,
 platforms:{
  web:{title:'Web',role:'中央档案：汇集记录、阅读原文、找答案，再核对证据。',variants:['normal','tablet','compact','minimum','zoom200'],languages:['zh','en'],
   walkthrough:['home','content','detail','ask','guide','import','settings'],
   decisions:['设置围绕配置、验证与维护；完整功能目录与普通设置分别说明。','四条最近记录在窄屏也保持完整；后台错误不藏进折叠内容。','当前截图必须有目标页面的内容就绪证明，旧加载壳证据已排除。']},
  mac:{title:'Mac',role:'本机优先：文件、屏幕和想法先保存，连接中央并整理后再搜索与提问。',variants:['normal','compact'],languages:['zh','en'],
   walkthrough:['home','note','content','detail','ask','guide','import','settings'],
   decisions:['四个平等保存动作沿用原有导航，观察新索引是否更像个人档案。','回看内容、核对证据与中央能力应相互连贯。','本机保存不要求中央连接；已接收不等于可搜索或已生成记忆。']},
  android:{title:'Android',role:'随身保存：保留四个平等动作，离线内容与中央能力分别说明。',variants:['normal','compact'],languages:['zh','en'],
   walkthrough:['home','note','content','detail','ask','guide','import','settings'],
   decisions:['常规与窄屏 / 大字体一起判断层级；四个保存动作保持平等，说明和入口应同时清楚。','原生目录只表达本客户端已支持的中央功能。','系统权限、采集开关与真实连接状态沿用已有政策。']}
 },assets:[]};
const variants={normal:'常规',tablet:'820 px',compact:'窄屏 / 大字体',minimum:'320 px'};
manifest.variantLabels=variants;
manifest.platforms.web.variantLabels={normal:'1440 px',tablet:'820 px',compact:'390 px',minimum:'320 px',zoom200:'1440 px 窗口 · 200% 缩放'};
manifest.platforms.mac.variantLabels={normal:'1140 × 808',compact:'820 × 620'};
manifest.platforms.android.variantLabels={normal:'常规',compact:'320 dp · 130% 字体'};
const webFiles={content:'library',detail:'material-detail',note:'quick-note',import:'import-existing-files',ask:'ask',guide:'all-features-and-settings',memory:'memory',insights:'insights',activity:'activity',settings:'settings',sources:'add-source'};
const macFiles={home:'first-run-ui-fixture',content:'capture-records-ui-fixture',note:'notes-ui-fixture',import:'import-confirmation-ui-fixture',settings:'settings-ui-fixture',sources:'source-ui-fixture',screen:'capture-settings-ui-fixture',ask:'ask-ui-fixture',guide:'feature-guide-ui-fixture',detail:'note-detail-ui-fixture'};
const androidFiles={home:'home',content:'content',note:'note',import:'import-local-task',ask:'ask',guide:'feature-guide',detail:'note-detail',screen:'screen-scope',settings:'settings',connection:'connection',add:'add',sources:'sources','sync-status':'home-sync-details','collection-status':'home-collection','record-list':'note-return-list','record-empty':'note-empty-list'};
if(frozenManifest){
 manifest.frozenEvidence={inputManifestSha256:frozenManifestHash,refreshedPlatforms:[...refreshPlatforms].sort(),boundary:'Frozen assets retain their original source, revision, verification status and SHA-256. Refreshing a platform replaces all of its candidate assets, never baseline evidence.'};
 for(const platform of ['web','mac','android'])if(!refreshPlatforms.has(platform)&&frozenManifest.candidateBuilds?.[platform])manifest.candidateBuilds={...manifest.candidateBuilds,[platform]:frozenManifest.candidateBuilds[platform]};
 for(const {asset,png} of frozenAssets){writeFileSync(join(output,asset.src),png);manifest.assets.push(asset);}
}
const refresh=platform=>!frozenManifest||refreshPlatforms.has(platform);
function add(platform,revision,scene,variant,language,path,verified,note=''){
 if(!existsSync(path))return;
 const metadata=freshEvidence.get(resolve(path))||{};
 if(revision==='candidate'&&sources.candidate.requireReadyEvidence){
  assert.equal(metadata.readiness?.ready,true,'Current screenshot needs content readiness: '+path);
  assert.ok(metadata.readiness.page&&['content','empty','restriction'].includes(metadata.readiness.state),'Current screenshot needs a completed target state: '+path);
 }
 const bytes=readFileSync(path);assert.equal(bytes.subarray(1,4).toString(),'PNG','Only PNG evidence is allowed');
 if(platform==='android'&&revision==='candidate'&&androidHashes)assert.equal(createHash('sha256').update(bytes).digest('hex'),androidHashes.get(resolve(path)),'Android PNG must be selected by its generated evidence manifest');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
 const name=[platform,revision,scene,variant,language].join('-')+'.png';copyFileSync(path,join(assetFolder,name));
 const record={platform,revision,scene,variant,language,src:'assets/'+name,width,height,
  generatedOnly:true,evidence:'actual-fixture-screenshot',verified,note,
  source: path.startsWith(repo)?relative(repo,path):path,
  sha256:createHash('sha256').update(bytes).digest('hex'),
  ...(metadata.readiness?{readiness:metadata.readiness}:{}),
  ...(metadata.captureKind?{captureKind:metadata.captureKind}:{}),
  ...(metadata.baseWindow?{baseWindow:metadata.baseWindow}:{}),
  ...(metadata.overlayWindows?{overlayWindows:metadata.overlayWindows}:{})};
 const prior=manifest.assets.findIndex(item=>item.src===record.src);if(prior>=0)manifest.assets[prior]=record;else manifest.assets.push(record);
}
function androidDirectory(selected,root,variant,language){
 const configured=selected.androidVariantDirectories?.[variant+'-'+language];
 const name=configured??(variant==='compact'?(language==='en'?'compact-english':'compact'):(language==='en'?'english':''));
 const directory=resolve(root,name);assert.ok(directory===root||directory.startsWith(root+'/'),'Android condition directory stays inside its selected root');return directory;
}
for(const revision of ['baseline','candidate']){
 if(frozenManifest&&revision==='baseline')continue;
 if(frozenManifest&&refreshPlatforms.size===0)continue;
 const selected=sources[revision],verified=selected.verified;
 if(revision==='baseline'){
  const web=resolve(repo,selected.webRoot);
  const result=JSON.parse(readFileSync(join(web,'result.json'),'utf8'));
  assert.equal(result.generatedOnly,true);assert.equal(result.passed,true,'Web evidence must come from a passing generated fixture');
  for(const [variant,width] of [['normal',1440],['tablet',820],['compact',390],['minimum',320]])for(const language of ['zh','en']){
   for(const [scene,prefix] of [['home','populated-home'],['empty','empty-home'],['signedout','signed-out']])add('web',revision,scene,variant,language,join(web,`${prefix}-${language}-${width}.png`),verified);
  }
  for(const [scene,prefix] of Object.entries(webFiles))add('web',revision,scene,'normal','zh',join(web,prefix+'.png'),verified);
 }
 if(!selected.nativeRoot&&!selected.macRoot&&!selected.androidRoot)continue;
 const native=selected.nativeRoot?resolve(repo,selected.nativeRoot):null;
 const mac=refresh('mac')&&!selected.requireReadyEvidence?(selected.macRoot?resolve(repo,selected.macRoot):native):null;
 const androidRoot=refresh('android')?(selected.androidRoot?resolve(repo,selected.androidRoot):native?join(native,'android'):null):null;
 for(const language of ['zh','en'])for(const variant of ['normal','compact']){
  const directories=mac?(language==='en'?[join(mac,'english','validation'),join(mac,'english')]:[join(mac,'validation'),mac]):[];
  for(const [scene,prefix] of Object.entries(macFiles)){
   const names=scene==='home'&&variant==='compact'?['first-run-compact-ui-fixture']:scene==='home'?[prefix]:variant==='normal'?[prefix]:[prefix+'-compact'];
   const path=directories.flatMap(dir=>names.map(name=>join(dir,name+'.png'))).find(existsSync);
   if(path)add('mac',revision,scene,variant,language,path,verified||selected.verifiedPlatforms?.mac,scene==='content'?'此图是采集记录列表，只覆盖一种内容类型。':'');
  }
  if(!androidRoot)continue;
  const android=androidDirectory(selected,androidRoot,variant,language);
  for(const [scene,prefix] of Object.entries(androidFiles)){
   const path=join(android,prefix+'.png');add('android',revision,scene,variant,language,path,verified||selected.verifiedPlatforms?.android);
  }
 }
 // This explicitly named final English note-detail fixture is separate from the Chinese set.
 if(androidRoot)add('android',revision,'detail','normal','en',join(androidRoot,'note-detail-english.png'),verified||selected.verifiedPlatforms?.android);
 if(androidRoot)for(const language of ['zh','en'])for(const variant of ['normal','compact']){
  const directory=androidDirectory(selected,androidRoot,variant,language);
  add('android',revision,'populated-content',variant,language,join(directory,'content-populated.png'),verified||selected.verifiedPlatforms?.android);
  add('android',revision,'populated',variant,language,join(directory,'home-populated.png'),verified||selected.verifiedPlatforms?.android,revision==='candidate'?'已滚动到最近内容；实际保存的生成笔记完整出现在可见首页中。':'');
  if(language==='en')add('android',revision,'detail',variant,language,join(directory,'note-detail-english.png'),verified||selected.verifiedPlatforms?.android,'英文详情截图；由同轮真实生成笔记打开。');
  if(revision==='candidate')add('android',revision,'detail',variant,language,join(directory,'home-note-original.png'),verified||selected.verifiedPlatforms?.android,'从当前可见首页的确切生成笔记进入，验证同一记录 ID 和原始正文。');
 }
}
if(refresh('web')&&sources.candidate.webSceneManifest){
 const evidence=JSON.parse(readFileSync(resolve(repo,sources.candidate.webSceneManifest),'utf8'));assert.equal(evidence.generatedOnly,true);assert.equal(evidence.passed,true);
 const root=resolve(repo,sources.candidate.webRoot);
 if(sources.candidate.webBuildManifest){
  const build=JSON.parse(readFileSync(resolve(repo,sources.candidate.webBuildManifest),'utf8'));assert.equal(build.generatedOnly,true);assert.equal(build.checks.build,true);
  for(const [file,hash] of Object.entries(build.buildAssets))assert.equal(createHash('sha256').update(readFileSync(join(repo,'apps/web/dist/assets',file))).digest('hex'),hash,'Current Web build asset: '+file);
  manifest.candidateBuilds={...manifest.candidateBuilds,web:build.buildAssets};
 }
 const selectedWebScenes=new Set();
 for(const record of evidence.captures){
  if(record.reviewSelection===false)continue;
  if(!record.scene)continue;
  assert.ok(scenes.some(scene=>scene.id===record.scene),'Unknown Web scene');
  assert.ok(manifest.platforms.web.variants.includes(record.variant),'Unknown Web condition');
  const selectedLabel=[record.scene,record.variant,record.language].join('/');
  assert.ok(!selectedWebScenes.has(selectedLabel),'Duplicate selected Web evidence: '+selectedLabel);selectedWebScenes.add(selectedLabel);
  const path=resolve(root,record.name+'.png');assert.ok(path.startsWith(root+'/'));
  assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),record.sha256,'Selected Web PNG hash');
  freshEvidence.set(path,{readiness:record.readiness,captureKind:'app-window'});
  add('web','candidate',record.scene,record.variant,record.language,path,sources.candidate.verifiedPlatforms?.web??false,'当前真实 renderer 已验证目标内容就绪；限制和空状态按实际结果记录。');
 }
}
const sceneMap={home:'home','home-populated':'populated',add:'add',content:'content',reader:'detail','note-composer':'note','ask-disconnected':'ask',guide:'guide',import:'import',settings:'settings',connection:'connection'};
if(refresh('mac')&&sources.candidate.macSceneManifest){
 const reviewer=JSON.parse(readFileSync(resolve(repo,sources.candidate.macSceneManifest),'utf8'));assert.equal(reviewer.generatedOnly,true);
 if(reviewer.build){
  for(const [file,hash] of Object.entries(reviewer.build))assert.equal(createHash('sha256').update(readFileSync(resolve(repo,file))).digest('hex'),hash,'Current Mac build asset: '+file);
  manifest.candidateBuilds={...manifest.candidateBuilds,mac:reviewer.build};
 }
 for(const record of reviewer.scenes){assert.equal(record.generatedOnly,true);if(!sceneMap[record.scene])continue;
  if(record.sha256)assert.equal(createHash('sha256').update(readFileSync(record.path)).digest('hex'),record.sha256,'Selected Mac scene hash: '+record.scene);
  freshEvidence.set(resolve(record.path),{readiness:record.readiness,captureKind:'app-window'});
  const boundary=record.scene==='guide'?'完整功能目录位于中央 Web；此 Mac 截图只记录入口的当前状态，不证明完整目录已打开。':'当前构建实际生成界面；采集与系统权限使用生成 fixture 桩。';
  add('mac','candidate',sceneMap[record.scene],record.size,record.locale==='en'?'en':'zh',record.path,sources.candidate.verifiedPlatforms?.mac??sources.candidate.verified,boundary+(record.notes?' '+record.notes:''));
 }
}
if(refresh('mac')&&!sources.candidate.requireReadyEvidence&&sources.candidate.macRoot)add('mac','candidate','populated-content','compact','en',join(sources.candidate.macRoot,'mixed-source-content-en-compact.png'),sources.candidate.verifiedPlatforms?.mac??sources.candidate.verified,'同一本机内容列表中的生成通知、笔记与文件；使用真实队列导入与原文阅读，系统通知观察器为 fixture。');
const baselineNative=sources.baseline.nativeRoot&&resolve(repo,sources.baseline.nativeRoot);
if(!frozenManifest&&baselineNative)add('mac','baseline','populated','normal','zh',join(baselineNative,'validation','ui-fixture.png'),true,'已有生成内容的首页；和候选记录不同，不能比较条目数量。');
// Baseline reviewer detail was taken from the same isolated, generated-only Mac fixture.
if(!frozenManifest&&existsSync('/tmp/mote-ui-eval/mac-round5-detail.png'))add('mac','baseline','detail','normal','zh','/tmp/mote-ui-eval/mac-round5-detail.png',true,'独立评审截图，来自同一第 5 轮隔离生成 fixture。');
for(const platform of refreshPlatforms)assert.ok(manifest.assets.some(asset=>asset.platform===platform&&asset.revision==='candidate'),'No fresh candidate evidence for '+platform);
const selectedAssets=new Set(manifest.assets.map(item=>item.src.slice(7)));
for(const invalid of manifest.invalidHistoricalEvidence){const asset=manifest.assets.find(item=>item.src===invalid.src);assert.ok(asset&&asset.sha256===invalid.sha256,'Invalid historical evidence must identify exact preserved bytes');}
for(const file of readdirSync(assetFolder))if(file.endsWith('.png')&&!selectedAssets.has(file))unlinkSync(join(assetFolder,file));
const finalValidation=join(repo,sources.currentDocuments?.validation||'docs/validation/ui-originality-2026-10-13.md');
if(existsSync(finalValidation))manifest.finalValidation=sources.currentDocuments?'evidence/feedback-validation.md':'evidence/originality-validation.md';
for(const file of ['index.html','review.css','review.js','README.md'])if(existsSync(join(folder,file)))copyFileSync(join(folder,file),join(output,file));
mkdirSync(join(output,'evidence'),{recursive:true});
const documents=[
 [sources.currentDocuments?.validation,'evidence/feedback-validation.md'],
 [sources.currentDocuments?.evaluator,'evidence/feedback-evaluator.md'],
 [sources.currentDocuments?.contract,'evidence/feedback-contract.md'],
 ['docs/design/ui-iteration-evaluator-2026-10-13.md','evidence/evaluator.md'],
 ['docs/design/ui-iteration-journeys-2026-10-13.md','evidence/journeys.md'],
 ['docs/validation/ui-iterations-2026-10-13.md','evidence/validation.md'],
 ['docs/design/ui-originality-evaluator-2026-10-13.md','evidence/originality-evaluator.md'],
 ['docs/validation/ui-originality-2026-10-13.md','evidence/originality-validation.md'],
 ['docs/design/ui-originality-2026-10-13.md','evidence/originality-design.md'],
 ['docs/design/ui-iterations-2026-10-13.md','evidence/iterations-design.md'],
 ['docs/adr-client-action-first.md','evidence/references/adr-client-action-first.md'],
 ['docs/client-navigation.md','evidence/references/client-navigation.md'],
 ['docs/ui-slate.md','evidence/references/ui-slate.md'],
 ['docs/development.md','evidence/references/development.md'],
].filter(([file])=>file&&existsSync(join(repo,file)));
const documentTargets=new Map(documents.map(([file,name])=>[join(repo,file),name]));documentTargets.set(join(folder,'README.md'),'README.md');
manifest.documents=documents.map(([,name])=>name);
for(const [file,name] of documents){
 const source=join(repo,file),destination=join(output,name);
 const document=readFileSync(source,'utf8').replace(/(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,(original,image,label,reference)=>{
  if(/^[a-z]+:/i.test(reference)||reference.startsWith('#'))return original;
  const fragment=reference.indexOf('#'),href=fragment<0?reference:reference.slice(0,fragment),anchor=fragment<0?'':reference.slice(fragment);
  const target=resolve(source,'..',href),bundled=documentTargets.get(target);
  if(bundled)return `[${label}](${relative(resolve(destination,'..'),join(output,bundled))}${anchor})`;
  if(image&&existsSync(target)){
   const hash=createHash('sha256').update(readFileSync(target)).digest('hex'),asset=manifest.assets.find(item=>item.sha256===hash);
   if(asset)return `![${label}](${relative(resolve(destination,'..'),join(output,asset.src))})`;
  }
  const boundary=image?'该图未包含在本交付的已选择证据中':'源码参考，不包含在离线交付中';
  return `${label}（${boundary}：\`${relative(repo,target)}${anchor}\`）`;
 });
 mkdirSync(resolve(destination,'..'),{recursive:true});writeFileSync(destination,document);
}
const json=JSON.stringify(manifest,null,2).replaceAll('<','\\u003c');
writeFileSync(join(output,'manifest.json'),json+'\n');
writeFileSync(join(output,'manifest.js'),'window.MOTE_UI_REVIEW = '+json+';\n');
console.log(`Offline review synchronized: ${manifest.assets.length} generated screenshots → ${output}/index.html. No credentials, raw DOM or runtime configuration copied.`);
