# 一键 OCR / 语音准备：本轮验证

实现及实际运行代码：`ca19854da089a2980d7a5567cba6651a8cc1e51e`。本目录后续提交只保存报告和生成素材截图，不改变该代码。产品决定见 [ADR](../../adr-managed-media-preparation.md)，源画面见[来源证据 MEDIA-S01–06](../ui-final-source-export-gaps-2026-10-29.md)。这是 W45 准备器与局部状态卡的验收，W43 模型设置整页和最终 128 组真实 Terra 回归仍待完成。

## 真实准备与处理

本轮使用 macOS arm64、Node 26.11.1，独立模型目录和生成数据；没有使用个人资料或用户既有服务。首次从官方固定源下载 uv 0.13.6、CPython 3.11.17，以及 OCR / ASR / 说话人依赖和模型，OCR 模型 21,544,960 字节、对话模型 532,764,577 字节。模型与依赖校验后才发布；模型下载完成但 worker 未就绪时不显示可使用。

首次默认准备是在本轮开发状态运行；固定提交上重新验证了真实 CLI 安装、重复执行、Central 复用、界面启动和生成素材处理。05:25:56 UTC 的 CLI 使用包含空格的相对 `--python` 路径，首次安装成功、重复执行 `changed=false`；Central 只探测相同已发布环境，不联网重装。目标 profile 配置字节保持一致，临时 profile 已删除。

05:33:06 UTC 在固定提交上重新运行实际 worker，三个请求均返回 HTTP 200，见[处理结果](processing-result.json)：

| 输入 / 步骤 | 实际结果 | 限度 |
| --- | --- | --- |
| 1000×260 生成图片，两行英文 | PP-OCRv5 mobile ONNX 正确读出 `MOTE GENERATED TEST` 与 `Tomorrow at nine.`，89 ms | 仅本次清晰生成图片，不代表所有扫描质量 |
| macOS Samantha 离线合成约 6.8 秒语音 | faster-whisper small 保留明日九点与蓝色笔记本，2746 ms | `Mote` 被识别为 `mode`；未校正转写，不声称完全准确 |
| 同一合成音频的说话人分离 | Sherpa ONNX 检出 1 位说话人，179 ms | 单说话人素材，未验证多人、重叠发言或真实人声质量 |

处理结束 `closed=true`，自有 worker 及 UI fixture 的 Central/Electron 已退出。模型与私有依赖缓存暂留在本轮隔离工作区供最终集成复用；没有安装系统服务、修改用户安全设置或保存第三方凭据。

## 真实界面与受控状态

[UI 结果](ui-result.json)记录 05:27:23 UTC、clean 提交、Web bundle 摘要和每张 PNG 的 SHA-256。中文、浅色；宽屏 1440×1000、窄屏 390×844，DPR 2。源网站六态由独立审查者在 1440×1000 / DPR 1 实际查看，来源与产品的 DPR 不同，不宣称逐像素一致。

| 产品截图 | 验证方式与结果 |
| --- | --- |
| [模型已好、服务未就绪](ocr-model-ready-worker-idle.png) | 真实模型目录与未启动 worker，明确重试，不假成功 |
| [OCR 可使用](ocr-actual-ready.png)、[语音可使用](audio-actual-ready.png) | 真实页面按钮启动实际处理服务；认证健康检查成功，保留“检查状态”；安装前后处理授权配置相同 |
| [尚未安装](ocr-not-installed.png)、[准备依赖](ocr-dependencies.png)、[模型下载](ocr-model-download.png) | 显式受控 HTTP fixture 让短暂状态可拍；这些图片不是一次真实完整下载的连续录像 |
| [取消操作](ocr-cancel-action.png)、[失败](ocr-failure.png)、[已取消](ocr-cancelled.png)、[390 窄屏](ocr-cancelled-390.png) | 受控状态验证文案、进度、按钮、取消/重试和布局，无横向溢出；真实取消生命周期另有进程/下载回归 |

独立审查复核了十张实际产品图：源要求的“中心本机处理”“可使用”“检查状态”和初装主按钮已对齐。源示例未展示取消入口；本轮追加授权要求真实失败恢复，故保留取消。整页仍是旧模型设置布局，表单组织、补处理位置与窄屏公共导航由后续 UI 模块继续收敛；本报告不将整页记作一比一通过。

## 风险回归与平台范围

- 13 项运行环境/协调器回归：凭据与包配置隔离、官方 archive 校验、显式 Python、失败替换保留旧环境、重复请求、配置变更、取消、真实进程组清理、Docker 仅检查 sidecar、自定义端点不接管。
- 5 项既有 worker 回归：认证、执行事实、并发容量、超时和取消后的未知结果语义。
- 9 项 Web 回归：不修改处理同意、重复请求/取消重试、权限撤回、切节点迟到响应、ready 复查真实健康和后台资源刷新。
- 新增真实流下载中断/Range 续传/校验发布，以及实际 Fastify owner/collector 权限合同各 1 项通过。Server/Web 构建、类型检查、架构边界、8895 条六语言目录与 diff 检查通过。

Native 自动准备目标为 macOS arm64/x64、Linux glibc arm64/x64；本次实际安装/处理仅验证 macOS arm64。其余三目标尚未实机验证，Docker 只完成受控 sidecar 合同验证；Windows/musl/自定义端点保持明确不支持自动安装。可选 WeSpeaker 未执行真实下载/声纹质量验收。没有进行本轮最终 Codex Server `gpt-6.1-terra` 集中回归。

重现 UI 时先准备本轮专用模型目录，再运行 `scripts/test-media-preparation-ui.cjs`，显式指定 `MOTE_TEST_MEDIA_MODELS` 和可用的 `MOTE_FIXTURE_NODE`；脚本默认隐藏窗口，并清理自有进程和临时 profile。不能将其指向用户日常运行目录。
