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

## 待完成记录

候选 2～5、最终受影响检查及可移动 ZIP 验证将按实际完成后追加。未执行的内容不作为已验证结果。

## 未验证范围

物理设备、真实个人采集、外部账号、真实模型、真人首次理解和完整无障碍研究未执行。原生权限 / 系统选择器由生成 fixture 替身控制；不等于真实系统授权成功。离线浏览比较页不执行产品操作，模型评分不等于用户选择。


## 候选 2：扫读与密度

实际源码提交：`10d28e60aaaff205d3871594d3fa5a4d07664658`。三端保留本轮实际 producer 提交；如单端修复，采用实际 Git 输入等价证明，未借用其他轮图片。本轮 producer：Web `10d28e60aaaff205d3871594d3fa5a4d07664658`、Mac `6854f25904d924b406fdbf1843ae74a5ab420e15`、Android `6854f25904d924b406fdbf1843ae74a5ab420e15`。Web / Mac 各 32 张核心图；Android 四条件共 86 张应用自有窗口图，核心 32 张，矩阵 12 项通过、0 跳过；连接返回回归 16 项通过。Web 47 个实际脚本旅程、Mac 15 个；独立手动操作、八项评分与限制见评价报告该轮记录。

构建 / 源码 / 原始图 / 内容就绪状态 / 旅程证据保存于 `.mote/ui-art-direction/r2`；独立评估证据保存于 `.mote/ui-art-direction/evaluator/r2`。产品 APK SHA256：`a93ba288337467b23739890b9886d91656b13e52a236e6ef2e7025f595470062`。应用自有窗口绘制不包含系统键盘像素；真实 IME 布局在矩阵中单独执行。无实机、个人资料、真实模型或真实账号检查。


候选 2 导入后的离线实际 file 页面复验通过：285 张哈希匹配原图，候选 1～2 的 24 个平台 / 语言 / 窗口条件 × 8 场景、比较 / 放大 / Escape / 本地倾向与导出格式正常，390px 无横溢，外部请求 0。默认对照上一候选；历史基线仍可选，缺少的历史 Web 原文图明确标注且不以其他图替代。
