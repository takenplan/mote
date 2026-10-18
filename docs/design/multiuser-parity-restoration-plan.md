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
| MEM / MEM-M01..M08 | [MEM开发](codex://threads/01a14e8f-6977-7fa3-8145-0b3696ae413c) | `codex/parity-memory-20261018` / [Draft #177](https://github.com/utopiafar/mote/pull/177) | [独立验收](codex://threads/01a14e90-04ae-70c0-92a5-3f2a24a3bf0c) | `6f44fc26b79e71a2ac43ccd667ab192cbe6d6744` | LOCAL_REQUIRED18_PASS；run5295/1351.864914s，Server3222P2skip/Web602/Shared198/JVM374，78freshXML/25tasks全执行；binding0d0ef7c9，原855失败/组合实际边界另列 |
| FILE / FILE-01..06；FILE-07旧缺陷观察 | [FILE开发](codex://threads/01a14e8f-6b10-7001-b7d6-84ba844a5604) | `codex/parity-files-20261018` / [Draft #176](https://github.com/utopiafar/mote/pull/176) | [独立验收](codex://threads/01a14e90-04ae-70c0-92a5-3f2a24a3bf0c) | `f29ffd94b6cdfccbffbafe248ead37d057fce7de` | FULL19_PASS；1446.428666s，Server3166P2skip/Web601/Desktop606/Shared198，bindingd44385af；Android25UPTODATE/0fresh；Draft176已更新f29，组合仍待 |
| ASK / ASK-A01..A05 | [ASK开发](codex://threads/01a14e8f-6d35-77d1-ad5f-531013c4ea08) | `codex/parity-ask-20261018` / [Draft #179](https://github.com/utopiafar/mote/pull/179) | [独立验收](codex://threads/01a14e90-04ae-70c0-92a5-3f2a24a3bf0c) | `a0215837f71bda236dc2c719a07e963a44bf7f6f` | APPROVED_BOUNDED9_PASS；185.775725s，Web601/Shared198/JVM373 fresh78XML/25tasks；binding50fc7117，非新Server/full23；Draft179 |
| CONN / CONN-C01..C07 | [CONN开发](codex://threads/01a14e8f-6edd-7772-b552-f0ce79bb7c61) | `codex/parity-connectors-20261018` / [Draft #178](https://github.com/utopiafar/mote/pull/178) | [独立验收](codex://threads/01a14e90-06cd-7242-96bb-349e5fdb83b3) | `a562a1f2cd76ed905a2c556e0e99aa4b6844eab0` | APPROVED_BOUNDED6_PASS；166.674991s，Web604/Shared198/JVM376 fresh79XML/25tasks；binding92e13e19，非新Server/full14；Draft178 |
| EXEC / EXEC-X01..X03、EXEC-S01 | [EXEC开发](codex://threads/01a14e8f-7094-7af3-880a-8580a9135ea1) | `codex/parity-execution-20261018` / [Draft #171](https://github.com/utopiafar/mote/pull/171) | [独立验收](codex://threads/01a14e90-06cd-7242-96bb-349e5fdb83b3) | `070ffc04a859d01551674070cdf16551a2c29928` | CANDIDATE；F01修复后driver整22步PASS/1489.376s，已push/更新PR；Android全25任务缓存/未重跑，独验与新ports组合待验，非READY |
| CONFIG / CONFIG-C01..C07、CONFIG-UX01 | [CONFIG开发](codex://threads/01a14e8f-7295-7c62-9d1d-d6f9a3e6a59e) | `codex/parity-configuration-20261018` / [Draft #180](https://github.com/utopiafar/mote/pull/180) | [独立验收](codex://threads/01a14e90-06cd-7242-96bb-349e5fdb83b3) | `2aa08c862087532807b22bada91545ebc69a6720` | APPROVED_BOUNDED8_PASS；181.04322s/Web606/JVM382 fresh80XML/25exec，binding9f17dbea；原ee42 FAILED及15明确baseline保持，非新23或ServerPASS |
| DESKTOP / DESKTOP-D1..D4 | [DESKTOP开发](codex://threads/01a14e8f-745e-7330-8770-aed83a43077f) | `codex/parity-desktop-20261018` / [Draft #182](https://github.com/utopiafar/mote/pull/182) | [独立验收](codex://threads/01a14e90-08cc-7631-b1bb-fe8b691c3e27) | `55b40d37a4948fd40db194f6448b92ac1a287db8` | FULL16_PASS；1278.614416s，Desktop627/Server3129P2skip/Web601/Shared198，bindingc564b80d；post全核，正常push/Draft182/27paths；实际D1–D4与跨端/最终组合另验 |
| AND / AND-01..04、AND-D01 | [AND开发](codex://threads/01a14e8f-7620-73f0-8c0b-032e94f1a3e3) | `codex/parity-android-20261018` / [Draft #172](https://github.com/utopiafar/mote/pull/172) | [独立验收](codex://threads/01a14e90-08cc-7631-b1bb-fe8b691c3e27) | `2622844e3b226f3ebae9542bdb16aafedc5cf3a7` | CANDIDATE；driver7/7及JVM388 fresh PASS；实际模拟器App262+backend070功能子范围PASS/173证据核齐，secure像素受限；Calendar读取与D01原控件偏好子范围另已PASS，Actions交付/D2等仍待 |
| WEB / WEB-W01..W02 | [WEB开发](codex://threads/01a14e8f-77d9-7723-8762-9bb7b456da4d) | `codex/parity-web-20261018` / [Draft #170](https://github.com/utopiafar/mote/pull/170) | [独立验收](codex://threads/01a14e90-08cc-7631-b1bb-fe8b691c3e27) | `f8f684b6dee904d820b9952ead336da5a33f330f` | VISIBLE_MAC_SUBSCOPE_PASS；Q002/R006保留，新增26交互/11图实际Chrome已验；真实模型/原生/完整组合待验，最终READY/汇总未释放 |
| EXT / EXT-E01..E03、EXT-ES01/ES02/EC01 | [EXT开发](codex://threads/01a14e8f-79dc-70b3-8d6c-608e696cb79d) | `codex/parity-extensions-20261018` / [Draft #175](https://github.com/utopiafar/mote/pull/175) | [独立验收](codex://threads/01a14e90-08cc-7631-b1bb-fe8b691c3e27) | `5a5ed7bfeaf1c33409c84bdb6ba906e4e103763a` | QUALIFIED_INCREMENTAL_PASS；freshServerbuild+正常common scope/4组整file80/38/26/16全PASS；native20及544原FAILED分别保留，非新22PASS/最终READY |
| ACTION / ACTION-A01..A04 | [ACTION开发](codex://threads/01a14e8f-7b96-7d00-9b68-d9d30aea97dd) | `codex/parity-actions-20261018` / [Draft #181](https://github.com/utopiafar/mote/pull/181) | [独立验收](codex://threads/01a14e90-04ae-70c0-92a5-3f2a24a3bf0c) | `2689e88d7ac2a58257903021d4224cd13bcd3c81` | FULL15_PASS；1248.675337s，Server3160P2skip/Web601/Shared198，binding99b2f321；post全核，正常push/Draft181/41paths；实际模型/nativeWRITE/最终组合另验 |
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
| Q007 | DESKTOP / exact55b40d37 / Draft182 | 正常full16 run72c6442a，1278.614416s，Desktop627/Server3129P2skip/Web601/Shared198 | FULL16_PASS；samehead/clean/input/cleanup/lock/PID全核；正常push/Draft182/attach，实际PR base同16 | bindingc564b80d；Android未选，原73最小实际UI子范围不转新55，真实D1–D4/跨端D2/组合另验 |
| R002 | CONN / exact179237a0 native两方法 | RecordingParityInstrumentedTest阶段历史+首次save auto on/off，无pre-sync；新14步含JVM，APK/instrumentation另排 | WAIT_SERIAL_RESOURCES；原生未跑，API/serial实际窗口重核 | Node24.22 ABI137/JDK21，生成backend开发smoke仅其输入；独立实际index/managed CLI启动仍UNRUN，不能冒原生/真实供应商 |
| R003 / Q008 | CONFIG / `5b218d926568ed4c4a51ba8a50e9278f706f4cfa` | 新dry-run实际all=true/22步六TS+Android；manifest68hash全核，18窄PASS+types/i18n/scope/两个入口语法通过 | WAIT_FINAL_FILES_COMBINATION_AND_SERIAL_CHECK；owner已结束 | 组合须重绑Config5b + File374 + LIFEef + Ask9d；旧79bf图/语法不作实际启动/浏览器/native证据 |
| R006 | 独立客户端验收 / PR#170 exact f8 | 私有依赖/构建、窄12项、真实main双用户browser77.096s、13入口11.086s、30012ms设备刷新/31s卸载无读、6图真实场景 | DONE_PASS并已释放；旧PM browser范围确认保留，整体READY未释放 | JSON SHA256 4cb7d378cf69b135e06ff5161f4d8936a95560da5ff5929d8a4ca83f6f6e199b；跨EXEC/新域组合仍UNRUN |
| R007 | 独立物理Mac可见Chrome / PR#170 exactf8 | Node24.22 ABI137/实际CLI→src/index，26交互/11最终图；A-B迟到隔离、设备刷新29895ms/离页31501ms零GET/重进均PASS | PASS_EXECUTED_SUBSCOPE_ONLY；private profile/DB/Chrome/49170已清理，无model | report28450a08/manifest768dc2d7/driver42e58fc4；新模型Insight/扩展动态/producer/native/OS隐藏可见/组合未验 |
| P009 / R004 | FILE / 8217依赖准备已完；native等新并发freeze | driver补固定Electron41.10.7后全环境PASS/源码和lock未变；原生未运行 | P009 DONE_ENV；R004 WAIT_NEW_INPUT_AND_WINDOW | 8217 gate Desktop失败/e799 sourcepool静态退回；native 4JVM/2instrument方法合同只作未验计划，不冒producer smoke为native |
| Q001 / Q001-R1 | FILE / 286FAILED→current4c01，base2c78 | 原7c43/1535.277034s，16PASS/Server3163PASS2skip/Web598PASS3FAIL/后5UNRUN；新4c01作者4PASS，旧87含先期4分列 | QUALIFIED_REMAINING13_PASS；正常common27108/185.309125s，13/13PASS，Web601/Shared198/JVM377，79freshXML/25tasks全执行 | 原bindingee163d30/plan d966fac8/新binding8fb87f26；已推Draft176，不冒新22PASS；2044六case适配与原hot失败另案，单次插桩诊断NONREPRO不作修复 |
| Q001-A | FILE / exact8217旧gate | runfacf1b1a，151.598s；Desktop603PASS/3FAIL；12步PASS后9UNRUN | FAILED_AND_CLEANED；source同HEAD/clean/cleanupConfirmed，锁释放 | metadata canonicalization mismatch已由e799修；两OCR失败是A pre-manual旧fixture假设，不是B privacy回归；原log不改 |
| Q004 | LIFE / exactb30c2cb5 / Draft174 | run d075289e/191.836518s，批准剩13/13PASS；Web603/Shared198/JVM372，78freshXML/25tasks全执行 | QUALIFIED_REMAINING_PASS；6cbd原16PASS/WebFAIL/5UNRUN及Server3168PASS2skip仅明确组件baseline | bindingc44810da；sameHEAD/clean/inputunchanged/cleanup/PIDgone；未声称b30重新跑Server或新22PASS，真实/组合仍独立 |
| Q006 | MEM / exact6f44fc26 / Draft177 | 正常18/18PASS，run5295dbfc/1351.864914s；Server3222PASS2skip/Web602/Shared198/JVM374，78freshXML/25tasks全执行0缓存 | PASS_LOCAL_REQUIRED_SCOPE；同HEAD/clean/input未变/cleanup/锁/PID已核；已push/attach | binding0d0ef7c9；原85552FAIL保留，不替代真实模型/UI/全组合退款与不回放边界 |
| Q006-B | MEM / exact855旧full | runa77215a6/1520.258s，14PASS/Server3169PASS52FAIL2skip/后7UNRUN，Android未跑 | FAILED_AND_CLEANED；sameHEAD/clean/cleanupConfirmed/锁释放/PIDgone | binding25141a20；逐52分类见835新packet，原log/receipt不改 |
| Q006-A | MEM旧72f/1c历史 | 72f run d5a6098d整13步8PASS/Server3160PASS1FAIL2skip/后4UNRUN，1298.654s；1c只修fixture8PASS后独立F01..03/R01退回 | FAILED_AND_SUPERSEDED；原receipt/diagnostic均保留，不再跑旧源 | 当前855修生产流程，必须新22及新独验，旧13/定向不拼PASS |
| Q003 | EXT / exact5a5ed7bf / Draft175 | 批准freshServerbuild+1505artifact绑定及剩5check c6ac/428.868812s全PASS；4整file组80/38/26/16，无fail/skip | QUALIFIED_INCREMENTAL_PASS；normalcommon/source/input/cleanup已核；旧native20另列 | bindingbcfb9d59；544原全FAILED/组件baseline原样保留，新5a不拼22PASS；真实UI/model/最终组合未验 |
| Q003-B | EXT / exactd468旧gate | run6820aa4c，1430.727s；14PASS/Server3087PASS62FAIL2skip/后7UNRUN | FAILED_AND_CLEANED；source未改/cleanupConfirmed/锁释放 | 58 config_prepare_failed、两recording503、1旧MCP helper、1legacy import preparing观察；082各类别修复与原失败分开 |
| Q005 / Q005-R1 | ASK / 原e427FAILED→a021 / Draft179 | 原full23：14PASS/Server3188P3F2skip/8UNRUN，binding0acc5cff；新源prod0、独审8daf6790及PM88516cf0批准有限9 | 新正常common a6361637，9/9PASS/185.775725s，Web601/Shared198/JVM373，78freshXML/25tasks全执行 | binding50fc7117；不拼新Server/full23；原失败保留，input/source/cleanup/锁/PID已核 |
| Q009 | EXEC / `1e9ec7ab253cbb25bd21f14f3aee9ea19bbb96d2`，base2c78ca8d | driver整14步PASS/1490.842s；Server3133+2skip，Web602/Shared198/release37，Android JVM373/0skip | DONE_PASS；run67404cc8，20:24:10（Asia/Shanghai），cleanupConfirmed/clean/锁释放 | inputIdentity99e9bb294dca83022cece84186a5008794eac49cbe024bb2757c51cb1022ddaf；新Memory/Files M05接口与组合不在此轮 |
| Q009-R1 | EXEC / exact070ffc04，已push/PR171已更新 | fresh22/22PASS，1489.376s；Server3140PASS2skip/Agent327PASS1skip/Desktop606/Web602/Shared198 | DONE_PASS；run21f009bb，21:41:40（Asia/Shanghai），sameHEAD/clean/cleanupConfirmed/锁释放 | binding95ad1463；Android25/25 UP-TO-DATE、0fresh，不冒373重跑；独验/native/新ports联合未验 |
| Q010 / R005 | AND / exact2622844e+backend070 / Draft172 | 完整7/7、JVM388 fresh与准确APK构建PASS；实际App/Worker/SAF/切号/冷重启子范围完成 | PASS_EXECUTED_APP_FUNCTIONAL_SUBSCOPE_WITH_EXPLICIT_GAPS；173原件/Calendar88/D01 241工件核齐，资源已清 | report8533ddd3/manifest007fe766，173/173hash一致；原像素FLAG_SECURE受限；Calendar读取与11键D01偏好另已验，WRITE/Actions交付/native模型/D2未验 |
| Q011 | CONN / 4fe01f47旧候选 | Java25环境修正轮及Java21过时候选停止轮分别保存；不得拼PASS | STOPPED_CHANGES_REQUIRED，PM释放owner修复F01-F05；R002暂缓 | Java21 receipt d287d97c原cleanup=false/EPERM保留；后验13PID与PGID3095均消失，核owner后只清残留锁，可写入已通知 |
| Q011-R1 | CONN / exactfddccce1，base2c78 | run81ead226/1177.790458s，8PASS/Server3162=3159PASS1FAIL2skip/后5UNRUN；source/input未变、cleanup/锁释放/PIDgone | FAILED_OWNER_REPAIR_DISPATCHED；五分钟wake测试:242仅一项失败，根因未定；不凭耗时/负载归fixture | bindingab0751cc；Web/Shared/release/central-runner/Android后5UNRUN。原owner仅做最小调查/修复，必要新scope交独审，不自宣Server或新14全绿 |
| Q011-R2 | CONN / exacta562a1f2 / Draft178 | 独审完整62paths/prod0，clean whole9+15；fresh四build/1544输出dfb5b256 | PM批准有限6正常common22bcfa06全部PASS/166.674991s，Web604/Shared198/JVM376 fresh79XML/25tasks | binding92e13e19；旧fdd全FAILED/Server3159P1F2skip保留，不拼新Server或full14 |
| Q012 | ACTION / exact2689e88d / Draft181 | 正常full15 run28c8c359，1248.675337s，Server3160P2skip/Web601/Shared198 | FULL15_PASS；samehead/clean/input/cleanup/lock/PID全核；正常push/Draft181/attach，实际PR base同15 | binding99b2f321；Android未选，旧2044实际text Actions不转本head，nativeWRITE/archive parity/最终组合另验 |
| Q001-R2 | FILE / exactf29ffd94 / Draft176 | 正常full19 run817782fa，1446.428666s，Server3166P2skip/Desktop606/Web601/Shared198 | FULL19_PASS；samehead/source/input/cleanup/lock/PID全核，正常push更新原Draft176为f29 | bindingd44385af；Android25UPTODATE/0fresh，79旧XML377不冒新执行；523组合另有C红，不能转记 |
| Q008-R1 | CONFIG / 原ee42FAILED→2aa / Draft180 | 独审394cc910/PM29e19d73批准8；normal common9f2ad61c全部PASS181.04322s | Web606/JVM382 fresh80XML/25tasks全执行，post全核；正常push/Draft180/attach | binding9f17dbea；原15明确未变baseline+新8，不拼新full23或Server；旧ee42 FAILED/信号UNKNOWN保留 |
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
| 集成driver | active，唯一完整检查调度者 | 13个Draft170–182均未合；模块common已完、R3限定独立109覆盖PM接受，Core/native真实旅程在途；正式assembly/final未释放 |
| 原owner工作 | 本轮Conn/Memory只读/Exec source槽均已结束 | a562源资格与conditional6已独审及PM批准；24a新managed源完整交还，原2044及模块树不改；Domain只读独审中，未跑新组合应用 |
| 核心独验 | 2044及新一条Actions真实链已结束并清理 | 真实Files→Memory→Ask/取消/重启及新Actions人审/claim API子范围PASS；原hot/Web/旧两Actions输入结论保留，整体NOT_READY，新组合freeze后独审 |
| Android独验 | 新capture-transport实际子范围在途 | 262+070原App/Calendar/D01已结束；生成画面原OS授权→fullbytes/Worker ACK→停止冷启/A-B-A新20–30min任务，headless5582 ready/19:28:16退峰，不重跑旧子范围 |

| 待办号 | 待通知/执行对象 | 具体条件与范围 | 当前状态 |
| --- | --- | --- | --- |
| G001 | WEB PR#170 | 新R007实际Mac Chrome/26交互11图报告28450a08；driver核48证据/234artifact及关键图，49170/UI锁已清理 | PASS_EXECUTED_SUBSCOPE_ONLY；已更新Draft170 metadata，source未改；模型Insight/扩展动态/native/OS可见性/组合仍待 |
| G002 | CONN native C07 / exact179 | 首次save auto on/off与阶段历史两方法，真实select→一次admit→追踪syncTask；先核14步/专用无窗口窗口，backup固定true不增toggle | WAIT_SERIAL_RESOURCES；新native JVM/APK/instrumentation/独验UNRUN |
| G003 | AND D2及Ask组合 | D2前置`5744d6a832117a9f9aec7affd37453ab15d455cf`（含早期1417及part/commit upload_expired补充），Android与Ask消费者精确SHA待冻；仅临时组合，非PR夹带/正式合入 | WAIT_DEPENDENCY |
| G004 | 四独立验收chat | 排队传达已决L06/D01、精确PR/head/base/依赖与新消费者清单，闲置不唤醒；一次一项 | WAIT_GLOBAL_SLOT |
| G005 | 唯一common检查driver | Memory18已PASS/推Draft177；Ask23 run855c21e2在途，Conn批准6随后；Config23/Actions15/Desktop16等精确候选继续 | RUNNING_ASK_FULL23；无并行full，原失败与当前新scope分列，完整最终Server仍required |
| G006 | Memory新6f44 | 18/18正常完整检查已PASS，69files Draft177，Server3222P2skip/JVM374 fresh等最终binding0d0ef7c9 | PASS_LOCAL_REQUIRED_SCOPE_WAIT_COMBINED_DYNAMIC；原855失败保留，实际2044普通Memory链不代本head或完整退款/零重放边界 |
| G007 | Config实际consumer组合 / 新2aa | 2aa生产与ee42相同，须保原Codex域、Memory percall与Ext issued/unknown/checkpoint；新组合逐hunk合并，不动正式integration | SOURCE_R2_IN_PROGRESS；实际startup/生成artifactTransport/角色403/图片与storage联合仍待 |
| G008 | Files M05 publicProgress port | exact8217纯schema/retired只读投影在e799未改；原Exec owner只读无新增确认blocker，作者57+1与动态独验分开 | 窄host source复核已做；新Files并发fix后的全gate/控制组/固定组合/native仍待 |
| G009 | EXEC Draft#171 / exact070 | F01 required parent-generation schema+真实CLI/恢复regression；新22步driver PASS，已正常push且PR head/body核对，Draft/Open/未合 | WAIT_INDEPENDENT_ACCEPTANCE；新Memory/Filesports及实际producer/父链组合另验，非READY |
| G010 | 临时组合2044b446 / treee3516104 | 独立source/86交接+60最终工件、146源、215表核齐；native2/targeted20、本树构建与实际Memory/Ask/取消/重启阳性 | NOT_READY_FINAL_REPORT_1f7735e1；原hot1PASS1FAIL初始17、Web1PASS5FAIL/旧两Actions INCOMPLETE保留。新Actions47e9 API子范围PASS/37工件已核；单次hot插桩诊断NONREPRO，原原因UNKNOWN |
| G011 | Files873只读delta预审 | report515baf84；PM接受FILES-STATIC-01源码闭合，无确认新bug；作者98PASS不作独立动态 | DONE_SOURCE_DELTA_PASS_PENDING_DYNAMIC；Q001可排新22，非READY；后续组合须保留File for(;;)，不带回e01 outer pool2/4 cap |
| G012 | Memory855只读预审 | report00acbb40，F01/F02/F03/R01源码闭合、无确认新bug；27附件/25源核验，作者结果分源 | SOURCE_REVIEW历史保留；新22已FAIL/52待返修，设备UI/real-Codex/组合未验，非READY |
| G013 | Android实际App与scope修订 | 原8533/173项与Calendar3c92/88项均核齐且已清理；原范围取消额外24h，正常expiry/ACK/restart保留 | D01_ACTUAL_PREF_SUBSCOPE_PASS；e24c3583/241工件核齐，11键A-B-A+冷启与33键原值恢复已验并清理；采集停止，像素/其他catalog不扩大 |
| G014 | 全12新临时组合24a68151 / tree10a6098a | 原2044另建managed树，12最新真祖先含a562；完整base431paths/core217，44冲突20files/216required表；310/310交接工件root已核 | SOURCE_RELEASED_PENDING_INDEPENDENT_REVIEW；Domain实际只读审全base/hunks，source通过后另排own依赖/build/正式HOT双case/Web六case/真实Mote-Codex/UI，不等全部module gate |
| G015 | AND-CAPTURE-TRANSPORT-01 | 原070/262clean及1541编译文件/APK/config hash核齐，生成HTML及device/backend/5min短峰前置齐后实际恢复Client | ACTUAL_IN_PROGRESS；19:28:16 ready即退峰，原OS授权/fullbinary/ACK/停止冷启/A-B-A待结果，不采个人画面，不扩大旧D01等PASS |

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

## 当前验收检查点（2026-10-19 07:02，覆盖历史运行快照）

66主行与22跨域场景仍未整体READY。13个Draft #170–182均OPEN/Draft/未合，正式integration只有两份管理文档，main未纳本轮业务、未部署。所有模块common已自然结束；完整检查runner与锁空，Server并发4、runner串行不变。当前临时业务候选是9c03，PM已接受有限动态覆盖并释放实际旅程；不是正式汇总、整个安装环境同一或新full PASS。

Actions2689完整15项PASS1248.675337s，run28c8c359/Server3160P2skip/Web601/Shared198，binding99b2f321/Draft181/41paths。Desktop55完整16项PASS1278.614416s，run72c6442a/Desktop627/Server3129P2skip/Web601/Shared198，bindingc564b80d/Draft182/27paths。两轮post源码/输入/clean/cleanup/锁/PIDgone全核，实际PR base分别仍同15/16；未选Android，不代替实际UI/model或全组合。File f29 full19 PASS1446.428666s，Server3166P2skip/Desktop606/Web601/Shared198，bindingd44385af/Draft176已更新；Android25UPTODATE/0fresh，79旧XML377不重计。其最小submitIntake最终接力deferPhysical范围包括eligible自动audio/document/media，旧live/unknown物理工作与原权限/源代次/附件/current grant、取消仍受原门禁。

Config2aa批准8 PASS181.04322s，Web606/JVM382 fresh80XML/25exec，binding9f17dbea/Draft180；原15明确baseline不拼新23/Server，原ee42 FAILED/信号UNKNOWN保留。Ask a021批准9 PASS185.775725s/Web601/JVM373 fresh78XML，binding50fc7117/Draft179，原e427失败保留；Conn a562 fresh四build1544后批准6 PASS166.674991s/Web604/JVM376 fresh79XML，binding92e13e19/Draft178，原fdd失败保留。Memory6f44 full18 PASS1351.864914s/Server3222P2skip/Web602/JVM374 fresh78XML，binding0d0ef7c9/Draft177；Life b30批准13 PASS191.836518s/Web603/JVM372，bindingc44810da/Draft174；Ext5a freshServerbuild1505后批准5组PASS428.868812s，bindingbcfb9d59/Draft175，native20另列；均不覆盖各旧失败。Exec070 full22的Android25任务缓存0fresh、Android262 full7/JVM388 fresh与Webf8 full9保持各自范围，非新组合。

原core2044、source24a与其唯一插桩NONREPRO报告均保留。2044实际Files→Memory独立复核保存3→Ask/取消重启A16/B0和文本Actions语义→人审claim仅各原输入；其HOT失败、Web1P5F、rawscreen Actions INCOMPLETE/无nativeWRITE不洗。24a首轮bd81仍39P3F/NOT_QUALIFIED（HOT复用例初始17、Web4P2F），原后置未达安全断言保持UNREACHED；后110.583s诊断双PASS仅NONREPRO，14loaded sentinels/2596输入与完整observer覆盖不构成修复，观测开销未测。原24a/523物理树继续冻结。

5235666d52aba0358cb55098cc8dda35704e6418/treefdce5cd81d14c3e67ff3a156c1f4e18bfb06d329为三新祖先f29/a021/2aa的真实组合，9delta路径/1production/3188其余mode/type/blob不变，source独审a88ee206、68+8工件已核。正常本树安装/Shared-Agent-Server-Web build/语义tsc/Node26 ABI147 SQLite-Sharp PASS，1625产物封存。其首次ordinary HOT2/Web6/File3共11P，之后whole Ask/processing76=73P3F，首轮87=84P3F、整体NOT_QUALIFIED保持。唯一三红诊断nonce b26fb2fa已消费：9.249811s原3均RED，两个文本例为intake/admission:pipeline/Material.revision三个真实organizer、正式Material/version/publication/intake各1/无model，容量两POST为同A下自动与manual两独立parent/request/scope各attempt1/accepted0；非同job物理重放。root回执61ed58f7/因果分析c6f4db6e，不回填原未达断言为绿。

PM另释放的523剩余C10已独立完成215P0F/0skip/cancel：Config29+七consumer32、generatedCodex4、Connector10、MCP9、Ext9、File四整file22、Web products/recipes11、Memory三整file88、native percall1。File40.495s/Web91.631s/Memory264.426s/native4.795s，两峰均实际退还。review9b2b6c09/manifestf0e9f284的33/33原件与10原Node summary由root核齐，root proof67133e99；source/locks/1625产物/原31历史工件不变，owned进程/lease0。这些是准确523新增scope，原87三红与未达断言不洗，不转记R3/final full。

R3冻结9c03b631045670ff6302aca430ba7a566c5647ab/tree6b935deffaa49feca5438df7a9fe5379f35d607d，单parent exact523，production0，仅processing.test 33+/14-。保完整8kind图与三organizer的精确private operation/owner/current public CaptureRecord hash/grant、null model、单Material/version/publication/intake、原两Ask事件/B/rollback/orphan/sequence；旧task前缀只适配current ask-index family。容量使用默认已登记intake唯一工作，held/B填满/跨awaitstorage拒写/settlement/B真实删除/显式retry原1→2与artifact保留；新增独立双意图例核不同parents/requests/scopes/grants/issuance、各attempt1/storageblocked/accepted0/无artifact-publication-activity。未删producer/关Memory/改Perception默认或原12s/120s。作者最终focused4P4.793812s、whole processing+Ask77P147.566784s，4是77子集不累81；初focused2P2F新增hash误用storageJSON后修为真实GET/captures投影，原log保留。27原件manifest2748e08b/reportca84ae13/root333d2470已核。

独立Control fa05932b完整静态审无阻塞源问题，15/15工件root proof5ac7cae8。其余3196 tracked同一，1592个Server/Shared/Agent输出同一、共同1172 installed entries逐字段同一、共同87841物理依赖文件逐SHA/size同一；R3新增235 entries不冒整环境同一，Diag3是新增无旧built baseline。driver随后fresh六TS+Android环境PASS与own Web build6.402s，缺失33 Web产物已真实补建并逐SHA同523，receiptbf0964，source/root及installed-lock不变。13组实际入口547源码的import/require加保守declared/optional/peer闭包192–944packages双树0包路径/manifest变化、235新增0可达、可选/platform未解边逐项同一；唯一first-party动态FileProcessor模块参数在当前ScopedProcessingHost为空。该证据不是syscall trace或任意插件保证。PM d78e0b0d批准HOT2/Web6/File3及C10 File22/Web11/Memory88/native1/Config29+32有限旧scope baseline，均保exact523来源；生成CLI/worker边界在新R3实际补32。

新R3独立五组实际分组覆盖已闭合：whole Ask+processing77P144.691s、generatedCodex4P10.600s、Connector10P22.873s、MCP9P21.277s、Ext9P22.110s，共109P0F/0skip/cancel，11个wholefiles/各child自然exit0，原helper后及容量B删除重试安全路径已在新运行到达。review75db8546/manifestfd1a1618的25/25原件、5原Node summary、source/两locks/全部1628 SHA+size/11输入/owned PID0均root核，proofe9b12c4c；PM正式9aab802b接受限定scope。原5min资源窗事前明确amend总上限10min9572642e，未改测试deadline；实际峰22:50:02.952Z退（Ask22:49:40.867Z完成），旧controller仍读已删owner而EXIT1，已过91无中断/重跑，仅未启动18按新普通无峰续体完成。原run.py/harness-error/工具stdout及transition全留；不命名一次新109命令/fullPASS，更不把不同SHA拼成全Server绿。

PM已具体释放实际旅程而非正式assembly/finalfull，driver已实际恢复原Domain与Client。Core49174使用全新生成profile/DB/账号，真实CLI启动/登录/服务→Mote启动原/opt/homebrew/bin/codex与原home stdio→Files/Memory独立提取复核保存、Ask既定三mode及原只读context/evidence/citations、Actions语义/问答/原人审、取消/SIGTERM重启/不回填与A/B，尚无本阶段PASS。Android另用49171独立nativeR3 profile，stock5582正常headless boot/normal install-r已成功，installed base.apk精确SHA cc1883dd；cold峰22:59:10.359715Z实际退，Core已获heavy go，不等native target。后续需原App真实LOCAL target注册并force-stop App、防Activity autoClaim，Client停止DB/API操作转交同backend/DB/targetepoch管理权→Domain真实语义/原人审保持unclaimed→Client首次nativeclaim/原OSWRITE/mutation/ACK及duplicate/B/revoke/restart。backend停止重启不是交接必需步骤；如实际生命周期需重启，旧新PID及target/epoch/lease重新验证，不能借旧可用性。过期目标走原App重注册，不造target。Mac Web/nativeDesktop实际UI另列，须准确own9c03构建/ABI隔离或完整输入复用证明，不冒旧73/55 UI。

Native APK仍为exact523本次build，独立managed树/JDK21/worker1/no-daemon，37.253505s exit0、PID/PGgone；59076344B/SHA cc1883ddcb6e03ddde4cb3ac2fdb99d54d4b4b0ffb9eb4c3e650323ea6377763，证书114c4cc7/package dev.mote.collector.m15fixture/100/0.0.89-m15fixture。manifest4fd4cd15/report566e3e9e的22工件、3197source/3425声明task文件/11998toolchain/7assets已root与Control核齐，root00473940；PM已准recorded-input复用给后续合格R3，不能称freshR3 build/原生行为通过。当前仅新installedSHA完成，target/WRITE/D2/真实native模型尚待；无wipe/clear/pregrant或旧070数据改写。

非图片外部六例已新不可变rebind R3，manifest599fb8c2/scriptb038a338/plan715ff6e9，root9/9核齐proofdba10716；仍PREPARED_ONLY，未syntax/import/type/run或模型/端口。public CaptureRecord hash与完整private error/stack诊断已准备、SQL观察全只读；Control新有界独审实际在途，不重复R3源审。第7 genuine WAV真实父附件→旧ASR held→新binding仍最小UNKNOWN：当前import host-media/mapper allow-set与retained-link同时要求未建立完整真实入口，不等于全非图片附件不支持或确认生产bug。下一有界调查须看其它真实public caller/旧旅程，不能内部attach/DB手装或默认豁免；六例不因7等待停队列，7未闭前不整体READY。

Android262+070旧App173/CalendarREAD88/D01偏好241/capture192/privacy249工件仅原各scope。privacy6新masked原件/core每张130208像素全黑、Chrome排除16.575s负例+清规则2ACK、A14→20/B0及33-key maps/AccessibilityOff/进程租约恢复已核；JPEG边缘2.8px不作exact-edge阈值PASS，FLAG_SECURE App像素/实体OEM/其它app/race/模型质量/nativeWRITE仍未验，不转给当前R3。只用生成素材，不采个人截图。正式业务汇总/final仍须PM另行释放真实integration SHA重选完整scope，临时source523 prospective23与R3单testdelta plan13均不替代435路径组合/final选取。条件估计仍沿原01:25锚点主收敛06:45–08:15、汇总Draft08:00–10:30，不因heartbeat平移；无额外24h等待/下限，失败和UNRUN不计节省。

## 最终验收与持续记录

逐项矩阵的全部预期均是验收要求，不是通过声明。以生成资料从真实账户登录、生产 HTTP/应用启动、客户端持久队列/WorkManager、UI 与重启顺序验证；原算法 fixture 只作对照。每项包含同 ID 双用户负例、相关撤权/删除/取消/迟到结果；高风险持续积压与组合状态不能只做单分支测试。真实模型/供应商、物理设备、系统权限、前台焦点和部署分别记录，未做就保持未验，不采集真实个人截图。

历史首阶段当时仅管理文档；WEB与DESKTOP已报冻结候选，尚无独立验收、正式模块集成或最终完整检查。D2前置单commit单独登记，不视为模块验收。文档检查记录在[矩阵末尾](../validation/multiuser-parity-restoration-matrix.md#首阶段文档核查)，后续用真实候选证据逐项更新。
