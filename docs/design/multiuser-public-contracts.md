# 多用户迁移的公共合同与推广顺序

本复审补充 [多用户 ADR](../adr-multiuser-scope.md) 和
[模块验收合同](multiuser-modules.md)，不改变共享 SQLite、共享服务、单执行器的方向。
范围是 M00/M01/M02/M03/M04/M05/M06/M09/M10 九个已交付 Draft 的公共机制，
以及 M07/M08/M11 的消费接缝；不是重新验收全部业务，也不宣布后者完成。
冻结版本、独立运行结果、已知问题与未跑项目见
[共享测试清单与复审证据](../validation/multiuser-public-contracts.md)。

## 结论与最小调整

公共基础已经足够。生产 `scope/app.ts` 在同一个数据库连接上创建 Accounts、
UserContextAuthority、ScopedServices 和 TaskExecution，接入 Configurations、
Ingress、插件、处理器与连接器，再启动执行器。M07/M08/M11 的冻结实现继续消费这些
宿主能力。当前问题主要在跨域接缝、旧能力的迁移对照和异步时序；没有证据支持新建
用户数据库、第二个执行器、万能授权对象或统一业务状态机。

优先统一以下三个合同，先用已有真实消费者验证，再推广：

1. **授权与读取凭证。** 固定 owner/来源范围，保留首次观察到的精确凭证，在每个
   读取路径的 await 后及最终返回/私人提交前复查全部依赖（外部事实结算例外见下文）。
   M07 provider page、M08 reader/artifact、
   M11 SDK 都是真实消费者。先统一测试义务；小型只增不改的凭证集合是候选，尚未实现。
2. **事务、ACK 与发布边界。** M03 intake→M02、M06 publication→M05 下游准入都要求
   同步原子性。嵌套失败被外层 catch 后，内部不能留下 authority/work/index/receipt；
   外层独立成功写应能提交。外部 ACK 的持久结算与私人结果的发布授权分别检查。
3. **生产夹具与能力账本。** 从真实 Accounts、生产 app/HTTP、SQLite 和单执行器开始，
   只冻结外部 I/O；共用同 ID 双用户、可控 await 屏障、生产状态等待和证据格式。
   每项旧能力必须有“旧实现→新入口→具体测试→冻结证据”，不能用测试总数替代。

本次只交付规范与清单，没有提取生产 helper 或改写测试框架。待 M07/M08/M11 的
精确公共基线统一后，可从至少两个真实消费者提取最小 fixture；必须保留原失败断言。
生产 helper 只有在两个真实场景和可复现问题共同支持、原契约测试可原样复跑时才提议。

## 已复用能力及责任边界

路径均相对 `apps/server/src/`；M07/M08/M11 路径只在各自冻结对象存在。

| 能力与所有者 | 真实消费位置 | 公共合同 / 领域责任 |
| --- | --- | --- |
| M00/M01 `scope/context.ts`、`scope/http.ts` | `scope/app.ts`、M03/M06/M09/M10 服务绑定；后续 Memory/Ask/MCP | 身份由宿主签发并检查来源、当前授权；JSON、模型参数、生命周期资料不能铸造上下文。请求响应发布前仍复查。 |
| M00 `scope/services.ts`、`scope/lifecycle.ts` | 各域 `registerUser`；M05 `TaskRun.services` | 普通用户服务和指定 domain/purpose 的生命周期授权分开；管理员身份不授予私人读取。恢复资料不能恢复执行授权。 |
| M02 `scope/private-data-sql.ts` | `scope/ingress.ts`、`scope/processing.ts`，后续 `scope/memory.ts`、`scope/ask.ts` | SQL 绑定宿主 `$user`，每次访问复查；复合键、FK、FTS 和传递依赖属于领域 schema/查询义务。扫描器不是任意 SQL 正确性的证明。 |
| M02 `PrivateCursor` | M02 数据分页；后续 Memory/Ask/MCP 查询 | 复用部署/用户/完整查询身份签名；领域定义 position、版本、范围和 continuation。原件 ID 游标、事件序号和 provider cursor 不强改为同一种格式。 |
| M04 `Configurations`、lease/fork/restore | M05 `bindConfiguration`、M06 媒体；M09/M10 配置；后续 Memory/Ask | 现有 schema/CAS/prepare/publish/rollback；模型、价格、凭据/资源代次固定。恢复失败不能改用当前配置。配置模块定义 live 与 restart 的失效规则。 |
| M05 `TaskExecution`、`TaskAuthorization`、`ExecutionGrant` | M06 `register`/`stage`、M09 invoke、M10 collect；后续 Memory/Ask coordinator | 单执行器承担 owner、attempt、lease、checkpoint、取消、公平性及最终 commit。领域承担输入快照、业务 generation、外部对账和不重复成功单元。 |
| M03 `IngressHost.bindSource` | app 的五方法插件白名单、M06 processor、M10 intake；后续 Memory 原件读取 | 固定来源及宿主 fence；准确原件/回执/父依赖。不得向 worker 暴露 DB、任意宿主路径或 owner selector。 |
| M09 插件宿主与 lifecycle | M06 processor adapter、M10 bundled adapters；后续 M07 provider | 包共享、实例归用户，固定 release/config/grant/namespace；pause 排空和 stop 撤权不同，物理 worker 退休单独证明。可信插件不宣称恶意代码沙箱。 |
| M07 `MemoryHost.bindRead` | M08 reader/开场记忆、M11 Memory 工具/resource | before-LIMIT 的完整传递来源与值过滤；实际 provider 正文及精确历史版本证明。provider 失败不能回退 SQL 镜像。owner audit 不成为 query Memory。 |
| M08 `AskHost.bind(...).reader()` | M11 `McpQuery` | 共享真实 query-visible projection、navigation、window、context/history/limit；原文披露授权引用。artifact 还需自己的 run/conversation/source 依赖。 |
| M10 `ConnectorSourceStatusReader` | M08 status、M11 source/tool/resource；M11 host-only reader registrar | 状态读取不打开外部连接或凭据；intake 状态不代表 processing/Memory 已完成。各域保留自己的状态账本。 |

## 需要一致的可观察行为

### 身份、范围与终止

普通请求绑定 credential/session，持久任务绑定 M05 原始账号授权与精确 attempt。
Web logout 不取消已准入后台任务；明确的账号 epoch 变化、任务取消、来源撤销、插件
stop 和业务 generation 各自阻断其控制的能力。不能因为都叫 epoch 就共用一个计数器。

host read capability 的 `sourceIds === undefined` 表示本人全部来源，`[]` 表示没有来源；
复制、规范化并冻结传入列表。M01 MCP 凭据的 `[]` 是账户范围读权限，M11 必须显式转换，
不能把任何非空 allowlist 省略。通知只能唤醒原有授权，不能把 capture/Memory task、
UserDataSubject 或普通任务 JSON 提升为账号范围的周期授权。

有效授权至少包含宿主身份、当前任务/请求、领域资源与输入三层。最终检查覆盖成功与
异常返回；一个后续 await 结束时，前面已读取的行、原件、来源声明、Memory 与 artifact
也必须仍有效。暂停、取消、撤权、删除、失败重试分别测试，不互相充当替代证据。

### 凭证与 pin

同名不代表同一种 pin：

| 凭证 | 意义与失效条件 |
| --- | --- |
| 原件 physical hold | M03 防止 GC 物理删除；不授予读权，逻辑删除后仍拒绝普通读取。 |
| source incarnation | 删除后用相同 ID 重建不能复活旧能力；metadata rename 是否失效由调用目的明确。 |
| 精确 original receipt | 同 ID、同正文重建属于新的 incarnation；canonical ref 可以相同，旧 receipt 仍须失效，不能只比较语义 hash。 |
| Material revision / transitive sources | 原始父项、ready projection 和所有传递来源符合当前范围；不能仅查主 source。 |
| Memory semantic fingerprint / provider version | 保留语义证据、精确 binding/key/body 与版本；历史权限使用目标版本的原始证明。当前行可用作稳定性 fence，不能替代历史来源授权。 |
| 插件 snapshot / model lease | 保留确切代码、配置、namespace 与模型/价格；恢复仍检查现行撤权。 |
| artifact/run/conversation/policy generation | M08 自己的寿命与 CAS；另一个合法 Memory 读取不能让旧 artifact 通过最终 fence。 |

首次观察到的凭证不能被后续读取覆盖。候选集合在排序、LIMIT、provider key/模型输入
之前按 owner、来源、transitive dependency 和请求值过滤；事后过滤不能补救分页遗漏或
已发生的外部披露。整页返回前复查整页，不只检查最后读取的项。范围、版本、query、
projection、manifest 与游标 identity 一致；旧 canonical ID 不映射成新版本正文。

### 同步事务、外部结果与恢复

`PrivateSql.transaction` 与 M05 同步准入已有 savepoint；`ExecutionGrant.commit`
负责外层成功事务。不能在 SQLite 同步事务 callback 内等待 Promise。一个接缝失败时
同时检查 task、grant、operation、resource/fairness、Material/FTS、receipt 和通知结果。
M09/M10 的已有 transaction wrapper 在外层事务内直接执行，是实现差异；本次未证明
存在可达的残留缺陷，先套用 caught-failure 合同，不直接大改。

具有外部副作用或需要结果对账的调用先记领域 intent/issuance；ACK/body 校验和持久结算
允许记录已发生的事实，但不会
恢复私人发布权。先复用领域现有 journal，禁止把“取消后不能发布”误写成“取消后不能
记迟到 ACK”。取消/删除后未知结果保持 unknown/pending，按准确 key 观察或清算，
不盲重放。物理 worker/process/adapter 退休、逻辑不可见和外部已擦除分别报告。

恢复复用原 owner、模型快照、完整输入、成功 checkpoint 与固定任务身份。分别验证：
未发送、已发送但结果未知、成功结果已持久化、结果已发布但 ACK 丢失。真实 SIGKILL、
graceful restart、直接种入 crash journal 和人工缩短租期是四种不同证据，不能相加后
称自然生产恢复全覆盖。

## 迁移顺序与旧能力对照

1. **先写能力账本。** 查看旧入口、算法、配置/UI、后台任务、数据/导出、错误与恢复。
   用正常正例建立 characterization；旧算法 fixture 只证明算法，不能代表新生产入口。
2. **确定 KEEP/CHANGE/REMOVE。** 每个意图变化与责任归属明确，不把保护措施扩成
   新业务限额或隐藏功能关闭。保留完整范围、history/context/limit、Unicode 和分页。
3. **先选代表接缝。** A 采集→M06→Memory；B Memory→Ask→真实 MCP SDK；C M05 准入→
   pause/撤销→真实进程死亡恢复。先在精确组合验证公共合同，再推广到其他模块。
4. **新缺陷先红再绿。** 保留失败测试提交和生产父 SHA、命令、原始输出、exit 与断言；
   在修复提交用同一场景复跑，保留合法正常能力与 B 用户对照。此前开发不追认为 TDD。
5. **组合后核对生产时序。** 等待实际 producer、正式 ready/publication/ACK/checkpoint，
   不以 intake receipt、固定 sleep、全库任务数或手工内部组装代替能力完成。
6. **完成受影响验收再推广。** 冻结精确依赖组合，跑消费者、fresh build/emitted process
   和必需 affected checks，独立审查。单个局部绿灯不升级成整个模块/最终组合通过。

| 取代检查 | 本规范的处理 |
| --- | --- |
| KEEP | 旧领域算法、完整业务能力、可信上下文、PrivateSql、M04 snapshots、M05 单执行器、M03 来源能力、M09 lifecycle。 |
| CHANGE | 补充跨域契约、真实生产 fixture、旧能力映射和明确的红绿/冻结证据义务。 |
| REMOVE | 用 intake 即时阴性代替 producer 完成后阴性；用历史测试数、PR 描述或环境失败证明新组合；追认历史全程 TDD。 |
| EXCEPTION | 旧 builder 仅供算法对照；mock 仅限外部 I/O；不同 pin、generation、cursor、ACK 与发布保留不同含义。 |
| UNKNOWN | M07 f436 的旧 v1 当前投影已由独立重启样本验证退出，历史/restore/性能与最终消费者组合仍需 owning-module gates；M08 Snapshot 后续小增量及最终 M07/M08/M11 组合；真实模型/设备/部署和 M16 编排。以后续证据逐项关闭。 |

## 九模块回查边界

| 模块 | 本次建议的有边界回查 |
| --- | --- |
| M00 | 实际新增路由/tool/worker 与 inventory 一致；scanner 只证明其声明覆盖，不证明所有 SQL。保留生产无 legacy fallback。 |
| M01 | 私人 HTTP、设备、MCP 与 task context 分流；撤销/重置和 logout 的差异；新路由传完整 Accounts runtime。 |
| M02 | before-LIMIT owner/来源及完整 transitive dependency；source/capture 重建后的当前可见性、修正与历史；private transaction 最终授权。 |
| M03 | receipt/accepted hook 原子性、原件/临时目录/pin/GC；producer 完成后的 Coding 对照。当前问题不据此定为 M03 身份授权缺陷。 |
| M04 | live lease 与 restart restore 的不同撤权触发器；原模型/价格/凭据代次；无当前配置 fallback。restart-required 设置按真实激活语义测试。 |
| M05 | retained service 的精确 attempt fence；caught child admission 原子性；hydrate 前取消/撤权；成功单元不重放、unknown 外部结果不自动重试。 |
| M06 | 重点回查通用 source-item decoder 是否保留 Coding/邮件/日历等领域投影；已发布旧缓存/Material 的可见性退出及传递下游。原件和合法 producer 均保留。 |
| M09 | 领域 pause/stop 与 worker 物理退休；迟到 ACK 必须结算后再 fence 发布；nested transaction 仅列待证实风险。 |
| M10 | 配置秘密不落 task/checkpoint/export；原始 format、onAccepted/onAdmitted 与 savepoint 组合；未知外部结果的真实死亡证据与 seeded journal 分开。 |

不重新唤醒已关闭模块或暂停的 M11。公共修复由当前 owning module 提供精确 freeze，
review 方在自己的 archive/合成数据上验证；较大生产提取先由父任务协调。最终推广以
同一组合上的代表链证据为门槛，而非要求每个模块无限增加探针。
