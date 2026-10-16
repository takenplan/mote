# M12 Actions、待办与日程提议隔离

候选依赖为 `87046225af3cae212bd773e93e1c07317f4eff31`，运行时与统一候选
`c53c199876bbfee2acfe8c38ecda7403af7f809d` 相同。前置 M07/M08/M11 仍待各自最终验收。

## 有限旧能力账本

| 旧实现及真实消费者 | 处置与复用 |
| --- | --- |
| `todos.ts` → Web `features/actions.tsx`：人工任务、无默认截止日期、创建幂等、CAS 状态、分页和备份 | KEEP 字段和算法；CHANGE 为 M02 PrivateSql、签名用户游标及本域 lifecycle。 |
| `actions.ts` → Web、Desktop `calendar-actions.ts`、Android `CalendarActions.kt`：创建/更新/取消/完成建议、语义 sameAs、证据 quote/current/version 校验 | KEEP 模型判断和 shared 日期/时区/标记算法；CHANGE 使用 M08 真实 reader、M04 模型快照和 M05 单执行器。 |
| `actions.ts` → `action_catalog` 和 calendar-extraction Skill：只读模型目录、字面检索和分页；查询无写工具 | KEEP 只读目录与证据预算，owner 由宿主固定；不把普通 Ask 的答案解释成批准。 |
| `actions.ts`、`actions-configuration.ts` → Actions 设置 UI：默认关闭、时区、设备长期 review grants、配置失败先撤权 | KEEP M04 配置交易和领域授权，长期 grant 与一次批准分开。 |
| `registerActions` → Web/设备：targets、confirm、dismiss、deliveries、claim、receipt | CHANGE 绑定 M01 身份、设备、精确 target incarnation 和不可变批准；复用 OwnerQuestions 回复/CAS，不新建审批引擎。 |
| Desktop/Android 本机执行账本：attempting 先持久化、首次 claim 才允许 mutation、崩溃后 marker 对账、uncertain 无盲重放 | KEEP 既有外部执行责任与协议；只用合成 transport/进程测试，不写真实日历。 |
| 来源变化/删除 scrub、撤权、离线与重启、外部 ACK | CHANGE 保留准确外部事实结算，发布单独 fence；删除不宣称删除系统日历事件。 |

REMOVE 生产单用户 Store/ExecutionEngine 入口的恢复方式；不恢复旧全局表或共享状态。
EXCEPTION：旧测试只作算法 characterization；设备原生生命周期由 M14/M15 消费新合同。
UNKNOWN：真实模型质量、物理设备/日历、个人外部账户、部署和 M16 全实例编排均不在本任务授权内。

本模块不新增邮件、支付、Google Calendar 写入或自动执行业务。

## 验证顺序

第一条代表场景使用真实 Accounts、生产 app/HTTP 和 SQLite，A/B 使用相同待办 ID，
检查幂等、CAS、签名分页和重启。RED 须先在原候选运行；后续逐项登记原始 exit。
重型检查顺序由父线程协调，M07 → M08 → M11；本模块先实现及窄测试，不占用重型窗口。
