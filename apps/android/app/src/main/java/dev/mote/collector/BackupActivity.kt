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
    private var prepared: QueueArchive.Prepared? = null
    private var exportOrigin: String? = null
    private var exportGeneration = -1L
    private var configTab = false
    private var pendingPicker = 0
    private lateinit var inventory: TextView
    private var localStateJob: kotlinx.coroutines.Job? = null
    override fun onCreate(state: Bundle?) {
        super.onCreate(state); window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        includeToken = state?.getBoolean("includeToken") ?: false
        exportOrigin = state?.getString("exportOrigin"); exportGeneration = state?.getLong("exportGeneration") ?: -1L
        configTab = state?.getBoolean("configTab") ?: false
        pendingPicker = state?.getInt("pendingPicker") ?: 0
        val body = moteDetailPage(title = MoteI18n.text("备份与恢复"))
        val tabs = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }.also(body::addView)
        val recordsTab = Button(this).apply { text = MoteI18n.text("本机记录"); tag = "backup-records-tab" }
        val settingsTab = Button(this).apply { text = MoteI18n.text("客户端配置"); tag = "backup-config-tab" }
        tabs.addView(recordsTab, LinearLayout.LayoutParams(0, -2, 1f))
        tabs.addView(settingsTab, LinearLayout.LayoutParams(0, -2, 1f))
        val records = SecondaryUi.column(body)
        val recordCard = SecondaryUi.column(records, card = true)
        SecondaryUi.text(recordCard, MoteI18n.text("本机记录"), heading = true)
        inventory = SecondaryUi.text(recordCard, MoteI18n.text("正在读取本机同步状态…"), muted = true)
        SecondaryUi.action(recordCard, MoteI18n.text("导出本机记录 ZIP"), primary = true) { create(12, "application/zip", "mote-records.zip") }.tag = "backup-export-records"
        SecondaryUi.action(recordCard, MoteI18n.text("从备份恢复")) { open(13, "application/zip") }.tag = "backup-restore-records"
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
        SecondaryUi.text(config, MoteI18n.text("客户端配置"), heading = true)
        SecondaryUi.text(config, MoteI18n.text("迁移采集、应用规则、同步和诊断设置。系统权限和来源文件授权需在新设备重新授予。"), muted = true)
        val options = SecondaryUi.disclosure(config, MoteI18n.text("导出选项"), "backup-export-options", includeToken)
        secrets = CheckBox(this).apply { text = MoteI18n.text("导出时包含节点令牌（文件为明文，请妥善保管）"); isChecked = includeToken; setOnCheckedChangeListener { _, checked -> includeToken = checked } }.also(options::addView)
        SecondaryUi.action(config, MoteI18n.text("导出配置 JSON"), primary = true) { includeToken = secrets.isChecked; create(10, "application/json", "mote-settings.json") }
        SecondaryUi.action(config, MoteI18n.text("导入配置 JSON")) { open(11, "application/json") }
        status = SecondaryUi.text(body, MoteI18n.text("导入前可预览；同 ID 记录不会重复添加。"), muted = true).apply { tag = "backup-status"; accessibilityLiveRegion = android.view.View.ACCESSIBILITY_LIVE_REGION_POLITE }
        fun select() {
            records.visibility = if (configTab) android.view.View.GONE else android.view.View.VISIBLE
            config.visibility = if (configTab) android.view.View.VISIBLE else android.view.View.GONE
            recordsTab.isSelected = !configTab; settingsTab.isSelected = configTab
            MoteUi.button(recordsTab, primary = !configTab); MoteUi.button(settingsTab, primary = configTab)
        }
        recordsTab.setOnClickListener { configTab = false; select() }
        settingsTab.setOnClickListener { configTab = true; select() }
        select(); MoteUi.styleTree(body)
    }
    override fun onResume() {
        super.onResume()
        localStateJob = observeLocalState { state -> inventory.text = state.active?.let { MoteI18n.text("本机保留 {0} 条 · 待发 {1} 条", it.records, it.pending) } ?: state.imageLabel() }
    }
    override fun onPause() { localStateJob?.cancel(); localStateJob = null; super.onPause() }
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
        when (requestCode) {
            14 -> task.start(MoteI18n.text("正在导出本机记录…"), { status.text = it }, {
                val q = queue(); val records = org.json.JSONArray()
                q.dedupeIds().forEach { id -> q.capture(id)?.let(records::put) }
                requireNotNull(contentResolver.openOutputStream(uri, "wt")).bufferedWriter().use { it.write(JSONObject().put("format", "mote-local-metadata").put("version", 1).put("records", records).toString()) }
            }) { status.text = if (it.isSuccess) MoteI18n.text("配置已导出") else MoteI18n.text("导出未完成，请重试") }
            15, 16 -> task.start(MoteI18n.text("正在导出中央资料…"), { status.text = it }, {
                val client = CentralAccess.requireClient(this)
                check(client.server == exportOrigin && CentralSession.get(this).generation == exportGeneration) { MoteI18n.text("登录会话已变更，请重新打开中央页面。") }
                val mode = if (requestCode == 15) "metadata" else "data"
                requireNotNull(contentResolver.openOutputStream(uri, "wt")).use { client.download("/api/export-bundle?mode=" + mode, it) }
            }) { result -> status.text = result.fold({ MoteI18n.text("资料已导出") }, { it.message ?: MoteI18n.text("导出未完成，请删除不完整文件后重试") }) }
            10 -> task.start(MoteI18n.text("正在导出配置…"), { status.text = it }, {
                val json = ConfigurationArchive.encode(Settings(this).read(), includeToken)
                requireNotNull(contentResolver.openOutputStream(uri, "wt")).bufferedWriter().use { it.write(json) }
            }) { result -> status.text = if (result.isSuccess) MoteI18n.text("配置已导出") else MoteI18n.text("导出未完成，请重试") }
            11 -> task.start(MoteI18n.text("正在读取配置…"), { status.text = it }, {
                val current = Settings(this).read()
                val bytes = requireNotNull(contentResolver.openInputStream(uri)).use { input ->
                    val out = java.io.ByteArrayOutputStream(); val buffer = ByteArray(8192)
                    while (true) { val count = input.read(buffer); if (count < 0) break; require(out.size() + count <= ConfigurationArchive.MAX_BYTES) { MoteI18n.text("配置文件过大") }; out.write(buffer, 0, count) }
                    out.toByteArray()
                 }
                require(bytes.size <= ConfigurationArchive.MAX_BYTES)
                current to ConfigurationArchive.decode(AppReleaseVerifier.utf8(bytes), current)
            }) { result -> result.onSuccess { (current, next) ->
                MoteDialogBuilder(this).setTitle(MoteI18n.text("导入客户端配置？"))
                    .setMessage(MoteI18n.text("采集间隔 {0} 秒 · 保留 {1} 天\n应用规则 {2} 项\n{3}\n\n将替换当前偏好设置。已有记录和设备身份保留，系统权限不会自动开启。", next.intervalSeconds, next.uploadedRetentionDays, next.collectionRules.apps.size, if (current.server == next.server) MoteI18n.text("中央节点不变") else MoteI18n.text("中央节点将改变；未携带令牌时需重新连接")))
                    .setNegativeButton(MoteI18n.text("取消"), null).setPositiveButton(MoteI18n.text("导入")) { _, _ ->
                        RuntimeSettings.apply(this, next, expected = current) { applied -> status.text = if (applied.isSuccess) MoteI18n.text("配置已导入") else applied.exceptionOrNull()?.message ?: MoteI18n.text("配置导入失败，原设置保留") }
                    }.show()
            }.onFailure { status.text = MoteI18n.text("配置无法导入：{0}", it.message ?: MoteI18n.text("文件无效")) } }
            12 -> task.start(MoteI18n.text("正在导出本机记录…"), { status.text = it }, {
                ConnectionGuard.sync {
                    QueueArchive.export(queue(), Settings(this).dataOrigin(), requireNotNull(contentResolver.openOutputStream(uri, "wt")))
                } ?: error(MoteI18n.text("设置正在变更，请稍后重试"))
            }) { result -> status.text = result.fold({ MoteI18n.text("已导出 {0} 条记录", it) }, { MoteI18n.text("导出未完成，请删除不完整文件后重试") }) }
            13 -> task.start(MoteI18n.text("正在校验备份…"), { status.text = it }, {
                prepared?.close(); prepared = null
                val settings = Settings(this)
                val staged = QueueArchive.prepare(requireNotNull(contentResolver.openInputStream(uri)), File(cacheDir, "restore-${UUID.randomUUID()}"), settings.read().maxQueueMiB * 1024L * 1024)
                if (staged.origin != settings.dataOrigin()) { staged.close(); error(MoteI18n.text("备份属于不同中央节点，请先连接原节点")) }
                if (closed) { staged.close(); error(MoteI18n.text("页面已关闭")) }
                prepared = staged; staged
            }) { result -> result.onSuccess { staged ->
                MoteDialogBuilder(this).setTitle(MoteI18n.text("导入 {0} 条本机记录？", staged.count))
                    .setMessage(MoteI18n.text("已有记录保留，同 ID 自动去重。同步将切换为手动，检查导入结果后可立即同步。"))
                    .setNegativeButton(MoteI18n.text("取消")) { _, _ -> staged.close(); prepared = null }
                    .setOnCancelListener { staged.close(); prepared = null }
                    .setPositiveButton(MoteI18n.text("导入")) { _, _ ->
                        val settings = Settings(this); val current = settings.read(); val next = current.copy(syncMode = "manual")
                        restoring = true
                        RuntimeSettings.apply(this, next, expected = current, change = {
                            settings.save(next, current)
                            QueueArchive.restore(staged, queue(), settings.dataOrigin(), next.maxQueueMiB * 1024L * 1024)
                        }) { applied ->
                            staged.close(); prepared = null; restoring = false
                            status.text = if (applied.isSuccess) MoteI18n.text("记录已导入 · 手动同步") else MoteI18n.text("导入未完成：{0}。已导入记录保留，可重试同一备份。", applied.exceptionOrNull()?.message)
                        }
                    }.show()
            }.onFailure { status.text = MoteI18n.text("备份无法导入：{0}", it.message ?: MoteI18n.text("文件无效")) } }
        }
    }
    override fun onDestroy() { closed = true; if (!restoring) prepared?.let { java.util.concurrent.Executors.newSingleThreadExecutor().apply { execute { it.close() }; shutdown() } }; super.onDestroy() }
    override fun onSaveInstanceState(outState: Bundle) { outState.putInt("pendingPicker", pendingPicker); outState.putBoolean("configTab", configTab); outState.putBoolean("includeToken", includeToken); outState.putString("exportOrigin", exportOrigin); outState.putLong("exportGeneration", exportGeneration); super.onSaveInstanceState(outState) }
}
