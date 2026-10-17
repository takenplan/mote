package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/** Native projection of the shared owner control-plane contract. No query tool
 * can reach these commands; authorization is enforced by CentralClient/server. */
internal data class PluginCommandIntent(val path: String, val method: String, val body: String) {
    fun payload() = JSONObject(body)
}
internal data class PluginCapability(val id: String, val state: String, val reason: String)
internal data class PluginField(val id: String, val label: String, val type: String, val required: Boolean, val options: List<Pair<String, String>>, val description: String)
internal data class PluginInstance(val id: String, val packageId: String, val name: String, val revision: Long, val scope: String, val configuration: JSONObject, val fields: List<PluginField>, val capabilities: List<PluginCapability>, val desired: Boolean, val observed: String, val issues: List<String>, val allowedActions: Set<String>, val secretStatus: JSONObject, val definition: JSONObject? = null, val checked: Boolean = false)
internal data class PluginPackage(val id: String, val name: String, val version: String, val source: JSONObject, val runtime: String, val state: String, val observed: String, val issues: List<String>, val allowedActions: Set<String>, val fields: List<PluginField> = emptyList())
internal data class PluginInventory(val revision: Long, val installation: JSONObject, val packages: List<PluginPackage>, val instances: List<PluginInstance>, val catalog: List<JSONObject>, val adminRevision: Long? = null, val declarations: JSONObject? = null)

internal object PluginControlProjection {
    fun objects(value: JSONArray?) = value?.let { array -> (0 until array.length()).map { array.getJSONObject(it) } }.orEmpty()
    fun strings(value: JSONArray?) = value?.let { array -> (0 until array.length()).map { array.getString(it) } }.orEmpty()
    fun actions(value: JSONObject) = strings(value.optJSONArray("allowedActions")).toSet()
    fun capabilities(value: JSONArray?) = objects(value).map { PluginCapability(it.getString("id"), it.getString("state"), it.optString("reason")) }
    fun fields(value: JSONArray?) = objects(value).map { field ->
        PluginField(field.getString("id"), field.getString("label"), field.getString("type"), field.optBoolean("required"), objects(field.optJSONArray("options")).map { it.getString("value") to it.getString("label") }, field.optString("description"))
    }
    fun instance(value: JSONObject) = PluginInstance(value.getString("id"), value.getString("packageId"), value.getString("name"), value.getLong("revision"), value.getString("scope"), value.getJSONObject("configuration"), fields(value.getJSONArray("configurationSchema")), capabilities(value.getJSONArray("capabilities")), value.getBoolean("desired"), value.getString("observed"), strings(value.getJSONArray("issues")), actions(value), value.getJSONObject("secretStatus"))
    fun inventory(value: JSONObject) = PluginInventory(value.getLong("revision"), value.getJSONObject("installation"), objects(value.getJSONArray("packages")).map { PluginPackage(it.getString("id"), it.getString("name"), it.getString("version"), it.getJSONObject("source"), it.getString("runtime"), it.getString("state"), it.getString("observed"), strings(it.getJSONArray("issues")), actions(it), fields(it.optJSONArray("configurationSchema"))) }, objects(value.getJSONArray("instances")).map(::instance), objects(value.getJSONArray("catalog")))
    fun configured(fields: List<PluginField>, configuration: JSONObject, secretStatus: JSONObject? = null): Boolean = fields.all { field ->
        val value = configuration.opt(field.id)
        val absent = value == null || value == JSONObject.NULL || value == ""
        if (absent) !field.required || (field.type == "secret-reference" && secretStatus?.optBoolean(field.id) == true) else when (field.type) {
            "boolean" -> value is Boolean
            "number" -> value is Number && value.toDouble().isFinite()
            "select" -> value is String && field.options.any { it.first == value }
            "text", "model-profile", "secret-reference" -> value is String
            else -> false
        }
    }
}

internal class PluginControlClient(private val client: CentralClient) {
    fun inventory(): PluginInventory {
        val value = client.get("/api/plugins")
        val administrator = client.get("/api/connections/self").getJSONObject("account").getBoolean("administrator")
        val admin = if (administrator) client.get("/api/admin/plugins") else null
        val packages = PluginControlProjection.objects(value.getJSONArray("packages"))
        val instances = PluginControlProjection.objects(value.getJSONArray("instances")).map { raw ->
            val pkg = packages.single { it.getString("id") == raw.getString("packageId") }
            val grants = raw.getJSONObject("grants")
            PluginInstance(raw.getString("id"), raw.getString("packageId"), raw.getString("name"), value.getLong("revision"),
                PluginControlProjection.strings(grants.getJSONArray("sourceIds")).joinToString(", "), raw.getJSONObject("configuration"), PluginControlProjection.fields(pkg.getJSONArray("configurationSchema")),
                PluginControlProjection.capabilities(raw.getJSONArray("capabilities")), raw.getBoolean("desired"), "unknown", emptyList(),
                if (raw.getBoolean("desired")) setOf("disable") else setOf("configure", "check") + if (raw.getBoolean("checked")) setOf("enable") else emptySet(),
                raw.getJSONObject("secretStatus"), JSONObject().apply { for (key in listOf("id", "packageId", "name", "configuration", "desired", "revocation", "grants")) put(key, raw.get(key)) }, raw.getBoolean("checked"))
        }
        val projected = JSONObject().put("revision", value.getLong("revision")).put("installation", admin?.getJSONObject("installation") ?: JSONObject().put("supported", false))
            .put("catalog", admin?.getJSONArray("catalog") ?: JSONArray()).put("instances", JSONArray()).put("packages", JSONArray(packages.map { raw ->
                JSONObject(raw.toString()).apply { val allowed = PluginControlProjection.actions(raw).toMutableSet(); if (PluginControlProjection.objects(admin?.getJSONArray("packages")).any { it.getString("id") == raw.getString("id") && "uninstall" in PluginControlProjection.actions(it) }) allowed.add("uninstall"); put("allowedActions", JSONArray(allowed.toList())) }
            }))
        return PluginControlProjection.inventory(projected).copy(instances = instances, adminRevision = admin?.getLong("revision"), declarations = value)
    }
    fun memory() = client.get("/api/memory")
    fun preparation(id: String) = client.get("/api/memory/bindings/" + CentralScreens.encode(id))
    fun resolve(repository: String, tag: String = "") = client.post("/api/plugins/resolve", JSONObject().put("repository", repository).apply { if (tag.isNotBlank()) put("tag", tag) })
    fun execute(intent: PluginCommandIntent): JSONObject = when (intent.method) {
        "POST" -> client.post(intent.path, intent.payload())
        "PATCH" -> client.patch(intent.path, intent.payload())
        else -> error("Unsupported plugin command method")
    }
    companion object {
        fun configureOwned(packageId: String, previous: JSONObject?, revision: Long, name: String, configuration: JSONObject, grants: JSONObject): PluginCommandIntent {
            val instance = JSONObject().put("id", previous?.getString("id") ?: UUID.randomUUID().toString()).put("packageId", packageId).put("name", name)
                .put("configuration", configuration).put("desired", false).put("revocation", previous?.getString("revocation") ?: "initial").put("grants", grants)
            return PluginCommandIntent("/api/plugin-instances", "POST", JSONObject().put("instance", instance).put("expectedRevision", revision).put("preserveRedactedSecrets", previous != null).toString())
        }
        fun ownedInstanceAction(id: String, action: String, revision: Long): PluginCommandIntent {
            require(action in setOf("check", "enable", "disable", "pause", "resume", "stop"))
            return PluginCommandIntent("/api/plugin-instances/" + CentralScreens.encode(id) + "/" + action, "POST", (if (action == "check") JSONObject() else JSONObject().put("expectedRevision", revision)).toString())
        }
        fun memoryControl(action: String, revision: Long): PluginCommandIntent {
            require(action in setOf("pause", "resume", "stop"))
            return intent("/api/memory/$action", revision)
        }
        fun prepareBinding(instanceId: String?): PluginCommandIntent = PluginCommandIntent("/api/memory/bindings", "POST", JSONObject().put("operationId", UUID.randomUUID().toString()).apply { instanceId?.let { put("instanceId", it) } }.toString())
        fun bindingControl(id: String, action: String, revision: Long): PluginCommandIntent {
            require(action in setOf("activate", "cancel"))
            return PluginCommandIntent("/api/memory/bindings/" + CentralScreens.encode(id) + "/" + action, "POST", (if (action == "activate") JSONObject().put("expectedRevision", revision) else JSONObject()).toString())
        }
        fun intent(path: String, revision: Long, payload: JSONObject = JSONObject(), method: String = "POST", operationId: String = UUID.randomUUID().toString()) =
            PluginCommandIntent(path, method, JSONObject(payload.toString()).put("expectedRevision", revision).put("operationId", operationId).toString())
        fun install(preview: JSONObject, revision: Long) = intent("/api/plugins/install", revision, JSONObject().put("previewId", preview.getString("id")))
        fun uninstall(id: String, revision: Long) = intent("/api/plugins/" + CentralScreens.encode(id) + "/uninstall", revision)
    }
}
