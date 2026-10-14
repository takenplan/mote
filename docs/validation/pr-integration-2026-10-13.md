# 2026-10-13 PR 整合与客户端发布

本轮范围为 [#113](https://github.com/utopiafar/mote/pull/113)、[#114](https://github.com/utopiafar/mote/pull/114)、[#115](https://github.com/utopiafar/mote/pull/115)。依据既有对话中的所有者确认，以及[上下文读取决定](../adr-memory-context-reading.md)、[范围评估决定](../adr-memory-range-evaluation.md)，没有新增需要所有者决策的产品或架构问题。

## 重叠设计处理

两个 Memory PR 原先分别占用了个人 v4、提取 v2、审核 v4，但内容和指纹不同。保留 #113 的固定 v4 定义；组合版本使用个人 v5、提取 v3、审核 v5，同时保留主动读取上下文和完整目标范围评估。默认升级按 v2→v3→v4→v5 执行；旧授权继续用旧绑定，来源覆盖、自定义选择和成功历史不重写。

| 分类 | 整合结果 |
| --- | --- |
| KEEP | 原文授权、目标与读取范围分离、宿主实际披露收据、精确引文、主体与时间边界、独立审核、成功检查点、现有资源限制。 |
| CHANGE | 新 v5 组合两项能力；当前进度分别呈现真实失败与输入失效；Android 列表和详情消费同一结果字段。 |
| REMOVE | 新范围评估契约中的候选数量驱动语义切分；失效历史任务的调度与重试入口；已退出当前执行的历史失败对当前待处理数的影响。 |
| EXCEPTION | 显式旧配方和无新字段的持久任务保留旧契约；真实资源失败保留有限恢复；混合任务仍呈现独立真实失败。 |
| UNKNOWN | 组合后的真实模型选择质量、全库召回、物理设备权限与后台行为未在本轮复测。 |

## 已执行验证

- 40 项针对性 Memory 回归通过，覆盖上下文读取、独立审核、8/32/80 候选、原文更正、旧任务重启与续审。
- 默认迁移 12 项、自动配方 17 项、提问与上下文恢复 33 项回归通过。
- 新增真实 HTTP 入口组合 fixture：Source→正式 source-body Material→个人 v5 任务；提取和审核各自通过实际 `context_evidence` 桥补读目标之外的授权原文，保存 40 个经独立审核的生成观察，保持目标覆盖。来源更正后，列表与详情显示 `input_invalidated`，失败数为 0；重启不新增模型调用。
- Android 3 项生成 JSON 回归及 Kotlin 编译通过：纯输入失效无调度按钮，混合失败保留重试，旧接口缺少 outcome 时不从错误码推断结果。
- 第一轮完整检查发现一项旧测试仍把 v4 当作范围评估策略；已扩展为同时验证 v2/v4 旧契约和 v5 新契约，并重跑受影响检查。

完整 `npm run check:affected -- --base origin/main` 已通过：三端 TypeScript 构建与类型检查、Central 1606、Web 358、Desktop 433、Agent 289、Shared 179、Diagnostics 5 项测试，以及发布工具、CLI 和中央运行器回归通过；Android 全量 `testDebugUnitTest` 成功。两个既有 opt-in 项（macOS sandbox、已安装 Codex 的合成 Responses fixture）跳过，未记为通过。Android 使用已安装的 JDK 21 与本机 Android SDK。新测试仅用生成资料和脚本化模型响应；本轮没有新增真实模型调用或采集个人屏幕。

## 发布范围

检查范围与发布范围分别判断。主分支在 `desktop-v0.0.85` 和 `android-v0.0.86` 之后已有实际客户端改动；本次发布 [Desktop 0.0.86](../../release/notes/desktop/0.0.86.md) 与 [Android 0.0.87 / code 98](../../release/notes/android/0.0.87.md)。Central 版本保持 0.0.89，本轮不创建中央标签，也不启动此前已停止的本机 DEV 服务或观察任务。

发布工作流另行核对组件版本、应用身份、签名和公开附件。合并完成、发布产物可用与用户已安装升级分别核对，不能相互代替。
