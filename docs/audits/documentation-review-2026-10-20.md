# 现状文档与 ADR 审计及待决策项

日期：2026-10-20。最终代码基线：`af11ab7c3e9fb5f38deaea4e4bae11462a7306b4`，已快进同步到本次拉取的 `origin/main`。主体审查冻结于 `da2f49971338029b2376041b46cb122864e9087a`；审查期间合入 PR #193，仅修改 `AGENTS.md` 两项最终检查时机规则。已补读这份增量，并补记 A2 中开发指南尚未同步的表述；其他被引用源码和文档未变，逐文件数量与阅读记录仍适用。

主要问题是多用户生产入口替换后，现状说明没有完整跟进；另有少数运行时行为与文档约定不同。大量 ADR 差异已有明确取代关系，不应再作为两套可任选的现行政策。本文只记录发现和建议，未修改产品行为、既有 ADR、操作指南或历史验证结论。

后续补充：[项目地图与事项推进进展审计](project-map-and-progress-review-2026-10-20.md) 核对了模块地图、55 项清单、66 行恢复矩阵、GitHub PR/Issue/Release 和本地推进检查点，另列已合入、已验证与仍未闭环的范围。

用户提供另一份审阅后的统一结论见[交叉验证与修订建议](documentation-review-consolidated-2026-10-20.md)。它纠正了历史 F 缺口、矩阵统计、重复待决项和整篇归档建议，并给出三批修订顺序。

## 建议先处理的事项

| 编号 | 需要判断什么 | 已有依据与当前差异 | 建议 |
| --- | --- | --- | --- |
| D1 | 核对任务评估时刻是否遵循现有合同 | 现状文档要求手工任务固定创建时间、自动任务使用接收时间，生产实现却从输入原件的最晚 `capturedAt` 取值。它可能影响“最近”“现在”等表达。详见 U1。 | 先核对任务来源与最终上下文；确认偏离后恢复对应的固定评估时刻。原文发生时间独立保留。不能只把文档改成代码现状来宣布闭环。若希望改为原文时刻，才需新的产品决策。 |
| D2 | 核对实际 Skill 入口与策略优先级 | 文档描述中性的 `memory-strategy` / `memory-integration` 程序；生产路径仍选择带固定语义和确认措辞的旧 Skill。详见 U2。 | 保留策略负责语义、宿主负责授权和校验的既有边界，检查并统一实际入口。若有意改变已约定的职责，才需新的产品决策，并明确例外及优先级。 |
| D3 | 现状、决策和历史怎样组织？ | 当前索引混合指南、有效 ADR、方案和验收，且仅直接收录 13/49 份 ADR。部分指南用一段“旧说明”提示包住大量仍写成现状的正文。 | 当前指南只描述 scoped 生产入口；ADR 保留决定和局部取代关系；旧宿主说明放入明确的历史章节。新增完整 ADR 台账，分别记录决定、实现、验证和部署状态。也可选择最小方案：暂不移动文件，只补精确适用范围和台账。 |

D1、D2 是已发现的文档与实现差异，不表示代码已经证明错误，也不表示已有约定失效。后续实现若改变职责、语义或生命周期，仍按仓库技术方案审查执行。D3 是文档组织选择，不改变产品政策。

## 可以按现有决定修正的过时说明

### S1 生产基线、协议和单所有者说明混用

- [架构](../architecture.md) L9、L20、L60、L92–96 仍写“当前” epoch 4、Wire 1、Ingress 2、单所有者仓库，以及多租户需另行设计；同文 L3 又声明 scoped 生产入口已接入。
- [中央 Memory](../central-memory.md) L5 仍称当前 epoch 4；[内容存储](../content-storage.md) L3、L9 仍以中央 epoch 4、本机格式 3 为当前准入基线。
- [文件](../files.md) L121–125、[同步恢复](../sync-recovery.md) L42–45 和[上传调度](../upload-scheduling.md) L11 仍给旧端点或旧传输选择说明。
- 实际入口是 `apps/server/src/app.ts` L1–2 的 `buildScopedApp`；`scope/baseline.ts` L2 固定 epoch 5 / Wire 2 / Ingress 3 / portable 3。实际上传路由在 `scope/ingress-routes.ts` L40–58；当前部署矩阵见[部署](../deployment.md) L147–153。

处理建议：保留 ACK、不可变原件、幂等、队列恢复等仍有效的领域规则，替换生产版本与路由；旧宿主明确标为测试 fixture。依据已有 [M00](../adr-multiuser-scope.md) 和[主线集成决定](../adr-multiuser-main-integration.md)，无需重新选择协议或恢复旧 API。

### S2 配对凭据、管理员和账号登录权限写错

- [采集与同步](../collection-and-sync.md) L52、[Slate](../ui-slate.md) L15 仍称设备邀请发放 owner 凭据，可进入归档和问答。
- [Android 原生中央](../android-native-central.md) L29–53 仍以“One owner session”、origin 作用域草稿及 owner 上传身份描述当前合同。
- 当前[部署](../deployment.md) L141 明确设备凭据不授予归档浏览或管理权限；`scope/http.ts` L27 对设备凭据限制路径。`AccountBinding.kt` L7–12 绑定 origin、deployment、user，`Ingress3Client.kt` L17–29 验证同一归属。
- [网页登录与配对](../web-login-and-pairing.md) 开头已经将后文降为历史流程；不能因历史正文仍存在，就将旧 owner 登录当成一个当前可选入口。

处理建议：当前指南分别说明账号会话、受限采集设备凭据、MCP 凭据和实例管理员。管理员可管理账号和资源，不等于普通 API 可访问其他账号私有资料。依据 [M00](../adr-multiuser-scope.md)、[M01](../design/multiuser-auth.md) 和[设备邀请合同](../design/multiuser-qr-pairing.md)。

### S3 单份 YAML 的表述遮住实例与个人配置边界

- [服务端配置](../server-configuration.md) L3 已声明实例与每账号私有 YAML；L5、L28、常用参数和文件位置表却继续使用单所有者“一份配置”“所有者令牌”等表述。[架构](../architecture.md) L36 也仍将系统设置归结为一份私有 `mote.yaml`。
- `scope/configuration.ts` L131–135 创建实例 ConfigService，L204–213 在 `configuration/users/.../mote.yaml` 创建各账号 ConfigService；`scope/app.ts` L103 把部署选定的主文件作为实例配置传入。
- [统一配置 ADR](../adr-unified-configuration.md) L5–8 已明确多用户取代范围；[配置归属](../configuration-ownership.md) L3 也已有提示，但下文仍主要描述旧领域实现。

处理建议：整理字段归属矩阵，区分实例资源与个人模型、处理、Memory、加密设置；保留 ConfigService 的校验、revision、prepare/publish/rollback 合同。不是改用另一套配置框架，也不意味着实例文件必须改名。

### S4 完整实例备份是否含秘密的说明相反

- [文件](../files.md) L131–137 给当前 `npm run backup` 命令，却称不含密钥、连接令牌及处理配置。
- [部署](../deployment.md) L225–227 和[更新](../updating.md) L45 正确说明当前完整实例备份包含私有配置及恢复所需密钥材料。
- `scripts/backup.ts` L21–24 将 epoch 5 分派到 scoped 备份；`scripts/scoped-backup.mjs` L147–158 复制实例及个人私有文件，并声明 `configuration:true`、`privateKeyMaterial:true`。

影响：操作者可能错误处理一个包含多个账号秘密的备份，或遗漏位于数据目录外的实例配置。建议让文件指南引用部署中的当前完整实例备份与个人导出说明；不能再沿用旧备份的排除项。不改变备份产品行为。

### S5 恢复后是否还需逐领域重新批准，指南未跟上决定

- [部署](../deployment.md) L179、L239 仍要求重新登录后“逐项确认授权”才能继续后台工作。
- [生命周期平价 ADR](../adr-lifecycle-parity.md) L11–16、L25–28、L63–77 已明确取代该步骤：可信密码登录以新授权恢复未来策略；旧 pending/unknown 工作不重放，原先暂停或更新的用户选择仍有效。
- 实现入口在 `scope/restore-future.ts` L23–26、L40–49、L68–92；`scope/app.ts` L99 将密码登录接到恢复协调器。

处理建议：分开描述停止状态的恢复、首次可信密码登录、未来策略恢复、设备重新配对和旧未知操作。这里不是需要再次决策的“默认是否恢复”，已有明确 ADR。

### S6 本机格式与 Dev 凭据保护只更新了部分文档

- [Desktop](../desktop.md) L3 写格式 4，L251–252、L266 又写格式 3，L262 仍笼统要求 safeStorage。
- 同类过时说明见[Android 库性能](../android-library-performance.md) L3、L35–38，[Android 本地状态](../android-local-state.md) L32，[客户端设置与存储](../client-settings-and-storage.md) L15、L23、L55、L62–63，[采集与同步](../collection-and-sync.md) L50，[同步恢复](../sync-recovery.md) L7、L13，[文件](../files.md) L9、L141，[相册](../capture-albums.md) L27–31。
- [Android 系统事件](../android-system-events.md) L5、L26 还把内容队列写成加密队列、正文写成解密后返回。
- 当前 `LocalDataFormat.kt` L9、`storage-format.ts` L5 均为 4；`QueueArchive.kt` L21、L50 和 Desktop `queue.ts` L497、L504 的导入导出也使用 4。`SecretBox.kt` L26–32、L64–83 使用 Dev 私有文件凭据和文件密钥；[Profile ADR](../adr-profile-release-policy.md) L23–45 保留 Prod 系统保护。

处理建议：统一“内容对象、私有草稿/ledger、连接凭据、归档格式”的当前矩阵，逐篇移除泛化表述。不能全局替换所有历史“3”为“4”，不能把 Dev 例外扩展到 Prod 或第三方 CLI。

### S7 导航、验收要求和发布渠道有旧规则残留

- [客户端导航](../client-navigation.md) L3–9 正确写资料库首屏，L53–57 的现行回归要求却仍要求默认 Home；这是验收规范冲突，不是旧 PASS 记录。
- [页面采集](../ui-page-capture.md) L7–11 仍指向旧的“今天 / 资料 / 问一问 / 本机”；[Android 原生中央](../android-native-central.md) L11 还要求 Ask 返回 Today。
- 当前[展示 ADR](../adr-ui-presentation-packs.md) L9、`ui-presentation.ts` L17、Android `MainActivity.kt` L92、Desktop `navigation.ts` L10–11 均以 Library/Content 为默认。
- [Slate](../ui-slate.md) L23 仍称各组件发布 DEV prerelease；[Profile ADR](../adr-profile-release-policy.md) L10–20、[发布流程](../releasing.md) L15–21、L94–120 和发布 workflow 已采用 Dev SHA Actions artifact，Beta/正式 tag 使用 Prod 身份。

处理建议：修当前指引和验收要求；历史设计、发布记录保持原日期。当前实际 GitHub 发布或部署状态本次未检查。

### S8 首页和索引仍把已实现能力列作缺口

- [中文首页](../../README.zh-CN.md) L76、[英文首页](../../README.md) L76 仍称多用户未实施 retention/capacity；`scope/app.ts` L126–130 已挂载容量账本和启动 ArchiveMaintenance。[生命周期 ADR](../adr-lifecycle-parity.md) L22–24、L49–61 已定义当前责任。
- [文档索引](../README.md) L24 仍称插件一期“产品实现尚未完成”；[插件 ADR](../adr-plugin-center-memory-replacement.md) L3、[MVP ADR](../adr-mvp-baseline.md) L44 已明确一期控制和固定适配器实现，生产 `scope/app.ts` L112、L119 也已注册。
- [架构](../architecture.md) L3 把[10 月 18 日平价审计](business-flow-parity-2026-10-18.md) 当作现状入口，但那份有冻结基线的审计仍保留 F02/F03/F11 等旧开放状态。后续配置、生命周期 ADR 已改变部分状态，不能把原审计中的全部缺口照搬为今天的待决策清单。

处理建议：新增当前闭环台账，链接原发现及后续证据；原始审计正文不追溯改成新的 PASS。挂载了实现也不等于本次证明所有规模、故障和设备旅程都通过。

### S9 已取消的 Memory 总量、期限和二分仍在现状说明中

- [中央 Memory](../central-memory.md) L107 仍写 Memory 总量 100,000，达到后拒绝新增/修正；[归档准入清理 ADR](../adr-archive-admission-cleanup.md) L17–23、L69 已移除生命周期总数上限。配置容量仍是另一回事。
- [审核策略](../memory-review-policy.md) L50 和[记忆更新](../memory-updates.md) L62 仍给删除比较设置统一五分钟总期限；[任务执行策略](../task-execution-policies.md) L27 的对应任务没有默认总期限。不能把仍有效的单次模型 deadline 或审核缓存五分钟 TTL 一并删掉。
- [手工输入计划](../memory-manual-input-plans.md) L16 仍写超时后拆分，L18–20 又以已取消的内部 Agent 输入上限解释打包；[问答与上下文简化 ADR](../adr-ask-evidence-quality-and-simple-context.md) L11–17 已取消所有自动 Memory 二分，实际容量失败保留原范围。初始结构分段和获授权的 `needs_context` 重组是不同机制，仍可保留。

处理建议：按已有取代决定改说明，保留真实容量失败、未知外部结果、显式重试、取消和资源等待的各自语义。不新增更短期限或静默拆小成功。

### S10 扩展开发指南指向旧生产宿主和已失效配置入口

- [Feature packs](../feature-packs.md) L5、L11–14、L34 声称当前服务端经 `ServerFeatureHost`、`AgentFeatureHost` 和 `features/index.ts` 组合，`/api/features` 联合多类能力目录。
- 当前 `scope/app.ts` L93、L101–134 直接组合账号域；`scope/web-routes.ts` L7–24 的目录来自当前 HTTP route 注册。当前[插件开发](../plugin-authoring.md) L3、L24–27 已说明该边界。[社区扩展](../community-extensions.md)和[资料库插件合同](../library-plugin-contracts.md)也已有历史适用提示。
- [Memex source pack README](../../plugins/source-packs/memex-markdown/README.md) L5 仍要求 `MOTE_IMPORT_PYTHON_PACKS` 环境变量；`config.ts` L253–258、L267、L301 只从 YAML `plugins.importPythonPacks` 取普通配置，当前 `scope/app.ts` L117 仍实际消费此扩展。

处理建议：更正生产扩展入口、实际能力目录和实例 YAML 配置；保留仍生效的浏览器展示注册规则。不能把单所有者 fixture 中存在的代码当成当前生产注册路径。

### S11 版本标签、普通修订和后台处理职责有局部旧表述

- [有限个人 Memory ADR](../adr-bounded-personal-memory.md) L5 把范围评估组合称为“新个人 v4”，而[范围评估 ADR](../adr-memory-range-evaluation.md) L119–131 和 `memory-range-selection-policy.ts` L8–15 明确该组合是 v5，v4 保留固定旧定义。应只改入口标签，不改旧配方语义。
- [正式资料架构](../material-architecture.md) L139 仍把实际依赖“更正、删除或撤权”一并写成清除回答；[历史保留 ADR](../adr-evidence-history-retention.md) L16–34 已区分普通更正后保留历史答案与隐私删除/访问限制，当前 scoped 规则见[集成 ADR](../adr-multiuser-main-integration.md) L23–41。L133 的便携 v2 说明也属于 S1 的旧基线。
- [执行器](../execution-engine.md) L43 说图像理解只在 query 请求原图时发生；[图片与媒体 ADR](../adr-scoped-image-and-managed-media.md) L8–18、L91–105 与当前 `scope/processing.ts` L544–569 已有后台理解配方。后台图片处理与 Ask 原图披露是独立授权边界，改说明不能默认开放原图。
- [Agent](../agent.md) L83 把自动洞察写成数量或最长等待；[生命周期](../memory-lifecycle.md) L51 明确洞察为最小间隔 AND 数量阈值，当前 scoped `ask-automation.ts` L83 也使用 AND。其他工作流的 OR 条件不能推广成洞察的规则。

处理建议：这些局部文字可按已有合同更正，不需要重新采纳版本、删除政策、图片默认值或洞察调度政策。

## ADR 冲突与含糊之处

### A1 插件 ADR 同时声称已实现、只是原型、可合并和禁止提交 GitHub

[插件 ADR](../adr-plugin-center-memory-replacement.md) L3、L5–11 说一期已实现、所有者已授权验收后 PR/merge；L218–223 却说本次 plan/prototype 不声称实现或验证；L225–229 又说实现、测试、数据和报告必须留在本地、不得提交 GitHub。

这是同文的明确表达冲突。开头足以证明文档自称的当前状态，不能证明所有 provider 已完成验证；末尾也不能不加日期和上下文就被解释为全仓永久发布禁令。

后续交叉核查已找到适用阶段的明确依据：[一期实施方案](../design/plugin-center-phase-one-2026-10-12.md) L5、L7 记录原型后实际实施、验收与 PR/合并授权，并明确实现与可公开的生成回归测试可以提交，令牌、私有运行资料和模型输入留在本地；[验证账本](../design/plugin-center-phase-one-validation-2026-10-12.md) L166、L179、L185 分别记录后续授权、历史原型附件和私有运行资料的边界。因此应给 ADR 末尾加历史原型阶段说明，并链接后续实施授权，保留私有资料、现有节点写入及个人截图的原有限制。这不是当前待所有者重新授权项，也不意味着获得了对本次审计或其他工作的新增提交授权。

### A2 取代关系经常只在新 ADR 写，旧 ADR 仍看似有效

| 表面矛盾 | 已有取代依据 | 应怎样解释与整理 |
| --- | --- | --- |
| [归属 ADR](../adr-material-attribution.md) L3–5、L39–46 保留持续处理、移除普通关闭；插件 ADR 支持 pause/stop | [插件 ADR](../adr-plugin-center-memory-replacement.md) L192–193、L206–214；[MVP ADR](../adr-mvp-baseline.md) L42 | 暂停政策已决定。给旧 ADR 加局部取代提示，保留归属、来源授权、非空策略与历史授权规则。 |
| [请求准入 ADR](../adr-central-request-admission.md) L7–15 包括登录不按次数拒绝；当前密码登录有尝试保护 | [M00](../adr-multiuser-scope.md) L137 明确允许 M01 的窄认证例外；[认证实现](../../apps/server/src/scope/accounts.ts) L113–125 | 不恢复普通 HTTP 配额；补认证例外和当前登录保护入口。已经批准的例外不需要重投票。 |
| [历史保留 ADR](../adr-evidence-history-retention.md) L50–55 写补回执、backfill；当前生产禁止启动补造缺失的历史依赖/发布回执 | [主线集成 ADR](../adr-multiuser-main-integration.md) L58–64 明确不重建缺失收据，L110–115 区分 scoped 与旧 EvidenceArchive | 分开标注宿主和历史阶段，不能将旧 backfill 当作当前 MVP 的待实现兼容工作。历史 root receipt 本身不授予读取权限；正常重启保留既有回执仍应支持。 |
| Action-first、旧来源说明 ADR 保留旧 Home 导航；展示 ADR 改为 Library 首屏 | [Action-first ADR](../adr-client-action-first.md) L5 已有局部取代；[展示 ADR](../adr-ui-presentation-packs.md) L9–11 | 这是已解决的顺序取代，剩余问题是各消费指南和 KEEP 行没有完整跟进。 |
| [开发指南](../development.md) L244 仍写“PR 前”完成完整检查；新 [AGENTS](../../AGENTS.md) L15 允许中间提交/草稿 PR 更新用定向检查 | PR #193 的最终检查时机澄清，以宣布可合并或交付前完成完整检查为门槛；开发中保留定向验证 | 更新开发指南的时间表述，保留最终检查、冻结候选、单驱动和高风险状态覆盖要求。不降低验证范围。 |

建议台账记录“适用宿主 / 决定状态 / 局部取代条款 / 当前指南 / 后续实现证据”。不能仅以日期新旧决定整篇失效，也不能让旧 KEEP 行否决之后明确采纳的变更。

### A3 决定获准、源码存在、验收通过和部署上线被混成一个状态

- 五份 ADR 缺少明确状态字段：[缓存 Memory](../adr-cache-memory-retention.md)、[请求准入](../adr-central-request-admission.md)、[外观](../adr-cross-platform-appearance.md)、[图片与媒体](../adr-scoped-image-and-managed-media.md)、[统一配置](../adr-unified-configuration.md)。正文可能有授权或实施来源，缺表头不等于未经批准。
- [增量检查证据](../adr-incremental-check-evidence.md) L3 仍为“revised implementation for review”，[主线集成](../adr-multiuser-main-integration.md) L3 仍为“implementation under validation”。需要从后续原始证据确认状态，不能凭已进 main 就补成全部通过或已部署。
- [Material task identity](../adr-memory-material-task-identity.md) L3、L34–39 的 candidate/qualification pending 与其[验证计划](../validation/memory-material-incarnation-2026-10-19.md) 的未执行范围并不矛盾。它应进入待验收清单，不能因为有表和代码就把状态“修正”为交付完成。

后续进度补查发现，该 Material identity 入口没有连接后来的实际执行与组合证据：初始 source-only 仍属准确历史，但不能代表今天从未执行。已进入 main、已有部分执行与完整资格尚未证毕应分别记录，见[补充报告 P7](project-map-and-progress-review-2026-10-20.md)。

处理建议：至少分别记录决定、实现、验证、部署。历史验证保留原始 base/head 和生成夹具、真机、真实模型范围。

## 两处需要调查或确认的现状与实现差异

### U1 Memory 任务时间与原件时间的职责不清

[审核策略](../memory-review-policy.md) L14 要求任务固定持久化创建时间；[Memory 策略](../memory-strategies.md) L111 对手工任务有同样说明，自动任务则另有其时间合同。当前生产 `apps/server/src/scope/memory.ts` L252 构造 `QueryInput.contextTime` 时，从输入记录中选最晚 `capturedAt`，没有在这一赋值处按手工/自动来源区分。

风险：今天手工整理旧日记时，模型可能把旧日记时间收到“现在”的上下文中。这里只确认赋值与文档不同，没有运行真实模型证明某一具体回答已错；应继续核对任务来源、持久化字段、提取及审核实际消费。

建议在后续计划中列出自动、手工、整合、跨午夜重试、补充上下文、历史原文六类时间角色。已有任务创建时间约定仍是默认修复依据；若所有者希望改变，则需明确新政策，不能仅依据局部代码认定原约定已取消。

### U2 中性程序与当前选用的 Skill 同时给出语义规则

- [生命周期](../memory-lifecycle.md) L103、[策略](../memory-strategies.md) L107、L153 描述中性 `memory-strategy` 和 `memory-integration` 程序，所选策略独立决定语义准入。
- 当前生产 `scope/memory.ts` L252 却为整合选择 `memory-consolidation`，其他阶段选择 `memory-extraction`。
- [consolidation Skill](../../packages/agent/skills/memory-consolidation/SKILL.md) L16 说关系要等所有者确认；[生命周期](../memory-lifecycle.md) L83、[审核策略](../memory-review-policy.md) L3 和当前 `memory-contract.ts` L20 却明确独立审核及宿主校验后自动生效。中性 [memory-strategy Skill](../../packages/agent/skills/memory-strategy/SKILL.md) 则明确服从宿主所选策略与输出合同。

这超出单纯介绍文字过时：被选 Skill 是运行输入。现阶段可以确认入口和规则存在张力，不能仅靠静态阅读断言模型一定执行哪一条。Skill 中的数值边界仍可能有当前宿主合同依据，不能据此单独判定过时或要求删除。需要核对最终提示组合、策略覆盖与阶段合同，并通过生成资料的真实生产入口检查。

建议保持已采纳的策略职责，移除或明确约束旧提示中的竞争规则。若旧 Skill 是特意保留的例外，应在 ADR、当前指南和实际程序中写出范围；不要新增泛化人工确认步骤来迎合旧提示。

## 文档入口和完整清单

基线包含 **612 份 Git 跟踪 Markdown，其中 49 份 ADR**。完整文件、类别、是否直接收录到文档索引及本次核对层次见[逐文件清单](documentation-inventory-2026-10-20.md)。

| 类别 | 数量 | 本次处理方式 |
| --- | ---: | --- |
| docs 根目录 ADR | 49 | 核对状态、适用范围和取代关系，并对高风险差异追到实际入口；逐文件阅读层次见清单 |
| docs 根目录其他指南或记录 | 152 | 优先核对当前行为说明、操作步骤、权限和验收要求；大型文件可能只读相关章节 |
| docs/design | 57 | 作为决定和设计来源，核对与当前决定的关系；不把原计划当已交付 |
| docs/validation | 204 | 作为有冻结输入的历史证据；按问题追读，未逐份复验 |
| docs/audits | 8 | 保留原始基线和发现；本次结论单独记录 |
| release/notes | 120 | 历史发布记录，仅结构扫描，不因旧版本而判过时 |
| 运行时 Agent Skill | 9 | 按代码输入看待；核对 Memory 相关规则，不擅自改写 |
| 其他 README 与开发指令 | 13 | 清点入口，按关联领域核对 |

索引仅直接链接 13/49 份 ADR；docs 根目录除索引自身外有 70 份文档未直接收录，其中 36 份为 ADR。这不表示完全无法通过其他文档找到，但目前没有完整决策入口。现有索引还把 10 月 9 日清理和 10 月 14 日 UI rollout 写成当前入口，未清楚接上之后的多用户和展示决定。

静态链接检查未发现失效的本地文件目标；发现一处明确失效的章节链接：[插件一期设计](../design/plugin-center-phase-one-2026-10-12.md) L116 指向 `plugin-center.md#api`，实际章节为“控制 API 与验证”。远端 URL、HTML 链接、引用式链接及历史生成产物未做完整可用性验证。

## 后续修订边界与验证

建议第一批只修 S1–S11 的已确定文字、A1 的原型/实施阶段边界、A2 的取代提示、索引和失效锚点；U1/U2 独立调查后再决定实现修复。原历史材料不删除，原验证结果不重写。

本次完成的是静态文档与源码交叉审查，以及文档格式、链接检查。没有运行应用构建、自动化业务测试、浏览器/原生界面旅程、物理设备、真实模型或外部账号验证；没有查看运行中的个人资料或改变部署。源码静态证据只支持此提交的结论，不证明当前线上节点已更新。此审计和清单为本工作区新增的未提交文件，尚未进入主分支或发行版。
