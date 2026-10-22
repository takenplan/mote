# Mote 扩展场景与架构审计（子任务）

日期：2026-10-07。唯一代码基准：`/Users/utopiafar/.codex/worktrees/df3d/mote`，HEAD `c72f9ae7cc03e03e92c1905e0791d3a6438d23f5`。已读根 AGENTS.md。全程只读该 worktree；本文件保存在临时目录。此报告不包含 Harness/Cordis 官方外部调研，它由另外两名 agent 完成。

## 决策建议

**保留现有 Cordis + 多个领域 registry + ExecutionEngine + MaterialStore 的方案，但不能把现状定为已经满足完整插件理想。只细化确有消费方缺口的契约并按场景补齐，不重做内核。** 已覆盖形态的新来源、显式后处理、Web 专用详情可以部署级低成本接入。通用命名产物订阅、窗口/join/aggregation 策略执行、稳定资料目录/卡片贡献、Android 原生贡献尚不完整。先保证实际声明被执行、依赖和生命周期被验证，再称这些面向“已定案”。

现状支持受信模块随部署安装，部分注册可以运行中撤销/替换；这不同于用户在运行中的系统安装任意新代码而完全不重启。HTTP 拓扑、新 connector、原生平台能力和 Web bundle 各有自己的部署生命周期。

## 可核查现状映射

下列文件/行号均对应审计 commit，不能用默认 checkout 的同名行号替代。

| 用户目标 | 已有扩展面与代码 | 实际边界/缺口 |
|---|---|---|
| 来源命名空间、同步、端侧预处理 | `packages/shared/src/sources.ts:98-109` 接受 builtin 或 dotted namespace；`source-capabilities.ts:18-36`；Mac `source-adapters.ts:8-55` 和 `source-manager.ts:128-143` | kind 可扩展，但来源 item 是预定结构枚举；新的未知输入形态需 codec/契约。Mac 可注入 registry，尚无卸载 API。`LocalSource` 配置/UI 不是完整声明式贡献系统。 |
| 中央来源接收与组织 | `source-pipelines.ts:26-54`；`recipe-contract.ts:19-38`；`source-recipe-executor.ts:47-97` | raw/group/step/publish 确有执行入口；pipeline 按 kind+priority 选一个赢家，不是任意多个 producer 订阅。 |
| 命名产物、多消费者 | `materials.ts:43-45`、`material-readiness.ts:9-17`、`materials.ts:269-275`；`processing-runtime.ts:20,34,63-95` | Material named artifacts 已有状态、revision、blockIds；Memory 依赖会消费。通用 ContextProcessor 只有 material page 或 artifact id/revision 输入，没有 artifact key/schema 的公共订阅声明；ArtifactOutput 是 kind/text/metadata，未统一 outputKey/schemaVersion。 |
| 中央窗口/连接/聚合 | `recipe-contract.ts:27-29`；`recipe-registry.ts:47-49` | 仅声明/验证/固定 manifest 版本。executor Handler union 只有 writer/reader/group/step/publish（`source-recipe-executor.ts:12-17`），`registerPolicy` 无 handler（47-49），organize 仅运行 steps→publisher（88-97）。不能据此声称 window/join/aggregation 被执行。 |
| 正式发布、身份、历史 | `materials.ts:86-98,363-369,405-406` | Material ID 必须 hash([sourceId,origin.externalId])，不可换来源身份；同一 group 工作返回一个 MaterialDraft。一个 Material 可含多个命名产物；需要多个独立 Material 时必须明确稳定产物逻辑身份及公共发布/删除语义。 |
| UI 页面/详情/附加面板 | Web `features/host.ts:4-21`，`types.ts:7-13`，`runtime.tsx:40-49` | exact kind/schemaVersion/representation；缺失/异常/歧义 renderer fallback。collection 只 render 整页，不是公共目录/card row slot。 |
| 稳定资料库外壳 | `Archive.tsx:44-57`、`features/collections.tsx:21-30` | 下拉菜单来自 collection registry，但 records/materials 两分支绕过贡献 render；选中 reference、详情布局仍特殊处理。Coding upload 是独立 `/library/coding` 页面。默认 capture/资料/Coding archive 未形成统一目录投影。 |
| 贡献依赖 | `packages/shared/src/feature-packs.ts:2-5,24-42` | registry 依赖仅 string ID，无 version ref；允许注册未在 manifest.components 中声明的项（declared 为空就通过）。Web install 创建 descriptor 时未传入 requires（`host.ts:12`）。Page 自己的 requires 在 `runtime.tsx:33-37` 检查服务端硬编码 version 1；Collection 没有 backend requires。 |
| 动态安装/卸载 | `feature-host.ts:33-58`；`connectors/registry.ts:69-70,92-117`；Mac `source-adapters.ts:32-56` | HTTP scope dispose 是撤销请求，不删除 Fastify route 树；topology 必须重启。Connector start 后禁止 register；close 是整体 shutdown，非每插件热安装。Mac adapter register 返回 this，没有 disposer。 |
| Android | `CentralScreens.kt:72-77,503-506`；`CentralLibrary.kt:22-27,102-118,159-176` | 固定 page 分派与导航目录，通用 Material text 能读未知 kind，但没有卡片/详情/菜单 contribution host。新增专用 UI 仍需 Kotlin 修改、构建、安装。 |
| Query Agent | `agent-feature-host.ts:10-29`、`evidence-exposure.ts:43-61` | 只读工具注册/撤销，EvidenceReader 内核授权。recipe exposure.routes 确被公共 policy 消费；这不同于 exposure.use 注册的实现本身被 executor 调用。 |

`docs/feature-packs.md:28-35` 明确 bundle/restart 边界；`docs/backend-plugin-rearchitecture.md:38,61-71` 是目标与不变量，不能逐条当作已实现证据。`feature-inventory.ts:9-11` 将 registry 中 pipeline/processor 都标 active；pipeline 的 recipe 依赖可能已失效，因此 inventory 当前表示注册状态，不能当作可执行或产物就绪证明。

## 四个扩展演练：改动路径与成本

### A. 新增 `acme.notes` 数据源并同步

可直接落在既有 SourceItem 形态（例：message 或 file）：来源 ID+externalId+revision 提供幂等同步，中央 capabilities 明确 transport。只为这种新增来源，不必改 SourceStore、receipt、ExecutionEngine、MaterialStore 或 Agent 核心。

**Mac 路径**：新增 `apps/desktop/src/adapters/acme-notes.ts`（建议路径，当前不存在），实现 SourceAdapter；在 `source-adapters.ts:58` 的部署 composition 或 source-manager 构造传入 registry 处追加注册。调用 `addAdapterSource` 创建账号/目录实例。默认 Manager 对 kind 无固定 dispatch，checkpoint 是带 version 的 opaque 形状（`source-types.ts:29-30`）。若用户需要 GUI 配置该来源，再新增或贡献原生设置入口；现状不能只写 manifest 自动生成界面。要给新增配置字段加版本化 schema；凭据放平台存储，不能进入 SourceConnection 或 source metadata。

最小 Mac 示例（接口草案，非已执行产品改造）：

```ts
registry.register({kind:'acme.notes',version:1,watchesPath:false,
  tracksDeletions:true,allowsArchive:false,
  validateConfiguration(source){ /* 校验用户已选账号/路径 */ },
  async scan({signal}) {
    signal.throwIfAborted();
    return {version:1,scan:{items:[{externalId:'note-1',title:'Generated',
      text:'Generated fixture',kind:'message',layer:'snapshot'}],
      seen:['note-1'],complete:true,skipped:0,checkpoint:{version:1,cursor:'1'}}};
  }
});
```

**中央 connector 路径**：新增 `examples/plugins/acme-notes-connector.mjs`，导出 `ConnectorManifest`，sourceKinds 写 `{kind:'acme.notes',capabilities:{...externalWrite:false}}`；create.init 注册 SourceConnection；ownerRoute 调 sources.upsertBatch。加入 `MOTE_CONNECTOR_PLUGINS`，重启。若普通 record→Material 默认形态可接受，无需自定义 organizer；新资料结构则在 init 注册 MaterialOrganizer 并在 close disposer。真实可核查最小结构在 `apps/server/test/connectors.test.ts:71-114`，测试用 synthetic.notes 的独立模块、认证入口、资料发布和卸载暂停，不要复制其 fixture 私有 SQL/路径到生产代码。

**成本**：简单 connector 1 模块+配置，Mac 1 adapter+1 composition+所需配置 UI；已覆盖结构无内核改动。新原生 capture API 需要 Kotlin/Swift/权限实现；新 wire shape 需要 shared codec/type，是明确契约扩展而非免费。Mac 包重建/重启；中央 connector 部署重启；未知来源 registry 不会自动添加原生入口。

**fixture 验收**：生成两个账号各两条 note+修订+删除；receipt 重放同 id/revision 无重复；同 revision 改正文拒绝；断网 journal 恢复；reference 来源正文不得上传；disabled 来源不接收；adapter 升级保留已接收 outbox、重置自己的 scan checkpoint。已有静态测试：Mac `source-scheduling.test.ts:15-49`，server `connectors.test.ts:71-114`、`source-pipelines.test.ts:168-175`。

### B. 基于已存在产物新增独立后处理 `acme.quote-index`

**当前能低成本完成的版本**：新增独立 `.mjs`/TS deployment module，经 `MOTE_BACKEND_PLUGINS`/`MOTE_FILE_PROCESSOR_PLUGINS` 加载，`ctx.effect(()=>ctx.moteContextProcessors.register(...))`；所有者 `POST /api/processing/workflows` 明确给 materialInputs（固定 material ref/range）或 artifactInputs（固定 id/revision），保存输出 Artifact。新增 module 1 文件+部署配置+调用方一个有界 workflow。无需另建 task queue/cache/deletion store；返回最多 16 项、总 200000 bytes（runtime），单 artifact text 12000 字符（`evidence-archive.ts:7`）。实际示例：`examples/plugins/text-normalization.mjs`，独立加载测试 `community-plugin.test.ts:12-35`。

```ts
ctx.effect(()=>ctx.moteContextProcessors.register({
  id:'acme.quote-index',version:'1',lane:'extract',
  async process({artifacts,signal}) {
    signal.throwIfAborted();
    return [{kind:'acme.quoted-text',text:artifacts[0].outputs[0].text,
      metadata:{fixture:true}}];
  }
}));
// 所有者提交：
{steps:[{name:'quotes',processor:'acme.quote-index',
  artifactInputs:[{id:existingArtifactId,revision:existingArtifactRevision}]}]}
```

此示例做结构变换而非语义判断。若做“重要/任务/洞察”提取必须由模型解释，通过宿主模型通道/预算执行；不能按关键词派发。

**用户理想中尚缺的版本**：插件只声明 requires named `transcript`、produces `quote-index` 并自动响应任何来源的 `transcript` 就绪。目前 Material.artifacts 的 key 可由 `MaterialStore.dependencyInput` 解析成块/证据 pin，但 ContextProcessor 没有通用 named product selector/调度订阅；需薄适配把 product pin→受控输入→既有 ProcessingRuntime.enqueue，而不是要求每业务自己从 text 猜类型。新增消费者注册声明和公共 planner/material input key 支持，属于最小内核契约扩展。也需将 ArtifactOutput outputKey/schemaVersion 纳入结果验证/身份和可枚举目录，否则调用方只能以数组 index 知输出。

**构建/重启**：新增可独立 JS 模块通常只配置和重启；TS 模块需编译；registry disposer 可撤销，但 runtime user install endpoint 未存在。仅显式 existing artifact 后处理低；自动命名依赖中等、一次公共适配成本，以后 consumers 不改内核。

**fixture 验收**：生成 note/WAV+脚本 ASR，两个下游分别依赖 transcript / attachment；只 transcript ready 应解锁前者；同 pin 重放复用；依赖 failed/unavailable 清晰 blocked；只更新 attachment 不重跑 transcript 消费者；输入更正/撤权/删除时失效输出；同版本卸载重装竞态不得提交旧实例结果。静态证据 `material-processing.test.ts:30-79` 已覆盖 material 页 pin、revision race、delete/retire lineage；named-key 场景 `source-pipelines.test.ts:177-192` 主要是 Memory gate，不等于全部消费者已支持。

### C. 新增/替换中央分组、窗口、join 与聚合

**现成可替换的部分**：注册新的 group handler + step handler + publish handler，复制成新的明确 recipe ID/version，注册 SourcePipeline，`runtime.configure(sourceId,{pipelineId:'acme.daily',...})` 选部署内 pipeline；保持 storage semantics。无需改 SQL scheduler/publication 内核。`source-pipelines.ts:309-330` 拒绝 records/archive 跨 storage 原地替换，需新 source identity。`source-pipelines.test.ts:225-231` 有替换生成 fixture。

```ts
ctx.effect(()=>recipes.registerGroup({id:'acme.day-group',version:'1',kind:'group'},
  item=>item.observedAt.slice(0,10))); // 测量时间分组，非语义分类
ctx.effect(()=>recipes.registerStep({id:'acme.fold',version:'1',kind:'step'},
  input=> /* bounded input.items -> draft-ready structure */));
// recipe group.policy/use refs 固定对应 ID；steps:[{id:'fold',use:{id:'acme.fold'},dependsOn:[]}]
```

时间 identity 必须声明 observed/recorded/occurred 角色和 timezone，不能因为易写就永久采用上例 UTC date；上例仅结构演练。新 group ID 规则会改变 Material identity，迁移需要明确旧 group retire/保留，不可只是改 group handler 导致旧 catalog duplicate。

**当前不能兑现的部分**：仅加 `window:{policy:{id:'acme.window'}}`、join/aggregation manifest 不运行策略。SourceRecipeExecutor step 是同步 `unknown`、publish 单 Draft；signal 仅在 outer runtime 前后检查，step callback 未直接得到 AbortSignal/预算。纯固定小型 transform 可用；耗时模型/远程调用应经持久 ExecutionEngine/ProcessingRuntime，不能塞入同步 step。

**最小公共细化**：沿现有 SourceRecipeExecutor 补“GroupPlan”读取/执行入口（bounded refs、checkpoint、watermark、关闭条件、late-input 行为），注册对应 window/join/aggregation handler，用现有 durable engine 固定 plan fingerprint、policy/component versions、source scopes，输出交既有 Publisher。暂未实现的 recipe fields install 时明确 unsupported_execution，直到有 handler+执行测试；不静默接受无效配置。不创建平行 scheduler，不让 policy 直接获得 Store/SQL。跨 source join 每一个输入都受控授权，结果权限取所有输入交集；迟到输入使其逻辑组增 generation，旧结果 fence 失效。一个 pipeline 可以给一个 Material 多个 named products，若真正需要多 Material 输出，publisher 可增加有限 Draft[] 适配，但必须规范每个 output 的 stable logical identity + tombstone fan-out；没有实际需求之前不要推广任意 DAG 插件编程语言。

**成本**：替换已实现 group/step 低（1 module+1 recipe+配置）；通用 window/join/aggregation 中等、首次必须改 executor/runtime contract 和 tests，不能说零内核改动。部署 module install 重启；已加载 registry 运行时替换可用，必须更版本并重新配置/retry。自动历史确定性重算与历史收费模型调用分开（`source-pipelines.ts:263-280` manual/deterministic）。

**fixture 验收**：六条生成 event 跨两个窗口、两来源；迟到/重复/删除/移组/窗口关闭/不完整 join；安装 window 定义证明实际 handler 被调用（现有 `recipe-registry.test.ts:13,39` 只证明 pin）；改变 config 或在执行中卸载策略，旧 Draft 不发布；deterministic replay 更新规定 group，manual upgrade blocked 等显式授权。材料权限跨 scope 不泄漏。

### D. 新资料类型 `acme.note-bundle` 的卡片、详情、导航

**现在可做**：新增 `apps/web/src/features/acme-notes.tsx`；导出 PageEntry/CollectionEntry/ViewEntry；`features/runtime.tsx` deployment composition 添加 install（或 `entries.ts`/`collections.tsx` 添加贡献）。导航 page 注册 route/section/order；详情 renderer/panel exact `kind:'acme.note-bundle',schemaVersion:1,representation:'material'`，使用现有 Material bounded reads。API 若既有 `/api/materials?kind=...` 足够，server 无改；新的数据读取语义才加 `apps/server/src/features/acme-notes.ts` typed FeatureServices Pick、`features/index.ts` composition，server bootstrap rebuild/restart。

```ts
await host.install({id:'acme.notes',version:'1',components:[]},[
  {surface:'page',entry:{id:'acme-notes',featureId:'acme.notes',route:'library/acme-notes',
    section:'library',label:'Generated notes',render:props=><Notes {...props}/>}},
  {surface:'renderer',entry:{id:'acme-detail',kind:'acme.note-bundle',schemaVersion:1,
    representation:'material',render:props=><NoteDetail {...props}/>}},
]);
```

**尚缺**：Card/ListRow slot 和公共目录 projection/ref resolver 未建立；CollectionEntry render 整个列表，自带 pagination/filter/status，成本会重复且无法让资料库成为稳定公共外壳。Archive records/materials 特判要迁入对应 builtin contribution，公共 shell 持有选中 logical ref、分页 scope、fallback；Coding upload/普通来源 metadata 各由 contribution 提供，不往 shell 加第三个 Coding if。Collection/page/renderer 同一 CapabilityRef 统一 backend/版本依赖，避免 Page 硬编码 1 和 Collection 无要求。Android 原生无法执行 React plugins，应建立 Kotlin equivalent registry + generic JSON presentation contract，而不是把 Web Cordis 拉进 Android；先 generic list/text fallback，专用 native renderer 随 APK 部署。

**成本**：Web 专用详情/独立页面低（1 feature file+1 composition）；统一卡片+目录+Android 中等一次公共接口细化，之后类型贡献不改 Archive/CentralScreens 核心。Web rebuild/reload；server 若新 route restart；Android build/install/relaunch。不能三端 lifecycle 合并称“热插拔”。

**fixture 验收**：同 kind schema 1 正常、schema 2 未安装 fallback；两个 renderer 同时匹配 fallback（无安装先后赢家）；抛错仅本 panel/view 局部；dispose 后 navigation/collection/view 消失且 current selection 清空/fallback；backend required version unavailable 时不调用数据 API；改 authenticated identity 丢弃旧 cache；生成 30 项分页无重复、scope 改变拒旧 cursor、无水平 overflow。静态 `feature-host.test.ts:5-28` 测 registry/dispose，未实际渲染 React fallback，不能等价于 UI E2E。

## 生命周期与边缘场景

| 条件 | 当前证据 | 必须明确/补验 |
|---|---|---|
| plugin missing / uninstall | `SourcePipelineRuntime.select:199-207` persisted binding/declared kind 不 fallback record；`RecipeRegistry.resolveRecipe:114-120` pins fail closed；processor admit/commit version gating（135-142） | Feature inventory active 要区分 registered 与 executable；未知 source 历史列表保持只读可见、暂停 intake、blocked 不吞任务。Mac initialize 对缺 adapter 抛错（66），目前可能阻止整个 source manager 恢复，不是独立 blocked；应让缺 provider 来源停用保留 outbox。 |
| unload UI | Web disposal 移除 registry（host 9-14）；Archive 自动 entry fallback（46-50），FeatureView fallback（45） | disposer 不影响 backend data/Agent access；current page route 的 fallback、abort 请求与 late response 需要真实 UI fixture。 |
| upgrade/version | recipe fingerprint+pins、immutable identity（registry 90-119）；pipeline tick manual/deterministic（263-280）；processor version 参与 job hash（78） | recipe immutability identities 是内存 Map；持久 work pins 守住已有工作，不代表 across restart 绝对禁止“同版本重新定义”。建议部署定义 digest 纳入 manifest/installer 验证。安装/启用/历史重算独立；停用保留旧资料，不补发历史收费授权。 |
| in-flight late result | source `publishGroup:173-183` 查 generation、archive checkpoint、instance identity、recipe pins、config；engine `205-213` signal/fence/lease+validate | ContextProcessor commit 只比 processor.version（142）。运行中 unload→同 id/version 重装，不同实例旧结果可能被新版本号接受；现有 `community-plugin.test:26-35` 先旧结果 blocked 后才重装，未覆盖竞态。应增加 installed generation 或执行时实例 token，并在 commit 比较；持久 fingerprint 和运行实例 token 用途不同。 |
| original delete | archive receive tombstone `226` redact old Material；forget `353-373` revoke/erase；Material lineage invalidation `material-processing.test:49-55` | source drop/uninstall 不等于 explicit forget；保留原件引用已 unavailable 时历史事实/可保留派生应依 retention policy，禁 resurrect。多 outputs/join 延伸必须都加入 lineage/deletion graph。 |
| unknown schema | FeatureView exact triple（host20/runtime43-45）；sourceMaterialView 未知形状 literal raw（source-material-view.ts17） | Catalog/card 不借正文猜 kind；未知 schema generic text/meta/status 保留。Markdown fallback 确为当前实现，需 UI 渲染安全验证。 |
| missing dependency | FeatureRegistry get/list 撤 dependent（33-42）；Memory dependencyInput pending/failed/unavailable；recipe unavailable blocked | FeatureRegistry 注册时不主动拒 cycles，get 时不可用；Web host 不传 requires/collection 无 backend gate，契约应统一。独立失败只阻断依赖 consumers。 |
| trusted code boundary | module 从 deployment config import（file-processors135-139）；connector receives trusted services | 当前是同进程受信代码，领域 callback 受控并不等于 arbitrary-code sandbox；不得宣称所有部署模块技术上无法访问 filesystem。查询 Agent 只读受控工具另有明确 boundary。 |

## 沿现有 manifest/registry 的最小草案

此段是建议，不是 current type 或产品实现。保留每领域 registry 的 executable authority，扩充 FeatureManifest/FeatureComponent 作可审计 data descriptor；manifest 不能第二次决定实际 processor 可用性，inventory 从实际 registry 及 resolved dependencies 生成。

```ts
type CapabilityRef = {id:string;version:string};
type ProductRef = {owner:string;key:string;schemaVersion:number};
type ProductContract = ProductRef & {
  representations: string[]; // text/json/asset；由明确 codec 验证
};
type FeatureComponentV2 = {
  id:string;version:string;surface:FeatureSurface;
  requires?:CapabilityRef[];
  inputs?:{product:ProductRef;required:boolean;maxBytes:number}[];
  outputs?:ProductContract[];
};
type LibraryContribution = {
  id:string;version:string;featureId:string;
  catalog:CapabilityRef;
  matches:{kind:string;schemaVersion:number;representation:string}[];
  slots:('source'|'card'|'detail'|'action')[];
  placement:{collectionId:string;order:number};
  requires?:CapabilityRef[];
};
type PinnedProductInput = {
  materialRef:string;product:ProductRef;fingerprint:string;
  blockIds:string[]; // 已有 dependencyInput 作唯一 resolver，不从正文解析
};
```

不要求一次引入全套字段：先 backend `requires` + `inputs/outputs`、UI library slot 有实际实现/fixture 后再升 schema；避免 manifest 写十个未来字段而 executor 再次无消费方。IDL 产物元数据不携带秘密、宿主路径、代码字符串。输入/output schema 校验、版本、预算、鉴权、收据、持久任务/取消、删除传播属公共层；插件只请求能力，不能自授。

**目录投影规则**：

1. 目录是 capture/source-head/material/artifact 权威上的投影；没有第二个长期正文库。Catalog provider 只交受控 ref、kind/schema、标题/preview（已授权范围）、time roles、来源、coverage/processor state 和明确操作 capability。历史/未知插件类型仍可 generic browse；不把 capability active 等同产物 ready。
2. 逻辑身份沿用 canonical refs。SourceConnection ID 与上游 account/item 唯一身份独立；source externalId/revision；Material ID hash([sourceId,stableLogicalExternalId])、immutable ref `material:id@revision`；ProductKey 单独命名空间不放 transport batch/token/time。多个输出使用 `sourceLogicalItem + producer/output logical key` 规范编码的 externalId，而不是模糊拼接或把 version 写进稳定 ID。producer version 进 revision/job fingerprint。上游 group policy 变更必须声明 migrate/retire/keep，避免孤儿 old heads。
3. 统一目录采用 bounded cursor keyset，稳定 tie-break canonical ref；cursor 绑定 identity、scope/filter/order、projection schema revision，过期或不匹配明拒绝。当前 MaterialStore cursor 仅 updated_at/id（606-613）可复用但尚未绑定 scope，不要称已完成统一 pagination。多 provider 合并需公共 bounded merge+provider cursor，不用各 UI 全量拉取后排序。
4. Owner catalog、query model catalog 分别经过既有授权/exposure。查询是否获图片/原件 grant 不能由 UI contribution 或目录标题决定；derived join 逐一验证全部 lineage。title/preview/count/error/export 均受可见性约束。实际业务操作授权和预算随 reader 进入，无写工具给予 Query Agent。
5. Action contribution 只能提供命令 capability 与适用 schema，实际执行仍公共 owner/operation authorization、幂等 request ID、结果收据；停用 UI action 不撤销此前 receipt，停用 backend capability 禁新 admission 并 fence 未授权提交。

## 分阶段验收建议

1. **定下内核边界/纠正声明**：保留当前部署和权威，文档区分三类 lifecycle；unsupported policy 执行明确失败；inventory 标注 dependencies executable；补 ContextProcessor installation-generation race fixture。无新业务 pipeline/真实数据。
2. **跨来源命名 consumer**：给已有 Material dependency resolver 一个通用 consumer adapter，固定 inputs/outputs 与 version；两个生成来源产生 transcript，一个新消费者+两个独立策略复用，故障只阻依赖；旧 input/old instance cannot commit；计量与历史重算授权由现有 engine/receipts承担。
3. **资料库稳定外壳**：records/materials 特判搬 builtin contribution；catalog+card/detail/actions 同一可撤销 descriptor；统一 bounded pagination/identity/scope；新 acme type 只加 module+composition、不改 Archive；Coding origin/upload state 作为贡献展示，不能再写菜单 switch。
4. **真实所需的中央策略/native**：先单个 window 演练证明 close/late/fence，再 join，仅实现需求；Kotlin generic directory fallback+native registration 显示缺失插件安全。验收每一个新增 source/type 的改动路径不进入 core dispatch，物理设备/真实模型独立验证后再报告通过。

## 本次验证记录

只读检查已完成：基准 git HEAD、AGENTS、指定文档与源码及上述既有 fixture 测试代码。试运行命令：

```sh
node --import tsx --test apps/server/test/recipe-registry.test.ts \
  apps/server/test/source-recipe-integration.test.ts \
  apps/server/test/source-pipelines.test.ts apps/server/test/material-processing.test.ts \
  apps/server/test/feature-packs.test.ts apps/web/test/feature-host.test.ts
```

结果：基准未装 node_modules，`ERR_MODULE_NOT_FOUND: Cannot find package 'tsx'`，六测试文件全部在 loader 阶段失败，**没有任何测试体实际执行**；不能说测试失败证明产品 bug，也不能说 fixture 验收已通过。未安装依赖、未写基准。主 agent 另在 `/tmp` 审计 commit 独立归档执行 generated fixtures，最终报告应以其实际结果为准。

未执行：npm run check:local、真实浏览器 UI E2E、Mac/Android 物理设备、真实账号 connector、真实模型/Harness、窗口/join 泛型策略（当前无 executor）。没有使用/收集/传输个人截图与其他真实个人材料。无产品改造、commit 或 PR。


> 汇总说明：本文件保留子任务自己的验证范围；主 agent 后续在审计 commit 的隔离临时副本完成 25 项基准生成资料测试及 4 项缺口探针。同 ID/version 立即重装时旧 ProcessingRuntime 结果提交已复现。最终决策和实测范围以 [主报告](plugin-architecture-2026-10-07.md) 为准。
