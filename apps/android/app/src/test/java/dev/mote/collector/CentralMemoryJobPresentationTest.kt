package dev.mote.collector

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CentralMemoryJobPresentationTest {
    @Test fun sourceRevisionMakesTheHistoricalTaskReadableWithoutRetryControls() {
        val job = JSONObject("""{"status":"failed","outcome":"input_invalidated","failedBatches":0,"invalidatedBatches":1,"errorCode":"evidence_changed"}""")
        assertEquals("资料已更新，本次结果失效", CentralMemoryJobPresentation.status(job))
        assertEquals("历史结果保留；请查看当前资料版本。失效输入不能直接重试。", CentralMemoryJobPresentation.notice(job))
        assertTrue(CentralMemoryJobPresentation.controls(job).isEmpty())
        assertEquals("The presentation must not rewrite historical scheduling state", "failed", job.getString("status"))
    }

    @Test fun aMixedTaskKeepsItsActualProcessingFailureAndRetry() {
        val job = JSONObject("""{"status":"failed","outcome":"processing_failed","failedBatches":1,"invalidatedBatches":1,"errorCode":"memory_capacity_saturated"}""")
        assertFalse(CentralMemoryJobPresentation.invalidated(job))
        assertEquals("failed", CentralMemoryJobPresentation.status(job))
        assertNull(CentralMemoryJobPresentation.notice(job))
        assertTrue(CentralMemoryJobPresentation.controls(job).any { it.first == "retry" })
    }

    @Test fun olderCentralReceiptsAreNotReclassifiedFromErrorCodesOrCounts() {
        val job = JSONObject("""{"status":"failed","failedBatches":1,"invalidatedBatches":1,"errorCode":"evidence_changed"}""")
        assertFalse(CentralMemoryJobPresentation.invalidated(job))
        assertEquals("failed", CentralMemoryJobPresentation.status(job))
        assertNull(CentralMemoryJobPresentation.notice(job))
        assertEquals(listOf("pause", "resume", "cancel", "retry"), CentralMemoryJobPresentation.controls(job).map { it.first })
    }
}
