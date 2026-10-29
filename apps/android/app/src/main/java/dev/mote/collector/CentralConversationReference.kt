package dev.mote.collector

/** A saved citation must not use the independent owner archive as a fallback. */
internal object CentralConversationReference {
    fun available(client: CentralClient, conversationId: String, evidenceId: String): Boolean {
        fun encode(value: String) = java.net.URLEncoder.encode(value, "UTF-8")
        val value = client.get("/api/conversations/" + encode(conversationId) + "/references/" + encode(evidenceId))
        return value.optBoolean("available") && value.optString("id") == evidenceId
    }
}
