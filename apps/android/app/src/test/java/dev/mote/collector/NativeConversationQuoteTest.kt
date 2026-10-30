package dev.mote.collector

import org.json.JSONObject
import org.json.JSONArray
import org.junit.Assert.*
import org.junit.Test

class NativeConversationQuoteTest {
    @Test fun `display uses only matching private snapshot and keeps the saved quote literal`() {
        val id = "2fe73d52-265e-472f-9211-1c1f70476139"
        val question = "Question with **literal** text"
        val original = question + "\n\n> **Answer** [$id]"
        val origin = JSONObject().put("kind","conversation").put("text",original).put("conversationId","conversation-a").put("messageIds",JSONArray().put("turn-a"))
        val presentation = NativeConversationQuote.snapshot(original,question,listOf(id),"conversation-a","turn-a","https://central-a.test")
        assertEquals(question + "\n\nAnswer [1]", NativeConversationQuote.display(origin,presentation))
        val record = JSONObject().put("server","https://central-a.test").put("originPresentation",presentation)
        assertNotNull(NativeConversationQuote.scoped(record,"https://central-a.test"))
        assertNull(NativeConversationQuote.scoped(record,"https://central-b.test"))
        assertEquals(original,origin.getString("text"))
        origin.put("conversationId","conversation-b")
        assertEquals(original,NativeConversationQuote.display(origin,presentation))
        origin.put("conversationId","conversation-a").put("messageIds",JSONArray().put("turn-b"))
        assertEquals(original,NativeConversationQuote.display(origin,presentation))
        origin.put("messageIds",JSONArray().put("turn-a"))
        origin.put("text",original + " changed")
        assertEquals(original + " changed",NativeConversationQuote.display(origin,presentation))
        origin.put("kind","share").put("text",original)
        assertEquals(original,NativeConversationQuote.display(origin,presentation))
    }
}
