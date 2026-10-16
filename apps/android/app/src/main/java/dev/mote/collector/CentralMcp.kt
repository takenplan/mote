package dev.mote.collector

import android.view.View
import android.widget.*
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/** Native consumer of M04 saved outbound connections and M11 explicit reads. */
internal class CentralMcp(private val screens: CentralScreens) {
    private val ui = screens.ui
    private val api = screens.client
    private val target = ui.card()
    private var revision = 0L
    private var renderRevision = 0L
    private fun current() = screens.ownsSelectedAccount() && ui.client === api
    private fun objects(values: JSONArray) = (0 until values.length()).map(values::getJSONObject)
    private fun connections(view: JSONObject): List<JSONObject> = objects(view.getJSONArray("domains"))
        .single { it.getString("id") == "mcpConnections" }.getJSONObject("saved").getJSONArray("connections").let(::objects)

    fun show() {
        ui.work(MoteI18n.text("正在读取…"), { api.get("/api/configuration") to api.get("/api/sources") }) { (view, sources) ->
            render(view, sources)
        }
    }
    private fun render(view: JSONObject, sources: JSONObject, selectedId: String = "") {
        revision++; val rendered = ++renderRevision; target.removeAllViews()
        ui.text(MoteI18n.text("外部 MCP 连接"), NativeFontRole.SECTION, target)
        val configured = connections(view)
        val selector = Spinner(ui).apply {
            adapter = ArrayAdapter(ui, android.R.layout.simple_spinner_dropdown_item,
                listOf(MoteI18n.text("请选择")) + configured.map { it.getString("id") + " · " + it.getString("url") })
        }; target.addView(selector)
        val selectedPanel = ui.card(target)
        selector.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
            override fun onItemSelected(parent: AdapterView<*>?, child: View?, position: Int, id: Long) {
                revision++; selectedPanel.removeAllViews()
                val connection = configured.getOrNull(position - 1) ?: return
                val stamp = revision
                val eligible = objects(sources.getJSONArray("items")).filter { source ->
                    source.optString("kind") == "mcp" && source.optBoolean("enabled", true) &&
                        connection.getJSONArray("sourceIds").let { ids -> (0 until ids.length()).any { ids.getString(it) == source.getString("id") } }
                }
                ui.text(MoteI18n.text("来源名称"), NativeFontRole.SUPPORT, selectedPanel)
                val source = Spinner(ui).apply {
                    adapter = ArrayAdapter(ui, android.R.layout.simple_spinner_dropdown_item, eligible.map { it.getString("name") })
                }; selectedPanel.addView(source)
                val discovered = ui.card(selectedPanel)
                fun active() = current() && stamp == revision
                fun importSelected(request: JSONObject) {
                    if (!active()) return
                    val destination = eligible.getOrNull(source.selectedItemPosition) ?: error(MoteI18n.text("请选择"))
                    val payload = JSONObject(request.toString()).put("connectionId", connection.getString("id")).put("sourceId", destination.getString("id"))
                    ui.work(MoteI18n.text("正在导入…"), { api.post("/api/connectors/mcp/import", payload) }) { result ->
                        if (active()) ui.notice(MoteI18n.text("导入完成：{0} 条新资料，{1} 条已存在。", result.getInt("imported"), result.getInt("duplicates")))
                    }
                }
                ui.button(MoteI18n.text("发现 MCP 资源"), parent = selectedPanel) {
                    if (!active()) return@button
                    check(connection.optBoolean("enabled", true)) { MoteI18n.text("已暂停") }
                    ui.work(MoteI18n.text("正在读取…"), { api.post("/api/connectors/mcp/discover", JSONObject().put("connectionId", connection.getString("id"))) }) { catalog ->
                        if (!active()) return@work
                        discovered.removeAllViews()
                        val selected = linkedSetOf<String>()
                        for (resource in objects(catalog.getJSONArray("resources"))) {
                            discovered.addView(CheckBox(ui).apply {
                                text = resource.getString("name")
                                setOnCheckedChangeListener { _, checked -> if (active()) { if (checked) selected.add(resource.getString("uri")) else selected.remove(resource.getString("uri")) } }
                            })
                        }
                        ui.button(MoteI18n.text("导入所选资源"), true, discovered) {
                            if (!active()) return@button
                            check(selected.isNotEmpty()) { MoteI18n.text("请选择资源") }
                            importSelected(JSONObject().put("resourceUris", JSONArray(selected)))
                        }
                        for (tool in objects(catalog.getJSONArray("tools"))) {
                            val card = ui.card(discovered)
                            ui.text(tool.getString("name"), NativeFontRole.ROW, card)
                            ui.text(tool.optString("description"), parent = card)
                            val args = ui.field(MoteI18n.text("工具参数 JSON"), "{}", multiline = true, parent = card)
                            val approved = CheckBox(ui).apply { text = MoteI18n.text("我确认此工具只读") }; card.addView(approved)
                            ui.button(MoteI18n.text("导入工具结果"), true, card) {
                                if (!active()) return@button
                                check(approved.isChecked) { MoteI18n.text("请确认工具只读后再执行") }
                                importSelected(JSONObject().put("tool", JSONObject().put("name", tool.getString("name")).put("arguments", JSONObject(args.text.toString())).put("confirmedReadOnly", true)))
                            }
                        }
                    }
                }
            }
        }
        selector.setSelection((configured.indexOfFirst { it.getString("id") == selectedId } + 1).coerceAtLeast(0))
        val create = ui.card(target)
        ui.text(MoteI18n.text("新增数据源"), NativeFontRole.SECTION, create)
        val endpoint = ui.field(MoteI18n.text("MCP 地址"), parent = create)
        val name = ui.field(MoteI18n.text("来源名称"), MoteI18n.text("MCP 导入资料"), parent = create)
        val token = ui.field(MoteI18n.text("访问令牌（可选）"), password = true, parent = create)
        val id = "mcp-" + UUID.randomUUID().toString()
        ui.button(MoteI18n.text("保存并应用"), true, create) {
            if (!current() || rendered != renderRevision) return@button
            val url = endpoint.text.toString(); val label = name.text.toString(); val secret = token.text.toString()
            val value = JSONObject().put("connections", JSONArray(configured + JSONObject().put("id", id).put("url", url).put("token", secret).put("sourceIds", JSONArray().put(id))))
            ui.work(MoteI18n.text("正在保存…"), {
                api.post("/api/ingress/devices", JSONObject().put("id", "mcp-import").put("name", label).put("platform", "import"))
                api.post("/api/ingress/sources", JSONObject().put("id", id).put("name", label).put("kind", "mcp").put("deviceId", "mcp-import").put("platform", "import").put("retention", "snapshot").put("enabled", true))
                api.put("/api/configuration/mcpConnections", JSONObject().put("revision", view.getLong("revision")).put("value", value).put("preserveRedactedSecrets", true)) to api.get("/api/sources")
            }) { (saved, latestSources) -> if (current()) render(saved, latestSources, id) }
        }
    }
}
