# 开发与测试环境隔离

开发默认使用 dev 中央 47842，测试使用 test 中央 47852；正式部署 prod 使用 47832。不要用正式中央的配置、令牌、数据库、App profile 或实际屏幕做自动化测试。所有验证素材应由程序生成。

## 首次准备

```sh
npm ci
npm run build:libs
npm run build -w @mote/server -w @mote/web
node scripts/mote.mjs init --profile dev
node scripts/mote.mjs init --profile test
```

每个环境都有自己的 `.mote/profiles/<name>/mote.yaml`、`data/`、`logs/`、`backups/` 和 `file-sync/`。`file-sync/` 在第一次明确文件导入时创建。初始化不读取根 `.env`，不继承模型 key，不复制正式资料。默认模型预设使用 Codex；仅验证存储、UI 与同步时，可在该私有 YAML 将 `models.deployment.model` 留空。

CLI 不自动初始化，已有 profile 不会被覆盖；重复 init 报错后直接使用已有配置即可。`--home /absolute/test-profiles` 可创建另一整套环境，Docker project 与 volume 也随路径隔离。不要把私有 YAML 加入 Git。旧 `mote.env` profile 会被拒绝；先停止旧版本、保留原目录，再离线手工填写新 YAML，CLI 不自动迁移。

## 日常开发

从当前源码直接启动中央和网页：

```sh
node scripts/dev-server.mjs
```

该脚本自动创建缺失的本地 dev profile，安装变化的依赖，构建共享库、中央与网页，再以前台进程启动。空账号库首次创建管理员 `admin`，密码为 `admin`；可直接在网页或客户端登录。已有账号与修改后的密码不会被重置。按 Ctrl+C 停止本次服务及其子进程。可用 `--home /absolute/dev-profiles --profile NAME` 选择另一套本地开发环境；初始化仅允许 native、loopback、非 prod 且端口不是 47832 的配置。已有旧格式或不完整的 profile 会被拒绝，不自动迁移。

已构建中央服务并配置命名 Tunnel 的本机 DEV，可用一个命令前台运行两者：

```sh
npm run up
```

该命令使用 DEV 中已有的 Tunnel 凭据并自动启用隧道，先启动中央服务再启动 cloudflared；按 Ctrl+C 同时停止两者，任一进程退出也会停止另一个。已有中央或隧道实例时会拒绝重复启动。它不执行构建、不启动屏幕采集，也不创建 Cloudflare 域名路由。中央日志仍在 `.mote/profiles/dev/logs/central.log`；cloudflared 原始输出仍由运行器抑制。其他原生 profile 可使用 `node scripts/mote.mjs run-all --profile NAME`。

```sh
npm run dev
```

此命令先构建共享库，再通过 `mote exec --profile dev` 启动 API 热重载和 Vite。API 是所选 dev 端口，Web 默认 `http://localhost:5173`。如果先前用 CLI 后台启动过 dev 中央，先 `node scripts/mote.mjs stop --profile dev`，避免两个进程争用同一个环境。

```sh
# 构建完成后启动独立 Mac App，绑定独立 dev profile
npm run build -w @mote/desktop
npm run desktop:dev
```

Mac 的命名 profile 使用独立的用户数据目录、队列、草稿和连接设置。`desktop:dev` 为新 profile 引导所选中央连接，已有设置不会被后台替换；进入客户端后使用账号登录，旧实例 owner token 不能代替当前登录凭据。通过开发脚本初始化的空库可首次使用 `admin/admin`。首次开始截图仍需要用户在 App 中设置并授权；这些命令本身不会采集屏幕。未命名 App 的 default profile 使用原 Electron 用户数据路径，当前本机格式为 4，旧格式拒绝且不自动迁移，详见 [电脑端说明](desktop.md) 和 [更新说明](updating.md)。

运行 test 环境的同一套热重载界面：

```sh
node scripts/mote.mjs exec --profile test -- npm run dev:workspace
```

test Web 默认 5174。Vite 的代理读取 `MOTE_CONFIG_FILE` 选择的 dev/test YAML 中 `server.port`；没有所选环境或端口为 47832 时会拒绝启动。浏览器 bundle 不包含 `MOTE_*` 配置或令牌。`dev:workspace` 是内部命令，应由 `mote exec` 提供环境。

## CLI 工具使用同一连接

任意已有工具都可在所选环境执行：

```sh
node scripts/mote.mjs exec --profile dev -- npm run demo
node scripts/mote.mjs exec --profile dev -- npm run import:files -- --root /absolute/selected-notes --dry-run
node scripts/mote.mjs exec --profile dev -- npm run import:files -- --root /absolute/selected-notes
node scripts/mote.mjs exec --profile test -- npm run import:files -- --root /absolute/selected-notes
```

导入脚本只读取用户明确选择的 UTF-8 文件夹，默认 `.md,.txt`，单文件不超过 100 KB，不递归隐藏目录或符号链接。加 `--extensions .md,.txt,.csv` 明确类型；`--watch` 每 30 秒检查更改。文件状态基于实际所选节点 URL，落在该 profile 的 `file-sync/`，所以同一个源目录可以分别导入 dev 与 test；成功 ACK 后同环境再次运行会跳过不变文件。原文删除不删除中央历史。

`exec` 清除继承的普通 `MOTE_*` 与 `COMPOSE_*` 参数，设置所选 `MOTE_CONFIG_FILE`，并从同一 YAML 派生设备/工具连接 URL 与令牌。普通进程环境不能覆盖服务端 YAML；只有声明的敏感字段支持 `${SECRET_NAME}` 引用。直接运行 `npm start` 默认读取工作目录的 `mote.yaml`，或显式设置 `MOTE_CONFIG_FILE=/absolute/mote.yaml`；导入工具同样支持该文件选择。`MOTE_ENV_FILE` 已拒绝，根 `.env` 不参与加载。API/model 密钥不要写进命令参数、示例文件或公开诊断。

## Android 开发连接

```sh
adb reverse tcp:47842 tcp:47842
```

开发版 Android 填 `http://127.0.0.1:47842`，并显式允许调试 HTTP。开发 APK 使用独立 application ID 和本地存储，与日常版本分开；实际 Gradle 命令及 HyperOS 设备设置见 [Android 说明](android.md)。手机 loopback 默认指手机本身，USB reverse 断开后待传事件应保留，恢复网络再重试。跨设备长期部署使用 HTTPS。

## 验证命令

<a id="background-testing"></a>

### 本地后台测试

本地自动化测试默认不显示窗口、不激活应用、不抢占当前焦点。单测、类型检查、构建及 Gradle JVM 测试直接在终端运行，不需要启动客户端或模拟器。需要 UI 验证时仍运行真实渲染器、preload/IPC 和应用生命周期，使用生成素材与独立测试 profile。

中央网页的首次加载、同范围后台刷新、空状态、滚动时间范围、分页及撤权回归见 [Web 后台刷新稳定性](testing-web-background-refresh.md)。

Electron UI/桌面 fixture 入口必须在导入 `electron` 或产品模块之前加载 `scripts/fixture-background.cjs`（桌面脚本使用对应相对路径）。该测试专用入口强制隐藏窗口、禁止原生窗口获取焦点，并关闭后台渲染节流，使动画帧、DOM 焦点、键盘/滚轮输入及生成页面截图仍可验证。macOS 使用 accessory 激活策略避免 Dock 图标；不使用禁止创建窗口的 prohibited 策略。新建、重建窗口及后续 `show()` / `focus()` 调用均遵守同一规则。产品正常启动行为不变。

```sh
# 后台窗口、真实输入、动画帧、截图和窗口重建的生成 fixture 回归
npm run test:background-ui
# 构建客户端后运行真实桌面 UI 与 profile 重启流程
npm run test:ui -w @mote/desktop
npm run test:profiles -w @mote/desktop
```

隐藏窗口不会自动隐藏系统原生文件选择、消息提示或外部浏览器。因此后台 fixture 遇到未预期的原生 dialog 或 `shell.openExternal` 会报错；未捕获异常（包括 ready 前的启动失败）输出错误并以非零状态退出，避免 Electron 自身显示错误窗口。需要这些操作的测试应在加载入口后提供明确的生成响应或记录目标 URL。原生 Chrome 登录 fixture 已拦截 `/usr/bin/open`；不要为了让测试通过而静默选择取消或绕过授权。资料测试的 `interactive-400` 表示数据和交互场景，默认也隐藏窗口。

确实需要查看界面时，明确设置 `MOTE_TEST_SHOW_UI=1`，例如：

```sh
MOTE_TEST_SHOW_UI=1 npm run test:ui -w @mote/desktop
```

此开关只用于测试进程，会显示 fixture 窗口并允许原生提示；已有生成 dialog/browser 响应仍按各测试原有逻辑处理。自动化 agent 在需要前台 UI、系统授权或人工操作时，应先说明原因和影响；用户明确要求展示时直接按要求执行。隐藏模式不能代替原生焦点、菜单、系统授权等必须前台验证的行为，未执行的检查应单独报告。

Android instrumentation 和 ADB UI 验证优先连接专用、无窗口的 `mote_fixture_api35` 模拟器。以下命令在另一个终端启动它（SDK 路径按本机配置调整）：

```sh
"${ANDROID_HOME:-$HOME/Library/Android/sdk}/emulator/emulator" \
  -avd mote_fixture_api35 -port 5580 -no-window -no-audio -read-only -no-snapshot-save
adb -s emulator-5580 wait-for-device
adb -s emulator-5580 shell getprop sys.boot_completed
```

确认 `sys.boot_completed` 返回 `1` 后，再执行 [Android 说明](android.md) 中带明确 serial 的安装、instrumentation 或页面采集命令。`-no-window` 隐藏的是主机上的模拟器窗口，Android Activity 仍可在虚拟设备内部前台运行；不要把 Activity 压到后台，否则不能验证实际页面。`-no-audio` 禁止声音，`-read-only` 和 `-no-snapshot-save` 避免写回 AVD/快照。端口占用时选另一空闲偶数端口并同步更新 serial；不要停止不属于本轮测试的模拟器。

现有 Android E2E 脚本连接已启动的模拟器，不负责启动或隐藏已有窗口。不要对正在使用的真机直接执行会切换页面的测试；需要真机或系统权限交互时，单独安排和报告该验证。本轮结束后只清理本轮创建的测试进程和临时目录。

<a id="pr-check-scope"></a>

### PR 检查范围

PR 前使用依赖图和构建输入规则选择检查范围；发布组件与检查工作区分别计算，不因 Web 属于 Central 发布就运行全部 Server 测试：

```sh
npm run check:affected -- --dry-run
npm run check:affected
# 指定 PR 基线；默认 origin/main，先获取最新基线
npm run check:affected -- --base origin/main
# 只核对已提交范围，适用于 CI 或明确提交的验证
npm run check:affected -- --base origin/main --head HEAD --dry-run
```

默认范围包含与基线共同祖先相比的已提交改动，以及当前暂存、未暂存和未被忽略的未跟踪文件。移动文件同时检查原位置与新位置，避免把移入文档目录的运行代码误判为纯文档。基线无法解析时命令失败，不会当作无改动跳过检查。`--dry-run` 输出发布组件投影 `affected`、细分范围 `selection` 和实际任务 `checks`，只展示计划，不代表检查通过。

| 改动场景 | 自动检查 | 按实际行为补充 |
| --- | --- | --- |
| 纯文档、根 AGENTS.md、各语言 README、历史发布说明 | 不构建或测试应用；人工检查格式、语法、链接和必要的渲染 | 运行时 prompt、配置及 workspace 内资源按代码输入处理 |
| `docs/design/scope-inventory.json` | scope 契约及检查基础设施回归，不构建应用 | 该文件是检查器的可执行输入，不按纯文档跳过 |
| 仅 Web | Web 类型/测试及共享契约测试；构建 shared、Agent 等实际前置 | Web 集成 fixture 仍使用真实 Server 代码；对应浏览器交互另验，不自动运行整个 Server 套件 |
| Server | Server 及 Web 消费者检查、共享契约与中央运行器回归 | 对应 API、导入/查询/Memory 等流程；客户端契约变化补跨端旅程 |
| Agent / 中央插件 | Agent 的实际消费者，或中央工作区检查 | 对应委派、恢复、插件生命周期及上下文授权 |
| macOS / diagnostics | Desktop 及实际依赖检查、共享契约；diagnostics 变化覆盖 Desktop 消费者 | Desktop 构建、受影响 UI；原生助手/依赖/打包变更在 macOS 编译；权限与系统生命周期单独验收 |
| Android | `check:i18n`、发布工具回归、Gradle debug 单测（包含测试依赖的代码编译） | 对应 variant 构建、lint、instrumentation；后台与权限变化单独真机验收 |
| 共享包或协议 | 检查所有受影响消费者；目前 shared / protocol 选择三端 | 跨端契约与连接/同步生成 fixture；不要把检查范围当作发布范围 |
| 单端发布 workflow | 对应端检查及发布工具回归 | 对应 workflow 的构建、签名和产物身份检查；无关端不构建 |
| 检查选择器、计划、驱动、环境预检及本地检查入口 | 对应检查基础设施回归，包含 CLI 的隔离 Git fixture | 无需应用构建 |
| 通用发布工具、公共 workflow、根配置/lockfile、未知构建输入 | 保守检查全部消费者 | 相关部署、容器、依赖安装或发布链路 |

所有范围由同一驱动执行，先运行所选环境、翻译、scope 契约和纯发布工具预检，再构建、检查类型、执行工作区测试及其余运行时回归，最后执行所需 Android 单测。环境预检核对 Node、依赖是否安装、相关原生 SQLite 能否实际运行，以及 Android 所需 Java/SDK；缺失时直接失败，不自动安装或修复。构建前置与测试消费者分别选择，同一计划中的任务只执行一次；已由构建执行的同份 TypeScript 检查、Agent 隐式构建及共享测试不再重复运行。Server 的 dev-server/profile 运行时回归只随 Server、Central 或全量计划执行，不加入无关 Desktop/Android 计划。

`check:local` 固定选择全部 TypeScript 工作区和根回归；`check:central`、`check:desktop` 固定选择各自工作区，均使用同一驱动。`check:local` 不包含 Android 测试、Desktop 原生编译、浏览器 E2E、真机或真实模型验收。`check:affected` 在共享协议、根配置、lockfile 或未知输入影响三端时仍选择全部 TypeScript 与 Android 单测。新增文案需检查翻译和 Android catalog 同步；shared 和共享翻译目录仍保守选择全部消费者。

模块开发阶段先运行相关定向测试，PR 前仍需完成 `check:affected` 选出的计划。跨模块组合由一个执行者冻结候选并运行完整计划，其他任务提交自己的精确前置、定向结果和未验范围，不各自重复启动同一组合门禁。这些入口在同一仓库的所有 worktree 间共享 Git common dir 下的 `mote-check-driver.lock`；已有驱动时，新请求以非零状态报告 `UNRUN`，不会排队或把占用当作通过。输出包含锁的所属进程和工作目录；只有确认原驱动及其子进程都已结束后才手工移除残留锁。不确定或过期锁不会自动抢占，也不终止其他任务。

每轮回执位于 Git common dir 的 `mote-check-receipts/<id>.json`，只保存输入摘要、逐步状态、耗时及退出/清理结果等元数据，不保存源码、命令输出或凭据。失败、中断和未执行步骤分别保留；执行期间输入变化使整轮门禁失效，已经通过的步骤不能拼成新输入的通过结论。任务去重仅在本轮计划内生效，不跨轮缓存 PASS；回执用于追溯实际验证，不把旧候选重新标成新 SHA 已执行。

选择器不能从路径证明运行时兼容性。例如 Central 即使没有改客户端文件，若改变了客户端使用的 API、授权或同步契约，仍应补测受影响客户端。反之，内部实现、网页样式或普通服务端修复不默认要求 macOS 编译和单测。仅变更文案通常只需翻译与显示检查；新增翻译目录之外的变化按实际输入范围处理。

追加修改后重新选择并执行受影响检查。仅修改 PR 标题/描述不改变被测输入；补充验证文档仍需按纯文档规则审阅，并明确原回执的被测版本。代码、依赖、基线合并或执行环境变化后，不沿用相关旧结果。全量 TypeScript 集成检查保留用于跨模块重构最终验收或影响范围不明的情况，不作为每次单端 PR 更新的固定门槛。发布前始终验证发布组件的版本、构建与产物，以及相关安装/升级流程。

当前规则保留（KEEP）生成 fixture、历史回归、消费者检查和所需旅程验收；改变（CHANGE）为工作区级计划、先预检及跨 worktree 单驱动；移除（REMOVE）按发布端重复构建/测试和无关 Server 运行时检查；例外（EXCEPTION）共享协议、翻译、根配置及未知输入仍保守扩大；未知（UNKNOWN）CI 是否启用及设备/模型环境能力需实际核实，不能由本地选择器推断。CI 使用同一细分计划，Android 验证仍单独执行；本地通过不代表 GitHub workflow 已运行。历史验证报告保留当时执行记录，不改写成新的验证结果。

```sh
npm run typecheck
npm test
npm run test:privacy
npm run test:e2e
npm run test:profiles
```

`test:profiles` 使用系统临时目录和随机 loopback 端口，实际创建两套当前 Wire-2 dev/test 中央 Node 子进程。验证首次账号初始化前的公开健康检查、隔离存储、启停和重启，以及拒绝占用端口、旧 owner token 和不属于该配置的 PID；只清理本次创建的进程与目录。不会使用正式 47832、前台 UI 或外部模型。运行前先完成 `build:central`。当前恢复矩阵见 [多用户恢复生命周期](validation/multiuser-recovery-lifecycle-seams.md)，日志与监督器由发布工具回归和 `test-central-runner.mjs` 单独验证。

main 与多用户集成分支合流后的实际检查、原生与浏览器回归、来源版本和未执行范围见 [2026-10-17 合流回归记录](validation/main-multiuser-integration-2026-10-17.md)。历史报告保留当时的源码和执行结果。

问答依赖或 Memory 启动/恢复变化需覆盖正式 HTTP 与应用重启顺序：宽依赖续问跨过执行租约、核对中删除、外联中删除、未激活任务重启休眠、显式启动后的恢复，以及取消/撤权拒绝。使用生成原件与 loopback 模型 fixture；测试次数、真实模型计量和部署版本分别记录。当前回归入口与执行证据见[租约与启动授权验证](validation/query-lease-and-memory-activation-2026-10-14.md)。

```sh
# 需要 Docker Engine 与 Compose 2.30+
npm run test:container
npm run test:profiles:container
```

第二个脚本实际构建本仓库镜像、启动隔离 Compose project，验证命名卷重建、停止后备份、空卷恢复、镜像切换回退、Caddy 配置解析。临时镜像/容器/卷以测试唯一标识命名；不会 publish 或全局 prune。脚本已加入 GitHub Linux CI。本机没有 Docker 时应明确记录未执行，不能将 TypeScript、配置静态检查或之前版本的 CI 结果当作本次容器验证。

真实 DeepSeek / Qwen 调用与实体手机测试需单独记录所用版本、输入是否合成、耗时与失败行为。macOS 权限、HyperOS 后台恢复、公网 HTTPS、launchd 登录/重启行为均不能由上述 fixture 代替。

## 调试与分享诊断

每个中央环境默认开启有上限的结构化诊断，`diagnostics.debug: false`。需要调试时只修改正在测试的 `mote.yaml`；enabled/debug/traceEnabled/level 经校验热应用，日志目录与容量参数需要重启。中央界面的运行诊断、Mac 和 Android 的支持包用于查看版本、连接类别、队列状态、数值指标与固定事件。分享前仍应查看导出内容；不要改为转发原始截图、OCR、随手记、模型 prompt 或 token。

原生 `logs/central.log` 默认只保存固定监督事件；未知 SDK/runtime 输出只保存类型与字节数。新 DEV 的 YAML 省略 `diagnostics.maxBytes`，每份最多 100 MiB、3 份；结构化 `central.N.ndjson` 与监督日志分别轮转，各最多 300 MiB。其它 profile 保留每份 2 MiB、3 份。已有 DEV 的显式数值保持不变，主动采用默认值见 [部署说明](deployment.md#dev-log-retention)。支持包、内存事件数和单条日志仍各有自身边界。

## 独立版本与发布

保留 npm workspaces。Central（server + web）、macOS、Android 分别维护版本和标签；改动一个端只发布该端。共享依赖和协议改动需要检查所有受影响端，但不会自动生成其他端的发布。操作、发布产物和迁移说明见 [发布流程](releasing.md) 与 [独立发布架构](release-architecture.md)。
