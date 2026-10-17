package dev.mote.collector

import org.json.JSONObject

/** Both saved-conversation readers share the server's history and erasure states. */
internal object CentralConversationPresentation {
    data class Turn(val notice: String?, val result: JSONObject?)
    fun read(turn: JSONObject): Turn {
        if (turn.optBoolean("evidenceDeleted")) return Turn(MoteI18n.text("相关证据已删除，这条历史回答已清除。可以继续提问查阅现有记录。"), null)
        val result = turn.optJSONObject("result") ?: return Turn(null, null)
        return when {
            turn.optBoolean("evidenceStale") -> Turn(MoteI18n.text("这是历史版本，当前资料已更新。"), result)
            else -> Turn(null, result)
        }
    }
}
