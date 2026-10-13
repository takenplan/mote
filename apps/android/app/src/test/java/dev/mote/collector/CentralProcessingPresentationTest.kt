package dev.mote.collector

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CentralProcessingPresentationTest {
    @Test fun scheduledOmissionsAndSpecificWaitsPreserveTheirMeaning() {
        assertEquals("未安排", CentralProcessingPresentation.stateKey("blocked", "archive_only", true))
        assertEquals("等待你确认", CentralProcessingPresentation.stateKey("blocked", "awaiting_confirmation"))
        assertEquals("处理结果未知", CentralProcessingPresentation.stateKey("blocked", "processor_response_unknown"))
        assertNull(CentralProcessingPresentation.stateKey("blocked", "processor_not_configured"))
        assertNull(CentralProcessingPresentation.stateKey("failed", "provider_unavailable"))
        assertNull(CentralProcessingPresentation.stateKey("cancelled", "authority_changed"))
    }
}
