# Focused development and candidate validation

## Daily feedback

Run the narrow command that exercises changed behavior after a coherent batch of edits. A report, handoff or Draft PR update does not trigger wider checks. Do not run `npm test` and then append a file when the npm script already contains a full glob.

| Module | Focused command (module working directory unless stated) |
| --- | --- |
| Server | `node --import tsx --test --test-concurrency=4 --test-timeout=120000 test/connections.test.ts` |
| Web | `node --import tsx --test test/api.test.ts` |
| Desktop | `npm run test -w @mote/desktop -- test/config.test.ts` from root |
| Agent | Build changed shared/Agent libraries, then `node --test packages/agent/test/task-context.test.mjs` from root |
| Android | `apps/android/gradlew -p apps/android --no-daemon :app:testDebugUnitTest --tests 'actual.package.TestClass'` from root |

Replace examples with an existing affected file/class. Use Node `--test-name-pattern` before the filename for one diagnostic case; report that selection. Build shared inputs only when changed or absent and coordinate shared output with other owners. SQLite must match the active Node ABI. Preserve existing timeouts, assertions, data scale and lifecycle coverage.

## Early integration and candidate checks

For cross-module work agree on one small real journey and connect it early: actual entrypoint/startup, authenticated action, producer output and consumer result. Add relevant restart, cancellation or partial-failure states as their modules converge. A manually composed internal object is not evidence for actual startup.

After planned changes converge, one owner inspects and executes the candidate plan:

```sh
npm run check:affected -- --dry-run
npm run check:affected
# Explicit comparison for a recovery branch:
npm run check:affected -- --base origin/main --head HEAD --dry-run
```

The dry-run is the default scope, not a proof of runtime compatibility. Add consumer/journey checks for a real contract or safety risk, not because a turn ended. `check:local` is broad TypeScript integration, not daily feedback. The recovered selector has no `--test-file` or receipt API; use the direct commands above.

After a fix rerun checks invalidated by source, dependency, fixture, configuration or environment changes. Reuse unchanged successful results without another run. Never reuse failed, interrupted or uncertain-cleanup results. A repeated failure should prompt diagnosis; do not endlessly replay the same test or stop useful repairs merely at an arbitrary count.

Document-only changes receive formatting, grammar, link and rendering review. Product or protocol changes may need native builds/UI checks. Report fixture, physical-device and live-model checks separately. Historical results are not current evidence.

## Logs

Keep verbose logs in ignored files; print a short result and inspect failure excerpts. Preserve exit status, for example:

```sh
mkdir -p .mote/checks
npm run typecheck -w @mote/server > .mote/checks/server-types.log 2>&1
check_status=$?
if [ "$check_status" -ne 0 ]; then tail -60 .mote/checks/server-types.log; fi
exit "$check_status"
```

## Risk-based review

Small fixes and internal implementation changes need focused checks, not a new approval process. For a module feature, state its behavior and consumers briefly. Changes to authorization, destructive data behavior, persistence contracts, cross-client protocols or major lifecycle ordering need a bounded technical plan and an independent explicit APPROVE before implementation. Bind that review to the revision, scope and assumptions; review only a changed decision boundary again.

The plan compares old/new user entrypoints, state transitions, risks and real-boundary validation. Use KEEP/CHANGE/REMOVE/EXCEPTION/UNKNOWN when an architectural responsibility is superseded, not as a mandatory form for every edit. Test changes that relax valid assertions/timeouts/success criteria or change the tested entrypoint require the same coverage review. New product policies still belong to the human owner.

Do not require per-edit evidence ledgers, full-suite reruns at handoff, or repeated reviews of an unchanged approved design. [Coordination](agent-development-workflow.md) applies only when work actually needs multiple owners; [CI](ci.md) describes final revision checks.

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

