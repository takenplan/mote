package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

/** Presentation is a private snapshot, not an authorization to open its references. */
internal object NativeConversationQuote {
    private fun hash(text: String): String = MessageDigest.getInstance("SHA-256")
        .digest(text.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }

    fun snapshot(original: String, question: String, citationIds: List<String>, conversationId: String, turnId: String, server: String): JSONObject {
        require(original.startsWith(question + "\n\n"))
        require(server.isNotBlank())
        return JSONObject().put("textHash", hash(original)).put("questionLength", question.length)
            .put("citationIds", JSONArray(citationIds.distinct())).put("conversationId",conversationId).put("turnId",turnId).put("server",server)
    }

    fun scoped(record: JSONObject?, expectedOrigin: String): JSONObject? =
        record?.takeIf { it.optString("server") == expectedOrigin }?.optJSONObject("originPresentation")?.takeIf { it.optString("server") == expectedOrigin }

    fun display(origin: JSONObject, presentation: JSONObject?): String {
        val original = origin.optString("text")
        if (origin.optString("kind") != "conversation" || presentation == null || presentation.optString("textHash") != hash(original)) return original
        val messages = origin.optJSONArray("messageIds") ?: return original
        if (origin.optString("conversationId").isBlank() || origin.optString("conversationId") != presentation.optString("conversationId") || messages.length() != 1 || messages.optString(0) != presentation.optString("turnId")) return original
        val questionLength = presentation.optInt("questionLength", -1)
        if (questionLength < 0 || questionLength + 2 > original.length || original.substring(questionLength, questionLength + 2) != "\n\n") return original
        val ids = presentation.optJSONArray("citationIds") ?: return original
        val citations = (0 until ids.length()).mapNotNull { ids.optString(it).takeIf(String::isNotBlank) }
        return original.substring(0, questionLength + 2) + NativeAnswerPresentation.format(original.substring(questionLength + 2), citations).text
    }
}
