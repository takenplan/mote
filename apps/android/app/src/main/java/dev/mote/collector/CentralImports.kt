package dev.mote.collector

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID

/** Durable, encrypted, bounded upload parts; retries preserve both upload and admission IDs. */
internal class CentralImports(private val directory: File, private val cipher: ByteCipher) {
    private val state = CentralStateFile(directory, "import", cipher)
    fun pending(): JSONObject = state.read()
    fun stagePortable(context: Context, uri: Uri, operationId: String? = null): JSONObject {
        operationId?.let(UUID::fromString)
        return stage(context, uri, "").apply { operationId?.let { put("requestId", it) }; put("kind", "portable") }.also(state::write)
    }
    fun sendPortable(client: CentralClient): JSONObject {
        val saved = pending(); require(saved.getString("kind") == "portable")
        val size = saved.getJSONObject("manifest").getLong("sizeBytes"); require(size in 1..MAX)
        val bytes = java.io.ByteArrayOutputStream()
        val total = ((size + PART - 1) / PART).toInt()
        repeat(total) { part ->
            val chunk = cipher.open(File(directory, "part-$part.enc").readBytes())
            require(chunk.size.toLong() == minOf(PART.toLong(), size - bytes.size())); bytes.write(chunk)
        }
        require(bytes.size().toLong() == size)
        val receipt = CentralPortable(client).importArchive(saved.getString("requestId"), JSONObject(bytes.toString(Charsets.UTF_8.name())))
        if (receipt.getString("state") == "completed") discard()
        return receipt
    }
    fun stage(context: Context, uri: Uri, instruction: String): JSONObject {
        check(!pending().has("manifest")) { MoteI18n.text("请先重试或放弃待导入文件。") }
        directory.mkdirs(); directory.listFiles()?.filter { it.name.startsWith("part-") }?.forEach { it.delete() }
        val name = context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use {
            if (it.moveToFirst()) it.getString(0) else null
        } ?: "import"
        val mime = context.contentResolver.getType(uri)
        var size = 0L; var part = 0
        try {
            requireNotNull(context.contentResolver.openInputStream(uri)).use { input ->
                while (true) {
                    val bytes = ByteArray(PART); var offset = 0
                    while (offset < bytes.size) { val count = input.read(bytes, offset, bytes.size - offset); if (count < 0) break; offset += count }
                    if (offset == 0) break
                    size += offset; require(size <= MAX) { MoteI18n.text("导入文件最多 64 MiB。") }
                    File(directory, "part-${part++}.enc").outputStream().use { it.write(cipher.seal(bytes.copyOf(offset))) }
                }
            }
            val manifest = JSONObject().put("id", UUID.randomUUID().toString()).put("name", name).put("sizeBytes", size)
            mime?.let { manifest.put("mimeType", it) }
            return JSONObject().put("manifest", manifest).put("requestId", UUID.randomUUID().toString()).put("instruction", instruction).also(state::write)
        } catch (error: Throwable) { discard(); throw error }
    }
    fun send(client: CentralClient, progress: (Int, Int) -> Unit): JSONObject {
        val saved = pending(); val manifest = saved.getJSONObject("manifest")
        val id = manifest.getString("id"); UUID.fromString(id)
        val requestId = saved.getString("requestId"); UUID.fromString(requestId)
        val size = manifest.getLong("sizeBytes"); require(size in 0..MAX)
        val total = ((size + PART - 1) / PART).toInt()
        val digest = java.security.MessageDigest.getInstance("SHA-256")
        val hashes = (0 until total).map { part ->
            val bytes = cipher.open(File(directory, "part-$part.enc").readBytes())
            require(bytes.size.toLong() == minOf(PART.toLong(), size - part.toLong() * PART))
            digest.update(bytes); Ingress3Client.hash(bytes)
        }
        val hash = digest.digest().joinToString("") { "%02x".format(it) }
        fun verifyOriginal(value: JSONObject, expectedId: String): JSONObject {
            UUID.fromString(expectedId)
            require(value.getString("id") == expectedId && value.getString("hash") == hash && value.getLong("sizeBytes") == size)
            require(value.getString("relativePath") == manifest.getString("name") && value.getString("name") == manifest.getString("name").substringAfterLast('/'))
            require(value.getString("mimeType") == manifest.optString("mimeType", "application/octet-stream").ifBlank { "application/octet-stream" })
            return value
        }
        val upload = client.post("/api/import-uploads", manifest)
        require(upload.getString("id") == id && upload.getInt("partBytes") == PART)
        val received = upload.getJSONArray("parts").let { parts ->
            (0 until parts.length()).map { index ->
                val part = parts.getJSONObject(index); val position = part.getInt("part")
                require(position in 0 until total && part.getString("hash") == hashes[position] && part.getLong("bytes") == minOf(PART.toLong(), size - position.toLong() * PART))
                position
            }.also { require(it.toSet().size == it.size) }.toSet()
        }
        if (upload.optString("fileId").isBlank()) repeat(total) { part ->
            if (part !in received) {
                val bytes = cipher.open(File(directory, "part-$part.enc").readBytes()); require(Ingress3Client.hash(bytes) == hashes[part])
                val ack = client.bytes("PUT", "/api/import-uploads/$id/parts/$part", bytes, "application/octet-stream")
                require(ack.getInt("part") == part && ack.getLong("bytes") == bytes.size.toLong() && ack.getString("hash") == hashes[part])
            }
            progress(part + 1, total)
        }
        val file = upload.optString("fileId").takeIf(String::isNotBlank)?.let { verifyOriginal(client.get("/api/archived-files/" + it), it) }
            ?: client.post("/api/import-uploads/$id/commit").let { verifyOriginal(it, it.getString("id")) }
        val fileId = file.getString("id")
        val request = JSONObject().put("requestId", requestId).put("processing", "preview")
            .put("instruction", saved.getString("instruction")).put("archivedFileIds", JSONArray().put(fileId))
        val result = client.post("/api/imports", request)
        require(result.getString("id") == requestId && result.getString("status") in setOf("queued", "preparing", "awaiting_confirmation", "importing", "completed", "failed", "cancelled", "needs_configuration", "unsupported"))
        val originals = result.getJSONArray("files")
        val matching = (0 until originals.length()).map(originals::getJSONObject).single { it.getString("id") == fileId }
        verifyOriginal(matching, fileId)
        discard(); return result
    }
    fun discard() { directory.listFiles()?.forEach { check(it.delete()) }; }
    companion object { const val PART = 4 * 1024 * 1024; const val MAX = 64 * 1024 * 1024L }
}
