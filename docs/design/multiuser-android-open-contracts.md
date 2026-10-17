# M15 原能力的剩余共同接缝

这是有限消费对照，不是完成声明、产品删减或新的授权。发现基线为 M11最终
`98d76945e091d7234217ebcf532ebeff3350937c`；已完成边界和真实验证见
[Android 账本](../validation/multiuser-android.md)及
[最终矩阵](../validation/multiuser-android-final-matrix.md)。共享 SQLite、服务和单执行器
不变；不恢复全局 owner 路由、另建配置仓库或按用户启动运行时。

## 模型预设原控制

原 `CentralAdmin.models` 的复制按钮位于 `!readOnly` 条件之外，旧部署预设也可复制。
原消费者是：

- `POST /api/model-settings/profiles/:id/copy`，`revision,id,name,includeCredentials`；
  默认 includeCredentials=true。原 ModelSettingsStore 保留未展开的 apiKey/headers/
  extraBody 表达式；false 时清除三者，不能重复插值。
- `POST /api/model-settings/profiles/:id/test`，携带 revision 与当前 clean settings；
  原宿主从同一已存预设补齐隐去的秘密，复用原连接/网络探测算法。
- `GET /api/model-settings/profiles/:id/models`，使用真实已存预设，原 providerModels/
  codexModels 目录；原系统也有 draft POST 变体。

当前 M15 使用 M04 `/configuration` 及 models 域 CAS/显式 masked-secret 保留。
复制、探测、目录没有已冻结的等价公共入口，UI 明示缺口；Ask 选模型和临时覆盖
不是这三项能力。公共实现应复用 M04 的原主配置、事务与完整个人/共享模型引用。
共享资源仍是不透明、可撤销引用：不能在 Android 将共享密钥克隆成不受原授权
约束的个人秘密。原 readOnly-copy 的映射需要在共同契约中明确，不能由客户端猜。

验收保留 A/B 同预设 ID、不同未展开表达式、include true/false、旧 revision409、
实际 probe/model-directory 的 await 后撤权及 B 正例。只用生成 loopback provider，
不访问真实模型/账号。契约冻结后恢复原 native 控制，固定 Api/revision/owner，
原 helper 单独通过不能替代实际按钮链。

## Agent 首次上下文与已记录事件

原 native `CentralAdmin.agent` 仍有两个真实入口：
`POST /api/agent-view/startup {question,timeZone}` 与
`GET /api/agent-view/events?afterSeq=0`。当前真实 scoped 路由探测对 member/admin 均为
503；已有 catalog/material-read/context canonical expansion 通过不能替代它们。

KEEP 首次上下文是预览，不进行模型调用；历史只显示真实已记录 trace，不能重建
提示词冒充历史。公共实现应复用 M08/M07 真实上下文、记录和依赖复查，不能借
旧全局 trace bus 或用普通 raw capture fallback。每个 await 后以及返回前保留
原 owner/来源/版本授权；新会话不得接收旧 A 的提示词或记录。准确 DTO/入口由
公共 owner 冻结后，M15 沿原问题输入、首次上下文和实际读取记录控件做薄适配。

## Files/Imports 处理方案

Joint 唯一负责原 named profiles、source/MIME/default 规则、original-only archive、
processor 参数/recipe、已保存服务检测、未完成 fingerprint reconciliation、
显式 preview/reprocess 与 import imageProfileId。有限公共2528/source519已消费；
其 policy WIP 不是可用合同。原件保存、正文处理、索引及 Memory 就绪仍分别呈现。
不能将 profileId 当 modelId，也不能在默认任务已准入后才补写用户选定方案。

M15 保留原处理设置和 Import 入口；共同 schema/路由及实际执行冻结后，复用
现有 M04 CAS、M05 task、M03 原件/附件与 M06 发布，不另造后台或返回假成功。
Web-only acoustic/term-review 控件不是98d原 Android UI，但其现有导出内容和共同
执行合同仍应保留。原 native 的 cancel/retry/delete/play/save/correction/speaker/
export 已有当前实际验收，不能因这些通过而把方案缺口标为完成。
