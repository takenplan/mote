# 多用户越界恢复闭合表与技术方案

状态：2026-10-19，治理规则落实与恢复方案；**正式业务汇总 HOLD，未宣称全部恢复。** 本表复用[正式计划](multiuser-parity-restoration-plan.md)和[66 行矩阵](../validation/multiuser-parity-restoration-matrix.md)，不另建一套通过标准。人类要求“把改造越界的部分都改回来”，恢复基准是旧单用户完整业务旅程；不能整树回退必要隔离或已确认安全修复。

## 恢复基准与取代边界

行为对照是 `2c2627621e2598332ae8169845bc7343be7ed63e`，本轮起点为 `2c78ca8d52a7d17fae20962cf68d09a717ffc73a`。遵守[共享业务流程](../adr-shared-business-flows.md)、[多用户作用域](../adr-multiuser-scope.md)及[当前格式基线](../adr-mvp-baseline.md)。旧 builder 只作特征对照，不重新挂载成生产旁路。

| 分类 | 恢复要求与依据 |
| --- | --- |
| KEEP | 原领域职责，真实入口→准备→处理/理解→提取→独立审核→保存→读取消费；原输入/配方/默认、顺序、时序、成功步骤复用、失败/重试与取消语义。保留原件、精确证据、只读查询工具、删除/撤权及外部结果未知边界。 |
| CHANGE | 仅必要的账户身份、私人配置/凭据、数据/缓存/索引/队列/设备归属、任务授权及跨 await 发布 fence。单账号与多账号共用领域实现，宿主适配已绑定账号的 ports。每个新增差异仍须证明必要性。 |
| REMOVE | 隔离改造中漏掉职责的替代流程、隐式 owner/全局私人访问、无依据的固定业务限额、手工步骤或静默降级。只删已确认且尚未恢复的 delta；不因 harness 失败改产品。 |
| EXCEPTION | 已明确批准的当前 wire/storage 与无旧版迁移；取消内部 Agent 任意字符上限；录音备份不自动 ASR、显式/普通音频处理保留；Dev 私有文件凭据/Prod 保护；L06 重新登录后按原开关续未来意图但不复活旧执行权；Android 偏好按账号、OS 权限仍设备级。依据见正式计划“行为合同与取代检查”及相关 ADR。 |
| UNKNOWN | 无源码/真实旅程证据的差异、原实模图像失败、完整 native WRITE、物理权限和供应商行为先查因。未知不是批准删功能、降级配方、放松授权或宣称恢复的理由。 |

原审计为正式计划所列总报告与 12 分报告；历史已恢复项沿用准确包及其限制。FILE-07 是原有缺陷观察，不自动变成新的多用户回归或已批准永久缺口。

## 唯一目标与准确依赖图

唯一正式目标为 `codex/parity-integration-20261018` 的汇总 Draft，后续 main 不合。核对时该分支为 `c6110e6122ac87d88a586ab10c2e303b7372e643`，仅管理文档 checkpoint，不是业务交付 SHA。13 个模块/工具 PR 的实际 base 都是这个分支，均 Draft/unmerged；其业务 head 此时均不是正式分支祖先。治理文档后续推进不改变这个业务状态。

| 对象 | 精确身份 | 当前用途及限制 |
| --- | --- | --- |
| 临时全源组合 | `codex/all-new-source-temp-20261019`；HEAD `cd0da8d156c1241eef766c033da13b131b6fac6f`，tree `25b5188197ae7aeedcdccffc21233301e199d30c` | 当前业务观察对象，含下面 13 原 PR head 及已绑定最小修正祖先。原完整检查覆盖 22P/1F/0UNRUN，整批仍 FAILED。 |
| Web 测试子候选 | `codex/web-recovery-observer-20261019`；HEAD `3efdec1b48b37a6c8a0405dacc1d3b4bb2bd22ab`，tree `ef7c7822ee8368140b60a7c16e814e79b16b5bb6` | cd0 的 test-only 子候选，正常 delta9P；不是新全23P、正式 shipping 或原13浏览器场景通过。 |
| 可选诊断候选 | `codex/m07-review-diagnostic-cd0-20261019`；HEAD `2b9950b574e602e1057708aea3bc68d1b40ebc59`，tree `212eedb7aa0ff393be167f50ef160d9ed3c61803` | 另树、默认关闭的诊断能力，仅 component diagnostic；未准进入业务 shipping。外部临时 harness 不改变产品默认。 |

以下为当前 PR 实际 head 与临时组合绑定。修正 child 是拟推广输入，不能冒充 PR 已更新。完整 40 位 Git 身份及祖先核对保存在 driver 的 `boundary-current-source-snapshot-20261019.json`，SHA256 `8ad624d017ff787d57964f9686e9a9653740ce257b78cbc474684110500060fa`；对应组合回执见正式计划当前检查点，不复制或重新移植源码。

| 模块 / PR | 当前 PR shipping head | cd0 中的最小修正/依赖绑定 | 正式目标 |
| --- | --- | --- | --- |
| WEB / #170 | `f8f684b6dee904d820b9952ead336da5a33f330f` | Web port `a33d3c11555a1f984d9c2b2a4319c77033223c39`；3ef 仅测试 delta | 未含业务 head；未释放 |
| EXEC / #171 | `070ffc04a859d01551674070cdf16551a2c29928` | 备份 child `b7c7d154657ba0a383dad9f5a48b03b6251f5f1e`；组合物理结算修正 `2b5f6fe30156e146bba1e5b1d8b2f6e17a6a3289` | 未含；未释放 |
| AND / #172 | `2622844e3b226f3ebae9542bdb16aafedc5cf3a7` | 原 head 为祖先；当前 APK 523→cd0 的精确输入桥另证，不称重新构建 | 未含；native 全链未验 |
| TOOL / #173 | `be096a80d988d13cfbe2fc7c1447f59d06b46975` | 原 head 真祖先；按实际 PR diff 选择消费者 | 未含；不是绕过最终检查的例外 |
| LIFE / #174 | `b30c2cb5e1de4bcd1082c0ef2c7185fe6b42f70a` | 依赖 M07 schema/EXEC quiescence；组合 lifecycle fixture 修正逐 commit 保留 | 未含；未释放 |
| EXT / #175 | `5a5ed7bfeaf1c33409c84bdb6ba906e4e103763a` | 原 head 真祖先；组合 probe/current-authority fixture 修正保留 | 未含；未释放 |
| FILE / #176 | `f29ffd94b6cdfccbffbafe248ead37d057fce7de` | File46 真祖先；canonical ACK `f40f8648e262d790dcefbf0c6ec5cbecaf177853`，shared consumers 同步 | 未含；未释放 |
| MEM / #177 | `6f44fc26b79e71a2ac43ccd667ab192cbe6d6744` | port `60eeb763fef1d995302c3d273149d6cccd0e7182`→ACK consumer `d1d10d96345e3ee878da14dc8463e773feb013e5`；强录音 fixture `f5b8dbe207102c33a756632d98cd646da89c7d44` | 未含；2b 诊断不自动纳入 |
| CONN / #178 | `a562a1f2cd76ed905a2c556e0e99aa4b6844eab0` | 原 head 真祖先，RecordingFlow/FILE/MEM 接线保留 | 未含；未释放 |
| ASK / #179 | `a0215837f71bda236dc2c719a07e963a44bf7f6f` | port `d217eff783331fe27176d9699a1c66f2f752fe94`→ACK consumer `f62c41d2d97016340d0282539dcd0d044217a288` | 未含；未释放 |
| CONFIG / #180 | `2aa08c862087532807b22bada91545ebc69a6720` | fixture child `683625ea1e42b0d9af16c0447ac8b50aaebaa211`；M04消费者保全 | 未含；未释放 |
| ACTION / #181 | `2689e88d7ac2a58257903021d4224cd13bcd3c81` | `d09fb20cd129ed01985638b4ba12467f3953d95b` 真祖先，依赖 M05/M07 与 AND target | 未含；WRITE未验 |
| DESKTOP / #182 | `55b40d37a4948fd40db194f6448b92ac1a287db8` | ACK consumer `b6ffb678a160cc18ceb1e46cf6de244b552b42e5`；依赖 File f40 | 未含；完整D1–D4未验 |

业务依赖仍是 FILE→canonical Material→MEM/ASK；CONN→FILE/MEM；CONFIG 与 EXEC→全部模型/Operation消费者；ACTION→Android target/WorkManager→设备日历；LIFE→所有域的导出/删除/恢复。唯一 composer 只处理已释放输入；不把含12模块的临时头整体灌进单模块 PR。PM 一次释放正式汇总后，按依赖合入、核已含 commit、冻结新的正式 SHA，再由唯一 driver 做最终完整检查和独立验收。当前不新增“正式目标 SHA”。

## 越界恢复闭合表

“已有证据”仅在原精确输入和范围内复用；**实现存在、源码批准、fixture P、临时实际子范围 P、正式交付**是不同状态。下面 12 组覆盖原矩阵全部 58 核心加 8 补充行；逐行断言仍在原矩阵，不能用组状态覆盖单行未验。

| 行范围 / 原行为及越界差异 | 当前临时候选已有恢复证据 | 尚未闭合与下一最小动作 | 必要隔离 / 例外依据 | 唯一 owner、独审及消费者 |
| --- | --- | --- | --- | --- |
| MEM-M01..M08：完整准备/读取/理解、连续批、独立审核、及时保存与后续消费；早期缩短输入/分散调度/缺职责须恢复 | 6f44 与后续最小 port/强录音合同在组合中，原方案、独审和定向/Server消费者证据保留；2b 非模型真实relay/smoke 2P | 当前真实图片提取/复核完成却保存失败，自动根因UNKNOWN；另一次component因OCR未就绪未进模型。先用已审诊断定位，不把OCR-only当恢复。确认产品delta后原MEM先交新方案；原真实自动输入→独审→保存→Ask全链仍必验 | 私人space/epoch/来源incarnation/grant/pin与单publisher必要；保独审和原配方。无批准删图像理解或缩窄所有非录音输入 | MEM原作者；Domain/现有Memory独审；FILE/ASK/EXEC/ACTION消费者 |
| FILE-01..06、FILE-07：原处理/导入/图片配方/原件与历史入口；不能只剩索引或上传 | File46/f40恢复当前同immutable输入的canonical ACK与缺原件resupply，M07/ASK/Desktop强consumer已组合；原正常处理、portable等准确回执复用 | 显式processing字段等未覆盖边界保原完整路径，不当永久例外；补最终原入口→处理/原件→Material→消费与同ID隔离。FILE-07旧缺陷先保OLD，不新增无因回退 | 账号/原件hash/bytes/MIME/current head/source/epoch/retention必要；ACK丢失恢复不铸造旧authority、不新增TTL | FILE原作者；Domain；ASK/MEM/Desktop/Android与LIFE |
| ASK-A01..A05：原检索/上下文/引用、持续输入索引、历史和重启；不得只补transport | 最小port、per-record proof/兄弟隔离与ACK consumer真祖先；真实held/late/删除等组合fixture证据保留 | saved Memory依赖的一段实际未达；完整当前文件→检索/Memory→Ask回答/历史与A/B隔离待。无确认新源码bug不重写检索或替代模型语义 | 当前授权/证据pin/历史删除与普通修订区别、取消/迟到结果fence必要；无关键词路由/静默fallback | ASK原作者；Control/Domain；FILE/MEM/CONFIG/EXEC及客户端 |
| CONN-C01..C07：发现分页、既有配置/筛选、分阶段元数据/转写/备份、显式处理/回听 | 共享RecordingFlow与账号ports、独立错误/重试/locator及下游接线；a562既有whole/consumer与限定实际证据复用 | 当前整旅程/供应商/跨端尚未全证；仅针对新证差异开任务，不重做不变源码或把phase fixture冒供应商验收 | 账号/source/recording绑定必要；人类批准备份不自动ASR，普通/显式音频处理保留，成功兄弟不覆盖错误 | CONN原作者；Control；FILE/MEM/CONFIG/Android |
| EXEC-X01..X03、EXEC-S01：原family/parent进度、lane、公平推进/动态容量、每call预算及物理未知 | 070与组合修正保实际engine/grant/epoch/quiescence；exact cd0 Server组件与原有限physical/checkpoint回执复用 | 不把旧failed/未发行usage抹掉；最终持续积压/取消/未知调用/后续恢复消费者仍按矩阵验。新harness raw/HTTP比较缺陷不改产品usage SQL | 每账户queue/authority与实例共享容量必要；原未知物理结果不得被重试或restore放行；无新业务预算 | EXEC原作者/唯一composer；Control；所有Operation与模型消费者 |
| CONFIG-C01..C07、CONFIG-UX01：原保存/草稿/秘密、有效模型runtime、费用片段、配置/存储UI | 2aa及683 fixture/当前消费者已组合，原bounded/正常Web等回执保；无更换原Codex域 | 新A/B鲜登录、个人OCR凭据CAS尚未到；先修验证器/实际验证。有效域覆盖须明确，不以saved字段冒effective/admitted。原体验差异只按新证据修 | 实例共享引用与用户秘密/模型域分离必要；保持固定Codex、原context/运行参数，无fallback或新限额 | CONFIG原作者；Control/Domain；全部模型/FILE/EXT和Android配置UI |
| DESKTOP-D1..D4：原采集/浏览/同步、持久队列、丢ACK/过期会话/重启自动续传 | f40/b6强consumer与R15具名实际D2 automatic renew→canonical commit/closed pending证据；原生成D1子范围保 | 完整D1–D4/最终B/物理TCC未证；沿原App/队列/生命周期补验，不将transport子范围或hook等同全客户端恢复 | stable deployment/account queue归属、撤权/迟到ACK fence必要；保原自动恢复，不能加手工重传步骤 | Desktop原作者；Client；FILE/EXEC/LIFE与Android同协议 |
| AND-01..04、AND-D01：原采集、恢复队列、隐私、账号偏好与OS权限/后台生命周期 | 原262生成模拟器采集/排除/遮罩子范围及新AVD两阶段APK/Calendar保留各有限接受；离线observer源证据分列 | App原登录→偏好→OS Calendar→target→WorkManager→claim/WRITE/ACK仍未达；79新harness合同不等实际。Native端口单点须先delta方案独审；不改产品来过fixture | 偏好按账号为已批准CHANGE，OS权限/硬件仍设备级；队列不转属，未解决结果不重发 | Android原作者；Client；ACTION/Ingress/CONFIG/LIFE |
| WEB-W01..W02：原Home/Notes/文件/录音/配置/原件与设备刷新、离开停止/回来继续 | 原f8/a33与限定浏览器证据、3ef test delta9P保留 | cd0 v4实际1P9F3UNRUN是harness归属/前置/停止传播问题，未知首因不归产品；ea6e方案→新seam合同→短资格→另GO原13，保25–39s polling/31.5s离开等原断言 | 当前account generation与stale response fence必要；不重做导航架构/删场景/以blank timeout当独立覆盖 | WEB原作者；Client/现有Chrome独审；CONFIG/CONN/EXT/LIFE |
| EXT-E01..E03、EXT-ES01/ES02/EC01：原probe/启停/收发能力、MCP结构与恢复 | 5a真实issued/unknown journal/checkpoint与有限consumer证据；组合源/fixture已保 | 最终actual安装/服务/写ACK及未知重启接缝按原scope验；不把MCP结构UNKNOWN判成应删除，也不重发未解决外部动作 | 可信package实例/用户capability/namespace必要；已发行未知call保留，restore不恢复执行权 | EXT原作者；Client；CONFIG/EXEC/WEB/LIFE |
| ACTION-A01..A04：完整segment语义producer→建议→独审/批准→设备交付及失败/撤销 | d09包含producer闭环；原A文本proposal/v1/proposed、B404有限事实保；不是只有consumer接口 | 原图像task blocked/attempt0，currentgeneration原因UNKNOWN；native target/claim/WRITE/ACK未到。原任务不清receipt、不伪新授权；新最小产品修正须先因果方案 | owner/epoch/source及独立批准、真实native target与delivery fence必要；不以复活旧grant解决 | ACTION原作者；Domain/Client；MEM/EXEC/Android |
| LIFE-L01..L06：原保留/容量、导出/删除/恢复与未来意图；恢复数据不复活授权 | b30及M07 schema217/EXEC quiescence/当前portable与future fixture修正已在临时组合；旧回执/失败均保 | 正式exactSHA的完整backup/restore/delete/未来A→B→A与下游真实入口仍需，先确认未恢复delta，不重复已有同输入证据 | 全实例备份/个人导出边界；用户批准重新登录按原开关续未来意图，仍需当前身份/新授权，旧外部UNKNOWN不重发 | LIFE原作者；Control；所有域/客户端与EXEC |

当前没有证据把上述任何整组写成“正式目标已恢复”。已准确恢复的子项引用原证据，不新增重复实现；缺口只分为尚未验证、已确认尚未恢复、因果UNKNOWN。下一任务须明确属于哪一类，不能一律“重构恢复”。

## 开工前方案独审与当前派发

稳定规则已写入[AGENTS](../../AGENTS.md)及[开发指南](../development.md#technical-plan-review)。执行状态为 `PLAN → INDEPENDENT_APPROVE → IMPLEMENT → AFFECTED/CONSUMERS → ORIGINAL_JOURNEY_AND_ISOLATION → TARGET_COMMIT_VERIFIED`；源码批准不是 runtime GO，fixture P 不是用户链路通过。

每个方案绑定准确 base/head、计划字节身份、旧/新完整旅程与五类取代结论、必要隔离或人类例外依据、最小改动/共享文件唯一owner、消费者/状态转换/真实入口验证、风险与资源。独审按难度用Sol Medium/High，不默认Max/Ultra；小修2–3段delta即可。范围或假设变化先补独审，产品政策只由人类决定，已准工程动作不重复请示。原owner唯一实现，Root唯一实际source派发/full；全局连同子代理和其他active工作target5/hard6，不能为新流程填槽。

| 当前项 | 准确方案/既有证据 | 下一步边界 |
| --- | --- | --- |
| Memory资料准备诊断 | 独立bc89bd14/2beb5bcc及PM限定scope批准可在准确范围复用：正常intake一次、默认recipe、本地OCR真实publication/current Material/image pin、独立30s与精确OCR基线 | 不代替原automatic/image-understanding；outer覆盖缺口等新delta须明确审查。已运行source自然封存；后续新实现批先独审APPROVE，actual另freshGO，同profile资格不转移 |
| Chrome M1–M4 | 独立ea6e812f/4862d3b2及PM准确批准可复用；正常CLI、role归属、sticky safety、共同setup、一次正常cleanup；S4固定短入口已批准范围 | 新包先S0–S3真实seam合同/差异复核，freshGO才S4，再distinctGO原13；不以测试selector删原旅程 |
| Native v2及端口delta | ebc21740的79新生成合同一次P；源码独审921ebcd1确认原四机制闭合，但同profile端口禁用冲突仍BLOCK | 当前仅原Client提交最小端口delta方案；独立APPROVE后才实现tinychild，新79/旧127不重复；没有App/runtime许可 |
| Domain用量基线delta | a58首次实际FAILED；Root99ae2cae接受44refs与当前停止态。新source在本指令到达前已运行 | 正常封存，不能追认为开工前方案批准；保HTTP可见与完整raw各基线/实际脱敏集合/隐藏行观测边界，后续改动先独审delta。无第二runtimeGO |

本治理方案与闭合表本身尚待现有两位独审按关联范围复核；不是对所有未恢复业务delta的实施总授权。不得恢复Final或新建一批常驻actor填流程。独审只核新增边界/证据映射/最小任务，不重审全库存、不重跑昂贵检查。已有准确范围的独立验收自然进展，不为补流程中断或追认。

## 验收与交付判据

1. 原owner只对已确认且未恢复的差异实现已批准最小方案；UNKNOWN先查因，harness缺陷由harness owner修，不据其改业务。
2. 固定候选按实际PR base/head完整diff执行 `npm run check:affected` 与相关消费者/旅程。文档治理本次只查语法、格式、链接和渲染，不构建测试应用。
3. 原单用户真实入口A→B→C/产物/恢复加账号隔离对照，覆盖关键状态与生命周期；记录原输入/有效配置/配方/顺序。真实模型、设备、物理权限和fixture分别报，未做UNRUN；诊断成功不替代完整链路。
4. 任一失败整批FAILED，firstFailure/UNKNOWN保留；有安全证明才继续独立case，归属不明锁存并正常收尾。不得用新结果改绿旧批次。
5. PM释放后才正式集成；核每个相关commit已在所称目标、冻结最终正式SHA、完整checks/UI/live/final review。main不合、未部署，准确输入复用仍须具体依据，不能预先豁免。
