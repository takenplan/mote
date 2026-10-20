package dev.mote.collector

import org.junit.Assert.*
import org.junit.Test
import java.io.IOException

class SourceRejectionTest {
    @Test fun confirmedEnabledSourceKeepsTheOriginalPermanentConflict() {
        val conflict = FileIngressRejection(409, "conflict")
        assertSame(conflict, confirmSourceRejection(conflict) { false })
    }

    @Test fun confirmedDisabledSourceRemainsPaused() {
        val paused = confirmSourceRejection(FileIngressRejection(409, "conflict")) { true }
        assertTrue(paused.paused)
        assertEquals(409, paused.httpStatus)
        assertEquals("conflict", paused.code)
    }

    @Test fun failedLookupCannotFabricateAPermanentConflictEvenWhenItsOwnResponseIsARejection() {
        for (failure in listOf(IOException("Generated disconnect"), FileTransportFailure(503, "Generated outage"),
            FileTransportFailure(401, "Generated retired credential"), FileIngressRejection(409, "lookup_conflict"),
            IllegalStateException("Generated retired account"))) {
            val unknown = assertThrows(SourcePauseLookupFailure::class.java) {
                confirmSourceRejection(FileIngressRejection(409, "upload_conflict")) { throw failure }
            }
            assertSame(failure, unknown.cause)
        }
    }

    @Test fun conditionsFailureKeepsItsExistingWaitingBoundary() {
        val waiting = SyncConditionsUnavailable("Generated charging condition")
        assertSame(waiting, assertThrows(SyncConditionsUnavailable::class.java) {
            confirmSourceRejection(FileIngressRejection(409)) { throw waiting }
        })
    }

    @Test fun confirmedPauseAndOtherPermanentRefusalsNeedNoLookup() {
        for (failure in listOf(FileIngressRejection(409, paused = true), FileIngressRejection(410), FileIngressRejection(426))) {
            assertSame(failure, confirmSourceRejection(failure) { fail("No pause lookup is needed"); false })
        }
    }
}
