# 五轮共同美术风格：实际验证

范围为 Web、Mac、Android 的生成资料 UI。设计范围、八项量表与五轮顺序见 [共同风格合同](../design/ui-art-direction-five-rounds.md)，独立判断见 [评价记录](../design/ui-art-direction-evaluation.md)。用户尚未选择候选。本文只记录实际执行结果，不把构建或自动截图称为独立实操。

## 候选 1

聚合源码提交为 `5d5f076e9067bacf03b2ad76212d4e832fb665ec`。Web producer 为 `2b17e6e20821a773779acceb5bd7384523546aac`，Mac 为 `5e4c1724362d939841da9d3afb10b60eb5a8f3cf`，Android 为聚合提交。同轮修复分别属于 Android 首屏留白 / 测例恢复等待和 Web 截图编排；Web / Mac 实际 producer 未改写。实际 Git diff 与 1450 个生产输入文件的 Git blob 比对证明两端源码和共同生产构建输入与聚合提交完全相同。保留真实 producer、构建归档和逐图哈希。

| 实际执行 | 结果与范围 |
| --- | --- |
| Web 构建、单元 | 构建通过，360 单元通过；实际导航 fixture 通过。 |
| Web 完整生成 renderer | 157 原始 PNG、32 核心 PNG、46 脚本旅程；原文精确一致、设置职责 / 任务 origin、各 consumer ready、窄屏 / 200% 状态，全部通过。 |
| Mac 完整构建及功能 smoke | native helper / updater / icon 与实际 Electron 构建、完整生成资料功能 smoke 通过。 |
| Mac 核心与补验 | 32 核心 PNG、13 脚本旅程；保存 / 草稿 / 原文 / 焦点 / Ask 来源返回，以及中英窄窗 screen / privacy / sources / sync / 离线目录限制，通过。补验并非所有页四条件完整截图。 |
| Android 构建、JVM | Development product / test APK 构建通过；66 类、313 JVM 测试，0 fail / error / skip。 |
| Android 实际模拟器矩阵 | 411dp / 320dp、font1 / font1.3、中英四条件共 12 测试，0 skip；86 张应用自身整窗 PNG，精确原文 / 日期切换 / 实际返回 / 真实 IME 布局通过。 |
| Android 额外原生旅程 | Navigation 8 pass / 2 明确 skip；草稿 Activity 重建 1、采集预览 / 明确开始 5、阻塞后台队列时 Start 1，通过。 |
| 核心离线比较页 | R1 的 96 核心图 + 93 历史参照图导入通过；后台真实 file 页面检查 12 条件 × 8 场景、放大 / Escape、本地倾向与刷新 / 导出格式、390px 无横溢；外部请求 0。 |

当前 canonical 证据在忽略目录 `.mote/ui-art-direction/r1/{web,mac,android,builds}`；同轮生产输入等价证明分别为 `source-equivalence.json` 与 `web-source-equivalence.json`。Android product APK SHA-256 为 `5e79f6d515b3e49237e51f1c5d79ca09257c77b7a798a5c300673690e433f91b`。

首次检查发现的中宽英文 toolbar 溢出、大字体第四动作裁切，已成为实际矩阵断言。编排还修复了 Development test build type、locale 真实 reload / 手机尺寸切回、headerBack 后真实 Main 恢复等待。失败尝试的 source / APK / PNG / log 保留，均未导入候选完成页。Android 不通过人工 `finish()` 模拟首页返回；实际 reader Close 回 matching records，再执行真实 headerBack。

所有执行使用临时 Central / Electron profile 与专用无窗口 `mote_ui_focus_5330_api37` / `emulator-5582`。保留 `FLAG_SECURE`，Android 图只绘制应用自己的窗口，不含系统键盘像素；真实 IME 对应用布局的影响另有操作与几何证据。生成者交接后停止驱动。其任务结束导致 held 进程被工具清理，root 以相同产品重新启动临时 profile 并持续持有，旧 canonical 图片不覆盖。独立三端核心实操与详细补验随后完成，真实 reviewer 和未验边界见评价记录；root 已在明确 release 后清理 Web/Mac 进程及 Android 生成 profile，专用无窗口 AVD 留供下一轮。

## 完成状态

五轮均已实际构建、采图与独立评价，逐轮记录如下。最终受影响检查与离线包验证按实际结果另记。

## 未验证范围

物理设备、真实个人采集、外部账号、真实模型、真人首次理解和完整无障碍研究未执行。原生权限 / 系统选择器由生成 fixture 替身控制；不等于真实系统授权成功。离线浏览比较页不执行产品操作，模型评分不等于用户选择。


## 候选 2：扫读与密度

实际源码提交：`10d28e60aaaff205d3871594d3fa5a4d07664658`。三端保留本轮实际 producer 提交；如单端修复，采用实际 Git 输入等价证明，未借用其他轮图片。本轮 producer：Web `10d28e60aaaff205d3871594d3fa5a4d07664658`、Mac `6854f25904d924b406fdbf1843ae74a5ab420e15`、Android `6854f25904d924b406fdbf1843ae74a5ab420e15`。Web / Mac 各 32 张核心图；Android 四条件共 86 张应用自有窗口图，核心 32 张，矩阵 12 项通过、0 跳过；连接返回回归 16 项通过。Web 47 个实际脚本旅程、Mac 15 个；独立手动操作、八项评分与限制见评价报告该轮记录。

构建 / 源码 / 原始图 / 内容就绪状态 / 旅程证据保存于 `.mote/ui-art-direction/r2`；独立评估证据保存于 `.mote/ui-art-direction/evaluator/r2`。产品 APK SHA256：`a93ba288337467b23739890b9886d91656b13e52a236e6ef2e7025f595470062`。应用自有窗口绘制不包含系统键盘像素；真实 IME 布局在矩阵中单独执行。无实机、个人资料、真实模型或真实账号检查。


候选 2 导入后的离线实际 file 页面复验通过：285 张哈希匹配原图，候选 1～2 的 24 个平台 / 语言 / 窗口条件 × 8 场景、比较 / 放大 / Escape / 本地倾向与导出格式正常，390px 无横溢，外部请求 0。默认对照上一候选；历史基线仍可选，缺少的历史 Web 原文图明确标注且不以其他图替代。


## 候选 3：边界与分隔

实际源码提交：`f628484e02b5c6975a896e35de247c5162afd725`。三端保留本轮实际 producer 提交；如单端修复，采用实际 Git 输入等价证明，未借用其他轮图片。本轮 producer：Web `f63f2a23c3ee7128a22caf39c51990a1e807d585`、Mac `f63f2a23c3ee7128a22caf39c51990a1e807d585`、Android `f628484e02b5c6975a896e35de247c5162afd725`。Web / Mac 各 32 张核心图；Android 四条件共 86 张应用自有窗口图，核心 32 张，矩阵 12 项通过、0 跳过；连接返回回归 16 项通过。Web 47 个实际脚本旅程、Mac 15 个；独立手动操作、八项评分与限制见评价报告该轮记录。

构建 / 源码 / 原始图 / 内容就绪状态 / 旅程证据保存于 `.mote/ui-art-direction/r3`；独立评估证据保存于 `.mote/ui-art-direction/evaluator/r3`。产品 APK SHA256：`b81a06075263f4dabfa0bee83506c6163490b06e7d076b99cf0fd0c9c20c5197`。应用自有窗口绘制不包含系统键盘像素；真实 IME 布局在矩阵中单独执行。无实机、个人资料、真实模型或真实账号检查。


候选 3 的真实弹窗边线回归：首次 `f63f2a23` 构建中，142px 动作按钮仅121px可见，按钮 `top=-10px`，6 个完整顶边采样在自身绘制中存在、在同次整窗绘制中全丢。失败源码 / APK / 原图 / ready=false 几何 JSON 保留于 `r3/android-dialog-clipped-f63f2a23`，未导入候选。`f628484e` 只关闭原生动作栏的 baseline alignment；同一硬门槛、采样容差与绘制算法复验，四条件24按钮全部完整可见，全部顶边采样保留。该回归继续在后两轮执行。


## 候选 4：视觉重点

实际源码提交：`b47938b44da5ccedeac9d7376c48acbb264b96a2`。三端保留本轮实际 producer 提交；如单端修复，采用实际 Git 输入等价证明，未借用其他轮图片。本轮 producer：Web `b47938b44da5ccedeac9d7376c48acbb264b96a2`、Mac `ad503028863294217b02c799f987d1f5f60027db`、Android `5bf1fbf944abaca4a1fa671a193b99606a77db99`。Web / Mac 各 32 张核心图；Android 四条件共 86 张应用自有窗口图，核心 32 张，矩阵 12 项通过、0 跳过；连接返回回归 16 项通过。Web 47 个实际脚本旅程、Mac 15 个；独立手动操作、八项评分与限制见评价报告该轮记录。

构建 / 源码 / 原始图 / 内容就绪状态 / 旅程证据保存于 `.mote/ui-art-direction/r4`；独立评估证据保存于 `.mote/ui-art-direction/evaluator/r4`。产品 APK SHA256：`c6a1305eb29b6af5da9059e23ae7e9c356d1321df19a5cce02992428f425fac0`。应用自有窗口绘制不包含系统键盘像素；真实 IME 布局在矩阵中单独执行。无实机、个人资料、真实模型或真实账号检查。


## 候选 5：细节与节奏

实际源码提交：`68fe663476f1b37fa0aceb7d051969c23659ec45`。三端保留本轮实际 producer 提交；如单端修复，采用实际 Git 输入等价证明，未借用其他轮图片。本轮 producer：Web `7afc4b97cd8bc27a410370359091975439a48b45`、Mac `7afc4b97cd8bc27a410370359091975439a48b45`、Android `68fe663476f1b37fa0aceb7d051969c23659ec45`。Web / Mac 各 32 张核心图；Android 四条件共 86 张应用自有窗口图，核心 32 张，矩阵 12 项通过、0 跳过；连接返回回归 16 项通过。Web 55 个实际脚本旅程、Mac 15 个；独立手动操作、八项评分与限制见评价报告该轮记录。

构建 / 源码 / 原始图 / 内容就绪状态 / 旅程证据保存于 `.mote/ui-art-direction/r5`；独立评估证据保存于 `.mote/ui-art-direction/evaluator/r5`。产品 APK SHA256：`522cee74bc0fa23166482471bdcefea29a39cd5adc19f42171e46ef2ca94d928`。应用自有窗口绘制不包含系统键盘像素；真实 IME 布局在矩阵中单独执行。无实机、个人资料、真实模型或真实账号检查。


## 第五轮补验与真实生命周期修复

最终 Android 源码 / 聚合候选为 `68fe663476f1b37fa0aceb7d051969c23659ec45`，Web / Mac 实际构建和详细实操保留本轮 `7afc4b97` producer，复核时聚合候选为 `0110434e`；最终再次逐项核验共同与本端生产输入，Web 1282、Mac 1235 个 Git blob 完全相同。没有改写旧构建身份，也没有借用其他轮图片。

Android 末轮完整验证：313 JVM、12 页面矩阵、16 原任务返回、8 新阅读窗口生命周期回归、24 弹窗动作和 180 个真实边线像素样本通过；最终补充旅程 15 通过、2 项既有可选检查跳过。紧凑中英两组明确区分 Unicode fixture `setText` 与真实 ASCII key events，在真实 IME 保持显示时滚动并触摸保存，再逐字核对原文和实际父页返回；没有系统键盘像素采集。第一次输入会话时序失败保留于 `r5/android-ime-attempt-7afc4b97`，没有降低原文或触摸门槛。

独立终评在旧 `0110434e` 发现真实问题：关闭原文到列表后，系统字体 / 密度变化引起重建，原文再次自动打开。旧产物与原始 61 / 62 UI 证据保留于 `r5/android-lifecycle-attempt-0110434e` 及独立评估目录。修复仅保存实际显示中的原文 ID / 本机或中央标志；首次 Intent 与恢复状态分开，关闭后不重放 Intent，仍打开的原文可按原 ID 继续读取。正文、client 和 token 不进入 Bundle，中央原文不回退读取本机。四个条件的打开 / 关闭两状态共 8 条真实产品入口回归通过，关闭后的日期和来源保持；独立评审另以系统配置两次变化验证关闭保持列表、打开保持逐字原文 / 来源 / 时间，再 Close → Content → Home。真实账号的远程读取恢复未验证。

Web 最后 55 个实际脚本旅程通过，新增附件限制直接可见、具名完整处理说明在中英四尺寸实际展开 / 折回；32 核心图来自 158 张本轮真实图。独立实操另验证真实 200% 浏览器 zoom：720×484 CSS、DPR4，实际 Tab / Enter 保存、精确原文、完整帮助、Escape 同来源焦点、设置职责及模型设置原任务返回通过，恢复 zoom1 后再次确认 1440×968 / DPR2。不是 CSS 缩放或仅窄视口模拟。

Mac 32 核心图 / 15 矩阵旅程及完整 UI smoke、45 请求的同步历史 smoke 通过；本轮完整 native helper / updater / icon 与 Electron 构建完成。实际完整标签边界与菜单图标在四条件中核验。独立中英窄窗键盘保存、原文 / 帮助、同 opener 焦点、草稿重载、Keep / Discard、原任务返回、导入预览后取消、停止状态与范围入口通过。最初后台 wrapper 语法失败发生在夹具初始化前，原文件和日志保留；修复 wrapper 后执行原断言，不冒充产品故障。

## 最终受影响组件检查

`npm run check:affected -- --base b52d6275` 通过，包含 `check:local` 和 Android Debug JVM。完整 TypeScript 消费者检查无失败，两个既有条件跳过另列于原日志；Android Debug 66 suites / 313 tests，0 failure / error / skip。本次完整检查始于 `7afc4b97`，期间仅 Android fixture 输入会话顺序改为 `0110434e`，全部 TypeScript 生产输入不变。

之后分别执行受影响增量检查：`--base 7afc4b97 --head 0110434e` 通过（Gradle up-to-date，不当作第二次实际单测）；`--base 0110434e --head 68fe6634` 通过，阅读窗口生产修复的 Debug JVM 313 实际重跑。8177 条中英文文案与 Android catalog 同步检查通过。完整命令日志及 SHA 保存于 `.mote/ui-art-direction/final-checks.json`。

三端最终评审明确释放后，Root 已精确关闭本次 Web / Mac 进程、清理对应生成 profile 和 Android Dev 资料，只停止专用 `emulator-5582` / `mote_ui_focus_5330_api37`；四个 Root 持有会话均已退出。物理设备、真实个人采集、真实模型 / 外部账号、真人审美 / 首次理解与完整无障碍研究未执行。

## 最终离线候选页与 ZIP

完整候选页包含 573 张实际原图：93 张历史基线和五轮各 96 张。五个候选的三端 / 中英文 / 常规与窄屏共 60 个组合，各 8 个场景，哈希、内容就绪状态、实际加载与逐场景切换全部通过。历史基线缺少的三张 Web 原文图明确标注，不用其他轮或场景替代；五个新候选矩阵完整。

隐藏 Chromium 实际打开原目录的 file 页面，验证两轮对照、三端并看、原始像素放大 / Escape、本地倾向的保存 / 刷新、导出格式和 390px 无横向溢出；外部请求为 0。只验证导出格式，未操作系统下载对话框。报告标题与候选说明的格式整理后，重新生成并重复这些检查。

ZIP 仅含 9 个静态页面 / 报告文件和 573 张原图，共 582 个文件，CRC 及每张原图 SHA-256 通过。实际解压到一个全新移动目录，再以 `--folder` 打开移动后的 file 页面，以上 573 原图 / 60 组合及交互检查再次通过，外部请求为 0。包大小为 95,382,150 bytes，SHA-256 为 `34761efb75cd18e5ecf16311dfc276cb865de5c94090c289a5e5d311a0526fde`；原目录与解压移动页的 manifest SHA-256 均为 `3fbca2f3bb95a9425b576379a461824211bce4e279170f8395e8da985e4b7bda`。

交付位于忽略目录 `.mote/ui-art-direction-review/index.html` 和 `.mote/ui-art-direction-review.zip`。最终证明为 `.mote/ui-art-direction/r5/{gallery-validation.json,portable-gallery-validation.json,package-validation.json}`，前一次格式整理前的通过结果另存，不覆盖为失败或扩大验证范围。此节是验证记录，不在 ZIP 内；记录追加后没有改变已验证的页面 / 报告 / 图片字节。
