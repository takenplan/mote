# 当前项目进展与证据台账

更新时间：2026-10-20。源码固定为 `af11ab7c3e9fb5f38deaea4e4bae11462a7306b4`；本页整理静态源码、Git 祖先关系和已有原始记录，**本次没有执行应用测试、模型、设备或部署检查**。动态 PR/Release 读回限定[本轮进展审计](audits/project-map-and-progress-review-2026-10-20.md)的北京时间 17:17 检查点，后续变化需重新核对。项目概览见[项目地图](project-map.md)；审阅依据见[交叉验证](audits/documentation-review-consolidated-2026-10-20.md)。

本页是当前对账入口。原计划负责要求、ADR 负责决定、原验证记录负责各自冻结输入的结果；旧聊天/driver 的 RUNNING、HOLD、Draft 或禁止当轮合并，不是今天的调度授权。`scope-inventory.json` 继续是检查器的边界输入，不承担进度表职责。未在本页写为通过的断言，不因实现或合入而自动关闭。

## 状态和交付基线

- **决定**：已接受的产品/责任合同。F11 的密码重登后恢复未来策略、AND-D01 账号偏好等已有决定，不重新投票。
- **实现与 main**：具体源码及祖先关系；不表示所有用户旅程已合格。
- **验证**：保留实际 candidate/base、入口、输入、原回执、失败/跳过/未运行与消费者范围；本页引用不是新执行，也不是检查回执复用。
- **发布／部署**：分别核对具体标签、资产和运行节点。较早发布不能代表本页源码已部署；本次未核对节点版本。

PR 184 已于北京时间 2026-10-20 10:34 合入 main，merge `9a8717c325da04cb4346804457114b7327033394`。下表 12 个业务 shipping head 均为本页源码祖先；PR 170–182 的 13 项还包含工具项，整体交付与后继功能检查见[集成附录](validation/plugin-extension-benchmark/integration-current-host-2026-10-20.md)。这关闭“源码尚未进入 main”的旧描述，不关闭全部 66 行资格。

| 功能检查记录 | 精确输入与原结果 | 仍不证明 |
| --- | --- | --- |
| PR184 后继集成 | base `2c78ca8d52a7d17fae20962cf68d09a717ffc73a` → runtime `f92fec719dd51f7d2c28591229bc9f6e20605e6c`；[原附录](validation/plugin-extension-benchmark/integration-current-host-2026-10-20.md)记录 23/23 阶段 PASS、原失败及 SKIP 保留 | 五轮完整案例从 0/5 变为全通过、SQLite UNKNOWN 根因解决或全部原生/真实模型旅程 |
| 后续功能门禁 | base `301b5941e2d451e46710befb23a5398a089b24e7` → runtime `0696be480f0946bb554bcccb54407e04bf6762af`；[原记录](validation/pr-168-189-191-integration-2026-10-20.md#final-passed-functional-gate)为 23 项新执行 PASS、receipt `c85ab202-e76e-446e-ae93-81ce6ae62d0e`，十项测试 SKIP 保留 | 本次审阅重新执行；完整 66 行、物理设备、真实 LLM/embedding、个人资料或生产部署 |

## 原多用户模块与后继恢复

[M00–M16 原计划](design/multiuser-modules.md)保留原依赖、要求和阶段，已不代表仅 M00 health 的生产空壳。原模块的文档入口如下；记录齐备或名称含 final，不等于每个原断言全通过。涉及后继变动时同时核对下一表与逐行事项。

| 稳定模块 | 职责 | 原验证入口 | 当前对账 |
| --- | --- | --- | --- |
| M00 | 作用域基础 | [M00 原记录](validation/multiuser-m00-scope.md) | 源码已进入 scoped 主线；原验收与后继恢复分别核对 |
| M01 | 账号认证 | [M01 原记录](validation/multiuser-m01-auth.md) | 源码已进入 scoped 主线；原验收与后继恢复分别核对 |
| M02 | 私人数据 | [M02 原记录](validation/multiuser-m02-private-data.md) | 源码已进入 scoped 主线；原验收与后继恢复分别核对 |
| M03 | Ingress/原件 | [M03 原记录](validation/multiuser-m03-ingress.md) | 源码已进入 scoped 主线；原验收与后继恢复分别核对 |
| M04 | 配置模型用量 | [M04 原记录](validation/multiuser-m04-configuration.md) | 源码已进入 scoped 主线；原验收与后继恢复分别核对 |
| M05 | 执行器 | [M05 原记录](validation/multiuser-m05-execution.md) | 源码已进入 scoped 主线；原验收与后继恢复分别核对 |
| M06 | Processing | [M06 原记录](validation/multiuser-m06-processing.md) | 源码已进入 scoped 主线；原验收与后继恢复分别核对 |
| M07 | Memory | [M07 原记录](validation/multiuser-m07-memory.md) | 源码已进入 scoped 主线；原验收与后继恢复分别核对 |
| M08 | Ask | [M08 原记录](validation/multiuser-ask.md) | 源码已进入 scoped 主线；原验收与后继恢复分别核对 |
| M09 | Plugins | [M09 原记录](validation/multiuser-m09-plugins.md) | 源码已进入 scoped 主线；原验收与后继恢复分别核对 |
| M10 | Connectors | [M10 原记录](validation/multiuser-m10-connectors.md) | 源码已进入 scoped 主线；原验收与后继恢复分别核对 |
| M11 | MCP | [M11 原记录](validation/multiuser-m11-mcp.md) | 源码已进入 scoped 主线；原验收与后继恢复分别核对 |
| M12 | Actions/Todo | [M12 原记录](validation/multiuser-actions.md) | 源码已进入 scoped 主线；原验收与后继恢复分别核对 |
| M13 | Web | [M13 原记录](validation/multiuser-m13-web.md) | 源码已进入 scoped 主线；原验收与后继恢复分别核对 |
| M14 | Desktop | [M14 原记录](validation/multiuser-desktop.md) | 源码已进入 scoped 主线；原验收与后继恢复分别核对 |
| M15 | Android | [M15 原记录](validation/multiuser-android.md) | 源码已进入 scoped 主线；原验收与后继恢复分别核对 |
| M16 | 生命周期/备份 | [M16 原记录](validation/multiuser-m16-lifecycle.md) | 源码已进入 scoped 主线；原验收与后继恢复分别核对 |

第二轮恢复的责任域、准确 shipping head 和原证据如下。原模块负责人以[历史 owner 登记](design/multiuser-parity-restoration-plan.md#模块所有权与候选登记)定位；该引用用于追溯，不唤醒旧聊天或恢复其执行槽位。

| 责任域 | shipping head / PR（已是 main 祖先） | 当前源码职责入口 | 原分范围证据 | 剩余核对重点 |
| --- | --- | --- | --- | --- |
| MEM / Memory | `6f44fc26b79e71a2ac43ccd667ab192cbe6d6744` / [#177](https://github.com/utopiafar/mote/pull/177) | [server/src/scope/memory.ts](../apps/server/src/scope/memory.ts) | [原记录](validation/memory-journey-parity-2026-10-18.md) | 提取/独审/保存、成功复用、双域和图片失败按同一旅程映射 |
| FILE / Files | `f29ffd94b6cdfccbffbafe248ead37d057fce7de` / [#176](https://github.com/utopiafar/mote/pull/176) | [server/src/scope/processing.ts](../apps/server/src/scope/processing.ts) | [原记录](validation/parity-files-2026-10-18.md) | 原时间/设备、reference/归档/配方、目录导入与客户端接缝 |
| ASK / Ask | `a0215837f71bda236dc2c719a07e963a44bf7f6f` / [#179](https://github.com/utopiafar/mote/pull/179) | [server/src/scope/ask.ts](../apps/server/src/scope/ask.ts) | [原记录](validation/parity-ask-2026-10-18.md) | 语义召回、披露依赖、失败轮次与外部分页的实际读写边界 |
| CONN / Connectors | `a562a1f2cd76ed905a2c556e0e99aa4b6844eab0` / [#178](https://github.com/utopiafar/mote/pull/178) | [server/src/scope/connectors.ts](../apps/server/src/scope/connectors.ts) | [原记录](validation/connector-parity-2026-10-18.md) | 周期失败恢复、规范录音、音频复用与原生阶段状态 |
| EXEC / Execution | `070ffc04a859d01551674070cdf16551a2c29928` / [#171](https://github.com/utopiafar/mote/pull/171) | [server/src/scope/task-execution.ts](../apps/server/src/scope/task-execution.ts) | [原记录](validation/execution-parity-2026-10-18.md) | 真实父子链、交互/后台公平性、动态并发与跨池发布 |
| CONFIG / Configuration | `2aa08c862087532807b22bada91545ebc69a6720` / [#180](https://github.com/utopiafar/mote/pull/180) | [server/src/scope/configuration.ts](../apps/server/src/scope/configuration.ts) | [原记录](validation/configuration-parity-2026-10-18.md) | 草稿/秘密复用、快照/撤权、Codex 配置、用量及专用 UI |
| DESKTOP / Desktop | `55b40d37a4948fd40db194f6448b92ac1a287db8` / [#182](https://github.com/utopiafar/mote/pull/182) | [desktop/src/source-sync.ts](../apps/desktop/src/source-sync.ts) | [原记录](validation/desktop-parity-2026-10-18.md) | 真实 D1–D4、离线/迟到 ACK、权限/TCC 与中央接缝 |
| AND / Android | `2622844e3b226f3ebae9542bdb16aafedc5cf3a7` / [#172](https://github.com/utopiafar/mote/pull/172) | [android/app/src/main/java/dev/mote/collector/AccountBinding.kt](../apps/android/app/src/main/java/dev/mote/collector/AccountBinding.kt) | [原记录](validation/parity-android-20261018.md) | 实际 App/Worker、偏好账号切换、409/410 与日历写入 |
| WEB / Web | `f8f684b6dee904d820b9952ead336da5a33f330f` / [#170](https://github.com/utopiafar/mote/pull/170) | [web/src/features/system.tsx](../apps/web/src/features/system.tsx) | [原记录](validation/multiuser-parity-restoration-matrix.md#web) | 原可见子范围、后继 Chrome 失败、动态扩展及完整组合分别核对 |
| EXT / Extensions | `5a5ed7bfeaf1c33409c84bdb6ba906e4e103763a` / [#175](https://github.com/utopiafar/mote/pull/175) | [server/src/scope/plugins.ts](../apps/server/src/scope/plugins.ts) | [原记录](validation/parity-extensions-20261018.md) | 实际 probe、停用/卸载、MCP 无状态/一次导入和协议范围 |
| ACTION / Actions | `2689e88d7ac2a58257903021d4224cd13bcd3c81` / [#181](https://github.com/utopiafar/mote/pull/181) | [server/src/scope/actions.ts](../apps/server/src/scope/actions.ts) | [原记录](validation/parity-actions-2026-10-18.md) | 完整语义 producer、同批批准、成功检查点及原生日历 WRITE |
| LIFE / Lifecycle | `b30c2cb5e1de4bcd1082c0ef2c7185fe6b42f70a` / [#174](https://github.com/utopiafar/mote/pull/174) | [server/src/scope/lifecycle-operations.ts](../apps/server/src/scope/lifecycle-operations.ts) | [原记录](validation/parity-lifecycle.md) | 启动/小时维护、容量、导出、密码登录后的未来恢复与 unknown |

## 恢复事项逐行对账

以下 66 个 ID 继承[原矩阵](validation/multiuser-parity-restoration-matrix.md)的完整要求、依赖和输入。原主行状态分布为 **58 OPEN、2 VISIBLE_MAC_SUBSCOPE_PASS、3 UNKNOWN、2 IN_PROGRESS、1 OUTSIDE**，合计 66；58 核心加 8 个补充/旧缺陷/体验行。全文 PASS/READY/UNRUN 出现次数不是该分布。

每行同时标出 shipping head（完整 SHA 见上表）及原记录中的具名入口/用例。领域记录的开发期 focused 结果仍属于其各自冻结输入，不因链接到 shipping head 就重标为该 head 的新执行；主门禁和实际模型/原生子范围按原矩阵分别绑定。当前门禁不覆盖的图片失败、原生首次 WRITE、D1–D4/TCC、unknown/撤权和配置跨 await 状态继续保留。表内下一步是证据对账要求，不是自动发起整套重跑或付费历史任务。

| ID | 原要求 / 责任域 | 原主行记录 | 具体入口／原证据及交付来源 | 未闭合与下一步 |
| --- | --- | --- | --- | --- |
| MEM-M01 | 完整提取输出合同 / MEM | `OPEN` | 交付 `6f44fc26b79e`；[领域原记录](validation/memory-journey-parity-2026-10-18.md)：`scoped-memory-parity.test.ts` 捕获提取和独审的共享完整输出合同/示例；原 Memory M01 行及连续批次回归。 | 核对真实模型请求是否保留完整字段/引文/coverage；不能仅从门禁通过推定语义合同逐条已达。 |
| MEM-M02 | 同任务主动补读 / MEM | `OPEN` | 交付 `6f44fc26b79e`；[领域原记录](validation/memory-journey-parity-2026-10-18.md)：同文件跨批 `context_evidence`、双账号同 ID、外账号拒绝、已读原句依赖与未读 catalog 区别、删除/重启；原 M02 行和 metadata fence 场景。 | 缺真实模型主动补读的本行完整对应证据；保持 unread-body 修订与已披露元数据改变的不同 fence。 |
| MEM-M03 | 未完成评估与同任务重试 / MEM | `OPEN` | 交付 `6f44fc26b79e`；[领域原记录](validation/memory-journey-parity-2026-10-18.md)：`scoped-memory-parity.test.ts` 的合法空、漏 coverage、incomplete+部分候选、重启同 job retry；旧 `855b89a0` 整轮 Server 3169P/52F/2skip 保留。 | 后继消费者已按连续 batch 更新；逐输入核对未完成范围不发布、成功兄弟 task/attempt 不重跑，不把旧 52F 改绿。 |
| MEM-M04 | 自动双域整合 / MEM | `OPEN` | 交付 `6f44fc26b79e`；[领域原记录](validation/memory-journey-parity-2026-10-18.md)：`multiuser-memory-integration-domains.test.ts` 实际 personal/coding 分流；一域失败、另一域提交，重启/同 job retry 保留成功域。 | 核对同一原件双域自动触发的实模输出及最终消费；不能以 settings.profile 单值覆盖另一域。 |
| MEM-M05 | 整合仅已选长期 Memory / MEM | `OPEN` | 交付 `6f44fc26b79e`；[领域原记录](validation/memory-journey-parity-2026-10-18.md)：原 M05 行：observation 不产生整合窗口或计入 minChanges；oversized publication 使用冻结 successor，含 due wait/restart/cancel/stop。 | 分别核对 observation-only 与 selected Memory 的自动整合；大批 successor 不等于把观察转成长期记忆。 |
| MEM-M06 | Coding 理解准备与 work/event 产物 / MEM | `OPEN` | 交付 `6f44fc26b79e`；[领域原记录](validation/memory-journey-parity-2026-10-18.md)：`multiuser-memory-coding-preparation.test.ts`：真实 Coding ingress，严格复用2次与缺口非复用3次调用；两session+普通输入成3批。旧 `1c9be37b` F02/F03 经独审退回。 | 按 source/device/provider/project/session、完整 candidate coverage 和独审绑定核对；重启复用与取消/删除/停号晚到不能跨批。 |
| MEM-M07 | 引文错误顺序与安全诊断 / MEM | `OPEN` | 交付 `6f44fc26b79e`；[领域原记录](validation/memory-journey-parity-2026-10-18.md)：原 M07 行及同 scoped parity 用例：提取与独审先报 quote_not_found，再做 quote-backed coverage；诊断保留 phase/run/candidate/span，不留正文。 | 核对错误顺序、失败独审不抹已成功提取和无敏感诊断；缺真实长输入失败的逐例映射。 |
| MEM-M08 | 持续模型积压下及时发布 / MEM | `OPEN` | 交付 `6f44fc26b79e`；[领域原记录](validation/memory-journey-parity-2026-10-18.md)：原 M08/F01：8个生成原件在 provider gate 下仍有 backlog 时首批已可搜；一个 memory.batch 存 draft/review/prepared/saved；原 `1c9be37b` 三task设计已退回。 | 需冻结 EXEC 依赖证明>2模型并发及积压时及时保存；`855b89a0` 失败与后继 consumer 修正分开，实模图片保存原失败保留。 |
| FILE-01 | 权威设备与资料时间投影 / FILE | `OPEN` | 交付 `f29ffd94b6cd`；[领域原记录](validation/parity-files-2026-10-18.md)：`multiuser-files-material-parity.test.ts`：HTTP source→native上传→processing→Ask 按原设备/三类时间过滤→restart，同ID A/B。 | 核对旧日期今日处理、修订、端侧显示和真实消费者；fixture关联 attachment 使用受信宿主 port，并非公开关系修改API。 |
| FILE-02 | 原件归档与处理方案分离 / FILE | `OPEN` | 交付 `f29ffd94b6cd`；[领域原记录](validation/parity-files-2026-10-18.md)：同 material-parity 用例：archive+caption、OCR/understanding pending→named products→父组合；含真实archive-only、自定义理解-only及named OCR。 | 保留原图片实际保存失败；自定义recipe/caption、并发保留+处理和原生历史回补冲突须逐输入对账。 |
| FILE-03 | 原位置缺失仍可读中央归档 / FILE | `OPEN` | 交付 `f29ffd94b6cd`；[领域原记录](validation/parity-files-2026-10-18.md)：`multiuser-file-catalog-parity.test.ts`：archive→deleted revision→list/detail/chunks/playback/export→reference→restart→forget/ticket拒绝。 | 仅fresh/新portable保留head旅程；既有epoch5 deleted head无持久身份的主列表仍未修，不回填/猜排序，也不声称物理删除。 |
| FILE-04 | reference/Shadow 元数据目录 / FILE | `OPEN` | 交付 `f29ffd94b6cd`；[领域原记录](validation/parity-files-2026-10-18.md)：同 catalog-parity 用例：native/source-item metadata-only→list/detail，无original能力，A/B同ID路径/游标、restart/forget。 | `FilesCatalogParityInstrumentedTest` 等原生消费者分别核对；后端fixture启动不代替Activity和OS实际路径。 |
| FILE-05 | 管理员目录预览确认导入 / FILE | `OPEN` | 交付 `f29ffd94b6cd`；[领域原记录](validation/parity-files-2026-10-18.md)：`scoped-admin-directory.test.ts`：管理员目录→归档→preview→confirm→publish；双admin同path/request、cancel/delete/restart、预览后目录消失。 | ordinary/vault/symlink/缺失/非目录拒绝有具名fixture；仍缺真实部署权限和完整UI确认范围，不能按旧“无路由”处理。 |
| FILE-06 | 按相对路径搜索文件 / FILE | `OPEN` | 交付 `f29ffd94b6cd`；[领域原记录](validation/parity-files-2026-10-18.md)：catalog-parity、`multiuser-snapshot-recovery.test.ts`、Desktop `multiuser-desktop.test.ts`：relativePath字面命中、账号/游标、snapshot路径/size校验。 | 核对同名异目录、过期快照和真实Desktop/Android列表消费；changed path/title/time/hash/size不得沿用旧snapshot。 |
| ASK-A01 | 目录元数据独立依赖与发布 fence / ASK | `OPEN` | 交付 `a0215837f71b`；[领域原记录](validation/parity-ask-2026-10-18.md)：`multiuser-ask-source-directory.test.ts`：真实Harness目录读取后hold，改名/enable/delete/说明改变拒发布，心跳允许，同ID隔离。 | 核对实际模型已经披露的metadata与未读正文范围；源目录、设备目录和source-context三种依赖不可混同。 |
| ASK-A02 | 账号语义/混合召回与相关度 / ASK | `OPEN` | 交付 `a0215837f71b`；[领域原记录](validation/parity-ask-2026-10-18.md)：`multiuser-ask-retrieval.test.ts`：HTTP intake/Material→M05 embedding→loopback向量→非字面召回排序→真实Ask引用，restart/撤权晚向量。 | 新输入的fixture召回已具名；真实embedding质量、配置/未配置和degraded空结果、历史覆盖逐范围核对，不自动回填。 |
| ASK-A03 | 说明发现及 preview / ASK | `OPEN` | 交付 `a0215837f71b`；[领域原记录](validation/parity-ask-2026-10-18.md)：source-directory用例：只有description命中时发现来源、命中preview/精确ref/context catalog，另一账号说明不可见。 | 按说明修订及返回前授权核对实际入口；不再重复实现名称OR说明搜索。 |
| ASK-A04 | 确定失败轮次历史与重试 / ASK | `OPEN` | 交付 `a0215837f71b`；[领域原记录](validation/parity-ask-2026-10-18.md)：`multiuser-ask-failures.test.ts`：确定失败持久化、reopen/restart、同run retry/历史分页、portable数据恢复；cancel/revoke/timeout晚失败拒发布。 | 核对真实native/Web失败轮次可见与再次提问；Ask/M07 republication pair仍保旧首败81与新71的不同来源。 |
| ASK-A05 | 外部显式响应分页 / ASK | `OPEN` | 交付 `a0215837f71b`；[领域原记录](validation/parity-ask-2026-10-18.md)：`multiuser-context-pagination.test.ts` + `multiuser-mcp-query.test.ts`：HTTP/MCP browse集合、search枚举、retrieve排序/拒cursor、容量/truncated、restart。 | 外部响应capacity与内部无字符配额分开；实际客户端协议、私有授权和同scope稳定cursor分别核对。 |
| CONN-C01 | 故障后持续周期发现 / CONN | `OPEN` | 交付 `a562a1f2cd76`；[领域原记录](validation/connector-parity-2026-10-18.md)：原Connector C01：Gmail/Google terminal503→未来poll→restart/provider恢复；后继非abort discovery held期间selection先保存、B继续。 | 保留 `4fe01f47` CHANGES_REQUIRED及两143中断；后继20/20 phase场景与8个consumer对账，真实OAuth/CLI另验。 |
| CONN-C02 | 原后台同步开关生效 / CONN | `OPEN` | 交付 `a562a1f2cd76`；[领域原记录](validation/connector-parity-2026-10-18.md)：原Connector C02：Lark/recording autoSync=false手动sync后，已有scheduled poll及restart不新增后台读取；selection原控件。 | 核对已准入waiting phase独立due责任与新discovery门控；原生首次保存/选择实际时序单列。 |
| CONN-C03 | Lark 自动来源与预览确认 / CONN | `OPEN` | 交付 `a562a1f2cd76`；[领域原记录](validation/connector-parity-2026-10-18.md)：原Connector C03：旧calendar poll存在时改变文档/folder范围只preview；timer不confirm/download，显式sync才进入新范围。 | 核对原Web/native选择确认与automatic=true来源；不能由timer静默确认新正文。 |
| CONN-C04 | 单录音规范正文与证据图 / CONN | `OPEN` | 交付 `a562a1f2cd76`；[领域原记录](validation/connector-parity-2026-10-18.md)：原Connector C04：多段录音只发布一个canonical全文Material并保留exact locators/raw export；shorter/empty/unsupported撤旧投影。 | 完整单正文→Memory配方和事件消费仍按原输入对应；stale-tail回执不是全部canonical质量通过。 |
| CONN-C05 | 录音原专用配方安装绑定 / CONN | `OPEN` | 交付 `a562a1f2cd76`；[领域原记录](validation/connector-parity-2026-10-18.md)：原Connector C05：专用recording recipe枚举、source默认绑定、固定intake身份；前置 `e84b8bb72ac195e047d9a590eec7221b9ffcfdcb`补extracted-text声明。 | 核对原录音v3版本/指纹、真实首次来源和FILE alias去重；不把generic personal补录当等价。 |
| CONN-C06 | 选择变化复用已确认音频 / CONN | `OPEN` | 交付 `a562a1f2cd76`；[领域原记录](validation/connector-parity-2026-10-18.md)：原Connector C06：selection变化+restart复用同账号精确已备份音频；相同provider ID的B不能借用；backup无自动ASR。 | 核对provider.media实际次数与withdrawal/held媒体；不能由配置代次变化重新下载成功音频。 |
| CONN-C07 | 独立阶段状态和重试时间 / CONN | `OPEN` | 交付 `a562a1f2cd76`；[领域原记录](validation/connector-parity-2026-10-18.md)：原Connector C07：两provider页面显示metadata/transcript/audio各自状态/错误/retry；transcript成功+audio终态失败重启后不再调用。 | 原Web13/13及后继6/6短表单、2/2完整paging/archive保各自输入；原生CentralRecordings消费另核。 |
| EXEC-X01 | 业务 Operation family 与增量更新 / EXEC | `OPEN` | 交付 `070ffc04a859`；[领域原记录](validation/execution-parity-2026-10-18.md)：`multiuser-execution-parity.test.ts` kind/filter/change cursor与三层shared child；`multiuser-operation-feed.test.ts`真实HTTP变化使Web失效更新。 | 核对真实各域producer及晚child/parent generation、取消late progress、restart；Work SQL不能代替Operations详情。 |
| EXEC-X02 | 交互与后台独立 lane / EXEC | `OPEN` | 交付 `070ffc04a859`；[领域原记录](validation/execution-parity-2026-10-18.md)：`multiuser-execution-lanes.test.ts` holds两个background Insight，同时chat完成；两账号与queued取消0attempt。 | 真实模型/物理harness聚合另验；不能把在gate内部等候当已占聊天槽。 |
| EXEC-X03 | 有效并发配置驱动执行 / EXEC | `OPEN` | 交付 `070ffc04a859`；[领域原记录](validation/execution-parity-2026-10-18.md)：同lanes用例实际interactive 2→4→1及restart；Memory快照只证明scheduler边界。 | Memory>2实际调用须带冻结MEM/EXEC组合；多Central进程全局physical limit仍是原调查项。 |
| CONFIG-C01 | 个人目标改变与秘密复用确认 / CONFIG | `OPEN` | 交付 `2aa08c862087`；[领域原记录](validation/configuration-parity-2026-10-18.md)：保存秘密→修改provider/protocol/baseUrl→网络/保存前拒绝；显式reuse/重填/清除、A/B同ID、shared固定连接。 | 核对敏感headers/body及未保存草稿同规则，不能只测最终save。 |
| CONFIG-C02 | Codex 探测与业务统一运行配置 / CONFIG | `OPEN` | 交付 `2aa08c862087`；[领域原记录](validation/configuration-parity-2026-10-18.md)：生成CLI实际验证实例executable/home：catalog/probe、A/B Ask、compaction/restart及Hindsight host options；原runtime2tests。 | 真实Codex资源与实际probe/业务双入口单列；不能借另一登录home，配置重启边界保留。 |
| CONFIG-C03 | 用量统计、分页与价格入口 / CONFIG | `OPEN` | 交付 `2aa08c862087`；[领域原记录](validation/configuration-parity-2026-10-18.md)：HTTP usage/reducer7tests + 原cookie Usage renderer3tests：时区、filters/group/facets/drilldown/paging/price/unknown。 | 独立UUID fragments/失败/恢复取完整入口收据；真实供应方账单不由fixture证明。 |
| CONFIG-C04 | 个人草稿目录/探测后保存 / CONFIG | `OPEN` | 交付 `2aa08c862087`；[领域原记录](validation/configuration-parity-2026-10-18.md)：未保存personal draft/new profile的catalog/probe不改saved/effective revision，随后保存；shared draft override拒绝。 | 核对真实UI未保存状态/错误草稿、网络返回后账号切换和secret复用；generated browser来源单列。 |
| CONFIG-C05 | 普通配置新版本与真正撤权分开 / CONFIG | `OPEN` | 交付 `2aa08c862087`；[领域原记录](validation/configuration-parity-2026-10-18.md)：原57tests suite含held Ask tuning/withdrawal、Memory/file/import consumers；普通设置保live/durable snapshot，真撤权拒lease。 | 不能把model/budget/reasoning/deadline编辑当资源全撤权；相关域自己的publication fingerprint仍保持。 |
| CONFIG-C06 | 个人每功能独立模型选择 / CONFIG | `OPEN` | 交付 `2aa08c862087`；[领域原记录](validation/configuration-parity-2026-10-18.md)：一个personal连接各功能独立model并持久restart；shared override拒绝、referenced删除guard和unreferenced确认/取消。 | 核对切连接清旧feature override及实际模型请求，不以复制连接/secret替代。 |
| CONFIG-C07 | 入口明确用量归属 / CONFIG | `OPEN` | 交付 `2aa08c862087`；[领域原记录](validation/configuration-parity-2026-10-18.md)：`multiuser-processing-usage-attribution.test.ts`真实summary/review/import→A/B独立agent/module/skill收据，restart不重放。 | 需要FILE依赖；Files=`file-analysis/files/null`，import=`document-import/imports/document-import`，历史未知不补猜。 |
| DESKTOP-D1 | 文件逐项 ACK/拒绝/暂时失败 / DESKTOP | `OPEN` | 交付 `55b40d37a494`；[领域原记录](validation/desktop-parity-2026-10-18.md)：Desktop原D1：reference ACK后网络中断先durable结清；真实409只隔离该revision、forget410不挡兄弟/B、429/503/507仅defer本版本。原五file83/83。 | 原矩阵R9三D1自动断言/closedcopies及raw3a5ad1b3为限定证据；背景emitted main不等于TCC、真实sleep/lock或全部D1–D4。 |
| DESKTOP-D2 | 会话过期与 durable ACK 恢复 / DESKTOP | `OPEN` | 交付 `55b40d37a494`；[领域原记录](validation/desktop-parity-2026-10-18.md)：`source-account-retry`14/14；真实spool、丢part/成功commit ACK、跨24h生成expiry/restart；中途reference/archive旧generic409两红保留。 | 原矩阵R15后继有real409→自动续期→canonical commit200/closedpending0限定接受，finalB未查；区分会话过期与不续权snapshot及Android消费者。 |
| DESKTOP-D3 | 服务端分页与首屏 / DESKTOP | `OPEN` | 交付 `55b40d37a494`；[领域原记录](validation/desktop-parity-2026-10-18.md)：`central-browse-parity`4/4；65captures按limit30、原签名cursor跨leading insert；31sessions/35members使用服务端cursor，B/query拒A游标。 | 对账当前真实Content列表/记录/session/member分页与重启；后端/背景main fixture不代替物理UI全部路径。 |
| DESKTOP-D4 | 中央原始 sizeBytes 显示 / DESKTOP | `OPEN` | 交付 `55b40d37a494`；[领域原记录](validation/desktop-parity-2026-10-18.md)：`content-library-ui`11/11含生成JPEG无OCR/preview时显示服务端原字节数，B同ID不同bytes独立。 | 对账真实renderer打开/返回/账号切换与image bytes，保持B内容/尺寸隔离；无物理采集/TCC通过声明。 |
| AND-01 | 设置/重登恢复日历投递 / AND | `OPEN` | 交付 `2622844e3b22`；[领域原记录](validation/parity-android-20261018.md)：`CalendarRecoveryLifecycleInstrumentedTest`真实connect→RuntimeSettings→WorkManager→CalendarProvider；原R001日历1/1。 | R001为编辑阶段APK，后继262+070已有Calendar READ子范围；首次native WRITE/实际process-stop pair按精确APK组合核对。 |
| AND-02 | 原始采集逐项结清与冲突隔离 / AND | `OPEN` | 交付 `2622844e3b22`；[领域原记录](validation/parity-android-20261018.md)：`Ingress3OutcomesTest`/`MultiuserIngressTest`与真实UploadWorker mixed packed/individual；原JVM22/22、native conflict1/1。 | 后继 `c55560b7a179a0e0f321f10e74a84250a35c88af` 409后暂停查询失败修复及emulator5/5见集成附录；不把所有409/410归网络。 |
| AND-03 | 窄 transport 原 typed outcome / AND | `OPEN` | 交付 `2622844e3b22`；[领域原记录](validation/parity-android-20261018.md)：SourceScan/UploadWorker paused/permanent/network typed outcome，droppedACK+forgotten、listener outage/manual/automatic。 | 原R001 pause/network因缺persistable SAF grant未到业务断言；后继修正须带实际SAF/Worker source，保留该失败。 |
| AND-04 | 恢复页与 Worker 同账号状态 / AND | `OPEN` | 交付 `2622844e3b22`；[领域原记录](validation/parity-android-20261018.md)：真实Recovery Activity check/replay/stop/recreation/A-B，原R001 recovery1/1。 | 后继账号report/旧WorkRequest退休、UI晚响应对账；原R001不能重标最终262或现行APK资格。 |
| WEB-W01 | 原首页内容/入口/Home slot / WEB | `VISIBLE_MAC_SUBSCOPE_PASS` | 交付 `f8f684b6dee9`；[领域原记录](validation/multiuser-parity-restoration-matrix.md#web)：矩阵Q002/R006/R007准确 `f8f684b6dee904d820b9952ead336da5a33f330f`：26实际Chrome交互/11最终图；原scope仅可见子范围。 | 后继Chrome cd0首批W01-empty P、W01-notes因memory.intake前置F、11UNRUN保留；分别核Home slot/最新Insight及设备30秒刷新，不拼13PASS。 |
| WEB-W02 | 设备原30秒可见刷新 / WEB | `VISIBLE_MAC_SUBSCOPE_PASS` | 交付 `f8f684b6dee9`；[领域原记录](validation/multiuser-parity-restoration-matrix.md#web)：矩阵Q002/R006/R007准确 `f8f684b6dee904d820b9952ead336da5a33f330f`：26实际Chrome交互/11最终图；原scope仅可见子范围。 | 后继Chrome cd0首批W01-empty P、W01-notes因memory.intake前置F、11UNRUN保留；分别核Home slot/最新Insight及设备30秒刷新，不拼13PASS。 |
| EXT-E01 | 停用无引用实例退役卸载 / EXT | `OPEN` | 交付 `5a5ed7bfeaf1`；[领域原记录](validation/parity-extensions-20261018.md)：Plugin HTTP disable→管理员直接uninstall；自身disabled无引用可退役，foreign/enabled/retained snapshots阻挡。 | 实际异步check/运行中历史/旧reader不能被卸载；核UI allowedActions与执行一致。 |
| EXT-E02 | 原核验入口真实 provider probe / EXT | `OPEN` | 交付 `5a5ed7bfeaf1`；[领域原记录](validation/parity-extensions-20261018.md)：`multiuser-plugin-capability.test.ts`：真Mem0+loopback embedding A200/B500、lying health worker，restart不多probe。 | describe不是能力通过；保留独立probe目录、exact配置/模型授权、异步task与late cleanup。 |
| EXT-E03 | MCP reference 目录元数据 / EXT | `OPEN` | 交付 `5a5ed7bfeaf1`；[领域原记录](validation/parity-extensions-20261018.md)：`multiuser-mcp-one-shot.test.ts` reference分页resources/list取第二页name/MIME，body reads0；metadata held后撤权拒发布。 | 真实SDK/一页不能代全部目录；只有缺metadata才fallback，保owner/source范围。 |
| ACTION-A01 | 完整语义产物消费与检查点 / ACTION | `OPEN` | 交付 `2689e88d7ac2`；[领域原记录](validation/parity-actions-2026-10-18.md)：`multiuser-actions-semantic-parity.test.ts`：capture→bounded完整segment→productsVersion1语义cues→calendar关系→OwnerQuestions→claim/receipt，空cues无calendar；最终header7/7。 | 原106/106早于header变更，后继29/29及emitted1/1各留输入；首次nativeWRITE与真实模型关系质量另验，Coding actionCues仍空。 |
| ACTION-A02 | 同批合并/去重/执行保护 / ACTION | `OPEN` | 交付 `2689e88d7ac2`；[领域原记录](validation/parity-actions-2026-10-18.md)：`multiuser-actions-batch-parity.test.ts`：duplicate/update次序、dismiss保留、新建议去重、approved/executing/uncertain pin；restart unknown reconcile-only。 | 完整UI批批准与OS效果逐范围映射，不将unknown claim再次写；原失败/后继结果分开。 |
| ACTION-A03 | 成功历史身份独立于授权代次 / ACTION | `OPEN` | 交付 `2689e88d7ac2`；[领域原记录](validation/parity-actions-2026-10-18.md)：`multiuser-actions-replay-parity.test.ts`：disable/re-enable、timezone/restart保相同successful inputs/proofs/task/attempt，gap输入一次；late输出拒发布。 | 失败/interrupted仍显式retry，已成功checkpoint不再调用；native未知issued只能一份，不因新授权代次重放。 |
| ACTION-A04 | 纯重命名保留建议/批准 / ACTION | `OPEN` | 交付 `2689e88d7ac2`；[领域原记录](validation/parity-actions-2026-10-18.md)：`multiuser-actions-source-metadata.test.ts`：rename/no-op后pending/approved/restart保留；unknown→restart→rename仍mutationAllowed=false且ACK幂等。 | source停用、context/owner relation、delete/recreate与B隔离分别核；纯改名不误作privacy删除。 |
| LIFE-L01 | 原保留周期启动/每小时维护 / LIFE | `OPEN` | 交付 `b30c2cb5e1de`；[领域原记录](validation/parity-lifecycle.md)：原L01→`parity-lifecycle-maintenance.md`：production ready/hourly、logout/restart、strict context cutoff、retention0、真实file revision排除、派生撤权。 | 真实客户端跨cutoff、共享引用/pin/late处理另映射；原c0bf gate失败保留，不能只看startup构造。 |
| LIFE-L02 | 既有实例逻辑容量准入 / LIFE | `OPEN` | 交付 `b30c2cb5e1de`；[领域原记录](validation/parity-lifecycle.md)：原L02及revision R1：双owner ceiling、507事务rollback/ACK、delete/restart重试、staging promotion/eviction；Todo增长/heldartifact真实容量补回归。 | 原R1 RED和frozen-five5P/processor1P各输入保留；需普通客户端保队列并释放后恢复，非新配额/磁盘写满。 |
| LIFE-L03 | 个人导入导出一致性隔离 / LIFE | `OPEN` | 交付 `b30c2cb5e1de`；[领域原记录](validation/parity-lifecycle.md)：Memory export/preflight await期间A/B HTTP写：A实际依赖变则conflict，B和排除的A task progress不冲突；import final同witness。 | 核多SQLite连接/真实导出一致性、撤权与metadata依赖；不靠全库fingerprint或静默重试掩盖冲突。 |
| LIFE-L04 | 中央导出内容副本删除生命周期 / LIFE | `OPEN` | 交付 `b30c2cb5e1de`；[领域原记录](validation/parity-lifecycle.md)：原one-response full export、bytes/ETag/length/restart、socket断流/背压erase；Web单次save与Android staging有消费者，portable-final16P为原focused。 | 实际Mac/Android保存位置、账号切换/迟到文件及重试仍按输入核对；不恢复中央下载历史或新增TTL。 |
| LIFE-L05 | 原GC启动/周期驱动 / LIFE | `OPEN` | 交付 `b30c2cb5e1de`；[领域原记录](validation/parity-lifecycle.md)：原startup/hourly复用ingress/import cleanup；activepin/unknown只挡受影响owner、跨restart；原maintenance-capacity19P。 | 真实客户端未commit/未知外部与GC时序对账；不按年龄猜进程已死，原consumer cleanup错误保留。 |
| EXEC-S01 | 原Operation父子链与进度 / EXEC | `OPEN` | 交付 `070ffc04a859`；[领域原记录](validation/execution-parity-2026-10-18.md)：`multiuser-execution-business-parents.test.ts`：text import、取消ZIP→新preview→confirm、同配置file retry和Android所用receipt；image进度+restart。 | 原070整22步是模块gate；真实跨域producer父链和三层聚合/取消仍需逐入口对齐。 |
| EXT-ES01 | MCP无状态使用与重启 / EXT | `UNKNOWN` | 交付 `5a5ed7bfeaf1`；[领域原记录](validation/parity-extensions-20261018.md)：`multiuser-mcp-stateless.test.ts`：原无initialize/session POST、A/B同ID、可选SDKsession/restart/epochs；actualprocess含SIGKILL前后raw calls。 | 原结构未知已有具名回归；核实际客户端完整路径，不新增必需session/source步骤。 |
| EXT-ES02 | 单次发现/导入前置步骤 / EXT | `UNKNOWN` | 交付 `5a5ed7bfeaf1`；[领域原记录](validation/parity-extensions-20261018.md)：one-shot + Web renderer：draft target→discover（无config/source写）→select→create/import，同保存目标走同importer；YAML/export无临时secret。 | 核取消/retry/restart/范围缩小/late结果及真实浏览器；不重新提出先保存连接的额外步骤。 |
| EXT-EC01 | 资源模板发现协议可达性 / EXT | `UNKNOWN` | 交付 `5a5ed7bfeaf1`；[领域原记录](validation/parity-extensions-20261018.md)：`multiuser-mcp-optional-discovery.test.ts` 用官方SDK1.30 low-level Server+StreamableHTTP，缺templates返回-32601仍保资源；InternalError仍502。 | 窄协议兼容已有fixture，非所有第三方合规认证；按实际服务/可选prompts范围继续核对。 |
| LIFE-L06 | 恢复策略意图与执行授权 / LIFE | `IN_PROGRESS` | 交付 `b30c2cb5e1de`；[领域原记录](validation/parity-lifecycle.md)：原future-final约62s 1P：stoppedrestore→无权→passwordlogin→新future tasks/actualprobe→Actions/connector timer；revision R2-red held verifier阻挡兄弟，R2-final2P修复retry/stop/独立scope。 | 选择已定无逐域重批；原c0bf/6cbd与后继b30 required13/13及PM选B后claim-v2/6875组合分别记录；实模/native未来权限/原unknown不重放仍需同旅程核对。 |
| AND-D01 | 采集/隐私/同步偏好按账号 / AND | `IN_PROGRESS` | 交付 `2622844e3b22`；[领域原记录](validation/parity-android-20261018.md)：`AccountCapturePreferencesInstrumentedTest`：defaults/stopped、A→B→A、token/URL、stale callback/process-stop；后继262+070偏好241/capture192/privacy249工件子范围。 | 账号偏好已决定；FLAG_SECURE App像素/实体OEM及其它race另验。旧global不猜归属，不再提出新批准。 |
| FILE-07 | ZIP Markdown相对附件关系 / FILE | `OUTSIDE` | 交付 `f29ffd94b6cd`；[领域原记录](validation/parity-files-2026-10-18.md)：Files原记录“Existing defect outside this restoration”：两比较基线均缺ZIP Markdown相对图片关系。 | 既有缺陷OUTSIDE原58项；未记录该修复通过，另行明确任务范围，禁止历史付费回放。 |
| CONFIG-UX01 | 专用配置控件退为JSON编辑 / CONFIG | `OPEN` | 交付 `2aa08c862087`；[领域原记录](validation/configuration-parity-2026-10-18.md)：原Configuration“Dedicated controls”及生成browser：provider预设、advanced credentials、reasoning/timeout/token/local/Codex、模块与saved/effective。 | 原Web18focused和browser结果各自绑定源hash；补实际组合UI/Android专用控件，不把generic JSON当恢复。 |

原矩阵后续补充的 INV、seam、observer 和跨模块最终旅程继续各自记状态，不机械增加或减少 66 主行。`memory-material-incarnation` 的最初 source-only 阶段已有[实际首次失败](validation/memory-material-fixture-first-failures-2026-10-19.md)（`66a576fd09653ae5c30df0b35dcbc0475edd882d`，81=76P/5F），后继有限修正和组合结果仍见原矩阵；不能把原 81 改成 81P，也不能把当前状态退回“从未执行”。


## 业务审计 F 项继任关系

[原 F01–F13 审计](audits/business-flow-parity-2026-10-18.md)的“current gaps”绑定其原 `b26e797b5427fd089fa4fc4fa8b0cc45909f24af` 等候选。以下是本页源码的继任对账，不修改原发现或把源码当验收；精确交叉依据见[进展审计](audits/project-map-and-progress-review-2026-10-20.md)及[交叉验证](audits/documentation-review-consolidated-2026-10-20.md)。

| 稳定 ID | 当前实现／决定与来源 | 验证范围、未验及下一步 |
| --- | --- | --- |
| F01 | `scope/memory.ts` / `memory-coding.ts` 已有独立 Coding preparation、持久结果和结构化发布；关联 MEM-M06 | 不再是没有 producer；按 Memory 原记录对齐来源分组、严格复用、事件/工作消费、模型质量和失败恢复 |
| F02 | `scope/model-usage.ts` / `model-query.ts` 已有独立 UUID 片段、实际发送、onUsage、失败/中断，业务入口显式归因；关联 CONFIG-C03/C07 | 原 lease 唯一计量缺口描述过时；按[用量记录](validation/configuration-usage-parity-2026-10-18.md)及可靠性验证核对重试/撤权/进程死亡；真实账单未知仍未知 |
| F03 | `scope/app.ts` 挂载 ArchiveMaintenance / ScopedStorageCapacity；保留期限、启动/每小时和共享逻辑容量有消费者；关联 LIFE-L01/L02/L05 | 原“设置接受但无执行”已过时；[生命周期记录](validation/parity-lifecycle.md)和规模/引用/pin/迟到处理断言逐范围核对 |
| F04 | `scope/ask.ts` / `ask-retrieval.ts` 已接新输入事件、embedding、作用域向量和 rank fusion；关联 ASK-A02 | 当前 FTS 加可选 embeddings；[Ask 原证据](validation/parity-ask-2026-10-18.md)不等于全部语义质量、历史覆盖或真实供应方通过；不自动付费回填 |
| F05 | 原 archive/profile/readiness 疑点与 FILE-02 关联；本轮未逐条重证全部路径 | 保留当前证据对账，不能直接沿用旧“未恢复”或宣告关闭；核对保留+处理、真实 archive-only、自定义 recipe/caption |
| F06 | `scope/ask-evidence.ts` 按名称 OR 最新 description 查找并返回预览、精确读取依赖；关联 ASK-A03 | 说明仅能按名称查的旧缺失描述过时；按实际范围、账号、修订与返回前 fence 对账 |
| F07 | ZIP/Markdown 相对附件是原矩阵 FILE-07 既有缺陷观察 | OUTSIDE 原 58 核心；未由功能门禁宣布修复，不恢复历史收费任务 |
| F08 | `scope/processing-imports.ts` 当前 directory create 要求管理员，使用 hostImportDirectory 并经 ingress 归档；关联 FILE-05 | 已有生产目录接入；完整预览/确认、symlink/保护目录、重启/UI 和模型输入集合须按当前旅程核对 |
| F09 | 资料 origin 时间/deviceId 与 FILE-01 关联；本轮未重证全部输入类别与消费 | 保留当前证据对账；原日期/设备过滤及修订/重启的高风险状态不自动关闭 |
| F10 | stale-tail、empty/unsupported 的原修正与 canonical/Memory 形状是不同维度；关联 CONN-C04/C05 | 保留[录音修订原回执](validation/main-multiuser-recording-revisions-2026-10-18.md)；规范单正文、配方/locator、媒体复用与阶段状态按后继记录继续对账 |
| F11 | [生命周期 ADR](adr-lifecycle-parity.md)已选可信密码重登后以新权恢复未来策略，不逐域再次批准；restore-future 已接入；关联 LIFE-L06 | 决定已明确；原 grants/unknown/target/device 权不复活。按[生命周期原记录](validation/parity-lifecycle.md)核对新未来协调器、暂停/后续选择和独立 scope 的当前资格，无新政策投票 |
| F12 | 原历史保留/相等决定的合流修正已有[原集成回执](validation/main-multiuser-integration-2026-10-17.md) | 保留其准确输入与范围，本次未重跑；不能扩写为任意历史或部署已验证 |
| F13 | 确定本地解码失败与真实 unknown 调用区分已有[原回执](validation/main-multiuser-local-decoder-failure-2026-10-18.md) | 保留格式失败结清与 HTTP unknown 对照，本次未重跑或取消未知结果边界 |

## 本轮新增的 Memory 合同调查

以下 ID 独立于原 66 行，不调整原验收分母。原发现固定于 2026-10-20 的
`af11ab7c` 静态审计；后续独立修复候选和实际检查单列如下，不回写原调查或扩大原验证范围。

| ID | 确认范围 | 状态与下一动作 |
| --- | --- | --- |
| MEM-U1 | `af11ab7c` 审计：scoped 任务未持久固定既定创建/接收评估时钟；原件投影时间进入模型 `currentTime`、审核收据及默认 `supersededAt`，Coding/反馈另有不一致取时 | 后续独立候选 `c9b6c116` 恢复私人固定评估语境及相关消费者；预审、源码复核与生成 fixture 证据见下方后记。main 合入、部署及模型实际质量分别核对 |
| MEM-U2 | `af11ab7c` 审计：固定提取/整合注入旧 Skill；整合生成及独审的“关系等所有者确认”与审核后自动原子应用合同冲突 | 后续独立候选 `c9b6c116` 改用既有中性程序，保留独审、原生引擎和删除比较边界，不新增确认步骤；证据与 main/部署状态见下方后记 |
| MEM-Q1 | 正式 Material intake 代码仍有 count/max-wait 条件，与普通滚动队列的既定不等待合同存在静态张力 | 候选待查：补全默认、实际触发和 drain 例外证据后纳入工程方案；不据此改默认或宣称某次实际延迟已复现 |

入口、最终 prompt、持久状态、消费者、排除项和最小回归矩阵保留在
[原调查与工程草案](audits/memory-runtime-contract-investigation-2026-10-20.md)。恢复已有合同
不需要重新做产品投票；下方工程批准与实际检查是后续证据，文档复核本身不是实现预审。

### 2026-10-20 U1/U2 后续候选

状态更新：2026-10-21（Asia/Shanghai）。

[独立修复 PR](https://github.com/utopiafar/mote/pull/203) 从 `bcff7bab6109a7c99acde3decb5712a072e1b045`
（含 PR 194）实施，候选提交为 `c9b6c116bdb03caf860c272e1a0efdd486d2b9cb`。
独立方案预审及适用增量批准、源码复核的 I1/I2 均已闭合；I2 补齐 Activity 消费者同步。
定向结果按实际输入分别记录：前驱 `4925a706` 有 58＋23 项新执行生成 fixture 通过；
I2 后另有 17 项通过（16/16，50.329 秒；补漏 1/1，5.522 秒）。后续 reader fixture 补充
经局部增量前瞻 APPROVE，17/17 通过（9.757 秒），提交为 `c9b6c116`；运行源码与
`a73a8e3a` / `936b5c23` 相同。上述各轮结果不重标为最终候选上的重复新执行。
准确输入、实际入口、未验及回执见[验证记录](https://github.com/utopiafar/mote/blob/42cd862ac5c025803276466145526948f75c0976/docs/validation/memory-evaluation-context-restoration-2026-10-20.md)。
最终候选完整门禁：14 项计划成功：13 项本轮执行，1 项 Agent 测试按完整输入复用原始通过回执；Server 全套新执行 3721 pass / 9 既有条件 skip，driver 确认清理完成（准确任务与未验边界见验证记录）。该轮按精确任务输入，从既有收据中只复用已通过任务并
核对清理确认，Server 重新整轮执行；本轮新执行、收据复用和仍未闭合观察分别以最终报告为准，
不将整轮表述为所有任务均新执行。

main 合入：本快照未记录该候选合入；发布、安装和部署：未核验。后续须各自补准确
merge/标签/节点证据，不能从候选提交或检查通过推断。MEM-Q1 不在修复范围；原 66 行、
原图片保存失败/模型质量、物理设备、未知外部结果与其他原未闭环事项均未据此关闭。

## 独立后续、发布和风险

- UI PR 185、DSH PR 190 在本轮动态读回时均为 Open Draft，分别为 15 轮准备和阶段 1/4；准确 head 与原限制见[动态快照](audits/project-map-and-progress-review-2026-10-20.md)。它们不被旧 UI／插件一期“已完成”吸收，后续状态需刷新。
- UI PR 120（`18a25c0f3a7b97aa1e7947f070b4e6edc1f11071`）、展示包 PR 122（`6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`）、插件一期 PR 99（`8297e172851569b8cf21c807c3568fc259a8035c`）已在 main；[UI ledger](design/ui-presentation-rollout-2026-10-15.md)和[供应方验收](design/plugin-center-phase-one-validation-2026-10-12.md)保留原范围。
- Desktop 0.0.87／Android 0.0.88 的历史非 Draft Release 和 ZIP/APK 元数据已核对，见各[Desktop](../release/notes/desktop/0.0.87.md)／[Android](../release/notes/android/0.0.88.md)说明。没有本次下载/安装/签名验收；后来的 Dev Actions artifact 政策不因此撤销。
- [原五轮插件实验](validation/plugin-extension-benchmark/REPORT.md)完整案例 0/5、七项 NOT RUN、严格探针 0/6 和 SQLite 根因 UNKNOWN 保留。后继 `f92fec71` 门禁与固定 Mem0/Hindsight 一期验收都不能关闭一般插件生态的完整案例。
- 原图片 Memory 实际保存失败、不同输入 NONREPRO、原生首次日历 WRITE、Desktop D1–D4/TCC、FLAG_SECURE 像素、设备/OEM 和 unknown 外部结果继续按各自证据核对。不得把新门禁、一次成功或新输入未复现写为原根因已解；不自动重放旧付费任务。

## 更新本台账

新证据须写稳定 ID、精确 base/head、实际入口/输入、原回执位置、消费者及已到/未到状态、main merge、发布/部署和更新时间。仅文件存在、原聊天 idle、旧 RUNNING 槽位或某个名为 final 的报告不能推进资格。先查有效原证据；只有证据缺口或新改动确有需要时，再由单一 driver 按实际输入选择检查，不为整理文案重复昂贵测试。

