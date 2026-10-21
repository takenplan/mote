# 中央模型服务

当前中央采用[多用户配置合同](design/multiuser-configuration.md)。账号登录后在 **设置 → 模型与服务 → 模型连接（Provider）** 创建个人连接，选择服务商类型、填写地址和自己的凭据，查询模型目录或手动填写 ID，按需测试，再 **保存并应用**。目录查询和测试可以使用尚未保存的个人草稿，不要求先激活连接。多个模块可使用同一套个人连接并选择不同模型，无需重复保存自己的密钥。

| 连接归属 | 账号可以做什么 | 配置与秘密边界 |
| --- | --- | --- |
| 个人连接 | 创建、编辑、查询目录、测试、复制自己的连接，并分配给模块 | 当前账号私人 YAML 的 `models.profiles`；不展开环境变量，不支持宿主 Codex 登录协议 |
| 实例共享模型 | 选择只读资源引用，查询其目录或测试固定连接 | 管理员维护完整连接；账号目录仅显示 ID、名称、Provider、模型和只读状态，不向个人复制地址或秘密，也不能覆盖共享模型 ID |
| 本机 Codex | 选择管理员提供的共享 Codex 资源 | CLI 可执行文件、登录 home 与凭据属于实例宿主；个人不能提供另一套 executable/home 或借用其他账号连接 |

**模型与服务 → 模块与模型** 为 Chat、Memory、个人回顾、资料导入、文件分析、OCR、ASR 和 embedding 保存当前账号的功能选择。个人连接可以 **跟随预设默认** 或 **指定此 Provider 下的模型**；共享资源只能整体选择其固定引用。换连接会清除该模块原来的个人模型覆盖。目录来自所选连接；不支持目录的服务仍可手动填 ID。模型与处理器的具体适用范围见[文件策略](file-processing-policies.md)和[配置归属](configuration-ownership.md)。

问答、记忆、洞察等支持单次选择的入口保留 **本次模型**。本次明确选择连接时，使用该连接；个人连接上的本次模型覆盖优先于其默认模型。未显式换连接时，采用功能的 `models.selections`，个人功能覆盖优先于个人连接默认模型。共享连接始终使用管理员固定的模型，不能通过临时模型覆盖改成另一个 ID。本次选择不修改功能默认值。没有按内容、关键词或模型失败自动切换供应商的逻辑。

实例的 `models.deployment`（资源 ID `env:deployment`）和已配置的实例 `models.profiles` 提供共享资源。普通账号看到的资源只读；管理员通过 **共享模型资源** 页面或实例配置事务维护它们，不能通过个人配置接口管理另一账号。`env:deployment` 是固定资源 ID，不表示环境变量会覆盖 YAML。当前宿主不挂载旧单所有者 `/api/model-settings*`，不读取或迁移旧 `default` 预设。

个人预设可以命名、编辑、复制、删除，最多 30 个。复制仅限当前账号已保存的个人连接，默认包含自己的凭据，也可选择不包含；服务器内部复制不会把秘密回传浏览器。共享资源不能复制成携带共享秘密的个人预设。副本独立持久化，更换地址仍需确认复用。专用编辑器阻止删除仍被功能引用的个人连接，并要求确认删除未引用连接；历史问答保留。

新准入请求使用已保存的新配置。模型 lease 固定实际连接、模型、个人及实例配置版本、价格和授权身份；正常调参不将执行中的请求换到新模型，重启恢复也不能静默借用当前配置替代原快照。共享模型的输出预算、推理、速度或期限调整作用于新准入；移除资源、更换共享 transport/凭据、账号重置/禁用/删除和个人凭据撤回仍执行当前授权 fence。普通登出不取消已经准入的工作。Memory 和 Files 另保留自己的相关配置指纹与提交检查，不能由快照规则豁免。不可用的引用或无法恢复的快照明确等待/报错，不自动换供应商或补发旧任务授权。

设计参考了 [Open WebUI 的连接管理](https://docs.openwebui.com/getting-started/quick-start/connect-a-provider/)与[模型预设复制](https://docs.openwebui.com/features/workspace/models/)。Mote 采用“可复用连接 + 模块模型绑定”，不在连接预设里加入提示词、资料权限或 Agent 工具权限。

模型名称留给用户填写，因为可用模型、地域、账户授权和工具调用能力会变化。某功能未选择资源或连接未配置完整时，该功能明确显示未配置，不回退到部署模型；采集、同步、笔记和资料归档仍可使用。中央图片处理及 embedding 索引还需各自的设置和授权，连接存在不代表自动启动处理。

## 保存、测试与凭据

个人连接的 API key、自定义请求头和高级请求参数只显示“已配置／未配置”，不会读取旧值回填。每项可选择不改动、填写新值或清除；请求头和高级参数按整个 JSON 对象替换。遮罩只绑定同一账号、同 ID、同 revision 的已保存秘密，新 ID 不继承凭据。未保存的输入只保存在当前页面内存；保存后使用服务器返回的遮罩视图。

更换服务商、协议或服务地址时，如果仍保留任一已有密钥、请求头或高级参数，需要明确勾选允许复用，也可以改为填写新值或清除旧值。这项确认同时适用于草稿目录、测试和遮罩保存；它不是持久的自动复用政策。管理员编辑共享连接也保留相同的凭据复用决定，普通账号不能提交共享连接草稿或秘密。

**测试连接**由中央节点向所选固定连接或个人草稿模型发送少量合成内容，并使用独立的合成记录验证工具调用和引用。测试不连接个人资料库，不上传个人截图、OCR 或笔记，也不会保存草稿、修改功能选择或创建 Ask 任务；请求可能产生模型费用。测试的 Agent 期限为 30 秒，HTTP 单次请求期限取所配值与 30 秒中的较小值。测试成功表明本次连接和工具往返通过，不代表全部问题的回答质量或长期可用性。目录与探测在传输及返回前复核账号、revision、连接和共享资源代次，过期响应不能覆盖新账号或配置。

要使用部署模型，在功能选择中显式选择共享部署资源；要重新选择或清空功能默认值，通过同一账号的配置事务保存。当前没有旧 `/api/model-settings` 的“恢复部署配置”写入流程。并发 revision 冲突时重新读取对应账号或实例文件，保留尚未提交的选择后再决定如何修改，不能用旧 revision 自动覆盖。

## 服务预设

当前有 24 项预设，包含自定义入口、本机服务及腾讯混元原平台。预设只是填写地址和协议的起点，不表示该平台的所有模型都支持 Mote 所需的流式工具调用。地址仍可修改；模型 ID 以对应控制台为准。

表中的 Chat、Responses、Messages、Gemini 分别对应下一节的协议。正式远程 API 都需要对应服务的 API key；Azure 使用资源 API key，Ollama、LM Studio 可显式启用本机免密。

| 服务 / provider ID | 默认协议 | BaseURL | 官方接入资料 |
|---|---|---|---|
| 本机 Codex / `codex` | Codex App Server | 无 HTTP 地址 | [官方 App Server](https://developers.openai.com/codex/app-server) |
| 自定义 / `custom` | Chat | 用户填写 | 选择下列已支持协议 |
| DeepSeek / `deepseek` | DeepSeek | `https://api.deepseek.com/anthropic` | [API](https://api-docs.deepseek.com/) |
| 阿里百炼 / `qwen` | Chat | `https://dashscope.aliyuncs.com/compatible-mode/v1` | [OpenAI 兼容](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope) |
| 火山方舟 / `ark` | Chat | `https://ark.cn-beijing.volces.com/api/v3` | [接入说明](https://www.volcengine.com/docs/82379/1795150) |
| 智谱 GLM / `glm` | Chat | `https://open.bigmodel.cn/api/paas/v4` | [工具调用](https://docs.bigmodel.cn/cn/guide/capabilities/function-calling) |
| Kimi / `kimi` | Chat | `https://api.moonshot.cn/v1` | [Chat API](https://platform.kimi.com/docs/api/chat) |
| MiniMax / `minimax` | Chat | `https://api.minimax.cn/v1` | [OpenAI 兼容](https://platform.minimax.cn/docs/api-reference/text-chat-openai) |
| 百度千帆 / `qianfan` | Chat | `https://qianfan.baidubce.com/v2` | [Chat API](https://cloud.baidu.com/doc/qianfan-api/s/3m7of64lb) |
| 腾讯 TokenHub / `tencent-tokenhub` | Chat | `https://tokenhub.tencentmaas.com/v1` | [接入说明](https://cloud.tencent.com/document/product/1823/130058) |
| 腾讯混元原平台 / `hunyuan` | Chat | `https://api.hunyuan.cloud.tencent.com/v1` | [兼容接口](https://cloud.tencent.com/document/product/1729/111007) |
| 硅基流动 / `siliconflow` | Chat | `https://api.siliconflow.cn/v1` | [Chat API](https://docs.siliconflow.cn/docs/api/chat-completions-post) |
| 讯飞星火 / `spark` | Chat | `https://spark-api-open.xf-yun.com/x2` | [Spark-X2 HTTP](https://www.xfyun.cn/doc/spark/X1http.html) |
| 阶跃星辰 / `stepfun` | Chat | `https://api.stepfun.com/v1` | [Chat API](https://platform.stepfun.com/docs/zh/api-reference/chat/chat-completion-create) |
| OpenAI / `openai` | Responses | `https://api.openai.com/v1` | [Responses](https://developers.openai.com/api/docs/guides/text) |
| Anthropic Claude / `anthropic` | Messages | `https://api.anthropic.com` | [API](https://platform.claude.com/docs/en/api/overview) |
| Google Gemini / `gemini` | Gemini | `https://generativelanguage.googleapis.com/v1beta` | [工具调用](https://ai.google.dev/gemini-api/docs/function-calling) |
| Azure OpenAI / `azure-openai` | Chat | `https://资源名.openai.azure.com/openai/v1` | [v1 API](https://learn.microsoft.com/en-us/azure/foundry/openai/latest) |
| xAI Grok / `xai` | Responses | `https://api.x.ai/v1` | [Responses](https://docs.x.ai/developers/rest-api-reference/inference/responses) |
| Mistral / `mistral` | Chat | `https://api.mistral.ai/v1` | [Chat API](https://docs.mistral.ai/api/endpoint/chat) |
| Groq / `groq` | Chat | `https://api.groq.com/openai/v1` | [OpenAI 兼容](https://console.groq.com/docs/openai) |
| OpenRouter / `openrouter` | Chat | `https://openrouter.ai/api/v1` | [快速开始](https://openrouter.ai/docs/quickstart) |
| Ollama / `ollama` | Chat | `http://localhost:11434/v1` | [兼容范围](https://docs.ollama.com/api/openai-compatibility) |
| LM Studio / `lm-studio` | Chat | `http://localhost:1234/v1` | [工具调用](https://lmstudio.ai/docs/developer/openai-compat/tools) |

阿里提供按 Workspace ID 和地域区分的地址，例如 `https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`；原 DashScope 地址仍可使用，密钥必须与地域匹配。[地域说明](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope)

方舟的模型栏可填写模型 ID 或推理接入点 ID。Azure 的模型栏填写部署名称，Mote 将填写的 API key 放入 `api-key` 请求头。千帆使用新版 Bearer API Key，不使用旧版 OAuth `access_token`。[方舟](https://www.volcengine.com/docs/82379/1795150)、[Azure](https://learn.microsoft.com/en-us/azure/foundry/openai/latest)、[千帆认证](https://cloud.baidu.com/doc/qianfan-api/s/ym9chdsy5)

腾讯建议新接入使用 TokenHub；从原混元平台迁移需要同时更换地址和新建的 API key。MiniMax 当前官方地址为 `api.minimax.cn`；使用其 Messages 接口时，将协议改为 `anthropic-messages`，地址改为 `https://api.minimax.cn/anthropic`。[腾讯迁移](https://cloud.tencent.com/document/product/1823/131382)、[MiniMax Messages](https://platform.minimax.cn/docs/api-reference/text-anthropic-api)

星火的 API key 栏填写 HTTP 服务的 **APIPassword**，通过 Bearer 认证；预设地址对应 X2，其他版本按控制台选择地址。阶跃星辰的按量 API 与 Step Plan 套餐地址不同，使用套餐时改为 `https://api.stepfun.com/step_plan/v1` 并选择套餐可用模型。[星火认证](https://www.xfyun.cn/doc/spark/X1http.html)、[阶跃接入](https://platform.stepfun.com/docs/zh/api-reference/chat/chat-completion-create)

## 协议与高级选项

| 协议值 | 用途 |
|---|---|
| `codex-app-server` | 通过服务器本机 Codex CLI 的 App Server stdio 协议与本机登录调用 Codex |
| `deepseek` | DeepSeek 原生 Messages 适配，处理思考签名、多轮工具调用及图片输入 |
| `openai-completions` | OpenAI Chat Completions，以及实现相同消息、流式和工具格式的兼容服务 |
| `openai-responses` | OpenAI Responses 格式的文本和工具往返；Mote 固定关闭服务端会话存储参数 |
| `anthropic-messages` | Anthropic Messages 的消息块、工具调用和流式事件 |
| `google-generative-ai` | Google 原生 Gemini API，保留工具调用所需的思考签名 |
| `mote-media` | OCR/ASR 的处理运行时连接；不作为普通查询 Agent 的语言模型协议 |

HTTP 语言模型协议使用 DeepSeek Harness 和 pi-ai；Codex 使用独立 App Server 适配器。两者共享证据工具定义、宿主范围限制与最终引用校验。选择协议不增加模型工具权限；媒体服务使用独立的处理合同，不能用普通查询工具探测替代其健康检查。这里只支持上述协议，不是任意请求／响应 JSON 的字段映射器；使用其他协议需要新增适配代码。

BaseURL 应填写服务基址，不是具体推理方法的完整 URL。保留厂商要求的 `/v1`、`/api/v3` 等路径前缀，不要自行给所有厂商补 `/v1`。地址禁止用户名、密码、查询参数和 fragment；远程必须使用 HTTPS，仅 `localhost`、`127.0.0.1`、`[::1]` 允许 HTTP。模型请求拒绝重定向。

Harness 0.2.0-rc.2 的 `deepseek` 协议使用 `/v1/messages`、`x-api-key` 和 `output_config.effort`。已有官方根地址 `https://api.deepseek.com` 或 `/v1` 在运行时转为 `/anthropic`；自定义网关路径保留原值。仍提供 Chat Completions 的网关应显式选择 `openai-completions`。官方模型目录继续通过 Bearer 认证读取 `/models`。

Mote 在查询与导入运行时显式关闭 Harness 会话日志和插件清单上传。图片仍内联发送；原生适配器尝试 Files API 时，Mote 在网络请求前拒绝上传，使用上游的内联回退，因此不会引入额外的远程文件留存。原有图片授权、去重、区域读取及宿主预算继续生效。

远程配置必须填写 API key，即使自定义请求头另有认证字段也不能省略此栏。无需密钥的本机模型必须显式允许免密；“本机”指中央节点所在机器，Docker 的回环地址指容器自身。Mote 不自动启动本地模型服务或下载模型。

推理强度通常选择 **由模型决定（`auto`）**，避免发送模型不接受的通用推理字段。也可按所选模型支持情况设置 `off`、`low`、`high`、`max`；DeepSeek 预设保留既有的 `high` 默认值，仍可改成 `auto`。这些选项不保证每个平台的含义相同，也不保证每个思考模型都能关闭推理。

自定义请求头是字符串键值 JSON 对象；高级参数是符合当前协议的 JSON 对象，例如模型支持时的 `{"temperature":0.7}`。它们可以包含凭据，因此同样只写入、不回显。Mote 拒绝用这些参数覆盖模型名称、消息、系统提示、工具、输出上限、请求目的地或受保护传输头；输出上限应在专门的设置项修改。

Chat 协议下，OpenAI、Azure 和 MiniMax 使用 `max_completion_tokens`，其余预设使用 `max_tokens`。自定义网关若要求前一种字段，可选择 OpenAI 预设后编辑服务地址。MiniMax 默认加入 `reasoning_split:true`，使思考内容与最终回答分离；可通过高级参数显式覆盖，该参数不关闭思考。

模型能力仍需分别确认，尤其是工具调用与流式能否同时使用、思考内容是否需要在多轮工具中保留、输出 token 的计数方式，以及采样参数是否支持。例如部分 Qwen 思考模型要求流式，MiniMax 的 `reasoning_split` 只改变输出格式，千帆的两种输出 token 上限统计范围不同。[Qwen 思考](https://help.aliyun.com/zh/model-studio/deep-thinking)、[MiniMax 参数](https://platform.minimax.cn/docs/api-reference/text-chat-openai)、[千帆参数](https://cloud.baidu.com/doc/qianfan-api/s/3m7of64lb)

## 本机 Codex

由管理员在实例共享连接中选择 **本机 Codex**，填写服务器账户可用的准确模型 ID；账号再把这个固定共享资源分配给 Chat、Memory、回顾、导入或文件分析。个人 `models.profiles` 不接受 `codex-app-server`，也不能覆盖共享 Codex 的模型 ID。它调用官方 `codex app-server --listen stdio://`，选中的上下文仍会交给 Codex 上游模型。[官方 App Server 协议](https://developers.openai.com/codex/app-server)

前提是 **运行中央节点的系统用户** 已安装 Codex CLI，并有文件形式的 Codex 登录凭据。网页不填写 Codex API key。只有桌面应用已登录、凭据仅在系统钥匙串时，还需要为服务器用户设置 CLI 的文件登录存储并登录：

```sh
codex -c 'cli_auth_credentials_store="file"' login
```

默认从服务器进程的 `CODEX_HOME` 或该系统用户的 `~/.codex` 获取登录文件。操作员可在实例 YAML 的 `models.codex.executable` 指定可信 Codex 可执行文件，`models.codex.home` 指定已有登录目录；这两个宿主字段保持重启合同，管理员实例配置事务保存也不等于立即生效。个人文件、个人配置 API、模型参数和模型工具不能设置它们。目录查询、探测、任务执行、工作记忆压缩和 Hindsight 适配器共用实例的有效宿主配置。Docker 部署需要容器内有 CLI 与受保护的可访问登录文件；宿主桌面程序的存在本身不够。

每次请求启动独立进程和临时 home，只链接登录文件，不继承个人 MCP、插件、hooks、历史会话或用户指令。查询使用只读沙箱、关闭环境访问与原生执行工具，动态工具仅调用 Mote 已有证据桥。当前验证过的 Codex 0.154.0 还会提供仅修改临时运行计划的 `update_plan`，不访问或修改用户资料。导入有单独的可写临时工作区，不接入归档查询工具；仍须经过原有预览、确认和宿主校验。

App Server 的动态工具接口为实验接口，兼容性取决于安装的 CLI。配置警告、额外审批请求、未知执行工具和错误返回会终止请求；不会降级为另一个服务商。设置中的“单次模型请求超时”对 Codex Server 不适用：App Server 不把内部模型生成作为 Mote 可见的单次 Provider 请求；Mote 只可选择是否设置“Agent 总运行超时”，它累计实际获准执行的 `turn`、工具循环与结果修正时间，不包含中央模型名额等待；留空则不设置 Mote 的执行时间预算。响应字节预算仍由 Mote 限制，输出 token 上限由 Codex 管理，页面的 HTTP 输出预算不传给 Codex。设置页从本机 `model/list` 读取所选模型的 `supportedReasoningEfforts` 和 `defaultReasoningEffort`；`auto` 不指定推理强度，Mote 的当前 `off` 选择对应 App Server 的 `none`，其余挡位按原值传给 `turn/start.effort`。目录不可用或手动填写目录外模型时，页面仍显示通用选项，具体支持情况须通过测试连接验证。

Codex 预设可独立选择 **速度模式：Standard / Fast**，不会改变推理强度。Fast 可用性取决于账户、模型、工作区和 CLI 版本，且会增加额度或费用消耗；页面按模型目录禁用明确不支持的 Fast，缺少速度目录时可用“测试连接”验证。保存后，查询、Memory、回顾、文件分析和导入均使用该预设的速度模式。Mote 在自己的临时配置中设置 `service_tier`，Fast 还启用 `features.fast_mode`，并将 `serviceTier` 传给 `thread/start`；Codex 目录和线程返回的 `priority` 是 Fast 的协议别名，Mote 统一映射为 `fast`；返回的线程档位不匹配时终止请求。当前 Codex 预设必须显式保存速度模式；缺少该字段的旧预设不自动补值，需要重新配置。[官方速度模式说明](https://learn.chatgpt.com/docs/agent-configuration/speed)、[配置参考中的档位映射](https://learn.chatgpt.com/docs/config-file/config-reference)

## YAML 配置与保存位置

页面和手改文件通过各自的 ConfigService 事务工作，但实例和每个账号使用不同文件、权限与 revision。私人配置路径由服务端认证上下文定位，不接受客户端指定账号或文件名。

| 文件 | `models` 内容 |
| --- | --- |
| 操作员选定的实例 YAML（`MOTE_CONFIG_FILE` / CLI profile） | `deployment`、共享 `profiles` 和宿主 `codex` 等实例设置；共享目录只公开固定引用的少量元数据 |
| `DATA/configuration/users/<服务端账号 ID>/mote.yaml` | 自己的 `profiles` 和按功能保存的 `selections`；初始可以为空，无自动部署回退 |

以下是**个人文件**的最小模型示例，需与该文件当前 `version`、`revision` 及其他领域一起保存。密钥占位需在私人文件中换成自己的字面值；个人配置不解析 `${NAME}`。个人功能默认值使用 `selections`，旧单所有者 `defaults/defaultModels` 不是该 schema 的字段。

```yaml
version: 1
revision: 0
models:
  profiles:
    - id: my-provider
      name: 我的模型连接
      settings:
        provider: qwen
        protocol: openai-completions
        baseUrl: https://dashscope.aliyuncs.com/compatible-mode/v1
        model: 填写控制台提供的模型ID
        apiKey: 填写自己的密钥
        reasoningEffort: auto
        maxTokens: 65536
        modelRequestTimeoutMs: 300000
        agentTimeoutMs: 3600000
        headers: {}
        extraBody: {}
        allowUnauthenticatedLocal: false
  selections:
    chat: {kind: personal, id: my-provider}
    memory: {kind: personal, id: my-provider, model: 另一可用模型ID}
    insight: {kind: shared, id: 'env:deployment'}
```

示例中的共享 `env:deployment` 必须已由管理员配置完整；不存在或撤回时明确不可用。将其改成其他管理员公开 ID 同样只保存引用，不把共享 endpoint、key、headers 或 extraBody 写进私人文件。个人引用可带 `model`；共享引用严格只有 `kind`、`id`。

只有**实例**敏感字段的显式 `${NAME}` 引用会解析操作员环境凭据；普通环境变量不覆盖文件。`headers` 和 `extraBody` 是 YAML 对象，也按敏感数据保护。实例中未修改的秘密引用在其他字段保存时保持引用。不要通过 shell `source` 执行配置，不要把真实密钥放进命令参数或提交到仓库。完整启动、实例示例和生效方式见[服务端配置参考](server-configuration.md)。

保存先统一校验、准备，再原子持久化并发布相关有效快照；需重启字段分别展示已保存值与有效值。每份文件的各领域共用该文件 revision，相同内容不会产生新版本；不同账号与实例不共用个人编辑号。`model-settings.json` 和旧全局 `/api/model-settings*` 不作为当前生产来源，不自动读取、转换或迁移。配置文件和自己的副本可能含真实密钥，0600 文件权限不等于加密。个人 portable 导出移除凭据和活动快照；完整实例备份有不同的恢复与秘密保护范围，见[部署与恢复](deployment.md)。

运行中无效文件或准备失败保留原有效模型，错误不泄露配置值。应用失败区分已保存候选与旧有效值；写入结果不确定时先读取配置状态再处理。模型配置改造不删除业务数据库、历史回答、授权或 Memory 检查点。

## 当前账号与管理员 API

个人接口只访问已认证账号的配置，遵守会话、CSRF 与协议要求；设备采集凭据和限权 MCP 凭据不能调用。管理员接口只编辑实例共享模型，管理员身份不会取得其他账号私人连接。读取视图隐藏秘密，成功与错误响应不回传凭据或底层模型异常文本。草稿、复制及目录/探测的完整结构见[模型连接工具合同](design/multiuser-model-tools-http.md)。

| 方法与路径 | 行为 |
|---|---|
| `GET /api/configuration` | 当前账号的 revision、各域 saved/effective、状态与遮罩秘密；不暴露其他账号路径 |
| `PUT /api/configuration/models` | `{revision,value:{profiles,selections},preserveRedactedSecrets?,allowCredentialReuse?}`，完整替换个人模型域 |
| `PATCH /api/configuration` | `{revision,patches:{models:…},preserveRedactedSecrets?,allowCredentialReuse?}`，同一账号多域事务 |
| `POST /api/configuration/reload` | 重新读取当前账号固定 YAML 路径并验证，不接受任意文件路径 |
| `GET /api/models` | 功能列表 `features`、共享只读目录 `shared`、当前账号遮罩连接 `personal` 和 `selections` |
| `GET /api/models/selection/:feature` | 当前功能所选引用、Provider、模型、个人/实例 revision；无隐式回退 |
| `POST /api/models/profiles/:id/copy` | `{revision,id,name,includeCredentials?}`，仅复制自己的已保存个人连接，默认包含自己的凭据 |
| `POST /api/models/catalog` | `{revision,reference:{kind,id},draft?,allowCredentialReuse?}`，查询固定共享资源或个人已保存/未保存草稿目录 |
| `POST /api/models/probe` | 同上，执行合成工具/引文探测，返回 `{ok,code,message,durationMs}`，不保存草稿 |
| `GET /api/usage` | 当前账号用量；带 `from/to/timeZone`、过滤、分组和分页参数时返回相应汇总与详情 |
| `PUT /api/usage/prices` | 保存当前账号的 Provider/模型价格到个人 `modelPrices` |
| `GET /api/admin/configuration/models` | 管理员读取实例模型域及其 revision，秘密仍遮罩 |
| `PUT /api/admin/configuration/models` | 管理员提交 `{revision,value,preserveRedactedSecrets?,allowCredentialReuse?}`，完整替换实例模型域；宿主字段保留重启合同 |

个人连接 ID 为 1–80 个字母、数字、下划线或连字符，以字母或数字开头；`default` 已退役。个人初始选择可以为空，没有强制 `primary` 或隐式部署连接。支持单次模型选择的 scoped 业务入口使用 `modelReference:{kind:"personal"|"shared",id}` 和可选 `modelOverride`，不是旧 `modelProfileId`；个人连接可临时改模型，不能改变共享固定模型。以各业务入口的严格 schema 为准。

`settings` 的基础字段为 `provider`、`protocol`、`baseUrl`、`model`、`reasoningEffort`、`maxTokens`、`modelRequestTimeoutMs`、`agentTimeoutMs`、`allowUnauthenticatedLocal`；共享 Codex 另有必填 `serviceTier`。`provider` 必须已由内置或受信模块注册，普通自定义地址使用 `custom`。语言模型名称为空时连接未配置完整，不会启动 AI；OCR/ASR 的受管理媒体服务有自己的字节处理合同。HTTP 语言模型地址只可在模型为空时留空；实例 Codex 地址必须为空，不能设置 HTTP 密钥、请求头或高级参数，个人连接则不接受 Codex 协议。非 Codex 的 `modelRequestTimeoutMs` 为 5000–600000 毫秒整数，`agentTimeoutMs` 可为 5000–3600000 毫秒整数或 `null`；Codex 的 `modelRequestTimeoutMs` 为 `null`。新 HTTP 模型预设的 Agent 执行预算默认一小时，已有显式数值保持不变。所有协议的 Agent 预算都排除中央模型名额等待，模型输出修正共享本次实际执行预算；工作流本身的策略另见[任务执行策略](task-execution-policies.md)。

在所编辑连接的 **高级设置 · 输出预算** 调整 HTTP 输出上限；共享连接由管理员编辑。默认值为 **65,536 tokens**，提供 8,192、16,384、32,768、65,536、128,000 档位和自定义输入；保存后用于新准入，重启后保留，在途请求仍使用原快照。已显式保存或在 YAML 中设置的值不会因软件升级被覆盖。单次响应预算包含正文、HTML 和服务商计入的推理 token，不是整个 Agent 任务的累计用量，也不等于字数、图片尺寸或文件大小。达到输出上限时会尝试一次更简短的完整回答；仍失败会显示明确的输出超限提示。

预算选择与真实模型复现记录见[回答截断与输出预算](query-output-budget.md)。

目录/探测的个人 `draft` 中，`apiKey`、`headers`、`extraBody` 可省略或使用匹配的布尔遮罩以保留同 ID 已存秘密，`null` 表示清除，提供新值表示整体替换。配置域 PUT 是完整替换：页面以 `preserveRedactedSecrets:true` 保留匹配的布尔遮罩；显式空字符串 key、空 headers/extraBody 对象用于清除。不要把旧单所有者 API 的“省略即保留”规则套用到完整域替换。修改 provider、protocol 或 baseUrl 后，保留非空秘密需要 `allowCredentialReuse:true`；协议和地址改变不自动复用凭据，也不自动尝试其他厂商。

无效参数返回 400，revision 冲突或缺少凭据复用确认返回 409，准备／保存失败返回 503。`config_commit_uncertain` 表示需要重新读取实际保存及生效状态；不能假定请求失败就一定未保存，也不能用旧 revision 自动覆盖。未配置或已撤回的模型引用明确不可用，不因此回退到其他连接。

预设地址来自上面的官方资料；项目自动化验证使用本机 HTTP 服务、合成凭据和合成模型响应。本轮未逐一调用厂商实网，协议 fixture 通过不等于所有服务和模型已经完成在线认证或质量验收。

## 用量与价格

在 **用量与费用** 为当前账号的精确 Provider/模型填写每百万 tokens 的输入、输出、缓存读取和缓存写入单价，支持 USD/CNY。价格保存在个人 `modelPrices`；新模型 lease 固定当时价格，改价不重写旧收据。日期、时区、过滤、Agent/模块/Skill/模型/Provider 分组、下钻和详情分页均按当前账号的数据计算；缺少价格或必要计量时保留“未估算”，已计量失败调用也保留。估算不是服务商账单；连接探测、媒体服务或绕过受控入口的请求不能被冒称已完整计入 Agent 用量。完整计量与缺失边界见[用量与查询进度](usage-and-query-progress.md)。

## 验证

本页在 2026-10-20 依据 scoped 配置、资源解析、lease、模型工具路由及 Web 消费者做静态文档核对，没有重跑测试、真实模型或部署。当前账号目录/草稿探测、共享引用、凭据复用和请求快照的既有执行范围见[模型工具](design/multiuser-model-tools-http.md)、[配置模型平价](validation/configuration-model-parity-2026-10-18.md)、[配置用量平价](validation/configuration-usage-parity-2026-10-18.md)和[配置资源消费者](validation/configuration-resources-parity-2026-10-18.md)。它们各自保留原输入及未验范围，不代表所有供应商或端侧完整验收。

Harness 0.2.0-rc.2 / Cordis 4.0.4 的分模块覆盖、合成全流程结果与兼容性边界见[升级验证记录](harness-upgrade-validation.md)。

原单所有者自动化覆盖配置持久化、凭据隔离、默认路由、逐次选择、热切换、旧文件拒绝和授权。原 `scripts/test-model-profiles-ui.cjs` 使用独立临时资料库与生成答案验证前端操作、凭据不回显、桌面及窄屏布局；该记录不证明当前账号级 Models 页面已完成同等验收。

Codex 测试分为协议模拟进程和真实 CLI + 本机合成 Responses 服务。后者验证 `initialize → thread/start → turn/start`、两轮动态工具、引用和查询工具清单：

```sh
npm run build:libs
MOTE_TEST_CODEX_BIN=/可信路径/codex node --test packages/agent/test/codex.test.mjs
```

这些测试不使用真实截图、个人资料或真实模型登录凭据。未执行线上模型质量验证或物理设备验证。

## 2026-09-17 原配置重构验证

2026-09-17，本机 Codex CLI **0.154.0**，从 `model/list` 读取 5 个可用模型，选择 **gpt-6-astra**。使用临时独立资料库和合成笔记执行：

- 真实连接测试通过（约 20 秒）：模型、证据工具与引用格式校验。
- 创建 Codex 预设 → 复制 → 将副本默认模型设为未使用的测试 ID → 为 Chat 显式指定目录模型 → `POST /api/query`。实际结果记录 `profileId=codex-copy`、`model=gpt-6-astra`，调用 `search_context`、`evidence`，返回正确时间及 1 条有效引用（约 21 秒）。
- 未连接个人资料库、未采集个人截图；真实推理由 Codex 上游完成。未进行物理移动设备验证。

原宿主的真实测试脚本为 `node --import tsx scripts/test-codex-provider-live.ts`（需要服务器用户的 Codex 文件登录；可通过 `MOTE_TEST_CODEX_MODEL` 指定目录内模型）。这是显式运行的网络测试，不纳入普通 fixture 测试，也不能把该原宿主的复制/选择流程当作当前共享 Codex 可复制的证明。
