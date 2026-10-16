# M12 Actions 验证账本

当前为实现/窄 TDD 记录，**不是最终交付或重型验收通过声明**。真实账户、生产 HTTP/服务/SQLite、
M08 Harness、M05 执行器与实际 Desktop CalendarActions adapter 使用合成 A/B 数据；
只替换外部模型/原生 transport。未写真实日历、邮件、支付或外部账户，未建真实凭据、权限、部署。
不修改 `main` 或远端集成分支，不启用禁用的 CI。

## RED 与修复证据

命令均在本模块 checkout 执行：`node --import tsx --test --test-concurrency=1 <file>`；
表中 `/tmp/<name>` 表示原始 `<name>.log` 和 `<name>.exit`，测试名称筛选保留在命令/日志。
每个测试组的最终精确候选 SHA 与最终复跑命令将追加到本文件；尚未进行的检查不能用此前快照代替。

| 旧能力/隔离义务 | 真正 RED 与归因 | 修复及窄 GREEN |
| --- | --- | --- |
| 人工待办、同 ID A/B、create 幂等、CAS、无推断截止日、签名页、重启 | `bd210b3`，原候选 870 返回 503 而非 201，`m12-todo-red` EXIT1 | `55e48160`，`m12-todo-green` 1/1 EXIT0；`multiuser-actions.test.ts`。 |
| 默认设置、配置归属与同名目标 | `f8d2a4d0`，`m12-settings-red` EXIT1 | `412629f8`，`m12-settings-green` 2/2 EXIT0。 |
| 真实 Harness 从本人原文提出建议、交错审批、模型无写工具 | `496d583a`，`m12-harness-red-loopback` EXIT1（真实缺失发现） | `68bf819f`，`m12-harness-green` 1/1 EXIT0；后续扩展同 requestId A/B。 |
| 原生 adapter 首次 claim、重复回执、未知结果对账 | `96debb35`，claim 缺失，`m12-delivery-red` EXIT1 | `0d2ac3f7`，`m12-delivery-green3` 1/1 EXIT0。 |
| 删除停止确切任务、立即 scrub、可移植恢复原子校验 | `a16ab1d8`，`m12-fences-red` 7pass/3fail EXIT1 | `9aad7aab`，`m12-fences-green2` 原 14 项 14/14 EXIT0。 |
| 旧更新/取消/完成原生事件与 related 版本推进 | `0a372c6e`，`m12-kinds-red` 0/3 EXIT1 | `18ec2b29`，`m12-kinds-green` 3/3 EXIT0。 |
| 手工待办 export/delete/restore | `5a832b3a`，`m12-todo-restore-red` scope_unavailable EXIT1 | `c54d3797`，`m12-todo-restore-green` 1/1 EXIT0。 |
| 弹窗可审查完整固定内容与外部账户 | `bcc8c00f`，`m12-review-details-red` 缺 reviewedAction EXIT1 | `b5e2e4aa`，`m12-review-details-green` 1/1 EXIT0。 |
| 停止父发现任务、成功 locator 不可从普通任务 API 重放、模型拒绝 owner/native ID | `d9bce670`，`m12-admission-red` 1pass/2fail EXIT1 | `1e5b3dea`，`m12-admission-green` 3/3 EXIT0。 |
| Actions 删除后的显式历史恢复不复活原授权 | `d9bce670`，`m12-actions-restore-red` EXIT1 | `1e5b3dea`，`m12-actions-restore-green` 1/1 EXIT0。 |
| 真正 provider 401 的安全进度、retry、成功单元不重跑；删除失败来源不保留错误 | `37a91174`，修正夹具后的 `m12-progress-valid-red` EXIT1，缺 provider_authentication | `09d3a32c`，`m12-recovery-green3` 3/3 EXIT0。 |
| GET/catalog 不暗写、来源擦除后迟到回执仍固定原事件 | `10a2c68d`，`m12-readonly-red` 0/2 EXIT1，GET 改库、错误 native ID 返回 200 | `0bc5cf08`，`m12-readonly-green` 2/2 EXIT0。 |
| 纯本地完成不能产生外部 issuance | `03943c97`，`m12-local-only-red` 200 而非 409 EXIT1 | `0bc5cf08`，`m12-local-only-green` 原生变更 3/3 EXIT0。 |
| 同一 formal Material 的跨原文约定 | `ffa55e81`，`m12-material-red` 6 completed 但无跨原文建议 EXIT1 | `c7aaebb6`，`m12-material-green` 1/1 EXIT0，真实 Material、Harness 与删除 scrub。 |

## 额外生产链覆盖

| 场景与旧入口 | 实际窄证据 |
| --- | --- |
| 两个真实 OS 进程：生产 server 与实际 Desktop CalendarActions；外部假日历成功后 SIGKILL 两者、丢本地账本再启动，成功模型单元与原生变更均不重放，B 不变 | `72a16962`，`multiuser-actions-process.test.ts`，`m12-process-source` 1/1 EXIT0；fresh emitted 仍待最终重型。 |
| 真设备 credential 的同设备/目标授权，配置失败前已撤权，时区与错误设备/日历目标 | `72a16962`，`multiuser-actions-device.test.ts`，`m12-device` 3/3 EXIT0；批准后过期的首次 claim 拒绝（合成 Date 时钟）`m12-expiry` 1/1 EXIT0。 |
| 模型选择独立同标题事件及语义 sameAs、保留 dismissed；16 项真实建议无漏页、来源过滤先于 LIMIT、跨 owner/filter 游标拒绝 | `72a16962`，`multiuser-actions-catalog.test.ts` 前 2 项，`m12-catalog` 2pass/1timeout EXIT1，不能算整组通过。 |
| M03 真实上传→M06 正文→真实 Harness 最后 Unicode 范围，时区 UTC、无断 surrogate | `72a16962`，同文件第 3 项，改为等待实际终态后 `m12-long-state-wait` 1/1 EXIT0，29474ms。 |
| M05 同步 onIssued 回调 throw/thenable：journal 与领域 intent 同时回滚；固定 A 的任务/issuance 在撤权后只结算 A 外部事实 | `multiuser-actions-issuance.test.ts`，`m12-issuance` 3/3 EXIT0。 |
| 六种迟到事实围栏：cancel、grant revoke、目标 change、账号 disable、credential revoke、domain delete；unknown 不盲重放、重复批准/ACK 幂等 | `multiuser-actions-fences.test.ts` 与 `multiuser-actions-recovery.test.ts`，窄原始证据如上，最终组合待复跑。 |

当前 `d66b6ed9` 的目录/sameAs/交错审批邻接回归：`m12-catalog-approval-current` 3/3 EXIT0；真实 A/B 同 requestId 收据分离。

## 必须如实分类的中间失败

- `m12-harness-red` 是 sandbox loopback EPERM，属于环境失败，不能算业务 RED；授权本机假服务后另跑有效 RED。
- 初次 `m12-fences-green` 的 ENOTEMPTY 是真实异步模型清理生命周期缺口；修复为跟踪并等待实际 Promise drain，之后原场景通过，不能归咎环境或只放宽 cleanup。
- `m12-catalog` 的长文件 15 秒超时保留了 6 completed/6 pending；是夹具等待不符合实际生产终态的假设失效，不能声称尾段丢失。改成等待实际尾段输出，未降低内容断言，独立通过。
- 最初 recovery 假模型对不含合成约定的原文也输出硬编码日程，导致正确的 calendar_quote 拒绝。修正夹具按真正提供的文本返回后，另在原进度实现上复现了有效 RED；没有放宽生产 quote 校验。
- `m12-delivery-probe`/早期 green2 的嵌套 grant 和 unknown 状态错误均保留原始失败，只有最终 green3 被记通过。
- 初次类型检查缺工作区依赖 `mem0ai/oss` 属环境准备问题；依赖复制到本模块本地后 server typecheck EXIT0。无同伴 node_modules 写入或软链到同伴工作树。

## 最终门禁（待重型窗口）

1. 对齐真实 M07/M08/M11 最终提交，当前活跃对话独立复审最终 runtime，修 confirmed 问题。
2. 同 SHA 的 M12 专项、实际 scoped/legacy consumer 组合、fresh libs/server build、生产 emitted 双进程恢复。
3. `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=/Users/utopiafar/Library/Android/sdk ANDROID_SDK_ROOT=/Users/utopiafar/Library/Android/sdk npm run check:affected -- --base origin/codex/mote-multiuser-integration`。
4. 精确远端 feature head/base/CI 状态，Draft PR 指向独立集成分支；CI Checks/Component checks 禁用，未运行，不启用它们。

所有此前窄检查只覆盖当时树。真实模型、真实日历/外部账号、物理设备、部署和最终跨模块 UI 不计入本模块已验证范围。
