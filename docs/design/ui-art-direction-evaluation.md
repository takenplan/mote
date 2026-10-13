# 五轮共同美术风格：独立评价记录

本文件逐轮记录实际构建、操作、八项判断与取舍。五个方案均供用户选择，独立模型评价不是用户接受。

## 初审与固定合同

评估者：preview_audit。日期：2026-10-13。本文件不修改产品或预览生成器。

用户已明确推翻上一轮的审美接受。F2 / D3 / R10 的历史独立操作与当时分数保留，但**8.5 不作为本轮起点或已获用户认可的证明**。此次没有正在运行的隔离 fixture，初审重新目视实际冻结 PNG。基线 Functionality 使用同一冻结版本此前独立实际操作的 trace，再结合本次动作可识别性重判，明确本次没有重跑；不会把此前通过带到任何新候选。五轮均须有真实三端候选、独立反馈和逐项分数，即使中途分数达标也不把其余轮次省略或倒填为同一批图。

### 网上调研与采用边界

- Apple HIG 把重要性、对齐、分组与渐进呈现联系起来：空白、容器、分隔线都能表达关系；过多内容和选择会妨碍理解。这支持压缩重复说明、整理层级，而不是统一加卡片或隐藏功能。[Layout](https://developer.apple.com/design/human-interface-guidelines/layout?changes=lat_3__1_2)
- Apple 字体指南强调用字号、字重和颜色表达层级，并在字体放大时维持相对关系。系统字体可不同，但内容/标题/辅助说明的角色应清楚。[Typography](https://developer.apple.com/cn/design/human-interface-guidelines/typography)
- Android 指南把隐式留白与显式分隔都视为 containment；相关内容应组合、无关内容应分开，网格和边距要适应尺寸。[Content composition and structure](https://developer.android.com/design/ui/mobile/guides/layout-and-content/content-structure)
- Material 将 surface、primary/secondary、error 等语义颜色角色与 token 连接，使设计与实现共享规则；这能作为三端角色统一的基础。[Color roles](https://m3.material.io/styles/color/the-color-system)、[Foundations](https://m3.material.io/foundations/)
- Carbon 区分按钮强调级别，要求相同 variant 稳定表达相同角色，按钮文字清楚且长文字应合理换行；说明主张层级，不意味着每个链接都必须有矩形边框。[Button](https://www.carbondesignsystem.com/building-blocks/core/components/button/guidelines)
- Carbon 区分任务型与表现型字体，帮助避免把设置/表单做成营销段落。[Typography](https://www.carbondesignsystem.com/building-blocks/foundations/typography/overview)

这些是设计参考，不是 Mote 产品政策。不会照搬 Carbon 的单主按钮规则来删除 native 四个平等保存动作，不强制新依赖/框架、同一字体文件、相同像素布局或 Liquid Glass。三端真实功能与交互习惯可不同；同一角色的美术语言需要能解释为同一个产品。

### 当前截图的具体问题

初审重新打开以下真实图，兼看上一轮三端接触图：Web F2 `populated-home/settings/providers-en-1440`，Mac D3 `en-normal-home/note-composer/reader`，Android R10 `english/home/settings` 与 `compact-english/note-return-list`。文件来自各自冻结 manifest，没有重新合成产品图或启动用户界面。

| 问题 | 实际观察 | 本轮审查方向 |
| --- | --- | --- |
| 大段文字平铺 | Web Provider 在表单前有页说明、大型起步说明、示例、preset说明、创建后果说明、只读说明；真正配置字段靠后。Settings 卡片每个带多行说明，再跟Memory解释面板。Android 日期笔记页先放标题/长说明/两筛选/日期/统计/Refresh/类型与状态，原文摘要排到首屏下。 | 区分“完成当前动作必需”“识别对象”“有疑问再看”的文字。必要边界仍留在决策点；重复解释可以整合/折叠，但入口与含义不可丢。 |
| 标题与内容重复 | Provider 的“Deployment configuration”同时出现在preset选择、右侧对象标题与只读卡标题。Mac reader把整条笔记正文同时作为大标题与正文。Android Quick notes在页名、筛选值、时间行、记录类型中重复，Local records也重复。 | 每层承担明确角色：页面、所选对象、正文、metadata，不仅换字号。保留有定位作用的breadcrumb/导航上下文；移除无信息增量的重复。 |
| 分隔的效用不稳定 | 三端并非完全没有线或边界：Web有白卡边线与hero/列表分隔，Mac Home有大量横线，Android四动作行有分隔。问题是部分复杂段落与状态仍同权平铺，而Mac细线过多又把页面切成很多窄带。 | 看关系是否可扫读，而不是统计分隔线。组内/组间留白、容器、边线与标题要承担不同角色；不能只给所有东西套白卡。 |
| 控件可识别性与边界 | Android顶栏Settings是灰色文字，部分行内动作与说明形态接近；Mac绿色描边次要按钮与蓝色文字/纸页样式不同于Web灰色描边与Android浅蓝pill。普通导航链接可无外框，但重要动作应能在未hover时识别。 | 明确主动作、次要动作、导航、筛选、选中、禁用各自规则，既有视觉边界也有真实focus/点击区域。不能用“全加边框”替代角色设计。 |
| 实际Craft缺口 | Web正常英文Provider创建按钮长label被裁切为“Create an empty profile, then configu…”。Android320dp/130%把Previous day和2026-10-13挤成不自然拆行。Mac正常note编辑页Save与附件按钮上下几乎贴合。 | 固定成为五轮回归：完整label、合理换行/伸缩、动作组间距、真正可见且可操作。此前我没有据此下调Craft，上一轮审美评分过宽，本轮纠正。 |
| 跨端风格断裂 | Web是sans大标题、细描边白卡与横向dashboard；Mac是serif正文标题、蓝色纸页左线与细横线、绿色次要按钮；Android是大sans、强pill与无描边大圆角卡，Mote字标本身也不同。共享蓝灰色和名字不足以形成共同美术系统。 | 固定共同的字体角色/色彩角色/边界与圆角家族/图标家族/信息密度节奏；平台差异可保留，但需要映射到共同规则，不以“原生不同”解释所有偏差。 |

这些判断是评估者基于图像的诊断与推断。它们不证明用户会按同样路径理解，也不以官方指南推导出用户必须喜欢哪种风格。

### 初审重新评级（视觉范围）

本轮不继承历史8.5。基线 Functionality 有此前同版本保存/返回的独立实操依据，同时对当前可理解性与使用摩擦重新判断；这里没有新执行任何fixture，更不代表R1功能验收。候选每轮需fresh实操。

| 当前冻结参照 | Design | Originality | Craft | Functionality* | Firstlook | Page focus | Platform consistency | Cross-platform joint |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Web F2 | 6.5 | 6.5 | 5.5 | 7.5 | 6.5 | 7 | 6.5 | 4 |
| Mac D3 | 6.5 | 7 | 6 | 7.5 | 6.5 | 7.5 | 6.5 | 4 |
| Android R10 | 5.5 | 5.5 | 4.5 | 7 | 5.5 | 7 | 5.5 | 4 |

*Functionality7–7.5表示同版本主要实操路径确实能完成，但创建label裁切、设置入口说明堆叠、原文/日期列表额外扫读与滚动摩擦仍影响可理解性；不是给未重跑版本8.5保底。

新的三端共同美术风格初评 **4/10**：有共同蓝灰基础，但角色、字形/密度、形状与品牌表现分裂。该分是三端合看结果，不是三端平均分。

### 第八项建议：跨端统一美术风格

评估同一候选轮中的 Web/Mac/Android 是否呈现同一个产品的美术语言：字体层级、色彩角色、表面与边界、形状家族、图标/品牌、留白与信息节奏，以及这些规则如何落到首页、表单、列表、原文、限制与设置。只看已有shared token不足以得分，必须看真实渲染。

| 固定锚点 | 判定 |
| --- | --- |
| 0 | 在已有真实三端证据中完全无法建立共同美术语言。缺少任一候选时记未验证，不用0代替缺失。 |
| 3 | 三端主要像互不相关产品；同类角色的字体、形状、颜色和密度相互冲突。 |
| 5 | 名称/标志或主色共享，部分组件相似；首页、编辑、阅读、设置仍分裂，差异无法由平台/任务解释。 |
| 7 | 大部分同类角色映射到共同系统；主要页风格连续，少量显著例外/状态/尺寸仍破坏家族感。 |
| 9 | 三端在普通/空/限制/错误与窄屏/大字体下均有清楚共同身份；平台原生差异有一致规则，文字与动作层级保持。 |
| 10 | 约定矩阵内未观察到共同美术语言缺口，且三端变化都能由既定规则解释；不声称普遍美学正确。 |

中间分必须给实际例子。第7项评“端内一致性与平台适配”，第8项评“三端家族关系”，两者不可相互抵消。建议第8项作为单独三端联合分，逐端8项表可写同一joint值并注明scope；不能分别把各端自洽称作跨端统一，也不新增总分/权重。

不由评估者自定用户接受分。若owner仍保留各旧目标，应逐项报告差距；哪怕8项都达到目标，结论只能是模型建议，不能写“用户已经接受”。五轮始终使用同一锚点，不在第4/5轮放宽条件或调权重。

### 五轮固定审查清单

每轮都审以下同一清单，不能用不同焦点代替全套评审：

1. **首屏目的与层级**：只看已ready首屏先记录产品作用/当前页目的/立即动作/保存后去哪。主标题、关键数据、主动作是否能先被看见，正文是否被重复帮助挡住。
2. **标题唯一职责**：页名、breadcrumb、对象名、正文标题、类型标签分别有信息增量。首页笔记正文不重复作同权标题与摘要；设置不反复自我介绍。
3. **文字密度与长度**：长/短原文、中英说明、长对象名；必要边界可见，帮助/advanced可发现；不能通过删功能、删必要说明或一律截断降密度。
4. **分组与节奏**：related组内紧密、不同任务组间明确；边线/表面/空白/section标题的作用可解释，不能满页同款卡或满页同款细线。
5. **动作角色**：主要/次要/导航/筛选/选中/禁用/危险动作稳定；未hover可识别，keyboard focus清楚，label完整，目标之间分离。native四保存动作仍为平等入口。
6. **字体与适应**：标题/正文/辅助/数值/状态是少量角色；320dp130%/Web200%和窄Mac没有割裂词、裁切主label、横溢、控件遮挡或边距漂移。
7. **三端并排**：同一轮同时摆Home、list、note、reader、settings、connection/restriction比较；不以三端截图大小/DPR不同误判px尺寸，依据CSS/pt/dp与实际角色。
8. **内容与状态真实性**：同一真实生成记录/来源/原文；本机保存、中央接收、处理/index不可被美术合并成假完成；empty/error/restriction和正常态一样有构图。
9. **主要旅程保持**：保存、回原文、草稿、取消/返回、功能目录与配置任务origin可用；设置不重新混入记录仪表盘，进入页面不启动授权/采集。
10. **证据可比**：round/build/APK/source、locale/viewport/font/DPR、page/state/marker、PNGhash、实际交互日志明确；没有借用上一轮图补当前缺项。无效/历史图有原因，first-view与滚动后图不混称同一首屏。

### 每轮最低真实操作

评估者单独接手known generated后台fixture，生成者停止驱动；三端全部完成后算该轮反馈，不由截图脚本自己打分。

| 平台 | 每轮R1–R5都必须本人实操 | R1/R5详细验证，以及相关变更后补验 |
| --- | --- | --- |
| Web | readyHome观察→new unique note→Save→同条可见→exact source→Close/返回；Settings实际进入确认职责；真实Ask配置CTA→Provider/module→原Ask，directSettings无伪造origin；窄屏至少focus/触发一个主要动作确认label与边界。 | note→Settings→BrowserBack草稿保留；Provider草稿取消/Reset；实际slow/error/signedout状态与200%高风险动作。 |
| Mac | readyHome观察→空note→unique Save→Home同条→exact reader→Close同opener/原父页；Settings→Connection确认职责；820×620focus/滚动触发主要动作。 | 四保存入口和真实生成file确认预览/Cancel；Privacy、测试设置draft→Revert/取消；语言reload、草稿/状态生命周期。 |
| Android | freshUI-tree真实坐标→真实IME输入unique note→Save→Home同条→exact reader→Close匹配records→实际headerBack原父页；Settings/Connection确认职责；320dp130%至少实际IME/scroll/Save或Close；Home Start/Sync入口仍可达但不触发真实采集。 | note日期昨天empty→今天同条；Settings展开维护；连接draft→Keep editing/Discard/reopen；note草稿往返和一次配置重建。 |

五轮每次unique记录带round编号，不沿用上一轮截图。功能catalog/source/import/screen关键族可由每轮现有真实fixture自动旅程覆盖，评估者R1/R5至少实际打开目录及一个file/scope预览，R2–R4至少打开一项新增或主要修改的功能入口；区分本人实操与生成者脚本，不要求外部账号/实机/模型。新增用户发现缺陷加入持久回归。

### 每轮最低截图与状态矩阵

保持固定同类生成内容和稳定文件名。四条件为ZH/EN × normal/compact：Web1440×968/390×812，Mac实际CSS1140×808/820×588（外窗1140×840/820×620，DPR2），Android411dp@420dpi-font1/320dp@540dpi-font1.3（实际PNG1080×2400）。首屏单独记录；为检查下方内容另外保存scroll状态，不能用scroll状态伪称首屏。

| 范围 | 四条件必有的实际ready图 |
| --- | --- |
| 三端共同角色 | Home真实empty、Home populated、Content/list、note editor、exact original reader带真实parent、Ask已连接或明确未连接限制、Settings、Connection/模型连接。 |
| Web重要职责 | Import、Models/Provider/Module、Storage/Privacy、Guide完整目录、Memory/Insights、Activity/processing与设备/来源入口；维持已有功能目录覆盖，不能仅交首页。 |
| Mac重要职责 | Add四动作、生成file import确认、screen scope预览、自动来源/状态、隐私设置、guide实际可用或离线限制；不能把connection限制图冒称打开中央目录。 |
| Android重要职责 | Add四动作、import local task、screen scope、sources、Home collection与sync details、note return/empty日期列表、guide支持功能/连接限制。 |

额外高风险图：Web signed-out Settings/实际503维护失败/900ms慢请求后loaded Notes；Provider长label与Settings在320px及200%zoom；Android两个compact真实IME布局；三端至少一张mixed source/长文本阅读与长名称。每轮不必捏造live-model回答来补状态，有真实限制即清楚说明。

PNG可解码和hash一致不构成ready。必须目标页、loaded/empty/restriction/error consumer标记明确且排除pending/suspense，错误/loading若保留按该状态单独命名。Android用app-owned完整window和实际dialog几何/parent证据；不使用adb screencap，不移除FLAG_SECURE；IME应用布局图明确不包含系统键盘像素。base/overlay secure范围分别写，不能说所有叠层secure。

### 每轮交付字段

候选R1…R5各有冻结manifest/源码或APKhash、候选图、生成者变更假设、独立8项评分与具体缺陷、实际操作范围/未验范围、对上轮反馈的处理与下一轮决定。记录“保留/修正/转向”及证据，不用5个版本名包装一次生成。第5轮即使未达目标也如实报告差距，并把全部5个候选保留可看；未执行实机/live-model/真人理解不会被综合分隐去。

### Owner合同对齐

已读 docs/design/ui-art-direction-five-rounds.md。共同方向与token角色由owner确定，本初审不另设新产品导航/功能政策；第8项8.5按owner合同作为努力目标，仍不凑分。R1共同语法、R2密度、R3边界、R4重点、R5细节只作为演进主题；每轮八项均审，按实际反馈调整主题。详细生命周期首末轮执行，其他轮保留表中真实核心操作，不能只审缩略图。


---

## 候选 1 · 共同视觉语法

R1 建立了可辨认的共同基础：冷灰背景、白色带边界的内容面、深色系统无衬线标题、蓝色动作和选中态、线性图标。仍有明显的密度与角色断裂，**不能写成用户已接受**。本轮各端功能核心能够完成；Android 的真实 Ask 配置返回丢失原任务是需要明确修正的摩擦。评分从当前真实候选重新判断，没有继承之前的 8.5。

聚合候选：`5d5f076e9067bacf03b2ad76212d4e832fb665ec`。实际 producer 保持 Web `2b17e6e20821a773779acceb5bd7384523546aac`、Mac `5e4c1724362d939841da9d3afb10b60eb5a8f3cf`、Android `5d5f076e9067bacf03b2ad76212d4e832fb665ec`。Web/Mac 对聚合候选的各 1450 个生产输入 Git blob 已由 `/root/preview_audit` 独立逐项验证相同，证明记录分别为 `web-equivalence-independent.json`、`mac-equivalence-independent.json`。不倒填原 producer / manifest / PNG 来源，也不借用跨轮图片。

### 八项分数

固定七项依次为：设计质量、原创性、工艺、功能性、第一眼清晰与完整、页面职责与聚焦、端内一致性与平台适配。第八项对同一轮三端共同角色独立给分；不是七项平均，没有总分或权重。

| 平台 | 设计 | 原创 | 工艺 | 功能 | 第一眼 | 职责/聚焦 | 端内/平台 | 跨端统一美术风格 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Web | 7 | 6.5 | 6.5 | 8 | 7.5 | 7.5 | 7 | 7（联合项） |
| Mac | 7 | 6.5 | 6.5 | 8 | 7 | 7.5 | 7 | 7（联合项） |
| Android | 7 | 6.5 | 6 | 7.5 | 7.5 | 7 | 7 | 7（联合项） |

联合项 **7/10**：符合固定锚点“多数共同角色已成立，仍有明显断裂”。标题、白内容面、蓝色填充/描边按钮、蓝选中底和线性图标已使三端比旧三套风格更像同一产品；Mac 的 serif / 纸页书脊已离开核心，Android 四动作外框和组内分隔连续，未观察到所怀疑的 child 白色遮角。剩余问题是 Web 原文/Ask/composer/导入辅助区域的绿色或橄榄色，与其他端蓝灰共同角色脱节；阅读对象、正文、状态和帮助的权重不同且重复，使三端资料读取呈现不连续。Android Import 标题/普通文字偏灰且与其他核心标题层级不同；Mac 读者先遇到四阶段状态与重复题文，Web 读者再遇到绿色类型与来源，Android 原文框直接可读却父列表有厚重重复 scaffold。平台 native nav/IME/窗口尺寸的合理差异不要求像素相同，不能用它解释辅助色和同角色层级漂移。

### 独立评审者与证据

| 范围 | 实际评审者 | 实际方法与报告 |
| --- | --- | --- |
| Web | `/root/preview_audit/web_r1_evaluator` | 独立 CDP 点击/真实输入、BrowserBack、Tab/规范 Enter、设置语言真实 reload、320/390 配置与保存。查看32 core+40补充同产品图并核SHA。见 `web-independent-review.md`、`web-independent-scores.json`。 |
| Mac | `/root/preview_audit` | 独立 CDP 实际 Save/原文/Home和Content来源返回/草稿取消Revert/Ask origin/EnterTabEscape/生成文件预览Cancel/遮罩示意草稿Revert。32 core核SHA与IHDR并审图。见 `mac-independent-review.md`、`mac-independent-scores.json`。 |
| Android | `/root/preview_audit/android_r1_evaluator` | 独立 fresh UI-tree 选择控件并真实 adb 输入/Android IME；保存、exact原文、真实Close→记录→真实Back、空日期往返、草稿configuration重建、设置/连接/实际Ask返回、生成格式预览。查看86同APK app-own-window图并核SHA。见 `android-independent-review.md`、`android-independent-scores.json`。 |
| 三端共同项 | `/root/preview_audit` | 亲自合看8共同角色×normal/compact的48张英文同轮图，见 `joint-visual/index.json`及8联系图；再放大Android两条件首屏Home验证完整四动作/外框。各平台评审完整覆盖中英文×常规/窄屏，Mac中文完整组亦已审。共同项没有从源码/token哈希自动推出一致。 |

每个 reviewer 是独立评审角色，Web/Android 操作不冒充 parent 本人操作；生成者没有给本轮分数。先前 held进程消失是交接生命周期问题，root复开同候选、持续持有新生成profile后才开始核心实操，原canonical图片未替换。只用生成资料、隐藏fixture，不使用用户前台或 private auth。

### 实操结论与 R2 优先项

1. **Android 修正真实任务返回。** 独立两次 Home→Ask→Connection settings→真实 Back to parent，结果是 Settings hub。可手动底栏Ask恢复，不阻断本地保存或原文，但打断原任务；Functionality和Page focus已扣分。Web与Mac真实来源返回均通过。R2按已有真实origin/directSettings差异修复，保留草稿离开确认，并加实际入口的持久回归。
2. **资料更早进入视野。** Mac列表同段title与preview重复、reader又显示同段title与正文，正文前四段处理状态和单独说明占空间。Android日期页title/help/filter/date/prev-next/count/Refresh/time/type/status层叠，compact正文要再滚动；Web Library同类记录卡只有类型/来源/完成，无区别正文预览。按对象/正文/来源/时间/状态给唯一职责，减少无信息增量重复；不能把真实限制、错误、发送目标/范围、保留规则移到不可发现处。
3. **减少配置前置说明与单项大卡。** Web Models/Provider/Modules复用整套起步帮助，实际320创建按钮要滚到y≈869；EN390 Settings第一屏先读很多说明。Mac窄桌面内层白卡与48px按钮增加高度。AndroidSettings单项卡/大组间距把App组推到compact首屏后；Connection邀请/说明在首字段前占高。用紧凑分组与可发现帮助层级，保留触控、完整说明及全部入口。
4. **按重要信息而非只按日期修窄屏。** Android日期旧拆词已修，但Sync details出现 `Connectio / n settings`，Import selected retention被省略；这两项来自同APK真实图，不能由日期回归通过掩盖。Web390真实Tab后的Save下缘约8.5CSSpx在底栏后，中心和label可见且规范Enter实际保存，属于部分焦点/边界遮挡，不是按钮不可用。
5. **把辅助颜色/边界统一到明确角色。** Web绿色阅读/Ask/import辅助层，Mac Save与附件按钮紧贴，Androidreader/catalog动作描边上边缘缺失（原因未独立证明）与格式预览用Off关闭，是R2/R3具体细节。先稳定角色和扫读，再做光学校准；不为了分数追加违和装饰。

KEEP：四种平等保存动作、Android原生导航/IME、原文/来源/时间、草稿与明确开始、真实离线/模型限制、发送/保留政策、已经修好的日期和Provider长label。没有在评审中改产品、生成器或gallery。

### 验证边界与释放

- Web true200%仅看producer真实Home图；独立390/320操作不能冒充true-browser zoom，Provider/Settings true200%未独立实操。503/慢请求/signed-out是producer证据，不写成reviewer注入。
- AndroidPNG来自真实应用自己的View/窗口，不包含OS键盘像素；IME状态实际输入/应用insets另验，swipe会先收键盘再露出Save，不写成键盘保持时保存。base secure与overlay实际flags分开，几何不单独证明Activity parent或安全范围。reader父关系由实际Close/树/真实Back证明。
- Mac独立native语言切换/renderer重载未证明；native select赋值+change后文字未切换，不作为用户真实select的产品缺陷，两语言渲染依据canonical。应用重启后持久性未独立复验。Web真实语言reload、Android真实configuration recreation、各端路由草稿分别记录，不互相借验。
- 评估工具错误gate、无CR按键、reload race与诊断记录均保留，并在各端报告排除；不是产品失败，也不提升成完成页。没有实机、真实采集/账号/模型、真人初看实验或完整无障碍认证。

**三端已明确 release 给 root**：Web EN Today1440×968DPR2且空草稿；Mac EN Home820×588DPR2，note Save后为空、device/mask已Revert、Import已Cancel、采集停止；Android English420dpi/font1/Home selected、空草稿、preview关闭、未开始采集。只留独立生成记录/一个未配置preset给owner清理。reviewer没有停止或清理root-owned进程；release状态是允许owner收回，不冒充清理已完成。

R1记录完整，下一轮可按上述优先问题继续；用户尚未选择任何候选。


## 候选 2 · 扫读与密度


本轮减少了设置和阅读页的重复说明。Mac 与 Android 的原文更早进入视野，设置菜单开始按相关职责成组；配置的完整帮助仍可展开，重要限制和操作直接可见。真实保存、原文回读和来源返回通过，Android Ask 配置返回丢失原任务的问题已在本轮正常与窄屏实操中修正。**美术风格仍有明显断裂，用户尚未选择候选。**

聚合候选 `10d28e60aaaff205d3871594d3fa5a4d07664658`。Web实际 producer为同一提交，Mac/Android实际 producer为 `6854f25904d924b406fdbf1843ae74a5ab420e15`。两提交唯一改动是隐藏 Web fixture 获得键盘焦点的测试前提；Mac1235、Android1349个声明生产输入的实际 Git blob 已由 `/root/preview_r2` 独立重核逐项相同。原 manifest、APK、PNG来源保持原 producer，没有借用前轮图片。本文只使用冻结的R2资料，未使用之后R3 workingtree。

### 八项分数

固定七项依次为设计质量、原创性、工艺、功能性、第一眼清晰与完整、页面职责与聚焦、端内一致性与平台适配。联合项单独直接判断，没有总分、权重或平均。

| 平台 | 设计 | 原创 | 工艺 | 功能 | 第一眼 | 职责/聚焦 | 端内/平台 | 跨端统一美术风格 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Web | 7.5 | 6.5 | 7 | 8 | 7.5 | 8 | 7.5 | 7（联合项） |
| Mac | 7.5 | 6.5 | 7.5 | 8 | 7.5 | 8 | 7.5 | 7（联合项） |
| Android | 7.5 | 6.5 | 7 | 8.5 | 7.5 | 8 | 7.5 | 7（联合项） |

联合项 **7/10** 未随轮次自动提高。共同灰白蓝、无衬线、线性图标已成立，信息层次变得接近；Web残留淡绿/橄榄辅助面、重复reader层级，Android灰色Import标题、不同顶栏与own-window对话框U形描边，以及Mac同组菜单图标例外，仍对应固定7分锚点。`/root/preview_r2`亲自合看48张同轮英文共同角色图，未从token哈希相同或平台分数平均推出联合项；详见 `joint-independent-review.md` 与 `joint-visual/index.json`。

### 实际评审与证据

| 范围 | 实际评审者 | 本轮实际范围 |
| --- | --- | --- |
| Web | `/root/preview_r2/web_evaluator` | 32核心图独立核hash/尺寸/ready并审四条件；两条独立生成note实际Save、逐字reader与Close，纯Settings/真实Ask origin、命名完整帮助与Provider即时空preset后果，390真实Tab与CR Enter保存。见 `web-independent-review.md` / scores。 |
| Mac | `/root/preview_r2` | 32核心核验/四条件审图，真实独立两行note、Home/Content两入口逐字原文、展开四阶段、Close同key焦点、Settings职责、Ask配置真实返回、生成文件preview/Cancel。见 `mac-independent-review.md` / scores。 |
| Android | `/root/preview_r2/android_evaluator` | 86同APK own-window图独立核验/审图；正常与320dp130%实际IME输入保存/逐字原文/Close/真实headerBack、Ask origin与Keep/Discard、直接Settings、完整帮助/同步动作与Close preview。见 `android-independent-review.md` / scores。 |
| 共同项 | `/root/preview_r2` | 8共同角色×常规/窄屏×3端共48英文图亲自对照；个别端四条件完整审图由各实际评审者完成，不冒充父代理亲自操作子评审运行时。 |

Root handoff预置的 `reviewerTask=/root/preview_r2` 被通用runner原样写入raw trace。Web/Android实际操作者是上表子评审，汇总分别记录 `actualReviewerTask` 和 `rawDeclaredReviewerTask`；原trace不改写。制作代理没有给本轮分数。

Web焦点全边界独立实证：390宽，Save底部709.54CSSpx，outline3+offset3后的边界715.54，小于底栏顶部742；规范CR Enter实际保存且原文相等。隐藏fixture焦点前提及CDP focus emulation按报告明确记录，不能当作前台浏览器/真实系统焦点研究。制作方首次focus失败是隐藏renderer没有获得焦点，保留该测试缺陷记录，不当作产品故障。

Android真实Ask→Connection→headerBack回Ask；Keep editing不丢草稿/origin，Discard后同样回Ask；直接Settings访问回Settings，未虚构Ask来源。正常IME下Save完整可见；compact首次输入后需真实gesture露出Save，应用仍保持IME缩短的视口，完整Save实际成功。PNG只绘制应用自己的窗口，没有系统键盘像素，不用几何单独证明返回父Activity。

Mac保存后Notes出现完成提示，进入Settings时没有遗留提示；但点击Settings前提示已先自然消失，**本轮未独立证明即时跨页抑制时序**，也未注入running/error。该边界已纠正，不能把源码规则写成额外通过。

错误gate/locator及旧壳观察保留并排除完成证明：Web18模块旧门槛只捕获旧Provider壳，原PNG不作为完成页，21按真实模块标题/内容补证；Mac06/12/15/18错误marker均false且无完成PNG，后续根据实际观察补证；Android初始实际为English，错误ZH gate保留诊断后改用真实marker。详见各端报告。没有重写失败raw记录或用它们提高评分。

### R3的具体反馈

1. 把外壳、操作描边、组内分隔分成稳定角色；Android own-window对话框动作上边缺失需定位绘制/裁剪原因并加入真实几何回归，不能先宣称系统渲染故障已证实。
2. 同职责顶栏、菜单图标和返回提示连续；Android Main/子Activity层级、灰色Import标题，Mac Permissions图标例外与Ask配置breadcrumb应明确修正。
3. Web残留绿色非状态辅助面应归入共同角色；普通蓝色Delete与正常动作区分。reader重复类型/前置处理说明仍影响正文优先。
4. Android展开同步的大块同色长文、重复记录类型/近期统计继续压缩层级。Web Library同类项难区分是已记录扫描限制；不能凭空捏造API尚未提供的正文或时间字段。

KEEP：原文/来源/时间、实际处理/发送/保留/离线限制、四个平等保存动作、草稿/返回、完整帮助与明确开始。R2–4按实际核心与受影响变化验证；未重演R1全部生命周期或宣称完整错误状态覆盖。

### 验证边界与释放

没有实机、真实个人采集/账号/传输/模型、真人初看实验或完整无障碍认证。R2未独立重做true200%浏览器缩放、应用重启与完整语言持久性；两语言视觉矩阵来自本轮真实canonical。模拟器、生成资料和fixture不能扩大为这些验证。

**三端均已显式release给Root**：Web中文Today1440×968DPR2、空note/config草稿且focus emulation reset；Mac中文Home1140×808DPR2、note已Save后为空、配置未改、导入Cancel、采集停止；Android英文Home420dpi无override/font1、空草稿/无未保存配置、Collection paused/not started。reviewer没有结束Root-owned进程；Root随后已精确清理Web/Mac与专用AVD开发生成profile，保留AVD继续下一轮。用户尚未选择候选。


## 候选 3 · 边界与分隔


本轮的操作描边、轻容器外框与浅组内分隔开始形成稳定关系。Mac 同组图标和真实原任务路径更连续；Android 原生对话框按钮被真实布局裁切的问题已在本轮修复。**三端仍有色彩、顶栏和阅读层级的断裂；用户尚未选择候选。**

聚合候选 `f628484e02b5c6975a896e35de247c5162afd725`。Web/Mac实际producer为 `f63f2a23c3ee7128a22caf39c51990a1e807d585`，Android实际producer为聚合提交。两个提交的改动仅为Android NativeUi和GeneratedWindowRendering；父评审实际逐项重核Mac1235、Web1281个声明生产输入Git blob全部相同。原manifest/PNG/构建来源不改写；失败f63 Android图未用于正式候选评分，没有借用前轮图。

### 八项分数

固定七项依次为设计质量、原创性、工艺、功能性、第一眼清晰与完整、页面职责与聚焦、端内一致性与平台适配。联合项单独直接判断，无总分、权重或平台平均。

| 平台 | 设计 | 原创 | 工艺 | 功能 | 第一眼 | 职责/聚焦 | 端内/平台 | 跨端统一美术风格 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Web | 7.5 | 6.5 | 7 | 8 | 7.5 | 7.5 | 7.5 | 7.5（联合项） |
| Mac | 7.5 | 6.5 | 8 | 8 | 7.5 | 8 | 8 | 7.5（联合项） |
| Android | 7.5 | 6.5 | 7 | 8.5 | 8 | 8 | 7.5 | 7.5（联合项） |

联合项7.5来自本轮具体角色连续性的改善，不是按轮次涨分。父评审亲自合看48张同轮英文共同角色图（8场景×常规/窄屏×三端），并细看重点全图。操作/容器/分隔层级已更清楚，Android完整原生对话框顶边与Mac菜单语法解决已观察缺口；Web非状态绿色、正文前重复支架、Android嵌入Ask顶栏仍使其低于8.5努力目标。详见 `joint-independent-review.md` / `joint-visual/index.json`。

### 实际验证范围

| 平台 | 实际评审者 | 本轮范围 |
| --- | --- | --- |
| Web | `/root/preview_r3/web_evaluator` | 四条件32core核hash/尺寸/ready并审图；唯一生成note实际保存/精确三行原文/Close同card焦点；纯Settings；Ask→Provider→真正模块消费者→③返回Ask，中央badge实际Settings/BrowserBack；中文390设置。 |
| Mac | `/root/preview_r3` | 四条件32core核验审图；唯一两行note实际Save/同记录精确原文/Close同opener焦点；纯Settings；Ask→Connection→真实breadcrumb/BackAsk；directSettings→Connection→BackSettings。 |
| Android | `/root/preview_r3/android_evaluator` | 四条件32core审图、86PNG核验；独立重算24同APK原生按钮完整几何及180有效顶边像素；正常IME实际保存/Content和Home精确原文/Close→对应列表→真实headerBack；纯Settings；Ask配置脏草稿Keep保留/Discard回Ask。 |

每个平台的原始记录使用真实owner副本handoff；父评审没有冒充Web/Android的实际操作者。完整平台理由、错误诊断、报告SHA和操作记录见 `scores.json` 及各平台 independent report。

Android生产方的24完整layout/global-visible bounds及顶部RGBA样本证明四条件本轮裁切修复；子评审独立解码canonical PNG并核像素，与实时XML reader/dirty对话框按钮142px高度分别记录。实时XML只证明可见范围，不能代替当时完整View或像素；没有采集系统IME像素、没有adb screencap。几何hardgate/像素算法未因修复而改变。

无本轮所验主旅程阻断。错误评审gate/locator完整保留且不作产品失败或完成截图：Web4错误gate+1移动locator，15模块过渡旧Provider壳排除，22真实模块consumer补证；Mac6错误gate+2before-only locator，由06b/08b/09c/13b/15b实际consumer补证；Android5错误就绪假设及正确后续UI-tree/selected状态明确区分。没有把错误gate或过渡PNG包装成完成证明。

### R4的具体反馈

1. Web Ask/Import的非状态绿色、reader遮罩和少量指示归入共同角色；Mac推荐标签也审视共同辅助角色。错误/成功等真实状态色保持语义。
2. 原文/来源/时间优先；Web reader重复类型和前置处理/Memory动作应压缩层级，实际处理/提取边界仍清楚。Android内容/近期行重复类型可去重。
3. Android原生与嵌入Ask的同职责顶栏动作颜色和边界统一；compact English的Add/Settings挤压Quick notes、屏幕范围标题，Ask顶栏下有大空带。
4. 三端窄屏说明与配置页头仍偏重；重要范围、发送目的地、离线/隐私/保留后果直接可见。完整帮助持续具名可达。R5再校准Mac类型badge换行、Android英文单数和菜单图标区分。

KEEP：真实内容/来源/时间、功能目的地、原任务返回、保存和处理边界、完整选项与完整帮助；不引入处理/保留/发送政策。没有用不同轮的图或纯token相同推出用户接受。

### 未验证和释放

这是中间轮的核心与受影响变化复核，未独立重演R1/R2全部生命周期、语言重启、全部指南和完整错误/高级配置状态。Web/Mac独立键盘/IME、true200%缩放未重验；Android本轮独立compact IME与全部下拉展开未重验，四条件实际矩阵审图和生产方脚本验证另外声明。制作方自动旅程不能冒充独立实操。没有实机、真实个人采集/账号/传输/模型、真人审美/首次理解实验或完整无障碍认证。

**三端已显式release给Root**：Web中文Home1440×968DPR2并clear metrics，Mac中文Home1140×808DPR2，Android英文Home420dpi/font1；空note草稿、配置未改或真实Discard、采集停止/未开始。评审没有杀Root-owned进程或清空profile，Root负责随后精确清理。用户尚未选择候选。


## 候选 4 · 视觉重点


第四轮的蓝色动作、冷中性色和原文优先层级更连续，Android 窄屏顶栏的标题与动作已分行完整显示。**仍有英文窄屏密度、少量辅助绿色、badge 换行与图标区分缺口；用户尚未选择候选。**

聚合候选 `b47938b44da5ccedeac9d7376c48acbb264b96a2`。实际 Web producer 为聚合提交；Mac 为 `ad503028863294217b02c799f987d1f5f60027db`，Android 为 `5bf1fbf944abaca4a1fa671a193b99606a77db99`。差异只有公共 UI fixture 脚本的真实帮助、原文顺序与键盘焦点前提断言；父评审逐项重核 Mac1235、Android1349 个声明生产输入 Git blob 全部相同。没有改写原 manifest / PNG / 构建身份，没有借用前轮图片；失败 fixture 尝试不用于正式候选评分。

### 八项分数

固定七项依次为设计质量、原创性、工艺、功能性、第一眼清晰与完整、页面职责与聚焦、端内一致性与平台适配。联合项直接判断，没有总分、权重或平台平均。

| 平台 | 设计 | 原创 | 工艺 | 功能 | 第一眼 | 职责/聚焦 | 端内/平台 | 跨端统一美术风格 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Web | 8 | 6.5 | 7.5 | 8 | 7.5 | 8 | 7.5 | 8（联合项） |
| Mac | 8 | 6.5 | 8 | 8 | 8 | 8 | 8 | 8（联合项） |
| Android | 8 | 6.5 | 7.5 | 8.5 | 8 | 8 | 8 | 8（联合项） |

联合项8来自父评审亲自核验合看的48张同轮英文共同角色图：8场景 × 常规/窄屏 × 三端，并细看重点完整图。蓝动作、中性辅助角色、规则边界及原文/来源/时间的阅读关系更连续；平台导航与系统字体差异有职责依据。仍未到9分锚点：Web残余辅助绿和窄屏说明、Mac badge 换行、Android英文数词与复用菜单图标尚有缺口。详见 `joint-independent-review.md` / `joint-visual/index.json`。这不是用户接受或真人首次理解研究。

### 实际验证范围

| 平台 | 实际评审者 | 本轮范围 |
| --- | --- | --- |
| Web | `/root/preview_r4/web_evaluator` | 四条件32core独立核hash/尺寸/consumer并审图；唯一三行生成note真实Save、逐字原文、常规及390再次Close同card焦点；具名完整processinghelp展开/折回、原文在help/Memory前；纯Settings；Ask→Provider→真实模块分配consumer→返回Ask及纯设置无虚构原任务。 |
| Mac | `/root/preview_r4` | 四条件32core核验审图；唯一双空格/换行note真实Save、同key精确原文/source/time、Close同Home opener焦点；真实四阶段帮助展开/折回、metadata展开；纯Settings；Ask与直接Settings进入Connection分别真实返回原页面。 |
| Android | `/root/preview_r4/android_evaluator` | 86PNG/32core及实际APK独立核验；24严格dialog完整几何及180canonical顶边像素独立核验；实际IME唯一note保存、精确原文/Close→相应列表→真实headerBack；Settings/Ask脏配置Keep/Discard返回；正常英文真实展开sync queue/policy/receipt/speed/targets；compact header和空status/scope适配来自canonical、producer断言与source，未冒充独立实时全矩阵。 |

每个平台实际owner写入fresh handoff副本和raw记录，父评审没有冒充子评审操作。各平台分数理由、报告SHA、原始操作和完整性证据在 `scores.json` 及独立平台报告。

错误评审gate与过渡诊断完整保留并排除completed证据：Web27后置records中21正确ready、6错误gate；Mac22中19正确ready、3错误gate；Android26中19明确ready、3错误gate、4无explicit gate诊断。失败的consumer预期分别经观察的实际消费者补证，未设gate的诊断不作为completed页面证明，失败gate没有完成页PNG，不作为产品失败或完成证明。制作方脚本旅程另行声明，不能冒充以上独立实操。

### R5的具体反馈

1. Web实际辅助角色 `.icon-button` 颜色 `rgb(139,145,135)`、`.language-selector select` 描边 `rgb(220,227,221)`、`.node-button` 上边线 `rgb(219,227,216)`；按角色校准，不覆盖真实success/error。英文390编辑页的tool/page节距及常驻附件说明偏重，既有文件/不能现场录音/归档顺序/50MiB限制继续直接可知，完整教学具名可达。
2. Mac窄屏Quick notes及中文类型badge、Saved locally状态badge换行拥挤；调整自然宽度与节距，保留真实内容/状态，不缩小原文字号或隐藏状态。设置菜单图标可再区分。
3. Android固定key `本机保留 · {0} 条资料` 英文当前为 `On this device · {0} records`，单条可改为 `On this device · Records: {0}`；不翻译采集的原始app/device值。菜单复用glyph、长说明节奏仍可细化。

KEEP：真实来源/时间/原文、完整政策/范围/发送后果、实际状态、具名完整帮助、草稿/原任务返回。CHANGE只包括辅助角色、自然换行、图标区分和节奏；不新增处理/保留/发送政策或产品默认。R5最后一轮重验键盘/缩放/高风险生命周期与限制。

### 未验证和释放

本轮是中间轮核心与变化复核，未独立重演全部未改生命周期、语言重启、全部指南、全部高级/慢加载/错误/运行状态。Web新真实UI note未携带非空windowTitle，非空窗口标题本轮只核源码条件行与已有canonical静态范围，不声称独立manual positive；来源/时间/索引/隐私及原文顺序实际已验。Web/Mac独立键盘/IME/true200%本轮未重验；Android系统IME像素未采，只用自己的真实窗口PNG与实际输入/UI-tree分别说明。没有实机、真实个人采集/账号/传输/模型、真人审美/首次理解实验或完整无障碍认证。

**三端已显式release给Root**：Mac中文Home实际滚回顶部1140×808DPR2；Android英文Home顶端selected=true、实际density420/font1.0，sync已折回、脏配置真实Discard、note保存后空、采集未开始；Web中文Home且草稿空/配置未改，27已clear device metrics但同一步末snapshot仍390×812DPR2，异步恢复正常尺寸未fresh验证，早先normal恢复声明明确撤回。Root决定接管后精确关闭本轮Web/Mac及清除生成profile/ownDev状态，不额外补normal尺寸实操。评审未杀Root-owned fixture或AVD。


## 候选 5 · 细节与节奏


第五轮的菜单图标、完整状态标签、原文阅读和附件限制更清楚。三端共同视觉语法已成立，仍有窄屏长说明、编辑区高度和少量辅助色/动作强调差异。**联合项为8，未强求8.5；用户未选择候选。**

最终聚合源码 `68fe663476f1b37fa0aceb7d051969c23659ec45`。Web/Mac实际producer为同轮 `7afc4b97cd8bc27a410370359091975439a48b45`，详细操作在当时聚合 `0110434eb5eee05e43040911c5f8eaa6a1978420` 下完成，原记录未改写。Android修复后实际producer为最终源码，采用全部新manifest/PNG/APK。父评审在最终handoff后亲自重核Web1282、Mac1235个声明的生产/共同输入Git blob全部相同，保留同轮已完成构建与操作；没有借用其他轮图片或冒称重新构建。

### 八项分数

固定七项依次为设计质量、原创性、工艺、功能性、第一眼清晰与完整、页面职责与聚焦、端内一致性与平台适配。第八共同项直接判断，无总分、权重或平台平均。

| 平台 | 设计 | 原创 | 工艺 | 功能 | 第一眼 | 职责/聚焦 | 端内/平台 | 跨端统一美术风格 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Web | 8 | 6.5 | 8 | 8.5 | 8 | 8.5 | 8 | 8（联合项） |
| Mac | 8 | 6.5 | 8.5 | 8.5 | 8 | 8.5 | 8.5 | 8（联合项） |
| Android | 7.5 | 6.5 | 7.5 | 8.5 | 7.5 | 8.5 | 8 | 8（联合项） |

父评审重新核验并合看48张最终英文共同角色图（8场景 × 两条件 × 三端），再细看关键完整图；Android全为68fe新canonical，011旧attempt不计最终共同项。冷灰/白/蓝、系统字体、边界、浅分隔、线性图标及原文/来源/时间关系连续。仍有Web模型辅助暖绿与多层compact导航、Mac固定设置页脚/长配置、Android大字体长说明；桌面填蓝/native描边Add的强调不同。详见joint-independent-review.md。分数是模型判断，不是真人首次理解或用户接受。

### 实际验证

三端各自独立核32core中英四条件hash/bitmap/consumer并审图。完整理由、原动作、来源身份与报告SHA见scores.json及三个独立平台报告。

- Web子评审实际验证三份逐字原文、草稿导航/reload/保存清空、完整帮助及同opener焦点、纯Settings、配置Keep/Discard、Ask→Provider→实际module consumer→原任务返回、直接Settings返回，以及英文390真实Tab/Enter Save。真正浏览器200%为1440×968/DPR2→Root私有fixture zoom2→fresh720×484/DPR4→实际保存/原文/帮助/Escape/设置/Ask返回→reset1→fresh1440×968/DPR2；没有以CSS或窄屏替代。
- 父评审Mac实际验证混合双空格/空行/emoji原文、renderer reload草稿，两语言820窄窗Tab/Enter Save及readerClose/同Home key焦点，全框加6px完整；四阶段帮助键盘展开/折回、metadata；纯Settings、脏Keep/Discard与Ask/直接Settings返回、真实语言reload、生成Import preview/Cancel、停止的Recordscreen→Privacy范围未Start。
- Android子评审最终独立核新86PNG/32core、两APK、24严格dialog完整几何及180实际顶边像素；新note真实输入/Save清空/精确两行原文与来源时间，Closed常规→compact→常规始终list无dialog，Open同两变换恢复同原文，Close/headerBack→Content→Home。共19新observations（17gated完成、2diagnostic）与4实际config。

Android先前011的draft、纯Settings、连接Keep/Discard/任务返回、两compact实际IME/Save/原文、同步事实保留真实旧source范围；独立Gitblob证明Main/Connection/NativeUi/catalog/shared未变，不冒称68fe重新操作。生产方最终12matrix/16返回/8新reader状态/24几何/313JVM及15pass2skip另列，不能冒充独立实操。

### 确认失败与边界

Android在011实际Close后，配置变化触发重建又误开同原文；旧source/build/APK、失效trace/原图冻结，分数暂为null等待修复。68fe仅在dialog实际显示时保存ID/remote标记；Close/Cancel后null，fresh create只消费初始intent。新增8个durable状态回归，并经上述真实闭/开双向配置补验：关闭保持列表、正在读则精确恢复。远程沿用既有授权、不存正文/client/token、不回落本机，是源码与生成回归证据，未操作真实中央账号。

Web73post/63原ready/60可用完成记录/40有效PNG，6false、4null、2before-only与3过渡/过宽PNG保留排除；Mac53post/47原ready/45可用完成记录及PNG，6false、2空snapshot/保存过渡排除并fresh补证。错误gate/过渡不冒产品失败或完成图。最终Android0failedgate；旧011的69observations不计新producer完成数。

没有个人屏幕/真实资料、实机、真实账号/采集/模型/发送、真人研究或完整无障碍认证。Web超限上传/长文件名/非空windowTitle未手动制造；Mac只有renderer/语言reload，无完整主进程重启，picker/权限来自生成stub；Android真实中文IME composition、remote关闭/取消/错误恢复未独立运行。FLAG_SECURE保留，只应用自身窗口绘图，未采系统IME像素；CDPfocus只exact隐藏生成target，不称物理键盘/原生OS focus。

### 释放

三端显式release Root：Web中文Home1440×968/DPR2/zoom1、metricsclear、草稿/配置清楚；Mac英文Home1140×808/DPR2（normal metrics恢复→clear→fresh）、focus emulation关、草稿空/配置Discard复核/importCancel；Android英文Home顶端420/font1、sync折回、note空、无reader/IME/dirty、未capture/sending。Root精确清理ownedfixture/profile/ownDev/专用AVD，评审未kill/clear。最新源码对应第五轮，五个候选均保留供用户选择，剩余gap不抬分或增加第六轮。
