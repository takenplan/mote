package dev.mote.collector

import android.content.Intent
import android.net.Uri
import android.widget.*
import android.os.Handler
import android.os.Looper
import org.json.JSONArray
import org.json.JSONObject

/** Native settings for saved, owner-bound M10 connections; M09 owns execution. */
internal class CentralConnectors(private val screens: CentralScreens, private val showValues: (JSONObject, LinearLayout) -> Unit, private val openProvider: (String) -> Unit) {
    private val ui = screens.ui
    private val api = screens.client
    private val navigation = ui.navigationRevision
    private val target = ui.card()
    private var render = 0L
    private val handler = Handler(Looper.getMainLooper())
    private val polls = mutableSetOf<Runnable>()
    fun close() { polls.forEach(handler::removeCallbacks); polls.clear() }
    fun resume() { if (current()) load() }
    private data class Snapshot(val inventory: JSONObject, val configuration: JSONObject, val plugins: JSONObject, val work: JSONObject)
    private fun current() = screens.ownsSelectedAccount() && ui.client === api && ui.navigationRevision == navigation
    private fun objects(rows: JSONArray) = (0 until rows.length()).map(rows::getJSONObject)
    private fun saved(view: JSONObject) = objects(view.getJSONArray("domains")).single { it.getString("id") == "connectorSettings" }.getJSONObject("saved").getJSONArray("connections").let(::objects)
    private fun path(id: String) = "/api/connectors/" + CentralScreens.encode(id)
    private fun load() {
        if (!current()) return
        close()
        ui.work(MoteI18n.text("正在读取…"), {
            Snapshot(api.get("/api/connectors"), api.get("/api/configuration"), api.get("/api/plugins"), screens.connectorWork())
        }) { (inventory, configuration, plugins, work) -> if (current()) list(inventory, configuration, plugins, work) }
    }
    fun show() = load()
    private fun list(inventory: JSONObject, configuration: JSONObject, plugins: JSONObject, work: JSONObject) {
        close(); val stamp = ++render; target.removeAllViews()
        val providers = objects(inventory.getJSONArray("providers")).map { it.getString("provider") }.filter { it in setOf("gmail", "google-calendar", "lark", "feishu-recordings", "dingtalk-recordings") }
        ui.button(MoteI18n.text("新建连接"), parent = target) { if (current() && stamp == render) edit(configuration, providers, null) }
        for (connection in saved(configuration).filter { it.getString("provider") in providers }) {
            val id = connection.getString("id"); val card = ui.card(target)
            ui.text(id + " · " + connection.getString("provider"), NativeFontRole.SECTION, card)
            val instance = objects(plugins.getJSONArray("instances")).singleOrNull { it.getString("id") == "connector." + id }
            ui.text(MoteI18n.text(if (instance?.optBoolean("desired") == true) "已启用" else "已暂停"), parent = card)
            fun active() = current() && stamp == render
            val generation = objects(inventory.getJSONArray("connections")).single { it.getString("id") == id }.getLong("generation")
            val resultPanel = ui.card(card)
            var taskVersion = 0L
            fun showTask(taskId: String, commandVersion: Long = ++taskVersion, admittedGeneration: Long = generation) {
                if (!active() || commandVersion != taskVersion) return
                require(Regex("[a-f0-9]{64}").matches(taskId))
                ui.work(MoteI18n.text("正在读取…"), { api.get("/api/tasks/" + taskId) }) { task ->
                    if (!active() || commandVersion != taskVersion) return@work
                    require(task.getString("id") == taskId)
                    resultPanel.removeAllViews(); ui.text(task.getString("state"), parent = resultPanel)
                    task.opt("error")?.takeIf { it != JSONObject.NULL }?.let { ui.text(it.toString(), parent = resultPanel) }
                    if (task.getString("state") in setOf("waiting", "running")) {
                        val poll = object : Runnable { override fun run() { polls.remove(this); if (active()) showTask(taskId, commandVersion, admittedGeneration) } }
                        polls.add(poll); handler.postDelayed(poll, 1000)
                    } else if (task.getString("state") == "succeeded" && admittedGeneration == generation) {
                        val result = task.optJSONObject("result")
                        if (result?.opt("calendars") is JSONArray) {
                            val calendars = objects(result.getJSONArray("calendars")); val selected = linkedSetOf<String>()
                            require(calendars.map { it.getString("id") }.toSet().size == calendars.size)
                            for (calendar in calendars) {
                                if (calendar.getBoolean("selected")) selected.add(calendar.getString("id"))
                                resultPanel.addView(CheckBox(ui).apply { text = calendar.getString("summary"); isChecked = calendar.getBoolean("selected")
                                    setOnCheckedChangeListener { _, checked -> if (active() && commandVersion == taskVersion) { if (checked) selected.add(calendar.getString("id")) else selected.remove(calendar.getString("id")) } }
                                })
                            }
                            ui.button(MoteI18n.text("保存选择"), true, resultPanel) {
                                if (!active() || commandVersion != taskVersion) return@button
                                val request = JSONObject().put("operation", "select").put("payload", JSONObject().put("calendarIds", JSONArray(selected)))
                                ui.work(MoteI18n.text("正在保存…"), { screens.submitConnector(api, id, generation, path(id) + "/operations", request) }) { if (active()) showTask(it.getString("id")) }
                            }
                        }
                        if (result?.has("imported") == true && result.has("duplicates")) ui.text(MoteI18n.text("已同步 {0} 条新版本，{1} 条已存在。", result.getLong("imported"), result.getLong("duplicates")), parent = resultPanel)
                        if (result?.has("selectedCalendarIds") == true) ui.text(MoteI18n.text("日历选择已保存。"), parent = resultPanel)
                    }
                }
            }
            fun command(suffix: String, payload: JSONObject = JSONObject()) {
                if (!active()) return
                ui.work(MoteI18n.text("正在处理…"), { runCatching { screens.submitConnector(api, id, generation, path(id) + "/" + suffix, payload) } }) { result ->
                    if (active()) result.onSuccess { showTask(it.getString("id")) }.onFailure { ui.requestFailure(it); if (current()) load() }
                }
            }
            work.optJSONObject(id)?.let { previous ->
                if (previous.has("pending")) {
                    ui.text(MoteI18n.text("请求结果尚未确认，请重试同一请求。"), parent = resultPanel)
                    ui.button(MoteI18n.text("重试"), parent = resultPanel) {
                        if (!active()) return@button
                        ui.work(MoteI18n.text("正在处理…"), { screens.retryConnector(api, id) }) { if (active()) showTask(it.getString("id"), admittedGeneration = previous.getLong("generation")) }
                    }
                    ui.button(MoteI18n.text("清除本机待确认请求"), parent = resultPanel) {
                        if (active()) screens.confirm(MoteI18n.text("清除本机待确认请求"), MoteI18n.text("这只清除本机待确认请求，已在中央接收的任务仍会继续。")) {
                            if (active()) ui.work(MoteI18n.text("正在保存…"), { screens.clearPendingConnector(id) }) { if (active()) load() }
                        }
                    }
                } else if (previous.has("taskId")) showTask(previous.getString("taskId"), admittedGeneration = previous.getLong("generation"))
            }
            val google = connection.getString("provider") in setOf("gmail", "google-calendar")
            if (connection.getString("provider") == "google-calendar") ui.button(MoteI18n.text("读取日历列表"), parent = card) { command("operations", JSONObject().put("operation", "calendars").put("payload", JSONObject())) }
            if (google) {
                ui.button(MoteI18n.text("立即同步"), true, card) { command("sync") }
                ui.button(MoteI18n.text("断开连接"), parent = card) { command("disconnect") }
            } else ui.button(MoteI18n.text("查看详情"), parent = card) { if (active()) openProvider(connection.getString("provider")) }
            ui.button(MoteI18n.text("编辑连接"), parent = card) { if (active()) edit(configuration, providers, connection) }
            for ((action, title) in listOf("enable" to "启用", "pause" to "暂停", "resume" to "继续", "stop" to "立即停止")) {
                ui.button(MoteI18n.text(title), parent = card) {
                    if (!active()) return@button
                    ui.work(MoteI18n.text("正在处理…"), {
                        api.post(path(id) + "/" + action, JSONObject().put("expectedRevision", plugins.getLong("revision")))
                    }) { if (active()) load() }
                }
            }
            ui.button(MoteI18n.text("检查状态"), parent = card) {
                if (!active()) return@button
                ui.work(MoteI18n.text("正在读取…"), { api.get(path(id)) }) { status -> if (active()) showValues(status, ui.card(card)) }
            }
            if (google) ui.button(MoteI18n.text("连接"), parent = card) {
                if (!active()) return@button
                ui.work(MoteI18n.text("正在处理…"), {
                    check(screens.connectorWork().optJSONObject(id)?.has("pending") != true) { MoteI18n.text("请求结果尚未确认，请重试同一请求。") }
                    api.post(path(id) + "/start", JSONObject()).also { screens.rememberConnectorTask(id, generation, it.getString("taskId")) }
                }) { result ->
                    if (!active()) return@work
                    val url = Uri.parse(result.getString("authorizationUrl"))
                    require(url.scheme == "https" && url.host == "accounts.google.com" && url.userInfo == null && url.port == -1)
                    ui.startActivity(Intent(Intent.ACTION_VIEW, url))
                }
            }
            ui.button(MoteI18n.text("移除连接"), parent = card) {
                if (!active()) return@button
                screens.confirm(MoteI18n.text("移除连接"), id) {
                    if (!active()) return@confirm
                    ui.work(MoteI18n.text("正在处理…"), { api.delete(path(id), JSONObject().put("expectedRevision", configuration.getLong("revision"))) }) { if (active()) load() }
                }
            }
        }
    }
    private fun edit(base: JSONObject, providers: List<String>, existing: JSONObject?) {
        close(); val stamp = ++render; target.removeAllViews()
        fun active() = current() && stamp == render
        ui.text(MoteI18n.text(if (existing == null) "新建连接" else "编辑连接"), NativeFontRole.SECTION, target)
        val provider = Spinner(ui).apply {
            adapter = ArrayAdapter(ui, android.R.layout.simple_spinner_dropdown_item, providers)
            if (existing != null) { setSelection(providers.indexOf(existing.getString("provider"))); isEnabled = false }
        }; target.addView(provider)
        val id = ui.field(MoteI18n.text("连接 ID"), existing?.getString("id") ?: "", parent = target).apply { isEnabled = existing == null }
        val clientId = ui.field(MoteI18n.text("Google 客户端 ID"), existing?.optString("googleClientId") ?: "", parent = target)
        val secret = ui.field(MoteI18n.text("Google 客户端密钥"), password = true, parent = target)
        val clear = CheckBox(ui).apply { text = MoteI18n.text("清除已保存密钥") }; target.addView(clear)
        val redirect = ui.field(MoteI18n.text("Google 授权回调地址"), existing?.optString("googleRedirectUri") ?: "", parent = target)
        fun googleFields() {
            val visible = if (provider.selectedItem?.toString() in setOf("gmail", "google-calendar")) android.view.View.VISIBLE else android.view.View.GONE
            listOf(clientId, secret, clear, redirect).forEach { it.visibility = visible }
        }
        provider.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
            override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) = googleFields()
        }; googleFields()
        val automatic = CheckBox(ui).apply { text = MoteI18n.text("自动同步"); isChecked = existing?.optBoolean("autoSync", true) ?: true }; target.addView(automatic)
        val interval = ui.field(MoteI18n.text("同步间隔（分钟）"), ((existing?.optLong("syncIntervalMs", 300000) ?: 300000).toDouble() / 60000).toString(), parent = target)
        ui.button(MoteI18n.text("保存连接"), true, target) {
            if (!active()) return@button
            check(provider.selectedItemPosition >= 0)
            val milliseconds = interval.text.toString().toDouble() * 60000
            require(milliseconds.isFinite() && milliseconds % 1 == 0.0 && milliseconds >= 60000 && milliseconds <= 2147483647)
            val value = JSONObject().put("id", id.text.toString()).put("provider", providers[provider.selectedItemPosition])
                .put("autoSync", automatic.isChecked).put("syncIntervalMs", milliseconds.toLong())
            if (value.getString("provider") in setOf("gmail", "google-calendar")) value
                .put("googleClientId", clientId.text.toString()).put("googleRedirectUri", redirect.text.toString())
                .put("googleClientSecret", if (clear.isChecked) "" else secret.text.toString().takeIf { it.isNotBlank() } ?: existing?.opt("googleClientSecret") ?: "")
            ui.work(MoteI18n.text("正在保存…"), {
                if (existing == null) api.put(path(value.getString("id")), JSONObject().put("expectedRevision", base.getLong("revision")).put("connection", value))
                else api.put("/api/configuration/connectorSettings", JSONObject().put("revision", base.getLong("revision"))
                    .put("value", JSONObject().put("connections", JSONArray(saved(base).map { if (it.getString("id") == existing.getString("id")) value else it })))
                    .put("preserveRedactedSecrets", true))
            }) { if (active()) load() }
        }
        ui.button(MoteI18n.text("取消"), parent = target) { if (active()) load() }
    }
}
