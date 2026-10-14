# 三端 UI 迭代：用户旅程与证据

日期：2026-10-13。范围：中央 Web、macOS、Android。本文记录本轮功能入口和验证边界；设计评价与每轮取舍由独立评审记录承接。

## 评价与迭代约束

沿用 [Anthropic 原文](https://www.anthropic.com/engineering/harness-design-long-running-apps) 的四项评价：Design quality、Originality、Craft、Functionality。保留独立评审者实际浏览、截图和质疑，固定标准与校准参照，并由反馈决定继续优化或调整方向；后一轮不自动视为更好。原文没有给这四项数字权重。本项目另加第五项「首次理解与重要功能完整性」，不能用它替代原四项。

第五项从用户旅程判断：首次来到页面能否说明 Mote 的用途；能否找到保存、阅读、提问、记忆、回顾和后台状态；功能在本机还是中央、何时可用是否清楚。功能存在于源文件、目录或链接中，仅证明入口覆盖，不能算使用完成。

最接近的现有产品模式是 [行动优先客户端](../adr-client-action-first.md)、[客户端导航](../client-navigation.md) 和 [Slate UI](../ui-slate.md)。本轮保留 Web 的五个工作区和原生三个主入口，不另建一级导航。

| Supersession 分类 | 本轮约束 |
| --- | --- |
| KEEP | 现有导航、来源/处理/记忆边界、隐私授权、明确开始采集、离线保存、草稿保护、旧链接、真实接收与索引状态、中英文目录。 |
| CHANGE | 用途说明、首页层级、现有入口的发现方式、组件间距和视觉执行。 |
| REMOVE | 仅移除被更清楚表达取代的重复呈现；不移除已支持的功能或高级入口。 |
| EXCEPTION | 文件选择、采集和系统权限继续采用原生流程；未连接时中央功能继续显示实际限制。 |
| UNKNOWN | 未实测的物理设备、OEM 后台、真实账号和模型质量；独立 AI 评审不等同于真人用户研究。 |

## 完整功能入口分母

Web 的目的目录 `feature-guide-catalog.ts` 当前有 16 个组、78 个功能单元。下表保留这个分母；本轮不要求把 78 项控件放到首屏。

| 目的组 | 中央 Web 入口 | macOS / Android 的现有承接入口 |
| --- | --- | --- |
| G05 随手记与附件 | 顶部随手记、首页记录动作 → `#/library/notes` | 首页随手记或添加 → 随手记；本机保存与中央发送沿现有行为。 |
| G04 导入资料与恢复 | 首页导入 → `#/library/import` | 首页导入文件 / 同步文件夹 → 原生任务编辑；中央导入管理从中央工作台进入。 |
| G03 来源、飞书与录音 | 新增数据源 → `#/connections/add`；已有来源 `#/connections`；飞书/录音详情 | 首页来源管理、本机文件/日历来源；Mac 中央工作台承接 Web 录音设置。Android 原生来源/飞书页沿现有支持范围，不宣称已提供 Web 厂商录音配置。 |
| G02 设备与采集 | 采集与设备 → `#/connections/devices`；连接授权 `#/connections/access` | 首页记录屏幕；设置 → 连接与同步、权限与后台；中央设备仅看最后上报状态。 |
| G06 正文与原始证据 | 资料库 → 全部资料 / 原始采集记录；详情与证据链接 | 内容 → 本机 / 已发送内容 → 详情；中央资料库阅读正式资料；原图主动展开。 |
| G08 提问与对话 | 问一问 → `#/ask` | 主导航问一问；未连接时明确连接要求。 |
| G09 记忆与更正 | 资料库 → 记忆；插件 → 记忆方案；模型与服务 → 模块与模型 | 中央记忆阅读/更正；中央模型与插件管理；本机保存不等于生成记忆。 |
| G10 洞察与回顾 | 首页洞察 / 资料库工具 → `#/library/insights` | 中央洞察页；缺模型时按既有提示设置。 |
| G11 后台工作与恢复 | 活动 → `#/activity`；技术记录 → `#/system/processing` | 本机同步详情/具体来源恢复；中央处理任务用于中央后台工作。 |
| G12 行动与日程建议 | 今天相关入口 / 全部功能 → `#/actions` | 中央行动页；日历写入仍逐项确认。 |
| G07 类型与时间回看 | 资料库 → 来源、文件与录音、片段、应用活动、媒体播放 | 本机内容筛选；中央类型页；应用活动与 Mote 后台工作仍区分。 |
| G15 存储、备份与用量 | 设置 → 存储、加密与备份 / 用量与费用 | 设置本机存储与导出；中央存储/费用在中央管理。 |
| G13 模型、图片、文件与语音 | 设置 → 模型与服务 → 对应分类 | 中央管理 → 模型与服务；本机采集高级参数仍在本机。 |
| G14 自动记忆与插件 | 设置 → 自动记忆与插件 → 当前方案 / 已安装 / 发现 | 中央插件页；安装、启用与生效继续分开，恢复不补历史。 |
| G01 登录、语言与页面入口 | 登录对话框、设置、语言切换；旧 hash 与返回历史 | 原生登录/邀请、设置语言；一次中央登录沿用已有凭据和目的地保护。 |
| G16 帮助、诊断与 Agent 视角 | 设置 → 帮助 / 诊断 / Agent 能看到什么 | 本机开发者/关于；中央帮助、诊断与只读 Agent 范围。 |

macOS 从「中央工作台」或首页「全部功能与设置」进入实际 Web 消费者；Android 从「内容」「资料库管理」和首页「全部功能与设置」进入原生中央消费者，分组页面目录承接已支持的记忆、洞察、行动和管理功能。Android 分组目录不是 Web 78 项功能的等价实现，目录入口与各原生控件仍需分别验证；不能将中央能力描述成本机离线能力。

## 本轮可重复的真实 renderer 验证

新脚本 [test-ui-iterations.cjs](../../scripts/test-ui-iterations.cjs) 每次创建独立临时配置、loopback 中央节点和浏览器。它使用真实笔记接收、来源 batch 接收及 Coding 正文发布，全部输入都是生成资料。脚本不配置真实模型、不启用设备采集、不读取个人 profile。

```sh
npm run build:central
node_modules/.bin/electron scripts/test-ui-iterations.cjs --round baseline --review
node_modules/.bin/electron scripts/test-ui-iterations.cjs --round round-1
```

`--round` 用于保留相同标准下各轮证据；`--review` 让生成节点保持运行，供独立评审者通过真实登录 UI 自行浏览。评审窗口保持后台，不打开或聚焦用户前台窗口。凭据仅存于权限 `0600` 的临时 `connection.json`，不会写到日志或源码。停止该进程后清理临时节点；截图、DOM 和结果在忽略目录 `.mote/ui-iterations/<round>/`。每次重建 Web 后重新启动 fixture；中央在启动时注册静态资源路径，旧节点不能代替新构建的交互评审。

| 状态或旅程 | 自动证据 | 不能由此推断的结果 |
| --- | --- | --- |
| 未登录、已登录空档案、生成资料档案 | 1440、820、390、320 px 首屏截图、实际视口文字和控件位置，无横向页面溢出；4 条真实 API 生成笔记保持可见 | 第一次理解的质量、真人可用性或实际权限。 |
| English 与 200% 缩放 | 未登录、空档案、生成资料档案均使用四种宽度的英文矩阵，另有 200% 首屏；记录实际 DOM 语言和浏览器缩放 | 所有页面语言、完整键盘和屏幕阅读器验收。 |
| 首次添加、导入、随手记、全部功能 | 点击实际产品控件，核对目标路由，保存页面截图 | 完整导入、附件处理、各功能状态和取消/恢复。 |
| 管理登录 | 打开真实登录对话框，核对密码字段；以临时生成令牌提交真实表单并进入首页 | 外部账号、OAuth 或正式节点凭据。 |
| 实际语言切换 | 真实 React 选择器和重载；fixture `window.confirm` 记录并模拟取消 / 确认，取消保留语言和路由，确认重载切换 | 原生浏览器确认对话框；为遵守后台测试约束，没有打开系统弹窗。 |
| Ask、记忆、洞察、活动、设置与模型 | 从产品入口点击；保存实际限制与配置页面 | 模型问答语义质量、费用或无模型时不存在的产物。 |
| 完整目的目录 | 与作者目录比对 16 组 / 78 单元，记录受限入口 | 78 项操作全部执行；嵌套高级操作仍需独立旅程。 |
| 四项目的索引 | Chromium 原生 Tab / Enter 进入每项分类，目标标题获得焦点并滚入视口，路由保持不变 | 完整屏幕阅读器或全部页面的键盘验收。 |
| 生成正文阅读 | 真实接收 → 发布 → 资料库条目 → 正文详情 | 物理采集、外部账号、OCR/ASR 或生产资料完整覆盖。 |

自动脚本不评分。评审者独立浏览并依据截图、交互结果及状态作出五项评价；作者只能据反馈提出下一轮实现，不能用自动 `PASS` 代替设计或可用性评价。

## 消费者回归入口

| 平台 | 已有验证命令 / 测试 | 主要范围 |
| --- | --- | --- |
| Web | `node_modules/.bin/electron scripts/test-web-navigation.cjs`；`--library-only` 为资料阅读切片 | 浏览历史、模型草稿、200% 键盘阅读和焦点返回、类型筛选、响应布局。 |
| Web | `node_modules/.bin/electron scripts/test-web-feature-packs.cjs` | 真实生成 Coding 正文、注册能力、Agent 范围、29 路由与 capability 请求恢复。 |
| Web | `apps/web/test/execution-queue-presentation.test.ts` | 挂载组件和真实资源缓存：分开计数、可选队列、折叠后刷新失败可见、旧缓存不冒充当前计量、恢复。 |
| Mac | `npm run build -w @mote/desktop`；`node_modules/.bin/electron apps/desktop/scripts/ui-smoke.cjs` | 实际 App 主进程/preload/renderer、隔离配置、原生采集 IPC 测试桩、草稿、离线文件/笔记、最小窗口。 |
| Mac | `apps/desktop/scripts/offline-sync-smoke.cjs` | 实际中央、真实 ACK、目的地绑定、手动发送与离线恢复；屏幕采集被阻止。 |
| Android | `apps/android/gradlew -p apps/android :app:testDebugUnitTest :app:assembleDebug :app:assembleDebugAndroidTest` | Kotlin、单元、实际 App/test APK 构建；不是设备 UI 执行。 |
| Android | `NavigationInstrumentedTest`、`SourcesEntryInstrumentedTest`、`NativeCentralInstrumentedTest` | 专用合成模拟器的原生导航、文件选择器生命周期、中央页面；生成预览使用 App `View.draw(Canvas)`，保留 `FLAG_SECURE`。 |

按 [开发指南](../development.md#pr-check-scope) 在最终代码上运行 `npm run check:affected`，共享作者文案影响所有消费者。模拟器、实际 App renderer、单元、物理设备和真实模型结果分别记录，不用历史报告充当本轮检查。

## 本轮发现的持久回归

| 情境 | 正确状态与持久验证 |
| --- | --- |
| 首页资料卡改成紧凑列表，窗口缩窄 | 4 条生成笔记均可读；不能继承旧网格的第 4 张卡隐藏规则。新 renderer fixture 在四种宽度核对实际可见数量。 |
| 队列详情折叠后，刷新失败且资源缓存保留旧成功数据 | 摘要显示暂不可用，错误在折叠之外，旧数字不显示为当前值；恢复后显示新值。新增 mounted React 单元测试覆盖真实缓存生命周期。 |
| Mac 离线 Ask 后收到周期状态；有连接且已登录后刷新 Ask | 离线提示保留、令牌输入不重新出现；已登录也不重新显示令牌输入，问题草稿保持。桌面 smoke 使用实际 preload 状态事件和生成 Ask 响应。 |
| Android 从全部功能选择记忆后重建 Activity | 恢复所选页面；不能重复首次启动的目录对话框。原生 fixture 用真实分组选择和 Activity 重建覆盖。 |
| Mac 打开中央首页 / 全部功能，进入浏览器登录交接 | 固定目标通过 ticket 和 request 两种现有登录方式保留；URL 不带 bearer 凭据。`central-browser.test.ts` 保留回归。 |
| 过期快照恢复后，共同执行引擎的完成事件先启动索引 | transport ACK 仍是同一版本，处理中的原始字节准确，完成后清理输入；恢复 fixture 通过真实 processor 的可释放屏障和有界 operation drain 核对稳定状态，不能假定一次 discovery tick 一定等完已运行工作。 |

## 已执行证据

2026-10-13 基线：新 Web renderer 生成 fixture 脚本通过；未登录 / 空档案 / 生成档案、四种宽度、英文和 200% 缩放无页面横向溢出，实际入口可达，生成正文可读，16 组 / 78 单元与当前目录一致，未记录 renderer 错误。基线输出在 `.mote/ui-iterations/baseline/`，不会提交截图、节点数据或凭据。

最终第 5 轮 Web fixture 通过：38 张生成界面截图、17 条实际登录 / 入口 / 键盘旅程，中文和 English 的未登录、空档案、生成资料档案均覆盖 1440 / 820 / 390 / 320 px，另有 200% 英文缩放。16 组 / 78 单元保留，4 条最近记录在两种语言的四种宽度下均可见，未记录 renderer 错误。队列呈现的 2 项 mounted React / 资源缓存单元测试通过。早期轮次保留其实际执行范围；真实登录、4 条记录与键盘索引回归在第 3 轮增加，完整英文矩阵在第 5 轮增加，不能把最终范围回填为早期已执行。

第 5 轮第一次尝试发现生成时间戳可能落在首页查询的上界之后。fixture 已改为固定过去时间，Coding 事件早于 4 条笔记，并在同一产品构建上重新通过；未修改产品时间筛选策略。

最终同一第 5 轮构建另有 `.mote/ui-iterations/round-5-language-cdp/`：38 张截图、24 条旅程通过，其中增加实际语言选择器的 1 次取消和 6 次确认。确认结果由 fixture hook 明确模拟并记录，产品 change handler 和页面重载仍实际执行；原生确认对话框未验证。独立评审另在后台 CDP 中自行选择取消 / 确认、以 320 px 打开全部功能与设置，再进入模型与服务；已有第 5 轮 38 / 17 的原始报告保持不变。

最终受影响检查还暴露了恢复 fixture 的两处时序假设：HTTP 恢复 ACK 返回时不能断言工作一定仍在 `waiting`；已被引擎完成事件启动的工作也不一定出现在下一次 `FileProcessing.prepare()` 的 discovery 列表中。测试现使用真实文本 processor 的屏障验证处理中字节，再以 20 秒有界的 operation pipeline drain 等到成功；屏障在失败 teardown 中仍释放。仅调整测试，未更改产品调度器。两份恢复测试独立通过 21 / 21；恢复、客户端、快照和文件处理四份消费者测试以并发 4 通过 80 / 80。同一版本、单一 capture / version、丢失 ACK 幂等、精确字节和完成后输入清理断言全部保留。日志为 `.mote/ui-iterations/recovery-isolated-final.log` 和 `recovery-consumers-parallel-final.log`；全量受影响检查另由最终报告记录。

这些生成 fixture 和单元记录不宣称物理设备、真实模型、所有 78 项控件或真人首次理解已经验证。各轮独立评价和最终实际执行结果由本轮评价报告补充。
