# 更新 Mote 与存储代际边界

按 **Central、macOS、Android** 独立发布。Dev 从各组件 Actions workflow 下载按提交标识的 Artifact；Beta / 正式版从 [GitHub Releases](https://github.com/utopiafar/mote/releases) 选择组件 Tag，其中 `-beta.N` 是 Pre-release，其余为正式发布，均使用 Prod Profile。各端版本不能相互比较，`releases/latest` 不代表某个端最新版本。当前工作流不附 `mote-release.json` 或 GHCR 镜像，安装和升级仍手动进行，不能使用保留的签名更新器获取这些新产物。

## 配置格式与历史存储边界

当前多用户基线使用 Wire 2、Ingress 3、中央 storage epoch 5、Desktop/Android 本机格式 4，以及 `mote-portable` version 3 账号便携归档。主配置仍为 YAML version 1；旧 env、模型/文件 JSON 与 SQLite 运行设置不自动转换，也不覆盖主文件。中央使用账号与密码登录；旧实例 owner token 不会转换为管理员或用户凭据。

同代更新可以保留当前 profile、账号、配置、密钥与正常持久状态，无需清空当前资料库。旧版 `backend_epoch=4`、客户端格式 3、Wire 1/Ingress 2 和便携归档 version 2 属于此前的 MVP 基线，不能直接供当前版本使用。MVP 不提供自动迁移，也不会自动清空旧目录。先停止旧写入，使用配套旧程序完成导出和完整备份，再选择新空目录或新 profile，重新配置并登录；旧导出用于保留历史，不代表能够跨代导入。当前 version 3 个人归档只支持匹配部署和账号的校验导入，不是旧库转换或跨部署迁移工具。

明确放弃旧资料时才执行清理。历史跨代的中央手动 reset、新目录和客户端清理步骤见 [MVP 清理实施记录](audits/mvp-baseline-cleanup-2026-10-09.md)；该记录描述当时的基线，不改变上述当前版本要求。旧二进制与完整旧备份须一起保留，才能跨代回滚。当前缺失历史授权 receipt 的数据也不会在启动或读取时自动补写；正常当前记录的 receipt 会随发布或验证后的恢复持久化。

## Mac App

保存输入，退出使用同一个 App bundle 的全部 Mote 实例，解压同 Profile 的 Mac ZIP，用其中的 App 覆盖对应身份 App 后启动。Dev App 与 Prod App 分开安装。设备身份、配置、凭据、草稿、队列和模型在应用包之外；当前格式 4 的同代更新不要删除资料目录。格式 3 或更早的目录会被拒绝，须先备份，再明确选择新目录或重置；旧队列、草稿和凭据不自动接入多用户账号。默认 profile 仍使用原 userData 路径，换 App bundle 不会把旧资料变成新格式。连接当前中央后按账号登录。当前使用 ad-hoc 签名时，系统可能再次要求运行、屏幕或日历授权；Prod 还可能要求 Keychain。Dev build 或 dev Profile 的 Mote 自有凭据只使用私有 JSON，不访问 Keychain。旧 Dev 加密凭据或恢复检查点不会自动转换，先保留完整旧目录，再创建空 Dev 目录重新登录。正式 Mac build 仍必须选精确的 `dev` 名称；备份并移开原 dev 目录后重建，不能用 `dev-new` 假定会开启文件凭据。独立 Dev App 可使用新的空命名目录。

## Android App

下载对应 Profile 的 APK，同包覆盖安装。Dev 包名 `dev.mote.collector.dev`，Beta / 正式包名 `dev.mote.collector`；签名证书必须一致且 versionCode 不降低。Test 的 `dev.mote.collector.test` 不作日常分发。首次从旧加密 Dev 切换到文件凭据时明确拒绝旧目录；保留旧程序和资料后，显式清除旧 Dev 存储并重新登录，不能把这一步用于日常 Prod。系统可能要求允许安装应用并确认更新。当前格式 4 的同代更新不要先卸载或清除数据，可保留当前队列和设置；格式 3 或更早的安装会明确拒绝旧数据，须先用旧版本导出和备份，再显式清除应用存储或选择全新独立安装。清除/卸载会丢失应用本地密钥（Prod / Test 为 Keystore，Dev 为 JSON AES 密钥），不能保证以旧目录恢复凭据、私有草稿和操作 ledger，需要重新按账号登录与授权。更新可能中断投屏，会话恢复仍由 Android 权限与后台规则控制。

## 中央节点

从 `central-vX.Y.Z` 发布下载 `mote-server-X.Y.Z.tar.gz`，解压到独立目录，或检出对应 Git 标签。源码包保留构建所需的 Monorepo 依赖，产品版本读取 `apps/server/package.json`；网页与服务属于同一个 Central 版本。先安装依赖并构建中央与 Web：

```sh
npm ci
npm run build:libs
npm run build -w @mote/server -w @mote/web
```

epoch 5 的同代托管 profile 用 `upgrade --release /absolute/built-checkout` 切换；Docker 先自行构建镜像，再用 `upgrade --image <image>`。同代切换沿用原 profile、`--home`、主 YAML、数据目录/卷及密钥，CLI 会停止目标环境并创建一致性备份后切换。Wire 1/epoch 4 的旧部署须先用配套旧程序完成备份，再为当前版本创建新空 profile 或资料目录/卷，准备当前 YAML，重新设置模型和文件 policy；不能将新版本的 `upgrade` 或 restore 指向旧库或旧代备份。

新中央的管理员由本地操作员在选定配置下运行 `npm run auth:initialize-admin` 初始化，用户名和密码通过标准输入 JSON 提供；已有账号不重复初始化。普通中央启动不会自动创建管理员，客户端使用账号登录，不再使用旧 owner token。`node scripts/dev-server.mjs` 是本地开发例外：缺少 profile 时自动创建隔离的 native 开发 profile，只在空账号库创建一次 `admin/admin`，已有账号与密码保留；prod、非本地监听与正式端口 47832 不适用此默认账号。

非 CLI 托管进程需管理员自行停止与备份，不能假定 CLI 已接管它。直接启动默认 `profile=default`，读取工作目录的 `mote.yaml`，或使用 `MOTE_CONFIG_FILE` 显式选择文件；普通环境变量和根 `.env` 不提供配置覆盖。

```sh
node scripts/mote.mjs upgrade --profile prod --home /srv/mote/profiles --release /srv/mote/releases/next
# 仅限 epoch 5 同代升级，并且需要恢复升级前数据时：
node scripts/mote.mjs rollback --profile prod --home /srv/mote/profiles --restore-data
```

详细步骤见 [部署与迁移](deployment.md#升级与回退)，其中历史步骤须遵守本文的代际边界。上述回退事务用于同代部署，恢复升级前快照并另外保留新增资料；跨代回滚必须恢复完整旧目录并使用配套旧程序，不能让旧程序直接读取新格式数据库。

当前 epoch 5 实例备份与个人便携归档不同：实例备份按清单包含数据库、部署身份、原件、配置、私有密钥材料及受支持的原生 Memory 状态，停止状态恢复撤销旧执行授权且不启动任务；可信密码重登后按[生命周期决定](adr-lifecycle-parity.md)以新权限恢复本人未来策略，旧未知操作和设备权限不复活；个人 version 3 归档不包含登录凭据或有效授权，不能当作实例备份。配置引用的外部密钥与供应方授权仍须单独保管和核对；不要仅保留密文而丢失对应内容密钥。OCR/ASR 模型和运行时的安装、升级另见 [中央媒体运行时](ocr-asr-implementation-plan.md)。

## 签名清单更新通道

代码仍保留客户端签名清单下载与安装、中央 `check-update` / `update`、独立更新助手及失败回退。它们要求受内置公钥信任的 manifest 和对应资产；切换仓库不会更换信任根，不能跳过签名、证书或版本校验。验证器只接受所属端的独立标签与必填组件身份：`central-vX.Y.Z`、`desktop-vX.Y.Z`、`android-vX.Y.Z`。旧统一 `vX.Y.Z` 标签与缺组件的清单拒绝；清单不能夹带其他端资产。当前 Profile 发布不使用该通道。历史验证见 [0.5.1 更新验收](update-validation.md)，当前产物与流程见 [发布说明](releasing.md)。

## 验证边界

下载完成不代表已安装；重新启动后核对实际程序版本、原有配置与待同步数据。Fixture、模拟器、物理设备和真实模型检查分别记录，历史通过不代表本次升级已实测。
