package dev.mote.collector

import android.content.Intent
import android.net.Uri
import android.widget.*
import org.json.JSONArray
import org.json.JSONObject

/** Native settings for saved, owner-bound M10 connections; M09 owns execution. */
internal class CentralConnectors(private val screens: CentralScreens, private val showValues: (JSONObject, LinearLayout) -> Unit) {
    private val ui = screens.ui
    private val api = screens.client
    private val navigation = ui.navigationRevision
    private val target = ui.card()
    private var render = 0L
    private fun current() = screens.ownsSelectedAccount() && ui.client === api && ui.navigationRevision == navigation
    private fun objects(rows: JSONArray) = (0 until rows.length()).map(rows::getJSONObject)
    private fun saved(view: JSONObject) = objects(view.getJSONArray("domains")).single { it.getString("id") == "connectorSettings" }.getJSONObject("saved").getJSONArray("connections").let(::objects)
    private fun path(id: String) = "/api/connectors/" + CentralScreens.encode(id)
    private fun load() {
        if (!current()) return
        ui.work(MoteI18n.text("正在读取…"), {
            Triple(api.get("/api/connectors"), api.get("/api/configuration"), api.get("/api/plugins"))
        }) { (inventory, configuration, plugins) -> if (current()) list(inventory, configuration, plugins) }
    }
    fun show() = load()
    private fun list(inventory: JSONObject, configuration: JSONObject, plugins: JSONObject) {
        val stamp = ++render; target.removeAllViews()
        val providers = objects(inventory.getJSONArray("providers")).map { it.getString("provider") }.filter { it == "gmail" || it == "google-calendar" }
        ui.button(MoteI18n.text("新建连接"), parent = target) { if (current() && stamp == render) edit(configuration, providers, null) }
        for (connection in saved(configuration).filter { it.getString("provider") in providers }) {
            val id = connection.getString("id"); val card = ui.card(target)
            ui.text(id + " · " + connection.getString("provider"), NativeFontRole.SECTION, card)
            val instance = objects(plugins.getJSONArray("instances")).singleOrNull { it.getString("id") == "connector." + id }
            ui.text(MoteI18n.text(if (instance?.optBoolean("desired") == true) "已启用" else "已暂停"), parent = card)
            fun active() = current() && stamp == render
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
            ui.button(MoteI18n.text("连接"), parent = card) {
                if (!active()) return@button
                ui.work(MoteI18n.text("正在处理…"), { api.post(path(id) + "/start", JSONObject()) }) { result ->
                    if (!active()) return@work
                    val url = Uri.parse(result.getString("authorizationUrl"))
                    require(url.scheme == "https" && url.host == "accounts.google.com")
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
        val stamp = ++render; target.removeAllViews()
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
        val automatic = CheckBox(ui).apply { text = MoteI18n.text("自动同步"); isChecked = existing?.optBoolean("autoSync", true) ?: true }; target.addView(automatic)
        val interval = ui.field(MoteI18n.text("同步间隔（分钟）"), ((existing?.optLong("syncIntervalMs", 300000) ?: 300000).toDouble() / 60000).toString(), parent = target)
        ui.button(MoteI18n.text("保存连接"), true, target) {
            if (!active()) return@button
            check(provider.selectedItemPosition >= 0)
            val milliseconds = interval.text.toString().toDouble() * 60000
            require(milliseconds.isFinite() && milliseconds % 1 == 0.0 && milliseconds >= 60000 && milliseconds <= 2147483647)
            val value = JSONObject().put("id", id.text.toString()).put("provider", providers[provider.selectedItemPosition])
                .put("googleClientId", clientId.text.toString()).put("googleRedirectUri", redirect.text.toString())
                .put("googleClientSecret", if (clear.isChecked) "" else secret.text.toString().takeIf { it.isNotBlank() } ?: existing?.opt("googleClientSecret") ?: "")
                .put("autoSync", automatic.isChecked).put("syncIntervalMs", milliseconds.toLong())
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
