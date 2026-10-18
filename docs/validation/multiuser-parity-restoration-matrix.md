# 多用户功能对标修复：逐项验收矩阵

日期：2026-10-18。管理、owner/branch/PR/候选/依赖接缝与检查排队见[集成计划](../design/multiuser-parity-restoration-plan.md)。这是验收合同和当前空台账，不是通过记录。

## 数量、状态与证据

核心 58 项：MEM 8、FILE 6、ASK 5、CONN 7、EXEC 3、CONFIG 7、DESKTOP 4、AND 4、WEB 2、EXT 3、ACTION 4、LIFE 5。补充 6 项：EXEC-S01、EXT-ES01/ES02/EC01、LIFE-L06、AND-D01。另列 FILE-07 旧缺陷与 CONFIG-UX01 原未编号体验差异，共 66 个唯一跟踪行；后两项不偷换58项范围。

每行继承计划的模块登记（owner chat / branch / PR / 独立验收 chat / 候选 SHA）；未填为尚无候选。`C/N/R/S/U/OLD` 见计划证据定义，均描述起点审计，不是本轮修复结果。每行末列同时保留本轮证据、未验证与阻塞，不能用 audit evidence 关闭。

所有核心行初态 OPEN：本轮实现证据=无、运行验收=UNRUN、独立验收/PM释放=无，等待模块候选。每次更新须提供精确源码 SHA、实际命令/入口/输入、结果、回执/日志定位、消费者与未验部分。模块登记与该行共同构成完整记录。

## 全部行共用的验收前置

- 生成素材、独立空当前格式profile与loopback服务；不读取或传输真实个人截图，不部署、不重跑个人历史。
- 从真实 production HTTP/应用/客户端生命周期入口开始；同外部ID/设备ID/幂等键/相同字节双用户正负例；不能只调用内部组装路径或旧legacy fixture。
- 相关flow至少覆盖正常、合法空、单项失败、retry/restart、暂停/取消、来源或账号撤权/删除、配置变化、迟到结果；保留成功兄弟与unknown事实。高风险积压、跨天、A→B→A等多状态组合单列，不能被pairwise删除。
- 用户语义由模型解释，修复检索/上下文不加词表路由；不新增上限、手工恢复步骤、静默降级或自动付费历史处理。
- 模块PR聚焦检查与check:affected先dry-run排期、按原范围执行；最终组合仅集成driver运行。隐藏UI/无窗口模拟器为默认，原生权限、前台交互、真实设备/模型另记。

## 核心58项

### MEM

原审计：`memory.md`；模块元数据继承计划中 `MEM` 行。

| 编号 | 起点证据 / 优先级 | 原行为恢复目标 | 依赖 | 具体验收要求 | 审计证据定位（非本轮通过） | 本轮证据 / 未验证 / 阻塞 |
| --- | --- | --- | --- | --- | --- | --- |
| MEM-M01 | C / P1 | 完整提取输出合同 | CONFIG | 默认个人 v5 及依赖宿主格式的配方经真实提取入口捕获请求；提取与独立审核均含同一完整字段/引文/coverage 合同及示例，保持不可变策略版本。 | M01；静态调用链；窄测试加载失败 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| MEM-M02 | C / P1 | 同任务主动补读 | ASK / FILE | 跨批年份/本人/续文缺口由提取和独立审核通过 context_evidence 读取同任务已授权原件；记录精确披露依赖；跨账号/未授权范围拒绝。 | M02；静态装配与工具门控 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| MEM-M03 | C / P1 | 未完成评估与同任务重试 | EXEC | 分别覆盖incomplete、漏coverage、合法no_candidates及incomplete+部分候选；未完成范围不得提前正式发布或成功结算，成功兄弟保留，同job retry只补缺口不重放成功；重启可恢复，取消不续跑。 | M03; static extraction-review-publish-retry chain | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| MEM-M04 | C / P1 | 自动双域整合 | EXEC | 一次提取产生合法 personal/coding 卡；自动按卡实际域分别整合并保存独立检查点，改变 settings.profile 不遗漏另一域，手工范围保持。 | M04；静态 SQL/分组 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| MEM-M05 | C / P2 | 整合仅已选长期 Memory | — | 日常 observation 不计入自动整合 minChanges 或发送给整合模型；selected Memory 保持原触发与独立审核；不新增观察转长期产品。 | M05；静态输入谓词 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| MEM-M06 | C / P1 | Coding 理解准备与 work/event 产物 | FILE / EXEC / ACTION | Coding 导入→清洗原文→独立会话理解→workRecords/events 及理解引用→Memory 提取/独立审核；失败/重试/重启保留阶段；actionCues 仍为空。 | M06；真实旧/新 composition | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| MEM-M07 | C / P2 | 引文错误顺序与安全诊断 | CONFIG | 错误 quote、offset 与 coverage 归属分别触发原反馈顺序；安全诊断有 phase/run/candidate/span/field/尝试信息，无原文或秘密；审核失败不抹提取成功。 | M07；静态 validator/诊断链 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| MEM-M08 | R / P2 | 持续模型积压下及时发布 | EXEC / CONFIG | 生成持续 eligible 模型工作并持有慢模型；已独立审核结果在积压未清空时仍可发布/查询，记录时序与配置并发；每用户仍单 publisher，未知外部结果不重放。 | M08；资源与跨池顺序推导，未测饥饿 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |

### FILE

原审计：`files.md`；模块元数据继承计划中 `FILE` 行。

| 编号 | 起点证据 / 优先级 | 原行为恢复目标 | 依赖 | 具体验收要求 | 审计证据定位（非本轮通过） | 本轮证据 / 未验证 / 阻塞 |
| --- | --- | --- | --- | --- | --- | --- |
| FILE-01 | C+N / P1 | 权威设备与资料时间投影 | ASK / MEM | 旧日期资料今日上传/处理后，经真实 Files→Material→Ask/Memory 按原设备/原日期可发现；接收/处理时间分开，重启与修订仍保留权威 origin。 | FILE-01；生成 SQLite 谓词 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| FILE-02 | C / P1 | 原件归档与处理方案分离 | MEM / CONFIG | archive 保留+OCR/理解与真实 archive-only 成对覆盖；慢图片步骤期间父资料不提前 ready，理解与原图组合保留；补自定义 image:<step> recipe+caption。 | FILE-02；静态父组合/readiness | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| FILE-03 | C+N / P1 | 原位置缺失仍可读中央归档 | LIFE / DESKTOP / AND | 本轮fresh及新portable闭环：归档→deleted revision/无原件新head→列表/旧详情/播放/导出仍达最后归档版并显示originMissing，forget/disable拒绝。当前epoch5既有deleted且无持久head身份不回填/猜排序，明确未修边界，不能声称其列表已恢复。 | FILE-03；生成 Files JOIN | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| FILE-04 | C+N / P2 | reference/Shadow 元数据目录 | DESKTOP / AND / EXT | 仅文件信息扫描/上传 ACK 后 Files 列表与详情可见，hasOriginal=false/不可下载/不处理表达准确；同 ID 另一账号不可见。 | FILE-04；生成 Files JOIN | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| FILE-05 | C / P2 | 管理员目录预览确认导入 | CONFIG / EXT | 生成独立目录经管理员原目录入口→遍历/预览→明确确认→SourcePack/导入；普通用户拒绝，symlink/资料库交叉路径保护保留；单文件 host-import 不能替代。 | FILE-05；静态 request.directory 403 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| FILE-06 | C+N / P2 | 按相对路径搜索文件 | DESKTOP / AND | 多个同名 note.txt 分属不同目录；标题与 relativePath 均按原字面搜索并保持账号/游标范围；路径独有命中可见。 | FILE-06；生成 SQL title/path | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |

### ASK

原审计：`ask.md`；模块元数据继承计划中 `ASK` 行。

| 编号 | 起点证据 / 优先级 | 原行为恢复目标 | 依赖 | 具体验收要求 | 审计证据定位（非本轮通过） | 本轮证据 / 未验证 / 阻塞 |
| --- | --- | --- | --- | --- | --- | --- |
| ASK-A01 | R / P1 | 目录元数据独立依赖与发布 fence | FILE / CONN | 仅 sources/devices 目录读取→provider await→删除/停用/改名或相关说明改变→发送/保存前复核旧元数据；纯 lastSyncAt 心跳不撤销；精确说明读取另有 pin。 | A01；高置信静态链，竞态未运行 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| ASK-A02 | C / P1 | 账号语义/混合召回与相关度 | CONFIG / EXT / FILE | 配置 embedding 的账号经生产入口写入生成语料后 semantic/hybrid/ranked 检索可达；候选隔离、rank/coverage/degraded 如实报告；未配置保持原行为，不启动历史收费回填。 | A02；静态 producer/reader 缺口 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| ASK-A03 | C+N / P2 | 说明发现及 preview | CONN | 来源名不命中而说明独有命中时可发现，返回原命中 preview/长度及 exact ref；读取精确版本，账号隔离，不引入词表路由。 | A03；生成说明匹配 SQL | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| ASK-A04 | C / P2 | 确定失败轮次历史与重试 | WEB / EXEC | 问题确定失败→离开→重开对话仍显示原问题/失败轮次并能再次提问；取消/超时失效 grant/撤权后的迟到成功不写为完成。 | A04；静态 producer→GET→UI | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| ASK-A05 | C+N / P2 | 外部显式响应分页 | EXT | 经外部Context/MCP验证browse聚合导航collections、search稳定枚举、retrieve相关排序且拒绝cursor，并请求显式maxCharacters；长记录截页/续页和truncated正确。内部Ask仍无字符配额，bundle保留独立合同。 | A05; extracted queryPage over maxCharacters with truncated=false | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |

### CONN

原审计：`connectors.md`；模块元数据继承计划中 `CONN` 行。

| 编号 | 起点证据 / 优先级 | 原行为恢复目标 | 依赖 | 具体验收要求 | 审计证据定位（非本轮通过） | 本轮证据 / 未验证 / 阻塞 |
| --- | --- | --- | --- | --- | --- | --- |
| CONN-C01 | C / P1 | 故障后持续周期发现 | EXEC | 真实 scoped sync→生成 429/503/网络终态→网络恢复→未来 poll 继续；重启仍继续周期责任，暂停/撤权停止，unknown 外部副作用不盲重放。 | C01；静态 successor/schedule | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| CONN-C02 | C / P1 | 原后台同步开关生效 | WEB / CONFIG | 录音与 Lark autoSync=false→保存→一次手动同步→跨原 poll 周期不自动读；开启则恢复原周期；connection 生命周期作为权限门而不吞用户开关。 | C02；静态 selection/connection 失配 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| CONN-C03 | C / P1 | Lark 自动来源与预览确认 | FILE / WEB | 已有日历/旧范围周期→新文档范围只预览→后台 poll 不 confirm/归档新正文；明确手动确认后才按原行为同步，automatic=true 来源准确。 | C03；静态 startSync 参数 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| CONN-C04 | C / P1 | 单录音规范正文与证据图 | FILE / MEM | 多段录音经真实 sync→处理→Memory intake 只形成一份规范语义全文，精确 segment locator/raw export/音频关系保留；缩短/empty/unsupported 修订与历史不回退。 | C04；静态 N+1 producer，未测产卡数 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| CONN-C05 | C / P1 | 录音原专用配方安装绑定 | MEM / CONFIG | 枚举原 recording v3 提取/审核配方；新录音来源默认正确绑定，显式覆盖保留；请求捕获确认非 generic personal，不重做历史任务。 | C05；静态安装/默认绑定缺口 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| CONN-C06 | C / P2 | 选择变化复用已确认音频 | FILE / LIFE | 同账号已备份→改变仍包含录音的选择/autoSync→再次同步 provider.media 调用不增加；当前账号/source/媒体身份及撤权检查有效。 | C06；静态 existingMedia=undefined | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| CONN-C07 | C / P2 | 独立阶段状态和重试时间 | WEB / AND | 生成 metadata/transcript/audio 各阶段独立失败与不同重试时间；真实页面显示正确 phase/state/error/nextAttemptAt，成功兄弟不被 aggregate error 覆盖。 | C07；服务端事实→Web 类型/渲染漏接 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |

### EXEC

原审计：`execution.md`；模块元数据继承计划中 `EXEC` 行。

| 编号 | 起点证据 / 优先级 | 原行为恢复目标 | 依赖 | 具体验收要求 | 审计证据定位（非本轮通过） | 本轮证据 / 未验证 / 阻塞 |
| --- | --- | --- | --- | --- | --- | --- |
| EXEC-X01 | C+N / P1 | 业务 Operation family 与增量更新 | WEB / MEM / FILE / ASK / ACTION | 各域后台运行→完成产生原业务 kind/filter 与变化通知；已打开的相应页面自动失效更新，同 ID 双用户不互读；不能靠全量 reset 代替。 | X01；函数抽取 feed+generated-kind SQL | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| EXEC-X02 | C+N / P1 | 交互与后台独立 lane | ASK / CONFIG | 生成持续慢后台 Insight 占满背景名额时聊天仍能用原交互 lane；账号公平保留，等待模型 gate 不先占掉聊天机会；记录派发时序。 | X02；静态链+limit 函数 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| EXEC-X03 | C+N / P2 | 有效并发配置驱动执行 | CONFIG / MEM | 热更新原交互/后台/Memory 并发到允许值后生产池实测生效，配置8不被隐藏 fixed2 截断；资源真实互斥仍保留并可诊断。 | X03；抽取 limit 配置8→2 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |

### CONFIG

原审计：`configuration.md`；模块元数据继承计划中 `CONFIG` 行。

| 编号 | 起点证据 / 优先级 | 原行为恢复目标 | 依赖 | 具体验收要求 | 审计证据定位（非本轮通过） | 本轮证据 / 未验证 / 阻塞 |
| --- | --- | --- | --- | --- | --- | --- |
| CONFIG-C01 | C+N / P1 | 个人目标改变与秘密复用确认 | WEB | 保存过生成 key/敏感 headers/body 的个人连接→修改 provider/protocol/baseUrl→未确认复用必须按原提示处理；确认/重填/清除路径正确，无真实网络或秘密回显。 | C01；retainViewSecret 函数抽取 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| CONFIG-C02 | C / P1 | Codex 探测与业务统一运行配置 | ASK / MEM / FILE / EXT | 配置生成 executable/home 进程 fixture；目录/探测/Ask/Memory/分析/复核/导入及相关 provider 路径均使用固定实例 runtime，不回落默认登录；真实 Codex 另列。 | C02；静态 runtime 注入分岔 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| CONFIG-C03 | C / P2 | 用量统计、分页与价格入口 | WEB | 日期/时区/from-to、Agent/模块/Skill/provider/model/status 过滤、分组/汇总/facets/下钻/分页及价格编辑用原界面可达；双用户数据不混；价格快照保留。 | C03；静态 query/页面退化 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| CONFIG-C04 | C / P2 | 个人草稿目录/探测后保存 | WEB | 未保存个人 endpoint/key 草稿→目录/测试→选模型→保存；探测不改有效配置；错误草稿不影响在途工作；shared 引用仍禁任意 caller target/key。 | C04；静态 dirty 阻挡 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| CONFIG-C05 | C / P2 | 普通配置新版本与真正撤权分开 | EXEC / ASK / MEM | 在途/yield 任务期间普通 maxTokens/reasoning/timeout 更新：原快照可完成，后续用新值；删除/撤回资源/凭据则拒绝旧 lease，重启仍精确校验。 | C05；静态全 settings hash 撤权 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| CONFIG-C06 | C / P2 | 个人每功能独立模型选择 | WEB | 一套个人 endpoint/key 保存一次，聊天 model A、Memory model B 持久选择并执行；不复制连接/凭据；shared 管理员固定完整引用权限保持。 | C06；静态 selection/schema/UI | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| CONFIG-C07 | C / P2 | 入口明确用量归属 | FILE / MEM | 生成文件分析/复核/导入真实入口执行后收据 Agent/module/skill 与原归属一致，operation/account 独立；不按内容推断，真实历史未知仍未知。 | C07；静态 attribution 缺口 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |

### DESKTOP

原审计：`desktop.md`；模块元数据继承计划中 `DESKTOP` 行。

| 编号 | 起点证据 / 优先级 | 原行为恢复目标 | 依赖 | 具体验收要求 | 审计证据定位（非本轮通过） | 本轮证据 / 未验证 / 阻塞 |
| --- | --- | --- | --- | --- | --- | --- |
| DESKTOP-D1 | C+N / P1 | 文件逐项 ACK/拒绝/暂时失败 | FILE / EXEC | source scan→同批 ok/409/410/暂时失败/later；已成功逐项结清、永久拒绝按版本隔离、无关项继续；重启不丢 ACK，不改 ID/前驱覆盖中央。 | D1；生产 sendBatch 合成 seam | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| DESKTOP-D2 | C / P1 | 跨24小时会话与 durable ACK 恢复 | FILE / LIFE | 真实客户端与 Ingress 上传未commit/commit但ACK丢失→模拟超过24h且无GC→同版本重启重试恢复 ACK 或新合法 attempt；无手工GC/改文件步骤，字节与owner校验保留。 | D2；静态跨端状态链 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| DESKTOP-D3 | C+N / P2 | 服务端分页与首屏 | FILE / ASK | 生成长历史与整日截图，真实浏览入口每页只消费原 limit/cursor、后续页失败不阻首屏；翻页/头部插入不靠本地 offset 全量扫描；账号/device/query绑定。 | D3；capturePages 1000行 seam | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| DESKTOP-D4 | C+N / P2 | 中央原始 sizeBytes 显示 | FILE | 有OCR/无OCR中央截图分别保留 server sizeBytes，2MiB不变14字节/0；本机记录原大小算法不回退，真实隐藏 renderer 验显示。 | D4；preview 生产函数 seam | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |

### AND

原审计：`android.md`；模块元数据继承计划中 `AND` 行。

| 编号 | 起点证据 / 优先级 | 原行为恢复目标 | 依赖 | 具体验收要求 | 审计证据定位（非本轮通过） | 本轮证据 / 未验证 / 阻塞 |
| --- | --- | --- | --- | --- | --- | --- |
| AND-01 | C+N / P1 | 设置/重登恢复日历投递 | ACTION / CONFIG | 真实 connect→RuntimeSettings.apply/replaceAccount→WorkManager 持久调度→投递；普通设置与同账号重登成对恢复，A→B旧工作退休，不能仅直接 doWork。 | AND-01；静态调用+源码断言 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| AND-02 | C+N / P1 | 原始采集逐项结清与冲突隔离 | FILE / EXEC | packed及单条队列含同ID不同内容409后仍上传正常生成记录；原冲突可见且不堵队头；核对旧410适用状态而不伪称已复现，不自动改ID/覆盖。 | AND-02；静态跨端+源码断言 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| AND-03 | C+N / P2 | 窄 transport 原 typed outcome | FILE / CONN | disabled 注册、source item 409、file_forgotten410，自动/手动分别走原 paused/permanent/blocked 状态；不误作 offline 无限重试，恢复入口及权限正确。 | AND-03；静态异常分类+断言 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| AND-04 | C+N / P2 | 恢复页与 Worker 同账号状态 | WEB | 页面检查/补传/停止→Worker→真实页面报告一致；A/B切换和旧结果迟到不回写新页面；读取与写入均为同一账号 store，用户步骤不增加。 | AND-04；静态 prefs 错位+断言 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |

### WEB

原审计：`web.md`；模块元数据继承计划中 `WEB` 行。

| 编号 | 起点证据 / 优先级 | 原行为恢复目标 | 依赖 | 具体验收要求 | 审计证据定位（非本轮通过） | 本轮证据 / 未验证 / 阻塞 |
| --- | --- | --- | --- | --- | --- | --- |
| WEB-W01 | C+N / P2 | 原首页内容/入口/Home slot | FILE / ASK / EXT / MEM | 生成新/已有数据账号打开今天：原导入/新增来源/最近记录原文/最近Insight预览引文数/设备模型提示/扩展Home slot均按原层级可达；账号Api和晚响应隔离保留。 | W01；静态12项检查中的首页部分 | READY：Q002 driver required gate及R006独立动态PASS，PM已确认；跨模块/释放仍待 |
| WEB-W02 | C+N / P2 | 设备原30秒可见刷新 | EXEC / DESKTOP / AND | 页面保持可见，生成设备心跳/队列100→0/错误解除后按原30秒节奏更新；前后台/断线恢复不冻结；与 Operation family 修复独立验证。 | W02；静态timer→loader断链 | READY：Q002 driver required gate及R006独立动态PASS，PM已确认；跨模块/释放仍待 |

### EXT

原审计：`extensions.md`；模块元数据继承计划中 `EXT` 行。

| 编号 | 起点证据 / 优先级 | 原行为恢复目标 | 依赖 | 具体验收要求 | 审计证据定位（非本轮通过） | 本轮证据 / 未验证 / 阻塞 |
| --- | --- | --- | --- | --- | --- | --- |
| EXT-E01 | C+N / P2 | 停用无引用实例退役卸载 | CONFIG / MEM | 管理员安装→配置→停用无历史引用实例→原卸载操作成功；其他账号实例/真实历史/在途check继续阻挡，UI allowed与执行一致，不要求手改JSON。 | E01；旧/新真实方法抽取+SQLite | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| EXT-E02 | C / P2 | 原核验入口真实 provider probe | MEM / CONFIG | 生成不可用/可用 provider 经原核验入口得到准确capabilities/issues/observed状态与反馈；describe不冒充验证；隔离probe目录与固定模型授权，失败不激活错误方案。 | E02；静态probe→describe变化 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| EXT-E03 | C / P2 | MCP reference 目录元数据 | FILE / ASK | reference 导入经分页资源目录获得真实 name/MIME，缺失才用原fallback；不读正文，取消/撤权/账号边界与正常import同效。 | E03；静态分支 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |

### ACTION

原审计：`actions.md`；模块元数据继承计划中 `ACTION` 行。

| 编号 | 起点证据 / 优先级 | 原行为恢复目标 | 依赖 | 具体验收要求 | 审计证据定位（非本轮通过） | 本轮证据 / 未验证 / 阻塞 |
| --- | --- | --- | --- | --- | --- | --- |
| ACTION-A01 | S+R / P2 | 完整语义产物消费与检查点 | MEM / FILE / EXEC | Actions主责旧bounded screen/完整segment的真实producer→semantic actionCues→calendar extraction，含原触发/提示/artifact-revision检查点；不能只补consumer或扩大所有资料；无完整segment保留原文分支，Coding actionCues仍空。 | A01; confirmed structure, quality consequences unrun | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| ACTION-A02 | C+N / P2 | 同批合并/去重/执行保护 | EXEC | 真实批准建议入口覆盖create sameAs+update、两个sameAs、完全相同new、已有approved/executing/uncertain子操作；一次批次合并/版本推进、精确去重，不使合法批次stale。 | A02；三例真实方法抽取 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| ACTION-A03 | C / P2 | 成功历史身份独立于授权代次 | CONFIG / EXEC | 成功历史→停用再开/只改时区→新内容继续而成功模型单元不重跑；重启/失败retry复用检查点，授权generation仍拒绝旧未授权工作。 | A03；静态policy/cursor/job身份 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| ACTION-A04 | C / P2 | 纯重命名保留建议/批准 | ASK / CONN | 来源纯改名/无实际变化保存后原建议可看/批准/claim且不报已删除；删除/撤权/语义依赖变化仍失效，迟到ACK只结算外部事实。 | A04；静态触发器/proof/claim | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |

### LIFE

原审计：`lifecycle.md`；模块元数据继承计划中 `LIFE` 行。

| 编号 | 起点证据 / 优先级 | 原行为恢复目标 | 依赖 | 具体验收要求 | 审计证据定位（非本轮通过） | 本轮证据 / 未验证 / 阻塞 |
| --- | --- | --- | --- | --- | --- | --- |
| LIFE-L01 | C / P1 | 原保留周期启动/每小时维护 | FILE / ASK / MEM | 生成旧/新采集和文件版本；真实启动/小时推进按context_end清理超龄非文件并撤派生/历史，排除文件规则与retentionDays=0保留；不处理真实资料。 | L01；静态配置无消费者 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| LIFE-L02 | C / P1 | 既有实例逻辑容量准入 | FILE / DESKTOP / AND | 生成小容量实例在原逻辑计数边界返回507且不先接受丢数据，客户端保留队列并在释放后继续；并发双用户共享实例账本，不新增个人配额/磁盘写满实验。 | L02；静态实例上限失效 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| LIFE-L03 | C+N / P1 | 个人导入导出一致性隔离 | MEM / FILE | A导出/导入含await provider期间B持续写入不误报archive_changed；A真实依赖变化/撤权仍拒绝，双连接/重启覆盖，不靠全库静默重试。 | L03；全局fingerprint SQLite | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| LIFE-L04 | C / P1 | 中央导出内容副本删除生命周期 | FILE / MEM / ASK | 按原生成当前完整导出→直接响应下载旅程，无中央永久完整副本/下载历史。内部任务进度、无内容receipt和必要暂存按完成/失败/取消/断流/重启清理及原重试；授权/pin/删除fence保持。不得新增latest-only/TTL/次数政策或额外用户下载步骤；仅生成fixture，不操作真实历史副本。 | L04；静态保存/下载/删除全链 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| LIFE-L05 | C / P2 | 原GC启动/周期驱动 | FILE / EXEC / EXT | 生成失效upload/workspace/snapshot/失败restore残留→真实启动/周期自动回收；活跃pin和真实unknown仍保留，不依赖用户手工GC，不按时长猜活动死亡。 | L05；静态gc存在但无驱动 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |

## 补充、未知与旧缺陷

下表不并入58项。U项先调查/送PM，不能用本矩阵当作新增产品政策授权。

| 编号 / 模块 | 起点分类 | 目标 / 依赖 | 具体验收或裁定要求 | 审计来源 | 本轮证据 / 未验证 / 阻塞 |
| --- | --- | --- | --- | --- | --- |
| EXEC-S01 / EXEC | S / 补充 | 原Operation父子链与进度；FILE / MEM / ASK / CONN | 导入→文件→处理→Memory、Ask协调→子研究等实际入口保留原父子链接/汇聚/取消/进度，跨owner链接拒绝；Work SQL展示不能替代Operations详情验收。 | execution.md S01；确认结构变化 | OPEN：待候选；无本轮运行证据 |
| EXT-ES01 / EXT | S+U / 补充 | MCP无状态使用与重启；ASK / EXEC | 生成受支持客户端按原stateless POST使用；对比initialize/session/重启重连步骤，证明必要隔离而不新增无依据必需步骤；凭据轮换/撤权仍有效。 | extensions.md ES01；实际客户端未验证 | UNKNOWN：待调查/必要PM裁定，保持安全边界；无本轮运行证据 |
| EXT-ES02 / EXT | S+U / 补充 | 单次发现/导入前置步骤；FILE / CONFIG / WEB | 原一次目标选择→发现→导入旅程与当前持久连接/预建source对照，保留原可达步骤及私有凭据归属；必须新增步骤的必要性送PM，不自行固化。 | extensions.md ES02；结构必要性未证明 | UNKNOWN：待调查/必要PM裁定，保持安全边界；无本轮运行证据 |
| EXT-EC01 / EXT | U+N / 候选 | 资源模板发现协议可达性；ASK | 用仓库实际SDK与合法资源服务核对templates/list及prompts/list可选性，再生成Method not found场景验证资源发现结果；未证实前不升级为确认回归。 | extensions.md EC01；stub证明失败，合法性未确认 | UNKNOWN：待调查/必要PM裁定，保持安全边界；无本轮运行证据 |
| LIFE-L06 / LIFE | S+U / 补充 | 恢复策略意图与执行授权；EXEC / CONFIG / 所有自动域 | 整实例备份→空目标恢复→可信登录/显式启动与旧版对照；保留原策略意图并退休旧credentials/leases/grants。用户已选重新登录后按原开关继续未来任务；旧执行权不恢复、已完成外部操作不重复、unknown外部写先对账；新授权后的未完成内部阶段/已知未发生外部写保留正常恢复。 | lifecycle.md L06；确定设置变化，安全方案未验 | IN_PROGRESS；重新登录按原开关继续已定；无独立运行证据 |
| AND-D01 / AND | U→CHANGE / 用户已决 | 采集/隐私/同步偏好按账号；CONFIG / AND | 用户已决定采集/隐私/同步偏好按账号独立保存，OS权限/硬件仍设备级。以A设置→B初始与修改→回A、同账号凭据轮换/重启、旧Worker/迟到结果验证隔离和原用户控制；不做旧格式迁移，外观共享保留。 | android.md D01；起点未知已由用户明确裁定 | IN_PROGRESS；政策已定；独立运行UNRUN |
| FILE-07 / FILE | OLD / 旧缺陷 | ZIP Markdown相对附件关系；MEM / FILE | 单列两版共同缺失的同包精确相对媒体关系；mapper输入集合旧问题已修，不重报。若PM另行释放修复，另记范围/新输入生成旅程，不自动历史OCR/ASR/Memory重算。 | files.md FILE-07；旧缺陷，不在58项 | OUTSIDE：旧缺陷待PM另行范围释放；无本轮运行证据 |
| CONFIG-UX01 / CONFIG | C+S / 体验补充 | 专用配置控件退为JSON编辑；WEB | 原Provider预设自动地址/协议、推理强度、请求/Agent超时、token预算、本机免密、headers/body专用操作按原信息架构可用；后端接受字段/通用JSON不算原体验恢复。 | configuration.md + web.md 原未编号交叉差异；web.md末节 | OPEN：待候选；无本轮运行证据 |

## 补充调查与消费者门槛（不改变66主行）

下列是PM/独立验收追加的防遗漏事项。除明确注明的作者窄复现外，均未独立运行；不机械增加confirmed bug计数。产品选择只由PM/用户裁定。

| 跟踪ID / 主行关联 | Owner / 依赖 | 当前证据与需调查/验收内容 | 本轮状态 / 阻塞 |
| --- | --- | --- | --- |
| INV-FILE-01 / FILE-02 | FILE / MEM、AND | 自定义`image:<step>`理解-only recipe+caption/readiness，保留+处理并发；静态疑点，非普遍图片故障结论。 | UNRUN；待FILE冻结SHA |
| INV-CONN-01 / CONN、FILE | CONN / FILE、MEM、CONFIG | 非录音text/Coding/mail/calendar/page/screen、reference/archive/snapshot在processing enabled/automatic/模型缺失/修订/重启组合下，M06是否扩大处理或阻断旧非模型输入；旧触发范围不扩大。 | 调查；待组合输入/owner结论 |
| INV-ASK-01 / ASK | ASK / FILE | canonical source=message与source/kind=file过滤原旅程是否偏离；现明文contract不是等价证明，未先认定bug。 | UNKNOWN；待新旧入口对照 |
| ACTION-S1 / ACTION | ACTION / FILE、ASK | PM指定独立owner原ID授权reader，保持Ask query-visible scope。作者窄HTTP对照旧201/200、新screen/reference/archive/Material替代原ID404/404，raw file/Material正控成功、B引A拒绝；receipt=`/tmp/mote-todo-evidence-parity-20261018/receipt.json`。属窄复现，未独立全进程复现/修复PASS；补create/update、CAS、隐私/真撤权/遗忘删除。 | 已确认窄入口差异；修复与独立验收UNRUN |
| INV-EXEC-01 / EXEC-X03 | EXEC / CONFIG | 多Central进程下实例并发上限是否仍按原合同全局有效；process gates与共享pool组合需实际生成双进程。 | UNKNOWN；未运行 |
| INV-AND-01 / 原生Central消费者 | AND / ASK、FILE、MEM、CONN、CONFIG | 六域逐专用页消费当前scoped DTO；原生Ask用生成HTTP模型验提问/历史/失败重试/A→B迟到。legacy owner-token 26页面与live opt-in不替代；录音旧原生backupAudio固定true、shared literal(true)为KEEP，不新增关闭开关；验原备份状态/回听/显式处理，metadata/独立错误/nextRetry要展示。 | UNRUN；待逐域依赖SHA |
| DESKTOP-S1 / DESKTOP-D3 | DESKTOP / ASK、FILE | account浏览→打开detail→401/403撤权→刷新/held detail迟到，检查archiveAuthorizationDenied/detail清理/generation；静态候选，未运行确认。 | 候选；待真实account UI回归 |
| INV-FILE-02 / FILE-03/04 | FILE / AND、CONFIG、LIFE | list/owned扩展reference与归档旧head后，policy preview完整cancellation/proof形状、无preview500；可读归档不授当前processing权。canonical ig_file_heads与LIFE冻结owner/source/external/receipt/current/deleted/CAS/portable/backup及inventory，当前格式不静默失踪、无旧数据回填。原生CentralLibrary hasOriginal=false不得强读originalRef/size/sha。 | UNRUN；待FILE及Android消费者SHA |
| INV-CONN-02 / CONN-C06 × FILE/LIFE | CONN / FILE、LIFE | PM授权最小host账号绑定assertFileAllowed复用forget事实，acquisition/publish前复核。forget后改selector零重下载/零重发布，在途forget迟到拒绝，B同external ID可正常备份；静态发现非已修PASS。 | 待实现/运行/独验；无新策略/历史扫描 |
| INV-ASK-02 / ASK-A05 | ASK / EXT | browse原聚合导航collections、search稳定枚举、retrieve相关rank且拒cursor分别验，不因maxCharacters/hybrid修复自动判三mode恢复。 | 已纳scope；UNRUN |
| INV-CONN-03 / CONN | CONN / EXEC、WEB | PM核旧周期clamp≤300000后每wake直接sync(false)，恢复实际5min周期。允许同一M05本地selection admission lane避开长sync物理资源，及时保存/撤旧epoch，保留durable取消、跨await持久epoch/forget/grant fence与physical join/erasure；不另建scheduler。须non-abort-compliant held scan验证及时返回、重启新范围、旧release不入库及双账号正例；原统计总览另验。 | 工程方向已定；独立运行UNRUN |
| INV-LIFE-01 / LIFE-L01 | LIFE / FILE、DESKTOP、AND | PM要求沿原delete journal核对同owner同ID重传/个人merge不得复活已删内容；分别覆盖newID、另一账号、重启、retention与explicit forget差异和整实例恢复。不泛化禁所有import，无后续人类批准不得添EXCEPTION绕过journal。 | 已纳范围；待准入与生成回归 |
| INV-EXEC-02 / EXEC-X01 | EXEC / AND、DESKTOP | 原生Android operation receipt仍硬编码task前缀；family恢复后与connector前缀保持精确账号hash/回执校验，待producer与consumer双SHA联调；Desktop并行核对。 | UNRUN；待EXEC/AND候选 |
| FILE-PERCEPTION / FILE-02关联 | FILE领域/ports/API、instance-bound MediaAssets/MEDIA_CATALOG、OCR/ASR健康安装恢复admin与实际scoped处理；CONFIG专用Web/必要Kotlin；ASK allowQueryImages消费 | PM确认静态缺口：原图片auto/profile、外部OCR、查询图像控制、日期/来源complete/recompute preview确认及实例媒体资源服务/consumer需完整接回。不能仅private DTO/伪ready；共享资源与个人配置授权/admin边界保留。生成artifact+假HTTP供源经真实installer验成功/失败/取消/重启/互斥/普通用户403/实际处理；不自动下载大模型/开用户开关/重跑历史，真实供应商下载/模型UNRUN。与image/caption/readiness联合，无legacy旁路/重复业务流。 | 依赖与check范围待精确冻结；实际入口/installer/独验UNRUN，G004排通知 |
| ASK-INTAKE-01 / ASK-A02 × MEM | ASK / MEM publication port | 作者新增真实生产fixture先红：noteCapture经MemoryHost captureMaterials→PrivateData直接publish，Ingress/M06 hooks未收到，canonical embedding为0。双方协调最小Material publication通知port，Ask订阅新发布输出；不改Memory语义、不做查询时历史扫描/backfill。作者报既有A01 16/A04 8/A05 HTTP4+MCP4/A02 24项定向通过，均在途、未附冻结SHA，不能覆盖新缺链。 | 作者生产fixture失败已报；修复后真实intake→发布通知→scoped embedding/检索及双用户/修订删除/重启待验，独立UNRUN |
| CONFIG-EXT-HINDSIGHT / CONFIG-C02 × EXT-E02 | EXT / CONFIG、MEM | EXT报告新Hindsight实际probe构造与原provider执行构造并存；固定Codex executable/home必须同时进入二者。只合原执行构造一行不能关闭C02或E02。冻结组合后验证生成runtime路径、probe及正常执行、撤权与账号隔离；冲突解决请两owner复核。 | 在途结构依赖；无候选SHA/组合运行证据；独验UNRUN |
| CONN-C05-SEAM / CONN-C05 × FILE | CONN producer / FILE、MEM consumers | 精确前置`e84b8bb72ac195e047d9a590eec7221b9ffcfdcb`仅`scope/processing.ts` artifacts声明：保留extraction，对!derived+完整coverage+非空blocks以同revision/blockIds补extracted-text，原录音配方版本/fingerprint不变。FILE勿重复实现alias；与origin/status等hunk合并后去重复核。作者报Node24类型及canonical/empty/unsupported/late-forget定向3项、recording12项通过，日志`/tmp/mote-connectors-recording-parity-final-node24.log`；实际被测为abd8c495+当时WIP（含同alias字节），非该单commit或最终组合的独立PASS。 | 精确producer可定位；最终冻结/affected/独验及FILE组合回归UNRUN |
| MEM-SHARED-SEAMS / MEM × EXEC/ACTION | MEM / EXEC、ACTION | 作者review精准纳入EXEC f416966727bdb182c0fd2921a94a57be43e5a987→本树802b2e53、ACTION ece742f090a9d2502775184b0396e073050e4de9→本树7b299257。仅共享seam；pure conversation parser拆出、mm_batch_artifacts inventory与窄pure allowlist保持生产边界。集成按内容去重，两原owner门禁仍执行，不因Memory定向结果冒领原分支PASS。 | Memory尚未冻；旧77项曾75PASS/2FAIL，2例分组遗漏已修且8b精确复跑2/2；最新72f整组仍未通过完整gate，不能称PASS；parent根/stage/options组合UNRUN |
| WEB-PREREVIEW-F01 / WEB-W01视觉证据 | 客户端独验 / 作者fixture | 只读pre-review-v1（JSON SHA256 d7ac39012d0cbd754968e739ec4d00eef5dfd29c2dfa6d9764b74b1a6621191e）确认作者home-desktop-a.png为Agent页，不能当桌面Home布局通过；保留原图快照hash31cedc55f141537f22e3a5d14343f1ad3a37b281aaa132ac423c8e30da27bc01。报告目录`/Users/utopiafar/.codex/visualizations/2026/10/18/01a14e90-08cc-7631-b1bb-fe8b691c3e27/web-readonly-f8f684b6/`。 | 历史P2作者视觉证据缺口；R006已用稳定导航/DOM后的6张新图独立闭合，原图/hash保留，冻结源码未改 |
| FILE-MODEL-DESCRIPTOR / FILE-PERCEPTION × CONFIG | FILE最小hunk / CONFIG端口复核、ASK/UI消费 | FILE在f461实现Configurations.forUser host-only非密modelDescriptor(feature,reference?)（baseUrl/provider/model/reference），该head现HOLD待public cursor补丁，Perception GET不借模型lease、不复制secret/endpoint authority；Config/Ask idle不FYI唤醒，精确port SHA后协调复核。实例媒体继续复用central-runner/dev-server共享startMediaWorkers唯一监督器，app不再启动第二套；仅所选OCR/ASR endpoint精确匹配managed资源才注入host worker token，不改用户选项、不自动下载。 | producer已落实现仍待修复新冻结；PM已恢复Config接实际consumer，新head/组合测试未验 |
| EXT-GATE-SCOPE / EXT-E02 | EXT owner / LIFE备份consumer | driver精确d347 required gate EXIT1；5项scope缺声明，19步骤UNRUN，inputIdentity154b71a4ac6a669551ae238d6d5b4f590254dc85dcfd8be8f8818a0911a604f2，cleanupConfirmed/clean/锁释放。owner已复现，拟最小4surface+单host入口pure-helper许可与负例；backup-schema漏plugin_user_checks需7列/owner准入，不改变L06。 | 修复head d4683421已登记，整轮22步UNRUN；旧轮FAIL不能用定向或补跑拼PASS；生命周期冲突待精确SHA联合 |
| CONN-JAVA-ATTEMPT / Q011 | driver环境修正（历史轮） | 采用manifest Android Studio JBR时实为Java25，wrapper Gradle8.14；核官方兼容矩阵后在Android前主动中断自己run10edecc9，143/cleanupConfirmed，Server阶段取消所生失败不当生产bug。随后用现有JDK21从头重跑14步，但该轮又因F01..F05被PM要求停止；两轮均非PASS。 | 143中断两轮分别保留；Java21清理跟进见CHECK-STOP-EPERM；原Java25证据在driver目录connectors-4fe01f47-java25-interrupted.json/log |
| CONN-STATIC-F01..F05 / CONN-C01/C06/时序 | CONN修复 / 控制组只读E1 | 精确4fe静态CHANGES_REQUIRED：F01 held account await后forget仍可进入media；F02 Web enabled=true保存await整sync；F03 Android首次select不触发原即时sync；F04 已接纳waiting phase被autoSync/discovery门控，缺独立due责任；F05 同录音/同页串行await媒体挡后续文本。报告JSON SHA256 b96b88719dd77045f7766275bd77cf06db2dd37744c2accdba91a00d6ede1c24，control connector-static-4fe01f47目录。 | 动态未复现不得冒已实跑；PM要求同M05恢复原phase独立2/2/1、真实Web/native首次保存、非abort held/forget/到期/失败discovery组合，新head全量重验；旧4fe不PR/不READY |
| MEM-STATIC-F01..03 / R01 | 领域独验只读 / exact1c，PM确认CHANGES_REQUIRED | report JSON SHA256 a2c9c62c353d14323648a23c20517f6b3a7a437b31898358f1fa38ab05ffab0f，32段固定旧新源。F01 P1/M08仍三业务task重新获选，旧单memory.batch execute连续提取/纠错或精确复用→独审→stage/commit；F02 P2/M06遗漏严格匹配的builtin Coding候选复用；F03 P2/M06只recipe+size导致原source/device/provider/project/session分组可混。R01完整review即open问题早于publish，旧onSaved才建。 | 三项源码偏离确认、动态后果UNRUN；R01时序源码确认但held publish答复/unknown后果待实跑。PM恢复owner，1c不再重跑/PR；保留原8项fixture修复，不回引global legacy/不改真实历史；新freeze再完整门禁与独验 |
| CHECK-STOP-EPERM / driver运行事件 | driver / 检查基础设施后续调查 | Q011 Java21 SIGTERM后runChecks EPERM保留锁/cleanupConfirmed=false。原driver+12子PID及PGID3095后验全空、核runId/owner不变后只移除该残留锁；原receipt不改。跟进`connectors-4fe01f47-java21-stop-cleanup-followup.json`保存证明。Server实际启动后中断，原receipt因cleanup错误列UNRUN；不把取消报错当产品bug。 | 已安全清理/释放写入，原因未定；不改变默认不抢锁政策、不新增自动回收/测试豁免 |

独立验收准备工件（不代表通过）：领域组v1.1.0，`/Users/utopiafar/.codex/visualizations/2026/10/18/01a14e90-04ae-70c0-92a5-3f2a24a3bf0c/parity-acceptance/acceptance-checklist-v1.1.json`，SHA256 `9ffd1c49834ca086c55a579b830b65fcb652c6b1b266f6e95701a170625bd1c2`；23主条目+13额外项，独立应用运行全部UNRUN。其Todo回执为owner实跑/验收chat审回执，非独立运行。


控制组准备工件v1：`/Users/utopiafar/.codex/visualizations/2026/10/18/01a14e90-06cd-7242-96bb-349e5fdb83b3/parity-independent-acceptance-20261018-v1.json`，SHA256 `55344f8ef461ef4996f6c8c77f6367e7bbc62dab22e885c81ab0fb9a6e016755`，22编号项+6结构体验项+11消费边界，运行全部UNRUN。领域组最新v1.2.0：`acceptance-checklist-v1.2.json`（同上领域组目录），SHA256 `5cfda7205b93ae91eb44a2a517714f7c26c7f544142eacd596fcf68a6e5953c9`，23主项+14补充项，新增Files原生reference/历史消费者，应用独验全部UNRUN；v1.1保留。

最终验收准备标准：`/Users/utopiafar/.codex/visualizations/2026/10/18/01a14e90-898a-7330-9ad8-b604cd31b65f/final-parity-acceptance/final-acceptance-standard.md`及同目录`acceptance-matrix.json`、`evidence-receipt-template.json`、`review-provenance.json`、`document-check.json`；66主行=0PASS/0FAIL/66UNRUN，15跨域旅程/6调查/12防退化组，仅文档检查。

客户端独立准备v1.1.0：`/Users/utopiafar/.codex/visualizations/2026/10/18/01a14e90-08cc-7631-b1bb-fe8b691c3e27/acceptance-readiness/independent-acceptance-checklist-v1.1.json`，SHA256 `a3c9d3d4e270f5f1c01d087f13cb6a94b774d44f1f3527b506c887bedaf7bf1a`，29场景/消费者门槛，运行全部UNRUN；该版本取代旧backup toggle误判。

控制组准备v2保留v1：同控制组目录`parity-independent-acceptance-20261018-v2.json`，SHA256 `2d33ae457dfd621fd2af9dc6f56b7a6092874df1186f8da506f3f8c4dda19750`；补delete journal/readmission与backup固定true校准，应用运行全部UNRUN。

## 已登记的临时前置候选

| 前置 / 精确SHA | 所有者与报告结果（非独验） | 消费者与组合要求 | 正式集成状态 |
| --- | --- | --- | --- |
| Desktop D2 `5744d6a832117a9f9aec7affd37453ab15d455cf`，base起点2c78ca8d | 作者前置递进：1417e395 begin恢复→d77fa9c4过期错误码→5744d6a8类型声明。含begin后跨日part/commit upload_expired409暂态边界；不能只取早期1417。作者报告server typecheck、29项+explicitcontract1项、Desktop source-account14项通过，日志`/tmp/mote-parity-desktop-server-type-green.log`等；非独验/完整gate。snapshot授权不续期。 | Android冻结consumer后登记base+D2+Android精确head及组合SHA/tree；SourceUploadWorker半传/commit丢ACK/已有begin后跨24h均验，不依赖GC，不夹带Desktop改动进Android PR。新前置不沿用旧组合结果。 | 尚未组合/独验/affected gate；未合正式integration |
| Desktop完整模块候选 `73c1115287fe07e1824526861ebc2e8ed3cf39fc`，base起点2c78ca8d | 作者报告5文件83项、Ingress/snapshot29+explicit expired1项、Server/Desktop类型与依赖预检通过；真实main/preload/startup/迟到ACK/换账号/旧read拒绝已包含。handoff=`/Users/utopiafar/.codex/visualizations/2026/10/18/01a14e8f-745e-7330-8770-aed83a43077f/desktop-parity-evidence/handoff.json`。 | 最终affected计划Desktop+Server+Web，Android=false；Android D2消费仍需与其冻结SHA临时组合。 | CANDIDATE；Q007等待全局槽；未运行完整gate/未PR/未独验/未正式集成 |
| Files部分head `67b28439cac04942911eacd4cf3118a4fbe51586`，base2c78ca8d | 作者已推送/clean；restore提交`980674f6`；67b284为最小Perception只读port供ASK review消费。冻结部分head的HTTP30项/类型/scope/i18n作者EXIT0，receipt=`/Users/utopiafar/.codex/visualizations/2026/10/18/01a14e8f-6b10-7001-b7d6-84ba844a5604/parity-files-evidence/receipt.json`；同目录perception-next-contract.json为PROPOSED未交付。完整独立image/history与managed MediaAssets仍OPEN。当前ALL6 TS+Android/root scope预检缺Electron/Java环境，Server/Mem0 Node26 ABI147已报PASS；native源码/测试已落盘但UNRUN。 | ASK只消费该精确最小port；FILE其余功能完成后重新冻结、重选检查。当前部分定向与port不能关闭FILE-PERCEPTION或原生验收。 | Q001 WAIT_FEATURE；P009/R004后续窗口排队，非最终READY，无PR/merge |
| Ask历史部分core `f2b44331479fc6ca60f62ab0732493b93f76fda7` | 含fixture-only c94e9e9及精准Material发布seam ac3533c1（cherry b66527d3），不含其父Memory业务。真实noteCapture→发布通知/上传→M06→向量worker→Context/Ask fresh引用等固定core54项作者EXIT0，证据仅绑定f2。 | 已由下方最终e23候选接Files最小port/allowQueryImages取代；该core不关闭完整FILE-PERCEPTION，也不等于Memory原任务验证。 | SUPERSEDED；历史定向结果保留，当前Q005按e23重选/检查 |
| Execution source冻结 `1e9ec7ab253cbb25bd21f14f3aee9ea19bbb96d2`，base2c78ca8d | 作者最终回执：clean，冻结精确6文件定向25/25 EXIT0（45.41s），Server/Web类型、scope-contract、含Android实际环境及dry-run EXIT0；回执`/Users/utopiafar/.codex/visualizations/2026/10/18/01a14e8f-7094-7af3-880a-8580a9135ea1/execution-evidence/frozen-receipt.json`。host parent/lane seam `f416966727bdb182c0fd2921a94a57be43e5a987`为Memory已review前置。Node26 ABI147双SQLite/Java21预检作者PASS。未push/PR。 | 最终dry-run所选server/Web/shared/Android JVM/scope/tooling须完整gate；Memory >2/发布和跨域parent消费者仍需各自精确SHA组合，不以seam review当通过。 | Q009 DONE_PASS；driver exact1e9整14步/1490.842s及JVM373通过，Server另2skip明确未验；未push/PR/独验/READY，联合及新seam不在此轮 |
| Extensions历史候选 `d347b4647aa0c66a42bc3f7adf5129466b16aa16`，base2c78ca8d | 作者clean；报告plugin39/MCP18/Web13/两进程unknown-write2项与类型/i18n通过；含真实canary与SIGKILL生成进程。证据`/Users/utopiafar/.codex/visualizations/2026/10/18/01a14e8f-79dc-70b3-8d6c-608e696cb79d/extensions-validation/frozen-candidate.json`及frozen-affected-plan.txt。 | Hindsight两构造runtime与CONFIG精确依赖仍验；shared helper异步时序冲突找owner复核；Android JVM/完整gate/真实模型供应商Docker物理端部署UNRUN。 | SUPERSEDED；旧Q003 scope门禁FAIL/19UNRUN，准确证据保留；下方d468修复重新整轮 |
| Configuration候选 `79bf961020782661c701cb0d3af47d1e5f48a0e3`，base2c78ca8d | 作者clean；54文件hash/准确命令/依赖与UNRUN见`/Users/utopiafar/.codex/visualizations/2026/10/18/01a14e8f-7295-7c62-9d1d-d6f9a3e6a59e/configuration-evidence/frozen-candidate.json`。精确候选生产生成API/Codex/Usage16项及重建真实隐藏browser作者EXIT0，截图已检查；此前57模型/18UI等仅各自被测输入。 | C07依赖FILE实际入口；Images/history/managed UI依赖FILE真实port，storage依赖LIFE，embedding/allowQueryImages依赖ASK，联合实跑UNRUN；managed UI可能补候选。JVM/原生四方法及完整gate未跑，不能称完全恢复。 | R003/Q008旧79bf历史冻结；PM已恢复实际Files/LIFE/Ask consumer修订，新head/组合/完整gate/native/独验待验 |
| Memory历史冻结 `8b7bcc16650ea84092df8b730703f85a3a43e181`，base2c78ca8d | 含精准共享seam802b2e53（orig f4169667）与7b299257（orig ece742f0）。旧77中两范围回归在8b精确复跑2PASS；其它扩展多文件focused属各自迭代结果，不转记72f全通过。历史计划`/Users/utopiafar/.codex/visualizations/2026/10/18/01a14e8f-6977-7fa3-8145-0b3696ae413c/memory-parity/frozen-affected-plan.json`，Node26 ABI147 native ready。 | >2配置并发必须联合完整EXEC `1e9ec7ab253cbb25bd21f14f3aee9ea19bbb96d2`真实门闩；standalone仅seam不能证明。parent/发布与其它域组合逐项列SHA，内容去重不替代原owner gate。 | SUPERSEDED；最终72f增mixed incomplete durable回归，Q006已FAIL，修复另冻新head；PR/独验UNRUN |
| Android冻结 `2622844e3b226f3ebae9542bdb16aafedc5cf3a7`，base2c78ca8d | 作者clean未push/PR；D01稳定deployment+user原子个人snapshot、origin仅metadata、旧全局保留不猜归属/默认停止、stale preview/save挡B，以及永久拒绝/暂停竞态/upload_expired分类已落盘；新增4个instrumentation类和typed JVM。新冻结重资源结果尚无。 | 所选affected→multiuserFixture APK/testAPK→专用API37 serial5580 core/SAF/D01含force-stop；1worker实际入口核对。D2仅临时加精确5744d6a三commit、Ask需其精确业务SHA，组合单独验证不夹带PR。 | Q010/R005 WAIT_GLOBAL_SLOT；旧R001不同输入结果不转记；完整gate/新原生/独验UNRUN |
| Connectors退回候选 `4fe01f477df6f564cd4c977c79efbe979e73e1d3`，base2c78ca8d | 作者已推送且远端核对；manifest=`/Users/utopiafar/.codex/visualizations/2026/10/18/01a14e8f-6edd-7772-b552-f0ce79bb7c61/connector-parity-evidence/manifest.json`。报告各自输入下focused76/Web13/summary-selection5/最后Web2及类型/scope/i18n通过，不能转标冻结全gate。含c6e1e48f→abd8c495 Memory seam与e84b8bb7 producer，按内容去重。 | 只读静态F01..F05要求恢复原phase独立调度/首次保存/forget边界；旧Q011两轮143停止，JDK21修正及EPERM后验清理分开保留；R002原生暂缓，其他native/live UNRUN。 | CHANGES_REQUIRED；owner已获写入释放并返修，等新freeze重选整轮，不PR/不READY |
| Ask最终候选 `e23c06a3f3ea30a5d844fbadb76de0475b17246b` | 作者clean，未push/PR；core f2b44331精确54项EXIT0（f2b44331-focused.json），最终e23c图片权限/Filesport/显式附件4项、类型/scope EXIT0（e23c06a3-image-port.json），同parity-ask-evidence目录。review精准Memory b66527d3→ac3533c1、FILE67b28439→82e81c7a及fixture c94e9e9，无父业务盲拣。 | Files实际origin/device业务、EXEC完整1e9父/slots、CONFIG Codex compaction仍精确联合待验；allowQueryImages最终已接，defaultfalse/A-B/await后关闭拒绝/显式附件独立grant生成覆盖。 | Q005 WAIT_SERIAL_CHECK；全6TS+Android/i18n/tooling22项计划`/tmp/mote-ask-final-check-plan.json`；完整gate/原生/独验UNRUN |
| Actions候选 `42b57dee735467362239cab27dbc923a93cfe7a1`，base2c78ca8d | 作者clean，未push/PR；manifest/check-plan=`/Users/utopiafar/.codex/visualizations/2026/10/18/01a14e8f-7b96-7d00-9b68-d9d30aea97dd/parity-actions-evidence/{candidate.json,check-plan.txt}`。报告106组合（header前）+最终lifecycle delta29+emitted进程1+emitted backup20（含3新表negative）各自准确输入PASS；不把source-entry当dist验证。 | pure合同ece742f0已由Memory定向review/pick，集成内容去重，原两owner gate分别执行；ACTION-S1在此模块，全部producer/consumer和unknown副作用边界仍独验。 | Q012 WAIT_SERIAL_CHECK；all6 TS+Android所选完整gateUNRUN，无PR/独验 |
| Web Draft [#170](https://github.com/utopiafar/mote/pull/170) | driver按PM管理授权正常push `codex/parity-web-20261018`，远端与PR head均核对为f8f684b6；创建时base `codex/parity-integration-20261018`@c49ffa8d，Draft/Open/CLEAN且未合；已attach当前集成chat。PR body明确driver代跑门禁及作者范围/未验。 | PR metadata后续补充作者home-desktop-a.png实际Agent页的预审证据缺口，未改冻结源码或文档输入；statusCheckRollup空不作CI通过。 | R006正式独验PASS，PM已确认Web范围READY；未释放/正式集成或main |
| LIFE冻结 `c0bf80d6f884c0cde15ab40bfff6cc9c8197b962`，base2c78ca8d | 作者已推/clean；manifest/22步计划/源码hash及准确分层结果在`/Users/utopiafar/.codex/visualizations/2026/10/18/01a14e8f-7dc6-7fb3-a058-cb39df965cb9/lifecycle-candidate-c0bf80d6/{handoff.json,check-plan.json,delivery.md}`。Node26 ABI147/两SQLite resolver当前复验PASS；各自import15/lifecycle27/direct16/Web13/maintenance19/policy46/future1等结果不加总重叠，原失败日志保留，非完整gate。 | FILE ig_file_heads/portable anchors↔本树ig_file_revisions、DESKTOP begin expiry↔capacity/parts、ACTION cursor resumeRestored、EXT异步check启用及新canonical checks7列、CONFIG storage saved/effective需owner冻结精确联合；新表不迁移旧数据。 | Q004 WAIT_SERIAL_CHECK；Android/native/emitted Desktop/Docker/Hindsight/physical/live/PR/独验UNRUN |
| Extensions修复 `d4683421faf2ce22be8d42c25eb385fa8a0b6aa1`，parent d347 | 最小4个M09 surface+单host probe helper入口与crypto/两pure合同限制；负例拒绝其它host/legacy Store/fs/sqlite。backup-schema补checks7列，owner/table/generation/无目标写入与当前generated Mem0备份权限回归。manifest=`/Users/utopiafar/.codex/visualizations/2026/10/18/01a14e8f-79dc-70b3-8d6c-608e696cb79d/extensions-validation/scope-repair/repair-candidate.json`；作者clean，CLI/12项scope-pure/4项lifecycle-backup通过。 | 旧d347 gate FAIL仍保留，新整轮22步需重跑；同LIFE备份schema内容去重，L06未改。Hindsight普通/新probe runtime与CONFIG联合仍待。 | Q003 RUNNING；driver exactd468整22步，run6820aa4c，未push/PR/独验，不沿用d347片段 |

最终Memory head由`8b7bcc16650ea84092df8b730703f85a3a43e181`更新为`72f0e55ba26d54f9a3d66fa6e5a8deb706e4371a`（clean，仅新增mixed incomplete+owner-question durable回归），该新增case作者EXIT0，证明incomplete整批不提前创建可操作问答。旧suite精确为77项=75PASS/2FAIL，旧报78修正；两新增原件遗漏已修，在8b精确2项复跑PASS。其它最后扩展期间多文件focused仅迭代证据，不冒称72f全通过。最终计划为同Memory证据目录`final-affected-plan.json`；Q006按72f整13步已FAIL，8前置/构建PASS、Server3160PASS/1FAIL/2skip、后4步UNRUN。原失败及窄2PASS分开保留。接续1c9be37b5e46e706bcf9715ea00cce052b3e9810已推/clean，仅fixture与validation文档变更：受控持久化1500ms在红559b557a实复现旧1秒假设，新helper join HTTP route实际已接纳promise，保留samejob/两条imported/executor终态与原三次Ask/更正/引用断言，runner120000ms未改。作者精确1c并发4相关三文件8PASS/0skip、类型/13步dry-run EXIT0；manifest同Memory目录`q006-fix-manifest.json`。不能据旧原日志复原最后await或冒称性能无回归。新整13步及与EXEC1e9联合>2门闩仍UNRUN。

Files接续f4618a5a已推/clean核对，完整image settings/history与MediaAssets实现不再只是旧67b只读port；driver实际dry-run仍22步all6TS+Android。该head因owner发现global SQLite cursor/watermark回显被HOLD，未运行完整gate/native；须覆盖Perception/task/Operation/M05/Work所有普通用户实际可达progress，仅public本账号合法事实、位置host-private，不能编码原整数或缩回填范围代替修复。新head须生成A输入不变/B交错时无全库水位泄漏，并保留本人分页/确认/重启。Config已按PM槽位开始真实consumer；临时组合用Config新head+Files接续新head+LIFE c0bf+Ask e23，真实startup/browser/角色/managed生成artifactTransport/实际图片联调仍UNRUN。

Memory只读预审已于exact1c完成且由PM裁定CHANGES_REQUIRED，停止1c完整gate/PR排期；报告`/Users/utopiafar/.codex/visualizations/2026/10/18/01a14e90-04ae-70c0-92a5-3f2a24a3bf0c/parity-acceptance/memory-1c9be37b-static/review.json`（SHA256 a2c9c62c353d14323648a23c20517f6b3a7a437b31898358f1fa38ab05ffab0f），同目录review.txt/source-excerpts.txt。需按原连续批领域流程修F01..03并动态验证/恢复R01保存后问题时序，不仅调三队列优先级或证明首卡可见；原正常模型公平/有限等待/授权/成功checkpoint与单publisher保存保留。旧8项fixture-only PASS不作scoped业务恢复证据，新的生产head/完整gate/精确EXEC >2组合/独验全部待验。

Files随后确认仅改新写入仍无法关闭current已完成任务旧metadata的读取旁路。PM允许必要最小M05 host-only纯publicProgress schema投影port，并在handler retired后保留只读投影；不迁移/回填、不恢复grant或任务。全Task/Operation/Work公开投影须生成本人已完成/退役、A-B交错、服务重启、来源真实撤权/遗忘的正负例，同时保留合法原进度/导航。精确M05 hunk/SHA及全部读写consumer清单待新候选，后续EXEC/control按固定组合复核；当前Q009结果不能转标这条新hunk。

PM另已准Memory在自己的branch实现必要最小M05 host-only逐次模型admission与同Engine grant动态resource端口，沿execution_resources与单publisher，保存/OwnerQuestion同grant commit。此新共享接口必须单列精确hunk/SHA/scope及等待、取消、lease/revoke、跨进程互斥、usage/unknown回归，由Exec/control后续准确候选review/固定组合；不改本轮Q009输入，不将旧1e9 PASS覆盖新接口，也不为FYI恢复idle owner/reviewer。

Config接续5b218d926568ed4c4a51ba8a50e9278f706f4cfa已本地freeze/clean（未push/PR），tree bc0a7c0e97d5e7e94e563ab3ba594c7f367af9af；driver核68输入hash与三producer tree无差。manifest=`/Users/utopiafar/.codex/visualizations/2026/10/18/01a14e8f-7295-7c62-9d1d-d6f9a3e6a59e/configuration-resources-evidence/frozen-candidate.json`，SHA25600715c40451e48340164870543c098f956fddc76d547193dfdcc1d8dfeeda475。新Web/native媒体health/admin install-cancel、图片历史/范围、storage saved/effective消费者已落源；作者18窄测/types/i18n8643/scope/语法EXIT0，其中fixture语法没有解析imports，不作真实producer启动。精确联调入口与命令见模块configuration-resources-parity验证文档；读Files192110c2但实际组合必须最终publicProgress修复新head，LIFEc0bf/Aske23均未合Config。新整22步、combined startup/browser、native JVM/APK/instrumentation/独验全部UNRUN。

Conn新179237a05c320f4dca18b83d4d3aa00d6ac8bf30已推/clean/远端核对，driver全核50输入hash。manifest=`/Users/utopiafar/.codex/visualizations/2026/10/18/01a14e8f-6edd-7772-b552-f0ce79bb7c61/connector-parity-review-179237a0/manifest.json`，SHA256a84cbec0b334133645a67098115f1938ba8c85be05fd7d0406a3400f6762ed4f。作者F01..05实际阶段/CLI/SIGKILL/recipe20PASS、provider匹配8（两个无匹配file不计用例）、reader/shared4、backup2、parent4、Web6+2与类型/scope/i18n各输入通过，不加总或冒完整门禁。旧4fe隔离源码负例/648生产blob核对及两轮停止保留。独立HTTP composition SIGKILL非actual index PID/managed CLI lifecycle，专用recipe两次生成模型HTTP非live语义；这些未验边界仍保留。新14步含JVM以及APK/两instrumentation方法/独验均UNRUN，Node24.22 ABI137独立依赖/JDK21。前置c6e1e48f→abd8c495、extracted alias e84b8bb7、EXEC f4169667→6b01322f均按精确内容去重。

Execution Draft [#171](https://github.com/utopiafar/mote/pull/171)已由PM准active driver正常push同1e9并创建/attach；创建base integration@3c663da9797b912185d4455d1b33c096f728aed7，复核head1e9、Draft/Open/CLEAN/未合、check rollup空。body准确引用driver门禁/2skip/native与新seam未验；只改PR metadata不更换源码。控制组只读预审已分派，不作动态独验/READY/合入。

## 跨模块最终冻结旅程

这些旅程与逐行验收互补；只在单一最终集成 SHA 执行并记录结果。依赖模块尚未释放，不启动完整套件。

| 旅程 | 必须覆盖的接缝与状态 | 实际候选 / 证据 / 未验 |
| --- | --- | --- |
| 采集/文件→资料→检索/Memory | 双用户同ID；原设备/日期、reference、归档源消失；保留+处理图片与自定义recipe；按页读取；删除/撤权迟到；合法空/不完整同任务retry。 | — / UNRUN / 全部 |
| 录音→规范正文→配方→阶段UI | 多段/缩短/empty/unsupported、原导出/音频关系；autoSync关闭、预览不突破、网络终态后未来poll、已备份复用、无自动ASR、显式处理及独立阶段错误。 | — / UNRUN / 全部 |
| 模型/Memory积压→发布/聊天 | 背景Insight持续占用、交互lane、动态并发、跨池Memory及时保存、双域/observation层级、Operation业务类型与父子变化通知。 | — / UNRUN / 全部 |
| 配置→真实执行→用量/界面 | 个人草稿/秘密确认/每功能模型、固定生成Codex runtime、普通编辑快照与真正撤权、归属/价格快照/过滤分页、专用控件原路径。 | — / UNRUN / 全部 |
| Actions→人审→设备日历 | 完整语义与原文分支、同批合并去重、成功检查点、改名、设置/重登后真实WorkManager重新调度；unknown/取消/停用迟到ACK不重写。 | — / UNRUN / 全部 |
| 双端离线/切账号→恢复 | reference逐项409/410/暂时失败、capture冲突隔离、超过24h未commit与ACK丢失、A→B→A及同账号换凭据、队列/草稿/恢复UI状态与旧响应隔离。 | — / UNRUN / 全部 |
| 删除/保留/容量→导出/恢复 | 原实例retention与逻辑容量507、客户端队列保留、自动GC活动pin/unknown；A导出时B写入、中央副本遗忘失效、空目标恢复不重授旧权限/重放未知。L06用户已选重新登录按原开关继续未来任务；原authority不复活。 | — / UNRUN / 全部 |
| 原首页/设备/插件/MCP | 原首页最近记录/Insight/入口/Home slot、30秒设备刷新、核验/停用退役卸载、reference元数据、真实SDK协议候选与原单次操作。 | — / UNRUN / 全部 |

## 运行证据登记模板

| 记录ID / 行号 | 候选SHA / baseSHA / tree输入 | Owner / 验收chat / PR | 命令与真实入口 / 生成输入 | 结果与回执/日志 | 未执行与原因 / 阻塞 / PM释放 |
| --- | --- | --- | --- | --- | --- |
| WEB-Q002 / WEB-W01、W02 | `f8f684b6dee904d820b9952ead336da5a33f330f` / base2c78ca8d；inputIdentity`cc37d2a7c864bfd87aef4343e74582cca87e387343780842fe7248f3d84c4cc5` | integration driver本chat实跑，PM允许冻结模块准确workdir代跑；Web owner未冒领 | `PATH=/tmp/mote-node24-runtime-20261014/node-v24.21.0-darwin-arm64/bin:$PATH npm run check:affected -- --base 2c78ca8d52a7d17fae20962cf68d09a717ffc73a --head f8f684b6dee904d820b9952ead336da5a33f330f`；cwd原Web工作树 | EXIT0，9/9步骤，116.413s；Web602、Shared198、release-contracts65、release-integration19均0fail/0skip。原receipt=`.git/mote-check-receipts/2026-10-18T11-01-18-502Z-91082734-146e-4fa2-9acc-32eac6a54248.json`；绑定摘要/日志见下。 | 输入未变化，完成后sameHEAD/clean，cleanupConfirmed=true、锁释放。本门禁不覆盖独验/跨EXEC/真实模型/供应商/设备/部署；后续PR#170及R006结果见下一行 |
| EXEC-Q009 / required gate | exact1e9 / base2c78；inputIdentity99e9bb294dca83022cece84186a5008794eac49cbe024bb2757c51cb1022ddaf | driver实跑，PM允许固定模块workdir代跑；未PR/独验 | Node26 ABI147/JDK21/SDK/Gradle1worker，14步从头执行，原Execution工作树 | EXIT0/1490.842s，14/14PASS；Server3133PASS/2skip，Web602/Shared198/release-contract65/release-integration37；Android78XML=373/0fail/0skip、Gradle25/25executed | 两skip为pinned Python Source Pack与macOS sandbox，未执行不作通过。cleanupConfirmed/sameHEAD/clean/锁释放；独验/native UI/Memory >2与其它跨域及新Files/Memory M05接口/真实模型设备部署均UNRUN；发布等槽，非READY |
| MEM-Q006 / required gate失败 | exact72f / base2c78；inputIdentity bc61be0351bad39b10b6afeeb304407e6431f17f87f14157095c49b0f8d2d874 | driver实跑，owner修复已另计第4槽 | Node26 ABI147，`npm run check:affected -- --base 2c78ca8d52a7d17fae20962cf68d09a717ffc73a --head 72f0e55ba26d54f9a3d66fa6e5a8deb706e4371a`，原Memory cwd | EXIT1/1298.654s；8步PASS，Server3160PASS/1FAIL/2skip，后4步UNRUN；query-import-context.test.ts:71 actual importing/expected completed；窄并发1复跑2PASS只作诊断 | 原receipt d5a6098d与完整log/hash绑定driver目录memory-72f0e55b-required-gate-failed.json；cleanupConfirmed/sameHEAD/clean/锁释放。原因待定，不冒生产bug或flaky定论，不抵消失败/不PR/READY |
| WEB-R006 / WEB-W01、W02及必要账号对照 | exact f8 / PR#170；独立前后核head/base、clean与fixture hashes | 客户端独立验收chat实跑，driver只读报告/hash验证；PM随后已审READY | 私有npm ci/build:central/path无symlink；窄12；真实main/scoped生成A/B/empty browser77.096s及13入口11.086s | WEB-W01/W02/必要同文档held-A→B及草稿PASS，6张Home/Devices桌面移动图已核像素/hash，旧错图保留且证据缺口闭合。报告见下。 | 首次外部launcher语法错在产品启动前，保留原log，外部修正后正式两计划EXIT0；冻结源码/持久fixture未改。真实OS隐藏可见性/设备/权限/live/EXEC及新域组合未验；READY不等于释放 |

Q009正式binding：`/Users/utopiafar/.codex/visualizations/2026/10/18/01a14e8d-8f73-7ac2-a490-27ac73d5f6ba/parity-integration/execution-1e9ec7ab-required-gate.json`，SHA256 `a18ccf7f6b96bc2998fec995f2051098f803e3aa3f3d80c03892f79583216656`；同目录required-gate.log/original-receipt.json/required-plan.txt及78份XML hash绑定，原receipt run67404cc8位于common `.git/mote-check-receipts/`。输入未修改且清理确认；不将source-level stage顺序声明转换成实际跨模块验收。

Q002绑定摘要与完整日志：`/Users/utopiafar/.codex/visualizations/2026/10/18/01a14e8d-8f73-7ac2-a490-27ac73d5f6ba/parity-integration/web-f8f684b6-required-gate.json`及同名.log。原始日志中的FAIL来自release-driver负例测试，外层release-contracts与最终9步骤均passed，不当作本候选失败。

R006正式报告：`/Users/utopiafar/.codex/visualizations/2026/10/18/01a14e90-08cc-7631-b1bb-fe8b691c3e27/web-dynamic-r006/acceptance-report-v1.json`，SHA256 `4cb7d378cf69b135e06ff5161f4d8936a95560da5ff5929d8a4ca83f6f6e199b`；同目录acceptance-manifest-v1.json绑定全部脚本/fixture/log/image hash。

原生构建、隐藏Electron/浏览器、Android JVM/instrumentation/模拟器、物理设备、真实模型/供应商与部署分别记结果，不能用fixture替代。最终检查实际失败、中断、UNRUN、skip均保留。GitHub Checks是否启用需单列，空rollup不算通过；不修改Actions设置。

## 首阶段文档核查

首个文档checkpoint（2026-10-18，起点2c78ca8d上的两份新增Markdown，提交3a9a9a15）：

- 编号核对：58核心+6补充+FILE-07+CONFIG-UX01=66唯一主行，12模块覆盖；补充调查表独立编号，不计入66主行。
- 本地链接/锚点9个、23个表格列、代码块配对检查通过；独立只读审阅发现的M03未完成范围不得先发布、L06避免笼统禁止正常恢复两点已修正。
- 使用bundled marked生成HTML、已安装Chrome headless渲染，23表格无水平溢出；人工检查计划首页与矩阵表格截图，文字/表格可读。首次默认Playwright headless-shell缺失，未启动浏览器，随后改用已安装Chrome完成；未下载浏览器、未激活前台窗口。
- 文档回执/HTML/截图：`/tmp/mote-parity-doc-review-20261018/`，回执`document-check.json`。这些只证明文档，不是产品UI验收。
- `npm run check:affected -- --base 2c78ca8d52a7d17fae20962cf68d09a717ffc73a --dry-run` EXIT0：所有affected=false，workspaces=[]，checks=[]。暂存检查首次提示EOF空行，清理后`git diff --cached --check`通过；无应用构建/测试。

本集成chat未运行产品HTTP/应用测试、原生/模拟器/产品UI、真实模型/供应商/物理设备或部署。模块作者通过消息报告的WIP定向结果与独立验收UNRUN分开；无正式模块集成或最终完整gate。

政策/并发增量核查：已记录L06重新登录按原开关继续、AND-D01偏好按账号及设备权限边界；只读全局快照13 active/5 idle，WEB候选等待Q002。新FILE-PERCEPTION调查独立编号，不变更66主行。格式/链接/编号与headless渲染再次核对；原文档回执保留为`document-check-3a9a9a15.json`，增量为`document-check-policy-slots.json`，同文档核查临时目录。文档-only dry-run与暂存diff检查通过；未运行任何应用检查。

后续接缝增量：记录ASK-INTAKE-01作者真实生产fixture红、D2前置5744d6a8与CONN原5min/held scan方向、AND-D01首启动边界；核心66行不变。只做文档核对，回执`/tmp/mote-parity-doc-review-20261018/document-check-seams.json`；没有运行产品检查或通知idle验收组。
