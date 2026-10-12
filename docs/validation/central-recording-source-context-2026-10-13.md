# 中央录音来源说明与保存验证

日期：2026-10-13。范围为中央录音详情页的保存层级、选填资料说明和通用来源管理入口。此前已批准的版本化元信息政策不变，见[录音来源设计](../recorder-connectors-design.md#来源说明与保存)及[回归场景](../testing-recording-source-context.md)。用户确认安卓未显示说明是旧版本问题，因此未新增安卓业务行为；Android 英文 catalog 随中央新文案同步。

| 实际检查 | 结果 |
| --- | --- |
| 中央生产构建、最新 Web 构建与类型检查 | 通过 |
| 翻译及 Android catalog | 8087 条双语文案与调用位置检查通过 |
| 受影响 TypeScript 检查 | `check:affected` 选择的 `check:local` 通过；Desktop 433、Server 1530、Web 352、Agent 271、Diagnostics 5、Shared 178 项通过；Server 和 Agent 各 1 项既有环境检查跳过 |
| 相关 Web 用户路径 | 录音设置 10 项、来源说明编辑器 9 项均通过；包含原样文本、清空、CAS、丢 ACK 重试、先确认说明后启用、仅说明不重启同步、节点/来源切换及晚响应隔离 |
| 脚本与运行器 | 63 + 4 项通过；中央运行器生成数据生命周期检查通过；最终 fixture 脚本类型检查通过 |
| 实际浏览器 + 正式中央路由 | 生成飞书、钉钉账号各自完成真实登录、连接、说明保存与同步；PATCH 200 ACK 先于 selection；刷新保留；版本更新与清空可从正式 Material 读取；来源间不串说明；纯说明保存不提交 selection |
| 音频与布局 | 打开设置不读取音频正文，主动回听才读取中央备份；生成 WAV 时长 1 秒；桌面主次操作分行、430 px 无横向溢出；最新帮助文字单列布局已人工查看 |
| Android debug JVM | 指定 JDK 17 与 SDK 后 303 项通过，0 失败、0 跳过 |
| PR 前最终 `check:affected` | 显式设置 JDK 17 和 SDK，整条命令 exit 0；TypeScript 检查重新通过，Gradle 确认相同输入的已通过单测结果为 up-to-date |

首轮 `check:affected` 的 TypeScript 阶段完成，默认环境在最后的 Gradle 启动时因找不到 Java 运行时退出 1；Android Studio 自带 Java 25 的补跑亦未能启动这套 Gradle 构建。随后使用既有 JDK 17 和显式 SDK 路径单独运行所选的 `:app:testDebugUnitTest` 成功，没有将原整条命令记为 exit 0。PR 前在最终源码上重新执行完整 `check:affected`，环境修正后的整条命令 exit 0；Android 单测复用同一输入的有效 Gradle 结果，不声称再次执行了全部用例。最终 Web 样式变更已重新构建并执行完整浏览器回归；最后的脚本类型检查、翻译检查及差异空白检查通过。

浏览器只使用生成转写、音频、隔离数据库和随机令牌，零真实模型调用。截图和结果位于忽略目录 `.mote/recordings/`，不进入版本库。未执行真实厂商账号、物理设备、真实模型或本轮 Android 模拟器验证。改动尚未发布或安装到用户正在运行的中央服务。
