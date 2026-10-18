package dev.mote.collector

import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.widget.*
import org.json.JSONArray
import org.json.JSONObject
import java.text.DateFormat
import java.util.Date

/** Original recording controls use saved M10 connections and the existing M05
 * command journal. The central connector remains the only scheduler/executor. */
internal class CentralRecordings(private val screens: CentralScreens) {
    private val ui = screens.ui
    private val api = screens.client
    private val navigation = ui.navigationRevision
    private val body = screens.body
    private val library = CentralLibrary(screens)
    private val handler = Handler(Looper.getMainLooper())
    private var poll: Runnable? = null
    private var render = 0L
    private var visible = true
    private fun current() = screens.ownsSelectedAccount() && ui.client === api && ui.navigationRevision == navigation
    fun close() { poll?.let(handler::removeCallbacks); poll = null }
    fun resume() { if (visible && current()) show() }
    private fun path(id: String) = "/api/connectors/" + CentralScreens.encode(id)
    private fun rows(value: JSONArray) = (0 until value.length()).map(value::getJSONObject)
    private fun verify(id: String, generation: Long) {
        check(current())
        val connection = rows(api.get("/api/connectors").getJSONArray("connections")).singleOrNull { it.getString("id") == id }
        check(connection?.getLong("generation") == generation) { MoteI18n.text("配置或方案已变化；请读取当前状态后重新确认。") }
        check(current())
    }
    fun show() {
        if (!current()) return
        close(); visible = true
        ui.work(MoteI18n.text("正在读取…"), {
            val connections = rows(api.get("/api/connectors").getJSONArray("connections")).filter { it.getString("provider") in setOf("feishu-recordings", "dingtalk-recordings") }
            Triple(connections, connections.associate { it.getString("id") to api.get(path(it.getString("id"))) }, screens.connectorWork())
        }) { (connections, statuses, work) ->
            if (!current()) return@work
            val stamp = ++render; body.removeAllViews()
            fun active() = current() && visible && render == stamp
            ui.text(MoteI18n.text("录音归档"), NativeFontRole.TITLE_MOBILE)
            ui.button(MoteI18n.text("刷新")) { if (active()) show() }
            if (connections.isEmpty()) ui.text(MoteI18n.text("暂无记录"))
            for (connection in connections) {
                val id = connection.getString("id"); val generation = connection.getLong("generation"); val value = statuses.getValue(id)
                val card = ui.card().apply { tag = "recording-connection:" + id }
                ui.text(id + " · " + connection.getString("provider"), NativeFontRole.SECTION, card)
                ui.text(MoteI18n.text(if (value.getBoolean("connected")) "已连接" else "尚未授权"), parent = card)
                val counts = value.getJSONObject("counts")
                ui.text(MoteI18n.text("已归档转写 {0} 条，音频 {1} 条；等待 {2} 步，需处理 {3} 步。", counts.getInt("transcripts"), counts.getInt("audio"), counts.getInt("pending"), counts.getInt("failed")), parent = card)
                if (counts.getInt("empty") > 0) ui.text(MoteI18n.text("采集完成，暂无文字：{0} 条", counts.getInt("empty")), parent = card)
                if (counts.getInt("pending") > 0) schedule()
                val previous = work.optJSONObject(id)
                val task = previous?.optString("taskId")?.takeIf(String::isNotBlank)
                if (task != null) {
                    ui.work(MoteI18n.text("正在读取…"), { api.get("/api/tasks/" + task) }) { result ->
                        if (!active()) return@work
                        require(result.getString("id") == task)
                        ui.text(result.getString("state"), parent = card)
                        result.optJSONObject("result")?.optJSONObject("syncTask")?.let { sync ->
                            val syncTask = sync.getString("id")
                            require(Regex("[a-f0-9]{64}").matches(syncTask) && syncTask != task)
                            screens.rememberConnectorTask(id, generation, syncTask)
                            schedule()
                        }
                        result.optJSONObject("failure")?.optString("code")?.takeIf(String::isNotBlank)?.let { ui.text(it, parent = card) }
                        val progress = result.optJSONObject("progress")?.optJSONObject("connector")
                        progress?.optString("authorizationUrl")?.takeIf(String::isNotBlank)?.let { address ->
                            val url = Uri.parse(address)
                            val hosts = if (connection.getString("provider") == "feishu-recordings") listOf("feishu.cn", "larksuite.com") else listOf("dingtalk.com", "dingtalk.cn", "dingtalk.io")
                            require(url.scheme == "https" && url.userInfo == null && url.port == -1 && hosts.any { url.host == it || url.host?.endsWith("." + it) == true })
                            ui.button(MoteI18n.text("打开授权页面"), parent = card) { if (active()) ui.startActivity(Intent(Intent.ACTION_VIEW, url)) }
                        }
                        if (result.getString("state") in setOf("waiting", "running")) {
                            ui.button(MoteI18n.text("取消当前操作"), parent = card) {
                                if (active()) ui.work(MoteI18n.text("正在处理…"), { api.post("/api/tasks/" + task + "/cancel", JSONObject()) }) { if (active()) show() }
                            }
                            schedule()
                        }
                    }
                }
                if (previous?.has("pending") == true) {
                    ui.text(MoteI18n.text("请求结果尚未确认，请重试同一请求。"), parent = card)
                    ui.button(MoteI18n.text("重试同一请求"), parent = card) {
                        if (active()) ui.work(MoteI18n.text("正在处理…"), { screens.retryConnector(api, id) }) { if (active()) show() }
                    }
                    ui.button(MoteI18n.text("清除本机待确认请求"), parent = card) {
                        if (active()) screens.confirm(MoteI18n.text("清除本机待确认请求"), MoteI18n.text("这只清除本机待确认请求，已在中央接收的任务仍会继续。")) {
                            if (active()) ui.work(MoteI18n.text("正在保存…"), { screens.clearPendingConnector(id) }) { if (active()) show() }
                        }
                    }
                }
                fun command(suffix: String, payload: JSONObject = JSONObject()) {
                    if (!active()) return
                    ui.work(MoteI18n.text("正在处理…"), { verify(id, generation); screens.submitConnector(api, id, generation, path(id) + "/" + suffix, payload) }) { if (active()) show() }
                }
                fun operation(name: String, payload: JSONObject = JSONObject()) = command("operations", JSONObject().put("operation", name).put("payload", payload))
                ui.button(MoteI18n.text("连接已授权账号"), true, card) { operation("connect") }
                ui.button(MoteI18n.text("扫码登录并授权只读权限"), parent = card) { operation("login") }
                ui.button(MoteI18n.text("同步范围"), parent = card) { if (active()) selection(id, generation, value.getJSONObject("selection")) }
                ui.button(MoteI18n.text("立即同步"), true, card) { command("sync") }
                ui.button(MoteI18n.text("重试失败步骤"), parent = card) { operation("retry", JSONObject().put("resume", true)) }
                ui.button(MoteI18n.text("断开连接"), parent = card) { command("disconnect") }
                ui.button(MoteI18n.text("同步步骤与状态"), parent = card) { if (active()) checkpoints(id, generation) }
                ui.button(MoteI18n.text("最近归档的录音"), parent = card) { if (active()) archive(id, generation) }
            }
        }
    }
    private fun schedule() {
        if (poll != null) return
        val next = Runnable { poll = null; if (visible && current()) show() }
        poll = next; handler.postDelayed(next, 1000)
    }
    private fun selection(id: String, generation: Long, value: JSONObject) {
        close(); visible = false; val stamp = ++render; body.removeAllViews()
        fun active() = current() && render == stamp
        val enabled = CheckBox(ui).apply { text = MoteI18n.text("启用"); isChecked = value.getBoolean("enabled") }; body.addView(enabled)
        val start = ui.field(MoteI18n.text("开始时间"), value.getString("start"))
        val end = ui.field(MoteI18n.text("结束时间"), value.optString("end"))
        val automatic = CheckBox(ui).apply { text = MoteI18n.text("自动同步"); isChecked = value.getBoolean("autoSync") }; body.addView(automatic)
        ui.button(MoteI18n.text("保存设置"), true) {
            if (!active()) return@button
            val selection = JSONObject().put("enabled", enabled.isChecked).put("start", start.text.toString()).put("autoSync", automatic.isChecked).put("backupAudio", true)
            if (end.text.toString().isNotBlank()) selection.put("end", end.text.toString())
            ui.work(MoteI18n.text("正在保存…"), { verify(id, generation); screens.submitConnector(api, id, generation, path(id) + "/operations", JSONObject().put("operation", "select").put("payload", selection)) }) { if (active()) show() }
        }
        ui.button(MoteI18n.text("取消")) { if (active()) show() }
    }
    private fun checkpoints(id: String, generation: Long, cursor: String? = null) {
        close(); visible = false
        ui.work(MoteI18n.text("正在读取…"), { verify(id, generation); api.get(path(id) + "/recordings?limit=30" + (cursor?.let { "&cursor=" + CentralScreens.encode(it) } ?: "")) }) { page ->
            if (!current()) return@work
            val stamp = ++render; body.removeAllViews()
            fun active() = current() && stamp == render
            ui.button(MoteI18n.text("返回")) { if (active()) show() }
            ui.text(MoteI18n.text("同步步骤与状态"), NativeFontRole.TITLE_MOBILE)
            ui.text(MoteI18n.text("以下检查点属于当前同步范围；历史原件仍可在资料库查看。"))
            for (row in rows(page.getJSONArray("items"))) {
                val card = ui.card().apply { tag = "recording-checkpoint:" + row.getString("id") }; ui.text(row.optString("title", row.getString("id")), NativeFontRole.SECTION, card)
                for (phase in CentralRecordingPresentation.phases(row, System.currentTimeMillis())) {
                    val phaseCard = ui.card(card).apply { tag = "recording-phase:" + phase.key }
                    ui.text(MoteI18n.text(phase.title) + " · " + MoteI18n.text(phase.stateLabel) + " · " + MoteI18n.text("尝试 {0} 次", phase.attempts), NativeFontRole.ROW, phaseCard)
                    phase.error?.let { ui.text(it, NativeFontRole.SUPPORT, phaseCard) }
                    phase.nextAttemptAt?.let { at -> ui.text(MoteI18n.text("下次可运行时间") + " · " + DateFormat.getDateTimeInstance(DateFormat.DEFAULT, DateFormat.DEFAULT, MoteI18n.locale()).format(Date(at)), NativeFontRole.SUPPORT, phaseCard) }
                    if (phase.state == "failed") ui.text(MoteI18n.text("自动重试已停止，请核对原因后手动重试"), NativeFontRole.SUPPORT, phaseCard)
                }
                if (row.optBoolean("empty")) ui.text(MoteI18n.text("采集完成，暂无文字"), parent = card)
                if (row.optBoolean("unsupported")) ui.text(MoteI18n.text("厂商转写格式尚不支持"), parent = card)
                row.optString("transcriptCaptureId").takeIf(String::isNotBlank)?.let { capture -> ui.button(MoteI18n.text("查看原文依据"), parent = card) { if (active()) library.file(capture) } }
                row.optString("audioCaptureId").takeIf(String::isNotBlank)?.let { capture -> ui.button(MoteI18n.text("播放录音"), parent = card) { if (active()) library.playFile(capture, card) } }
            }
            if (page.getJSONArray("items").length() == 0) ui.text(MoteI18n.text("暂无记录"))
            CentralScreens.next(page)?.let { next -> ui.button(MoteI18n.text("下一页")) { if (active()) checkpoints(id, generation, next) } }
            if (cursor != null) ui.button(MoteI18n.text("返回第一页")) { if (active()) checkpoints(id, generation) }
            ui.button(MoteI18n.text("中央资料库")) { if (active()) ui.navigate("files") }
        }
    }
    private fun archive(id: String, generation: Long) {
        close(); visible = false
        ui.work(MoteI18n.text("正在读取…"), { verify(id, generation); api.get(path(id) + "/recordings?limit=1") }) { checkpoint ->
            if (!current()) return@work
            val stamp = ++render; body.removeAllViews()
            fun active() = current() && render == stamp
            ui.button(MoteI18n.text("返回")) { if (active()) show() }
            val source = checkpoint.optString("sourceId").takeIf(String::isNotBlank)
            if (source == null) ui.text(MoteI18n.text("暂无记录")) else library.paged("/api/files?sourceId=" + CentralScreens.encode(source), ui.card()) { row, card ->
                val item = row.getJSONObject("item"); val capture = row.getString("captureId")
                ui.text(item.optString("title"), NativeFontRole.SECTION, card)
                ui.button(MoteI18n.text("查看详情"), parent = card) { if (active()) library.file(capture) }
                if (item.optString("mimeType").startsWith("audio/")) ui.button(MoteI18n.text("播放录音"), parent = card) { if (active()) library.playFile(capture, card) }
            }
        }
    }
}
