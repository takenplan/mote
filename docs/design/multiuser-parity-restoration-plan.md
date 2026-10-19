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

按实际设备、隔离后端/账号/数据集分场景并行，同一设备UI、同一测试profile或数据库独占。完整check:affected仍由driver单窗口串行。保持目标5/上限6个active（含PM、driver、新旧chat及子代理）。按人类最新授权，原故障和依赖历史仍用原owner，清楚独立任务可建新chat或子代理，给最小目标/精确源码证据/约束/已知失败/交接，不继承长历史或重复审不可变包，不自动嵌套。真机交互前说明设备、窗口占用及权限影响；准备和构建后台执行。未授权部署、不重跑真实个人资料、不采集个人截图；缺设备或系统权限先给PM具体缺口清单。

客户端已完成v1/v2设备、Dev app/权限、本机Codex元信息和66+22细分矩阵；准备报告不作App执行PASS。v1四hash保留，v2明确ENV01移除手机/USB条件。实际窗口由driver在准确APK/隔离后端/账号和设备锁齐备后派发。后续按实际冻结PR/临时组合与设备锁派单；Mac采集/队列/浏览，Android采集/SAF/Worker/A-B-A/日历，文件/图片/历史处理，producer→Memory独审保存→Ask/Actions，配置/插件/MCP与隔离备份恢复分别列前置、交互、预期、证据、互斥资源和UNRUN。

MCP访问Mote私人上下文与能力必须用户鉴权和账号授权；外部MCP源按自身原有鉴权合同，合法公开匿名源不增OAuth。协议初始化和会话管理由客户端完成。鉴权之外新增手工建session、预建connection/source等步骤，仍须具体必要性证据及产品裁定；这次鉴权决定不扩张为其它用户步骤授权。

## 全局对话槽位与待办（用户最新约束）

人类最新调度覆盖此前一律禁止新chat/子代理的限制：目标5、上限6个active，PM、driver、新旧chat和子代理均计入，每次恢复或新建前fresh核数并留PM再醒余量。原故障和依赖历史继续原owner；清楚独立任务可用最小上下文新chat或子代理，不重审不可变包，不自动嵌套。后续实际派发用GPT-6.1 Sol：薄移植、状态、常规验证和证据为Medium；集成、授权生命周期并发、复杂根因及重要独审为High，无具体困难不用Max/Ultra。Fast工具无受支持参数时不冒称开启。输入未齐者交精确handoff后结束，资源释放立即接续，不等heartbeat，不因FYI唤醒idle。PM唯一mote-4保持15min/仅有意义变化通知。

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

## 当前验收检查点（2026-10-19 12:20，覆盖历史运行快照）

66主行与22跨域场景仍未整体READY。13个Draft #170–182均OPEN/Draft/未合，正式integration仅管理文档，main未纳本轮业务、未部署。实际shipping heads已收敛到bab6/tree872629bc，全部3219条目精确同4052、13个proposed heads均为真祖先；首个正确union23已FAILED：12P/1DesktopFAIL/10UNRUN，170.532s，Agent327P1skip、Desktop626P1F。原Desktop owner已源码定位启动GC清过期transport row，PM已确认普通archive须canonicalACK快捷恢复且原始parts零重传，该生产修复已在新3c首次完整Desktop retry14中验证；新Server七whole50=49P1F，唯一未提交snapshot过期例暴露旧GC前置假定，正仅修订测试，原两轮失败保留。Client R4真实安全smoke已接受，但首product因fixture RPC id碰撞失败；R5A九项自动结果保原输入范围，R5B因observer拒symlink中断；修订R6后一次新BONLY十项自动断言完成，Root16PNG与Control raw独核仅接受named transport/queue观察，final local-ledger全行与D1abort403/D2actualexpiry仍未验，尚无D1–D4整体验收。common/Root峰已释放，Client独占另行三资源，Server并发4不变；正式assembly/final仍HOLD。

Actions2689完整15项PASS1248.675337s，run28c8c359/Server3160P2skip/Web601/Shared198，binding99b2f321/Draft181/41paths。Desktop55完整16项PASS1278.614416s，run72c6442a/Desktop627/Server3129P2skip/Web601/Shared198，bindingc564b80d/Draft182/27paths。两轮post源码/输入/clean/cleanup/锁/PIDgone全核，实际PR base分别仍同15/16；未选Android，不代替实际UI/model或全组合。File f29 full19 PASS1446.428666s，Server3166P2skip/Desktop606/Web601/Shared198，bindingd44385af/Draft176已更新；Android25UPTODATE/0fresh，79旧XML377不重计。其最小submitIntake最终接力deferPhysical范围包括eligible自动audio/document/media，旧live/unknown物理工作与原权限/源代次/附件/current grant、取消仍受原门禁。

Config2aa批准8 PASS181.04322s，Web606/JVM382 fresh80XML/25exec，binding9f17dbea/Draft180；原15明确baseline不拼新23/Server，原ee42 FAILED/信号UNKNOWN保留。Ask a021批准9 PASS185.775725s/Web601/JVM373 fresh78XML，binding50fc7117/Draft179，原e427失败保留；Conn a562 fresh四build1544后批准6 PASS166.674991s/Web604/JVM376 fresh79XML，binding92e13e19/Draft178，原fdd失败保留。Memory6f44 full18 PASS1351.864914s/Server3222P2skip/Web602/JVM374 fresh78XML，binding0d0ef7c9/Draft177；Life b30批准13 PASS191.836518s/Web603/JVM372，bindingc44810da/Draft174；Ext5a freshServerbuild1505后批准5组PASS428.868812s，bindingbcfb9d59/Draft175，native20另列；均不覆盖各旧失败。Exec070 full22的Android25任务缓存0fresh、Android262 full7/JVM388 fresh与Webf8 full9保持各自范围，非新组合。

原core2044、source24a与其唯一插桩NONREPRO报告均保留。2044实际Files→Memory独立复核保存3→Ask/取消重启A16/B0和文本Actions语义→人审claim仅各原输入；其HOT失败、Web1P5F、rawscreen Actions INCOMPLETE/无nativeWRITE不洗。24a首轮bd81仍39P3F/NOT_QUALIFIED（HOT复用例初始17、Web4P2F），原后置未达安全断言保持UNREACHED；后110.583s诊断双PASS仅NONREPRO，14loaded sentinels/2596输入与完整observer覆盖不构成修复，观测开销未测。原24a/523历史输入和工件继续冻结。原R3及R2物理工作树后来均已缺失，原因UNKNOWN；Git对象与历史证据完整，旧PID存续不作运行健康或当前环境资格。

5235666d52aba0358cb55098cc8dda35704e6418/treefdce5cd81d14c3e67ff3a156c1f4e18bfb06d329为三新祖先f29/a021/2aa的真实组合，9delta路径/1production/3188其余mode/type/blob不变，source独审a88ee206、68+8工件已核。正常本树安装/Shared-Agent-Server-Web build/语义tsc/Node26 ABI147 SQLite-Sharp PASS，1625产物封存。其首次ordinary HOT2/Web6/File3共11P，之后whole Ask/processing76=73P3F，首轮87=84P3F、整体NOT_QUALIFIED保持。唯一三红诊断nonce b26fb2fa已消费：9.249811s原3均RED，两个文本例为intake/admission:pipeline/Material.revision三个真实organizer、正式Material/version/publication/intake各1/无model，容量两POST为同A下自动与manual两独立parent/request/scope各attempt1/accepted0；非同job物理重放。root回执61ed58f7/因果分析c6f4db6e，不回填原未达断言为绿。

PM另释放的523剩余C10已独立完成215P0F/0skip/cancel：Config29+七consumer32、generatedCodex4、Connector10、MCP9、Ext9、File四整file22、Web products/recipes11、Memory三整file88、native percall1。File40.495s/Web91.631s/Memory264.426s/native4.795s，两峰均实际退还。review9b2b6c09/manifestf0e9f284的33/33原件与10原Node summary由root核齐，root proof67133e99；source/locks/1625产物/原31历史工件不变，owned进程/lease0。这些是准确523新增scope，原87三红与未达断言不洗，不转记R3/final full。

R3冻结9c03b631045670ff6302aca430ba7a566c5647ab/tree6b935deffaa49feca5438df7a9fe5379f35d607d，单parent exact523，production0，仅processing.test 33+/14-。保完整8kind图与三organizer的精确private operation/owner/current public CaptureRecord hash/grant、null model、单Material/version/publication/intake、原两Ask事件/B/rollback/orphan/sequence；旧task前缀只适配current ask-index family。容量使用默认已登记intake唯一工作，held/B填满/跨awaitstorage拒写/settlement/B真实删除/显式retry原1→2与artifact保留；新增独立双意图例核不同parents/requests/scopes/grants/issuance、各attempt1/storageblocked/accepted0/无artifact-publication-activity。未删producer/关Memory/改Perception默认或原12s/120s。作者最终focused4P4.793812s、whole processing+Ask77P147.566784s，4是77子集不累81；初focused2P2F新增hash误用storageJSON后修为真实GET/captures投影，原log保留。27原件manifest2748e08b/reportca84ae13/root333d2470已核。

独立Control fa05932b完整静态审无阻塞源问题，15/15工件root proof5ac7cae8。其余3196 tracked同一，1592个Server/Shared/Agent输出同一、共同1172 installed entries逐字段同一、共同87841物理依赖文件逐SHA/size同一；R3新增235 entries不冒整环境同一，Diag3是新增无旧built baseline。driver随后fresh六TS+Android环境PASS与own Web build6.402s，缺失33 Web产物已真实补建并逐SHA同523，receiptbf0964，source/root及installed-lock不变。13组实际入口547源码的import/require加保守declared/optional/peer闭包192–944packages双树0包路径/manifest变化、235新增0可达、可选/platform未解边逐项同一；唯一first-party动态FileProcessor模块参数在当前ScopedProcessingHost为空。该证据不是syscall trace或任意插件保证。PM d78e0b0d批准HOT2/Web6/File3及C10 File22/Web11/Memory88/native1/Config29+32有限旧scope baseline，均保exact523来源；生成CLI/worker边界在新R3实际补32。

新R3独立五组实际分组覆盖已闭合：whole Ask+processing77P144.691s、generatedCodex4P10.600s、Connector10P22.873s、MCP9P21.277s、Ext9P22.110s，共109P0F/0skip/cancel，11个wholefiles/各child自然exit0，原helper后及容量B删除重试安全路径已在新运行到达。review75db8546/manifestfd1a1618的25/25原件、5原Node summary、source/两locks/全部1628 SHA+size/11输入/owned PID0均root核，proofe9b12c4c；PM正式9aab802b接受限定scope。原5min资源窗事前明确amend总上限10min9572642e，未改测试deadline；实际峰22:50:02.952Z退（Ask22:49:40.867Z完成），旧controller仍读已删owner而EXIT1，已过91无中断/重跑，仅未启动18按新普通无峰续体完成。原run.py/harness-error/工具stdout及transition全留；不命名一次新109命令/fullPASS，更不把不同SHA拼成全Server绿。

R3实际Core已完成真实CLI init/admin/start/auth、现有Codex stdio和双账号文本Files→Memory独立提取/审核保存2卡；A/B Ask实际完成，按canonical originalRefs/runPins/sourceSpans/sourceEvidence只读核对原引用，无重复模型。三处harness误设（ingress ID等于canonical evidence ID、强求单独evidence工具名、OwnerQuestion.status而非state）保原错误并以只读合同审计闭合。取消在真实turn.started后生效；正常CLI SIGTERM/restart后30.481s有界观测无新job/card/usage或OCR物理收据变化。Context仅单页lexical/degraded=false，vector、多页完整性与全部三mode未证。Core reviewb6ba0c04/84工件e5af56bc、Native语义review68e5f5ac/43工件6f2ce236均由root逐SHA/size核齐，proof4dffc1d2。

生成PNG经真实PP-OCRv5 ONNX CPU worker产生Material（1物理OCR事实/识别184ms，非冷启总耗时），随后自动图片Memory确实失败：job8d988843/task9825e953、attempt1/permanent memory_output_image_evidence，extract30615ms与review42736ms均为completed逻辑会话；review accepted/prepared/save均未成。失败位于review QueryResult返回至host接纳检查点之间，具体分支及软件缺陷尚UNKNOWN。原draft及实际读图证据保留，review结构结果/本轮receipts/ranges/trace/精确reject stack未记录；reported requests0不推物理0。freeze9ae58123/logsb72aa831及原失败不改，不重试原job。原Memory只读triage10d33e77与已有证据恢复8847aa2e均未找回review结果，当前实际9c03仍NOT_QUALIFIED。

阶段B另从9c03冻结09d173df158c0d285b70fa62c8f315e6a225ffb9/tree76e05a0f79b5a349d7d16e87a3dc4a8ee0df746e，8paths289+/5-仅最小host-only观察/fixture，默认OFF、原return/error对象和prompt/guard/repair/deadline不变；去观察语句后两业务文件逐byte同9c03。own正常安装/Shared-Agent-Server语义构建/Node26 ABI147 SQLite-Sharp通过，最终whole两file18P（含9nested）/scope通过。初scope直引观察器FAIL保留，经既有facade修正后重验；独立f4653e9c无新硬阻塞，43工件、8源/1595own产物/两locks root核齐f9fac229/8af785ce。caller拒绝的实际MemoryHost集成只静态挂接，unit手工weakmap seam/clone失败等有限边界按PM217e0207接受，不冒全故障覆盖。

阶段C按PM另明确接受priorCards0对原2卡的上下文差异，只做一个fresh-image instrumented诊断；原PNG49989B/SHA2ba2b4ef、有效配方/模型/settings不改，无额外付费seed/旧job retry。external wrappercfb3c690只在exact09 serverdist与唯一新配置同时匹配才启private preload，root43af565d及真实serverPID marker/runtime cdb27c55已核。独立49178/49179 profile在00:18:34Z经公共入库→真实OCR→自动Memory，00:19:31Z首次COMMITTED/attempt1保存1卡；完整结果证实extract/review各实际read_image1/receipt1/ranges6/citations4，最终保visual1+OCR文本3而非仅OCR替代、实际scope checkpoint_saved→commit。reviewd592232b/public54+private9已root核齐ea417eda，post源8/产物1595/两locks再独立核相同。正常CLI stop/flush与worker清理exit0，四端口关闭/ownPID与两backend leases归零。此成功仅新输入NONREPRO，priorCards0vs2、本轮提取与审核均整图而原提取crop、instrumented/fresh身份差异均保；PM0d1f3199接受有限诊断，原8d988失败及根因UNKNOWN不洗，不再运行第二case，观察器09d不因此进入业务汇总。正常CLI ensureMediaRuntime还自动建venv/pip安装74个发行包，虽脚本未显式安装，不能声称无安装；实际OCR仍已有Python+仅5个公共权重，pip输出已由产品丢弃，下载来源/量UNKNOWN；managed内部signal历史未记录，不冒全部退出信号已观测。无个人资料、全stdio、auth/history/stdin读取。

Client原Web已实际切换A/B各自Ask历史并点击inline citation；B打开A旧citation URL显示不存在/已删除，无A缓存泄露。原Memory UI显示两条已生效文本卡与上述图片failed，未点重试。Core生成API target的OwnerQuestion经原UI确认后closed/approved/version2/op1、claimed0/ACK0；这仅为验收agent实际UI操作，非自然人判断或OS写入。Core49174、OCR49176、Native49171及MacUI现均由Client唯一管理，Domain已停止这些liveDB/API访问；同DB/epoch交接不强制停后端，确有重启则重新核PID/target/lease。

Native APK仍来自exact523本次37.253505s构建：59076344B/SHA cc1883ddcb6e03ddde4cb3ac2fdb99d54d4b4b0ffb9eb4c3e650323ea6377763，证书114c4cc7/package dev.mote.collector.m15fixture/100/0.0.89-m15fixture。22工件、3197源/3425声明task文件/11998toolchain/7assets root核齐00473940，PM仅准recorded-input复用，不称freshR3 APK。stock5582原App正常注册LOCAL1/真实device/epoch4801c081，StageA61工件root核齐11e1b53b；WRITE false→true未出现新OS对话，不能声称点击系统Allow。新native独立profile完成真实语义→open question/canonical action，再由验收agent在原Web确认，firstclaim前ops1/claimed0/issuance null/ACK0。Client已报告23:42:19.819Z仅冷启原MainActivity，自然CalendarActionWorker SUCCESS（非强制调度或直接Activity写入），LOCAL事件2→3仅新增row3，canonical全文/时间/时区/位置/双marker匹配，ledger30B、服务端claimed1/published1/ACK succeeded externalId3；App重启后无重复。Native76工件manifestd2b9bda2、Core25工件manifest2d457c0c均已root逐SHA/size核齐f05808b5；B原App未connect/no-adoption空列表、恢复A、两次真实刷新无OS/ledger/op/ACK新增已验。inflight切号、uncertain崩溃ACK恢复、未claim前撤权/TTL及server重启replay仍UNRUN。原两端口共host cookie误认隔离已纠正为Native localhost与Core127.0.0.1，分别reload/auth-self身份与deployment200，旧失效UI保留，不称物理BrowserContext。BPF被拒导致首次HTTP响应body未抓，mutationAllowed只能结合原生guard与真实effect/receipt推论，不能声称首响应已录。冷启峰23:40:30Z已退；无wipe/clear/pregrant/伪target/直接OS insert/预claim或fakeACK。

Desktop另在own9c03隔离树完成normal ci/libs/Swift helper/updater与实际Electron probe，Node26.11 ABI147 SQLite-Sharp、Electron41.10.7/Node24.18 ABI145 builtinSQLite3.53.1与Sharp生成PNG分别通过；使用原产品main。最初辅助证据误用root esbuild0.28.2，原错误保留，随后workspace0.25.12 write:false精确重现既有bundle b59f8a7d/55输入。reportfcc3e236/manifest52f2fe27的18工件root proof4dffc1d2核齐；二进制可运行不等于原renderer/preload、D1–D4/TCC/真实采集通过，后续实际隐藏UI另验，不借旧73/55。

非图片六例的原599/41包均未执行且保持不可变；Control原c539/6c0先后闭合F01损坏WAV的UTF8观察器和F02误读status.cancellation/强求receipt unknown的错误。新80793736/script0857399c经有限独审9f799247确认initial old coordinator→精确ASR child/owner/epoch/grant/issuance/未决issued-or-unknown receipt及wire tuple闭合，其余5case与所有后置断言/预算不变。root首次独立普通执行25.712s为6=5P1F/0skip/cancel，input/source/locks/1628产物不变、峰/PID已清，review803f4923。8份48B实收WAV逐byte同生成原件，F01真实字节保真闭合；unknown显式确认、disabled held、text两入口与cancel等5例通过，不冒整个六例合格。

唯一失败是新epoch enabled路径：password reset/新login/source注册/upload open与part均成功，commit401 invalid_identity。Control c3b1a79b/4工件root2601c3f6确认请求进入事务同步消费者；accepted事件→Ask event/private operation/task/full input三重hash精确命中旧epoch0 succeeded ask.index-admit。M05拒旧grant正确；旧任务复用逃逸为新业务commit401是最强源闭合机制，原HTTP assertion没有内部server throw frame，限界保留，不能说新token过期或fixture错。新Ask582f624e曾完成own正常安装/Node26 ABI147/Shared-Agent-Diag/Server语义及scope，20.981s/1595outputs，仅环境前置不是测试。Control924b5057随后要求修正整批proof误伤有效兄弟、独立精确digest oracle，并指出完整公开sameRevision reset先遇M07身份碰撞；旧582资格不转新源。

Ask返修child08452da8e57461be0b44ef2d1149b9d3a2d6a528/treec597aef27eee07c36e42981f8aa560307a470c92从582冻结，6paths139+/27-，production仍仅ask-retrieval。持久化receipt-time envelope、按实际record核source/Material子树/原件proof；独立已知图oracle恢复完整proof/digest/op/task/grant，原公开sameRevision case仍enabled且正文逐byte同549746af。Control首次启动因模型capacity失败且无审查输出，一次同原者重试后有限独审e1473e11仍CHANGES_REQUESTED：await child submit不在record-local catch内，异步授权间X退役仍可能中断后Y；两新sibling例DELETE X后要求同ID重建200违反既有永久tombstone/410。此为静态反例，未冒实测新失败。root4报告/6source/8packet核齐23e24dd3，旧exact oracle问题已静态闭合；后续cbbc及真实pair结果见下，原179未更新，原5P1F不洗。

M07另从9c03冻结66a576fd09653ae5c30df0b35dcbc0475edd882d/tree326e07ed919f5ea75dbdf9e714678b7f8a8bba96，10paths272+/5-；M07 producer/input增加受信epoch及owned capture/source生命周期token，双FK退休、Memory erase清理、普通restart持久，M05拒旧grant不改。current stopped-backup必需schema含新表全部4列，scope inventory同步，portable不带active authority。Domain有限独审fe921d72无确认新源码反例，25作者工件及必要消费者已核；direct raw DB人为删表后启动拒绝不在保证内，单独capture删除/Memory erase新fixture覆盖和paid checkpoint/unknown进程消费者仍有边界。root首次正常own ci9.907s/Node26 ABI147 SQLite/libs2.807s/Server语义5.386s/scope1.773s通过；三whole files148.642s实际81=76P5F/0skip-cancel，总169.023s自然exit1/源码与installed-lock不变/匹配退峰，review42a743cd。新备份portable三top+五nested与原processing68共76P；五个新M07例均红：全owner external journal1!=0未区分paid、两次duplicate upload part409、公开reset exactrevision stale/grant_revoked、reset heldASR replacement commit401。不能全借Ask依赖解释；后续956与真实pair结果见下，保完整public/listeners/canonical revision，原81失败不盲重跑。

第7 genuineWAV已由真实configured生成PythonPack公共upload→preview/confirm→parent retainedWAV→attachment processing建立，非现有bundled WAV能力或DB手装。PM770a2ccf KEEP旧explicit pinned pack全supplied输入（含ZIP/成员/媒体），generic无pack媒体拆分与安全门不变。原File新48d0的7=6P1F保留；独审a027确认observer只查intake:%漏正常policy-reconcile后继。新38a5保快速enable原序，whole7P18.094s+8whole消费者56P83.978s，明确旧disabled intake gen3/cancelled0与新grant/gen4 current successor blocked external_result_unknown，原explicit-confirm尾A,A通过；selected新test类型20FAIL保。仅type-only再冻46fe7dde4381a40d3abd0e3dfdf5ffdb0f806ab0/treed4a398eaeca899197304a97797991f60d8d9bb93，擦除JS18343B/SHA47869d7c逐byte同38，rootafb930e0独核；新selected严格noEmit/whole7P17.075s/Server源noEmit均PASS，manifest75586430。56仍只归38，旧4P3F/5P1F1cancel/48红全部保，未更新176。独立delta与runtime包均已root核；完整19尚未单独执行，不自waive。

Native已ACK后原固定审批详情仍显示等待客户端写入的差异另由Actions修复：新d09fb20cd129ed01985638b4ba12467f3953d95b/tree7868eb5eda860a636b8fe3d649dd83e4038a5d6d仅在原review GET加入经既有reviewCurrent绑定exact approval/operation的current execution facet，固定payload/version/fingerprint不改，复用原Actions状态与可见页poll/身份重置。root9c73a088静态无阻塞；own正常安装/ABI/libs/Server-Web语义构建通过。作者从根目录启动的四file21=14P7F（13Server+1Web schema通过，7因classic JSX失败）原样保留；root随后按官方Web工作区react-jsx执行3whole8P19.120s+scope/i18n通过，reviewd1f4be91，同source/locks，不改源。13原Server+8新Web是21唯一例，不累22、不称新单21命令PASS；尚未更新181或实际新组合UI。

Desktop ownR3隐藏原main/preload/renderer已走真实Core A/B历史、citation、进程restart与A→B→A；report2366de42/manifest02972081的62项publicFiles已root核齐dc9d2c85。A最初因验收先开base再同文档hashchange到ticket URL，认证成功却无证据overlay，reload才恢复；B及最终A fresh-document首次即显示本人证据，旧A页随后退登录无A原文。仅背景presentation/生成对话框边界，非TCC/打包原生启动或全部D1–D4。Client正准备新生成no-model隔离profile的D3/D4分页、cursor/错误/中央图像bytes与D1/D2原Sources选择确认/spool/真实ACK丢失及restart回归；尚未执行，不借最小UI证明全覆盖。

Web新d6adec8f生产只修main同页ticket恢复，Domain159b7cb8有限源审无生产阻塞，但150ms等待不能证明旧认证终态。测试-only child473900504d1b7f1062455c06c361e0fa962d948a/tree9dbba7620de8f2c3f8df928d589529c516912122保d6四production blob，改为原生auth lock原Promise终态、MessageChannel排队与被动React commit空闲屏障，补route ABA/manual B/真实ticket replay；root有限核85e40f69不冒runtime。正常own ci9.558s后首轮准确Web9于115.610s失败，runbab5646e：6stepsP、Web615=613P2F/0skip-cancel、Shared/release后2项UNRUN。两红分别Vault初始export409 archive_changed与录音归档第二页预期4实际3，尚未定为production或fixture；source/locks不变、cleanupConfirmed，原失败保留。

另一次明确首次执行此前UNRUN的正常Central绑定build12.524s通过后，473隐藏built-main browser无结果或错误，准确挂起JS阶段UNRECORDED。root在5min窗到期后实查并仅SIGTERM本人6个descendants，实耗316.019s、发现due后16s清理，全PIDgone/token释放，review4b9f7adf；raw controller误写natural exit的原件另存并由review纠正，不称自然结束或页面行为已验。原Web新test-only child5c89e95f70d4ad82fb1818a86836a544a32f2204/tree710c40cd508819b2e2f61456f25c057ac0ee5d19保production不变，补真实owner tasks终态再单次export、最终first20/remaining4与UI exact cursor/IDs完成屏障，及neutral blank frame后有界CDP/首product load阶段。两红具体witness/旧cursor和首次hang精确原因仍UNKNOWN，不替production免责；root随后完成own正常依赖/构建及首次检查：两whole消费者14=13P1F，recordings通过，Vault把合法future memory_window_pending误等全终态而失败；显式browser29.066s自然失败已过首document load，后续evidence/auth阶段当时未分。后续43与244结果见下，完整affected消费者留实际新联合计划，不拼旧9项PASS。原473/d6/f8/R3与PR170不改，不加任意等待或用户reload。

Ask cbbc2afcc7d5d2bb711c02ada3b51cb6d64c64d7增加逐record异步授权退役的精确404局部处理，其他全局授权/存储错误仍抛出；真实原M04 lease等待、DELETE/410与有效兄弟Y继续的whole5独立PASS5.834s，Domain af21b0c4静态无新阻塞。M07 test-only 95658b082662ad06bb4fde68c302debe8f724b5c修正重投transport batch与物理journal观测，原业务/processing/backup不变；两独立seams 2P4.093s，review7597bd41，实际processing.extract1且model receipts/usage0，不把本地提取误算付费。

两者真实合并db1ff614a57c705191d3a51d2d6001d95981ec2b/tree58770858f03acbbc87605aa1fb3c003a3d79c597，16path并集、0冲突/手改，root merge-tree精确同tree/82工件核齐9199e70e；current required schema217含M07四列。own正常安装/语义构建后首次四whole files81=78P3F/148.164s：M07五例、siblings五例及原F03通过；两个Ask例在未等B admissions终态的全状态快照处失败，旧A late-tail未达；processing rollback已回滚而旧JSON.kind检查不识别当前envelope.event.kind。原首轮失败reviewd5eae35e完整保留，未补跑同头。

新test-only 3b680cfe0deff1b20a6a902c5b400bca072d5f50/treea909d2cc6434bbfd98a5498422d8ae90b7ee475a仅两tests+doc，生产/锁/其余3203对象同db1。Domain 2c93a88a有限审无阻塞；原B成功终态后才取完整baseline，保旧A全部late-tail并增强B精确proof/grant/journal/Material不变，rollback保独立已知完整图/receipt/digest/owner/current grant与零publication。root新own安装/语义/scope后两受影响whole files Ask3+processing68实际71P0F/0skip-cancel137.069s，总157.393s，review94733e9e；之前未达尾部已到达，源码/installed-lock不变、1595编译SHA同db1、记录进程gone/匹配退峰。M07及siblings保准确db1来源，不拼新81PASS，正式联合full仍必需。

Web43仅test-only合法future-intake例外与公开canonical引用：whole Vault12P4.490s、完整导入/ACK丢失/B隔离/cancel均到达；首次browser在public-evidence-targets-ready、window/ticket之前失败，仅catalog/read200、无context read，确切失败值UNRECORDED，reviewe4db5072保留。新244e0c77177f8e0ba46f484bdaaa7acc91dbc37c/treedd978e2350a360607865daf0dfc26150293b013f保d6生产四blob及43Vault/5cRecordings，四test/fixture/doc增量。完整公开catalog/material窗口按已知raw成员、完整正文、block/sourceSpan/time唯一匹配typed current citation；作者本树正常安装/ABI/绑定build及真实HTTP预检30.805s全部exit0，A/B各2refs/spans/sourceSpans、唯一目标1、本人context200、同raw ID且exact A ref在B404。prep71bb9d5f/precheckeda49c5e只作作者locator合同证据；Domain5431f748有限审无新阻塞。Root在同一已准备物理树首次hidden built-main browser十项实际PASS5.297s、总5.462s自然exit0，reviewa0ffc236；首次document、同页hash ticket恢复、真实replay、held A→B、精确A-ref/B负例、取消及cleaned-hash ABA、manual B和真实auth Promise/React终态均到达。Root核19工件/3202源与1625实际build SHA、87本树symlink，未重装或借环境，运行前后源码/1625产物/installed-lock不变、owned process group gone/02:09:56Z匹配退峰。作者precheck只留最终installed-lock hash，不冒作者两点比较；真实cross-tab、controlled expiry、auth A-B-A和原Desktop/IAB新fix重验仍UNRUN，UI404仍只endpoint/status见证，直接API exact ref404另证，不拼新Web9完整PASS。

Client R2新独立exact9c03后端已own正常安装/SQLite-Sharp/libs/Central构建，3197源/95863依赖90本树links/1628产物齐备；1628同旧冻结metadata的SHA/size，不冒已消失旧树字节直接cmp。新不可变R3 manifest9bfb0d89/freeze7a6cf78b、独立micro9d72e80e：16final syntax+inert+3入口共20实际exit0，7个dummy lifecycle、3个真实toy HTTP partialabort/fsreject/200drop、两JPEG实际decode均通过；不作Electron/Mote产品通过。Control fa77f19f有限关闭三NFR2，但新增orderly stop oracle需实际exit0/signalnull/无升级终止。02:00:56Z首个实际direct-index安全smoke在generated-admin stdin CLI退出1/invalid_request，尚无HTTPserver；controller1保留，3记录PID gone、49178关闭/两匹配lease02:04:03Z退还、source/deps/compiled/Desktop645不变。health/auth/schema/restart仍UNRUN。源合同确认原fixture显式空ASR endpoint会进入defaultProcessingConfiguration的localEndpoint URL校验而拒绝；原throw field/stack未录，排他运行因果不冒已证。新R4 aab79619/freeze08149ccc仅省略空endpoint用合法默认、严格正常stop要求code0/signalnull及补保护旧包；Root有限审af2d58d7核32工件/14source inputs/五合同源/旧199public SHA，控制/代理/各stage逻辑同R3，不重复安装构建或micro。已准一次新R4≤5min隔离direct-index smoke，须外部sidecar核两次真实server正常exit0/signalnull/无SIGKILL或cleanupError后才可ACCEPT；实际结果待回执，产品A/B GO保持HOLD。

最小交付source已经单独冻结：M07 60eeb763/tree054c9eb6直接parent6f44，独立SolHigh审4593cc09仅SOURCE_APPROVE，25工件/三capture段及逆投影均核、standalone200+origins=201；Ask d217eff7/tree0e142dea直接parenta021，五whole blobs exact3b，Root有限b728c393；Web a33d3c11/treeb12ddaf7直接parentf8，八whole files/四critical production blob exact244、两个tests仅owned hunk，Root有限4dbf1cfe。原13 PR remote heads未更新；旧71/db1/244证据不转新port runtimePASS。

原Exec先形成4052/tree872629bc并真合Tool be096与current管理c0f，旧143工件Root5b589760核齐；之后真实依次merge60e/d217/a33到bab6c87a629a45dcad2043081cb013f8fc83587c，三步全tree仍exact4052，62新工件Root6fe96d50核齐。实际M07一region是incoming未变6f44 accept旧body，保aggregate attachment-parent；Web两region是旧export上下文，保当前GET A/B和cancel/cleanup；每个incoming owned段已精确包含，不用不透明ours换祖先。217表/其它16表与origin四列/原3b shared processing全部保，3219 mode/type/blob逐项不变，26 current+proposed ancestry均true。Root实际逐13 PR base/head完整diff映射到正确union23，map6c46f671零遗漏；File46/Actiond09直接交付、其余三port真实祖先已到位。

新bab6本树own正常npm ci10.277s通过，源码/root及installed-lock不变，无借环境。首个官方union23从02:33:55.196Z开始，run5a40f02e/input937e40d5，official169.502s（wrapper170.532s）后12P/1F/10UNRUN；Agent328=327P1skip，Desktop627=626P1F/65files/109.576s。唯一失败source-account-retry.test.ts113:190的commit lostACK/既有expiry+restart路径：request_key相同和pending恢复/flush清空已到达，current upload id却不同于old id；后续A1/B0与再次同步不重复的断言UNREACHED。Root reviewae04b9e8保首失败，原owner SolHigh只读核当前契约/源码因果，不凭私有ID推断用户数据已重复、不按负载/flaky免责；额外24h专项取消也不删除此既有expiry/ACK/restart例。source/两locks不变、official cleanuptrue、launcher group gone、common释放；Server/Shared/Web等后10步均UNRUN。修复真实diff后按影响补delta/consumer/剩余义务，可证明不变的已过组件只作准确bab6 baseline，不冒新全轮PASS或机械重跑。

Client R4首次实际direct-index安全smoke已PASS：exact独立9c03自己的216 required表/1033列（非pair217）、health/auth/protocol/同生成DB重启、前后execution/captures/usage0，两个actual server code0/signalnull/无升级终止，六记录PID gone、匹配lease02:20:00Z释放；Root runtime qualificationec999e32接受此准确9c03范围。此前admin invalid_request与0213Z外部mkdir入口UNRUN均保留。R4首product AB在A01之后select content-scope处失败：实际UI已selected:true，payload id覆盖numeric RPC correlation4、reply string被pending丢弃而45s超时；Root不当UI挂死。生成65captures/292execution/usage0分列，Client额外zeroexecution后检误设保留，D3/D4及B尾部UNRUN，进程正常退出/三lease02:26:42Z归零。新不可变R5仅requestId与nested action分离、focused dummy consumer及旧包保护，38工件7ea1a9b0/final14freezeb6d797d3；唯一genuine lifecycle.desktop/Node实际微测五numeric回复、原select payload/normal0/no late650ms通过，仅transport非DOM。Root31a0bbfc与Control f4228de9有限批准，backend/config/stages/closures逐byte同R4，不机械再smoke；已准一次fresh R5 AB≤既有18min/新三lease+短cold峰；A阶段九项自动结果已到达（分页、四503恢复、A/B图片/原件bytes），尚待Root人工核UI。B首offline本地盘点因运行中生成profile出现symlink被observer拒绝，原路径未记录且退出后消失，不能回填Singleton具体路径或放行任意link；本地queue/ACK/restart断言和后续B未达，原失败/全正常退出/三lease02:42:46Z归零保持。新R6 bf2d4d35仅lstat/readlink元信息/O_NOFOLLOW普通文件hash与旧包保护，42工件/14freeze及一次真实生成FS两普通文件/四links不follow微测均Root81e4f55c有限核；SQL证据/RPC/backend/stageB原断言逐byte同R5，旧具体link原因仍UNKNOWN。B不依赖A数据/界面状态，已准一次fresh BONLY≤15min/三新lease+短cold峰，准确9c03/ec999资格复用，不重A或机械再smoke；R5A保原输入范围：Root已亲看A/B原件及503页面，OCR disabled/awaiting retry状态一致性与raw IPC错误文案质量仍待裁细项。R6一次BONLY已实际完成十场景，286工件manifest6c242561/reportbf7b63a3；三次真实后端与Electron重启、pending摘要保持、完整commit/part响应丢失路径均达，9 transport/queue加1撤权review仍待Root人工UI/账本核。4server/13Electron/bootstrap均正常0/signalnull，无升级终止；61记录PID/组gone、两个端口free，三匹配lease03:02:37Z释放、98.845s。captured23/execution69/usage0分列，实际D1abort/yield403与D2expiry仍UNRUN；新Singleton元信息只证明本轮nofollow，不回填R5原offender，不能转记bab6。

本轮新增生产裁定已落实到唯一writer：PM查旧2c262 files.ts81–86/347确认，普通archive的当前有权、同immutable输入且canonical record/原件仍在时，commit ACK丢失→staging GC→重启应直接恢复canonical ACK/parts[]、零原始parts重传；允许临时UUID变化，不回滚GC/新增TTL或旧Store兼容。原File owner SolHigh在46真实shipping child实现最小M02只读revision/fingerprint端口与M03当前head/原件hashbytesMIMEretention校验，Desktop owner Medium在55 child补单文件强consumer，Server108–114同合同修订。最终File f40f8648/treea308da8f（parent99514/ancestor46）恢复缺物理原件既有resupply，拒旧99514新增410；Desktop b6ffb678/tree1def523b直接55 child。唯一SolHigh新独审eea3fa44只SOURCE_APPROVE_FOR_FOCUSED，六owned路径及proposal语义核齐，尚无runtime/type/build PASS。普通default无processingProfileId/importDeclaration是当前最小覆盖，显式处理字段不在canonical fingerprint则原完整处理路径保持，此项是未覆盖边界而非已批准永久例外；非currenthead/缺原件/删除/过期snapshot/当前epoch/source/revoke等既有义务不缩。

ACK shortcut还暴露三类已知消费者前置：shared scoped-files、Ask upload与M07 redeliver原来都会在begin后直接PUT，M07还强要新batch无receipt；旧DTO本已允许begin.receipt，需真实读取并校验ACK后不PUT，保原epoch/paid journal/grant/incarnation/late结果断言。唯一File writer管shared helper，原Ask/M07各Medium仅自有单测试文件thin child，分别f62c41d2/tree72e43644直接d217 child、d1d10d96/tree1f03a16c直接60e child，原三/五测试body保持。不能把transport batch当恢复旧authority或伪造新processing意图；四新head已交原Exec真实合成，须保bab6原ordinary-expiry/retained-receipt/当前schema217等hunk，准确新祖先和正确后续义务须在下一昂贵检查前再次冻结。原bab6失败始终保留，剩余10步从未借绿。

实际四新head已依次真合为3c312c11d4d994f5e9b6ea99dddf024d61923cc7/tree9cf9dd49：File三file/三region，其余零冲突；102工件manifestc448dece，Root a6dfa4da全SHA/size核齐。Root eb858bfe把原5cb517 proposal在内存逐hunk应用到真实bab6、四result blob byteexact3c；三strong consumer wholeblob各exact新shippinghead，其他3211既有entry mode/type/blob不变（旧3219→新3220，8既有变更+1新增doc），有效生产无额外delta，不机械再独审。自有环境全deps/outputs前后相同，Root own-ci两lock binding复用；按真实管理base b416及新13 proposed shipping完整diff→union23，map99c63a71零漏，remote13仍旧head。

3c首focused run033985b2/input6ebd70bb，7steps 6P1F/62.502s：environment/scope/Server build/Desktop与scripts类型P；whole Desktop retry14P/19.232s，canonicalACK/0part/bytes0、真实expiredGC重启、A1/B0与再次同步尾全部到达。Server七whole50=49P1F/27.246s/0skip-cancel，Ask3/M075/siblings5/snapshot4/file-source6/file-forget2完整P，ingress25=24P1F；新lostarchiveACK例P。唯一ingress93默认snapshot/未提交part→expiredPart409→restart后changedbytes begin expected409/actual200，后恢复tail未达；不是新archive shortcut运行回归，也不把旧Server UNRUN冒原绿。Root first failure3d263762；源/两locks不变、正常结束/cleanuptrue/launcher组gone/common释放/峰03:19:08Z退。

原Desktop SolHigh112s只读确认旧55没有automatic startupGC，旧409依赖expired row仍resident；LIFE恢复启动GC会删除该row和manifest_hash，旧2c262也不保已GC未提交batch永久绑定。PM批准仅原Exec改单个integration test case：明确expired仍resident或freshrenewed期间的same-key变体409及row/part/B不变；确认restart后oldrow消失、用原bytes合法renew，保oldcommit404/清staging/B原part/完整原件bytes/一次capture/真实successor409。Root另识别新proposal未达line99把默认snapshot当archive-only fastACK，是静态fixture矛盾而非又一runtime失败；恢复bab6该段snapshot新batch→expired续传两part→commit同canonicalID，不改source retention或扩生产shortcut。新lostarchiveACK及其它24case byteexact保持。首test-only child ae92b135/tree472955b7已实际wholeingress24P1F（run8b66682a/input390434ed，20.724s）：restart仅创建app，oldrowgone直接SQL断言先于Fastify onReady，故旧row仍在。首失败保留；Root承认遗漏了此启动次序，未改GC/加sleep/同头重跑。原Exec仅一行加真实app.ready()形成69542743ced4eac97136dd904f0b421b507484e0/tree57d5ea46，生产0/其它24case不变，Root源码资格a991d46b；首wholeingress25P/0fail-skip-cancel（runf58194c2/input8cff5532，20.482s）。原3c其余六whole与14保3c来源，正式精确integration full仍不豁免。

R6B Root manual1ff27e0b亲看16生成PNG/286工件全hash，Control7779e2c3核75必要工件/192rawHTTP body及3restored ledger：只接受9 transport/queue+1撤权观察；十case无final local-ledger行导出，不能把before/restored冒最终持久SyncHistory归属/pending删除通过。真实final status/HTTP ACK/中央durable receipt/capturecounts及immutable原件hash各按已到达scope记录。临时Syncing与synced同屏不称稳定文案通过；D1abort/yield403、D2actualexpiry与默认加工Memory共存仍UNRUN，原R5link原因UNKNOWN。Client原最小计划由原SolHigh审cb28ebf1，新四项源包39014785/sourcefreeze305b8c0a再审0649dee5；原writer修订manual/unpaused真实readback、完整bootstrap/gate waiter/inflight cleanup与timeout headroom、reader聚合原始bytes及实际输出buffer限额、yield真实admission/集合与D2 exactupload/runfinished/click因果。旧prose proxy patch和unbound adapter不是可执行交付；新composed包须全绑定并仅审新增delta，不重审旧R6或扩A-B十例。

PM已允许各新源focused+有限独审合格后，以新冻结全源临时候选一次正确完整check:affected联合覆盖File46/Actionsd09/新Ask/M07/Web，按每个真实PR base/head完整diff和义务→step映射核遗漏；M07新增backup/schema消费者须保并集，不机械把新输入限定23。此替代预先重复各module19/15等整Server，不把组合绿冒各独立branch新fullPASS，旧PR头先保持。原Exec已恢复≤15min仅准备3b/File46/Actionsd09/Web244真实新临时合并和落地表；full前须把module→实际PR base/head→最小shipping fixhead及依赖→候选真实ancestry→check义务列齐，不能把9c03全12基线直接灌单模块PR。13个PR当前真实baseRefName是codex/parity-integration-20261018，fresh read e334e887；GitHub baseRefOid可陈旧，按实际fetched ref及mergebase2c78核义务，正式汇总仍未释放。正式assembly/final仍HOLD；精确最终integration完整检查未豁免，同一准确输入若需复用须另交具体证据裁定，诊断观察器09d未准进入业务组合。

Android262+070旧App173/CalendarREAD88/D01偏好241/capture192/privacy249工件仅原各scope。privacy6新masked原件/core每张130208像素全黑、Chrome排除16.575s负例+清规则2ACK、A14→20/B0及33-key maps/AccessibilityOff/进程租约恢复已核；JPEG边缘2.8px不作exact-edge阈值PASS，FLAG_SECURE App像素/实体OEM/其它app/race/模型质量/nativeWRITE仍未验，不转给当前R3。只用生成素材，不采个人截图。正式业务汇总/final仍须PM另行释放真实integration SHA重选完整scope，临时source523 prospective23与R3单testdelta plan13均不替代435路径组合/final选取。条件估计保原01:25锚点，PM已用实际依赖预算替代旧绝对时刻：前置约15–30min并行，随后两轮完整Server各25–28min、汇总10–20min与最终独验20–40min，硬串行80–116min；首union新增Desktop失败正在查因，不把旧绝对时刻顺延或将预算随更新重新起算，未获final复用豁免。修复/定向/必要实际旅程另计且可隔离并行；不因heartbeat平移，无额外24h等待/下限，失败和UNRUN不计节省。


695按actual13 proposed shipping完整diff→union23，mapf87c3e21零漏；新11步continuation含wholeDesktop+原10UNRUN，非新单轮23。run7987543f从03:37:21Z开始，Desktop627P/111.500s、Diagnostics5P/0.590s；原continuation在04:05:57Z自然结束：Server3530=3511P10F9skip/0cancel，1604.068s，whole1716.797s，原2P1F8UNRUN/receipt93da3604与failure-reviewd1b5151b保留。十条assert分八组：图片额外manualsubmit409 external_result_unknown；backup B全owner cursor37!=33；KEEP等待旧memory.extract超时；录音仍要求三stage task超时；L06 Actions新证据watch blocked/stale；L06两个setup未等异步check便enable503；延迟导入误用global setTimeout(1500) TypeError；两File旧portable export POST503。具体原因各由原owner核对，未把十条全部先判fixture。9skip含8个固定Python/SourcePack及macOS sandbox条件测试，不能冒运行通过。source/双locks/input不变、cleanuptrue、launcher groupgone/common退。

新Client自有物理树parity-client-runtime-r7-69542743-20261019/mote准确695/tree57d5：一次normal ci/native/原preparer唯一build:central和actual index资格均0，完整217必需表、admin/A/B模型与加工/Memory OFF、0captures/0execution/0usage、同生成DB重启；两个真实server正常0/signalnull、PID/组/端口及匹配lease清。Root原verify独立核3220源码+1625Central产物，completed build receipt d5787a55；95863 installed文件/90 own links前后绑定保作者来源，不借其它树。此为运行环境资格，不冒四项产品UI完成；旧自有Desktop645组件仅生产/config等输入精确相同并核自身closure后条件复用。

Root在该同一物理695树复用真实completed receipt、独立临时generated profile/随机loopback端口，原hidden built-main browser十项首次全P/9.013s，result1d2e5f03；source/installedlock不变、natural0/组无残留、短peak/MacUI匹配释放03:58:49Z，无重装/重建/第二common/model。覆盖first-document票据、真实已消费票据重放、same-document/heldA→B、exactAref在B的404、导航取消/cleaned-hash ABA、synthetic StorageEvent、manualB取代及不存在票据；controlled expiry、真实cross-tab及auth ABA仍UNKNOWN，不冒Desktop R7或完整产品通过。

按最新人类授权，原Client唯一writer的实际composed新包须完成增量独审APPROVE、syntax/contract、准确runtime/自身组件closure、原入口ready/health/217/同DBrestart/normalcleanup及fresh隔离资源；全部到齐后自动最小四项UI，不等待Server/PM/heartbeat或重复授权。三项许可分别登记：UI旅程；held fresh upload核runtime/owner/source/session/key/manifest/epoch/priorExpires后，仅一次expires-only CAS/changes1/rollback条件变更realNowMinusOne；正常closed后仅本新generated run白名单副本read-only/先hash/row-byte caps/时间戳采样。不推定backend准备等于SQL许可、不回填R6 finalledger；proxy403仅transportfault，真实同pipeline permission403保持UNKNOWN。正式业务汇总/final仍HOLD。


按已授权义务仅续原八UNRUN，run6a8de7bc/input8cff5532/116.703s，Shared198P/.562s、Web619P/102.740s；release-integration37=36P1F/12.643s，dev-server.test.mjs112 accounts(existing)只读SELECT在真实live启动器旁遇SQLite error5 database locked，原receipt8920f887/failuref0538018保，后五UNRUN不洗红。正常清理/源两locks/input不变后，仅续五run873af432同input/78.345s，root14.152s、backup5.736s、client.669s、central1.739s、Android55.500s全P；Android83 freshXML/404tests/0fail-error-skip，25tasks全部执行。receipt2e7f398e/binding27356fb9，非模拟器App/实体/模型验证。源/locks/input/cleanup/PG/common全核；1628自有compiled闭包在tail在途时实际重核exact3eaa，时序不回填before。剩余native预编译阶段才取得短peak并匹配释放04:12:36Z；原whole gate未持peak的事实保留。

下一源仅准备修订，尚未运行：Config683625ea/tree96036真实HTTP A/B manualjob IDs/automatic=false关联current memory.batch queue，保四门live1→2及全部真实transport/独审/Ask尾；EXECb7c7d154/tree15fa通过真实current epoch/restoration/task和scope终局后再取全owner cursor baseline，终局失败保诊断，不冒L06恢复成功；两者均soleparent695。LIFE confirmed patch91e8f15e换actual图片intake和精确probe task成功/checked后enable，整尾逐字保；Ask e29f7bca仅Promise timerimport、原实际1500ms与所有断言不变；File d36fe6a7只helper改current GET/api/export并加强version3/deployment/owner/ctype，三case body不变。Root仅SOURCE_APPROVE_FOR_FOCUSED，首失败/未达tail均保持，不作runtime绿。

LIFE authority候选也仅测试模型前置：current Actions ordinary-note先actions.understand，实际声明modelFeature memory/严格五semantic字段；原fixture仅chat选择/旧actions[]。Root核准确695原source后准同generated profile显式memory与完整空products stub供focused，原重登/旧grant/未来工作/真实model turn尾不变，无新production fallback或用户设置政策；M05将任意ScopeError标grant_revoked的广义诊断未修，不能把旧字样当真实撤权证明。MEM原owner正准备录音连续batch的committed/succeeded、真实两HTTP、不同draft/review run与独审receipt/专用冻结配方/完整原文强证明，未准仅查batch存在。原EXEC唯一合成writer同时仅修dev测试reader有界busy_timeout=5000，具体持锁writer未观察，不冒flaky；保持真实launcher/password/stop/guards与原180s总timeout。

交付父链已一次固定：在原自有all-new-source-temp物理树继续695，实际merge Config683→8217221c与EXECb7→8ab45506（零冲突），保accepted两个child及全部shipping祖先；reader独立commit1a792dbc。其余精确外部patch按来源/patchSHA/resultblob逐个独立commit，等最后MEM新patch后冻结同一candidate，再统一有限type/wholefiles/消费者。此为下一准确临时收敛候选，正式业务汇总未释放；未来汇总须保这组accepted ancestry，不测试临时副本后无绑定移植，也不把695整12模块灌单modulePR。实际新增delta义务核对，精确最终full与独立实际产品验收仍不豁免。

## 最终验收与持续记录

逐项矩阵的全部预期均是验收要求，不是通过声明。以生成资料从真实账户登录、生产 HTTP/应用启动、客户端持久队列/WorkManager、UI 与重启顺序验证；原算法 fixture 只作对照。每项包含同 ID 双用户负例、相关撤权/删除/取消/迟到结果；高风险持续积压与组合状态不能只做单分支测试。真实模型/供应商、物理设备、系统权限、前台焦点和部署分别记录，未做就保持未验，不采集真实个人截图。

历史首阶段当时仅管理文档；WEB与DESKTOP已报冻结候选，尚无独立验收、正式模块集成或最终完整检查。D2前置单commit单独登记，不视为模块验收。文档检查记录在[矩阵末尾](../validation/multiuser-parity-restoration-matrix.md#首阶段文档核查)，后续用真实候选证据逐项更新。
