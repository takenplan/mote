package dev.mote.collector

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.os.Bundle
import android.view.WindowManager
import android.widget.*
import java.io.File
import java.util.UUID
import org.json.JSONObject

class BackupActivity : MoteActivity() {
    private val task by lazy { UiTask(this) }
    private lateinit var status: TextView
    private lateinit var secrets: CheckBox
    private var includeToken = false
    private var restoring = false
    @Volatile private var closed = false
    private val preparedLock = Any()
    @Volatile private var prepared: QueueArchive.Prepared? = null
    private var exportOrigin: String? = null
    private var exportGeneration = -1L
    private var configTab = false
    private var pendingPicker = 0
    private lateinit var operation: BackupOperationView
    private var importName = ""
    private lateinit var inventory: TextView
    private var localStateJob: kotlinx.coroutines.Job? = null
    override fun onCreate(state: Bundle?) {
        super.onCreate(state); window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        includeToken = state?.getBoolean("includeToken") ?: false
        exportOrigin = state?.getString("exportOrigin"); exportGeneration = state?.getLong("exportGeneration") ?: -1L
        configTab = state?.getBoolean("configTab") ?: false
        pendingPicker = state?.getInt("pendingPicker") ?: 0
        val page = moteDetailPage(title = MoteI18n.text("备份与恢复"), onBack = { returnOrFinish() })
        val body = SecondaryUi.column(page)
        val tabs = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }.also(body::addView)
        val recordsTab = Button(this).apply { text = MoteI18n.text("本机记录"); tag = "backup-records-tab" }
        val settingsTab = Button(this).apply { text = MoteI18n.text("客户端配置"); tag = "backup-config-tab" }
        tabs.addView(recordsTab, LinearLayout.LayoutParams(-2, -2))
        tabs.addView(settingsTab, LinearLayout.LayoutParams(-2, -2))
        val records = SecondaryUi.column(body)
        val recordCard = SecondaryUi.column(records, card = true)
        SecondaryUi.text(recordCard, MoteI18n.text("这台手机仍保留的记录"), muted = true)
        inventory = SecondaryUi.text(recordCard, MoteI18n.text("正在读取本机同步状态…"), heading = true)
        SecondaryUi.text(recordCard, MoteI18n.text("导出为本机记录 ZIP，之后可以重新导入。"), muted = true)
        val recordActions = SecondaryUi.actions(recordCard)
        SecondaryUi.action(recordActions, MoteI18n.text("导出本机记录"), primary = true) { create(12, "application/zip", "mote-records.zip") }.tag = "backup-export-records"
        SecondaryUi.action(recordActions, MoteI18n.text("从备份恢复")) { chooseRestore() }.tag = "backup-restore-records"
        val range = SecondaryUi.disclosure(records, MoteI18n.text("备份包含什么"), "backup-scope")
        SecondaryUi.text(range, MoteI18n.text("备份本机仍保留的截图、应用活动、通知、媒体和随手记。ZIP 为明文，不含中央归档、来源文件原件、未提交草稿或模型文件。"), muted = true)
        SecondaryUi.action(range, MoteI18n.text("导出本机元数据 JSON")) { create(14, "application/json", "mote-local-metadata.json") }
        SecondaryUi.row(records, MoteI18n.text("本机存储位置")) { startActivity(Intent(this, StorageActivity::class.java)) }
        val central = SecondaryUi.disclosure(records, MoteI18n.text("中央资料导出"), "backup-central")
        SecondaryUi.text(central, MoteI18n.text("中央导出与问答、资料库共用登录状态。"), muted = true)
        SecondaryUi.action(central, MoteI18n.text("中央登录与账户")) { startActivity(Intent(this, CentralActivity::class.java).putExtra("page", "vault")) }
        SecondaryUi.action(central, MoteI18n.text("导出中央元数据")) { create(15, "application/gzip", "mote-central-metadata.tar.gz") }
        SecondaryUi.action(central, MoteI18n.text("导出中央资料与附件")) { create(16, "application/gzip", "mote-central-data.tar.gz") }
        val config = SecondaryUi.column(body, card = true)
        SecondaryUi.text(config, MoteI18n.text("迁移采集与同步设置"), heading = true)
        SecondaryUi.text(config, MoteI18n.text("迁移采集、应用规则、同步和诊断设置。系统权限和来源文件授权需在新设备重新授予。"), muted = true)
        val options = SecondaryUi.disclosure(config, MoteI18n.text("导出选项"), "backup-export-options", includeToken)
        secrets = CheckBox(this).apply { text = MoteI18n.text("导出时包含节点令牌（文件为明文，请妥善保管）"); isChecked = includeToken; setOnCheckedChangeListener { _, checked -> includeToken = checked } }.also(options::addView)
        val configActions = SecondaryUi.actions(config)
        SecondaryUi.action(configActions, MoteI18n.text("导出配置 JSON"), primary = true) { includeToken = secrets.isChecked; create(10, "application/json", "mote-settings.json") }
        SecondaryUi.action(configActions, MoteI18n.text("导入配置 JSON")) { open(11, "application/json") }
        status = SecondaryUi.text(body, "", muted = true).apply { tag = "backup-status"; accessibilityLiveRegion = android.view.View.ACCESSIBILITY_LIVE_REGION_POLITE }
        operation = BackupOperationView(this, page, body) { returnFromOperation() }
        fun select() {
            records.visibility = if (configTab) android.view.View.GONE else android.view.View.VISIBLE
            config.visibility = if (configTab) android.view.View.VISIBLE else android.view.View.GONE
            recordsTab.isSelected = !configTab; settingsTab.isSelected = configTab
            MoteUi.action(recordsTab, MoteUi.ButtonRole.TEXT); MoteUi.action(settingsTab, MoteUi.ButtonRole.TEXT)
            recordsTab.paintFlags = if (!configTab) android.graphics.Paint.UNDERLINE_TEXT_FLAG else 0
            settingsTab.paintFlags = if (configTab) android.graphics.Paint.UNDERLINE_TEXT_FLAG else 0
        }
        recordsTab.setOnClickListener { configTab = false; select() }
        settingsTab.setOnClickListener { configTab = true; select() }
        select(); MoteUi.styleTree(body)
    }
    override fun onResume() {
        super.onResume()
        localStateJob = observeLocalState { state -> inventory.text = state.active?.let { MoteI18n.text("{0} 条", it.records) } ?: state.imageLabel() }
    }
    override fun onPause() { localStateJob?.cancel(); localStateJob = null; super.onPause() }
    private fun chooseRestore() {
        if (!canChooseFile()) return
        operation.show(MoteI18n.text("从备份恢复"), "", MoteI18n.text("选择本机记录 ZIP"),
            MoteI18n.text("导入前先校验备份。已有记录保留，已有的同一条记录不重复添加。"),
            actions = listOf(Triple(MoteI18n.text("选择备份文件"), true) { open(13, "application/zip") }))
    }
    private fun returnFromOperation() {
        if (!restoring && !task.busy) releasePrepared()
        operation.landing()
    }
    private fun releasePrepared(expected: QueueArchive.Prepared? = null) {
        val release = synchronized(preparedLock) {
            prepared?.takeIf { expected == null || it === expected }?.also { prepared = null }
        }
        release?.let { staged -> java.util.concurrent.Executors.newSingleThreadExecutor().apply { execute { staged.close() }; shutdown() } }
    }
    private fun returnOrFinish() { if (::operation.isInitialized && operation.showing) returnFromOperation() else finish() }
    @Deprecated("Native back callback") override fun onBackPressed() = returnOrFinish()
    private fun progress(message: String) { status.text = message; operation.updateProgress(message) }
    private fun create(code: Int, mime: String, name: String) {
        if (!canChooseFile()) return
        if (code in setOf(15, 16)) {
            task.start(MoteI18n.text("正在读取…"), { status.text = it }, { CentralAccess.requireClient(this).server to CentralSession.get(this).generation }) { result ->
                result.onSuccess { (origin, generation) -> exportOrigin = origin; exportGeneration = generation
                    launchPicker(Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE, name), code)
                }.onFailure { status.text = it.message }
            }
        } else launchPicker(Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE, name), code)
    }
    private fun canChooseFile() = !closed && !restoring && !task.busy && pendingPicker == 0 && prepared == null
    private fun launchPicker(intent: Intent, code: Int) {
        if (!canChooseFile()) return
        pendingPicker = code
        try { startActivityForResult(intent, code) } catch (error: Exception) { pendingPicker = 0; status.text = error.message }
    }
    private fun open(code: Int, mime: String) = launchPicker(Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime), code)
    @Deprecated("Native document picker")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode !in 10..16 || requestCode != pendingPicker) return
        pendingPicker = 0
        if (closed || restoring || task.busy || prepared != null) return
        if (resultCode != RESULT_OK) return
        val uri = data?.data ?: return
        if (requestCode in setOf(10, 12, 14, 15, 16)) {
            val label = MoteI18n.text(when (requestCode) { 10 -> "正在导出配置…"; 14 -> "正在导出本机元数据…"; 15, 16 -> "正在导出中央资料…"; else -> "正在导出本机记录…" })
            operation.show(MoteI18n.text("导出"), MoteI18n.text("正在导出"), label, loading = true)
        }
        if (requestCode == 11) operation.show(MoteI18n.text("导入客户端配置"), "", MoteI18n.text("正在读取配置…"), loading = true)
        when (requestCode) {
            14 -> task.start(MoteI18n.text("正在导出本机记录…"), ::progress, {
                val q = queue(); val records = org.json.JSONArray()
                q.dedupeIds().forEach { id -> q.capture(id)?.let(records::put) }
                requireNotNull(contentResolver.openOutputStream(uri, "wt")).bufferedWriter().use { it.write(JSONObject().put("format", "mote-local-metadata").put("version", 1).put("records", records).toString()) }
            }) { exportResult(it, requestCode) }
            15, 16 -> task.start(MoteI18n.text("正在导出中央资料…"), ::progress, {
                val client = CentralAccess.requireClient(this)
                check(client.server == exportOrigin && CentralSession.get(this).generation == exportGeneration) { MoteI18n.text("登录会话已变更，请重新打开中央页面。") }
                val mode = if (requestCode == 15) "metadata" else "data"
                requireNotNull(contentResolver.openOutputStream(uri, "wt")).use { client.download("/api/export-bundle?mode=" + mode, it) }
            }) { exportResult(it, requestCode) }
            10 -> task.start(MoteI18n.text("正在导出配置…"), ::progress, {
                val json = ConfigurationArchive.encode(Settings(this).read(), includeToken)
                requireNotNull(contentResolver.openOutputStream(uri, "wt")).bufferedWriter().use { it.write(json) }
            }) { exportResult(it, requestCode) }
            11 -> task.start(MoteI18n.text("正在读取配置…"), ::progress, {
                val current = Settings(this).read()
                val bytes = requireNotNull(contentResolver.openInputStream(uri)).use { input ->
                    val out = java.io.ByteArrayOutputStream(); val buffer = ByteArray(8192)
                    while (true) { val count = input.read(buffer); if (count < 0) break; require(out.size() + count <= ConfigurationArchive.MAX_BYTES) { MoteI18n.text("配置文件过大") }; out.write(buffer, 0, count) }
                    out.toByteArray()
                 }
                require(bytes.size <= ConfigurationArchive.MAX_BYTES)
                current to ConfigurationArchive.decode(AppReleaseVerifier.utf8(bytes), current)
            }) { result -> result.onSuccess { (current, next) -> previewConfiguration(current, next) }
                .onFailure { errorStage(MoteI18n.text("导入客户端配置"), MoteI18n.text("配置无法导入：{0}", it.message ?: MoteI18n.text("文件无效"))) { open(11, "application/json") } } }
            12 -> task.start(MoteI18n.text("正在导出本机记录…"), ::progress, {
                ConnectionGuard.sync {
                    QueueArchive.export(queue(), Settings(this).dataOrigin(), requireNotNull(contentResolver.openOutputStream(uri, "wt")))
                } ?: error(MoteI18n.text("设置正在变更，请稍后重试"))
            }) { exportResult(it, requestCode) }
            13 -> {
              operation.show(MoteI18n.text("从备份恢复"), MoteI18n.text("正在校验备份…"), MoteI18n.text("校验并保存记录"), loading = true)
              task.start(MoteI18n.text("正在校验备份…"), ::progress, {
                val settings = Settings(this)
                val staged = QueueArchive.prepare(requireNotNull(contentResolver.openInputStream(uri)), File(cacheDir, "restore-${UUID.randomUUID()}"), settings.read().maxQueueMiB * 1024L * 1024)
                if (staged.origin != settings.dataOrigin()) { staged.close(); error(MoteI18n.text("备份属于不同中央节点，请先连接原节点")) }
                val retained = synchronized(preparedLock) { if (closed) false else { prepared = staged; true } }
                if (!retained) { staged.close(); error(MoteI18n.text("页面已关闭")) }
                importName = runCatching { contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)?.use { if (it.moveToFirst()) it.getString(0) else null } }.getOrNull() ?: MoteI18n.text("本机记录 ZIP")
                staged
            }) { result -> result.onSuccess { staged ->
                if (operation.showing) previewRestore(staged) else releasePrepared(staged)
            }.onFailure { errorStage(MoteI18n.text("从备份恢复"), MoteI18n.text("备份无法导入：{0}", it.message ?: MoteI18n.text("文件无效"))) { open(13, "application/zip") } } }
            }
        }
    }
    private fun errorStage(title: String, message: String, retry: () -> Unit) {
        status.text = message
        if (!operation.showing) return
        operation.show(title, MoteI18n.text("未完成"), title, message, actions = listOf(
            Triple(MoteI18n.text("重新选择文件"), true, retry), Triple(MoteI18n.text("返回"), false) { returnFromOperation() }))
    }
    private fun exportResult(result: Result<*>, code: Int) {
        val success = result.isSuccess
        val message = if (!success) MoteI18n.text("请删除刚才不完整的文件，再重新导出。本机记录保留。") else when (code) {
            10 -> if (includeToken) MoteI18n.text("配置文件包含节点令牌，请妥善保管。") else MoteI18n.text("配置文件不含节点令牌。系统权限需在目标设备上重新授予。")
            14 -> MoteI18n.text("元数据文件可用于查看记录信息，不是带附件的备份。")
            else -> MoteI18n.text("导出没有清空本机内容。")
        }
        status.text = if (success) MoteI18n.text("已保存到所选位置") else MoteI18n.text("导出未完成")
        if (!operation.showing) return
        operation.show(MoteI18n.text("导出"), status.text.toString(), if (success) MoteI18n.text("导出文件已生成") else MoteI18n.text("备份未能生成"), message,
            actions = (if (success) emptyList() else listOf(Triple(MoteI18n.text("重新导出"), true) { retryExport(code) })) +
                listOf(Triple(MoteI18n.text(if (success) "完成" else "返回"), success) { returnFromOperation() }))
    }
    private fun retryExport(code: Int) {
        val (mime, name) = when (code) {
            10 -> "application/json" to "mote-settings.json"
            12 -> "application/zip" to "mote-records.zip"
            14 -> "application/json" to "mote-local-metadata.json"
            15 -> "application/gzip" to "mote-central-metadata.tar.gz"
            else -> "application/gzip" to "mote-central-data.tar.gz"
        }
        create(code, mime, name)
    }
    private fun previewRestore(staged: QueueArchive.Prepared) {
        operation.show(MoteI18n.text("从备份恢复"), MoteI18n.text("备份已校验"), MoteI18n.text("导入 {0} 条本机记录？", staged.count), content = { card ->
            SecondaryUi.text(card, importName)
            SecondaryUi.fact(card, MoteI18n.text("导入到"), MoteI18n.text("这台手机"))
            SecondaryUi.fact(card, MoteI18n.text("Central"), if (staged.origin.isBlank()) MoteI18n.text("未连接") else MoteI18n.text("与当前连接一致"))
            SecondaryUi.fact(card, MoteI18n.text("已有内容"), MoteI18n.text("已有记录保留，同 ID 自动去重。"))
            SecondaryUi.fact(card, MoteI18n.text("发送方式"), MoteI18n.text("导入后切换为手动同步"))
        }, actions = listOf(Triple(MoteI18n.text("导入到此手机"), true) { restore(staged) }, Triple(MoteI18n.text("取消"), false) { returnFromOperation() }))
    }
    private fun restore(staged: QueueArchive.Prepared) {
        if (closed || restoring || task.busy || pendingPicker != 0 || prepared !== staged) return
        val settings = Settings(this); val current = settings.read(); val next = current.copy(syncMode = "manual")
        restoring = true
        operation.show(MoteI18n.text("从备份恢复"), MoteI18n.text("正在导入到本机"), MoteI18n.text("校验并保存记录"),
            MoteI18n.text("请保持备份文件与存储位置可用。"), loading = true, content = { SecondaryUi.text(it, importName) })
        RuntimeSettings.apply(this, next, expected = current, change = {
            settings.save(next, current)
            QueueArchive.restore(staged, queue(), settings.dataOrigin(), next.maxQueueMiB * 1024L * 1024)
        }) { applied ->
            restoring = false
            if (closed || applied.isSuccess || !operation.showing) releasePrepared(staged)
            if (closed) return@apply
            status.text = if (applied.isSuccess) MoteI18n.text("记录已导入 · 手动同步") else MoteI18n.text("导入未完成：{0}。已导入记录保留，可重试同一备份。", applied.exceptionOrNull()?.message)
            if (!operation.showing) return@apply
            operation.show(MoteI18n.text("从备份恢复"), MoteI18n.text(if (applied.isSuccess) "已导入本机" else "导入尚未完成"),
                MoteI18n.text(if (applied.isSuccess) "记录已回来" else "请检查本机内容后重试"), status.text.toString(), content = { SecondaryUi.text(it, importName) }, actions =
                    (if (applied.isFailure) listOf(Triple(MoteI18n.text("重试同一备份"), true) { previewRestore(staged) }) else emptyList()) + listOf(
                        Triple(MoteI18n.text("查看本机内容"), applied.isSuccess) { startActivity(Intent(this, CaptureRecordsActivity::class.java)) },
                        Triple(MoteI18n.text("查看待发送"), false) { startActivity(Intent(this, SyncQueueActivity::class.java)) }))
        }
    }
    private fun previewConfiguration(current: CollectorConfig, next: CollectorConfig) {
        operation.show(MoteI18n.text("导入客户端配置"), "", MoteI18n.text("替换这台手机的偏好设置？"),
            MoteI18n.text("已有记录和设备身份保留，系统权限不会自动开启。"), content = { card ->
                fun row(label: String, before: String, after: String) {
                    val line = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
                    listOf(label, before, after).forEach { value -> line.addView(TextView(this).apply { text = value; MoteUi.type(this, NativeFontRole.BODY); MoteUi.textColor(this, NativeColorRole.INK); setPadding(0, moteDp(12), moteDp(8), moteDp(12)) }, LinearLayout.LayoutParams(0, -2, 1f)) }
                    card.addView(line); card.addView(android.view.View(this).apply { MoteUi.backgroundColor(this, NativeColorRole.DIVIDER) }, LinearLayout.LayoutParams(-1, moteDp(1)))
                }
                row(MoteI18n.text("设置"), MoteI18n.text("当前"), MoteI18n.text("导入后"))
                row(MoteI18n.text("采集间隔"), MoteI18n.text("{0} 秒", current.intervalSeconds), MoteI18n.text("{0} 秒", next.intervalSeconds))
                row(MoteI18n.text("本机保留"), MoteI18n.text("{0} 天", current.uploadedRetentionDays), MoteI18n.text("{0} 天", next.uploadedRetentionDays))
                row(MoteI18n.text("发送方式"), syncLabel(current), syncLabel(next))
                row(MoteI18n.text("应用规则"), current.collectionRules.apps.size.toString(), next.collectionRules.apps.size.toString())
                SecondaryUi.text(card, if (current.server == next.server) MoteI18n.text("中央节点不变") else MoteI18n.text("中央节点将改变；未携带令牌时需重新连接"), muted = true)
            }, actions = listOf(Triple(MoteI18n.text("导入配置"), true, applyConfiguration@{
                if (!canChooseFile()) return@applyConfiguration
                restoring = true
                operation.show(MoteI18n.text("客户端配置"), "", MoteI18n.text("正在应用设置"), loading = true)
                RuntimeSettings.apply(this, next, expected = current) { applied ->
                    restoring = false; if (closed) return@apply
                    status.text = if (applied.isSuccess) MoteI18n.text("配置已导入") else applied.exceptionOrNull()?.message ?: MoteI18n.text("配置导入失败，原设置保留")
                    if (!operation.showing) return@apply
                    operation.show(MoteI18n.text("客户端配置"), "", status.text.toString(), MoteI18n.text("已有记录和设备身份保留，系统权限不会自动开启。"), actions = listOf(Triple(MoteI18n.text("返回"), true) { returnFromOperation() }))
                }
            }), Triple(MoteI18n.text("取消"), false) { returnFromOperation() }))
    }
    private fun syncLabel(config: CollectorConfig) = when (config.syncMode) {
        "manual" -> MoteI18n.text("仅手动发送")
        "interval" -> MoteI18n.text("定时发送")
        "realtime" -> MoteI18n.text("有新内容时发送")
        else -> MoteI18n.text("凑够一批后发送")
    }
    override fun onDestroy() { synchronized(preparedLock) { closed = true }; if (!restoring) releasePrepared(); super.onDestroy() }
    override fun onSaveInstanceState(outState: Bundle) { outState.putInt("pendingPicker", pendingPicker); outState.putBoolean("configTab", configTab); outState.putBoolean("includeToken", includeToken); outState.putString("exportOrigin", exportOrigin); outState.putLong("exportGeneration", exportGeneration); super.onSaveInstanceState(outState) }
}
