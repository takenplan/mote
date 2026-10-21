# Memory 评估时间与中性程序：实施和验证记录

原审计日期：2026-10-20。状态更新：2026-10-21（Asia/Shanghai）。当前状态：独立分支候选；I1/I2 及局部 fixture 修正已经适用预审、实施和复核，冻结候选 `c9b6c116` 的完整门禁 **PASS**：14 项计划均成功，13 项本轮执行、1 项 Agent 测试按精确输入复用。尚未合入或部署。录音首次媒体等候的负载相关失败观察仍未闭合，没有放宽其时间或断言。

## 基线与范围

- 修复前已拉取 `origin/main`，确认基线为 `bcff7bab6109a7c99acde3decb5712a072e1b045`，包含 PR 194；该提交没有修复 U1/U2。实施期间再次拉取，main 未变化。
- 文档整理独立提交 `35348520cdfa72d4c64825b93f911e4869c70133`，见 [PR 202](https://github.com/utopiafar/mote/pull/202)。本修复分支没有把文档分支当作运行源码基线。
- 运行源码由 `memory_adr_audit` 唯一实施；root 为唯一完整检查 driver。独立审查人 `memory_plan_reviewer` 使用 Sol High。
- 首次收敛的运行源码：13 个已跟踪文件的 `git diff -- apps/server/src packages/agent/src` SHA-256 为 `0bb8c5271ea356cc5b02e6421e32e77a2542550331c0a0704f1efa8f092f61ac`；新增 `scope/memory-evaluation-context.ts` SHA-256 为 `2143a0a20ed7716e6e507df0684df1b218d3afa560b483dac5bbb9e5a423ddf9`。这是工作树来源标识，不能冒充合入提交。
- I1 闭合后的候选：14 个已跟踪运行源码文件的同命令 SHA-256 为 `632330eb843cf5532e6290166f0d823678628221a4d57bac9415552df9a36878`，新增 helper 的哈希不变。增加的 Agent 文件仅声明内部可选类型字段。
- 冻结提交 `4925a706d3baeced085230eeea9533676ab6fa30`。提交后逐一核对先前的 14 个运行源码文件、原测试差异、新 helper 和五个新测试文件，均与实际验证身份相同；原测试差异 SHA-256 为 `9c16f0d9554b64065f98ff951ebaa2222568df1147e4f5eb12dd9f7bb37df712`。
- I2 Activity 增量提交 `a73a8e3aa0cd454098bb8a89d847e71d780ac23c`；相对其父 `4925a706` 的运行差异及三处源码/测试文件逐一核对，与实际定向输入身份相同。该提交是重新执行完整门禁的冻结候选。
- fixture 清理增量提交 `936b5c232fd5b8a2a9349e68851b5283916f7d06`，运行代码与 `a73a8e3a` 逐字相同，仅增加局部测试清理修正及审查回执；测试文件与差异身份核对通过。该提交是后续新执行完整门禁的冻结候选。
- 阅读器 fixture 增量提交 `c9b6c116bdb03caf860c272e1a0efdd486d2b9cb`，运行代码仍与 `a73a8e3a` 逐字相同；只修正手工构造的当前任务字段及其负例映射，附局部增量批准和验证回执。其测试文件身份核对通过，作为最新门禁冻结候选。

## 实施前审查

完整审查过程见[独立方案审查回执](memory-evaluation-context-plan-review-2026-10-20.md)：

| 方案 | 封存 SHA-256 | 决定与边界 |
| --- | --- | --- |
| [v1 原字节](../design/memory-evaluation-context-restoration-v1-2026-10-20.md) | `1bce8b3dac51e49bce37f6e64f2256f0a0b9c5354cf15eaf0df283909989415e` | `CHANGES_REQUIRED`：缺少 processor-plugin 的可信原件传递。没有据此开始实施。 |
| [v2 主方案](../design/memory-evaluation-context-restoration-2026-10-20.md) | `4e85b9497a90dd95e3efe741baceeb025b3896bcf8f0432db4fffa0f60e08bef` | 实施前 `APPROVE`；覆盖所有发布入口、时钟和消费者。原文保留封存时的 pending 字样，当前批准以回执为准。 |
| `semantic-clock-wrapper-v1` | 精确增量文字在回执中 | 实施前 `APPROVE`；只增加内部构造 options 类型传递，不改 HTTP 或授权时钟。 |
| [feedback-catalog-v2](../design/memory-evaluation-context-feedback-catalog-delta-2026-10-20.md) | `7031685fff490f38f2eebf75cb065309cc7dcefab113292620443f9bb598a096` | 边界实施前 `APPROVE`；按现行 ADR 恢复同配方、同固定策略的目录与历史过滤，不扩大正文读取范围。 |
| [legacy-metadata-v1](../design/memory-evaluation-context-legacy-metadata-v1-2026-10-20.md) | `8c3798e3cc2abf960ac0f8b4480f0f50f011ebc357c996ab1002e571a32d0fc1` | 实施前 `APPROVE`；为合法无 `workContract` 配方补独立描述时间元数据，保留原候选、覆盖及合法空结果的审核合同。 |
| [legacy-metadata-v2](../design/memory-evaluation-context-legacy-metadata-v2-2026-10-20.md) | `14a1344e4562c32db92dd17f23961a1fcc7703cddd5f53893e7bacee98a4fbc5` | 实施前 `APPROVE`；只在 Agent 的内部宿主输入类型中声明可选描述字段，没有改变运行期 schema、HTTP 或工具权限。 |
| [legacy-metadata-v3](../design/memory-evaluation-context-legacy-metadata-delta-2026-10-20.md) | `14749414da47f8c09314d667c3f71d981c744d1e00d5651e2ba97176d2dedefa` | 实施前 `APPROVE`；描述已冻结只读目录各区间的评估时间，覆盖按需补读，Coding 仍按实际范围窄化。没有增加读取许可或正文元数据。 |
| [Activity I2 增量](../design/memory-evaluation-context-activity-delta-2026-10-20.md) | `e99096236f92c2d5ce9daef3bd6d6dd05ab55495be171fda4012ec01f9798180` | 实施前 `APPROVE`，绑定 base `bcff7bab` / head `4925a706`；Activity 从现有 batch metadata 读取精确逐输入时间以匹配四元成员键，保留原 rank、原件计量、权限和所有旧断言，不回退旧键或补时钟。 |
| [阅读器 fixture 局部增量](../design/memory-evaluation-context-reader-fixture-delta-2026-10-20.md) | `3613458eeb9339a7655ff9afb7201bd33525e917d235a6c75259fbf2430f8980` | 编辑前明确 `APPROVE`，绑定 head `936b5c23` 及原文件哈希；属于既定 schema 内的构造修正，补五个原 pin 的固定钟并同步 unknown UUID，保留所有原断言、规模、计数和时限。 |

反馈开发中曾临时合并跨配方 read carriers 并得到局部 PASS；该实现已撤回，PASS 不计为交付证据，也没有被追认为实施前批准。最终方案依据 [context-reading ADR](../adr-memory-context-reading.md) 和 [scoped Memory 设计](../design/multiuser-memory.md) 的同任务、同配方合同。

[实施源码审查](memory-evaluation-context-implementation-review-2026-10-20.md) 对首次收敛候选提出 I1：合法无 `workContract` 的配方在混合自动包和跨批按需补读中缺少逐输入时间描述。补充方案先获批准，再实施并验证。独立审查人核对源码、实际断言和明确标注的 owner 执行转录后关闭 I1。后续完整门禁又发现 Activity 消费者遗漏 I2，另按实施前增量审查处理；I1 的闭合不代替 I2 验证。源码审查没有被计为审查人亲自执行的测试或合入证据。

## 候选行为

U1：宿主在手工首次准入、原件首次接收及自动整合窗口正式选入时保存评估时间。混合自动包保留每个输入自己的时间，模型调用使用本次首个目标的时间，Coding 理解使用本会话首个目标。反馈、Owner 续评、独审和关系发布继承相应快照。来源 `contextTime`、事件时间和目录校验继续保留原语义。

U2：固定提取策略及独审使用现有 `memory-strategy`，固定整合及独审使用 `memory-integration`。理解、Owner 回答解释和删除比较保持各自无语义 Skill 的合同；原生引擎生成与 Mote 独审分别记录。旧 Skill 文件没有被删除或全局改写。

合法无 `workContract` 配方通过独立 `memoryEvaluation` 描述目标、已供上下文和原有只读目录的评估时间；这不启用范围覆盖要求。原有非空独审与合法空结果的审核收据行为均保留。Coding 按实际会话范围窄化描述并绑定生成身份。

Processing 与 organizer 通过内部同步回调传递已验证的原件身份；不从插件 payload 猜测生产者。派生 Material 按实际发布 pin 与证据关系绑定收据。部分选块的 Owner 续评只映射原授权块。反馈读取目录保留精确配方和策略绑定。

没有新增公开时间覆盖、权限、候选限额、等待策略、保留规则、旧任务迁移或历史自动重跑。自动队列等待门槛的另一项静态候选不属于本修复。

## 验证状态

首次两条真实 HTTP → 已注册模型适配器 → 序列化 provider envelope 回归在旧运行代码上均为 RED（来源日期充当 now、旧通用 Skill 被加载），修复后 2/2 GREEN。依赖尚无 dist 的加载失败、日期字符串格式或 fixture 配置误用不计产品 RED。

在 `4925a706` 对应源码重新执行定向矩阵：**58/58 PASS**，0 fail/skip/cancel，212.138 秒；Agent 两个消费者文件 **23/23 PASS**，0 fail/skip/cancel，0.536 秒。没有把先前 35 个邻域检查的 107.16 秒 PASS 沿用为本轮证据。后续 I2 增量改变 Activity 消费者，其定向结果及完整门禁另列，不将这些既有执行改写为在 I2 新源码上重新运行。

| ID | 实际进入的状态与主要断言 | 实际回归入口 |
| --- | --- | --- |
| E1 | 两配方 × 两批、8 次 provider HTTP；旧来源日期、跨语义午夜、并发同请求共用一次时钟/模型、不同请求 409、重启无重放 | [手工及自动时间](../../apps/server/test/scoped-memory-evaluation-context.test.ts) |
| E2 | 不同接收时间经延迟 M06 仍同包；各输入及首目标时间正确；重复 ACK 不续时、拒收不在恢复后重新授权 | [手工及自动时间](../../apps/server/test/scoped-memory-evaluation-context.test.ts) |
| E2P | 安装、检查、启用、快照和实际插件调用；outer 无原件字段仍正确传递；foreign/错 artifact/同任务换原件回滚；organizer 两配方；图片父链和精确去重；真实 held stop/撤权/删除不产生 Memory intake/job | [发布者](../../apps/server/test/scoped-memory-evaluation-publishers.test.ts)、[held 插件负例](../../apps/server/test/multiuser-processing-05.test.ts) |
| E3 | 真实 waiting 后控制持久调度到期；双域/有界后继继承根时间，前驱 failed/paused 不阻断；重试/重启不取新钟，新窗口独立取钟 | [整合时间](../../apps/server/test/scoped-memory-evaluation-integration.test.ts)、[后继窗口](../../apps/server/test/multiuser-memory-integration-domains.test.ts) |
| E4 | 两 Coding 会话与普通输入各取实际 scope 首目标时间；理解无 Skill；incomplete 重试跨时间推进；候选复用及其 policy/work/model/range/time 身份失配 | [Coding 准备](../../apps/server/test/multiuser-memory-coding-preparation.test.ts)；各身份差异的失配为定向身份层断言，未逐项复制 HTTP 旅程 |
| E5 | 同策略真实 planner tool-loop 到 child；异配方目录不借读、缺口和成功兄弟保留；child admission 前真实 SIGKILL，恢复只跑未完成 child，保留持久 proposal 和时间 | [反馈](../../apps/server/test/multiuser-memory-08.test.ts)、[进程死亡](../../apps/server/test/multiuser-memory-process.test.ts)、[续任务边界](../../apps/server/test/scoped-memory-evaluation-continuations.test.ts) |
| E6 | 部分 evidencePins 的真实 question/reply/resolved；只映射原授权块，新声明 ID 继承旧时间；回答解释另用真实 currentTime/无 Skill；重复回答与重启无重放 | [续任务边界](../../apps/server/test/scoped-memory-evaluation-continuations.test.ts)；unknown/defer 保留原邻域，未另造镜像 |
| E7 | personal/daily/custom/Coding/integration 中性程序；自定义 review marker 保留；六种 repair/失败状态保持冻结时间；native fixture 与 Mote 独审分开；删除比较无 Skill | [review 修复](../../apps/server/test/multiuser-memory.test.ts)、[native](../../apps/server/test/scoped-memory-native-admission.test.ts)及以上实际 provider envelope |
| E8 | 默认 supersededAt 与显式 validFrom、独审收据和版本历史；held review 期间真实 owner correction 改变目标版本，晚到整合不部分保存、不生成问题、重启不重发 | [整合及竞争发布](../../apps/server/test/scoped-memory-evaluation-integration.test.ts)；原直接取消/撤权/unknown-publication 由完整套件覆盖，不计为本 58 项的新增镜像 |
| E9 | extract/review unknown issued 不隐式重发；成功查询检查点在 domain save 前中断后精确复用；缺快照不补时钟、不重发，已保存 canonical Memory 仍可读 | [调用检查点](../../apps/server/test/scoped-memory-issued-query.test.ts)、[缺快照](../../apps/server/test/scoped-memory-evaluation-context.test.ts) |
| E10 | 九种真实 catalog fence；来源时间不被评估时间替换；额外/缺失/冲突映射、公开伪造拒绝；A/B 归属、未读正文与不同语义时间的压缩引用边界 | [catalog](../../apps/server/test/scoped-memory-catalog-parity.test.ts)、[Agent wire](../../packages/agent/test/wire-context.test.mjs)、[上下文](../../packages/agent/test/task-context.test.mjs)，保留 4097/257 规模 |
| I1 | 合法 @2/@3/@4 同包逐输入时间及旧输出；empty 保留一次调用；legacy 提取/独审实际补读 B 保留 B 时间、C 被拒绝，8 HTTP/4 次成功 query issuance；Coding 描述按 scope 窄化 | [合法无 workContract 配方](../../apps/server/test/scoped-memory-evaluation-legacy.test.ts)、[Coding](../../apps/server/test/multiuser-memory-coding-preparation.test.ts) |
| I2 | 不同接收时间经实际延迟 M06 汇入同包，提取/独审后 attention 与 detail 均为两原件、一完成一需补充；时钟不公开，B detail 404，重启不重发；原完整主人追问所有旧断言保留并通过 | [Activity 逐输入键](../../apps/server/test/scoped-memory-evaluation-activity.test.ts)、[完整主人追问](../../apps/server/test/multiuser-memory-07.test.ts)；实际执行阶段单列如下 |

最终定向命令（源码已冻结；正则只选择本轮矩阵，不冒充全 Server 套件）：

```sh
set -o pipefail
node --import tsx --test --test-concurrency=1 \
  --test-name-pattern='E[0-9]|I1:|manual production|pinned scoped|real account-scoped Coding|incomplete Coding|a late Coding|incomplete-context understanding|two short Coding|candidate reuse|MEM-M02: scoped catalog|MEM-M02: frozen catalog|issued Memory|successful Memory|structured rejected-before-execution|in-session output repair|each native|a new extraction of the same original|scoped review restores|real Memory feedback|an independent consolidation continuation|a true M09|SIGKILL during feedback' \
  apps/server/test/scoped-memory-evaluation-context.test.ts \
  apps/server/test/scoped-memory-evaluation-publishers.test.ts \
  apps/server/test/scoped-memory-evaluation-continuations.test.ts \
  apps/server/test/scoped-memory-evaluation-integration.test.ts \
  apps/server/test/scoped-memory-evaluation-legacy.test.ts \
  apps/server/test/multiuser-memory-coding-preparation.test.ts \
  apps/server/test/scoped-memory-catalog-parity.test.ts \
  apps/server/test/scoped-memory-issued-query.test.ts \
  apps/server/test/scoped-memory-native-admission.test.ts \
  apps/server/test/multiuser-memory.test.ts \
  apps/server/test/multiuser-memory-08.test.ts \
  apps/server/test/multiuser-memory-integration-domains.test.ts \
  apps/server/test/multiuser-processing-05.test.ts \
  apps/server/test/multiuser-memory-process.test.ts \
  2>&1 | tee /tmp/mote-memory-final-focused-2026-10-20.log

node --test --test-concurrency=1 \
  packages/agent/test/task-context.test.mjs \
  packages/agent/test/wire-context.test.mjs \
  2>&1 | tee /tmp/mote-memory-final-agent-2026-10-20.log
```

原始日志 SHA-256 分别为 `9b4538dfd7bc487822aa9eea07c198dae9b6f3b6908da09f52e137e859f55095`、`0f704c60fcab93bc79460a4fc2018c8b56bf4d576a9366862e1fcb840eaacbf5`。两个进程正常 exit 0；fixture 的 `t.after` await app/provider 关闭和临时目录删除，held gates 释放。进程死亡用例实际断言首进程 SIGKILL、次进程 code 0；没有以额外全局进程扫描冒充此清理范围。

完整门禁已在 `4925a706` 启动：

```sh
npm run check:affected -- --base bcff7bab6109a7c99acde3decb5712a072e1b045
```

计划为 Agent、Server、Web、shared 契约及 environment/i18n/scope/release/central-runner；这是新执行，没有指定 `--reuse`。首次运行在 Server 全套发现 I2：`multiuser-memory-07.test.ts` 的原完整 Owner 追问旅程在 `assert.ok(work)` 失败。独立单项诊断同样失败，0/1 PASS，4.261 秒；日志为 `/tmp/mote-memory-owner-reply-diagnostic-20261020.log`。此前记忆成功兄弟、`awaiting_context`、一个主人问题和 B 用户不可读断言已通过；尚未进入回答续评部分，不能称作回答模型失败。

实施者与独立审查人分别静态确认：`memory-data.ts` 的成员键包含固定评估时间，但 `activity.ts` 仍按原三元键匹配覆盖回执，因此需要补充的原件被错误投影为等待，进度页 attention 筛选没有该卡片。这是本候选遗漏的实际消费者，原断言保留。I2 的有界方案批准、实施及新检查结果另记，不能用先前 E6 定向 PASS 代替这个完整消费者。

root 于 15:19 UTC 中断已知失败的旧候选门禁，exit 130；原始日志 `/tmp/mote-memory-check-affected-20261020.log`、原始收据 `2026-10-20T15-01-09-380Z-a3086386-e77f-48e8-b171-05a3dfab57e4.json` 保留。driver 收据状态为 `interrupted`，因清理 EPERM 记录 `cleanupConfirmed: false` 并保留锁。root 随后通过进程元数据确认原 driver/child PID 3096、16434、16461、16462 及其拥有的 PGID 16434 均不存在，才释放自身精确 owner 的锁，另存 `/tmp/mote-memory-initial-driver-cleanup-20261020.json`；没有回写原收据，也不复用此次 PASS。修复 I2 后重新执行完整门禁。

### I2 增量的 RED 与定向验证

新两原件回归先在 `4925a706` 未改运行源码上执行，真实 RED：0/1 PASS，4.698 秒，exit 1，失败为 attention 页没有 Memory 卡。不同接收钟、实际延迟 M06、混合任务、一个主人问题及两次真实模型 HTTP 均已断言通过，未将 setup 错误计为产品 RED。日志 `/tmp/mote-memory-activity-red-20261020.log`。

批准后三处实际改动仅为 `activity.ts` 的逐输入四元键匹配、原 `multiuser-memory-07` 增加详情页和 B 用户断言，以及一个新 Activity 回归。原用例断言没有删改。以下第一个正则漏选了原文件最后的 explicit-import 用例，因此顺序补跑第二条；合计 17 项 PASS，原 `-07` 全部 11 项均已实际执行，不能称为单次完整文件执行。

```sh
set -o pipefail
node --import tsx --test --test-concurrency=1 \
  --test-name-pattern='I2:|Memory evidence navigation|Memory pages and cursor|concurrent independent extractions|automatic integration uses its own immutable|visual Memory cannot|cancelling a job during a genuine|binding drains a persisted|reviewed Memory question|generic owner question dependency|scoped Activity deduplicates|empty-body Memory input|real production Memory extraction|explicit owner correction' \
  apps/server/test/multiuser-memory-07.test.ts \
  apps/server/test/scoped-memory-evaluation-activity.test.ts \
  apps/server/test/multiuser-memory-06.test.ts \
  apps/server/test/multiuser-memory-08.test.ts \
  2>&1 | tee /tmp/mote-memory-activity-green-20261020.log

node --import tsx --test --test-concurrency=1 \
  --test-name-pattern='explicit import prose follows fresh M03 originals' \
  apps/server/test/multiuser-memory-07.test.ts \
  2>&1 | tee /tmp/mote-memory-activity-neighbor-import-20261020.log
```

两轮分别 16/16 PASS、50.329 秒与 1/1 PASS、5.522 秒，均 exit 0，0 fail/skip/cancel。I2 相对 `4925a706` 的运行差异 SHA-256 `e4b0291c85fa0780dc7d3833dae05b75e6fb406a1accee572475f77818e7f88b`；相对 `bcff7bab` 的完整运行差异（包含已提交的新 helper）为 `8c078baaac996ab7cd02566c2e24a7dee7c40491f84c459527ce43294670b980`。新增测试文件 SHA-256 `0b8bb23b26c4a781ad2f1a577f7e07a4090f22c9f634e1610d907c48acc60c24`，其他精确输入与日志哈希保存在 `/tmp/mote-memory-activity-final-identity-20261020.json`。

三次测试进程均已退出；fixture `t.after` 释放 held gates、await app/provider 关闭并删除临时目录。没有额外全局进程扫描或持久 host 清理声明。独立审查人核对实际差异、原始 tee 日志和上述哈希后关闭 I2；这是 owner 执行、reviewer 只读核对。GREEN 后运行源码和测试冻结。

### 新候选完整门禁

root 在 `a73a8e3aa0cd454098bb8a89d847e71d780ac23c` 全新执行相同 `check:affected --base bcff7bab6109a7c99acde3decb5712a072e1b045`，不使用 `--reuse`。日志 `/tmp/mote-memory-final-check-affected-20261020.log`。该轮出现另一个文件级失败：`execution-continuation.test.ts` 的所有业务用例均显示通过，但首用例 `after` 在用例结束后抛出异步 `write EPIPE`。这是清理钩子的失败，不能删掉后按该文件 PASS 记。

root 于 15:32 UTC 结束该已知失败候选门禁，exit 130。原始收据 `2026-10-20T15-26-59-242Z-af5e47d2-9a95-48fe-981a-3d9b79f14700.json` 保留 `interrupted` 和 driver 清理 EPERM 的 `cleanupConfirmed: false`，不复用。root 按提前保存的本轮 12 个拥有进程及 PGID 46315 确认均已消失后，才释放自身精确 owner 的锁；补充证据 `/tmp/mote-memory-second-driver-cleanup-20261020.json`，未改原始收据。

### 执行器 fixture 局部清理增量

独立审查将 `execution-continuation-publisher-child-close-v1` 归类为既定设计内保持断言含义的局部生命周期修正，记录增量和 focused 验证即可；仍在编辑前明确 `APPROVE`，绑定 base `bcff7bab` / head `a73a8e3a` 及唯一测试文件原 SHA-256 `b1893c84cf29ad4f752e0cb916db1126696c7cd90a4bff0690dd9ce96b375534`。详见方案审查回执的该增量原文。

该 fixture 原先收到三个 `done` 事件后即结束正文；此时 `exitCode` 可能尚未设置，`after` 又对仍 connected 的 child 发送 `release` 并立即 SIGKILL，没有等待关闭，形成 IPC 写入竞争。局部修正只为 launch 注册 close promises；成功路径在三个 done 后 await 正常关闭并新增 code 0/signal null 断言；失败清理仅终止尚未退出的自身 child，await 全部 close 后再关闭数据库和删除目录，不再发送额外 IPC。保留三真进程、所有业务断言、实际入口、输入规模和原 30 秒时限，没有吞掉 EPIPE 或修改运行代码。

root 新执行完整该测试文件：

```sh
node --import tsx --test --test-concurrency=1 \
  apps/server/test/execution-continuation.test.ts \
  > /tmp/mote-memory-execution-fixture-cleanup-20261020.log 2>&1
```

**18/18 PASS**，0 fail/skip/cancel，4.401 秒，exit 0；三个实际 host 正常关闭断言通过，fixture 等待自身 children 后再删除资源。测试文件新 SHA-256 `aa6fc6cf4647f731d7dfd773938808d43302fbdc08eee487465f4350bbab2108`，差异 SHA-256 `904f9c96969580d39288094c00be4c08110ecb4bcd0b10757fcc3ce4a1ed9898`，原始日志 SHA-256 `50c12a7b8984a9ebcffca6db0fa1a361433eb8e3902b671a6a4a5f3d14bbaaf2`。身份另存 `/tmp/mote-memory-execution-fixture-cleanup-identity-20261020.json`。

### `936b5c23` 完整门禁

root 对 `936b5c232fd5b8a2a9349e68851b5283916f7d06` 新执行相同完整 `check:affected` 命令，未使用 `--reuse`，日志 `/tmp/mote-memory-delivery-check-affected-20261020.log`。该轮正常结束，exit 1：Server **3730 tests、3703 pass、18 fail、9 skip**，1280.005 秒。原始收据 `2026-10-20T15-33-54-685Z-9a944997-a6aa-418f-ba29-2f1f3d627d27.json` 为 `failed` / `cleanupConfirmed: true`，未报告输入变化，driver 正常释放锁。Agent 为 328 pass / 1 原有 opt-in skip；Web、shared、release-integration 和 central-runner 尚未执行。

18 个失败中，17 个来自 `scoped-memory-reader-batch.test.ts:15` 的同一手工 fixture 缺必需 `evaluationContext`，在 schema parse 时即失败，未进入原授权、SQL 计数或发布断言；它们不是新增运行故障的证据。另一个为录音首次媒体等待，详见下方未闭合观察。该轮不能记为完整 PASS。

### 阅读器 fixture 局部增量

按上表封存的局部增量先获确认，随后只编辑原测试文件两处构造：为五个现有 target/read pins 指定同一固定生成钟；unknown-required-evidence 负例只替换原 tail 的 map ID，沿用同一钟，继续触发原 `not_found` guard。没有改运行代码、schema、共享 helper、所有断言、2/5 输入规模、重复/optional 顺序、异常身份、SQL mapping/version 计数、live authorization、超时或成功条件。

```sh
set -o pipefail
node --import tsx --test --test-concurrency=1 \
  apps/server/test/scoped-memory-reader-batch.test.ts \
  2>&1 | tee /tmp/mote-memory-reader-batch-focused-20261020.log
```

原完整文件 **17/17 PASS**，0 fail/skip/cancel，9.757 秒，exit 0；原 `t.after` 的零模型调用断言及 app/provider await 关闭、临时目录删除均完成。测试文件 SHA-256 `680d162513490fa3f858ce2f4e50ed283961b270e3cd75dc44792f19ea3637fc`，相对 `936b5c23` 的差异 SHA-256 `39fdeb36c8d13cd58a4f4be499f475aa63ee32969929a28fe75126f886fe5d00`，原日志 SHA-256 `ed36c835717af92f56532b24fc8cc7e9da7135be51e2385e426cf90b4e9f6bd7`。独立审查人只读核对实际差异、原日志及身份后记录局部完成；没有将其称为审查人执行、Server 全套或录音通过。

### 录音首次媒体等候：未闭合观察

`multiuser-recording-phase-parity.test.ts` 的 `one slow first audio backup…` 在上述 loaded 全套，以及与全套并行的原单项诊断中，均因原 6 秒 `First audio must be physically held` 等待失败；尚未进入后续三份转写/三份 canonical Material 断言。原单项诊断日志 `/tmp/mote-memory-recording-phase-diagnostic-20261020.log`。不能称为已复现转写被音频阻塞。

全套结束后，未改代码的当前原完整用例 1/1 PASS，case 4.737 秒；隔离 `bcff7bab` main 原完整用例也 1/1 PASS，case 5.118 秒。后者复用同一主机安装依赖与不变的 shared/Agent JavaScript，只作为有界基线比较，不是独立环境或完整 main 验收。外部只读状态探针另实际进入过 `mediaEntered`（一次观察为 1.742 秒），但没有继续原完整用例，因此不计入该用例 PASS。最早外部 `.ts` 的 ESM/CJS 加载失败也未计为产品 RED。日志分别保留在 `/tmp/mote-recording-current-idle-20261020.log`、`/tmp/mote-recording-main-baseline-20261020.log`、`/tmp/mote-recording-state-diagnostic-trace-20261020.log`。

静态链路核对未发现本次 Memory clock 位于首次 media 物理调用前的依赖；这不等于排除了运行期影响。现有证据不足以确定失败时是排队延迟还是未被调度，也不足以支持把原 6 秒放宽到 12 秒。独立审查建议保留原预算、真实后台入口和全部状态断言。录音文件与 fixture 均未改；后续门禁若进入原全部状态，可记该轮通过，同时保留此前失败及根因未闭合。若再次失败，需要在相同 loaded 状态采集 M05 队列、锁、后继、执行事件和单调时刻，再提有证据的最小增量；不靠多次 PASS 宣称原问题已修复。

后续 `c9b6c116` 的正式完整门禁实际通过原完整录音用例，case 9.523 秒，原 6 秒等待及三转写/三 canonical、分页、串行 media、真实保持 gate 的全部断言未改。这是该轮 PASS，不是根因闭合。外部只读 observer 仅跟随本 driver 的目标 worker 及 `lsof` 已打开的 12 个生成库；172 次短只读快照中 110 成功、62 因其自身只读连接遇锁失败。它未发 HTTP/tick/信号、未读取正文或凭证、未改仓库、计时或断言，目标 worker 退出后自然结束且关闭连接。摘要 `/tmp/mote-recording-loaded-observer-20261021-summary.md`。该粗粒度观察有读取空洞，不能给出精确私有 gate 进入时刻或解释先前失败；遇锁也不是产品根因证据，不计为产品测试。

### `c9b6c116` 完整门禁

```sh
npm run check:affected -- \
  --base bcff7bab6109a7c99acde3decb5712a072e1b045 \
  --reuse /Users/utopiafar/Documents/Projects/mote/.git/mote-check-receipts/2026-10-20T15-33-54-685Z-9a944997-a6aa-418f-ba29-2f1f3d627d27.json
```

root 为唯一 driver，冻结 `c9b6c116bdb03caf860c272e1a0efdd486d2b9cb`，日志 `/tmp/mote-memory-checked-delivery-20261021.log`。该命令显式请驱动匹配原回执，不能将复用改称本轮新执行。完整计划 **14/14 成功**，exit 0；13 项新执行，Agent 测试按完整输入匹配复用自 run `9a944997-a6aa-418f-ba29-2f1f3d627d27` 的 `test:@mote/agent`，其原执行任务耗时 31.776 秒，输入身份 `ef892914ea32606427ec93147984acb93600c781ba85ad0669f99b5753b9b4dd`。没有复用原失败 Server 或原未执行任务。

| 任务 | 本轮状态 | driver 耗时 | 结果 |
| --- | --- | --- | --- |
| environment / i18n / scope-contracts / release-contracts | 4 项新执行 PASS | 2.251 / 1.193 / 2.103 / 7.277 秒 | release 工具回归 110/110 |
| shared / Agent / Server / Web build | 4 项新执行 PASS | 1.806 / 1.395 / 6.377 / 5.238 秒 | 构建通过 |
| Agent tests | 1 项 REUSED | 本轮 0 秒；原执行 31.776 秒 | 原 328 pass / 1 opt-in skip；完整输入、定义、环境与原 passed 任务回执匹配 |
| Server tests | 新执行 PASS | 1303.739 秒 | 3721 pass / 9 既有条件 skip，0 fail/cancel |
| Web tests | 新执行 PASS | 112.244 秒 | 619/619，0 skip/fail/cancel |
| shared tests | 新执行 PASS | 0.981 秒 | 198/198，0 skip/fail/cancel |
| release-integration | 新执行 PASS | 13.888 秒 | 37/37，0 skip/fail/cancel |
| central-runner | 新执行 PASS | 2.229 秒 | 两次 noisy restart、每次 60000 stdout 行及 2300000 stderr bytes 的监督/保留/错误边界通过 |

原始 driver 收据 `2026-10-20T16-01-08-361Z-73f833df-5571-4ded-9844-8a2666800a21.json`，run ID `73f833df-5571-4ded-9844-8a2666800a21`；UTC 16:01:08.361–16:25:39.382，整体 1471.011 秒。收据为 `passed`、exit 0、`cleanupConfirmed: true`，没有输入变化，所属锁已释放。完整输入身份 `2c1ea169f00f079ce6623d00f32d210ce3622a5f6e7f1a6f2a1b0996afa3588d`，收据 SHA-256 `c9139661652134caa71842958eba71310c7b3ec228c1a377dcaa75a7f0f72d3b`，原始日志 SHA-256 `5aec1d45d78b4d889ce687ab4399d9cb6e650615548d984876d5f3cdb5656bd6`。之后只补充普通验证文档及 PR 元数据，运行源码、测试和依赖保持冻结；文档提交不重标本门禁为新执行。

Server 本轮为 **3730 tests、3721 pass、0 fail/cancel、9 skip**，测试原生日志 1302.775 秒、driver 任务耗时 1303.739 秒。原录音、I2 Activity 以及阅读器的原全部用例均实际通过。九个 Server skip 均为既有 Python/OS sandbox 条件入口：七个固定 Source Pack 附件/导入场景、一个 pinned Python Source Pack 私有导入、一个 macOS sandbox 文件/网络拒绝场景；本轮未启用对应 opt-in 环境，不能记为通过。复用的 Agent 记录为 328 pass / 1 skip，skip 为未指定 `MOTE_TEST_CODEX_BIN` 的实际已安装 Codex 场景。新加入及定向验证的本轮 Memory 场景未新增 skip。

默认六文件并发的 Server 性能报告观察 583 份文件 summary，23 文件超过 60 秒软预算、24 case 超过 30 秒提醒。没有放宽既有 timeout、隐藏提醒、缩小输入或删断言。受本修复扩展且超过文件预算的 `multiuser-memory-process.test.ts` 为 89.75 秒，包含真实双 host SIGKILL 后的独审/准入/反馈恢复；反馈和独审 case 分别 38.83/35.54 秒，保留实际进程死亡、执行租约恢复、A/B 成功检查点不重发和未知结果边界。`multiuser-memory-integration-domains.test.ts` 为 66.06 秒，保留双域独审失败/重启、有界后继、failed/paused 前驱与到期推进的实际后台旅程。此处记录保留这些必要状态和真实入口的原因，超额仍作为性能债可见，不将检查通过称为性能优化；其他原慢场景与全部耗时在原始报告中保留。

## 证据边界

测试使用生成文本、图片、插件和 loopback 脚本 provider。Fastify inject 的 HTTP 路由覆盖与模型侧真实 loopback HTTP 发送分别按实际入口说明。整合 due 用例先进入真实 waiting，再控制持久窗口和调度到期状态；不推进全局 Date、执行租约或授权时钟，也不声称真实等待一小时。

未进行真实付费模型、真实 Hindsight 服务、物理设备、个人截图、发布或部署验证。fixture 证明调用合同、状态和权限边界，不证明语义质量改善。修复尚未进入 main，不能称为已在主线或用户安装版本交付。
