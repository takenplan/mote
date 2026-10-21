# 中央文件类型策略

在中央网页进入 **设置 → 文件与语音**。本文描述当前账号的策略；实例共享 media 的安装与管理员共享连接另有权限边界，见[配置归属](configuration-ownership.md)。

## 用户配置

1. 在“服务连接”中填写自己的服务名称、类型、运行位置、地址和密钥，或选择管理员提供的共享连接。同一服务可供多个方案复用。个人端点和密钥属于本账号 `models.profiles`，策略服务保存固定 `{kind:personal|shared,id}` 引用；普通用户不能读取共享密钥。远程服务必须显式选择远程 HTTPS；本地服务只允许中央本机的回环地址。录音服务遵循 Mote 的二进制转写协议，不是任意厂商 ASR 地址的直接替换；厂商协议可通过适配服务或 Cordis 插件接入。
2. 在“处理方案”中选择插件、绑定服务，并设置参数。可复制“本地多人录音”，分别建立“两人电话”和“四人访谈”：两个方案使用同一本地转写服务，各自保存说话人数。语义分组、摘要和人工校正建议可选择本地或远程语言模型；未选择独立模型时使用中央文件分析模型。关闭这些可选步骤仍可完成转写、分离和时间对齐。
3. 在“类型策略”中将录音、图片、文本、PDF 或精确 MIME 类型绑定到方案。没有合适插件的类型保持“仅归档原件”。本期内置 UTF-8 文本、PDF/DOCX/XLSX 文档提取、录音接口、本地多人录音、图片文字接口与本地说话人分离。`document.generic` 读取 PDF 文本层、DOCX 段落和 XLSX 单元格，不做扫描件 OCR 或公式重算；无文本层或超限会明确报告覆盖限制。
4. 在“来源覆盖”中选择来源和类型。例如手机录音目录的 `audio/*` 使用“四人访谈”，同目录 `image/*` 仍使用全局图片方案。
5. 保存后，可通过 MIME 类型试算命中规则；文件详情显示实际执行的配置版本、规则、方案和参数，也显示按照当前设置重新处理会选什么。

匹配顺序：来源精确 MIME → 来源类型通配符 → 来源全部类型 → 全局精确 MIME → 全局类型通配符 → 全局默认。相同来源和类型只能有一条规则。规则只匹配用户指定的 MIME 元数据，不根据内容猜测语义或主题。

密钥不会回传网页。保留本账号原连接密钥遵循同 ID、revision 的遮罩草稿合同；更换 provider、协议或地址时必须重新填写、清除，或明确确认复用自己的旧密钥，不能从共享连接复制秘密。已完成文件记录服务身份快照，服务地址或模型发生变化时，历史分析会等待明确重处理，不会自动转交新服务。

## 保存和重处理

保存影响新文件与未完成任务，不自动重新提取已完成文件。单文件可以在详情中重新提取或重试某一步。已有文件批量重处理分两步：

- 先选择来源和类型预览，查看本批标题、命中规则和方案；每批最多 100 份当前版本原件。预览扫描最多 1,000 份候选，达到上限时提示缩小范围。
- 点击“确认重新处理”后才入队。10 分钟内有效，配置版本或文件任务状态改变后必须重新预览。只处理预览中列出的文件；排除 Shadow、仅归档和活动任务。

重新提取生成新的派生结果，旧校正标为过期，原件继续保留。原件被手机删除不删除中央归档；这里只配置处理策略，采集方式、增量/回填和手机暂存清理由同步配置管理。

本地多人录音的文字正常进入配置的向量索引、Memory 和问答。所有支持摘要的方案都由摘要开关决定是否生成摘要，未选独立模型时继承中央文件模型设置。说话人仍匿名，名称、术语与场次需要用户确认。

## 开发者扩展

当前外部扩展通过固定 release / worker 的 `processor` 组件读取获准原件、提交提取产物或请求现有流水线，见[插件作者指南](plugin-authoring.md)。宿主保持原件授权、方案、M05 执行和最终发布；网页不会直接执行任意处理器代码。

下面保留旧单所有者 Cordis 模块的注册示例，便于理解内置处理器的领域契约；`MOTE_FILE_PROCESSOR_PLUGINS` / 旧 `fileProcessorModules` 未由当前 `buildScopedApp` 加载，不是现行安装步骤。

```ts
ctx.effect(() => ctx.moteFileProcessors.register({
  id: 'example.pdf', name: 'PDF 文本提取', version: '1',
  stage: 'extract', mediaTypes: ['application/pdf'],
  serviceKind: 'file', // 可选：asr / image / file；纯本地代码可省略
  parameters: [
    { key: 'maxPages', label: '最多页数', type: 'number',
      min: 1, max: 500, integer: true, default: 100 },
  ],
  async process(input) {
    // input.parameters: 当前方案的参数；不读取其他方案。
    // input.settings.endpoint / apiKey: 当前方案绑定的服务。
    // input.signal: 取消和超时；readOriginal(): 原件字节流。
    return { durationMs: 0, segments: await extractPdf(input) };
  },
}));
```

参数声明支持 string / number / boolean、枚举、默认值、可空、数值范围和整数。服务端验证参数与类型兼容性，网页按声明生成表单。秘钥放服务，不放 parameters。处理器返回共享 Transcript 契约；非音频使用零时间，代码负责可靠提取，内容理解由模型完成。

内置处理器的 `ProcessorInput.settings` 提供所选服务的执行配置，`parameters` 提供所选方案参数。独立分析模型服务通过 `modelServiceId` 选择完整 personal/shared 连接，按该连接实际声明的语言模型协议进入现有 Harness；不限定为 OpenAI Completions，媒体协议 `mote-media` 不能用于语言分析。未选独立模型时使用固定的文件模型引用。本地多人录音保留转写 → 分离 → 对齐 → 可选语义分组流程，执行位置不限制派生文字的模型使用权限。

## 配置与 API

- `GET /api/file-processing`：当前账号脱敏 settings、有效 policy、policyConfigured、models、处理器/能力元数据及字符串 revision；未显式保存时展示按当前选择生成的默认策略。
- `PUT /api/file-processing`：`{revision, settings, policy, models?}`，乐观并发控制；可在同一事务保存本账号服务连接、运行设置及策略。`policy.services` 只保存完整模型连接引用。
- `POST /api/file-processing/match`：`{sourceId, mimeType}`，只试算已保存规则。
- `POST /api/file-processing/preview`：`{revision, sourceId?, type?, profileId?}`，返回有时限的一次性 token 和范围。
- `POST /api/file-processing/reprocess`：`{token}`，按预览范围入队。
- `GET /api/files/:id`：包含 `processingPolicy.applied/current` 和 `capabilities`；详情操作按对话、摘要能力展示。导出 manifest 也包含实际方案快照，无密钥。

当前配置在 `DATA/configuration/users/<账号 ID>/mote.yaml`：运行字段为 `processing`，策略为 `filePolicy.policy`（version 1），连接为 `models.profiles / selections`。初始 `filePolicy.policy` 可为 null，读取时按当前模型选择与运行设置生成有效默认策略；显式保存必须提交完整 policy。旧 `file-processing.json`、旧 `processing.settings / policy` 和旧全局服务副本不作为账号配置的兼容读取路径。中央基线为 epoch 5；旧库拒绝启动。任务固定实际方案、完整连接引用/指纹及原件身份，配置变更不改写已完成的历史计划。

## 验证

`apps/server/test/file-policy.test.ts` 保留旧宿主的策略/参数/Cordis 算法回归，不能单独证明当前账号配置、授权或 API 合同。当前入口与 Files 的实际验证范围见[Files 平价记录](validation/parity-files-2026-10-18.md)和[配置资源记录](validation/configuration-resources-parity-2026-10-18.md)。下列旧 runner 使用前需核对其 fixture 入口；本文修订没有重新运行测试。

可用隔离测试中央与生成的 Android 文件执行：

```sh
MOTE_FILE_TEST_DIR=<测试目录> node --import tsx scripts/verify-file-sync.ts --live-model --policy
MOTE_FILE_TEST_DIR=<测试目录> node --import tsx scripts/test-file-dialogue.ts <合成录音.wav>
```

前者需要已生成的模拟器结果和显式真实模型配置；后者需要本地 ASR/分离模型。fixture 测试、真实模型测试、模拟器与真机验证应分别报告。

## 可选声纹模型与单文件范围

`audio.diarize-wespeaker@1` 使用独立安装的 WeSpeaker 中文模型。下载不更改默认分离插件。人数参数支持未知（全部留空）、准确人数（`speakerCount`），或已知范围（`speakerMin` 与 `speakerMax`）；准确人数和范围互斥，范围仅供该插件使用。候选评分不是概率，匿名标签也不是已确认的真人身份。范围估计保留候选和版本，仍需试听。

文件详情的“单文件分人设置”复用原始转写，只重新分人与对齐，不改变其他文件的配置。原始与历史产物保留，旧名称确认不会自动套用到新声纹标签。快照来源仍需要有效临时输入；不会因单文件重处理变成长期归档。展示合并可展开每个原始片段，校正和引用继续指向原坐标。

`POST /api/files/:id/retry` 的 `stage:"diarize"` 可携带 `diarization:{artifactId,options:{processor,speakerCount,range}}`；`artifactId` 为当前原始转写，`processor` 为 `audio.diarize` 或 `audio.diarize-wespeaker`，`range` 为 `{min,max}` 或 null。`options:null` 清除此文件覆盖。仅当前账号可提交自己的文件，活动/未知调用仍遵循现有保护。CLI `media-import --role speaker-wespeaker --from DIRECTORY` 验证固定目录中的 `speaker.onnx` 后安装，不下载 ASR 或改选默认方案。

行为边界和验证见 [声纹范围 ADR](adr-speaker-range-and-display.md) 与 [验证场景](validation/speaker-quality-range.md)。
