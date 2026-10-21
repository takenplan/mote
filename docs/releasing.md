# 发布版本与签名

Mote 保留 npm Monorepo，按独立安装/部署单元发布。根 `package.json` 是私有工作区控制入口，不再代表产品版本；共享内部库随使用它的产品从同一提交构建。

## 最简规范：先 Profile，再 Tag

| Profile | 用途 | 默认行为 |
| --- | --- | --- |
| `dev` | 开发、自测 | 详细结构化日志、客户端诊断与调试入口；Mote 自有凭据使用私有本地文件，不调用系统密钥存储 |
| `prod` | Beta 内测与正式使用 | 常规诊断，关闭开发入口和额外采样；客户端保留系统密钥存储 |
| `test` | 自动化 fixture | 独立身份、生成素材；不作为分发 Profile |

Central 的运行 Profile 来自私有 YAML，源码包本身不包含环境配置。Mac / Android 的构建 Profile 用于选择安装身份和默认能力；Mac 正式构建显式选择 `--profile=dev` 时同样使用 Dev 文件凭据。第三方 Lark / DingTalk CLI 等组件继续管理自己的密钥。Central 现有私有 YAML、SQLite 和 secret 文件保持归属，不重写为另一份 JSON。多用户个人正文 trace 仍由本人显式开启，Dev 的结构化 debug 不扩大任何资料授权。

| 场景 | 标识 | 产物位置 |
| --- | --- | --- |
| 日常 Dev | `<组件>-dev-<commit SHA>`，不创建 Tag | GitHub Actions Artifact，含 `build-info.json` 和校验元数据 |
| Beta | `<组件>-vX.Y.Z-beta.N` | Prod Profile；GitHub Pre-release |
| 正式 | `<组件>-vX.Y.Z` | Prod Profile；GitHub Release |

组件为 `central`、`desktop`、`android`，各自递增版本；Android 每次发布还递增 versionCode。Tag 不可覆盖，Pre-release 只是发布状态，不控制 Debug。Beta 与正式版使用同一 Prod 安装身份；Dev 与 Prod 的数据、配置、凭据及客户端身份隔离。当前仍手动安装/部署，不恢复签名在线更新或 GHCR 镜像。

| 发布单元 | 版本来源 | Prod 公开附件 |
| --- | --- | --- |
| Central | server / web 的 package.json，两者一致 | `mote-server-X.Y.Z.tar.gz` |
| macOS | desktop 的 package.json | `mote-desktop-macos-<arch>-X.Y.Z.zip` |
| Android | `apps/android/version.properties` | `mote-android-arm64-X.Y.Z.apk` |

版本中的 Beta 后缀原样出现在附件名。三个单元分别走 [Central](../.github/workflows/release-central.yml)、[Desktop](../.github/workflows/release-desktop.yml)、[Android](../.github/workflows/release-android.yml) workflow；一个标签只构建和分发一个组件。架构和升级边界见 [独立发布架构](release-architecture.md)、[Profile 与发版 ADR](adr-profile-release-policy.md) 和 [更新说明](updating.md)。

## MVP 阶段的 GitHub 检查开关

2026-10-02 暂停 GitHub 的 `Checks` 和 `Component checks`，仓库变量 `MOTE_PRE_RELEASE_CHECKS=false`。Profile 规范落地后，该开关只允许 Dev 构建跳过可选测试。Beta / 正式标签始终执行对应组件检查；Mac 还必须执行打包后 smoke，Android 执行 release 单测。构建、版本、签名、安装身份和附件完整性检查始终执行。此 PR 不修改线上工作流启停状态或仓库权限。

需要恢复时运行：

```sh
gh workflow enable checks.yml --repo utopiafar/mote
gh workflow enable component-checks.yml --repo utopiafar/mote
gh variable set MOTE_PRE_RELEASE_CHECKS --repo utopiafar/mote --body true
```

这会恢复后续 PR/主分支检查及新发布的测试；完整 `Checks` 仍需手动触发。旧标签保留创建时的工作流，不受新提交中的测试开关控制。

旧 `vX.Y.Z` Release、标签和 `release/notes/X.Y.Z.md` 保留追溯；新发布不再使用统一标签。初始拆分保持各端原安装版本与 Android 版本码，调整发布流程本身不创建安装包。后续只递增实际发布的组件。

## 开发早期版本编号

2026-09-14 将对外版本重新从 **0.0.1** 开始，保留已实现功能和代码历史，撤下此前的 GitHub 试验 Release。版本编号较小不会改变应用签名、数据格式或用户目录；Android 内部 `versionCode` 从 11 递增到 12，后续每次发布继续递增。

此前 Mac 和中央节点的自动更新按语义版本比较，因此不会将 0.0.1 当作更新；切换时应手动更新中央部署、退出并覆盖替换 Mac App，保留配置、凭据、模型与数据目录。Android 按内部版本码比较，原有更新流程仍可识别 code 12。不要绕过签名校验、复用较低 Android 版本码或卸载应用来完成切换。项目仍处于开发早期，当前版本不承诺功能和协议稳定。

## 历史完整发布产物（含尚未恢复的在线更新附件）

| 产物 | 用途 |
| --- | --- |
| `mote-desktop-macos-<arch>-X.Y.Z.zip` | 对应架构的独立 Mac App，含本地原生助手和更新助手 |
| `mote-android-arm64-X.Y.Z.apk` | 日常 Android 应用 |
| `mote-android-dev-arm64-X.Y.Z.apk` | 独立开发环境应用，不与日常设置混用 |
| `mote-server-X.Y.Z.tar.gz` | 目标机器上构建的中央源码包，内含前端与部署工具 |
| `mote-release.json` | 带 RSA 签名的发布清单；客户端依据它验证版本、资产和镜像 |
| `SHA256SUMS` | 供人工核对下载；自动更新仍须验证签名清单 |
| `ghcr.io/utopiafar/mote:X.Y.Z` | Linux amd64/arm64 中央镜像；更新实际按签名中的不可变 digest 拉取 |

模型权重由模型管理器另行下载或离线导入；更新安装包不会重复分发或清理已下载模型。源码包从已提交快照归档；Prod 对应精确 Tag，Dev 对应提交。忽略目录、个人配置和签名材料不在其中。

## 签名配置与历史清单密钥

签名材料保存在 GitHub 仓库的 **release Environment Secrets**。该环境允许历史 `v*` 及 `central-v*`、`desktop-v*`、`android-v*` 标签的部署。首次启用独立工作流时，维护者需在 Environment 的 Deployment branches and tags 中添加三个组件标签规则；此设置不在 Git 仓库中，版本验证器仍要求准确的组件版本标签。普通分支和 Pull Request 的测试无需签名私钥。Workflow 只写 Secret 名称，通过环境变量或临时文件使用值；临时签名文件在构建结束后清理，不作为 artifact 上传。不要把私钥粘贴到 YAML 或 Release 附件。

| Secret / Variable | 内容 |
| --- | --- |
| `MOTE_RELEASE_SIGNING_KEY`（Secret） | RSA 3072 PKCS#8 PEM 私钥，签署原始 manifest payload 字节 |
| `MOTE_ANDROID_KEYSTORE_BASE64`（Secret） | 保持同一应用签名身份的 PKCS#12 文件，以 base64 存储 |
| `MOTE_ANDROID_KEYSTORE_PASSWORD`（Secret） | 随机生成的 keystore 密码 |
| `MOTE_ANDROID_KEY_ALIAS`（Secret） | 签名条目的别名 |
| `MOTE_ANDROID_KEY_PASSWORD`（Secret） | 私钥条目密码 |
| `MOTE_MAC_SIGNING_MODE`（Variable） | `adhoc` 或 `developer-id`；未设置时为 adhoc，并在 Release 中标明 |
| `MOTE_MAC_CERTIFICATE_P12_BASE64`（Secret） | Apple Developer ID Application 证书及私钥，仅正式签名模式使用 |
| `MOTE_MAC_CERTIFICATE_PASSWORD`（Secret） | Apple 证书容器密码 |
| `MOTE_APPLE_TEAM_ID`（Variable） | Apple 团队标识 |
| `MOTE_APPLE_API_KEY_P8` / `MOTE_APPLE_API_KEY_ID` / `MOTE_APPLE_API_ISSUER`（Secrets） | Apple 公证 API 凭据 |

GitHub 的 `GITHUB_TOKEN` 由工作流自动取得，当前用于仓库 Release 发布；旧完整发行流程还曾用于 GHCR 发布，不另存一个个人 PAT。镜像首次发布后需确认包可见性满足部署需求；如果 GHCR 包保持私有，部署机需要自己的只读 registry 凭据，不能将发布 token 写入客户端。

本仓库的 `ghcr.io/utopiafar/mote:0.5.1` 已验证可匿名读取 amd64/arm64 镜像清单。实际安装与升级使用发布签名中的 digest；fork 或新软件包仍需单独检查其可见性。

配置方式见 [GitHub Secrets 官方说明](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)。例如使用 `gh secret set NAME --env release --repo utopiafar/mote`，通过标准输入提交值；不要把值写在 shell 参数中。

Android 0.5.1 延续本项目 0.4.0 包的原有签名密钥，转换为强密码 PKCS#12 后供 CI 使用。私钥身份保持相同，发布版不启用调试标志。CI 会核对实际 APK 的包名、版本和固定证书 SHA-256，防止每次 runner 自动生成新 debug key，造成用户无法覆盖升级。证书公开指纹与应用标识位于 [签名策略](../release/signing-policy.json)。[Android 要求更新包保持签名身份](https://developer.android.com/studio/publish/app-signing)。

Mac 默认 adhoc 只提供本期可构建的分发方式，不代表 Apple 认可的正式签名。选择 `developer-id` 后，缺少证书或公证凭据会使构建失败，不会静默降级为 adhoc；构建验证签名、公证票据和 Gatekeeper。Apple 账户、证书费用与公证服务由应用维护者配置，流程不会代为创建这些账户。[electron-builder v26 签名说明](https://www.electron.build/v26/docs/code-signing)。

## 日常 Dev 构建

在对应 workflow 的 Run workflow 中选择分支与 `profile=dev`。工作流校验该组件和锁文件，构建 Dev 包并保留为 `<组件>-dev-<完整提交 SHA>` Artifact（保留 7 天）；不创建 Git Tag 或 GitHub Release。安装包本身保留组件版本；确切提交以 Artifact 名和 `build-info.json` 为准。Central 的文件名与 Prod 相同，因为它是同一份不带配置的源码。

Mac Dev 使用 `dev.mote.collector.dev` / `Mote Collector Dev`；Android 使用 `dev.mote.collector.dev` 和 `-dev` versionName。Android 沿用已有固定签名证书，避免换 runner 后无法覆盖安装。

本地 Mac 出包：

```sh
MOTE_BUILD_PROFILE=dev node scripts/release/mac-package.mjs
# Beta / 正式包使用正式安装身份：
MOTE_BUILD_PROFILE=prod node scripts/release/mac-package.mjs
```

签名 Secret 仍从 `release` Environment 读取。该 Environment 目前仅允许组件 Tag；Mac / Android 首次从分支构建 Dev 签名包前，维护者须在 Deployment branches and tags 中额外允许受信任的开发分支（通常 `main`），或采用单独受控环境并相应配置 workflow。不要开放不受信任分支。此设置不在 Git 中，本 PR 不自动扩大线上 Secret 的访问范围；未配置前 Mac / Android 的分支 Dev 签名打包会被 GitHub 拒绝；Central 的 Dev 源码打包不使用该 Environment，可直接运行。

<a id="release-preflight"></a>

## 发布前预检

发布负责人在稳定候选上验证目标组件的实际 Profile/variant，再创建发布 Tag。日常 `debug` 测试、模块定向测试和发布配置各自记录；发布配置中的确定性错误应在推送 Tag 前暴露。

先把版本、lockfile 和发布说明提交到发布候选，再验证打包。Central 源码包从 `HEAD` 归档，工作树中的未提交修改不会进入产物；记录打包所用提交，后续合并带来输入变化时重新核对受影响检查与产物。

| 发布组件 | 当前发布配置验证 | 与日常检查的区别 |
| --- | --- | --- |
| Central | `npm run check:central`，源码打包、版本与附件结构验证 | 对照 [Central workflow](../.github/workflows/release-central.yml)；复用候选检查中符合条件的任务证据 |
| macOS | macOS 上的 `npm run check:desktop`，目标 Profile 的原生构建、打包和打包后 smoke | 对照 [Desktop workflow](../.github/workflows/release-desktop.yml)；匹配架构与签名配置 |
| Android Beta/正式 | `apps/android/gradlew -p apps/android --no-daemon testReleaseUnitTest`，随后构建及签名产物校验 | PR 的 `testDebugUnitTest` 与发布使用不同 variant；release 单测可先于签名打包执行 |
| Android Dev 包 | `apps/android/gradlew -p apps/android --no-daemon testDevelopmentUnitTest` | 按 [Android workflow](../.github/workflows/release-android.yml)选择 development variant |

这张表是发布候选的范围，不是每次提交的检查清单。先查看已有候选证据，再补发布配置和产物检查。固定组件检查也使用同一驱动，可显式追加 `-- --reuse /absolute/path/to/original-receipt.json`；输入匹配与每轮实际执行任务遵循[回执规则](development.md#pr-check-scope)，本地回执不转作 GitHub Runner 的执行记录。

Mac 在具备原生依赖与所选签名环境时，本地执行目标 Prod 构建及 smoke：

```sh
MOTE_BUILD_PROFILE=prod MOTE_PRE_RELEASE_CHECKS=true node scripts/release/mac-package.mjs
```

真实签名、安装身份、架构和附件完整性仍在发布流程验收；缺少本地平台或签名环境时，记录待验证项与执行环境，由发布负责人完成对应检查。预检不上传 Release，也不创建 Tag；发布权限与现有 Environment 规则按原流程执行。

## Beta / 正式发布

1. 选择组件。运行 `npm run release:version -- desktop 0.1.0-beta.1`；正式发布使用 `npm run release:version -- desktop 0.1.0`。替换组件名即可发布 Central / Android；版本必须高于该组件当前版本。
2. 编写脚本输出的 `release/notes/<组件>/<版本>.md`，说明用户变化、安装/升级步骤和实际验证范围。
3. 由集成/发布负责人完成稳定候选的 `npm run check:affected`、受影响用户流程及上面的[发布配置预检](#release-preflight)，再运行 `npm run release:verify -- desktop`（替换为实际组件）。符合条件的任务证据显式复用，后续变更重跑失效范围。普通文档 PR 只检查文档；发布候选仍需验证发布配置与真实产物。
4. 合并后，在已验证提交创建并推送脚本输出的不可变 Tag，例如 `desktop-v0.1.0-beta.1`。普通分支不能发布 Prod；手动重跑也必须选准确组件 Tag。Tag 构建固定采用 Prod，与 dispatch 默认选项无关。
5. 工作流执行组件测试、构建、版本与真实产物身份校验，再上传唯一组件附件。Beta 自动标记 Pre-release；正式 Tag 自动清除此标记。已发布版本拒绝覆盖；失败草稿可以重试。

Beta 验收后准备正式版本、同步元数据和说明，再检查并打正式 Tag；不能把 Dev 包改个名称当正式包。各端版本不必同时递增；共享修改检查所有消费者，但只为实际需要升级的产品发版。GitHub 全局 Latest 不表示任何一个组件的最新版本，发布器不修改该指向。

安全校验元数据和 `build-info.json` 保留在 Actions，不作为公开 Release 附件。Mac 验证签名、Bundle ID、版本和架构；Android 验证包名、证书、版本码、非 debuggable 及 16 KiB 对齐；Central 从提交归档构建所需 Monorepo 并校验内容。当前工作流不上传签名更新清单，升级仍按 [更新指南](updating.md) 手动进行。

## 信任与密钥轮换

[发布公钥](../release/release-public-key.pem) 随已安装程序固定。清单 envelope 包含 `schemaVersion`、`keyId`、base64 payload 和 RSA-SHA256 签名；签名覆盖原始 UTF-8 payload 字节，避免不同平台 JSON 序列化差异。单组件 payload 必须声明 `component=central|desktop|android`，使用对应组件标签且只包含该组件资产。版本、渠道、仓库/标签、资产大小与散列、平台身份及可选镜像 digest 仍在签名覆盖范围内。更新器按所属发布流读取，拒绝旧统一清单及缺失组件。当前 Profile 发布 workflow 不调用签名清单生成器。

修改更新仓库不会改变信任密钥，任意第三方清单仍不能通过验签。自有 fork 需要建立自己的签名身份，并在首次安装时明确使用对应公钥构建。GitHub Secrets 无法反向导出，维护者应保留受保护的恢复副本；不能通过重新生成密钥来“修复”旧客户端的签名错误。

未来轮换发布密钥需先由旧可信密钥发布支持新公钥的过渡版本；Android 应用签名轮换还受系统支持的签名 lineage 约束。本期不提供忽略签名、降级、自动卸载或重置配置的兜底开关。
