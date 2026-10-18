package dev.mote.collector

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class CentralRecordingPresentationTest {
    private fun receipt(state: String, error: String? = null, retry: Long? = null) = JSONObject().put("state", state).put("attempts", 2)
        .put("archived", state == "succeeded").put("blocked", state in listOf("failed", "blocked", "stale")).apply { error?.let { put("error", it) }; retry?.let { put("nextAttemptAt", it) } }
    private fun row(metadata: JSONObject, transcript: JSONObject, audio: JSONObject) = JSONObject().put("metadata", metadata).put("transcript", transcript).put("audio", audio.put("required", true))

    @Test fun metadataFailureDoesNotBecomeWaitingTranscriptOrAudioFailure() {
        val row = row(receipt("blocked", "generated_metadata_denied"), receipt("waiting"), receipt("waiting")).put("error", "generated_metadata_denied")
        val phases = CentralRecordingPresentation.phases(row, 1000)
        assertEquals(listOf("读取信息", "归档转写", "备份音频"), phases.map { it.title })
        assertEquals("需要处理", phases[0].stateLabel); assertEquals("generated_metadata_denied", phases[0].error)
        assertEquals("等待处理", phases[1].stateLabel); assertNull(phases[1].error); assertNull(phases[2].error)
    }

    @Test fun independentlyWaitingPhasesKeepTheirOwnErrorsAndRetryTimes() {
        val phases = CentralRecordingPresentation.phases(row(receipt("succeeded"), receipt("waiting", "generated_transcript_pending", 2000), receipt("waiting", "generated_audio_pending", 4000)), 1000)
        assertEquals("generated_transcript_pending", phases[1].error); assertEquals(2000L, phases[1].nextAttemptAt)
        assertEquals("generated_audio_pending", phases[2].error); assertEquals(4000L, phases[2].nextAttemptAt)
        assertNull(phases[0].nextAttemptAt)
    }

    @Test fun terminalAudioFailureDoesNotOverrideSuccessfulTranscriptOrPromiseAnotherRetry() {
        val item = row(receipt("succeeded"), receipt("succeeded"), receipt("failed", "generated_media_failed", 5000)).put("error", "generated_media_failed")
        val phases = CentralRecordingPresentation.phases(item, 1000)
        assertEquals("已完成", phases[1].stateLabel); assertNull(phases[1].error)
        assertEquals("未完成", phases[2].stateLabel); assertEquals("generated_media_failed", phases[2].error); assertNull(phases[2].nextAttemptAt)
        assertNull(CentralRecordingPresentation.phases(row(receipt("succeeded"), receipt("waiting", retry = 500), receipt("succeeded")), 1000)[1].nextAttemptAt)
    }
}
