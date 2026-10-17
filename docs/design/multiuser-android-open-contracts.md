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

当前已组合 M13 独立公共 `c4e42220`（含 Codex 每次物理 RPC 前的授权复查）。
准确 DTO 见 [模型接口](multiuser-model-tools-http.md)：个人复制走
`POST /api/models/profiles/:id/copy`；探测和目录走 `/api/models/probe`、
`/api/models/catalog`，固定已保存的完整个人/共享引用及 M04 revision。
`GET /api/models.features` 给出权威功能列表；原“功能默认模型”可显式绑定或清除，
空配置不预选，失效引用保留为明确的不可用选项。保存仍沿原 M04 域 CAS。

KEEP 个人复制默认包含自己的原始秘密，false 清除 apiKey/headers/extraBody，
不会从显示掩码重建秘密；目录完整分页，探测使用生成的只读上下文且不准入 Ask/M05。
CHANGE 个人环境变量表达式不再执行；共享连接仍是不透明、可撤销引用，不能复制
其端点或秘密成为个人连接。该约束来自已定 M04，不由 Android 发明替代授权。

实际原生9852/cc3已恢复原复制/探测/目录控制，生成 provider 完整用例1/1通过，
覆盖 include true/false、真实工具/引用探测、两页目录、A 等待→B 退休和 B 新操作。
原空 Chat 默认选择用例 RED→6f4ac791 GREEN，保留已失效 Memory 引用、其他默认值、
预设及 B 状态，不调用模型。精确版本和日志见账本；最终 JVM/build/独审/affected
仍独立验收，不能仅据共享 helper 或页面可见性宣布全模块完成。

## Agent 首次上下文与已记录事件

原 native `CentralAdmin.agent` 仍有两个真实入口：
`POST /api/agent-view/startup {question,timeZone}` 与
`GET /api/agent-view/events?afterSeq=0`。旧探测对 member/admin 均为503；当前已组合 M13独立245308de及
后继ddc64fe9，原生c706d743已恢复个人记录开关和不透明游标历史。实际
startup/traces/relogin三项后端与两项原生都通过；精确证据见账本。此前
catalog/material-read/context canonical expansion 通过不曾替代缺失入口。

KEEP 首次上下文是预览，不进行模型调用；历史只显示真实已记录 trace，不能重建
提示词冒充历史。公共实现应复用 M08/M07 真实上下文、记录和依赖复查，不能借
旧全局 trace bus 或用普通 raw capture fallback。每个 await 后以及返回前保留
原 owner/来源/版本授权；新会话不得接收旧 A 的提示词或记录。准确 DTO/入口见 multiuser-agent-http.md。M15现沿原问题输入、首次上下文和
实际读取记录控件薄适配；默认关闭，显式本人M04 CAS，关闭不伪造或删除已保留
历史。实际旧查询等待→logout/relogin→原生关闭记录→继续完成但不再带payload
已验证。最终门禁和任意深度payload呈现不由该有限证据代替。

## Files/Imports 处理方案

Joint 唯一负责原 named profiles、source/MIME/default 规则、original-only archive、
processor 参数/recipe、已保存服务检测、未完成 fingerprint reconciliation、
显式 preview/reprocess 与 import imageProfileId。有限公共2528/source519已消费；
其后明示有限检查点a2cbf3aa已组合供原Files设置消费者实现；当前
GET/PUT及预览/显式重处理的准确边界见multiuser-file-processing-contract.md，
未冻结的健康探测/root/import指定方案等仍非可用合同。原件保存、正文处理、索引及 Memory 就绪仍分别呈现。
不能将 profileId 当 modelId，也不能在默认任务已准入后才补写用户选定方案。

基线98d的 Files→处理设置并非普通 processing 域表单：它读取
`GET /api/file-processing`，提交 `{revision:string,settings,policy?}`，只在
policyConfigured 时带原 policy；根设置页另有 `/api/processing/settings`。
当前 native `fileSettings` 已恢复这个原入口及 advanced JSON 数组编辑。
已保存 graph 使用 `/api/file-processing` 全图 CAS；未配置 graph 的标量保存使用
现有 `/api/configuration/processing`，与前者共享同一个 M04 revision。这是发送前
按 `policyConfigured` 选择的准确域映射，不是400后重试、自动启用候选 graph 或
另建配置库。实际并发 graph 新建后旧标量 revision409，原完整 native 用例通过。
之前严格 PUT 缺 policy 的400已保留为历史错误消费证据，不再列作后端阻塞。

精确98d原 Android 没有 test-local、imageProfileId、preview/reprocess 等专用控件；
这些 Web 页面不能自动扩大为新的 Android UI。原 advanced graph 的参数与 recipe
执行、恢复和共享配置变动仍必须依照共同 producer 的明确冻结边界，不能由可编辑
JSON 或本地成功保存推断后台能力完成。

M15 保留原处理设置和 Import 入口；共同 schema/路由及实际执行冻结后，复用
现有 M04 CAS、M05 task、M03 原件/附件与 M06 发布，不另造后台或返回假成功。
Web-only acoustic/term-review 控件不是98d原 Android UI，但其现有导出内容和共同
执行合同仍应保留。原 native 的 cancel/retry/delete/play/save/correction/speaker/
export 已有当前实际验收，不能因这些通过而把方案缺口标为完成。

当前有限共同消费点已扩展到 Joint runtime `50304300` / 文档 `b7a408e4`，
原 wire 不变：root/attachment 允许已保存或显示默认处理 profile；Import 的
imageProfile 只作用于已确认图像；local health 只接已保存 serviceId 并 GET/health，
个人方案历史只恢复数据、不恢复任务或授权。M15 已只读复审并组合，相关构建、
原生入口和最终 affected 另验。已安装自定义 image recipe、instance/shared/component
启动观察和最终公共组合仍 OPEN；此点仍是有限 PREP，不能据配置保存宣布闭合。
