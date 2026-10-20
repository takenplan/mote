# 项目地图

更新：2026-10-20。源码核对基线：`af11ab7c3e9fb5f38deaea4e4bae11462a7306b4`。
本文是当前系统、决定和事项的入口；实现、合并、验证、发布和部署证据见
[进度台账](project-progress.md)。GitHub 状态采用该日审计的只读快照，不是实时看板。

## 产品与系统

Mote 是 AI-native 的个人上下文采集器和中央归档。macOS、Android 及中央来源接入
保留原件，中央生成可检索的正式资料；Memory、回顾与 Ask 使用获授权的证据。
模型解释语义并选择检索工具；确定性代码负责授权、传输、去重、版本、保留和计量。
捕获内容是不可信证据，查询 Agent 只获得只读上下文工具。

一个中央写入实例通过共享 SQLite、服务和执行器承载相互隔离的账号。
管理员管理部署、账号和实例资源，管理权限不授予其他账号的私人资料 API 读取权。
设备凭据用于绑定账号的采集与同步，中央私人页面另行登录；MCP 使用独立限权凭据。
生产从 `apps/server/src/app.ts` 进入 `buildScopedApp`，旧单所有者组合只作显式测试 fixture。

| 独立合同 | 当前源码值 | 权威与操作说明 |
| --- | --- | --- |
| Central 存储 | epoch 5 | [多用户边界](adr-multiuser-scope.md)、[架构](architecture.md) |
| 客户端 Wire / 采集 Ingress | 2 / 3 | [机器合同](../protocol/contract.json)、[握手说明](../protocol/README.md)、[操作协议](protocol.md) |
| Desktop / Android 本机格式 | 4 / 4 | [客户端设置与存储](client-settings-and-storage.md)、[同步恢复](sync-recovery.md) |
| 个人 portable archive | 3 | [生命周期](adr-lifecycle-parity.md)、[部署与恢复](deployment.md) |
| 完整实例备份 manifest | 2 | [完整备份与恢复](deployment.md)；不同于个人 portable archive |
| 组件版本声明 | Central 0.0.90；Desktop 0.0.88；Android 0.0.89（code 100） | app package/version 文件；声明不证明安装包或节点含本基线 |

MVP 只读写当前格式，拒绝旧版本，不增加迁移或双读路径。合同版本、组件版本和发布
Profile 分开管理。Dev 是按提交保留的 Actions artifact，Beta/正式标签使用 Prod；历史
DEV Release 保留其当时事实。运行节点、安装版本和系统权限本轮没有核对。

## 领域地图

模块编号保留最初 M00–M16 的责任映射；它们不是当前完成率。原验收要求见
[模块计划](design/multiuser-modules.md)，当前实现与剩余资格见[进度台账](project-progress.md)。

| 领域 / 模块 | 当前责任 | 当前指南与决定 |
| --- | --- | --- |
| 账号与私人数据 M00–M02 | 可信账号上下文、会话与凭据、私人 SQL/索引边界 | [架构](architecture.md)、[多用户 ADR](adr-multiuser-scope.md)、[账号设计](design/multiuser-auth.md) |
| 接入 M03，Desktop M14，Android M15 | 本机采集、隐私、离线队列、账号绑定、原件传输与 ACK | [采集与同步](collection-and-sync.md)、[配对](connections.md)、[Desktop](desktop.md)、[Android](android.md) |
| 配置与执行 M04–M05 | 实例/个人配置、模型与用量、一个持久执行器、授权和公平调度 | [配置归属](configuration-ownership.md)、[服务端配置](server-configuration.md)、[执行器](execution-engine.md)、[任务策略](task-execution-policies.md) |
| 处理与正式资料 M06 | 共享权重、账号任务、OCR/ASR/图像理解、版本化 Material 与证据 | [文件](files.md)、[资料架构](material-architecture.md)、[媒体运行时](ocr-asr-implementation-plan.md) |
| Memory M07 | 连续 batch、独立策略与审核、正文/检索替换、暂停及发布协调 | [生命周期](memory-lifecycle.md)、[策略](memory-strategies.md)、[插件中心](plugin-center.md)、[连续批次决定](adr-memory-continuous-batch.md) |
| Ask 与产品界面 M08、M13 | 只读查询、对话、洞察、委派、引文、账号切换和迟到响应保护 | [Agent](agent.md)、[对话](conversations.md)、[导航](client-navigation.md)、[历史保留](adr-evidence-history-retention.md) |
| 扩展、连接与动作 M09–M12 | 管理员可信包、用户实例、外部来源、限权 MCP、独立写授权 | [插件开发](plugin-authoring.md)、[连接器](connectors.md)、[飞书](lark-integration.md)、[行动](calendar-actions.md) |
| 生命周期 M16 及各域 | 删除、保留/容量、个人导出、完整实例备份恢复、更新与诊断 | [生命周期决定](adr-lifecycle-parity.md)、[部署](deployment.md)、[更新](updating.md) |

## 交付与剩余事项

| 事项 | 本基线可确认的进展 | 下一步 / 证据边界 |
| --- | --- | --- |
| 多用户与第二轮业务恢复 | 生产已装配账号域；汇总 [PR 184](https://github.com/utopiafar/mote/pull/184) 的 merge `9a8717c3` 在基线中 | 按台账对齐 66 项原要求和后继证据；完整旅程、设备和模型资格分开记录 |
| 后续清理、检查器和 Memory 修复 | PR 168/186/187/188/189/191/192/193 已进入基线 | [最近功能门禁](validation/pr-168-189-191-integration-2026-10-20.md) 被测 runtime `0696be48`，23 项新执行通过；这是原记录，不是本次重跑 |
| 固定 Memory 适配器与一般扩展 | 插件一期已有固定适配器；扩展实验 PR 183 已合入 | [一期账本](design/plugin-center-phase-one-validation-2026-10-12.md)与一般扩展实验分别看；原 0/5、NOT RUN、SQLite UNKNOWN 不据此关闭 |
| Memory 时间与策略入口 | `af11ab7c` 的 U1/U2 原发现保留；后续独立候选 `c9b6c116` 已有方案批准、I1/I2 源码复核与分候选生成 fixture 证据 | [修复 PR](https://github.com/utopiafar/mote/pull/203)、[验证记录](https://github.com/utopiafar/mote/blob/42cd862ac5c025803276466145526948f75c0976/docs/validation/memory-evaluation-context-restoration-2026-10-20.md)及[有日期后记](project-progress.md#2026-10-20-u1u2-后续候选)；main 合入与部署分别核对，不关闭 MEM-Q1 或原质量缺口 |
| 原图片 Memory 保存及客户端接缝 | 已有有限范围修复和验证，原旅程完整闭环未证实 | 先找相同输入/状态的后继证据，再限定补验；不自动重放付费或未知结果任务 |
| UI 清晰度、DSH 兼容 | 审计快照中 PR 185、190 为草稿，分别 0/15 轮、阶段 1/4 | 独立跟踪，不计入已交付 UI/插件一期；具体 head 和范围见台账 |
| 发布、安装与部署 | 部分旧标签发布事实已核对 | 不从 main 合入推断节点更新；安装包、真实账号和运行版本保持未核对 |

这里不合成全项目百分比。局部通过只关闭其实际覆盖的断言，源码合入不能代替完整
用户旅程。新执行、原结果引用和驱动证明可复用的证据分别标注；检查要求见
[开发指南](development.md#pr-check-scope)。

## 文档职责与维护

- 本地图负责当前入口、领域职责、独立版本合同和重点剩余工作。
- [进度台账](project-progress.md)按稳定事项连接预期决定、实现/merge、原验证及未验、发布/部署和下一动作；新证据更新对应行及核对日期。
- [ADR 台账](architecture-decisions.md)收录决定和局部取代关系；指南描述当前操作，实现偏差另列问题，不改写为获准政策。
- 计划、审计和验收保留原 base/head、通过/失败/未运行及设备/模型边界；新增有日期的后记链接后继证据，不追溯修改原结论。
- `scope-inventory.json` 是检查器的可执行边界声明；旧 55 项 JSON 是带版本的历史清单；聊天和本地 PM/driver 文件是检查点，不单独代表全项目现状。

本轮整理依据见[交叉审阅](audits/documentation-review-consolidated-2026-10-20.md)和
[原逐文件清点](audits/documentation-inventory-2026-10-20.md)。本文整理源码与既有证据，
未据此运行新应用测试、真实模型、物理设备或部署。
