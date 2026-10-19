package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class CentralModelConfigurationTest {
    private fun reference(kind: String = "personal", id: String = "same-profile") = JSONObject().put("kind", kind).put("id", id)
    private fun settings() = CentralModels.newSettings().put("baseUrl", "https://generated.invalid/v1").put("model", "generated-original")
        .put("apiKey", true).put("headers", true).put("extraBody", true)

    @Test fun changedTargetsRequireDecisionForEachRetainedCredentialButReplacementAndClearDoNot() {
        for (target in listOf("provider", "protocol", "baseUrl")) for (credential in listOf("apiKey", "headers", "extraBody")) {
            val previous = CentralModels.newSettings().put(credential, true)
            val changed = JSONObject(previous.toString()).put(target, "generated-change")
            assertTrue(CentralModels.needsCredentialReuse(previous, changed))
            changed.put(credential, if (credential == "apiKey") "GENERATED_REPLACEMENT" else JSONObject().put("generated", "replacement"))
            assertFalse(CentralModels.needsCredentialReuse(previous, changed))
            changed.put(credential, if (credential == "apiKey") "" else JSONObject())
            assertFalse(CentralModels.needsCredentialReuse(previous, changed))
            changed.remove(credential)
            assertTrue(CentralModels.needsCredentialReuse(previous, changed))
        }
        assertFalse(CentralModels.needsCredentialReuse(settings(), settings().put("maxTokens", 8192)))
    }

    @Test fun unsavedDraftCatalogAndProbeUsePinnedReferenceAndNeverSaveOrReplaceTheEffectiveConnection() {
        val requests = mutableListOf<Triple<String, String, JSONObject>>()
        val client = CentralClient("http://127.0.0.1:47999", "GENERATED_TOKEN", transport = { method, url, bytes, _, _ ->
            requests.add(Triple(method, url, JSONObject(String(bytes!!))))
            200 to JSONObject().put("items", JSONArray().put(JSONObject().put("id", "generated-directory")))
        })
        val draft = settings().put("model", "generated-unsaved")
        val input = CentralModels.inspectRequest(17, reference(), draft, true)
        client.post("/api/models/catalog", input); client.post("/api/models/probe", input)
        assertEquals(2, requests.size); assertTrue(requests.all { it.first == "POST" && !it.second.contains("/configuration") })
        assertTrue(requests.all { it.third.getLong("revision") == 17L && it.third.getBoolean("allowCredentialReuse") })
        assertEquals("generated-unsaved", requests[0].third.getJSONObject("draft").getString("model"))
        draft.put("model", "changed-after-request")
        assertEquals("generated-unsaved", input.getJSONObject("draft").getString("model"))
        assertFalse(CentralModels.inspectRequest(17, reference("shared", "env:deployment")).has("draft"))
        assertThrows(IllegalArgumentException::class.java) { CentralModels.inspectRequest(17, reference("shared", "env:deployment"), settings()) }
    }

    @Test fun independentFeatureModelsShareOneConnectionWhileSharedResourcesRejectCallerModels() {
        val chat = CentralModels.featureReference(reference(), " generated-chat ")
        val memory = CentralModels.featureReference(reference(), "generated-memory")
        assertEquals(chat.getString("id"), memory.getString("id")); assertEquals("generated-chat", chat.getString("model")); assertEquals("generated-memory", memory.getString("model"))
        assertFalse(CentralModels.featureReference(reference(), "").has("model"))
        assertFalse(CentralModels.featureReference(reference("shared", "env:deployment"), "").has("model"))
        assertThrows(IllegalArgumentException::class.java) { CentralModels.featureReference(reference("shared", "env:deployment"), "caller-model") }
    }

    @Test fun profileAndDefaultEditsPreserveOtherProfilesSecretsAndPerFeatureModelsWithCas() {
        val original = JSONObject().put("profiles", JSONArray()
            .put(JSONObject().put("id", "same-profile").put("name", "Generated A").put("settings", settings()))
            .put(JSONObject().put("id", "other-profile").put("name", "Generated other").put("settings", settings())))
            .put("selections", JSONObject().put("chat", CentralModels.featureReference(reference(), "generated-chat")))
        val originalBytes = original.toString()
        val next = CentralModels.replaceProfile(original, "same-profile", "Edited", settings().put("model", "generated-new"))
        assertEquals(originalBytes, original.toString()); assertEquals(2, next.getJSONArray("profiles").length())
        assertEquals("Generated other", next.getJSONArray("profiles").getJSONObject(1).getString("name")); assertTrue(next.getJSONArray("profiles").getJSONObject(1).getJSONObject("settings").getBoolean("apiKey"))
        assertEquals("generated-chat", next.getJSONObject("selections").getJSONObject("chat").getString("model"))
        val payload = CentralModels.saveRequest(29, next, true); assertEquals(29, payload.getLong("revision")); assertTrue(payload.getBoolean("preserveRedactedSecrets")); assertTrue(payload.getBoolean("allowCredentialReuse"))
        val created = CentralModels.replaceProfile(original, "new-profile", "New", CentralModels.newSettings())
        assertEquals(3, created.getJSONArray("profiles").length()); assertEquals("", created.getJSONArray("profiles").getJSONObject(2).getJSONObject("settings").getString("apiKey"))
    }

    @Test fun aRetiredAccountCannotAcceptItsLateDirectoryResult() {
        var active = true
        val client = CentralClient("http://127.0.0.1:47999", "GENERATED_A_TOKEN", active = { active }, transport = { _, _, _, _, _ ->
            active = false
            200 to JSONObject().put("items", JSONArray().put(JSONObject().put("id", "GENERATED_A_PRIVATE_MODEL")))
        })
        assertThrows(Exception::class.java) { client.post("/api/models/catalog", CentralModels.inspectRequest(1, reference(), settings())) }
    }
}
