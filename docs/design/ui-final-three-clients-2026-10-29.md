# 三端 UI 定稿：来源、决定与验收范围

2026-10-29。初始代码核对基线：`5846a09b240594cb6dc1237299ab435c95048b44`。本文记录本轮 UI 目标、已集成实现与分阶段证据，**不是完整旅程或一比一视觉验收通过报告**。规范决定见 [三端 UI 定稿 ADR](../adr-ui-final-three-clients.md)，测试分层仍以 [testing](../testing.md) 为准。

本次续作从 main `f693ed6a81a153e3b8c37e2181a9df3d62cf5ee9` 恢复；本次执行快照的集成提交为 `f8ad2ccd`（共享服务当前运行 `3a68db16`；新 UI、catalog 10074 与 CJK 显示待下一次串行构建）。上轮的本地分支和证据可以复用，但必须按实际变更判断是否仍有效；停工时的 46/128 仅为具有部分独审画面的旅程组，不能折算为完整旅程通过。下文旧基线差异用于追溯，当前各批的已修、实际验证与剩余状态以第 3、6、9 节为准。

三端的日常定位及最终入口如下；相同业务实体保持相同身份，各端分别采用获认可的布局。

| 端 | 默认打开后应看到什么 | 保留的次级入口与连续路径 |
| --- | --- | --- |
| Central Web | 完整侧栏与顶栏，搜索/提问、最近资料与对话；一处全局随手记 | 资料库的原文预览、按时间回看与统一详情；独立 Memory 详情与可收起筛选；输入来源和对外 AI 接入分开；发现、活动、待办日程、完整设置与全部功能 |
| Mac | 完整侧栏与菜单栏；工作台以提问、最近对话、最近内容为主，正常采集/发送状态紧凑 | 内容、来源、问一问各自完整工作区；同步与活动、设置在侧栏下部；本机权限、文件夹、采集、存储与恢复仍在本机；关窗继续后台，退出明确停止 |
| Android | 一个日常首页，底部只有“记录／继续草稿”和“问一问”两个主动作；新用户可以先本机记录 | “我的 Mote”菜单进入资料与记忆、发现历史、日程与待办、采集与同步、设置；答案引用与保存结果直接打开精确原文，返回保留对话和草稿；正常后台运行不变成常驻仪表盘 |

验收包含第 3 节的 **128 个旅程组**（Web 50、Mac 39、Android 39），及第 7 节 **77 个 Central 能力、33 项历史原生能力**的全部保留入口。每组包含多个页面、弹窗或状态；首页截图或入口存在都不等于整组通过。示例内容可随真实结果变化，布局、控件、入口、返回关系、状态含义和既有能力不能遗漏或被替代。

## 1. 来源与优先级

设计依据是所有者指定的 [「评审各端 UI 用户旅程」原始对话](codex://threads/01a17d84-94a3-7382-b12a-5c656106f534)。本轮使用受支持的 `read_thread` 完整分页重读了 40 个 turn，其中有 39 个包含用户发言，另一个为无独立用户消息的续轮；最后一轮为定稿网站发布。[第 8 节](#8-原讨论逐轮索引)保留 `S00`—`S39` 的 turn ID、用户 message ID 和产物，不能将助手建议单独当成所有者决定。

来源顺序为：主对话中较后的明确用户取舍 → 对应获认可/按要求修正的原型 → 最新收尾 HTML 中已有能力的 UI 补全。所有者在本次续作再次明确：**项目 ADR 与该对话冲突时以对话为准；三端最终形态须与对话定稿完全一致；相关 UI 修改直接实施。** 旧 ADR 不能成为保留已否决布局的理由。新功能或未选择的后端架构、执行策略仍须单独确认。

所有者随后明确：“不用参考那个网站，那个网站的内容都是从对话里面出来的，直接看我开头儿给的那个对话就行。”后续以原对话及其中最终认可的原型、图片为依据，不再等待网站登录或继续网站/发布项目预览。此前核对发布提交及访问记录作为历史来源核实保留，不产生独立设计决定。

本轮执行授权另有明确追加：[执行协调对话](codex://threads/01a1767c-d428-715a-8055-60970a2a00c5)，助手提问 `Sentinel_6409e67a4e0481918ccb06bb1688db5a`、用户回复 `Sentinel_257460f132848191881fe64393bba4c5`：“可以就这么搞，然后第四条的自动依赖什么的也都一起做完。”该回复批准第 5 节 H01–H04 所列四项有界变更，并将第四项扩大为完整一键依赖准备、模型下载、启动及失败恢复。它是本轮执行/后端授权来源，不替代前述 UI 设计来源；对应实现现已集成，并有分组合同/运行证据；**最终完整旅程仍待第 9 节执行**，不能再当作待批准事项，也不能仅凭授权或集成宣称通过。

本次续作又对 H07/H09 的两个确实缺失的实现作了具体解释。所有者回复“两处都按这个方案补齐（推荐）”：补齐已配置网站的只读授权检查，以及 Mac 备份恢复的真实部分结果回执。权限、保存与去重规则保持现有边界，不自动授权或自动重试；授权范围详见第 5 节。

随后，所有者对长资料提问的具体方案回复“补齐整份资料的版本引用（推荐）”。H10 因此获准：提问携带一个精确 Material 版本引用，模型沿用既有工具按需分页读取；资料更新或不可用时保留草稿，明确清除/重新选择。沿用当前读取权限、模型和收费配置，不把超过 30 段的资料静默截断。

所有者随后明确批准补齐“只保存缺失时间”的 H11：在 Mote → 待办与日程 → 安排详情，由用户填写原先缺失的开始/结束时间；保存后仅按既有唯一有效的设备、日历及资料范围授权自动同步。完整且满足原有执行条件的日程直接生效，不猜测日期、不增加授权，也不把“保存信息”当作逐条批准写日历。确切合同与已集成状态见第 5 节 H11。

所有者在本轮集中查漏中又明确回复“补齐只读分组，按定稿完成（推荐）”，批准 H12：时间回看新增只读分组，截图沿用已有采集会话；其余按已记录的设备、日期和来源类型归组，没有明确关联不声称同一篇文档。组内保留确切原件、筛选与分页；不改变采集、保存、授权或模型调用。

2026-10-29 03:37 UTC，用户在执行协调对话的消息 `Sentinel_b79931f658388191b44f5559409ca9dc` 提供[三端 UI HTTPS 网站](https://mote-ui-01a17d84.n826wty8ft.chatgpt.site/?platform=central&scene=previous#journey/central/home)，要求“我做成网站了，按这个里面去对比”。这曾是本轮新增的可视核对入口，已被上述“直接看原对话”的较后指示替代；[网站来源证据与剩余状态表](../validation/ui-final-source-export-gaps-2026-10-29.md#用户提供的-https-来源与已验证状态)记录分组、UTC、视口、可见操作与实际观察，不把网站示例当产品验收。

源目录为 `/Users/utopiafar/.codex/visualizations/2026/10/27/01a17d84-94a3-7382-b12a-5c656106f534/`，本轮只读。原型包含生成数据，示例日期、数量、设备、账号、成功结果、模型和版本号不是产品常量。顶部客户端、旅程、安装包、示例回执/结果选择器是**评审工具**，不移植到产品。

`mote-final-workspace.html` 是最后收尾稿。S39 中所有者明确要求把“所有的已经定稿的三端的样式”发布为网站，因此其中残留的 `candidate-awaiting-owner-review` 作者标签不能否定后来的所有者决定。网站包含三端界面、首次使用、对话与资料回看、恢复与继续四组；这些组共同构成最终源，不能只实施首页或最后一份 HTML。当前授权没有把示例回执、示例数据或隐含的新执行策略变成产品能力。

本次还核对了 S39 发布工具记录与本机原发布项目：二者 commit 均为 `8f4ff814cd43ebd86e73adabc8266f890a0834ef`，本机发布工作区干净。四组 `dist/` 文件通过受支持的本机只读预览实际渲染，散列及访问经过记录在[来源证据](../validation/ui-final-source-export-gaps-2026-10-29.md#本次续作的可视来源)。这些是此前的发布来源核实记录；后续逐页对照直接使用原对话及其接受的产物，不再使用网站或发布项目预览。旧浏览器拒绝同样保留为历史记录，不能据此把未核对状态判成通过。

S09 引用的 [更早分享对话](https://chatgpt.com/share/6aded7e7-8e04-83ea-86ed-fa36a31fc8e5) 已通过获准的公开页面只读下载，解析其 `linear_conversation` 可见正文，并复读 56 条实际用户发言；另一个 user 记录仅为不可用自定义指令占位。未执行页面脚本。它补充确定性记录与对话分开、输入与输出分开、结果与异常优先、共享用户状态与本机权限/草稿分开、功能就近与专业设置分层等早期原则。主对话较晚的 Android 轻首页、既有只读 MCP 接入、手动 Memory 操作和历史保留取舍优先；较早分享中的通知算法、iOS、模型路由、隐私生命周期等未定事项不能自动成为本轮新功能。

| 最终源集合 | 用途与接受关系 | SHA-256 |
| --- | --- | --- |
| `mote-final-workspace.html` | S38 既有能力集中收尾；保留已接受框架；新策略仍需第 5 节核对 | `d6ae147fbb0b2b9df08b52bc8ee60a85e02c4340c7872e45c4878fdb0592819e` |
| `mote-recovery-workspace.html` | S37 恢复/中断，S38「大体 OK」 | `58bedf951b124128d7853246e2d3b967e28bdd8e66a6468fc0d3d3a19473bde2` |
| `mote-continuity-workspace.html` | S36 跨端/副本，S37 明确覆盖其删除历史分支 | `15f899ce90dd79d6058f322bdfc8b34b940a7dec4fa31c04476c57af7eba61b3` |
| `mote-first-use.html` | S35 首次使用，S36「大体 OK」；不能被最终文件遗漏 | `01b1f22269645d40af80957731b6ecae8f7169e31942bee2c31f60dc0889d7af` |
| `mote-mac-role-exploration.html` | S34 Mac 对照，S35 接受轻落点/保留侧栏方向 | `64739e25469d468b981a055d05865e04915e38e8c586be6f4a06f7a0620ff113` |
| `mote-android-assistant.html` | S33 手机轻入口，S34 接受并要求新用户承接 | `361fd91595477797a77059df9bd243b8b005f4ac8e9582499f5f2a2a88fe259b` |
| `mote-ui-owner-decisions.json` | 作者整理的辅助索引；与用户原话冲突时不优先 | `27fd2c6061b667123bd33f0de7f05b7cb3fc7f6837033f717b999ec79422a6f7` |
| `audit-features.json` | S00 既有 78 项 Central/33 项原生能力审计；A01 后来被删除，旧导航不再规范 | `cbef62f58de8aeb802611657bc9c56d570490414c0d3a388b8d1672d480499d2` |


## 2. 已确认的原则与取舍

| ID | 最终要求 | 被替代或未选方案 | 直接出处 |
| --- | --- | --- | --- |
| D01 | 默认只显示内容、必要状态和操作；说明留在首次引导、帮助、错误和重要选择 | 日常页面堆满无谓说明；把调研中间结果放进产品页 | S01、S04、S25 |
| D02 | 局部迭代保留未讨论的侧栏、顶栏、视觉框架和功能 | S04 资料页整体重做、侧栏消失 | S05 驳回，S06 接受恢复稿 |
| D03 | 先盘完整功能、用户旅程、实体与现有 ADR；参考同类产品熟悉的路径 | 为突出新入口挤掉旧能力；未核实能力先画可用按钮 | S12、S13、S14、S25、S28 |
| D04 | 阅读原文、原图和已有正文；预览截取已有正文、图片用缩略图 | 为 UI 新增摘要实体/生成任务 | S02、S07 |
| D05 | 我的资料内按资料找、按时间回看；同一资料可从不同入口找回 | 按主动/自动、是否有主题硬分「记录与文件/采集记录」 | S03 质疑；S06、S07 接受恢复后的整合 |
| D06 | 原文预览为默认；无正文引用如实显示位置/状态 | 默认只见紧凑元数据，或引用假装有正文 | S07 |
| D07 | Central 全局顶栏一处随手记，保存回原页，收起保留草稿与阅读/提问位置 | 只有资料页内入口；每个页面重复强调创建；自动复制当前资料到独立笔记 | S08、S09；Android 后由 D21 收敛 |
| D08 | 资料库、来源、引用进入同一份资料详情；返回位置跟随来路 | 来源内再做一套不同正文/提问页；丢失来源上下文 | S10、S11 |
| D09 | Memory 独立详情、来源依据、状态；搜索在前，筛选按需展开并保留可移除条件 | 独立视图库/成员管理；新增视图管理功能 | S11 建议，S12 明确收回，S14 接受精修 |
| D10 | 文件/文件夹/ZIP 导入、预览、恢复保留；服务器目录导入移除 | Central 服务器路径输入及相应入口 | S15 明确删除；S16 接受 |
| D11 | 原件归档、记录发布、记忆整理分别表达；可靠解析自动保存，含糊解释再确认 | 上传成功直接称处理完成；取消处理即删除已归档原件 | S14、S15 |
| D12 | 来源配置按真实能力区分；资料说明/内容归属按需展开，显式保存，返回保留草稿 | 所有来源一套虚构范围；重授权/保存配置自动解除暂停 | S15、S16 |
| D13 | 输入来源与对外 AI 接入分开；已有只读 MCP 配置生成、复制/下载、凭据只显示一次、撤销 | 配置生成等同客户端连通；不存在的使用明细/最近访问；新增权限预设或 MCP 扩权 | S16、S17 |
| D14 | 首页前置搜索/提问、最近资料与对话、有限既有发现；发现结论可回原文 | 以后台管理指标占据日常首页；新建自动精选/推送算法 | S17、S18；S33、S34 |
| D15 | 发现默认排版结果；「排版结果/标准阅读」收更多，保留现有 HTML/Markdown 输出 | 显眼「报告/文字」双 Tab；因布局改造后端输出架构 | S19 明确确认 |
| D16 | 活动按进行中/需要处理/已结束，原因与成果优先；导入确认/重试回原操作页 | 日常直接暴露运行树/技术步骤；复制一套导入流程 | S19、S20 |
| D17 | 「模型与服务」聚合语言模型、OCR、语音：服务连接/模块与模型/资料处理 | 只管 LLM 的「模型与 AI」；把采集权限、来源接入、外部 AI 授权混在 Provider 内 | S21—S26 |
| D18 | 后台授权为资料处理中的「自动处理新资料」；首次/服务或资料范围变更说明确认，日常开停；更多中范围和立即停止 | 独立后台授权 Tab/权限勾选页；把全局授权假装成每功能独立授权 | S24、S25；保存连接仍不自动授权 |
| D19 | 本机 OCR/语音一键安装依赖、下载模型并启动；分别显示准备与可用，技术地址端口深藏 | 要用户逐个填写 loopback/worker 接口；文件下载完成即称可用 | S25、S26；实施前缺口及已集成边界见 H04 |
| D20 | 设置总页保留自动记忆/插件、用量、存储备份、诊断；定期发现就近配置且总页同入口 | 设置只通模型；复制两套定期发现配置 | S25、S26 |
| D21 | Android 单日常首页，记录/问一问两个主动作；资料与记忆、采集与同步等到次级菜单 | 原四 Tab、再加 Record Tab、各页面重复记录主按钮；正常采集仪表盘常驻首页 | S32 候选，S33 改方向，S34 接受 |
| D22 | Android 必须有首次使用承接，允许先记录后连接，不强迫权限/模型就绪 | 极简空白页；必须先接 Central 或全开权限才能记录 | S34、S35、S36 |
| D23 | Mac 菜单栏轻入口＋完整主窗口；保留侧栏和工作区，首页突出提问/最近内容，正常状态紧凑 | 将 Mac 压成手机同款布局；原工作台大采集/发送面板占优先位置 | S34 探讨，S35 接受 |
| D24 | 每次保存/导入/来源同步可填独立、选填资料说明；区分单条/来源作用域，续传沿用 | 把说明混入原文、心情或本人陈述；每次后台续传打断；自动付费重跑历史 | S31 明确要求；说明传递边界见 H03 |
| D25 | 采集、来源暂停和发送暂停保持各自语义；来源暂停保留待发内容 | 授权后自动开始；保存规则即开始；暂停发送同时停记录 | S30、S31、S35—S37 |
| D26 | 日程默认生效，不再逐项审批；保留缺时间、等设备、待核实/失败与真实回执 | S26 逐条核对/确认日程队列 | S27 明确纠正，S28 完成修正，S29 接受；同范围执行见 H02，用户补缺时间见 H11 |
| D27 | 设备在来源中，生成邀请/扫码/导入；只展示上报和 Central 接收；本机采集权限留本机 | Web 远程启停/改设备隐私；连接成功等于原文可读或 AI 可用 | S28、S29、S35—S36 |
| D28 | 录音以转写阅读/时间回听为主，局部命名说话人、逐段校正，保留原转写；导出/关联/处理收更多 | 把无音频的厂商转写画成可回听；跨录音自动统一说话人身份 | S29、S30 |
| D29 | 同一已提交对话跨端继续，未提交草稿留原端；引用打开精确原文并可返回 | 暗中同步草稿或切对话丢稿；Mac 本机重造 Web 引用阅读器 | S36、S37 |
| D30 | 资料修改或删除后，已提交问题、回答和引用身份始终可见；轻提示、继续提问、不可用原文如实说明 | S36 删除资料后清空/隐藏历史回答；把旧引用指向新正文 | S37 明确覆盖；执行范围见 H01 |
| D31 | 本机副本清理不等于 Central 删除；Android 记录保留期、文件暂存、Mac ACK 释放各自区分 | 三端强行一套副本保留策略；移除来源时不说明未发送暂存会清除 | S36、S37 |
| D32 | Android ZIP/配置 JSON、Mac 队列 JSON 按现有格式恢复；显示校验失败、部分结果、重试/未知，验证后切存储位置 | 统一备份格式、原子全部恢复、无条件取消迁移、假造 Mac 节点绑定/成功 | S37、S38；Mac 失败结果见 H07 |
| D33 | 图片提问/本次模型/对话更多、Memory 手动反馈和历史、澄清问题、特殊资料、插件失败恢复、本机维护、全部功能入口归各自位置 | 新一级导航、无对应实现的能力、目录 ID 存在即宣称可用 | S38 受当前纯 UI 落地授权覆盖；见第 3/4 节与 Q01 |
| D34 恢复定稿配色 | 浅色次要文字与侧栏次要文字使用最终源 `#777066`；三端从同一源生成 | 上轮实施者为对比度自行使用的 `#6f695f` 未经所有者逐色批准，本轮不继续保留该视觉偏差 | S39 定稿来源；本次续作“最终形态完全一致”要求 |
| D35 问答保存与本轮详情 | 每轮并列“保存为记录／更多”；保存打开独立窗：可见引用→本人补充（选填）→折叠资料说明→取消/保存；本轮详情保留模型/检索/费用与折叠已读依据 | 把保存藏进本轮详情、遗漏独立说明、顶层对话 More 再复制一份本轮详情快捷项 | S36 continuity 的 `ctTurn`/`ctReviewAnswer`，S38 最终6169/6173只追加 More；本次源复核纠正实施层级 |

D34 的旧调色属于实施偏差，本次按所有者要求恢复源颜色。下表保留实测对比值以说明旧选择与本次改变：源的部分浅色次要文字配对低于 4.5:1，不能继续宣称所有配对达到该值。已有测试只为这五个源配对保留明确例外并检查准确色值，其余正文、状态、主按钮、控件及深色对比要求继续执行。该变更不改变主题切换、草稿或授权行为。

| 背景 | 本次定稿 `#777066` 对比度 | 上轮偏差 `#6f695f` 对比度 |
| --- | --- | --- |
| `#eeebe5` | 4.110509 | 4.570485 |
| `#f7f5f1` | 4.491462 | 4.994067 |
| `#fffdfa` | 4.816706 | 5.355706 |
| `#f0ede7` | 4.185602 | 4.653981 |
| `#eee7f5` | 4.048589 | 4.501635 |

## 3. 逐端逐页、弹窗与状态清单

以下是源清单，建立于实现前，不按实施结果倒推。W/M/P 是验收旅程组，不是精确页面总数；一组可包含多个页面、弹窗和状态。每行均需核对布局、文字、控件、导航及列明状态。“已集成”表示本组相关实现已汇入候选，不表示所有源状态已实现或通过；“阶段”只覆盖实际记录的子状态，“尚未验收/终验待执行”不由默认截图、类型检查或单测替代。基线实现列保留实施前的代码差异，不能继续当作当前缺口；H01–H04/H07/H09/H10/H11 对应实现已集成，末列只标记实际阶段证据或尚未验收。原型定位为文件名/可检索标识，不把累计文件里残存的旧候选路由都算成选中页面。

### 本次集中查漏的统一口径与批次

协调者沿用 **50 个 Web、39 个 Mac、39 个 Android** 的完整源清单，逐组维护要求、当前入口、阶段证据和剩余状态。`bac1c5b8` 的第一轮范围/证据盘点发现 13 组差异；这只表示当时的已知差异，不能解释为其余 115 组已经逐状态一致。下表末列使用三类结论：**已确认不一致**需要有明确源要求与当前产品差异；**待验证**保留可能已有的实现以及实际证据缺口；**已验证一致**必须逐状态核对并注明提交、构建及证据。已修差异改记已修、待最终组合验证；局部已验状态保留自身版本，不升级整组通过。当前整组逐状态一致仍为 0；最终集中运行已经开始，实际结果及明确剩项见第 9 节。已有适用证据的子状态不因提交编号改变而重跑，也不能继续写成从未测试。

后续独立复核确认的 W06/W11/W12/W14/W17/W19/W21/W22/W23 九组差异现已修复并集成，包括：H12 默认可读错误及折叠诊断、逐轮并列保存和独立说明、接管其他端运行的只读恢复、proposed 筛选、处理选项默认折叠、导入非空行与 unsupported、修改说明后的重预览守卫、来源真实状态及版本/来路隔离。相应风险检查、实际界面和独立复核分别见第 6 节，旧的问题描述不再表示当前未实现。P23 的操作文案也已修，14 张双主题图仍仅覆盖所列子状态。

第二轮按原稿完整扫描 W24–W50 又确认来源设置、设备、录音、特殊资料和运行记录的呈现差异，分给互不并写的原开发模块。连接设置、设备、录音与特殊资料已汇入 `12a9c9f1` 之前的集成栈；运行记录的独立页面、默认层级已按其他 Agent 的只读复核修复，实际证据为 `2611268c` 与本批真实 Terra 运行记录。Android 全 39 组静态复扫另确认 P04 默认仍暴露手工连接表单、P26 默认缺实际 DEV/PROD 标识，已由原 Android 开发者修复；Mac 全 39 组源状态已完成对账：新增 M04 空总队列菜单差异；其它指定子状态、已有适用证据与 OS/外部限制逐行回填，不把四张默认图说成完整复核。

| 批次／开发归属 | 一次交齐的差异与剩余检查 | 收口条件／独立复核 |
| --- | --- | --- |
| Q1／Web 原开发者 | W09–W13：默认阅读、顶层历史/新对话/More、逐轮详情/模型/检索/未估价、每轮并列保存/More、独立保存窗与自己的补充/折叠说明、删除确认/失败、引用返回、未发草稿；保留所有请求、分页、owner、附件与 H01/H10 合同。 | 明确提交及实际浅/深/窄屏操作，其他 Agent 只读复核对应状态；新 UI 不能只隐藏能力。 |
| L1／资料库原开发者＋根只读后端 | W05：mixed row 一套有效样式；W06：日期/筛选层级、H12 已批准真实分组、完整数量、成员分页/原件/返回；保留现有全部筛选与分页。 | 新投影先作跨模块合同复核；生成数据跨页/设备/来源、删除/范围变化、组/成员 cursor 均正确；逐状态实图与独立复核。 |
| A1／Android 原开发者 | P17–P22：Ask coarse 触控目标与返回；发现默认/标准阅读、无旧 collection chrome、localized 日期/真实依据数、完整引用→确切原文→同报告；保留历史/模型/附件/请求恢复。 | 专用 AVD 的当前 Development APK 与测试 APK hash；明确阶段/真实 Terra 输入边界；其他 Agent 只读复核，开发文件仍由原开发者独占。 |
| M1／根的小样式修复＋Mac 原开发者验收 | M09/M10 的数字引用按最终 `.ct-cite` 恢复 24×24；其余 Mac 子状态按本表待验证项补验。 | `bac1c5b8` 已修样式，最终构建实际尺寸、精确引用/同会话往返和草稿需复核；OS 原生边界单列。 |
| I1／Web 原导入模块 | W19/W21：unsupported 需处理筛选、非空行式、改说明后先重预览才确认、三阶段与独立 Memory 状态、平面成果/精确原件返回。 | 保留真实接收/处理/保存与模型策略；按实际任务状态验证，原确认合同不可弱化。 |
| S1／Mac Agent 的来源模块 | W22/W23：来源搜索和行层级、真实需处理状态、概览/已有资料/连接范围；只用现有数据，不编造统计或成功。 | 独占 Sources/SourceCatalog 与局部 CSS；真实 error/permission_required、原件返回、范围/草稿与取消。 |
| R1／Android Agent 的 Memory 模块 | W14/W17：现有 proposed 状态筛选、模型/方案等进入默认折叠处理选项；保留运行与结果。 | 先核既有服务合同，独占 Memories/MemoryIntegration 与局部 CSS；真实过滤/空态/展开/返回，最终 Terra 单列。 |
| V1／协调者集中分派 | 其余 115 组按每行列明状态补验；W03、W08、W17–W18、W19–W23、W30–W31、W39/W42/W47 等缺独立操作的入口优先，不能用默认截图替代。 | 最早完成开发的 Agent 接他模块只读复核；同一文件不并写、同一 AVD/共享构建不并用；真实模型只在统一最终批次使用 Terra。 |
| C2／Web 来源连接原开发者 | W24–W27：连接/范围/同步层级，准备、日历与说明默认折叠；录音归档与 Memory 分开，MCP 输入与对外 AI 接入分开；403 撤下旧账号。 | clean `257ffc94` 的 27 状态；clean `265712f4` 的 17 个样式/英文受影响状态；clean `74c2dad2` 的 8 个最终 MCP 状态分别保留，均 0 live。真实外部账号另列待验证。 |
| D2／协调者原设备模块 | W28–W29：去重复上下文工具栏，恢复“采集与同步／中心已收到”，保持实际邀请、撤销、分页和原件。 | clean `ada8a31f` 的 15 个实际状态、29 条真实分页与来路返回；Web Agent 对原 CSS/两张画面只读复核，无具体阻断，不升级整组。 |
| F2／Mac Agent 的录音模块 | W37–W38：说话人名称、试听及纠正入口、双列命名、原始时间、关联日程原文返回；共享播放器仅显式启动，provider transcript 无假音频。 | clean `ff607e5e` 的 21 状态及 clean `68603274` 的 5 个受影响几何/英文状态；同源 CSS 构建和独立 reader 焦点修复已验证，Android 只读复核。受控 ASR 不冒充模型识别。 |
| X2／Android Agent 的特殊资料模块 | W39：截图两 Tab、日期/设备控件，实际测得活动时长，媒体状态折叠，Coding 四阶段、真实已发布正文及原文返回。 | clean `f0ff3799` 的 26 图，clean `6831839c` 仅重验受影响截图控件的 9 图；真实 SQLite/HTTP 生成 Material，0 model；Mac 独立复核。 |
| T2／协调者运行记录模块 | W47：明确选择与主动读取，模型输入／工具读取／输出；只呈当时实际保留内容，literal 正文、确切原件、保留分页及 owner 隔离。 | clean `8ba47bb4` 的 15 个实际状态与 21 项相关检查；独审再发现独立页面多余外层 Tab、默认目录行和输入上下文层级，正在一次修正后只复验受影响状态。 |

无专用外部账号、真实 OS/OEM 或物理资源的具体子步骤继续记待验证；它们不让同组其他已授权可执行工作停止，也不自动成为新审批。H12 为真正新增的只读分组合同，所有者已明确同意，不再重复确认。

### Central Web

`最终` 指 `mote-final-workspace.html`，此前原型名称见第 8 节。现有实现路径相对 `apps/web/src/`。

| ID | 入口 → 页面或弹窗 | 必须覆盖的内容、状态与返回 | 源/定位 | 基线实现与差异入口（历史） | 当前集成／阶段证据／最终验收 |
| --- | --- | --- | --- | --- | --- |
| W01 | 首次打开 → 首次使用 | 未连接采集器、已连接无资料、待发送/未核实、原文可读/不可用；模型可跳过 | S35–36；`mote-first-use.html` | `shell-components.tsx`、`DeviceOverview.tsx`；须逐状态比对 | 待验证：8fce93e5（dirty）10 状态已有邀请兑换/heartbeat、真实 note→原文/资料库、模型可跳过、reference-only 和 503。剩设备 queueDepth>0 未送达及当前可读错误文案画面；旧错误码图不证明新文案。 |
| W02 | 首页 | 搜索/提问、精选既有发现、最近资料/对话、必要异常；真实空态 | S17–19；最终首页 | `Overview.tsx`、`features/system.tsx` | 待验证：3a真Home→a812→页面History/Home返回已验；后来发现两真H04 file行显示envelope JSON，0895d6b9已修typed预览，clean6c3私有provider/普通JSON四图通过，Root同vault两file画面待串行构建。旧note图不代file。 |
| W03 | 全局搜索 → 搜索结果 | 显式搜索/提问模式，结果回原文；返回保留输入 | S09–10；搜索/问一问 | `SearchWorkspace.tsx`、`LibraryBrowse.tsx`、`MemoryDetailPage` | 待验证：clean 9184e11b 的 18 状态、d1d9aa39 的无结果→未发 Ask→原查询及本批真实搜索互补；typed-note reader 由 de59b958 14 图闭合。主要操作已有适用证据，最终独立视觉对账待收口，不新增筛选排列矩阵。 |
| W04 | 全局顶栏 → 随手记编辑器 | 文字/已有附件，保存/收起/失败，草稿及原页滚动保留；独立资料说明见 H03 | S09、S31；`recordButton` | `Notes.tsx`；原全局入口/弹层比对 | 待验证：5b74阶段与本批真ce41保存有效；d94fb904/f15c4b02闭合附件503→同manifest重试、说明上传期防覆盖、note真实201独立说明、收起保稿/附件及晚回执。clean1d5的14图和3b的6图复用，23focused/types/build通过；picker为受控CDP选择/清空，非OS chooser像素。 |
| W05 | 资料库 → 我的资料 | 搜索/类型/来源筛选、标签、翻页、默认原文预览、空/加载/失败 | S06–07；`mote-library-complete.html` | `Archive.tsx`、资料投影组件 | 待验证：mixed行/筛选/分页/503/返回原阶段适用；0895d6b9已修共用Home/Library file preview，仅现声明source-view exact revision正文、普通JSON literal、metadata/asset-only无伪摘要。31focused/clean6c3四图及Terra独审有效；Root真H04行和首次loading帧待补。 |
| W06 | 我的资料 → 按时间回看 | 既有截图/通知/活动关系展开；不按每个底层事件塞一行；回原范围 | S03、S07；时间回看 | `Archive.tsx`、集合视图 | 待验证：H12 真实 SQLite/HTTP 8 项、生命周期 17 项，clean 95158857 10 状态及 5d1f2b32 可读 503/折叠诊断有效。剩组内单资产不可读时的局部显示及同组/cursor 返回。 |
| W07 | 列表/来源/引用 → 统一资料阅读 | 原文、原图/OCR、来源/位置/状态；无正文/原件不可用；原路返回 | S07、S10–11；`openRecord` | `Materials.tsx` 内联详情、`ReferenceDetail.tsx`、`main.tsx` 原始记录详情 | 待验证：18b3f1b2/7a1cacee与6f11f833已修file-derived引用：固定旧ref、kind/schema、声明speech-text、evidence/chunk/坐标/canonical片段严格对应后才投影正文+speaker，More保原字节。Web3a实际三引用8图、Android64bc新Main三引用9图已验且Terra独审；WebMore长行整层横滚另交局部CSS收口。partial-readable/asset-only默认图仍待补。 |
| W08 | 资料阅读 → 更多/关系/提取 | 内容归属与说明、下载、原件、提取当前资料；单条原始记录删除确认/取消/失败保留，显式目标不误处理另一项 | S15、S31、S38；`record-more`/`extract-current` | `SourceContextEditor.tsx`、`ManualMemoryRecipes.tsx`；字段缺口另列 | 待验证：clean 11c13faf 实际 Capture 删除确认/失败/成功并保留保存记录、de59b958 附件下载、H10 入口有效；本批 H01 真删除 ce41 保历史回答和引用。主要操作已有证据；源说明 409 保稿若补只用生成来源。 |
| W09 | 阅读/搜索 → 完整问答 | 对话/历史、证据范围、发送/生成/错误/离线、引用→原文→原位，草稿不丢 | S01、S09、S36；`ctCompose` | `Ask.tsx`、`ConversationShell.tsx` | 待验证：Q1与真实三端同会话/H10/删除后续问互补；H04真实CJK粗体呈星号由Terra发现，f8ad2ccd仅在原Markdown parser补CJK delimiter显示，8focused/types通过，原answer/cite字节不变；同旧turn真画面待构建，不新提问。恢复另归W12。 |
| W10 | 问答 → 图片/本次模型 | 选择/取消、上传中/失败/重试/移除，文字附件保留、忙碌禁重复、模型默认 | S38；`finStartImages` | `Ask.tsx`、`ModelSelector.tsx` | 待验证：d94/f15失败行重试/移除、4ad初始化Storage失败恢复、d521源muted颜色已集成。24focused、clean1d5十四功能图、clean3b六发送条件图；151仅两颜色替代图，旧失败颜色图不用来证明最终样式。0query/model、成功项只上传一次；picker为CDP边界，failed File只同Api memory。 |
| W11 | 对话 → 更多/本轮详情/保存/删除 | 本轮模型、检索、费用未估价与已读依据；整段对话删除→确认/取消→失败保留；保存时已提交原文与本人补充分离，失败回对话且不覆盖全局草稿 | S09、S38；最终6173、对话更多 | `Conversations.tsx`、`SaveConversationRecord.tsx`、`NoteOrigin.tsx` | 待验证：clean 11c13faf 17 图、d3ca78fa 删除403/取消及本批 conversation-actions-r2 真实 turn 保存互补。7fbaa035 异常 ACK 同 identity 重试、独立说明和回原草稿已验；异常是受控201响应体，非真实网络503；本批整段删除只取消。 |
| W12 | 对话 → 中断/停止/继续澄清 | 结果未确认、检查/同请求重试、失败再编辑、停止待回执、依据不足 | S37；恢复稿提问场景 | `Ask.tsx`、请求状态模块 | 待验证：clean bef05126 13 图已验 owned 双丢 ACK、accepted404/重建和 late stop；focused 保 adopted A404只读/同步终态/owner。剩 adopted404 的浏览器 GET-only 重建和依据不足/继续澄清画面，不需新真实模型。 |
| W13 | 历史 → 资料已更新/已删除 | 问答、引用身份与继续入口留存；原文不可用提示、不静默转向新版本 | S37；连续稿修正 | `Ask.tsx`、`AnswerMarkdown.tsx`；服务器删除冲突 H01 | 待验证：Q1 旧版本/普通删除/不可用引用与本批 h01-continue-r2 13 图互补；ce41 原件404，65b三旧轮保留，Terra续问诚实限定历史回答。撤权/forget/strict全删按专项证据；失败 h01-delete 不标通过。 |
| W14 | 资料库 → 我的记忆 | 搜索、筛选展开/收起、已选条件可清、依据数量/来源/更新状态、空/失败 | S12–14；精修稿 | `Memories.tsx`、`MemoryTopics.tsx` | 待验证：90859943等原17态继续有效；本批3a真实Memory9f48d2a7在H01后仍200/已生效，实际搜索→详情→同查询→清除，0新模型。related-memory另归W15，不用该路径代证。 |
| W15 | 记忆 → 详情/依据 | 判断/范围/状态、相关记忆、依据→统一阅读→返回原搜索筛选；不可用依据 | S12–14；Memory 详情 | `Memories.tsx` 内联详情 | 待验证：c60ccbdc（dirty）、clean 9184e11b及本批 memory-r2 已验详情、准确依据/历史/原文及同job返回。Root readonly-home-history-r3 已真实读取H01后9f48d2a7为published并搜索/详情/原路返回；剩 related-memory 点击/返回。 |
| W16 | 记忆更多 → 纠正/历史/有效时间/导出/删除 | 编辑草稿、保存/取消/失败、原列表/详情同步、删除确认、历史只读 | S38；`fc-memory*` | `Memories.tsx`、现有记忆操作；无自动传播新策略 | 待验证：c60ccbdc（dirty）22 图实际纠正400/503/新UUID、有效时间、导出失败/成功、历史只读和删除取消/403/成功；focused 保 offset/晚回调。保留版本边界，不再写从未操作。 |
| W17 | 资料/记忆 → 手动提取/继续整理 | 固定被选实体、配方、工作状态/失败/结果/返回；不扩大到全量资料 | S38；`fc-memory-extract`/`fc-memory-integrate` | `ManualMemoryWorkspace.tsx`、`MemoryWorkChoices.tsx`、`MemoryIntegration.tsx` | 待验证：clean 58540418 21 状态、f143b863 5个呈现增量及本批 memory-r2 真 job20ec9ca0 completed/Memory9f48d2a7/准确原件互补。本批3c6dee31正常UI从真实9f48d2a7 version2选择默认mote.memory-integration@2，唯一294b98c9完成；call26有本机Terra原生模型回执，零新记忆为真实有效结果，自动设置不变。合法waiting_input答复后继续仍待有界受控补验，未声称本轮模型自然提问。 |
| W18 | 首页/资料 → 需要你补充 | 问题详情、回答/稍后/“我也不知道”、历史、失败保留输入、资料变化提示、回原资料 | S38；`fc-owner-questions`，最终5918、5930 | `OwnerQuestions.tsx`、`features/owner-questions.tsx`；历史H01 | 待验证：clean 698f8c20与d1d9aa39 已实际验独立列表/详情、回答/稍后/不知道、同request失败重试、obsolete/403/窄深与返回。真实模型收到回复后的后续产物另核，不否定已验编辑操作。 |
| W19 | 资料库/来源 → 导入列表 | 全部/需处理/已完成、原件/记录/记忆状态分别显示 | S14–16；`openImports` | `Imports.tsx`；旧服务器目录入口已移除 | 待验证：clean f7759be6 25状态、6e1fada8 6个样式增量已验六种job、unsupported需处理、完成筛选及原件/理解/Memory分开。主要app操作有证据，独立最终视觉对账待收口。 |
| W20 | 导入 → 添加资料 | 文件/文件夹/ZIP、选填说明、取消/空/限制、图片方案；无服务器目录 | S15；导入新增 | `Imports.tsx`、`ImportQueueEntry.tsx` | 已确认不一致：原型直接选件上限4000，现Web count及files/archivedFileIds DTO上限2000；所有者容量选择已单独提问，4000最小patch未应用。ZIP/directory既有总项4000含容器、64MiB/256MiB及展开512MiB不变。其它文件/目录/ZIP/取消/限制/预览按现合同继续补验，不擅自扩后台。 |
| W21 | 导入详情 → 预览/确认/恢复/删除 | 拆分及说话人核对，改说明重算预览，可靠结果自动保存，取消保原件、重试同请求、删除说明共享资料 | S14–16；导入详情 | `Imports.tsx`、队列/预览组件；删除历史 H01 | 待验证：clean f7759be6/6e1fada8 已验改说明禁旧confirm、同job重预览、503保稿、取消/失败保原件、成果→原文→同草稿。剩说话人/拆分核对、删除导入而保共享资料的实际UI，只在独立生成fixture做。 |
| W22 | 来源 → 列表/添加来源 | 类型/需处理筛选、状态、添加目录、已有连接；不以配置已存代替连接成功 | S15–16；`showAddSource` | `Sources.tsx`、`SourceCatalog.tsx` | 待验证：clean 1297f89d 10状态、19196aba录音样式、f4edc182读取失败、d1ddd9de提供方及旧5d1/159适用。添加目录/空错/第二层已有操作，外部账号不由此代证。 |
| W23 | 来源 → 详情/已有资料/连接与范围 | 概览与配置分层，说明与归属，保存草稿/暂停/恢复/断开/重授权、实际同步时间 | S15–16；来源详情 | `Sources.tsx`、`SourceContextEditor.tsx` | 待验证：clean159a6d18/5d1及16fae181的8项真实SQLite/受控HTTP已验exact source/context、503、保存/重授权不解除暂停。真实外部账号重授权与账号级绑定未验，Google/Gmail无映射不声称绑定某source。 |
| W24 | 来源 → 飞书文档/日历 | CLI/账号授权、范围/首次回溯/排除/预览/保存；取消授权、失败重试、暂停不自动解除 | S15–16；飞书 | `LarkSettings.tsx` | 待验证：clean257ffc94/265712f4 已验受控CLI授权取消、503同scope保稿重试、生成文档真归档1。真实飞书/Lark登录、应用审批、厂商撤权/过期未验。 |
| W25 | 来源 → Google Calendar / Gmail | 独立授权、日历选择、同步/续页/断开/失败；只读与归档限制真实 | S15–16；Google/Gmail | `Sources.tsx`、来源配置组件 | 待验证：clean257ffc94/265712f4 已归档生成event/mail各1、选择dirty gate、503、断开取消/确认保原件。剩二页续页UI；真实Google OAuth/refresh-token撤销属外部未验。 |
| W26 | 来源 → 录音供应商 | 历史范围、转写归档/音频归档分开、授权取消/失败/单项重试 | S15–16、S29；录音 | `RecordingsSettings.tsx`、`RecordingAuthorization.tsx` | 待验证：clean257ffc94/265712f4 已验范围/说明CAS、取消、暂停保存不自动恢复、归档与Memory分开。discover空fixture未证明单项失败重试、转写/音频分别归档；真实账号另未验。 |
| W27 | 来源 → MCP 资源 / NAS 引用 | MCP 列表→选择→一次导入；NAS 保存位置元信息不假装已抓正文；取消/失败 | S15–16；MCP/reference | `Sources.tsx` | 待验证：clean74c2dad2 8状态实际本机MCP SDK列2选1、说明CAS、同source/body503重试和准确原文返回；NAS只存元数据按原证据。远端服务/auth不由本机SDK代证。 |
| W28 | 来源 → 设备详情 | Mac/Android最近上报、实际Central资料→原文→设备；不上远控按钮 | S28–29；设备 | `DeviceOverview.tsx` | 待验证：cleanada8a31f 15状态已验设备、29条接收记录分页、准确原文/设备返回和最终Tab；Web独审无具体阻断。物理采集/长期离线队列属native边界。 |
| W29 | 添加设备 → 邀请/连接管理 | 客户端选择、邀请/扫码/导入、过期/取消/错误、撤销/重连；归档仍可看 | S28–29；设备接入 | `Connections.tsx`、`ClientLoginApproval.tsx` | 待验证：cleanada8a31f 已验邀请编辑/取消/校验、兑换、撤销取消/确认及窄屏。剩自然过期状态/重生成实际画面，可用短clock fixture；物理扫码单列。 |
| W30 | AI 接入 → 授权列表/详情 | 有效/历史授权、凭据标识；无捏造最近使用/连通状态 | S16–17；AI access | `Connections.tsx` | 待验证：本批 final-ai-access-enabled 18状态真active/revoked/history、唯一MCP1d49；bbc387fd对应Root9c47e694四态闭合长名状态换行。剩expired元数据详情实际图；不新增不存在的逐来源读取范围。 |
| W31 | AI 接入 → 新建/生成/撤销弹窗 | 名称/节点、复制/下载/复制失败、完整凭据一次展示、隐藏/离开不可回显、撤销确认 | S16–17；AI 配置 | `Connections.tsx` | 待验证：本批真唯一MCP创建、600下载字节/hash、hide exact详情、离开/旧路由/reload不回显、撤销取消/确认及原inventory不变已验。copy为私有浏览器memory transport，非OS剪贴板/外部客户端；旧长名图由bbc四态替代。 |
| W32 | 首页 → 发现详情/历史 | 默认排版结果；更多中标准阅读；依据→原文/追问→原位、空/不可用 | S17–20；发现 | `Insights.tsx`、`InsightReport.tsx`；旧双 Tab 已归入 More | 待验证：真a812报告默认/标准/精确引用/未发草稿及浅深宽窄四报告图仍有效；3a只读补验明确测得dark的窄屏发现历史，旧误名light图不升级。真实Home卡进入该报告及页面入口返回亦完成，0新模型；完整独立逐状态对账仍待收口。 |
| W33 | 发现 → 生成/自动生成设置 | 方向/范围、进行中、取消/重启、失败/历史结果；设置就近且总页同入口 | S17、S25–26 | `Insights.tsx`、`AutomaticActivitySettings.tsx` | 待验证：本批run08cfc6e6真生成a8120173入档，历史/引用返回有效。剩取消→停稳/重启、失败保输入、就近设置取消/冲突实际UI，用独立受控hold-run，不再新发正常真模型。 |
| W34 | 活动 → 列表/详情 | 进行中/需处理/结束、原因/成果；导入确认或重试、结果/依据→返回；运行信息折叠 | S19–20 | `Activity.tsx` | 待验证：b23763be（dirty）23图实际WorkActivity/operation/import、exact missing job、503、分页、原因/成果、折叠信息和原文返回适用。最终真Activity→现成Memory/发现→返回若补为0模型。 |
| W35 | 首页/阅读 → 待办列表/详情/编辑 | 原文记为待办，保存/取消留原文；完成/重新打开/筛选/依据 | S26–29 | `Actions.tsx` | 待验证：clean5c38bd28 45图、45d4fd0d 5个可读错误增量已验真Todo同ID丢ACK/503/409、编辑、完成/重开/取消与原文。二页Todo专门实际图未见，其他主要app状态有证据。 |
| W36 | 日程 → 列表/详情/设置 | 完整日程在既有授权范围直接生效；详情由用户补缺时间后同范围自动同步；等设备、写入成功/失败/待核实、依据变化；不猜时间、不新授权、无逐项审批队列 | S27–29；自动日程稿 | `Actions.tsx`、`ActionTimeInformation.tsx`、`ActionCapabilitySettings.tsx`；H02/H11 | 待验证：H11两UI差异已修，a17真update-information7图已验；同一grant的Android LOCAL cal1真create/update/cancel与Mote-only complete有回执。自然update仅为进程存活的WorkManager GreedyScheduler，非进程死亡OS唤醒；unknown/late/stale/CAS按旧受控证据。Mac无本机测试日历，未写入。 |
| W37 | 录音 → 正文/回听/局部纠正 | 时间跳转、原转写对照、命名说话人仅当前录音；无音频状态、失败/取消 | S29–30 | `Files.tsx` 内联 FileDetail、`ArchivedAudio.tsx` | 待验证：cleanff607e5e 21图、68603274 5个增量已验回听/raw对照/局部纠正/当前录音说话人/取消失败/无假音频；本批H04真ASR/diarize/dialogue补处理链。真实麦克风/多人/可听质量未验；派生引用JSON差异归W07。 |
| W38 | 录音更多 → 导出/关联日程/处理设置 | 原始转写、导出、关联/返回、重处理排队/失败不称完成 | S29–30 | 文件/录音详情、`FileProcessingSettings.tsx` | 待验证：cleanff607e5e 真raw tar/manifest/pin、503/409恢复、关联原文返回有效。剩重处理后的排队→失败/unknown实际图；打开处理窗不是后续完成；H04真原件hash另列。 |
| W39 | 资料库/全部功能 → 特殊资料 | 截图片段/应用相册及展开原图；应用测得时长；媒体观测；Coding同步状态/原对话 | S38；`fc-segments`/`fc-activity`/`fc-media`/`fc-coding` | `Archive.tsx`、集合视图；四类分别验收 | 待验证：cleanf0ff3799 26图、6831839c 9个截图控件增量已验双分页/原图/返回、测得时长、媒体观测、Coding四阶段/canonical正文及503/409。物理采集/OEM/外部Coding同步另未验。 |
| W40 | 设置 → 设置总页 | 模型服务、自动记忆/插件、用量、存储备份、运行诊断、偏好/全部功能完整可达 | S25–26、S38 | `WorkspaceNavigation.tsx` SettingsLanding、`features/system.tsx` | 待验证：a3006291设置目录、最终77目录与本批web-first-r3/C20/C30可达/返回互补；目录主要操作已有证据。目标effect只读阻断不代表目标业务已授权或通过。 |
| W41 | 模型与服务 → 连接列表/新建/详情/复制/删除 | LLM/OCR/语音、部署只读、协议参数折叠、凭据不回显、改地址显式处理旧密钥、保存/失败/草稿返回 | S20–26 | `ModelProfiles.tsx`、`ModelSettingsEditor.tsx` | 待验证：8fce93e5（dirty）13图已验真新建/复制/删除/409、未保存0写和不改grant；focused保旧secret。fec770d3的15个指定状态中已实际验生成假key改URL、明确保留/清空及取消离开保稿；e86bc3dd三张控件图替代原裁切图，第四张为重复警告，不增加独立状态。0model/0probe，Terra独审。 |
| W42 | 模型与服务 → 模块与模型 | 问答/Memory/回顾/导入/文件分析分配，默认跟随，保存/失败/缺连接 | S20–26 | `ModelAssignments.tsx` | 待验证：clean0d8175a5 14图、f1490a45 7图已验默认/继承/custom、独立CAS409、503、reload取消/失败/成功、403、保稿、中英/窄深。fec770d3实际补验可用列表撤下已存连接、pending保存403撤表及正常退出/登录后旧ACK隔离；缺连接是受控投影，生产删除仍拒绝移除被分配连接。30项相关focused及Terra独审；0model/0probe。 |
| W43 | 资料处理 → 图片/录音/文档/服务详情 | 处理方案、原图授权、OCR/理解区分、转写/分离区分、服务往返保草稿、历史重处理显式 | S21–26 | `PerceptionSettings.tsx`、`FileProcessingSettings.tsx` | 待验证：53dce235（dirty）35图已验图片/音频/文档策略、第二阶段503只重试未知部分、exact服务往返保父稿、本机/远程/仅归档与真DTO。fec770d3实际补验原图授权拒绝保稿与服务端false、真实生成图片历史预览/取消；e86bc3dd替代两个裁切控件图，0历史process/0backfill；旧Api迟到预览已隔离，30相关focused和Terra独审。H04真链另列。 |
| W44 | 资料处理 → 自动处理配置/首次确认/更多 | 全局范围，首次/范围或服务改变确认、取消、暂停/恢复、立即停止；不保存Provider即授权 | S24–26 | `ModelAuthorizationSettings.tsx`；组织层级需改，合同保留 | 待验证：同53dce235实际首次review/取消0授权、exact scope、503、enabled/paused/stopped及设置保存不改授权。fec770d3实际补验服务fingerprint变化后取消0grant、命令实际提交后丢ACK再明确重试：encoded revision/grant与operationId冻结，revision只推进一次；未知时不能发新授权，关闭后保恢复入口。30相关focused及Terra独审，0model/0probe。 |
| W45 | 图片/录音 → 本机准备 | 一键依赖准备/模型下载/启动/可用/失败恢复与安全重试；远程方案收起本地卡，未准备和不可用状态真实 | S25–26；本机识别；本轮追加授权H04 | 基线处理器安装/运行入口仍需补齐完整链路 | 待验证：旧ca19854d有实际固定依赖/模型下载安装；53dce235（dirty）10图区分5个受控准备态与真ready；本批H04同host缓存worker真file-sync→OCR/ASR/diarize→Terra material_read。未称本批新下载、真安装取消或其它平台通过；图片理解未取得像素，derived reader JSON返修。 |
| W46 | 自动记忆与插件 → 开停/方案/插件 | 当前方案、节奏折叠；可信插件核验/安装、准备失败/待核实/重试/明确应用；失败保原方案 | S25–26、S38；`fc-plugin-recovery` | `MemorySettings.tsx`、`PluginCenter.tsx`、`MemoryRecipeSelection.tsx` | 待验证：cleanf892f4b9 28图、e62caf61 5增量实际release/hash/install/worker CRUD/restart、同operation丢ACK、check/enable分开、checkpoint失效、暂停/停止/卸载取消。上游Mem0/Hindsight/Docker/Embedding真兼容和账号未验。 |
| W47 | 插件/诊断 → 实际能力/Agent输入 | 仅实际注册能力、已记录模型输入/工具读取；缺记录/不可用，按需深入 | S38；`fc-plugin-capabilities`/`fc-agent-trace` | `AgentInspector.tsx`、`features/agent-view.tsx`、`PluginCenter.tsx` | 待验证：clean2611268c 18图与21focused已验主动读取/分层/literal/exact原件/缺记录/503/分页；本批真Terra retained5页核firstSeq和truncated，不重构已丢记录。旧harness cursor0错属测试，不是API缺口。 |
| W48 | 设置 → 用量/存储备份/运行诊断 | 结果先行；费用/保留/并发/部署/日志展开；导入导出、失败/取消、支持包真实范围 | S25–26、S38 | `Usage.tsx`、`Vault.tsx`、`RuntimeSettings.tsx`、`Diagnostics.tsx`、`features/diagnostics.tsx` | 待验证：10bce908（dirty）30图实际12receipts/10+2页/5维度、费用未知、价格保存、存储/加解密/日志/部署与503；深色须用e6c7d183修后12.026对比度。clean1ab844b7/eb001a84的独立真实Web/SQLite传输批已补archive导出、JSON导入、支持包下载/取消/失败及不明导入回执保原数量；df4ef6b8仅替代其中一张503默认提示裁切图，不新增独立状态；0model，Terra复核。 |
| W49 | 设置 → 外观语言与会话/退出/重登 | System/light/dark，中英，草稿不丢；session/1d/7d/30d沿用合同，退出后私有导航禁用，空令牌/失败 | S38；`web-preferences`/`web-signin` | `session.ts`已有四选项；仅UI不扩持久政策 | 待验证：a3006291（dirty）17图实际system/light/dark、语言重载保问题/附件、退出取消/commit、错token/重登。四会话到期由focused clock验证，非真实等待1/7/30天，不新增全页面语言排列。 |
| W50 | 设置/帮助 → 全部功能/版本反馈 | 检索/分组/空结果、77保留项到既有入口、返回目录；版本未知/不一致、外链反馈 | S38；`guide`/`web-about` | `FeatureGuide.tsx`、`feature-guide-catalog.ts`；A01去除 | 待验证：实际16折叠组/77唯一项、搜索/清除/无结果、全局记录取消保query、Coding/Activity返回及本批readonly-directory/C20/C30有效。发布下载/反馈站点和真飞书授权不由目录导航代证。 |

### Mac

来源以 S30–31 的本机工作区、S34–35 的轻量落点、S35–36 的首次使用、S36–37 的连续性/恢复和 S38 收尾为准。下表引用的行号均对应第 1 节最终 HTML 的 hash，首次使用须另看 `mote-first-use.html`；各项与第 8 节原消息可追溯。实现路径相对 `apps/desktop/src/`。PNG 只表示原型已有画面，所有产品状态仍未测。

| ID | 页面/入口与源定位 | 必须覆盖的控件、状态与连续路径 | 基线实现映射与差异 | 源证据/产品验收 |
| --- | --- | --- | --- | --- |
| M01 | Mac shell；CSS 296；macRender 4914、6192 | 208px 侧栏：工作台/内容/来源/问一问；底部同步与活动/设置/中央工作台、设备连接；顶部面包屑＋全局随手记。子页返回、窄窗侧栏折叠。 | index.html 32–49 当前首页/资料库/活动，顶部“添加”和中央；缺侧栏设备状态。保留快捷键、窗口身份与导航。 | 待验证：final-ui-product workbench/settings、clean ef09 来源与正常device-session r4保完整shell；navigation风险有效。未发现新增指定应用态缺口，OS菜单边界归M04。 |
| M02 | home；5271、5436 | 提问 textarea、空文本禁用、最近对话→历史/同一对话、最近内容→详情/全部、底部采集/发送真实摘要→设置。 | index.html 54–68 当前 status/onboarding/actions/content/sources/guide；没有首页 Ask 与最近对话。可复用现有 Ask，不能伪造样例。 | 待验证：workbench7态、ef09及真mac-live/r4已验最近内容/共享会话/正常恢复，不能再写最终续问没跑。首读unknown保旧内容由focused覆盖，缺独立实际画面，可并M03。 |
| M03 | first-use/role onboarding；5265、first-use 累计段 | 初次未连接/已连接未保存；写第一条/选文件/开始采集；本机已存/等清点/等回执/原文不可用；稍后、取消、返回草稿。 | connection + home-onboarding + note draft 已有能力，呈现不同；需保留目标核对/权限边界。 | 待验证：82f4a5e8/43f7ac3f/890d9e51已修两类ACK显示混淆，13focused/types及cleanf4六有效态、clean619连接两态、clean02首次正文503新一态互补。实际队列/SyncHistory已ACK后即使从未成功读body，也保中央已收到并撤正文；仅既有producer核device/UUID/source的exact首件行，owner/leave失效，Terra独审。 |
| M04 | 菜单栏/收起/退出；5290–5308 | 打开 Mote/随手记/Central/设置；开始/停止采集；立即发送随真实状态禁用；关闭主窗继续后台；退出是退出。 | 现有 Electron tray/独立窗口能力保留；不要把 prototype 的“收起主窗”模拟页面加入产品。 | 待验证：760380a7/3a68db16已修空队列Send gate，复用含source outbox的aggregate pendingRecords。clean1533真实菜单对象实测empty/source-only/capture/paused/uploading/503保原件与manual、默认可读错误/明确技术详情，2focused/types及10070 catalog通过，Terra亲看报告与主窗。OS菜单/原生dialog像素未验。 |
| M05 | 全局随手记；4924、4985 | 独立编辑入口、正文/选填资料说明；关闭保留草稿、空值禁用、保存中防重复、失败原文保留、保存回原页；发送暂停时仍可本机保存。 | ui.ts 54、575–598 已开独立 quick note 与持久草稿；contracts/note.ts 无 description（H03）。顶部当前“添加”应改直接随手记。 | 待验证：note/first-use、ef09、1f6真实EACCES保稿与mac-live真实937a独立说明/ACK/原文适用。剩同pending双击一次IPC、失败明确重试，以及More→现Central Notes→回native保稿；不新增native附件编辑。 |
| M06 | 内容列表；4904；收到内容链接 | 标题“内容”、副题本机记录；搜索；全部/本机待发送/中心已接收三个按钮；图标/标题/来源时间/真实状态/箭头；空/无匹配/加载/错误/更多。 | content-library-ui.ts 有本机+Central分页与失败；select 过滤没有搜索。不能把“本机保留”误等同“待发送”，也不能只搜索已加载却称全量搜索（Q02）。保留记忆主题/刷新/更多入口。 | 待验证：library全量分页外搜索/403/保旧页、5031（dirty）筛选及09f4无图/401撤More有效。剩Content本身全空/首次loading，不用空日期或搜索无匹配代证。 |
| M07 | 内容详情；4906、5420 override | 本机正文/资料说明/来源状态；已接收时到对应 Central 原文；副本释放后解释并打开 Central；离线/不存在、回到来处及滚动位置。 | 当前 #content-detail-dialog/阶段结果/原始正文丰富，源为页面。能力都保留，不从截图删掉阶段/附件/媒体入口。 | 待验证：library/sources、5031（dirty）/09f4/1f6与真937a received原文已有本机正文、说明、ACK及准确返回。未发现新增指定应用态缺口；个人屏幕/录音物理采集不在本条代证。 |
| M08 | Ask 历史；5364、5437–5441 | “对话历史”列表、右上“新对话”；同一会话标题/轮数/时间；空历史、刷新/分页、离线、登录/未连接。 | index.html 151–156 当前历史与聊天同时双栏；需要历史 landing→选中聊天，保留 pagination 与 scope。 | 待验证：clean78060acd Ask21态替代旧dirty21，5031两页exact ID/empty、09f4的401撤cursor及r4真共享history适用。剩未配置连接的Ask landing/登录入口实际帧。 |
| M09 | Ask 会话；5364–5390 | 返回历史、问题/回答、继续提问、草稿、来源范围、引用、对话更多；已提交跨端一致，原端草稿不自动跨端。 | ask-controller/ask-conversation/ask-presentation 已有服务；当前 scope、登录、revision、分页不能丢。 | 待验证：clean78060acd、真mac-live续问/24px与正常device-session r4保5turn/草稿/scroll。剩Material scope chip→Central同会话范围查看/清除→native返回，现只有chip/IPC目标；不再新发模型。 |
| M10 | 引用/原文/保存回答；5385–5396 | Mac→Central 精确原文→原对话/位置；资料变更轻提示、历史原文不可用不重定向；删除原文保留问答；保存原问答与自己的补充分开。 | 引用 URL/安全 Markdown 已有；历史保留依赖后端 H01；保存回答若无 Mac API 不加假按钮。 | 待验证：原稿5385/5393规定Mac引用交Central，5371无native保存回答；未新增native reader/Save。r4正常device-session实际full-text/pin→native同5turn/稿/scroll已验，旧raw-owner清空图排除。H04 file JSON是Web返修；OS前台浏览器切换未验。 |
| M11 | Ask 中断/澄清；5503、5518、5557 | 发送中/结果不明/检查/同请求重试/失败重新编辑/停止待确认/已停止仍可历史看见/无依据澄清；禁止重复新请求。 | 现有 Ask controller run/id/revision/timeout 等可复用。不得 UI 改业务执行策略。 | 待验证：clean78060acd的unknown/检查/同ID重试/stop待回执及adopted404风险有效；r4实际含删除原文后的历史与无可重核证据第4轮。无新增指定应用态短项，不把受控故障称真实供应商故障。 |
| M12 | 来源列表；4880 | 标题、副题、添加来源；已有来源一行；屏幕与应用组；云来源→Central。空列表、清点中/暂停/失败均真实。 | 当前 sources 页是管理表单+选择控件，需逐行与导航；Coding、日历、筛选等入口不丢。 | 待验证：sources、ef09/cd6已有来源行/暂停/连接。剩真正空列表、首次清点和明确失败row，与M16同一生成来源批补，不用空编辑器代空列表。 |
| M13 | 添加来源弹窗；4924 add-source | 文件夹、单文件、Coding Agent、本机日历、云端来源 Central；取消，选后进入原入口。 | #add-dialog 当前 folder/file/screen/note/lark 混合通用“添加”。定稿来源弹窗不能吃掉仍有的本机日历/Coding。 | 待验证：sources五入口取消、cd6的Coding/calendar、first-file实际generated选件适用。剩cloud来源按钮准确Central sources目标/返回，可并M39单次遍历，不重复下游业务。 |
| M14 | 文件夹/单文件/编辑来源；4868–4879 | 来源返回；选择/更换本机路径；模式；说明 scope；首次 all/new_only；retention snapshot/archive/metadata；allowRead；目标；高级名称/间隔/扩展/排除/遮盖/删除跟踪；取消/保存/禁用/格式错误。 | SourceOptions 有范围/保留等，未有 authored description H03；UI 不得增加后端不支持同步方式。选原已存在来源保持说明草稿。 | 待验证：sources真实folder/file/editor/cancel/晚回执与source-selection/manager风险有效。剩reference仅元数据+new_only/allowRead代表呈现、高级展开及无效options保原稿；不扩模式/格式政策。 |
| M15 | 选择文件/文件夹；4920、选择 handler | macOS picker；取消不清原配置；同来源不重复添加；更换选择保持填写草稿。 | main native dialog、SourceSelectionController/UI beginSourceSelection 已有。需 fixture cancel + retry。 | 待验证：first-file单/多文件与合同已验generated文件public selector→exact sourceIDs。无新增指定应用态短项；macOS picker像素、security-scope及物理权限未验。 |
| M16 | 来源详情；4882、5408、5438 | 暂停/恢复、编辑、资料说明/待同步；已清点/待发/跳过；首次清点中；保留/发送/上次清点；待发详情；跳过原因；暂停不移除。 | 当前 source-controls/summary、SourceStatus 有真实 facts；资料说明 H03；Mac removal 不新增。 | 待验证：sources暂停/恢复/context409/403/reader403有效；真note ACK不冒称source ACK。剩首次清点→一项skipped/读取失败原因→明确retry回同source，与M12合批，不泛化全部长期状态。 |
| M17 | 来源/采集资料说明弹窗；4924 | 单来源已有/后续或单条；保存待同步；采集 duration/screenshot/structured 各来源可选说明应用到草稿；取消不保存。 | Mac note/source/capture metadata transport 缺口 H03，不能只有 toast。 | 待验证：clean3a13五中文态、d74单英文与10focused已验时长/截图/结构化三说明、通知closed More、cancel→apply draft→主save CAS/outbox及partial只重试余稿。H03真说明另见mac-live/H04；不是Mac四物理采集通道证明。 |
| M18 | Coding；4924 coding/codex-source；最终 Coding 源入口 | 本机 provider 发现/未发现/会话同步；打开真实 source；Central 专页入口。 | 已有 coding-agents/source manager；保留 UI 列表与状态，无新增 provider 自动恢复策略。 | 待验证：cleancd6十三态已有私有home Coding发现/解析/原文与ef09首次连接。无新增指定应用态短项，不读取用户个人Coding profile，不扩所有provider/OEM矩阵。 |
| M19 | 本机日历；4924 calendar；收尾日历范围 | 系统权限→已授权日历选择→资料说明→连接同步；过去/未来范围为实际现有实现；取消；选择为空禁用。 | SourceOptions/calendar APIs 已有，说明H03待补；追加授权H02允许现有设备/日历范围内更新、取消、完成，不扩大范围。 | 待验证：cd6/1f6及9f英文替代图覆盖generated denied/empty/listfailure/choice/cancel/save、30/90及closed-view守卫。真实EventKit granted/localSourceCount0，按owner范围停止；Mac真实读取/写改取消未验，不能由Android代证。 |
| M20 | 屏幕记录；4850–4867 | 已暂停/运行状态与开始/暂停；默认范围折叠；应用搜索/全部/单独/需留意；app列表+规则；三个独立通道；默认继承；不支持结构化真实提示；dirty save/reset。 | 当前 screen/privacy 分离，app-capture-ui 有通道与真实能力；不能把默认样例 Chrome/微信“已连接/可用”固定化。 | 待验证：settings与clean6ba七态已补默认折叠/搜索/all/custom/attention/inherit/unsupported/dirty/reset；说明草稿不改采集。无新增指定应用态短项，物理screen/a11y/通知未验。 |
| M21 | 开始复核＋系统权限；4919、4924 | 保存规则后复核；dirty 时先保存/还原；确认后真实权限检查；拒绝/取消/设置回来仍需明确开始；权限随通道需求。 | 现有 capture-confirm-dialog、permissions page 和 request/inspect API；保留原未保存保护。 | 待验证：settings Tray review/cancel与ui/permissions已有gate/lifecycle。剩受控native拒绝→设置返回仍stopped、dirty保存/还原后再review实际UI；不启动个人采集，真实TCC往返另未验。 |
| M22 | 隐私与过滤；4924 privacy | 应用规则入口、固定遮挡、确切文字过滤、锁屏/休眠；新增仅后续；返回应用范围。 | 当前 privacy 页完整配置、masks/edit/native editor 等不能被 prototype 摘要删掉。 | 待验证：settings隐私及clean6ba的literal/mask草稿/失败/reset有效。无新增指定应用态短项；物理遮挡像素、真实锁屏触发不能由配置证明。 |
| M23 | 同步与活动 pending；4892、5410、5439 | 待发送/接收历史 tabs；真实发送模式/暂停/等待回执；本机 rows；PauseAll/Resume、SendNow；队列空/paused source/重复点击。 | 当前 work/activity/upload/sync-history 分散。可整合呈现，不改变 gate/policy；sync.png 的“按设置发送”只是样例，不能硬编码。 | 待验证：1f6/ace默认行和保旧页、5031（dirty）/09f4的503/终态/epoch及mac-live真ACK有效。剩零队列/仅暂停source pending呈现、同未决发送第二次不增attempt，可并M04私有夹具。 |
| M24 | 接收历史/同步回执；4892、4898 | 历史列表/筛选/回执详情：已接收、未确认、时长大小、具体记录；重试同记录；未知不说未收到；回执≠解析完成；返回。 | sync-history-ui 有真实 time/source/outcome filters、pagination、receipt detail，必须保留。累计 ctMacSync 演示 singleton 不构成删此能力授权（Q02）。 | 待验证：原56-request IPC、5031（dirty）四筛选/日期、ace首读失败不补零及mac-live a95d绑定937a适用；旧伪0 receipt图排除。剩unknown显式检查→同capture→返回保筛选actual，不重跑所有分页。 |
| M25 | 发送设置；4903 | batch/interval/realtime/manual；按模式字段；save/cancel；保存保持 pause；立即发送不改变策略。 | #sync/SyncPolicy 已有；只重排控件、真实文本。 | 待验证：1f6/5031（dirty）batch/interval保存失败保稿、09f4的503不改policy与mac-live真实retry有效。已有指定代表应用态，不新增四mode×全部错误×主题乘积。 |
| M26 | 设置 landing；4912、6190 | 屏幕记录/发送/隐私/系统权限/连接与存储；Central 模型服务自动处理；此Mac偏好维护。 | index.html 133–150 当前 inline 外观语言+tile/统计/高级；移至子页仍保留全部原入口。 | 待验证：settings/ef09当前nav分隔/heading及64c维护层级有效。未发现新增指定应用态短项；Central各目标验收不复制成Mac设置页新义务。 |
| M27 | 连接与存储；5406、5697；首次连接系列 | 连接实际目标、待发量、已确认释放、原件保留；待发送/Central；连接目标预览确认，取消；备份恢复、存储位置。 | 当前 connection 单页 + storage 藏 capture；拆呈现可复用 API，不改 binding/sync semantics。 | 待验证：settings/connection-smoke与r4正常生产device-session/ticket已补真实session，不放宽raw-owner reset。剩生成过期邀请/错目标取消保旧配置与首件草稿，可并M03；真实Keychain/QR相机/个人服务未验。 |
| M28 | 备份恢复 landing；5668 | Mac 待传数量、导出队列 JSON/恢复；详情准确包含范围；元数据 JSON另入口；storage/Central 导出。 | exportQueue/importQueue/exportJSON存在；需保留 profile/真实选择路径，不将 JSON当设置或AndroidZIP。 | 待验证：clean64c/b21、e629、1f6已验总数/来源独立队列、包含排除、位置与metadata入口。无新增指定应用态短项，旧诊断图被94e替代者不复用。 |
| M29 | 恢复 picker/working/result；5670、5700 | 选择JSON/取消；说明目标与当前发送；暂停入口；工作进度；invalid/partial/retry same/imported/local/queue；Mac不先切manual。 | importQueue API仅 {canceled,imported} 或 reject，部分结果和同文件retry H07；不得声称失败时零导入。 | 待验证：settings/clean7f33真quota0写、52d终态、1f6所选文件/unknown size/非QueueFailure原throw、f003真实fsync lowerbound1后明确重选同包dedup有效。旧quota/partial待验句失效；OS picker外观未验，不新增checkpoint/自动retry。 |
| M30 | 导出 picker/working/result；5678、5701 | 保存位置/取消；working；success/失败重试；不清队列；元数据非完整附件备份。 | main.ts 601 exportQueue 与真实结果路径；失败不能跳success。 | 待验证：clean7f33实际EISDIR→显式retry/字节、1f6文件卡/结果层级/取消清旧身份且队列仍在有效。无新增生成应用态短项；OS save picker未验，metadata非附件备份已明确。 |
| M31 | 存储位置及迁移确认；5679、5702 | 原/新目录、实际path/容量；复制验证；cancel/working/moved/space error/旧副本待清理/切换待恢复/磁盘离线/重启核对；Central和来源原件不迁。 | 现有 queue-storage/storage flags/API；需原有状态和重启行为，不借 UI 改策略。 | 待验证：bbcf52d1/f4e5dd1c优先显示真实recoveryRequired/当前目录待确认、保两份和当前Storage恢复入口，完整capture挂载不搬走；clean65a真FS pointer已落盘后ACK抛错、两份SHA一致/拒新写/stopped/可见按钮实图，14focused及Terra独审。旧7f33冷启动另保版本；本批未点恢复/真拔盘断电。 |
| M32 | 此 Mac 设置；5813 | 外观语言、采集高级、Chrome、帮助诊断、关于版本；返回原设置。 | 当前偏好/采集/developer/about 分散；仅增加导航呈现，不新增一级端。 | 待验证：settings/chrome/ef09/64c已有此Mac五入口和上下文返回。无新增指定应用态短项，不重复目标页全业务。 |
| M33 | 外观语言；5821 | system/light/dark，system/zh/en；显式 apply；保存/取消/失败保留草稿；runtime profile/path/credential信息只读。 | 现有 preferences立即应用语义需核对是否支持显式 draft/save；UI可按现有 config保存。翻译共享 parent协调。 | 待验证：settings/appearance/clean78060acd及admitted语言风险保apply/cancel/失败稿与真实profile信息。冷载主题/system已有，不改OS全局；不增加每页每locale全乘积。 |
| M34 | 采集高级；5823 | sample/idle/login/battery/lowpower；质量/边长/dedupe；队列MiB/数量；reset/save范围校验、失败保留、保持running；命名profile不注册登录项。 | 当前 capture页已全部有；数值边界必须用实际 config contract，不能随演示增加范围。 | 待验证：settings/6ba/09f4/1f6已有高级数值、queue/reset/save，原稿5823 JPEG本为number。剩named profile禁系统login项的实际说明/控件，不注册OS项；物理running采集保存和真login注册未验。 |
| M35 | 图片压缩预览；5824 | quality/maxside→更新真实比较→apply draft；未生成禁用；失败/取消；回到原设置仍需save；不改已有图片。 | compression-preview API/UI已存在；保留实际图像来源权限，fixture用生成图。 | 待验证：1f6真实encoder/无自动生成/late/invalidate/failure与settings apply-to-draft有效，zoom/metrics More保留。无新增指定应用态短项，generated像素不证明个人屏幕权限。 |
| M36 | Chrome 页面采集；5825、5845–5850 | prepare native bridge→browser install/grant→recheck真实权限；origins保存；实验规则草稿/load确认/save；取消/拒绝/缺权限/断桥不可成功。 | setupChromeCapture只返回directory/id/manifest，当前采集bridge状态不能证明所列origin授权；独立check接口缺口 H09。已有准备和编辑能力保留。 | 待验证：旧socket实际、7f33规则load/cancel/discard/savefail、64c生成home registration ACK/late/unknown gate及H09 wrongreply/busy/timeout/origin风险有效。无新增应用态短项，个人Chrome安装/grant/无痕/真页面采集未验。 |
| M37 | 帮助与诊断；5822、5837–5839 | enable/interval、save、refresh数值、1h/24h/7d logs/export diagnostics/support；pick位置/cancel/error/retry；不自动发给任何人。 | 当前 developer/support已有，不删性能数值/阶段日志入口；真实export结果。 | 待验证：settings真recorder和1h/24h/7d导出排除原文、7f33 raw-log失败重试、94e新ACK/owner gate两态替代旧sample-click推断；facts在controls后/export前。无新增短项，OS save与支持包外部消费未验。 |
| M38 | 关于/Dev/Prod更新；5814、5831–5835 | 实际build/profile/version；Dev手动artifact；Prod channel/check/download/verify/reveal/install；未保存输入guard；cancel/error/rollback/新启动确认；feedback external。 | updater/ui已有完整真实状态；样例版本0.1.0和fake success不能抄。本任务不执行安装/部署。 | 待验证：b04f92f8补源5834安装确认，取消0IPC、继续前复核same ready/dirty/note，4focused/types及clean a787四实际态已验：签名current、生成ad-hoc签名MachO/ZIP/ditto/native inspect ready、dirty拦截、确认取消。无install/生成App启动注册/实装回滚证明，Terra独审；旧错误10态不重标新通过。 |
| M39 | 全部功能/低频内容 | 收尾 T38“全部功能”；Central功能目录包括活动/媒体/Coding/Memory等。 | 当前 home features、content memories、work/upload/statistics 等必须可发现；源六图省略不代表授权删去。放到既有设置/低频页需协调明确归属（Q02）。 | 待验证：memory-topics真实HTTP32项/树/原文返回/403/empty、time/disk有效；H04是Central媒体真处理，不冒称native完整媒体工作区。剩低频目录/Memory/recall/activity/cloud准确Central route/不可用/返回单次bounded遍历，不新增native整理能力。 |

### Android

来源以 S31 的原生页能力、S33–34 选中的轻首页、S35–36 的独立首次使用、S36–37 连续性/恢复、S38 收尾为准。`final` 是最终 HTML，`first` 是首次使用 HTML。下表 P 编号只用于本轮验收，不能与第 7 节历史 Android A 编号混用。实现路径相对 `apps/android/app/src/main/java/`；类名须按实际包定位，未指定行号不代表已完成界面核验。

| ID | 页面/入口 | 必须覆盖的控件、状态与连续路径 | 源/定位 | 基线实现映射与差异 | 源证据/产品验收 |
| --- | --- | --- | --- | --- | --- |
| P01 | 日常首页 | Mote + 右上菜单；“想问什么？”；最近对话；底部仅“记录 / 继续草稿”和“问一问…”；记录保留本机回执；只有可处理采集错误显现；离线不丢草稿；已有发现可展示，不制造发现。 | final 5159–5249、ct 覆盖 5364–5434；轻首页接受 turn `01a18367…` | `MainActivity.buildToday` 常驻问答按钮/状态/首次使用/本机笔记/发现；无最近对话；四 Tab + 中间全局记录。应换布局，recent 使用已有 conversations 接口。 | 待验证：84a6671e/9f3026b9/d3ed64e8恢复原稿compact最近结果，只有GET现a812并核owner/origin/epoch/foreground和点击身份，不生成。R6 source079/newMain315e/APK931a/catalog10071只补浅深两图3.706s，Root当前Mac新增三key10074未在旧APK，非完全同构建；Mac/Terra亲看独审。 |
| P02 | 菜单“我的 Mote” | 回看：资料与记忆、发现历史、日程与待办；这台手机：采集与同步、设置；Central；采集开关与发送开关独立。返回首页且草稿不丢。 | final `liteManage` 5174 | `MainActivity` / `PrimaryNavigation` / `NativeUi.MotePrimaryNavigation` 分散入口；需所有次级入口保持可达，不能简单删除 Tab 丢页面。 | 待验证：本轮六菜单与既有consumer实际分段核验，Agent/Lark根自刷新返回环由31f75ff2修。R4整体FAIL保留，失败前12逐项返回可复用；R5只剩13成功，不声称一方法25通过。More实际25+独立Ask=26，外部业务不由导航证明。 |
| P03 | 首次启动/首条记录 | 欢迎→先记下一件事；文字/照片/语音；本机先保存并可读原文；连接可后做，采集可后开，模型非前置条件。正常用户不重复承接卡。 | first `onPhoneHome` 5350；turn `01a1838f…` | `firstUseState` 有真实首次使用判定，现卡文案/层级不同；必须保留该行为，final 缺本页合并。 | 待验证：当前候选尚无完整逐状态一致证据。<br>已集成；阶段：欢迎→编辑→本机保存回执→原文；已使用后不重复welcome；保存可在未连接/无模型条件完成；真实相机/picker/录音另见P06。；终验待执行 |
| P04 | 初次连接/连接管理 | QR / 邀请文件 / 粘贴；预览 Central、设备名、owner 权限、本机旧记录绑定；明确连接；取消/格式错/失效/连接失败保留输入；返回；连接后采集/发送仍独立。 | first `onConnection` 5385；final settings/connection routes | `ConnectionActivity` / `ConnectionScanActivity`、`MainActivity.buildConnection` | 待验证：已修复原默认长表单差异；邀请/已存状态优先，手工 URL/token/name 及核对保存归入连接设置。clean native 源树 f61ac6d6 对应 P04/P26 的 3 个新增方法与 2 个受影响方法、10 张有效图通过；保持原绑定、来访草稿、权限和独立发送/采集。各图绑定实际 APK，后续翻译需最终构建；完整状态/跨端待终验。 |
| P05 | Central 安装帮助 | 复制安装提示/文档；“现在先记下来”；离开/返回保留本机内容。UI 不实际安装 Central。 | first `onHelp` 5390 | 现帮助路径需逐入口核对，属于首次使用缺图项。 | 待验证：当前候选尚无完整逐状态一致证据。<br>已集成；阶段：复制实际安装提示；文档入口；现在先记下来；帮助返回不清本机草稿。；终验待执行 |
| P06 | 随手记编辑器 | 顶栏返回/标题/保存；文字与图片、语音、文件；引用原文与自己补充分开；可选说明；空内容/录音中不能保存；附件移除/播放；picker 取消；权限拒绝；离开停止录音留草稿；外部分享遇已有草稿继续/替换确认；保存回原入口。 | final `pEditor` 5022、light header 5190、actions 5081–5149 | `RecordEditorActivity` 已有耐久草稿/分享/附件/录音/引用；保存仍底部、2×2附件按钮；独立说明无 `RecordDraftStore` 契约，H03。 | 待验证：当前候选尚无完整逐状态一致证据。<br>已集成；阶段：引用原文在本人补充之前初始展开；折叠/重建保留；独立description；真实分享图与原文显式保存；有旧草稿继续/替换；真实AAC录音停止预览、离开停止并保留；picker取消/生成相机照片保留。；终验待执行 |
| P07 | 文件一次导入 | picker→已选项；可选说明只作用当前文件；一次导入/明确持续同步；模式、类型、大小限制等高级展开；取消保留此前草稿；校验错不提交。 | final `pFileForm` 5031 / file actions | `FileTaskActivity` 已有说明、durable draft、目标与 context ACK；布局/高级参数/入口需对齐。 | 待验证：当前候选尚无完整逐状态一致证据。<br>已集成；阶段：进入不自动picker；取消/重建保留description；真实系统文件选择复用原有配置；原范围未保存不变；大小0真实拒绝，light/dark错误字段可编辑。；终验待执行 |
| P08 | 文件夹来源 | picker→已选目录；说明作用整个来源当前与后续内容；支持/音频/自定义过滤、all/new initial；snapshot/archive/reference；扫描间隔15–1440、上限1–512、扩展名/排除/allowRead；返回/取消/错误。 | final `pFileForm` 5031 | `FileTaskActivity` / `SourcesActivity` 既有契约；不可省掉真实处理同意或范围语义。 | 待验证：当前候选尚无完整逐状态一致证据。<br>已集成；阶段：系统目录picker、音频/自定义范围、all/new、snapshot/archive/reference和既有高级配置/description保留；错误不创建来源；dark数值范围校验。；终验待执行 |
| P09 | 来源列表/添加 | 本机来源列表；添加文件/文件夹/屏幕/云端；final 补本机日历；采集、通知/设备信息、同步；其他来源到 Central；空列表；返回。 | final `pSources` 5037、6188 | `MainActivity.buildSources` 扁平按钮+`SourcesActivity`列表，与最终单层列表入口不同。 | 待验证：当前候选尚无完整逐状态一致证据。<br>已集成；阶段：文件/目录/采集/日历/通知设备/其他Central来源可达；空来源页面；header加号无裁切；light/dark。；终验待执行 |
| P10 | 来源详情/暂停/移除 | 当前状态/待发送/说明；待发本机条目、Central 已归档条目区分；编辑；暂停/恢复；删除连接前警示未发暂存与原件/中央保留边界；取消不删；移除后为空/返回来源。 | final `pSourceDetail` 5038 / source actions | 现 `SourcesActivity` 编辑弹窗 neutral 直接删除，需明确确认；暂停保存现有待发；不改 LocalSourceStore 既有筛选变化导致暂存清理策略。 | 待验证：本轮R5真实所选source→通用Central archive→同source，名称/说明/暂停状态保持，19.994s与后13consumer合批。原稿本就generic archive，不猜source关联；原受控source故障和真实OEM限制保留各自版本。 |
| P11 | 资料与记忆 | 我的资料/我的记忆；本机/Central 区分；原文预览；无本机副本可去 Central；Central 离线/无资料/空记忆真实显示；不假定本机有副本。 | final base library、ct library overrides | `CentralLibraryViews` / 本机记录列表等分散；需入口/阅读边界对齐，不能伪造逐原件已接收，H06仅约束新增接收/统计政策。 | 待验证：原5399的下划线主Tab、默认本机及可见本机/Central位置由 `b914238f`→`43b3a360` 恢复；Central记忆More先前25ac批与7 JVM/4native保留。无新增native整合消费者，5044/5936仍按6209–10真实端归属。当前10068 APK的受影响原生补验进行中。 |
| P12 | 本机原文阅读 | 原文/引用/图片音频文件；说明独立；来源与存储信息渐进；本机可用不等于 Central ACK；来源/资料到同一详情且返回原位。 | final `pItem` 5045、ct reader | `CaptureRecordsActivity` / `FileContentActivity` / `LibrarySourceReaderActivity` 等现页，需要原文身份和 back 复用检查。 | 待验证：旧note当前context/原文与附件证据保持原版本；6f11f833 file-derived严声明投影已在Android新Main2e30062c/APKde68ff43/canonical10069实际三引用9图通过，More完整旧canonical、同turn和后来草稿返回，正常短期owner已注销并恢复collector/私有字节；Terra亲看。当前Root10070只多Mac未用literal，不称与APK完全相同。 |
| P13 | 屏幕/应用采集 | 应用时长、截图、结构化三项默认范围；按应用搜索/继承/自定义/全关；结构规则支持提示；保存→预览→明确开始；暂停；拒绝权限/恢复权限仍不自动启动；OCR 与设备事件入口；来源说明弹窗。 | final `pCapture` 5052、`pCaptureStart` 5121、light override | `MainActivity.PRIVACY/CAPTURE` 既有独立状态、系统授权；布局需整理；采集 source description 契约未找到，H03。 | 待验证：49909fd9→266886b9仅刷新现有启停标题。Development主4bdde64c/MainTreeba7aabc4/catalog10083；R6完整11.534s实际正常A11y Allow、两次SystemUI Projection同意、仅生成外部testAPK截图入队、运行迁移复用原grant/service、菜单暂停、停止迁回不autoStart、fresh开始再授权及masterStop。R7 4.157s仅补真实SystemUI窗口，替代R6过渡帧；标题/迁移/权限图已由Terra独审。所有原queue字节/ptr/id、prefs/private3/9573/cal1event7、A11y/通知false恢复，0HTTP。OEM长期后台与物理权限差异未验，不升整组。 |
| P14 | 按应用详情 | 默认继承/自定义；时长/截图/结构三项；支持与不支持结构化不同；保存/取消/返回保留范围；未知应用不推定支持。 | final phone app route / capture actions | 现 CaptureRules / per-app UI；不得改真实采集能力。 | 待验证：当前候选尚无完整逐状态一致证据。<br>已集成；阶段：支持结构化规则与未知/不支持应用不同提示；继承/自定义三个channel独立；保存/取消/重建；详情无多余全局开始按钮。；终验待执行 |
| P15 | 同步与上传 | 当前/上传历史；发送暂停与采集独立；立即发送待真实回执；数量有范围；日志 request 不冒充每条原件 ACK；离线/失败/待发/重复点击/返回。 | final `pSync` 5056 / log route | `SyncQueueActivity` / `UploadHistory` 有真实 ledger；旧 Android 数量/状态 hold 仍存在，H06。 | 待验证：当前候选尚无完整逐状态一致证据。<br>已集成；阶段：真实Central四条generated originals的present/missing/owner-deleted/conflict；当前/历史；确认/未确认分离；暂停发送不启动采集；真实跨日receipts与结果筛选双主题。；终验待执行 |
| P16 | 同步恢复 | 核对两端已有保留记录；准备重放前确认；取消/停止；缺原件、被删、冲突明确排除；真实执行状态。 | final `pRecovery` 5060 | `SyncRecoveryActivity` 已有机制；不通过 UI 编造重新接收成功。 | 待验证：当前候选尚无完整逐状态一致证据。<br>已集成；阶段：实际reconcile保留present/missing/deleted/conflict；重放确认取消不写；重放2项成功且deleted/conflict不复活；stop保留原件及暂停状态。；终验待执行 |
| P17 | 问一问/会话 | 顶栏返回/历史/新建/更多；消息区与底部输入；scope chips strict/anchor/none；scope 改变/切换已有会话遇未发草稿确认；离线/未连接/模型不可用分别处理并留草稿；返回菜单不丢输入。 更多→本轮模型/检索/费用未估价/已读依据；整段对话删除有确认/取消/失败保留（S38，最终6173）。 | final ct functions 5364–5434；first ask readiness | `CentralScreens.ask` 现所有参数、按钮与历史一起纵排；底部输入/历史次页/More 需重组；已有接口可用。 | 待验证：`944d5e7a` 将底部动作恢复至 42dp，保留现有 composer/history/More/scope 与草稿守卫；有对应 Development APK 的实际触控、主题重放和返回证据。尚未在统一最终构建完成整组比较。 |
| P18 | 历史/继续对话 | 已提交问题和回答跨端读取；选中原 conversation ID；新会话；空/加载/错误；离线仅已加载快照；源修改/删除轻提示，历史问答必须完整可见并可继续。 | final ctHistory 5364–5365；turn `01a183b0…` | `CentralConversationPresentation.read` evidenceDeleted 返回 result=null；后端也删除答案。H01。不能仅改文案当成功。 | 待验证：真共享65b/turn4969及同对话历史已有旧精确build证据；本轮R2实际深色20+9分页、历史版本提示/未发稿重建3.793s，0query/capturePOST。R2与后续Main只首页样式/根返回差异不冒称全部重跑。 |
| P19 | 引用与保存问答 | 点击 citation→对应原文；返回原对话与滚动位置；历史/已删原文不可用不能重定向成新原文；保存问答→引用+自己的补充+独立说明；本机先保存。 | final ct evidence/reader + editor origin | 既有引用身份/记录编辑功能需 UI 对齐；说明同 H03。 | 待验证：42dp 修正及精确 citation reader/返回已集成；阶段已验 capture identity/availability/origin guard 和保存时摘录、本人补充、说明分离。统一最终构建的整组仍待验证。 |
| P20 | 提问执行异常 | 等受理/流式/停止待确认；同一请求重试；编辑后重新发送；证据不足；取消/重复操作；失败保留问题与附件；不造成功。 | final recovery `ra*` 5503–5580 | 已有 run/retry/stop 状态，需布局与文案核对；执行策略不改。 | 待验证：`65089b19` 将完整错误收进显式详情，`41d06ba3` 保留同请求已确认失败并追加随后 conversation 503 的诊断链；对应实际 native 组合回归通过，Mac 只读复核未见阻断。原 pending ID/body、accepted 404、停止和 later draft 合同保留，最终整组仍待验证。 |
| P21 | 提问图片与单次模型 | More 下选择模型；最多既有 API 允许的图片数；选择/移除/上传进度/上传失败/重试；保留文本与附件；发送中禁重复。 | final `fi*` 6159–6177 | `CentralScreens` 已有模型和图片参数，现常驻参数需收起；原型演示图片不是真实数据。 | 待验证：42dp 动作行已集成；保留实际 picker cancel、8MiB 拒绝、丢上传回执后同 manifest 重试、移除晚回调、4 张上限及 owner/new-session 清理的阶段证据。最终完整图片/模型状态待验证。 |
| P22 | 发现历史/详情 | 从菜单进入；空/已有结果；默认一份排版内容，更多里切格式；返回；引用转原文；不新增发现生成机制。 | final lite-insights / lite-insight 5174+；turn `01a180e5…` | `HomeDiscoveryView` / Central native discoveries 已有；需保留可达，首页常驻大块移除。 | 待验证：`944d5e7a` 已改单层发现阅读、localized 日期/真实依据数及正文编号到精确原文再回同报告。实际专用 AVD 子状态与 6 项 JVM 表现合同、原 7 条旅程证据分别保留；统一最终构建和真实 Terra 结果待验证。 |
| P23 | 日程与待办 | 从菜单到现有 Central 页面；导航/返回/空/错误；创建及已追加授权的更新/取消/完成默认生效，仍按现有设备/日历范围和真实回执呈现。 | final lite-manage / Central calendar；本轮追加授权H02 | `CalendarActionsActivity` / central route；H02已授权，须实现及验证完整执行链路。 | 待验证：`b914238f` 增加同一日程/待办宿主下划线Tab并复用现有Todo消费者、列表和owner草稿；`5765dbfd` 修复独审发现的旧owner日程残留及迟到/旧确认回调，foreground固定client+scope守卫，默认worker/设备执行不变。原CalendarProvider四操作证据保留，新宿主/跨会话受影响状态补验进行中，非最终真实Terra回执。 |
| P24 | 设置与“这台手机” | 采集/权限/同步/连接/本机存储/备份等保留；外观语言、关于更新、权限后台、图像质量、本机日历、本机统计、日志保留、诊断分组。 | final `pSettings` 5065 + `device-options` 5750 | `MainActivity.buildSettings` 过长扁平清单/参数；现高级能力必须保持次级可达。 | 待验证：当前候选尚无完整逐状态一致证据。<br>已集成；阶段：采集/权限/同步/连接/本机/备份/日历/统计/诊断/appearance等保留次级入口；light native分组可达。；终验待执行 |
| P25 | 外观与语言 | system/light/dark；语言切换；已有输入/附件/授权保留；返回。原型只演示中文/英文，不能删除产品既有其他语言。 | final `fp-appearance` 5753 | `MoteI18n` 已有8语言，`NativePresentationStyles`/`NativeAppShell` 保持组件和草稿；现对话框与整页不同。 | 待验证：当前候选尚无完整逐状态一致证据。<br>已集成；阶段：system/light/dark选择框完整描边；八语言选择保留；实际connection/preview/diagnostic表单焦点/选区/disabled/light-return不改配置；theme/layout替换时secret与draft守卫。；终验待执行 |
| P26 | 关于/更新/反馈 | build/profile/version 真实；PROD 检查/下载/系统安装确认/失败/取消/删除下载包；DEV 手动 Actions；仓库/channel 高级；反馈明确外部浏览器，不自动发送。 | final `fp-about`/`fp-update` 5751–5752 | `AppUpdatesActivity` / ABOUT/DEVELOPER 已有；不从示例0.1.0取产品版本。 | 待验证：414b5cf8已将ready/install_permission删除安装包按钮置主区，保执行中禁用和签名守卫。TEST独立包R2实际5.733s验证合成current/available/downloading/checksum/ready与真实生成APK/part删除；既有APK verifier0.303s拒错证书/包名/降级/篡改，canonical公钥未替换。两个TEST包已移除，原Dev数据/权限不变；Terra独审。没有canonical GitHub发布/下载、真实Prod系统安装证明。 |
| P27 | 权限/后台运行 | accessibility、通知使用权与通知提醒分开、usage、projection会话、电池/自启动/受限设置、HyperOS帮助；返回后核对；授权不自动开始采集。 | final `fp-permissions` 5760 | 现 `MainActivity.PERMISSIONS` / 平台 capability 有；需布局/入口改，不能假定已授予。 | 待验证：当前候选尚无完整逐状态一致证据。<br>已集成；阶段：权限分组/独立通道入口、返回核对；无accessibility→控制grant真实service连接→返回仍enabled=false/projection=false/queue0。；终验待执行 |
| P28 | 图像质量/采集去重 | JPEG40–95；off/exact/near；保存；预览；对比诊断默认关、20条/32MiB/24h边界；关后保存清理；批量去重入口；无权限/未保存状态。 | final `fp-images` 5756 | `MainActivity.PROCESSING` 已有；集中 form 与详情需对齐。 | 待验证：`b914238f` 恢复5756默认JPEG/去重/保存/预览及诊断样本的顺序和层级，原五种wire子档显式选择保留；`5765dbfd` 把JPEG恢复可直接编辑number，并以raw-source稳定key保留跨语言未保存值。边长等高级能力仍可达，不新建语义档映射或改变压缩/保留策略；受影响native补验进行中。 |
| P29 | 压缩预览 | 质量/最长边；真实尺寸/bytes；刷新；原图/结果放大比较；无图/加载/失败；返回保留配置。 | final `fp-preview` 5757、5797 | `CompressionPreviewActivity` 已有生成/比较；原型 fixture 不复制为真实指标。 | 待验证：当前候选尚无完整逐状态一致证据。<br>已集成；阶段：实际生成PNG/JPEG尺寸/字节、参数编辑验证/重建/显式刷新；codec依赖故障清旧图禁用apply→真实codec恢复；放大；dark focus/disabled/失败。；终验待执行 |
| P30 | 去重诊断/批量去重 | 诊断空/对比/清空；批量扫描/结果/待决定区；候选和保留图对比；隔离/恢复/删/永久删确认；只删本机副本；取消/失败不误报。 | final `fp-dedupe-log`5758、`fp-bulk`5759、`fpCompare`5764 | `ImageDedupeDiagnosticsActivity` / `BulkDedupeActivity` 已有；执行边界保留。 | 待验证：当前候选尚无完整逐状态一致证据。<br>已集成；阶段：真实diagnostic pair/empty/zoom/clear；actualworker空scan/候选/compare/待决定区move/restore；永久删除确认取消原件不变；dark caption可读并有实际颜色断言。；终验待执行 |
| P31 | 本机日历来源 | 读日历权限→真实日历 picker；前0–365/后1–365天；首次all/new；可选说明；保存后等待本机扫描，不能立即报 Central 接收。 | final `fp-calendar` 5761 | `SourcesActivity` 支持日历、`LocalSource` description/`SourceContextSync` 对所有kind有效；缺说明控件，可纯UI接现有契约。 | 待验证：当前候选尚无完整逐状态一致证据。<br>已集成；阶段：说明取消不写/保存独立contextDirty、scope保留；移除确认取消/移除真实store；OS权限不隐式改变。；终验待执行 |
| P32 | 本机统计 | 当前记录/待发送/图片bytes/其他bytes，与累计保存/隐私拦截独立；未知不补；无伪造按天计数。 | final `fp-statistics` 5762 | `StorageStatisticsActivity` / `ActivityStatsActivity` 已有；显示范围需明确；H06适用。 | 待验证：当前候选尚无完整逐状态一致证据。<br>已集成；阶段：实际文件长度/UTC lastModified两日磁盘分布；明确不是每日新增；本机records/pending与累计分开、隐私未单独统计不补0；dark数据与边界。；终验待执行 |
| P33 | 上传历史时长/日志 | 7/30/90/365天；只清历史不删原件/草稿/待发；日志all/failed、请求状态/bytes/耗时；不当原件 ACK。 | final `fp-history`5763、`fp-logs`5755 | `UploadHistorySettingsActivity` / `LogViewerActivity` 已有；选择与真实存储绑定。 | 待验证：当前候选尚无完整逐状态一致证据。<br>已集成；阶段：7/30/90/365选择中90保存与原件保留；两日confirmed/unknown历史过滤与重建；真实SupportEvents all/failed筛选、原始日志不改。；终验待执行 |
| P34 | 诊断与支持 | 数值/事件诊断开关；最多1440；整机电量声明；1/24/168h；日志；导出不含敏感原文/令牌/图片；取消/失败。 | final `fp-diagnostics`5754 | `MainActivity.DIAGNOSTICS` 有既有本地导出；不能后台发反馈。 | 待验证：`b914238f` 恢复5754的开关、1440边界/整机电量与敏感信息说明、日志/当前1h-24h-7d及两导出；技术状态/采样字段在More。时间范围只沿现有SupportEvents，数值导出仍保留全部数值且文案如实说明；`5765dbfd` 修跨语言未保存间隔/checkbox。新原生短验进行中，原safe JSON/失败/取消证据不重称新跑。 |
| P35 | 备份 | 记录/配置tab；Android ZIP只本机记录，不含Central、文件来源原件、草稿/模型；元数据导出；Central导出独立入口。 | final `mtBackup`5668 | `BackupActivity` 已有相应功能；现平铺说明/按钮，需分组。 | 待验证：`414b5cf8` 恢复真实inventory的大数字+条和备份范围说明；只在已知库存时展示实数，不将未知补零。记录/config tab、真实ZIP/恢复/去重规则未变，主批及本次受影响原生画面分别保留；新actual补验进行中。 |
| P36 | ZIP恢复 | 选ZIP→错误Central/非法包→预览条数/当前匹配目标→明确恢复；取消；进行中；部分成功保留已完成，重试不重复；完成只是本机，手动同步。 | final `mtRestore`5670 | `BackupActivity` 已有校验/partial/resume；需展示逐阶段真实结果。 | 待验证：当前候选尚无完整逐状态一致证据。<br>已集成；阶段：真实ZIP选择→预览→取消→导入成功/重复不重建ID；invalid不变；容量故障partial保留完成、同验证文件retry不重复；light/dark。；终验待执行 |
| P37 | 导出/配置导入导出 | 导出中/失败清不完整文件/成功；记录/元数据/配置分开；凭据选项警示；配置import当前新值比较，保留资料/设备/系统权限；取消/错包保留旧配置。 | final mt export/config 5675–5689 | `BackupActivity` 已有；不把导出动作变成云发送。 | 待验证：`414b5cf8` 的本次SAF只读DISPLAY_NAME/SIZE文件卡与记录/metadata/config阶段标题已集成，`acec1bf2` 把URI放入默认折叠技术详情；未知不造路径，同URI重选/取消/晚回执fence保身份。4 JVM与编译已过，Mac独审叶模块无具体阻断；受影响actual2待补，原导出/写入/去重不改。 |
| P38 | 本机位置迁移 | 当前真实路径在详情；内部/外部位置；迁移确认→复制核验；失败保留原位置；存储不可用保留选择并可刷新；处理中不提供伪取消；projection会话可能需重授权。 | final `mtLocation`5679、`mtLocationConfirm`5702 | `StorageActivity` 已有复制核验/回滚；长路径/说明当前常驻，可渐进。 | 待验证：R6主4bdde64c/MainTreeba7/catalog10083真实运行采集中迁移复用当前Projection实例/授权、菜单Pause、停止态迁回仍停止、再次显式开始需要新授权，最后masterStop/drain。原queue全部文件字节/指针/ID与private3/prefs/cal完整恢复；0HTTP，Terra独审。旧StorageActivity取消/复制验证/失败与JVM证据按原pin复用；未做真实可移除介质拔出/掉电全流程。 |
| P39 | Central入口/已有原生消费者 | 来源、飞书、导入、文件、后台工作、插件、模型、用量、存储、诊断等已有页面继续可达；逐一核对返回/错误/权限/草稿，不能删Tab后遗失入口 | S00能力审计、S38“不遗漏”；只保留已有消费者，不推定每个Central能力都有Android原生版 | `CentralContent.kt` 与 `CentralScreens.kt`；沿真实已注册路径核对 | 待验证：31f75ff2移除Agent/Lark根返回自身，明确folder回/context后交原pageHistory；Mac/Terra源码与代表图独审无阻断。R4 FAIL前12实际观察+R5余13/P10成功，25 More+独立Ask路径26，Coding旧上传处理入口保留；真实OAuth/插件业务生命周期未验。 |

## 4. 基线差异与实现分界

本节是 `5846a09b` 的静态核对，不替代各行实际 UI 比对。

| 范围 | 已有实现/明显差异 | 可以独立推进的 UI | 不可通过假显示补齐 |
| --- | --- | --- | --- |
| Android 导航 | `NativeAppShell.kt`/`PrimaryNavigation.kt`仍按四主目的地；新稿为单首页两个动作 | 轻首页、次级菜单、入口与返回、原生组件/文案/间距 | 新主动推送、自动精选、把不存在的资料统计当成果 |
| Mac 落点 | `index.html`/`ui.ts`仍有采集/发送管理块；全工作区存在 | 首页层次、紧凑正常状态、侧栏/完整工作区保留 | 新远控、新Mac来源移除、捏造本机说明已传递 |
| Web 导入 | `Imports.tsx`含服务器目录方式，`feature-guide-catalog.ts`保留其目录项 | 移除服务器目录 UI 与目录入口，保文件/文件夹/ZIP | 擅自扩展或删除后端API/权限/数据行为 |
| Web 发现 | `InsightReport.tsx`显眼「报告/文字」两按钮，默认已为report | 收更多并改为排版结果/标准阅读，详情和依据布局 | 改生成/存储格式、增加摘要生成 |
| Web 设置 | 服务、授权、处理组件存在；默认暴露层级需按最终目标整合 | 入口、配置归位、渐进披露，保实际范围/暂停语义 | 简化为保存Provider即授权、自动恢复或扩大数据范围 |
| Web 会话 | `session.ts`已有session/1d/7d/30d，并受serverExpiresAt约束 | 展示现有选择、退出/重登/错误与返回 | 延长服务端授权、跨来源复用凭据、改变自动恢复策略 |
| 历史 | 普通更新已标stale且保留；删除等分支仍替换回答并清引用 | 已保留历史的轻提示/返回，与真实可读原文区分 | 把后端已抹除内容“显示回来”，或撤掉权限校验；H01 |
| 资料说明 | Web导入/来源、Android文件任务及本机日历已有说明合同；Mac NoteDraft仅text/mood等，SourceOptions无独立说明 | 复用已有字段的入口/作用域提示 | 新字段只留前端却声称会用于解析；H03 |
| 日程 | `managed-calendar.ts`自动路径只选calendar.create；`actions.ts`拒绝其他managed种类且要求变化新确认 | 真实状态、布局/帮助归位；按追加授权H02补齐既有范围的更新/取消/完成 | 只删确认而未实现执行链路却显示生效，或扩大设备/日历范围 |
| Mac恢复 | `main.ts`导入IPC成功返回imported；`ui.ts`主要是统一成功/异常反馈 | 真实取消/成功/错误文案、忙碌状态及回原位置 | 没有回执却显示逐阶段/部分成功数或新增恢复策略；H07 |

## 5. 已授权合同变更与仍需核实的边界

已确认的 UI 原则不重复请求批准。H01–H04/H07/H09/H10/H11 保留原问题 ID 便于追溯，均按各自明确授权实现并集成；分组运行与最终三端验收分开，不能用纯 UI 假显示或局部通过代替真实效果。H06–H09 与 Q01/Q02 中未被授权扩展的边界仍单独核实。实现授权不等于在用户现有部署、服务或设备上执行安装、写日历或调用付费模型；测试仍使用本轮可控资源，不部署/发行。

| ID | 实施前场景／对应现有合同 | 已批准目标或仍未选的边界 | 当前集成、验证与授权边界 |
| --- | --- | --- | --- |
| H01 历史删除边界：已授权、已集成，终验待执行 | 普通修改已保留；明确capture删除、保留到期、source tombstone、Material forget/retirement、撤权仍可能抹除/阻断历史；`evidence-store.ts`删除分支替换answer并清citations/trace | 普通资料修改/删除后保留已提交问答及引用身份；不可用原文诚实提示。隐私擦除、忘记、撤权继续原清除/限制合同 | 普通删除与隐私擦除分流、服务端保留和各端展示已集成，有分组风险合同；真实跨端删除后续问待第9节；已抹除文本无法恢复。此授权不扩大原文访问、模型上下文或到期保留范围；若需要改变这些未选政策另行报告 |
| H02 非create日程：已授权、已集成，终验待执行 | 基线scoped自动执行仅calendar.create；update/cancel/complete现需确认及关联版本/设备回执 | 更新、取消、完成纳入既有授权范围内自动执行；不扩展设备或日历范围 | 已集成同范围管理及目标/证据版本、幂等和条件变化保护，有真实 HTTP/设备 adapter 分组合同；真实 EventKit 无本地来源、未写改取消，最终设备回执待验；保留现有权限和宿主保护；不再逐项确认这些已授权种类，不伪造生效 |
| H03 说明传递：已授权、已集成，终验待执行 | 三端笔记独立description缺失；Mac来源/采集、Android采集缺持久context通路；Android文件及本机日历已有LocalSource context | 补齐独立说明的字段、存储、传输与解析上下文；保持单条/来源作用域，不混正文或本人补充 | 已复用 source context 并补齐当前统一格式的独立字段、存储、传输和消费者，有保存/冲突/隔离分组证据；最终模型上下文待第9节；不新增旧读者/双写/迁移；验证保存、恢复、同步、覆盖/清除及解析可见，历史不自动付费重跑。已有字段只缺控件的路径直接做UI |
| H04 本机识别准备：已授权、已集成，终验待执行 | 已有模型包/处理服务能力，但完整依赖准备/下载/启动/恢复链路尚有缺口 | 本轮完成一键OCR/ASR依赖准备、模型下载、启动及失败恢复；不能只封装当前已有能力后停留于缺依赖 | 完整受管理链路已集成；已有任务专属资源的真实 worker/OCR/ASR 与准备状态分组证据，缓存复用不称本次首次完整下载，最终全链仍待验；分别验证安装、下载、启动、可用、失败和安全重试；不得以文件下载完成代替服务可用。用本轮可控测试资源验证，不操作用户现有部署 |
| Q01 收尾稿能力核实（非批准项） | S38是最后原型，作者仍标候选；目录里有低频既有能力，不代表每端同等原生支持 | 当前任务允许这些既有能力的UI归位；对话更多、手动Memory和维护不应引出新策略 | 逐项映射真实消费者。已有可用功能直接做UI，不再批准整份原型；仅确实新增的持久化/权限/自动化选择单列窄范围缺口 |
| H06 Android数量/接收 | 请求HTTP结果、本机存量/累计量、原件接收/正文可读不同；源明确不凭日志给逐记录ACK | 页面的数字/状态应忠于实际数据；原型12/3等是fixture | UI名称、展示层次可改；新增逐条接收账本或计数政策须单独决定。只在有现存回执时显示已收，不补虚构批次 |
| H07 Mac恢复失败：结果报告已授权、已集成，终验待执行 | 导入实际可能已发生部分工作；旧 IPC 成功仅返回 imported，异常只报通用失败 | 根据真实导入过程报告确定完成的数量下限、总量及当前记录是否仍未确认；恢复页区分校验失败、部分完成、结果待核实 | 本次所有者明确批准补齐真实回执。保留现有写入、去重和重试规则；用户重新选择同一备份时跳过相同记录。没有批准新事务、持久检查点、回滚或自动恢复策略。已重命名但 fsync 未确认的当前记录不能算作确定失败或确定成功 |
| H08 Web恢复/凭据 | 现有会话期限已支持；Provider/source暂停及授权受现有合同约束 | 新稿只允许界面归位，服务变更要重核范围，暂停不能被保存/重授权悄悄解除 | 旧hold的纯UI部分可做；自动恢复/故障切换/凭据重用/后端会话政策不因本轮授权解除 |
| H09 Mac网页权限核验：已授权、已集成，终验待执行 | `setupChromeCapture` 只提供 bridge 准备和扩展目录，bridge ready 不证明每个 origin 已授权 | “重新检查”仅通过现有可信桥接查询保存的精确 HTTP(S) origin，扩展调用 chrome.permissions.contains | 本次所有者明确批准只读查询。不得申请/扩大权限、读取页面或开始采集；未连接、多实例、忙碌、超时、取消、过期及配置变化均保留“待核实”，不能借旧结果宣布新范围已允许 |
| H10 整份资料版本引用：已授权、已集成，终验待执行 | 旧提问只能选择至多 30 个 UUID；长 Material 的全部块不能装入该字段 | 可空单一 `anchorMaterialRef` 指向 `material:mat_…@revision`，与两种 UUID 选取互斥；会话保留引用，续问继承，显式 null 清除 | 只提供已选准确版本的导航起点，不复制全文或展开所有块，不授予新读权限。准入/准备核对原时间和设备范围，模型调用与结果保存重验当前版本/可见性；分页和原始证据仍走现有工具和披露回执。可读部分资料保留真实覆盖缺口，空正文不被误判成无附件。旧版本/已移除不改指新版本。没有新增表、迁移、后台处理或收费策略 |
| H11 用户补缺日程时间：已授权、已集成，终验待执行 | 原提案已保留，但开始/结束/时区有 null；不能把手动确认写入冒充普通信息保存 | Mote → 待办与日程 → 安排详情提供“补充时间 / 保存信息 / 收起”；完整且满足既有条件的日程直接生效；不猜时间、不新授设备/日历/资料范围 | `POST /api/actions/:id/information` 严格只收 `{version,start,end,timeZone}`；仅当前 proposed create/update 且原时间字段有 null、未处置/未派发时可补。已有非 null 时间逐字节不变，沿用全天/时区校验；标题、地点、描述、原文及关联/目标/不确定性保留。保存只推进信息版本，不即时写日历；后续仅既有唯一有效 grant 可自动重评，重叠、撤权、过期或语义不确定仍待处理。版本/原文/关联变化拒绝；结果未知锁定原 version/body 重试，409 后读取精确当前对象核验，不静默换 payload、重写新版本或伪称已写入。实现/合同见 [actions.ts](../../apps/server/src/actions.ts)、[actions-information.test.ts](../../apps/server/test/actions-information.test.ts) 与 [ActionTimeInformation.tsx](../../apps/web/src/ActionTimeInformation.tsx)；分组证据见第 6 节，最终三端未验收 |
| H12 时间回看只读分组：已授权、投影已集成，消费者与终验待完成 | 逐条 CapturePreview 及仅截图会话接口不能提供完整混合时间分组与真实组内数量 | 截图复用现有采集会话；其他按设备、日期和已记录来源类型归组；未关联记录不声称同一文档；展开确切原件 | 所有者明确批准新增只读接口与该分组规则。保留全部现有筛选和分页、原件身份与权限；数量从完整查询得到，不能把当前已加载页当总量。只改读取投影，不改采集、保存/删除/保留、来源授权、已有会话切分或模型调用；投影已集成为 `c8981f3a`＋`ff1ab543`，8 项真实 SQLite/HTTP focused 通过，Android 独立只读核查闭合跨午夜问题；消费者仍由 L1 实施。新增 `/api/capture-browser/timeline` 与 `/timeline/members`，绑定 owner/范围/完整 revision/组，变更时失效而不换原件；顶层日期展示行 ID 不代替 nested `record.id`。 |
| Q02 Mac内容搜索/筛选核实（非批准项） | 既有列表分页与本机保留、Central事实不等于源演示“本机待发送”；未核实全量搜索合同 | 源要求内容搜索与范围按钮，但累计演示不得删掉现有回执筛选/分页/详情 | 先映射真实查询与状态；只搜索已加载子集必须诚实命名。只有确需新增全量检索或统计语义时提窄范围功能选择；原有能力入口保留 |

## 6. 验收矩阵及证据边界

本节保留 2026-10-29 06:11 UTC 的上轮独立审查快照，作为恢复起点。实施证据记录在相关 PR 与本轮工具结果中；本次整合后的真实链路集中回归见第 9 节，不能把局部验证折算为最终旅程通过。W/M/P 是旅程组，组内包含页面、入口及多个状态，不能称为128个页面。第4、7节的基线“未测”不是持续执行状态。

上轮于06:11:02 UTC按用户要求停止；以下表格是当时归档，**不是当前禁止继续工作的指令**。本次用户已明确恢复实现、严格验收与 PR 合入。停止时Web八类型固定提交的新图、AI接入新模块、Mac Chrome模块、Android新设置/维护模块均未完成独立审查，不纳入以下计数。上轮开发对话的实际model、reasoning effort、service tier没有从运行元数据核实，仍记unknown。

每个 W/M/P 行的完成证据至少包括：实现 revision、真实运行的端与入口、屏幕或视口/DPR/主题/语言、源原型文件与状态、产品截图、逐项差异、通过/失败/未测/Hold、测试资源与清理结果。页面的空、加载、错误、权限拒绝、取消、返回和重复操作按该行源状态逐项记录。表里未列的状态若源代码/画面确有，补充到相应行后再验收，不能由实现者单方面删掉。

| 验收层 | 要证明什么 | 当前证据/状态 |
| --- | --- | --- |
| 源完整性 | 40个turn、39轮用户发言、被替代候选、独立原型、收尾及网站发布没有漏 | 本次已完整重读；首次使用、连续性、恢复独立稿必须保留；更早分享仅作次级依据 |
| 功能不丢 | 第7节77项Central目录与33项历史原生能力在各端最终入口得到正确承接 | 静态目录已核；所有产品路径未逐项实测，不据ID数量宣称无遗漏 |
| 视觉 | 真实产品逐屏对照相同源状态，含布局/文字/控件/导航/窄屏/深色 | 上轮历史快照46组有部分真实产品画面经独立查看；其中只有标明已见源状态的部分具备源对照，不能宣称整组/全端一比一。旧访问限制记录仅作历史追溯，现按原对话与允许文件对照 |
| 交互 | 草稿、返回、重复请求、取消/失败/权限状态使用真实产品入口 | 已有隔离真实UI fixture及原生仪器状态证据；最终集中回归已开始，逐组剩项见第3、9节 |
| 边界 | 已批准追加合同实现有界变更；现有权限、回执与未授权政策不被扩展 | H01–H04/H07/H09/H10/H11 已集成，有分组合同/运行证据；完整128组仍待最终集中回归。H06/H08及其他未选政策继续保留边界 |
| 独立审查 | 审查者按源清单检验实现，而非按代码反推清单 | 来源、代码、运行图分别审查；发现的问题由实施者修复后复核，剩余项明确列出 |
| 发布 | Draft PR→独立审查→最终head相关检查→合main→核远端commit | 本文不构成PR或合并完成证明；不部署/发版 |

2026-10-30 的阶段集成点 `5765dbfd`：50/39/39 组源要求、当前入口与77/33能力已集中复扫。Mac39独立复核确认的八类呈现差异已返修并由其他代理按原稿、精确提交及关键实际图收口；最新Mac源码已冻结。Android39独立复扫确认的8组/7类呈现差异已按互斥文件整批汇入，交叉复核发现的日程owner隔离、JPEG控件及语言草稿也已窄修；10068主/测试APK打包与6项Projection JVM通过，正在唯一AVD做受影响短补验。源码冻结不等于原生画面或全状态终验通过。复用 [Web W01–W50 摘要](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/web-w01-w50-acceptance-summary.json)、[Mac M01–M39 摘要](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/mac-m01-m39-acceptance-summary.json)、[Android P01–P39 摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json)中的原日志、PNG、revision、dirty/APK 信息。完整扫过、代码存在及局部实测均不等于整组通过；ignored分组证据不复制成平行台账。

新增分组证据按实际边界记录：运行记录 clean `2611268c` 的 18 状态由 Web 独审关闭七处源层级差异；导入创建 clean `4362f18a` 的 9 状态使用实际 Chromium 文件/目录输入、归档字节与 hash、独立说明，任务真实状态为 `queued`，fixture 没有后台 worker，不宣称完成解析；clean `43655a6e` 的 7 个受影响呈现状态替代其旧工具栏/文件卡片图，原件校验不重称新跑。Mac clean `ef09f7d1` 的 7 状态、`cd6abc2e` 的 13 个连接子状态、`78060acd` 的 21 个 Ask 状态及最后 `e6299678` 的 9 个存储/主题子状态各保留原版本，不相加为独立旅程数。P04/P26 的 3 个新 native 方法及 2 个受影响旧方法通过，10 张有效图分别绑定原 APK；最后的动态 TINT 图替代旧浅色填充，未更新 APK 的后续翻译不冒称已进旧二进制。

来源 W22/W23 的 clean `1297f89d` 主批 10 状态、`19196aba` 录音样式 2 状态、`f4edc182` 读取失败及 `d1ddd9de` 最终提供方 2 状态分别记录，Android 只读复核无具体阻断。Google/Gmail 配置明确是账号级范围；没有来源身份映射时保持待核实，不猜私有 hash。`16fae181` 修复保存 Google 日历选择隐式解除暂停：8 项真实 SQLite/受控 HTTP 检查验证新来源正常启用、原来源继续暂停、原件及独立说明保留、重授权也不恢复，显式恢复仍有效；Mac 独审无具体阻断。以上均不是真实外部账号授权或最终 Terra 证据。

首页/搜索/补充问题主批的 clean `698f8c20` 共 33 状态只按其原范围复用；搜索的 18 个受影响状态由 clean `9184e11b` 替代，typed-note 首页/列表正文与准确来源跳转另有 3 图，交接的 3 图绑定 clean `d1d9aa39`，0 model、清理完成。先前一次交接 runner 的 proxy 等待失败保留失败报告，不能计入通过。集成分支 `634ab1f4` 的 Web 广测 759 项中 9 失败如实保留：6 项旧 Memory 选择合同、1 项旧笔记 DTO fixture，以及暴露真实发现取消入口回归的 2 项；对应作者已修复产品与 fixture，focused 验证保留撤权、opaque pin、迟到回执与无额外 POST，集成广测须在新批次完成。W04 笔记 Material 默认正文原先露出 canonical metadata JSON，`dfb9cb96` 仅对 owner 的 `mote.note/schema2` fallback 按真实 pinned `/read` 的 plain spans 呈现原文，保留用户写成 JSON 的正文、引用与补充分离、独立说明、附件及真实 continuation；7 项真实 SQLite/HTTP 与原 Material 合同已过，不提前算实际画面或全组通过。

后续关闭了上述局部缺口：Note clean `de59b958` 的 14 个实际状态、0 model、清理三项 true，Web 独审代码及五张关键图；W17 同 clean 的 5 个英文定点状态、0 POST，不重复旧中文批。W42 的 clean `0d8175a5` 实际 HTTP 14 状态与 `f1490a45` 的 7 个受影响页脚/错误/窄屏/英文状态分别保留，原33 focused与最终增量风险不重复累计。Mac 的 `9c193591`/`7f33d2aa` 使用真实生成数据修导出失败、终态、最早日期与无正文活动；M17 的 clean `3a13dae8` 6图和 `d74b38c4` 单英文图按最终三默认项加通知更多呈现，先前四默认项的图不再作为布局一致证据，仅复用未失效生命周期断言。

Draft [PR #332](https://github.com/utopiafar/mote/pull/332) 已建立，未合并。初始 head `3aa865b9` 的 CI 除 server-4 外均通过，包括 Web/Android/Desktop；server-4 的既有大上下文用例在30秒内未完成，该文件本次未改。单文件保持原数据量/断言/超时约9秒通过；`476e88df` 只将每个 server 测试命令的同时文件数从4降至2，不移除用例、改变规模或放宽原超时，24项调度/覆盖检查及本地 server-4 的582项全部通过。其余 CI 证据不冒充新head已验，最终需统一推送后检查。`47132018` 的完整 build/全工作区 typecheck通过，后续变更另验；翻译当前10068项。仅用于环境准备的隔离 Central 已启动/种入实际原件后关闭，0次推理，不计入第9节最终回归。

Mac末批实际20态中原回执首读失败的伪零旧图作废，其余19态保留；clean ace04的1图替代。英文3态中旧calendar占位图由clean9f的1图替代，另有确认前取消1态及clean f003真实partialfile/显式去重重试2态，不相加成旅程组数。Web独立只读复核源、精确diff与关键图未发现新增阻断。集成 `e7d08462` 的完整Desktop阶段705/705通过，覆盖93测试文件；新scope guard另有3 focused，未将旧阶段称为最终候选重跑。PR的97c2641c CI中4个server分组、Web、Android、shared、i18n、architecture和tooling通过，Desktop因4个新fixture首行静态约束失败；`cfc39eb9` 只修入口行格式，保留guard及较新诊断ACK模式，本地完整Desktop阶段随后通过。新head尚未推送完成CI，不能称最终CI通过。

Web 的 Memory 管理有 22 图分组证据；插件有 28 图及准备文案 5 图；Actions/Todos/H11 有 `5c38bd28` 的真实隔离 Central/构建后 Web 45 图，后续错误→返回的小修仅以 `45d4fd0d` 的相关 5 图重测，不将旧 45 图重新称为新 head 通过。H11 后端见已整合的 `56d9a17c`，Web 见 `4ea00dc9` 与错误修复 `dd302658`；报告中的独立工作树 SHA 保留原值，不冒充 `398b1b1b` 重跑。受控 Agent、release/worker、HTTP 设备回执与原生仪器证据各按实际边界记录，没有代替最终 Terra、真实供应商或物理日历写入。

Mac 最新真实 EventKit helper 的权限为 `granted`，但 `localSourceCount=0`。按所有者本轮范围停止该外部写入子步骤；没有真实 create/write、update、cancel 或相应设备回执通过证据。旧 generated helper/日历 adapter 的成功合同不能覆盖这一限制。发现报告的安全自然高度与只读来源桥接已集成；受控真实 Central/Chromium 的 7 个宿主状态与 8 个来源徽标场景已有分组证据，维持确切 reader/原路返回、frame/token/owner 守卫及禁止模型脚本。coarse 的尺寸计算证据不冒充非零实际几何，最终真实模型宿主结果仍由统一回归记录。

Q1 最终源层级 `11c13faf` 的 clean 实际构建记录 17 图、22 次受控 Agent、0 live；`ddbc0416` 仅问答引用前缀模板，另有单条 focused，不把旧图称作该 delta 重跑。Android 已独立只读复核 owned/adopted 请求恢复、同步终态守卫、独立保存/说明及原件身份，无具体阻断。Memory `5d5a37ad` 的产品差异由 Mac 只读复核；clean `90859943` 的 17 状态只覆盖既有 proposed 筛选与处理选项层级、真实取消与失败保留，不证明成功模型整理。P23 的实际 Provider 四操作、空态/503/原件修改待核实及 3 JVM 检查由 Mac 独立复核。所有证据保留各自提交和范围。

### 阶段覆盖：已有证据与剩余状态

以下计数固定保留为上轮 06:11 UTC 的历史快照，**不是当前覆盖统计**；含义是“已有实现，并有独立查看的实际产品局部证据”，不是整组完成数：**Web 11/50、Mac 15/39、Android 20/39，共46/128组已有部分证据**。其余82组在该历史时间点未纳入固定版本的独立产品状态审查；后续实现与分组证据按本节当前快照和§3更新，不继续沿用旧计数推断当前进度。所有128组的最终集中回归仍待执行；不得把本表的部分证据写成整组通过，也不得继续把实际已验状态写成全部未测。

产品图根目录均是本轮独立工作区的 ignored `.mote` 证据，下面以工作区名标识；不能当作源原型图。源侧引用[来源证据工作表](../validation/ui-final-source-export-gaps-2026-10-29.md)中的 ID。

| 组 | 已实现且独立已看/核的局部 | 实现与真实运行证据 | 仍未通过/未测的范围 |
| --- | --- | --- | --- |
| W01 | 首件回执保留精确原件身份；正常ready折叠、错误/未验证主区；重验证时保持原文返回焦点 | `mote-web` `271b91f0`；`.mote/web-home-ui/result.json`及`home-wide-receipt.png`；官方first-data回归 | 全部首次使用场景、Mac/Android联合接收链及最终集成重跑 |
| W02 | 1440/390首页、真实列表/空及接口能力gate；无横向溢出 | 同上12图；最终head clean、生成数据、真实HTTP、无模型调用 | 390导航与源存在差异；完整异常/深色/全入口及最终模型关联 |
| W04 | 全局随手记默认/展开、说明分离、窄屏边界；草稿/离线队列/迟到ACK事件 | 同上；WEB-S04/S05 源已见 | 附件“更多”/本机回执为保留能力差异；完整附件/权限/失败重试及跨端真实说明链 |
| W05 | 资料列表、真实来源/旧kind筛选、chips、分页返回、日期空态、HTTP503与重试；宽窄图 | `97237322`；`mote-web/.mote/web-library-ui`11图，clean head、05:50:49–52 UTC、1440×1000/390×844、真实Central HTTP、0模型、三项清理true | 待验证：`b0f228be` 统一混合行；互审指出的窄屏有效 CSS 与图标对齐由 `37c516d0` 修正。独立分支 clean `e51eb312` 的 3 个相关尺寸/主题状态有实图与 CSS hash；其余筛选、分页、原文返回保留原 7 状态阶段证据，尚非全部最终状态一致。 |
| W07 | reader替换列表；返回保持原分页/筛选/滚动/焦点；实际retire后原行消失时返回列表heading；旧node/revision图片立即撤下 | 同上；两项独审P1已修复，保留固定head实际图与真实retire回归 | 仅阅读切换壳，不是正文、来源折叠、原图/OCR、不可用及全入口的一比一；不外推W06时间回看或W09问答 |
| W19 | 导入列表、既有job可读；移除服务器目录新建入口 | `607c84d5`；`mote-web/.mote/web-narrow-ui`13图 | 已确认不一致：需要处理筛选漏 unsupported；非空导入行缺原稿 icon/元信息/状态/chevron 与行式间距。I1 补现有状态及呈现，按真实 unsupported/completed/pending 任务验证，不以空态旧图代替。 |
| W20 | 文件/文件夹/ZIP入口保留，无服务器目录表单 | 同上 | 各picker取消、限制、说明、图片方案的完整状态 |
| W21 | 原队列/API/历史记录保留，旧job继续读取 | 同上 | 已确认不一致：修改说明后的本地草稿未通知父确认区，未重预览仍可确认旧说明；源明确 dirty 时禁确认。I1 补前端守卫/同任务重预览，并恢复原件/理解/保存三列、独立 Memory 状态与平面成果列表；不改后端处理或授权。 |
| W32 | 默认排版，“更多”内切换，宽窄菜单、键盘/关闭局部 | 同上；旧接受More图局部对照 | 整页仍有卡片双列/常驻依据及默认iframe深色差异；原文/追问返回等 |
| W45 | 固定官方依赖/模型准备；明确Python路径CLI与Central复用同环境；图片OCR、合成语音ASR及单说话人处理实际HTTP200；可使用/检查状态、初装主按钮及中心本机处理标题已按源修复 | `ca19854d`真实CLI与05:33:06处理；后续`b842db2d`仅夹具格式及已审main合入；`mote-media/.mote/media-preparation-ui/result.json`10图clean head/05:27:23、1440×1000与390×844/DPR2；MEDIA-S01–06；[媒体证据](../validation/ui-final-media-2026-10-29/README.md) | 失败取消画面中的受控状态不充当全部真实故障；ASR将Mote识成mode的误差保留；多说话人/真人质量及四平台矩阵未验。整体ModelSettings布局仍未完成 |
| W50 | 16分组/77直达项、默认/展开/搜索/无结果、390返回保搜索；真实Coding接收→目录→原文，capability guard与完整既有入口保留 | `542a7d06`；`mote-web/.mote/feature-guide`9图、clean head、05:20:26–29 UTC、1440×1000/390×844、0模型；37 focused及真实浏览器fixture | 版本/未知/不一致与反馈外链子页未验；本批不等于W50整组通过 |
| M01 | Mac侧栏/顶栏与独立工作台结构，窄窗布局 | `c719938d`；`mote-desktop/.mote/final-ui-product/workbench` | 所有二级页/权限/深色/菜单栏状态 |
| M02 | 工作台最近内容/对话；远端503、本机读取失败保留已知同范围记录，重试恢复 | 同上5图及真实Electron fixture | 首次流程、全部真实来源状态与最终集成 |
| M05 | 随手记默认/说明展开、原生窗口不溢出、持久草稿及准备后重试不丢说明 | `68504aae`；`.mote/final-ui-product/note`3图；MAC-S03 | 全附件/权限/录音/分享冲突；保留附件More为差异 |
| M06 | 内容列表、三范围、真实搜索/无匹配、中央拒绝和读取错误、窄窗 | `79209c27`；`.mote/final-ui-product/library`8图 | 日期/记忆等原能力承接的全入口、全状态及深色 |
| M07 | 本机/中央inline阅读、返回保搜索/筛选/滚动、拒绝清远端；标题下真实本机待传/中央已收到及实际bytes已补，设备/完整时间保留折叠 | `79209c27`及`2487fe9a`；library与sources实际图；MAC-S04 | 全类型原件/来源详情异常、跨端返回及最终集成 |
| M08 | 独立历史landing、轮数/时间/新建、异常与窄窗实际图 | `50185ebf`；`.mote/final-ui-product/ask`11图；MAC-S05 | 错误态刷新需实际点击恢复；空/分页/离线/未连接全分支 |
| M09 | 单列会话、继续草稿、scope、历史返回；运行时禁止新会话 | 同上；MAC-S05 | scope说明应位于chips下独立一行；更多/图片/跨端对话及全部草稿冲突 |
| M10 | 普通删除保留问答、更新轻提示、privacy清除；引用availability false不打开原文，返回保草稿 | 同上；MAC-S01/02 | 保存回答、真实外部浏览器精确往返；当前fixture仅捕获handoff IPC，不是实际浏览器回跳 |
| M11 | 正在读取/停止/已停止和新会话确认的实际画面 | 同上 | 结果不明/检查/同ID重试/停止待确认/无依据澄清最终真实模型链 |
| M12 | 单层来源行、添加入口、屏幕与应用及云端入口，实际暂停/异常可见 | `2487fe9a`；`mote-desktop/.mote/final-ui-product/sources`18图，clean head、05:46:28–30 UTC、1440×936/DPR2，compact820×620；真实renderer/preload IPC、私有fixture、0模型 | 全部来源kind/首次清点、在线Central完整链与深色未验 |
| M13 | 添加弹窗五入口，取消后保留当前来源页面 | 同上 | 各入口到真实平台授权/长期处理的完整后续未验 |
| M14 | 单文件/文件夹空与选中、编辑默认、说明与高级参数、真实提交后第三行出现；迟到GET/保存结果不回填关闭或新节点表单 | 同上；5项实际组件回归先红后绿；B01前合法源仅既有来源编辑默认 | picker系统画面、所有格式/权限错误、源未见新增空态不能判视觉一致 |
| M15 | 选择回调后保草稿、同来源去重和取消回调语义保留 | 同上生成选择回调fixture | 没有实际macOS picker窗口证据，不计系统picker视觉/真实文件系统授权通过 |
| M16 | 详情、真实暂停label、来源计数/待传与中央归档阅读；context冲突/403与归档拒绝保持可见 | 同上；来源页源图及合法HTTPS默认/详情局部 | 全部清点/跳过/断网/读失败分支、长期同步及跨端真实回执未验 |
| M17 | 说明默认/冲突/拒绝；private outbox按节点绑定、register→说明ACK→内容顺序；ID/epoch/scope三重fence | 同上及3项真实SourceStore/routes→manager HTTP合同 | 四采集通道的最终全部入口、真实Central+模型说明链及所有源视觉状态未验 |
| P01 | 轻首页、真实最近对话、HTTP503及malformed200不假空、权限中断提示 | `bb7fe6b0`；`mote-android/.mote/ui-final-runtime/palette-integrated/ui-final-home`及前批仪器图 | 完整来源/网络/深色组合及最终集成 |
| P02 | 我的Mote菜单、二级入口、返回保草稿 | 同上 | 所有次级入口真实端到端；次级新模块另审 |
| P03 | 首次使用草稿分支保留，非首次不重复承接 | 前批`home-first-use-draft.png`及native记录 | 连接/首件接收六场景与跨端真实原文读取 |
| P06 | 记录页说明独立、分享图片草稿与保存入口；保留既有草稿/附件 | `b43c4df0`及主题合入；`ui-v1-evidence/editor-shared-image.png` | 全picker/录音/权限拒绝/离线403及说明后端全链 |
| P07 | 文件表单中英文、说明/范围/策略/高级项分层，系统picker取消与重建保草稿 | `d2896865`；`mote-android-secondary/docs/validation/android-secondary-ui-2026-10-29/`28图；manifest绑APK与代码；1080×2424/420dpi/fontScale1/浅色；r3日志52.846秒、22 native通过 | 已连接Central真实上传、权限失效及不支持文件全组合未验 |
| P08 | 文件夹已选与预设，表单重建，来源元数据/接收状态不被旧编辑覆盖，中英文实际图 | 同上；SourcesEntry使用实际系统picker，截图不含系统弹窗 | 长期扫描、授权丢失、连接变更和真实上传未验 |
| P09 | 空来源、添加/文件/文件夹入口及采集/同步次级导航 | 同上 | 通知与设备信息接线由主导航后续模块负责，Central在线回程/系统日历授权未验 |
| P10 | 暂停按所见显式目标值更新，删除后不复活；权限/中央暂停/provider/说明冲突在折叠外显示 | 同上；独审P1已闭合 | Central在线详情/分页、全故障分支及完整源视觉未验 |
| P13 | 四字段采集来源说明本地保存/冲突版本合同，换节点时旧编辑器不能写入或回填 | `637a48cf`；两项真实native说明测试；`context-ask-native-r1/ui-final-context/capture-context-local.png`；合法源四字段图已核 | 最终入口/字段名/间距及整个采集规则、预览、权限/开始链仍待本端后续模块 |
| P15 | 发送暂停独立、未连接禁立即发送、历史tab重建、陈旧恢复不反向暂停，当前/历史分层 | `d2896865`同批28图及22 native | 真实发送/ACK丢失/网络恢复/历史全部筛选未验，不能把请求日志当原件接收 |
| P16 | 真实本机保留/待发数量及既有恢复入口默认图 | 同上 | 在线检查、重放、取消/停止、完成状态未验 |
| P17 | Ask顶栏/底部输入、历史切换草稿、scope；本轮详情实际三行对齐，未知费用诚实显示；引用gate与返回草稿合同 | `bb7fe6b0`、`bcc3b94c`；`ask-firstuse-connection-r2/ui-final-home/ask-turn-details.png`及native回归 | 待验证：`944d5e7a` 将底部动作恢复至 42dp，保留现有 composer/history/More/scope 与草稿守卫；有对应 Development APK 的实际触控、主题重放和返回证据。尚未在统一最终构建完成整组比较。 |
| P18 | 精确conversation摘要进入、陈旧目标重验；HTTP503/畸形200不假空；已连接无历史空态 | 同上及native记录、`home-connected-empty.png` | 待验证：42dp 修正已集成；保留 29 轮实际分页、旧问答/notice 重建、普通删除留存及显式隐私擦除的既有阶段证据。最终同一 Central 跨端继续与全部历史状态待验证。 |
| P31 | 已有真实本地日历来源的说明取消/保存，暂停/移除确认取消 | `d2896865`同批图与native；没有改变系统权限 | 系统读权限、真实日历列表和范围扫描未验；本批不含日历执行证明 |
| P32 | 本机真实数量/磁盘统计；未单独统计的隐私拦截不补造数值 | 同上 | 大量数据、刷新失败、累计计数全部边界未验 |
| P33 | 上传历史时长草稿重建/保存、生成配置验证后还原 | 同上 | 日志列表/过滤/详情属于后续模块未验 |
| P35 | 记录/配置tab、真实数量、凭据选择重建；忙碌/重复回调防护 | 同上；独审备份P1已闭合 | 全凭据组合、Central在线导出未验 |
| P36 | 实际ZIP校验/非法包/预览取消/完成；8MiB配额下真实部分恢复，释放本例占位后同文件重试不重复 | 同上；BackupJourney 5项包含在22项内，保留先前失败及修复记录 | Backup选择器由ActivityMonitor注入URI/取消，不是实际系统picker验收；系统杀进程/撤权等组合未验 |
| P37 | 实际ZIP导出成功/目标写入失败重试；配置预览取消/确认、设备身份保留、提交前比较当前配置 | 同上 | Central授权/会话变化、全部元数据与令牌组合未验 |
| P38 | 真实当前位置、可用/不可选位置默认图及既有迁移JVM合同 | 同上 | 实体可移除介质、复制中断、核验失败/回滚原生全旅程未验 |

主题 PR #320 的局部独审已收尾：light tokens与源保持指定关系，D34对比度例外有记录，dark未改，三端实际图已查看；合并提交由协调者核验为 `c5fed1457a995f9d318188d2d93fa523612ce05d`。这仅证明配色模块，并不清除上表的页面差异。Web窄改#319、Mac首个shell#321的局部证据保留在表中；具体远端PR/head/CI仍以发布记录为准。

原工具引用中共有156个去重图像路径，2026-10-29读取时104个存在、52个不存在。S38的 `/tmp/mote-final-phone.png`、`mote-final-mac.png`、`mote-final-central.png`、`mote-final-phone-320-dark.png`、`mote-final-memory.png` 均缺失；前代PNG存在不等于最后原型所有状态已看图。

本轮通过受支持CUA隐藏浏览器打开最终 `file://` URL 被明确拒绝，未重试。用户随后主动提供的 HTTPS 网站曾通过受支持浏览器合法访问，取消原首批7图人工请求；之后又出现Mac来源表单样式读取、Android通知截图及Mac新标签同origin访问的明确拒绝。最后一项将同origin新访问判定为绕过，所有代理已停止整个设计站点的浏览器动作。用户已经授权，不把工具拒绝改写为用户没有同意。准确动作、地址、原始理由、UTC未知及未执行状态见[来源证据工作表](../validation/ui-final-source-export-gaps-2026-10-29.md)。原有合法图仍可用，余下源画面未验/被阻断，不靠静态描述宣称一致。

在拒绝通知前，实施者已生成、独立审查者随后用 `view_image` 看过10个**源原型默认状态**：Web首页/全部功能（1440×1000，fullPage）与需要你补充列表（1440×1064 PNG）；Android首页（390×844）；Mac首页/内容/来源/对话历史/同步/设置（1440×1000视口，`#mac-app`元素高度可变）。均浅色、DPR1、源hash为上表最终HTML。它们不是产品运行截图，不覆盖空/加载/错误/深色/权限等分支，Mac设置截图中的评审控制条不计产品UI。这些既有截图不构成后续动态渲染的许可。

既有源图已归档至 [来源截图目录](../validation/ui-final-source-2026-10-29/README.md)，[manifest](../validation/ui-final-source-2026-10-29/manifest.json) 保留精确 hash、视口/图片尺寸、UTC、生成者、独立审查者和拒绝原文；只复制原有图像字节，未再次渲染。38个直接引用HTML均可只读访问，其hash及引用轮次也在manifest中，原始私人对话全文未加入仓库。

当前补验集成到 `449c03cd`；共享服务及Web资产实际载入clean `3c6dee31`/catalog10083，26个已记录真实Agent调用不等于26个旅程通过。该head15项CI全通过；更晚Android测试夹具叶不由旧CI代证。W41–44的[15个指定状态](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/web-model-processing-gaps-final/report.json)与[三张控件替代及一张重复图](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/web-model-processing-gaps-controls-final/report.json)保留受控生成数据、0model/0probe和旧owner边界；[W48单张503替代图](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/web-w48-import503-visible-final/report.json)不增加状态数。导入文案53334317只翻译公开结构可证的host gate：模型低置信/歧义reason与九条固定句逐字碰撞仍原样，manual和混合warnings无来源证明则保原文；九种unit碰撞与两种真实隔离HTTP碰撞分开记，后者parser受控且0model。旧manual/warnings中文图失效，不拿来证明新来源判断。

H04的[集成阅读八图](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/h04-reader-final-integrated-r3/report.json)在同一持久Terra回答上验证三处准确pin、中文CJK加粗、默认正文/说话人、More内完整canonical可读且整窗不横溢、通用“返回”与同一未发草稿，0query/0save；正常独立登录logout200后原session读取401，窗口/profile清理确认。前两次夹具分别在退出请求超时、关闭最后隐藏窗导致异步清理报告未写完处失败，原图/失败均保留，不计完整通过；第三次修正夹具生命周期后才收口。[真实文件预览与手动整理五图](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/file-preview-memory-integration/result.json)显示同一图片/录音版本在首页和资料库的OCR/ASR摘要，未用元数据JSON作正文；唯一手动整理294b98c9使用真实9f48d2a7@version2和默认recipe2，call26原生模型回执为gpt-6.1-terra，实际零新增Memory，原自动设置不变，未触发或伪造ownerQuestion。Root已查看代表图；仍按组内剩余状态验收，不上调为128组通过。

## 7. 保留能力的逐项对账

下面复用源 `finCatalog` 的77个ID，唯一从78项源审计中移除的是 **Central A01：服务器目录导入**（D10）。Central的A编号与Android历史能力A编号是两套命名，不能混用。目录只是防漏项对账，行数不代表页面数，也不代表功能已实测；末列“入口已集成”仅记录现有入口归位，实际已操作/未覆盖状态以第3节和已存在的三端摘要为准，全部最终验收仍待第9节。最终跳转以 `finOpenEntry`/`fin.entryAliases` 为准，旧 `page` 字段只作定位线索。

| Central ID | 源能力 | 最终源定位（不是最终跳转合同） | 基线实际目标 | 验收组 |
| --- | --- | --- | --- | --- |
| C12 | 随手记下文字 | `notes` | `#/library/notes` | W04；入口已集成，阶段证据见第3节；终验待执行 |
| C13 | 上传已有图片或音频附件 | `notes` | `#/library/notes` | W04；入口已集成，阶段证据见第3节；终验待执行 |
| C09 | 导入已有文档、文件夹和媒体 | `imports` | `#/library/import` | W19–21；入口已集成，阶段证据见第3节；终验待执行 |
| C10 | 查看并处理导入进度 | `imports` | `#/library/import` | W19/W21；入口已集成，阶段证据见第3节；终验待执行 |
| C11 | 删除整次导入 | `imports` | `#/library/import` | W21；入口已集成，阶段证据见第3节；终验待执行 |
| A02 | 选择导入解析器和图片处理方案 | `imports` | `#/library/import` | W20–21；入口已集成，阶段证据见第3节；终验待执行 |
| A03 | 恢复被中断的本地上传 | `imports` | `#/library/import` | W21；入口已集成，阶段证据见第3节；终验待执行 |
| C07 | 选择要加入的来源 | `sourceCatalog` | `#/connections/add` | W22；入口已集成，阶段证据见第3节；终验待执行 |
| C08 | 管理来源接收与内容关系 | `sources` | `#/connections` | W23；入口已集成，阶段证据见第3节；终验待执行 |
| A04 | 保存外部或 NAS 引用 | `sources` | `#/connections?setup=reference` | W27；入口已集成，阶段证据见第3节；终验待执行 |
| A05 | 只读归档 Google 日历 | `sources` | `#/connections?setup=google` | W25；入口已集成，阶段证据见第3节；终验待执行 |
| A06 | 只读归档 Gmail 邮件 | `sources` | `#/connections?setup=gmail` | W25；入口已集成，阶段证据见第3节；终验待执行 |
| A07 | 从远程 MCP 选择资源导入 | `sources` | `#/connections?setup=mcp` | W27；入口已集成，阶段证据见第3节；终验待执行 |
| A09 | 连接飞书文档和日历 | `lark` | `#/connections/lark` | W24；入口已集成，阶段证据见第3节；终验待执行 |
| A10 | 归档厂商录音和转写 | `recordings` | `#/connections/recordings` | W26/W37–38；入口已集成，阶段证据见第3节；终验待执行 |
| A11 | 查看来源版本和原位置 | `archive/sources` | `#/library?view=sources` | W23/W07；入口已集成，阶段证据见第3节；终验待执行 |
| C03 | 从今天开始整理资料 | `overview` | `#/today` | W01–02；入口已集成，阶段证据见第3节；终验待执行 |
| C04 | 查看设备上报的采集与同步状态 | `devices` | `#/connections/devices` | W28；入口已集成，阶段证据见第3节；终验待执行 |
| C05 | 连接或重新授权设备 | `deviceConnections` | `#/connections/pair` | W29；入口已集成，阶段证据见第3节；终验待执行 |
| C06 | 检查和撤销已发出的连接权限 | `deviceConnections` | `#/connections/pair` | W29；入口已集成，阶段证据见第3节；终验待执行 |
| A08 | 让其他 Chatbot 使用 Mote MCP | `connections` | `#/connections/access` | W30–31；入口已集成，阶段证据见第3节；终验待执行 |
| C14 | 浏览已经发布的资料正文 | `archive/materials` | `#/library?view=materials` | W05；入口已集成，阶段证据见第3节；终验待执行 |
| C15 | 核对资料正文、来源与处理状态 | `archive/materials` | `#/library?view=materials` | W07；入口已集成，阶段证据见第3节；终验待执行 |
| C16 | 说明单份资料关系并提取记忆 | `archive/materials` | `#/library?view=materials` | W08/W17；入口已集成，阶段证据见第3节；终验待执行 |
| C17 | 查看原始采集证据 | `archive/records` | `#/library?view=records` | W06–08；入口已集成，阶段证据见第3节；终验待执行 |
| C18 | 删除一条原始记录 | `archive/records` | `#/library?view=records` | W08；入口已集成，阶段证据见第3节；终验待执行 |
| C20 | 围绕归档资料提问 | `ask` | `#/ask` | W09；入口已集成，阶段证据见第3节；终验待执行 |
| C21 | 回看和管理对话历史 | `ask` | `#/ask` | W11–13；入口已集成，阶段证据见第3节；终验待执行 |
| C22 | 随问题提交图片 | `ask` | `#/ask` | W10；入口已集成，阶段证据见第3节；终验待执行 |
| C23 | 浏览有证据的记忆 | `archive/memories` | `#/library?view=memories` | W14–15；入口已集成，阶段证据见第3节；终验待执行 |
| C24 | 纠正、删除或导出一条记忆 | `archive/memories` | `#/library?view=memories` | W16；入口已集成，阶段证据见第3节；终验待执行 |
| C25 | 手动提取记忆 | `archive/memories` | `#/library?view=memories` | W17；入口已集成，阶段证据见第3节；终验待执行 |
| C26 | 回答需要你澄清的问题 | `ask` | `#/ask` | W18；入口已集成，阶段证据见第3节；终验待执行 |
| A16 | 核对记忆的历史和有效时间 | `archive/memories` | `#/library?view=memories` | W16；入口已集成，阶段证据见第3节；终验待执行 |
| A17 | 从一条当前记忆继续整理 | `archive/memories` | `#/library?view=memories` | W17；入口已集成，阶段证据见第3节；终验待执行 |
| A18 | 调整记忆策略和回顾节奏 | `settings/model` | `#/system/models?category=model` | W46；入口已集成，阶段证据见第3节；终验待执行 |
| C27 | 生成并回看有证据的洞察 | `insights` | `#/library/insights` | W32–33；入口已集成，阶段证据见第3节；终验待执行 |
| C28 | 查看正在做的工作和结果 | `activity` | `#/activity` | W34；入口已集成，阶段证据见第3节；终验待执行 |
| A25 | 检查技术步骤并恢复可重试工作 | `processing` | `#/system/processing` | W34/W48；入口已集成，阶段证据见第3节；终验待执行 |
| C29 | 记录和完成普通待办 | `actions` | `#/actions` | W35；入口已集成，阶段证据见第3节；终验待执行 |
| C30 | 查看已生效日程和设备写入状态 | `actions` | `#/actions` | W36；入口已集成，阶段证据见第3节；终验待执行 |
| C19 | 按内容类型查看资料库 | `archive/materials` | `#/library?view=materials` | W05；入口已集成，阶段证据见第3节；终验待执行 |
| A12 | 按截图片段或应用相册回看 | `archive/segments` | `#/library?view=segments` | W39；入口已集成，阶段证据见第3节；终验待执行 |
| A13 | 查看测得的应用活动时间 | `archive/activity` | `#/library?view=activity` | W39；入口已集成，阶段证据见第3节；终验待执行 |
| A14 | 查看媒体播放观测 | `archive/media` | `#/library?view=media` | W39；入口已集成，阶段证据见第3节；终验待执行 |
| A15 | 查看 Coding 会话接收与同步状态 | `archive/coding-status` | `#/library?view=coding-status` | W39；入口已集成，阶段证据见第3节；终验待执行 |
| C39 | 导入导出归档并找到完整备份 | `vault` | `#/system/storage` | W48；入口已集成，阶段证据见第3节；终验待执行 |
| C40 | 查看保留、容量和内容存储政策 | `vault` | `#/system/storage` | W48；入口已集成，阶段证据见第3节；终验待执行 |
| C41 | 核对模型用量和估算费用 | `usage` | `#/system/usage` | W48；入口已集成，阶段证据见第3节；终验待执行 |
| A31 | 把已有加密文件转为明文 | `vault` | `#/system/storage` | W48；入口已集成，阶段证据见第3节；终验待执行 |
| A32 | 查看运行状态与空间 | `statistics` | `#/system` | W48；入口已集成，阶段证据见第3节；终验待执行 |
| A33 | 维护估价并追查用量明细 | `usage` | `#/system/usage` | W48；入口已集成，阶段证据见第3节；终验待执行 |
| C31 | 配置或检查模型连接（Provider） | `settings/providers` | `#/system/models?category=providers` | W41；入口已集成，阶段证据见第3节；终验待执行 |
| C32 | 检查或分配功能使用的模型 | `settings/model` | `#/system/models?category=model` | W42；入口已集成，阶段证据见第3节；终验待执行 |
| C36 | 控制新图片识别与原图授权 | `settings/images` | `#/system/models?category=images` | W43–44；入口已集成，阶段证据见第3节；终验待执行 |
| C37 | 查看文件或录音的内容提取和恢复 | `archive/files` | `#/library?view=files` | W37–38；入口已集成，阶段证据见第3节；终验待执行 |
| C38 | 配置文件与语音处理 | `settings/file-processing` | `#/system/models?category=file-processing` | W43；入口已集成，阶段证据见第3节；终验待执行 |
| A19 | 调整模型性能和协议细节 | `settings/providers` | `#/system/models?category=providers` | W41；入口已集成，阶段证据见第3节；终验待执行 |
| A20 | 复制或删除模型预设 | `settings/providers` | `#/system/models?category=providers` | W41；入口已集成，阶段证据见第3节；终验待执行 |
| A21 | 补处理或重算历史图片 | `settings/images` | `#/system/models?category=images` | W43；入口已集成，阶段证据见第3节；终验待执行 |
| A22 | 配置文件规则、方案和处理服务 | `settings/file-processing` | `#/system/models?category=file-processing` | W43；入口已集成，阶段证据见第3节；终验待执行 |
| A23 | 预览文件规则并重新处理已有原件 | `settings/file-processing` | `#/system/models?category=file-processing` | W43；入口已集成，阶段证据见第3节；终验待执行 |
| A24 | 纠正转写并确认说话人 | `archive/files` | `#/library?view=files` | W37；入口已集成，阶段证据见第3节；终验待执行 |
| A29 | 设置执行并发和查看等待名额 | `settings/model` | `#/system/models?category=model` | W42/W48；入口已集成，阶段证据见第3节；终验待执行 |
| A30 | 配置检索和外部连接的部署草稿 | `settings/embedding` | `#/system/models?category=embedding` | W48；入口已集成，阶段证据见第3节；终验待执行 |
| C33 | 暂停或立即停止自动记忆 | `extensions` | `#/system/plugins?tab=memory` | W46；入口已集成，阶段证据见第3节；终验待执行 |
| C34 | 核对和替换整套记忆方案 | `extensions` | `#/system/plugins?tab=memory` | W46；入口已集成，阶段证据见第3节；终验待执行 |
| C35 | 管理可信记忆插件 | `extensions` | `#/system/plugins` | W46；入口已集成，阶段证据见第3节；终验待执行 |
| C01 | 登录并管理当前会话 | `about` | `#/preferences` | W49；入口已集成，阶段证据见第3节；终验待执行 |
| C02 | 找到常用页面和所属工具 | `overview` | `#/today` | W02/W50；入口已集成，阶段证据见第3节；终验待执行 |
| C42 | 找到帮助、版本和维护方式 | `help` | `#/help` | W50；入口已集成，阶段证据见第3节；终验待执行 |
| A26 | 查看 Agent 当前能读取的上下文 | `agentView` | `#/agent` | W47；入口已集成，阶段证据见第3节；终验待执行 |
| A27 | 查看已记录的实际模型输入和工具读取 | `agentView` | `#/agent` | W47；入口已集成，阶段证据见第3节；终验待执行 |
| A28 | 核对实际注册的插件能力 | `extensions` | `#/system/plugins` | W47；入口已集成，阶段证据见第3节；终验待执行 |
| A34 | 查阅运行日志并导出支持包 | `developer` | `#/system/diagnostics` | W48；入口已集成，阶段证据见第3节；终验待执行 |
| A35 | 设置诊断记录并查看部署生效值 | `developer` | `#/system/diagnostics` | W48；入口已集成，阶段证据见第3节；终验待执行 |
| A36 | 切换界面语言 | `about` | `#/preferences` | W49；入口已集成，阶段证据见第3节；终验待执行 |

历史原生 33 项是保留能力对账，旧首页位置不继续约束新导航；同一能力可由多个验收组共同承接。

| 历史平台/ID | 已有能力 | 本轮验收组 |
| --- | --- | --- |
| Mac M01 | 菜单栏：打开/记录/Central/设置/采集开停/立即发送/退出 | M04；入口已集成，阶段证据见第3节；终验待执行 |
| Mac M02 | 随手记与已有图片/语音附件、草稿 | M05；入口已集成，阶段证据见第3节；终验待执行 |
| Mac M03 | 本机+中央内容、原文/原件与处理阶段 | M06–07；入口已集成，阶段证据见第3节；终验待执行 |
| Mac M04 | 按日期/Session/应用浏览截图/页面内容 | M06–07/M39；入口已集成，阶段证据见第3节；终验待执行 |
| Mac M05 | 文件/目录一次导入或持续同步 | M14–15；入口已集成，阶段证据见第3节；终验待执行 |
| Mac M06 | Claude Code/Codex/Kimi本机对话与项目 | M18；入口已集成，阶段证据见第3节；终验待执行 |
| Mac M07 | 系统日历只读来源、写入能力声明 | M19；入口已集成，阶段证据见第3节；终验待执行 |
| Mac M08 | 来源保存模式、首次范围、过滤、metadata、开停/同步 | M14–17；入口已集成，阶段证据见第3节；终验待执行 |
| Mac M09 | 屏幕记录/按应用通道/遮挡/文字审查/页面规则 | M20–22；入口已集成，阶段证据见第3节；终验待执行 |
| Mac M10 | Chrome扩展与本机桥接、站点授权 | M36；入口已集成，阶段证据见第3节；终验待执行 |
| Mac M11 | 应用测得时间、中央后台工作 | M23/M39；入口已集成，阶段证据见第3节；终验待执行 |
| Mac M12 | 发送策略、暂停/恢复、当前任务、历史/回执 | M23–25；入口已集成，阶段证据见第3节；终验待执行 |
| Mac M13 | 统一问答、历史分页、scope与引用 | M08–11；入口已集成，阶段证据见第3节；终验待执行 |
| Mac M14 | 记忆主题与原文依据 | M06/M39；入口已集成，阶段证据见第3节；终验待执行 |
| Mac M15 | 配对/归属/登录与Central窗口 | M03/M27；入口已集成，阶段证据见第3节；终验待执行 |
| Mac M16 | 存储位置/保留/压缩预览/图像去重/支持包/日志/更新/语言外观/profile | M28–38；入口已集成，阶段证据见第3节；终验待执行 |
| Mac M17 | 关闭窗口后台采集、退出停止 | M04；入口已集成，阶段证据见第3节；终验待执行 |
| Android A01 | 统一文字/拍照/图库/录音/文件草稿、系统分享 | P06；入口已集成，阶段证据见第3节；终验待执行 |
| Android A02 | 本机与Central稳定身份资料阅读、类型/位置/日期筛选 | P11–12；入口已集成，阶段证据见第3节；终验待执行 |
| Android A03 | 文件/来源版本/整理资料读取与原件 | P10–12；入口已集成，阶段证据见第3节；终验待执行 |
| Android A04 | 屏幕/页面/通知/应用活动/媒体/设备事件的按通道采集 | P13；入口已集成，阶段证据见第3节；终验待执行 |
| Android A05 | 应用继承/覆盖、字段规则/预览、遮挡、确定性文字隐私 | P13–14；入口已集成，阶段证据见第3节；终验待执行 |
| Android A06 | 文件/SAF目录/系统日历、范围与保存模式、来源metadata | P07–10/P31；入口已集成，阶段证据见第3节；终验待执行 |
| Android A07 | 设备邀请/扫码/导入、节点目标绑定、上传网络与条件 | P04/P15；入口已集成，阶段证据见第3节；终验待执行 |
| Android A08 | 采集与同步两行状态、等待/暂停/重试、当前任务 | P02/P15；入口已集成，阶段证据见第3节；终验待执行 |
| Android A09 | 上传日期/批次/单条原件/接收回执、历史保留设置 | P15–16/P33；入口已集成，阶段证据见第3节；终验待执行 |
| Android A10 | Central原生问答/共享历史/引用/澄清、设备草稿 | P17–21/P39；入口已集成，阶段证据见第3节；终验待执行 |
| Android A11 | 记忆主题与原文、发现精选与历史/详情 | P11/P22；入口已集成，阶段证据见第3节；终验待执行 |
| Android A12 | 日程建议、授权设备写入与结果核实 | P23；入口已集成，阶段证据见第3节；终验待执行 |
| Android A13 | 系统权限、电池优化、自启动与后台运行 | P27；入口已集成，阶段证据见第3节；终验待执行 |
| Android A14 | 本机存储、备份恢复/配置迁移、空间/采集统计、压缩与去重 | P28–32/P35–38；入口已集成，阶段证据见第3节；终验待执行 |
| Android A15 | 诊断/日志/脱敏支持包、更新、语言/外观、profile | P24–26/P33–34；入口已集成，阶段证据见第3节；终验待执行 |
| Android A16 | Central管理原生消费者：来源/飞书/导入/文件/后台工作/插件/模型/用量/存储/诊断等 | P39；入口已集成，阶段证据见第3节；终验待执行 |

## 8. 原讨论逐轮索引

以下条目全部来自指定主对话。每轮用户消息决定其**上一轮**原型是否被认可，不能把当轮新生成的建议立即当作获确认。S27的停下随后由S28继续，不能解释为取消当前实施任务。源对话的“HTML-only”边界是当时设计阶段的执行范围，当前用户已明确另行授权产品UI实现和PR合入。

| 序号 | Turn ID / 用户 message ID | 本轮用户取舍（摘要） | 本轮文本提及的原型 |
| --- | --- | --- | --- |
| S00 | `01a17d84-96f6-7570-a2a5-66c2513e84db`<br>`01a17d84-a175-7593-84b5-0a46e3261efa` | 完整功能/用户旅程审计，设计阶段只通过HTML交互 | `mote-ui-review.html` |
| S01 | `01a17d98-df92-74a0-995f-e95ea9a2dd17`<br>`01a17d98-dfa6-72e3-a539-f0b593dc8231` | 逐旅程评审；减少无谓文字；产物可独立使用 | `mote-material-ask.html` |
| S02 | `01a17e18-eb22-77c2-a0fb-a04f39b07d4e`<br>`01a17e18-eb36-7bd1-8e44-f4aa231af77b` | 只用已有正文/缩略图，不为UI引入摘要架构 | `mote-material-ask.html`、`mote-library-content.html` |
| S03 | `01a17e26-7341-7540-9a0d-3903ccc4d6b5`<br>`01a17e26-7351-79a0-96f0-4e6cb059bd15` | 质疑记录与采集的硬分；先审计数据含义 | `mote-library-content.html`、`mote-library-data-audit.html` |
| S04 | `01a17e34-2d22-74f0-9f94-235ca1852ba9`<br>`01a17e34-2d33-7ee0-b176-ed113156b1da` | 要求从用户旅程完善资料页 | `mote-library-data-audit.html`、`mote-library.html` |
| S05 | `01a17e42-3fb6-7532-89e1-30edf64de23f`<br>`01a17e42-3fd4-71c2-82d0-6c8d90a35052` | 否决未经讨论整体重做、侧栏消失 | `mote-library.html`、`mote-library-restored.html` |
| S06 | `01a17e4a-ccb9-74c3-ab1b-7ea7dce4c611`<br>`01a17e4a-ccc9-7690-ab41-e4c9d869e49e` | 认可恢复框架，继续列表内容 | `mote-library-restored.html`、`mote-library-list.html` |
| S07 | `01a17e55-28c9-7b82-9b78-0dcefa1d2085`<br>`01a17e55-28db-7332-bcff-52aff105fe4c` | 认可预览方向；原文预览为默认 | `mote-library-list.html`、`mote-library-complete.html` |
| S08 | `01a17e68-57a3-7572-b75a-b03c107c5e7b`<br>`01a17e68-57b5-7320-8f94-5904dcf8b498` | 要求全局随手记而非资料页专属 | `mote-library-complete.html`、`mote-note-global.html` |
| S09 | `01a17e91-9449-73b3-a1ad-5c8ebc553954`<br>`01a17e91-9476-7032-bdcd-3f68cdee551f` | 认可记笔记方向；参考早期原则，下一旅程 | `mote-note-global.html`、`mote-workspace-next.html` |
| S10 | `01a17eac-71c7-7852-8b2e-4d51e611e363`<br>`01a17eac-71d9-7cf1-95c2-ce78f5311099` | 资料库与来源进入同一详情，继续细化 | `mote-workspace-next.html`、`mote-detail-library.html`、`mote-detail-source.html` |
| S11 | `01a1804d-54a4-7363-8f99-95fe2df7df91`<br>`01a1804d-54cd-7ad1-a804-2c7536fb0b51` | 实体详情是建议；当前稿大体可，审查交互/ADR | `mote-memory-workspace.html` |
| S12 | `01a1805b-8851-7583-be19-3b682fb7f159`<br>`01a1805b-8860-7ec1-8c55-98f4af57a8fc` | 否决新增独立视图；尊重既有功能与实体 | `mote-memory-workspace.html`、`mote-memory-current.html` |
| S13 | `01a1806a-c977-7cd2-90bf-66babf18bfcc`<br>`01a1806a-c98f-71a3-802a-b724092b2844` | 继续收敛记忆页，不新增能力 | `mote-memory-current.html`、`mote-memory-polished.html` |
| S14 | `01a18075-840e-7960-9085-ab8abec67030`<br>`01a18075-841f-7371-8e34-bf3abd967324` | 接受记忆精修；先核实导入现状 | `mote-memory-polished.html`、`mote-import-workspace.html` |
| S15 | `01a1809e-290e-7213-9ecb-0bd938dc8e01`<br>`01a1809e-2924-7881-9a29-6deba309cd15` | 删除服务器目录导入，其余继续来源 | `mote-import-workspace.html`、`mote-source-workspace.html` |
| S16 | `01a180b2-b4f8-70b1-b121-91839c9b2c97`<br>`01a180b2-b9f8-7443-b09f-adb6905af23a` | 接受来源方向；再评AI接入 | `mote-source-workspace.html`、`mote-ai-access.html` |
| S17 | `01a180c2-751c-74d1-b4d9-a0efde45ca6f`<br>`01a180c2-752e-7d02-af59-620208ab383e` | 接受AI接入；首页与发现 | `mote-ai-access.html`、`mote-home-discoveries.html` |
| S18 | `01a180e2-d6cf-7ef0-a050-26f8cb1c716f`<br>`01a180e2-d6ed-70c2-ae27-6321197373f9` | 发现阅读形式需要收敛 | `mote-home-discoveries.html` |
| S19 | `01a180e5-3590-7921-a2a1-800e5b790198`<br>`01a180e5-35a4-7e22-927a-7c19b183a0b3` | 默认排版结果，切换进更多，不改后端 | `mote-home-discoveries.html`、`mote-discovery-refined.html`、`mote-activity-workspace.html` |
| S20 | `01a18103-f5e3-7893-84b9-e53af9a2cba8`<br>`01a18103-f5f5-7431-b070-570c763fd561` | 接受活动方向；模型设置 | `mote-discovery-refined.html`、`mote-model-settings.html` |
| S21 | `01a1819e-6849-75c0-81f9-b2ed7def8668`<br>`01a1819e-6d39-7470-a9af-49dd3db91df4` | OCR/语音与语言模型统筹服务，先盘现状 | `mote-model-settings.html` |
| S22 | `01a181a8-7fd7-7541-adc1-9ec246ba5e68`<br>`无独立用户消息` | 系统续轮；无独立用户消息，不新增所有者决定 | `mote-settings-services.html` |
| S23 | `01a181b8-bfce-7400-91f2-9c5b5d795bc0`<br>`01a181b8-bfe9-7670-954c-759ddc2d5769` | 要求后台授权合入对应功能而非独立页 | `mote-settings-services.html` |
| S24 | `01a181bb-7d46-7961-a768-bb58ff20a313`<br>`01a181bb-7d57-71d0-a29a-93667c92e8a5` | 移除后台授权单页，资料处理内开关和首次说明 | `mote-settings-services.html`、`mote-settings-automatic.html` |
| S25 | `01a1820c-4ba9-7030-919c-be4f33ef71f1`<br>`01a1820c-4bc2-7431-9fb3-41e8e256948d` | 更完整设置；本机识别一键准备；其他设置不能漏 | `mote-settings-automatic.html`、`mote-settings-complete.html` |
| S26 | `01a18227-ca9e-7091-ba17-7f6a7e6d2c41`<br>`01a18227-caaf-7d50-b08d-87ee723f8fd9` | 接受完整设置，继续待办/日程 | `mote-settings-complete.html`、`mote-actions-workspace.html` |
| S27 | `01a18260-7e10-7eb0-8115-9648f9222e2e`<br>`01a18260-7e20-7bd1-b1e6-be6569224bdc` | 明确日程默认生效不逐项确认；暂停该次执行 | `mote-actions-workspace.html`、`mote-settings-complete.html` |
| S28 | `01a1827e-0ee7-7273-b245-6dad68ff8206`<br>`01a1827e-0efa-7e13-82d4-7ecb9b2451a1` | 继续并纠正改错文件；完整盘点后做设备 | `mote-settings-complete.html`、`mote-device-workspace.html`、`mote-actions-automatic.html` |
| S29 | `01a18288-6ba9-7603-b3e1-0e898f14ead5`<br>`01a18288-6bb9-7880-84e5-82f9eefc8905` | 接受设备；继续录音 | `mote-device-workspace.html`、`mote-recording-workspace.html` |
| S30 | `01a1829b-cf34-7083-8be9-20117ff18759`<br>`01a1829b-cf4b-7db0-8597-670c9daa2ed4` | 接受录音；盘Mac和Android主旅程 | `mote-recording-workspace.html`、`mote-mac-workspace.html` |
| S31 | `01a182cc-ee54-7ad1-b955-92fe25d98e3c`<br>`01a182cc-ee65-71c3-b6ee-2ad246f88798` | 任何同步/保存都可填独立说明，其余Mac通过 | `mote-mac-workspace.html`、`mote-android-workspace.html` |
| S32 | `01a18336-5ac2-7982-a5d4-b202625207f2`<br>`01a18336-5ad3-7a53-a23a-ead1f7c6f319` | 手机记录不应每页重复；提出Tab供探讨 | `mote-android-workspace.html`、`mote-android-navigation.html` |
| S33 | `01a18351-4851-75b0-b4c4-5189f2ff11ae`<br>`01a18351-486a-7c61-9007-74d541a52bfb` | 改为轻输入/输出端；管理次级，日常只记录/提问 | `mote-android-navigation.html`、`mote-android-assistant.html` |
| S34 | `01a18367-9d7e-7881-b5a7-6b8924249ea9`<br>`01a18367-9d8e-7ab2-9a11-7913f5ddc979` | 接受Android轻首页；补首次使用；探讨Mac | `mote-android-assistant.html`、`mote-mac-role-exploration.html` |
| S35 | `01a18379-0906-7d01-a4df-d6c97abdff88`<br>`01a18379-0916-7ed3-9fe6-b9bb0f1e7bcb` | 接受Mac轻落点，保留框架；继续新用户旅程 | `mote-mac-role-exploration.html`、`mote-first-use.html` |
| S36 | `01a1838f-8d0e-7be0-a411-8898a799081c`<br>`01a1838f-8d20-7ac3-a2bd-946f23ad32b5` | 首次使用大体OK；跨端与本机清理/暂停 | `mote-first-use.html`、`mote-continuity-workspace.html` |
| S37 | `01a183b0-234a-73e0-afee-8424cc5b4c22`<br>`01a183b0-2359-7d31-95b9-b0f253900ab4` | 明确修改/删除资料不能隐藏历史问答；继续恢复 | `mote-continuity-workspace.html`、`mote-recovery-workspace.html` |
| S38 | `01a183c8-8cb8-7b51-944c-3a29607e263b`<br>`01a183c8-8cce-7b40-85d3-4a9814098458` | 恢复大体OK；全盘收尾，遗漏入口一并补齐 | `mote-recovery-workspace.html`、`mote-final-workspace.html` |
| S39 | `01a185ae-ecf5-7e73-a7f8-11b76104247c`<br>`01a185ae-f1b2-7083-aafb-654ab133e19c` | 将所有已经定稿的三端样式发布为仅自己可见的网站 | 网站的三端界面、首次使用、对话与资料回看、恢复与继续四组；对应 index/first-use/continuity/recovery.html |

## 9. 全部落地后的真实链路集中回归

2026-10-29 04:28:50 UTC，用户在[执行协调对话](codex://threads/01a1767c-d428-715a-8055-60970a2a00c5)的消息 `Sentinel_3ba253d9663c8191a36319e3b3154fd5` 追加要求：全部做完后，在真实链路中使用真实大模型跑完上面的所有用户旅程；涉及模型时可使用本机 Codex Server 的 GPT 6.1 Terra。本节在已有设计验收文档内维护，不新建平行验收台账。它是最终集中回归的执行清单，不能把此前小 PR 的 fixture、单测、原型演示或已经生成的截图改写成这轮真实模型验收。

本次所有者再次明确顺序与模型：**全部相关 UI 整合后，再把几端串起来做一轮真实回归；模型调用固定使用本机 Codex Server 的 `gpt-6.1-terra`。** 三端使用同一隔离 Central 和生成资料，已提交对话、原文身份与真实回执连续；各端草稿仍留各端。不接受其他模型、假回答或分散后端替代该轮串联。没有新推理的页面可以复用已记录的真实结果，但仍要实际操作该入口。

本节当前同步点为 `7d976fa0`：最终同实例真实批次已开始，第3/6节的旧分组运行不填作本批新执行。**完整逐状态验收组仍为0/128；已有本批真实子状态，按下表实际证据记录，不能再称集中回归尚未开始。** 本批run `f1e0f926-a28c-4b2e-b16e-8a3a4b71db58` 使用同一隔离vault、loopback origin和生成资料，真实模型均由本机Codex App Server的原生选择回执确认gpt-6.1-terra/high；代码、构建、APK与调用各保实际版本。当前 Mac EventKit `granted`/`localSourceCount=0` 只证明已检查权限而无可用本地来源，按所有者范围停止真实写改取消；对应最小子步骤保持未验，其余本轮生成资料链继续。安全自然高度发现 HTML 的集成、只读宿主引用桥接的补齐目标也不能替代最终页面与返回实测。

本批启动源为 `3f79a1a3`，编译后的Web/Desktop和10068 Android以各自hash记录。源 `293d547e` 的同实例重启仅重新载入10069/C30静态资源，原origin、vault、token、会话、note与4条实际结果保留；旧内存trace不会重建，已实读的Web运行记录图及截断限制保留。原临时分发fetch wrapper已还原，5次受控分发命中不称真实GitHub；插件本身走真实resolve/install/digest/check/enable且尚未授执行范围。

首个Web实际调用用时16,283ms，Mac同会话新轮16,124ms；H10长资料15,693ms，三次material_read读取当前31块准确版本。Android首次在另一条全局running存在时把指定会话65b误投到6bb，实际call4虽完成但该旅程失败；`293d547e`→`7d976fa0`修显式/已选目标与owner/ownedbody守卫，3种受控风险经Mac独审。修后实际call5用时19,666ms且正确写入65b第3轮；引用按钮多轮重名的仪器selector修复只复用该turn、不重发模型。发现actualcall6用时34,030ms并归档真实HTML，但实际默认排版固定450内滚动，高度/来源桥接仍在返修，不能计视觉通过。

### 执行批次和证据要求

协调者在三端相关实现集成后固定一个提交与构建批次，使用本轮隔离 Central、专用客户端 profile 和生成资料执行。先跑最短三端共用的真实问答，再扩展剩余旅程；不在每个小 PR 重跑全仓、性能或真实模型。每个旅程保留第 3 节全部页面、弹窗和状态，不得只验正常成功态。第 7 节 77 个 Central ID 和 33 项历史原生能力通过下表关联，均须有至少一个可追溯结果；同一能力映射到多行时，不能用其中一行代替其余不同入口。

真实模型预检：协调者于 **04:32:42 UTC** 通过仓库 `codexModels` → `/opt/homebrew/bin/codex app-server` 的 `initialize`/`model/list` 只读目录确认 8 个模型中包含 `id=gpt-6.1-terra`、显示名 `GPT-6.1 Terra`；reasoning 为 low/medium/high/xhigh/max/ultra，默认 low，目录服务层为 fast。证据为执行工作区忽略目录中的 `.mote/terra-catalog-preflight.json`。本次预检没有创建 thread/turn，没有模型推理，未读出凭据。**目录可用不等于真实调用成功；预检当时没有推理。本批实际调用与逐旅程结果以下表为准。** 不把桌面工具模型名、展示标签或 mock 响应当作实际 provider/model，不静默降级。

后续原生调用预检使用隔离 Central `6d73f3a0`：真实 QueryRun `05029312-cf1c-4b4b-b77a-99d2a15bd1ba` 已完成，原生 `codex.model.selected` 回执确认 `gpt-6.1-terra`、high reasoning，1 次推理、21,709ms，实际工具为 `material_catalog`、`material_read`。生成笔记的地点、验证码与计划时间已核实；引用打开确切正文，pinned Material 的 origin 与原始笔记关联、正文逐字一致。最初将 citation ID 等同 raw note ID 的测试假设失败，已按现有 Material block 身份合同更正验证，并保留失败说明，不计成模型重跑。根 ignored `.mote/terra-native-transport-preflight-6d73f3a0/actual-query-result.json` 和同目录 `report.json` 保留证据，服务已关闭。这是模型/检索预检，**不填下表作最终三端 UI 通过**。该检查又暴露虚拟引用的删除身份、零回执误报和原文读取缺版本问题；均按现有同一原件、确切版本合同修复，未新增整份 Material 删除或保留政策。

每次执行填写唯一 run ID、UTC、最终提交/构建/APK hash、真实入口、生成输入原文或本轮文件及 hash、范围和实体 ID、实际 provider/model ID 与 reasoning。后端记录请求/会话/任务 ID、持久结果及真实回执；前端记录实际用户可见结果、草稿/返回/重复操作；视觉单列原对话中已认可原型/已有允许图片及对应场景、产品截图及视口/DPR/主题/语言/差异；不再打开网站、发布预览或绕过受限访问。模型生成措辞可变化，验收依据是事实、证据身份、动作范围和状态，不要求模型输出逐字等于示例。费用/token 未提供时记未知，不捏造估价。证据不得包含令牌或用户私有资料。

模型需要列中“是”为本旅程有实际新推理；“否（复用）”只复用明确 run ID 的真实结果，交互仍需自己执行；“分支”须在对应子状态标明实际调用是否发生。没有模型的页面也须完成真实客户端→服务端/本机存储的旅程，不能省略。“不适用”只能用于确实无需的维度，不能替代失败或未测。中断、撤权、取消与重启用真实服务状态控制；必要故障注入单独标注，不能声称模型供应商真的故障。重复请求检查服务端身份与实际调用计数，不靠界面禁用推断。

每个失败保留首个失败 run、原因、修复提交与受影响重测 run；不得覆盖旧证据后只写通过。只有该行源涉及的状态、真实结果和视觉都完成，才可写整行通过。局部已验、能力缺失、权限拒绝、待用户决定分别保留。独立审查者按第 3/7/8 节及原对话接受的产物逐项核对；[此前来源证据](../validation/ui-final-source-export-gaps-2026-10-29.md)只作历史追溯，实施者的成功汇总不能替代独立复核。

### 生成输入集（计划，尚非执行证据）

| 输入集 | 最小输入与要保留的差异 |
| --- | --- |
| F00 | 空隔离 profile、生成 owner/设备、未连接/邀请过期/已连接无资料；不以配置已存替代真实接收 |
| F01 | 三端各一条唯一标记的文字、生成图片/音频/文件及独立说明；空、草稿、picker 取消、离线和真实 ACK 分开 |
| F02 | 至少两设备、两来源、跨分页资料；同标题不同 ID、版本更新、普通删除、隐私 forget/撤权，说明与原文分别留存 |
| F03 | 对生成资料提出可核实问题、无依据问题与后续问题；strict/anchor/none 范围、同会话跨端、未提交草稿、普通删除后续问与不可用引用 |
| F04 | 生成含确定文本/图形的图片和问题；上传取消/失败/重试/移除与单次模型选择，模型收到的图片身份可追溯 |
| F05 | 由真实生成资料和模型运行得到的记忆/发现/澄清问题；纠正、历史、稍后/我也不知道、失败与继续整理 |
| F06 | 生成文档/ZIP/录音与专用连接器测试资料；已知转写、说话人、外部引用、分页、授权取消与断开；无专用账号则相应真实接入未测 |
| F07 | 本轮专用客户端的生成采集资料与来源队列；暂停/等待/错目标/重试/原件已释放；实际权限不以截图 fixture 假定 |
| F08 | 生成待办及同一专用目标的 create/update/cancel/complete 提案；不完整/过期/版本变化/撤权/同操作重试；H11 用户补缺时间、既有时间不可改、未知保存结果；不写用户真实日历 |
| F09 | 隔离配置中的真实 Codex Server 模型分配、可销毁本机 OCR/ASR runtime 与模型；依赖/下载/启动/健康/失败/取消/恢复，处理授权另核 |
| F10 | 生成备份/错包/部分结果/诊断/更新元信息与可销毁目录；导出/恢复/迁移/取消/重试后核数据和资源收尾，不安装到用户现有应用 |

本次续作的资料处理分项与默认自动处理入口已补齐到集成候选：图片、录音、文档分别呈现既有策略，高级处理能力保留；确切服务/功能模型可在同一编辑器进入并返回，不丢父草稿和位置。只对同一 Api、相同已知配置基线承接子服务的真实保存回执，外部配置变化仍按既有 CAS 拒绝并保留草稿。空的已保存来源范围不被扩大。受控实际 Web 验收已覆盖 35 个画面状态，另有真实 HTTP/React 风险回归；这不等于 W43–W45 或全 128 组完成最终验收。

OCR/ASR 本次在任务专属的复制缓存上重新启动真实 worker，处理生成的两行图片和约 6.68 秒 Albert 合成语音；OCR 两行匹配，ASR 保留会议时间和蓝色笔记本，但将 Mote 转写为 mode；匿名说话人处理检出 1 位。缓存复用了上轮已核的固定依赖/模型，不称为本次首次完整下载。10 个新设置页准备状态画面包含真实 worker 就绪和明确标注的受控失败/取消，安装没有改变处理授权。均是最终集中 Terra 回归前的分组验证。

### 三端逐旅程执行表

当前快照：PR [#332](https://github.com/utopiafar/mote/pull/332) 仍为 draft，未合 main。Root `f8ad2ccd`，共享服务加载 `3a68db16`，Android实测main tree `315ebca35995a6cff6d227df4167474771f88bb2`、APK SHA `931a2c3b5bb05b08ca11f4f962d799aaff8b046f2176d7a358c6d73909af3e00`（catalog10071；当前Root10074只新增Mac文案，非同一APK）；测试叶 `ea7d91c6` 集成为 `5b1cab05`。`a17b4943` 的 CI server4 发现 Memory 测试未等待后续自动产生任务的终态；`09cf12a5` 仅修测试等待并保原规模/断言，focused及原13项已验（其中误选入原1000输入检查已如实记录），Required CI 对 `4676c890` 已全部通过；之后的 `3a68db16` reader/M04 与 `0b0bc0b2` 附件修复尚无新 head CI。H04 默认正文及M04已修/实际子路径已验；新发现file列表metadata预览、Android最近结果入口、Mac首件ACK层级等仍收口，不能宣称三端完整一致。

以下为 **2026-10-30 最终集中回归的执行中快照**。旅程与源定位、全部子状态以第 3 节同 ID 行及第 8 节 40 个 turn 索引（39 个有用户发言）为准；能力 ID 来自第 7 节，`Mac Mxx`/`Android Axx` 是历史能力 ID，不能与本轮旅程 ID 混用。“§3”表示该旅程本身的源要求，不代表凭空新增能力。每行输入项在执行时补实际 input/run ID，后续填写本表或在该格链接对应 PR/本轮证据，不再创建另一份状态总表。

| 旅程 / 关联保留能力 | 模型需要 | 计划输入 / 实际 run | 实际 provider / model | 前端结果 | 后端结果 | 视觉结果 | 失败 → 修复重测 | 最终状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| W01 / C03 | 否 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W01 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/web-first-use/result.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W02 / C03、C02 | 否；复用 W09/W33 | 本批 f1e0f926-a28c-4b2e-b16e-8a3a4b71db58；启动3f79/恢复293d；Web真实owner登录/home；3a只读真实a812卡→报告→页面History/Home返回 | 否；复用真实结果 | home及真实最近入口；未遍历全部首次/异常 | 同一Central真实读取 | [web-first-r3](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/web-first-r3/result.json) home，深色实际viewport/DPR按report；[真实Home/深色历史/Memory只读](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/readonly-home-history-r3/result.json) | 未将页面入口代替全组状态 | 真实card及页面返回已验；file预览JSON差异返修 |
| W03 / §3 | 否；复用 W09 | 本批 f1e0f926-a28c-4b2e-b16e-8a3a4b71db58；启动3f79/恢复293d；global search → 精确原文 → 原搜索 | 否；未新增推理 | 当前保存资料的typed capture/Material路径和查询返回正确 | 原文身份与query保持；实际GET非fixture | [web-first-r3](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/web-first-r3/result.json) | 原r2模型后的脚本cursor失败另记，不否定已成功搜索子状态 | 局部已验，余状态待验 |
| W04 / C12、C13 | 否 | 本批 f1e0f926-a28c-4b2e-b16e-8a3a4b71db58；启动3f79/恢复293d；Web note ce41bad7-cbd1-48f2-9381-7e6e9e4311fe；d94/f15附件及说明锁定修；真实201/controlled503与held晚回执 | 否；后续call1读取此原文 | 正文与独立description从真实dialog保存 | 真实notes ACK；说明在attributionContext，非正文/metadata | [web-first-r2](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/web-first-r2/result.json)；[附件14图](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/attachments-final-1d5-r2/report.json)；[发送条件6图](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/attachments-final-send-gate-r4/report.json) | 首次CDP前置挂起0model；恢复后确切保存1条 | 附件/保存相关新增子状态已验；OS picker未验 |
| W05 / C14、C19 | 否 | 本批 f1e0f926-a28c-4b2e-b16e-8a3a4b71db58；启动3f79/恢复293d；资料入口与31块reader | 否；复用H10 | 默认入口/所选Material可达；筛选/分页所有状态未全验 | 真实Material/read API | [long-material](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/long-material/result.json)及目录77入口 | 不据入口计功能完整 | 局部已验，余状态待验 |
| W06 / C17 | 否 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W06 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/library-timeline-browser-951/report.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W07 / A11、C15、C17 | 否 | 本批 f1e0f926-a28c-4b2e-b16e-8a3a4b71db58；启动3f79/恢复293d；capture/Material/citation reader；3a exact H04三pin当前body/speaker与More旧canonical；native64bc/2e | 否；复用call1/2/3 | Web typed原文、H10原文、Mac真Webhandoff均精确返回 | 原文字节/引用身份按真实GET核 | [web-first-r3](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/web-first-r3/result.json) / [long-material](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/long-material/result.json) / [mac-live](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/mac-live/result.json)；[Web实际三引用8图](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/h04-reader-final-r2/report.json)；[Android实际三引用9图](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/derived-reader-actual-r3/report.json) | 物理前台浏览器返回未证 | 精确媒体引用子状态已验；WebMore局部横滚/其余reader状态待收口 |
| W08 / C16、C17、C18 | 分支：提取时是；阅读/删除否 | 本批 f1e0f926-a28c-4b2e-b16e-8a3a4b71db58；启动3f79/恢复293d；H10 reader→Ask；删除尚待H01 | 分支未作提取；Ask用真实call3 | 31块资料传准确版本引用，非截成30 UUID | conversation.scope.anchorMaterialRef准确；未出现anchorEvidenceIds | [long-material](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/long-material/result.json) | 本轮完整提取/删除状态待续 | 局部已验，余状态待验 |
| W09 / C20 | 是 | 本批 f1e0f926-a28c-4b2e-b16e-8a3a4b71db58；启动3f79/恢复293d；QueryRun 31c4289c-201d-4c4c-b3a0-3eb5d417e2d5；H10 88e34833-bb9a-451a-9db2-4529d72c3365 | 本机Codex App Server / gpt-6.1-terra / high；原生model与threadModel回执 | 真实提问/持久结果/引用原文往返；宽窄实际图 | call1 c469a7f6-32e6-46c4-9a34-f5bffdc7189c；H10 eaefb7eb-4901-4f98-acbd-6b32a33ffc7c；事实/准确来源核 | [web-first-r3](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/web-first-r3/result.json) / [long-material](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/long-material/result.json) | 运行记录脚本原afterSeq=0错；改沿UI firstSeq-1复用同run，0新call通过 | 局部已验，余状态待验 |
| W10 / C22 | 是 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口；d94/f15；sameApi failed File显式retry/remove；configured adapter仅readiness无query | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W10 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/web-conversation-final-d3ca78fa/report.json)；[附件14图](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/attachments-final-1d5-r2/report.json)；[发送条件6图](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/attachments-final-send-gate-r4/report.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 所列failed/retry/remove/收起与Send gate已验；无OS chooser取消证明 |
| W11 / C21 | 否；复用真实turn91526f1e | 共享65b；保存7fbaa035-a620-45e6-8bd4-0fbe96468dcc；a8→834 | 否；保存与显式同请求重试不推理 | 默认阅读/More/详情、literal问答与本人补充/说明分离；保Ask未发稿 | 受控替换已提交201 ACK；同ID/时间/body显式重试获真实duplicate ACK | [conversation-actions-r2](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/conversation-actions-r2/result.json) | r1回执误关闭→a8精确ID守卫；r2真实11图、Terra独审；整段删除仅确认→取消 | 局部已验，整段删除成功/失败等余状态待验 |
| W12 / C21 | 是 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W12 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/web-query-recovery/report.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W13 / C21 | 是：普通删除后续问 | 65b原3轮保留；run926fc5d4 / turn5d53ac35；834 | 本机Codex App Server / gpt-6.1-terra / native双模型回执 | 旧原文404→定稿不可用dialog→同轮；真正续问明确历史依据不等于重读原文 | 原回答/cite身份保持；call14无伪造引用，citationIds/tools均空 | [h01-continue-r2](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/h01-continue-r2/result.json) | 原runner将raw Markdown比渲染文字、后误找reader alert，保失败不重删；834复用dialog后13图通过，Terra独审 | 普通删除子路径已验；改版/撤权/strict全删等余状态另核 |
| W14 / C23 | 否；复用 W17 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口；3a H01后GET真9f200；真实搜索/详情/返回/清除，0模型 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W14 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/memory-final-browser-final/report.json)；[真实Home/深色历史/Memory只读](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/readonly-home-history-r3/result.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 真实Memory列表子路径已验，其他状态复用原阶段 |
| W15 / C23 | 否；复用 W17 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W15 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/home-search-questions-search-delta/report.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W16 / C24、A16 | 否；复用 W17 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W16 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/web-memory-management/result.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W17 / C16、C25、A17 | 是：真实提取/review及本批整理 | job20ec9ca0/Memory9f48d2a7；整理294b98c9 | 本机Codex App Server / gpt-6.1-terra；新增call26 | 原提取结果及原文返回；本批默认recipe2只整理所选version2并真实completed | 整理新增0条是合法结果；配置不变；ownerQuestion分支另待验 | [提取](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/memory-r2/result.json)；[整理](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/file-preview-memory-integration/result.json) | 原夹具失败保留；不以extraction代consolidation或以正常完成代等待问题 | 真实整理子状态已验；剩项见第3节 |
| W18 / C26 | 分支：回答进入既有整理链路时是 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W18 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/home-search-questions-product/report.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W19 / C09、C10 | 否 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W19 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/web-imports-final/report.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W20 / C09、A02 | 否 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W20 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/import-creation-presentation-final/report.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W21 / C09、C10、C11、A02、A03 | 分支：选用现有 LLM 解析器时是 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W21 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/web-imports-final/report.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W22 / C07 | 否 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W22 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/source-catalog-final-browser-final/report.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W23 / C08、A11 | 否 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W23 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/source-final-scope-browser-159/report.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W24 / A09 | 否 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W24 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/web-source-connectors-final/report.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W25 / A05、A06 | 否 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W25 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/web-source-connectors-final/report.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W26 / A10 | 否 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W26 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/web-source-connectors-final/report.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W27 / A04、A07 | 否 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W27 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/web-source-connectors-mcp-final/report.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W28 / C04 | 否 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W28 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/devices-source-alignment-ada8a31f/result.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W29 / C05、C06 | 否 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W29 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/devices-source-alignment-ada8a31f/result.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W30 / A08 | 否；实际授权管理不调用模型 | 共享vault；唯一MCP1d49e2f9；Root6b功能/9c scoped CSS | 既有 MCP 只读；未接外部AI客户端 | 创建/下载/隐藏准确详情/离开不回显/撤销取消及确认；有效与历史；长名浅深宽窄 | 仅该MCP 1POST/1DELETE；私有下载hash一致；其他inventory不变，独立浏览器登录已精确撤销 | [真实授权18状态](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/final-ai-access-enabled/report.json)；[长名四态](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/access-state-nowrap-bbc387fd-r3/report.json) | hide目标错→6b；长名状态换行→9c；仅重验受影响四态，copy为私有transport | 所列管理子状态已验；expired实际帧/外部客户端未验 |
| W31 / A08 | 否；实际授权管理不调用模型 | 共享vault；唯一MCP1d49e2f9；Root6b功能/9c scoped CSS | 既有 MCP 只读；未接外部AI客户端 | 创建/下载/隐藏准确详情/离开不回显/撤销取消及确认；有效与历史；长名浅深宽窄 | 仅该MCP 1POST/1DELETE；私有下载hash一致；其他inventory不变，独立浏览器登录已精确撤销 | [真实授权18状态](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/final-ai-access-enabled/report.json)；[长名四态](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/access-state-nowrap-bbc387fd-r3/report.json) | hide目标错→6b；长名状态换行→9c；仅重验受影响四态，copy为私有transport | 所列管理子状态已验；expired实际帧/外部客户端未验 |
| W32 / C27 | 是：真实报告；四态复用不再生成 | run08cfc6e6→resulta8120173；共享vault；报告UI834；3a实际dark窄历史补验/量测dark，0新生成 | 本机Codex App Server/gpt-6.1-terra/high；native receipts | 默认排版/More标准阅读/准确引用/未发草稿返回；浅深宽窄报告自然高度、实际pointer均已验 | 真实报告持久化及原artifact；旧712因H01全读范围守卫撤下，不恢复 | [真实报告](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/discovery-final-theme/result.json)；[报告四态](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/discovery-final-theme-four-states/result.json)；[真实Home/深色历史/Memory只读](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/readonly-home-history-r3/result.json) | CSP桥接9373、主题d8修后真新报告；历史末图实际light，不能因文件名dark计通过 | 报告四态及当前dark历史/返回已验；整组独审待收口 |
| W33 / C27 | 是：真实生成；后续受控取消无需新模型 | run08cfc6e6→a8120173；仅一次新回顾 | 本机Codex App Server/gpt-6.1-terra/high | 真生成入档、历史和引用返回；取消/停稳/失败/就近设置另待补 | 准确run/result已完成；无为补画面再生成 | [真实报告](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/discovery-final-theme/result.json)；[报告四态](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/discovery-final-theme-four-states/result.json) | 旧712撤下保持历史事实；不把正常completed当取消/失败通过 | 正常生成子状态已验，余项见第3节 |
| W34 / C28、A25 | 否；复用 W17/W33 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W34 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/web-activity-final-complete/result.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W35 / C29 | 否 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W35 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/web-actions-final/report.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W36 / C30 | 是：真实提案；填时/设备执行自身否 | 同grant473530c8/device9573/LOCAL1；d6a7 create+5cf9 update+fb9f cancel+67ef complete | 本机Codex App Server/gpt-6.1-terra/high；actual producer modelSelection | H11原缺end保存自动等待设备；a17 update7图无假冲突；取消与Mote完成各5图 | 真event6创建/原ID更新/取消后不存在；event7保持完整不变而Mote关联完成；同授权无新confirm | [create](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/android-calendar/create-H11/report.json)；[自然 update](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/android-calendar/update-natural-periodic/report.json)；[cancel / Mote complete](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/android-calendar/cancel-and-complete/report.json)；[补时更新](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/calendar-update-information/result.json) | 077fa等待semantic依赖；a17保存回执/文案修；自然update是存活进程GreedyScheduler，未证明OS死进程唤醒 | 本轮四操作与正负补时路径已验；其余风险按旧专项，Mac EventKit写入未验 |
| W37 / A10、C37、A24 | 否；复用 H04 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W37 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/recording-final-browser-r4/result.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W38 / A10、C37 | 分支：选用 LLM 重处理时是 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W38 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/recording-final-browser-r4/result.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W39 / A12、A13、A14、A15 | 否 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W39 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/special-materials-browser-final/report.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W40 / §3 | 否 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W40 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/web-settings-final/result.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W41 / C31、A19、A20 | 本批0model/0probe；真实模型正常路径按既有批次复用 | fec770d3/e86bc3dd→43ae2d2a/c2babd63；catalog10083 | 真实生成Central/SQLite/HTTP及受控外部元数据；非外部供应商验证 | fec770d3的15个指定状态中已实际验生成假key改URL、明确保留/清空及取消离开保稿；e86bc3dd三张控件图替代原裁切图，第四张为重复警告，不增加独立状态。0model/0probe，Terra独审。 | 15个指定状态合计；三图替代+一重复不加计 | [指定分支](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/web-model-processing-gaps-final/report.json)；[替代图](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/web-model-processing-gaps-controls-final/report.json) | 原失败和裁切范围保留；独立Terra只读复核无新阻断 | 指定缺口已补验；组内原阶段仍保适用范围 |
| W42 / C32、A29 | 本批0model/0probe；真实模型正常路径按既有批次复用 | fec770d3/e86bc3dd→43ae2d2a/c2babd63；catalog10083 | 真实生成Central/SQLite/HTTP及受控外部元数据；非外部供应商验证 | fec770d3实际补验可用列表撤下已存连接、pending保存403撤表及正常退出/登录后旧ACK隔离；缺连接是受控投影，生产删除仍拒绝移除被分配连接。30项相关focused及Terra独审；0model/0probe。 | 15个指定状态合计；三图替代+一重复不加计 | [指定分支](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/web-model-processing-gaps-final/report.json)；[替代图](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/web-model-processing-gaps-controls-final/report.json) | 原失败和裁切范围保留；独立Terra只读复核无新阻断 | 指定缺口已补验；组内原阶段仍保适用范围 |
| W43 / C36、C38、A21、A22、A23 | 本批0model/0probe；真实模型正常路径按既有批次复用 | fec770d3/e86bc3dd→43ae2d2a/c2babd63；catalog10083 | 真实生成Central/SQLite/HTTP及受控外部元数据；非外部供应商验证 | fec770d3实际补验原图授权拒绝保稿与服务端false、真实生成图片历史预览/取消；e86bc3dd替代两个裁切控件图，0历史process/0backfill；旧Api迟到预览已隔离，30相关focused和Terra独审。H04真链另列。 | 15个指定状态合计；三图替代+一重复不加计 | [指定分支](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/web-model-processing-gaps-final/report.json)；[替代图](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/web-model-processing-gaps-controls-final/report.json) | 原失败和裁切范围保留；独立Terra只读复核无新阻断 | 指定缺口已补验；组内原阶段仍保适用范围 |
| W44 / C36 | 本批0model/0probe；真实模型正常路径按既有批次复用 | fec770d3/e86bc3dd→43ae2d2a/c2babd63；catalog10083 | 真实生成Central/SQLite/HTTP及受控外部元数据；非外部供应商验证 | fec770d3实际补验服务fingerprint变化后取消0grant、命令实际提交后丢ACK再明确重试：encoded revision/grant与operationId冻结，revision只推进一次；未知时不能发新授权，关闭后保恢复入口。30相关focused及Terra独审，0model/0probe。 | 15个指定状态合计；三图替代+一重复不加计 | [指定分支](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/web-model-processing-gaps-final/report.json)；[替代图](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/web-model-processing-gaps-controls-final/report.json) | 原失败和裁切范围保留；独立Terra只读复核无新阻断 | 指定缺口已补验；组内原阶段仍保适用范围 |
| W45 / §3 | 否 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W45 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/media-final/ui/result.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W46 / A18、C33、C34、C35 | 分支：实际记忆工作是；安装否 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W46 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/web-plugin-final/report.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W47 / A26、A27、A28 | 否；复用 W09/W17 | 本批 f1e0f926-a28c-4b2e-b16e-8a3a4b71db58；启动3f79/恢复293d；实际agentRun c469a7f6-32e6-46c4-9a34-f5bffdc7189c | 本机Codex App Server / gpt-6.1-terra / high；原生model与threadModel回执；页面复用0新call | 显式读取后实际输入/工具/输出/原文返回 | 实读5页含run.completed；真实truncated已提示，未重构 | [web-first-r3](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/web-first-r3/result.json) | 错误测试cursor0改为产品firstSeq-1；未改后端过滤/保留 | 局部已验，余状态待验 |
| W48 / A25、C39、C40、C41、A31、A32、A33、A29、A30、A34、A35 | 否 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W48 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/web-maintenance-final/result.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W49 / C01、A36 | 否 | 复用第3/6节原阶段；版本/dirty边界按原report；本批未重跑本入口 | 原阶段0 live；受控依赖不称真实外部账号/模型 | 已操作子状态及具体剩项见第3节 W49 | 只复用原阶段实际存储/HTTP结果，不作新通过计数 | [原阶段证据（复用）](/Users/utopiafar/.codex/worktrees/ui-final-web-complete/mote/.mote/web-settings-final/result.json) | 原失败保留；受影响修后证据及剩项按第3/6节 | 阶段局部已验；余子状态待验 |
| W50 / C02、C42 | 否 | 本批 f1e0f926-a28c-4b2e-b16e-8a3a4b71db58；启动3f79/恢复293d；目录77项+补C20/C30 | 否；0新模型 | 77实际入口进入/返回；C30最终稿文案闭合 | 实际GET，非effect；飞书自动check POST被只读阻断不算正常授权页 | [目录主批](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/readonly-directory/result.json)、[C20](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/readonly-directory-c20/result.json)、[C30](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/readonly-directory-c30-r2/result.json) | C20最初runner严格hash误判；C30初次旧静态404后同vault恢复，仅该条重验 | 局部已验，余状态待验 |
| M01 / §3 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M01 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M02 / §3 | 否；复用 M09 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M02 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M03 / Mac M15 | 否 | 82f/43f/890；首件同session6有效+连接2替代+首次正文503新1；真队列/SyncHistory ACK，不凭body成功确认 | 真实生成本机/loopback；0model/Root访问 | 实际具体子状态及限制见第3节 M03 | 原既有producer/guard；未改迁移/安装/接收策略 | [首件原批](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/mac-first-session-final/result.json)；[连接两态](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/mac-first-session-connection-final/result.json)；[首次body失败](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/mac-first-body-read-failure-final/result.json) | 修前及首修挂载/未展开disclosure失败保留；只重验失效态 | 相关实际子状态已验；其余源/OS边界见第3节 |
| M04 / Mac M01、Mac M17 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口；760380a7；clean1533 actual aggregate空/仅source/仅capture/暂停/上传/503 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M04 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[capture实际菜单](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/mac-tray-final-capture/result.json)；[source实际菜单](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/mac-tray-final-source/result.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 菜单对象/回调与错误披露已验；非OS菜单像素 |
| M05 / Mac M02 | 否 | 本批 f1e0f926-a28c-4b2e-b16e-8a3a4b71db58；启动3f79/恢复293d；Mac note 937a00d5-9332-45c2-8ca4-c57b76474aad | 否；独立真实notes传输 | 原生note本机保存、独立说明→发送→Central确切回执原文 | 真实note UUID/received回执run a95d1917-2c10-44fe-b8cc-95a7726404ca | [mac-live](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/mac-live/result.json) | 其余录音/附件/失败原生状态未由该笔证明 | 局部已验，余状态待验 |
| M06 / Mac M03、Mac M04、Mac M14 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M06 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M07 / Mac M03、Mac M04 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M07 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M08 / Mac M13 | 否；复用 M09 | 本批 f1e0f926-a28c-4b2e-b16e-8a3a4b71db58；启动3f79/恢复293d；同conversation 65b2b0f6-232e-4e3d-b5cb-1ec3b9d83988 | 本机Codex App Server / gpt-6.1-terra / high；原生model与threadModel回执；history复用 | 从实际history选中Web既有会话，新轮保留原turn | prior 91526f1e-e28c-4846-9226-07221085c9fe → 新 99bc27d7-ac1a-439e-8b6b-b760840b4383 | [mac-live](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/mac-live/result.json) | 分页/全部异常仍待本批 | 局部已验，余状态待验 |
| M09 / Mac M13 | 是 | 本批 f1e0f926-a28c-4b2e-b16e-8a3a4b71db58；启动3f79/恢复293d；正确Mac continuation 99bc27d7-ac1a-439e-8b6b-b760840b4383 | 本机Codex App Server / gpt-6.1-terra / high；原生model与threadModel回执 | 准确新轮而非旧同问回答；原对话保留 | 原生call2 c1d89ca9-9db5-47bc-bbc0-486a715368cc；正确同conversation | [mac-live](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/mac-live/result.json) | 新轮ID排除prior；历史同citation按新轮index定位 | 局部已验，余状态待验 |
| M10 / Mac M13 | 否；复用真实Mac第5轮cffceee8 | Root6b源/正常新device-session；同65b五轮；0新query/save | 既有Terra call20；本次只读 | native精确轮→真实Web ticket exchange→exact引用1500正文→同会话；全state/title/draft/scroll250不变 | 原文103 UTF16/231 UTF8、pin/libraryVersion一致；本次0新模型/保存；自己的4个会话逐一撤销 | [正常设备会话 r4](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/mac-continuity-device-session-r4/result.json) | 旧raw-owner升级会话会合法清Ask，旧图不算native连续性；r2静态404与r3未ready选择失败保留；r4只读通过 | 正常设备会话引用往返已验；视口250显示较旧轮，OS前台切换未验 |
| M11 / Mac M13 | 是 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M11 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M12 / §3 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M12 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M13 / §3 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M13 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M14 / Mac M05、Mac M08 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M14 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M15 / Mac M05、Mac M08 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M15 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M16 / Mac M08 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M16 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M17 / Mac M08 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M17 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M18 / Mac M06 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M18 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M19 / Mac M07 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M19 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M20 / Mac M09 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M20 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M21 / Mac M09 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M21 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M22 / Mac M09 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M22 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M23 / Mac M11、Mac M12 | 否 | 本批 f1e0f926-a28c-4b2e-b16e-8a3a4b71db58；启动3f79/恢复293d；Mac note同步/待发→history | 否 | 已存本机队列→立即发送→真实received历史 | 真实receipt/run/note identity | [mac-live](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/mac-live/result.json) | 未据note回执称解析完成 | 局部已验，余状态待验 |
| M24 / Mac M12 | 否 | 本批 f1e0f926-a28c-4b2e-b16e-8a3a4b71db58；启动3f79/恢复293d；exact received a95d1917-2c10-44fe-b8cc-95a7726404ca | 否 | 具体记录→Central正文与独立说明→回执返回 | 收到的确切note原文一致 | [mac-live](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/mac-live/result.json) | 其他unknown/paging/error仍分组证据，非此笔重跑 | 局部已验，余状态待验 |
| M25 / Mac M12 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M25 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M26 / §3 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M26 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M27 / Mac M15 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M27 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M28 / Mac M16 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M28 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M29 / Mac M16 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M29 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M30 / Mac M16 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M30 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M31 / Mac M16 | 否 | bbcf/f4e；真实生成FS pointer提交ACK失败，两副本hash/拒新写/停止/当前Storage恢复入口 | 真实生成本机/loopback；0model/Root访问 | 实际具体子状态及限制见第3节 M31 | 原既有producer/guard；未改迁移/安装/接收策略 | [M31实际](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/mac-storage-uncertain-final-r2/result.json) | 修前及首修挂载/未展开disclosure失败保留；只重验失效态 | 相关实际子状态已验；其余源/OS边界见第3节 |
| M32 / Mac M16 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M32 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M33 / Mac M16 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M33 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M34 / Mac M16 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M34 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M35 / Mac M16 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M35 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M36 / Mac M10、Mac M16 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M36 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M37 / Mac M16 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M37 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| M38 / Mac M16 | 否 | b04；签名current、ad-hoc生成包ready/dirty/显式确认取消，0install | 真实生成本机/loopback；0model/Root访问 | 实际具体子状态及限制见第3节 M38 | 原既有producer/guard；未改迁移/安装/接收策略 | [M38实际](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/mac-update-ready-final/result.json) | 修前及首修挂载/未展开disclosure失败保留；只重验失效态 | 相关实际子状态已验；其余源/OS边界见第3节 |
| M39 / Mac M04、Mac M11、Mac M14 | 分支：按关联 Central 入口分支 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 M39 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用） | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| P01 / §3 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 P01 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[原Android摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| P02 / Android A08 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 P02 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[原Android摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| P03 / §3 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 P03 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[原Android摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| P04 / Android A07 | 否 | bc主APK；最终风险失效邀请/EOF保名称邀请、返回/重建、重试仅1次兑换；1.85s；原失败保留 | 否；本批精选故障/本机状态不调用模型 | 已实际操作子状态见本格输入说明与原摘要 | 当前Main生产路径；仅生成输入，原配置/队列/三私有文件恢复 | [Android原摘要及确切子报告](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 各首次失败与修后重测保留在原摘要，不计整组通过 | 相关实际子状态已验；其余源状态/真实OS边界待验 |
| P05 / §3 | 否 | bc主APK；r4真实ACTION_VIEW→受控目标Chrome→Back帮助→同草稿/说明，2.976s；外部GitHub可达未验 | 否；本批精选故障/本机状态不调用模型 | 已实际操作子状态见本格输入说明与原摘要 | 当前Main生产路径；仅生成输入，原配置/队列/三私有文件恢复 | [Android原摘要及确切子报告](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 各首次失败与修后重测保留在原摘要，不计整组通过 | 相关实际子状态已验；其余源状态/真实OS边界待验 |
| P06 / Android A01 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 P06 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[原Android摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| P07 / Android A06 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 P07 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[原Android摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| P08 / Android A06 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 P08 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[原Android摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| P09 / Android A06 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 P09 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[原Android摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| P10 / Android A03、Android A06 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 P10 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[原Android摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| P11 / Android A02、Android A03、Android A11 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 P11 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[原Android摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| P12 / Android A02、Android A03 | 否；读已有真实原件 | AA main2366978589…；原note a1d231e0；真实Discovery message4b44；6f11；newMain2e30062c/APKde68ff43/catalog10069；同H04三引用9图 | 否；未新增保存/推理 | 正文与当前attributionContext独立说明分开展示，准确版本/原文返回 | 既有真实note ACK只读核验，不读旧metadata或重复保存 | [note复验](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/android-live-repaired/persisted-note-verification-r2/report.json)；[Discovery](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/android-discovery-r2/report.json)；[Android实际三引用9图](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/derived-reader-actual-r3/report.json) | 旧reader缺当前context→d9876fd1；AA4JVM+实际图，Mac/Terra独审 | note和file各保精确版本；本轮file子路径已验，Root10070非完全相同APK |
| P13 / Android A04、Android A05 | 本批0模型；独占生成AVD | 主4bdde64c/treeba7aabc4/catalog10083；Root449c03cd测试叶 | 专用AVD实际系统/文件行为；更新仅TEST受控UI，非OEM/Prod发布 | 49909fd9→266886b9仅刷新现有启停标题。Development主4bdde64c/MainTreeba7aabc4/catalog10083；R6完整11.534s实际正常A11y Allow、两次SystemUI Projection同意、仅生成外部testAPK截图入队、运行迁移复用原grant/service、菜单暂停、停止迁回不autoStart、fresh开始再授权及masterStop。R7 4.157s仅补真实SystemUI窗口，替代R6过渡帧；标题/迁移/权限图已由Terra独审。所有原queue字节/ptr/id、prefs/private3/9573/cal1event7、A11y/通知false恢复，0HTTP。OEM长期后台与物理权限差异未验，不升整组。 | 仅原指定子状态；R7替代授权过渡图不加整旅程计数 | [R6](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/projection-actual-r6/report.json)；[R7授权图](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/projection-actual-r7/report.json)；[TEST更新](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/update-test-ui-actual-r2/report.json) | 初R1–R5失败保留；R6保原test包4d84，R7包5676不重标旧通过 | 指定缺口已补验；环境边界和组内其他状态见第3节 |
| P14 / Android A05 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 P14 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[原Android摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| P15 / Android A07、Android A08、Android A09 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 P15 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[原Android摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| P16 / Android A09 | 否 | bc主APK；r3物理event移出后reader不可用/安排补传0/0capturePOST，无复活；保留1归旧a1d note是基于前后队列ID/原件和旧mtime的事后归属推断；无当时文件名快照，截图本身不证明归属 | 否；本批精选故障/本机状态不调用模型 | 已实际操作子状态见本格输入说明与原摘要 | 当前Main生产路径；仅生成输入，原配置/队列/三私有文件恢复 | [Android原摘要及确切子报告](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 各首次失败与修后重测保留在原摘要，不计整组通过 | 相关实际子状态已验；其余源状态/真实OS边界待验 |
| P17 / Android A10 | 是 | 本批 f1e0f926-a28c-4b2e-b16e-8a3a4b71db58；启动3f79/恢复293d；正确run8b0b10e2→turn4969dd04；bc主APK；删除取消0DELETE、实际503保同会话/草稿/附件/重建、旧owner迟到隔离；可读默认错误，技术详情More；原真Terra续问仍按既有run | 本机Codex App Server / gpt-6.1-terra / high；原生model与threadModel回执 | 已真实写入原65b第3轮，Send前actualtarget guard通过；引用只读resume已过 | call5 df5106c4；原错误call4在6bb保持失败 | android-live原失败与android-live-repaired实际图分开；[Android原摘要及确切子报告](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | global adopt误投→01b/d4修→正确新call；多引用selector仅test修/0新call | 相关实际子状态已验；其余源状态/真实OS边界待验 |
| P18 / Android A10 | 是 | 本批 f1e0f926-a28c-4b2e-b16e-8a3a4b71db58；启动3f79/恢复293d；Web→Mac→Android原65b3turn | 本机Codex App Server / gpt-6.1-terra / high；原生model与threadModel回执 | 指定会话跨端续问已正确，原Web/Mac轮仍在 | 正确turn4969/realQueryRun8b0；失败wrong6bb不算 | [Android本批](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/android-live-repaired/report.json) | 受控A/B并发、ownedunknown/body与owner迟到3风险独审；真实新轮单独核 | 局部已验，余状态待验 |
| P19 / Android A10 | 否；复用 P17 | 本批 f1e0f926-a28c-4b2e-b16e-8a3a4b71db58；启动3f79/恢复293d；existingturn4969原文ce41bad7 | 否；只读复用call5 | 准确新轮引用原文→同65b/同turn，未发draft保留；保存问答本批未做 | GET真实capture/完整snapshot及该turn引用序列核 | [只读续验](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/android-live-repaired/persisted-turn-resume) | save raw note已ACK但旧test metadata断言错；reader独立context显示返修，不重建note | 局部已验，余状态待验 |
| P20 / Android A10 | 是 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 P20 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[原Android摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| P21 / Android A10 | 是 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 P21 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[原Android摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| P22 / Android A11 | 否；复用真实Discovery | AA/test8919；712报告inline0→原文4b44→同报告 | 否；0新推理 | 完整原生正文/citation映射/当前Material pin/原文/同报告返回 | 真实Central结果，共享旧会话turn IDs不变 | [android-discovery-r2](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/android-discovery-r2/report.json) | 原AVD退出失败保留；不清数据恢复后2.28s通过，Terra独审；后H01旧结果撤下是后续事实 | 本次引用子路径已验；余主题/空错历史沿用精确阶段证据 |
| P23 / Android A12 | 是 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 P23 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[原Android摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| P24 / Android A15 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 P24 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[原Android摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| P25 / Android A15 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 P25 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[原Android摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| P26 / Android A15 | 本批0模型；独占生成AVD | 主4bdde64c/treeba7aabc4/catalog10083；Root449c03cd测试叶 | 专用AVD实际系统/文件行为；更新仅TEST受控UI，非OEM/Prod发布 | 414b5cf8已将ready/install_permission删除安装包按钮置主区，保执行中禁用和签名守卫。TEST独立包R2实际5.733s验证合成current/available/downloading/checksum/ready与真实生成APK/part删除；既有APK verifier0.303s拒错证书/包名/降级/篡改，canonical公钥未替换。两个TEST包已移除，原Dev数据/权限不变；Terra独审。没有canonical GitHub发布/下载、真实Prod系统安装证明。 | 仅原指定子状态；R7替代授权过渡图不加整旅程计数 | [R6](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/projection-actual-r6/report.json)；[R7授权图](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/projection-actual-r7/report.json)；[TEST更新](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/update-test-ui-actual-r2/report.json) | 初R1–R5失败保留；R6保原test包4d84，R7包5676不重标旧通过 | 指定缺口已补验；环境边界和组内其他状态见第3节 |
| P27 / Android A13 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 P27 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[原Android摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| P28 / Android A14 | 否 | bc主APK；勾选关闭实际清除加密诊断样本，草稿不误触清理；1.135s | 否；本批精选故障/本机状态不调用模型 | 已实际操作子状态见本格输入说明与原摘要 | 当前Main生产路径；仅生成输入，原配置/队列/三私有文件恢复 | [Android原摘要及确切子报告](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 各首次失败与修后重测保留在原摘要，不计整组通过 | 相关实际子状态已验；其余源状态/真实OS边界待验 |
| P29 / Android A14 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 P29 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[原Android摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| P30 / Android A14 | 否 | bc主APK；实际释放选中原件仍保引用；chmod000真实IO失败为0成功/1失败/原件保留；3.429s | 否；本批精选故障/本机状态不调用模型 | 已实际操作子状态见本格输入说明与原摘要 | 当前Main生产路径；仅生成输入，原配置/队列/三私有文件恢复 | [Android原摘要及确切子报告](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 各首次失败与修后重测保留在原摘要，不计整组通过 | 相关实际子状态已验；其余源状态/真实OS边界待验 |
| P31 / Android A06、Android A14 | 否 | bc主APK；r4真calendar1选择/范围各边界及取消；追加启用source、生产SourceScanWorker真本机扫描0条/等发送、registered=false/HTTP0，1.458s；临时source/work已清理 | 否；本批精选故障/本机状态不调用模型 | 已实际操作子状态见本格输入说明与原摘要 | 当前Main生产路径；仅生成输入，原配置/队列/三私有文件恢复 | [Android原摘要及确切子报告](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 各首次失败与修后重测保留在原摘要，不计整组通过 | 相关实际子状态已验；其余源状态/真实OS边界待验 |
| P32 / Android A14 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 P32 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[原Android摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| P33 / Android A09、Android A15 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 P33 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[原Android摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| P34 / Android A15 | 否 | bc主APK；r2真SAF支持包排除正文/图像/令牌；追加1h/24h真运行日志范围与3年龄数值样本全部保留，1.707s，重建保24h。未改变/冒称journal逐时裁剪；测试准备失败保留 | 否；本批精选故障/本机状态不调用模型 | 已实际操作子状态见本格输入说明与原摘要 | 当前Main生产路径；仅生成输入，原配置/队列/三私有文件恢复 | [Android原摘要及确切子报告](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 各首次失败与修后重测保留在原摘要，不计整组通过 | 相关实际子状态已验；其余源状态/真实OS边界待验 |
| P35 / Android A14 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 P35 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[原Android摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| P36 / Android A14 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 P36 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[原Android摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| P37 / Android A14 | 否 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 P37 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[原Android摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |
| P38 / Android A14 | 本批0模型；独占生成AVD | 主4bdde64c/treeba7aabc4/catalog10083；Root449c03cd测试叶 | 专用AVD实际系统/文件行为；更新仅TEST受控UI，非OEM/Prod发布 | R6主4bdde64c/MainTreeba7/catalog10083真实运行采集中迁移复用当前Projection实例/授权、菜单Pause、停止态迁回仍停止、再次显式开始需要新授权，最后masterStop/drain。原queue全部文件字节/指针/ID与private3/prefs/cal完整恢复；0HTTP，Terra独审。旧StorageActivity取消/复制验证/失败与JVM证据按原pin复用；未做真实可移除介质拔出/掉电全流程。 | 仅原指定子状态；R7替代授权过渡图不加整旅程计数 | [R6](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/projection-actual-r6/report.json)；[R7授权图](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/projection-actual-r7/report.json)；[TEST更新](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/update-test-ui-actual-r2/report.json) | 初R1–R5失败保留；R6保原test包4d84，R7包5676不重标旧通过 | 指定缺口已补验；环境边界和组内其他状态见第3节 |
| P39 / Android A10、Android A16 | 分支：按关联 Central 入口分支 | 复用第3/6节原阶段；真实版本/dirty边界按原报告，本批未重跑本入口 | 原阶段真实本机/受控HTTP，未冒称live模型或物理OS | 已操作子状态及具体剩项见第3节 P39 | 仅对应原本机存储/HTTP结果，不计新通过 | 原第3/6节对应证据（复用）；[原Android摘要](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/p01-p39-actual-acceptance-summary.json) | 首失败及修后重测保持原版本；不因新stamp重跑 | 阶段局部已验；指定应用态/OS边界仍按第3节 |

### 追加合同的贯穿验收

下表补充跨旅程合同，不取代三端各自入口与视觉记录。已有真实 SQLite/HTTP、专用设备、依赖下载或 fixture 验证可以引用，但必须与本轮最终真实模型回归分开。

| 合同 / 关联旅程 | 模型需要 | 计划输入 / 实际 run | 实际 provider / model | 前端结果 | 后端结果 | 视觉结果 | 失败 → 修复重测 | 最终状态 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| H01 普通删除保留问答 / W08/W11–13/W18/W21/M09–11/P18–20 | 是：删除后续问 | 真实ce41普通删除；65b3旧轮保留、call14 run926fc5d4 / turn5d53ac35 | 本机Codex App Server / gpt-6.1-terra / high；native model与threadModel | 准确不可用dialog→旧轮→真正续问；保留历史与可重新核实范围清楚 | 原回答/cite身份不变、原文404；续问仅历史依据，无伪造新引用 | [h01-continue-r2](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/h01-continue-r2/result.json)；h01-retained-readonly-verification.json | 两个runner断言/selector失败保留，不重删/重发；834后13图和完整answer由Terra独审 | 普通删除子路径已验；tombstone/forget/撤权/strict全删按专项证据另核 |
| H02 同范围日程管理 / W36/M19/P23/P31 | 是：真实提案；complete仅Mote状态 | 同grant473530c8/generated source/device9573/LOCAL1；原create/update/cancel/complete身份 | 本机Codex App Server/gpt-6.1-terra/high；真实producer receipts | 原缺end补完自动同步；真实四操作回执、同原文与准确状态返回 | create event6→update同6→cancel后6不存在；complete关联7且原event7完整JSON不变 | [create](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/android-calendar/create-H11/report.json)；[自然 update](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/android-calendar/update-natural-periodic/report.json)；[cancel / Mote complete](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/android-calendar/cancel-and-complete/report.json) | create/cancel为测试明确触发生产adapter；update自然GreedyScheduler；complete主机先完成、无伪造OS写入 | 本轮同授权四操作已验；故障/撤权/重启等沿用原专项；Mac无LOCAL源未写入 |
| H03 独立说明 / W04/W08/W20–23/M05/M14/M17/P06–08/P13/P19/P31 | 是：证明上下文独立可见 | Webce41/Mac937a/Androida1d2真实原件与独立说明 | 本机Codex App Server / gpt-6.1-terra；call1/2实际attribution_context | Web/Mac分字段保存/读；Android当前context正文/说明分离返修已验 | 真实exact ACK/原文版本/host context；不嵌正文或metadata | [Web/Mac](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/mac-live/result.json)；[Android](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/android-live-repaired/persisted-note-verification-r2/report.json) | Android旧metadata reader→d9876fd1；4JVM+真图，Mac/Terra独审；不重复保存/付费重跑历史 | 局部已验；清除/跨设备/隐私等风险仍按原专项证据另核 |
| H04 完整本机 OCR/ASR 准备 / W37–38/W43–45 | 真实OCR/ASR；理解/提问Terra | 生成sourcee8ca；PNGba14a543 12996bytes、WAV585009ef 217930bytes；处理前后原SHA相同；3a/64bc修后Web8图+Android9图复用同真实H04 turn，0新query/save | 本机缓存OCR/ASR/diarize；理解+Ask gpt-6.1-terra；Ask6d70d232/turnf7f6a4a1 | 现设置真检查ready；file-sync→owner retry仅两文件→原文；三个exact citation实际pointer返回同turn | OCR两行正确、ASR保mode误识、匿名1人、dialogue成功；两exact Material/read；七项设置/授权/jobIDs不变 | [H04总报告](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/h04-final/report.json)；[精确引用往返](/Users/utopiafar/.codex/worktrees/ui-final-mac-complete/mote/.mote/h04-final/readonly-resume/report.json)；[Web实际三引用8图](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/h04-reader-final-r2/report.json)；[Android实际三引用9图](/Users/utopiafar/.codex/worktrees/ui-final-android-complete/mote/.mote/android-final/derived-reader-actual-r3/report.json) | 唯一Ask admission后fixture误读body.question失败；0重发只读resume。默认derived引用露JSON已交Web/Android返修 | 真处理及两reader默认正文/More/返回已验；WebMore长行局部样式另收口。非新下载/像素理解/麦克风/多人/其它平台通过 |
| H10 整份精确版本资料提问 / W09–13/M09–11/P17–21 | 是：实际分页读取及同会话续问 | 本批 f1e0f926-a28c-4b2e-b16e-8a3a4b71db58；启动3f79/恢复293d；31块ref material:mat_727242eb15a4fa9fbc48049adbd9611849411319212cb4056e661962cdeb4fc5@a9c4be7a55556707419228ac4877ae4c881d36a13338e1f396845b4464ebfa54 | 本机Codex App Server / gpt-6.1-terra / high；原生model与threadModel回执 | 整份准确版本由reader传到Ask，读第16/31并返回原文 | 真实3次material_read与准确引用；不截30；call3 eaefb7eb-4901-4f98-acbd-6b32a33ffc7c | [long-material](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/long-material/result.json) | 不把wrong Native6bb误投续问算正确跨端；其余继承/变化分支待验 | 局部已验，余状态待验 |
| H11 安排详情补缺时间 / W36/M19/P23/P31 的同一 Mote 入口 | 原提案Terra；填时保存自身否 | A2b68语义uncertainty负例；Bd6a7/更新5cf9原endnull正例；唯一旧grant | 本机Codex App Server/gpt-6.1-terra/high；真实producer9354/5b89 | A补end仍待处理且无operation；B补end自动waiting_device；a17真update7图显示信息已保存/真实进度而无假冲突 | 非null原start字节及title/evidence/relations/authoritypin不变；真event6同ID13–14UTC/雨松厅 | [update实际UI](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/calendar-update-information/result.json)；[自然设备回执](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/android-calendar/update-natural-periodic/report.json)；[负例只读核对](/Users/utopiafar/.codex/worktrees/c1a8/mote/.mote/final-shared-terra-20261030-0256/calendar-negative-reconciliation/result.json) | A时间拼写harness失败保成功请求；B依赖race077fa单任务恢复；a17修保存ACK/文案，未清uncertainty/放宽授权 | 正负补时、两UI差异与本轮设备更新已验；原其它异常分支按专项证据 |

H01 必须分别验证普通物理删除、外部来源 tombstone 与显式隐私忘记/撤权/到期；保留的历史问答不授予重新读已不可用原文的权利。历史引用先按会话/引用身份和当前可用性校验，不能通过通用原文链接绕回；原独立 owner 归档合同不因此伪称已擦除。strict 范围内原文全删时，真实搜索/读取授权集合为空，不能扩大为全资料；混合有效、普通删除、未知缺失、隐私删除的 ID 分别核对。需要你补充的已提交回答和资料变化反馈也须覆盖。

H02 使用真实模型产生的提案走现有同设备/日历和证据版本保护，旧 create-only 声明不能伪称已授予新操作。update/cancel 保持原身份，complete 的本地状态不伪造成设备写入；重复请求/领取、撤权后仅回执、重启恢复与不确定结果保留。专用测试日历的单独授权证据只能证明其记录的范围。

H11 从安排详情实际补缺开始/结束时间及必要的明确时区，核对已有非 null 值的偏移/毫秒字节与全天排他结束日期保持不变；标题、地点、描述、语义不确定性、原文依据、关联与目标不被补时间改写。保存成功首先只证明信息已存；没有唯一有效既有授权、重叠/撤权/过期或仍有语义不确定性时不得显示已写入。既有授权自动重评后，等待设备、执行中、未知回执及真实成功分别验证。同一旧 version 重放必须 409，未知结果保留原请求并 GET 精确身份核验；另测原文/关联更新、旧节点晚回调和失败保草稿。全程不猜时间、不新增授权、不自动选择设备或日历。

H03 单条与来源说明分别验证保存/清除/重启/同步、跨设备拒绝、同 ID 幂等冲突、collector 不可声明 owner 内容、模型上下文及派生资料范围；不混正文，不在全文搜索/心跳泄漏私有说明，不自动付费重跑历史。H04 分别记录受管理依赖、实际模型包、图片 OCR 与音频 ASR 真实输入结果；准备成功必须达到启动和健康，取消/失败/重试不改自动处理授权，不操作现有部署。

### 最小未授权外部动作与收尾

- 发送外部邮件/消息、邀请真实人员、写用户真实日历、修改真实第三方数据或发布/部署，不属于本次最终回归授权。只暂停需要该动作的最小子步骤，写明目标、动作、已完成部分与所需决定，其余生成资料和本地链路继续。只读测试账号接入缺失是能力/凭据缺口，不能用 mock 回执改写成真实连接通过。
- 使用本轮已有明确授权的可销毁设备/日历时，保留原授权和清理证据；不得据此扩大到用户设备、现有服务/profile 或个人资料。需要额外账号写入/安装时再单独确认，不恢复已取消的旧验收任务。
- 若真实 Codex Server 的模型调用失败、所选 ID 不可用或访问被拒绝，保留精确错误和未执行状态；不静默换模型、伪造输出或重试被拒绝操作的替代路径。目录预检不解除真实调用时的限制。
- 完成后关闭本轮服务、worker、fixture browser、专用测试进程和端口；清理生成数据、测试凭据、临时日历/文件并记录结果。尚需下个模块复用的专用资源记 owner 和保留原因，不声称已清理。最终按已合 PR、128 旅程实际覆盖、77/33 能力对账、已批准追加合同、真实模型证据、视觉差异、失败重测、未测与 Hold 报告，不以局部完成代替全部完成。
