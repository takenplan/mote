# ADR 台账

核对日期：2026-10-20，源码基线 `af11ab7c3e9fb5f38deaea4e4bae11462a7306b4`。
本表收录该基线全部 49 份 `adr-*.md`；2026-10-23 追加统一用户旅程决定，未重新验收历史条目。决定状态引用原文及明确后继依据；有代码或
已合入不自动等于完整验收、所有者接受新政策或已部署。

每份 ADR 保留原日期、责任边界和取代条款。局部被取代时只撤下对应责任，不把整份
决定判为失效；原验证的 PASS/FAIL/NOT RUN 与生成夹具、真实模型、设备范围不重写。
当前系统入口见[项目地图](project-map.md)，实现 head、main merge、精确验证及剩余
工作见[进度台账](project-progress.md)。本表“现状/证据入口”是导航，不声称本次重验。
部署状态本轮未核对。

## 基线、配置与生命周期

| ADR | 决定状态与适用范围 | 后继 / 保留边界 | 现状或原证据入口 |
| --- | --- | --- | --- |
| [统一架构与用户旅程](adr-unified-user-journeys.md) | 所有者已接受；统一账号宿主、配置事务、任务与证据边界，实施中 | 取代按模块恢复旧逻辑、会话决定已接收工作寿命等局部假设；保留独立 Memory 审核、Actions 审批及只读 Ask | [分层验证](testing-unified-user-journeys.md)、[本次实施记录](validation/unified-user-journeys-2026-10-23.md) |
| [MVP 单基线](adr-mvp-baseline.md) | 已接受；当前版本唯一读写 | 原 epoch 4/Wire 1 等数值由多用户基线取代；持续新输入规则由插件暂停决定取代；无旧版本迁移 | [当前合同](project-map.md)、[原清理](audits/mvp-baseline-cleanup-2026-10-09.md) |
| [多用户边界](adr-multiuser-scope.md) | 已采纳；M00 原决定不独自交付下游模块 | 原“其余模块规划中”是阶段边界；当前装配和后继恢复另记 | [模块要求](design/multiuser-modules.md)、[交付台账](project-progress.md) |
| [主线集成](adr-multiuser-main-integration.md) | 所有者要求集成；源码已入 main | 缺失回执不补造；当前原文/授权和隐私删除保留；完整资格单列 | [历史集成](validation/main-multiuser-integration-2026-10-17.md)、[后继门禁](validation/pr-168-189-191-integration-2026-10-20.md) |
| [共享业务流](adr-shared-business-flows.md) | 已接受；保原旅程并必要隔离 | 各领域平价 ADR 细化职责，不授权简化默认和输入范围 | [恢复矩阵](validation/multiuser-parity-restoration-matrix.md) |
| [统一配置](adr-unified-configuration.md) | 所有者要求的 ConfigService 实现 | 单 owner 文件/模型复制由 M04 取代；校验、revision、prepare/publish/rollback 保留 | [配置归属](configuration-ownership.md)、[配置指南](server-configuration.md) |
| [配置旅程平价](adr-configuration-journey-parity.md) | 已接受；页面、文件、模型及用量旅程 | 实例/个人所有权隔离；保秘密引用、草稿、在途快照 | [配置原验证](validation/configuration-parity-2026-10-18.md) |
| [生命周期平价](adr-lifecycle-parity.md) | 已接受；维护、容量、恢复及导出 | 可信密码重登以新权恢复未来策略；旧 grants、unknown、设备目标权不复活 | [部署](deployment.md)、[生命周期原验证](validation/parity-lifecycle.md) |
| [请求准入](adr-central-request-admission.md) | 所有者要求移除任意 HTTP/积压额度 | M00 允许窄密码尝试保护；资源并发、容量和协议结构边界保留 | [原验证](validation/central-request-admission-2026-10-10.md)、[认证](design/multiuser-auth.md) |
| [Profile 与发布](adr-profile-release-policy.md) | 已接受实施；Dev 文件凭据、Prod 系统保护 | Dev SHA artifact，Beta/正式 Prod 标签；第三方 CLI 凭据管理不变 | [发布](releasing.md)、[Profile 回归](testing-profile-release.md) |

## 原件、资料、来源与证据

| ADR | 决定状态与适用范围 | 后继 / 保留边界 | 现状或原证据入口 |
| --- | --- | --- | --- |
| [归档准入与客户端清理](adr-archive-admission-cleanup.md) | 已接受；退役端侧解释及旧总量限制 | 不恢复旧 Worker、内部输入上限或生命周期 Memory 总数上限 | [文件](files.md)、[中央 Memory](central-memory.md) |
| [中央文件证据](adr-central-file-evidence.md) | 已接受；退役设备读请求链 | 中央 retained-text 扩展和精确依赖保留 | [文件](files.md)、[资料架构](material-architecture.md) |
| [资料归属](adr-material-attribution.md) | 已接受；未知/第三方/混合归属及纠正 | MVP 取代旧迁移；插件决定取代强制持续新准入；当前账号权限取代配对即 owner | [资料架构](material-architecture.md)、[归属原验证](validation/material-attribution-2026-10-07.md) |
| [Material 披露依赖](adr-material-disclosure-lineage.md) | 原阶段实现中；当前 scoped 适用范围由集成细化 | 普通修订清除改为保留旧回答并标 stale；隐私/访问控制保留 | [主线集成](adr-multiuser-main-integration.md)、[台账](project-progress.md) |
| [历史对话保留](adr-evidence-history-retention.md) | 所有者要求，原 PR 160 已合并 | 原 EvidenceArchive backfill 不是 scoped 当前路径；普通修订与隐私删除分开 | [对话](conversations.md)、[原验证](testing-evidence-history-retention.md) |
| [缓存变更保留 Memory](adr-cache-memory-retention.md) | 原 EvidenceArchive 实现及验证已记录 | scoped M07 以集成合同为准；不从旧 trigger 迁移推出 epoch 5 兼容路径 | [集成决定](adr-multiuser-main-integration.md)、[Memory 生命周期](memory-lifecycle.md) |
| [文件与来源说明](adr-file-source-context.md) | 已接受；版本化说明与文件任务 | 导航由展示决定取代；归属声明不能由标题/正文冒充 | [客户端导航](client-navigation.md)、[资料架构](material-architecture.md) |
| [录音覆盖与本人对应](adr-recording-coverage-and-owner-context.md) | 已采纳；所有者确认修复 | 覆盖编号、说话人与本人关系分开；不能从 diarization 标签推身份 | [录音来源回归](testing-recording-source-context.md) |
| [录音导出结果与就绪](adr-recording-outcomes-runtime.md) | 已接受；空、未就绪、不支持、失败分开 | 该次显式历史重跑授权不泛化为其他任务自动重放；音频备份不自动 ASR | [连接器](connectors.md)、[录音当前输入回归](testing-recording-canonical-parity.md) |
| [声学范围与转写展示](adr-speaker-range-and-display.md) | 已接受；首轮真实验收仅五份指定录音 | WeSpeaker 为可选固定组件；未知人数不继承试点范围 | [媒体运行时](ocr-asr-implementation-plan.md)、ADR 内原验证范围 |
| [作用域图片与媒体资产](adr-scoped-image-and-managed-media.md) | 平价职责恢复已记录；验证分开 | 账号图片控制、实例共享权重；原图披露仍独立授权；不能重放未知结果 | [Files 原验证](validation/parity-files-2026-10-18.md)、[执行器](execution-engine.md) |
| [飞书文档上下文](adr-feishu-document-context.md) | 所有者确认实施 | 第五个接入动作；提供方线索不等于完整行为日志；展示导航以后继决定为准 | [飞书](lark-integration.md)、[场景](testing-feishu-document-context.md) |

## Memory 与查询

| ADR | 决定状态与适用范围 | 后继 / 保留边界 | 现状或原证据入口 |
| --- | --- | --- | --- |
| [手工选择输出](adr-manual-memory-selected-outputs.md) | 已接受；显式选择的正式输出 | 不用来源自动默认吞掉手工选择，独立审核和授权保留 | [手工计划](memory-manual-input-plans.md) |
| [Memory 批次上下文](adr-memory-batch-context.md) | 已接受；原内部请求修正 | 范围评估替代穷举完成；简化决定取消自动二分；完整上下文保留 | [范围评估](adr-memory-range-evaluation.md)、[原回归](memory-batch-context-validation.md) |
| [有限个人 Memory](adr-bounded-personal-memory.md) | 已采纳；归属、有限观察及补问 | 当前范围评估组合为个人 v5；旧 v3/v4 固定定义不改写 | [策略](memory-strategies.md)、[范围评估](adr-memory-range-evaluation.md) |
| [Memory 上下文与正文](adr-memory-context-and-canonical-evidence.md) | 已采纳；无损上下文和精确正文保留 | 宿主字符门槛、预算异常、自动二分由简化决定取代 | [简化决定](adr-ask-evidence-quality-and-simple-context.md)、[审核](memory-review-policy.md) |
| [按需读取上下文](adr-memory-context-reading.md) | 已采纳；所有者确认实施 | v4 保持旧定义；当前 v5 范围评估；不恢复宿主字符阅读额度/二分 | [原回归](memory-context-reading-validation.md)、[范围评估](adr-memory-range-evaluation.md) |
| [完整范围评估与选取](adr-memory-range-evaluation.md) | 所有者已接受；实现/验证/部署分开 | 简化决定取消资源二分与宿主配额；部署需原有确认，当前节点未核对 | [验证要求](memory-range-evaluation-validation.md)、[台账](project-progress.md) |
| [Memory 必要补问](adr-memory-user-clarification.md) | 已接受；原实现已记录 | 连续批次细化为成功 staging 后保存与可回答问题同事务；等待/补答语义保留 | [原验证](memory-user-clarification-validation.md)、[连续批次](adr-memory-continuous-batch.md) |
| [连续 Memory batch](adr-memory-continuous-batch.md) | 已接受；恢复原生产旅程 | 外部引擎只替换声明阶段；Mote 保留生命周期、授权、独审、最终保存 | [Memory 原平价记录](validation/memory-journey-parity-2026-10-18.md)、[生命周期](memory-lifecycle.md) |
| [证据送达和诚实失败](adr-memory-evidence-delivery-and-failure-state.md) | 所有者已接受 | 原图与解释分开；unknown 和确定失败分开；历史执行授权不泛化 | [原回归](validation/memory-evidence-recovery-2026-10-15.md) |
| [M07 task identity](adr-memory-material-task-identity.md) | 原 candidate 已有后继源码和执行；完整资格仍需对账 | `66a576fd`/shipping port 已入 main；原 81=76P/5F 不改写；不新增产品接受/拒绝投票 | [首次失败](validation/memory-material-fixture-first-failures-2026-10-19.md)、[当前台账](project-progress.md) |
| [旧提案生命周期](adr-memory-proposal-lifecycle.md) | 原死锁修正已接受；现为历史设计/验收 | MVP 取代升级前非法等待的修复路径、旧预算/迁移/工具；当前仍须先交接产品执行、再等待，不恢复旧运行时 | [当前执行器](execution-engine.md)、[旧回归](memory-proposal-lifecycle-validation.md) |
| [统一查询与执行改造](adr-system-refactor.md) | 所有者已接受；验证分开 | 新配方由范围评估/简化决定局部取代；独审、只读查询与单执行器保留 | [历史改造验证](validation/system-refactor-2026-10-10.md)、[生命周期](memory-lifecycle.md) |
| [Ask 覆盖与简化上下文](adr-ask-evidence-quality-and-simple-context.md) | 已采用；自动/模型/部署分别报告 | 取消宿主近似容量与自动二分；实际失败保留范围和诚实状态 | [问答场景](ask-quality-validation.md)、[Agent](agent.md) |
| [结构化页面自动 Memory](adr-ui-page-automatic-memory.md) | 所有者已接受接入 | 已有日常事件后继双向引用；初始页面接入不单独决定更广默认 | [页面指南](ui-page-capture.md)、[原验证](validation/ui-page-automatic-memory-2026-10-10.md) |
| [日常事件 Memory](adr-daily-event-memory.md) | 所有者已接受 | 范围评估增加 daily-event v2；只解释有证据的行为，不从空精选推断没发生 | [日常回顾原验证](validation/daily-event-memory-2026-10-10.md) |

Memory 现状指南仍作为预期合同。已确认进入模型输入的评估时间、旧 Skill 差异及其
工程修复边界见[专项调查](audits/memory-runtime-contract-investigation-2026-10-20.md)，
不能以本台账的“已接受”掩盖运行实现偏离。

## 客户端、展示与动作

| ADR | 决定状态与适用范围 | 后继 / 保留边界 | 现状或原证据入口 |
| --- | --- | --- | --- |
| [Android 页面字段](adr-android-page-fields.md) | 所有者已接受 | 采集前范围预览、字段与中央组织职责保留；不构造手写语义分类 | [页面采集](ui-page-capture.md) |
| [Android 账号偏好](adr-android-account-capture-preferences.md) | 所有者已采纳 | 偏好按当前账号绑定；不能从共享安装继承另一账号自动采集 | [Android 原平价验证](validation/parity-android-20261018.md) |
| [行动优先客户端](adr-client-action-first.md) | 所有者已接受；导航局部被取代 | 展示决定使用 Library 首屏；飞书决定增加第五动作；来源、队列和原生生命周期保留 | [当前导航](client-navigation.md)、[展示决定](adr-ui-presentation-packs.md) |
| [展示包与资料库工作区](adr-ui-presentation-packs.md) | 所有者已接受；执行结果分开 | 领域权限不由 UI 包改变；外观 ADR 增加本机浅/深/系统选项 | [rollout](design/ui-presentation-rollout-2026-10-15.md)、[外观](adr-cross-platform-appearance.md) |
| [跨端外观](adr-cross-platform-appearance.md) | 所有者要求三态外观；原任务禁止合并/部署是当时范围 | 后续源码已集成；物理设备/OEM/辅助功能及实际部署单列 | [外观原验证](validation/cross-platform-appearance.md)、[集成决定](adr-multiuser-main-integration.md) |
| [Actions 发现旅程平价](adr-actions-business-parity.md) | 已接受；保完整发现→审批→执行 | 取代 M12 raw-only 替代；只读 Ask 不得取得隐藏写工具 | [Actions 原验证](validation/parity-actions-2026-10-18.md) |

## 扩展、执行与工程规则

| ADR | 决定状态与适用范围 | 后继 / 保留边界 | 现状或原证据入口 |
| --- | --- | --- | --- |
| [插件与可替换 Memory](adr-plugin-center-memory-replacement.md) | 已接受；一期控制与固定适配器已有实现 | 支持暂停/排空/立即停；Mem0 与 Hindsight 范围分开；原型全本地限制已有后续明确授权 | [插件当前支持](plugin-center.md)、[一期账本](design/plugin-center-phase-one-validation-2026-10-12.md) |
| [扩展旅程平价](adr-extension-journey-parity.md) | 所有者平价要求下已接受 | 配置→真实 probe→启用，停用→无引用卸载；用户绑定 MCP/实例 | [扩展原验证](validation/parity-extensions-20261018.md)、[一般扩展实验](validation/plugin-extension-benchmark/REPORT.md) |
| [任务恢复与执行预算](adr-task-recovery-and-execution-budgets.md) | 所有者已接受并授权统一应用 | 真实容量/外部 unknown 不盲重放；无新历史失败重跑授权 | [当前任务策略](task-execution-policies.md) |
| [作用域处理可靠性](adr-scoped-processing-reliability.md) | 所有者已接受；仅当前执行 | 池公平、资源等待、安全诊断、用量与实例重授权；不授权历史修复 | [原回归](validation/scoped-processing-reliability-2026-10-18.md) |
| [增量检查证据](adr-incremental-check-evidence.md) | 实现已合入；工程预审及资格见原记录 | 同任务完整输入/原回执才复用；不能倒称原实现获预先批准 | [原验证](validation/incremental-check-evidence-2026-10-20.md)、[开发](development.md#pr-check-scope) |
| [Server 测试并行](adr-server-test-parallelism.md) | 已接受；2026-10-20 | 保持套件和断言；性能、实际生命周期覆盖及功能门禁分别记录 | [功能门禁](validation/pr-168-189-191-integration-2026-10-20.md) |
| [Dev 日志保留](adr-dev-log-retention.md) | 授权 Dev 容量变更内已接受 | 诊断保留与生产资料保留独立；不得包含令牌/个人内容 | [日志](raw-logs.md)、[原回归](testing-dev-log-retention.md) |

## 更新规则

新 ADR 加入本表并链接现状指南；修改既有决定时同时在被取代文档写明具体条款和后继。
实现、验收、发布、部署的新证据更新[进度台账](project-progress.md)及原文的有日期后记，
不把历史候选的结果覆写为当前结果。只有确有新产品行为取舍时提交所有者决策；工程
方案审查继续遵守[开发协议](../AGENTS.md)，不以整理文字代替预先批准或实际验证。
