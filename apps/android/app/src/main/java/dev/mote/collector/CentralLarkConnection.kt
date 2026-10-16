package dev.mote.collector

import org.json.JSONObject
import org.json.JSONArray

/** Original Lark presentation backed by one saved M10 connection and M05 task.
 * Scheduling and external I/O remain in the existing central connector. */
internal class CentralLarkConnection(
    private val screens: CentralScreens,
    val id: String,
    private val generation: Long,
    private val selected: () -> Boolean,
) {
    private val api = screens.client
    private val path = "/api/connectors/" + CentralScreens.encode(id)
    private var view: JSONObject? = null
    private var pending: String? = null
    private var kind = "selection"
    var calendars: JSONArray? = null; private set
    var uncertain = false; private set
    val polling get() = pending != null
    private fun active() { check(selected() && screens.ownsSelectedAccount() && screens.ui.client === api) { "Connection changed" } }
    private fun verify() {
        active()
        val rows = api.get("/api/connectors").getJSONArray("connections")
        val current = (0 until rows.length()).map(rows::getJSONObject).singleOrNull { it.getString("id") == id }
        check(current?.getLong("generation") == generation) { MoteI18n.text("服务返回的操作回执与当前账号不一致。") }
        active()
    }
    private fun fresh(): JSONObject {
        val current = api.get(path); active()
        view?.let { old -> for (field in listOf("installed", "version", "configured", "connected", "accountName", "missingScopes")) {
            if (old.has(field)) current.put(field, old.get(field))
        } }
        return current
    }
    fun read(): JSONObject {
        verify()
        val work = screens.connectorWork().optJSONObject(id)
        uncertain = work?.has("pending") == true
        if (pending == null) work?.takeIf { it.optLong("generation") == generation }?.optString("taskId")?.takeIf(String::isNotBlank)?.let { pending = it }
        view = fresh()
        pending?.let { require(Regex("[a-f0-9]{64}").matches(it)); apply(api.get("/api/tasks/" + it)) }
        active(); return JSONObject(requireNotNull(view).toString())
    }
    private fun apply(task: JSONObject) {
        require(task.getString("id") == pending)
        task.optJSONObject("progress")?.optJSONObject("connector")?.optString("kind")?.takeIf(String::isNotBlank)?.let { kind = it }
        val state = task.getString("state")
        if (state in setOf("waiting", "running")) {
            view!!.put("job", task.optJSONObject("progress")?.optJSONObject("connector") ?: JSONObject().put("id", pending).put("kind", kind).put("state", "running"))
            return
        }
        view = fresh()
        if (state == "succeeded") {
            val result = task.optJSONObject("result")
            result?.optJSONArray("calendars")?.let { calendars = JSONArray(it.toString()) }
            if (result?.has("installed") == true) {
                if (result.optBoolean("statusInConnection")) {
                    for (field in result.keys()) if (field != "statusInConnection") view!!.put(field, result.get(field))
                } else view = JSONObject(result.toString())
            } else view!!.remove("job")
        } else view!!.put("job", JSONObject().put("id", pending).put("kind", kind).put("state", if (state == "cancelled") "cancelled" else "failed")
            .put("error", task.optJSONObject("failure")?.optString("code") ?: state))
        pending = null
    }
    fun get(url: String): JSONObject = if (url == "/api/connectors/lark") read() else { active(); api.get(url).also { active() } }
    fun patch(url: String, body: JSONObject): JSONObject { verify(); return api.patch(url, body).also { active() } }
    fun put(url: String, body: JSONObject): JSONObject {
        require(url == "/api/connectors/lark/selection")
        return post("/api/connectors/lark/select", body)
    }
    fun post(url: String, body: JSONObject = JSONObject()): JSONObject {
        verify()
        val action = url.removePrefix("/api/connectors/lark/")
        if (action == "cancel") {
            val task = requireNotNull(pending)
            apply(api.post("/api/tasks/" + task + "/cancel", JSONObject()))
            return JSONObject(view!!.toString())
        }
        kind = when (action) { "check", "select", "calendars" -> "selection"; else -> action }
        if (action == "calendars") calendars = null
        val suffix = if (action in setOf("sync", "disconnect") && !body.has("document")) action else "operations"
        val payload = if (suffix == "operations") JSONObject().put("operation", if (action == "sync" && body.has("document")) "sync-document" else action).put("payload", body) else body
        val task = screens.submitConnector(api, id, generation, path + "/" + suffix, payload)
        active(); pending = task.getString("id"); if (view == null) view = fresh(); apply(task)
        return JSONObject(view!!.toString())
    }
    fun delete(url: String): JSONObject { require(url == "/api/connectors/lark"); return post("/api/connectors/lark/disconnect") }
    fun retry(): JSONObject {
        verify(); val task = screens.retryConnector(api, id); active(); pending = task.getString("id"); if (view == null) view = fresh(); apply(task); return JSONObject(view!!.toString())
    }
    fun clearPending() { active(); screens.clearPendingConnector(id) }
}
