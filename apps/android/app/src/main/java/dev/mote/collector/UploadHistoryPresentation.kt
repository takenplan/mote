package dev.mote.collector

import org.json.JSONObject

/** Projects the existing bounded operation history; it never infers an upload from capture. */
internal object UploadHistoryPresentation {
    private val kinds = setOf(
        OperationKind.SCREEN_ACK, OperationKind.NOTE_ACK, OperationKind.ACTIVITY_ACK,
        OperationKind.MEDIA_ACK, OperationKind.SYSTEM_EVENT_ACK, OperationKind.PAGE_ACK,
        OperationKind.SOURCE_ACK, OperationKind.SOURCE_FAILED, OperationKind.UPLOAD_RETRY
    )

    fun events(state: JSONObject): List<JSONObject> {
        val events = state.getJSONArray("events")
        return (events.length() - 1 downTo 0).map { events.getJSONObject(it) }
            .filter { event -> OperationKind.valueOf(event.getString("kind")) in kinds }
    }
}
