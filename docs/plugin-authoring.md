# 为当前 Central 编写外部插件

本文描述 `apps/server/src/index.ts → buildScopedApp` 的多用户运行入口。
先用本页选择扩展边界，再阅读相应领域合同。可执行示例与生成数据位于
[`plugins/extension-benchmark`](../plugins/extension-benchmark/)。

## 1. 先确认能力通过哪条路径提供

| 需求 | 当前公开接入路径 | 执行范围 |
| --- | --- | --- |
| 接收、读取获授权来源，发布正式资料 | 固定 release 中的 `createMotePlugin`，`source` 组件 | 当前用户、实例快照及 `grants.sourceIds` |
| 读取原件、提交提取结果、请求现有文件流水线 | 同一 worker ABI 的 `processor` 组件 | 原件版本、来源授权、现有 ProcessingHost |
| 更换 Memory 正文、检索或引擎 | 插件中心安装，加 Memory 领域的核验、准备和绑定 | 通过 `domainProvider` / MemoryProvider；查看 [Memory 方案](plugin-center.md) |
| 新主题、布局或资料卡片 | 平台可信构建中的 PresentationHost / WebFeatureHost | [展示包合同](adr-ui-presentation-packs.md)；原生布局随客户端构建 |
| 自定义模型调用、任意 UI worker 组件 | 需要宿主已注册相应领域 adapter | manifest 中出现 `model` / `ui` 仅是声明；当前默认 Central 的通用 invoke 路径提供 source 和 processor |
| 原样加载 DeepSeek Harness 原生插件 | 当前产品没有原生包加载配置，需要宿主装配或适配器改造 | `apply(ctx)` 不能直接作为 `createMotePlugin` 的 worker release 入口 |
| 自定义周期或事件 Agent | 需要领域调度扩展点 | 内置洞察调度并未公开成通用 worker 注册接口 |

`MOTE_BACKEND_PLUGINS`、`MOTE_FILE_PROCESSOR_PLUGINS` 和旧
`POST /api/processing/workflows` 属于旧入口的扩展方式。当前多用户入口未加载这些
模块配置。旧示例可以帮助理解领域设计；新插件应从本页的 release / worker 路径开始。

## 2. 一个真实 worker 的最小结构

插件模块不导入 Mote 的私有 Store、数据库、TaskExecution 或路由代码。
宿主通过 JSON RPC 提供本次调用所拥有的方法。

```js
export function createMotePlugin(configuration) {
  return {
    components: [{
      id: 'example.source.list',
      version: '1',
      surface: 'ingress',
      capability: 'source',
      async invoke(input, host, signal) {
        signal.throwIfAborted();
        return host.call('pageOriginals', [input.sourceId, '', 20]);
      },
    }],
    async close() {},
  };
}
```

运行时代码返回的每个组件必须与 release manifest 声明的 ID、version、surface、
capability 一致。`invoke` 是实际回调，不能仅返回一份组件列表来替代实现。
`configuration` 来自用户配置实例，模型字段使用已有的 opaque 引用，不能填写 API key。

### 当前调用方法

| 组件 | `host.call` 方法 | 参数数组 |
| --- | --- | --- |
| source | `receiveCaptures` | `[sourceId, batchId, captures]` |
| source | `receiveSourceItems` | `[sourceId, batchId, items]` |
| source / processor | `readOriginal` | `[originalRef, {offset, length}]`；范围对象按需提供 |
| source / processor | `pageOriginals` | `[sourceId, after, limit]` |
| source | `publishMaterial` | `[material]`；成员和所有原始证据必须属于授权来源 |
| processor | `stageExtraction` | `[originalRef, transcriptOutput]`；返回 `{artifactId}` |
| processor | `processOriginal` | `[originalRef]`；复用当前已配置的处理流水线，返回 `{artifactId}` |
| 所有 invoke 组件 | `emit` | 一个 JSON 进度对象；这项使用对象本身，非参数数组 |

`readOriginal` 的 `bytes` 经 JSON RPC 表达为 `{type: 'Buffer', data: [...]}`。
可以用 `Buffer.from(result.bytes.data)` 恢复生成数据。显式 `length` 是准确长度，
必须不大于 `totalBytes - offset`，不会自动截到末尾。未知总长时，省略 `length`，
累计实际返回的字节数作为下一次 `offset`，直到读满 `totalBytes`。
分页必须处理返回游标；
若业务要覆盖全部授权原件，不能把一页当作全部。

`processor` 的最终返回值必须通过该领域的 `{artifactId}` 校验。
`stageExtraction` 仅提交 Transcript 类产物，复杂资料聚合应使用相应正式资料合同。
宿主负责成功事务中的发布、输入失效和任务状态。

例如，已读取并处理的简短文本可以这样提交。`originalRef` 必须来自授权原件，
`text` 是本次处理的输出；示例没有进行语义推断：

```js
return host.call('stageExtraction', [originalRef, {
  durationMs: 0,
  coverage: 'full',
  engine: 'example-text-normalizer-v1',
  segments: [{startMs: 0, endMs: 0, untimed: true, text}],
}]);
```

成功任务的 `result.artifactId` 对应
`GET /api/processing/artifacts/:artifactId` 的 `originalRef` 和 `payload`。
Transcript 的文本在 `payload.segments[].text`。资料列表返回 `{items, ...}`；
`GET /api/materials/:id/read` 返回 `text` 与含证据成员的 `spans`；
`GET /api/materials/:id/members` 的 `items` 包含 `{kind: 'capture', ref: 'capture:<id>'}`。
验证时比较实际文本和原件关系，不能只检查任务状态。

## 3. 打包和安装

发布包包含实际 JavaScript 入口与全部运行依赖，另有同一 GitHub release 中的
`mote-plugin.json`。插件中心不运行 npm 安装脚本。

```json
{
  "schemaVersion": 1,
  "id": "example.source",
  "name": "Example source",
  "version": "1.0.0",
  "runtime": "worker",
  "entry": "plugin.mjs",
  "archive": {"asset": "plugin.zip", "sha256": "<实际 ZIP 的 64 位 SHA-256>"},
  "capabilities": ["source"],
  "configuration": [],
  "dependencies": [],
  "access": ["用户明确授权的来源"],
  "components": [{
    "id": "example.source.list", "version": "1",
    "surface": "ingress", "capability": "source"
  }]
}
```

先生成 ZIP，再计算它的实际 SHA-256 填入 manifest。JSON 示例中的摘要是待替换项。
入口必须是 ZIP 内的相对路径。安装预览固定 repository、tag、commit、manifest 和
ZIP 摘要；安装时重新核验实际字节。

管理员使用 `/api/plugins/resolve`、`/api/plugins/install` 安装共享包。
普通用户配置自己的实例，不能通过请求 body 提供服务器路径或任意模块代码。
HTTP 调用采用当前登录会话；生成测试使用 client Bearer token 和
`x-mote-protocol-version: 2`，Ingress 调用另加 `x-mote-ingress-version: 3`。

管理员先向 `/api/plugins/resolve` 提交
`{"repository":"owner/repository","tag":"v1.0.0"}`，读取预览 ID，再读取
`GET /api/admin/plugins` 的 revision。随后向 `/api/plugins/install` 提交：

```json
{"previewId":"<预览 ID>","expectedRevision":0,"operationId":"<本次安装生成的 UUID>"}
```

安装的 `operationId` 必须是 UUID，例如 `crypto.randomUUID()` 的结果；普通调用的
操作 ID 使用该调用自己的合同。`expectedRevision` 使用刚读取的实际数值。
安装异步进行，继续读取管理员 catalog，
直到包的状态为 `installed` 或终止失败。`/enable`、`/disable`、`/stop` 的请求体为
`{"expectedRevision":<当前用户配置 revision>}`；断线重试沿用原来的操作身份和请求。

## 4. 配置、执行、读取是不同阶段

1. 用 `GET /api/plugins` 获取当前配置 revision 和已安装的 package ID。
2. 用 `POST /api/plugin-instances` 提交 `{instance, expectedRevision}`。
   instance 包含 `id`、`packageId`、`name`、`configuration`、`desired: false` 和
   `grants: {capabilities, sourceIds, history}`。
3. 对 `/api/plugin-instances/:id/check` 发送空对象，再查看实例的各个 capability 状态。
   `checked` 记录代码描述与配置的核验结果；运行能力由实际领域 adapter 提供。
4. 用当前 revision 调用 `/enable`，然后向 `/snapshots` 提交 `{}`，得到固定运行快照。
5. 向 `/api/plugin-snapshots/:id/invoke` 提交
   `{componentId, payload, operationId}`，通过 `GET /api/tasks/:id` 读取结果。
6. 插件调用 `publishMaterial` 后，用正式 `/api/materials` 与
   `/api/materials/:id/read` 读取结果，并校验它的证据成员。

安装、check 和 enable 都不表示业务回调已经执行，也不会授权历史扫描。
验证插件时必须看到实际任务结果，以及它在正式资料或对应领域中的持久结果。

## 5. 生命周期和升级

| 操作 | 行为 |
| --- | --- |
| pause / disable | 关闭新快照准入；已授权快照中的工作按现有排空语义继续 |
| stop | 撤销实例 generation，拒绝旧调用的发布，退休相应 worker |
| 取消单个 task | 撤销该任务的继续执行与提交权；基线 worker 尚未转发单次调用的 AbortSignal，合作式取消是已复现的待修项 |
| 更新配置或安装新版本 | 新快照使用新配置与固定包；保留旧快照引用的准确版本 |
| 释放 snapshot | `DELETE /api/plugin-snapshots/:id`，结束其读写引用 |
| 卸载 package | 先解除实例和在途快照引用；历史资料删除是另一项操作 |

停用实例后的新快照请求返回 `409`；stop 后使用已撤销快照返回 `401`。

不要在插件中建立第二套队列、用户身份或发布权威。插件可以复用宿主已授权的
回调；跨源读写仍须逐个来源授权。子进程运行的是受信代码，拥有宿主进程用户的
文件和网络权限，安装者需信任发布方。

## 6. 本地生成数据验收

```sh
npm run build:libs
node --import tsx --test apps/server/test/extension-benchmark-*.test.ts
```

生成 release transport 替换下载网络；ZIP 展开、摘要核验、真正的子进程、Accounts、
用户 API、任务引擎和原件/资料存储仍执行。示例中的 mock 仅用于明确标注的模型
输出，不能将 registry-only fixture 当成全链路成功。

维护规则和五轮记录见 [扩展能力实验](validation/plugin-extension-benchmark/plan.md)。
更底层的运行合同见 [多用户插件领域](design/multiuser-plugins.md)。
