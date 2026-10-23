# Cordis 插件机制核验（子调研）

核验日期：2026-10-07（Asia/Shanghai）。Mote 审计基准：`c72f9ae7cc03e03e92c1905e0791d3a6438d23f5`，只读目录 `/Users/utopiafar/.codex/worktrees/df3d/mote`。已读该目录 `AGENTS.md`；未修改基准 worktree，结束时 `git status --short` 为空。

## 结论

建议保留现有 Cordis + Mote registries + 公共执行层的方案。Cordis 已提供可撤销副作用、服务依赖和消费者重启；无需另造插件内核。需要细化 Mote 的业务契约和宿主生命周期：注册存在不代表运行中任务被取消，更不代表代码可无重启安装。当前可证明的是“预先部署的可信插件模块可注册、撤销，部分服务可在内存中替换”，产品安装入口、HTTP 路由重新挂载、模块发现与校验、版本迁移和所有运行中提交的实例 fencing 未形成完整协议。

## 包、版本、来源与上游区别

- Mote server/web/agent 均直接锁定 `@deepseek-ai/cordis: 4.0.4`；`package-lock.json:1503` 锁定 npm tarball 及 integrity。该包依赖 `@deepseek-ai/cosmokit ~1.8.5`，Loader/Include 是 optional peer，安装依赖树不代表 Mote 启用了它们。
- npm 元数据记录 4.0.4 发布于 `2026-09-22T15:36:40.763Z`；本次读取时 latest=4.0.4。包内 repository 指向 `deepseek-ai/deepseek-harness` 的 `vendor/cordis`。[精确版本元数据](https://registry.npmjs.org/@deepseek-ai%2fcordis/4.0.4)、[全版本时间元数据](https://registry.npmjs.org/@deepseek-ai%2fcordis)、[锁定 tarball](https://registry.npmjs.org/@deepseek-ai/cordis/-/cordis-4.0.4.tgz)。
- 官方 vendor 清单说明其源头为上游 `cordis 4.0.0-rc.7`，commit `56b3d4f725681cf4556c1a8695a709cc3b6eed74`。这是 vendor 上游基准，不能把它当作 scoped 包 4.0.4 的版本号或发布 commit。[vendor 清单与修改记录](https://github.com/deepseek-ai/deepseek-harness/blob/master/vendor/README.md)、[上游基准 manifest](https://github.com/cordiverse/cordis/blob/56b3d4f725681cf4556c1a8695a709cc3b6eed74/packages/core/package.json)。
- 上游 npm `cordis/latest` 在读取时为 `4.0.0-rc.10`；GitHub main 为 `f8ea3cd50f1a5724e8e715995bcde131c9c12b2c`（2026-09-08）。上游 README 声明 API 仍不稳定。升级应按 scoped fork 的实际发布载荷核验，不能因名称相同就直接换用上游包。[上游仓库](https://github.com/cordiverse/cordis)、[上游 npm 元数据](https://registry.npmjs.org/cordis/latest)。
- DeepSeek fork 的官方修改日志覆盖重入 disposal、卸载中禁止新 effect、异步 cleanup 可 join、通知异常隔离、配置惰性解析，以及独立 Loader/HMR 修复。日志是当前 master 的记录，不证明所有 23 项均属于锁定 4.0.4；本报告运行时结论以精确 npm 载荷为准。[修改日志](https://github.com/deepseek-ai/deepseek-harness/blob/master/vendor/README.md)。

基准 worktree 没有 node_modules；使用项目默认 checkout 已安装包作只读审计，并下载锁定 tarball 到 `/tmp` 比较。tarball SHA-512 与 lock 完全一致：`sha512-obgyxqWAmFn3Re8kvsuUnyW+ihrz6eJCnJO4fh1cQzDtmPYz/zzVeUkH9R94I0OwSVOocK67Kgakm04j/oQXzg==`。已安装的 `src/fiber.ts`、`src/registry.ts`、`src/reflect.ts`、`lib/index.js`、`package.json` 与 tarball 字节相同。版本元数据未提供 gitHead，因此精确发布源码 commit 未确认。

## 核验到的 Cordis 契约

以下包内位置位于 `/Users/utopiafar/Documents/Projects/mote/node_modules/@deepseek-ai/cordis`，已经上述锁定 tarball 验证。

| 契约 | 实际行为 | 包内位置 / 主来源 |
| --- | --- | --- |
| plugin | 支持函数、构造类、带 apply 的对象；返回 Fiber PromiseLike wrapper；身份是执行 callback，而不是业务 manifest id | `src/registry.ts:91,222,316`；[Registry API](https://deepseek-harness.github.io/deepseek-harness/reference/cordis-api/registry) |
| inject | 所需服务缺失时为 PENDING；provider 可用后执行；provider 消失会清理消费者；新 provider 会重新执行消费者 | `src/registry.ts:164`、`src/fiber.ts:605`、`src/reflect.ts:297,314`；[官方入门](https://deepseek-harness.github.io/deepseek-harness/reference/cordis-primer) |
| await | 只等待当前 inertia 并重新抛出启动错误；PENDING 且没有 inertia 时也立即返回，因此 await 成功不等于 ACTIVE | `src/fiber.ts:704`；[Fiber API](https://deepseek-harness.github.io/deepseek-harness/reference/cordis-api/fiber) |
| provide | 同一 isolation key 不允许两个 provider 同时注册；移除后通知 dependents 并等待其稳定；替换需先移除旧 provider | `src/reflect.ts:277`；[Service API](https://deepseek-harness.github.io/deepseek-harness/reference/cordis-api/service) |
| effect | setup 可返回 disposer/Promise/可迭代；单个 effect 内 cleanup 逆序并串行；Fiber 层 top-level effects 按逆注册顺序发起，但 Promise.all 并行等待，不能假设不同 effects 的异步完成顺序 | `src/fiber.ts:418,431,675`、`src/utils.ts:27`；[锁定源码 tarball](https://registry.npmjs.org/@deepseek-ai/cordis/-/cordis-4.0.4.tgz) |
| dispose | 显式 fiber.dispose 可 await；registry.delete 会启动所有 fibers 的 dispose，但它自身返回 runtime，不是可等待全部 teardown 的 Promise；需要顺序保障时保留并 await fiber | `src/registry.ts:258`、`src/fiber.ts:265`；[Registry 源码](https://github.com/deepseek-ai/deepseek-harness/blob/master/vendor/cordis/src/registry.ts) |
| update/restart | update 走 internal/update waterfall，默认 restart，可被 veto；不是对旧新资源的事务性替换 | `src/fiber.ts:718,736`；[Fiber 源码](https://github.com/deepseek-ai/deepseek-harness/blob/master/vendor/cordis/src/fiber.ts) |

官方也明确要求有顺序关系的清理放在同一个 effect 中。完整撤销依赖插件作者正确归属所有计时器、监听、子进程和资源；Cordis 不会自动收回已经泄露到全局或自建闭包中的能力。[官方实践规则](https://deepseek-harness.github.io/deepseek-harness/reference/cordis-primer)。

## Mote 实际使用及边界

以下位置均相对只读基准 worktree：

| Mote 扩展点 | 已有能力 | 生命周期限制 |
| --- | --- | --- |
| `apps/server/src/backend-plugin-scope.ts:20,25,32` | provide、install、按所拥有 plugin/service 反向 close；共享 root 时不误 dispose 兄弟 runtime | 不提供单插件替换管理 API；`await install` 不额外校验 ACTIVE，缺 inject 时可能仍为 PENDING |
| `apps/server/src/file-processors.ts:65,94,101,135` | registry disposer 检查对象身份；插件通过 inject+effect 注册；统一部署 modules 可 import | modules 只在 constructor 初始化读取，HTTP 无代码安装能力；不能据此宣称运行中发现或安装 |
| `apps/server/src/processing-runtime.ts:17,24,41,135,141` | 独立 processor；输入只给 evidence/material/artifact/config/signal；持久 DAG、输入版本、父权限及执行 fence 留在 host | admit/commit 检查 processor version；同 id 同 version 撤销后替换仍缺 installation epoch，旧实例返回值可能通过版本检查。版本更换已能阻断旧 version 的 commit；全面热替换承诺需最小 epoch/fence 细化 |
| `apps/server/src/source-pipelines.ts:41,56` | source policy 可 disposer 撤销；声明过的 sourceKind 集合保留，用于判断曾有此能力 | registry 撤销不是删除原件或历史资料；持久任务/版本/删除逻辑必须由宿主管理 |
| `apps/server/src/feature-host.ts:33,40,46,58` | Cordis effects 撤销 feature manifest/routes inventory；scope.stop 停 admission 和 timer；route 进入 503 | Fastify route 仍存在，仅 dispatch 被拒绝；源码明确 HTTP 拓扑变化 require restart。重复 install 同 id 先受 registry 拒绝，dispose 后也不解决重复 HTTP 路由 |
| `packages/shared/src/feature-packs.ts:17,24,33` | 身份检查使旧 disposer 不删除新注册；requires 可递归过滤缺失或循环依赖；inventory 有 unavailable 原因 | 只适用于元数据/查找；不会自动停止持久任务；requires 仅 string id，无依赖版本范围；manifest 对未声明组件的注册仍允许，非完整契约校验 |
| `apps/server/src/agent-feature-host.ts:10,20,27` | agent reader 及 context tool registrations 受控只读；dispatch 每次查 active 注册，撤销后 503 | 组装分组仍为静态表；Cordis 内部插件是可信服务宿主代码，不能把 Context 本身交给 query agent |
| `apps/web/src/features/host.ts:9,20` | 独立浏览器 root；page/collection/renderer/panel/home effect 撤销；renderer 精确匹配 kind/schemaVersion/representation | bundle 中预先导入组件，没有远程代码发现/动态打包安装；host 生成 descriptor 时不传 entry.requires |
| `apps/web/src/features/runtime.tsx:16,30,40,53` | React subscribe 更新；unknown schema/零或多个 renderer 使用 fallback；panel 撤销消失 | page 有 server capability requires 校验，collection 类型无 requires，不能统一断言后端缺能力时所有 UI 都取消；collection selected 撤销后内容为空，仍需公共 fallback/选择重置 |
| `apps/server/src/connectors/registry.ts:69,84,92` | 启动前可从受信模块加载 connector | started 后 register 拒绝，属于部署级插件 |

生命周期必须分开表述：端侧 adapter 的文件监听与 OS 权限、中央持久执行与提交 fence、UI registry 的 React 卸载，各有自己的资源和状态。只给其中一层 Cordis disposer 不能证明端到端撤销。

## 最小建议（不另造权威）

1. 延续现有 FeatureManifest/FeatureRegistry。沿用 capability id 加 version 或 version-range；声明输入/输出引用和 UI contribution 关联，校验注册不能绕过 manifest。依赖可用性是状态投影，不成为新的任务数据库。
2. 注册实例由宿主分配 installation epoch；执行开始固定 `(processorId, version, epoch)`，提交同时核 epoch 与公共 execution fence。替换先停止新 admission，revoke publication，取消/等待 owned work，await dispose，再 install；失败不要声称已 rollback。内容版本仍固定在配方与 material revision 中，不能用 runtime epoch 取代资料身份。
3. 插件缺失把依赖任务标记 blocked 并显示原因；卸载默认保留已持久化资料和未知类型回退；原件删除通过公共 lineage/tombstone 传播，插件不得自行保留可查询副本。后续 install 不自动授权高成本历史模型重跑。
4. 明确部署文档：“可信 module + 配置 + 服务/前端重启”为当前安装方式；已有内存注册可撤销或替换另行说明。暂不承诺无重启代码安装；将来确有需求时再加经过宿主治理的 module loader，不为了 Cordis 支持 HMR 就提前引入。
5. collection/renderer/panel 可声明同一后端 capability 依赖，缺失时公共资料库保留通用目录、历史条目、安全详情与 unavailable 状态；本地注册和后端 inventory 只投影状态，不引入第二套业务目录权威。

## 最小可执行证据及验证状态

已执行 `/tmp/mote-cordis-contract.mjs`（Node，导入上述经 tarball 核验的 `lib/index.js`）：4 项 PASS。测试仅创建 `fixtureSource` 和字符串 v1/v2，不读取个人截图、用户资料、网络模型或设备。案例：缺依赖时 await=稳定 PENDING；provider removal 清理 consumer；v2 provider 重新启动 consumer；effect 和 fiber 重复 dispose 为 single-shot。

核心示例：

```js
const consumer = root.plugin({
  inject: ['fixtureSource'],
  apply(ctx) {
    ctx.effect(() => registry.register({
      id: 'fixture.normalized', version: '1',
      process: input => generatedNormalize(input),
    }));
  },
});
await consumer; // 仍需检查 ACTIVE，缺依赖不会在这里永久等待。
await consumer.dispose(); // await 自己拥有的 fiber，而非 await registry.delete。
```

这证明框架机制，不证明 Mote 完整数据流。已只读检查 Mote 相关实现与现有生成测试：`apps/server/test/backend-plugin-scope.test.ts`、`apps/server/test/feature-packs.test.ts:16`、`apps/web/test/feature-host.test.ts`；本子任务没有运行这些项目测试，没有运行 `npm run check:local`，没有提交/PR。物理设备检查：未执行。真实模型检查：未执行。模块 Loader/HMR 在 Mote 中的实际启用：源码搜索未见调用，不能因传递依赖存在宣称启用。

## 未知与风险

- npm 4.0.4 的准确 git 发布 commit 不可从元数据确认；官方 master 文档可能比锁定版前进，已用精确载荷控制范围。
- 上游和 fork 的完整 API/行为 diff 未做全面逐行对照，不承诺可互换；已确认源头与 fork 修改记录并核验关键生命周期源码。
- 运行时替换同版本 plugin 的旧提交隔离尚未端到端 fixture 验证。现有 version checks 不能替代 installation epoch 或显式 revoke/drain 证明。
- 无重启安装、Android/Mac 全面卸载、资料库目录统一、跨端 UI capability gating 不属于本 Cordis fixture 已证明内容，应由主报告按平台和扩展场景独立验收。


> 汇总说明：本文件保留子任务自己的验证范围；主 agent 后续在审计 commit 的隔离临时副本完成 25 项基准生成资料测试及 4 项缺口探针。同 ID/version 立即重装时旧 ProcessingRuntime 结果提交已复现。最终决策和实测范围以 [主报告](plugin-architecture-2026-10-07.md) 为准。
