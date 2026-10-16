package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.util.UUID

class CentralPortableImportTest {
    private val operation = UUID.randomUUID().toString()
    private fun self() = JSONObject().put("protocol", JSONObject().put("min", 2).put("max", 2))
        .put("capabilities", JSONObject().put("ingest", true).put("ingressVersion", 3))
        .put("credential", JSONObject().put("kind", "client"))
        .put("account", JSONObject().put("userId", "generated-A").put("deploymentId", "generated-deployment"))
    private fun archive() = JSONObject().put("format", "mote-portable").put("version", 3).put("userId", "generated-A").put("deploymentId", "generated-deployment")
        .put("domains", JSONArray().put(JSONObject().put("domain", "private-data").put("version", 1).put("userId", "generated-A").put("deploymentId", "generated-deployment").put("payload", JSONObject())))
    private fun receipt() = JSONObject().put("kind", "import").put("id", operation).put("format", "mote-portable").put("version", 3)
        .put("userId", "generated-A").put("deploymentId", "generated-deployment").put("state", "completed").put("phase", "completed")
        .put("scope", JSONObject().put("kind", "account")).put("progress", JSONObject().put("mode", "semantic"))
        .put("coverage", JSONObject().put("importedDomains", JSONArray().put("private-data")).put("preservedDomains", JSONArray().put("configuration"))
            .put("credentials", false).put("activeAuthorization", false).put("instanceBackup", false))
        .put("domains", JSONArray().put(JSONObject().put("domain", "private-data").put("state", "complete")).put(JSONObject().put("domain", "configuration").put("state", "preserved")))

    @Test fun `completed receipt cannot drop a required canonical domain and acknowledge only its declared subset`() {
        val response=receipt()
        val api=CentralClient("https://generated.invalid","generated-token",{method,_,_,_,_->200 to if(method=="GET")self() else response})
        assertThrows(Exception::class.java) {CentralPortable(api).importArchive(operation,archive())}
    }

    @Test fun `foreign archive identities are rejected before sending any private archive bytes`() {
        for (variant in listOf("owner", "deployment", "domain", "legacy")) {
            var posted = 0
            val api = CentralClient("https://generated.invalid", "generated-token", { method, _, _, _, _ ->
                if (method == "POST") posted++
                200 to self()
            })
            val value = archive()
            when (variant) { "owner" -> value.put("userId", "generated-B"); "deployment" -> value.put("deploymentId", "replacement"); "domain" -> value.getJSONArray("domains").getJSONObject(0).put("userId", "generated-B"); else -> value.put("version", 2) }
            assertThrows(Exception::class.java) { CentralPortable(api).importArchive(operation, value) }
            assertEquals(0, posted)
        }
    }
    @Test fun `import acknowledgement requires exact owner operation coverage and data-only receipt`() {
        for (variant in listOf("valid", "operation", "owner", "kind", "coverage", "authority", "artifact", "pending-domain")) {
            val response = receipt()
            when (variant) {
                "operation" -> response.put("id", UUID.randomUUID().toString())
                "owner" -> response.put("userId", "generated-B")
                "kind" -> response.put("kind", "export")
                "coverage" -> response.getJSONObject("coverage").getJSONArray("preservedDomains").put("private-data")
                "authority" -> response.getJSONObject("coverage").put("activeAuthorization", true)
                "artifact" -> response.put("filename", "generated.json")
                "pending-domain" -> response.getJSONArray("domains").getJSONObject(0).put("state", "waiting")
            }
            var posts = 0
            val api = CentralClient("https://generated.invalid", "generated-token", { method, _, body, _, _ ->
                if (method == "GET") 200 to self() else { posts++;assertEquals(operation, JSONObject(String(body!!)).getString("operationId"));200 to response }
            })
            if (variant == "valid") assertEquals(operation, CentralPortable(api).importArchive(operation, archive()).getString("id"))
            else assertThrows(Exception::class.java) { CentralPortable(api).importArchive(operation, archive()) }
            assertEquals(1, posts)
        }
    }
}
