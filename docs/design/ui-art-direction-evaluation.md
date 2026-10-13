# 五轮共同美术风格：独立评价记录

本文件逐轮记录实际构建、操作、八项判断与取舍。五个方案均供用户选择，独立模型评价不是用户接受。

# 五轮美术方向迭代：独立评估初审与固定合同

评估者：preview_audit。日期：2026-10-13。本文件不修改产品或预览生成器。

用户已明确推翻上一轮的审美接受。F2 / D3 / R10 的历史独立操作与当时分数保留，但**8.5 不作为本轮起点或已获用户认可的证明**。此次没有正在运行的隔离 fixture，初审重新目视实际冻结 PNG。基线 Functionality 使用同一冻结版本此前独立实际操作的 trace，再结合本次动作可识别性重判，明确本次没有重跑；不会把此前通过带到任何新候选。五轮均须有真实三端候选、独立反馈和逐项分数，即使中途分数达标也不把其余轮次省略或倒填为同一批图。

## 网上调研与采用边界

- Apple HIG 把重要性、对齐、分组与渐进呈现联系起来：空白、容器、分隔线都能表达关系；过多内容和选择会妨碍理解。这支持压缩重复说明、整理层级，而不是统一加卡片或隐藏功能。[Layout](https://developer.apple.com/design/human-interface-guidelines/layout?changes=lat_3__1_2)
- Apple 字体指南强调用字号、字重和颜色表达层级，并在字体放大时维持相对关系。系统字体可不同，但内容/标题/辅助说明的角色应清楚。[Typography](https://developer.apple.com/cn/design/human-interface-guidelines/typography)
- Android 指南把隐式留白与显式分隔都视为 containment；相关内容应组合、无关内容应分开，网格和边距要适应尺寸。[Content composition and structure](https://developer.android.com/design/ui/mobile/guides/layout-and-content/content-structure)
- Material 将 surface、primary/secondary、error 等语义颜色角色与 token 连接，使设计与实现共享规则；这能作为三端角色统一的基础。[Color roles](https://m3.material.io/styles/color/the-color-system)、[Foundations](https://m3.material.io/foundations/)
- Carbon 区分按钮强调级别，要求相同 variant 稳定表达相同角色，按钮文字清楚且长文字应合理换行；说明主张层级，不意味着每个链接都必须有矩形边框。[Button](https://www.carbondesignsystem.com/building-blocks/core/components/button/guidelines)
- Carbon 区分任务型与表现型字体，帮助避免把设置/表单做成营销段落。[Typography](https://www.carbondesignsystem.com/building-blocks/foundations/typography/overview)

这些是设计参考，不是 Mote 产品政策。不会照搬 Carbon 的单主按钮规则来删除 native 四个平等保存动作，不强制新依赖/框架、同一字体文件、相同像素布局或 Liquid Glass。三端真实功能与交互习惯可不同；同一角色的美术语言需要能解释为同一个产品。

## 当前截图的具体问题

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

## 初审重新评级（视觉范围）

本轮不继承历史8.5。基线 Functionality 有此前同版本保存/返回的独立实操依据，同时对当前可理解性与使用摩擦重新判断；这里没有新执行任何fixture，更不代表R1功能验收。候选每轮需fresh实操。

| 当前冻结参照 | Design | Originality | Craft | Functionality* | Firstlook | Page focus | Platform consistency | Cross-platform joint |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Web F2 | 6.5 | 6.5 | 5.5 | 7.5 | 6.5 | 7 | 6.5 | 4 |
| Mac D3 | 6.5 | 7 | 6 | 7.5 | 6.5 | 7.5 | 6.5 | 4 |
| Android R10 | 5.5 | 5.5 | 4.5 | 7 | 5.5 | 7 | 5.5 | 4 |

*Functionality7–7.5表示同版本主要实操路径确实能完成，但创建label裁切、设置入口说明堆叠、原文/日期列表额外扫读与滚动摩擦仍影响可理解性；不是给未重跑版本8.5保底。

新的三端共同美术风格初评 **4/10**：有共同蓝灰基础，但角色、字形/密度、形状与品牌表现分裂。该分是三端合看结果，不是三端平均分。

## 第八项建议：跨端统一美术风格

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

## 五轮固定审查清单

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

## 每轮最低真实操作

评估者单独接手known generated后台fixture，生成者停止驱动；三端全部完成后算该轮反馈，不由截图脚本自己打分。

| 平台 | 每轮R1–R5都必须本人实操 | R1/R5详细验证，以及相关变更后补验 |
| --- | --- | --- |
| Web | readyHome观察→new unique note→Save→同条可见→exact source→Close/返回；Settings实际进入确认职责；真实Ask配置CTA→Provider/module→原Ask，directSettings无伪造origin；窄屏至少focus/触发一个主要动作确认label与边界。 | note→Settings→BrowserBack草稿保留；Provider草稿取消/Reset；实际slow/error/signedout状态与200%高风险动作。 |
| Mac | readyHome观察→空note→unique Save→Home同条→exact reader→Close同opener/原父页；Settings→Connection确认职责；820×620focus/滚动触发主要动作。 | 四保存入口和真实生成file确认预览/Cancel；Privacy、测试设置draft→Revert/取消；语言reload、草稿/状态生命周期。 |
| Android | freshUI-tree真实坐标→真实IME输入unique note→Save→Home同条→exact reader→Close匹配records→实际headerBack原父页；Settings/Connection确认职责；320dp130%至少实际IME/scroll/Save或Close；Home Start/Sync入口仍可达但不触发真实采集。 | note日期昨天empty→今天同条；Settings展开维护；连接draft→Keep editing/Discard/reopen；note草稿往返和一次配置重建。 |

五轮每次unique记录带round编号，不沿用上一轮截图。功能catalog/source/import/screen关键族可由每轮现有真实fixture自动旅程覆盖，评估者R1/R5至少实际打开目录及一个file/scope预览，R2–R4至少打开一项新增或主要修改的功能入口；区分本人实操与生成者脚本，不要求外部账号/实机/模型。新增用户发现缺陷加入持久回归。

## 每轮最低截图与状态矩阵

保持固定同类生成内容和稳定文件名。四条件为ZH/EN × normal/compact：Web1440×968/390×812，Mac1140×840/820×620，Android411dp@420dpi-font1/320dp@540dpi-font1.3（实际PNG1080×2400）。首屏单独记录；为检查下方内容另外保存scroll状态，不能用scroll状态伪称首屏。

| 范围 | 四条件必有的实际ready图 |
| --- | --- |
| 三端共同角色 | Home真实empty、Home populated、Content/list、note editor、exact original reader带真实parent、Ask已连接或明确未连接限制、Settings、Connection/模型连接。 |
| Web重要职责 | Import、Models/Provider/Module、Storage/Privacy、Guide完整目录、Memory/Insights、Activity/processing与设备/来源入口；维持已有功能目录覆盖，不能仅交首页。 |
| Mac重要职责 | Add四动作、生成file import确认、screen scope预览、自动来源/状态、隐私设置、guide实际可用或离线限制；不能把connection限制图冒称打开中央目录。 |
| Android重要职责 | Add四动作、import local task、screen scope、sources、Home collection与sync details、note return/empty日期列表、guide支持功能/连接限制。 |

额外高风险图：Web signed-out Settings/实际503维护失败/900ms慢请求后loaded Notes；Provider长label与Settings在320px及200%zoom；Android两个compact真实IME布局；三端至少一张mixed source/长文本阅读与长名称。每轮不必捏造live-model回答来补状态，有真实限制即清楚说明。

PNG可解码和hash一致不构成ready。必须目标页、loaded/empty/restriction/error consumer标记明确且排除pending/suspense，错误/loading若保留按该状态单独命名。Android用app-owned完整window和实际dialog几何/parent证据；不使用adb screencap，不移除FLAG_SECURE；IME应用布局图明确不包含系统键盘像素。base/overlay secure范围分别写，不能说所有叠层secure。

## 每轮交付字段

候选R1…R5各有冻结manifest/源码或APKhash、候选图、生成者变更假设、独立8项评分与具体缺陷、实际操作范围/未验范围、对上轮反馈的处理与下一轮决定。记录“保留/修正/转向”及证据，不用5个版本名包装一次生成。第5轮即使未达目标也如实报告差距，并把全部5个候选保留可看；未执行实机/live-model/真人理解不会被综合分隐去。

## Owner合同对齐

已读 docs/design/ui-art-direction-five-rounds.md。共同方向与token角色由owner确定，本初审不另设新产品导航/功能政策；第8项8.5按owner合同作为努力目标，仍不凑分。R1共同语法、R2密度、R3边界、R4重点、R5细节只作为演进主题；每轮八项均审，按实际反馈调整主题。详细生命周期首末轮执行，其他轮保留表中真实核心操作，不能只审缩略图。
