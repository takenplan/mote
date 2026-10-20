# 按任务复用检查证据：2026-10-20

本记录验证[增量检查证据 ADR](../adr-incremental-check-evidence.md)及[开发指南](../development.md#pr-check-scope)中的本地检查流程，不修改历史候选的执行结论。

## 候选与范围

验证对象是基于 `2c78ca8d52a7d17fae20962cf68d09a717ffc73a` 的未提交工作区修改，运行时输入摘要为 `1a3de6f57453c244377f187c102b95e42d577adc04504898f32ce9a749296f99`。HEAD 只标识来源，不能单独代表本次修改。验证后仅补充本记录及文档语法修正。

macOS arm64，Node 26.11.1 / ABI 147。安装根依赖时关闭 workspace 安装及生命周期脚本；没有构建应用或启动前台窗口。所有回归使用生成的 Git 仓库、源码、进程和文件。选择器将本候选归为 `tooling=true`，工作区为空；实际计划只有环境预检与检查基础设施回归。

## 已执行

`npm run check:affected`：77 项通过，0 失败、0 跳过。回归包含选择器、计划、环境、真实 CLI、驱动和任务输入身份。

| 场景 | 实际证据 |
| --- | --- |
| 测试文件与产品源码分开归属 | 普通顶层测试选择完整所属工作区；产品源码、共享 fixture/helper、已知跨端读取测试文件及未知 TS 验证脚本保留消费者义务 |
| 修改后选择性失效 | 所属测试变化使其任务失效；无关任务及传递消费者的旧 PASS 保留；产品源码及共享 fixture 变化使相关消费者失效 |
| 输入完整性 | 命令、参数、目录、权限、配置、lockfile、安装依赖修补、同 PATH 工具替换、文件增删及符号链接目标变化均进入身份 |
| 生成输出 | 相同字节的 dist 重建不失效；缺失、篡改及多余旧产物失效；Vite/Vitest 输出缓存不会使安装树误失效 |
| 原始证据复用 | 后续任务失败不抹掉已通过任务；中断、阻塞、未清理及旧格式回执拒绝复用；REUSED 不成为新的原始执行 |
| 生命周期与冻结 | 跨 worktree 原子锁、进程组中断/清理、锁归属变化、规划与加锁间修改、发布回执时修改均由真实 Git/子进程 fixture 覆盖 |
| 不稳定输入 | 已发现的任务输入变化即使恢复原内容也保持 invalidated；其余未变任务可在重新选择计划后引用原始回执 |
| 调用方元数据 | 不同 CODEX_TOOL_CALL_ID 不造成无关失效；真实任务子进程也无法读取该字段；其它环境变化仍使身份失效 |

随后在另一工具调用中执行 `npm run check:affected -- --reuse /absolute/path/to/original-receipt.json`，引用下表原始回执。环境预检实际重新执行，`release-contracts` 显示 `REUSED`，没有再次执行 77 项测试。

| 回执 runId | 状态与任务 | 驱动总耗时 |
| --- | --- | --- |
| `1bddc265-7160-4b3f-8523-2435b8465182` | passed；environment passed；release-contracts passed，6.442 秒 | 8.351 秒 |
| `23cb6676-ad2f-4f3d-9fa5-20f1c2ab1a68` | passed；environment passed；release-contracts reused，来源为上行原始任务 | 1.882 秒 |

两轮 `release-contracts` 输入摘要相同：`e7eb704dec5fde3214a34c11d3ad3b4b843138647aa3f04bd73324b748275da9`。原始 JSON 回执保存在 Git common dir 的 `mote-check-receipts/`，不将源码、环境值、命令输出或凭据写入回执。文档格式、语法、链接目标和围栏另行检查。

## 未验证与限制

本次没有运行 Server、Agent、Web、Desktop 的完整应用测试集、Android Gradle、原生构建、浏览器或实体设备旅程、容器、真实模型及 CI。它们不在本次基础设施改动的自动计划中。

本次测量只说明这份小型检查计划的真实入口能够复用，不代表历史 PR 的重跑成本，也未实测 Server 全套可节省的时间。未建模外部覆盖及设备、模型、特定生命周期状态的证据仍须单独验证。
