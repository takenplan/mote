# Mote Wire 2 与 Ingress 3

本文描述当前生产入口 `buildScopedApp` 的操作与数据合同。机器声明见 [contract.json](../protocol/contract.json)，握手与生成 fixture 见 [Wire compatibility](../protocol/README.md)。Central 使用 epoch 5，Desktop / Android 本机格式为 4，个人便携归档为 version 3；这些版本与产品版本、页面字段版本和备份 manifest 版本分别独立。旧 Wire 1、Ingress 2、owner token 和旧库不作为生产兼容入口，跨代处置见[更新说明](updating.md)。

## 认证与连接

`GET /api/health` 公开返回 `{ok,mode,protocol,storageEpoch,authentication,privateCapabilities}`，当前为 `multiuser-auth`、`{min:2,max:2}`、epoch 5 和 `username-password`，没有产品 `version` 字段。健康、能力列表和握手均不授予私人访问权限。

账号使用用户名密码登录。原生/API 客户端发送 bearer 凭据与 `X-Mote-Protocol-Version: 2`；Web 使用服务端 HttpOnly 会话 cookie，并发送当前会话绑定和 CSRF 头。身份来自认证上下文，不能由请求中的 userId、路径或模型内容选择。公开登录、票据交换、邀请兑换和 PKCE poll/ACK 使用各自临时凭据合同，不能据此匿名访问私人 API。具体旅程见[账号与设备连接](connections.md)。

`GET /api/connections/self` 返回 `{account,credential,protocol,capabilities}`，协议范围在顶层。客户端核对整数范围及重叠、准确部署/账号/设备和能力后使用连接，不把缺失信息当作旧服务器兼容。`archiveRead:false` 是此接口的能力投影，实际私人读取由账号会话和对应路由授权决定。

设备邀请 v2 固定部署、账号、origin 和 `purpose:device`。设备凭据只允许自身 ingress、获准 Actions、self 与 logout，不能浏览私人归档、管理、签发其他凭据或批准登录。MCP 凭据另按只读或明确来源写入授权。实例管理员的管理权限不提供其他账号私人资料的选择器。

默认监听 `127.0.0.1:47832`。远程部署使用 HTTPS，邀请只接受 HTTPS 或 loopback HTTP。手机上的 localhost 指手机自身。客户端不跟随重定向向另一 origin 传递凭据。

## Capture upload

所有 `/api/ingress/*` 请求另外发送 `X-Mote-Ingress-Version: 3`。先注册当前账号设备与来源：

| 操作 | 路由与正文 |
| --- | --- |
| 注册设备 | `POST /api/ingress/devices`：`{id,name,platform}` |
| 设备状态 | `POST /api/ingress/devices/heartbeat`：heartbeatSchema 的实际设备状态 |
| 注册来源 | `POST /api/ingress/sources`：sourceConnectionSchema 的稳定来源、设备、平台与保留方式 |
| 更新来源 | `PATCH /api/ingress/sources/:id`；注册不能重新启用已暂停来源 |
| 上传采集 | `POST /api/ingress/sources/:id/captures`：`{batchId,items:[CaptureInput,...],importDeclaration?}` |
| 上传来源版本 | `POST /api/ingress/sources/:id/items`：`{batchId,items:[SourceItem,...],importDeclaration?}` |
| 读取接收凭据 | `GET /api/ingress/sources/:id/receipts/:batchId` |

一次批次为 1–500 项，batchId 长度为 1–256。采集 JSON 请求体上限为 16 MiB。压缩发送仍使用同一 captures 路由，Content-Type 为 `application/x-ndjson+gzip`，`X-Mote-Batch-Id` 固定该批身份；不切换到旧 `/api/captures`、`/batch` 或 `/bundle`。解包和单项校验仍适用；413 可拆小批次，单条仍超限时保留失败记录。

采集对象继续使用[共享 CaptureInput schema](../packages/shared/src/index.ts)。来源、设备及 platform 必须与注册和凭据范围一致，采集不能伪造来源 provenance。同批身份和内容幂等返回原回执，同身份不同内容冲突。正文、UUID、观察时间和图片字节在重试中不变。暂停、撤权、墓碑和真实冲突分别处理，不以新 ID 绕过。

接收凭据为 `{version:3,id,deploymentId,userId,sourceId,batchId,state:'received',captures:[...]}`，成员包含服务端确认的采集 ID、重复状态及存在时的原件引用。客户端验证准确部署/账号/来源/批次、成员身份和原件散列/大小后，才清理待传输入。HTTP 200 或任务状态不能代替校验。回执只证明接收，不证明 OCR、索引、Memory 或问答可用。

## Activity-only and metadata

每次样本保留独立观察身份，图片按内容散列复用，同图不合并观察时间。`durationMs` 为 0–300000 的实测采样覆盖，不是持续注意力。每设备先去除重叠再计算应用活动，设备之间不合并为连续使用时长。

应用规则在本机解析为 `content`、`activity` 或 `off`。off 不创建记录，activity 不取得像素、窗口标题或正文。应用标识存在时应用名也必须存在；未知名称使用明确标签，不从正文猜测。活动不制造正文或 embedding 工作，媒体/通知的 activity 模式也不读取对应私有文本。

可选元数据采用严格的 [recordMetadataSchema](../packages/shared/src/metadata.ts)。元数据观察时间、capturedAt 和首次 receivedAt 分别保留，未知值不补零。文件来源可保留系统给出的创建、修改、访问及删除观察时间；已不可见不证明人为删除。同一不可变版本重试不能重新测量这些字段。

当前截图发送空 `ocrText` 与 `ocr.status=disabled`，本机 OCR 仅服务隐私规则，不作为归档正文。中央 OCR、图片理解和索引是独立产物。Android 页面字段使用 `metadata.uiPage.version=2`，保存对象原文、可靠 URL/item ID、观察时段和 `visible_window` 覆盖，不上传 UI 节点、坐标或图片。Desktop 的 v1 页面形状是另一条当前字段合同，不等于支持 Wire 1。详见[页面采集](ui-page-capture.md)、[媒体上下文](media-context.md)和[通知/设备事件](android-system-events.md)。

## User notes / 随手记

笔记以 `source:note`、时长 0、无图像、非空原文保存，正文最多 100000 字符；可选 mood 是用户提供的非空自由文本，最多 80 字符，不由模型或关键词推断。原生离线笔记使用来源绑定的采集通道，中央 Web 命令保存同类证据。笔记不需要屏幕权限。

提交前持久保存准确 UUID、时间和正文，丢 ACK 后重用原身份。主动再写相同正文可以有新 UUID。未同步草稿属于客户端，不因中央导出而自动备份；换号、换节点和存储失败不能把旧草稿或队列归给新账号。

## 版本化外部来源

SourceItem 使用稳定 externalId、不可变 revision、原文、观察时间及已知元信息。中央维护头指针和历史，重试不覆盖内容。来源说明是用户控制的版本化上下文，不由标题、路径或第一人称推断身份，修改不补发历史付费处理授权。

文件原件使用同一个 Ingress 3 归属和确认边界：

1. `GET /api/ingress/sources/:id/head?externalId=...` 读取前驱。
2. `POST /api/ingress/sources/:id/uploads` 发送 `{batchId,revision:<FileRevision>}`，返回归属、upload id、4 MiB partBytes、已确认 parts 或最终 receipt。
3. `PUT /api/ingress/uploads/:id/parts/:part` 发送 `{bytes:<base64>,checksum:<sha256>}`，沿原会话补缺失块。
4. `POST /api/ingress/uploads/:id/commit` 发送 `{}`，复核完整原件后返回 Ingress 3 凭据；`GET /api/ingress/uploads/:id` 查询结果。

snapshot 临时输入恢复另使用服务端给出的 recoveryId 与原身份，不能改发不同字节。引用模式不读取、哈希或发送正文。文件解码、OCR、ASR 和语义处理在中央，端侧仅授权、发现、过滤、固定输入和发送。生命周期、原件保留和当前限制见[文件](files.md)。

## Read API

私人读取使用当前账号和真实资源身份。资料库、原文、Material、Memory、文件、对话和任务路由分别校验范围，能力目录不是授权。同步 `POST /api/query`、`POST /api/insights` 及持久 `/api/query-runs`、`/api/insight-runs` 仍由当前 Ask 宿主注册，具体请求/状态见[Agent](agent.md)和[对话](conversations.md)。同名 URL 不表示沿用旧 owner 身份或 DTO。

`POST /api/ingress/devices/:id/reconcile` 正文为 `{ids:[...]}`，最多 100 个采集 UUID，返回 `{checkedAt,items:[{id,state:'present'|'unavailable'}]}`。它检查本账号、显式设备及获准来源的可见记录，设备凭据只查自身设备；结果不是上传 ACK，不改变本机清理期限。

模型检索和引用保持显式设备/时间范围、分页、准确版本和删除栅栏。原文、OCR、字段、附件与派生产物是不可信证据，不能指挥 Agent 或增加权限。原图披露另需获准，原件引用不表示模型已看原图。

## Screenshot albums

Session 按同设备、同应用连续样本组织；超过五分钟间隙、切换应用或未知应用身份会分组，正好五分钟不分组。分组在分页前计算，稳定 ID 选择准确成员。App 相册使用固定十五分钟时钟桶。分组只说明观察范围，不推断主题、任务或持续阅读。

列表先读有界元数据，图片及原文按需打开。中央读取绑定当前账号和设备/日期范围，本机与中央因保留不同可有不同分组。详情、图片及分页请求以当前[采集浏览路由](../apps/server/src/scope/capture-browser-routes.ts)为准，不开放旧全局 capture-gallery API。界面及索引责任见[相册](capture-albums.md)。

本文整理没有重新运行协议、设备、模型或端到端测试。历史验收保留原冻结输入。
