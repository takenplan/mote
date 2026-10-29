package dev.mote.collector

import android.content.ContentResolver
import android.net.Uri
import android.provider.OpenableColumns

/** Facts from this selected document only; a content URI is never presented as a disk path. */
internal data class BackupDocumentFacts(val uri: String, val displayName: String?, val size: Long?) {
    companion object {
        fun of(uri: String, name: String?, size: Long?) = BackupDocumentFacts(uri, name?.takeIf(String::isNotBlank), size?.takeIf { it >= 0 })
    }
}
internal object BackupDocumentMetadata {
    fun read(resolver: ContentResolver, uri: Uri): BackupDocumentFacts {
        var name: String? = null
        var size: Long? = null
        runCatching {
            resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME).takeIf { it >= 0 && !cursor.isNull(it) }?.let { name = cursor.getString(it) }
                    cursor.getColumnIndex(OpenableColumns.SIZE).takeIf { it >= 0 && !cursor.isNull(it) }?.let { size = cursor.getLong(it) }
                }
            }
        }
        return BackupDocumentFacts.of(uri.toString(), name, size)
    }
}

/** A cancelled/replaced picker and a return to the landing page withdraw only presentation facts. */
internal class BackupDocumentSelection {
    data class Ticket(val generation: Long, val uri: String)
    private var generation = 0L
    private var ticket: Ticket? = null
    var facts: BackupDocumentFacts? = null; private set
    fun clear() { generation++; ticket = null; facts = null }
    fun select(uri: String): Ticket {
        clear()
        return Ticket(generation, uri).also { ticket = it; facts = BackupDocumentFacts.of(uri, null, null) }
    }
    fun accept(selected: Ticket, value: BackupDocumentFacts): Boolean {
        if (ticket != selected || value.uri != selected.uri) return false
        facts = value
        return true
    }
}
