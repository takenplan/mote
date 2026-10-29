package dev.mote.collector

import org.json.JSONObject
import java.util.UUID

/** Transport identity and composer ownership; no model or retrieval decisions. */
internal object NativeAskRunState {
    val terminal = setOf("completed","failed","cancelled")
    fun currentId(state: JSONObject): String = state.optJSONObject("pending")?.optString("id").orEmpty().ifBlank { state.optString("runId") }
    fun validate(run: JSONObject, expected: String) {
        val id=run.optString("id")
        check(runCatching { UUID.fromString(id) }.isSuccess && id==expected && run.optString("status") in terminal+"running") { MoteI18n.text("请求尚未确认，可重试同一请求。") }
    }
    fun missing(state: JSONObject): Boolean {
        if(state.has("pending"))return true
        val request=state.optJSONObject("activeRequest")
        if(request!=null && request.optString("id")==state.optString("runId")) {
            state.put("pending",JSONObject(request.toString()))
            return true
        }
        // An adopted run has no local admission body. Keep its identity held;
        // never reconstruct a request or infer a terminal state from HTTP404.
        return false
    }
    fun completesCurrentDraft(state: JSONObject, id: String): Boolean {
        val request=state.optJSONObject("activeRequest") ?: return false
        if(request.optString("id")!=id)return false
        val input=request.optJSONObject("input") ?: return false
        if(state.optString("question").trim()!=input.optString("question"))return false
        val current=state.optJSONArray("attachments")
        val expected=input.optJSONArray("attachmentIds")
        val currentIds=if(current==null) emptyList() else (0 until current.length()).map { current.getJSONObject(it).getString("id") }
        val expectedIds=if(expected==null) emptyList() else (0 until expected.length()).map { expected.getString(it) }
        return currentIds==expectedIds
    }
}
