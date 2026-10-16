# M12 Actions、待办与日程提议隔离

M12 在独立 feature branch 实现，未改 `main` 或远端集成分支。已组合 M07 PR136
`cd7a306cce0f6cd5fec3c9e91e6dee0761352115`、M08 PR137
`58944f00837c89bc1d302ecd7be7a568db4abe44`；M11 PR138 最终
`98d76945e091d7234217ebcf532ebeff3350937c` 已组合。本轮又组合 M16 稳定候选
`589d6ad7c4a36de21cb105a7be41a599d0fae1df`，不将它称为 M16 最终验收。最终组合门禁仍待运行。
逐项证据见 [验证账本](../validation/multiuser-actions.md)。

## 有限旧能力账本与责任替换

| 旧实现及真实消费者 | 处置与当前入口 |
| --- | --- |
| `todos.ts` → Web `features/actions.tsx`：人工任务、无默认截止日期、创建幂等、CAS 状态、分页和备份 | KEEP 原字段及算法；CHANGE 为 M02 PrivateSql、签名用户/筛选游标及本域 lifecycle。`GET/POST /api/todos`、`PATCH /api/todos/:id`。 |
| `actions.ts` → Web、Desktop `calendar-actions.ts`、Android `CalendarActions.kt`：创建/更新/取消/完成建议、语义 sameAs、quote/current/version 校验 | KEEP 模型判断、calendar-extraction Skill、shared 日期/时区/标记算法和原生客户端；CHANGE 为 M08 真实 reader、M04 固定模型配置快照、M05 单执行器。 |
| 原 `sharedCues` 在完整语义 artifact 中原子消费跨 observation 的约定 | CHANGE 为当前 query-visible formal Material 的原文单位；保留同一 Material 的多原文证据及其完整依赖围栏。REMOVE 旧全局 context_artifacts/action_semantic_checkpoints 的读写与独立语义任务。不得用关键字判断约定。 |
| `action_catalog` 和 calendar-extraction Skill：只读比较目录、字面搜索和分页 | KEEP 每页 20 项、24KB、前四条证据预览和旧引用预算；先校验完整来源闭包，再应用 LIMIT。模型读取无隐含批准或原生日历工具。 |
| Actions 设置 UI：默认关闭、显式时区、设备长期 review grants、配置失败先撤权 | KEEP M04 配置交易与领域授权；长期发现授权和一次批准分开。`PUT /api/actions/settings`；撤权先提交，后续配置失败仍返回撤权结果。 |
| `registerActions` → Web/设备：targets、confirm、dismiss、deliveries、claim、receipt | CHANGE 为可信 M01 身份、精确设备/日历/外部账户/目标 incarnation、不可变批准、OwnerQuestions 回复与 CAS。不另建审批引擎。 |
| Desktop/Android 本机执行账本：attempting 先落盘、首次 claim 才允许 mutation、崩溃后 marker 对账、uncertain 不盲重放 | KEEP 外部写责任与协议；M05 在批准的确切操作上先记录 issuance，生产 Desktop adapter 使用假原生 transport 验证。纯本地完成不创建外部 issuance。 |
| 失败进度、retry、离线重启与成功 checkpoint | KEEP 只恢复当前失败单元；成功模型单元、已经发出的原生操作不重放。错误只保留固定码，不保留 provider 正文。 |
| 来源变化/删除 scrub、停止/撤权/删除后的迟到 ACK、备份恢复 | CHANGE 为外部事实结算与私有发布分开的围栏。删除立即擦除本域原文/草案/OQ，恢复只恢复已撤权历史；不宣称删除系统日历事件。 |

纯输入 schema 提取到 `action-contract.ts`、`todo-contract.ts` 供旧 characterization 与新实现共同使用；
生产 scoped 路径不导入旧 Store。M01/M02/M04/M05/M07 OwnerQuestions/M08 为已有公共合同，
没有新增 scheduler、审批框架或邮件/支付/Google Calendar 自动写业务。

EXCEPTION：旧 `actions.test.ts`、`todos.test.ts` 只表征历史算法，不能证明新身份隔离；
物理客户端的账号生命周期及 UI 改造分别由 M13/M14/M15 承接。
UNKNOWN：真实模型质量、物理设备/日历、真实外部账户写入、部署和 M16 全实例编排尚未验证。
原项目的单用户表保留供迁移与旧测试，不覆盖或删除原数据；不把旧表自动认领给首个登录用户。

## 批准与设备投递合同

owner 来自认证上下文，模型、HTTP body、原文均不能选择 owner。
`POST /api/actions/:id/review` 输入 `{version,event,target?:{deviceId,calendarId}}`；
`GET /api/actions/:id/reviews/:questionId` 返回 OwnerQuestions 公共字段及 `reviewedAction`：
`{id,version,kind,event,target?,targetDetails?,related?,evidence,fingerprint}`。
弹窗应呈现该固定内容；targetDetails 包含已注册设备、日历和可选的外部 accountId。
批准 hash 绑定内容、版本、依赖、source 范围、账户代次、设备授权代次及目标 incarnation。
来源或目标变化后旧问题返回冲突，重新启用来源不会恢复旧批准。

OwnerQuestions 的选择回复用现有 `{requestId,expectedRevision,action:'answer',choiceId:'approve'|'dismiss'}`；
自由文本不授予外部写权限。同一请求收据幂等，A/B 相同 requestId 分开保存。
`POST /api/actions/:id/confirm` 沿同一审批路径作兼容入口，不能绕过固定内容。
`POST /api/actions/:id/dismiss` 与 `/cancel` 使用 `{version}`；cancel 撤销确切操作和 M05 任务。
跨用户对象不存在为 404；旧版本、来源、目标或授权冲突为 409；身份失效按 M01 返回。
未新增 Actions WS：复用已有账号隔离的订阅和 OwnerQuestions。账号切换必须清除旧弹窗、草稿、
待提交动作并丢弃旧请求结果，不能把旧请求重新绑定到新身份。

设备凭据可进入 Actions 路由，但域方法固定 credential.deviceId 并要求 owner 明确授权 review device。
注册目标只能登记本人设备；设置/长期授权/发现重试只接受 owner 上下文。
`GET /api/actions` 与模型 catalog 只返回受围栏约束的视图，不推进建议、审批或外部操作状态；初次读取可沿 M04 初始化本人的配置元数据。
来源删除的擦除由同步删除 trigger 执行，不依赖 UI 再读取。
分页 `nextCursor` 为绑定账号和筛选条件的不透明字符串；URL 必须编码并原样传回。
初次请求可省略 cursor，兼容旧 Web/Android 的 `cursor=0` 首屏标记；非零数字不是合法游标。

原生客户端 `/claim` 在 M05 issuance 与领域 intent 原子提交后首次返回 `mutationAllowed:true`；
重复、断线、失去本地账本、重启只返回 false 并对账。`uncertain` 不等于可重发。
`/receipt` 返回 `{acknowledged,published}`。准确的迟到 ACK 可以完成先前确切 issuance，
但停止、来源变化、目标变化、撤权、停用或删除后不发布私有成功结果。
已知原生事件 ID 独立于可擦除的草案保存，错误事件回执即使在来源擦除后仍被拒绝。
宿主预绑定的回调只结算确切外部事实；它不能恢复身份、grant 或任务访问。
新 HTTP 请求仍须通过正常认证，撤销凭据不能凭旧操作 ID 绕过认证。

## Web 最小消费映射

| 原消费点 | 当前合同 |
| --- | --- |
| `Actions.tsx` 列表 | `GET /api/actions?cursor=<encoded opaque string>`；省略、空串或 `0` 为首屏，`nextCursor:string|null`；其余列表字段保留。 |
| Actions 设置 | `PUT /api/actions/settings` 保留 `{revision,authorizationRevision,settings}`；配置失败但撤权已提交时返回 `authorizationRevoked/revokedDeviceIds/authorizationRevision`。 |
| 审批弹窗 | proposal.version 创建 review；呈现 reviewedAction；使用 question.revision 作为 OwnerQuestions expectedRevision。fingerprint 是服务端绑定内容的标识，不是 credential；epoch 不由客户端选择或提交。 |
| 撤销/并发 | `/cancel {version}` 撤销已批准确切操作；旧版本或不同并发回复冲突 409；跨用户对象 404；同 requestId/同内容收据幂等。 |
| 旧 `/api/devices` | M03 `GET /api/ingress/devices`，`x-mote-ingress-version: 3`，`{items:[{id,name,platform}]}` 映射到 UI 的 deviceId/deviceName；不恢复旧全局路由。 |
| 待办 | 既有 create/CAS/filter 流程保留，游标为用户/筛选绑定字符串；owner 不在请求体。 |

## 任务、恢复与公开范围

M05 `actions.watch` 是用户开启发现时签发的 durable authorization，沿原 15 秒发现周期等待；
`actions.extract` 固定 generation、时区、sourceIds、原文范围与模型费用快照；
`actions.delivery` 固定批准操作、设备目标和外部 issuance。父任务停止后其子任务不能发布。
任务输入只保留有界 locator，不保留原文、凭据或 provider 正文。
所有模块依赖会在最终组合候选上重新验证；CI Checks/Component checks 保持禁用并记为未运行。

## 恢复本轮的决策与公共接缝

| 问题 | 决策、依据与影响 | 实际验证 |
| --- | --- | --- |
| M16 个人导入要求各域声明策略，缺失 hook 会拒绝整个归档。 | 沿已有 `DomainLifecycle.importUser`：Todos 同步合并数据及 create 收据，相同内容幂等，冲突拒绝并回滚，不覆盖后来的本地修改。Actions 显式 `false`，coverage 声明保留当前审批/操作。旧 `archive-export.ts` 的 jsonTables/derived 包含 Todos、未含 Actions，故没有裁掉旧 Actions 个人导入。依据 [多用户存储与恢复](../adr-multiuser-scope.md#decision-and-provenance) 和 [M16 个人导入合同](multiuser-lifecycle.md)。 | 实际 portable HTTP 2/2，重启、重复、同 ID B、冲突/重复 ID 与事务回滚。独立 domain restore 仍恢复撤权后的 Actions 历史；不恢复旧外部权限。 |
| 非空 uncertain ACK 被误当结清，擦掉标题却保留普通私有元数据。 | 仅精确 succeeded ACK 算 settled。unknown 期间只保留预绑定回调结算所需的 operation/issuance/native identity 与外键 tombstone，擦除源、目标、内容、策略及普通元数据；成功事实后再删除可清空私有行。已删除域的触发器和启动回填不重建来源。依据 [原生 ACK 与内容事实](../adr-client-action-first.md#content-and-progress)、[恢复失败合同](../adr-task-recovery-and-execution-budgets.md#failure-handling-contract) 和 M16 物理完成要求。 | 实际 claim→uncertain→域删除、M16 account delete→迟到成功 ACK→retry 3/3；原 history/todo restore 相邻 3/3。 |

### 实例备份接缝

当前生产 composition 新增的 13 张 `ac_*` / `td_*` 表及其全部列须加入 M16 既有 stopped-archive schema 合同，不新增备份格式。下方列清单来自真实空生产库的 PRAGMA。

实例恢复保留规范数据和外部成功/unknown 事实，但先退役旧执行权：实际用户 YAML 及会被继承的实例配置 `actions.enabled=false`；`ac_state.settings.enabled=false`，generation 与 authorization_revision 前进，review_devices 清空，policy_id/policy_task 清空；删除旧 `ac_targets` 的执行目标注册；`ac_operations.revoked=1`。不得清零 claimed、issuance_id、native_external_id 或 ACK 来制造新的首发资格；成功/unknown journal 与 completed 模型历史保留。旧 M05 grants/凭据继续沿 M16/M05 的退役合同处理。Todos 没有外部执行权，不重写内容或状态。

这一实例恢复接缝随本轮冻结交 M16 做自己的真实 corruption/retirement RED→GREEN。在组合该冻结修复并复验前，不能声称本模块或全部 17 模块的备份恢复完成。M15 delivery 与 M16 lifecycle 对旧 35d 的独审均为有界静态审查，不是执行测试；确认的问题已按上表修复，新 delta 仍需关闭审查。

| Table | Required columns |
| --- | --- |
| `ac_meta` | `id`, `cursor_key`, `installation_epoch` |
| `ac_state` | `user_id`, `deleted`, `generation`, `settings`, `authorization_revision`, `review_devices`, `policy_id`, `policy_task` |
| `ac_sources` | `user_id`, `id`, `epoch` |
| `ac_proposals` | `user_id`, `id`, `json`, `proof`, `scope`, `created_at` |
| `ac_dependencies` | `user_id`, `action_id`, `kind`, `id` |
| `ac_targets` | `user_id`, `device_id`, `epoch`, `json` |
| `ac_jobs` | `user_id`, `id`, `input`, `proof`, `task_id`, `state` |
| `ac_operations` | `user_id`, `id`, `action_id`, `approval_hash`, `target_epoch`, `authorization_revision`, `account_epoch`, `native_external_id`, `task_id`, `issuance_id`, `claimed`, `ack`, `revoked`, `published` |
| `ac_restore` | `user_id`, `id`, `hash` |
| `td_meta` | `id`, `cursor_key` |
| `td_state` | `user_id`, `deleted` |
| `td_todos` | `user_id`, `id`, `created_at`, `status`, `version`, `request_hash`, `json` |
| `td_restore` | `user_id`, `id`, `hash` |
