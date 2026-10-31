package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

class CaptureOverviewTest {
    private val zone = ZoneId.of("Asia/Shanghai")
    private val now = Instant.parse("2026-10-31T08:00:00Z")
    private val pausedToday = Instant.parse("2026-10-31T04:30:00Z").toEpochMilli()
    private fun facts(enabled: Boolean = true, state: String = "capturing", used: Boolean = true, screenSelected: Boolean = true, screenLive: Boolean = true,
        projection: Boolean = false, pausedAt: Long? = null, notifications: Boolean = true, systemLive: Boolean = true, queueFull: Boolean = false, folders: Int = 2,
        connected: Boolean = true, sendPaused: Boolean = false, sendState: String = "idle", pending: Int? = 0, acknowledged: Boolean = true) =
        CaptureOverview.Facts(enabled, state, "生成的状态说明", used, screenSelected, screenLive, projection, pausedAt, notifications, false, false, systemLive,
            queueFull, folders, connected, sendPaused, sendState, pending, acknowledged)

    @Test fun normalCaptureIsOneQuietLineWithoutAnAction() {
        val line = CaptureOverview.line(facts(), now, zone)
        assertEquals(CaptureOverview.Kind.ACTIVE, line.kind)
        assertEquals("采集中", line.title)
        assertEquals("屏幕、通知、2 个文件夹", line.detail)
        assertEquals("已同步", line.send)
        assertNull("Normal capture never asks for a step", line.action)
    }

    @Test fun captureThatWasNeverUsedStaysOffTheHome() {
        assertEquals(CaptureOverview.Kind.HIDDEN, CaptureOverview.kind(facts(enabled = false, state = "paused", used = false, folders = 0)))
    }

    @Test fun anIntentionalStopIsQuietButOffersResume() {
        val line = CaptureOverview.line(facts(enabled = false, state = "paused", screenLive = false, systemLive = false), now, zone)
        assertEquals(CaptureOverview.Kind.PAUSED, line.kind)
        assertEquals("文件夹照常同步", line.detail)
        assertEquals(CaptureOverview.Action.RESUME, line.action)
        assertNotEquals("A pause is not an error", CaptureOverview.Kind.ATTENTION, line.kind)
    }

    @Test fun aTemporaryScreenPauseKeepsOtherSourcesAndNamesTheTime() {
        val line = CaptureOverview.line(facts(screenSelected = false, screenLive = false, pausedAt = pausedToday), now, zone)
        assertEquals(CaptureOverview.Kind.SCREEN_PAUSED, line.kind)
        assertEquals("屏幕采集已暂停", line.title)
        assertEquals("12:30 起 · 其他来源照常采集", line.detail)
        assertEquals(CaptureOverview.Action.RESUME, line.action)
        val only = CaptureOverview.line(facts(enabled = false, state = "paused", screenSelected = false, screenLive = false, pausedAt = pausedToday, notifications = false, systemLive = false), now, zone)
        assertEquals("When the screen was the only source, nothing else is claimed to continue", "12:30 起", only.detail)
    }

    @Test fun stoppingEverythingAfterAScreenPauseIsAFullPause() {
        val stopped = facts(enabled = false, state = "paused", screenSelected = false, screenLive = false, pausedAt = pausedToday, systemLive = false)
        val line = CaptureOverview.line(stopped, now, zone)
        assertEquals("Notifications are still selected, so collection as a whole was stopped", CaptureOverview.Kind.PAUSED, line.kind)
        assertEquals("采集已暂停", line.title)
        assertEquals(CaptureOverview.Action.RESUME, line.action)
        assertFalse("The screen row does not offer a second, partial resume", CaptureOverview.screenPaused(stopped))
    }

    @Test fun turningScreenCaptureOffInSettingsIsNotAPause() {
        val line = CaptureOverview.line(facts(screenSelected = false, screenLive = false, pausedAt = null), now, zone)
        assertEquals(CaptureOverview.Kind.ACTIVE, line.kind)
        assertFalse(line.detail.contains("屏幕"))
    }

    @Test fun interruptionsOfferTheMatchingRepair() {
        val stopped = CaptureOverview.line(facts(enabled = false, state = "permission_required", screenLive = false, systemLive = false), now, zone)
        assertEquals(CaptureOverview.Kind.ATTENTION, stopped.kind)
        assertEquals("采集已中断", stopped.title)
        assertEquals("生成的状态说明", stopped.detail)
        assertEquals(CaptureOverview.Action.RESTART, stopped.action)
        val projection = CaptureOverview.line(facts(projection = true, screenLive = false), now, zone)
        assertEquals("部分来源等待权限", projection.title)
        assertEquals("A projection session needs a new system consent", CaptureOverview.Action.RESTART, projection.action)
        val accessibility = CaptureOverview.line(facts(screenLive = false, notifications = false, systemLive = false), now, zone)
        assertEquals("等待采集权限", accessibility.title)
        assertEquals(CaptureOverview.Action.PERMISSIONS, accessibility.action)
        val full = CaptureOverview.line(facts(queueFull = true), now, zone)
        assertEquals("本机空间已满", full.title)
        assertEquals(CaptureOverview.Action.STORAGE, full.action)
    }

    @Test fun sendingIsReportedAsItIsWithoutClaimingAcknowledgement() {
        assertEquals("仅保存在本机" to false, CaptureOverview.send(facts(connected = false)))
        assertEquals("发送已暂停" to false, CaptureOverview.send(facts(sendPaused = true)))
        assertEquals("发送需要处理" to true, CaptureOverview.send(facts(sendState = "blocked")))
        assertEquals("待同步 3 条" to false, CaptureOverview.send(facts(pending = 3)))
        assertEquals("An unread queue makes no claim", "" to false, CaptureOverview.send(facts(pending = null)))
        assertEquals("Nothing was acknowledged yet", "" to false, CaptureOverview.send(facts(acknowledged = false)))
    }

    @Test fun pausesOnEarlierDaysShowTheDate() {
        val yesterday = Instant.parse("2026-10-30T04:30:00Z").toEpochMilli()
        val label = CaptureOverview.since(yesterday, now, zone)
        assertTrue(label.endsWith(" 起"))
        assertNotEquals("12:30 起", label)
    }

    @Test fun onlyProposalsMissingTimeWaitForTheOwner() {
        fun action(id: String, status: String = "proposed", kind: String = "calendar.create", start: Any? = "2026-11-01T07:00:00Z", end: Any? = JSONObject.NULL, resolution: String? = null) =
            JSONObject().put("id", id).put("status", status).put("kind", kind).apply { resolution?.let { put("resolution", it) } }
                .put("event", JSONObject().put("title", "生成的安排 $id").put("start", start ?: JSONObject.NULL).put("end", end ?: JSONObject.NULL))
        val items = JSONArray()
            .put(action("missing-end"))
            .put(action("missing-start", kind = "calendar.update", start = null, end = "2026-11-01T08:00:00Z"))
            .put(action("complete", end = "2026-11-01T08:00:00Z"))
            .put(action("resolved", resolution = "dismissed"))
            .put(action("approved", status = "approved"))
            .put(action("cancel", kind = "calendar.cancel"))
        assertEquals(listOf("missing-end", "missing-start"), CalendarNeeds.missingTime(items).map { it.getString("id") })
    }

    @Test fun olderNeedsAreFoundWithinABoundedScan() {
        fun proposal(id: String, status: String = "proposed") = JSONObject().put("id", id).put("status", status).put("kind", "calendar.create")
            .put("event", JSONObject().put("title", "生成的安排 $id").put("start", "2026-11-01T07:00:00Z").put("end", JSONObject.NULL))
        fun page(next: Long?, items: List<JSONObject>) = JSONObject().put("items", JSONArray(items)).put("nextCursor", next ?: JSONObject.NULL)
        val settled = (1..20).map { proposal("settled-$it", status = "approved") }
        val history = mapOf(0L to page(40, settled), 40L to page(20, listOf(proposal("older"))), 20L to page(null, listOf(proposal("oldest"))))
        val read = mutableListOf<Long>()
        assertEquals("A full page of newer, settled suggestions does not hide older ones", listOf("older", "oldest"),
            CalendarNeeds.scan { read += it; history.getValue(it) }.map { it.getString("id") })
        assertEquals(listOf(0L, 40L, 20L), read)
        read.clear()
        val crowded = page(10, listOf(proposal("a"), proposal("b"), proposal("c")))
        assertEquals(listOf("a", "b"), CalendarNeeds.scan { read += it; crowded }.map { it.getString("id") })
        assertEquals("Reading stops once the home has its rows", listOf(0L), read)
        read.clear()
        assertTrue(CalendarNeeds.scan { read += it; page(it + 1, settled) }.isEmpty())
        assertEquals("The scan is bounded even when the history continues", CalendarNeeds.PAGES, read.size)
    }

    @Test fun systemEntriesShareOneStableDefinition() {
        assertEquals(listOf("record", "photo", "audio", "ask"), MoteQuickEntry.entries.map { it.id })
        assertEquals(MoteQuickEntry.PHOTO, MoteQuickEntry.find("photo"))
        assertNull(MoteQuickEntry.find("start-capture"))
        assertEquals("camera", MoteQuickEntry.PHOTO.media)
        assertEquals("audio", MoteQuickEntry.AUDIO.media)
        assertNull("Record and Ask never start media by themselves", MoteQuickEntry.RECORD.media ?: MoteQuickEntry.ASK.media)
    }
}
