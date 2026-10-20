package dev.mote.collector

import org.json.JSONObject
import java.util.UUID

/** Personal imports stay attached to their original immutable native client. */
internal class CentralPortable(private val api: CentralClient) {
    private val owner by lazy { AccountBinding.self(api.server, api.get("/api/connections/self")) }
    private fun current() {
        check(AccountBinding.self(api.server, api.get("/api/connections/self")) == owner) { "Deployment or account changed" }
    }
    fun importArchive(operationId: String, archive: JSONObject): JSONObject {
        UUID.fromString(operationId); current()
        require(archive.getString("format") == "mote-portable" && archive.get("version") == 3)
        require(archive.getString("userId") == owner.userId && archive.getString("deploymentId") == owner.deploymentId) { MoteI18n.text("归档必须来自当前实例和当前账号。") }
        val domains = archive.getJSONArray("domains")
        for (index in 0 until domains.length()) {
            val domain = domains.getJSONObject(index)
            require(domain.getString("userId") == owner.userId && domain.getString("deploymentId") == owner.deploymentId)
        }
        return importReceipt(api.post(IMPORT_PATH, JSONObject().put("operationId", operationId).put("archive", archive)), operationId)
    }
    fun readImport(id: String): JSONObject { UUID.fromString(id); current(); return importReceipt(api.get("$IMPORT_PATH/$id"), id) }
    fun cancelImport(id: String): JSONObject { UUID.fromString(id); current(); return importReceipt(api.post("$IMPORT_PATH/$id/cancel"), id) }
    fun listImports(cursor: String? = null): JSONObject {
        current()
        val page = api.get(IMPORT_PATH + "?limit=20" + (cursor?.let { "&cursor=" + CentralScreens.encode(it) } ?: ""))
        val items = page.getJSONArray("items"); for (i in 0 until items.length()) importReceipt(items.getJSONObject(i))
        require(page.isNull("nextCursor") || page.get("nextCursor") is String)
        return page
    }
    private fun importReceipt(value: JSONObject, expectedId: String? = null): JSONObject {
        val id = value.getString("id"); UUID.fromString(id); require(expectedId == null || id == expectedId)
        require(value.getString("kind") == "import" && value.getString("format") == "mote-portable" && value.get("version") == 3)
        require(value.getString("userId") == owner.userId && value.getString("deploymentId") == owner.deploymentId)
        val state = value.getString("state"); require(state in setOf("working", "completed", "failed", "cancelled"))
        require(value.getString("phase") == if (state == "working") "validating" else state)
        require(value.getJSONObject("scope").getString("kind") == "account" && value.getJSONObject("progress").getString("mode") == "semantic")
        val coverage = value.getJSONObject("coverage")
        for (field in listOf("credentials", "activeAuthorization", "instanceBackup")) require(coverage.get(field) == false)
        fun domains(field: String) = coverage.getJSONArray(field).let { items -> (0 until items.length()).map { items.getString(it) } }
        val imported = domains("importedDomains"); val preserved = domains("preservedDomains"); val declared = imported + preserved
        require(imported.containsAll(listOf("private-data", "ingress", "processing", "memory", "ask")) && declared.size == declared.toSet().size)
        val rows = value.getJSONArray("domains")
        require(rows.length() == declared.size && (0 until rows.length()).map { rows.getJSONObject(it).getString("domain") }.toSet() == declared.toSet())
        for (i in 0 until rows.length()) { val row = rows.getJSONObject(i); require(if (row.getString("domain") in preserved) row.getString("state") == "preserved" else row.getString("state") in if (state == "completed") setOf("complete") else setOf("waiting", "complete")) }
        require(listOf("artifact", "filename", "contentType", "bytes", "sha256").none(value::has))
        return value
    }
    companion object { const val IMPORT_PATH = "/api/portable/imports" }
}
