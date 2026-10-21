# Mote 插件扩展：五轮评估与迭代

> 2026-10-20 后继交付：原五轮完整案例 0/5、七项 NOT RUN、G5 FAIL_HOST_STORAGE 和 SQLite UNKNOWN 保持。本报告之后的源码集成、定向修复及 `f92fec719dd51f7d2c28591229bc9f6e20605e6c` 的 23/23 功能门禁见[当前宿主集成附录](integration-current-host-2026-10-20.md)；它不把原实验改为全通过。[项目进展台账](../../project-progress.md)分别记录交付和剩余资格。

日期：2026-10-19 UTC。原始基线：`2c78ca8d52a7d17fae20962cf68d09a717ffc73a`。

本报告汇总用户提供的 Iterator / Evaluator / Optimizer 实验方法在 Mote 上的实际执行。
完整需求、评分门槛与公开数据在 [plan.md](plan.md) 和 [cases.json](cases.json)。
各轮开发者均为全新独立 Agent；插件开发者没有修改宿主源码。宿主改动由独立的
Optimizer 完成，Evaluator 通过真实任务、资料、原件和生命周期验证结果。

**五轮实验已执行，完整验收未闭合。完整案例 0/5，另有 7 项 NOT RUN；严格冻结探针
0/6。R05 两个独立新 vault 发生持久化 SQLite 损坏，候选级 G5 记为 FAIL_HOST_STORAGE。
最终受影响检查及诊断另行记录，不覆盖已知失败。**

## 已确认的结论

当前生产 worker 路径可以承载独立的 source / processor 插件：安装真实 ZIP、
读取授权原件、运行子进程、发布正式 Material / Transcript、保持用户隔离和历史读取。
本次实现了三项通用改进：安装前查询实际调用能力；按组件身份核验独立组合；把单任务
取消传递到 worker 的 `AbortSignal`。它们均由不同插件实现验证，不包含财务或会议专用宿主分支。

完整插件化能力仍有缺口。通用 worker 中的语义模型调用、原生 Harness 插件加载、
扩展自有周期/事件任务没有本次需求所需的公开路径。模型 mock 可以验证插件业务计算，
不能据此把模型授权、计量、自动触发或真实模型质量判为通过。

## 五轮记录与证据

| 轮次 | 冻结候选与独立开发任务 | 本轮观察与迭代 | 独立运行证据 |
| --- | --- | --- | --- |
| R01 | 原始 `2c78ca8`；财务资料插件及独立基线能力审计 | 识别旧模块配置与实际生产入口不一致，检查通过与领域可调用不是同一回事；保留模型、原生 ABI 和触发器失败 | [基线审计](baseline-evaluator.md)、[原始探针结果](baseline-probe-results.json)、[财务初始记录](../../../plugins/extension-benchmark/finance/trial-r1.json) |
| R02 | 文档候选 `7795f14`；全新 reading-pack | 生产源码与 R01 相同。补写当前开发入口、真实清单、配置与读写合同；独立验收发现财务 `refundOf` 丢失，原开发者用一次反馈修复 | [独立报告](round-02-evaluator.md)、[机器可读结果](round-02-evaluator-results.json) |
| R03 | `2879214`；全新 meeting-pack | 新增安装前能力查询。独立模块组成相同组件集合，仅顺序不同就返回 409；同一 ZIP 的同序控制组正常发布 | [R03–R04 对照报告](round-03-04-evaluator.md)、[原始会议记录](../../../plugins/extension-benchmark/meeting-pack/trial.json) |
| R04 | `b3d9561`；全新 cancel-pack | 修复按数组顺序比较的错误；补上逐调用取消协议。相同会议 ZIP 从 409 变成 200，两个回调均实际执行；新插件验证取消与同 worker 并发 | [R03–R04 对照报告](round-03-04-evaluator.md) |
| R05 | `88fb30a`；全新 final-pack | 开发前封存隐藏数据；独立财务/文本/隔离与在途版本升级有成功证据，但两次输入准备阶段出现数据库持久损坏；归档公开重放通过，G5 仍失败 | [独立报告](round-05-evaluator.md)、[机器可读结果](round-05-evaluator-results.json) |

报告中的候选 SHA 是实际执行时冻结的本地提交身份。R03、R04 的原始实验分支与集成
分支均保留：集成提交 `6ce353e`、`88fb30a` 的生产改动分别与原始候选相同。发布时
通过 GitHub API 重建提交，提交元数据导致 SHA 变化，但逐一核验 Git tree 完全相同。
[发布映射](publication-map.json) 给出每个实验候选的可 checkout 提交与相同的 tree。
最终源码/测试候选 `fe15cbd` 对应公开提交 `185dd36`，tree 均为
`3eee98ad87917b53b82238b0ef5dc54918422646`。合并节点保留原始分支关系，没有改变文件树；
最终 PR 在该候选之后只补充评估报告与紧凑收据。

每次跨候选比较都会重新运行已公开的财务、处理器、输入撤销、生命周期和隔离回归。
这些重跑是公开回归，不会重新包装成隐藏数据或新的独立开发试验。

## 三项通用宿主改动

### 安装前查询真实调用能力

`GET /api/plugins/host-capabilities` 在当前用户作用域内返回 worker ABI、支持的工厂
导出以及当前已注册的通用调用 adapter。它读取实际 adapter 注册表，没有把 schema
枚举当作已实现能力。普通运行时目前只注册 source 和 processor。

未安装任何包时即可读取该信息。未认证、collector 身份、伪造用户选择和停用账号的
拒绝路径均有回归。接口不创建插件、配置、任务或资料，不返回其他用户的数据。
它只描述通用 invoke 路径；Memory 的专用领域 provider 路径仍按自己的合同工作。

### 按组件身份核验组合

原实现对组件数组的 JSON 摘要直接比较，把清单排列与模块组合排列当作语义。
实际回调按组件 ID 寻址，因此相同 ID、version、surface、capability 的不同排列应能组合。
现按 ID 对照完整描述，并拒绝重复、缺失、额外 ID 和任何描述字段变化。

普通 runtime 和受限的 Memory maintenance runtime 使用同一核验方法。不会通过重排
获得新的 capability。针对错误描述的六种拒绝回归与真实 source 回调回归均已执行。

### 将单任务取消传入 worker

父进程为每个调用绑定取消监听，向子进程发送该调用的取消身份。子进程只撤销对应
控制器，插件通过现有第三参数 `signal` 清理自己的等待和 I/O。同 worker 的其他调用
继续运行；目标调用在取消后不能开始新的宿主回调。

worker 仍运行时，已接收的宿主回调会先结束，真实的父进程错误不会被插件返回值掩盖。
初始化等待可以被取消，已结束调用会移除监听。实例 stop / 整个 scope 关闭仍按原有
worker 退休合同处理；worker 丢失可能留下需恢复的未知结果，不能解释为远程写入回滚。
该限制在代码审查中用真实子进程复现，并写入当前 [插件开发指南](../../plugin-authoring.md)。

## 业务结果与可重复性

公开财务数据有 43 条观测，来自三个生成来源；23 笔唯一交易、16 条重复观测与 4 条噪声。
9 月净额为 83,335 美分，8 月为 1,234，10 月为 9,999。它们通过实际 worker 读原件、
去重、退款计算与发布产生，Evaluator 再读取 Material 正文、成员和原件关系逐项比较。
成功任务状态或一段“已完成”文字不构成验收结果。R05 独立隐藏数据改变了交易身份、
金额和到达顺序；对应净额为 **89,251 美分**，由 95,860 总支出减去 6,609 退款得到。
Evaluator 逐条比较原件、23 个交易身份和退款引用；该结果没有复用公开示例答案。

首版财务插件算对了金额，但持久记录没有退款对应的 `refundOf`。独立评估反馈后，插件
保留该字段，按实际原交易验证关联，并在跨月分组前处理引用。随后重新生成隐藏金额和
身份，独立验收再次通过。这次修复留在外部插件，没有为财务用途修改宿主。

reading-pack 将输入文本归一化并通过 `stageExtraction` 产生真实 Transcript 和 Material。
独立五条输入覆盖不同换行、Unicode 和类似指令的原文；正文、原件关联、分页和幂等均按
预先构造的期望值验收。该用例证明文本处理发布路径，没有把它算作图像语义 provider。

meeting-pack 的两个独立模块在原候选上无法按不同顺序组合。清单/JavaScript/ZIP 的
字节身份被保留，同一实现跨 R03/R04 执行后，独立排列由 409 变成 200。真实读回的
会议合计为 5,800 美分，参考资料合计为 3,975，美分计算和每条证据成员均有断言。

## R05 发现的宿主存储失败

两次全新 vault 在正常 SourceItems 入库与 Originals 分页阶段发生持久化 SQLite 损坏，
正式 `index.ts` 进程分别以 code 1 退出。独立只读副本的 `quick_check` / `integrity_check`
确认结构不一致；这是实际存储失败。两次库中的插件实例、快照均为 0，没有 configure、
check、invoke 或 cancel 请求，语义 mock 也尚未执行。故障不能记成 Iterator 修复，
也不能仅凭位置不在本次改动文件中，就宣称已证明是环境问题或既有基线问题。

原始隐藏验收在其他执行中完成了精确财务资料、文本产物、用户隔离、在途版本升级与
SIGKILL 后相同任务/资料回读。后续归档入口在相同源码上公开重放 3/3 通过，进一步
覆盖撤权、独立 stop 与单任务取消。公开重放是复现与回归证据，不是新的盲测；它不
消除前述两次损坏，候选级 **G5 = FAIL_HOST_STORAGE**。

[单次原始基线诊断](storage-diagnostic/README.md) 在 `2c78ca8` 上用同组 43 条生成输入
执行实际 HTTP 接收与分页读回。35 次 HTTP 均为 200，正常退出后的数据库只读检查为
`quick_check=ok`、`integrity_check=ok`。strace 没有捕获顶层数据库的截断或替换，但它
改变了时序。这一次未复现不能排除已有宿主问题，也不能证明本轮修改造成回归。
两次损坏库的只读副本仍有文件页数与数据树引用不一致，**根因为 UNKNOWN**。报告保留
哈希和紧凑诊断收据；原始测试数据库与约 48 MB trace 没有加入源码仓库。

另外两次中断来自 Evaluator 自身的设置/断言范围：更新未 check 的配置时携带
`desired: true`；将禁用期间正常 ingress 产生的资料投影混算为插件发布。修正均保留
原记录，不改插件、模型 oracle 或宿主源码，也不消耗 Iterator 修复次数。

## 完整案例与评分口径

| 完整案例 | 实际验收范围与结果 |
| --- | --- |
| E01 财务洞察 | 数据读取、精确计算和持久资料子路径通过；正常模型调用、扩展自动触发以及完整洞察/Memory/query/UI 链路未通过，因此完整案例 FAIL / NO_EXTENSION_POINT |
| E02 主题与布局替换 | 新外部包全程 NOT RUN；基线另有共享/Web/桌面表现合同测试，不替代新插件验收 |
| E03 本地模型隐私 | 完整策略插件 NOT RUN；基线实测本地 OCR/Ask mock 路由。edge 的模型决策扩展边界没有可用入口 |
| E04 原生 Harness 插件 | unchanged `apply(ctx)` 包能够安装，但工厂检查返回 502，完整案例 FAIL / NO_EXTENSION_POINT；实际 Harness tool 会话没有执行 |
| E05 确认后的日程创建 | NOT RUN |
| E06 扩展自有周期/事件策略 | 公开请求、清单/任务 schema 与 worker `registerTrigger` 均拒绝，FAIL / NO_EXTENSION_POINT |
| E07 Memory repository/retrieval 替换 | 新 provider 完整案例 NOT RUN；专用领域接口与通用 worker invoke 严格区分 |
| E08 新图像理解 provider | NOT RUN；已验证的文本 Transcript 路径不算图像理解通过 |
| E09 自定义资料卡/面板 | 新外部 UI 包完整案例 NOT RUN |
| E10 共存、升级、在途恢复 | PARTIAL；E10.4 的发布后重启读回已证实，在途恢复未证实；R05 另缺 E10.5 成功卸载后的历史读取。其他轮的独立成功分支不合并为本轮完整通过 |
| E11 用户与操作隔离 | PARTIAL；原件/资料/任务/事件等已测边界通过，未测模型资源/export 组合不外推 |
| E12 ASR 与说话人分段 | NOT RUN |

R01 是能力审计，不单独宣称完整 NISR；R02、R03、R04 各自的完整案例 NISR 均为
**0/5**，另有 7 个完整案例未运行。早期记录中的 P01/P02 PASS 分别指 source 发布和
文本提取子路径，不表示 `cases.json` 对应 `requiredAssertionIds` 已全部完成：P01 仍引用
持久洞察要求，P02 仍引用图像输入/provider 要求。因此 **2/6 只表示缩小后的功能覆盖，
不作为严格冻结探针的 NISR**。原有报告已更正指标名和 G5 的焦点回归范围，未更改
执行结果或降低冻结断言。R05 按全部冻结断言裁决：完整案例 **0/5**，严格冻结探针 **0/6**；没有用缩小范围的通过替换原始要求。

历史插件作者自述中的 E08 PARTIAL 仅指文本子路径；最终 Evaluator 与本报告把完整
E08 列为 NOT RUN。不能用测试断言数量代替案例数，也不能把不同候选与不同任务合并
成同一系统的统计复测。

## 校准、mock 和实验限制

Evaluator 实际构造并识别了“返回成功但不发布”、“持久发布硬编码答案”和“侵入核心的
补丁”等反例；同时运行真实成功、跨用户拒绝和撤销后的迟到发布。它从冻结用例计算
期望值，不从插件返回值生成 oracle。首轮审计没有据此宣称完整案例 NISR。

早期隐藏种子的选择晚于开发者启动，早于交付检查。这偏离了计划中的预提交时机，已在
第二轮报告明确披露；R04 的取消变体在交付前封存，R05 的 oracle 和种子在全新开发者
启动前封存。不同任务的开发用时不作因果性能比较；未获得的 token 成本等指标保留未知。

仅语义抽取使用明确的模型 mock。外部 GitHub release 网络另由生成 transport 提供固定
字节，实际安装的 SHA256、ZIP、worker、Accounts、SQLite、任务、原件和正式资料路径均
执行。fixture 从不提前发布结果或代替宿主权限。没有真实模型调用、个人截图、真实日历
写入、原生设备运行或生产部署。UI 的基线 JSDOM 合同证据与真实浏览器/设备验证分别记录。

## 复现入口

使用仓库 Node 24+ 环境及锁定依赖，先运行 `npm ci` 和 `npm run build:libs`。从仓库根目录：

```sh
# 全部集成测试由受影响检查统一驱动；完整输出另保存为本地日志。
npm run check:affected -- --base 2c78ca8d52a7d17fae20962cf68d09a717ffc73a --head HEAD

# 查看仍存在的生产入口/工厂/通用调用负例。
node --import tsx apps/server/test/fixtures/extension-baseline-probe.mts

# 不同组件顺序在最终候选必须成功；默认不会重写冻结试验文件。
node --import tsx --test apps/server/test/extension-benchmark-meeting.test.ts

# 边界级取消与严格组件身份回归。
node --import tsx --test apps/server/test/extension-worker-cancellation.test.ts apps/server/test/extension-component-registration.test.ts
```

第五轮完整归档入口：

```sh
node --import tsx --test --test-concurrency=1 apps/server/test/extension-benchmark-final-evaluator.test.ts
```

默认 CI 执行行为回归并记录源码差异；`R5_REQUIRE_FROZEN_SOURCE=1` 另外强制原候选的
521 个源文件/清单哈希。插件字节哈希和财务 oracle 在两种模式下均强制校验。生成输入
现已公开，后续运行只作为公开回归，不再计作新的隐藏试验。

## 最终检查与交付状态

最终源码和测试冻结于 `fe15cbd5e7aba9b53e3d664f7470a85107428013`，上述所有宿主改动、
五轮插件与归档入口均包含在该候选中。运行环境为 Node 24.19.0，锁定依赖未改动。
[最终检查记录](final-validation.md) 给出命令、候选 tree、原始失败收据和未执行阶段的
补充运行结果。没有把失败的受影响检查改记为通过。

原始受影响检查完成环境、翻译、scope/release 契约和 shared/agent/server/web 构建后，
在 Agent 的 328 个测试中得到 325 PASS、2 FAIL、1 SKIP，因此退出 1。两项失败已由
[候选/基线字节对照](agent-test-diagnostic/README.md) 定位到已有 mock HTTP fixture
逐 Buffer 解码 UTF-8：分块落在 emoji 字节内部时，原始请求被 fixture 改成替换字符。
四次观测的完整 Buffer 合并后均与期望原文完全相同。本轮没有修改该 fixture 或其断言。
这项归因只解释这两个测试失败，不解释 SQLite 损坏，也不解除 G5。

随后在相同冻结候选和输入身份下，将原计划中尚未执行的五个阶段各运行一次：

| 补充阶段 | 原始汇总 | 阶段结论 |
| --- | --- | --- |
| Server | 3,160 项：3,151 通过、4 失败、3 因超时取消、2 跳过 | FAIL；另有子进程超出命令生命周期 |
| Shared | 198/198 通过 | PASS |
| Web | 601/601 断言通过 | FAIL；子进程超出命令生命周期 |
| Release integration | 37 项：34 通过、1 失败、2 跳过 | FAIL；只读目录写入没有按测试预期拒绝 |
| Central runner | 结构化集成场景完成、退出 0 | PASS |

Server 的一项类型错误传播失败已由跨 worktree 重复加载同名类解释，其他 Memory、
后台导入、关闭和大批量请求失败/超时仍未归因。第五轮归档测试的默认 CI 三阶段均通过，
但不能据此替换 Server 阶段结论。Web 断言通过与检查器的进程清理门槛失败分别保留。
所有补充阶段结束后均确认清理完成，原始受影响检查与补充总结果仍为退出 1。
完整失败矩阵、一次性诊断和先前 M06 失败记录见 [最终检查记录](final-validation.md)。

交付为可审阅的 draft PR。五轮试验、公开回归、已确认改进和未满足要求均已归档。
完整插件化目标与候选可靠性仍未通过验收；后续优先定位真实存储损坏，再设计模型调用、
原生 Harness 和扩展自有触发器的公开合同，分别补齐当前 NOT RUN 与 PARTIAL 的用户旅程。
