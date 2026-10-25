package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/** A record entry may never rewrite the scope of an already accepted or retryable question. */
internal object NativeAskEvidenceScope {
    fun select(state: JSONObject, id: String): Boolean {
        UUID.fromString(id)
        val busy = state.has("pending") || state.optString("runStatus") == "running"
        if (busy) {
            val scope = state.optJSONObject("pending")?.optJSONObject("input")?.optJSONArray("evidenceIds") ?: state.optJSONArray("evidenceIds")
            return scope?.length() == 1 && scope.optString(0) == id
        }
        state.put("evidenceIds", JSONArray().put(id)).put("scopeDirty", true); return true
    }
    fun clear(state: JSONObject): Boolean {
        if (state.has("pending") || state.optString("runStatus") == "running") return false
        state.put("evidenceIds", JSONObject.NULL).put("scopeDirty", true); return true
    }
    fun writeInput(state: JSONObject, input: JSONObject) {
        if (state.has("evidenceIds")) input.put("evidenceIds", state.get("evidenceIds"))
    }
    fun restore(state: JSONObject, conversation: JSONObject) {
        if (state.optBoolean("scopeDirty") || state.has("pending")) return
        val evidence = conversation.optJSONObject("scope")?.optJSONArray("evidenceIds")
        if (evidence != null) state.put("evidenceIds", JSONArray(evidence.toString())) else state.remove("evidenceIds")
    }

}
