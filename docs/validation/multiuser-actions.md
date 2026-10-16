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
| 旧 Web/Android 首屏 cursor=0 与其余签名页隔离 | `753fda50`，`m12-cursor-red` 首屏 400 EXIT1 | `ce52c47e`，`m12-cursor-green` 1/1 EXIT0，非零数字仍拒绝。 |
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

旧算法 characterization 另外运行：`node --import tsx --test --test-concurrency=1 apps/server/test/actions.test.ts apps/server/test/todos.test.ts`，`m12-legacy-server` 18/18 EXIT0；`npm test -w @mote/desktop -- test/calendar-actions.test.ts`，`m12-native-characterization` 7/7 EXIT0。它们不替代 scoped 身份或 emitted 证据。

## 必须如实分类的中间失败

- `m12-harness-red` 是 sandbox loopback EPERM，属于环境失败，不能算业务 RED；授权本机假服务后另跑有效 RED。
- 初次 `m12-fences-green` 的 ENOTEMPTY 是真实异步模型清理生命周期缺口；修复为跟踪并等待实际 Promise drain，之后原场景通过，不能归咎环境或只放宽 cleanup。
- `m12-catalog` 的长文件 15 秒超时保留了 6 completed/6 pending；是夹具等待不符合实际生产终态的假设失效，不能声称尾段丢失。改成等待实际尾段输出，未降低内容断言，独立通过。
- 最初 recovery 假模型对不含合成约定的原文也输出硬编码日程，导致正确的 calendar_quote 拒绝。修正夹具按真正提供的文本返回后，另在原进度实现上复现了有效 RED；没有放宽生产 quote 校验。
- `m12-delivery-probe`/早期 green2 的嵌套 grant 和 unknown 状态错误均保留原始失败，只有最终 green3 被记通过。
- `m12-legacy-contracts` 把原有 Vitest Desktop 文件误交给 node:test，runner 不匹配，18pass/1filefail EXIT1；按两个包各自既有 runner 重跑得到上述 18/18 与 7/7，没有改测试或生产代码。
- 初次类型检查缺工作区依赖 `mem0ai/oss` 属环境准备问题；依赖复制到本模块本地后 server typecheck EXIT0。无同伴 node_modules 写入或软链到同伴工作树。

## 最终门禁（待重型窗口）

1. 对齐真实 M07/M08/M11 最终提交，当前活跃对话独立复审最终 runtime，修 confirmed 问题。
2. 同 SHA 的 M12 专项、实际 scoped/legacy consumer 组合、fresh libs/server build、生产 emitted 双进程恢复。
3. `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=/Users/utopiafar/Library/Android/sdk ANDROID_SDK_ROOT=/Users/utopiafar/Library/Android/sdk npm run check:affected -- --base origin/codex/mote-multiuser-integration`。
4. 精确远端 feature head/base/CI 状态，Draft PR 指向独立集成分支；CI Checks/Component checks 禁用，未运行，不启用它们。

所有此前窄检查只覆盖当时树。真实模型、真实日历/外部账号、物理设备、部署和最终跨模块 UI 不计入本模块已验证范围。

## 恢复后的公共合同组合（未最终验收）

- 干净恢复 `35d661b2`。M13 原目标本轮单次交接返回 `isError:false` 与准确 threadId，父已核实成功；后续重复结果澄清被审核拒绝，未发送并停止，不影响原交接成功。M11/M14 未被唤醒，没有创建第五对话。
- `1f129540` 组合 M16 固定 `589d6ad7` 与 M11 PR138；app 注册/退出清理、scope 清单、纯导入例外精确并集，server types/scope/diff0。本方库 dist 复制同源 M16 缓存用于窄 fixture，不冒充本方 fresh build。
- 独立静态报告为 `/tmp/mote-m15-review-m12-delivery-35.md`、`/tmp/mote-m16-review-m12-35d.md`。M16 确认 uncertain 非 NULL ACK 误判及物理元数据残留，真实生产 fixture 随后证实。
- `8c7f839d`：`node --import tsx --test --test-concurrency=1 apps/server/test/multiuser-actions-lifecycle.test.ts`，`m12-lifecycle-physical-red` 0/3 EXIT1，分别为域误报 complete、已结算域残留、实际 M16 总删除 completed 后残留。`bab08a4f` 主修复；`f66aeace` 增补已删除域仍收到来源的有效 RED，`m12-deleted-source-red` 0/1 EXIT1。`5172f099` 后 `m12-lifecycle-physical-green` 3/3 EXIT0，19898ms。
- `ee3f8ec1`：`node --import tsx --test --test-concurrency=1 apps/server/test/multiuser-actions-portable.test.ts`，`m12-portable-red` 0/2 EXIT1（实际 HTTP archive_import_unavailable）。`bab08a4f` 后 `m12-portable-green` 2/2 EXIT0，2935ms；实际合并、重复、重启、同 ID B、冲突/重复 ID 与回滚，不恢复 grants。
- `5172f099` 邻接窄回归：`node --import tsx --test --test-concurrency=1 --test-name-pattern='portable action restore|explicit Actions restoration|explicit owned todo restore' apps/server/test/multiuser-actions-fences.test.ts apps/server/test/multiuser-actions.test.ts`，`m12-lifecycle-adjacent` 3/3 EXIT0，16196ms。未选场景不计本次通过。
- 当前增加到 46 个专项场景，原 41 个全部保留。未在最终同一 SHA 整组跑过。M16 固定 589d 的第五次 required 已结束 EXIT1：Desktop 492/492、Server 2562 pass/0 fail/1 opt-in skip、Web 505/505；最后 CLI 4/5（重复 fresh-self 请求）失败，Android 未运行。M16 已释放，M15 使用两个短槽，本方未 claim heavy。13 表和权限退役接缝给 M16 后，须组合其真实冻结修复再验收。
- 文档编辑曾在 Python 解析期因输入编码失败，以及 apply_patch 上下文未匹配；均未改文件。列清单脚本误遍历字典后只追加了表头，已按真实 PRAGMA 字典追加全列。这些是编辑命令失败，不计产品或测试失败。

## 首次 fresh 组合与长文件夹具修正

- `59a2966e903cc1d51912d6e491badd4f1ad07a1c` 在真实最终 M11/M16 589d 和 CLI 7fb 基础上 fresh `npm run build:libs`、`npm run build -w @mote/server` 均 EXIT0，日志 `m12-final-build-{libs,server}`。随后原 13 文件 46 项串行专项为 45 pass/1 fail，341583ms，`m12-59a-focus.log/.exit`；唯一长 Unicode 场景在 90 秒等待后看到 4 completed、无 pending/failed、无建议。该阶段已释放，后续 A/B/C、emitted、required 没有继续执行。
- `6fd208ff` 的诊断增加完成状态等待后又重复等待输出，累计触发 120 秒测试总时限，`m12-long-tail-valid-red` 为 1 cancelled/EXIT1，不计生产 RED。`59db9aec` 改为在真实 watch waiting、全部模型单元 completed 后立即检查输出，`m12-long-tail-completed-red` 0/1 EXIT1、34352ms；诊断证明 4 批各含 3 条 M06 记录，最后一批第 3 条的 54 个字符含完整尾段。生产没有截尾；旧假模型只检查每批 `[0]` 的假设不再适用于先前已保留的 Material 分组能力。
- `725f8b97f349f29ddd9f0e8c78b59cbbdcb1d446` 仅修正该合成 responder，检查全部已提供原文。相同真实 M03/M06/Harness、尾段内容、UTC 和 surrogate 断言原样通过 1/1、32943ms，`m12-long-tail-grouped-fixture-green.log/.exit`。没有放宽时限或修改生产实现，不追认为新的运行时缺陷 TDD。
- M16 `2affb338` / `9fa19e2b` 已分别 pick 为本方 `9ac5d2e0` / `52aa25b9`，13 表与恢复撤权接缝由对方实际 17/17 验证。本方只读两 helper、真实调用者和新增测试后没有新增 confirmed P0/P1/P2，报告 `/tmp/mote-m12-review-m16-backup-9fa.md`；静态清单 173，13 表全部列与真实 PRAGMA 一致。本方 compiled/required 仍须执行，不能把对方结果当独立运行。
- M15 已冻结的延迟读取/完整 import 回执小增量按其测试前置顺序组合到 `e9f284af`；对方实际 JVM 4/4 与原生 3 个单例 GREEN 的来源见其 validation，不冒充本方原生执行。新增 opaque Actions 页面检查仍由 M15 进行。
