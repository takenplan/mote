# ADR：保留现有插件内核，补齐被实际消费的扩展契约

- 日期：2026-10-07
- 状态：本次调研确定的方案方向；产品实现及完整场景验收待后续任务
- 审计基准：`c72f9ae7cc03e03e92c1905e0791d3a6438d23f5`
- 依据：[中文调研报告、官方来源、四场景成本和验证记录](audits/plugin-architecture-2026-10-07.md)

## 问题

Mote 希望来源、端侧预处理、中央流程、命名产物消费者和资料库展示可独立演进，通过版本配方组合。现有 registry、Cordis scopes 与公共持久执行已能承接受信部署模块，但配方声明与执行入口、命名消费与 UI 目录关系尚不完整。仅凭注册函数存在不能决定所有场景都已满足。

## 决定

保留 DeepSeek fork Cordis、现有领域 registries、ExecutionEngine、MaterialStore 与 Harness bridge。沿 FeatureManifest/recipe 增量细化版本依赖、输入/输出端口、命名产物绑定、目录/展示贡献及安装实例代际。不建立平行资料库、任务调度器或授权中心。

公共层强制鉴权、隐私、收据、版本与删除传播、持久任务、取消、费用授权及预算。模块实现可替换能力；模型解释语义。查询 Agent 只有受控只读工具，捕获内容不能改变配置或授予权限。

## 必要改动

1. 同 ID/version 重装时旧处理实例提交必须由 installationEpoch 拒绝；持久版本和执行 fence 继续独立校验。
2. Material named product 与 EvidenceArchive artifact 保持各自权威，通过受控引用解析接入既有消费者队列；显式声明形态、版本、输入和输出，允许多个消费者独立失败/恢复。
3. window/join/aggregation 补真实 bounded policy 执行入口及持久 checkpoint；未实现的 policy 明确 unsupported/unavailable，不继续只注册宣称生效。
4. 资料库保持稳定公共外壳，内置 records/materials/Coding 也走贡献；目录投影、卡片、详情、面板、导航与操作有共同依赖和位置契约。Android 使用无代码描述与原生通用回退。

## 安装和生命周期

当前支持可信模块随部署组合，部分预部署能力可运行时撤销。HTTP 拓扑、connector、新 Web bundle 和原生能力各自有构建/重启要求；无重启安装新代码不属于本次目标。停用/卸载默认保留历史，独立于删除及历史重算授权。

## 验收

用生成资料完成 namespaced source 同步、命名产品独立后处理、中央窗口/聚合替换、新类型卡片/详情/导航四个演练，记录新增/修改路径，并证明后续模块无需继续改公共业务分派。覆盖依赖缺失、卸载/同版重装/升级、旧 Worker、原件删除、历史/未知 schema 回退与 UI 撤销。

已有 fixture 通过与已复现缺口仅证明审计结论。所有迁移、完整 UI E2E、物理设备与真实模型验收均不能由规划或类型检查代替。PR 前运行 `npm run check:local`；新增 moteText 同步英文与 Android 目录。
