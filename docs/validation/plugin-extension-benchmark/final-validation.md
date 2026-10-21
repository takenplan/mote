# 最终候选检查与失败记录

> 2026-10-20 后继交付：本页“最终”限定原表所列源码/测试候选和原收据，不代表后续所有候选。后继真实合并、局部修复与单独的完整功能检查见[集成附录](integration-current-host-2026-10-20.md)，当前归属见[项目进展台账](../../project-progress.md)。原失败、存储 UNKNOWN 与未执行范围不追溯改绿。

日期：2026-10-19 UTC。**最终受影响检查失败；第五轮 G5 仍为
FAIL_HOST_STORAGE。五轮实验的完成不表示完整插件化或可靠性验收通过。**

本页与 [机器可读收据](final-validation-results.json) 共同保留原始检查、原先未运行阶段的
一次性补充结果，以及范围明确的诊断。最终结论见 [五轮总报告](REPORT.md)。

## 冻结输入与运行方式

| 项目 | 身份 |
| --- | --- |
| 原始基线 | `2c78ca8d52a7d17fae20962cf68d09a717ffc73a` |
| 实际检查的本地源码/测试提交 | `fe15cbd5e7aba9b53e3d664f7470a85107428013` |
| 相同文件树的公开提交 | `185dd36c8a2deb01ba8ccb7393d2764fc9c7bea1` |
| 源码/测试候选 Git tree | `3eee98ad87917b53b82238b0ef5dc54918422646` |
| 原始及全部补充收据的 inputIdentity | `4e288d2d82c8214790c72ea59c73f1bc7ca5a8a64abf7762efd4cef14e33373f` |
| 运行环境 | Linux x64，Node 24.19.0；仓库依赖清单和锁文件未修改 |
| 最终追加内容 | 评估文档和紧凑 JSON 收据；没有继续修改源码或测试 |

原始检查在独立冻结 worktree 中，由唯一完整检查 driver 运行：

```sh
npm run check:affected -- --base 2c78ca8d52a7d17fae20962cf68d09a717ffc73a --head HEAD
```

原始运行时间为 **19:54:33.254–19:56:00.681 UTC**，退出码 **1**。它在 Agent 测试失败后
按原检查器规则停止。后续只执行原计划中五个尚未运行的阶段，每个阶段执行一次：直接
复用仓库 `runChecks`、同一计划、互斥锁和输入身份检查，在确认清理完成后继续下一阶段。
补充运行时间为 **20:02:23.828–20:36:36.778 UTC**，总退出码 **1**。

补充 driver 首次直接启动时因 npm 生命周期 PATH 与原始调用不同，被输入身份保护拒绝，
当时没有执行测试。还原 npm 自己设置的 PATH 后，五份补充收据均与原始 inputIdentity
一致，未发生输入变更。补充执行不改写原始失败收据，也不是一次通过的替代检查。

各阶段结束后检查器均确认清理完成。Server/Web 的 `owned_processes_outlived_command`
表示命令退出时仍有其拥有的子进程，因此阶段失败；后续清理成功不解除该失败。紧凑收据
没有给出具体遗留子进程身份，不能据此归因给某个插件或某个测试。

## 完整结果

| 阶段 | 测试结果 | 阶段结论 |
| --- | --- | --- |
| 环境、i18n、scope/release 契约 | 均通过；release 契约 65/65 | PASS |
| shared、agent、server、web 构建 | 四项构建完成 | PASS |
| Agent（原始检查） | 328 项：325 通过、2 失败、1 跳过 | FAIL，原始检查退出 1 |
| Server（补充） | 3,160 项：3,151 通过、4 失败、3 因超时取消、2 跳过 | FAIL；另有子进程超出命令生命周期 |
| Shared（补充） | 198/198 通过 | PASS |
| Web（补充） | 601/601 断言通过 | FAIL；子进程超出命令生命周期 |
| Release integration（补充） | 37 项：34 通过、1 失败、2 跳过 | FAIL |
| Central runner（补充） | 结构化集成场景成功，退出 0 | PASS |

测试计数按 Node runner 的原始汇总保留，包含文件级失败单位；它们不是冻结案例 NISR，
也不适合相加后作为插件成功率。完整案例仍为 **0/5，另有 7 项 NOT RUN**，严格冻结
探针仍为 **0/6**。

第五轮归档入口在补充 Server 阶段的默认 CI 模式完成了全部三个阶段：校准
17.624 秒、权限边界 3.325 秒、最终插件公开回归 39.159 秒，均通过。此前独立归档重放
也为 3/3；这些输入现已公开，后续运行不再是隐藏试验。两次实际 SQLite 损坏记录仍然
有效，见 [R05 独立报告](round-05-evaluator.md) 与 [存储诊断](storage-diagnostic/README.md)。

## 已有直接证据的两项测试诊断

### Agent 的 UTF-8 mock 请求解码

两个失败均来自未改动的 `packages/agent/test/internal-input.test.mjs`：DeepSeek 的长内部
问题，以及容量失败测试。已有 HTTP fixture 用 `raw += part` 逐个 Buffer 转成字符串。
当 107,963 字节请求在 emoji 的 UTF-8 字节中间分块时，该写法引入替换字符，导致与
原件正文的深度相等断言失败。

候选和原始基线各进行一次有界诊断：候选 0/2 通过；基线 1/2 通过。四次观测中，把全部
Buffer 合并后再解码，均恢复与期望完全一致的原件和问题。基线的通过请求恰好没有截断
多字节字符。直接证据支持 fixture 解码问题；没有修改 fixture，也没有把一次基线结果
外推为整个基线通过。命令、分块边界、哈希和范围见
[诊断报告](agent-test-diagnostic/README.md)。

### Delegation HTTP 测试的跨 worktree 类身份

冻结 worktree 共享主 checkout 的 `node_modules`。包名 `@mote/agent` 指向主 checkout，
而测试相对导入的 bridge 指向冻结 worktree；两个 `ContextToolError` 文件字节相同，但
ESM URL 不同，因此构造器不相等，`instanceof` 为 false。原始 Server 失败的实际码为
`context_tool_failed`，期望码为 `invalid_delegation_arguments`，与该通用错误回退一致。

一次进程内 resolver 控制试验只把包名映射到同一冻结 dist，未改源码、测试、dist 或
依赖链接；构造器身份恢复一致，原测试 1/1 通过。它解释这一条失败，不能替代完整检查
或解释其他失败。详细证据见 [模块身份诊断](agent-test-diagnostic/worktree-module-identity.md)。

## Server 的七个非通过单位

| 原测试文件 | 原始观察 | 已知范围 |
| --- | --- | --- |
| `delegation-proposal-lifecycle.test.ts` | 实际 `context_tool_failed`，期望 `invalid_delegation_arguments` | 已由跨 worktree 类身份直接解释 |
| `memory-feedback-large-scope.test.ts` | 工作状态 `failed`，期望 `completed`；约 10.48 秒 | 原因未定位；不是测试超时 |
| `memory-import-background.test.ts` | 整个文件报告失败；约 83.32 秒 | spec 输出没有记录致命错误、子进程退出码或信号 |
| `shutdown-execution.test.ts` | 整个文件报告失败；约 43.56 秒 | 首项 publication polling 测试通过，后续具体失败位置未记录 |
| `memory-delegation.test.ts` | 千条原件的 review coverage 测试达到 120 秒限额 | TIMEOUT / cancelled |
| `memory-read-batch.test.ts` | 三个 Memory job、4,097 个 context grants 达到 60 秒限额 | TIMEOUT / cancelled |
| `request-admission.test.ts` | 1,001 个 query admission 达到 120 秒限额 | TIMEOUT / cancelled |

这七个测试文件和所检查的直接实现文件与基线相同。没有在完全相同条件下执行另一轮
基线全量检查，因此除已直接诊断的模块身份外，其余失败不能仅按文件未改动就归为
既有问题，也不能仅因发生在本轮候选就归因于四个生产改动。日志中其他通过的恢复测试
包含主动 SIGKILL，不能把那些信号移用到两个只有文件级失败记录的测试。

## 发布集成失败

`scripts/release/connector-runtime.test.mjs` 的“ready read-only deployments need no writes;
missing binaries in a read-only directory fail clearly”测试在第 17 行的 `assert.rejects`
报告 **Missing expected rejection**。只读目录中缺少 runtime 的准备操作没有按测试预期
拒绝。原始汇总为 34 通过、1 失败、2 跳过；没有重跑整个阶段或修改测试规避失败。

具体负例先将已有目录设为 `0555`，再在其中准备尚不存在的 `new-runtime` 子目录，
期望 `EACCES` 或 `EPERM`。已有 binaries 的离线复用先行通过，新目录操作则没有拒绝。
测试、runtime 实现与检查 driver/plan 均与基线相同。当前诊断进程的 UID/EUID 为 0，
driver 未显式降权，但完成收据未记录当时测试进程的权限能力和文件系统执行细节；
执行环境权限行为只是解释线索，尚不能作为已证实根因。这里的 `actual: undefined`
表示缺少预期 rejection，不是准备函数返回值的证据。

## 先前焦点回归也保留失败

最终冻结检查之前的 Memory/插件焦点运行有 **98 项：97 通过、1 失败**。失败来自
`multiuser-memory.test.ts` 的 M06 实际上传/发布测试：用户 B 进入 `processing_failed`，
布尔断言实际 false、期望 true。它没有报告 SQLite 损坏。

随后该单项隔离执行通过；最终补充 Server 阶段同项再次通过，约 6.17 秒。原焦点运行
缺少能将其唯一绑定到最终候选的完整提交收据，所以单独归档其日志哈希与结果，不将其
冒充 `fe15cbd` 的完整门槛。后来的通过不足以证明随机波动原因，也不抹去先前失败。

## 证据与复现边界

[JSON 收据](final-validation-results.json) 保存原始计划、每阶段运行身份、退出码、计数、
截短失败摘录以及两个完整日志的 SHA-256/字节数。日志、临时诊断 loader、原始生成
数据库和完整 strace 保留为会话诊断，没有声称已包含在仓库；持久交付包含紧凑证据、
公开测试入口和 [提交/tree 映射](publication-map.json)。

本实验真实运行认证、ZIP 安装、子进程 worker、SQLite、任务和资料发布。语义模型结果
与生成 release transport 使用明确的 mock，真实大模型调用数为 **0**。原生设备、真实
浏览器用户旅程、真实模型质量和生产部署未执行。收据的通过只适用于已执行的具体路径。

**可以交付并审阅三项通用改进和五轮实验记录；不能把当前候选描述为完整验收通过。**
