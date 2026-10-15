package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class CentralLarkSelectionTest {
    @Test fun `legacy ranges stay opted out and document changes preserve calendar configuration`() {
        val current = JSONObject().put("documents", JSONArray()).put("calendarIds", JSONArray(listOf("generated-calendar")))
            .put("pastDays", 30).put("futureDays", 90).put("timeZone", "Asia/Shanghai").put("autoSync", false)
        assertFalse(CentralLarkSelection.discovery(current).getBoolean("created"))
        assertFalse(CentralLarkSelection.discovery(current).getBoolean("opened"))
        val saved = CentralLarkSelection.payload(current, true, true, false, "30", " doc-1 \n\n doc-2 ", "folder-1", "wiki-1", "excluded-1", false)
        assertEquals("generated-calendar", saved.getJSONArray("calendarIds").getString(0))
        assertEquals("Asia/Shanghai", saved.getString("timeZone"))
        assertFalse(saved.getBoolean("autoSync"))
        assertEquals(listOf("doc-1", "doc-2"), (0 until saved.getJSONArray("documents").length()).map { saved.getJSONArray("documents").getString(it) })
        assertEquals("excluded-1", saved.getJSONArray("excludedDocuments").getString(0))
        assertEquals(0, current.getJSONArray("documents").length())
    }
    @Test fun `first history days reject blank fractional zero and negative input without changing current range`() {
        val current = JSONObject().put("autoSync", true)
        for (days in listOf("", "1.5", "0", "-1")) {
            assertThrows(IllegalArgumentException::class.java) { CentralLarkSelection.payload(current, true, true, true, days, "", "", "", "", true) }
        }
        val saved = CentralLarkSelection.payload(current, true, true, true, "365", "", "", "", "", true)
        assertEquals(365, saved.getJSONObject("documentDiscovery").getInt("firstSyncDays"))
    }
}
