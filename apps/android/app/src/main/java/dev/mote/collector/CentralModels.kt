package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject

/** Native selector retains an explicit owned M04 reference, never model credentials. */
internal object CentralModels {
    private val credentialFields = listOf("apiKey", "headers", "extraBody")
    fun configuration(view: JSONObject): JSONObject = view.getJSONArray("domains").let { domains ->
        JSONObject((0 until domains.length()).map(domains::getJSONObject).single { it.getString("id") == "models" }.getJSONObject("saved").toString())
    }
    fun needsCredentialReuse(previous: JSONObject, draft: JSONObject): Boolean =
        listOf("provider", "protocol", "baseUrl").any { draft.opt(it) != previous.opt(it) } &&
            credentialFields.any { previous.opt(it) == true && (!draft.has(it) || draft.opt(it) == true) }
    fun inspectRequest(revision: Long, reference: JSONObject, draft: JSONObject? = null, allowCredentialReuse: Boolean = false): JSONObject {
        val owned = this.reference(reference.toString())!!
        require(owned.getString("kind") == "personal" || draft == null)
        return JSONObject().put("revision", revision).put("reference", owned).apply {
            draft?.let { put("draft", JSONObject(it.toString())) }
            if (allowCredentialReuse) put("allowCredentialReuse", true)
        }
    }
    fun featureReference(reference: JSONObject, model: String): JSONObject = this.reference(reference.toString())!!.apply {
        if (getString("kind") == "personal") model.trim().takeIf(String::isNotEmpty)?.let { put("model", it) }
        else require(model.isBlank())
    }
    fun replaceProfile(configuration: JSONObject, id: String, name: String, settings: JSONObject): JSONObject = JSONObject(configuration.toString()).apply {
        val profiles = getJSONArray("profiles"); val next = JSONArray(); var replaced = false
        for (index in 0 until profiles.length()) {
            val profile = profiles.getJSONObject(index)
            if (profile.getString("id") == id) { next.put(JSONObject().put("id", id).put("name", name).put("settings", JSONObject(settings.toString()))); replaced = true }
            else next.put(JSONObject(profile.toString()))
        }
        if (!replaced) next.put(JSONObject().put("id", id).put("name", name).put("settings", JSONObject(settings.toString())))
        put("profiles", next)
    }
    fun saveRequest(revision: Long, configuration: JSONObject, allowCredentialReuse: Boolean = false): JSONObject = JSONObject()
        .put("revision", revision).put("value", JSONObject(configuration.toString())).put("preserveRedactedSecrets", true)
        .apply { if (allowCredentialReuse) put("allowCredentialReuse", true) }
    fun newSettings() = JSONObject().put("provider", "custom").put("protocol", "openai-completions").put("baseUrl", "").put("model", "")
        .put("reasoningEffort", "auto").put("maxTokens", 65536).put("modelRequestTimeoutMs", 300000).put("agentTimeoutMs", 3600000)
        .put("allowUnauthenticatedLocal", false).put("apiKey", "").put("headers", JSONObject()).put("extraBody", JSONObject())
    fun inventory(client: CentralClient): JSONObject {
        val inventory = client.get("/api/models")
        val profiles = JSONArray()
        for (kind in listOf("shared", "personal")) {
            val values = inventory.getJSONArray(kind)
            for (index in 0 until values.length()) {
                val item = values.getJSONObject(index)
                profiles.put(JSONObject().put("id", JSONObject().put("kind", kind).put("id", item.getString("id")).toString())
                    .put("name", item.getString("name")))
            }
        }
        return JSONObject().put("profiles", profiles).also { result -> inventory.optJSONArray("features")?.let { result.put("features", JSONArray(it.toString())) } }
    }
    fun reference(value: String): JSONObject? {
        if (value.isEmpty()) return null
        return JSONObject(value).also {
            require(it.keys().asSequence().toSet() == setOf("kind", "id") && it.getString("kind") in setOf("shared", "personal") && it.getString("id").length in 1..256)
        }
    }
}
