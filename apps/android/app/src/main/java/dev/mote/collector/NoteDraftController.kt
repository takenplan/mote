package dev.mote.collector

import java.util.concurrent.Executor
import java.util.concurrent.atomic.AtomicReference

/** The current local note use cases; implementations must retain only application-owned resources. */
internal interface NoteDraftOperations {
    fun read(): NoteDraft
    fun update(text: String, mood: String): NoteDraft
    fun clear()
    fun save(text: String, mood: String): String
}

/** No View callbacks or executor ownership: accepted draft writes outlive the page that submitted them. */
internal class NoteDraftController(private val notes: NoteDraftOperations, executor: Executor) {
    data class Persistence(val revision: Int, val succeeded: Boolean)
    private var editRevision = 0
    private val persisted = AtomicReference<Persistence?>(null)
    private val writer = LatestWriter<Pair<Int, Pair<String, String>>>(executor) { (revision, value) ->
        val result = runCatching { notes.update(value.first, value.second) }
        persisted.set(Persistence(revision, result.isSuccess))
    }

    /** Called by the foreground edit listener; only the latest queued edit needs to be persisted. */
    fun autosave(text: String, mood: String) { writer.submit(++editRevision to (text to mood)) }
    fun persistence(): Persistence? = persisted.get()?.takeIf { it.revision == editRevision }
    fun clearPersistence() { persisted.set(null) }

    // UiTask executes these on the same app-owned executor, after accepted autosaves have drained.
    fun read(): NoteDraft = notes.read()
    fun save(text: String, mood: String): String = notes.save(text, mood)
    fun clear() = notes.clear()
}
