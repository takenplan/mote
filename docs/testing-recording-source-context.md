# 中央录音来源说明回归

这些场景使用生成转写、生成音频、隔离账号和数据库，不读取个人资料或真实厂商账号，不调用收费模型。产品边界见[录音来源设计](recorder-connectors-design.md#来源说明与保存)。

| 用户路径 / 状态 | 预期结果 |
| --- | --- |
| 新账号详情 → 连接 → 选填说明 → 启用并保存 | 连接不会自行采集；主按钮清晰可见；来源说明 PATCH 确认先于同步范围 PUT。 |
| 已同步来源 → 仅修改说明 → 保存 | 原样文本成为新版本；不提交 selection、不重启发现或媒体任务。 |
| 修改说明 → 刷新读取 / 失败 / 版本冲突 | 轮询与失败保留草稿；冲突不静默覆盖新版；显式放弃修改并重新加载后才采用当前版本。 |
| 清空说明 → 保存 → 重开 | 清空产生新版本，重开显示空说明；已有原件及归属类别保留。 |
| 飞书 → 钉钉 → 返回飞书 | 每个来源独立读写；说明按来源和账号绑定，不串入另一个来源。 |
| 保存中 → 切换节点或来源 | 旧请求中止；晚到响应不更新新来源，不向新节点提交旧同步范围。 |
| 已接收录音 → 正式资料上下文读取 | 资料继承精确来源说明；既有单份归属纠正保留；不自动授权历史收费重算。 |
| 通用来源管理 → 保存说明 | 同一上下文 API，说明与类别归属独立保存，不启动录音同步。 |
| 桌面 / 430 px 窄屏 → 保存、回听 | 主次操作分组；说明、提示、按钮可见且不横向溢出；打开页面不读取音频正文，回听后才读取中央备份。 |

Web 生命周期和错误回归位于 `apps/web/test/source-context-editor.test.ts`、`apps/web/test/recordings-settings.test.ts`。真实浏览器与正式中央路由由 `scripts/test-recordings-browser.cjs` 和 `scripts/recordings-browser-fixture.ts` 验证。中央继承、模型传递、并发、加密和历史授权边界复用 `apps/server/test/source-context*.test.ts` 与 `apps/server/test/recordings.test.ts`。

应用检查使用 `npm run check:affected`；浏览器回归在中央构建后运行 `node_modules/.bin/electron scripts/test-recordings-browser.cjs`。浏览器预览和结果保存在忽略目录 `.mote/recordings/`。物理录音笔、真实账号、真实模型及部署版本必须另外报告，不能由这些生成 fixture 推断。
