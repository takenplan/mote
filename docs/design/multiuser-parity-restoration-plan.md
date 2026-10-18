# 多用户功能对标修复：集成计划与台账

状态：首阶段管理基线，2026-10-18。本文只管理本轮范围、依赖、集成与检查；不证明业务已修复或验收通过。具体验收见[逐项矩阵](../validation/multiuser-parity-restoration-matrix.md)。

## 基线、授权与责任

- 固定起点：`2c78ca8d52a7d17fae20962cf68d09a717ffc73a`；旧行为对照：`2c2627621e2598332ae8169845bc7343be7ed63e`，不是最初分叉点。
- 汇总分支：`codex/parity-integration-20261018`；模块 PR 全部以它为 base。独立管理工作树：`/Users/utopiafar/.codex/worktrees/parity-integration-20261018/mote`。所有文件及 Git 操作显式使用本 chat 返回的工作树。
- [总 PM](codex://threads/01a14e8b-fd8f-7190-9b71-e7648120074b)唯一裁定范围、产品未知项和验收释放；[集成负责人](codex://threads/01a14e8d-8f73-7ac2-a490-27ac73d5f6ba)只写管理文档、处理必要集成冲突并驱动最终完整检查，不代替模块实现。
- 用户已授权模块开发/独立验收 chat、模块分支与 PR、跨 chat 通信和验收后的汇总 PR。暂不合 main、不部署、不运行真实个人资料，也不借此启动历史收费重算或真实目录清理。
- 其他工作流 PR #168（`gilded-analytical` → main，PM 只读快照 `6b557ca3`）不自动纳入；不复用旧 multiuser integration、不操作旧工作树、不移动 main、不强推。

## 行为合同与取代检查

依据 [AGENTS](../../AGENTS.md)、[开发指南](../development.md)、[多用户作用域 ADR](../adr-multiuser-scope.md)和[共享业务流程 ADR](../adr-shared-business-flows.md)。除登录及必要账号资源/权限隔离外，原 A→B→C→产出、输入范围、时序、失败/重试、提示/配方、用户操作与体验保持。单账号和多账号共享领域实现，宿主只适配已绑定账号的 ports。新测试或新设计记录不能自行批准产品变化。

| 取代分类 | 本轮必须落实 |
| --- | --- |
| KEEP | 完整准备/理解/读取/校验/独立审核/保存/消费；原并发、前后台、分页、及时发布、自动维护、成功步骤复用与可达 UI；模型解释语义，查询工具只读。 |
| CHANGE | 身份、配置/凭据、对象/索引/缓存、任务/队列、权限与发布 fence 绑定账号；实例管理与私人访问分离；共享领域接受账号端口。 |
| REMOVE | 为隔离另写而漏业务的替代流程、隐式默认 owner、全局私人访问、无依据的新固定上限/全量扫描/用户手工步骤/静默降级；对应模块查清实际生产消费者后删除陈旧假设。 |
| EXCEPTION | 当前 wire/storage，拒绝旧格式、不做迁移/兼容/旧记录修补；已取消的内部 Agent 字符限制继续取消，外部响应合同保留；录音备份不自动 ASR，显式处理与普通音频原行为保留；Dev 私有文件凭据、Prod 系统保护和第三方 CLI 凭据政策保留。 |
| KEEP 安全边界 | 独立审核、撤权/停用/删除/取消、跨 await 与迟到响应校验、真实外部结果未知、数据恢复不铸造执行权限；修复体验不降低这些边界。 |
| CHANGE 已决 | 用户已选L06重新登录后按原开关继续未来任务，保留策略意图/撤旧执行权/已完成与未知外部事实；AND-D01采集/隐私/同步偏好按账号独立保存，OS权限与硬件仍设备级。无旧版迁移。 |
| UNKNOWN | MCP结构必要性/协议、既有无head删除记录的未修边界及真实模型、供应商、设备/CI仍需独立证据；缺证据保持安全边界。 |

每个模块候选须列出 KEEP/CHANGE/REMOVE/EXCEPTION/UNKNOWN，并检查代码、测试、UI、配置、后台任务、文档、ADR、prompt、agent 指令中的旧假设。旧 legacy builder 仅作行为对照，不能替代当前 production composition；不恢复旧生产旁路。

## 审计来源与证据分级

外部原始审计目录（未复制为本轮结果）：

```text
/Users/utopiafar/.codex/visualizations/2026/10/18/01a14e51-0429-7df1-bfe2-3c36496b5200/multiuser-parity-audit/
  multiuser-journey-parity-2c78ca8d.md
  multiuser-parity-2c78ca8d/{memory,files,ask,connectors,execution,configuration,desktop,android,web,extensions,actions,lifecycle}.md
  evidence/
```

已完整阅读总报告及 12 分报告。源对话：[Memory 排查](codex://threads/01a14e46-1d89-7d43-8bf8-64e13f9c15de)、[旅程审计](codex://threads/01a14e51-0429-7df1-bfe2-3c36496b5200)。外部审计的旧行号须对照完整旧 SHA，当前行号绑定起点 SHA；后续行号不可冒用。

| 标记 | 含义及限制 |
| --- | --- |
| C | 审计已由旧/新真实调用链确认行为或责任差异；模型质量、负载后果、完整旅程仍可能未验。 |
| N | 审计另有生成 SQL、源码函数抽取或静态断言佐证；不等于生产 HTTP、启动生命周期或 UI 端到端通过。 |
| R | 明确结构或条件下的风险推导，后果尚未运行复现。 |
| S | 已确认结构变化，需沿原旅程恢复或证明必要隔离；不能按结构差异声称所有用户故障。 |
| U | 产品/协议/运行未知，等待证据及必要的 PM 裁定。 |
| OLD | 旧缺陷延续，不冒充本轮多用户回归。 |

审计窄 Memory/Ask 测试因缺 tsx 在加载阶段失败，业务断言零执行；其他窄实验只按原报告范围引用。历史受影响检查、原生/真实模型回执都不是本轮候选结果。原审计已修项（历史/普通修订、录音缩短/空导出、备份不自动 ASR、确定本地解码失败结算、用量片段、长输入 guard、mapper 输入集合等）需防回归，不能重复列为待修，也不能直接转记为本轮通过。

## 模块所有权与候选登记

每个矩阵行通过模块键继承下表的 owner chat、branch、PR、独立验收 chat、候选 SHA、释放与集成记录。字段 `—` 明确表示尚未提供，不代表不需要；12模块已由PM派单；下表记录当前已报告的候选，未填者尚未冻结。单项依赖在矩阵内补充，依赖不是修改其他 owner 文件的许可。

| 模块键 / 编号 | Owner chat | Branch / PR | 独立验收 chat | 候选 SHA | 状态 / 阻塞 |
| --- | --- | --- | --- | --- | --- |
| MEM / MEM-M01..M08 | [MEM开发](codex://threads/01a14e8f-6977-7fa3-8145-0b3696ae413c) | `codex/parity-memory-20261018` / — | [独立验收](codex://threads/01a14e90-04ae-70c0-92a5-3f2a24a3bf0c) | `6f44fc26b79e71a2ac43ccd667ab192cbe6d6744` | CANDIDATE；原835基础三方纳264与已审工具、真实percall前置；作者native2/backup44/infra36与types PASS，26artifact核齐；正常18步full run5295正在跑，初始peak已退，旧855失败保留 |
| FILE / FILE-01..06；FILE-07旧缺陷观察 | [FILE开发](codex://threads/01a14e8f-6b10-7001-b7d6-84ba844a5604) | `codex/parity-files-20261018` / [Draft #176](https://github.com/utopiafar/mote/pull/176) | [独立验收](codex://threads/01a14e90-04ae-70c0-92a5-3f2a24a3bf0c) | `4c01da9eee81cc5772976985291b7e7c6145ae11` | QUALIFIED_REMAINING13_PASS；独审22ee83ff/prod0及286明确未变Server baseline；正常common13全PASS/Web601/JVM377 fresh，binding8fb87f26；原286全FAILED及2044 hot/Web失败保留 |
| ASK / ASK-A01..A05 | [ASK开发](codex://threads/01a14e8f-6d35-77d1-ad5f-531013c4ea08) | `codex/parity-ask-20261018` / — | [独立验收](codex://threads/01a14e90-04ae-70c0-92a5-3f2a24a3bf0c) | `e427eccd445d16e7734f5099c303b9710bd0d0f3` | CANDIDATE；原9d向量/事件schema与业务字节保留，薄264+已审工具；作者native/Ask/MCP/坏schema与infra PASS，新23步full/独验待验，旧e23保留 |
| CONN / CONN-C01..C07 | [CONN开发](codex://threads/01a14e8f-6edd-7772-b552-f0ce79bb7c61) | `codex/parity-connectors-20261018` / — | [独立验收](codex://threads/01a14e90-06cd-7242-96bb-349e5fdb83b3) | `fddccce1589be28ea949cc376144ecb309c9974e` | FULL_FAILED_OWNER_REPAIR；原14步run81ead为8PASS/Server3159PASS1FAIL2skip/后5UNRUN，bindingab0751cc；原owner调查五分钟wake/ACK生成时钟失败，native/独验仍待 |
| EXEC / EXEC-X01..X03、EXEC-S01 | [EXEC开发](codex://threads/01a14e8f-7094-7af3-880a-8580a9135ea1) | `codex/parity-execution-20261018` / [Draft #171](https://github.com/utopiafar/mote/pull/171) | [独立验收](codex://threads/01a14e90-06cd-7242-96bb-349e5fdb83b3) | `070ffc04a859d01551674070cdf16551a2c29928` | CANDIDATE；F01修复后driver整22步PASS/1489.376s，已push/更新PR；Android全25任务缓存/未重跑，独验与新ports组合待验，非READY |
| CONFIG / CONFIG-C01..C07、CONFIG-UX01 | [CONFIG开发](codex://threads/01a14e8f-7295-7c62-9d1d-d6f9a3e6a59e) | `codex/parity-configuration-20261018` / — | [独立验收](codex://threads/01a14e90-06cd-7242-96bb-349e5fdb83b3) | `ee42f867d03b282b4f2a12085779b4719e8f6ec3` | CANDIDATE；原5b三方264保Codex配置，providerf56非00e；工具已纳，作者race1/strong50/infra52及types PASS；新23步full/qualified组合未验 |
| DESKTOP / DESKTOP-D1..D4 | [DESKTOP开发](codex://threads/01a14e8f-745e-7330-8770-aed83a43077f) | `codex/parity-desktop-20261018` / — | [独立验收](codex://threads/01a14e90-08cc-7631-b1bb-fe8b691c3e27) | `55b40d37a4948fd40db194f6448b92ac1a287db8` | CANDIDATE；原73 Desktop/Ingress/D2业务原字节保留，薄264+工具，作者native4/重点Desktop18/main-preload5 PASS；新full16未验，旧73仅最小原生UI子范围 |
| AND / AND-01..04、AND-D01 | [AND开发](codex://threads/01a14e8f-7620-73f0-8c0b-032e94f1a3e3) | `codex/parity-android-20261018` / [Draft #172](https://github.com/utopiafar/mote/pull/172) | [独立验收](codex://threads/01a14e90-08cc-7631-b1bb-fe8b691c3e27) | `2622844e3b226f3ebae9542bdb16aafedc5cf3a7` | CANDIDATE；driver7/7及JVM388 fresh PASS；实际模拟器App262+backend070功能子范围PASS/173证据核齐，secure像素受限；Calendar读取与D01原控件偏好子范围另已PASS，Actions交付/D2等仍待 |
| WEB / WEB-W01..W02 | [WEB开发](codex://threads/01a14e8f-77d9-7723-8762-9bb7b456da4d) | `codex/parity-web-20261018` / [Draft #170](https://github.com/utopiafar/mote/pull/170) | [独立验收](codex://threads/01a14e90-08cc-7631-b1bb-fe8b691c3e27) | `f8f684b6dee904d820b9952ead336da5a33f330f` | VISIBLE_MAC_SUBSCOPE_PASS；Q002/R006保留，新增26交互/11图实际Chrome已验；真实模型/原生/完整组合待验，最终READY/汇总未释放 |
| EXT / EXT-E01..E03、EXT-ES01/ES02/EC01 | [EXT开发](codex://threads/01a14e8f-79dc-70b3-8d6c-608e696cb79d) | `codex/parity-extensions-20261018` / [Draft #175](https://github.com/utopiafar/mote/pull/175) | [独立验收](codex://threads/01a14e90-08cc-7631-b1bb-fe8b691c3e27) | `5a5ed7bfeaf1c33409c84bdb6ba906e4e103763a` | QUALIFIED_INCREMENTAL_PASS；freshServerbuild+正常common scope/4组整file80/38/26/16全PASS；native20及544原FAILED分别保留，非新22PASS/最终READY |
| ACTION / ACTION-A01..A04 | [ACTION开发](codex://threads/01a14e8f-7b96-7d00-9b68-d9d30aea97dd) | `codex/parity-actions-20261018` / — | [独立验收](codex://threads/01a14e90-04ae-70c0-92a5-3f2a24a3bf0c) | `2689e88d7ac2a58257903021d4224cd13bcd3c81` | CANDIDATE；原42业务原字节保留，薄264+工具，作者Actions81/native1/infra36 PASS；新full15未验。2044新生成输入实际语义→提案→人审/claim API子范围PASS，非本head动态 |
| LIFE / LIFE-L01..L06 | [LIFE开发](codex://threads/01a14e8f-7dc6-7fb3-a058-cb39df965cb9) | `codex/parity-lifecycle-20261018` / [Draft #174](https://github.com/utopiafar/mote/pull/174) | [独立验收](codex://threads/01a14e90-06cd-7242-96bb-349e5fdb83b3) | `b30c2cb5e1de4bcd1082c0ef2c7185fe6b42f70a` | QUALIFIED_REQUIRED_COVERAGE_PASS；0prod修订独审通过，保6cbd原FAILED/Server组件baseline；新13/13 PASS含Web603与JVM372 fresh，非新22PASS/最终READY |

建议依赖顺序不构成新范围：先修用户控制/凭据/数据生命周期，再补持续推进与完整产物，随后恢复发现/配置/UI，最后收敛结构及恢复未知项。重点接缝为 FILE→ASK/MEM、CONN→FILE/MEM、EXEC→所有 Operation 消费者与 MEM 发布、CONFIG→所有模型入口、ACTION→Android 日历、LIFE→各域。共享文件修改由 PM 明确 owner；冲突由涉及 owner 复核。

## 共享文件与联调归属（本轮通信目录）

下表记录owner协商/PM分派，不授权覆盖他人改动；给消费者的接口须精确commit，无SHA时仅为拟定。

| 接缝 / 文件 | 主责 / 消费者 | 当前约定与未验 |
| --- | --- | --- |
| `scope/processing.ts`、`memory-capture-materials.ts`、`processing-files.ts`、`processing-imports.ts` | FILE / MEM、ASK、LIFE、AND | FILE恢复origin/方案/视图/目录导入，并负责原生CentralLibrary reference/历史详情必要Kotlin消费者；扩大list保持policy preview完整形状及执行head fence。具体片段先协调。 |
| `scope/ingress.ts` begin / GC容量 | DESKTOP / LIFE、AND | DESKTOP修D2 begin，LIFE修GC/容量；双方互认片段。AND半传/丢ACK/重启与原会话过期回归在producer精确SHA复验；取消额外24h专项，不改wire。 |
| TaskExecution、ExecutionEngine、Operations | EXEC / 所有域 | family/parent进度/lane/动态配置归EXEC；MEM域publish锁范围与parent API对齐。 |
| `scope/ask.ts` | ASK / EXEC | ASK业务与EXEC注册lane/Operation片段先协调，不能整文件覆盖。 |
| 录音recipe与Memory host port | MEM / CONN | MEM安装recording配方与ensureRecordingRecipe；CONN负责canonical/locator/媒体/周期及app参数接线，待SHA。 |
| 通用segment语义 / Coding理解 | ACTION / MEM | ACTION恢复旧bounded screen/完整segment producer→semantic actionCues→消费闭环及触发/提示/checkpoint；MEM仅Coding理解/workRecords/events，actionCues仍空。不只修consumer，不扩大所有非录音资料范围。 |
| 配置/model-resources/model-query、配置及Usage UI | CONFIG / FILE、ASK、MEM、EXT | CONFIG主秘密/快照/runtime/草稿/统计/控件及必要CentralAdmin/CentralModels Kotlin消费者；FILE attribution双方协调；storage专用控件依赖LIFE最小API精确SHA。 |
| `scope/memory-providers.ts` Hindsight构造 | EXT新增probe；CONFIG C02固定runtime | EXT报告E02新增实际probe的createHindsightEngine(options)，CONFIG另改原provider执行构造。集成须两处均注入有效host配置`codex: this.configuration.codex()`，不只保留旧执行点一处；双方冻结时附精确SHA/冲突hunk/生成probe与执行证据，不拣未验分支。 |
| shared ModelFeature/embedding | ASK / CONFIG及exhaustive消费者 | 双方协调可选embedding功能，未选无chat fallback；共享消费者补编译/回归，不自动收费回填。 |
| ScopedSummary、system/devices功能页 | WEB / CONFIG、CONN、EXT | WEB首页/设备；CONFIG专用配置；CONN负责Web与原生CentralRecordings阶段/独立错误/重试及原备份状态/回听/显式处理入口必要Kotlin消费者；EXT插件/MCP。相同文件按具体片段协调。 |
| Android日历target/delivery | AND / ACTION | 不改原native合同；AND修真实WorkManager注册，ACTION修建议producer/批准。 |

已确认工作树均在`/Users/utopiafar/.codex/worktrees/`：MEM `parity-memory-20261018/mote`，ASK `parity-ask-20261018/mote`，CONN `parity-connectors-20261018/mote`，EXEC `parity-execution/mote`，CONFIG `parity-configuration/mote`，DESKTOP `parity-desktop-20261018/mote`，AND `parity-android-20261018/mote`，WEB `parity-web-20261018/mote`，EXT `parity-extensions-20261018/mote`，LIFE `parity-lifecycle/mote`。FILE `parity-files-20261018/mote`；ACTION `parity-actions/mote`，不按名称猜测。除后述PM授权冻结检查代跑外，driver不在模块工作树改业务/源码。

## 候选、独立验收与集成

1. Owner 提交精确 branch/PR、base SHA、冻结候选 SHA、文件范围、逐项实现/取代结论、定向与 check:affected 回执、未验与阻塞。独立验收须针对该 SHA 及真实 production 入口。
2. 状态依次为 OPEN → IN_PROGRESS → CANDIDATE → INDEPENDENT_PASS → READY → RELEASED → INTEGRATED → FINAL_VERIFIED。单模块独立PASS先记READY，不立即合入。12模块全部完成、必要独立验收与跨模块依赖预验闭合后，由PM一次明确释放正式汇总阶段。未知项保留U，不因代码存在跳级；新增代码或基线合并后重新核对相关验收。
3. 仅在全体READY及PM一次释放正式汇总后，核验候选PR/base、全部已验commit、依赖SHA和释放证据，按依赖顺序非强推集成。记录候选/合入前/合入后/merge commit并核验祖先；冲突须原owner复核解决结果。
4. 不移植未释放模块，不用另一 workflow 或旧收据替代。集成后确认目标分支确实含相关 commit，才能称已进入汇总分支；这仍不表示进入 main 或部署。
5. 正式汇总后冻结单一集成SHA，由集成driver执行最终检查与跨模块旅程，再交[最终独立验收chat](codex://threads/01a14e90-898a-7330-9ad8-b604cd31b65f)复核。失败修复产生新SHA后重选/重跑受影响检查，保留原失败/未执行。
6. 开发/独立验收需要前置模块时，可另建明确SHA的临时组合候选或登记stacked依赖供定向联调；不算正式合入，不把组合结果转标其他SHA，不使用正式汇总分支绕过全体READY门槛。
7. PM最终释放后才创建/更新针对main的Draft汇总PR并attach_artifact；注明准确候选、模块PR/已验commit/证据及真实模型/供应商/物理设备未验。main保持不合。

| 集成序号 | 模块 / PR / 候选 | 独立验收及 PM 释放证据 | 合入前 → 合入后 / merge commit | 冲突与 owner 复核 |
| --- | --- | --- | --- | --- |
| 尚无业务集成 | — | 未收到释放 | 起点 `2c78ca8d52a7d17fae20962cf68d09a717ffc73a` | — |

PM后续明确授权：冻结clean模块的必跑check:affected可由现有driver在该模块准确workdir/env/head/base代跑，允许必要构建/测试输出，不编辑模块业务源码。先复核输入/锁/Node ABI/Java，串行执行并保留driver实跑receipt；owner应明确引用driver代跑而非冒领。失败需修代码或PR创建再按槽恢复owner。最终完整集成driver仍唯一，所有PR门禁/消费者/原生旅程不豁免。

## 唯一完整检查 driver 与耗资源检查排队

遵守[PR 检查范围](../development.md#pr-check-scope)及[后台测试](../development.md#background-testing)。不修改检查器或 Actions 设置来绕过门禁。PM 只读快照显示 GitHub `Checks / Component checks` 为 `disabled_manually`，空 statusCheckRollup 不等于通过；本地与 CI 状态分别报告，不承诺 CI 已运行。

- 唯一最终完整集成检查 driver 是本集成 chat。模块开发先做聚焦检查；每个代码 PR 前依法执行 `npm run check:affected`，先 dry-run 报告 `affected`、`selection`、`checks`，不得豁免。
- 安装/native构建/模拟器冷启等峰值使用明确5–10分钟短窗并记录资源owner；不把整个API/UI/model运行串成重资源等待。各工作树按准确lock正常准备依赖，不共享node_modules/dist软链；记录Node/ABI，native与实际运行同runtime。仅准备当前入口确需的SQLite/Sharp等，Electron在实际需要时补齐；依赖准备不作业务验收。
- 模块向本 chat 报名：owner/工作树、PR base ref 与解析 SHA、冻结 HEAD SHA、是否有未提交输入、dry-run 完整选择结果、拟执行命令/环境/预计资源、定向前置和日志位置。批准排期只协调主机资源，不代替 PM 产品/集成释放。
- 完整check:affected只由本driver串行执行且遵守common检查锁，运行期间冻结对应源码。独立后端/账号/DB/端口/目录的focused、API、Mac UI、Android实际交互和本机Codex可并行；同源码、同库、同Mac前台UI及同serial独占，构建/冷启峰值另交短窗，不另开完整组合套件。
- 现有入口跨 worktree 共用 Git common dir 下 `mote-check-driver.lock`，不另造锁或绕过驱动。占用时按 UNRUN 报告并回队；不自动抢占、不终止他人任务。仅确认原驱动及子进程全部结束后，按开发指南处理残留锁。
- 完成/失败/中断均回报精确命令、候选/输入摘要、环境、退出码、逐步结果、common-dir `mote-check-receipts/<id>.json` 路径、日志与清理结果；然后释放下一位。输入变化使本轮结果失效，不拼接不同轮 PASS。
- 最终相对 main 的受影响组件及消费者由冻结集成 SHA 与当时核实的基线计算；必要时补 `check:local` 的广泛 TypeScript 集成检查。原生编译、浏览器/隐藏 Electron、Android instrumentation、跨端契约与旅程按行为另验，不能由选择器或旧回执推定通过。
- 仅文档阶段检查格式、语法、链接、表格/代码块渲染；可以 dry-run 证实文档范围，不运行应用构建或测试。文档内记录原被测 SHA，补文档不重标代码验证版本。

| 排队号 | Owner / 候选 / base | dry-run 范围 / 命令 | 排期 / 锁 / 状态 | 回执 / 未执行 / 阻塞 |
| --- | --- | --- | --- | --- |
| R001 | AND / 起点2c78ca8d+在途Android输入 | JVM22项、APK/testAPK及native capture冲突/日历/恢复页各1项作者报EXIT0；source暂停fixture未到断言 | 已释放；生成backend/reverse/emulator已清理，AVD留复验 | `/tmp/mote-parity-android-native-{conflict,calendar,recovery}.log`；后续代码已变不转记最终SHA，非独验 |
| P001 | LIFE / Node26.11.1 ABI147 | native/Electron及两处SQLite probe EXIT0 | 已完成释放 | 准备非验收 |
| P003 | CONN / Node24.22.0 ABI137 | 独立npm ci及两处SQLite预检EXIT0 | 已完成释放 | `/tmp/mote-connectors-npm-ci.log`；非业务验收 |
| P004 | MEM | native及两处SQLite probe EXIT0 | 已完成释放 | Node26.11.1 ABI147，lock未改 |
| P005 | EXEC | native及两处SQLite probe EXIT0 | 已完成释放 | Node26.11.1 ABI147 |
| P006 | FILE | native及两处SQLite预检EXIT0 | 已完成释放 | Node26.11.1 ABI147 |
| P007 | DESKTOP | native/Electron及两处SQLite预检EXIT0 | 已完成释放 | Node26.11.1 ABI147；无UI/lock更改 |
| P008 | ACTION | native/Electron及两处SQLite probe EXIT0 | 已完成释放 | Node26.11.1 ABI147；非业务PASS |
| Q002 | WEB / `f8f684b6dee904d820b9952ead336da5a33f330f` / 起点2c78ca8d | driver实际Node24.21.0 ABI137代跑；9/9步骤passed，116.413s | DONE_PASS，2026-10-18 19:03:14（Asia/Shanghai）；非独验/最终集成 | runId91082734-146e-4fa2-9acc-32eac6a54248，输入固定/clean，cleanupConfirmed=true/锁已释放 |
| Q007 | DESKTOP / `73c1115287fe07e1824526861ebc2e8ed3cf39fc` / 起点2c78ca8d | Desktop+Server+Web；Android=false，D2另跨端联调 | WAIT_GLOBAL_SLOT；作者83项及29+1/类型/预检报告通过 | `/tmp/mote-parity-desktop-affected-plan-final.json`；完整gate与D1–D4未验，最小实际原生UI见当前检查点 |
| R002 | CONN / exact179237a0 native两方法 | RecordingParityInstrumentedTest阶段历史+首次save auto on/off，无pre-sync；新14步含JVM，APK/instrumentation另排 | WAIT_SERIAL_RESOURCES；原生未跑，API/serial实际窗口重核 | Node24.22 ABI137/JDK21，生成backend开发smoke仅其输入；独立实际index/managed CLI启动仍UNRUN，不能冒原生/真实供应商 |
| R003 / Q008 | CONFIG / `5b218d926568ed4c4a51ba8a50e9278f706f4cfa` | 新dry-run实际all=true/22步六TS+Android；manifest68hash全核，18窄PASS+types/i18n/scope/两个入口语法通过 | WAIT_FINAL_FILES_COMBINATION_AND_SERIAL_CHECK；owner已结束 | 组合须重绑Config5b + File374 + LIFEef + Ask9d；旧79bf图/语法不作实际启动/浏览器/native证据 |
| R006 | 独立客户端验收 / PR#170 exact f8 | 私有依赖/构建、窄12项、真实main双用户browser77.096s、13入口11.086s、30012ms设备刷新/31s卸载无读、6图真实场景 | DONE_PASS并已释放；旧PM browser范围确认保留，整体READY未释放 | JSON SHA256 4cb7d378cf69b135e06ff5161f4d8936a95560da5ff5929d8a4ca83f6f6e199b；跨EXEC/新域组合仍UNRUN |
| R007 | 独立物理Mac可见Chrome / PR#170 exactf8 | Node24.22 ABI137/实际CLI→src/index，26交互/11最终图；A-B迟到隔离、设备刷新29895ms/离页31501ms零GET/重进均PASS | PASS_EXECUTED_SUBSCOPE_ONLY；private profile/DB/Chrome/49170已清理，无model | report28450a08/manifest768dc2d7/driver42e58fc4；新模型Insight/扩展动态/producer/native/OS隐藏可见/组合未验 |
| P009 / R004 | FILE / 8217依赖准备已完；native等新并发freeze | driver补固定Electron41.10.7后全环境PASS/源码和lock未变；原生未运行 | P009 DONE_ENV；R004 WAIT_NEW_INPUT_AND_WINDOW | 8217 gate Desktop失败/e799 sourcepool静态退回；native 4JVM/2instrument方法合同只作未验计划，不冒producer smoke为native |
| Q001 / Q001-R1 | FILE / 286FAILED→current4c01，base2c78 | 原7c43/1535.277034s，16PASS/Server3163PASS2skip/Web598PASS3FAIL/后5UNRUN；新4c01作者4PASS，旧87含先期4分列 | QUALIFIED_REMAINING13_PASS；正常common27108/185.309125s，13/13PASS，Web601/Shared198/JVM377，79freshXML/25tasks全执行 | 原bindingee163d30/plan d966fac8/新binding8fb87f26；已推Draft176，不冒新22PASS；2044六case适配与原hot失败另案，单次插桩诊断NONREPRO不作修复 |
| Q001-A | FILE / exact8217旧gate | runfacf1b1a，151.598s；Desktop603PASS/3FAIL；12步PASS后9UNRUN | FAILED_AND_CLEANED；source同HEAD/clean/cleanupConfirmed，锁释放 | metadata canonicalization mismatch已由e799修；两OCR失败是A pre-manual旧fixture假设，不是B privacy回归；原log不改 |
| Q004 | LIFE / exactb30c2cb5 / Draft174 | run d075289e/191.836518s，批准剩13/13PASS；Web603/Shared198/JVM372，78freshXML/25tasks全执行 | QUALIFIED_REMAINING_PASS；6cbd原16PASS/WebFAIL/5UNRUN及Server3168PASS2skip仅明确组件baseline | bindingc44810da；sameHEAD/clean/inputunchanged/cleanup/PIDgone；未声称b30重新跑Server或新22PASS，真实/组合仍独立 |
| Q006 | MEM / exact6f44fc26，原835+薄264+已审工具+percall fixture | 作者native2/backup44（含嵌套）/infra36分列，Server/scripts/types/scope/i18n通过；新正常18步 | RUNNING_FULL18；run5295dbfc/PID22139/19:08:49.384Z；初始build peak19:09:14已退，common独占，原835/855结果留原输入 | manifestd69d4be5/26artifact核齐；provider三方保Memory ModelCall并移除Entry.tail，旧native前置RED与新running续体前置独立 |
| Q006-B | MEM / exact855旧full | runa77215a6/1520.258s，14PASS/Server3169PASS52FAIL2skip/后7UNRUN，Android未跑 | FAILED_AND_CLEANED；sameHEAD/clean/cleanupConfirmed/锁释放/PIDgone | binding25141a20；逐52分类见835新packet，原log/receipt不改 |
| Q006-A | MEM旧72f/1c历史 | 72f run d5a6098d整13步8PASS/Server3160PASS1FAIL2skip/后4UNRUN，1298.654s；1c只修fixture8PASS后独立F01..03/R01退回 | FAILED_AND_SUPERSEDED；原receipt/diagnostic均保留，不再跑旧源 | 当前855修生产流程，必须新22及新独验，旧13/定向不拼PASS |
| Q003 | EXT / exact5a5ed7bf / Draft175 | 批准freshServerbuild+1505artifact绑定及剩5check c6ac/428.868812s全PASS；4整file组80/38/26/16，无fail/skip | QUALIFIED_INCREMENTAL_PASS；normalcommon/source/input/cleanup已核；旧native20另列 | bindingbcfb9d59；544原全FAILED/组件baseline原样保留，新5a不拼22PASS；真实UI/model/最终组合未验 |
| Q003-B | EXT / exactd468旧gate | run6820aa4c，1430.727s；14PASS/Server3087PASS62FAIL2skip/后7UNRUN | FAILED_AND_CLEANED；source未改/cleanupConfirmed/锁释放 | 58 config_prepare_failed、两recording503、1旧MCP helper、1legacy import preparing观察；082各类别修复与原失败分开 |
| Q005 | ASK / exacte427eccd；9d/e23历史保留 | 薄264+已审工具三对patch-id匹配，原9d producer/readset/schema不变；新正确dryrun23 | WAIT_SERIAL_FULL23；local clean未push/PR，不借原9d28/6188源码绿 | handoff19732527；native/Ask/MCP/当前坏schema真实CLI和infra为作者定向，新完整gate/组合与设备未验 |
| Q009 | EXEC / `1e9ec7ab253cbb25bd21f14f3aee9ea19bbb96d2`，base2c78ca8d | driver整14步PASS/1490.842s；Server3133+2skip，Web602/Shared198/release37，Android JVM373/0skip | DONE_PASS；run67404cc8，20:24:10（Asia/Shanghai），cleanupConfirmed/clean/锁释放 | inputIdentity99e9bb294dca83022cece84186a5008794eac49cbe024bb2757c51cb1022ddaf；新Memory/Files M05接口与组合不在此轮 |
| Q009-R1 | EXEC / exact070ffc04，已push/PR171已更新 | fresh22/22PASS，1489.376s；Server3140PASS2skip/Agent327PASS1skip/Desktop606/Web602/Shared198 | DONE_PASS；run21f009bb，21:41:40（Asia/Shanghai），sameHEAD/clean/cleanupConfirmed/锁释放 | binding95ad1463；Android25/25 UP-TO-DATE、0fresh，不冒373重跑；独验/native/新ports联合未验 |
| Q010 / R005 | AND / exact2622844e+backend070 / Draft172 | 完整7/7、JVM388 fresh与准确APK构建PASS；实际App/Worker/SAF/切号/冷重启子范围完成 | PASS_EXECUTED_APP_FUNCTIONAL_SUBSCOPE_WITH_EXPLICIT_GAPS；173原件/Calendar88/D01 241工件核齐，资源已清 | report8533ddd3/manifest007fe766，173/173hash一致；原像素FLAG_SECURE受限；Calendar读取与11键D01偏好另已验，WRITE/Actions交付/native模型/D2未验 |
| Q011 | CONN / 4fe01f47旧候选 | Java25环境修正轮及Java21过时候选停止轮分别保存；不得拼PASS | STOPPED_CHANGES_REQUIRED，PM释放owner修复F01-F05；R002暂缓 | Java21 receipt d287d97c原cleanup=false/EPERM保留；后验13PID与PGID3095均消失，核owner后只清残留锁，可写入已通知 |
| Q011-R1 | CONN / exactfddccce1，base2c78 | run81ead226/1177.790458s，8PASS/Server3162=3159PASS1FAIL2skip/后5UNRUN；source/input未变、cleanup/锁释放/PIDgone | FAILED_OWNER_REPAIR_DISPATCHED；五分钟wake测试:242仅一项失败，根因未定；不凭耗时/负载归fixture | bindingab0751cc；Web/Shared/release/central-runner/Android后5UNRUN。原owner仅做最小调查/修复，必要新scope交独审，不自宣Server或新14全绿 |
| Q012 | ACTION / exact2689e88d，base2c78 | 原42全部30业务源不变、delta11/base41；薄264+工具，作者Actions81/native1/infra36及types PASS | WAIT_SERIAL_FULL15；local clean未push/PR | receipt actions-next-gate-20261019；实际ActionEvidence直接读当前owned raw，文本路径不依赖M06/Memory，旧archive parity仍UNKNOWN |
| Q002-CHECK-RESERVATION | WEB | driver代跑已PASS，重资源锁释放 | 已消费完成；后续owner发布按全局槽 | 不自动独验或合入 |

同一已冻结输入可在一个批准资源窗口按顺序做原生旅程与完整affected，但完整driver保留全部选中步骤，不能跨轮缓存或拼接定向PASS；Gradle实际UP-TO-DATE/skip与真实执行分开记录。任一步后改代码/输入，重新冻结、重选范围并复验受影响结论。

## 最终设备UI与真实模型验收（用户最新决定）

最新用户答复“模拟器就行”覆盖此前Android实体手机前置：本轮Android以模拟器上的真实Mote App/UI/权限/SAF/Worker/切号/日历及生命周期验收，默认无窗口、ADB实际交互；实体手机/OEM未验单列而不阻批准范围。Mac仍用物理Mac上的真实UI连续交互覆盖细分用户旅程。生成资料与隔离测试账号用于验收；fixture/API、unit、DOM/headless保留为支持证据，Android实际模拟器App交互按已批范围验收。Web R006支持证据与新增R007物理Mac已验子范围分别保留；最终READY及汇总释放仍须闭合对应模块的必要未验项。

真实大模型验证统一调用已有本机Codex Server。先盘点当前进程、Mote配置和实际路由，不猜端口/API、不擅改第三方模型、不静默fallback。记录脱敏endpoint、runtime/model、实际调用、结果与所用精确源码/数据集；生成HTTP模型fixture不算真实Codex调用。

按实际设备、隔离后端/账号/数据集分场景并行，同一设备UI、同一测试profile或数据库独占。完整check:affected仍由driver单窗口串行。保持目标5/上限6个active chat（含PM/driver），不新建chat或spawn。真机交互前说明设备、窗口占用及权限影响；准备和构建后台执行。未授权部署、不重跑真实个人资料、不采集个人截图；缺设备或系统权限先给PM具体缺口清单。

客户端已完成v1/v2设备、Dev app/权限、本机Codex元信息和66+22细分矩阵；准备报告不作App执行PASS。v1四hash保留，v2明确ENV01移除手机/USB条件。实际窗口由driver在准确APK/隔离后端/账号和设备锁齐备后派发。后续按实际冻结PR/临时组合与设备锁派单；Mac采集/队列/浏览，Android采集/SAF/Worker/A-B-A/日历，文件/图片/历史处理，producer→Memory独审保存→Ask/Actions，配置/插件/MCP与隔离备份恢复分别列前置、交互、预期、证据、互斥资源和UNRUN。

MCP访问Mote私人上下文与能力必须用户鉴权和账号授权；外部MCP源按自身原有鉴权合同，合法公开匿名源不增OAuth。协议初始化和会话管理由客户端完成。鉴权之外新增手工建session、预建connection/source等步骤，仍须具体必要性证据及产品裁定；这次鉴权决定不扩张为其它用户步骤授权。

## 全局对话槽位与待办（用户最新约束）

后续同时执行对话目标5、上限6，PM和driver也计入。当前已运行任务继续，不中断/取消；现有子代理继续完成，完成后不补位。不再创建chat或spawn子代理，不因FYI唤醒idle/notLoaded的开发或验收chat。重启须先由PM/driver检查总active并登记槽位，超额存续自然收敛，不新增占用。等待检查/前置/验收的模块留下精确待办后结束回合，不空转。

2026-10-19人类最新调度（turn01a14fbc）：取消额外模拟超过24h专项、真实等24h替代及其前置/排期/完成下限，保留产品session expiry/durable ACK/restart及既有自动化回归。v2原hash不改，当前scope修订=`/Users/utopiafar/.codex/visualizations/2026/10/18/01a14e8d-8f73-7ac2-a490-27ac73d5f6ba/parity-integration/acceptance-scope-revision-20261019.json` SHA2561a866ba5cde37330135d2a57bda0a4ba8ae11740a71f9ec56b09a594e31abab2，覆盖PHYS-DESKTOP-D2/PHYS-S01的额外时长条件，不删除88条原旅程。driver无owned24h专项wait需要停止。最新用户规则优先于下方历史排窗叙事。

| 槽位对象 | 快照状态 | 当前工作 / 释放条件 |
| --- | --- | --- |
| PM | 按轮协调/裁定后释放 | 维护关键路径、验收与最终汇总释放；不写业务/跑full |
| 集成driver | active，唯一完整检查调度者 | Life/Ext/File合格补验已完成，Draft174/175/176；Memory6f44正常18步在途，Ask23等按精确源排队 |
| 原owner工作 | CONN最小返修、Memory/M05只读triage、Exec新source resolver已实际恢复 | 原2044不改；File一次隔离诊断NONREPRO已结束。新managed全12源组合只准备源与冲突，Conn fdd为临时failed来源，返修后必须替换重绑；不安装/build/full/UI/model |
| 核心独验 | 2044及新一条Actions真实链已结束并清理 | 真实Files→Memory→Ask/取消/重启及新Actions人审/claim API子范围PASS；原hot/Web/旧两Actions输入结论保留，整体NOT_READY，新组合freeze后独审 |
| Android独验 | 已结束并清理 | 原262+070 App功能/Calendar读取/D01 11键原控件偏好隔离子范围PASS；secure像素/WRITE/Actions交付/D2仍待 |

| 待办号 | 待通知/执行对象 | 具体条件与范围 | 当前状态 |
| --- | --- | --- | --- |
| G001 | WEB PR#170 | 新R007实际Mac Chrome/26交互11图报告28450a08；driver核48证据/234artifact及关键图，49170/UI锁已清理 | PASS_EXECUTED_SUBSCOPE_ONLY；已更新Draft170 metadata，source未改；模型Insight/扩展动态/native/OS可见性/组合仍待 |
| G002 | CONN native C07 / exact179 | 首次save auto on/off与阶段历史两方法，真实select→一次admit→追踪syncTask；先核14步/专用无窗口窗口，backup固定true不增toggle | WAIT_SERIAL_RESOURCES；新native JVM/APK/instrumentation/独验UNRUN |
| G003 | AND D2及Ask组合 | D2前置`5744d6a832117a9f9aec7affd37453ab15d455cf`（含早期1417及part/commit upload_expired补充），Android与Ask消费者精确SHA待冻；仅临时组合，非PR夹带/正式合入 | WAIT_DEPENDENCY |
| G004 | 四独立验收chat | 排队传达已决L06/D01、精确PR/head/base/依赖与新消费者清单，闲置不唤醒；一次一项 | WAIT_GLOBAL_SLOT |
| G005 | 唯一common检查driver | Life批准13、Ext批准增量、File批准13已PASS并推Draft174/175/176；Conn14已FAIL交原owner，Memory18在途，随后Ask23等准确候选 | RUNNING_MEMORY_FULL18；Ask23/Config23/Actions15/Desktop16等排队，Conn按返修delta与独审另定；无并行full或在途工具替换 |
| G006 | Memory新6f44 | 原835备份attempt修复保留；三方264/percall真实fixture/工具前置已完成，26工件核齐 | RUNNING_NEW_FULL18_AND_WAIT_COMBINED_DYNAMIC；原855失败保留，2044普通Memory链不代替独立退款/不回放边界 |
| G007 | Config实际consumer组合 / 新ee42 | ee42须与全12新冻结源组合并保provider configuredCodex、Memory percall与Ext probe；旧5b/2044绑定不转记新组合 | REQUEST_REGISTERED；实际startup/生成artifactTransport/角色403/图片与storage联合未验，不改正式integration |
| G008 | Files M05 publicProgress port | exact8217纯schema/retired只读投影在e799未改；原Exec owner只读无新增确认blocker，作者57+1与动态独验分开 | 窄host source复核已做；新Files并发fix后的全gate/控制组/固定组合/native仍待 |
| G009 | EXEC Draft#171 / exact070 | F01 required parent-generation schema+真实CLI/恢复regression；新22步driver PASS，已正常push且PR head/body核对，Draft/Open/未合 | WAIT_INDEPENDENT_ACCEPTANCE；新Memory/Filesports及实际producer/父链组合另验，非READY |
| G010 | 临时组合2044b446 / treee3516104 | 独立source/86交接+60最终工件、146源、215表核齐；native2/targeted20、本树构建与实际Memory/Ask/取消/重启阳性 | NOT_READY_FINAL_REPORT_1f7735e1；原hot1PASS1FAIL初始17、Web1PASS5FAIL/旧两Actions INCOMPLETE保留。新Actions47e9 API子范围PASS/37工件已核；单次hot插桩诊断NONREPRO，原原因UNKNOWN |
| G011 | Files873只读delta预审 | report515baf84；PM接受FILES-STATIC-01源码闭合，无确认新bug；作者98PASS不作独立动态 | DONE_SOURCE_DELTA_PASS_PENDING_DYNAMIC；Q001可排新22，非READY；后续组合须保留File for(;;)，不带回e01 outer pool2/4 cap |
| G012 | Memory855只读预审 | report00acbb40，F01/F02/F03/R01源码闭合、无确认新bug；27附件/25源核验，作者结果分源 | SOURCE_REVIEW历史保留；新22已FAIL/52待返修，设备UI/real-Codex/组合未验，非READY |
| G013 | Android实际App与scope修订 | 原8533/173项与Calendar3c92/88项均核齐且已清理；原范围取消额外24h，正常expiry/ACK/restart保留 | D01_ACTUAL_PREF_SUBSCOPE_PASS；e24c3583/241工件核齐，11键A-B-A+冷启与33键原值恢复已验并清理；采集停止，像素/其他catalog不扩大 |

已决政策立即适用于活跃owner；未运行验证仍UNRUN。任何新产品分歧仍送PM，政策已答项不再重复提问。

LIFE-L04已由PM明确：恢复原当前完整导出直接响应下载；删除中央永久完整副本/下载历史这一替代旅程，仅保留内部单引擎进度、无内容回执及必要暂存。完成/失败/取消/断流/重启按原清理与重试，不新增latest-only、TTL、次数政策或额外步骤，不操作真实历史副本。控制/最终验收通知排G004。

## 已确认首启动与账号偏好边界

AND-D01已由PM进一步明确：旧全局隐私/采集/同步值无可信owner快照，不能猜给当前登录账号、不能回填；保留旧私有值，不自动复制或删除。没有本人稳定deployment/account快照时使用既有CollectorConfig默认，运行采集停止、本人预览未确认。之后保存/恢复按账号，A→B→A恢复参数但换号运行态仍停止，snapshot.enabled不自动开采集。

系统权限、SAF、device/debug、容量和外观仍设备级；设备SAF grant不能当另一账号source授权。origin不是主要身份。生成回归覆盖首启动、同账号重登、URL和凭据变更、同deployment/account换URL、A→B→A、旧Worker/迟到响应以及SAF持久授权与账号source授权分离；不做旧格式迁移。客户端组/最终组通知继续排G004，当前不唤醒。

## 待发送给正式验收的更新摘要

不因FYI唤醒idle；G004有槽且有精确PR/head/base再交下述摘要。Web R006已完成独验且模块READY；Files/Ext/Memory旧候选静态结论不等于修复新head通过。其它完整独验按精确候选与必要依赖另排。

- L06：用户选重新登录后按原开关继续未来任务；旧credentials/leases/grants退休，已完成外部操作不重复，unknown外部写先对账。不是逐域重开，也不复活旧执行权。
- D01：偏好按稳定deployment/account独立；旧全局无owner不猜/不复制/不删，缺本人快照用既有CollectorConfig默认且采集停止/本人预览未确认。换号恢复参数不自动运行；OS/SAF/device/debug/容量/外观设备级但SAF不等于另一账号source授权。
- FILE-PERCEPTION：完整原image auto/profile、外部OCR、allowQueryImages、按日期/来源complete/recompute preview-confirm；instance MediaAssets/MEDIA_CATALOG、OCR-ASR健康/真实安装恢复admin与scoped消费者。FILE领域、CONFIG专用Web/Kotlin、ASK权限消费；不能仅DTO/伪ready，无自动真实大模型下载/开关/历史重跑。
- 录音backupAudio旧native隐藏固定true、shared literal(true) KEEP，不新增关闭开关；验独立备份状态/回听/显式处理及C07 metadata/各phase/error/nextRetry。备份不自动ASR，显式处理和普通音频原自动行为保留。
- L04：当前完整导出直接响应下载，中央永久完整副本/下载历史移除；必要暂存按完成/失败/取消/断流/重启与原重试处理。无latest-only/TTL/次数政策或额外下载步骤；不操作真实历史副本。
- 实际运行证据：Q002仅Web模块required affected门禁由driver实跑9/9通过；不是独验/原生/最终集成。原Operation family、增量刷新、Work父子进度和设备30秒刷新互不替代；D2最新5744d6a跨端组合仍另验。

## 当前验收检查点（2026-10-19 03:20，覆盖历史运行快照）

本节及上表是当前登记；文内历史排障叙事保留原始时点，不代表进程仍在运行。模块均未获最终READY，正式integration未纳业务提交，main未合、未部署。

File286保留264 provider生命周期互斥与071实际OCR自动处理前置。CORE-HOT-01确认一个测试前置缺陷：第九个A任务复用worker0时，该物理worker可以仍被自己未完成的子进程占用，19个子进程是合法等待，不证明全局并发被隐藏截断。新增独立第九listener验证全局8→3→8达到20；复用worker0情景先断言19/attempts0，再释放该worker达到20，双账号、取消、迟到不发布及原期限都保留。作者完整11项PASS，286生产代码相对071为零差异。旧27a原失败未记录listener索引，根因仍UNKNOWN，不追认其通过；新组合独立两情景结果见下，不由本模块PASS转记。manifest91ea6991的9个artifact由driver核齐。

Ext544整轮21步PASS（Server3161PASS2skip、Web602等）仅作为准确组件baseline，原native372PASS1FAIL使整轮FAILED。5a保Ext原releaseProbe与264生命周期修复，provider原blob为fa3a08f4而非File的7ea8，不能盲覆盖。异步check沿同一durable task等待完成，生产原有3秒自动轮询及单次用户操作不变。作者Node29项与driver新native20项分开；driver native25任务全fresh、0缓存、0失败/跳过。完整544→5a差异和provider/MCP/Ask/backup消费者已由独审批准并实际完成必要增量，不能把旧21与新native拼成新22PASS。候选42cb88fe及57个源hash由driver核齐。

独立核心总报告9ae05c4f的54个safe artifact由driver核齐。准确27a上的生产启动/生成A-B登录→自动Files处理→本机Codex gpt-6.1-sol/high/fast Ask→连续Memory提取和独立复核保存→Memory查询/原证据→实际模型取消→SIGTERM重启持久事实无重放子范围已执行，A用量5（4完成1中断）/B0。准确070另有编译入口及真实Chrome查询。准确Desktop73实际自身构建→原生main/preload启动→生成账号连接→中央记录详情→正常退出仅最小原生UI子范围通过；capture/TCC、D1–D4、完整产品仍未验。“编码对话”标签在两旧基线均有，单列继承P2观察，不冒新回归。

Android报告8533ddd3/manifest007fe766的173个safe artifact由driver核齐。准确262+070实际原生登录、Notes保存/Worker ACK/中央来源、A→B→A、账号同步偏好、force-stop冷重启、SAF三个reference项暂停→重启→恢复上传3/3、邀请原步骤与日历deny→retry→allow已执行；A/B模型用量0。日历读取当时0个calendar，READ=true/WRITE=false，不证明真实数据读取或Actions写入。App截图因FLAG_SECURE为黑，功能树/实际输入/持久效果与像素验证分列；系统权限/SAF有可见截图。原进程和租约已清理，stock数据保留；新CALENDAR-ENV-01复用它，不使用个人云日历，不重建APK。

独立检查范围审计7e14a79e覆盖12完整base..head差异524文件变化/1054hunk及真实PR，不按最后补丁判断范围。审计当时8个未来模块Server+最终1次只是安全上界，不证明每个Server用例必要。MAP-ROOT-BACKUP由原Exec owner在独立工具树实现，候选be096a80/treef92c69dc仅3个精确helper映射与必要planner/tests/docs；保Server/Web、根安全/更新及backup.ts脚本类型与diagnostics声明构建前置，未知/rename/混合继续保守。审计时12个固定候选同base/head旧新计划（新候选仍重新派生）：MEM22→18、FILE22→19、EXEC22→16、ACTION22→15；ASK/CONFIG/EXT/LIFE22→23（补独立顺序update），CONN14/DESKTOP16/AND7/WEB9不变。工具自身正常common锁门禁2/2、独立infra52/52及24次真实CLI重放/542绑定断言通过；Control b3865af9批准完整六文件，已推Draft173。后续Mem6f44/Ask e427/Conn fdd已把精确工具提交纳入自己的Git输入，driver不实现或自审selector，原File7c43轮未改。没有Server套件裁剪、Desktop AST优化、runner并行或Server并发提升；实测时间节省仍0。

新增执行状态与证据：File4c01已由独审22ee83ff确认三因和3053未变路径，保Server3163PASS2skip原组件baseline/整轮FAILED；新13义务正常common run27108已13/13PASS，185.309125s，Web601/Shared198/JVM377、79freshXML/25tasks全执行0缓存，binding8fb87f26。正常push并创建/attach Draft176，source/input/cleanup已核；不称新22PASS，不借4例绿覆盖2044六例。Life b30的唯一两文件tests/docs修订通过独立dfdcf323；除了这两路径，3053路径/mode/blob及Server全tree66a4d051与实际6cbd完全相等。正常common d075的批准13步全部PASS，191.836518s，Web603/Shared198与JVM372（78freshXML/25tasks全执行0缓存），bindingc44810da。原6cbd full继续FAILED、Server3168PASS2skip仅作已准组件baseline；新b30已推Draft174，不称新22PASS。Ext独审d4ef9092与计划8038bd82核完整57/9差异、保原probe与releaseProbe，准fresh Serverbuild+scope+10完整consumer文件；build已PASS并绑定本树1505编译artifact，正常common c6ac剩5项全部PASS，旧native20与544失败各自分列。

新core2044/treee351已正式释放；Memory835/Exec070/File286/Ask9d/Actions42/Life6cbd/b30均是真实祖先，Ext5a/Config5b未纳。Domain独立核86工件、146源码hash、23冲突/12文件及215表union，初审2b460f41未确认源码缺陷。正常server+web+root依赖/四workspace实际构建与Node26 ABI147下SQLite/Sharp加载通过，Web原缺React前置已正常补齐。实际独立hot首例在初始12s只有A OCR8+understanding8/B OCR1=17，缺B understanding，未到hot lowering；第二复用listener场景76.115s通过19等待→释放20及取消/B正控。新correct Web cwd原样6case为1PASS5FAIL，根目录JSX启动错误另保留；原File owner接三条旧进度前置/2!=1及两新增按钮阻塞消费者，但不盲归同因、不改产品默认或原12s。新49174真实Files→自动Memory独立提取/复核保存3条→真实Ask/原证据及实际取消已有阳性，B用量0，最终报告1f7735e1已冻结NOT_READY，60个safe artifact核齐；两次正式SIGTERM/重启持久性及实际取消通过，用量收据A16/B0准确保留。两条actual rawscreen Actions均未到提案/人审，未造cue，不凭模型无候选宣布生产bug；49174关闭、owned74871/86360均正式退出0，资源交还。所有正例不覆盖失败。Memory暂停/archive及正常Memory/snapshot两场rawscreen Actions均INCOMPLETE；缺M06/evidence anchor与Ask拒读是诊断事实，Actions实际仍用原ActionEvidence，不足单凭它定位卡点。原Actions owner已完成薄264+工具及只读原旅程调查并冻结2689，未新增fallback、回填、权限或语义词表。

2044新增且仅一次真实Actions旅程报告47e9afc2，37/37工件由driver复核。生成两条文本snapshot使用同当前五分钟桶、明确source-owner与先登记API target，A/B相同public IDs但独立incarnation；实际raw14/15→cursor15→semantic→prepare→chat→proposal→OwnerQuestion审批→首次claim允许/重复拒绝，B reply/claim均404。单链40.673s，实际Codex用量新增A2/B0，Memory暂停/minChanges25不变、originals0，证明文本路径不以M06或Memory提取为前置。正常API取消撤回授权，未伪造外部完成/ACK；无native WRITE/delivery声明。11535正式SIGTERM exit0、49174及pidfile清理。旧两INCOMPLETE不改，archive/reference范围parity仍UNKNOWN，原hot/Web失败不被阳性覆盖。

2044仅一次隔离只读插桩诊断为NONREPRO，report5ea20334/manifestfc484fdd的17工件核齐；90.961s通过原初始18与后续全部断言，但不是未插桩原验收或修复。原12/120秒及原provider分支未放宽；2.419s是两HTTP请求端到端间隔，validGrant/hasModelLease并不证明完整current fence或lease assertion，运行任务自身capacityAvailable=false不表示starvation。原失败阶段未观察到的instance gate仍UNOBSERVED，原因UNKNOWN。诊断树已归档；Memory/M05只读复核report7a89d6c7/manifest77c6c7cd的26工件已核，未改源或运行测试。它可排除“File第二HTTP重入Memory percall”和不同user-key的Memory publication锁直接阻挡B两种具体机制；共享Engine/组合及失败时B原图admission、读图与两轮HTTP停点仍未观测。

Conn fdd正常full run81ead226已FAILED：1177.790458s、8步PASS、Server3159PASS/1FAIL/2skip，后5UNRUN；唯一multiuser-connector-polling-parity.test.ts:242的五分钟wake生成时钟断言actual=false，bindingab0751cc，原source/input与完整失败/cleanup证据保留。已派原owner最小调查/返修，不预定为fixture/负载问题。Memory6f44正常18步run5295dbfc自19:08:49.384Z运行，初始build峰19:09:14已退，common锁保留；Ask23/Config23/Actions15/Desktop16按精确冻结源排队。

Exec原owner已接新managed全12模块临时source组合，从2044另建树；原2044与所有模块树保持不动。候选为本表12heads，Conn fdd只作failed provisional来源，返修新freeze必须替换并重绑祖先/hunks。保schema union（当前源216表）、provider Memory percall/264生命周期/Config configuredCodex/Ext probe各增量，以及File四case与Life两case全部断言；纯source阶段不安装、build或运行模型。该组合不是正式integration业务释放，冻结后交Domain独立审源与必要真实旅程。

Android Calendar新增报告3c92ade0/manifestf71dbfbf，88/88工件核齐：原262+070以普通shell只建唯一LOCAL生成日历与两事件，原App选择/保存/Scan and sync now→真实Worker/ACK→A原文/时间/ID准确；B中央空、source/item/material0及A材料404。READ=true/WRITE=false为读取阶段事实，seed不是Mote WRITE/delivery；owned44379/44412、三端口与租约已清。后续D01已获新5min启动窗、ready即退峰，原控件范围/排除包名/遮罩/偏好A→B→A与冷启动隔离已观察，已冻结e24c3583/manifestab05b88e，241/241工件核齐，11键隔离与冷启、A/B/local33键全map恢复原值；owned70162/70175、三端口与租约已清，原173/88/1541未改。同步模式不重跑、实际采集保持停止。上述仍不证明secure App像素、真实日历写入、Actions交付或实体OEM。

排期沿01:25预测锚点，主线05:25–07:25、可审Draft汇总06:55–09:25，不每轮平移。审计时串行安全预算245–294分钟（含条件Ext增量及返修预留；工具infra另计），已耗Life原full24.225分钟及File新full25.588分钟共约49.8分钟，另记Life合格补验3.197、Ext增量7.148、Conn失败19.630与File合格补验3.088分钟；Memory当前在途，后续Ask/Config/Desktop/Actions及最终完整检查仍待，Conn返修范围须按实际delta与独审决定，不预记豁免或通过。新core triage成本单列，根因未闭合前不平移旧预测区间；失败、UNRUN和未运行的理论裁剪不算优化收益。只串行必要资源，独立API/UI/模型与source任务并行；无额外24h等待或完成下限。

## 最终验收与持续记录

逐项矩阵的全部预期均是验收要求，不是通过声明。以生成资料从真实账户登录、生产 HTTP/应用启动、客户端持久队列/WorkManager、UI 与重启顺序验证；原算法 fixture 只作对照。每项包含同 ID 双用户负例、相关撤权/删除/取消/迟到结果；高风险持续积压与组合状态不能只做单分支测试。真实模型/供应商、物理设备、系统权限、前台焦点和部署分别记录，未做就保持未验，不采集真实个人截图。

历史首阶段当时仅管理文档；WEB与DESKTOP已报冻结候选，尚无独立验收、正式模块集成或最终完整检查。D2前置单commit单独登记，不视为模块验收。文档检查记录在[矩阵末尾](../validation/multiuser-parity-restoration-matrix.md#首阶段文档核查)，后续用真实候选证据逐项更新。
