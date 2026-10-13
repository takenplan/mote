# Mote 三端离线 UI 评审

用户要求独立 HTML 用于用户决策。本目录保留可重复生成的模板、选择性截图清单和生成 / 验证工具，不改产品架构。实际交付目录为 `.mote/ui-review-2026-10-13/`（被 Git 忽略），入口是该目录的 `index.html`。不要直接打开本目录的 HTML 模板，它需要生成的 `manifest.js`。

## 使用交付文件

直接在浏览器打开交付目录的 `index.html`，无需后端、安装依赖、登录、系统权限或网络。平台、尺寸、语言、场景和旅程按钮只选择本地截图。点击图像打开可放大的 HTML 弹层，不打开系统对话框。三端的倾向和备注仅存当前浏览器的 localStorage；导出会产生本地文字文件，不提交给服务器。移动到另一文件夹或浏览器后，本地备注不保证自动迁移，请先导出。

移动评审时使用 `.mote/ui-review-2026-10-13.zip`，或复制整个交付目录；不能只复制 `index.html`。PNG 保留原图字节，`manifest.json` 提供来源标签、尺寸、验证状态和 SHA-256。候选缺少某语言、尺寸或视图时明确显示缺项；不会用其他场景、旧版本或中文图补成英文证据。评分来自独立评审，未评估项保留为未评估。本次三端均显示反馈前与当前构建，原五项保留，另列页面职责与任务聚焦、视觉一致性与平台适配；不合成总分。

截图包含的内容全部为生成 fixture。界面浏览不证明完整功能已执行；本页没有保存、上传、提问、后端状态变更或权限操作。物理设备、真实模型、外部账号和真实新用户理解不是本次静态预览的验证范围。

## 重新生成

在仓库根目录运行：

```sh
node docs/design/ui-review-2026-10-13/generate.cjs --frozen .mote/ui-feedback/feedback-baseline --refresh-platform web --refresh-platform mac --refresh-platform android
node_modules/.bin/electron docs/design/ui-review-2026-10-13/validate.cjs
```

`review-sources.json` 固定反馈前参照、当前 fixture 目录、明确的验证状态和七项分数。反馈前 Web / Mac D2 / Android R8 的原始字节与来源轮次保留，当前构建重新生成、重新独立评估。更新目录和分数必须先取得该轮实际 fixture 与独立评价证据。`generate.cjs` 只复制预先列出的 PNG，不复制原始 DOM、日志、凭据或运行配置；评分与验证记录使用本仓库 Markdown 文档的本地副本。它不会浏览设备或调用模型。

原始来源包含忽略目录和临时目录。仅克隆源码不会拥有这些历史图像，也不能凭空重建历史效果；缺少已固定的来源时应保留交付 ZIP，或明确重跑对应生成 fixture，并更新参照轮次与证据。新截图不会倒填为旧轮次已验证。

本轮反馈前参照从原交付保留了不同平台的既定轮次，必须显式提供冻结包；直接从旧 fixture 目录重新推测这一参照会被拒绝。保留反馈前冻结包，刷新候选使用上方命令；仅同步模板和报告可从同一当前交付的冻结副本生成。

历史临时目录已清理时，可以从保留的交付目录重新同步模板与报告。先完整复制并保留冻结目录，再明确指定它；生成器不会自动用旧图补充不存在的新证据：

```sh
node docs/design/ui-review-2026-10-13/generate.cjs --frozen .mote/ui-review-frozen-2026-10-13
```

冻结输入必须有原来的 `manifest.json` 和全部 PNG。生成器先校验每张图的 SHA-256、尺寸、场景标签和路径，再保留来源、轮次、已验证状态及缺项。未刷新平台的来源、候选名称和评分必须与冻结记录一致；冻结导入不代表重新执行原生或模型验证。新 manifest 记录输入 manifest 的 SHA-256。

需要换成新的当前构建时，先把该平台的实际生成来源、独立评估结果和候选名称写入 `review-sources.json`，再显式刷新：

```sh
node docs/design/ui-review-2026-10-13/generate.cjs --frozen .mote/ui-feedback/feedback-baseline --refresh-platform web --refresh-platform mac --refresh-platform android
```

也可只刷新一端。刷新平台的旧候选图全部移出当前清单，仅导入该平台明确指定的新来源；旧候选目录仍保留为历史。缺少的新构建场景继续显示缺证据，不携带旧构建的截图或验证状态。反馈前参照不会刷新。其 provenance 明确记录从原交付中的参照 / 候选哪个轮次保留下来，不能冒充第 5 轮同一构建。

Android 可通过 `candidate.androidVariantDirectories` 明确指定 `normal-zh`、`normal-en`、`compact-zh`、`compact-en` 在所选 root 内的目录。例如新四条件矩阵的中文常规目录为 `default`。`candidate.androidSceneManifest` 可指向该矩阵的生成图片清单，生成器核验其 PNG 哈希，并要求所选图片都在清单中。Mac 与 Web 场景清单提供的图像哈希同样核验，Mac 构建哈希保存在交付 manifest 中。Web 依照显式场景、语言、尺寸与选择字段导入，200% 浏览器缩放单列；同一标签的重复选择被拒绝。

当前截图必须记录目标页和已完成内容、真实空状态或明确限制的就绪证明；可解码 PNG、标题或 hash 已变化都不能替代。已发现的七张旧 Web 加载壳保留历史字节，但比较区明确排除并显示原因。旧 Android 详情和目录若为对话框片段，明确标注，不能按完整手机页面判断；当前 Android 使用应用自身完整窗口与实际弹窗父页。新轮次的浏览器备注采用独立存储键，不覆盖之前的评审意见。

交付中的报告正文保留历史评估与验证边界。本地文档链接改为固定白名单中的副本；报告插图仅在哈希匹配当前清单的已选择图片时复用。没有打包的源码引用明确显示为文字，不留下不能打开的离线链接。

验证使用新临时 userData 的隐藏 Electron 窗口（`show:false`），阻止所有外部请求。检查每个条件的全部静态场景、PNG 字节和损坏冻结输入拒绝、所有报告的本地图片与文档链接、缺项表达、HTML 弹层、键盘、本地备注和导出文字结构；不会点击触发系统下载对话框。验证截图与结果留在忽略的 `.mote/ui-review-validation/`，测试资料全部为生成文本。

需要重新打包时，在仓库根目录运行：

```sh
python3 docs/design/ui-review-2026-10-13/package.py
```

打包会检查所有报告本地引用都在 ZIP 白名单内，并复核压缩包中的每张 PNG 哈希。将 ZIP 解压到新临时目录后，使用 `node_modules/.bin/electron docs/design/ui-review-2026-10-13/validate.cjs --folder /绝对路径/ui-review-2026-10-13` 验证移动后的实际 `file://` 页面。

完成完整 UI 验证后，如果只修改报告正文，可以用 `validate.cjs --static-only` 复核 PNG、全部报告引用和冻结输入拒绝，再重新打包。此模式不创建窗口，结果单独保存在 `.mote/ui-review-validation/result-static.json`，不会覆盖或冒充此前实际 UI 验证。

所有 HTML、CSS、JS 和图片均在交付目录内。打包脚本只读取明确的评审文件清单，即使另有下载到同目录的倾向文字也不会加入 ZIP；不包含浏览器备注、产品数据或认证文件。生成器使用仓库现有 Node，打包使用 Python 标准库；移动交付后只需要浏览器。
