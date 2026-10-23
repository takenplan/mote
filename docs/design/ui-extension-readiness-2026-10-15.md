# 全局 UI 重构：已选方向与插件化前置审计

日期：2026-10-15。事实基线：`9798e01cdce3b9ca26b9a86e6071186d8859c402`。

本记录承接所有者的新问题：在三端默认 UI 重构前，检查能否通过插件更换布局和样式。以下区分已选产品方向、当前代码事实和建议改造；没有实施生产 UI、插件加载或默认值变更，也不表示原生或运行时切换已经验收。

## 已选方向

- 结构采用[「梳理 Mote 全局 UI 重构方案」](codex://threads/01a13e48-d59c-7a72-93ef-5efc38518855)的推荐 A：资料库／问一问／来源／活动；原生阅读目的地可沿用“内容”。今天／首页降为辅助入口，设置与全部功能保留；无恢复页面或明确深链时默认进入资料。能力、权限、数据与处理政策保持既有约束。
- 视觉采用[「创建 Mote Design Lab」](codex://threads/01a13e58-a115-7731-b3fb-43e86bf271b1)的 A · Linear：暖石墨暗色、低饱和紫强调、暖白主操作、紧凑桌面控件、弱化外框。不是继续使用旧冷灰蓝色第五轮外观；结构原型原先沿用第五轮视觉的约束被本次选择替代。
- Web、Mac 与 Android 都在后续重构范围。跨端共享职责、视觉角色与扩展合同，各端保留系统交互；桌面紧凑尺寸不能直接变成 Android 触控尺寸。

原方案、原型与候选 Token 当前位于另外两个对话的工作树，并未纳入本工作树。后续迁移须核对并收录所用版本，不能把它们误称为当前生产实现。结构方案的首条真实产品旅程、逐批迁移、独立复核及状态／草稿／返回验收要求继续有效；本次没有合并或发布授权。

## 当前能做什么

结论：**已有局部展示扩展和编译期视觉基础，尚无三端通用的整体 UI 替换接口。**

| 层面 | 已有锚点与证据 | 当前边界 |
| --- | --- | --- |
| 共享视觉 | [Token JSON](../../packages/shared/design-tokens.json)、[生成器](../../scripts/generate-design-tokens.mjs) | 构建期生成 Web／Mac CSS 和 Android Kotlin／XML；没有运行时主题包、活动绑定和切换事务。Android 生成器只提取十六进制颜色与整数 px 值，不能完整表达候选的字重、行高、字体及平台单位。 |
| Web 局部展示 | [WebFeatureHost](../../apps/web/src/features/host.ts)、[贡献类型](../../apps/web/src/features/types.ts) | 已有 page、collection、home、card、renderer、panel、action，支持依赖和撤销。可部署可信 React 贡献，不能据此认定总外壳可替换。 |
| Web 路由与外壳 | [navigation](../../apps/web/src/navigation.ts)、[main](../../apps/web/src/main.tsx) | 页面 route／alias／section／order 有注册锚点，但一级导航数组、sidebar、topbar 和外壳仍在 main 中直接构造；没有 theme／shell／layout surface。 |
| 注册与选择 | [FeatureRegistry](../../packages/shared/src/feature-packs.ts) | 已有版本、依赖、订阅与卸载；重复 ID 被拒绝。添加第二个实现不等于替换第一个，缺少“可选实现集合 + 单一活动绑定”。 |
| Mac 本机窗口 | [index](../../apps/desktop/src/index.html)、[ui](../../apps/desktop/src/ui.ts)、[preload](../../apps/desktop/src/preload.ts) | 固定 DOM ID、事件和导航相互耦合。typed IPC 是可复用平台边界，不是布局插件接口。中央窗口加载 Web，只有该表面继承 Web 的扩展能力，见 [central-window](../../apps/desktop/src/central-window.ts)。 |
| Android | [MoteUi](../../apps/android/app/src/main/java/dev/mote/collector/NativeUi.kt)、[MainActivity](../../apps/android/app/src/main/java/dev/mote/collector/MainActivity.kt)、[CentralContent](../../apps/android/app/src/main/java/dev/mote/collector/CentralContent.kt) | 有原生组件封装和共享 token，但颜色／尺寸缓存与布局直接写在 Kotlin 中；尚无可选择的全局 renderer/provider。系统主题仍固定浅色，见 [资源主题](../../apps/android/app/src/main/res/values/strings.xml)。 |
| Android 类型扩展 | [CentralCatalogDescriptor](../../apps/android/app/src/main/java/dev/mote/collector/CentralCatalogDescriptor.kt) | 仅无代码资料类型描述与原生通用正文，不是页面模板或主题引擎。 |
| 已安装插件 | [release schema](../../apps/server/src/plugin-release.ts)、[插件中心](../plugin-center.md) | 当前通用包合同是 worker + repository／retrieval／engine，不支持 UI 主题或布局包。现有固定制品校验不能直接当作前端加载器。 |
| `adapters/ui` | [builtin](../../adapters/ui/builtin.json)、[UI 页面采集](../ui-page-capture.md) | 这是读取其他应用页面的采集规则，不是 Mote 外观插件。 |

现有 [Feature packs](../feature-packs.md) 和[资料库扩展合同](../library-plugin-contracts.md)继续适用。它们采用可信部署组合；原生采集需要原生构建。Web 贡献拿到带写能力的 `Api`，Mac renderer 的 `window.mote` 也包含采集、配置与文件操作，不能声称当前已隔离不可信 UI 代码。

## 建议的边界

把视觉主题与布局实现分开选择，使更换颜色与密度不要求替换页面，也使侧栏／主从分栏等结构变化不要求复制业务逻辑。默认实现也走同一套接口。

1. **主题包（ThemePack）。** 以版本化、可校验的语义角色描述颜色、排版、表面、间距和密度；允许平台映射。Web／Mac 读取 CSS 变量，Android 读取主题快照并正确转换 dp／sp，处理系统栏、对话框、字体缩放和触控。数据包不夹带脚本、任意 CSS 或远程资源地址。候选的完整 JSON 与组件语法共同决定效果，不能只覆盖几个颜色。
2. **布局合同（LayoutProfile + 平台 renderer）。** 先抽总外壳、导航、工具栏、列表／详情、设置分组及状态区等少量稳定插槽。声明式 profile 选择宿主支持的布局、区域和已注册页面 ID；三端使用自己的 renderer。主题不决定数据源；布局不新建路由权威或通过内容猜页面。完全新布局的代码实现由可信部署提供，不承诺任意 JSON 都能变成任意界面。
3. **状态与业务边界。** 身份、路由／深链、资料身份与版本、筛选／分页、草稿、选中、滚动／焦点／返回点由宿主或领域 controller 持有；renderer 消费明确的 view model 和命令。权限、原生选择器、采集、发送、处理与索引状态、保留、收费授权继续归现有服务。主题或布局切换不能重新启动这些工作，也不能把未知状态改成完成。
4. **选择与生命周期。** 复用现有注册器的身份、精确版本、依赖与 dispose 机制，增加显式的单一活动主题／布局绑定。先校验再应用，失败保留当前可用实现并呈现原因；注册、安装、预览、应用分开。切换前后保护草稿和导航，不把安装顺序当优先级，不把全局 remount 当无损切换。宿主管理共享订阅和轮询，展示实例有明确的 mount／update／dispose，旧实例的异步响应不能继续回写或重复发起命令；换身份时清除旧身份的私有视图。

主题与布局绑定按什么范围保存（本机、节点或账号），以及是否跨端同步，属于后续需要明确的产品选择，本审计没有新增偏好或同步默认值。建议先证明随包内置实现可替换，再讨论面向用户的下载／安装入口。

## 可实现的替换程度

| 目标 | 完成上述改造后的路径 | 构建要求 |
| --- | --- | --- |
| 换颜色、字体角色、圆角、间距、密度 | 三端消费同一主题合同及平台映射 | 支持的主题数据可运行时应用；当前尚未实现。 |
| 换已有布局组合、分栏、工具栏和导航呈现 | profile 选择已部署 renderer；页面身份和能力仍由宿主维护 | 已实现并兼容的变体可切换；新的原生结构先增加平台 renderer。 |
| 换特定资料卡、详情、面板或页面 | Web 沿现有贡献扩展；Mac／Android 增加对应原生展示锚点 | 新代码随可信版本分发；Android 需要相应原生构建。 |
| 安装任意第三方包，立即任意重画三端 | 另一个运行时和信任边界项目，当前机制不支持 | 需要另行定义隔离、兼容、分发与平台约束；不能作为此次重构的隐含承诺。 |

不建议为了“统一插件”把 Android 改成 WebView，或在第一阶段建设全新插件市场、通用 UI DSL 与任意代码沙箱。现有可信随包组合足以先验证可替换性，且能保留原生生命周期。

## 实施顺序与完成门槛

| 工作包 | 内容 | 完成证据 |
| --- | --- | --- |
| U0 | 收录选定结构及 Linear 规范；做全页面、路由、能力与旧约束迁移账本 | 明确取代项、每项能力去向和精确资料／来源／活动身份关联缺口。 |
| U1 | 类型化主题、平台映射、外壳插槽、活动绑定和状态边界 | 默认包和一个最小测试替代包用相同合同注册；替代包不需要额外完整视觉竞赛。 |
| U2 | Web 标准列表／详情和真实产品旅程 | 隔离中央、生成文件从实际导入入口到正式资料、证据／引用、来源和原位置返回；核对未知、失败、未索引和需确认状态。 |
| U3 | Mac 本机窗口与 Android 各一个原生试点 | 本机内容、离线／同步、中央状态与返回；主题和布局变更后草稿、选择、滚动与任务状态保持；Android 重建／恢复、系统栏及对话框一致。 |
| U4 | 将选定默认 UI 包推广到各页面，移除被替代的覆盖与重复展示 | 功能清单完整、旧深链可达、英文同步；核对对比度、键盘／焦点、大字体、长文本与窄屏；独立复核并修复，运行受影响组件与消费者检查。 |

执行采用原结构方案的“标准页面与首条真实旅程先行”，不先批量改 CSS 再追加插件壳。换包验收必须包含未保存设置、问答输入、证据打开、分页、断线／重连、插件不兼容／撤销和 Android 生命周期；卸载展示不得停止后台工作或删除数据。资料与活动关系只能用稳定 ID／回执，不能按标题或关键词补齐。

## Supersession 检查

| 分类 | 处理 |
| --- | --- |
| KEEP | 唯一数据／执行／授权权威；只读 QueryAgent；可信部署与现有依赖校验；原生权限和生命周期；生成 fixture；真实状态、草稿与返回；全部现有能力。 |
| CHANGE | 所有者已选主导航、首次着陆和视觉基础；把编译期 token 升级为主题合同、将固定外壳拆出可替换边界仍为本审计建议。 |
| REMOVE | 实施时移除旧导航归属断言、无角色的重复样式和 UI 内业务副本；不删除历史设计证据、领域 API 或任务。 |
| EXCEPTION | 平台字体、系统对话框、选择器、触控、IME 和返回保持平台适配；新增原生 renderer 仍需构建；当前可信 UI 贡献不等于不可信插件沙箱。 |
| UNKNOWN | 运行时切换后的全部状态／辅助技术表现；主题偏好保存和跨端同步范围；未来远程 UI 包分发；真人与真机体验、真实模型质量。 |

实施时核对 [行动优先 ADR](../adr-client-action-first.md)、[客户端导航](../client-navigation.md)、[Slate](../ui-slate.md)、[落地范围](ui-rollout-2026-10-14.md)、三端路由／菜单、组件和生成器、配置、后台工作、测试、运行时提示与 agent 指令；导航和视觉旧决定不得继续约束新默认方案。架构正式采用时另写 ADR，保留本记录作为采用前的审计。

## 本次实际验证

读取了两个对话的用户要求、交付结论和本地方案／Token；分别检查 Web／Mac、Android、插件注册／分发合同，并交叉核对关键结论。此次仅新增本文，完成 Markdown 格式与相对文件链接核对；未运行应用构建或测试，未切换生产主题，未采集个人截图，未做原生 UI、真机或真实模型验收。
