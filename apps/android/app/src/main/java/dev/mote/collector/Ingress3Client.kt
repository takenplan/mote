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
    }
    fun captures(events: List<JSONObject>): JSONObject {
        require(events.isNotEmpty())
        val sourceId = "android-capture-${SourceRules.hash(deviceId).take(32)}"
        register(JSONObject().put("id", sourceId).put("name", deviceName).put("deviceId", deviceId).put("platform", "android").put("kind", "custom").put("retention", "snapshot"))
        val batch = batchId(JSONArray(events))
        val receipt = send("POST", "/api/ingress/sources/$sourceId/captures", JSONObject().put("batchId", batch).put("items", JSONArray(events)))
        Ingress3Receipt.require(binding, sourceId, batch, events.map { it.getString("id") }, receipt)
        return receipt
    }
    fun item(source: LocalSource, body: JSONObject): JSONObject {
        register(source.registration(deviceId))
        val batch = batchId(JSONArray().put(body))
        val receipt = send("POST", "/api/ingress/sources/${source.id}/items", JSONObject().put("batchId", batch).put("items", JSONArray().put(body)))
        Ingress3Receipt.require(binding, source.id, batch, listOf(Ingress3Receipt.captureId(source.id, body)), receipt)
        return receipt
    }
    fun begin(sourceId: String, manifest: JSONObject): Pair<String, JSONObject> {
        val batch = fileBatch(manifest)
        val result = send("POST", "/api/ingress/sources/$sourceId/uploads", JSONObject().put("batchId", batch).put("revision", manifest))
        check(result.optString("deploymentId") == binding.deploymentId && result.optString("userId") == binding.userId && result.optString("sourceId") == sourceId)
        check(result.getInt("partBytes") == FileArchiveQueue.PART_BYTES)
        return batch to result
    }
    fun part(uploadId: String, index: Int, bytes: ByteArray) {
        val checksum = hash(bytes)
        val result = send("PUT", "/api/ingress/uploads/$uploadId/parts/$index", JSONObject().put("bytes", Base64.getEncoder().encodeToString(bytes)).put("checksum", checksum))
        check(result.optInt("part", -1) == index && result.optInt("bytes", -1) == bytes.size && result.optString("checksum") == checksum)
    }
    fun commit(sourceId: String, uploadId: String, manifest: JSONObject): JSONObject {
        val result = send("POST", "/api/ingress/uploads/$uploadId/commit", JSONObject())
        Ingress3Receipt.file(binding, sourceId, manifest, result)
        return result
    }
    companion object {
        fun hash(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        fun batchId(items: JSONArray) = "android-" + SourceRules.hash(SourceRules.canonical(items))
        fun fileBatch(manifest: JSONObject) = "android-file-" + SourceRules.hash(SourceRules.canonical(manifest))
    }
}

internal object Ingress3Receipt {
    fun captureId(sourceId: String, item: JSONObject): String {
        val hash = SourceRules.hash(JSONArray().put(sourceId).put(item.getString("externalId")).put(item.getString("revision")).toString())
        return "${hash.take(8)}-${hash.substring(8,12)}-5${hash.substring(13,16)}-a${hash.substring(17,20)}-${hash.substring(20,32)}"
    }
    fun require(owner: AccountBinding, source: String, batch: String, ids: List<String>, receipt: JSONObject) {
        check(receipt.opt("version") == 3 && receipt.optString("state") == "received" && receipt.optString("deploymentId") == owner.deploymentId && receipt.optString("userId") == owner.userId && receipt.optString("sourceId") == source && receipt.optString("batchId") == batch)
        val receiptId = SourceRules.hash(JSONArray().put(owner.deploymentId).put(owner.userId).put(source).put(batch).toString())
        check(receipt.optString("id") == receiptId)
        val captures = receipt.getJSONArray("captures")
        check(captures.length() == ids.size && ids.toSet().size == ids.size)
        for (index in ids.indices) { val ack = captures.getJSONObject(index); check(ack.optString("id") == ids[index] && ack.opt("duplicate") is Boolean) }
    }
    fun file(owner: AccountBinding, source: String, manifest: JSONObject, receipt: JSONObject) {
        val id = captureId(source, manifest.getJSONObject("item"))
        require(owner, source, Ingress3Client.fileBatch(manifest), listOf(id), receipt)
        if (manifest.has("sha256") && !manifest.getJSONObject("item").optBoolean("deleted")) {
            val original = receipt.getJSONArray("captures").getJSONObject(0).getJSONObject("original")
            check(original.optString("hash") == manifest.getString("sha256") && original.optLong("bytes", -1) == manifest.getLong("sizeBytes") && original.optString("sourceId") == source && original.optString("captureId") == id && original.optString("ref").matches(Regex("original:[a-f0-9]{64}")))
        }
    }
}
