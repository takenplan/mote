package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.util.Base64

/** Actual M01/M03 wire adapter. Stores and workers retain their existing durable journals. */
internal class Ingress3Client(
    val binding: AccountBinding,
    private val deviceId: String,
    private val deviceName: String,
    private val request: (String, String, JSONObject?) -> Pair<Int, JSONObject?>,
    private val current: () -> Boolean = { true },
    private val compressed: ((String, String, List<JSONObject>) -> Pair<Int, JSONObject?>)? = null,
) {
    fun verify() {
        check(current()) { "Account changed" }
        val (status, body) = request("GET", "/api/connections/self", null)
        if (status !in 200..299 || body == null) throw FileTransportFailure(status, "Account verification failed")
        check(AccountBinding.self(binding.origin, body) == binding) { "Deployment or account changed" }
        check(current()) { "Account changed" }
    }
    fun send(method: String, path: String, body: JSONObject? = null): JSONObject {
        verify() // No private bytes leave before this exact credential is verified.
        check(current())
        val (status, value) = request(method, path, body)
        if (status !in 200..299 || value == null) throw FileTransportFailure(status, "Ingress3 request failed")
        check(current()) { "Account changed" }
        return value
    }
    fun register(source: JSONObject) {
        val device = send("POST", "/api/ingress/devices", JSONObject().put("id", deviceId).put("name", deviceName).put("platform", "android"))
        check(device.optString("id") == deviceId)
        val result = send("POST", "/api/ingress/sources", source)
        check(result.optString("id") == source.getString("id") && result.optString("deviceId") == deviceId && result.optString("platform") == "android")
        check(result.optBoolean("enabled", true))
        if (listOf("name", "retention", "initialSync").any { source.has(it) && source.opt(it) != result.opt(it) }) {
            val patch = JSONObject(); for (key in listOf("name", "retention", "initialSync")) if (source.has(key)) patch.put(key, source.get(key))
            val updated = send("PATCH", "/api/ingress/sources/${source.getString("id")}", patch)
            check(updated.optString("id") == source.getString("id"))
        }
    }
    fun captures(events: List<JSONObject>): JSONObject {
        require(events.isNotEmpty())
        val sourceId = "android-capture-${SourceRules.hash(deviceId).take(32)}"
        register(JSONObject().put("id", sourceId).put("name", deviceName).put("deviceId", deviceId).put("platform", "android").put("kind", "custom").put("retention", "snapshot"))
        val batch = batchId(JSONArray(events))
        val path = "/api/ingress/sources/$sourceId/captures"
        val receipt = if (compressed != null) {
            verify()
            val (status, value) = compressed.invoke(path, batch, events)
            if (status !in 200..299 || value == null) throw FileTransportFailure(status, "Ingress3 compressed request failed")
            check(current()); value
        } else send("POST", path, JSONObject().put("batchId", batch).put("items", JSONArray(events)))
        Ingress3Receipt.captures(binding, sourceId, batch, events, receipt)
        return receipt
    }
    fun item(source: LocalSource, body: JSONObject): JSONObject {
        register(source.registration(deviceId))
        val batch = batchId(JSONArray().put(body))
        val receipt = send("POST", "/api/ingress/sources/${source.id}/items", JSONObject().put("batchId", batch).put("items", JSONArray().put(body)))
        Ingress3Receipt.require(binding, source.id, batch, listOf(Ingress3Receipt.captureId(source.id, body)), receipt)
        return receipt
    }
    fun head(sourceId: String, externalId: String): String? = send("GET", "/api/ingress/sources/$sourceId/head?externalId=${java.net.URLEncoder.encode(externalId, "UTF-8")}").let { if (it.isNull("revision")) null else it.getString("revision") }
    fun recoveryPage(sourceId: String, after: String = ""): JSONObject {
        require(after.isEmpty() || after.matches(Regex("[a-f0-9]{64}")))
        return send("GET", "/api/ingress/sources/$sourceId/recovery" + if (after.isEmpty()) "" else "?after=$after").also { page ->
            val items = page.getJSONArray("items"); require(items.length() <= 200)
            for (index in 0 until items.length()) require(items.getJSONObject(index).getString("recoveryId").matches(Regex("[a-f0-9]{64}")))
            if (!page.isNull("nextCursor")) require(page.getString("nextCursor").let { it.matches(Regex("[a-f0-9]{64}")) && it > after })
        }
    }
    fun begin(sourceId: String, manifest: JSONObject): Pair<String, JSONObject> = beginFile(sourceId, manifest, null, null)
    fun beginRecovery(sourceId: String, captureId: String, manifest: JSONObject, recoveryId: String): Pair<String, JSONObject> {
        require(captureId == Ingress3Receipt.captureId(sourceId, manifest.getJSONObject("item")) && recoveryId.matches(Regex("[a-f0-9]{64}")))
        return beginFile(sourceId, manifest, captureId, recoveryId)
    }
    private fun beginFile(sourceId: String, manifest: JSONObject, captureId: String?, recoveryId: String?): Pair<String, JSONObject> {
        val batch = fileBatch(manifest, recoveryId)
        val path = "/api/ingress/sources/$sourceId/" + if (captureId == null) "uploads" else "recovery/$captureId/uploads"
        val body = JSONObject().put("batchId", batch).put("revision", manifest)
        recoveryId?.let { body.put("recoveryId", it) }
        val result = send("POST", path, body)
        check(result.optString("deploymentId") == binding.deploymentId && result.optString("userId") == binding.userId && result.optString("sourceId") == sourceId)
        check(result.getInt("partBytes") == FileArchiveQueue.PART_BYTES)
        return batch to result
    }
    fun part(uploadId: String, index: Int, bytes: ByteArray) {
        val checksum = hash(bytes)
        val result = send("PUT", "/api/ingress/uploads/$uploadId/parts/$index", JSONObject().put("bytes", Base64.getEncoder().encodeToString(bytes)).put("checksum", checksum))
        check(result.optInt("part", -1) == index && result.optInt("bytes", -1) == bytes.size && result.optString("checksum") == checksum)
    }
    fun commit(sourceId: String, uploadId: String, manifest: JSONObject, recoveryId: String? = null): JSONObject {
        val result = send("POST", "/api/ingress/uploads/$uploadId/commit", JSONObject())
        Ingress3Receipt.file(binding, sourceId, manifest, result, recoveryId)
        return result
    }
    companion object {
        fun hash(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        fun batchId(items: JSONArray) = "android-" + SourceRules.hash(SourceRules.canonical(items))
        fun fileBatch(manifest: JSONObject, recoveryId: String? = null) = "android-file-" + SourceRules.hash(SourceRules.canonical(manifest)) + (recoveryId?.let { "-$it" } ?: "")
    }
}

internal object Ingress3Receipt {
    // Android JSONObject escapes every slash; the server hashes JSON.stringify bytes.
    // Keep this identity encoding separate from legacy local canonicalization.
    private fun identity(vararg values: String): String = SourceRules.hash(values.joinToString(",", "[", "]") { value ->
        buildString {
            append('"')
            for ((index, char) in value.withIndex()) when (char) {
                '"' -> append("\\\"")
                '\\' -> append("\\\\")
                '\b' -> append("\\b")
                '\u000c' -> append("\\f")
                '\n' -> append("\\n")
                '\r' -> append("\\r")
                '\t' -> append("\\t")
                else -> if (char.code < 32 || (char.isHighSurrogate() && (index + 1 == value.length || !value[index + 1].isLowSurrogate())) || (char.isLowSurrogate() && (index == 0 || !value[index - 1].isHighSurrogate()))) append("\\u%04x".format(char.code)) else append(char)
            }
            append('"')
        }
    })
    fun captureId(sourceId: String, item: JSONObject): String {
        val hash = identity(sourceId, item.getString("externalId"), item.getString("revision"))
        return "${hash.take(8)}-${hash.substring(8,12)}-5${hash.substring(13,16)}-a${hash.substring(17,20)}-${hash.substring(20,32)}"
    }
    fun require(owner: AccountBinding, source: String, batch: String, ids: List<String>, receipt: JSONObject) {
        check(receipt.opt("version") == 3 && receipt.optString("state") == "received" && receipt.optString("deploymentId") == owner.deploymentId && receipt.optString("userId") == owner.userId && receipt.optString("sourceId") == source && receipt.optString("batchId") == batch)
        val receiptId = identity(owner.deploymentId, owner.userId, source, batch)
        check(receipt.optString("id") == receiptId)
        val captures = receipt.getJSONArray("captures")
        check(captures.length() == ids.size && ids.toSet().size == ids.size)
        for (index in ids.indices) { val ack = captures.getJSONObject(index); check(ack.optString("id") == ids[index] && ack.opt("duplicate") is Boolean) }
    }
    private fun original(owner: AccountBinding, source: String, capture: String, hash: String, bytes: Long, mime: String, retention: String, value: JSONObject) {
        val ref = "original:" + identity(owner.userId, source, capture, hash, mime, retention)
        check(value.optString("ref") == ref && value.optString("sourceId") == source && value.optString("captureId") == capture &&
            value.optString("hash") == hash && value.optLong("bytes", -1) == bytes && value.optString("mime") == mime && value.optString("retention") == retention)
    }
    fun captures(owner: AccountBinding, source: String, batch: String, events: List<JSONObject>, receipt: JSONObject) {
        require(owner, source, batch, events.map { it.getString("id") }, receipt)
        for ((index, event) in events.withIndex()) {
            val ack = receipt.getJSONArray("captures").getJSONObject(index)
            if (event.has("imageBase64")) {
                val bytes = Base64.getDecoder().decode(event.getString("imageBase64"))
                original(owner, source, event.getString("id"), Ingress3Client.hash(bytes), bytes.size.toLong(), event.getString("imageMime"), "snapshot", ack.getJSONObject("original"))
            } else check(!ack.has("original"))
        }
    }
    fun file(owner: AccountBinding, source: String, manifest: JSONObject, receipt: JSONObject, recoveryId: String? = null) {
        val id = captureId(source, manifest.getJSONObject("item"))
        require(owner, source, Ingress3Client.fileBatch(manifest, recoveryId), listOf(id), receipt)
        if (manifest.has("sha256") && !manifest.getJSONObject("item").optBoolean("deleted")) {
            val descriptor = receipt.getJSONArray("captures").getJSONObject(0).getJSONObject("original")
            val item = manifest.getJSONObject("item")
            original(owner, source, id, manifest.getString("sha256"), manifest.getLong("sizeBytes"), item.optString("mimeType", "application/octet-stream"), if (item.getString("layer") == "snapshot") "snapshot" else "archive", descriptor)
        }
    }
}
