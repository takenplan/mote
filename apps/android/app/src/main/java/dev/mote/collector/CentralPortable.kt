package dev.mote.collector

import org.json.JSONObject
import java.io.File
import java.io.OutputStream
import java.util.UUID

/** An export operation stays attached to its original immutable native client. */
internal class CentralPortable(private val api: CentralClient) {
    private val owner by lazy { AccountBinding.self(api.server, api.get("/api/connections/self")) }
    private fun current() {
        check(AccountBinding.self(api.server, api.get("/api/connections/self")) == owner) { "Deployment or account changed" }
    }
    fun start(operationId: String): JSONObject {
        UUID.fromString(operationId); current()
        return receipt(api.post(PATH, JSONObject().put("operationId", operationId)), operationId)
    }
    fun read(id: String): JSONObject { current(); return receipt(api.get(path(id)), id) }
    fun list(cursor: String? = null): JSONObject {
        current()
        val page = api.get(PATH + "?limit=20" + (cursor?.let { "&cursor=" + CentralScreens.encode(it) } ?: ""))
        val items = page.getJSONArray("items")
        for (i in 0 until items.length()) receipt(items.getJSONObject(i))
        require(page.isNull("nextCursor") || page.get("nextCursor") is String)
        return page
    }
    fun control(id: String, command: String): JSONObject {
        require(command in setOf("retry", "cancel")); current()
        return receipt(api.post(path(id) + "/" + command), id)
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
        require(imported.isNotEmpty() && declared.size == declared.toSet().size)
        val rows = value.getJSONArray("domains")
        require(rows.length() == declared.size && (0 until rows.length()).map { rows.getJSONObject(it).getString("domain") }.toSet() == declared.toSet())
        for (i in 0 until rows.length()) { val row = rows.getJSONObject(i); require(if (row.getString("domain") in preserved) row.getString("state") == "preserved" else row.getString("state") in if (state == "completed") setOf("complete") else setOf("waiting", "complete")) }
        require(listOf("artifact", "filename", "contentType", "bytes", "sha256").none(value::has))
        return value
    }
    fun save(frozen: JSONObject, directory: File, openOutput: () -> OutputStream) {
        receipt(frozen)
        val id = frozen.getString("id"); val latest = read(id)
        val expected = completed(frozen)
        require(completed(latest) == expected) { "Export artifact changed" }
        api.downloadVerified(path(id) + "/content", openOutput, expected, directory)
    }
    internal fun receipt(value: JSONObject, id: String? = null): JSONObject {
        val actual = value.getString("id"); UUID.fromString(actual)
        require(id == null || actual == id)
        require(value.getString("kind") == "export" && value.getString("format") == "mote-portable" && value.get("version") == 3)
        require(value.getString("userId") == owner.userId && value.getString("deploymentId") == owner.deploymentId)
        require(value.getString("state") in setOf("working", "completed", "failed", "cancelled"))
        require(value.getJSONObject("scope").getString("kind") == "account" && value.getJSONObject("progress").getString("mode") == "semantic")
        val coverage = value.getJSONObject("coverage")
        for (field in listOf("credentials", "activeAuthorization", "instanceBackup")) require(coverage.get(field) == false)
        val domains = coverage.getJSONArray("domains"); val records = value.getJSONArray("domains")
        val declared = (0 until domains.length()).map { domains.getString(it) }
        require(declared.isNotEmpty() && declared.size == declared.toSet().size)
        require(records.length() == declared.size && (0 until records.length()).map { records.getJSONObject(it).getString("domain") }.toSet() == declared.toSet())
        if (value.getString("state") == "completed") completed(value)
        return value
    }
    private fun completed(value: JSONObject): CentralDownload {
        require(value.getString("state") == "completed")
        val bytes = value.get("bytes"); require(bytes is Number && bytes.toLong() >= 0 && bytes.toDouble() == bytes.toLong().toDouble())
        val sha = value.getString("sha256"); require(Regex("[a-f0-9]{64}").matches(sha))
        require(value.getString("filename") == "mote-portable-${value.getString("id")}.json")
        require(value.getString("contentType") == "application/json; charset=utf-8")
        return CentralDownload(bytes.toLong(), sha, value.getString("contentType"))
    }
    private fun path(id: String): String { UUID.fromString(id); return "$PATH/$id" }
    companion object { const val PATH = "/api/portable/exports"; const val IMPORT_PATH = "/api/portable/imports" }
}
