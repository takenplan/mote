package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

/** Generated wire replies exercise the current adapter, including packed transport. */
class Ingress3OutcomesTest {
    private val owner = AccountBinding("https://generated.example", "generated-deployment", "generated-a")
    private val device = "generated-phone"
    private val source = "android-capture-${SourceRules.hash(device).take(32)}"

    private fun event(number: Int) = JSONObject()
        .put("id", "00000000-0000-4000-8000-${number.toString().padStart(12, '0')}")
        .put("deviceId", device).put("deviceName", "Generated phone").put("platform", "android")
        .put("source", "note").put("capturedAt", "2026-10-18T00:00:00Z")
        .put("durationMs", 0).put("ocrText", "Generated record $number")

    private fun self() = JSONObject()
        .put("protocol", JSONObject().put("min", 2).put("max", 2))
        .put("capabilities", JSONObject().put("ingest", true).put("ingressVersion", 3))
        .put("credential", JSONObject().put("kind", "client"))
        .put("account", JSONObject().put("deploymentId", owner.deploymentId).put("userId", owner.userId))

    private fun receipt(events: List<JSONObject>): JSONObject {
        val batch = Ingress3Client.batchId(JSONArray(events))
        val identity = SourceRules.hash(JSONArray(listOf(owner.deploymentId, owner.userId, source, batch)).toString())
        return JSONObject().put("version", 3).put("state", "received")
            .put("id", identity).put("deploymentId", owner.deploymentId).put("userId", owner.userId)
            .put("sourceId", source).put("batchId", batch)
            .put("captures", JSONArray(events.map { JSONObject().put("id", it.getString("id")).put("duplicate", false) }))
    }

    private fun adapter(
        packed: Boolean = false,
        enabled: () -> Boolean = { true },
        current: () -> Boolean = { true },
        calls: MutableList<String> = mutableListOf(),
        captureReply: (List<JSONObject>) -> Pair<Int, JSONObject?> = { 200 to receipt(it) },
    ): Ingress3Client {
        val compressed: ((String, String, List<JSONObject>) -> Pair<Int, JSONObject?>)? = if (packed) {
            { path, batch, events ->
                assertEquals("/api/ingress/sources/$source/captures", path)
                assertEquals(Ingress3Client.batchId(JSONArray(events)), batch)
                calls.add("packed captures")
                captureReply(events)
            }
        } else null
        return Ingress3Client(owner, device, "Generated phone", request = { method, path, body ->
            calls.add("$method $path")
            when (path) {
                "/api/connections/self" -> 200 to self()
                "/api/ingress/devices" -> 200 to JSONObject().put("id", device)
                "/api/ingress/sources" -> 200 to JSONObject(body!!.toString()).put("enabled", enabled())
                "/api/ingress/sources/$source/captures" -> {
                    check(!packed) { "Packed transport must use the compressed adapter" }
                    val items = body!!.getJSONArray("items")
                    captureReply((0 until items.length()).map(items::getJSONObject))
                }
                else -> error("Unexpected generated request: $method $path")
            }
        }, current = current, compressed = compressed)
    }

    @Test fun disabledRegistrationIsAPauseAndDoesNotSettleOrSubmitAnyCapture() {
        for (packed in listOf(false, true)) {
            var uploads = 0
            val outcomes = mutableListOf<Int>()
            val client = adapter(packed, enabled = { false }) { uploads++; 200 to receipt(it) }
            val failure = assertThrows(FileIngressRejection::class.java) {
                client.settleCaptures(listOf(event(1), event(2))) { _, status -> outcomes.add(status) }
            }
            assertEquals(409, failure.httpStatus)
            assertEquals("source_paused", failure.code)
            assertTrue(failure.paused)
            assertEquals(0, uploads)
            assertTrue(outcomes.isEmpty())
        }
    }

    @Test fun explicitRejectionsPreserveStatusAndCodeForBothTransports() {
        for (packed in listOf(false, true)) for ((status, code) in listOf(
            409 to "conflict", 410 to "file_forgotten", 426 to "unsupported_ingress",
        )) {
            val failure = assertThrows(FileIngressRejection::class.java) {
                adapter(packed) { status to JSONObject().put("error", code) }.captures(listOf(event(1)))
            }
            assertEquals(status, failure.httpStatus)
            assertEquals(code, failure.code)
            assertFalse(failure.paused)
        }
    }

    @Test fun serviceUnavailabilityRemainsTransportFailureAndNeverSettlesARecord() {
        for (packed in listOf(false, true)) {
            val outcomes = mutableListOf<Int>()
            val failure = assertThrows(FileTransportFailure::class.java) {
                adapter(packed) { 503 to JSONObject().put("error", "generated_unavailable") }
                    .settleCaptures(listOf(event(1), event(2))) { _, status -> outcomes.add(status) }
            }
            assertFalse(failure is FileIngressRejection)
            assertEquals(503, failure.httpStatus)
            assertEquals("generated_unavailable", failure.code)
            assertTrue(outcomes.isEmpty())
        }
    }

    @Test fun retiredOwnerCannotTurnALateSuccessOrRejectionIntoASettledOutcome() {
        for (packed in listOf(false, true)) for (status in listOf(200, 409, 410)) {
            var selected = true
            val outcomes = mutableListOf<Int>()
            val client = adapter(packed, current = { selected }) {
                selected = false
                status to if (status == 200) receipt(it) else JSONObject().put("error", "conflict")
            }
            val failure = assertThrows(IllegalStateException::class.java) {
                client.settleCaptures(listOf(event(1), event(2))) { _, result -> outcomes.add(result) }
            }
            assertFalse(failure is FileTransportFailure)
            assertTrue(outcomes.isEmpty())
        }
        val calls = mutableListOf<String>()
        assertThrows(IllegalStateException::class.java) {
            adapter(current = { false }, calls = calls).settleCaptures(listOf(event(1))) { _, _ -> fail("Retired owner settled a record") }
        }
        assertTrue(calls.isEmpty())
    }

    @Test fun successfulPackedBatchIsVerifiedAndSettledWithoutSplitting() {
        val records = listOf(event(1), event(2), event(3))
        val submitted = mutableListOf<List<String>>()
        val outcomes = mutableListOf<Pair<String, Int>>()
        adapter(packed = true) { events ->
            submitted.add(events.map { it.getString("id") })
            200 to receipt(events)
        }.settleCaptures(records) { record, status -> outcomes.add(record.getString("id") to status) }
        assertEquals(listOf(records.map { it.getString("id") }), submitted)
        assertEquals(records.map { it.getString("id") to 200 }, outcomes)
    }

    @Test fun mixedSuccessConflictAndForgottenRecordsSettleIndividuallyAndContinueToLaterRecords() {
        for (packed in listOf(false, true)) {
            val records = (1..4).map(::event)
            val statuses = records.mapIndexed { index, record -> record.getString("id") to listOf(200, 409, 410, 200)[index] }.toMap()
            val submitted = mutableListOf<List<String>>()
            val outcomes = mutableListOf<Pair<String, Int>>()
            adapter(packed) { events ->
                submitted.add(events.map { it.getString("id") })
                val rejected = events.map { statuses.getValue(it.getString("id")) }.firstOrNull { it != 200 }
                if (rejected == null) 200 to receipt(events) else rejected to JSONObject().put("error", if (rejected == 410) "file_forgotten" else "conflict")
            }.settleCaptures(records) { record, status -> outcomes.add(record.getString("id") to status) }
            assertEquals(records.map { it.getString("id") to statuses.getValue(it.getString("id")) }, outcomes)
            assertEquals(7, submitted.size)
            assertEquals(records.map { it.getString("id") }, submitted.first())
        }
    }

    @Test fun earlierAcknowledgementIsPublishedBeforeALaterNetworkException() {
        for (packed in listOf(false, true)) {
            val records = listOf(event(1), event(2))
            val outcomes = mutableListOf<Pair<String, Int>>()
            val network = IOException("Generated connection closed")
            val failure = assertThrows(IOException::class.java) {
                adapter(packed) { events ->
                    when {
                        events.size > 1 -> 413 to JSONObject().put("error", "generated_batch_too_large")
                        events.single().getString("id") == records.first().getString("id") -> 200 to receipt(events)
                        else -> { assertEquals(listOf(records.first().getString("id") to 200), outcomes); throw network }
                    }
                }.settleCaptures(records) { record, status -> outcomes.add(record.getString("id") to status) }
            }
            assertSame(network, failure)
            assertEquals(listOf(records.first().getString("id") to 200), outcomes)
        }
    }

    @Test fun anOversizedSingleRecordRemainsUnsettledForBothTransports() {
        for (packed in listOf(false, true)) {
            val outcomes = mutableListOf<Int>()
            val failure = assertThrows(FileTransportFailure::class.java) {
                adapter(packed) { 413 to JSONObject().put("error", "generated_record_too_large") }
                    .settleCaptures(listOf(event(1))) { _, status -> outcomes.add(status) }
            }
            assertEquals(413, failure.httpStatus)
            assertFalse(failure is FileIngressRejection)
            assertTrue(outcomes.isEmpty())
        }
    }

    @Test fun pauseDuringSplitKeepsEarlierAcknowledgementWithoutQuarantiningRemainingRecords() {
        for (packed in listOf(false, true)) {
            val records = listOf(event(1), event(2))
            var paused = false
            val outcomes = mutableListOf<Pair<String, Int>>()
            val failure = assertThrows(FileIngressRejection::class.java) {
                adapter(packed, enabled = { !paused }) { events ->
                    if (events.size > 1) 409 to JSONObject().put("error", "conflict")
                    else { paused = true; 200 to receipt(events) }
                }.settleCaptures(records) { record, status -> outcomes.add(record.getString("id") to status) }
            }
            assertTrue(failure.paused)
            assertEquals(listOf(records.first().getString("id") to 200), outcomes)
        }
    }
    @Test fun pauseAfterSuccessfulRegistrationDoesNotQuarantineTheSingletonCapture() {
        for (packed in listOf(false, true)) {
            var enabled = true
            val outcomes = mutableListOf<Int>()
            val client = adapter(packed, enabled = { enabled }) {
                enabled = false
                409 to JSONObject().put("error", "conflict")
            }
            val failure = assertThrows(FileIngressRejection::class.java) {
                client.settleCaptures(listOf(event(1))) { _, status -> outcomes.add(status) }
            }
            assertTrue(failure.paused); assertTrue(outcomes.isEmpty())
        }
    }
    @Test fun expiredTransportAttemptRemainsRetryableWithoutBecomingAPermanentRevisionRejection() {
        val failure = assertThrows(FileTransportFailure::class.java) {
            adapter(captureReply = { 409 to JSONObject().put("error", "upload_expired") }).send("POST", "/api/ingress/sources/$source/captures", JSONObject().put("items", JSONArray().put(event(1))))
        }
        assertEquals(409, failure.httpStatus); assertEquals("upload_expired", failure.code)
        assertFalse(failure is FileIngressRejection)
    }
    @Test fun personalPreferenceIdentitySurvivesVerifiedOriginAndCredentialChanges() {
        assertEquals(owner.preferenceKey, owner.copy(origin = "https://new-generated.example").preferenceKey)
        assertNotEquals(owner.preferenceKey, owner.copy(userId = "generated-b").preferenceKey)
        assertNotEquals(owner.preferenceKey, owner.copy(deploymentId = "replacement-deployment").preferenceKey)
    }

}
