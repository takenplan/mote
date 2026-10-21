# 项目文档索引

Central（server + web）、macOS、Android 使用各自产品版本；当前版本分别记录在 app package.json 与 Android version.properties。拆分架构与发版操作见 [独立发布架构](release-architecture.md) 和 [发布流程](releasing.md)。早期版本曾从 0.8.0 重置到 0.0.1，历史验收应结合日期阅读。

使用指南描述当前代码，历史验收只证明当次执行的范围，方案记录保留当时的取舍。文档中的“本轮”“已通过”和构建产物路径均应结合该篇日期阅读，不代表本次重新验收。当前领域、版本及重点事项从[项目地图](project-map.md)进入；实现、合并、验证和发布/部署分别见[进度台账](project-progress.md)，决定及局部取代关系见[完整 ADR 台账](architecture-decisions.md)。

## 常用入口

| 需要了解什么 | 当前说明 |
| --- | --- |
| 当前项目地图、进度与决定 | [项目地图](project-map.md)、[当前进度与证据](project-progress.md)、[完整 ADR 台账](architecture-decisions.md) |
| 安装、开发、部署与更新 | [项目首页（中文）](../README.zh-CN.md)、[English](../README.md)、[开发](development.md)、[部署](deployment.md)、[更新](updating.md)、[发布](releasing.md)、[Profile 规范](adr-profile-release-policy.md) |
| 采集、隐私和上传 | [统一行为](collection-and-sync.md)、[macOS](desktop.md)、[Android](android.md)、[文字审查与中央感知](central-perception.md)、[同步恢复](sync-recovery.md) |
| 本地 OCR / ASR 与文件 | [运行时和模型安装](ocr-asr-implementation-plan.md)、[文件归档](files.md)、[文件处理](file-processing.md)、[类型策略](file-processing-policies.md) |
| MVP 断代规则与历次清理 | [当前版本合同](project-map.md)、[基线 ADR](adr-mvp-baseline.md)；历史 [10 月 9 日清理](audits/mvp-baseline-cleanup-2026-10-09.md)、[原始审计](audits/compatibility-audit-2026-10-04.md) 与 [83 项实施](audits/compatibility-cleanup-2026-10-04.md) |
| 多用户、配置与生命周期 | [多用户决定](adr-multiuser-scope.md)、[实例/个人配置](configuration-ownership.md)、[配置合同](adr-configuration-journey-parity.md)、[恢复与维护](adr-lifecycle-parity.md)、[原模块与 66 项对账](project-progress.md) |
| 数据、权限、协议 | [架构](architecture.md)、[正式资料](material-architecture.md)、[协议](protocol.md)、[内容加密](content-storage.md)、[资产存储](asset-storage.md) |
| Agent、记忆和行动 | [Agent](agent.md)、[模型配置](model-providers.md)、[生命周期](memory-lifecycle.md)、[记忆更新](memory-updates.md)、[日程](calendar-actions.md)、[行动更新](action-updates.md) |
| 结构化页面与自动 Memory | [采集范围和字段](ui-page-capture.md)、[接入 ADR](adr-ui-page-automatic-memory.md)、[验证边界](validation/ui-page-automatic-memory-2026-10-10.md) |
| 每天看了什么、做了什么 | [日常事件 Memory](adr-daily-event-memory.md)、[日常回顾验证](validation/daily-event-memory-2026-10-10.md) |
| 飞书文档与个人活动 | [接入](lark-integration.md)、[已确认决定](adr-feishu-document-context.md)、[生成场景验收](testing-feishu-document-context.md) |
| 浅色 / 深色 / 跟随系统 | [外观决定](adr-cross-platform-appearance.md)、[验证矩阵](validation/cross-platform-appearance.md) |
| 当前界面、对话和运行状态 | [Slate 导航](ui-slate.md)、[对话](conversations.md)、[Operations](operations.md)、[执行器](execution-engine.md)、[排错](troubleshooting.md) |
| 展示包与界面交付 | [展示决定](adr-ui-presentation-packs.md)、[展示 rollout](design/ui-presentation-rollout-2026-10-15.md)、[10 月 14 日验证](validation/ui-rollout-2026-10-14.md)；后续 UI 清晰度轮次独立见[当前台账](project-progress.md) |
| 2026-10-10 系统改造 | [已确认方案](design/system-refactor-2026-10-10.md)、[当前ADR](adr-system-refactor.md)、[验收结果与边界](validation/system-refactor-2026-10-10.md) |
| 插件中心与可替换记忆一期 | [当前支持](plugin-center.md)、[实施方案](design/plugin-center-phase-one-2026-10-12.md)、[架构决定](adr-plugin-center-memory-replacement.md)、[原验证账本](design/plugin-center-phase-one-validation-2026-10-12.md)；一期控制与固定适配器已有实现，用户隔离及剩余完整资格见[当前台账](project-progress.md) |
| 文档一致性与 Memory 运行差异 | [交叉审阅](audits/documentation-review-consolidated-2026-10-20.md)、[Memory 专项调查](audits/memory-runtime-contract-investigation-2026-10-20.md)、[原逐文件清点](audits/documentation-inventory-2026-10-20.md) |

端侧 Qwen 文档是已删除运行时的历史说明，当前截图不调用 VLM。旧版充电补 OCR、默认加密、签名在线更新及 Memory 的周期 AND 数量门槛不能当作当前默认。现行入口分别见上表。

## 专题与实现说明

下表按文件名索引；部分专题同时保留历史测试章节，其结果不等于当前全量验收。

| 文档 | 内容 |
| --- | --- |
| [action-updates](action-updates.md) | Evidence-backed action updates |
| [agent-prompt-and-startup](agent-prompt-and-startup.md) | Bounded prompts and startup measurements |
| [agent](agent.md) | Agent 配置与权限 |
| [android-bulk-dedupe](android-bulk-dedupe.md) | Android local bulk image deduplication |
| [android-capture-recovery](android-capture-recovery.md) | Android capture recovery and central navigation |
| [android-library-performance](android-library-performance.md) | Android 大资料库性能与格式 4；原测量保留其输入 |
| [android-local-state](android-local-state.md) | Android shared local state |
| [android-native-central](android-native-central.md) | Android 原生中央页面与账号边界 |
| [android-power-optimization](android-power-optimization.md) | Android 采集与同步开销优化 |
| [android-system-events](android-system-events.md) | Android 通知、设备事件与采集记录 |
| [android](android.md) | Android 采集端 |
| [architecture](architecture.md) | Mote 架构 |
| [asset-storage](asset-storage.md) | 原件资产与观察记录 |
| [calendar-actions](calendar-actions.md) | 日程建议与行动平台 |
| [capture-albums](capture-albums.md) | Screenshot sessions and App albums |
| [central-memory](central-memory.md) | 中央导入、记忆与洞察 |
| [central-perception](central-perception.md) | 上传审查与中央感知 |
| [client-navigation](client-navigation.md) | 原生客户端导航与设置 |
| [client-scheduling-and-status](client-scheduling-and-status.md) | Client scheduling and status validation (0.0.61 worktree) |
| [client-settings-and-storage](client-settings-and-storage.md) | 客户端设置与图片保存位置 |
| [cloudflare-tunnel](cloudflare-tunnel.md) | Cloudflare Tunnel 部署 |
| [coding-agent-memory](coding-agent-memory.md) | 编码 Agent 对话与经验记忆 |
| [collection-and-sync](collection-and-sync.md) | 采集、保存与上传 |
| [combined-backup-recovery](combined-backup-recovery.md) | Current-format combined backup and restore fixture |
| [community-extensions](community-extensions.md) | 社区扩展：接入既有处理链 |
| [configuration-ownership](configuration-ownership.md) | 配置归属与执行快照 |
| [connections](connections.md) | 设备配对与独立连接 |
| [connectors](connectors.md) | 中央连接器 |
| [content-storage](content-storage.md) | 内容存储与一次性批量解密 |
| [context-architecture](context-architecture.md) | 通用上下文架构 · 0.0.54 |
| [context-layers](context-layers.md) | 资料分层与渐进式记忆 |
| [conversations](conversations.md) | 对话历史与继续提问 |
| [deployment](deployment.md) | 独立中央节点部署、备份与迁移 |
| [desktop](desktop.md) | Mote 电脑采集器 |
| [development](development.md) | 开发与测试环境隔离 |
| [evidence-reader](evidence-reader.md) | Shared evidence reads |
| [execution-engine](execution-engine.md) | Current durable execution engine |
| [task-execution-policies](task-execution-policies.md) | Central task defaults, admission waiting and failure recovery |
| [delegation-and-activity](delegation-and-activity.md) | 自主委派、逐输入覆盖与活动界面 |
| [execution-protocol](execution-protocol.md) | Execution protocol |
| [feature-packs](feature-packs.md) | Web 展示注册与 scoped 生产能力目录边界 |
| [file-processing-policies](file-processing-policies.md) | 中央文件类型策略 |
| [file-processing](file-processing.md) | 中央文件处理：Cordis 插件与本地多人录音 |
| [files](files.md) | 文件归档与中央处理 |
| [format-workers](format-workers.md) | Bounded format work |
| [gmail](gmail.md) | Gmail 只读来源 |
| [internationalization](internationalization.md) | Interface languages |
| [image-processing](image-processing.md) | 统一图片接入、控制与原图边界 |
| [import-queue](import-queue.md) | 导入准入队列与固定批次恢复 |
| [lark-integration](lark-integration.md) | 飞书文档与日历（服务端只读） |
| [library-plugin-contracts](library-plugin-contracts.md) | 资料库与插件依赖、能力和降级合同 |
| [material-architecture](material-architecture.md) | 接入与正式资料架构 |
| [media-context](media-context.md) | 锁屏、前台与后台媒体上下文 |
| [media-import-pipelines](media-import-pipelines.md) | 中央媒体导入及处理扩展 |
| [memory-admission](memory-admission.md) | 资料、理解产物与精选记忆（0.0.44） |
| [memory-lifecycle](memory-lifecycle.md) | Memory lifecycle |
| [memory-manual-input-plans](memory-manual-input-plans.md) | 手工选择、分组、预览和固定输入计划 |
| [memory-review-policy](memory-review-policy.md) | Bounded memory review reuse |
| [memory-source-disclosure](memory-source-disclosure.md) | Memory 摘要、原句与精确证据的渐进披露 |
| [memory-strategies](memory-strategies.md) | 当前策略组合、版本与宿主责任 |
| [memory-updates](memory-updates.md) | Unified extraction and versioned memory review |
| [mixed-load-stability](mixed-load-stability.md) | Fixed-data mixed-load stability |
| [processing-throughput](processing-throughput.md) | Continuous processing, usage accounting and budget removal |
| [model-providers](model-providers.md) | 中央模型服务 |
| [ocr-asr-implementation-plan](ocr-asr-implementation-plan.md) | 中央 OCR 与录音转写：方案与实施 |
| [operation-import-insight-closure](operation-import-insight-closure.md) | Operation, import, document, and insight closure |
| [operations](operations.md) | Operations read model |
| [persona-memory-evaluation](persona-memory-evaluation.md) | Reproducible medium-horizon memory evaluation |
| [personal-memory-attribution](personal-memory-attribution.md) | 本人表达、第三方、任务和项目归属 |
| [plugin-authoring](plugin-authoring.md) | 当前 Central 插件入口与受支持扩展边界 |
| [privacy-and-metadata](privacy-and-metadata.md) | 应用分级与元数据 |
| [protocol](protocol.md) | 当前 Wire 2 / Ingress 3 操作与数据合同 |
| [provider-failures](provider-failures.md) | Provider failures and host retry |
| [query-output-budget](query-output-budget.md) | 回答截断与输出预算 |
| [raw-logs](raw-logs.md) | 原始日志与日志中心 |
| [release-architecture](release-architecture.md) | Monorepo 内独立发布边界、协议与验证 |
| [releasing](releasing.md) | 发布版本与签名 |
| [Profile 发版 ADR](adr-profile-release-policy.md) | Dev 文件凭据、Prod Beta/正式标签和既有边界的取代关系 |
| [Profile 发版回归](testing-profile-release.md) | 构建、凭据、配对重启、诊断和产物身份的验证矩阵 |
| [server-configuration](server-configuration.md) | 服务端配置参考 |
| [source-pipelines](source-pipelines.md) | 原件归档、正式资料发布和模型处理分工 |
| [sqlite-concurrency](sqlite-concurrency.md) | SQLite process locks |
| [sync-recovery](sync-recovery.md) | 同步机制与恢复设计 |
| [troubleshooting](troubleshooting.md) | 中央节点诊断与排错 |
| [ui-page-capture](ui-page-capture.md) | 页面内容采集与规则贡献 |
| [ui-slate](ui-slate.md) | 当前导航与 Profile 发布边界，历史 Slate 说明分开 |
| [updating](updating.md) | 保留设置地更新 Mote |
| [upload-scheduling](upload-scheduling.md) | Cross-client upload scheduling |
| [upload-processing-decoupling](upload-processing-decoupling.md) | 上传与中央后台处理的独立状态 |
| [usage-and-query-progress](usage-and-query-progress.md) | 对话进度、用量和模型目录 |
| [web-login-and-pairing](web-login-and-pairing.md) | 中央网页登录与设备配对 |

## 历史验收、调查与设计记录

`local-inference`、`memory-trigger-options`、`file-sync-design` 保留早期运行时或方案；现状以关联的操作指南为准。验证材料保留原始通过、失败、未执行与生成素材/真实模型/真机范围，不追溯改写历史结论。

| 文档 | 内容 |
| --- | --- |
| [系统改造 ADR](adr-system-refactor.md) | 已确认的统一查询、滚动 Memory 合批、审核恢复与前后台隔离决定 |
| [任务恢复与执行预算 ADR](adr-task-recovery-and-execution-budgets.md) | 按任务类型注册宽松期限、资源等待、模型反馈修正和失败分类原则 |
| [作用域处理可靠性 ADR](adr-scoped-processing-reliability.md) | 跨端资源排队、Memory 阶段公平性、安全诊断、独立用量片段与实例重新授权；[本次验证](validation/scoped-processing-reliability-2026-10-18.md) 单独记录 |
| [范围评估与模型选取 Memory ADR](adr-memory-range-evaluation.md) | 完整原件、逐范围评估、独立审核、模型选取、资源恢复与旧任务契约边界 |
| [范围评估回归矩阵](memory-range-evaluation-validation.md) | 新旧入口、选取与未完成状态、实际资源恢复、授权和重启场景；执行结果单独记录 |
| [系统改造方案（2026-10-10，已确认）](design/system-refactor-2026-10-10.md) | 14模块变更、5组选型、旅程、supersession和发布路线；拟议收益不是实测结果 |
| [系统改造验证方案](design/system-refactor-validation-2026-10-10.md) | 22条真实入口旅程、质量rubric、同模型性能对照与发布门槛；结果见本次验收记录 |
| [问答证据与简化上下文决定](adr-ask-evidence-quality-and-simple-context.md) | 模型覆盖、移除近似预算与二分、录音时间/正文、质量实验与实际恢复边界 |
| [跨来源状态问答回归](ask-quality-validation.md) | 多来源与续问的生成资料场景、固定输入比较方法、证据覆盖和验证边界 |
| [大范围续问与 Memory 启动回归](validation/query-lease-and-memory-activation-2026-10-14.md) | 完整依赖批量授权、租约续期、删除栅栏与显式启动后的重启恢复；生成 HTTP/provider 回归证据 |
| [Memory 证据送达与失败状态决定](adr-memory-evidence-delivery-and-failure-state.md) | 整合 A、独立图片证据、真实失败和有界回执；保留历史执行授权边界 |
| [Memory 证据链路修复回归](validation/memory-evidence-recovery-2026-10-15.md) | 完整入口、状态转换、生成夹具和隔离真实数据验收 |
| [0.0.13-validation](0.0.13-validation.md) | 0.0.13 验证记录 |
| [0.0.2-validation](0.0.2-validation.md) | 0.0.2 验收记录 |
| [0.0.3-validation](0.0.3-validation.md) | 0.0.3 验收记录 |
| [0.0.4-validation](0.0.4-validation.md) | 0.0.4 验收记录 |
| [0.0.5-validation](0.0.5-validation.md) | 0.0.5 验收记录 |
| [0.0.6-validation](0.0.6-validation.md) | 0.0.6 Android 升级无响应修复 |
| [agent-context-validation](agent-context-validation.md) | Agent 上下文与任务架构验证（0.0.43） |
| [backend-plugin-rearchitecture](backend-plugin-rearchitecture.md) | 历史后端重构工作稿；适用取代范围见文首 |
| [central-memory-validation](central-memory-validation.md) | 中央 Memory 工作流验证 |
| [client-background-audit](client-background-audit.md) | Android / mac 客户端 UI 阻塞盘点 |
| [client-feedback-validation](client-feedback-validation.md) | 客户端状态反馈复查 |
| [client-login-unification](client-login-unification.md) | 历史单所有者统一登录；当前认证见 M01 |
| [client-login-unification-validation](client-login-unification-validation.md) | 原统一登录验证，不证明当前多用户旅程 |
| [coding-agent-validation](coding-agent-validation.md) | Coding Agent 验收记录（2026-09-17） |
| [connection-validation](connection-validation.md) | 0.6.0 连接与统计验证 |
| [context-architecture-validation](context-architecture-validation.md) | 0.0.56 架构升级验证 |
| [file-sync-design](file-sync-design.md) | 已实现的处理扩展 |
| [file-sync-validation](file-sync-validation.md) | 0.0.18 Cordis 与录音处理增量验收 |
| [documentation-review-2026-09-24](documentation-review-2026-09-24.md) | 当日文档一致性审阅 |
| [goal-validation](goal-validation.md) | 真实上下文 MVP 的原输入和验收边界 |
| [harness-upgrade-validation](harness-upgrade-validation.md) | Harness / Cordis 原升级验证 |
| [ingress-prefix-503-validation](ingress-prefix-503-validation.md) | Linux ingress 前缀与 host-bind 503 原回归 |
| [issue-2-validation](issue-2-validation.md) | Issue 2 验收工作记录 |
| [issue-3-validation](issue-3-validation.md) | Issue #3 / 0.0.38 |
| [issue-4-client-settings](issue-4-client-settings.md) | Issue #4: client settings and central archive |
| [live-validation](live-validation.md) | Mote 0.2.1：真实模型与复杂链路验收 |
| [local-inference](local-inference.md) | 本机千问视觉审查与通用任务运行时 |
| [media-validation](media-validation.md) | 媒体上下文验证记录 |
| [memory-admission-validation](memory-admission-validation.md) | Memory admission validation — 0.0.44 |
| [memory-batch-context-validation](memory-batch-context-validation.md) | 原批次上下文回归；后继范围/简化决定另看 |
| [memory-context-reading-validation](memory-context-reading-validation.md) | 原件上下文读取回归 |
| [memory-proposal-lifecycle-validation](memory-proposal-lifecycle-validation.md) | 历史提案等待修复与原执行结果 |
| [memory-user-clarification-validation](memory-user-clarification-validation.md) | Owner question、等待及补答原验证 |
| [memory-trigger-options](memory-trigger-options.md) | Memory 整理与洞察触发：决策备忘 |
| [memory-validation-0.0.31](memory-validation-0.0.31.md) | Memory 生命周期验收（0.0.31） |
| [memory-validation-diagnostics](memory-validation-diagnostics.md) | Memory validation diagnostics |
| [operations-validation](operations-validation.md) | 0.3.0 部署、环境隔离与诊断验证 |
| [privacy-metadata-validation](privacy-metadata-validation.md) | 0.7.0 分级采集与元数据验证 |
| [review-2026-09-23](review-2026-09-23.md) | 项目复查、修复与场景验证（2026-09-23） |
| [review-upload-sync-2026-09-23](review-upload-sync-2026-09-23.md) | Upload and synchronization review — 2026-09-23 |
| [session-preview-validation](session-preview-validation.md) | Session 与压缩预览验证 |
| [sources-validation](sources-validation.md) | Mote 0.4.0：来源与记忆验收记录 |
| [testing-0.0.61](testing-0.0.61.md) | 0.0.61 验证记录 |
| [tunnel-validation](tunnel-validation.md) | 0.3.1 服务端配置与 Tunnel 验证 |
| [ui-page-research](ui-page-research.md) | 页面采集：实践调研与实现决策 |
| [update-validation](update-validation.md) | 0.5.1 发布与更新验证 |
| [0.0.59](validation/0.0.59.md) | 0.0.59 分层上下文与响应性能验证 |
| [0.0.60](validation/0.0.60.md) | 0.0.60 分层上下文与响应性能验证 |
| [development-history](validation/0.0.61/development-history.md) | 0.0.61 验证记录（发布前工作记录） |
| [persona-memory-results](validation/2026-09-23/persona-memory-results.md) | Persona 长周期记忆评估 |
| [recorder-connectors-design](recorder-connectors-design.md) | 录音笔接入原旅程、样本与账号验证边界 |
| [testing-archive-recency](testing-archive-recency.md) | 原归档问答新近度与阶段覆盖 |
| [testing-central-discovery](testing-central-discovery.md) | 中央发现与高级操作旅程 |
| [testing-dev-log-retention](testing-dev-log-retention.md) | Dev 诊断保留原回归 |
| [testing-evidence-history-retention](testing-evidence-history-retention.md) | 普通修订、历史保留和隐私删除原验证 |
| [testing-recording-canonical-parity](testing-recording-canonical-parity.md) | scoped 录音正式输入及音频备份回归 |
| [testing-recording-source-context](testing-recording-source-context.md) | 录音来源说明原回归 |
| [testing-web-background-refresh](testing-web-background-refresh.md) | Web 后台刷新稳定性原回归 |
| [testing-web-login-handoff](testing-web-login-handoff.md) | Web ticket 证据交接原回归 |
| [validation](validation.md) | Mote 0.2.0 基线验收记录 |
| [web-login-validation](web-login-validation.md) | 0.0.9 登录、页面职责与配对验证 |

## 发布记录与 Agent Skill

[release/notes](../release/notes/) 按发布版本保留变更记录，不是当前使用手册；[Agent Skills](../packages/agent/skills/) 是运行时任务说明，受代码的只读工具、范围及宿主提交校验约束。[AGENTS.md](../AGENTS.md) 是仓库开发约束，[第三方说明](../THIRD_PARTY_NOTICES.md) 标明依赖与许可证来源。
