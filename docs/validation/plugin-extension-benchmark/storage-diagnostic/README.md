# SQLite 故障：紧凑诊断证据

## 结论与归因

**根因：`UNKNOWN`。两条 R5 `FAIL_HOST_STORAGE` 记录保持不变。** 两次独立新 vault 在插件实例创建前的 SourceItems 输入准备阶段出现持久化数据库损坏。随后仅执行一次原始基线的带 strace 输入前缀诊断；该次基线通过，没有捕获到损坏写入者。strace 改变了运行时序，这一条通过记录不能消除 R5 的失败，也不能证明候选新增代码导致回归。

| 观察 | 结果 | 持久证据 |
| --- | --- | --- |
| R5 第一次故障，PID 27668 | 退出码 1；331 页文件中存在指向 500 页以上的树；`mp_file_reviews` 表记录缺失但其两个自动索引仍在 | [只读检查](read-only-inspections.json) 的 `r5-first-failure` |
| R5 第二次故障，PID 28271 | 退出码 1；280 页文件中存在指向 500 页以上的树；最后一条 Originals 分页请求为 503 | [只读检查](read-only-inspections.json) 的 `r5-second-failure` |
| 已完成的 R5 boundary 对照 | `quick_check=ok`、`integrity_check=ok`，499 页 | [只读检查](read-only-inspections.json) 的 `r5-completed-boundary-control` |
| 单次原始基线诊断，PID 29476 | 43 条 SourceItems 接收和读回通过；35 次 HTTP 全部 200；正常退出 0；687 页，两个完整性检查均为 `ok` | [运行收据](baseline-trace-results.json)与[只读检查](read-only-inspections.json)的 `original-baseline-trace` |

两次失败的 `plugin_user_instances` 与 `plugin_user_snapshots` 均为 0；已记录的请求没有创建、检查或调用插件实例。失败的直接表现是宿主/vault 层的结构损坏；造成损坏的具体操作尚未定位。没有把这些故障改写为 Iterator 修复或插件能力通过。

## 单次诊断范围

候选为原始基线 `2c78ca8d52a7d17fae20962cf68d09a717ffc73a`，在隔离 worktree 和新 vault 上从正式 `index.ts` 入口运行，没有修改生产或测试文件。诊断沿用已有依赖与本轮未修改的 shared/agent 构建；该运行不是独立依赖安装实验。时间为 2026-10-19 19:52:41.130Z 至 19:53:11.278Z，Node v24.19.0、strace 6.8。[运行收据](baseline-trace-results.json)和[来源哈希](provenance.json)保留这些边界。

复用失败运行的同一组生成 SourceItems，三个来源分别为 20、8、15 条，每批 6 条接收、每页 7 条读回。执行前缀包括管理员初始化、host 启动、登录、创建第二用户、安装生成 release，以及输入接收和读回；没有创建插件实例或调用模型。该前缀通过不代表完整的 R5 财务插件、升级或生命周期旅程通过。

仅跟踪 `open,openat,close,fcntl,ftruncate,truncate,rename,renameat,renameat2,unlink,unlinkat`。未抓取 read/write 内容、网络载荷、stdin 密码或环境内容。执行端以独占创建的运行标记防止误执行第二次诊断；[syscall 摘要](trace-analysis.json)记录 `runCount=1`。

## syscall 观察及限制

在本次通过的基线运行中，顶层 `vault/mote.sqlite` 只出现两个启动前检查复制使用的只读打开，随后是一个 SQLite 读写打开。没有观察到对该顶层数据库的 `truncate/ftruncate/rename/unlink`。详见[数据库打开摘录](database-metadata-excerpt.txt)与[syscall 计数](trace-analysis.json)。

完整 host trace 中仅有两次 `ftruncate`，目标均为新建的 `/tmp/mote-scope-preflight-*/mote.sqlite` 临时副本，长度为 0。没有 `better-sqlite3` 或 `better_sqlite3.node` 路径出现于 trace。这里描述的是这一次基线运行，不能据此推断先前两次故障没有截断、并发访问或底层存储问题。

静态审查在 [Mem0 runtime](../../../../apps/server/src/mem0-memory-runtime.ts) 的 `vectors.db` 路径发现 SDK better-sqlite3 与 node:sqlite 读取混用；[Mem0 provider](../../../../apps/server/src/mem0-memory-provider.ts) 将该 runtime 放在独立 worker 中。它不在这两次顶层 `mote.sqlite` 故障的已观察执行路径上，因此没有依据这一假设修改代码或宣布根因已解决。

## 只读检查与哈希

检查只复制已经停止的 vault，随后以 `mode=ro`、`query_only=ON` 打开副本。为查询损坏 schema 使用的连接级 `writable_schema=ON` 没有执行 DDL 或数据写入；副本检查前后 SHA256 保持相同。原始故障数据库没有使用 SQLite 打开或修改。

| 原始故障数据库 | SHA256 |
| --- | --- |
| 第一次，331 页 | `c57cc6aa9cbad69655644b3474ab6fd805ac9666a8a7a4fdd5b5e157a0a994ca` |
| 第二次，280 页 | `c59e5dae03183edbfec20855744920cdbd5c9902d87cc1f1d2628bc9c6caab0e` |

[只读检查收据](read-only-inspections.json)保留数据库与副本哈希、SQLite 检查结果、schema 计数、HTTP 状态和进程退出记录。[syscall 摘要](trace-analysis.json)保留原始 trace 的大小与 SHA256；[来源哈希](provenance.json)保留 helper、生成输入和 release 的身份。

## 归档内容与未包含的材料

本目录只包含本说明和以下六份紧凑证据文件；复制的六份证据保持诊断完成时的原始字节：

- [baseline-trace-results.json](baseline-trace-results.json)：单次基线运行收据。
- [trace-analysis.json](trace-analysis.json)：syscall 摘要、trace 哈希与限制。
- [database-metadata-excerpt.txt](database-metadata-excerpt.txt)：顶层数据库打开摘录。
- [read-only-inspections.json](read-only-inspections.json)：两次失败、boundary 对照和单次基线的检查收据。
- [provenance.json](provenance.json)：诊断输入与原 helper/release 的哈希。
- [reviewable-artifacts.json](reviewable-artifacts.json)：原始会话目录的工件哈希清单。

**原始 trace、数据库副本、诊断执行脚本、helper、生成输入和 release fixture 未随本目录归档。** 收据中的 `/workspace/scratch/...`、`/tmp/...`、`runDir`、`sourceRoot` 及其他原始路径只用于辨认当时的运行环境；会话结束后不能假定这些路径仍可访问，它们不是仓库内文件或持久下载链接。哈希可以核对外部取得的同一工件，不能从哈希还原未归档的内容。

`reviewable-artifacts.json` 是原始会话工件清单，包含未归档脚本、输入和运行标记的条目。其中 `README.md` 的哈希对应原始会话说明，**不对应本目录这份经相对链接适配的说明**；其他已复制文件可按其原始条目核对。该清单不表示列出的全部工件都在仓库中。
