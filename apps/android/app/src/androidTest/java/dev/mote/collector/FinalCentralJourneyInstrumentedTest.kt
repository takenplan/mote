package dev.mote.collector

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry
import androidx.test.runner.lifecycle.Stage
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.UUID
import java.util.concurrent.atomic.AtomicReference

/** Manually selected final Central journey. No test answers or server responses are substituted. */
@RunWith(AndroidJUnit4::class)
class FinalCentralJourneyInstrumentedTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private val output get() = File(context.filesDir,"final-central-ui").apply { mkdirs() }
    private fun <T> main(block: () -> T): T { val result=AtomicReference<Result<T>>(); instrumentation.runOnMainSync { result.set(runCatching(block)) }; return result.get().getOrThrow() }
    private fun views(root: View): List<View> = listOf(root) + if(root is ViewGroup) (0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
    private fun current(): Activity = ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED).single()
    private fun shown() = android.view.inspector.WindowInspector.getGlobalWindowViews().filter { it.isShown && it.hasWindowFocus() }.flatMap(::views).filter { it.isShown }
    private fun until(label: String, timeout: Long = 30_000, check: () -> Boolean) {
        val end=SystemClock.elapsedRealtime()+timeout
        while(SystemClock.elapsedRealtime()<end) { if(check()) return; Thread.sleep(80) }; fail(label)
    }
    private fun configuration(): JSONObject {
        assumeTrue(InstrumentationRegistry.getArguments().getString("nativeFinalCentral") == "true")
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("emu64a"))
        val file=File(context.filesDir,"final-central-journey.json"); require(file.isFile)
        val config=JSONObject(file.readText()); require(config.getBoolean("generatedOnly"))
        val origin=java.net.URI(config.getString("origin")); require(origin.scheme == "http" && origin.host in setOf("127.0.0.1","localhost") && origin.port > 0)
        require(config.getString("token").length >= 32 && !Settings(context).enabled)
        MoteI18n.select(context,"zh-CN"); main { MoteAppearance.select(context,AppearancePreference.LIGHT) }
        return config
    }
    private fun connect(config: JSONObject): CentralClient {
        val settings=Settings(context); val origin=config.getString("origin"); val token=config.getString("token")
        ConnectionGuard.change(context,origin,bindLocal=true) {
            settings.saveConnection(origin,token,"Generated final Android",true)
            settings.save(settings.read().copy(syncMode="manual",syncPaused=false,wifiOnly=false,syncChargingOnly=false,syncBatteryNotLow=false),confirmCentralEndpoint=true)
        }
        return CentralClient(origin,token).also { assertEquals("owner",it.get("/api/connections/self").getJSONObject("credential").getString("scope")) }
    }
    private fun screenshot(name: String) {
        val latch=java.util.concurrent.CountDownLatch(1)
        main { current().window.decorView.postOnAnimation { current().window.decorView.postOnAnimation { latch.countDown() } } }
        assertTrue(latch.await(5,java.util.concurrent.TimeUnit.SECONDS))
        main { val root=android.view.inspector.WindowInspector.getGlobalWindowViews().last { it.isShown && it.hasWindowFocus() }; val image=android.graphics.Bitmap.createBitmap(root.width,root.height,android.graphics.Bitmap.Config.ARGB_8888)
            try { root.draw(android.graphics.Canvas(image)); output.resolve("$name.png").outputStream().use { image.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it) } } finally { image.recycle() }
        }
    }
    private fun click(label: String) {
        until("Native action unavailable: $label") { main { shown().filterIsInstance<TextView>().any { it.isEnabled && it.isClickable && (it.text.toString() == label || it.contentDescription?.toString() == label) } } }
        main { shown().filterIsInstance<TextView>().first { it.isEnabled && it.isClickable && (it.text.toString() == label || it.contentDescription?.toString() == label) }.performClick() }
    }
    @Test fun saveAndSynchronizeIndependentDescription() {
        val config=configuration(); val api=connect(config); val marker=UUID.randomUUID().toString()
        val original="Generated final Android record $marker: the review decision remains pending."
        val description="Generated owner context $marker: this is a test diary, not a completed commitment."
        val before=context.queue().dedupeIds().toSet()
        require(context.recordDraftStore().draft().let { it.optString("text").isBlank() && it.getJSONArray("attachments").length() == 0 })
        ActivityScenario.launch(RecordEditorActivity::class.java).use { scenario ->
            until("Actual editor ready") { var ready=false; scenario.onActivity { a -> ready=views(a.window.decorView).filterIsInstance<EditText>().any { it.contentDescription == "正在想什么" && it.isEnabled } }; ready }
            scenario.onActivity { a -> views(a.window.decorView).filterIsInstance<EditText>().single { it.contentDescription == "正在想什么" }.setText(original); views(a.window.decorView).single { it.contentDescription == "资料说明（选填）" }.performClick(); views(a.window.decorView).filterIsInstance<EditText>().single { it.tag == "record-description" }.setText(description) }
            until("Both fields persisted independently") { context.recordDraftStore().draft().let { it.getString("text") == original && it.getString("description") == description } }
            screenshot("record-before-save"); click("保存")
            until("Explicit native save creates exactly one record") { (context.queue().dedupeIds().toSet()-before).size == 1 }
        }
        val id=(context.queue().dedupeIds().toSet()-before).single()
        assertEquals(description,context.queue().capture(id)!!.getJSONObject("metadata").getString("ownerDescription"))
        UploadWorker.schedule(context,Settings(context).read(),true)
        until("Real Central receipt required",120_000) { context.queue().capture(id)?.optBoolean("uploaded") == true }
        val remote=api.get("/api/capture-browser/$id")
        assertEquals(original,remote.getString("ocrText")); assertEquals(description,remote.getJSONObject("metadata").getString("ownerDescription"))
        output.resolve("save-result.json").writeText(JSONObject().put("generatedOnly",true).put("sourceRecordId",id).put("deviceId",Settings(context).deviceId).put("descriptionVerified",true).put("centralReceived",true).toString(2))
        ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { screenshot("home-after-save") }
    }
    @Test fun continueSharedConversationAndReturnFromExactCitation() {
        val config=configuration(); val api=connect(config); val id=config.getString("conversationId"); val question=config.getString("question")
        val prior=api.get("/api/conversations/$id?limit=50").getJSONArray("turns"); val priorIds=(0 until prior.length()).map { prior.getJSONObject(it).getString("id") }.toSet()
        require(prior.length() > 0)
        ActivityScenario.launch<CentralActivity>(Intent(context,CentralActivity::class.java).putExtra("page","ask").putExtra("conversationId",id)).use {
            until("Shared conversation and composer loaded") { main { (current() as? CentralActivity)?.isWorking == false && shown().filterIsInstance<EditText>().any { it.contentDescription == "你的问题" && it.isEnabled } } }
            screenshot("shared-conversation-before")
            main { shown().filterIsInstance<EditText>().single { it.contentDescription == "你的问题" }.setText(question) }; click("发送")
            var turn: JSONObject?=null
            until("Actual live model turn must complete",300_000) {
                val turns=api.get("/api/conversations/$id?limit=50").getJSONArray("turns")
                turn=(0 until turns.length()).map { turns.getJSONObject(it) }.firstOrNull { it.getString("id") !in priorIds && it.getString("question") == question }
                turn?.let { assertFalse("Actual model turn failed",it.optString("status") in setOf("failed","cancelled")) }
                turn?.optString("status") == "completed"
            }
            val result=turn!!.getJSONObject("result"); val expected=config.optString("expectedModel","gpt-6.1-terra")
            val model=result.optJSONObject("modelSelection")?.optString("model").orEmpty().ifBlank { result.optJSONObject("usage")?.optString("model").orEmpty() }
            assertEquals("The actual requested model must be recorded",expected,model)
            val raw=result.getJSONArray("citations"); val citations=(0 until raw.length()).map { raw.getJSONObject(it) }.distinctBy { it.getString("id") }
            assertTrue("The actual answer must cite real evidence",citations.isNotEmpty())
            val evidence=config.optString("expectedEvidenceId").ifBlank { citations.first().getString("id") }; val number=citations.indexOfFirst { it.getString("id") == evidence }+1; assertTrue(number > 0)
            assertTrue(CentralConversationReference.available(api,id,evidence)); val original=api.get("/api/capture-browser/$evidence").getString("ocrText")
            until("Actual answer must render") { main { shown().any { it.contentDescription?.toString()?.startsWith("查看引用 $number ·") == true } } }; screenshot("shared-conversation-answer")
            main { shown().single { it.contentDescription?.toString()?.startsWith("查看引用 $number ·") == true }.performClick() }
            until("Exact original must render") { main { shown().filterIsInstance<TextView>().any { it.text.toString() == original } } }; screenshot("exact-citation")
            main { shown().single { it.contentDescription == "返回上一页" }.performClick() }
            until("Return to same conversation and composer") { main { shown().filterIsInstance<EditText>().any { it.contentDescription == "你的问题" } && shown().any { it.contentDescription?.toString()?.startsWith("查看引用 $number ·") == true } } }; screenshot("citation-return")
            output.resolve("conversation-result.json").writeText(JSONObject().put("generatedOnly",true).put("liveModel",true).put("model",model).put("conversationId",id).put("turnId",turn!!.getString("id")).put("evidenceId",evidence).put("exactCitationVerified",true).toString(2))
        }
    }
}
