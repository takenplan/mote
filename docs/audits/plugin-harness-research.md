# DeepSeek Harness 插件方式：Mote 对照调研

读取日期：2026-10-07（Asia/Shanghai）。Mote 只读基准：`/Users/utopiafar/.codex/worktrees/df3d/mote`，HEAD `c72f9ae7cc03e03e92c1905e0791d3a6438d23f5`。已读该目录 AGENTS.md。未修改该 worktree、安装其依赖、运行真实模型或采集任何个人内容。

## 结论

建议保留 Mote 现有 Cordis + registry + manifest + 配方方向，借鉴 Harness 的明确能力契约、provider/consumer 分离和上下文所有权；不应把 Harness SDK 当作 Mote 全端插件内核，也不应直接引入其 profile 插件管理器以补齐资料库扩展。

Harness 是 DeepSeek 的开源 agent harness；其插件运行机制来自 `@deepseek-ai/cordis`。SDK client 是启动子进程、传递配置、运行会话和订阅事件的宿主侧库。数据源、中央处理、资料目录和 UI 的公共契约仍须由 Mote 定义。现有 Harness 使用能证明查询 Agent 工具组合受宿主控制；不能证明 Mac/Android 数据源、中央持久处理及资料 UI 已统一热插拔。

## 版本和来源确认

| 对象 | 审计值 | 实际确认方式 |
|---|---|---|
| Mote 根 package.json、packages/agent/package.json | `@deepseek-ai/dsh-sdk-client: 0.2.0-rc.2` | 根文件第 56 行；agent 文件第 24 行 |
| package-lock.json | client/app/minimal/jsonrpc-server/protocol 均 `0.2.0-rc.2` | 第 4857–4955 行；不是范围版本推断 |
| DeepSeek Cordis | SDK 的 peer 要求 `~4.0.4` | lock 与精确包 manifest；与上游 npm `cordis` 不是同一包名，不据此推断上游功能相等 |
| 公开项目 | `deepseek-ai/deepseek-harness` | npm repository 字段与 DeepSeek 官方仓库互证 |
| 官方 master 只读快照 | `5badb15009ae1756c3afe0ae0cef1faafc290ccc`，committer 日期 `2026-10-03T03:48:13Z` | GitHub commits/master API |
| 精确发布包 | 8 个 `0.2.0-rc.2` npm tarball | 下载到 `/tmp/mote-harness-audit`，sha512 校验，并逐项对照 Mote lock；收据 `receipts.json` |

基准目录没有本地 node_modules，故没有声称读取其已安装依赖。本次使用的是锁定版本 registry tarball，未运行包代码。下载了 client、sdk-minimal、sdk-app、sdk-jsonrpc-server、tools、sandbox-policy、jobs-local、plugin-manager；仅后两者用来确认能力边界，是否属于 Mote 实际 profile 由组合文件判定。

本次取得 registry 的版本发布时间：client 为 `2026-09-29T10:01:25.236Z`，sdk-minimal 为 `2026-09-29T09:53:20.395Z`，其余所查包同日发布；8 项 metadata integrity 均与 Mote lock 一致，收据包含逐项时间和完整 integrity。

未能确认 `v0.2.0-rc.2` 或 `0.2.0-rc.2` GitHub tag（两个 API 返回 404），npm metadata 无 `gitHead`，故不把任何 GitHub commit 冒称为 npm 发布版本的源码 commit。已发现精确 npm `sdk-minimal/cordis.patch.yml` 比 master 快照多 `invariants/session-invariant/agent-invariant/scope-invariant/agent-loop-invariant` 行；client README 的 master 少一个 invariant 说明表格行。能力结论以精确 tarball 为先，master 用于公开开发文档。

直接主来源：

- [官方仓库 README](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/README.md)：项目身份、Cordis 基础和 developer preview 的兼容性限制。
- [锁定 SDK client metadata](https://registry.npmjs.org/@deepseek-ai/dsh-sdk-client/0.2.0-rc.2)：精确版本、依赖、repository、integrity 和 tarball。
- [锁定 SDK minimal metadata](https://registry.npmjs.org/@deepseek-ai/dsh-sdk-minimal/0.2.0-rc.2)、[SDK app metadata](https://registry.npmjs.org/@deepseek-ai/dsh-sdk-app/0.2.0-rc.2)、[tools metadata](https://registry.npmjs.org/@deepseek-ai/dsh-tools/0.2.0-rc.2)：精确发布制品。
- [官方第一个插件教程](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/docs/user/develop/basic/index.md)、[配置教程](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/docs/user/develop/basic/config.md)、[发布/安装教程](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/docs/user/develop/basic/publish.md)。
- [官方生命周期](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/docs/user/develop/framework/index.md)、[服务依赖](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/docs/user/develop/framework/service.md)、[三角色能力设计](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/docs/user/develop/practice/index.md)。

## 插件开发和组合方式

一个 Harness 插件可为导出 `apply(ctx, config)` 的函数模块，也可用对象或 Service 类。`inject` 声明必须就绪的服务，配置 type 与 Schemastery schema 配对。模型工具消费者通过 `ctx.tools.register(defineTool(...))` 注册参数、canonical output schema、render 和 execute；这不等同于自动获得网络、文件或 Mote 原件访问权限。[官方工具教程](https://github.com/deepseek-ai/deepseek-harness/blob/5badb15009ae1756c3afe0ae0cef1faafc290ccc/docs/user/develop/basic/tool.md)

本地开发通过绝对插件路径和 `--patch` 叠加；可分发 npm bundle 使用 `package.json.dsh.bundle` 声明配置层；profile 使用 `dsh.profile.bundles` 固定有序组合。CLI plugin 命令将依赖安装到 profile。发布教程强调同宿主共享实例的 Harness 包声明 peerDependencies 和开发依赖。patch 后层胜出，单行 config 是整对象替换；不是深度合并。此处可借鉴部署配方和兼容性检查，不能忽略配置覆盖丢失字段的问题。

Harness 三角色模式把稳定 Service Definition（请求/结果）与可替换 Provider、Consumer 分离，并明确不要提前拆包。Mote 命名产物应使用已有 material/artifact/recipe 契约表达，而非为每个能力再制造独立平行权威。

最小教程形态：

```ts
import type { Context } from '@deepseek-ai/cordis';
import { defineTool } from '@deepseek-ai/dsh-tools';
export const name = 'fixture-tool';
export const inject = ['tools'];
export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'fixture_metadata',
    description: 'Return generated fixture metadata.',
    parameters: {},
    output: { schema: { type: 'string' }, render: (_args, v) => [{ type: 'text', text: v }] },
    async execute() { return 'Generated fixture only'; },
  }));
}
```

此示例仅说明 Harness 机制，不建议直接装入 Mote 查询 profile；Mote 新检索扩展应首先走宿主 ContextToolContribution，让授权和预算保留在公共层。

## 生命周期、权限、任务边界

| 边界 | 核查结论 | Mote 含义 |
|---|---|---|
| 缺失依赖 | 必需 inject 服务缺失时待加载；运行中丢失会卸载依赖插件，服务恢复后重新加载 | 适合注册所有权；业务任务能否恢复、资料是否保留不是 Cordis 自动解决 |
| 清理 | ctx 注册归所有者，`ctx.effect` 自定义清理；fiber dispose 等待异步清理。官方说明 disposer 按逆序开始但异步完成可并发 | 有次序要求的中止/等待/解除注册应放同一 disposer 内串行 await |
| 工具取消注册 | 精确 tools tarball 的 `lib/index.js:2878` 返回 `layers.effect` disposer | 可证明工具注册可撤销；不证明已经启动的外部副作用或旧产物提交会被阻断 |
| 动态安装 | 插件管理器在 HMR 开启时可应用；关闭时保存配置并要求重启 | “安装完成”“配置已保存”“当前应用成功”须分开，不可统称热插拔 |
| Mote 使用的 SDK | sdk-minimal 使用启动 patch；sdk-app 精确 README 明确 HMR 禁用、配置更改需新进程 | 当前是部署可插拔和新 Agent 进程配置，不能声称同个运行会话无重启安装 |
| 子进程取消 | SDK wire 无 prompt mid-turn cancel；放弃 run 要 close runtime；close 协议 shutdown 后 EOF→SIGTERM→SIGKILL | 应由 Mote 任务/预算层控制生命周期，旧结果提交仍要宿主校验 |
| 权限 | plugin-manager 精确 README 说明 Host 插件代码在工作区沙箱外宿主进程执行；sandbox-policy 只处理文件效果，不约束网络/进程 | 这是可信应用代码组合，不是不可信第三方代码的安全边界 |
| 持久任务 | sdk-minimal 实际树挂 jobs-local 服务，但没有 model-facing jobs control 插件；README “不含 jobs”只能理解为用户控制层省略。jobs-local 的记录进程内存中 | 不能用 Harness jobs 替换 Mote 持久任务、收据和删除传播 |
| SDK 结果 | run 收集 inbox receipt 到整体 Agent idle，finalResponse 为该区间最后 root assistant 文本；不是每 prompt 的因果结果 | 并发 steering/恢复任务必须使用宿主持久身份和运行 fence，而非仅文本回包 |

可核查来源：[锁定 SDK client tarball](https://registry.npmjs.org/@deepseek-ai/dsh-sdk-client/-/dsh-sdk-client-0.2.0-rc.2.tgz)、[锁定 SDK app tarball](https://registry.npmjs.org/@deepseek-ai/dsh-sdk-app/-/dsh-sdk-app-0.2.0-rc.2.tgz)、[锁定 jobs-local tarball](https://registry.npmjs.org/@deepseek-ai/dsh-jobs-local/-/dsh-jobs-local-0.2.0-rc.2.tgz)、[锁定 plugin-manager tarball](https://registry.npmjs.org/@deepseek-ai/dsh-plugin-manager/-/dsh-plugin-manager-0.2.0-rc.2.tgz)、[锁定 sandbox-policy tarball](https://registry.npmjs.org/@deepseek-ai/dsh-sandbox-policy/-/dsh-sandbox-policy-0.2.0-rc.2.tgz)。这些下载链接是所查制品，可按 integrity 复查。

## Mote 的实际接入和已存在契约

代码位置均指审计基准 commit，不指当前任务默认 checkout。

- `packages/agent/src/index.ts:48–91` 把插件源码冻结到当前模块，生成 JSON patch：禁用 bash/pwsh/terminal/subprocess/MCP 默认路径，关闭 provider session log/package inventory，加入 Mote skills/attachments/context；SDK 启动依赖 `moteReady`。
- `packages/agent/src/index.ts:244–272` 创建 sdk-minimal，隔离 `dshHome/cwd/processCwd`，显式提供子进程环境、桥接 token、允许工具和已固定工具定义；不是继承全部宿主环境。
- `packages/agent/src/plugin.mjs:6,135–188` 必需 `tools/skills/agents/attachments`，注册受允许列表约束的 tools，guard 拒绝名单之外的调用；将实际 tool schemas 送 `_ready`，提供 ready service。
- `packages/agent/src/bridge.ts:314–324` 宿主核对实际工具 roster；`:391–400` 扩展 metadata 工具读取前、读取后均重新 authorize，并约束每次与累计字符预算，标为 untrusted context；不授予原件 citation 权。
- `packages/agent/src/tool-contributions.ts:7–28` 已有 version、schema fields、parse、authorize、read、maxCharacters；注册返回 disposer；snapshot 的 authorize 检查同名当前 entry 是否仍是本代实例。卸载/升级后旧会话不能使用旧 entry 的授权读取。
- `packages/agent/src/index.ts:360–367` 在 finally 中关闭 Harness、bridge、observer；SDK 缺乏 wire cancel 的影响通过宿主清理路径处理。
- `packages/agent/src/import-agent.ts:53–70` 是另一个显式导入 profile，允许文件/写入/shell 路径，并无查询 bridge；不要把其工具权限与资料查询 Agent 混同。

对于“已有产物新增模型可用只读目录检索”，Mote 宿主贡献契约已经比直接 Harness tool 注册更完整。建议扩展其声明/目录关系而不另起查询插件框架。版本固定解决会话 schema 稳定性，动态 authorize 解决撤销；后处理和中央任务仍需在输出提交处校验 processor generation、input revision、delete epoch。这是从能力边界作出的方案推论，未宣称 Harness 自动实现。

## 与四类扩展场景的关系

| 场景 | Harness 可复用部分 | Harness 不提供的 Mote 公共契约 |
|---|---|---|
| namespaced 新数据源同步 | 明确服务定义/provider/consumer 分离的设计 | Mac/Android capture、隐私过滤、source id、同步游标、授权和删除传播 |
| 已有产物新增独立后处理 | 模型推理 profile、只读工具组合、关闭与预算接口 | 有版本输入/输出产物、依赖、持久任务、generation fence、提交收据 |
| 中央窗口/join/aggregation 替换 | 执行模型任务和通知 | grouping/window 的确定性执行语义、事件/处理时间、晚到数据、重算身份、输出原子提交 |
| 资料卡片/详情/导航 | 工具输出可有 presentation 信息，但属于 Harness 工具 UI | Mote 公共资料目录、renderer matching、导航贡献、权限过滤、未知 schema 回退 |

因此只借鉴其“所有注册归插件上下文”和“能力契约的角色划分”，不要因 Harness everything-is-a-plugin 的宣传语大规模迁移业务内核。

## 验证与未知

本次实际执行：read-only Git/源文件检查；官方网络文档和源码读取；8 个精确 npm 制品下载、sha512 与 lock 对照；对 master 和发布制品的静态差异检查。不是运行时契约测试。

本次未执行：npm 构建/check:local、任何 Harness runtime fixture 测试、UI/设备测试、真实模型质量检查。无产品修改、提交或 PR。建议综合阶段如需要可用生成 fixture，在独立临时 workspace 验证注册→pin→读取→注销→拒绝旧 handler；本报告没有冒称该检查已通过。

未知：精确 npm 发布对应的 Git commit/tag；不可信第三方插件的代码隔离（当前资料表明是可信宿主代码）；Mote Mac/Android/UI 完整生命周期由其他审计模块核对，本报告不依据 Harness 能力推断它们已经支持。


> 汇总说明：本文件保留子任务自己的验证范围；主 agent 后续在审计 commit 的隔离临时副本完成 25 项基准生成资料测试及 4 项缺口探针。同 ID/version 立即重装时旧 ProcessingRuntime 结果提交已复现。最终决策和实测范围以 [主报告](plugin-architecture-2026-10-07.md) 为准。
