package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.util.UUID

class CentralImportsAckTest {
    @get:Rule val folder = TemporaryFolder()
    private val cipher = object : ByteCipher {
        override fun seal(bytes: ByteArray) = bytes.map { (it.toInt() xor 91).toByte() }.toByteArray()
        override fun open(bytes: ByteArray) = seal(bytes)
    }
    private val bytes = "GENERATED_ORIGINAL_IMPORT_BYTES".toByteArray()
    private fun prepared(): Pair<File, JSONObject> {
        val dir = folder.newFolder()
        val intent = JSONObject().put("manifest", JSONObject().put("id", UUID.randomUUID().toString()).put("name", "generated.txt").put("sizeBytes", bytes.size).put("mimeType", "text/plain"))
            .put("requestId", UUID.randomUUID().toString()).put("instruction", "Generated original import intent")
        File(dir, "part-0.enc").writeBytes(cipher.seal(bytes)); CentralStateFile(dir, "import", cipher).write(intent)
        return dir to intent
    }
    private fun original(id: String) = JSONObject().put("id", id).put("hash", Ingress3Client.hash(bytes)).put("sizeBytes", bytes.size)
        .put("name", "generated.txt").put("relativePath", "generated.txt").put("mimeType", "text/plain").put("createdAt", "2026-10-16T00:00:00Z")
    private fun receipt(intent: JSONObject, file: JSONObject) = JSONObject().put("id", intent.getString("requestId")).put("status", "queued").put("files", JSONArray().put(file))

    @Test fun `a changed archived file descriptor cannot consume the retained original import intent`() {
        for (corruption in listOf("id", "hash", "sizeBytes", "relativePath", "mimeType")) {
            val (dir, intent) = prepared(); val fileId = UUID.randomUUID().toString(); val file = original(fileId)
            when (corruption) { "id" -> file.put("id", UUID.randomUUID().toString()); "hash" -> file.put("hash", "a".repeat(64)); "sizeBytes" -> file.put("sizeBytes", bytes.size + 1); "relativePath" -> file.put("relativePath", "another.txt"); else -> file.put("mimeType", "audio/wav") }
            var admitted = 0
            val api = CentralClient("https://generated.invalid", "generated-token", { method, url, _, _, _ ->
                200 to when { method == "GET" -> file; url.endsWith("/api/import-uploads") -> JSONObject().put("id", intent.getJSONObject("manifest").getString("id")).put("partBytes", CentralImports.PART).put("parts", JSONArray()).put("fileId", fileId); else -> { admitted++; receipt(intent, file) } }
            })
            assertThrows("Bad original descriptor: " + corruption, Exception::class.java) { CentralImports(dir, cipher).send(api) { _, _ -> } }
            assertEquals(0, admitted); assertEquals(intent.getString("requestId"), CentralImports(dir, cipher).pending().getString("requestId")); assertArrayEquals(bytes, cipher.open(File(dir, "part-0.enc").readBytes()))
        }
    }
    @Test fun `wrong import admission id preserves staged bytes and its original request`() {
        val (dir, intent) = prepared(); val fileId = UUID.randomUUID().toString(); val file = original(fileId)
        val api = CentralClient("https://generated.invalid", "generated-token", { method, url, _, _, _ -> 200 to when {
            method == "GET" -> file
            url.endsWith("/api/import-uploads") -> JSONObject().put("id", intent.getJSONObject("manifest").getString("id")).put("partBytes", CentralImports.PART).put("parts", JSONArray()).put("fileId", fileId)
            else -> receipt(intent, file).put("id", UUID.randomUUID().toString())
        } })
        assertThrows(Exception::class.java) { CentralImports(dir, cipher).send(api) { _, _ -> } }
        assertEquals(intent.getString("requestId"), CentralImports(dir, cipher).pending().getString("requestId")); assertArrayEquals(bytes, cipher.open(File(dir, "part-0.enc").readBytes()))
    }
    @Test fun `lost admission acknowledgement reuses the same verified original and request before clearing local parts`() {
        val (dir, intent) = prepared(); val fileId = UUID.randomUUID().toString(); val file = original(fileId); val requests = mutableListOf<String>(); var lost = true
        val api = CentralClient("https://generated.invalid", "generated-token", { method, url, body, _, _ -> 200 to when {
            method == "GET" -> file
            url.endsWith("/api/import-uploads") -> JSONObject().put("id", intent.getJSONObject("manifest").getString("id")).put("partBytes", CentralImports.PART).put("parts", JSONArray()).put("fileId", fileId)
            else -> { requests.add(JSONObject(String(body!!)).toString()); if (lost) throw java.io.IOException("Generated lost ACK"); receipt(intent, file) }
        } })
        assertThrows(java.io.IOException::class.java) { CentralImports(dir, cipher).send(api) { _, _ -> } }; assertTrue(File(dir, "part-0.enc").exists()); lost = false
        assertEquals(intent.getString("requestId"), CentralImports(dir, cipher).send(api) { _, _ -> }.getString("id")); assertEquals(2, requests.size); assertEquals(requests[0], requests[1]); assertFalse(CentralImports(dir, cipher).pending().has("manifest")); assertFalse(File(dir, "part-0.enc").exists())
    }
}
