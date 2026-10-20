package dev.mote.collector

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.time.ZoneId

class CentralResourceSettingsTest {
    @Test fun imageEditsPreserveDerivedServiceFieldsAndUseCurrentRevision() {
        val saved = JSONObject().put("enabled", true).put("understandingEnabled", false).put("allowExternalProcessing", false).put("allowQueryImages", false)
            .put("concurrency", 1).put("providerRevision", "generated-old").put("profileId", "generated-image")
            .put("ocrEndpoint", "http://127.0.0.1:47999/ocr").put("ocrProcessorId", "image.http")
        val before = saved.toString(); val flags = JSONObject(saved.toString()).put("allowQueryImages", true)
        val payload = CentralResourceSettings.perceptionRequest(17, saved, flags, "2", "generated-next", "other-image")
        val settings = payload.getJSONObject("settings")
        assertEquals(17, payload.getLong("revision")); assertEquals(before, saved.toString()); assertEquals(2, settings.getInt("concurrency"))
        assertTrue(settings.getBoolean("allowQueryImages")); assertEquals(saved.getString("ocrEndpoint"), settings.getString("ocrEndpoint"))
        assertEquals(saved.getString("ocrProcessorId"), settings.getString("ocrProcessorId")); assertFalse(settings.has("apiKey"))
        assertThrows(IllegalArgumentException::class.java) { CentralResourceSettings.perceptionRequest(17, saved, flags, "9", "generated", "image") }
        assertThrows(IllegalArgumentException::class.java) { CentralResourceSettings.perceptionRequest(17, saved, flags, "1", "", "image") }
    }

    @Test fun imagePreviewUsesOwnedSourceAndInclusiveLocalDaysWithoutPublicPositions() {
        val payload = CentralResourceSettings.historicalRequest("2026-03-08", "2026-03-08", "generated-source", "recompute", ZoneId.of("America/New_York"))
        assertEquals("2026-03-08T05:00:00Z", payload.getString("after")); assertEquals("2026-03-09T04:00:00Z", payload.getString("before"))
        assertEquals("generated-source", payload.getString("sourceId")); assertEquals("recompute", payload.getString("mode")); assertEquals(4, payload.length())
        assertEquals(1, CentralResourceSettings.historicalRequest("", "", "", "complete").length())
        assertThrows(IllegalArgumentException::class.java) { CentralResourceSettings.historicalRequest("2026-03-09", "2026-03-08", "", "complete") }
    }

    @Test fun capacityEditingPreservesExactExistingBytesAndRestartContractInput() {
        val bytes = 5L * 1024 * 1024 + 1
        val payload = CentralResourceSettings.storageRequest(23, "90", CentralResourceSettings.capacityMiB(bytes))
        assertEquals(23, payload.getLong("revision")); assertEquals(90, payload.getLong("retentionDays")); assertEquals(bytes, payload.getLong("maxStorageBytes"))
        assertEquals(1024L * 1024, CentralResourceSettings.storageRequest(1, "0", "1").getLong("maxStorageBytes"))
        assertThrows(IllegalArgumentException::class.java) { CentralResourceSettings.storageRequest(1, "36501", "1") }
        assertThrows(IllegalArgumentException::class.java) { CentralResourceSettings.storageRequest(1, "0", "1000001") }
    }

    @Test fun failedAndCancelledMediaRemainDistinctFromInstalledRuntimeReadiness() {
        assertEquals("处理失败", CentralResourceSettings.modelState("failed")); assertEquals("已取消", CentralResourceSettings.modelState("cancelled"))
        assertEquals("模型文件已安装", CentralResourceSettings.modelState("ready")); assertEquals("状态尚未确认", CentralResourceSettings.modelState("generated-unknown"))
    }
}
