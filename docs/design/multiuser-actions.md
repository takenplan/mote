# M12 Actions、待办与日程提议隔离

M12 在独立 feature branch 实现，未改 `main` 或远端集成分支。已组合 M07 PR136
`cd7a306cce0f6cd5fec3c9e91e6dee0761352115`、M08 PR137
`58944f00837c89bc1d302ecd7be7a568db4abe44`；M11 最终提交及最终组合验收仍待对齐。
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
`GET /api/actions` 与模型 catalog 只返回受围栏约束的视图，不持久化状态变更；
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

## 任务、恢复与公开范围

M05 `actions.watch` 是用户开启发现时签发的 durable authorization，沿原 15 秒发现周期等待；
`actions.extract` 固定 generation、时区、sourceIds、原文范围与模型费用快照；
`actions.delivery` 固定批准操作、设备目标和外部 issuance。父任务停止后其子任务不能发布。
任务输入只保留有界 locator，不保留原文、凭据或 provider 正文。
所有模块依赖会在最终组合候选上重新验证；CI Checks/Component checks 保持禁用并记为未运行。
