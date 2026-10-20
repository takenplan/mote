# Memory 运行合同调查：评估时刻与中性程序

调查日期：2026-10-20。静态源码基线：`af11ab7c3e9fb5f38deaea4e4bae11462a7306b4`。

本次只追踪账户隔离生产组合的入口、持久任务、最终模型上下文和提交消费者，并阅读既有回归源码；未运行测试、应用、付费模型或个人资料。本报告不是修复交付证明，也不为代码偏离修改既定产品合同。

结论：U1 已确认是生产调用者没有保留既定评估时钟，最终模型上下文使用原件投影时间；U2 已确认是固定策略任务仍注入旧语义程序，其中整合的“需所有者确认”与既定自动审核后原子应用直接冲突。是否已经导致某次真实模型漏提、错误日期或拒绝关系，现有证据不能判定。恢复既有合同属于工程修复；只有改用来源时间充当评估现在、重新引入人工确认或旧来源语义政策，才需要新的产品决定。

## U1 评估时刻

### 既定合同与真实入口

既定合同见 [Memory 策略](../memory-strategies.md)：手工任务固定创建时刻，同次自动接收的配方共享接收时刻；重试、跨午夜、不同批次和独立审核不因执行时间改变该语境。原文发生、记录、观察、接收与评估现在仍是不同时间角色。旧重放接口允许显式 `contextTime`，不授予新证据或收费权限。

| 环节 | 静态证据 | 已确认行为 |
| --- | --- | --- |
| 手工生产入口 | `apps/server/src/scope/memory-routes.ts:29–30`；`scope/memory.ts:62–63` | `/api/memory/jobs` 和 `/api/memory-integrations` 进入 scoped 服务；严格请求 schema 不接受 `contextTime`。 |
| 固定任务与分批 | `apps/server/src/scope/memory.ts:370–390`；`scope/memory-schema.ts:42,59–62` | 配方、模型、输入、时区等被持久化，但无评估时钟；批次继承此任务。部分队列表虽有 `created_at`，生产查询并未用其作为评估时钟。 |
| 自动接收 | `apps/server/src/scope/memory-intake.ts:16,27–28,51–65` | ingress 时固定策略/授权；M06 发布后建立正式 Material intake；两种收据均未固定评估时钟。后者的 `created_at` 是发布时刻，不能自动等同原始接收时刻。 |
| 模型输入 | `apps/server/src/scope/memory.ts:252` | 每批 `contextTime` 取该批 `records.capturedAt` 字符串排序后的末项，不是任务创建或收据接收时刻；本调查不把该排序另行认证为各种时区表示下的真实时间排序。 |
| 时间投影来源 | `apps/server/src/scope/memory-data.ts:62–68` | 投影的 `capturedAt` 依次回退到块 `observedAt`、Material `origin.firstAt`、底层原件最早 `capturedAt`、Material 创建时刻；其 `receivedAt` 另存 Material 创建时刻。因此不能将这里的 `capturedAt` 一概称为真实事件发生时间。 |
| 最终 prompt | `packages/agent/src/task-context.ts:42–43,69,73–76`；`apps/server/src/scope/model-query.ts:38–42` | `contextTime` 直接成为序列化上下文的 `currentTime` 和 `displayCurrentTime`；共享查询包装未改写它。HTTP Harness 与 Codex 两个适配器都使用该 `assembleContext`（`packages/agent/src/index.ts:231`；`codex-agent.ts:67–76`）。 |

可达条件是：任务通过正常准入和证据验证，且没有可复用的同一成功模型查询结果，实际进入新一次提取或审核调用。若所选原文早于今天，模型的“现在”就可能早于任务创建；同一任务各批原文时间不同，其“现在”也会不同。某个 fallback 时间偶然等于创建时刻，不代表合同已被实现。

### 消费者与边界

- **独立审核及删除比较**：`apps/server/src/memory-review.ts:43,99` 在审核输入中保留该时刻并写入审核收据；`memory-deletion-review.ts:24` 保留同一输入时刻，虽明确清除 Skill。可确认传值，不代表已证明某个语义判断受影响。
- **实际存储时间**：`apps/server/src/scope/memory-data.ts:146–149` 对审核通过的 `supersedes` 关系，在没有显式 `validFrom` 时以 `receipt.contextTime` 作为旧卡片的 `supersededAt`，再回退到审核创建时刻。因此该时钟不只用于展示 prompt；在上述条件下也直接影响当前/历史边界。
- **检查点与理解复用身份**：`scope/memory.ts:236–244` 对完整查询参数做检查点身份；`scope/memory-coding.ts:71` 的生成身份包含 `contextTime`。纠正调用时钟时必须同时审查相应复用身份，不能将旧成功结果冒充新语境结果，也不能自动收费重跑历史工作。
- **Coding 预理解**：`scope/memory-coding.ts:99–104` 另取该会话子集的最大 `capturedAt`，显式覆盖 base 时钟，同样偏离固定评估时钟。已有完整候选产品可绕过新的提取调用，但后续审核仍使用 base 输入。
- **反馈规划**：`scope/memory-feedback.ts:30` 将成员来源时间的最大值放在 `memoryWork.feedback.contextTime`；`:45` 的规划模型调用没有设置顶层 `QueryInput.contextTime`，因此最终 `currentTime` 默认取当次调用时间。后续子任务仍由相同 scoped 批次执行路径派生其来源时间。反馈目录的成员时间有独立语义，不应无差别改写为评估时钟。
- **不受此结论直接覆盖的路径**：普通 Ask、工作记忆和所有者回答生成有各自时间合同；本报告没有证明它们存在同一问题。成功查询检查点复用路径先验证原件并直接返回，不发生新的模型发送（`scope/memory.ts:236–237`）。原件时间角色与读取授权不会仅因 `contextTime` 被修改就自动改变。

### 既有证据能证明什么

`packages/agent/test/task-context.test.mjs:15–20` 证明 builder 在调用者正确提供 `contextTime` 时跨午夜保持一致；它没有证明 scoped 调用者选择了创建/接收时刻。`apps/server/test/memory-review.test.ts` 的固定时刻与缓存失配夹具同样依赖测试注入。`apps/server/test/scoped-memory-parity.test.ts:43–51` 检查真实生产提取/审核的输出合同，不含创建/接收时钟断言。自动 intake 现有 due-clock 夹具验证调度，不能替代最终 prompt 的评估时钟验证。本次没有执行这些测试。

## U2 中性程序与旧 Skill

### 已确认的最终提示冲突

既定合同见 [策略组合](../memory-strategies.md)、[生命周期](../memory-lifecycle.md) 与 [自动生效说明](../memory-updates.md)：固定提取或整合策略决定语义价值，通用程序只提供只读证据、引用、权限等共用规则；独立审核和宿主校验通过后自动原子发布关系，不要求额外所有者确认。

| 环节 | 静态证据 | 已确认行为 |
| --- | --- | --- |
| 生产任务选择程序 | `apps/server/src/scope/memory.ts:252` | 即使任务已固定所选提取/整合策略，仍按 phase 选择 `memory-extraction` 或 `memory-consolidation`。 |
| 完整内容注入 | `packages/agent/src/skills.ts:16–20`；`task-context.ts:57,73–76` | 读取完整 `SKILL.md`，作为 `procedure` 直接放入最终 JSON prompt，且要求直接应用；不需要模型再次调用 Skill 工具才能接触这些内容。 |
| 所选策略和独审 | `scope/memory.ts:252,275–279`；`apps/server/src/memory-review.ts:94–99` | 生成 request 含所选 prompt，独审 request 换成所选 review policy；独审通过展开原 input 仍携带旧 Skill。两份受信程序在同一上下文中出现。 |
| 直接矛盾 | `packages/agent/skills/memory-consolidation/SKILL.md:16`；`apps/server/src/memory-contract.ts:20` | 旧程序说关系须等所有者确认；宿主准入合同说独审、证据验证后自动原子应用，无需所有者确认。 |
| 宿主实际提交 | `apps/server/src/scope/memory-data.ts:139–152` | 审核收据通过后创建 `published` 卡片，并按精确版本处理 `supersedes`；这里没有所有者确认步骤。此证据不等于模型一定会产生应有关系。 |

**确认的偏离**是所选中性程序未被使用，以及整合生成/审核提示里的显式确认合同冲突。旧提取程序还带通用的观察/记忆价值判断（`memory-extraction/SKILL.md:22,31–33`），可与特定或自定义策略产生叠加；它同时要求服从宿主当前策略，不能仅凭这些文字推断已经发生特定漏提。最终 procedure 指令仅明确不得覆盖 `responseMode` 和证据范围（`task-context.ts:57`），没有消除上述所有语义优先级冲突。

这不是“旧 Skill 文件应从仓库删除”的结论：旧固定任务和其他显式入口可能仍需要可辨识程序。中性 `memory-strategy` 与 `memory-integration` 已存在（各 `SKILL.md:7–11`）；原单用户固定策略调用也已有中性选择（`apps/server/src/memory-pipeline.ts:983`、`memory-integration.ts:95`），可用于合同对照。

### 可达路径与排除项

- 普通 Mote 提取在实际新生成调用时注入旧 extraction；独立审核也保留它。Coding 预理解调用主动设 `skill:undefined`（`scope/memory-coding.ts:99`），所以不能把旧 procedure 冲突套到该预理解调用本身。
- 手工和自动整合都进入相同批次 base，实际 Mote 生成与独立审核均会带 consolidation。若没有候选、调用未进入或成功检查点直接复用，不应声称又发生一次冲突 prompt 发送。
- Hindsight 原生引擎可绕过 Mote 生成 prompt（`scope/memory.ts:270`），但独审仍采用相同 base（`:275–279`）；不能把 Mote 生成 Skill 问题直接归咎于其外部原生提取器。Mem0 module 走 Mote 生成路径。
- 删除比较显式 `skill:undefined`（`memory-deletion-review.ts:24`），不是该旧 Skill 冲突路径。所有者回答、普通 Ask 和 working-memory 不在本结论覆盖范围。
- consolidation 的“至多八条”在现行整合输出合同中也存在（`memory-strategy-contract.ts:30`）；不能把它单独列为已证实违反 `range-evaluation@1` 的问题。新范围评估提取的无候选配额合同与整合的旧输出合同必须分开。

既有 builder 回归（`packages/agent/test/task-context.test.mjs:138–146`）证明完整旧程序会进入 envelope，未验证生产固定策略选择中性程序。现有 scoped 夹具验证引用、独审和提交状态，不是模型解决矛盾提示的语义质量证明。本次未运行或新增测试。

## 最小工程修复计划草案

这是后续原实现 owner 的有界计划输入，尚未取得独立预实施 `APPROVE`，不构成允许当前子任务修改源码的授权。实际方案须绑定届时精确 base/head、原实现 owner、最少共享文件 owner、范围与假设，并按 [技术计划评审](../development.md#technical-plan-review) 完成独立预审。

| 分类 | 计划约束 |
| --- | --- |
| KEEP | 当前账户/来源授权、原件及成员时间角色、策略与模型快照、独审、精确引用、删除比较、版本绑定发布、原始未完成范围、每次物理调用和用量收据、成功检查点与未知结果重试保护。 |
| CHANGE U1 | 在真正创建/接收授权边界持久固定评估时钟；传至批次、跨配方兄弟、Coding 理解、独审、删除比较及明确需要该语境的反馈调用。对照旧自动成员和整合窗口合同，逐项定义哪个时钟被保留，不能简单把所有来源时间字段改成 now。检查 `supersededAt`、缓存、任务/查询身份和收据消费者。 |
| CHANGE U2 | 所选提取/整合及其独审使用匹配的中性程序，语义策略只有已固定策略与审核政策；保留 responseMode、原件范围与公共强制校验。检查 native、候选复用、修正和独审修复路径，不向普通查询扩展权限。 |
| REMOVE | 上述固定策略路径里的旧通用语义程序叠加；不笼统删除仍有明确调用合同的旧 Skill。 |
| EXCEPTION | 已保存成功结果不重新发送；原生引擎生成保持外部合同，Mote 独审仍按选定政策。旧绑定不能被原地重写为新策略。 |
| UNKNOWN | 跨原始接收时刻合并的自动包如何保持各成员既有评估语境、整合窗口的固定时刻、owner-question 子任务及反馈重试如何继承原合同，需要由工程 owner 查全后纳入同一计划。当前持久任务缺字段的处理须遵守当前 MVP 基线，不得顺手增加旧版本迁移或自动历史收费重做。 |

### 最小回归矩阵与真实入口

后续使用生成资料、隔离库、真实 HTTP → ingress/M06 → M07 → 已注册 Agent 适配器的模型协议夹具读取最终 envelope，不只直接调用 builder。测试先规定合同，再实现修复；不得降低原有断言、输入规模或生命周期覆盖。

| 输入/路径 | 必须控制的状态 | 关键断言 |
| --- | --- | --- |
| 手工 `/api/memory/jobs` | 原文比任务早数月；两批原文时间不同；排队跨午夜 | 全批、提取、Coding 理解和审核使用同一固定创建时刻；原文各时间保持独立。 |
| 自动 ingress → 延迟 M06 发布 → 多配方 | 接收、处理完成与运行分别不同；同次接收多配方；重启/暂停排空/显式重试 | 固定正确接收评估语境；不因 Material 发布或模型运行重新取时钟；新输入取得自己的语境；拒绝收据不转成授权。 |
| 整合与 `supersedes` | 有/无显式 `validFrom`；目标版本并发改变；取消/撤权 | 默认关系边界来自正确的固定语境；显式日期优先；自动原子应用且保留历史；迟到或旧版本无部分提交。 |
| 固定个人/Coding/日常/生成自定义策略 | 新生成、候选复用、独审格式修复 | 最终 `requiredSkill/procedure` 匹配中性程序；所选政策不混入旧来源语义/确认要求；引用与覆盖合同不变。 |
| 原生引擎与删除比较 | native bypass；相关/无关删除规则 | 不冒充 Mote 原生生成；独审中性且保留所选政策；删除比较保持只读、无旧 Skill、使用正确评估语境。 |
| 生命周期与复用 | 成功查询已落盘/未落草稿；未知远端结果；定义或时钟改变；反馈子任务 | 精确成功结果不重复调用，未知结果不自动重发；不兼容身份不误复用；新字段不触发历史重新授权；计量和清理收据真实。 |

传值、提示和状态断言可由脚本模型证明；语义是否改善应另用生成场景做独立评估，并单列任何实际模型运行、用量和未完成项。本调查没有执行该计划，也没有恢复交付声明。

## 另一个静态候选：自动队列等待门槛

`apps/server/src/scope/memory-intake.ts:60–61` 在正式 Material 自动 intake 用 `minChanges` 或 `(maxWaitHours ?? intervalHours)` 放行；[生命周期](../memory-lifecycle.md) 的既定普通滚动队列合同明确不等待旧 count/max-wait 门槛。真实入口链为 ingress 保存授权（`:27–28`）→ M06 发布回调（`:26,51–55`）→ 已注册 `memory.intake`（`:24,58–65`）→ scoped admit。该代码条件可导致新输入在计数未达且等待未到时进入 `memory_window_pending`；本次没有通过运行证明具体用户环境中发生过等待，也未查完所有 drain/默认覆盖条件。应由原实现 owner 补查并提出合同恢复方案；不能在本轮改默认、改策略或让所有者为既有合同重新投票。

## 本次文档整理与验证边界

现状文档保留既定评估时钟、中性策略和自动审核发布合同，并链接本调查；已确定的过期字面描述已修正：不存在的 Memory 十万条总量上限、超时自动切分、删除比较默认五分钟总期限、图片理解仅限查询、洞察 count-or-wait。历史验证保留其原基线与运行范围，没有将旧 fixture 结果改写为当前 scoped 验证通过。

本次只执行静态阅读、文档修订和差异自查。运行代码、Skill、测试均未修改；没有测试、构建、真实模型、设备、部署或个人资料验证。统一文档格式、链接和渲染检查由主任务执行。
