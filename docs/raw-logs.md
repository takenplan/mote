# 原始日志与日志中心

桌面与 Android 的本机日志查看器读取文件文本，不翻译字段或重排记录；损坏或未完成文本保留显示。当前 Central 的实例日志 API 则只投影固定运维元数据，不能通过“原始日志”取得个人内容或 trace。界面保留手动刷新、选择、复制和自动换行；剪贴板不可用时，Web/桌面提示键盘复制。

- Web：开发者选项 → 日志中心；选择 `central.0.ndjson` 当前文件或编号更大的历史轮转文件。API 为 `GET /api/diagnostics/logs?file=0`，只允许管理员会话，返回禁止缓存的 `text/plain`。当前宿主先按白名单投影实例运维事件，即使磁盘旧文件含私人 trace，也不会原样返回这些内容。
- 日志中心支持按阶段筛选并分页；分页 API 为 `/api/diagnostics/log-pages`。当前安全投影保留系统与请求类别，其他阶段筛选不能绕过投影读取私人事件。
- 桌面：开发者选项 → 查看本地日志；读取 `events.json`，上限 256 KiB。
- Android：本地日志查看器；读取应用私有 `support-events.json`，上限 256 KiB，长按选择复制。

日志在写入端带级别：阶段开始为 debug，成功/停止/正常过滤为 info，等待调度或缺少权限/模型等状态为 warn，操作失败为 error。中央节点的 4xx 阶段失败为 warn，5xx 为 error；debug 事件需要开启中央调试日志。

早期版本补充的来源、处理和端侧阶段事件见下方历史记录；是否存在某类事件，以当前宿主实际注册和本机诊断开关为准，不能据旧事件名假定中央实例日志包含私人查询过程。

实例诊断、本机日志和个人 Agent 过程是不同入口。实例 `diagnostics.debug` 只控制固定运维事件的 debug 级别；Dev 的默认 debug 不开启个人详细记录。当前每个账号的 `agentTrace.traceEnabled` 在所有 Profile 中默认 false，由本人在「记录详细 Agent 过程」或 Agent 视角设置中显式开启，可立即关闭；它保存在本账号配置中，不使用旧实例 `diagnostics.traceEnabled` 开关。

启用后，Ask 的上下文、prompt、模型输出和工具 payload 可作为私人 trace 保留在账号运行记录中，经 `/api/agent-view/runs` 与 `/api/agent-view/events` 读取，必须满足账号、运行和证据的有效性检查。关闭会停止新增详细 payload，不追溯删除已有历史；固定阶段元数据仍可存在。详细值不写入实例 central 日志，管理员管理身份不会取得他人的私人 trace。服务器部署者仍处于受信任边界内，这不构成端到端加密。

安全支持包继续只导出实例固定字段白名单，排除个人 trace 正文、请求正文和凭据；原生日志也不应包含截图、OCR 原文、令牌、模型对话或任意异常文本。Dev 默认每份实例结构化日志 100 MiB、3 份，其它 Profile 为 2 MiB、3 份；个人 trace 的容量边界仍使用实例现有 maxBytes/maxFiles/maxEntries，并保留显式截断。具体配置和输出边界见[日志配置](server-configuration.md#日志与调试)及[排错](troubleshooting.md#配置)。旧日志不会在查看时重写或补级别。

## 验证

下面记录既有合成验证范围，本次文档整理没有重新运行测试；当前账号 trace 与实例安全投影以 [Ask trace](../apps/server/src/scope/ask-traces.ts) 和[管理路由](../apps/server/src/scope/management.ts)为准。

使用合成数据验证原文（含空白、中文、损坏 JSON 和 HTML 字符）保真、读取上限、级别持久化、鉴权、日志轮转和复制/选择行为。Android 编译与 JVM 单元测试不等同于 Android 真机界面验证；未进行真机采集或真实模型调用。

## 历史 0.0.23 新主线复查

- 中央文件 API：`file_upload`、`file_part`、`file_commit`、`file_revision` 有开始/完成/失败事件；请求另含 HTTP 方法和固定路由类别。
- 中央文件处理：`file.started/completed/failed` 含文件任务 UUID、批次请求 UUID、尝试次数与耗时。可重试失败记录 `retryAfterMs`；达到尝试上限不会声称还有下一次重试。`file.step.*` 区分 extract、diarize、align、turns、summary；`file.cached` 表示复用已完成检查点。
- `file.blocked` 使用固定原因（未配置、仅归档、不支持格式、每日预算、本地处理禁止云摘要等）；配置更改或停机导致的取消记录 `file.cancelled`，不作为模型故障。
- Android：后台界面任务、文件扫描/准备/上传/分块/提交和批量去重记录固定阶段、耗时与结构化失败类别，不记录 UI 标签、文件路径、文件名或服务响应。
- 桌面：来源扫描与设置、连接、更新等后台操作增加阶段日志。HTTP 失败保持 AUTH/CONFLICT/SERVER 等传输类别。
- 复查并修复 `UiTask` 的执行器拒绝分支：拒绝结果走正常界面完成回调，清除忙碌状态；新增合成仪器回归。原日志分页/级别筛选测试更新为原文保真和文本选择测试。

端点日志须启用本机诊断开关；中央 debug 开始事件须开启 debug 级别。Android 实际日志文件为应用私有 `support-events.json`。
