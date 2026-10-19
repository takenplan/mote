package dev.mote.collector

import android.content.Intent
import android.net.Uri
import android.text.InputType
import android.widget.*
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID

/** Publication outcomes describe the current result; persisted status still owns scheduling. */
internal object CentralMemoryJobPresentation {
    private val legacyControls = listOf("pause" to "暂停", "resume" to "继续", "cancel" to "取消", "retry" to "重试")
    fun state(job: JSONObject): String {
        if (!job.has("tasks")) return job.optString("state", job.optString("status"))
        val top = job.getString("state")
        if (top in setOf("cancelled", "deleted", "paused")) return top
        if (top == "awaiting_context") return "needs_input"
        val tasks = job.getJSONObject("tasks"); val states = tasks.keys().asSequence().map { tasks.getJSONObject(it).getString("state") }.toList()
        for (failure in listOf("failed", "blocked", "stale")) if (failure in states) return failure
        if (states.isNotEmpty() && states.all { it == "succeeded" } && top == "committed") return "succeeded"
        if (!job.getBoolean("current")) return "stale"
        return if ("running" in states) "running" else "waiting"
    }
    fun invalidated(job: JSONObject) = if (job.has("tasks")) state(job) == "stale" else job.optString("outcome") == "input_invalidated"
    fun status(job: JSONObject): String = if (!job.has("tasks")) {
        if (invalidated(job)) MoteI18n.text("资料已更新，本次结果失效") else state(job)
    } else MoteI18n.text(when (state(job)) {
        "waiting" -> "等待提取记忆"; "running" -> "正在分批提取记忆"; "succeeded" -> "记忆提取完成"
        "failed" -> "部分记忆提取需要重试"; "blocked", "needs_input" -> "需要处理"; "stale" -> "资料已更新，本次结果失效"
        "cancelled" -> "记忆提取已停止"; "deleted" -> "已删除"; "paused" -> "已暂停"; else -> state(job)
    })
    fun notice(job: JSONObject): String? = if (job.has("tasks") && !job.getBoolean("current")) MoteI18n.text("输入版本已变化；任务完成记录保留，请打开记忆核对当前可读版本。")
        else if (invalidated(job)) MoteI18n.text("历史结果保留；请查看当前资料版本。失效输入不能直接重试。") else null
    fun controls(job: JSONObject): List<Pair<String, String>> = if (!job.has("tasks")) { if (invalidated(job)) emptyList() else legacyControls }
        else when (state(job)) { "paused" -> listOf("resume" to "继续", "cancel" to "取消"); "waiting", "running" -> listOf("pause" to "暂停", "cancel" to "取消"); "failed", "blocked" -> listOf("retry" to "重试", "cancel" to "取消"); "needs_input" -> listOf("cancel" to "取消"); else -> emptyList() }
    fun results(job: JSONObject): List<String> {
        val tasks = job.getJSONObject("tasks")
        return tasks.keys().asSequence().filter { it == "correct" || it.startsWith("batch") }.flatMap { stage ->
            val task = tasks.getJSONObject(stage); val ids = if (task.optString("state") == "succeeded") task.optJSONObject("result")?.optJSONArray("memoryIds") else null
            if (ids == null) emptySequence() else (0 until ids.length()).asSequence().map { ids.getString(it).also { value -> UUID.fromString(value) } }
        }.distinct().toList()
    }
}

/** Management uses native controls and explicit endpoint contracts, never a web fallback. */
internal class CentralAdmin(private val screens: CentralScreens) {
    private val ui get() = screens.ui
    private val body get() = screens.body
    private val client get() = screens.client
    private fun enc(value: String) = CentralScreens.encode(value)
    private val library = CentralLibrary(screens)
    private val plugins = CentralPlugins(screens) { extensions() }
    private var connectorPage: CentralConnectors? = null
    private var recordingPage: CentralRecordings? = null
    private var larkConnection: CentralLarkConnection? = null
    private var larkChoices = emptyList<JSONObject>()
    private var larkCalendarMode = false
    private val mediaHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private val larkHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private val larkPoll = Runnable { lark() }
    fun close() { mediaHandler.removeCallbacksAndMessages(null); plugins.close(); connectorPage?.close(); recordingPage?.close(); larkHandler.removeCallbacks(larkPoll) }
    fun clearPrivateState() { mediaHandler.removeCallbacksAndMessages(null); plugins.clearPrivateState(); connectorPage?.close(); connectorPage = null; recordingPage?.close(); recordingPage = null; larkHandler.removeCallbacks(larkPoll); larkConnection = null; larkChoices = emptyList(); larkCalendarMode = false }
    fun resume() { plugins.resume(); connectorPage?.resume(); recordingPage?.resume(); if (larkConnection != null) lark() }
    fun resumeConnections() { connectorPage?.resume(); recordingPage?.resume() }

    fun show(page: String) {
        if (page != "lark") { larkHandler.removeCallbacks(larkPoll); larkConnection = null; larkChoices = emptyList(); larkCalendarMode = false }
        ui.button(MoteI18n.text("刷新")) { screens.refresh() }
        when (page) {
            "devices" -> devices()
            "connections" -> connections()
            "actions" -> actions()
            "settings" -> settings()
            "statistics" -> read("/api/data/statistics")
            "processing" -> processing()
            "plugins", "extensions" -> plugins.show()
            "usage" -> usage()
            "vault" -> vault()
            "developer" -> diagnostics()
            "agentView" -> agent()
            "lark" -> lark()
            "imports" -> imports()
            "about" -> { preferences(); ui.text(ui.server); softwareUpdate(); ui.button(MoteI18n.text("连接设置")) { ui.startActivity(Intent(ui, MainActivity::class.java).putExtra("page", "CONNECTION")) } }
            "help" -> {
                ui.text(MoteI18n.text("检查连接、权限与处理状态，或提交问题反馈。"))
                ui.button(MoteI18n.text("反馈问题")) { ui.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/utopiafar/mote/issues/new"))) }
                ui.button(MoteI18n.text("诊断与更新")) { ui.navigate("developer") }
                ui.button(MoteI18n.text("关于与更新")) { ui.startActivity(Intent(ui, AppUpdatesActivity::class.java)) }
            }
            else -> ui.text(MoteI18n.text("资料不存在或已删除。"))
        }
    }
    private fun preferences() {
        val choices = listOf("system" to MoteI18n.text("跟随系统"), "zh-CN" to "简体中文", "en" to "English")
        ui.button(MoteI18n.text("界面语言")) {
            MoteDialogBuilder(ui).setTitle(MoteI18n.text("界面语言")).setItems(choices.map { it.second }.toTypedArray()) { _, index ->
                ui.work(MoteI18n.text("正在保存…"), { MoteI18n.select(ui, choices[index].first) }) { ui.recreate() }
            }.setNegativeButton(MoteI18n.text("取消"), null).show()
        }
    }
    fun values(value: Any?, target: LinearLayout, depth: Int = 0) {
        if (value == null || value == JSONObject.NULL || depth > 6) return
        when (value) {
            is JSONObject -> value.keys().forEach { key ->
                val next = value.opt(key)
                if (next == null || next == JSONObject.NULL) return@forEach
                if (next is JSONObject || next is JSONArray) {
                    val group = ui.card(target); ui.text(label(key), NativeFontRole.SECTION, group); values(next, group, depth + 1)
                } else ui.text(label(key) + " · " + next.toString(), parent = target)
            }
            is JSONArray -> for (i in 0 until minOf(value.length(), 100)) values(value.opt(i), target, depth + 1)
            else -> ui.text(value.toString(), parent = target)
        }
    }
    fun items(result: JSONObject, target: LinearLayout, select: (JSONObject) -> Unit) {
        val items = result.optJSONArray("items") ?: JSONArray()
        if (items.length() == 0) ui.text(MoteI18n.text("暂无记录"), parent = target)
        for (i in 0 until items.length()) {
            val item = items.getJSONObject(i); val card = ui.card(target)
            ui.text(item.optString("title", item.optString("kind", item.optString("id"))), NativeFontRole.SECTION, card)
            ui.text(item.optString("state", item.optString("status")), parent = card)
            ui.button(MoteI18n.text("查看详情"), parent = card) { select(item) }
        }
    }
    private fun read(path: String, target: LinearLayout = ui.card()) {
        val api = client
        ui.work(MoteI18n.text("正在读取…"), { api.get(path) }) { values(it, target) }
    }
    private fun action(path: String, payload: JSONObject = JSONObject(), done: (JSONObject) -> Unit = { screens.refresh() }) {
        val api = client
        ui.work(MoteI18n.text("正在处理…"), { api.post(path, payload) }, done)
    }

    /** Primitive fields are native inputs; complex policy arrays retain the existing advanced JSON editor. */
    private fun form(value: JSONObject, target: LinearLayout, readOnly: Set<String> = setOf("revision")): () -> JSONObject {
        val reads = linkedMapOf<String, () -> Any>()
        for (key in value.keys()) {
            val raw = value.get(key); val caption = label(key)
            if (key in readOnly || key == "backupAudio") { reads[key] = { raw }; continue }
            if (key in setOf("headers", "extraBody") && raw == JSONObject.NULL) {
                val field = ui.field(caption + " · " + MoteI18n.text("高级 JSON"), multiline = true, parent = target)
                val clear = CheckBox(ui).apply { text = MoteI18n.text("清除已保存的值") }; target.addView(clear)
                reads[key] = { if (clear.isChecked) JSONObject.NULL else field.text.toString().takeIf { it.isNotBlank() }?.let(::JSONObject) ?: KeepValue }
                continue
            }
            when (raw) {
                is Boolean -> {
                    val field = CheckBox(ui).apply { text = caption; isChecked = raw }; target.addView(field); MoteUi.styleTree(field); reads[key] = { field.isChecked }
                }
                is JSONObject -> {
                    if (key in setOf("sourceProfiles", "typeProfiles", "headers", "extraBody", "parameters")) {
                        val field = ui.field(caption + " · " + MoteI18n.text("高级 JSON"), raw.toString(2), multiline = true, parent = target)
                        reads[key] = { JSONObject(field.text.toString()) }
                    } else {
                        ui.text(caption, NativeFontRole.SECTION, target); val nested = form(raw, ui.card(target), if (key == "extraction") setOf("enabled") else emptySet()); reads[key] = nested
                    }
                }
                is JSONArray -> {
                    val field = ui.field(caption + " · " + MoteI18n.text("高级 JSON"), raw.toString(2), multiline = true, parent = target)
                    reads[key] = { JSONArray(field.text.toString()) }
                }
                else -> {
                    val choices = enums[key]?.let { if (raw.toString() in it) it else it + raw.toString() }
                    if (choices != null) {
                        ui.text(caption, NativeFontRole.SUPPORT, target)
                        val spinner = Spinner(ui).apply { adapter = ArrayAdapter(ui, android.R.layout.simple_spinner_dropdown_item, if (key == "serviceTier") choices.map { if (it == "fast") "Fast" else "Standard" } else choices)
                            setSelection(choices.indexOf(raw.toString()).coerceAtLeast(0)) }; target.addView(spinner)
                        reads[key] = { choices[spinner.selectedItemPosition] }; continue
                    }
                    val nullableNumber = key in setOf("modelRequestTimeoutMs", "agentTimeoutMs", "speakerCount", "speakerMin", "speakerMax")
                    val field = ui.field(caption, if (raw == JSONObject.NULL) "" else raw.toString(),
                        multiline = key in setOf("description", "instruction", "prompt"), password = key in secrets, parent = target)
                    if (raw is Number || nullableNumber) field.inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL or InputType.TYPE_NUMBER_FLAG_SIGNED
                    val clear = if (key in setOf("apiKey", "localWorkerApiKey")) CheckBox(ui).apply { text = MoteI18n.text("清除已保存的密钥") }.also(target::addView) else null
                    reads[key] = {
                        val input = field.text.toString()
                        if (clear?.isChecked == true) JSONObject.NULL
                        else if (input.isBlank() && nullableNumber) JSONObject.NULL
                        else if (raw is Number || nullableNumber) input.toLongOrNull() ?: input.toDouble()
                        else input
                    }
                }
            }
        }
        return { JSONObject().apply { reads.forEach { (key, read) ->
            val next = read(); if (next !== KeepValue && (key !in secrets || next.toString().isNotBlank())) put(key, next)
        }; if (has("protocol") && optString("protocol") != "codex-app-server") remove("serviceTier") } }
    }
    private fun edit(title: String, path: String, value: JSONObject, method: String = "PUT", back: () -> Unit = { screens.refresh() }, completed: (JSONObject) -> Unit = { screens.refresh() }) {
        body.removeAllViews(); screens.setBack(back); ui.text(title, NativeFontRole.TITLE_MOBILE)
        val collect = form(value, ui.card())
        ui.button(MoteI18n.text("保存设置"), true) {
            val payload = collect(); val api = client
            ui.work(MoteI18n.text("正在保存…"), {
                if (method == "POST") api.post(path, payload) else if (method == "PATCH") api.patch(path, payload) else api.put(path, payload)
            }, completed)
        }
    }
    private fun configuration(title: String, path: String, writePath: String = path, select: (JSONObject) -> JSONObject = { it }) {
        val api = client
        ui.work(MoteI18n.text("正在读取…"), { api.get(path) }) { edit(title, writePath, select(it)) }
    }
    private fun settings() {
        ui.button(MoteI18n.text("模型配置")) { models() }
        ui.button(MoteI18n.text("并发与执行设置")) { instanceSettingOwnership(MoteI18n.text("并发与执行设置")) { screens.refresh() } }
        ui.button(MoteI18n.text("处理设置")) { fileSettings() }
        ui.button(MoteI18n.text("文字识别设置")) { perceptionSettings() }
        ui.button(MoteI18n.text("记忆设置")) { memorySettings() }
        ui.button(MoteI18n.text("来源与外部应用")) { connectors() }
        val api = client
        ui.work(MoteI18n.text("正在读取…"), { api.get("/api/configuration") to api.get("/api/auth/self") }) { (configuration, identity) ->
            if (identity.getBoolean("administrator")) ui.button(MoteI18n.text("保留与容量")) { storageSettings() }
            val groups = configuration.optJSONArray("groups") ?: JSONArray()
            for (i in 0 until groups.length()) {
                val group = groups.getJSONObject(i)
                ui.disclosure(group.optString("title")) { card ->
                    ui.text(group.optString("description"), parent = card)
                    val fields = group.optJSONArray("fields") ?: JSONArray()
                    for (j in 0 until fields.length()) {
                        val field = fields.getJSONObject(j)
                        ui.text(field.optString("label") + " · " + field.opt("value"), parent = card)
                        ui.text(field.optString("description"), NativeFontRole.SUPPORT, card)
                    }
                }
            }
        }
    }
    private fun instanceSettingOwnership(title: String, back: () -> Unit) {
        body.removeAllViews(); screens.setBack(back); ui.text(title, NativeFontRole.TITLE_MOBILE)
        ui.text(MoteI18n.text("实例级执行与诊断设置由部署操作者管理；客户端仍可修改本账号的模型和处理设置。"))
    }
    private fun perceptionSettings(back: () -> Unit = { screens.refresh() }) {
        val api = client
        ui.work(MoteI18n.text("正在读取…"), {
            JSONObject().put("image", api.get("/api/perception")).put("policy", api.get("/api/file-processing"))
                .put("media", api.get("/api/media-models")).put("identity", api.get("/api/auth/self")).put("sources", api.get("/api/sources"))
        }) { loaded ->
            val view = loaded.getJSONObject("image"); val saved = JSONObject(view.getJSONObject("settings").toString())
            body.removeAllViews(); screens.setBack(back); ui.text(MoteI18n.text("文字识别设置"), NativeFontRole.TITLE_MOBILE)
            val navigation = ui.navigationRevision; fun current() = navigation == ui.navigationRevision && screens.ownsSelectedAccount() && client === api
            val controls = ui.card(); val flags = linkedMapOf<String, CheckBox>()
            for ((key, title) in listOf("enabled" to "自动处理新图片", "understandingEnabled" to "后台理解画面与来源上下文", "allowExternalProcessing" to "允许图片发往已选择的远程 OCR 服务", "allowQueryImages" to "允许查询模型按需读取已发现记录的原图（可能发往所选模型服务）")) {
                flags[key] = CheckBox(ui).apply { text = MoteI18n.text(title); contentDescription = MoteI18n.text(title); isChecked = saved.getBoolean(key) }.also(controls::addView)
            }
            val policy = loaded.getJSONObject("policy"); val processors = policy.getJSONArray("processors")
            val profiles = policy.getJSONObject("policy").getJSONArray("profiles").let { rows -> (0 until rows.length()).map(rows::getJSONObject).filter { profile ->
                profile.getString("processorId") == "archive" || profile.has("imageRecipe") || (0 until processors.length()).map(processors::getJSONObject).any { processor ->
                    processor.getString("id") == profile.getString("processorId") && processor.getString("stage") == "extract" && processor.getJSONArray("mediaTypes").let { types -> (0 until types.length()).any { types.getString(it).startsWith("image/") } }
                }
            } }.toMutableList()
            val selectedId = saved.optString("profileId")
            if (profiles.none { it.getString("id") == selectedId }) profiles.add(JSONObject().put("id", selectedId).put("name", MoteI18n.text("不可用") + " · " + selectedId))
            ui.text(MoteI18n.text("中央图片方案"), parent = controls)
            val profile = Spinner(ui).apply { contentDescription = MoteI18n.text("中央图片方案"); adapter = ArrayAdapter(ui, android.R.layout.simple_spinner_dropdown_item, profiles.map { it.getString("name") }); setSelection(profiles.indexOfFirst { it.getString("id") == selectedId }.coerceAtLeast(0)) }; controls.addView(profile)
            ui.text(MoteI18n.text("文字识别服务") + " · " + saved.optString("ocrEndpoint").ifBlank { MoteI18n.text("仅保存原件") }, parent = controls)
            ui.text(MoteI18n.text("内容理解使用中央文件分析模型：{0}", view.optJSONObject("model")?.optString("model") ?: MoteI18n.text("未配置")), parent = controls)
            val concurrency = ui.field(MoteI18n.text("图片处理并发"), saved.getInt("concurrency").toString(), parent = controls).apply { inputType = InputType.TYPE_CLASS_NUMBER }
            val version = ui.field(MoteI18n.text("处理模型／配置版本"), saved.getString("providerRevision"), parent = controls)
            val history = ui.card(); ui.text(MoteI18n.text("补处理已有图片"), NativeFontRole.SECTION, history)
            val after = ui.field(MoteI18n.text("开始日期"), parent = history); val before = ui.field(MoteI18n.text("结束日期"), parent = history)
            val sources = loaded.getJSONObject("sources").getJSONArray("items").let { rows -> (0 until rows.length()).map(rows::getJSONObject) }
            val source = Spinner(ui).apply { contentDescription = MoteI18n.text("来源"); adapter = ArrayAdapter(ui, android.R.layout.simple_spinner_dropdown_item, listOf(MoteI18n.text("全部来源")) + sources.map { it.getString("name") }) }; history.addView(source)
            val mode = Spinner(ui).apply { contentDescription = MoteI18n.text("处理方式"); adapter = ArrayAdapter(ui, android.R.layout.simple_spinner_dropdown_item, listOf(MoteI18n.text("补齐未完成步骤"), MoteI18n.text("重新计算已有结果"))) }; history.addView(mode)
            val confirmation = ui.card(history)
            fun dirty(): Boolean = flags.any { saved.getBoolean(it.key) != it.value.isChecked } || concurrency.text.toString() != saved.getInt("concurrency").toString() || version.text.toString() != saved.getString("providerRevision") || profiles[profile.selectedItemPosition].getString("id") != selectedId
            ui.button(MoteI18n.text("保存图片设置"), true, parent = controls) {
                if (!current()) return@button
                val values = JSONObject(); flags.forEach { (key, field) -> values.put(key, field.isChecked) }
                val limit = concurrency.text.toString(); val revision = version.text.toString(); val selected = profiles[profile.selectedItemPosition].getString("id")
                ui.work(MoteI18n.text("正在保存…"), { check(current()); api.put("/api/perception", CentralResourceSettings.perceptionRequest(view.getLong("revision"), saved, values, limit, revision, selected)) }) { if (current()) { perceptionSettings(back); ui.notice(MoteI18n.text("已保存")) } }
            }
            ui.button(MoteI18n.text("预览处理范围"), parent = history) {
                if (!current()) return@button
                if (dirty()) { ui.notice(MoteI18n.text("有未保存修改")); return@button }
                val start = after.text.toString(); val end = before.text.toString(); val sourceId = if (source.selectedItemPosition == 0) "" else sources[source.selectedItemPosition - 1].getString("id"); val selectedMode = if (mode.selectedItemPosition == 0) "complete" else "recompute"
                ui.work(MoteI18n.text("正在读取…"), { check(current()); api.post("/api/perception/ocr/historical-preview", CentralResourceSettings.historicalRequest(start, end, sourceId, selectedMode)) }) { preview ->
                    if (current()) {
                        confirmation.removeAllViews(); ui.text(MoteI18n.text("范围内共 {0} 张图片", preview.getInt("count")), parent = confirmation)
                        if (preview.getInt("count") > 0) ui.button(MoteI18n.text("安排全部图片"), true, parent = confirmation) {
                            if (!current() || dirty() || after.text.toString() != start || before.text.toString() != end || source.selectedItemPosition != (if (sourceId.isBlank()) 0 else sources.indexOfFirst { it.getString("id") == sourceId } + 1) || mode.selectedItemPosition != (if (selectedMode == "complete") 0 else 1)) { confirmation.removeAllViews(); return@button }
                            ui.work(MoteI18n.text("正在处理…"), { check(current()); api.post("/api/perception/ocr/historical-process", JSONObject().put("token", preview.getString("token"))) }) { if (current()) perceptionSettings(back) }
                        }
                    }
                }
            }
            val backfills = view.getJSONArray("backfills")
            for (index in 0 until backfills.length()) { val job = backfills.getJSONObject(index); ui.text(MoteI18n.text("已安排 {0} 张图片", job.getInt("queued")) + " · " + operationState(job), parent = history); job.optString("error").takeIf(String::isNotBlank)?.let { ui.text(it, parent = history) } }
            ui.text(MoteI18n.text("处理状态"), NativeFontRole.SECTION); values(view.getJSONArray("jobs"), ui.card())
            managedMedia(api, loaded.getJSONObject("media"), loaded.getJSONObject("identity").getBoolean("administrator"), listOf("ocr"), body)
        }
    }
    private fun managedMedia(api: CentralClient, snapshot: JSONObject, administrator: Boolean, roles: List<String>, target: LinearLayout) {
        val card = ui.card(target); val navigation = ui.navigationRevision
        fun current() = navigation == ui.navigationRevision && screens.ownsSelectedAccount() && client === api
        var poll: Runnable? = null
        fun render(media: JSONObject) {
            if (!current()) return
            poll?.let(mediaHandler::removeCallbacks); poll = null
            card.removeAllViews(); var updating = false
            for (role in roles) {
                val model = media.getJSONObject(role); val state = model.getString("state"); val active = state in listOf("downloading", "verifying", "installing")
                updating = updating || active || state == "ready" && !model.getBoolean("runtimeReady")
                val title = when (role) { "ocr" -> "本地 OCR 模型："; "dialogue" -> "本地转写与说话人模型："; else -> "可选 WeSpeaker 中文声纹模型" }
                ui.text(MoteI18n.text(title) + MoteI18n.text(CentralResourceSettings.modelState(state)), NativeFontRole.SECTION, card)
                if (state == "ready") ui.text(MoteI18n.text(if (model.getBoolean("runtimeReady")) if (role == "ocr") "OCR Worker 已就绪" else "已就绪" else if (role == "ocr") "模型已安装，正在准备本地 OCR 服务；就绪后会自动处理" else "等待音频 Worker"), parent = card)
                if (role == "dialogue" && state == "ready") model.optJSONArray("missingDependencies")?.let { missing -> if (missing.length() > 0) ui.text(MoteI18n.text("模型已安装，服务缺少运行依赖：{0}", (0 until missing.length()).joinToString(", ") { missing.getString(it) }), parent = card) }
                if (active) ui.text(model.getLong("bytes").toString() + " / " + model.getLong("totalBytes"), parent = card)
                model.optString("error").takeIf(String::isNotBlank)?.let { ui.text(it, parent = card) }
                if (role == "speaker-wespeaker") ui.text(MoteI18n.text("仅选用此插件的录音使用此模型；下载不会更改默认方案。"), parent = card)
                if (!administrator && state != "ready") ui.text(MoteI18n.text("仅管理员可安装本机模型。"), NativeFontRole.SUPPORT, card)
                if (administrator && state != "ready") {
                    val action = if (active) "cancel" else "install"
                    val label = if (active) "取消下载" else when (role) { "ocr" -> "下载并安装 OCR 模型"; "dialogue" -> "下载并安装本地音频模型"; else -> "安装可选声纹模型" }
                    ui.button(MoteI18n.text(label), parent = card) {
                        if (!current()) return@button
                        val payload = if (active) JSONObject() else JSONObject().put("source", if (role == "speaker-wespeaker") "official" else "auto")
                        ui.work(MoteI18n.text("正在处理…"), { check(current()); api.post("/api/admin/media-models/$role/$action", payload); api.get("/api/media-models") }) { render(it) }
                    }
                }
            }
            ui.button(MoteI18n.text("刷新"), parent = card) { if (current()) ui.work(MoteI18n.text("正在读取…"), { api.get("/api/media-models") }) { render(it) } }
            if (updating) { poll = Runnable { if (current()) ui.work(MoteI18n.text("正在读取…"), { check(current()); api.get("/api/media-models") }) { render(it) } }; mediaHandler.postDelayed(poll!!, 2000) }
        }
        render(snapshot)
    }
    private fun storageSettings() {
        val api = client
        ui.work(MoteI18n.text("正在读取…"), { api.get("/api/admin/storage-settings") }) { view ->
            body.removeAllViews(); screens.setBack { screens.refresh() }; ui.text(MoteI18n.text("保留与容量"), NativeFontRole.TITLE_MOBILE)
            val navigation = ui.navigationRevision; fun current() = navigation == ui.navigationRevision && screens.ownsSelectedAccount() && client === api
            val saved = view.getJSONObject("saved"); val effective = view.getJSONObject("effective")
            val days = ui.field(MoteI18n.text("自定义保留天数"), saved.getLong("retentionDays").toString()).apply { inputType = InputType.TYPE_CLASS_NUMBER }
            val capacity = ui.field(MoteI18n.text("自定义容量（MiB）"), CentralResourceSettings.capacityMiB(saved.getLong("maxStorageBytes"))).apply { inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL }
            ui.text(MoteI18n.text("当前生效值"), NativeFontRole.SECTION)
            ui.text(MoteI18n.text("历史记录保留") + " · " + effective.getLong("retentionDays") + " " + MoteI18n.text("天"))
            ui.text(MoteI18n.text("资料容量上限") + " · " + CentralResourceSettings.capacityMiB(effective.getLong("maxStorageBytes")) + " MiB")
            if (view.getString("status") == "restart-required") ui.text(MoteI18n.text("重启后生效"))
            if (view.getString("status") == "invalid") ui.text(MoteI18n.text("配置应用失败"))
            ui.button(MoteI18n.text("保存设置"), true) {
                if (!current()) return@button
                val retention = days.text.toString(); val limit = capacity.text.toString()
                ui.work(MoteI18n.text("正在保存…"), { check(current()); api.put("/api/admin/storage-settings", CentralResourceSettings.storageRequest(view.getLong("revision"), retention, limit)) }) { if (current()) storageSettings() }
            }
        }
    }
    private fun models() {
        val api = client
        ui.work(MoteI18n.text("正在读取…"), { api.get("/api/configuration") to CentralModels.inventory(api) }) { (view, inventory) ->
            body.removeAllViews(); screens.setBack { screens.refresh() }; ui.text(MoteI18n.text("模型配置"), NativeFontRole.TITLE_MOBILE)
            val navigation = ui.navigationRevision
            fun current() = ui.navigationRevision == navigation && client === api
            ui.text(MoteI18n.text("编辑草稿与实际生效配置分开显示；测试连接不保存草稿。"))
            ui.button(MoteI18n.text("功能默认模型")) { modelDefaults(api, view, inventory) }
            val configuration = CentralModels.configuration(view); val revision = view.getLong("revision")
            ui.button(MoteI18n.text("创建预设")) {
                modelEditor(api, revision, configuration, "preset-" + UUID.randomUUID().toString().take(8), MoteI18n.text("新 Provider 预设"), CentralModels.newSettings())
            }
            val rows = inventory.getJSONArray("profiles").let { values -> (0 until values.length()).map(values::getJSONObject) }
                .sortedBy { CentralModels.reference(it.getString("id"))!!.getString("kind") != "personal" }
            if (rows.isEmpty()) { ui.text(MoteI18n.text("暂无记录")); return@work }
            val choice = Spinner(ui).apply {
                contentDescription = MoteI18n.text("Provider 预设")
                adapter = ArrayAdapter(ui, android.R.layout.simple_spinner_dropdown_item, rows.map { it.getString("name") })
            }; body.addView(choice)
            val selected = LinearLayout(ui).apply { orientation = LinearLayout.VERTICAL }; body.addView(selected)
            val selection = java.util.concurrent.atomic.AtomicInteger()
            fun render(position: Int) {
                val stamp = selection.incrementAndGet(); selected.removeAllViews()
                val row = rows[position]; val reference = CentralModels.reference(row.getString("id"))!!; val name = row.getString("name")
                val card = ui.card(selected); ui.text(name, NativeFontRole.SECTION, card)
                if (reference.getString("kind") == "personal") {
                    val profiles = configuration.getJSONArray("profiles")
                    val profile = (0 until profiles.length()).map(profiles::getJSONObject).single { it.getString("id") == reference.getString("id") }
                    ui.button(MoteI18n.text("编辑"), parent = card) { selection.incrementAndGet(); modelEditor(api, revision, configuration, profile.getString("id"), name, profile.getJSONObject("settings")) }
                    val selections = configuration.getJSONObject("selections")
                    val inUse = selections.keys().asSequence().any { selections.getJSONObject(it).let { ref -> ref.getString("kind") == "personal" && ref.getString("id") == profile.getString("id") } }
                    if (inUse) ui.text(MoteI18n.text("该配置仍是某项功能的默认模型，请先修改功能默认值。"), parent = card)
                    ui.button(MoteI18n.text("删除"), parent = card) {
                        if (inUse || !current() || selection.get() != stamp) return@button
                        screens.confirm(MoteI18n.text("删除"), MoteI18n.text("删除后无法恢复。")) {
                            val next = JSONObject(configuration.toString()); next.put("profiles", JSONArray((0 until profiles.length()).map(profiles::getJSONObject).filter { it.getString("id") != profile.getString("id") }))
                            ui.work(MoteI18n.text("正在删除…"), { api.put("/api/configuration/models", CentralModels.saveRequest(revision, next)) }) { models() }
                        }
                    }.isEnabled = !inUse
                    ui.button(MoteI18n.text("复制为新预设"), parent = card) {
                        if (selection.get() != stamp) return@button
                        selection.incrementAndGet()
                        edit(MoteI18n.text("复制为新预设"), "/api/models/profiles/" + enc(reference.getString("id")) + "/copy",
                            JSONObject().put("revision", revision).put("id", "preset-" + UUID.randomUUID().toString().take(8)).put("name", name + " copy").put("includeCredentials", true),
                            "POST", back = { models() }, completed = { models() })
                    }
                } else ui.text(MoteI18n.text("共享连接保持只读；连接地址和凭据不能复制为个人预设。"), parent = card)
                val output = ui.card(card)
                fun inspect(path: String, catalog: Boolean) {
                    if (selection.get() != stamp) return
                    val payload = CentralModels.inspectRequest(revision, reference)
                    ui.work(MoteI18n.text("正在读取…"), { check(selection.get() == stamp); api.post(path, payload) }) { result ->
                        if (selection.get() == stamp) { output.removeAllViews(); if (catalog) modelCatalogPage(result, output) else values(result, output) }
                    }
                }
                ui.button(MoteI18n.text("测试连接"), parent = card) { inspect("/api/models/probe", false) }.contentDescription = MoteI18n.text("测试连接") + " · " + name
                ui.button(MoteI18n.text("可用模型"), parent = card) { inspect("/api/models/catalog", true) }.contentDescription = MoteI18n.text("可用模型") + " · " + name
            }
            choice.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onNothingSelected(parent: AdapterView<*>?) = Unit
                override fun onItemSelected(parent: AdapterView<*>?, field: android.view.View?, position: Int, id: Long) { render(position) }
            }
        }
    }
    private fun modelEditor(api: CentralClient, revision: Long, configuration: JSONObject, id: String, name: String, previous: JSONObject) {
        body.removeAllViews(); screens.setBack { models() }; ui.text(MoteI18n.text("模型配置"), NativeFontRole.TITLE_MOBILE)
        val navigation = ui.navigationRevision
        fun current() = ui.navigationRevision == navigation && client === api
        ui.text(MoteI18n.text("编辑草稿与实际生效配置分开显示；测试连接不保存草稿。"))
        val target = ui.card(); val title = ui.field(MoteI18n.text("名称"), name, parent = target)
        val parameters = JSONObject(previous.toString()).apply { remove("model"); listOf("apiKey", "headers", "extraBody").forEach(::remove) }
        val collect = form(parameters, target, emptySet()); val model = ui.field(MoteI18n.text("模型 ID"), previous.getString("model"), parent = target)
        val credentials = listOf("apiKey", "headers", "extraBody").associateWith { key ->
            val field = ui.field(label(key) + if (key == "apiKey") "" else " · " + MoteI18n.text("高级 JSON"), multiline = key != "apiKey", password = true, parent = target)
            val clear = CheckBox(ui).apply { text = MoteI18n.text(if (key == "apiKey") "清除已保存的密钥" else "清除已保存的值") }; target.addView(clear)
            field to clear
        }
        fun draft() = collect().put("model", model.text.toString()).apply {
            credentials.forEach { (key, fields) ->
                val input = fields.first.text.toString()
                put(key, if (fields.second.isChecked) { if (key == "apiKey") "" else JSONObject() }
                    else if (input.isBlank()) previous.get(key) else if (key == "apiKey") input else JSONObject(input))
            }
        }
        fun withDecision(next: JSONObject, action: (Boolean) -> Unit) {
            if (CentralModels.needsCredentialReuse(previous, next)) screens.confirm(MoteI18n.text("模型配置"), MoteI18n.text("服务商、协议或地址已改变，请确认复用已有凭据，或替换、清除已有凭据。")) { action(true) }
            else action(false)
        }
        val reference = JSONObject().put("kind", "personal").put("id", id); val output = ui.card()
        fun inspect(catalog: Boolean) {
            val next = draft()
            withDecision(next) { allow ->
                if (!current()) return@withDecision
                val payload = CentralModels.inspectRequest(revision, reference, next, allow)
                ui.work(MoteI18n.text("正在读取…"), { check(current()); api.post(if (catalog) "/api/models/catalog" else "/api/models/probe", payload) }) { result ->
                    if (current() && runCatching { draft().toString() == next.toString() }.getOrDefault(false)) {
                        output.removeAllViews()
                        if (catalog) {
                            modelCatalogPage(result, output, onSelect = { chosen -> model.setText(chosen); output.removeAllViews() })
                        } else values(result, output)
                    }
                }
            }
        }
        ui.button(MoteI18n.text("可用模型")) { inspect(true) }
        ui.button(MoteI18n.text("测试连接")) { inspect(false) }
        ui.text(MoteI18n.text("连接测试会发送生成内容，可能产生模型费用；测试不会保存编辑草稿。"))
        ui.button(MoteI18n.text("保存设置"), true) {
            val next = draft(); val nextName = title.text.toString(); withDecision(next) { allow ->
                if (!current()) return@withDecision
                val value = CentralModels.replaceProfile(configuration, id, nextName, next)
                ui.work(MoteI18n.text("正在保存…"), { check(current()); api.put("/api/configuration/models", CentralModels.saveRequest(revision, value, allow)) }) {
                    if (current() && title.text.toString() == nextName && runCatching { draft().toString() == next.toString() }.getOrDefault(false)) models()
                }
            }
        }
    }
    private fun modelDefaults(api: CentralClient, view: JSONObject, inventory: JSONObject) {
        val domains = view.getJSONArray("domains")
        val configuration = JSONObject((0 until domains.length()).map(domains::getJSONObject).single { it.getString("id") == "models" }.getJSONObject("saved").toString())
        val selections = configuration.getJSONObject("selections")
        val raw = inventory.getJSONArray("features"); val features = (0 until raw.length()).map(raw::getString)
        require(features.isNotEmpty() && features.distinct().size == features.size && features.all(String::isNotBlank))
        body.removeAllViews(); screens.setBack { models() }; ui.text(MoteI18n.text("功能默认模型"), NativeFontRole.TITLE_MOBILE)
        val navigation = ui.navigationRevision
        fun currentPage() = ui.navigationRevision == navigation && client === api
        val rows = inventory.getJSONArray("profiles"); val fields = linkedMapOf<String, Triple<Spinner, List<JSONObject?>, EditText>>()
        for (feature in features) {
            val choices = mutableListOf<Pair<String, JSONObject?>>(MoteI18n.text("未配置") to null)
            for (index in 0 until rows.length()) { val row = rows.getJSONObject(index); choices.add(row.getString("name") to CentralModels.reference(row.getString("id"))) }
            val current = selections.optJSONObject(feature)
            fun same(reference: JSONObject?) = if (current == null) reference == null else reference != null && current.getString("kind") == reference.getString("kind") && current.getString("id") == reference.getString("id")
            var selected = choices.indexOfFirst { same(it.second) }
            if (selected < 0) { choices.add(MoteI18n.text("不可用") + " · " + current!!.getString("kind") + ":" + current.getString("id") to JSONObject(current.toString())); selected = choices.lastIndex }
            ui.text(label(feature), NativeFontRole.ROW)
            val spinner = Spinner(ui).apply {
                contentDescription = MoteI18n.text("功能默认模型") + " · " + feature
                adapter = ArrayAdapter(ui, android.R.layout.simple_spinner_dropdown_item, choices.map { it.first }); setSelection(selected)
            }; body.addView(spinner)
            val model = ui.field(MoteI18n.text("模型 ID（可选覆盖）"), current?.optString("model").orEmpty())
            model.contentDescription = MoteI18n.text("模型 ID（可选覆盖）") + " · " + feature
            var previousChoice = spinner.selectedItemPosition
            fun updateModel() {
                if (spinner.selectedItemPosition != previousChoice) model.setText("")
                previousChoice = spinner.selectedItemPosition
                model.isEnabled = choices[spinner.selectedItemPosition].second?.optString("kind") == "personal"
            }
            spinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onNothingSelected(parent: AdapterView<*>?) = Unit
                override fun onItemSelected(parent: AdapterView<*>?, field: android.view.View?, position: Int, id: Long) { updateModel() }
            }; updateModel()
            fields[feature] = Triple(spinner, choices.map { it.second }, model)
        }
        ui.button(MoteI18n.text("保存设置"), true) {
            val next = JSONObject(selections.toString())
            for ((feature, field) in fields) {
                val reference = field.second[field.first.selectedItemPosition]
                if (reference == null) next.remove(feature) else {
                    val fixed = pick(reference, "kind", "id")
                    next.put(feature, CentralModels.featureReference(fixed, if (fixed.getString("kind") == "personal") field.third.text.toString() else ""))
                }
            }
            configuration.put("selections", next)
            val payload = JSONObject().put("revision", view.getLong("revision")).put("value", configuration).put("preserveRedactedSecrets", true)
            ui.work(MoteI18n.text("正在保存…"), { check(currentPage()); api.put("/api/configuration/models", payload) }) { if (currentPage()) models() }
        }
    }
    private fun modelCatalogPage(result: JSONObject, target: LinearLayout, offset: Int = 0, onSelect: ((String) -> Unit)? = null) {
        target.removeAllViews(); val metadata = JSONObject(result.toString()).apply { remove("items") }; values(metadata, target)
        val items = result.getJSONArray("items"); if (items.length() == 0) ui.text(MoteI18n.text("暂无记录"), parent = target)
        for (index in offset until minOf(offset + 100, items.length())) {
            val item = items.getJSONObject(index)
            if (onSelect == null) values(item, ui.card(target)) else ui.button(item.optString("name", item.getString("id")), parent = target) { onSelect(item.getString("id")) }
        }
        if (offset != 0) ui.button(MoteI18n.text("返回第一页"), parent = target) { modelCatalogPage(result, target, onSelect = onSelect) }
        if (offset + 100 < items.length()) ui.button(MoteI18n.text("下一页"), parent = target) { modelCatalogPage(result, target, offset + 100, onSelect) }
    }
    fun fileSettings() {
        val api = client
        ui.work(MoteI18n.text("正在读取…"), { Triple(api.get("/api/file-processing"), api.get("/api/media-models"), api.get("/api/auth/self")) }) { (value, media, identity) ->
            val settings = JSONObject(value.getJSONObject("settings").toString())
            if (value.getBoolean("policyConfigured")) {
                edit(MoteI18n.text("处理设置"), "/api/file-processing", JSONObject().put("revision", value.getString("revision"))
                    .put("settings", settings).put("policy", JSONObject(value.getJSONObject("policy").toString())))
                managedMedia(api, media, identity.getBoolean("administrator"), listOf("dialogue", "speaker-wespeaker"), body)
                return@work
            }
            val revision = value.getString("revision").toLong(); require(revision in 0..9_007_199_254_740_991L)
            body.removeAllViews(); screens.setBack { screens.refresh() }; ui.text(MoteI18n.text("处理设置"), NativeFontRole.TITLE_MOBILE)
            managedMedia(api, media, identity.getBoolean("administrator"), listOf("dialogue", "speaker-wespeaker"), body)
            val collect = form(settings, ui.card())
            ui.button(MoteI18n.text("保存设置"), true) {
                val payload = JSONObject().put("revision", revision).put("value", collect())
                ui.work(MoteI18n.text("正在保存…"), { api.put("/api/configuration/processing", payload) }) { screens.refresh() }
            }
        }
    }
    private fun ownedConfiguration(title: String, domainId: String, back: () -> Unit = { memorySettings() }, done: () -> Unit = back) {
        val api = client
        ui.work(MoteI18n.text("正在读取…"), { api.get("/api/configuration") }) { view ->
            val domains = view.getJSONArray("domains")
            val value = (0 until domains.length()).map { domains.getJSONObject(it) }.single { it.getString("id") == domainId }.getJSONObject("saved")
            body.removeAllViews(); screens.setBack(back); ui.text(title, NativeFontRole.TITLE_MOBILE)
            if (domainId == "agentTrace") ui.text(MoteI18n.text("详细记录可能包含问题、上下文、模型输出和工具内容，仅对当前账号生效。关闭后停止新增详细内容，已保留记录不会自动删除。"))
            val collect = form(value, ui.card(), emptySet())
            ui.button(MoteI18n.text("保存设置"), true) {
                val payload = JSONObject().put("revision", view.getLong("revision")).put("value", collect()).put("preserveRedactedSecrets", true)
                ui.work(MoteI18n.text("正在保存…"), { api.put("/api/configuration/" + enc(domainId), payload) }) { done() }
            }
        }
    }
    fun memorySettings() {
        body.removeAllViews(); screens.setBack { screens.refresh() }
        ui.button(MoteI18n.text("记忆自动处理")) { ownedConfiguration(MoteI18n.text("记忆自动处理"), "memory") }
        ui.button(MoteI18n.text("记忆提取配方")) {
            recipeSettings(false)
        }
        ui.button(MoteI18n.text("记忆整合")) { recipeSettings(true) }
        read("/api/memory")
    }
    private fun recipeSettings(integration: Boolean, scope: String? = null) {
        val api = client
        ui.work(MoteI18n.text("正在读取…"), { api.get("/api/configuration") to api.get("/api/memory/recipes") }) { (view, catalog) ->
            val domains = view.getJSONArray("domains")
            val settings = JSONObject((0 until domains.length()).map { domains.getJSONObject(it) }.single { it.getString("id") == "memory" }.getJSONObject("saved").toString())
            body.removeAllViews(); screens.setBack { memorySettings() }
            val field = when (scope) { "capture" -> "captureRecipes"; "lark-docs" -> "documentRecipes"; else -> "recipes" }
            val current = if (integration) { if (settings.getBoolean("integration")) listOf(settings.getJSONObject("integrationRecipe")) else emptyList() }
                else (settings.optJSONArray(field) ?: JSONArray().put(settings.getJSONObject(if (settings.optString("profile") == "coding") "codingRecipe" else "recipe"))).let { items -> (0 until items.length()).map { items.getJSONObject(it) } }
            val choices = catalog.getJSONArray(if (integration) "integrations" else "items")
            val fields = mutableListOf<Pair<CheckBox, JSONObject>>()
            for (i in 0 until choices.length()) {
                val recipe = choices.getJSONObject(i); val ref = pick(recipe, "id", "version")
                val check = CheckBox(ui).apply {
                    text = recipe.optString("name", recipe.getString("id")) + " · " + recipe.getString("version")
                    isChecked = current.any { it.getString("id") == ref.getString("id") && it.getString("version") == ref.getString("version") }
                    isEnabled = recipe.optBoolean("available", true) || isChecked
                }; fields.add(check to ref); body.addView(check)
                if (!integration) check.setOnCheckedChangeListener { _, checked -> if (!checked && fields.none { it.first.isChecked }) check.isChecked = true }
                else check.setOnCheckedChangeListener { _, checked -> if (checked) fields.filter { it.first !== check }.forEach { it.first.isChecked = false } }
            }
            ui.button(MoteI18n.text("保存设置"), true) {
                val selected = fields.filter { it.first.isChecked }.map { it.second }
                if (integration) { settings.put("integration", selected.isNotEmpty()); selected.firstOrNull()?.let { settings.put("integrationRecipe", it) } }
                else { if (selected.isEmpty()) return@button; settings.put(field, JSONArray(selected)) }
                val payload = JSONObject().put("revision", view.getLong("revision")).put("value", settings).put("preserveRedactedSecrets", true)
                ui.work(MoteI18n.text("正在保存…"), { api.put("/api/configuration/memory", payload) }) { memorySettings() }
            }
        }
    }
    fun memoryJobs() {
        body.removeAllViews(); screens.setBack { screens.refresh() }
        val api = client
        ui.button(MoteI18n.text("开始提取"), true) { memorySelection() }
        val pending = ui.card()
        ui.work(MoteI18n.text("正在读取…"), { screens.pendingMemoryAdmission() }) { intent ->
            if (intent != null) memoryAdmissionRetry(api, pending)
        }
        library.paged("/api/memory/jobs", ui.card()) { row, card ->
            ui.text(CentralMemoryJobPresentation.status(row), parent = card)
            ui.button(MoteI18n.text("查看详情"), parent = card) { run("/api/memory/jobs", row.getString("id")) }
        }
    }
    private fun memoryAdmissionRetry(api: CentralClient, target: LinearLayout) {
        ui.text(MoteI18n.text("请求结果尚未确认，请重试同一请求。"), parent = target)
        ui.button(MoteI18n.text("重试同一请求"), parent = target) {
            ui.work(MoteI18n.text("正在保存…"), { screens.retryMemoryAdmission(api) }) { run("/api/memory/jobs", it.getString("id")) }
        }
        ui.button(MoteI18n.text("清除本机待确认请求"), parent = target) {
            screens.confirm(MoteI18n.text("清除本机待确认请求"), MoteI18n.text("这只清除本机待确认请求，已在中央接收的任务仍会继续。")) {
                ui.work(MoteI18n.text("正在保存…"), { screens.discardMemoryAdmission() }) { memoryJobs() }
            }
        }
    }
    private fun memorySelection() {
        val api = client
        ui.work(MoteI18n.text("正在读取…"), { Triple(api.get("/api/memory/recipes"), CentralModels.inventory(api), screens.pendingMemoryAdmission()) }) { (catalog, models, pending) ->
            body.removeAllViews(); screens.setBack { memoryJobs() }
            if (pending != null) { memoryAdmissionRetry(api, ui.card()); return@work }
            ui.text(MoteI18n.text("仅处理所选资料的固定版本；未选配方时沿用当前记忆设置。"))
            val recipes = mutableListOf<Pair<CheckBox, JSONObject>>()
            val recipeItems = catalog.getJSONArray("items")
            for (index in 0 until recipeItems.length()) {
                val recipe = recipeItems.getJSONObject(index)
                val choice = CheckBox(ui).apply { text = recipe.optString("name", recipe.getString("id")) + " · " + recipe.getString("version"); isEnabled = recipe.optBoolean("available", true) }
                body.addView(choice); recipes.add(choice to JSONObject().put("id", recipe.getString("id")).put("version", recipe.getString("version")))
            }
            val profiles = models.getJSONArray("profiles")
            val ids = listOf("") + (0 until profiles.length()).map { profiles.getJSONObject(it).getString("id") }
            val selector = Spinner(ui).apply { adapter = ArrayAdapter(ui, android.R.layout.simple_spinner_dropdown_item,
                listOf(MoteI18n.text("跟随功能默认")) + (0 until profiles.length()).map { profiles.getJSONObject(it).getString("name") }) }
            body.addView(selector)
            val modelId = ui.field(MoteI18n.text("模型 ID（留空跟随预设）"))
            selector.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onNothingSelected(parent: AdapterView<*>?) = Unit
                override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                    modelId.isEnabled = CentralModels.reference(ids[position])?.optString("kind") != "shared"
                    if (!modelId.isEnabled) modelId.setText("")
                }
            }
            val selected = linkedMapOf<String, String>()
            val count = ui.text(MoteI18n.text("已选择 {0} 份资料", 0))
            val retry = ui.card()
            var retryShown = false
            ui.button(MoteI18n.text("提交所选资料"), true) {
                require(selected.isNotEmpty()) { MoteI18n.text("请选择至少一份资料。") }
                val chosen = selected.toSortedMap(); val pins = JSONObject(); chosen.forEach { (id, revision) -> pins.put(id, revision) }
                val request = JSONObject().put("materialIds", JSONArray(chosen.keys.toList())).put("materialRevisions", pins)
                val refs = JSONArray(recipes.filter { it.first.isChecked }.map { it.second }); if (refs.length() > 0) request.put("recipes", refs)
                CentralModels.reference(ids[selector.selectedItemPosition])?.let { request.put("modelReference", it) }
                modelId.text.toString().trim().takeIf { it.isNotBlank() }?.let { request.put("modelOverride", it) }
                if (!retryShown) { memoryAdmissionRetry(api, retry); retryShown = true }
                ui.work(MoteI18n.text("正在保存…"), {
                    for ((id, revision) in chosen) {
                        val preview = api.get("/api/memory/materials/" + enc(id) + "?revision=" + enc(revision) + if (refs.length() == 0) "" else "&recipes=" + enc(refs.toString()))
                        require(preview.getString("materialId") == id && preview.getString("revision") == revision && preview.getString("status") == "ready")
                    }
                    screens.submitMemory(api, request)
                }) { run("/api/memory/jobs", it.getString("id")) }
            }
            library.paged("/api/materials?limit=20", ui.card()) { row, card ->
                val id = row.getString("id"); val revision = row.getString("revision")
                val choice = CheckBox(ui).apply {
                    text = row.getString("title"); tag = "material:$id@$revision"; isChecked = selected[id] == revision
                    setOnCheckedChangeListener { _, checked -> if (checked) selected[id] = revision else selected.remove(id); count.text = MoteI18n.text("已选择 {0} 份资料", selected.size) }
                }; card.addView(choice); ui.text(revision, NativeFontRole.SUPPORT, card)
            }
        }
    }
    fun run(path: String, id: String) {
        body.removeAllViews(); screens.setBack { screens.refresh() }
        if (path == "/api/memory/jobs") {
            val target = ui.card(); val api = client
            ui.work(MoteI18n.text("正在读取…"), { api.get(path + "/" + enc(id)) }) { job ->
                job.getJSONObject("tasks"); job.getBoolean("current")
                ui.text(CentralMemoryJobPresentation.status(job), NativeFontRole.SECTION, target)
                CentralMemoryJobPresentation.notice(job)?.let { ui.text(it, parent = target) }
                for (memoryId in CentralMemoryJobPresentation.results(job)) ui.button(MoteI18n.text("查看记忆"), parent = target) { library.memory(memoryId) }
                if (CentralMemoryJobPresentation.invalidated(job)) {
                    ui.text(CentralMemoryJobPresentation.status(job), 18f, target)
                    CentralMemoryJobPresentation.notice(job)?.let { ui.text(it, parent = target) }
                    ui.disclosure(MoteI18n.text("查看详情"), target) { values(job, it) }
                } else values(job, target)
                CentralMemoryJobPresentation.controls(job).forEach { (command, label) -> ui.button(MoteI18n.text(label), parent = target) { action(path + "/" + enc(id) + "/" + command) { run(path, id) } } }
            }
        } else read(path + "/" + enc(id))
        ui.button(MoteI18n.text("刷新")) { run(path, id) }
        if (path != "/api/memory/jobs") ui.button(MoteI18n.text("停止")) { action(path + "/" + enc(id) + "/cancel") { run(path, id) } }
    }
    private fun devices() {
        library.paged("/api/ingress/devices", ui.card()) { row, card ->
            values(row, card)
            val deviceId = row.getString("id")
            ui.button(MoteI18n.text("为此设备重新生成邀请"), parent = card) { invitation(deviceId) }
        }
        ui.button(MoteI18n.text("生成设备连接邀请")) { invitation() }
    }
    private fun invitation(deviceId: String? = null) {
        val api = client
        body.removeAllViews(); screens.setBack { screens.refresh() }; ui.text(MoteI18n.text("生成设备连接邀请"), NativeFontRole.TITLE_MOBILE)
        deviceId?.let { ui.text(MoteI18n.text("绑定原设备：{0}", it)) }
        val collect = form(JSONObject().put("serverUrl", api.server).put("label", "Android"), ui.card())
        ui.button(MoteI18n.text("保存设置"), true) {
            val payload = collect().apply { deviceId?.let { put("deviceId", it) } }
            ui.work(MoteI18n.text("正在保存…"), { api.post("/api/connections/invitations", payload) }, ::credentialResult)
        }
    }
    private fun credentialResult(value: JSONObject) {
        body.removeAllViews(); screens.setBack { screens.refresh() }
        ui.text(MoteI18n.text("授权已创建"), NativeFontRole.TITLE_MOBILE); values(value, ui.card())
        val uri = value.optString("uri")
        if (uri.isNotBlank()) {
            val matrix = com.google.zxing.MultiFormatWriter().encode(uri, com.google.zxing.BarcodeFormat.QR_CODE, 512, 512)
            val bitmap = android.graphics.Bitmap.createBitmap(512, 512, android.graphics.Bitmap.Config.ARGB_8888)
            for (y in 0 until 512) for (x in 0 until 512) bitmap.setPixel(x, y, if (matrix[x, y]) android.graphics.Color.BLACK else android.graphics.Color.WHITE)
            body.addView(ImageView(ui).apply { setImageBitmap(bitmap); contentDescription = MoteI18n.text("设备连接邀请二维码") })
            value.optJSONObject("invitation")?.let { invitation -> ui.button(MoteI18n.text("取消邀请")) {
                action("/api/connections/invitations/revoke", JSONObject().put("code", invitation.getString("code")))
            } }
        }
    }
    private fun processingSettings() = fileSettings()
    private fun connections() {
        ui.button(MoteI18n.text("生成设备连接邀请")) { invitation() }
        ui.button(MoteI18n.text("创建 MCP 授权")) {
            edit(MoteI18n.text("创建 MCP 授权"), "/api/connections/mcp", JSONObject().put("label", "MCP").put("access", "read").put("sourceIds", JSONArray()), "POST", completed = ::credentialResult)
        }
        library.paged("/api/connections", ui.card()) { row, card ->
            values(row, card)
            if (row.isNull("revokedAt") || !row.has("revokedAt")) ui.button(MoteI18n.text("撤销授权"), parent = card) {
                screens.confirm(MoteI18n.text("撤销授权"), row.optString("label")) {
                    val api = client; ui.work(MoteI18n.text("正在撤销…"), { api.delete("/api/connections/" + enc(row.getString("id"))) }) { screens.refresh() }
                }
            }
        }
    }
    private fun actions() {
        ui.button(MoteI18n.text("日程建议")) { ui.startActivity(Intent(ui, CalendarActionsActivity::class.java)) }
        ui.button(MoteI18n.text("行动设置")) {
            val api = client
            ui.work(MoteI18n.text("正在读取…"), { api.get("/api/actions") }) { snapshot ->
                body.removeAllViews(); screens.setBack { screens.refresh() }
                ui.text(MoteI18n.text("行动设置"), NativeFontRole.TITLE_MOBILE)
                val collect = form(snapshot.getJSONObject("settings"), body)
                val revision = snapshot.getLong("revision")
                val authorizationRevision = snapshot.getLong("authorizationRevision")
                ui.button(MoteI18n.text("保存设置"), true) {
                    val payload = JSONObject().put("revision", revision).put("authorizationRevision", authorizationRevision).put("settings", collect())
                    ui.work(MoteI18n.text("正在保存…"), { api.put("/api/actions/settings", payload) }) { screens.refresh() }
                }
            }
        }
        val todo = ui.field(MoteI18n.text("待办标题"))
        ui.button(MoteI18n.text("添加待办"), true) {
            action("/api/todos", JSONObject().put("id", UUID.randomUUID().toString()).put("title", todo.text.toString()).put("description", "").put("dueAt", JSONObject.NULL).put("evidenceIds", JSONArray()))
        }
        library.paged("/api/todos?limit=30", ui.card()) { row, card ->
            ui.text(row.getString("title"), NativeFontRole.SECTION, card); ui.text(row.optString("description"), parent = card); ui.text(row.optString("status"), parent = card)
            if (row.optString("status") == "open") ui.button(MoteI18n.text("标记完成"), true, parent = card) {
                val api = client
                ui.work(MoteI18n.text("正在保存…"), { api.patch("/api/todos/" + enc(row.getString("id")), JSONObject().put("version", row.getInt("version")).put("status", "completed")) }) { screens.refresh() }
            }
            val refs = row.optJSONArray("evidenceIds") ?: JSONArray()
            for (i in 0 until refs.length()) ui.button(MoteI18n.text("查看原文依据"), parent = card) { library.captureEvidence(refs.getString(i)) }
        }
    }
    private val operationStates = listOf("" to "全部", "waiting" to "等待处理", "running" to "运行中", "blocked" to "受阻", "failed" to "失败", "succeeded" to "完成", "cancelled" to "已取消", "stale" to "来源变化待重验", "skipped" to "未安排")
    private fun stateLabel(state: String) = MoteI18n.text(operationStates.firstOrNull { it.first == state }?.second ?: state)
    private fun operationState(row: JSONObject): String {
        val label = CentralProcessingPresentation.stateKey(row.optString("state"), row.optString("waitingReason", row.optString("reason")), row.optBoolean("notScheduled"))
        return if (label != null) MoteI18n.text(label) else stateLabel(row.optString("state"))
    }
    private fun operationTitle(kind: String) = MoteI18n.text(mapOf("recording-sync" to "录音同步", "material-organizer" to "资料整理", "memory-provider-reconcile" to "记忆供应商核对", "file" to "文件处理", "capture" to "截图处理", "memory" to "记忆整理", "workflow" to "上下文处理", "import" to "资料导入", "query" to "问答", "insight" to "洞察", "embedding" to "检索向量计算", "material-index" to "资料检索索引")[kind] ?: "上下文处理")
    private fun processing(cursors: List<Long?> = listOf(null), state: String = "") {
        body.removeAllViews()
        ui.button(MoteI18n.text("刷新")) { processing(cursors, state) }
        val choice = Spinner(ui).apply {
            contentDescription = MoteI18n.text("任务状态")
            adapter = ArrayAdapter(ui, android.R.layout.simple_spinner_dropdown_item, operationStates.map { MoteI18n.text(it.second) })
            setSelection(operationStates.indexOfFirst { it.first == state }.coerceAtLeast(0))
        }
        body.addView(choice, LinearLayout.LayoutParams(-1, ui.moteDp(52)))
        choice.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
            override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                val selected = operationStates[position].first
                if (selected != state) processing(state = selected)
            }
        }
        val target = ui.card(); val api = client
        ui.work(MoteI18n.text("正在读取…"), { api.get("/api/operations?limit=10" + (if (state.isEmpty()) "" else "&state=" + enc(state)) + (cursors.last()?.let { "&cursor=$it" } ?: "")) }) { result ->
            val items = result.optJSONArray("items") ?: JSONArray()
            if (items.length() == 0) ui.text(MoteI18n.text("没有符合条件的任务"), parent = target)
            for (i in 0 until items.length()) {
                val row = items.getJSONObject(i)
                ui.selectRow(operationTitle(row.optString("kind")) + " · " + operationState(row), row.getString("id"), target) {
                    operation(row.getString("id"), returnTo = { processing(cursors, state) })
                }.apply { tag = "operation:" + row.getString("id"); contentDescription = MoteI18n.text("查看任务 {0} 的详情", row.getString("id")) }
            }
            pageButtons(cursors, result, items.length(), target) { processing(it, state) }
        }
        ui.button(MoteI18n.text("处理设置")) { processingSettings() }
    }
    private fun pageButtons(cursors: List<Long?>, result: JSONObject, count: Int, target: LinearLayout, load: (List<Long?>) -> Unit) {
        ui.text(MoteI18n.text("第 {0} 页 · {1} 条", cursors.size, count), NativeFontRole.SUPPORT, target)
        val paging = LinearLayout(ui).apply { orientation = LinearLayout.HORIZONTAL }
        target.addView(paging)
        ui.button(MoteI18n.text("上一页"), parent = paging) { load(cursors.dropLast(1)) }.apply {
            isEnabled = cursors.size > 1; layoutParams = LinearLayout.LayoutParams(0, -2, 1f).apply { marginEnd = ui.moteDp(4) }
        }
        val next = result.optLong("nextCursor").takeIf { it > 0 }
        ui.button(MoteI18n.text("下一页"), parent = paging) { next?.let { load(cursors + it) } }.apply {
            isEnabled = next != null; layoutParams = LinearLayout.LayoutParams(0, -2, 1f).apply { marginStart = ui.moteDp(4) }
        }
    }
    fun operation(id: String, cursors: List<Long?> = listOf(null), returnTo: () -> Unit = { screens.refresh() }) {
        body.removeAllViews(); screens.setBack(returnTo)
        ui.text(MoteI18n.text("任务详情"), NativeFontRole.TITLE_MOBILE)
        ui.button(MoteI18n.text("刷新")) { operation(id, cursors, returnTo) }
        val target = ui.card(); val api = client
        ui.work(MoteI18n.text("正在读取…"), { api.get("/api/operations/" + enc(id) + "?limit=10" + (cursors.last()?.let { "&cursor=$it" } ?: "")) }) { result ->
            val operation = result.getJSONObject("operation")
            ui.text(operationTitle(operation.optString("kind")) + " · " + operationState(operation), NativeFontRole.SECTION, target)
            ui.text(id, NativeFontRole.SUPPORT, target)
            val steps = result.optJSONArray("steps") ?: JSONArray()
            for (i in 0 until steps.length()) {
                val step = steps.getJSONObject(i)
                ui.disclosure(step.optString("kind") + " · " + operationState(step), target) { values(step, it) }
            }
            pageButtons(cursors, result, steps.length(), target) { operation(id, it, returnTo) }
        }
    }
    private fun extensions() {
        read("/api/features")
        ui.button(MoteI18n.text("处理设置")) { processingSettings() }
        ui.button(MoteI18n.text("文字识别设置")) { perceptionSettings { extensions() } }
        library.paged("/api/processing?limit=20", ui.card()) { row, card ->
            values(row, card)
            ui.button(MoteI18n.text("重试"), parent = card) { action("/api/processing/" + enc(row.getString("id")) + "/retry") }
            ui.button(MoteI18n.text("取消"), parent = card) { action("/api/processing/" + enc(row.getString("id")) + "/cancel") }
        }
    }
    private fun usage() {
        val from = ui.field(MoteI18n.text("开始日期"), LocalDate.now().minusDays(7).toString())
        val to = ui.field(MoteI18n.text("结束日期"), LocalDate.now().toString())
        val target = ui.card()
        fun load() {
            val start = LocalDate.parse(from.text.toString()); val end = LocalDate.parse(to.text.toString())
            target.removeAllViews()
            read("/api/usage?from=$start&to=$end&timeZone=" + enc(ZoneId.systemDefault().id), target)
        }
        ui.button(MoteI18n.text("查询")) { load() }; load()
    }
    private fun vault() {
        ui.text(MoteI18n.text("个人导出包含本账号的资料和已注册数据域，不包含登录凭据、执行授权或整实例备份。"))
        ui.button(MoteI18n.text("中央资料与附件导出"), true) {
            ui.saveCentral("/api/export", "mote-portable.json", "application/json")
        }
        ui.button(MoteI18n.text("中央元数据导出")) {}.isEnabled = false
        ui.text(MoteI18n.text("元数据单独导出的接口尚待接入；当前归档包含本账号的资料与可用原件。"))
        ui.button(MoteI18n.text("导入")) { ui.navigate("imports") }
    }
    private fun portableState(state: String) = MoteI18n.text(mapOf("working" to "正在处理…", "completed" to "已完成", "failed" to "失败", "cancelled" to "已取消").getValue(state))
    private fun diagnostics() {
        ui.button(MoteI18n.text("诊断设置")) { instanceSettingOwnership(MoteI18n.text("诊断设置")) { diagnostics() } }
        read("/api/diagnostics")
        ui.button(MoteI18n.text("查看日志")) { read("/api/diagnostics/log-pages?page=1&pageSize=100") }
        ui.button(MoteI18n.text("导出支持包")) { ui.saveCentral("/api/support-bundle", "mote-central-support.json", "application/json") }
        softwareUpdate()
    }
    private fun softwareUpdate() {
        val target = ui.card(); read("/api/software-update", target)
        ui.button(MoteI18n.text("检查更新")) { action("/api/software-update/check") { target.removeAllViews(); values(it, target) } }
    }
    private fun agent(path: String = "/context") {
        body.removeAllViews(); screens.setBack { screens.refresh() }
        listOf("/context", "/context/memory", "/context/episodes", "/context/sources").forEach { folder ->
            ui.button(folder) { agent(folder) }
        }
        library.paged("/api/agent-view/catalog?path=" + enc(path) + "&limit=12", ui.card()) { row, card ->
            ui.text(row.optString("title", row.optString("path", row.optString("id"))), NativeFontRole.ROW, card); ui.text(row.optString("preview"), parent = card)
            ui.button(MoteI18n.text("展开"), parent = card) {
                if (row.has("path")) agent(row.getString("path"))
                else if (row.optString("expand") == "source_items") {
                    library.paged("/api/agent-view/source-items?sourceId=" + enc(row.getString("id")) + "&limit=12", card) { item, child ->
                        ui.text(item.optString("title", item.optString("windowTitle")), parent = child)
                        ui.button(MoteI18n.text("查看原文"), parent = child) { library.queryEvidence(item.optString("ref").takeIf(String::isNotBlank) ?: "capture:" + item.getString("id")) }
                    }
                } else agentDetail(row, path)
            }
        }
        ui.button(MoteI18n.text("详细记录设置")) { ownedConfiguration(MoteI18n.text("详细记录设置"), "agentTrace", { agent(path) }, { agent(path) }) }
        ui.button(MoteI18n.text("实际读取记录")) { agentTraceHistory() }
        val question = ui.field(MoteI18n.text("你的问题"), multiline = true)
        ui.button(MoteI18n.text("首次上下文"), true) { action("/api/agent-view/startup", JSONObject().put("question", question.text.toString()).put("timeZone", ZoneId.systemDefault().id)) { values(it, ui.card()) } }
    }
    private fun agentTraceHistory(runId: String? = null) {
        val api = client
        ui.work(MoteI18n.text("正在读取…"), { api.get("/api/agent-view/runs") }) { runs ->
            body.removeAllViews(); screens.setBack { agent() }
            ui.text(MoteI18n.text("实际读取记录"), NativeFontRole.TITLE_MOBILE)
            ui.text(MoteI18n.text("仅显示实际保留的记录；关闭详细记录不会重建缺失内容，截断记录不代表完整读取。"))
            values(runs.getJSONObject("recording"), ui.card())
            if (runId != null) ui.button(MoteI18n.text("全部")) { agentTraceHistory() }
            val items = runs.getJSONArray("items")
            for (index in 0 until items.length()) {
                val run = items.getJSONObject(index); val id = UUID.fromString(run.getString("runId")).toString()
                ui.button(run.getString("at") + " · " + id) { agentTraceHistory(id) }
            }
            val path = "/api/agent-view/events?limit=12" + (runId?.let { "&runId=" + enc(it) } ?: "")
            library.paged(path, ui.card()) { event, card -> values(event, card) }
        }
    }
    private fun agentDetail(row: JSONObject, path: String, offset: Int = 0) {
        val kind = row.optString("expand")
        if (kind == "material_read") {
            val api = client
            ui.work(MoteI18n.text("正在读取…"), { api.get("/api/agent-view/material-read?ref=" + enc(row.getString("ref")) + "&offset=$offset&length=4000") }) { result ->
                body.removeAllViews(); screens.setBack { agent(path) }
                ui.text(result.getJSONObject("material").getString("title"), NativeFontRole.SECTION); ui.text(result.getString("text"))
                val originals = result.getJSONArray("originalRefs")
                for (index in 0 until originals.length()) ui.button(MoteI18n.text("查看原文依据") + " " + (index + 1)) { library.queryEvidence(originals.getString(index)) }
                val range = result.getJSONObject("textRange")
                if (!range.isNull("nextOffset")) ui.button(MoteI18n.text("继续展开")) { agentDetail(row, path, range.getInt("nextOffset")) }
            }
            return
        }
        if (kind !in setOf("memories", "segments")) { library.queryEvidence(row.optString("ref").takeIf(String::isNotBlank) ?: row.getString("id"), offset); return }
        val endpoint = when (kind) { "memories" -> "memories"; "segments" -> "segments"; else -> "evidence" }
        val id = if (kind == "segments") row.getString("ref") else row.optString("id", row.optString("ref"))
        val extra = if (kind == "memories") "&includeEvidence=true" else if (endpoint == "evidence") "&offset=$offset" else ""
        val api = client
        ui.work(MoteI18n.text("正在读取…"), { api.get("/api/agent-view/$endpoint?id=" + enc(id) + extra) }) { result ->
            body.removeAllViews(); screens.setBack { agent(path) }; values(result, ui.card())
            result.optJSONArray("evidence")?.let { rows -> for (index in 0 until rows.length()) ui.button(MoteI18n.text("查看原文依据") + " " + (index + 1)) { library.queryEvidence(rows.getJSONObject(index).getString("id")) } }
            val items = result.optJSONArray("items") ?: JSONArray()
            for (i in 0 until items.length()) {
                val item = items.getJSONObject(i)
                val evidence = item.optJSONArray("evidence") ?: JSONArray()
                for (j in 0 until evidence.length()) ui.button(MoteI18n.text("查看原文依据")) { library.queryEvidence(evidence.getJSONObject(j).getString("id")) }
                val members = item.optJSONArray("members") ?: JSONArray()
                for (j in 0 until members.length()) ui.button(MoteI18n.text("查看原文依据") + " " + (j + 1)) { library.queryEvidence(members.getString(j)) }
                item.optJSONObject("textRange")?.let { range ->
                    if (!range.isNull("nextOffset")) ui.button(MoteI18n.text("下一页")) { agentDetail(row, path, range.getInt("nextOffset")) }
                }
            }
        }
    }
    fun connectors() {
        body.removeAllViews(); screens.setBack { screens.refresh() }
        connectorPage?.close(); recordingPage?.close(); recordingPage = null
        connectorPage = CentralConnectors(screens, { value, target -> values(value, target) }) { provider -> if (provider == "lark") ui.navigate("lark") else recordings() }.also { it.show() }
        ui.button(MoteI18n.text("录音归档")) { recordings() }
        read("/api/connectors")
        ui.button(MoteI18n.text("飞书")) { ui.navigate("lark") }
        CentralMcp(screens).show()
    }
    private fun lark() {
        larkHandler.removeCallbacks(larkPoll)
        val selected = larkConnection
        if (selected == null) {
            val api = client
            ui.work(MoteI18n.text("正在读取…"), { api.get("/api/connectors").getJSONArray("connections") }) { rows ->
                larkChoices = (0 until rows.length()).map(rows::getJSONObject).filter { it.getString("provider") == "lark" }
                body.removeAllViews()
                if (larkChoices.isEmpty()) {
                    ui.text(MoteI18n.text("暂无记录")); ui.button(MoteI18n.text("来源与外部应用")) { connectors() }
                } else { selectLark(larkChoices.first()); lark() }
            }
            return
        }
        val api = selected
        ui.work(MoteI18n.text("正在读取…"), { api.get("/api/connectors/lark") to api.get("/api/sources") }) { (value, sourceList) ->
            if (larkConnection !== api) return@work
            body.removeAllViews(); screens.setBack { screens.refresh() }
            if (larkCalendarMode && !api.polling && api.calendars != null) {
                larkCalendarSelection(api, value.getJSONObject("selection"), api.calendars!!)
                return@work
            }
            body.addView(Spinner(ui).apply {
                contentDescription = MoteI18n.text("连接 ID")
                adapter = ArrayAdapter(ui, android.R.layout.simple_spinner_dropdown_item, larkChoices.map { it.getString("id") })
                setSelection(larkChoices.indexOfFirst { it.getString("id") == api.id })
                onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
                    override fun onNothingSelected(parent: android.widget.AdapterView<*>?) {}
                    override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                        val next = larkChoices[position]; if (larkConnection === api && next.getString("id") != api.id) { selectLark(next); lark() }
                    }
                }
            })
            ui.button(MoteI18n.text("刷新")) { lark() }
            ui.text(MoteI18n.text("飞书文档与日历"), DesignTokens.fontTitleMobile.toFloat())
            ui.text(MoteI18n.text("照常在飞书写日记、会议纪要和方案。中央节点归档文档与活动线索，供回顾、问答和 Memory 使用。"))
            ui.text(MoteI18n.text("打开、编辑等线索单独保存；打开不代表读完、认同或当时看到的版本。"))
            val account = ui.card()
            if (api.uncertain) {
                ui.text(MoteI18n.text("请求结果尚未确认，请重试同一请求。"), parent = account)
                ui.button(MoteI18n.text("重试"), parent = account) { ui.work(MoteI18n.text("正在处理…"), { api.retry() }) { if (larkConnection === api) { if (api.disconnected) larkConnection = null; lark() } } }
                ui.button(MoteI18n.text("清除本机待确认请求"), parent = account) {
                    if (larkConnection === api && screens.ownsSelectedAccount()) screens.confirm(MoteI18n.text("清除本机待确认请求"), MoteI18n.text("这只清除本机待确认请求，已在中央接收的任务仍会继续。")) {
                        ui.work(MoteI18n.text("正在保存…"), { api.clearPending() }) { if (larkConnection === api) lark() }
                    }
                }
            }
            ui.text(if (value.optBoolean("connected")) MoteI18n.text("已连接") else MoteI18n.text("尚未授权"), DesignTokens.fontSection.toFloat(), account)
            if (value.optString("accountName").isNotBlank()) ui.text(value.optString("accountName"), parent = account)
            if (value.optBoolean("installed")) ui.text("Lark CLI " + value.optString("version"), parent = account)
            ui.button(MoteI18n.text("安装 CLI") + " · " + MoteI18n.text("暂不可用"), parent = account) {}.isEnabled = false
            listOf("check" to "检查状态", "setup" to "开始配置", "login" to "扫码登录并授权只读权限").forEach { (command, label) ->
                ui.button(MoteI18n.text(label), parent = account) { larkAction(api, command) }
            }
            ui.button(MoteI18n.text("配置应用凭据"), parent = account) {
                if (larkConnection !== api) return@button
                body.removeAllViews(); screens.setBack { lark() }
                val collect = form(JSONObject().put("appId", "").put("secret", "").put("brand", "feishu"), ui.card())
                ui.button(MoteI18n.text("保存设置"), true) { larkAction(api, "configure", collect()) }
            }
            value.optJSONObject("job")?.let { job ->
                ui.text(if (job.optString("state") == "completed") MoteI18n.text("已完成") else stateLabel(job.optString("state")), parent = account)
                if (job.optString("error").isNotBlank()) ui.text(CentralLarkSelection.failure(job.getString("error")), parent = account)
                if (job.optString("state") in listOf("waiting", "running")) ui.button(MoteI18n.text("取消当前操作"), parent = account) { larkAction(api, "cancel") }
                job.optString("authorizationUrl").takeIf(String::isNotBlank)?.let { url ->
                    val parsed = Uri.parse(url); val host = parsed.host.orEmpty()
                    if (parsed.scheme == "https" && parsed.userInfo == null && parsed.port == -1 &&
                        listOf("feishu.cn", "larksuite.com", "larkoffice.com").any { host == it || host.endsWith(".$it") })
                        ui.button(MoteI18n.text("打开授权页面"), parent = account) { if (larkConnection === api && screens.ownsSelectedAccount()) ui.startActivity(Intent(Intent.ACTION_VIEW, parsed)) }
                }
            }
            ui.button(MoteI18n.text("查看授权进度"), parent = account) { lark() }
            val selection = value.optJSONObject("selection") ?: JSONObject()
            val selected = CentralLarkSelection.discovery(selection)
            val range = ui.card()
            ui.text(MoteI18n.text("选择同步范围"), DesignTokens.fontSection.toFloat(), range)
            ui.text(MoteI18n.text("首次回溯 {0} 天；之后随你的新活动归档。指定文档、文件夹和知识库分支持续跟踪。", selected.optInt("firstSyncDays", 30)), parent = range)
            ui.button(MoteI18n.text("选择文档与活动范围"), parent = range) { larkSelection() }
            ui.text(MoteI18n.text("需要日历时，先单独授权日历读取，再加载并选择日历。授权本身不会开始收集日程。"), parent = range)
            ui.button(MoteI18n.text("授权日历读取"), parent = range) { larkAction(api, "login", JSONObject().put("calendar", true)) }
            ui.button(MoteI18n.text("选择日历"), parent = range) { calendarSelection(true) }
            ui.button(MoteI18n.text("飞书文档默认组合"), parent = range) { recipeSettings(false, "lark-docs") }
            ui.text(MoteI18n.text("中央节点每 {0} 分钟检查；关闭页面后继续运行。", value.optInt("syncIntervalSeconds", 900) / 60), parent = range)
            val sync = value.optJSONObject("documentSync")
            val sourceId = sync?.optString("sourceId")?.takeIf(String::isNotBlank)
            val sourceRows = sourceList.optJSONArray("items") ?: JSONArray()
            val source = (0 until sourceRows.length()).map { sourceRows.getJSONObject(it) }.firstOrNull { it.optString("id") == sourceId }
            val paused = source?.optBoolean("enabled") == false
            if (sourceId != null && source != null) {
                ui.button(MoteI18n.text(if (paused) "恢复接入" else "暂停接入")) {
                    ui.work(MoteI18n.text("正在保存…"), { api.patch("/api/sources/" + enc(sourceId), JSONObject().put("enabled", paused)) }) { lark() }
                }
                ui.button(MoteI18n.text("资料说明（选填）")) { larkSourceDescription(api, sourceId) }
            }
            if (paused) ui.text(MoteI18n.text("此文档来源已暂停；保存范围或重新授权不会恢复接入。"))
            ui.button(MoteI18n.text("预览文档范围")) { larkAction(api, "preview") }
            sync?.optJSONArray("preview")?.let { preview ->
                val card = ui.card(); ui.text(MoteI18n.text("实际发现的文档"), DesignTokens.fontSection.toFloat(), card)
                ui.text(MoteI18n.text("下列为可用文档标题与引用，尚未因预览读取正文。归档时保存当前版本及可获得的活动线索。"), parent = card)
                ui.text(MoteI18n.text("发现 {0} 篇文档，以下显示 {1} 篇。", sync.optInt("previewTotal", preview.length()), preview.length()), parent = card)
                for (i in 0 until preview.length()) { val document = preview.getJSONObject(i); ui.text(document.optString("title", document.optString("reference")), parent = card) }
                if (preview.length() == 0) ui.text(MoteI18n.text("本次范围内没有发现文档。"), parent = card)
                ui.text(MoteI18n.text("预览最多显示 50 篇；同步会分页处理全部选定范围。"), parent = card)
            }
            if (!paused && (sync?.optBoolean("confirmed") == true || sync?.has("preview") == true || sync == null && (selection.optJSONArray("calendarIds")?.length() ?: 0) > 0))
                ui.button(if (sync != null && !sync.optBoolean("confirmed")) MoteI18n.text("确认并开始归档") else MoteI18n.text("立即同步"), true) { larkAction(api, "sync") }
            sync?.let {
                ui.text(MoteI18n.text("已归档 {0} 篇文档 · {1} 条活动线索 · {2} 项待处理 · {3} 项失败", it.optInt("documents"), it.optInt("activities"), it.optInt("pending"), it.optInt("failed")))
                val failures = it.optJSONArray("errors") ?: JSONArray()
                for (i in 0 until failures.length()) {
                    val failure = failures.getJSONObject(i); val card = ui.card()
                    ui.text(failure.optString("reference"), parent = card)
                    val archiveRequired = failure.optString("code") == "lark_document_archive_required"
                    ui.text(CentralLarkSelection.failure(failure.optString("code")), parent = card)
                    if (!paused) ui.button(MoteI18n.text(if (archiveRequired) "为此来源保留完整正文并重试" else "重试此文档"), parent = card) {
                        if (archiveRequired && sourceId != null) ui.work(MoteI18n.text("正在处理…"), {
                            api.patch("/api/sources/" + enc(sourceId), JSONObject().put("retention", "archive"))
                            api.post("/api/connectors/lark/sync", JSONObject().put("document", failure.getString("reference")))
                        }) { lark() }
                        else larkAction(api, "sync", JSONObject().put("document", failure.getString("reference")))
                    }
                }
            }
            ui.text(MoteI18n.text("同步归档完成后，Memory 会按现有设置继续处理；并非每篇文档都会生成精选记忆。"))
            ui.button(MoteI18n.text("查看来源与归档")) { ui.navigate("sources") }
            ui.button(MoteI18n.text("断开连接")) { screens.confirm(MoteI18n.text("断开连接"), MoteI18n.text("断开会停止读取并暂停这些来源，保留已归档资料。飞书端授权及 CLI 凭据仍保留，可在飞书中单独撤销。")) {
                ui.work(MoteI18n.text("正在处理…"), { runCatching { api.delete("/api/connectors/lark") } }) { outcome ->
                    if (larkConnection === api) { larkConnection = null; outcome.exceptionOrNull()?.let(ui::requestFailure); lark() }
                }
            } }
            if (api.polling) larkHandler.postDelayed(larkPoll, 500)
        }
    }
    private fun selectLark(row: JSONObject) {
        larkHandler.removeCallbacks(larkPoll)
        larkCalendarMode = false
        lateinit var next: CentralLarkConnection
        next = CentralLarkConnection(screens, row.getString("id"), row.getLong("generation")) { larkConnection === next }
        larkConnection = next
    }
    private fun larkAction(api: CentralLarkConnection, command: String, payload: JSONObject = JSONObject()) {
        if (larkConnection !== api || !screens.ownsSelectedAccount()) return
        ui.work(MoteI18n.text("正在处理…"), { runCatching { api.post("/api/connectors/lark/" + command, payload) } }) { result ->
            if (larkConnection === api) { result.exceptionOrNull()?.let { ui.requestFailure(it) }; lark() }
        }
    }
    private fun larkSourceDescription(api: CentralLarkConnection, sourceId: String) {
        val path = "/api/sources/" + enc(sourceId) + "/context"
        ui.work(MoteI18n.text("正在读取资料说明…"), { api.get(path) }) { current ->
            body.removeAllViews(); screens.setBack { lark() }
            ui.text(MoteI18n.text("资料说明（选填）"), DesignTokens.fontTitleMobile.toFloat())
            val description = ui.field(MoteI18n.text("可说明格式、时间、作者，以及哪些内容属于你。"), current.optString("description"), multiline = true)
            ui.text(MoteI18n.text("用于理解这个来源的背景、作者和内容归属。"))
            ui.text(MoteI18n.text("修改说明适用于已有和未来资料；不会自动重新转写或重算历史记忆。"))
            ui.button(MoteI18n.text("保存说明"), true) {
                val payload = JSONObject().put("expectedVersion", current.getInt("version")).put("description", description.text.toString())
                ui.work(MoteI18n.text("正在保存…"), { api.patch(path, payload) }) { lark() }
            }
        }
    }
    private fun larkSelection() {
        val api = requireNotNull(larkConnection)
        ui.work(MoteI18n.text("正在读取…"), { api.get("/api/connectors/lark").getJSONObject("selection") }) { current ->
            body.removeAllViews(); screens.setBack { lark() }
            ui.text(MoteI18n.text("选择文档与活动范围"), DesignTokens.fontTitleMobile.toFloat())
            val card = ui.card(); val discovery = CentralLarkSelection.discovery(current)
            ui.text(MoteI18n.text("自动发现我的文档活动"), DesignTokens.fontSection.toFloat(), card)
            fun choice(label: String, checked: Boolean) = CheckBox(ui).apply { text = MoteI18n.text(label); isChecked = checked }.also { card.addView(it) }
            val created = choice("我创建的", discovery.optBoolean("created")); val edited = choice("我编辑过的", discovery.optBoolean("edited")); val opened = choice("我打开过的", discovery.optBoolean("opened"))
            ui.text(MoteI18n.text("活动来自飞书可提供的最近记录，可能只有时间范围；不保证逐次操作日志或阅读时长。"), parent = card)
            val days = ui.field(MoteI18n.text("首次回溯天数"), discovery.optInt("firstSyncDays", 30).toString(), parent = card).apply { inputType = InputType.TYPE_CLASS_NUMBER }
            ui.text(MoteI18n.text("明确选定的范围会持续检查当前版本，包括其他协作者的后续修改。每行填写一个链接或 token。"), parent = card)
            val documents = ui.field(MoteI18n.text("指定文档（每行一个）"), CentralLarkSelection.text(current, "documents"), multiline = true, parent = card)
            val folders = ui.field(MoteI18n.text("文件夹（每行一个）"), CentralLarkSelection.text(current, "folders"), multiline = true, parent = card)
            val wikiRoots = ui.field(MoteI18n.text("知识库分支（每行一个）"), CentralLarkSelection.text(current, "wikiRoots"), multiline = true, parent = card)
            val exclusions = ui.field(MoteI18n.text("不再读取的文档（每行一个）"), CentralLarkSelection.text(current, "excludedDocuments"), multiline = true, parent = card)
            ui.text(MoteI18n.text("排除优先于自动发现和指定范围；已有归档保留。"), parent = card)
            val autoSync = choice("在后台定期同步选中内容", current.optBoolean("autoSync"))
            ui.text(MoteI18n.text("保存范围或重新授权不会恢复已暂停的来源。停止同步和移除范围会保留已有归档。"), parent = card)
            ui.button(MoteI18n.text("保存同步范围"), true) {
                val selections = Triple(created.isChecked, edited.isChecked, opened.isChecked)
                val firstSyncDays = days.text.toString(); val documentText = documents.text.toString(); val folderText = folders.text.toString()
                val wikiText = wikiRoots.text.toString(); val exclusionText = exclusions.text.toString(); val background = autoSync.isChecked
                ui.work(MoteI18n.text("正在保存…"), {
                    api.put("/api/connectors/lark/selection", CentralLarkSelection.payload(current, selections.first, selections.second, selections.third,
                        firstSyncDays, documentText, folderText, wikiText, exclusionText, background))
                }) { lark() }
            }
        }
    }
    private fun calendarSelection(lark: Boolean) {
        if (lark) { val api = requireNotNull(larkConnection); larkCalendarMode = true; larkAction(api, "calendars"); return }
        val api = client; val path = if (lark) "/api/connectors/lark" else "/api/connectors/google"
        ui.work(MoteI18n.text("正在读取…"), {
            api.get(path + "/calendars") to if (lark) api.get(path).getJSONObject("selection") else JSONObject()
        }) { (result, current) ->
            body.removeAllViews(); screens.setBack { screens.refresh() }
            val calendars = result.getJSONArray("calendars"); val selected = current.optJSONArray("calendarIds") ?: JSONArray()
            val ids = (0 until selected.length()).map { selected.getString(it) }.toSet()
            val fields = mutableListOf<Pair<CheckBox, String>>()
            for (i in 0 until calendars.length()) {
                val item = calendars.getJSONObject(i); val id = item.getString("id")
                val check = CheckBox(ui).apply { text = item.optString("name", item.optString("summary", item.optString("title", id))); isChecked = if (lark) id in ids else item.optBoolean("selected") }
                fields.add(check to id); body.addView(check)
            }
            val collect = if (lark) form(pick(current, "pastDays", "futureDays", "timeZone"), ui.card()) else ({ JSONObject() })
            ui.button(MoteI18n.text("保存设置"), true) {
                val edited = collect(); val payload = JSONObject(current.toString())
                edited.keys().forEach { payload.put(it, edited.get(it)) }
                payload.put("calendarIds", JSONArray(fields.filter { it.first.isChecked }.map { it.second }))
                ui.work(MoteI18n.text("正在保存…"), { api.put(path + if (lark) "/selection" else "/calendars", payload) }) { screens.refresh() }
            }
        }
    }
    private fun larkCalendarSelection(api: CentralLarkConnection, current: JSONObject, calendars: JSONArray) {
        screens.setBack { larkCalendarMode = false; lark() }
        val selected = current.getJSONArray("calendarIds"); val ids = (0 until selected.length()).map(selected::getString).toSet()
        val fields = (0 until calendars.length()).map { index ->
            val item = calendars.getJSONObject(index); val id = item.getString("id")
            CheckBox(ui).apply { text = item.getString("name"); isChecked = id in ids; body.addView(this) } to id
        }
        val collect = form(pick(current, "pastDays", "futureDays", "timeZone"), ui.card())
        ui.button(MoteI18n.text("保存设置"), true) {
            if (larkConnection !== api || !screens.ownsSelectedAccount()) return@button
            val payload = JSONObject(current.toString()); val edited = collect()
            edited.keys().forEach { payload.put(it, edited.get(it)) }; payload.put("calendarIds", JSONArray(fields.filter { it.first.isChecked }.map { it.second }))
            larkCalendarMode = false; larkAction(api, "select", payload)
        }
    }
    private fun recordingSteps(path: String, cursors: List<Long?> = listOf(null)) {
        body.removeAllViews(); screens.setBack { recordings() }
        ui.text(MoteI18n.text("同步步骤与状态"), NativeFontRole.TITLE_MOBILE)
        val target = ui.card(); val api = client
        ui.work(MoteI18n.text("正在读取…"), { api.get(path + "/steps?limit=20" + (cursors.last()?.let { "&cursor=$it" } ?: "")) }) { page ->
            val items = page.optJSONArray("items") ?: JSONArray()
            for (i in 0 until items.length()) {
                val step = items.getJSONObject(i)
                ui.disclosure(step.optString("title") + " · " + stateLabel(step.optString("state")), target) { child ->
                    values(step, child)
                    if (step.optString("state") == "failed") ui.text(MoteI18n.text("自动重试已停止，请核对原因后手动重试"), parent = child)
                }
            }
            pageButtons(cursors, page, items.length(), target) { recordingSteps(path, it) }
        }
    }
    private fun recordings() {
        body.removeAllViews(); screens.setBack { screens.refresh() }
        connectorPage?.close(); connectorPage = null
        recordingPage?.close(); recordingPage = CentralRecordings(screens).also { it.show() }
    }
    private fun imports() {
        val api = client
        ui.text(MoteI18n.text("个人归档只能合并回原实例的原账号，不恢复登录授权或后台任务。"))
        ui.button(MoteI18n.text("导入个人归档"), true) { ui.pickPortableImport() }
        val pending = ui.card()
        ui.work(MoteI18n.text("正在读取…"), { screens.pendingPortableImport() }) { saved ->
            if (saved.has("manifest")) {
                ui.text(saved.getJSONObject("manifest").getString("name"), parent = pending)
                ui.button(MoteI18n.text("重试同一请求"), parent = pending) { ui.work(MoteI18n.text("正在导入文件…"), { screens.retryPortableImport(api) }) { portableImportDetail(it.getString("id")) } }
                ui.button(MoteI18n.text("放弃待导入文件"), parent = pending) { screens.confirm(MoteI18n.text("放弃待导入文件"), MoteI18n.text("这只清除本机待确认请求，已在中央接收的任务仍会继续。")) {
                    ui.work(MoteI18n.text("正在处理…"), { screens.discardPortableImport() }) { screens.refresh() }
                } }
            }
        }
        portableImportHistory(ui.card())
        val instruction = ui.field(MoteI18n.text("导入要求（可选）"), screens.importInstruction, multiline = true)
        ui.button(MoteI18n.text("选择文件导入")) { screens.importInstruction = instruction.text.toString(); ui.pickImport() }
        screens.importPending(ui.card())
        library.paged("/api/imports", ui.card()) { row, card ->
            ui.text(row.optString("name") + " · " + row.optString("status"), NativeFontRole.ROW, card)
            ui.button(MoteI18n.text("查看预览"), parent = card) { importDetail(row.getString("id")) }
        }
        read("/api/import-capabilities")
    }
    private fun portableImportHistory(target: LinearLayout, cursor: String? = null, previous: List<String?> = emptyList()) {
        val portable = CentralPortable(client)
        ui.work(MoteI18n.text("正在读取…"), { portable.listImports(cursor) }) { result ->
            target.removeAllViews(); val items = result.getJSONArray("items")
            for (index in 0 until items.length()) {
                val row = items.getJSONObject(index); val card = ui.card(target)
                ui.text(row.getString("createdAt") + " · " + portableState(row.getString("state")), parent = card)
                ui.button(MoteI18n.text("查看详情"), parent = card) { portableImportDetail(row.getString("id")) }
            }
            if (previous.isNotEmpty()) ui.button(MoteI18n.text("上一页"), parent = target) { portableImportHistory(target, previous.last(), previous.dropLast(1)) }
            if (!result.isNull("nextCursor")) ui.button(MoteI18n.text("下一页"), parent = target) { portableImportHistory(target, result.getString("nextCursor"), previous + cursor) }
        }
    }
    fun portableImportDetail(id: String) {
        body.removeAllViews(); screens.setBack { screens.refresh() }
        val api = client; val portable = CentralPortable(api)
        ui.button(MoteI18n.text("刷新")) { portableImportDetail(id) }
        ui.work(MoteI18n.text("正在读取…"), {
            val receipt = portable.readImport(id); val pending = screens.pendingPortableImport()
            if (receipt.getString("state") == "completed" && pending.optString("requestId") == id) screens.discardPortableImport()
            receipt to pending
        }) { (receipt, pending) ->
            ui.text(portableState(receipt.getString("state")), NativeFontRole.SECTION)
            ui.disclosure(MoteI18n.text("元数据")) { values(receipt, it) }
            if (receipt.getString("state") == "failed") {
                if (pending.optString("requestId") == id) ui.button(MoteI18n.text("重试同一请求")) {
                    ui.work(MoteI18n.text("正在导入文件…"), { screens.retryPortableImport(api) }) { portableImportDetail(id) }
                } else ui.button(MoteI18n.text("重新选择同一归档重试")) { ui.pickPortableImport(id) }
            }
            if (receipt.getString("state") in setOf("working", "failed")) ui.button(MoteI18n.text("取消")) {
                ui.work(MoteI18n.text("正在处理…"), { portable.cancelImport(id) }) { portableImportDetail(id) }
            }
        }
    }
    fun importDetail(id: String) {
        body.removeAllViews(); screens.setBack { screens.refresh() }
        val api = client
        ui.work(MoteI18n.text("正在读取…"), { api.get("/api/imports/" + enc(id)) }) { row ->
            values(row, ui.card())
            row.optJSONObject("memoryProgress")?.let { progress ->
                val card = ui.card()
                ui.text(MoteI18n.text("自动记忆进度"), NativeFontRole.ROW, card)
                ui.text(MoteI18n.text("按本次新记录接收时选中的配方处理；进度按记录汇总。"), parent = card)
                ui.text(MoteI18n.text("完成 {0} / {1} · 处理中 {2} · 等待内容或名额 {3}", progress.optInt("completed"), progress.optInt("total"), progress.optInt("running"), progress.optInt("pending")), parent = card)
                ui.text(MoteI18n.text("失败 {0} · 等待模型 {1} · 暂停 {2} · 已取消 {3} · 未启用 {4} · 输入已变更或不可用 {5}", progress.optInt("failed"), progress.optInt("waitingForModel"), progress.optInt("paused"), progress.optInt("cancelled"), progress.optInt("disabled"), progress.optInt("unavailable")), parent = card)
            }
            val commands = when (row.optString("status")) {
                "awaiting_confirmation" -> listOf("confirm" to "确认导入", "prepare" to "重新解析", "cancel" to "取消")
                "failed", "cancelled" -> listOf("retry" to "重试")
                "completed" -> emptyList()
                else -> listOf("cancel" to "取消")
            }
            commands.forEach { (command, label) -> ui.button(MoteI18n.text(label)) {
                if (command == "confirm") screens.confirm(MoteI18n.text("确认导入"), MoteI18n.text("请核对预览后再确认。")) { action("/api/imports/" + enc(id) + "/confirm") { importDetail(id) } }
                else action("/api/imports/" + enc(id) + "/" + command) { importDetail(id) }
            } }
            ui.button(MoteI18n.text("刷新")) { importDetail(id) }
        }
    }
    private fun label(key: String): String = MoteI18n.text(labels[key] ?: key)
    companion object {
        private object KeepValue
        private val secrets = setOf("apiKey", "token", "secret", "clientSecret", "localWorkerApiKey")
        private val enums = mapOf("protocol" to listOf("deepseek", "openai-completions", "openai-responses", "anthropic-messages", "google-generative-ai", "codex-app-server"),
            "reasoningEffort" to listOf("auto", "off", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"),
            "serviceTier" to listOf("default", "fast"),
            "level" to listOf("debug", "info", "warn", "error", "silent"), "access" to listOf("read", "write"), "brand" to listOf("feishu", "lark"))
        fun pick(value: JSONObject, vararg keys: String) = JSONObject().apply { keys.forEach { key -> if (value.has(key)) put(key, value.get(key)) } }
        private val labels = mapOf(
            "captures" to "原始采集记录", "materials" to "正式资料", "sources" to "来源与连接",
            "automatic" to "自动处理", "understandingEnabled" to "内容理解", "summarize" to "生成摘要", "semanticTurns" to "语义分段",
            "audioProcessor" to "转写处理器", "diarizationProcessor" to "说话人分离处理器", "speakerCount" to "说话人数",
            "speakerMin" to "说话人数下限", "speakerMax" to "说话人数上限", "maxAudioMinutes" to "最长录音时长（分钟）", "timeoutMs" to "处理超时（毫秒）",
            "chat" to "问一问", "memory" to "记忆", "insight" to "洞察", "import" to "导入", "file" to "文件", "ocr" to "文字识别", "asr" to "转写", "title" to "标题", "name" to "名称", "includeCredentials" to "包含凭据", "description" to "描述", "enabled" to "启用", "status" to "状态", "state" to "状态",
            "provider" to "服务商", "protocol" to "协议", "baseUrl" to "服务地址", "model" to "模型", "reasoningEffort" to "推理强度",
            "headers" to "自定义请求头", "extraBody" to "高级请求参数",
            "serviceTier" to "速度模式",
            "maxTokens" to "最大生成 token", "apiKey" to "API Key（留空保留）", "modelRequestTimeoutMs" to "模型请求超时（毫秒）",
            "agentTimeoutMs" to "Agent 超时（毫秒）", "interactiveConcurrency" to "交互并发", "agentConcurrency" to "Agent 并发",
            "llmConcurrency" to "模型并发", "memoryConcurrency" to "记忆并发", "enabled" to "启用", "debug" to "调试日志",
            "traceEnabled" to "记录 Agent 读取", "level" to "日志级别",
            "deviceId" to "设备 ID", "deviceName" to "设备名称", "platform" to "平台", "serverUrl" to "节点地址", "label" to "名称", "sourceIds" to "来源范围"
        )
    }
}
