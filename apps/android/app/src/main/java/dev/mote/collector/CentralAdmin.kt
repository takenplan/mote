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
        return tasks.keys().asSequence().filter { it == "correct" || it.startsWith("publish") }.flatMap { stage ->
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
    private val larkHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private val larkPoll = Runnable { lark() }
    fun close() { plugins.close(); connectorPage?.close(); recordingPage?.close(); larkHandler.removeCallbacks(larkPoll) }
    fun clearPrivateState() { plugins.clearPrivateState(); connectorPage?.close(); connectorPage = null; recordingPage?.close(); recordingPage = null; larkHandler.removeCallbacks(larkPoll); larkConnection = null; larkChoices = emptyList(); larkCalendarMode = false }
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
                    val choices = enums[key]
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
        ui.button(MoteI18n.text("记忆设置")) { memorySettings() }
        ui.button(MoteI18n.text("来源与外部应用")) { connectors() }
        val api = client
        ui.work(MoteI18n.text("正在读取…"), { api.get("/api/configuration") }) { configuration ->
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
    private fun models(): Unit = ownedConfiguration(MoteI18n.text("模型配置"), "models", { screens.refresh() }, { models() })
    fun fileSettings() {
        val api = client
        ui.work(MoteI18n.text("正在读取…"), { api.get("/api/file-processing") }) { value ->
            val payload = JSONObject().put("revision", value.getString("revision"))
                .put("settings", JSONObject(value.getJSONObject("settings").toString()))
            if (value.getBoolean("policyConfigured")) payload.put("policy", JSONObject(value.getJSONObject("policy").toString()))
            edit(MoteI18n.text("处理设置"), "/api/file-processing", payload)
        }
    }
    private fun ownedConfiguration(title: String, domainId: String, back: () -> Unit = { memorySettings() }, done: () -> Unit = back) {
        val api = client
        ui.work(MoteI18n.text("正在读取…"), { api.get("/api/configuration") }) { view ->
            val domains = view.getJSONArray("domains")
            val value = (0 until domains.length()).map { domains.getJSONObject(it) }.single { it.getString("id") == domainId }.getJSONObject("saved")
            body.removeAllViews(); screens.setBack(back); ui.text(title, NativeFontRole.TITLE_MOBILE)
            if (domainId == "agentTrace") ui.text(MoteI18n.text("详细记录可能包含问题、上下文、模型输出和工具内容，仅对当前账号生效。关闭后停止新增详细内容，已保留记录不会自动删除。"))
            if (domainId == "models") ui.text(MoteI18n.text("模型预设和默认选择保存在本人配置；复制带凭据、测试连接和模型目录尚待多用户接口。"))
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
        ui.button(MoteI18n.text("文字识别设置")) { configuration(MoteI18n.text("文字识别设置"), "/api/perception") { it.getJSONObject("settings") } }
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
    private fun vault(cursor: String? = null, previous: List<String?> = emptyList()) {
        val api = client; val exports = CentralPortable(api)
        val pending = ui.accountPreferences("central-portable")
        ui.text(MoteI18n.text("个人导出包含本账号的资料和已注册数据域，不包含登录凭据、执行授权或整实例备份。"))
        ui.button(MoteI18n.text("中央资料与附件导出"), true) {
            val id = pending.getString("operationId", null) ?: UUID.randomUUID().toString().also { check(pending.edit().putString("operationId", it).commit()) }
            ui.work(MoteI18n.text("正在导出中央资料…"), { try { exports.start(id).also { check(pending.edit().remove("operationId").commit()) } }
                catch (failure: CentralFailure) { if (failure.code == "archive_authorization_changed") check(pending.edit().remove("operationId").commit()); throw failure } }) { portableExport(it.getString("id")) }
        }
        ui.button(MoteI18n.text("中央元数据导出")) {}.isEnabled = false
        ui.text(MoteI18n.text("元数据单独导出的接口尚待接入；当前归档包含本账号的资料与可用原件。"))
        ui.button(MoteI18n.text("导入")) { ui.navigate("imports") }
        val target = ui.card()
        ui.work(MoteI18n.text("正在读取…"), { exports.list(cursor) }) { result ->
            val rows = result.getJSONArray("items")
            if (rows.length() == 0) ui.text(MoteI18n.text("暂无记录"), parent = target)
            for (i in 0 until rows.length()) {
                val row = rows.getJSONObject(i); val card = ui.card(target)
                ui.text(row.getString("createdAt") + " · " + portableState(row.getString("state")), parent = card)
                ui.button(MoteI18n.text("查看详情"), parent = card) { portableExport(row.getString("id")) }
            }
            if (previous.isNotEmpty()) ui.button(MoteI18n.text("上一页"), parent = target) { body.removeAllViews(); vault(previous.last(), previous.dropLast(1)) }
            if (!result.isNull("nextCursor")) ui.button(MoteI18n.text("下一页"), parent = target) { body.removeAllViews(); vault(result.getString("nextCursor"), previous + cursor) }
        }
    }
    private fun portableState(state: String) = MoteI18n.text(mapOf("working" to "正在处理…", "completed" to "已完成", "failed" to "失败", "cancelled" to "已取消").getValue(state))
    private fun portableExport(id: String) {
        body.removeAllViews(); screens.setBack { screens.refresh() }
        val exports = CentralPortable(client)
        ui.button(MoteI18n.text("刷新")) { portableExport(id) }
        ui.work(MoteI18n.text("正在读取…"), { exports.read(id) }) { receipt ->
            ui.text(portableState(receipt.getString("state")), NativeFontRole.SECTION)
            ui.text(receipt.getString("createdAt"))
            ui.disclosure(MoteI18n.text("元数据")) { values(receipt, it) }
            if (receipt.getString("state") == "completed") ui.button(MoteI18n.text("下载"), true) { ui.savePortable(receipt) }
            if (receipt.getString("state") == "failed") ui.button(MoteI18n.text("重试")) {
                ui.work(MoteI18n.text("正在处理…"), { exports.control(id, "retry") }) { portableExport(id) }
            }
            if (receipt.getString("state") != "cancelled") ui.button(MoteI18n.text("取消")) {
                screens.confirm(MoteI18n.text("取消"), MoteI18n.text("取消后将不能下载这份导出文件。")) { ui.work(MoteI18n.text("正在处理…"), { exports.control(id, "cancel") }) { portableExport(id) } }
            }
        }
    }
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
            "title" to "标题", "name" to "名称", "description" to "描述", "enabled" to "启用", "status" to "状态", "state" to "状态",
            "provider" to "服务商", "protocol" to "协议", "baseUrl" to "服务地址", "model" to "模型", "reasoningEffort" to "推理强度",
            "serviceTier" to "速度模式",
            "maxTokens" to "最大生成 token", "apiKey" to "API Key（留空保留）", "modelRequestTimeoutMs" to "模型请求超时（毫秒）",
            "agentTimeoutMs" to "Agent 超时（毫秒）", "interactiveConcurrency" to "交互并发", "agentConcurrency" to "Agent 并发",
            "llmConcurrency" to "模型并发", "memoryConcurrency" to "记忆并发", "enabled" to "启用", "debug" to "调试日志",
            "traceEnabled" to "记录 Agent 读取", "level" to "日志级别",
            "deviceId" to "设备 ID", "deviceName" to "设备名称", "platform" to "平台", "serverUrl" to "节点地址", "label" to "名称", "sourceIds" to "来源范围"
        )
    }
}
