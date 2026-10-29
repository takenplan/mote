package dev.mote.collector

import org.junit.Assert.*
import org.junit.Test

class BackupDocumentSelectionTest {
    @Test fun unreadableNameAndSizeRemainUnknownRatherThanZeroOrAPathGuess() {
        assertEquals(BackupDocumentFacts("content://generated/document/7", null, null), BackupDocumentFacts.of("content://generated/document/7", " ", -1))
        assertEquals(0L, BackupDocumentFacts.of("content://generated/empty", "empty.zip", 0).size)
    }
    @Test fun cancelledPickerWithdrawsTheOldFileAndRejectsItsLateSize() {
        val state = BackupDocumentSelection()
        val first = state.select("content://generated/first")
        assertTrue(state.accept(first, BackupDocumentFacts.of(first.uri, "first.zip", 17)))
        state.clear()
        assertNull(state.facts)
        assertFalse(state.accept(first, BackupDocumentFacts.of(first.uri, "first.zip", 23)))
        assertNull(state.facts)
    }
    @Test fun reselectionOfSameUriStillFencesThePriorOperationAndDoesNotCarryItsSize() {
        val state = BackupDocumentSelection()
        val first = state.select("content://generated/file")
        state.accept(first, BackupDocumentFacts.of(first.uri, "first.zip", 999))
        val next = state.select(first.uri)
        assertNull(state.facts!!.displayName); assertNull(state.facts!!.size)
        assertFalse(state.accept(first, BackupDocumentFacts.of(first.uri, "first.zip", 999)))
        assertTrue(state.accept(next, BackupDocumentFacts.of(next.uri, "renamed.zip", 12)))
        assertEquals("renamed.zip", state.facts!!.displayName); assertEquals(12L, state.facts!!.size)
    }
    @Test fun factsOfAnotherDocumentNeverReplaceTheCurrentSelection() {
        val state = BackupDocumentSelection(); val selected = state.select("content://generated/current")
        assertFalse(state.accept(selected, BackupDocumentFacts.of("content://generated/other", "other.zip", 300)))
        assertEquals(selected.uri, state.facts!!.uri); assertNull(state.facts!!.size)
    }
}
