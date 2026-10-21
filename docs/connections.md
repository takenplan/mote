# 账号登录、设备配对与独立连接

当前生产使用用户名密码账号、Wire 2 和设备邀请 v2。Central epoch 5、客户端本机格式 4 的跨代边界见[更新说明](updating.md)；旧 owner token、v1 邀请和 collector-to-owner 别名不作为生产登录方式。

## 登录与权限

| 身份 | 用途与边界 |
| --- | --- |
| Web / 原生账号会话 | 本账号私人资料、问答、设置和显式授权，Web 会话与原生 bearer 各有生命周期 |
| 设备凭据 | 固定本账号设备 ID，允许自身 ingress、获准 Actions、self、logout，不授予私人归档、管理或凭据签发 |
| MCP 凭据 | 单独的只读或明确来源写权限，不能作为管理或邀请批准身份 |
| 实例管理员 | 管理账号与共享资源，普通私人 API 仍只选择自己的资料 |

生产中央启动不会自动创建管理员，操作员按[部署步骤](deployment.md)初始化空账号库。本地试用的 `scripts/dev-server.mjs` 有明确例外：仅在开发账号库为空时创建 `admin` / `admin`，不会重置已有密码，见[快速开始](../README.md#quick-start)。原生中央页面使用账号登录，设备采集连接可从本账号中央界面签发邀请。配对不会把设备凭据提升为完整账号会话。

## 在 App 中连接

1. 使用本账号登录中央设备/连接页面，创建邀请。填写设备可访问的 HTTPS origin；loopback HTTP 仅适用于本机。手机 localhost 指手机自身，邀请不创建公网地址、TLS 或 Tunnel。
2. 填写连接名称。新设备不指定原设备 ID；同设备重新授权时明确选择已有设备，不能用新设备邀请接管旧身份。
3. Android 可扫码、粘贴链接/JSON 或导入 JSON；Mac 可粘贴或导入 JSON/文本及二维码图片。二维码本机生成/解析，不发送第三方服务。输入与权限边界见 [Mac](desktop.md)和 [Android](android.md)。
4. 客户端预览完整 origin、部署/账号、期限和设备范围，明确确认后兑换。配对不授予屏幕、日历或 SAF 权限，也不开始采集。
5. 固定邀请、设备元数据与随机 verifier，经 poll、fresh self 和 ACK 核对后保存连接。丢应答恢复同一 claim，不重复创建连接或发布未经确认的账号。

邀请含 `format:mote.connection`、`version:2`、deploymentId、userId、serverUrl、`purpose:device`、code、expiresAt 和可选 deviceId。URI 为 `mote://connect?data=<base64url JSON>`。code 是十分钟临时能力，不含长期凭据，不应进入日志、公开报告或版本控制。

## 协议与确认

`POST /api/connections/invitations` 由当前完整账号会话确认范围。`POST /api/connections/redeem` 固定 expected subject、设备、platform 和 verifier 的 SHA-256 challenge，只返回 request ID/期限。`POST /api/login/poll` 使用 `{id,verifier}` 取得固定 `scope:client,purpose:device` grant；旧页面和账号代际不能覆盖新连接。

客户端核对 `GET /api/connections/self` 的 account.deploymentId/userId/credentialId、credential.deviceId、Wire 2 / Ingress 3。self 没有 credential.id 或 purpose 字段，purpose 来自 poll。安全保存恢复状态后 `POST /api/login/ack` 确认交付，不返回 token。字段与异常细节见[邀请合同](design/multiuser-qr-pairing.md)和[桌面恢复](design/multiuser-desktop-pairing.md)。

账号登录支持应用/标签页会话、1/7/30 天；退出先停止本机使用凭据，再尝试服务端撤销。浏览器交接使用一次性 ticket/PKCE，不把长期 token 放入 URL。私人中央阅读需要账号会话或明确 `central` purpose 的浏览器授权，设备邀请不能替代。

## 重新授权、换号与恢复

队列、来源、草稿和回执按已核验 origin、deployment、account 绑定。同账号轮换凭据保留原数据；换号/换实例停止旧采集并切换存储，旧账号待传版本保留。回到原账号可继续原字节，同 URL 的新实例不能接收旧部署队列。未绑定资料仍沿明确首绑确认，不猜测历史归属。

丢 redeem、poll 或 ACK 后恢复原 claim；退出/重启不会批准另一账号。桌面“恢复中断的连接确认”继续固定检查点，ACK 过期时仅在 fresh self 精确有效后退休检查点，不能伪称收到 ACK。平台自己的原子提交和恢复入口保留。

当前账号可在连接列表单独撤销凭据，归档仍保留。取消未完成邀请使用 `POST /api/connections/invitations/revoke`，已 ACK 连接需 `DELETE /api/connections/:credentialId` 撤销。关页不等于取消。账号禁用、密码重置和凭据撤销阻止迟到请求，不扩大后台权限。

## 本机秘密与验证边界

Dev 的 Mote 自有凭据使用私有本地文件，Prod 保持 Desktop safeStorage / Android Keystore，第三方 CLI 继续自行管理。应用会话、不持久 token、Android 进程绑定和退出标记沿平台合同。目录及导出边界见[内容存储](content-storage.md)和[Profile 决策](adr-profile-release-policy.md)。

产品与生成 fixture 结果分别记录在[桌面配对](validation/multiuser-desktop-pairing.md)、[设备邀请](validation/multiuser-qr-pairing.md)和[Android 回归](validation/multiuser-pr159-android-regression-2026-10-17.md)。原记录不等于本次重新运行；真实扫码、系统权限、外网和 OEM 行为只在明确执行的范围成立。旧单所有者协议保留在 Git 历史，不能照旧 token 流程连接当前节点。
