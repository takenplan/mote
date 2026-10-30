package dev.mote.collector

import org.junit.Assert.*
import org.junit.Test

class SettingsSummaryStateTest {
    private val old = SettingsSummaryConfig("https://old.generated.invalid", false)
    private val paired = SettingsSummaryConfig("https://new.generated.invalid", false)

    @Test fun returnedSettingsShowOnlyTheFreshCommittedNode() {
        val state = SettingsSummaryTracker()
        state.committed(old)
        val oldRead = state.token()
        state.beginRead()
        assertEquals(SettingsSummaryState.Loading, state.state)
        assertFalse(state.readResult(oldRead, old))
        assertEquals(SettingsSummaryState.Loading, state.state)
        assertTrue(state.readResult(state.token(), paired))
        assertEquals(SettingsSummaryState.Current(paired), state.state)
    }

    @Test fun lateReadCannotUndoAConfirmedDisconnectOrPauseChange() {
        val state = SettingsSummaryTracker()
        state.committed(paired)
        val beforeDisconnect = state.token()
        val disconnected = SettingsSummaryConfig("", false)
        state.committed(disconnected)
        assertFalse(state.readResult(beforeDisconnect, paired))
        assertEquals(SettingsSummaryState.Current(disconnected), state.state)
        val beforePause = state.token()
        val paused = disconnected.copy(syncPaused = true)
        state.committed(paused)
        assertFalse(state.readResult(beforePause, disconnected))
        assertEquals(SettingsSummaryState.Current(paused), state.state)
    }

    @Test fun failedReadHidesLastKnownAddressAndCanRecover() {
        val state = SettingsSummaryTracker()
        state.committed(paired)
        state.beginRead()
        assertTrue(state.readResult(state.token(), null))
        assertEquals(SettingsSummaryState.Unavailable, state.state)
        state.beginRead()
        assertEquals(SettingsSummaryState.Loading, state.state)
        assertTrue(state.readResult(state.token(), paired))
        assertEquals(SettingsSummaryState.Current(paired), state.state)
    }
}
