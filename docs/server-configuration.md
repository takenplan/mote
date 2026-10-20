# 服务端配置参考

当前 Central 使用一个实例 ConfigService 和每账号一个私人 ConfigService。它们复用 YAML version 1、稳定监听、revision/CAS、原子保存和 prepare/publish/rollback；不是共享一份个人模型或秘密。当前合同见 [M04](design/multiuser-configuration.md)、[配置旅程](adr-configuration-journey-parity.md)和[配置归属](configuration-ownership.md)。旧单所有者全局模型/设置路由不在生产入口挂载。

中央主导航为资料库、问一问、来源、活动，今天与设置为辅助入口。设置保留原分类、草稿、验证与维护操作；未安装能力不会因为存在配置字段而自动就绪。

## 文件启动和编辑

| 文件 | 归属与路径 |
| --- | --- |
| 实例配置 | 操作员通过 `MOTE_CONFIG_FILE` 或 CLI profile 选择；CLI 默认 `<home>/<profile>/mote.yaml`，直接启动未指定时为工作目录的 `mote.yaml` |
| Docker 实例配置 | profile 父目录挂载到 `/config`，读取 `/config/mote.yaml`；原子替换仍可见 |
| 个人配置 | `DATA/configuration/users/<服务端账号 ID>/mote.yaml`，由认证上下文定位，不接受客户端指定账号或路径 |
| ConfigService 缺省实例文件 | 未传部署文件的内嵌宿主使用数据目录的 `instance.yaml`；不替代 CLI 已选择的主文件 |

```sh
node scripts/mote.mjs init --profile dev
node scripts/mote.mjs config --profile dev
node scripts/mote.mjs start --profile dev
# 直接启动明确准备的实例文件
MOTE_CONFIG_FILE=/absolute/private/mote.yaml npm start
```

CLI 默认 dev，日常节点明确选 prod；命名环境及进程管理见[开发](development.md)和[部署](deployment.md)。`profile.json` 保存发行版本、卷和 Tunnel 生命周期选择，不覆盖普通运行参数。配置、临时写入文件为 0600，私有目录为 0700；备份副本也可能含秘密。

普通环境变量不覆盖 YAML。实例敏感字段可显式引用 `${NAME}`，普通字段不展开 shell、`~` 或命令替换。个人配置不执行环境变量引用，也不能选择宿主 Codex executable/login home。不要 `source` YAML。`server.token` / `MOTE_TOKEN` 不是当前账号认证入口，管理员按[部署步骤](deployment.md)初始化。

最小实例文件只需要明确部署差异，不放入个人策略：

```yaml
version: 1
revision: 0
server:
  profile: dev
  host: 127.0.0.1
  port: 47842
storage:
  dataDir: ./data
execution:
  interactiveConcurrency: 2
  agentConcurrency: 8
  llmConcurrency: 4
  memoryConcurrency: 3
```

启动缺失、无效或不可读配置会失败。运行中无效候选保留最后有效值，返回固定错误码，不回显秘密。手改文件保留读取的 revision；Web 保存携带同一文件的 revision。真正变更后递增，陈旧编辑冲突，相同内容不产生新 revision。不同账号文件及实例文件各有自己的 revision，不存在一个跨全实例个人设置的编辑号。

视图区分已保存值、有效值和生效方式。准备失败不替换当前值；应用失败回滚有效快照，已保存候选可保留为失败状态；不确定写入报告 `config_commit_uncertain`。保存端口或目录不会移动资料或重启服务。以实际领域注册返回的元数据为准，不能把旧宿主的字段表当作所有个人域的热更新承诺。

## 归属与生效方式

| 范围 | 当前责任 |
| --- | --- |
| 实例 server、storage 根目录、execution | 操作员部署、共享容量/保留和执行资源；监听、目录及启动资源保持各自重启/迁移边界 |
| 实例 models | 管理员提供完整共享连接，用户只能选择固定资源引用；Codex executable/login home 等宿主依赖保持重启合同 |
| 实例 media、updates 和 import Python packs | 安装位置、进程、端点/Token 与固定 Python parser，按部署重启或显式安装操作管理 |
| 实例 diagnostics | 固定结构化诊断与日志容量；debug/level 按注册应用，目录/轮转容量等保持重启边界 |
| 个人 models、modelPrices | 自己的连接、功能选择和价格；允许独立个人 model ID，不继承共享连接秘密 |
| 个人 processing / 图片策略 / 文件方案 | 原件处理选择、服务引用、来源/MIME 规则和已固定任务相关指纹；新选择不补发历史处理权 |
| 个人 memory、actions、连接器及 pluginInstances | 自动准入、策略和用户选择；实际任务、授权、外部回执和安装状态仍由领域数据库负责 |
| 个人 storage.contentEncryptionEnabled | 默认 false，即时影响之后的账号原件写入；已有对象转换另需显式解密任务 |
| 设备本地设置 | 隐私范围、采集、队列及本地偏好属于客户端；Android 的个人采集偏好按已核验账号保存 |

个人 API 为 `GET/PATCH /api/configuration`、`PUT /api/configuration/:domain` 和 `POST /api/configuration/reload`；只访问当前账号的已注册域。管理员的 `GET/PUT /api/admin/configuration/models` 只管理实例共享模型，不是跨账号配置编辑器。其他实例设置通过其已有管理员控制或操作员文件/CLI 修改。页面保留模型草稿目录查询、连接探测、保存和价格编辑，不要求先保存才能测试。

旧 `backendModules` / `fileProcessorModules` 字段属于旧模块宿主，当前 `buildScopedApp` 不加载它们；修改 YAML 并重启不会将旧模块装入生产入口。当前通用插件使用固定 release 包与账号安装实例，参见[插件作者指南](plugin-authoring.md)。

更换 provider、protocol 或 base URL 时，保留自己的 key/headers/extraBody 必须明确确认复用，或清除/替换它们；共享秘密不能复制到个人草稿。模型 lease 固定实际连接、配置、价格和授权身份。普通请求调参只影响新准入；真实 transport 撤权、账号重置/禁用/删除和个人凭据撤回保留即时 fence。Files 和 Memory 的相关配置指纹继续独立生效。

## 常用实例参数

| 字段 | 默认 / 用途 |
| --- | --- |
| server.host / port | `127.0.0.1` / `47832`；CLI dev/test 独立端口，远程通过 HTTPS |
| server.publicUrl / allowedOrigins | 公开 origin 与浏览器允许来源，不创建 DNS、TLS 或 Tunnel |
| storage.dataDir | 默认 `./data`，相对 YAML 目录解析 |
| storage.maxStorageBytes | 默认 10 GiB，现有共享逻辑容量；正增长准入与原件占用由账本执行，不等于所有磁盘文件大小 |
| storage.retentionDays | 默认 0，关闭按时间清理；正数由账号维护按已有保留边界执行，文件原件等例外见生命周期合同 |
| execution.*Concurrency | 新准入使用新容量，降低不会杀死已准入任务 |
| media.ocrEndpoint / asrEndpoint | 受管理的本机 OCR/ASR 资源，默认 loopback 9010 / 9009；与个人选择的模型/服务引用区分 |
| media.modelDirectory / python / workerToken | 模型位置、进程与私有 Worker 凭据；安装模型不等于授权处理 |

字段结构与范围以[配置 schema](../packages/shared/src/config-file.ts)及[生产领域注册](../apps/server/src/scope/configuration.ts)为准。模型参数见[模型服务](model-providers.md)，文件和图片策略见[文件策略](file-processing-policies.md)和[图片处理](image-processing.md)。保存新配置不重做已完成结果，历史处理仍需原有明确范围和确认。

## 日志与调试

省略 diagnostics.maxBytes 使用 Profile 默认：Dev 每份 100 MiB，其它 2 MiB；显式数字保持原值。Dev 允许 0.1–100 MiB，其它 0.1–8 MiB；maxFiles 为 1–10，maxEntries 为 100–5000。采用省略默认值的 CLI 操作见[日志容量](deployment.md#dev-log-retention)，容量在正常重启后生效。

结构化与原生监督日志分别轮转，Dev 默认各最多 300 MiB，不保证保留小时数；Docker stdout 独立限额。Dev 默认结构化 debug 不开放实例正文 trace。生产详细 Agent 输入/输出记录需本人明确开启，按本人账号权限读取；安全支持包排除 trace 正文。

普通事件最多 20 KiB，详细 trace 单条硬上限 8 MiB 且不超过文件容量。行式启动/分页/安全范围导出与大文件下载保持各自界限，见[诊断](troubleshooting.md)。

## 存储、秘密与升级

| 内容 | 当前位置 / 边界 |
| --- | --- |
| SQLite、WAL、任务及规范私有记录 | DATA/mote.sqlite，行级账号归属；管理员身份不绕过私人 API |
| 原件与账号托管密钥 | DATA/originals 下部署/账号散列目录，原件分片为 `.plain` / `.aes` |
| 实例配置 / 个人配置 | 所选主 YAML / DATA/configuration/users 下各自 YAML；模型快照和私有密钥单独保护 |
| 连接器与插件运行状态 | 各领域账号目录和数据库，不从 YAML 内容猜测任务授权 |
| Tunnel token | profile 的私有秘密文件，仅交给 Tunnel 进程 |
| 客户端队列与草稿 | 设备本地的 Profile/账号存储，不在中央实例 YAML 中 |

CLI config 隐去敏感值；在线私人配置视图也不是可公开的支持包。当前完整实例备份包含恢复所需私有配置和密钥；个人便携导出不含可复用凭据或有效执行授权，见[备份和恢复](deployment.md#备份恢复和迁移)。

统一 YAML 是配置来源选择，不能替代多用户代际切换。epoch 4 / 本机格式 3 / 旧 owner token 不迁移到当前基线，需保留旧程序和完整备份后选择新空 profile；同代更新保留当前资料。YAML 保存本身不执行自动重启、数据库重置、部署或密钥迁移。SQLite 使用本地块存储，活动 WAL 不放 SMB/NFS。
