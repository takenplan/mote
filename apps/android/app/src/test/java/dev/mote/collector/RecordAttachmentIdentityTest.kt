package dev.mote.collector

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.util.UUID

class RecordAttachmentIdentityTest {
    @get:Rule val folder = TemporaryFolder()
    @Test fun `same original in different notes has independent revision identity while lost ACK retries exact manifest`() {
        val file = folder.newFile("generated.txt").apply { writeText("generated same original") }
        val received = mutableMapOf<String, String>(); var loseAck = true
        val client = CentralClient("https://fixture.example", "generated-token", transport = { _, url, bytes, _, _ ->
            when {
                url.endsWith("/api/sources") -> 200 to JSONObject()
                url.endsWith("/api/file-sync/v1/uploads") -> {
                    val manifest = JSONObject(String(bytes!!)); val external = manifest.getJSONObject("item").getString("externalId")
                    val previous = received.putIfAbsent(external, manifest.toString())
                    if (previous != null) assertEquals("Retry must preserve observedAt and the whole manifest", previous, manifest.toString())
                    if (loseAck) { loseAck = false; throw java.io.IOException("Generated lost ACK") }
                    200 to JSONObject().put("ack", JSONObject().put("captureId", UUID.nameUUIDFromBytes(external.toByteArray()).toString()))
                }
                else -> error("Unexpected real transport path")
            }
        })
        val first = UUID.randomUUID().toString(); val second = UUID.randomUUID().toString()
        assertThrows(java.io.IOException::class.java) { CentralAttachments.upload(client, file, "same.txt", "text/plain", "fixture-device", { 1000L }, identityScope = first) }
        val retry = CentralAttachments.upload(client, file, "same.txt", "text/plain", "fixture-device", { 1000L }, identityScope = first)
        val other = CentralAttachments.upload(client, file, "same.txt", "text/plain", "fixture-device", { 2000L }, identityScope = second)
        assertNotEquals(retry, other); assertEquals(2, received.size)
    }
}
