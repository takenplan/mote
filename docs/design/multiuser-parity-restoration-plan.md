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
| MEM / MEM-M01..M08 | [MEM开发](codex://threads/01a14e8f-6977-7fa3-8145-0b3696ae413c) | `codex/parity-memory-20261018` / — | [独立验收](codex://threads/01a14e90-04ae-70c0-92a5-3f2a24a3bf0c) | `1c9be37b5e46e706bcf9715ea00cce052b3e9810` | CANDIDATE；已推/clean，Q006 fixture-only修复8项作者PASS；新整13步UNRUN，旧72f FAIL保留 |
| FILE / FILE-01..06；FILE-07旧缺陷观察 | [FILE开发](codex://threads/01a14e8f-6b10-7001-b7d6-84ba844a5604) | `codex/parity-files-20261018` / — | [独立验收](codex://threads/01a14e90-04ae-70c0-92a5-3f2a24a3bf0c) | `f4618a5a213fa7b832b1a56d6e77055f2113c602`（HOLD） | IN_PROGRESS；图片/媒体实现已推，global cursor公开投影修复待新head；FILE-07非阻塞 |
| ASK / ASK-A01..A05 | [ASK开发](codex://threads/01a14e8f-6d35-77d1-ad5f-531013c4ea08) | `codex/parity-ask-20261018` / — | [独立验收](codex://threads/01a14e90-04ae-70c0-92a5-3f2a24a3bf0c) | `e23c06a3f3ea30a5d844fbadb76de0475b17246b` | CANDIDATE；clean/core+allowQueryImages已冻，Q005完整gate/独验UNRUN |
| CONN / CONN-C01..C07 | [CONN开发](codex://threads/01a14e8f-6edd-7772-b552-f0ce79bb7c61) | `codex/parity-connectors-20261018` / — | [独立验收](codex://threads/01a14e90-06cd-7242-96bb-349e5fdb83b3) | `4fe01f477df6f564cd4c977c79efbe979e73e1d3` | CHANGES_REQUIRED；4fe旧gate已停止/已清理，active owner可写修F01-F05 |
| EXEC / EXEC-X01..X03、EXEC-S01 | [EXEC开发](codex://threads/01a14e8f-7094-7af3-880a-8580a9135ea1) | `codex/parity-execution-20261018` / — | [独立验收](codex://threads/01a14e90-06cd-7242-96bb-349e5fdb83b3) | `1e9ec7ab253cbb25bd21f14f3aee9ea19bbb96d2` | CANDIDATE；clean且冻结定向25项/类型作者PASS；Q009整14步RUNNING，独验UNRUN |
| CONFIG / CONFIG-C01..C07、CONFIG-UX01 | [CONFIG开发](codex://threads/01a14e8f-7295-7c62-9d1d-d6f9a3e6a59e) | `codex/parity-configuration-20261018` / — | [独立验收](codex://threads/01a14e90-06cd-7242-96bb-349e5fdb83b3) | `79bf961020782661c701cb0d3af47d1e5f48a0e3`（历史冻结） | IN_PROGRESS；PM已恢复真实Files/LIFE/Ask消费者，新head/组合待冻；旧79bf不直接开gate |
| DESKTOP / DESKTOP-D1..D4 | [DESKTOP开发](codex://threads/01a14e8f-745e-7330-8770-aed83a43077f) | `codex/parity-desktop-20261018` / — | [独立验收](codex://threads/01a14e90-08cc-7631-b1bb-fe8b691c3e27) | `73c1115287fe07e1824526861ebc2e8ed3cf39fc` | CANDIDATE；affected/独验UNRUN，待槽 |
| AND / AND-01..04、AND-D01 | [AND开发](codex://threads/01a14e8f-7620-73f0-8c0b-032e94f1a3e3) | `codex/parity-android-20261018` / — | [独立验收](codex://threads/01a14e90-08cc-7631-b1bb-fe8b691c3e27) | `2622844e3b226f3ebae9542bdb16aafedc5cf3a7` | CANDIDATE；clean，D01已实现待新冻结门禁/原生；未push/PR/独验 |
| WEB / WEB-W01..W02 | [WEB开发](codex://threads/01a14e8f-77d9-7723-8762-9bb7b456da4d) | `codex/parity-web-20261018` / [Draft #170](https://github.com/utopiafar/mote/pull/170) | [独立验收](codex://threads/01a14e90-08cc-7631-b1bb-fe8b691c3e27) | `f8f684b6dee904d820b9952ead336da5a33f330f` | READY；Q002+正式R006 W01/W02 PASS，PM已审确认；未释放合入 |
| EXT / EXT-E01..E03、EXT-ES01/ES02/EC01 | [EXT开发](codex://threads/01a14e8f-79dc-70b3-8d6c-608e696cb79d) | `codex/parity-extensions-20261018` / — | [独立验收](codex://threads/01a14e90-08cc-7631-b1bb-fe8b691c3e27) | `d4683421faf2ce22be8d42c25eb385fa8a0b6aa1` | CANDIDATE；scope修复已冻，旧d347 gateFAIL；新整轮UNRUN |
| ACTION / ACTION-A01..A04 | [ACTION开发](codex://threads/01a14e8f-7b96-7d00-9b68-d9d30aea97dd) | `codex/parity-actions-20261018` / — | [独立验收](codex://threads/01a14e90-04ae-70c0-92a5-3f2a24a3bf0c) | `42b57dee735467362239cab27dbc923a93cfe7a1` | CANDIDATE；clean且作者定向回执已报，Q012完整gate/独验UNRUN |
| LIFE / LIFE-L01..L06 | [LIFE开发](codex://threads/01a14e8f-7dc6-7fb3-a058-cb39df965cb9) | `codex/parity-lifecycle-20261018` / — | [独立验收](codex://threads/01a14e90-06cd-7242-96bb-349e5fdb83b3) | `c0bf80d6f884c0cde15ab40bfff6cc9c8197b962` | CANDIDATE；已推/clean，Q004完整gate及独验UNRUN |

建议依赖顺序不构成新范围：先修用户控制/凭据/数据生命周期，再补持续推进与完整产物，随后恢复发现/配置/UI，最后收敛结构及恢复未知项。重点接缝为 FILE→ASK/MEM、CONN→FILE/MEM、EXEC→所有 Operation 消费者与 MEM 发布、CONFIG→所有模型入口、ACTION→Android 日历、LIFE→各域。共享文件修改由 PM 明确 owner；冲突由涉及 owner 复核。

## 共享文件与联调归属（本轮通信目录）

下表记录owner协商/PM分派，不授权覆盖他人改动；给消费者的接口须精确commit，无SHA时仅为拟定。

| 接缝 / 文件 | 主责 / 消费者 | 当前约定与未验 |
| --- | --- | --- |
| `scope/processing.ts`、`memory-capture-materials.ts`、`processing-files.ts`、`processing-imports.ts` | FILE / MEM、ASK、LIFE、AND | FILE恢复origin/方案/视图/目录导入，并负责原生CentralLibrary reference/历史详情必要Kotlin消费者；扩大list保持policy preview完整形状及执行head fence。具体片段先协调。 |
| `scope/ingress.ts` begin / GC容量 | DESKTOP / LIFE、AND | DESKTOP修D2 begin，LIFE修GC/容量；双方互认片段。AND半传/丢ACK跨24h在producer精确SHA复验，不改wire。 |
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
- 依赖准备最多2个安装/native窗口；已运行者不强停，完成回报释放。各工作树独立固定lock安装，不共享node_modules/dist软链；记录Node/ABI，native和测试同runtime。Server/Mem0实际SQLite分别probe，Electron按所选计划补齐；准备完成不是业务验收。
- 模块向本 chat 报名：owner/工作树、PR base ref 与解析 SHA、冻结 HEAD SHA、是否有未提交输入、dry-run 完整选择结果、拟执行命令/环境/预计资源、定向前置和日志位置。批准排期只协调主机资源，不代替 PM 产品/集成释放。
- 本 chat 按报名编号串行释放耗资源检查；同时只允许一个已释放的驱动。运行期间冻结对应输入，隔离生成 profile、临时目录、端口和模拟器 serial。普通聚焦测试也须避免共享端口/文件/设备冲突，不另开完整组合套件。
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
| Q007 | DESKTOP / `73c1115287fe07e1824526861ebc2e8ed3cf39fc` / 起点2c78ca8d | Desktop+Server+Web；Android=false，D2另跨端联调 | WAIT_GLOBAL_SLOT；作者83项及29+1/类型/预检报告通过 | `/tmp/mote-parity-desktop-affected-plan-final.json`；完整gate/独验UNRUN |
| R002 | CONN / C07 Kotlin/helper/JVM/instrumentation | 专用`dev.mote.collector.RecordingParityInstrumentedTest`；生成scoped后端smoke作者报告通过 | WAIT_INPUT_AND_SLOT；Gradle/emulator UNRUN | 精确完整输入/SHA与环境待回报，无当前运行授权 |
| R003 / Q008 | CONFIG / 79bf历史；真实consumer修订中 | PM放行现有Config消费Files接续修复head/LIFE c0bf/Ask e23；新head后重选范围 | WAIT_NEW_FREEZE_AND_COMBINATION；完整gate/Gradle/emulator无并行窗 | hidden browser真实startup/角色/草稿/历史确认/storage/实际图片联调请求已登记G007；native变体/四方法仍待 |
| R006 | 独立客户端验收 / PR#170 exact f8 | 私有依赖/构建、窄12项、真实main双用户browser77.096s、13入口11.086s、30012ms设备刷新/31s卸载无读、6图真实场景 | DONE_PASS并已释放；PM确认Web范围READY | JSON SHA256 4cb7d378cf69b135e06ff5161f4d8936a95560da5ff5929d8a4ca83f6f6e199b；跨EXEC/新域组合仍UNRUN |
| P009 / R004 | FILE / 后续环境与native消费者 | Electron补当前lock执行文件；既有JAVA_HOME；JVM+FilesCatalogParityInstrumentedTest无窗口 | WAIT_INPUT_AND_GLOBAL_SLOT；未授权运行 | Java现有`/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`，SDK`/Users/utopiafar/Library/Android/sdk`；不视为需要新装JDK |
| Q001 | FILE / f4618a5a（parent67b，base2c78）待接续修复 | driver核pushed/clean及实际22步all6TS+Android/root；plan `/tmp/mote-parity-files-driver-f4618a5a-plan.txt` | HOLD_WAIT_NEW_HEAD；global SQLite cursor/watermark须所有public progress投影移除，不开f461 gate | 原完整image/media实现与定向结果只绑定其输入；后续精确冻结/回归/环境/native待验 |
| Q004 | LIFE / `c0bf80d6f884c0cde15ab40bfff6cc9c8197b962`，base2c78ca8d | 已推/clean；handoff/check-plan/delivery同lifecycle-candidate-c0bf80d6目录；22步 | WAIT_SERIAL_CHECK；不插队打断当前gate | Node26 ABI147及两处SQLite复验作者PASS；Android/emitted Desktop/Docker/Hindsight/physical/live UNRUN |
| Q006 | MEM / `72f0e55ba26d54f9a3d66fa6e5a8deb706e4371a` | 8前置/构建PASS；Server3160PASS/1FAIL/2skip；后4步UNRUN，elapsed1298.654s | FAILED/REPAIR_RELEASED；runId d5a6098d-6db1-4f99-991c-f4e735dd4fce；cleanupConfirmed/clean/锁释放 | query-import-context:71 actual importing≠completed；同SHA窄测2PASS不抵消失败，原因待定；>2联合UNRUN |
| Q003 | EXT修复 `d4683421faf2ce22be8d42c25eb385fa8a0b6aa1`，parent d347 | 旧d347整轮FAIL+19UNRUN保留；新CLI/受限pure负例12项、生产lifecycle/备份4项作者EXIT0 | WAIT_SERIAL_RETRY；新整22步UNRUN，未push/PR | canonical checks表7列/owner备份准入已补，不改L06；与LIFE schema hunk待内容去重复核 |
| Q005 | ASK / `e23c06a3f3ea30a5d844fbadb76de0475b17246b` | all6TS+Android/i18n/tooling22项；/tmp/mote-ask-final-check-plan.json | WAIT_SERIAL_CHECK | 精准前置已接；完整gate/独验UNRUN |
| Q009 | EXEC / `1e9ec7ab253cbb25bd21f14f3aee9ea19bbb96d2`，base2c78ca8d | driver核clean/固定head、实际14步计划与环境；Node26 ABI147/JDK21，GRADLE_OPTS workers1 | RUNNING；runId67404cc8-6f3e-4fac-8410-c06ca7193d94，19:59:19（Asia/Shanghai） | `/tmp/mote-parity-execution-driver-1e9ec7ab.log`；完整gate未结束，独验/Memory组合UNRUN |
| Q010 / R005 | AND / `2622844e3b226f3ebae9542bdb16aafedc5cf3a7`，base2c78ca8d | android/i18n，workspaces=[]；environment/i18n/release/shared build+test/release integration/android-unit；frozen plan`/tmp/mote-parity-android-plan-frozen.json` | WAIT_GLOBAL_SLOT；完整gate+multiuserFixture APK/testAPK+API37无窗口serial5580待授权 | 请求Gradle1worker，门禁入口实际参数待driver核对；D2与Ask组合另排，无重资源进程存活 |
| Q011 | CONN / 4fe01f47旧候选 | Java25环境修正轮及Java21过时候选停止轮分别保存；不得拼PASS | STOPPED_CHANGES_REQUIRED，PM释放owner修复F01-F05；R002暂缓 | Java21 receipt d287d97c原cleanup=false/EPERM保留；后验13PID与PGID3095均消失，核owner后只清残留锁，可写入已通知 |
| Q012 | ACTION / `42b57dee735467362239cab27dbc923a93cfe7a1`，base2c78ca8d | all6 TS+Android（必要scoped-backup-schema），check-plan.txt/candidate.json同证据目录 | WAIT_SERIAL_CHECK；未push/PR | Node26 ABI147/native/Electron已报ready；准确各输入定向PASS不替代完整gate |
| Q002-CHECK-RESERVATION | WEB | driver代跑已PASS，重资源锁释放 | 已消费完成；后续owner发布按全局槽 | 不自动独验或合入 |

同一已冻结输入可在一个批准资源窗口按顺序做原生旅程与完整affected，但完整driver保留全部选中步骤，不能跨轮缓存或拼接定向PASS；Gradle实际UP-TO-DATE/skip与真实执行分开记录。任一步后改代码/输入，重新冻结、重选范围并复验受影响结论。

## 全局对话槽位与待办（用户最新约束）

后续同时执行对话目标5、上限6，PM和driver也计入。当前已运行任务继续，不中断/取消；现有子代理继续完成，完成后不补位。不再创建chat或spawn子代理，不因FYI唤醒idle/notLoaded的开发或验收chat。重启须先由PM/driver检查总active并登记槽位，超额存续自然收敛，不新增占用。等待检查/前置/验收的模块留下精确待办后结束回合，不空转。

2026-10-18 20:07:03（Asia/Shanghai）只读快照5 active：PM/driver/Config/Conn/Files，Memory修复1c已交付并结束。Q009独占完整gate；PM随后预留下一槽给领域组只读Memory预审（无运行/安装），自己结束后回目标5；不得同时再释放其它新worker。所有重窗继续串行。随后只读Memory预审已消费该槽，PM结束；最新快照回到5 active（driver/Config/Conn/Files/领域预审），未新建chat。

| 槽位对象 | 快照状态 | 当前工作 / 释放条件 |
| --- | --- | --- |
| PM / driver | idle / active | PM已放行只读Memory预审后结束；Q009仍唯一完整gate |
| Files / Connectors / Configuration | 3 active | Files public进度隔离修复；Conn阶段修复；Config接真实producer，均无并行重资源窗 |
| MEM / ASK / LIFE / AND / ACTION / EXEC / DESKTOP / WEB / EXT | 9 idle/notLoaded | Memory新1c已交付并结束；driver按PM授权代跑冻结gate，不为FYI恢复owner |
| 领域组只读预审 / 其余三独验 | 1 active / 3 idle/notLoaded | PM授权exact1c Memory旧新流程只读，不安装/运行，不作动态PASS；完成报告即结束 |

| 待办号 | 待通知/执行对象 | 具体条件与范围 | 当前状态 |
| --- | --- | --- | --- |
| G001 | WEB PR#170 | Q002及R006已PASS，PM确认此冻结范围READY；PR body已记录独验与视觉证据闭合 | DONE_MODULE_READY；等全体闭合/PM一次释放，跨域UNRUN |
| G002 | CONN native C07 | 精确Kotlin/helper/JVM/instrumentation候选就绪，R001后单独资源窗，槽位允许；原backup固定true不增toggle | WAIT_CANDIDATE |
| G003 | AND D2及Ask组合 | D2前置`5744d6a832117a9f9aec7affd37453ab15d455cf`（含早期1417及part/commit upload_expired补充），Android与Ask消费者精确SHA待冻；仅临时组合，非PR夹带/正式合入 | WAIT_DEPENDENCY |
| G004 | 四独立验收chat | 排队传达已决L06/D01、精确PR/head/base/依赖与新消费者清单，闲置不唤醒；一次一项 | WAIT_GLOBAL_SLOT |
| G005 | 所有完整affected请求 | Q001 FILE/Q003 EXT/Q004 LIFE/Q005 ASK/Q006 MEM及后续EXEC/ACTION/DESKTOP/CONFIG；最终dry-run+clean SHA齐备，资源/全局槽双重满足 | Q009当前运行，其余WAIT_CANDIDATE_OR_SLOT |
| G006 | Memory Q006修复 / 新1c9be37b | fixture-only观察route实际admitted promise；红559b受控1500ms复现旧1秒假设，新1c并发4三文件8PASS；原终态/三次Ask/fence断言保留，无产品timeout变更 | QUEUED_FULL_RETRY；新整13步UNRUN，owner已结束，旧72f FAIL不抵消 |
| G007 | Config实际consumer组合 | Config新head + Files隐藏public cursor后新head + LIFE c0bf + Ask e23；真实startup/cookie/browser/生成artifactTransport/角色403与实际图片，记录必要hunk/tree | REQUEST_REGISTERED；PM放行工程，完整组合重窗另排，不改正式integration |

已决政策立即适用于活跃owner；未运行验证仍UNRUN。任何新产品分歧仍送PM，政策已答项不再重复提问。

LIFE-L04已由PM明确：恢复原当前完整导出直接响应下载；删除中央永久完整副本/下载历史这一替代旅程，仅保留内部单引擎进度、无内容回执及必要暂存。完成/失败/取消/断流/重启按原清理与重试，不新增latest-only、TTL、次数政策或额外步骤，不操作真实历史副本。控制/最终验收通知排G004。

## 已确认首启动与账号偏好边界

AND-D01已由PM进一步明确：旧全局隐私/采集/同步值无可信owner快照，不能猜给当前登录账号、不能回填；保留旧私有值，不自动复制或删除。没有本人稳定deployment/account快照时使用既有CollectorConfig默认，运行采集停止、本人预览未确认。之后保存/恢复按账号，A→B→A恢复参数但换号运行态仍停止，snapshot.enabled不自动开采集。

系统权限、SAF、device/debug、容量和外观仍设备级；设备SAF grant不能当另一账号source授权。origin不是主要身份。生成回归覆盖首启动、同账号重登、URL和凭据变更、同deployment/account换URL、A→B→A、旧Worker/迟到响应以及SAF持久授权与账号source授权分离；不做旧格式迁移。客户端组/最终组通知继续排G004，当前不唤醒。

## 待发送给正式验收的更新摘要

不因FYI唤醒idle；G004有槽且有精确PR/head/base再交下述摘要。当前客户端chat仅只读Web diff预审，未PR/gate完整回执前不作完整独验PASS、不跑浏览器或完整check。

- L06：用户选重新登录后按原开关继续未来任务；旧credentials/leases/grants退休，已完成外部操作不重复，unknown外部写先对账。不是逐域重开，也不复活旧执行权。
- D01：偏好按稳定deployment/account独立；旧全局无owner不猜/不复制/不删，缺本人快照用既有CollectorConfig默认且采集停止/本人预览未确认。换号恢复参数不自动运行；OS/SAF/device/debug/容量/外观设备级但SAF不等于另一账号source授权。
- FILE-PERCEPTION：完整原image auto/profile、外部OCR、allowQueryImages、按日期/来源complete/recompute preview-confirm；instance MediaAssets/MEDIA_CATALOG、OCR-ASR健康/真实安装恢复admin与scoped消费者。FILE领域、CONFIG专用Web/Kotlin、ASK权限消费；不能仅DTO/伪ready，无自动真实大模型下载/开关/历史重跑。
- 录音backupAudio旧native隐藏固定true、shared literal(true) KEEP，不新增关闭开关；验独立备份状态/回听/显式处理及C07 metadata/各phase/error/nextRetry。备份不自动ASR，显式处理和普通音频原自动行为保留。
- L04：当前完整导出直接响应下载，中央永久完整副本/下载历史移除；必要暂存按完成/失败/取消/断流/重启与原重试处理。无latest-only/TTL/次数政策或额外下载步骤；不操作真实历史副本。
- 实际运行证据：Q002仅Web模块required affected门禁由driver实跑9/9通过；不是独验/原生/最终集成。原Operation family、增量刷新、Work父子进度和设备30秒刷新互不替代；D2最新5744d6a跨端组合仍另验。

## 最终验收与持续记录

逐项矩阵的全部预期均是验收要求，不是通过声明。以生成资料从真实账户登录、生产 HTTP/应用启动、客户端持久队列/WorkManager、UI 与重启顺序验证；原算法 fixture 只作对照。每项包含同 ID 双用户负例、相关撤权/删除/取消/迟到结果；高风险持续积压与组合状态不能只做单分支测试。真实模型/供应商、物理设备、系统权限、前台焦点和部署分别记录，未做就保持未验，不采集真实个人截图。

首阶段仅管理文档；WEB与DESKTOP已报冻结候选，尚无独立验收、正式模块集成或最终完整检查。D2前置单commit单独登记，不视为模块验收。文档检查记录在[矩阵末尾](../validation/multiuser-parity-restoration-matrix.md#首阶段文档核查)，后续用真实候选证据逐项更新。
