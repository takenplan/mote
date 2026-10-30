package dev.mote.collector

import org.json.JSONObject

/** Reading previews never promote a quoted source into the owner's authored comment. */
internal object NativeRecordPreview {
    fun text(item: JSONObject): String {
        val authored = item.optString("textPreview").ifBlank { item.optString("ocrText") }
        if (authored.isNotBlank()) return authored.take(160)
        val metadata = item.optJSONObject("metadata")
        val origin = metadata?.optJSONObject("noteOrigin")
        val original = origin?.optString("text").orEmpty()
        if (original.isNotBlank()) {
            val label = if (origin?.optString("kind") == "conversation") "对话摘录" else "分享内容"
            return MoteI18n.text(label) + " · " + NativeConversationQuote.display(requireNotNull(origin), item.optJSONObject("displayOriginPresentation")).take(160)
        }
        val count = maxOf(item.optInt("displayAttachmentCount"), metadata?.optJSONArray("attachments")?.length() ?: 0)
        return if (count > 0) MoteI18n.text("附件") + " · " + count else ""
    }
}
/** Called on the existing reading I/O task; the private count is never written into a capture. */
internal fun android.content.Context.withNativeNotePreviews(page: JSONObject): JSONObject {
    val items = page.getJSONArray("items")
    for (index in 0 until items.length()) withNativeNotePreview(items.getJSONObject(index))
    return page
}

internal fun android.content.Context.withNativeNotePreview(row: JSONObject): JSONObject {
    if (row.optString("source") == "note" && row.optString("textPreview").isBlank()) {
        val record = recordDraftStore().record(row.getString("id"))
        val count = record?.optJSONArray("attachments")?.length() ?: 0
        if (count > 0) row.put("displayAttachmentCount", count)
        NativeConversationQuote.scoped(record,Settings(this).dataOrigin())?.let { row.put("displayOriginPresentation", it) }
    }
    return row
}
