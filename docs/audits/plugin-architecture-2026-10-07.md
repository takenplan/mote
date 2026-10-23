# Mote 插件架构调研与方案决策

日期：2026-10-07（Asia/Shanghai）。审计 commit：`c72f9ae7cc03e03e92c1905e0791d3a6438d23f5`。

## 决策

**保留 Cordis + 现有 registry + ExecutionEngine + MaterialStore + Harness bridge 的架构，选择“最小细化后定案”。现在不能宣布用户要求的四类扩展均已能低成本接入。** 不重写内核、不另建插件框架、任务引擎、资料库或授权中心；补齐真实消费的契约和少量公共扩展点，然后用四个生成资料演练验收。

已有能力足以支持受信部署模块、新 namespaced 文本来源、显式后处理、精确类型详情 renderer 和导航。缺口集中在：通用命名输入/输出与自动消费者绑定；window/join/aggregation 的可执行语义；运行实例代际栅栏；统一目录、卡片、详情、操作及跨端依赖声明。补这些有实际场景依据。当前无需建设第三方代码市场、沙箱或无重启包安装器。

“每个独立能力一个模块”成立，但模块不必一一拥有独立存储、服务进程、HTTP 路由或菜单。来源、格式变换、模型策略、投影和展示可各自注册，版本配方组合它们。公共层强制鉴权、隐私、可靠收据、持久任务、版本/删除传播、取消与预算；语义解释由模型完成。Captured content 始终是不可信证据；查询 Agent 仅拿受控只读工具。

## 审计范围与交付

- 只读基准：`/Users/utopiafar/.codex/worktrees/df3d/mote`，开始及结束核验 HEAD 和工作树。没有切换、重置或修改该 checkout。
- 报告目的地：本任务 checkout 的 `docs/`。其 HEAD 相同，但已有 `app.ts`、英文目录、Web failure message/test 等本地改动；全部保留。本次只新增调研资料，不做产品改造、commit 或 PR。
- 三个 subagent 分别核验 Harness、Cordis、Mote 场景；主 agent 交叉阅读源码并执行生成资料探针。子调研归档见 [Harness](plugin-harness-research.md)、[Cordis](plugin-cordis-research.md)、[Mote 场景](plugin-mote-research.md)。主报告的执行记录补充子报告的静态结论；[机器可读验证记录](plugin-validation.json) 保存命令和结果。
- [最小类型草案](plugin-contract-draft.ts) 是规划资料，不导入产品、不建立新 registry；[基准缺口探针](plugin-contract-probe.mjs) 证明当前行为，不代表目标契约已经实现。

下文 Mote 位置相对上述只读基准；行号取该 commit。可用 [固定 commit 源码](https://github.com/utopiafar/mote/tree/c72f9ae7cc03e03e92c1905e0791d3a6438d23f5) 核查。文档描述是设计意图，实际调用与测试才是实现证据。

## 外部方案核验

### Harness

确认具体项目为 DeepSeek 官方 `deepseek-ai/deepseek-harness`；Mote 锁定 `@deepseek-ai/dsh-sdk-client`、`dsh` 及相关插件 `0.2.0-rc.2`，不是按名称猜测的另一款 Harness。官方声明处于 developer preview，兼容性可能变化。它以 Cordis 装配服务、Agent、模型、工具和文件系统；适合做模型执行器插件底座。[官方仓库](https://github.com/deepseek-ai/deepseek-harness)、[插件开发主文档](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/docs/user/develop/basic/index.md)。

锁定 SDK 启动子进程，通过 stdio JSON-RPC 运行配置中的插件；Mote 采用 sdk-minimal、隔离临时 home/workspace 和启动 patch。SDK 配置在启动时生效；不能从完整 Harness 的 Loader/HMR 能力推断 Mote 的 SDK 可以运行中安装包。精确包 README 和实际 bridge 调用优先于移动中的 master 文档。[SDK 源码](https://github.com/deepseek-ai/deepseek-harness/tree/5badb15009ae1756c3afe0ae0cef1faafc290ccc/packages/sdk/client)、[精确 npm 版本](https://registry.npmjs.org/@deepseek-ai/dsh-sdk-client/0.2.0-rc.2)。

需要只读检索时，沿用 Mote 的 `ContextToolRegistry`，固定 tool schema/version、每读重授权、卸载失效，并在 bridge 调用前后复查。Harness 的工具注册、profile 或 tool permission 不能替代 Mote 的证据授权、隐私过滤与提交检查；Harness 插件仍是受信宿主代码。其进程内 jobs 不替代 Mote 可恢复的 ExecutionEngine。详见子报告的精确源码与 8 个 tarball 校验结果和 [完整性收据](plugin-package-receipts.json)。[锁定 jobs-local 载荷](https://registry.npmjs.org/@deepseek-ai/dsh-jobs-local/-/dsh-jobs-local-0.2.0-rc.2.tgz)、[安全声明](https://github.com/deepseek-ai/deepseek-harness/blob/master/SAFETY.md)。

### Cordis

Mote 使用 `@deepseek-ai/cordis 4.0.4`。这是 Harness `vendor/cordis` 的 DeepSeek fork；vendor 清单记载上游基线 `cordis 4.0.0-rc.7` / `56b3d4f725681cf4556c1a8695a709cc3b6eed74`，不能把 fork 版本当上游版本，或直接换包。[vendor 清单](https://github.com/deepseek-ai/deepseek-harness/blob/master/vendor/README.md)、[上游基线](https://github.com/cordiverse/cordis/blob/56b3d4f725681cf4556c1a8695a709cc3b6eed74/packages/core/package.json)。

插件可用函数、类或 apply 对象，声明 inject 依赖，使用 effect 注册和释放资源。服务消失会卸载消费者，新 provider 可令消费者重启。`await fiber` 可能仅等到稳定 PENDING，不保证已 ACTIVE。多个 top-level effects 的异步 cleanup 并行等待；有先后关系的 revoke → drain → release 必须由同一 effect 或宿主串行安排。[官方 primer](https://deepseek-harness.github.io/deepseek-harness/reference/cordis-primer)、[Registry API](https://deepseek-harness.github.io/deepseek-harness/reference/cordis-api/registry)、[Fiber API](https://deepseek-harness.github.io/deepseek-harness/reference/cordis-api/fiber)。

已将精确 tarball SHA-512 与 lock 核对，并确认默认 checkout 安装包的关键源码/载荷字节一致。纯框架生成 fixture 验证了 PENDING、依赖消失、provider 替换、单次 cleanup。Cordis 管内存资源所有权；不负责 Mote 持久任务、收费授权、资料删除或正式发布。[锁定 4.0.4 载荷](https://registry.npmjs.org/@deepseek-ai/cordis/-/cordis-4.0.4.tgz)。

### 版本与未知边界

读取日期均为 2026-10-07。Harness 官方 master 查到 `5badb15009ae1756c3afe0ae0cef1faafc290ccc`（2026-10-03），与 npm `0.2.0-rc.2` 有差异；子报告明确区分。Cordis npm 元数据未提供可确认的发布 gitHead，准确发布源码 commit 未知，以锁定载荷控制结论。上游/fork 全量兼容性、Loader 在 Mote 的无重启安装、外部账户/物理设备、模型语义质量均未验证。没有将移动中的 master 当成锁定版验收。

## 现状与目标扩展点映射

| 边界 | 已有实际扩展点及代码 | 目标缺口与决定 |
| --- | --- | --- |
| 来源协议与同步 | `shared/sources.ts:100` 接受 namespaced kind；`source-capabilities.ts:18`；`server/connectors/registry.ts:37,69,92`；source receipt/version/identity 原路径 | 沿用。已覆盖文本形态可低成本加 connector；新二进制/新 OS capture 不能承诺只加 manifest |
| Mac 预处理 | `desktop/source-adapters.ts:21,32,44`；SourceManager 拥有政策、outbox、监听和上传 | 仅部署注册，暂无 adapter disposer；watch/read/queue/旧扫描代际需 host 生命周期契约；不把浏览器插件套在原生采集 |
| 原件与正式资料 | `server/materials.ts:33,45,87,363`；immutable revision、origin、blocks、named artifacts、Publisher | 沿用单一权威。多命名产品已可表达；多个独立 Material 的 output slot 与订阅消费者尚未通用化 |
| 普通资料组织 | `material-organizers.ts:31,40` 的 scoped reader、slot/priority/exclusive；`source-item-recipe.ts:43` 固定现有执行路径版本 | 能替换已有 source-head 组织器；reader 仍有 capture/codingSession/screenGroup 等固定能力，不是任意窗口/跨源 join Reader |
| 来源中央配方 | `recipe-contract.ts:19`、`recipe-registry.ts:39,79,114`；`source-recipe-executor.ts:12,47,88`；`source-pipelines.ts:26,171` | group/同步 step/publish 已执行；window/join/aggregation、trigger、retention、index/exposure ID 有些只固定声明，由宿主既有逻辑决定实际行为。补可执行 policy，而不声称 DAG 已覆盖全部 |
| 独立后处理 | `processing-runtime.ts:17,34,63,125,141`；`file-processors.ts`；`examples/plugins/text-normalization.mjs` | 显式 materialInputs/artifactInputs/dependencies 已有。Material 的命名 key 与 EvidenceArchive id/revision 不同；自动按命名产品订阅仍缺通用绑定 |
| 模型与查询 | `packages/agent` Harness bridge、ContextToolRegistry；`agent-feature-host.ts:10,26` | 沿用只读工具及授权，不让插件/内容给 Agent 提权；语义处理仍进公共持久任务、预算和审核 |
| 服务与注册生命周期 | `backend-plugin-scope.ts:20,25,32`、registry disposers、ExecutionEngine | 同 ID/version 重装的旧结果提交已复现；必须新增宿主 installationEpoch，不能用版本号替代实例 fencing |
| Web 展示 | `features/host.ts:9,20` page/collection/renderer/panel/home；`runtime.tsx:30,40,47` | exact kind/schema/representation renderer 已有；卡片与 action 位置、目录关联、后端版本依赖需共同声明。host 不传 entry.requires；page 单独硬编码 version 1，collection 无 requires |
| 公共资料库 | `Archive.tsx:44–57`；`LibraryBrowse.tsx:29,59`；`features/collections.tsx:21` | records/materials 特判、来源固定 labels、Coding 支撑列表与正式目录分开。一次性将内置路径包装成贡献；后续不写来源菜单分派 |
| Android | `CentralLibrary.kt:22,102`、`CentralScreens.kt:72,504` | 固定 page 分派和菜单，非 Cordis host。用同一无代码目录描述 + 通用原生回退；专用 Kotlin renderer 仍需 APK 构建更新 |
| Inventory | `feature-inventory.ts:6` 跨 registry 读取实际注册；`feature-packs.ts:17,24,33` | 保留状态投影，不能当“每项处理已跑过”。manifest 允许未声明组件、requires 没版本；补校验，不再增一套能力权威 |

表中 `shared/`、`server/`、`desktop/` 分别对应 `packages/shared/src/`、`apps/server/src/`、`apps/desktop/src/`。

## 四个扩展演练与实际改动成本

成本按改动边界判断，不给没有实现依据的工时数字。“低”表示已有公共契约、只增加部署模块和组合；“中”表示需一次公共契约/宿主扩展；“高”表示新增持久化/原生平台能力。以下 `fixture.*` 文件是建议位置和最小示例，尚未实现产品。

| 演练 | 新增文件/注册点 | 需修改现有文件 | 公共契约/内核变化 | 构建、重启与成本 |
| --- | --- | --- | --- | --- |
| A namespaced 数据源同步 `fixture.journal` | `examples/connectors/fixture-journal.mjs` → ConnectorManifest/sourceKinds/capabilities；调用已有 SourceStore 同步；如需专用逻辑资料，再加 organizer 或 source recipe | 部署 modules 配置；若内置则 `connectors/index.ts`。若本地采集，加 `desktop/source-journal.ts` 和 `builtInSourceAdapters()`；UI 未支持配置时新增 feature | 已有文本、版本、删除/receipt 可复用；无需改上传/任务/存储内核。新 OS API 或二进制封包另评。当前没有通用端侧预处理配方 | 外部 push/中央 connector 低；Mac 新 adapter 中；Android 新 capture 能力高。connector 启动后禁止新增，需重启；TypeScript/原生变更需构建 |
| B 已有 `conversation` 新增独立 `outline` 后处理 | `examples/plugins/fixture-outline.mjs` → `moteContextProcessors.register`；用已授权 pinned materialInputs 或 archive artifactInputs enqueue | 模块列表配置；自动订阅时需细化 `feature-packs.ts`、recipe binding、现有队列规划器与 `processing-runtime.ts` | 显式处理已低成本，无任务内核改动；按 Material named key 自动调度/多消费者尚需一次 host binding。同版替换需实例栅栏 | 当前 modules 在启动加载；构建/重启。预部署 registry 可运行时撤销；明确 enqueue 低、自动组合中 |
| C 替换中央分组/窗口/聚合 | `server/source-plugins/fixture-window.ts` → registerGroup/registerStep/registerPublisher；有状态 window/join 后注册 typed policy + recipe v2 | `source-recipe-executor.ts`、`recipe-contract.ts`/registry、`source-pipelines.ts`，复用 ExecutionEngine 的 durable state/提交；scoped RawReader 扩展按需加入 | 协议 ID 分组和同快照聚合已可只加 step。跨源 join、watermark、迟到数据、持久窗口无可调用通用 handler，须公共扩展；不能仅加 window 字段 | simple group/step 低；bounded durable window/join 中至高。受信模块随服务构建/重启；不自动授予历史模型费 |
| D 新资料类型的卡片/详情/导航 | `web/features/fixture-journal.tsx` → collection/page/exact renderer/panel；未来 card/action contribution；server 同 pack 注册 catalog projection；Android 通用目录 fallback | 当前 `entries.ts`、`runtime.tsx`/collection 组合；统一外壳需改 `types.ts`/host、`Archive.tsx`、`LibraryBrowse.tsx`；Android `CentralLibrary.kt`/`CentralScreens.kt` 一次通用化 | 导航/详情 renderer 低；当前统一卡片、目录投影和 action/依赖位置不全，不能做到全部只注册。一次公共 UI 契约扩展后，未知类型继续通用读取 | Web bundle 构建/刷新；新 HTTP endpoint 需服务重启；Android 专用视图需新 APK。现详情低、完整公共库中 |

### A 最小例与 fixture

沿用 ConnectorManifest `apiVersion:1`、合法 connector id `fixture-journal`，注册 `sourceKinds:[{kind:'fixture.journal',capabilities:{lifecycle:'continuous',discovery:'explicit-selection',listening:'polling',readOriginal:'none',synchronization:'revisions',externalWrite:false}}]`。在 create(context) 内用受信服务和宿主 ownerRoute；不在正文中指定插件、权限或物理路径。同步输入为 sourceId + externalId + revision，调用 `context.sources.upsert(sourceId, item, authorize)` / `upsertBatch` 的现有协议（实际签名见 ConnectorContext 与既有 connector），不自建 receipt。

生成两个条目 J1/J2；重复 J1@r1、冲突同版本不同内容、更新 r2、墓碑删除、重启后续游标。断言 durable receipt、稳定 source identity、当前资料与历史 policy、删除不能被旧队列恢复。Mac adapter fixture 只返回生成 SourceScan；验证 reference retention 不得带正文、权限过滤先于 outbox。实际旧 HTTP contract 字段必须由现有 schema 生成，不把此伪例当新 transport。已额外运行 `apps/server/test/connectors.test.ts` 中两个生成模块案例，证明第三方 source kind/capability/owner route 可随模块安装而不改核心；这不是完整新来源演练或真实同步。

### B 最小例与 fixture

已能执行的形式：`ctx.effect(()=>ctx.moteContextProcessors.register({id:'fixture.outline',version:'1',lane:'extract',process:...}))`，由授权 planner `enqueue([{name:'outline',processor:'fixture.outline',materialInputs:[{ref:pinnedRef,offset:0,length:4000}]}])`。若上游在同 DAG，则 dependsOn；若是 EvidenceArchive 持久产物，则 artifactInputs 固定 id/revision。**Material `artifacts[].key='conversation'` 不是 EvidenceArchive artifact id**，不能直接填入 artifactInputs。

最小契约草案把 `consumes:conversation` 映射为受控 ProductRef，两个消费者分别 `outline` 与模型 Memory；host 固定实际 key/revision/block fingerprint，各自排队，不用一个 global complete。确定性 fixture 生成 outline，脚本模型 fixture 生成另一产物，注入单消费者失败，验证无依赖链不被阻塞；更正一个块只失效相应依赖；停用不删历史，安装不自动回算。已执行 community-plugin/material-processing 既有案例；跨所有处理 runtime 的命名订阅仍是待实现验收。

### C 最小例与 fixture

当前有效：group 根据已声明设备/对象 ID 确定分组，step 对 scoped snapshot 做确定性格式变换，publisher 返回单个 MaterialDraft。group `item.externalId` 等协议身份不是语义分类；按正文关键词选择业务策略禁止。组合已有 step 做聚合可行，但持久时间窗口和跨来源 join 不宜藏在某个 step 的自建 SQL/定时器里。

新增 `registerWindow/registerJoin/registerAggregation` 的 typed policy，返回 FlowPlan，不暴露 Store；host 在事务中存 checkpoint/window state 和固定版本，生成 ExecutionEngine 工作。event time/observed time、watermark、迟到允许范围、close/reopen、retry、partial 输出明确写入 immutable recipe config。没有通用 handler 的 policy 安装应拒绝或标记 unavailable。生成 3 个对象、2 来源、乱序/重复/缺件/迟到；kill/reopen 后计划一致；替换 policy v2 时旧 work blocked，旧 Worker 和已撤权结果不能发布。多输出必须有 stable outputSlot，不能让两个 publisher 抢相同 Material 身份。

本次已执行 source recipe pin/missing/change/removal 案例；探针证实 window/join/aggregation 只 pin、无执行入口。没有运行新增窗口流程，不把预期写成现已通过。

### D 最小例与 fixture

现有 exact renderer：`{id:'fixture.journal-detail',kind:'fixture.journal',schemaVersion:1,representation:'owner-material',render}`；通过 `WebFeatureHost.install` 注册。新 page 描述 route/section/order，导航已有自动派生；零 renderer、unknown schema 或多个匹配均走安全通用 fallback。卡片不能从用户标题/正文猜 kind；typed catalog entry 提供 shape、ref、来源和缺失状态，注册位置明确为资料库 collection/card/detail/panels/actions。

统一化后 Archive 只显示贡献驱动的资料类型/来源筛选；records/materials/Coding 均包装为内置 projection/collection。默认“全部资料”以 Material 正式逻辑对象为主；原始采集记录是明确的受权限控制视图，不把同一对象的 raw/derived 卡片重复塞入正式目录。owner 可看保留的原始记录；query 目录仍遵循原有严格暴露政策。不能为了 UI 的统一把 query raw exposure 放宽。

fixture 发布 `fixture.journal@schema1`，注册 card/detail/nav/panel/action；撤销后卡片仍用通用目录，专用导航和操作取消、选择切至可用 fallback。升级 schema2 而 UI 只识别 schema1，应通用安全阅读；中止旧请求并清除身份 scoped cache。缺后端依赖时菜单不可用但历史资料仍可读。Web 真实 renderer/browser QA、Android layout/device 验证均待实施；本次 host fixture 仅证明 registry 精确匹配和撤销。

## 最小公共契约草案

[可 typecheck 的类型](plugin-contract-draft.ts) 沿用现有 manifest、recipe、registry，不成为产品 API 的第二份权威。落地时增量移入现有 `feature-packs.ts`/recipe contract，其 schemaVersion 升级；现有 v1 先由显式 adapter 转成完整描述，不静默把未声明贡献当完整契约。

1. **Component** 加 versioned requires（明确 host 与 capability id/version）、consumes/produces ProductPort（name + kind + schemaVersion + representation），以及可审计 effects。effects 是声明上界，权限实际由公共层检查，不是 manifest 可自行授予的权限。
2. **Recipe** 每 step 的 inputs 绑定 `(upstreamStep, outputName)`，声明 outputs；配方固定组件版本和配置 fingerprint。校验端口形态、唯一名、缺依赖、cycle、fan-out 和 output bounds。先支持精确版本，确有升级规则才引入 version range；不用未经验证的“任何版本兼容”。
3. **ProductRef** 区分 Material named key/fingerprint/blockIds 与 EvidenceArchive id/revision。host 将消费者输入解析为 scoped Reader，并在执行和提交前复查。持久化引用/版本/状态复用现有表和工作引擎，不复制长期内容或建立新的产品库。
4. **CatalogContribution** 关联已有 server data capability 与形态、collection/card/detail/panel/action ID。无凭据、物理路径或任意网络 URL。projection 的具体实现为可信 server module，传输给 UI 只有有界数据/版本描述，不传可执行代码。
5. **Lifecycle pin** 增加 host 分配的 installationEpoch。运行开始固定 ID/version/epoch；卸载立即撤销新 admission 和提交权限；旧结果即使新实例同版也不得提交。epoch 只代表运行安装身份，不替代持久的 recipe/material revision；重启由当前 host 显式恢复版本匹配的工作，旧租约/fence 永不复用。
6. **Executable flow policy** 优先补实际使用的 bounded window/join/aggregate，不提前造全能编排 DSL。必要的 async step 加 signal、timeout/output budget，重工作仍进入 ExecutionEngine；普通同步格式变换保留直接执行。

FeatureRegistry 当前未声明组件仍允许注册，WebFeatureHost 生成 descriptor 丢失 requires；探针证明这些事实。迁移后 manifest 必须与实际注册一致；缺服务的 PENDING 不标为 active。HTTP inventory、processor registry、UI registry 继续是独立 host 的事实来源，`/api/features` 只合并投影。

## 目录投影、分页、权限与逻辑身份规则

- **唯一权威**：正式资料与 named products 仍由 MaterialStore/既有 artifact store 发布；目录只读它们当前合法状态。projection 可持久索引但可重建，不能自己写新正式正文、替代 lineage 或提供绕过权限的查询 API。
- **逻辑对象**：当前 Material id 是 `hash(sourceId, origin.externalId)`（`materials.ts:87,366`）。来源自身 ID/协议对象 ID 稳定；上传批次、插件版本、UI card ID 不成为对象身份。同一对象新内容产生新 revision。多个消费者只增加产品/关联视图，不复制对象。
- **多独立输出**：保持旧默认 slot 身份不变；新配方声明 stable outputSlot，host 用明确、无碰撞的 canonical `(nativeObjectId, outputSlot)` 生成 origin.externalId，再用原 materialId 算法。不同 slot 的多 Material 才独立；不得简单拼无转义字符串，不凭标题相似合并。切换分组/identity 规则属于显式 identity schema 迁移，保留 supersedes/lineage 或显式新对象，不能静默改旧 ID。
- **目录去重**：logicalKey 由受信 ref authority + logical object ID 生成，独立于 revision 和 presentation。相同对象有多 projection 时按 host 的明确主视图声明去重；raw、索引、Material、Memory 不当成同一类型但也不重复呈现同一个正式 Material。来源菜单由实际注册/可见 catalog 描述派生，来源卸载后历史对象仍用 neutral label/fallback。
- **分页**：先复用 Material list/read/members 的有界 API。统一目录新增 cursor 绑定身份、授权范围、过滤、排序及 snapshot/generation；稳定排序时间 + logicalKey，跨 projection 有界 merge，不一次拉全库。每页限制条数和元数据 bytes，正文不随目录返回；下一页重授权。目录变化明确 cursor stale/restart，不能悄悄跨用户、跨 scope 复用。现有 list cursor 本身不等于这些未来统一协议已完成。
- **正文**：保留 pinned immutable ref 与 offset/length（当前 Material 页 UTF-16、上限 12000）；成员/原件另分页，图片/二进制另授权。权限拒绝的字段（标题/摘要/错误/成员/操作）不得先放在目录后交 UI 隐藏。
- **授权**：owner 资料库与 query catalog 各用当前业务受众、操作、阶段、时间/设备范围授权；目录 entry 不铸造读取 capability，后续 expand/read 再检查。高频截图与 Coding raw 默认限制保持；EvidenceExposure 的协议结构判断是隐私规则，不是关键词分类。未知类型只呈现已授权 generic text/metadata，fallback 不得提升原件权限。
- **action**：catalog 只标识受信命令 capability 与所需资源 revision，宿主再次 owner auth/预算/幂等/当前状态检查。查询 Agent 无 action writer；UI 卸载只移除展示和可见入口，不撤销中央处理授权或删除数据。

## 生命周期与失效审计

| 事件 | 当前证据 | 最小要求/待验收 |
| --- | --- | --- |
| 插件/依赖缺失 | recipe resolve 拒绝；processing admit blocked；FeatureRegistry 隐藏依赖，UI page 有独立 gate | manifest 精确依赖；collection/card/panel/action 同样 gate；PENDING 不等于 active；不能降级到另一未授权来源解释 |
| 卸载 | HTTP 503、registry dispose、owned runtime close、query tools revoke；历史存储与插件注册分离 | stop admission → revoke commit epoch → cancel/drain owned work → release；用宿主串行保证顺序；blocked reason 可见，卸载不删历史 |
| 升级 | recipe/component fingerprints 固定；同 registry 生命周期内 recipe version 不能换定义；source publish 比较当前 pipeline/recipe | 新版本显式注册与 recipe 选择；旧输入版本不偷偷换；recipe identities Map 在内存中，跨重启应以持久 work pins 和部署定义 digest 核对，不宣称已有永久定义库；确定性重算及有费用重算分别授权 |
| 运行中旧提交 | source pipeline 比较执行结果 pipeline 对象身份；processing version 改变可 block | **同版重装旧处理结果已通过提交**；补 installationEpoch 后此探针应改为断言 blocked/no artifact，并覆盖所有 executor |
| 原件删除/更正 | Material lineage、archive 引用、stale inputs；既有 material-processing 删除/换版测试 | 公共层先撤销读取/搜索/授权/依赖，再清理物理文件；墓碑持久防旧 outbox 回灌；文件删除失败可报告重试，插件不能自行保留副本 |
| 历史资料保留 | 卸载 HTTP fixture 数据仍在；历史 ref/retention 与当前 query 区分 | 卸载/停用/重算不是删除操作；retention/隐私撤权仍覆盖历史。旧不安全 schema 不能因 fallback 恢复 query 可见性 |
| unknown schema/renderer 异常 | FeatureView 无/多 exact renderer fallback，panel error local | 通用目录/卡片亦有 fallback；不能用 schema 名称猜含义；原生 Android 同样显示有界资料而不崩溃 |
| UI 取消注册 | host fixture page/renderer/panel 消失；Archive 可选剩余 entry | invalid selection/hash route 切回可用页；abort 请求、清 per identity cache、恢复焦点；不误取消中央任务 |

**三种可插拔能力分别记账**：

| 级别 | 中央端 | Web | Mac/Android |
| --- | --- | --- | --- |
| 部署级模块组合 | 已有 trusted modules 与配置；HTTP/connector 拓扑重启 | 已有 bundle composition | 已有构建内 adapter/native module |
| 已部署代码运行时撤销/替换 | 部分 registry 可撤销；有持久 fence，但同版 epoch 缺口待补；路由撤销不移除 Fastify topology | registry 可 dispose，React 订阅；视图不会自动停后端 | Mac adapter 未有卸载；OS 资源/后台队列需单独治理；Android 显式 Kotlin 分派 |
| 无重启发现、验证、安装新代码 | 未完成，不承诺 | 未完成，不承诺远程 JS 执行 | 未完成，原生新能力通常需应用更新 |

不用 HTTP restart 要求倒推整个架构失败；也不用 Cordis 可 dispose 推断无重启安装已完成。

## 分阶段迁移与验收

### 1. 先补发布身份与真实契约

把精确输入/输出、跨 host 版本依赖和 installationEpoch 纳入现有 manifest/registry；迁移现有空 components manifest。运行时区分 PENDING/ACTIVE/unavailable；注册必须声明或经显式 v1 adapter 补全。先修同版 replacement commit，覆盖 processing/file/source/agent 各 runtime 的撤销、版本变更和实例重装。验收：23 个原 fixture 不退化，新的同版竞态拒绝旧提交，独立消费者失败隔离；没有第二个任务权威。

### 2. 先统一资料库外壳

沿用已有 owner read API，把 records/materials/Coding 和其他内置视图包装为 catalog/collection/card/detail/actions 贡献。Archive 移除 id 特判，Source labels/menu 从可见描述派生；Collection 统一依赖检查，安全回退、取消选择与请求。Android 接受同一无代码描述先走通用目录/详情，保留可部署专用 Kotlin renderer。验收：生成 fixture 的新类型只新增 pack + composition/部署配置；无需再改 Archive/ReferenceDetail/native menu 分派；真实 Web 浏览器 QA 及 Android 构建/设备结果分别记录。

### 3. 实现命名消费与一个实际窗口策略

host planner 解析 ProductRef 并为多个消费者固定授权、具体产物 fingerprint/版本；复用现有队列与 Engine，不用 events 作可靠队列。补一个 bounded window/join 示例和 outputSlot 发布，保留 simple source group/step 路径。验收：跨来源生成 fixtures、缺件/迟到/restart/delete/old-worker/upgrade 均正确；不重复转写；仅依赖自己的必需产物；新 window/source pack 不需改公共执行器业务分派。

### 4. 定案与后续门槛

四演练在部署级模块场景通过后，定下当前架构，文档明确受信部署边界。更大压力、模型质量、OS capture 与无重启安装分别是独立后续需求，不以此次 fixture 冒充。每次产品实现运行适当验证；开/更新 PR 前按 AGENTS 执行 `npm run check:local`，新增 moteText 同步 TypeScript/Android 英文目录。当前任务没有开 PR，也没有授权真实资料测试。

## 本次实际验证记录

基准 worktree 没有 node_modules。主 agent 用 `git archive` 指定 commit 建临时副本，external dependencies 引用当前已安装目录，npm workspace `@mote/*` 链接指向临时副本并重新 build:libs，未引用当前有本地改动的应用源码。精确 Cordis 包另经 lock integrity 校验；这不是一轮全新 npm ci 或依赖供应链验收。

1. `npm run build:libs`：通过，临时副本编译 shared/agent/local-inference/diagnostics。
2. `node --import tsx --test apps/server/test/source-recipe-integration.test.ts apps/server/test/community-plugin.test.ts apps/server/test/material-processing.test.ts apps/server/test/feature-packs.test.ts apps/web/test/feature-host.test.ts`：**23/23 通过**，生成资料；包含 HTTP feature scope、receipt→publication→Agent projection、卸载、版本变化、资料权限/lineage。
3. `MOTE_AUDIT_ROOT=<临时副本> node --import tsx --test <本报告目录>/plugin-contract-probe.mjs`：**4/4 通过**，断言当前四处缺口：manifest 未声明注册允许；Web host 不传播 requires；window/join/aggregation pin 不执行；同版重装旧结果可提交。测试通过意味着缺口复现，**不意味着它们已修复**。
4. Connector 补充：`node --import tsx --test --test-name-pattern='third-party recording manifest|trusted deployment connector modules' apps/server/test/connectors.test.ts`：**2/2 通过**；同一临时副本，生成第三方模块/来源及 owner routes。连同前述 23 项共 **25 项基准测试通过**。
5. Cordis 纯框架生成 fixture：4 项机制断言通过，由 Cordis 子任务运行；无网络模型、无个人原件。
6. `tsc --noEmit --strict --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext docs/audits/plugin-contract-draft.ts`：通过，仅说明规划类型自洽，不证明 runtime 消费这些字段。

未执行：`npm run check:local`、全仓 suite、四个新增产品模块的完整 E2E、Electron/真实浏览器视觉 QA、Android 构建、Mac/Android 物理采集、真实模型、真实账户同步/写入、收费历史回算、插件无重启安装。Mote 子任务最初尝试在无 deps 的基准启动测试，loader 失败，测试体未执行；上述成功来自主 agent 的临时副本，不混淆两者。

## 结论适用范围

可以明确保留现有技术路线；不能把“registry 存在”升级成四场景均已低成本或全面热插拔。所需工作是补齐当前 manifest/recipe 的业务关系、实际执行入口、代际栅栏和公共资料库投影。完成所列生成演练后，来源、处理和展示才可独立演进，公共内核继续只负责受信保证。
