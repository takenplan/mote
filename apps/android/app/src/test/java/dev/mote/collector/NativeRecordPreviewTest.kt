package dev.mote.collector

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class NativeRecordPreviewTest {
    @Test fun `source only previews retain explicit origin label without changing empty owner comment`() {
        val origin = JSONObject().put("kind", "conversation").put("text", "Exact quoted model answer")
        val row = JSONObject().put("ocrText", "").put("metadata", JSONObject().put("noteOrigin", origin))
        assertEquals("对话摘录 · Exact quoted model answer", NativeRecordPreview.text(row))
        assertEquals("", row.getString("ocrText")); assertEquals("Exact quoted model answer", origin.getString("text"))
        origin.put("kind", "share"); assertEquals("分享内容 · Exact quoted model answer", NativeRecordPreview.text(row))
        row.put("textPreview", "My actual comment"); assertEquals("My actual comment", NativeRecordPreview.text(row))
    }
    @Test fun `attachment only previews use actual local or received attachment counts`() {
        val local = JSONObject().put("displayAttachmentCount", 2)
        assertEquals("附件 · 2", NativeRecordPreview.text(local))
        val received = JSONObject().put("metadata", JSONObject().put("attachments", JSONArray().put("a").put("b").put("c")))
        assertEquals("附件 · 3", NativeRecordPreview.text(received))
        assertEquals("", NativeRecordPreview.text(JSONObject()))
    }
}
