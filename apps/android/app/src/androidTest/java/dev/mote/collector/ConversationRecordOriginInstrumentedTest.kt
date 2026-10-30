package dev.mote.collector

import android.content.ComponentName
import android.content.Intent
import android.os.Build
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry
import androidx.test.runner.lifecycle.Stage
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class ConversationRecordOriginInstrumentedTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private val store get() = context.recordDraftStore()
    private fun until(label: String, check: () -> Boolean) {
        val deadline = SystemClock.elapsedRealtime() + 20000
        while (SystemClock.elapsedRealtime() < deadline) { if (check()) return; Thread.sleep(80) }
        fail(label)
    }
    private fun fixture(body: () -> Unit) {
        assumeTrue(InstrumentationRegistry.getArguments().getString("generatedQuoteFixture") == "true")
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("emu64a"))
        require(!store.hasPrepared())
        val old = store.draft(); val before = context.queue().dedupeIds().toSet()
        try { body(); assertEquals("No preview or cancelled import saves a record",before,context.queue().dedupeIds().toSet()) }
        finally { QuickNotes.io.submit {}.get(); store.edit(old.getString("text"),old.getJSONArray("attachments"),old.getJSONObject("origin"),old.optString("description"),old.optJSONObject("originPresentation")) }
    }
    private fun empty() { store.edit("",JSONArray(),JSONObject().put("kind","manual")) }
    private fun views(root: View): List<View> = listOf(root) + if (root is ViewGroup) (0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
    private fun shell(command: String): String = ParcelFileDescriptor.AutoCloseInputStream(instrumentation.uiAutomation.executeShellCommand(command)).bufferedReader().use { it.readText() }

    @Test fun exportedShareCannotPretendToBeAnInternalConversation() = fixture {
        val pm = context.packageManager
        @Suppress("DEPRECATION") val exported = pm.getActivityInfo(ComponentName(context,RecordEditorActivity::class.java),0).exported
        @Suppress("DEPRECATION") val internal = pm.getActivityInfo(ComponentName(context,ConversationRecordEditorActivity::class.java),0).exported
        assertTrue(exported); assertFalse(internal)
        empty()
        shell("am start -n ${context.packageName}/dev.mote.collector.ConversationRecordEditorActivity")
        Thread.sleep(500)
        instrumentation.runOnMainSync { assertFalse("External shell cannot launch the internal editor",ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED).any { it is ConversationRecordEditorActivity }) }
        val output = shell("am start -n ${context.packageName}/dev.mote.collector.RecordEditorActivity -a android.intent.action.SEND -t text/plain --es android.intent.extra.TEXT Generated_external_shared_text --es recordText Forged_question --es conversationId forged-conversation --es turnId forged-turn --es quoteQuestion Forged_question --esal quoteCitations forged-evidence")
        assertTrue("External sharing must remain available: $output",output.contains("Starting:"))
        until("External share keeps only the actual shared input") { store.draft().getJSONObject("origin").optString("text") == "Generated_external_shared_text" }
        val draft = store.draft(); val origin = draft.getJSONObject("origin")
        assertEquals("share",origin.getString("kind")); assertFalse(origin.has("conversationId")); assertFalse(origin.has("messageIds"))
        assertFalse(draft.has("originPresentation"))
        instrumentation.runOnMainSync { ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED).filterIsInstance<RecordEditorActivity>().forEach { it.finish() } }
    }

    @Test fun incomingShareRequiresExplicitReplacementOfAnExistingDraft() = fixture {
        val priorText="Generated prior private text";val priorDescription="Generated prior private description"
        store.edit(priorText,JSONArray(),JSONObject().put("kind","manual"),priorDescription)
        fun shared()=ActivityScenario.launch<RecordEditorActivity>(Intent(context,RecordEditorActivity::class.java).setAction(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,"Generated incoming quoted original"))
        fun choose(label:String) {
            until("Existing draft choice $label") { var found=false;instrumentation.runOnMainSync { found=android.view.inspector.WindowInspector.getGlobalWindowViews().flatMap(::views).filterIsInstance<TextView>().any{it.isShown&&it.isClickable&&it.text.toString()==label} };found }
            instrumentation.runOnMainSync { android.view.inspector.WindowInspector.getGlobalWindowViews().flatMap(::views).filterIsInstance<TextView>().single{it.isShown&&it.isClickable&&it.text.toString()==label}.performClick() }
        }
        shared().use { scenario ->
            choose("继续编辑")
            until("The original draft remains in the editor") { var found=false;scenario.onActivity{activity->found=views(activity.window.decorView).filterIsInstance<android.widget.EditText>().any{it.isEnabled&&it.text.toString()==priorText}};found }
            assertEquals(priorDescription,store.draft().getString("description"));assertEquals("",store.draft().getJSONObject("origin").optString("text"))
        }
        shared().use {
            choose("替换草稿")
            until("Only explicit replacement imports the incoming quote") { store.draft().getJSONObject("origin").optString("text")=="Generated incoming quoted original" }
            val draft=store.draft();assertEquals("",draft.getString("text"));assertEquals("",draft.getString("description"));assertEquals("share",draft.getJSONObject("origin").getString("kind"))
        }
    }

    @Test fun internalQuoteKeepsExactIdentityAndRejectsOverlengthWithoutReplacingDraft() = fixture {
        val conversation = UUID.randomUUID().toString(); val turn = UUID.randomUUID().toString()
        val citation = UUID.randomUUID().toString(); val question = "Generated question"; val raw = question + "\n\n> **Answer** [$citation]"
        val sourceOrigin = "http://127.0.0.1:54783"
        empty()
        val valid = Intent(context,ConversationRecordEditorActivity::class.java).putExtra("recordText",raw)
            .putExtra("conversationId",conversation).putExtra("turnId",turn).putExtra("quoteQuestion",question).putExtra("quoteOrigin",sourceOrigin)
            .putStringArrayListExtra("quoteCitations",arrayListOf(citation))
        ActivityScenario.launch<ConversationRecordEditorActivity>(valid).use { scenario ->
            until("Exact conversation snapshot saved as a draft") { store.draft().getJSONObject("origin").optString("text") == raw }
            var draft = store.draft(); assertEquals(conversation,draft.getJSONObject("origin").getString("conversationId"))
            assertEquals(turn,draft.getJSONObject("origin").getJSONArray("messageIds").getString(0))
            assertEquals(question + "\n\nAnswer [1]",NativeConversationQuote.display(draft.getJSONObject("origin"),draft.getJSONObject("originPresentation")))
            scenario.recreate()
            until("Readable source survives activity recreation") {
                var found = false; scenario.onActivity { activity -> found = views(activity.window.decorView).filterIsInstance<TextView>().any { it.tag == "record-origin-fulltext" && it.text.toString() == question + "\n\nAnswer [1]" } }; found
            }
            draft = store.draft(); assertEquals(raw,draft.getJSONObject("origin").getString("text"))
        }
        val retained = store.draft().toString()
        val tooLong = Intent(context,ConversationRecordEditorActivity::class.java).putExtra("recordText","x".repeat(100001)).putExtra("conversationId",conversation).putExtra("turnId",turn)
        ActivityScenario.launch<ConversationRecordEditorActivity>(tooLong).use { scenario ->
            until("Overlength input shows an explicit limit") {
                var found = false; scenario.onActivity { activity -> found = views(activity.window.decorView).filterIsInstance<TextView>().any { it.text.toString() == MoteI18n.text("文字目前最多 100000 字符。") } }; found
            }
            assertEquals(retained,store.draft().toString())
        }
        empty()
        val boundaryText = "q\n\n" + "y".repeat(99997)
        val boundary = Intent(context,ConversationRecordEditorActivity::class.java).putExtra("recordText",boundaryText).putExtra("conversationId",conversation).putExtra("turnId",turn).putExtra("quoteQuestion","q").putExtra("quoteOrigin",sourceOrigin).putStringArrayListExtra("quoteCitations",arrayListOf())
        ActivityScenario.launch<ConversationRecordEditorActivity>(boundary).use {
            until("Maximum permitted quote remains complete") { store.draft().getJSONObject("origin").optString("text") == boundaryText }
            assertEquals(turn,store.draft().getJSONObject("origin").getJSONArray("messageIds").getString(0))
        }
    }

    @Test fun switchingNodesCannotSendAnExistingConversationDraftToAnotherArchive() = fixture {
        val settings=Settings(context);val original=settings.read();val source=settings.dataOrigin()
        require(source.isNotBlank() && !settings.hasPendingData())
        val other="http://127.0.0.1:54784";require(source!=other)
        val conversation=UUID.randomUUID().toString();val turn=UUID.randomUUID().toString();val text="Question\n\nGenerated source answer"
        empty()
        val intent=Intent(context,ConversationRecordEditorActivity::class.java).putExtra("recordText",text).putExtra("conversationId",conversation).putExtra("turnId",turn)
            .putExtra("quoteQuestion","Question").putExtra("quoteOrigin",source).putStringArrayListExtra("quoteCitations",arrayListOf())
        try {
            ActivityScenario.launch<ConversationRecordEditorActivity>(intent).use { scenario ->
                until("Original conversation draft is prepared") { store.draft().getJSONObject("origin").optString("text")==text }
                ConnectionGuard.change(context,other,bindLocal=true) { settings.save(original.copy(server=other),confirmCentralEndpoint=true) }
                assertEquals(other,settings.dataOrigin())
                scenario.onActivity { activity -> views(activity.window.decorView).filterIsInstance<TextView>().single{it.isClickable&&it.text.toString()==MoteI18n.text("保存")}.performClick() }
                until("Node change is visible and keeps the draft") { var shown=false;scenario.onActivity { activity -> shown=views(activity.window.decorView).filterIsInstance<TextView>().any{it.text.toString()==MoteI18n.text("访问凭据已失效，请重新连接。")} };shown }
                val retained=store.draft();assertEquals(text,retained.getJSONObject("origin").getString("text"));assertEquals(turn,retained.getJSONObject("origin").getJSONArray("messageIds").getString(0));assertFalse(retained.has("prepared"))
            }
        } finally { ConnectionGuard.change(context,source,bindLocal=true) { settings.save(original,confirmCentralEndpoint=true) } }
    }

    @Test fun sameNodeSignedOutStillSavesTheConversationDraftLocally() {
        assumeTrue(InstrumentationRegistry.getArguments().getString("generatedQuoteFixture") == "true")
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("emu64a"))
        val settings=Settings(context);val oldSettings=settings.read();val source=settings.dataOrigin();require(source.isNotBlank()&&oldSettings.syncPaused&&!settings.hasPendingData())
        val journal=java.io.File(context.noBackupFilesDir,"record-draft/record.enc");val oldJournal=if(journal.exists())journal.readBytes()else null
        val queue=context.queue();val before=queue.dedupeIds().toSet();val turn=UUID.randomUUID().toString();val conversation=UUID.randomUUID().toString();val original="Question\n\nGenerated offline answer"
        try {
            empty()
            val intent=Intent(context,ConversationRecordEditorActivity::class.java).putExtra("recordText",original).putExtra("conversationId",conversation).putExtra("turnId",turn)
                .putExtra("quoteQuestion","Question").putExtra("quoteOrigin",source).putStringArrayListExtra("quoteCitations",arrayListOf())
            ActivityScenario.launch<ConversationRecordEditorActivity>(intent).use { scenario ->
                until("Conversation draft ready") { store.draft().getJSONObject("origin").optString("text")==original }
                settings.signOut();assertEquals(source,settings.dataOrigin());assertFalse(settings.read().hasSyncConnection())
                scenario.onActivity { activity -> views(activity.window.decorView).filterIsInstance<TextView>().single{it.isClickable&&it.text.toString()==MoteI18n.text("保存")}.performClick() }
                until("One offline record is saved locally") { (queue.dedupeIds().toSet()-before).size==1 }
                val id=(queue.dedupeIds().toSet()-before).single();val saved=requireNotNull(queue.capture(id));assertFalse(saved.optBoolean("uploaded"))
                assertEquals(original,saved.getJSONObject("metadata").getJSONObject("noteOrigin").getString("text"))
                assertEquals(turn,saved.getJSONObject("metadata").getJSONObject("noteOrigin").getJSONArray("messageIds").getString(0))
            }
        } finally {
            QuickNotes.io.submit {}.get()
            for(id in queue.dedupeIds().toSet()-before){val saved=requireNotNull(queue.capture(id));check(saved.optJSONObject("metadata")?.optJSONObject("noteOrigin")?.optJSONArray("messageIds")?.optString(0)==turn);check(queue.resolveDedupe(id,"",null,null,null))}
            assertEquals(before,queue.dedupeIds().toSet())
            if(oldJournal==null)journal.delete()else journal.writeBytes(oldJournal)
            settings.save(oldSettings,confirmCentralEndpoint=true)
        }
    }
}
