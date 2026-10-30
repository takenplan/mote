package dev.mote.collector

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.File

class SyncReadinessTest {
    private val connected = CollectorConfig(deviceName = "Generated fixture", server = "http://127.0.0.1:47843",
        token = "generated-android-node-token-1234567890", debugHttp = true, wifiOnly = false, syncMode = "batch")
    private val disconnected = connected.copy(server = "", token = "")
    private val old = StoredSyncStatus("unconfigured", SyncReadiness.NOT_CONFIGURED)
    private val empty = QueueInventory(0, 0, 0, 0, 0, 0, 0, 0)
    private val translations = listOf("en", "de", "es", "fr", "ja", "ru").map { language ->
        JSONObject(File("src/main/assets/i18n-$language.json").readText())
    }
    private fun matches(source: String, text: String) = source == text || translations.any { it.optString(source) == text }
    private fun visible(config: CollectorConfig, status: StoredSyncStatus, inventory: QueueInventory? = empty, waiting: String? = null) =
        SyncReadiness.visible(config, status, waiting, inventory, matches = ::matches)
    private fun heartbeat(config: CollectorConfig, status: StoredSyncStatus, blocked: Int = 0, pending: PendingSync = PendingSync(0, null)) =
        SyncReadiness.heartbeatState(config, status, blocked, pending, ::matches)

    @Test fun pairingWithEmptyQueueProjectsANeutralStatusWithoutChangingTheStoredValue() {
        assertEquals(VisibleSyncStatus.Disconnected, visible(disconnected, old))
        assertNull(connected.syncPolicy().delayMillis(1000, 0, null, 0))
        assertEquals(VisibleSyncStatus.SendAsConfigured, visible(connected, old))
        assertEquals("idle", heartbeat(connected, old))
        assertEquals("unconfigured", old.state)
        // A fresh reader after restart sees the same stored status and projects it again.
        assertEquals(VisibleSyncStatus.SendAsConfigured, visible(connected, old.copy()))
        assertFalse(SyncReadiness.text(VisibleSyncStatus.SendAsConfigured).contains("确认"))
    }

    @Test fun logoutAndExpiredCredentialsDoNotLookLikeAConfiguredConnection() {
        for (config in listOf(disconnected, connected.copy(authSignedOut = true), connected.copy(authExpiresAt = 1))) {
            assertEquals(VisibleSyncStatus.Disconnected, visible(config, old))
            assertEquals("unconfigured", heartbeat(config, old))
        }
    }

    @Test fun actualErrorsUnknownMessagesAndPauseOrWifiRestrictionsArePreserved() {
        val error = StoredSyncStatus("error", "Generated transport error; records retained")
        val custom = StoredSyncStatus("unconfigured", "Generated scheduling error; retry")
        val acknowledgement = StoredSyncStatus("uploading", "已收到上传确认")
        for (status in listOf(error, custom, acknowledgement, StoredSyncStatus("paused", "Generated pause error; retry"))) {
            assertEquals(VisibleSyncStatus.Message(status.message), visible(connected, status))
            assertEquals(status.state, heartbeat(connected, status))
        }
        val wait = SyncConditions(false, false, true).waitingReason(false, null, false)
        assertEquals(VisibleSyncStatus.Message("等待非计费 Wi-Fi"), visible(connected, old, waiting = wait))
        assertEquals(VisibleSyncStatus.Message("已暂停全部发送 · 本机继续保存"),
            visible(connected.copy(syncPaused = true), old, waiting = "已暂停全部发送 · 本机继续保存"))
        assertEquals("unconfigured", heartbeat(connected.copy(syncPaused = true), old))
    }

    @Test fun resumingARecognisedPauseUsesCurrentConnectionAndPreservesBlockedRecords() {
        val paused = StoredSyncStatus("paused", SyncReadiness.PAUSED)
        assertEquals(VisibleSyncStatus.Message(paused.message), visible(connected.copy(syncPaused = true), paused))
        assertEquals("paused", heartbeat(connected.copy(syncPaused = true), paused))
        assertEquals(VisibleSyncStatus.SendAsConfigured, visible(connected, paused))
        assertEquals("idle", heartbeat(connected, paused))
        assertEquals(VisibleSyncStatus.NeedsAttention(1, 0), visible(connected, paused, empty.copy(blocked = 1)))
        assertEquals("error", heartbeat(connected, paused, blocked = 1))
        assertEquals(VisibleSyncStatus.Disconnected, visible(connected.copy(authSignedOut = true), paused))
        assertEquals("unconfigured", heartbeat(connected.copy(authSignedOut = true), paused))
        assertEquals("paused", paused.state)
    }

    @Test fun blockedRecordsAndPendingWorkAreNotPresentedAsCompleted() {
        assertEquals(VisibleSyncStatus.Loading, visible(connected, old, inventory = null))
        assertEquals(VisibleSyncStatus.Unavailable, SyncReadiness.visible(connected, old, null, empty, inventoryUnavailable = true, matches = ::matches))
        assertEquals(VisibleSyncStatus.NeedsAttention(2, 3), visible(connected, old, empty.copy(blocked = 2, pending = 3)))
        assertEquals("error", heartbeat(connected, old, blocked = 2))
        assertEquals("waiting", heartbeat(connected, old, pending = PendingSync(1, 100)))
        assertEquals("waiting", heartbeat(connected, old, pending = PendingSync(0, 100, pendingUpdates = 1)))
    }

    @Test fun persistedLabelsFromAnySupportedLanguageAreProjectedWithoutRewritingThem() {
        for (key in SyncReadiness.obsoleteMessages) for (catalog in translations) {
            val status = StoredSyncStatus(if (key == SyncReadiness.PAUSED) "paused" else "unconfigured", catalog.getString(key))
            assertEquals(VisibleSyncStatus.SendAsConfigured, visible(connected, status))
            assertEquals("idle", heartbeat(connected, status))
            assertEquals(catalog.getString(key), status.message)
        }
        // The output is an authored key resolved at display time, not a persisted translation.
        assertEquals("Send according to settings", translations.first().getString("按设置发送"))
    }
}
