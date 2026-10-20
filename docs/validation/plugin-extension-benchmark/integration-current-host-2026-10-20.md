# PR183 / PR184 当前集成验证附录

日期：2026-10-20（Asia/Shanghai）。本附录为文档后继；被测最终源码为 `f92fec719dd51f7d2c28591229bc9f6e20605e6c`。当前公开回归与原五轮实验分别记账，不重写原始评价或失败收据。

## 输入与交付范围

| 输入 | 精确身份 |
| --- | --- |
| 原 PR184 | `eb75e80d9a98c533175ebfd8dde2187c2c190f33` |
| Android 409 修复 | `c55560b7a179a0e0f321f10e74a84250a35c88af` |
| PR184 两项修复后的冻结源码 | `6f7d6bd4d64bed46cf2a851068529968a5425d13` |
| 原 PR183 实验归档 | `74da386f33adde6521d5dd3435bf9643da89f495` |
| 两者的真实合并 | `790f34ecb02592868cd702627d3d138d4d9e7417` |
| 当前插件回归适配 | `f677819f19459224b9bedcffac456f2a9e52b8cd` |
| 503 回放的生产/Mac dist 基底（含 UTF-8 fixture 修正） | `2b88e3d6e1775bbca2d857b4ab721ad441768935` |
| 503 诊断/回放五文件后继，无生产变更 | `8d9740c7375816300045614557b812f851419288` |
| 最终冻结源码（再含重启 observer 局部修正） | `f92fec719dd51f7d2c28591229bc9f6e20605e6c` |

实现前的有界方案与实现后的源码均获得独立 APPROVE。共享生产文件由单一 owner 合并，完整检查由单一 driver 执行；集成 worktree 独立安装锁定依赖并构建库，没有借用其他 checkout 的依赖或 dist。

## PR184 两项确认缺陷

1. 历史图片回补原先会越过活跃或外部结果未知的图片，并可能报告整批成功；强制替换处理配方也早于冲突拒绝。现在持久保留准确的冲突原件及意图，独立后续图片继续处理；活跃项复用已有等待/复查，未知项保持阻塞且不自动重放。只有核准的 retry 与配方替换在同一事务提交；重启、撤权、取消及原件失效继续受既有边界控制。
2. Android 上传返回 409 后，查询来源是否暂停若再遇网络错误，原先可能被当作永久拒绝。现在未知查询结果保留二进制或索引内容的待传版本，由同一自动 WorkRequest 恢复后重试；已确认暂停、真正的 enabled-source 409/410/426 和显式 retry 语义保持不变。

没有新增用户步骤、权限、默认值、处理配方、重放授权或产品策略。

## 定向红绿与组合兼容性

以下为开发期间的具体输入与结果，不替代最终冻结候选的完整检查。组合定向运行始于 `790f34ec` 的工作树；文件冻结清单区分后续适配，不能把早期结果重新标为最终源码的通过。组合定向环境为 macOS、Node 26.11.1、自有锁定依赖；使用生成数据及后台 loopback/worker，Android 构建使用 JDK 21，真机证据另列。

| 范围 | 实际结果及边界 |
| --- | --- |
| 历史图片冲突修复 | 最终 10 PASS：7 个新增冲突/恢复回归及 3 个既有处理消费者；实际 scoped ingress、公开回补/任务入口、生成图片、本地脚本 OCR、重启及授权/取消边界 |
| 该修复的早期运行 | v1 为 1 PASS / 5 FAIL，v2 首轮为 3 PASS / 4 FAIL；保留为不同输入的失败，已定位设置及生命周期断言偏差；最终 v2 保持后续图片独立前进，未用整体阻塞换取通过 |
| Android JVM | 29 PASS：SourceRejection 5、Ingress3Outcomes 12、MultiuserIngress 12；应用及测试 APK 编译/组装成功 |
| Android 原 APK 红例 | 2 个 Worker 用例均失败：预期 ENQUEUED，实际 FAILED，覆盖二进制和索引内容的暂停查询失败 |
| Android 修复 APK 绿例 | 独立无窗口 API 37 emulator 上 5/5 PASS，65.628 秒；同一自动请求重试并确认保留的字节/版本，含真实拒绝、暂停、网络及手动路径 |
| 插件组件、能力发现及取消 | 14/14 PASS；重排成功，六种描述漂移拒绝，认证/账号边界及同 worker 兄弟调用保留 |
| 七组 benchmark 首次运行 | 16 PASS / 1 FAIL；失败是生成 ZIP 的时区相关 DOS 时间字段，严格 ZIP 全字节断言仍保留 |
| 修正后完整 meeting | 3/3 PASS；显式使用原 ZIP 的本地 DOS 日期时间。UTC、Asia/Shanghai 离线生成均与原 2,337 字节 ZIP 完全相等 |
| 当前 R5 三阶段 | calibration、boundaries、final 为 3/3 PASS；真实安装、worker、SQLite、原件/资料/Transcript 和公开读回；语义与 release 下载使用明确生成 fixture |
| native 激活拒绝补强 | 只加强 boundaries 后完整该阶段重跑，1/1 PASS：check task blocked，checked/desired 为 false，fresh-revision enable 返回 503，snapshot 返回 409 |
| 插件消费者及生命周期 | 28/28 PASS，包含真实异步 check、配置变化、初始化取消/删除、未知结果、维护历史、卸载引用、重启及账号隔离 |
| Agent UTF-8 fixture | 旧逐块解码在新确定性跨字节边界用例中 1 FAIL；修正为合并字节后解码，整个文件 10/10 PASS，5.040 秒；未改 Agent 生产逻辑、原文断言或 deadline |

组合保留 PR183 的安装前能力发现、按 ID 核验及逐调用取消，也保留 PR184 的持久异步 probe、实际观测、清理、未知结果与授权栅栏。当前消费者跟随准确 check task，再读取同一实例核验状态后 enable；HTTP 200 只代表接收。native 缺少入口和扩展 trigger 拒绝仍是能力失败，没有改成 PASS。

## 生成 ingress 前缀 503：已确认的拒绝原因

[503 诊断与回放记录](https://github.com/utopiafar/mote/blob/8d9740c7375816300045614557b812f851419288/docs/ingress-prefix-503-validation.md)保留原 baseline 的 host-bind 503 → Linux-owned 43 条通过 → 新 host-bind 再次 503，以及原 PR183 的 host-bind / Linux-owned 同组对照。该 HTTP 失败发生于插件实例和模型调用之前。

已确认直接原因是目录所有权保护：失败时进程 UID/EUID 为 1000，目标目录被报告为 UID/GID 0；Node 检查与同容器同步 stat 一致，路径不是符号链接，之后的检查又报告 1000。`privateDirectory` 因实际观察到的非本用户目录而拒绝，映射为现有通用 503。**底层 Docker UID 呈现机制仍 UNKNOWN**；没有放宽或修改生产 guard。

最终严格 CLI 在 Debian 12 / Linux arm64 / Node 24.19.0 / SQLite 3.53.3 上使用 Linux-owned storage，保留镜像内依赖及基于 `2b88e3d6` 在 Mac 构建的 4 组 dist 和 Agent skills。逐项只读挂载及启动前后实际 import/require 路径与依赖清单均核验；没有 Linux 重建、重新安装依赖、联网或真实模型请求。

9.386 秒、CLI exit 0；113 次 HTTP 全为 200，43 个 authenticated ticket 原件逐条核对字节/字段/哈希；SQLite 副本为账号/采集/原件/实例/快照 **2/43/43/0/0**，quick/integrity 均 ok，检查前后副本哈希相同，hostExit 为 `{code:0,signal:null}`。证据复制、容器、匿名 volume 及本调查其余自有资源均已清理。

最终结果 SHA256 `1b0930b41502317141f808ef354bee667f68fe9efa31a61263e679e377543912`；启动前后依赖清单均为 `a81295770b72f0d7f395479147bd4aa989a512d684d5ff0cabd11ad8466903b1`；5 文件最终清单为 `2fb0a6b2ae5200f1cfcc566648cf5ea2c57ccd8e39d801d21a164202d944a9c9`。此调查另审计历史 3,054 文件为 0 变更。早期漏 skills、依赖混用、缺 shutdown 字段及严格 mount 预检失败保留原结论，不冒充最后严格运行；详见诊断记录。

该 503 的目录保护拒绝原因与原 SQLite 结构损坏是两个问题；正常回放库的完整性通过不能解释后者，原 SQLite 根因仍 UNKNOWN。

## 工件与收据身份

下列 SHA256 标识已保存材料，不是下载链接，也不能还原未归档工件。没有把本机临时路径冒充持久链接。

| 材料 | SHA256 |
| --- | --- |
| 首轮适配 14 文件清单（`f677819f`，早于 R5 observer 修正） | `7b27b310f5828cdcf7a4c109f83ff40a290f47ed9e81995091c58275002df0aa` |
| 适配定向验证汇总收据 | `d6ea3ea23301a69e9cb264c56179ddcb50dd3183632f8b9e6f4aafe3bb101057` |
| Android 源码/测试/APK 及验证清单 | `350ee36afd4d4ef0a45d0587efc74ad1011b5a97cbc862dc1887d637b8616af5` |
| 110 个原始工件审计收据 | `09fadb4efdaf7b9ca668f89048b51e7effa44c43068d91d5efb014956f81bf76` |
| 原 meeting ZIP | `f62d7ead953e6ce15ca917391c7397fbdc2d309d6d524204522e437d6acfb67a` |

定向日志 SHA256：

| 日志 | SHA256 |
| --- | --- |
| Android 原 APK 红例 / 修复绿例 | `308afd1fcf48b64eb1e53f04308b5ab1860b8fd9a671436b8f22609aeb908d10` / `7c1fb09c4965f7ad0ea5e98d460cdb9e3db3d7603e7510abe1b971f39295ec59` |
| 插件协议 / 首次七组 benchmark | `9867e9cd63b2babe501ab53660f2a995c218ed2b638e7f8e3ad2857174195c41` / `7edf09e31d0f5745c5f38294cd4c54293544fbbfc27e274a75e7e148bc7e7f9c` |
| R5 三阶段 / native 激活拒绝 | `cfeec3143b0ac2049fa59dc2716c9510d9f9964c851aab8866736085d8461bae` / `c8fccb31ee1564eb361c9635b300c3a9692b659dd6c4cea29b80ff2eda0d7f4b` |
| meeting 重查 / 插件消费者 | `c54f41590ae93f4f10785e4e53c927f11622285f016383335a1b34c1edd29cb8` / `e75df47d6f15f07a6a84c29410cdf7b28533b5d534c7b7548c04c3c4a415818f` |
| UTF-8 旧解码红例 / 修正整文件 | `ba6b7c41c45dda41c4ecdf7c237d6b3ad93084ed8fb68535e8044817ceab09d2` / `8dd8b09cfdbc71edf2b3313d8e4514e929b4d486ca9ec7a2d39228210684b5ac` |

原插件包/ZIP、seed、oracle、freeze 清单、薄 R5 测试入口及原报告/结果/诊断收据共 110 个文件，与 `74da386f` 逐字节对照为 0 差异。可执行编排已按当前宿主合同演进，原始执行器仍可从该不可变提交取得；新 R5 收据记录实际 Git commit、dirty 状态和执行器哈希，不冒充原实验或新盲测。

## 最终完整检查

有界修正仅将首次 SIGKILL 后的局部 observer 设为 50 秒（既有最长 30 秒租约 + 原普通 20 秒执行观察），默认 helper 和外层时限、原业务/版本/同一 Material 产物及 revision 不重复/重放/账号边界断言及显式 confirmUnknown 均保留。源码和验证经过独立 APPROVE；两个完整 final 焦点回归分别 18.045、17.936 秒通过，但 kill 前和重启首次读取均为 succeeded，observer 均为 0 ms，不据此声称已验证有效租约到期后的恢复。新完整检查的 f92fec71 R5 final 阶段同样在 kill 前和重启首次读取均为 succeeded、observer 为 0 ms，因此本次正式阶段也未覆盖有效租约到期后的恢复；完整门禁通过不闭合该缺口。原真实红例及该缺口保留；验证包 SHA256 `3095f720139255e3beef49a5a78f542650615013758bbb7b2fa4fed3c9b0f0c8`，原 110 文件再次比对为 0 差异。

首轮组合检查在 `8d9740c7375816300045614557b812f851419288` 发现 R5 final 的真实在途窗口：628 次公开任务 GET 均为 HTTP 200 / running，最后观测为 01:40:21.130Z；已停止库的只读副本记录 lease_until 为 01:40:30.064Z，原 20 秒 observer 提前 8.934 秒退出。任务授权未撤销、没有资源等待或外部调用，库 quick_check 正常。原 34.857 秒焦点 PASS 的首次重启读取已 succeeded，未证明命中有效租约窗口，不能推断 kill 与任务提交先后。

保留该 R5 phase exit 1 后，driver 有序中断：runId `ffc99684-c4c8-448b-9835-9a0ee31c1a24`，status interrupted / exit 130 / cleanupConfirmed=true；14 个前置阶段 PASS、Server 阶段中断、其余 8 阶段 UNRUN。inputIdentity `bf7cdafab86730314085dc7facbdeb03b33ceecebc84524d4135b03a1e94894f` 与独立重算一致；正式回执 SHA256 `f4e32d81b6e9978ce81b9d3a84f84030aa7a6c5f507c9d13bfa33aa59d7cd3b4`，日志 SHA256 `0360f44a3b2a0c09b7263d31bef04264bb806959cde3fdc76783beb9eb92fec2`。全局锁和该工作区 Node 子进程已清理，不把前置 PASS 拼成新候选通过。

| 检查 | 冻结输入 | 正式结果 |
| --- | --- | --- |
| PR184 修复后 14 步 | `eb75e80d9a98c533175ebfd8dde2187c2c190f33` → `6f7d6bd4d64bed46cf2a851068529968a5425d13` | 14/14 阶段 PASS，exit 0，cleanupConfirmed=true；Server 3,610 PASS / 9 SKIP，Web 619、Shared 198、release integration 37、Android JVM 409（84 suites）全部 PASS |
| 组合候选 23 步 | `2c78ca8d52a7d17fae20962cf68d09a717ffc73a` → `f92fec719dd51f7d2c28591229bc9f6e20605e6c` | **23/23 阶段 PASS**，exit 0，cleanupConfirmed=true；Agent 328 PASS / 1 SKIP，Desktop 627、Diagnostics 5、Server 3,646 PASS / 9 SKIP、Shared 198、Web 619、release integration 37、Android JVM 409（84 suites）全部 PASS |

PR184 命令为 `npm run check:affected -- --base eb75e80d9a98c533175ebfd8dde2187c2c190f33 --head HEAD`；macOS arm64 / Node 26.11.1 / JDK 21，2026-10-20 00:43:14.062Z–01:13:14.302Z。正式 runId `8b5fcd4b-4dae-4340-8314-5a8c645ade73`，inputIdentity `3c08d7c90a87d085ca20602282acf8e44fe9f938001c2f37369d27f6541a7a82` 与独立重算一致；回执 SHA256 `074a82c60d107b7653ff4b2d0fcd234387874e6d4a64e24fe5a58d153ccc0dd3`，完整日志 SHA256 `61143826b4eece75a905bb938f49ba37f5bdc3882358ec49319a55d5cf277eae`。源码和依赖未变，驱动锁已释放；独立复核通过。

组合命令为 `npm run check:affected -- --base 2c78ca8d52a7d17fae20962cf68d09a717ffc73a --head HEAD`，HEAD 冻结于 `f92fec719dd51f7d2c28591229bc9f6e20605e6c`；macOS arm64 / Node 26.11.1 / JDK 21，2026-10-20T01:58:46.613Z–2026-10-20T02:32:00.711Z。正式 runId `904fc1da-d4d3-4f73-9abd-b2a97fe00403`，inputIdentity `033d717e846cc3d05508845b0c01bf62245d1927580349d88b28f6c5cdf2ca8c` 与独立重算一致；回执 SHA256 `e5495f979eb44d923c694677aa71c623c74f96b79a4c2cb28c667ff91b642a51`，完整日志 SHA256 `cf1a6ae25880a278b6080afc82f1fb8b092793c2ef74b77438357f421d1fe605`。23 阶段全部通过，没有失败、取消或未执行阶段；root 29、backup/update 12、client 5 及 central-runner 阶段也通过。测试级 1 个 Agent 和 9 个 Server SKIP 保留；最终候选源码和依赖未变，进程清理确认、全局锁已释放。

本报告是严格文档后继；交付时仅新增此附录，应用门禁的实际被测源码仍为 `f92fec71`，不将文档提交标为另一次完整运行。文档已检查格式、语法、链接及 GFM 渲染。

上述完整检查是最终候选门槛。子进程清理失败、失败/取消/跳过和未执行阶段分别报告；定向通过或后来清理成功不替换失败阶段。文档后继只做格式、语法、链接和渲染检查；若再改源码或测试，须重新运行受影响检查。

## 历史评价与未闭合风险

[原五轮报告](https://github.com/utopiafar/mote/blob/74da386f33adde6521d5dd3435bf9643da89f495/docs/validation/plugin-extension-benchmark/REPORT.md)仍为完整案例 **0/5**、另 **7 项 NOT RUN**，严格冻结探针 **0/6**。source 发布和文本 Transcript 子路径不能代替完整洞察/Memory/query/UI、图像、ASR 或原生 Harness 验收；扩展自有模型调用和持久触发器等缺口没有由本次维护补齐。

[原完整检查记录](https://github.com/utopiafar/mote/blob/74da386f33adde6521d5dd3435bf9643da89f495/docs/validation/plugin-extension-benchmark/final-validation.md)中的原受影响检查退出 1，补充 Server、Web、release integration 也失败。UTF-8 fixture 与一个跨 worktree 类身份问题的局部归因，不解释全部 Memory/导入/关闭/超时/进程清理失败；当前修正不把原收据改绿。

[原存储诊断](https://github.com/utopiafar/mote/blob/74da386f33adde6521d5dd3435bf9643da89f495/docs/validation/plugin-extension-benchmark/storage-diagnostic/README.md)的两次新 vault 持久 SQLite 损坏发生于插件实例创建/调用前，原 G5 保持 **FAIL_HOST_STORAGE**，根因仍为 **UNKNOWN**。一次带 trace 的基线通过和当前公开回归通过均不能排除该风险；原失败数据库、完整 trace/helper/输入未归档，摘要哈希不能还原它们。

Android 此次证据限于生成数据、JVM 与独立无窗口 emulator；物理/OEM 设备、真实模型/provider、新的独立账号切换/stop instrumentation 重跑及单独的 managed-model polling 问题不在这批新增检查范围。扩展实验没有新增真实浏览器、原生日历写入或部署验证，也不将 PR184 的既有实际模型证据算作新的扩展验收。
