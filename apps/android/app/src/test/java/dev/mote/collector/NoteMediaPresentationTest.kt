package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class NoteMediaPresentationTest {
    private fun record(source: String, status: String, sessions: JSONArray = JSONArray()) = JSONObject()
        .put("source", source).put("metadata", JSONObject().put("media", JSONObject().put("status", status).put("sessions", sessions)))

    @Test fun plainNotesDoNotShowAnUnrelatedDisabledMediaStatus() {
        assertFalse(CapturePreview.showMediaContext(record("note", "disabled")))
        assertFalse(CapturePreview.showMediaContext(JSONObject().put("source", "note")))
        assertTrue(CapturePreview.showMediaContext(record("media", "disabled")))
        assertTrue(CapturePreview.showMediaContext(record("screen", "disabled")))
    }

    @Test fun notesKeepActualMediaEvidenceAndOtherExplicitAvailabilityStates() {
        val sessions = JSONArray().put(JSONObject().put("title", "Generated chapter").put("playbackState", "playing"))
        assertTrue(CapturePreview.showMediaContext(record("note", "available", sessions)))
        assertTrue(CapturePreview.showMediaContext(record("note", "disabled", sessions)))
        assertTrue(CapturePreview.showMediaContext(record("note", "permission_required")))
        assertTrue(CapturePreview.showMediaContext(record("note", "unavailable")))
    }
}
