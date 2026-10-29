package dev.mote.collector

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class CaptureContextSyncTest {
    @get:Rule val folder = TemporaryFolder()
    private val cipher = object : ByteCipher {
        override fun seal(bytes: ByteArray) = bytes.map { (it.toInt() xor 91).toByte() }.toByteArray()
        override fun open(bytes: ByteArray) = seal(bytes)
    }
    private val origin = "https://generated.example"
    private val device = "generated-device"
    private val channel = CaptureContextChannel.SCREEN
    private fun snapshot(version: Int, text: String, sourceId: String = "generated-host-source") = SourceContextSnapshot(sourceId, version, text, if (version == 0) null else "a".repeat(64))
    private fun pending(store: CaptureContextStore, text: String, target: String = origin): CaptureContextEntry {
        store.edit(target, device, channel, text)
        return store.saveDraft(target, device, channel)
    }
    @Test fun unboundDraftStaysPrivateAndOnlyExplicitBindingMakesItEligibleForOneTarget() {
        val directory = folder.newFolder(); var store = CaptureContextStore(directory, cipher)
        store.edit("", device, channel, "Generated owner background")
        assertTrue(store.hasPendingConnectionWork()); assertTrue(store.pending(origin, device, true).isEmpty())
        store.saveDraft("", device, channel)
        store = CaptureContextStore(directory, cipher)
        assertTrue(store.pending(origin, device).isEmpty()); assertEquals(1, store.pending(origin, device, true).size)
        assertFalse(directory.listFiles()!!.any { String(it.readBytes()).contains("Generated owner background") })
        store.bindLocal(origin, device)
        assertEquals("Generated owner background", store.pending(origin, device).single().description)
        assertTrue(store.pending("https://other.example", device).isEmpty())
        assertTrue(store.pending(origin, "other-device").isEmpty())
        assertEquals("", store.entry(origin, device, CaptureContextChannel.ACTIVITY).description)
    }
    @Test fun sourceRegistrationFailureKeepsLocalDescriptionAndNeverSubmitsCaptureMetadata() {
        val store = CaptureContextStore(folder.newFolder(), cipher); val item = pending(store, "A screenshot source")
        var calls = 0
        val failure = assertThrows(CentralFailure::class.java) {
            CaptureContextSync.sync(store, item, { true }) { method, url, body ->
                calls++; assertEquals("GET", method); assertTrue(url.endsWith("/api/devices/generated-device/capture-context/screen")); assertNull(body); 404 to null
            }
        }
        assertEquals(404, failure.status); assertEquals(1, calls)
        assertEquals(item, store.entry(origin, device, channel)); assertTrue(store.hasPendingConnectionWork())
    }
    @Test fun lostAckRetriesTheSameVersionAndClearingIsAnExplicitVersionedWrite() {
        val directory = folder.newFolder(); var store = CaptureContextStore(directory, cipher)
        val empty = store.entry(origin, device, channel); store.receive(empty, snapshot(3, "Old description"))
        val item = pending(store, "New background")
        assertThrows(java.io.IOException::class.java) {
            CaptureContextSync.sync(store, item, { true }) { method, _, body ->
                assertEquals("PATCH", method); assertEquals(3, body!!.getInt("expectedVersion")); throw java.io.IOException("Generated lost ACK")
            }
        }
        store = CaptureContextStore(directory, cipher)
        assertTrue(CaptureContextSync.sync(store, store.entry(origin, device, channel), { true }) { method, _, body ->
            assertEquals("PATCH", method); assertEquals(3, body!!.getInt("expectedVersion")); 200 to snapshot(4, "New background").json()
        })
        val clear = pending(store, "")
        assertTrue(CaptureContextSync.sync(store, clear, { true }) { _, _, body ->
            assertEquals(4, body!!.getInt("expectedVersion")); assertEquals("", body.getString("description")); 200 to snapshot(5, "").json()
        })
        assertFalse(store.hasPendingConnectionWork()); assertEquals(5, store.entry(origin, device, channel).accepted!!.version)
    }
    @Test fun remoteConflictAnd403KeepEveryLocalFieldUntilAnExplicitChoice() {
        val store = CaptureContextStore(folder.newFolder(), cipher)
        store.receive(store.entry(origin, device, channel), snapshot(1, "Old"))
        var item = pending(store, "Owner local description")
        val denied = assertThrows(CentralFailure::class.java) { CaptureContextSync.sync(store, item, { true }) { _, _, _ -> 403 to null } }
        assertEquals(403, denied.status); assertEquals(item, store.entry(origin, device, channel))
        val calls = mutableListOf<String>()
        assertFalse(CaptureContextSync.sync(store, item, { true }) { method, _, _ -> calls += method; if (method == "PATCH") 409 to null else 200 to snapshot(2, "Other owner edit").json() })
        assertEquals(listOf("PATCH", "GET"), calls)
        item = store.entry(origin, device, channel)
        assertEquals("Owner local description", item.description); assertEquals("Owner local description", item.draft)
        assertEquals("Other owner edit", item.conflict!!.description)
        assertFalse(CaptureContextSync.sync(store, item, { true }) { _, _, _ -> error("No automatic overwrite while a choice is pending") })
        val resolved = store.resolve(item, true)
        assertTrue(CaptureContextSync.sync(store, resolved, { true }) { _, _, body -> assertEquals(2, body!!.getInt("expectedVersion")); 200 to snapshot(3, resolved.description).json() })
    }
    @Test fun newNodeRemoteDescriptionIsReadFirstAndUnsavedDraftNeverBecomesASubmission() {
        val store = CaptureContextStore(folder.newFolder(), cipher)
        pending(store, "Old node background")
        val other = "https://other.example"
        store.edit(other, device, channel, "Unsubmitted other-node draft")
        val current = CaptureContextSync.read(store, store.entry(other, device, channel), { true }) { method, _, _ ->
            assertEquals("GET", method); 200 to snapshot(4, "Already present at new node", "other-source").json()
        }
        assertEquals("Already present at new node", current.description); assertEquals("Unsubmitted other-node draft", current.draft)
        assertFalse(current.pending)
        assertTrue(CaptureContextSync.sync(store, current, { true }) { _, _, _ -> error("A draft is not an authorized submission") })
        assertEquals("Old node background", store.pending(origin, device).single().description)
    }
    @Test fun changedSessionStaleAcknowledgmentAndMalformedSourceCannotConfirmNewerInput() {
        val store = CaptureContextStore(folder.newFolder(), cipher)
        store.receive(store.entry(origin, device, channel), snapshot(1, "Old")); val item = pending(store, "First edit")
        var selected = true
        assertThrows(IllegalStateException::class.java) {
            CaptureContextSync.sync(store, item, { selected }) { _, _, _ -> selected = false; 200 to snapshot(2, item.description).json() }
        }
        assertTrue(store.entry(origin, device, channel).pending)
        assertThrows(IllegalArgumentException::class.java) { store.acknowledge(item, snapshot(2, item.description, "wrong-source")) }
        assertThrows(IllegalArgumentException::class.java) { store.acknowledge(item, snapshot(1, item.description)) }
        val newer = pending(store, "Newer edit")
        assertFalse(store.acknowledge(item, snapshot(2, item.description)))
        assertEquals(newer, store.entry(origin, device, channel))
        assertThrows(IllegalArgumentException::class.java) { store.edit(origin, device, channel, "x".repeat(12001)) }
        assertEquals(newer, store.entry(origin, device, channel))
    }
    @Test fun acceptingRemoteConflictIsExplicitAndLeavesOtherChannelsAlone() {
        val store = CaptureContextStore(folder.newFolder(), cipher); val item = pending(store, "Local")
        store.edit(origin, device, CaptureContextChannel.NOTIFICATIONS, "Separate notification draft")
        store.conflict(item, snapshot(2, "Remote"))
        val resolved = store.resolve(store.entry(origin, device, channel), false)
        assertEquals("Remote", resolved.description); assertEquals("Remote", resolved.draft); assertFalse(resolved.pending)
        assertEquals("Separate notification draft", store.entry(origin, device, CaptureContextChannel.NOTIFICATIONS).draft)
    }
}
