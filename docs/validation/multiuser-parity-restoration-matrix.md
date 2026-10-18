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
| WEB-W01 | C+N / P2 | 原首页内容/入口/Home slot | FILE / ASK / EXT / MEM | 生成新/已有数据账号打开今天：原导入/新增来源/最近记录原文/最近Insight预览引文数/设备模型提示/扩展Home slot均按原层级可达；账号Api和晚响应隔离保留。 | W01；静态12项检查中的首页部分 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
| WEB-W02 | C+N / P2 | 设备原30秒可见刷新 | EXEC / DESKTOP / AND | 页面保持可见，生成设备心跳/队列100→0/错误解除后按原30秒节奏更新；前后台/断线恢复不冻结；与 Operation family 修复独立验证。 | W02；静态timer→loader断链 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |

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
| LIFE-L04 | C / P1 | 中央导出内容副本删除生命周期 | FILE / MEM / ASK | 完整导出→忘记文件/删采集→旧中央content下载拒绝且不残留可读正文/原件；重复导出副本可清理，无内容回执可保留；不要求擦除用户离线备份。 | L04；静态保存/下载/删除全链 | OPEN；无候选证据；全部旅程UNRUN；待owner候选/验收 |
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
| FILE-PERCEPTION / FILE-02关联 | FILE领域/ports/API与历史preview-confirm；CONFIG专用Web/必要Kotlin；ASK查询消费 | PM确认静态能力缺口，待生产入口复现：旧图片独立auto/profile、外部OCR、allowQueryImages、日期/来源complete/recompute preview确认未接scope；通用processing页不等价。与自定义image/caption/readiness联合，不能挂global legacy或另造业务流。 | 调查；三owner已active接收，独验通知等G004槽 |
| ASK-INTAKE-01 / ASK-A02 × MEM | ASK / MEM publication port | 作者新增真实生产fixture先红：noteCapture经MemoryHost captureMaterials→PrivateData直接publish，Ingress/M06 hooks未收到，canonical embedding为0。双方协调最小Material publication通知port，Ask订阅新发布输出；不改Memory语义、不做查询时历史扫描/backfill。作者报既有A01 16/A04 8/A05 HTTP4+MCP4/A02 24项定向通过，均在途、未附冻结SHA，不能覆盖新缺链。 | 作者生产fixture失败已报；修复后真实intake→发布通知→scoped embedding/检索及双用户/修订删除/重启待验，独立UNRUN |
| CONFIG-EXT-HINDSIGHT / CONFIG-C02 × EXT-E02 | EXT / CONFIG、MEM | EXT报告新Hindsight实际probe构造与原provider执行构造并存；固定Codex executable/home必须同时进入二者。只合原执行构造一行不能关闭C02或E02。冻结组合后验证生成runtime路径、probe及正常执行、撤权与账号隔离；冲突解决请两owner复核。 | 在途结构依赖；无候选SHA/组合运行证据；独验UNRUN |

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
| 尚无业务运行 | — | — | — | UNRUN | 无候选或释放；仅文档阶段 |

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
