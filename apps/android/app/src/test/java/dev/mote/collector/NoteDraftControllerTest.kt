package dev.mote.collector

import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.IOException
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executor
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

class NoteDraftControllerTest {
    @get:Rule val folder = TemporaryFolder()
    private val failWrite = AtomicBoolean()
    private val cipher = object : ByteCipher {
        override fun seal(bytes: ByteArray): ByteArray {
            if (failWrite.getAndSet(false)) throw IOException("Generated draft write failure")
            return bytes.map { (it.toInt() xor 91).toByte() }.toByteArray()
        }
        override fun open(bytes: ByteArray) = bytes.map { (it.toInt() xor 91).toByte() }.toByteArray()
    }
    private fun operations(store: NoteDraftStore, beforeUpdate: (String) -> Unit = {}) = object : NoteDraftOperations {
        override fun read() = store.read()
        override fun update(text: String, mood: String): NoteDraft { beforeUpdate(text); return store.update(text, mood) }
        override fun clear() = store.clear()
        // Manual submission remains the unchanged QuickNotes transaction, outside this local-draft fixture.
        override fun save(text: String, mood: String): String = error("No manual submission in draft persistence tests")
    }
    private class QueuedExecutor : Executor {
        private val work = ArrayDeque<Runnable>()
        override fun execute(command: Runnable) { work.addLast(command) }
        fun drain() { while (work.isNotEmpty()) work.removeFirst().run() }
    }

    @Test fun olderCompletionNeverReportsANewerEditSavedWhileItsWriteIsBlocked() {
        val directory = folder.newFolder(); val store = NoteDraftStore(directory, cipher)
        val io = Executors.newSingleThreadExecutor()
        val firstEntered = CountDownLatch(1); val releaseFirst = CountDownLatch(1)
        val latestEntered = CountDownLatch(1); val releaseLatest = CountDownLatch(1)
        val written = mutableListOf<String>()
        val controller = NoteDraftController(operations(store) { text ->
            if (text == "Generated first edit") { firstEntered.countDown(); check(releaseFirst.await(5, TimeUnit.SECONDS)) }
            else { latestEntered.countDown(); check(releaseLatest.await(5, TimeUnit.SECONDS)) }
            written += text
        }, io)
        try {
            controller.autosave("Generated first edit", "")
            assertTrue(firstEntered.await(2, TimeUnit.SECONDS))
            controller.autosave("Generated superseded pending edit", "")
            controller.autosave("Generated latest edit\nwith exact spacing  ", "calm")
            releaseFirst.countDown(); assertTrue(latestEntered.await(2, TimeUnit.SECONDS))
            assertEquals("Generated first edit", store.read().text)
            assertNull(controller.persistence()) // The previous revision is durable, but the current edit is not.
            releaseLatest.countDown(); io.submit {}.get(2, TimeUnit.SECONDS)
            assertEquals(NoteDraftController.Persistence(3, true), controller.persistence())
            assertEquals(NoteDraft("Generated latest edit\nwith exact spacing  ", "calm"), NoteDraftStore(directory, cipher).read())
            assertEquals(listOf("Generated first edit", "Generated latest edit\nwith exact spacing  "), written)
        } finally { releaseFirst.countDown(); releaseLatest.countDown(); io.shutdownNow(); assertTrue(io.awaitTermination(5, TimeUnit.SECONDS)) }
    }

    @Test fun acceptedWriteFinishesAfterPageRetirementBeforeRecreatedPageReadsTheDraft() {
        val directory = folder.newFolder(); val store = NoteDraftStore(directory, cipher); val io = QueuedExecutor()
        var oldPage: NoteDraftController? = NoteDraftController(operations(store), io)
        oldPage!!.autosave("Generated draft accepted before destruction\n保留原文", "")
        oldPage = null // No Activity, View callback, or page-owned executor is captured by accepted work.
        assertNull(oldPage); assertEquals("", store.read().text)
        val recreated = NoteDraftController(operations(NoteDraftStore(directory, cipher)), io)
        var restored: NoteDraft? = null
        io.execute { restored = recreated.read() }
        io.drain()
        assertEquals(NoteDraft("Generated draft accepted before destruction\n保留原文", ""), restored)
        assertNull(recreated.persistence()) // It has not authored an edit in this page instance.
        assertFalse(directory.listFiles()!!.any { String(it.readBytes()).contains("Generated draft") })
        assertFalse(directory.listFiles()!!.any { it.extension == "tmp" })
    }

    @Test fun failedWriteLeavesThePreviousDraftIntactAndDoesNotStrandTheNextEdit() {
        val directory = folder.newFolder(); val store = NoteDraftStore(directory, cipher); val io = QueuedExecutor()
        store.update("Generated durable previous draft", "")
        val controller = NoteDraftController(operations(store), io)
        failWrite.set(true); controller.autosave("Generated unsuccessful edit", ""); io.drain()
        assertEquals(NoteDraftController.Persistence(1, false), controller.persistence())
        assertEquals("Generated durable previous draft", NoteDraftStore(directory, cipher).read().text)
        controller.autosave("Generated retried edit", ""); io.drain()
        assertEquals(NoteDraftController.Persistence(2, true), controller.persistence())
        assertEquals("Generated retried edit", NoteDraftStore(directory, cipher).read().text)
        controller.clearPersistence(); assertNull(controller.persistence())
        assertFalse(directory.listFiles()!!.any { it.extension == "tmp" })
    }

    @Test fun controllerReadsAndKeepsAnInterruptedPreparedIdentityUntilExplicitClear() {
        val directory = folder.newFolder(); val store = NoteDraftStore(directory, cipher); val io = QueuedExecutor()
        store.update("Generated prepared note", "calm")
        val prepared = store.prepare("https://fixture.invalid") { draft ->
            JSONObject().put("id", UUID.randomUUID().toString()).put("source", "note").put("ocrText", draft.text).put("mood", draft.mood)
        }
        val controller = NoteDraftController(operations(NoteDraftStore(directory, cipher)), io)
        assertEquals(prepared.prepared.toString(), controller.read().prepared.toString())
        controller.autosave(prepared.text, prepared.mood); io.drain()
        assertEquals(prepared.prepared.toString(), NoteDraftStore(directory, cipher).read().prepared.toString())
        io.execute { controller.clear() }; io.drain()
        assertEquals(NoteDraft(), NoteDraftStore(directory, cipher).read())
    }
}
