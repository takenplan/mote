# 公共隔离合同：共享测试清单与有边界复审

本记录配合 [公共合同与推广规范](../design/multiuser-public-contracts.md)。复审只验证
指定公共接缝，不重做九模块业务，也不替代 M07/M08/M11 最终验收。旧记录、PR 描述和
同伴通过声明列为线索；本轮独立运行另列，不能混成同一组合的通过结论。

## 精确版本与隔离环境

2026-10-16 通过 GitHub PR 元数据独立核验，以下均为 OPEN、Draft、未合并，
base 为 `codex/mote-multiuser-integration` 的
`6272a9b51ec92cc4c32e2ff1a1eeb4fa38b142ed`。
只读 `git ls-remote` 同时确认 main 与 integration 仍是此 SHA。

| 模块 / PR | 远端 head |
| --- | --- |
| M00 [#126](https://github.com/utopiafar/mote/pull/126) | `5031b754915d3fbba0dbe0c050b6d103a02966ef` |
| M01 [#127](https://github.com/utopiafar/mote/pull/127) | `443726d2a95ef55db9466d06aa44ea1061ca56e4` |
| M02 [#128](https://github.com/utopiafar/mote/pull/128) | `8ecccb8ecf0093cc655fadd8bbc5e1637220f9fd` |
| M04 [#129](https://github.com/utopiafar/mote/pull/129) | `bc5323e1b5ee337c20dee58d4a8e9c25bc2adbbf` |
| M05 [#130](https://github.com/utopiafar/mote/pull/130) | `7f72e9040872dbbb351f3c9a22afa6f069aa59c8` |
| M03 [#131](https://github.com/utopiafar/mote/pull/131) | `b1f6700a7e68b60318b7b05f631a47d12fd93c24` |
| M09 [#132](https://github.com/utopiafar/mote/pull/132) | `cdc5c34c36fc5743049007ee2c76d705fde3dd7f` |
| M06 [#133](https://github.com/utopiafar/mote/pull/133) | `470516b7ed4ab7ee8b0fba344883c6b42bb7ce56` |
| M10 [#134](https://github.com/utopiafar/mote/pull/134) | `7572b573b03437ff743652c13181b9fdcf251fda` |

独立文档分支 `codex/mote-multiuser-public-review` 从完整 PR134 建立于交接所指本机的
`task-15/mote-review`；本轮 `hostname` 实际返回 `guangmodeMac-Studio`，不以 `bogon`
称呼推断机器标识。M07/M08/M11 仅以精确 Git 对象归档到自有 `/tmp/mote-public-review-*`。
依赖复制为自有副本，workspace symlink 指向各归档自身 packages；所需 libraries 在本方
构建。没有修改同伴 source/DB/deps、main、integration、真实资料或运行部署。

| 消费接缝 | 复审对象与版本限制 |
| --- | --- |
| M07 Coding/ACK | RED `1d88bddf8a372e20a3c56bd1cc962e6fcae7ae78`；GREEN `46a6c993fa6c14e5d154e01138cb346e77d13d29`。不是最终 M07。 |
| M07 retained-v1 最小关闭样本 | `f436d7e8e3e78dcda4509731038d64183c5dcee4`；owning-module RED tests 为 `55fd7b332b999042aaf359bc31084cef94d38830` / `7dba36ca3067c903b7fb1f70538336c60a0f5a75`。本轮只独立运行 old-host→fixed-host 当前投影 probe，不外推全部历史/restore/性能。 |
| M08 reader/周期候选 | `6855d85b18cf8329da4d9ec32b3aafa55cb0b4d8`；其周期 runtime 为 `1fe83c78d62bc7a7f0c9ba92c162c226164bb2f1`，Memory recordPins 增量为 `22ab04fb2eda42c3ba2b1ef498bcea323c46a142`。本轮不重跑一分钟周期全套。 |
| M08 后续 Snapshot 增量 | `b84240f554fe2c549eb9142cc00089eea1a84e88`，parent RED `c3e8932a8d71f4fd1167a6f7e27690a88d42ce7d`，本轮独立 2/2。后续 `745e38817e01fcc5e22a80390bb65c762e96333b` 的暂停来源元数据、`4a18aff95cff214d78ad901589c41b2a12a7a742` 的 research child 不接收父 Snapshot 补充只读过 runtime 差异，未运行这些对象。与 6855 分开记录。 |
| 暂停 M11 | `6de98afe6f740fc090b85a106620e0f04474720c`；内部组合 M07 `443c201a9159d77120d990a1b2d888cb2015d139`、M08 `73244e11f4625f3c1e0674b1f8629d8295c05b76` 及 PR134。不包含上述最新 M07/M08，不唤醒其执行对话。 |

## 三条代表链的验收合同

| 链 | 已有可复用覆盖 | 尚需在最终同一组合关闭的缺口 |
| --- | --- | --- |
| A 采集→处理→Memory | M03 HTTP/原件、M06 正式 producer/Material、M07 自动抽取与独立 review；同 ID A/B、原始字节、来源依赖、配置快照、取消/幂等。46 修复鲜输入 Coding 及共享 ACK；f436 的当前旧投影重启退出样本本轮通过。 | 修复前已经发布的错误投影还须在历史/restore 与最终所有 query-visible/传递下游保持撤下；不能仅升级 cache。合法 multipart 对话、正常文本/邮件/图像仍通过。MCP/Ask 消费最终 Coding 投影需在统一组合复跑。 |
| B Memory→Ask→MCP | 真实 M07 provider、M08 reader/Harness、M11 HTTP SDK；完整来源过滤、精确历史 key、首次 pin、artifact、context/history/limit、原文引用及撤权。 | 各局部 freeze 不同；最终组合必须含最新 M07/M08/M11，并重跑正常能力、同 ID/有限来源、await 失效与所有 adapter 出口。InsightSnapshot 是旧能力迁移对照的一部分。 |
| C 准入→暂停/撤销→SIGKILL | M05 原 owner/checkpoint；M06 实际 SIGKILL/自然租期恢复；M07/M08 的成功子任务不重放；领域 pause、stop、unknown journal 与 B 正常运行。 | 缺少一个将真实领域运行中外部调用、撤销、SIGKILL、unknown/no replay 和物理退休串起来的完整代表证据。waiting 后 kill、graceful restart、seeded journal、人工过期租期各自不能替代它。 |

每条链至少包括：正常结果；相同 source/device/external/revision/operation/batch/字节的
A/B；同用户有限授权来源及传递依赖；跨 await；事务失败回滚/幂等；旧能力对照。
每个拒绝场景有 B 与下一次合法请求的正例，避免通过关闭整个 producer/reader 得到阴性。

## 共享 fixture 的最小提取边界

继续使用仓库现有 `node:test`。不增加 runner、测试模式权限开关或 mock Memory/Ask/DB。

| 现有夹具 / setup | 适用范围与复用方式 |
| --- | --- |
| `apps/server/test/fixtures/two-users.ts` | 身份、scope 和仓储单元测试。它注入 verifier；production app 在此模式不安装真实 TaskExecution，不能作为三条代表链的 host。 |
| `multiuser-ingress.test.ts` / `multiuser-processing.test.ts` 的 `fixture` | 真实 Accounts 初始化、邀请 A/B、登录、protocol headers、request、临时目录与 cleanup。是共享生产 host setup 的首批两个消费者。 |
| `multiuser-plugins.test.ts` / `multiuser-connectors.test.ts` 的 `fixture` | 同样的真实 host setup，加外部 adapter transport。保留每个领域的业务正例和断言。 |
| 后续 `fixtures/mcp.ts`、`mcp-memory.ts`、`ask-reader-host.ts`、`ask-reader-memory.ts` | 已有真实 host、provider release、barrier、restart 和外部模型 transport。统一基线后只提取重复 setup；SDK 与业务数据构造保留各自 adapter。 |
| `fixtures/scoped-plugin-release.ts`、`scoped-memory-release.ts` | 真正生成包并经正式 installer/worker/RPC；复用真实 worker barrier，不把邻域服务换成 mock。 |
| 各 `multiuser-*-process.test.ts` | 子进程入口、listener、restart/SIGKILL、超时清理。每项声明实际杀点、是否自然租期、成功 checkpoint 及外部 issued 状态。 |

共享 setup 只负责 buildApp、真实账号/request、external transport 注入、gate、等待、
重启和可靠清理。owner 不能由测试请求自由选择；测试直接 DB 观察只读，故障注入单独标识。
业务服务、内部 task handler、模型 service 和 executor 不作为可替换的 mock 参数。
已有同步 hook/typed host 扩展可用于单元契约，但不能冒充完整生产链。

### 每个契约测试的模板

以下是编写/评审模板，不是已执行的通用 helper。按场景填写适用项，不适用时说明原因；
只读契约不要求人为引入 task/FTS 写或进程恢复：

| 字段 | 必须填写的内容 |
| --- | --- |
| 能力 / characterization | 旧用户结果、旧入口/算法、KEEP/CHANGE；至少一个正常结果和完整尾部/分页/history/context 等相关边界。 |
| 精确对象 | production commit、test commit、全部依赖 freeze、实际源码或 emitted 入口。 |
| 冲突输入 | A/B 共用哪些 ID/字节；另一个同用户未授权 source；期待分别存在的结果。 |
| 生产路径 | HTTP/SDK/worker→真实 host/SQLite/executor→正式 published/ready 状态。 |
| 屏障 | hold 哪个真实外部 transport/provider/worker await；由什么 entered/checkpoint 证明确已到达。 |
| 状态改变 | logout / cancel / pause / stop / credential / account / source recreate / parent delete / config change，逐项保留语义。 |
| 最终断言 | 全结果、整页/早期项、provider keys/实际模型输入、引用和 artifact；不能只断言末项或 error code。 |
| 原子性 | 外层 catch 后成功提交；内部 task/grant/operation/resource/fairness/FTS/receipt/通知均无残留。 |
| 恢复 | 真实 kill 点、原 lease/model/task/input、成功单元与 usage 不重放、unknown 不自动重试；B 字节/状态不变。 |
| 证据 | 命令、Node/ABI、真实结果数量、exit、duration、log、hash；失败分类及未跑项。 |

等待具体 producer、正式 ACK、持久 checkpoint 或 terminal 状态，用有界 deadline + 当前状态
诊断；不以固定 sleep 作为完成证据，也不将长期 policy waiting 算成 producer 未完成。
相同字节/ID 的重建需保存原 receipt，证明旧上下文拒绝而新 canonical 正例仍可读。

### 测试层次与 TDD 证据

1. 旧纯算法/legacy fixture 做 characterization，保留业务语义；不得声明新用户隔离。
2. 公共 primitive 契约覆盖 provenance、范围、事务、cursor 和 exact receipt。
3. 真实领域接缝覆盖 before-LIMIT、await、publication/ACK、模型输入和恢复。
4. 三条代表链在同一冻结组合运行，之后执行消费者、fresh build/emitted process 与
   仓库必需的 `check:affected`。原生、物理设备、真实外部服务和部署单列。

新缺陷保存 `production parent → RED test commit → minimal fix → same scenario GREEN`。
记录失败来自哪个原断言；修 fixture 时解释过时假设并保留原负例与新的合法正例。
若错误测试根本没进入生产路径，不算有效 RED。既有开发只有可核对的失败先行证据才
描述为 TDD；本规范不追认历史开发过程。当前文档-only PR 按 AGENTS 的文档检查规则，
不重复运行完整应用/Android 构建；本轮契约复跑是独立 review 证据。

## 旧能力→入口→具体测试→证据边界

下列文件相对 `apps/server/test/`。完整 test 名保留，可用 `--test-name-pattern` 定向运行。
“已有”表示冻结源中存在；只有下一节明确列出的项目是本轮独立执行。

| 旧能力 / 新生产入口 | 具体 test | 证据边界 |
| --- | --- | --- |
| 原件接收与同 ID 幂等；Ingress HTTP | `multiuser-ingress.test.ts`: `real ingress binds equal device, UUID, batch and bytes to credentials; request selectors cannot change ownership` | 真实 Accounts/SQLite/original；receipt 只证明接收。 |
| 原始字节、分片、丢 ACK 下载；upload/content | `multiuser-ingress-process.test.ts`: `real server startup, account-bound intake, lost ACK restart and authenticated original download use the production listener` | 实际 listener；正常重启用 SIGTERM，不能写成 SIGKILL。 |
| 正确 Coding 对话；原件→正式处理 | `coding-append.test.ts`: `the Coding conversation projection excludes tool bodies and host envelopes from catalog, reads and evidence`；46 的 `multiuser-ingress.test.ts`: `actual M03 Coding archives project only complete declared dialogue through M06 and Memory organizers for equal A/B identities` | 前者 legacy 算法对照；后者真实 producer，含 multipart、人类/agent-final 正例、tool/envelope 阴性与原字节保留。本轮原红绿复跑。 |
| SourceItem 和普通 JSON 不混淆；ProcessingHost | `multiuser-processing.test.ts`: `M03 source-item originals and uploaded JSON files retain their distinct trusted formats through the real processor` | 普通 message 正例，不代表全部 Coding role/parts。 |
| saved/processed/indexed；Ingress→M05/M06 | `multiuser-processing.test.ts`: `real M03 intake automatically admits a durable pipeline while its receipt still attests only reception` | 接到 Material/FTS；indexed 不表示 Memory 完成。 |
| 长正文与原 decoder；connector→M06 | `multiuser-connectors.test.ts`: `real M06 automatic pipeline decodes Gmail MIME originals for A/B in snapshot and archive without indexing provider JSON or losing long bodies`；`real M06 automatic pipeline consumes actual Lark document bytes and long calendar SourceItem originals into scoped Material after restart` | 正式原格式、长尾部、A/B、restart；九模块基线还没有 Memory 消费。 |
| Memory 自动抽取、独立 review；M06 hook→M07 | `multiuser-memory.test.ts`: `real M06 upload publication admits durable automatic Memory grants for equal user inputs` | M07 freeze 上真实完整下游，不可用基线 M06 的 synthetic consumer 代替。 |
| 有限来源 plugin；正式 worker/RPC | `multiuser-plugin-ingress.test.ts`: `real source plugin publication rejects same-user cross-source captures and transitive Materials before commit` | 真实生成包；主 source 与传递 source 均检查。 |
| 同步发布回滚；M06 hook→M05 | `multiuser-processing.test.ts`: `a failed Material hook rolls back Material, publication and downstream grant admission in the shared success transaction`；`caught nested admission failure rolls back every child row while the publishing Material transaction succeeds` | 本轮 PR134 实际复跑；保留外层成功和内部无残留。 |
| 下游 child 原子准入；M05 API | `multiuser-execution.test.ts`: `caught synchronous child admission failure leaves no authority or runnable work when the outer commit succeeds` | 本轮 PR134 实际复跑；已修问题，不列当前缺陷。 |
| logout 与 account epoch；后台 grant | `multiuser-execution.test.ts`: `Web logout keeps admitted background checkpoints and private commit alive, while disable and reset reject late publication` | 本轮 PR134 实际复跑；logout 不能替代撤权测试。 |
| pause 排空；plugin source RPC | `multiuser-plugin-ingress.test.ts`: `pause drains an already admitted real source RPC while blocking new admission without affecting B` | 真实 worker gate；保留与 stop 的差异。 |
| 成功 checkpoint；M05 真实 process | `multiuser-execution.test.ts`: `an actual killed host restores only the persisted owner and completed checkpoint in a replacement process` | 本轮复跑；测试人工将死租约设为 0，不证明自然过期。 |
| ASR 成功不重放；M06 process | `multiuser-processing-process.test.ts`: `actual process death and natural M05 lease recovery retain A/B ASR checkpoints, media snapshots and private Material publication` | 真 SIGKILL、自然租期；杀点在已完成 ASR 的 waiting 状态，不是外部 running unknown。 |
| OAuth unknown；connector callback | `multiuser-connectors.test.ts`: `an interrupted OAuth issuance survives restart as unknown and connector deletion cannot claim remote erasure` | cancel + 放行 held transport + graceful restart；不算真实 crash。 |
| 删除专用结算；connector lifecycle | `multiuser-connectors.test.ts`: `durable crashed-activity fixture requires a purpose-bound stopped observation before connector erasure and never settles B` | seeded journal；证明清算权限，不证明物理进程死亡。 |
| 秘密不落任务；connector operation/vault | `multiuser-connectors.test.ts`: `Lark configure encrypted task reference survives interrupted restart, isolates A/B and disconnect removes only A payloads`；`startup migrates earlier candidate raw operation inputs into encrypted references without dropping task history` | 全表秘密扫描/迁移历史对照，复用此保密合同而非只查一个 task input。 |
| 首次 pin 与同正文重建；真实 Ask reader | `multiuser-ask-read-races.test.ts`: `M08 reader preserves the first observed original through a later actual provider await and same-ID recreation`；`identical original text cannot revive a receipt after deletion and recreation during a real provider await` | 本轮 literal 6855 复跑；旧 receipt 拒绝与新 canonical 正例同时保留。 |
| artifact source/lifetime；Ask reader | `multiuser-ask-read-races.test.ts`: `owned artifact reads apply explicit query source filters to real run dependencies`；`an owned artifact deleted with its conversation cannot survive a later real provider await` | 本轮 literal 6855 复跑；另有 Memory await 不能掩盖 artifact 失效。 |
| context 最低预算/完整分页；Ask reader | `multiuser-ask-read-races.test.ts`: `minimum context budget pages real Memory and Material channels without losing references` | 本轮 literal 6855 复跑；不得降低完整性或关闭 Memory 取绿。 |
| Memory→真实 SDK；MCP 工具/resource | `multiuser-mcp-memory.test.ts`: `actual SDK Memory tools/resources read the real automatic MCP to M06 to independently reviewed M07 chain for A/B` | 真实 model transport 记录；精确 M11 旧组合的证据，不能外推最新组合。 |
| 资源撤权；MCP resource→provider | `multiuser-mcp-memory.test.ts`: `actual SDK memory resource carries credential revocation through a real provider await while the same URI remains private to B` | resource 与 tool 是不同出口，均需最终 fence。 |
| SDK 早期原件失效；MCP→Ask | `multiuser-mcp-query.test.ts`: `actual SDK read must reject a deleted earlier original when a later same-ID read follows a real Memory provider await` | SDK 层不省略 reader 最终检查。 |
| 外部 ACK 结算；原 worker publication | `plugin-control-journeys.test.ts`: `real worker migration cancelled after submission with an acknowledgement preserves the old binding and reconciles later source deletion after restart`；`real worker migration cancelled after submission with a lost acknowledgement preserves the old binding and reconciles later source deletion after restart` | 本轮 literal RED/GREEN；不能把取消 fence 放在已发生事实的持久结算之前。 |

## 本轮独立运行证据

所有运行均使用生成账号/字节/配置与临时目录。Node `24.21.0`；实际 production services、
SQLite、executor、Harness/SDK/worker 保留，只冻结外部 I/O。测试串行占用本任务槽位。
logs 位于执行机 `/tmp`，不把路径本身当作永久验收；以下命令可在相同对象复跑。

### 九模块基线：5/5

对象 `7572b573b03437ff743652c13181b9fdcf251fda`：

```sh
node --import tsx --test --test-concurrency=1 --test-timeout=120000 \
  --test-name-pattern='caught synchronous child|caught nested admission|failed Material hook|Web logout keeps|an actual killed host' \
  apps/server/test/multiuser-execution.test.ts apps/server/test/multiuser-processing.test.ts
```

5 pass、0 fail/cancel/skip，exit 0，4648.763125 ms。
`/tmp/mote-public-review-base-seams.log` 与 `.exit`。
先前一次选择了两个没有匹配 case 的文件，runner 把空文件计为成功测试；该日志
`mote-public-review-base-contract.log` 不计入这五项或任何契约通过数量。

### Coding / ACK：独立 RED → GREEN

RED 对象 `1d88bddf8a372e20a3c56bd1cc962e6fcae7ae78`，同一原测试：

```sh
node --import tsx --test --test-concurrency=1 --test-timeout=120000 \
  --test-name-pattern='source/Coding archive originals|actual M03 Coding archives|real worker migration cancelled after submission' \
  apps/server/test/multiuser-ingress.test.ts apps/server/test/plugin-control-journeys.test.ts
```

4 total、1 pass、3 fail，exit 1，12191.968833 ms；
`/tmp/mote-public-review-m07-red.log` 与 `.exit`。实际失败是：正式 producer 后 tool 搜索
命中 1；合法 human 正文丢失；迟到 ACK 未进入持久 journal。lost-ACK 变体通过。

GREEN 对象 `46a6c993fa6c14e5d154e01138cb346e77d13d29`，上式 pattern 再加
`|scoped raw coding groups`，文件再加 `apps/server/test/multiuser-memory.test.ts`：
5 pass、0 fail/cancel/skip，exit 0，8319.103292 ms；
`/tmp/mote-public-review-m07-green-loopback.log` 与 `.exit`。
此前沙箱原命令 4 pass/1 fail、exit 1，唯一失败是 raw-budget fixture 的 loopback
`listen EPERM`，保留 `mote-public-review-m07-green.log`；不是业务失败或 green。
允许本机 fixture 监听后完整原命令通过，没有放宽断言。

### M08 reader：7/7

对象 `6855d85b18cf8329da4d9ec32b3aafa55cb0b4d8`：

```sh
node --import tsx --test --test-concurrency=1 --test-timeout=120000 \
  apps/server/test/multiuser-ask-read-races.test.ts
```

7 pass、0 fail/cancel/skip，exit 0，23966.544417 ms；
`/tmp/mote-public-review-m08-read-races.log` 与 `.exit`。
含初次 pin、同正文重建、完整 context、before-provider filter/cursor、来源声明和
artifact 的 source/lifetime；日志明确 `leaked:false`。不是全 Ask/周期验收。

### 暂停 M11：5/5

对象 `6de98afe6f740fc090b85a106620e0f04474720c`：

```sh
node --import tsx --test --test-concurrency=1 --test-timeout=120000 \
  --test-name-pattern='actual SDK Memory tools/resources|actual SDK memory resource carries|outbound import status uses|outbound status rejects|actual SDK read must reject' \
  apps/server/test/multiuser-mcp.test.ts apps/server/test/multiuser-mcp-memory.test.ts \
  apps/server/test/multiuser-mcp-query.test.ts
```

5 pass、0 fail/cancel/skip，exit 0，22327.468792 ms；
`/tmp/mote-public-review-m11-seams.log` 与 `.exit`。包含实际自动 MCP→M03→M06→
独立 review Memory 的 A/B 正例、真实 resource 的 provider-await credential revoke、
Ask reader 早期原件删除重建，以及 outbound source status 的失败/重试/重启与配置退休。
这是当前暂停对象的新 status delta 的有界独立证据，不是全 M11 审批或最终组合。

### 旧 v1 已发布投影：46 的 RED 与 f436 的最小 GREEN

只调整同伴 probe 的两个 import 为本方冻结归档，脚本
`/tmp/mote-public-review-retained-v1.mts`：在 `1d88bddf` 的真实 app/账号/Ingress
创建 Coding tool_result，实际 tick 正式 producer，确认查询命中 1；关闭 app，保留
同一合成 SQLite/原件，再用精确 `46a6c993` 的 app 重启；同一查询仍命中 1。

```sh
node --import tsx /tmp/mote-public-review-retained-v1.mts
```

输出包含精确 old/restart SHA 和 `before:1,after:1`，随后在
`retained old projection remains visible after fixed host startup` 断言失败，exit 1。
`/tmp/mote-public-review-retained-v1.log` 与 `.exit`。本轮独立确认了仍未由 46 关闭的
缺口，不能被鲜输入 5/5 掩盖。脚本只用本方归档，finally 关闭 app 并清除生成目录。

随后仅把新宿主 import/报告的 restart SHA 改为
`f436d7e8e3e78dcda4509731038d64183c5dcee4` 的自有 literal archive，其他输入与断言
不变；`node --import tsx /tmp/mote-public-review-retained-v1-fixed.mts` 返回
`before:1,after:0`、exit 0，日志 `/tmp/mote-public-review-retained-v1-fixed.log/.exit`。
源码增量只复用既有 `PrivateData.hideMaterials`/`min_visible_sequence` 传递撤下、宿主
projection artifact marker、selected-version 与旧 processing artifact fence，未另建
授权/调度框架。本轮只关闭当前搜索样本；owning-module 的 7/7、23/23 是其独立账本，
不算本轮运行。历史目标、restore、retained reader、下游消费者及大目录 metadata 扫描
性能仍需其最终 gates；未在本轮证明最终组合或物理清除。

### M08 Snapshot 增量：2/2

对象 `b84240f554fe2c549eb9142cc00089eea1a84e88`：

```sh
node --import tsx --test --test-concurrency=1 --test-timeout=120000 \
  --test-name-pattern='scoped Insight preserves|real M07 Memory openings' \
  apps/server/test/multiuser-ask.test.ts
```

2 pass、0 fail/cancel/skip，exit 0，21621.07475 ms；
`/tmp/mote-public-review-m08-b842-snapshot.log` 与 `.exit`。验证真实 Memory→Ask/Insight
的原文引用，以及观察区间跨设备 union、overlap/gap、上边界裁剪、版本链和 B coverage
排除。源码增量复用旧 `observedIntervalCoverage` 与 shared `InsightSnapshot`，
精确 manifest 和范围在模型执行前固定，未增加调度器/授权框架。本轮未复现该增量的
RED，也未运行其后 745 的暂停来源/lifecycle 加强用例；同伴结果不记作本轮通过。

## 问题分类与仍需验收的项目

| 分类 | 精确症结 / 状态 |
| --- | --- |
| confirmed 新迁移缺陷，鲜输入已修 | M06 `sourceTranscript` 曾无条件使用 SourceItem.text，把 Coding tool_result 发布为同 owner 可搜索 Material；`46a6c993` 复用原 `conversationRecords`，保留原件、合法对话与真实 producer。共享验证提取改变 late ACK 顺序也在该对象修复；本轮原红绿确认。没有据此声称跨用户读取或旧单用户 bug。 |
| confirmed 旧投影退休缺口，最小样本已关闭 | 修复前宿主已发布的 v1 错误正文在 46 重启后仍搜索 `1→1`；f436 同一独立样本为 `1→0`。属于同 owner 投影/披露及可能的下游污染，使用既有 visibility withdrawal 与传递依赖；本轮未证明 Memory 已受该旧正文污染，也未替代历史/restore/性能及全组合 gate。 |
| confirmed 迁移遗漏，局部修复有界通过 | M08 旧 `InsightSnapshot` 的 coverage/version 未迁移；同伴在 literal 6855 的有效新回归因 snapshot 缺失失败。b842 复用旧算法/shared 形状，本轮 2/2；745 暂停来源补充仅静态审查。不是已经证明的旧业务 bug，也不是完整 M08 验收。 |
| 已修历史缺陷，不重开 | submitSync caught child 残留已 savepoint 修复；Memory migration 传递来源、首次 pin 覆盖、Lark 明文 task input、artifact source/final fence 均保留对应 owning module 回归。历史日志不是新组合通过证据。 |
| 待证实风险 | M09/M10 transaction wrapper 在已有事务内不建 savepoint；本轮仅确认实现不同，未证明可达的部分残留。先在真实消费入口保存 RED，再决定最小 helper。 |
| 测试假设失效 | 全实例“零/固定数量任务与 Material”、未等 raw→formal producer、把 raw UUID 永久当合法 canonical 正例；更新 fixture 需保留原拒绝和新正式正例，不能归因旧业务 bug。 |
| 环境失败 | loopback EPERM、Node ABI 与 Mem0 binary 不符、Electron 未安装 binary、缺 consumer dist；独立列环境/命令，不计业务缺陷，也不能算通过。 |

本轮主要原始 log 的 SHA-256（文件名统一以前缀 `/tmp/mote-public-review-` 开始）：

| log | SHA-256 |
| --- | --- |
| `base-seams.log` | `599cddc17d78bd1af5f74316e34fe5dab327766dd1047e8aa55ad48510dfa767` |
| `m07-red.log` | `24a37ad9a2dce6a844faf8a4b772cd2829d054b58578319f605c67b9ce3dcbd3` |
| `m07-green-loopback.log` | `deaf6093ec565ca6955a01d0a75cf9a667d94d12b94dadba884f358aeb02d176` |
| `m08-read-races.log` | `26703d2823e599b0944887b4e968b29def0799ad9368a817bfb56b0fa27d2a2f` |
| `m11-seams.log` | `bd7f38c60873efebf607ae5e5575109f53edd3fa6174a9d93ef0c80c68e93c89` |
| `retained-v1.log` | `bf30f3324343a754c383d6cd4dd16abb34ff5c22b81c2fdccadf437386a83813` |
| `retained-v1-fixed.log` | `dfef4ceb33478c394289ac33d9c50708d9d7315a1519056f402812c2cc06bba2` |
| `m08-b842-snapshot.log` | `d8d6a127d016a93b6f49799bcc9ff01fb3f3ffcb1fc7c3de8523ddafcf2de241` |

M07 `ca69ed69b04f4cf481a1d099e4b5013f97931d45` required affected 的
2312 pass / 2 fail / 1 optional skip、exit 1 保留；Android 未到达。早期 389 组合与 emitted 4
是不同 checkpoint。M08 1fe 的全 Ask/read-races 53/54 失败及 6855 focused 正例修正、
M11 旧组合/旧 affected 同样不能替代最终 gates。

本轮未进行最终三模块合成、全量 affected、server emitted build、Android、renderer、
物理设备、真实模型/外部账号、部署、M16 whole-instance lifecycle。CI 设置未改变；
只读工作流 API 确认 Checks/Component checks 为 `disabled_manually`，release workflows
保持 active，未触发它们。没有运行 CI 通过的声明。后续只需先关闭上述 owning-module 缺口、统一精确依赖，
再运行代表链与受影响 gates；不无限追加不相关探针。
