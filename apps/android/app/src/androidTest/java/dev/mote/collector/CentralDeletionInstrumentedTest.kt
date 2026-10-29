package dev.mote.collector

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.lifecycle.Lifecycle
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
import java.util.concurrent.atomic.AtomicReference

/** Manually selected generated Central; real deletion/citation gates, controlled failure receipts, zero model calls. */
@RunWith(AndroidJUnit4::class)
class CentralDeletionInstrumentedTest {
    private val instrumentation get()=InstrumentationRegistry.getInstrumentation()
    private val context get()=instrumentation.targetContext
    private fun <T> main(fn:()->T):T { val value=AtomicReference<Result<T>>();instrumentation.runOnMainSync { value.set(runCatching(fn)) };return value.get().getOrThrow() }
    private fun views(view:View):List<View> = listOf(view)+if(view is ViewGroup)(0 until view.childCount).flatMap { views(view.getChildAt(it)) } else emptyList()
    private fun shown()=android.view.inspector.WindowInspector.getGlobalWindowViews().filter { it.isShown&&it.hasWindowFocus() }.flatMap(::views).filter { it.isShown }
    private fun until(label:String,fn:()->Boolean) { val end=SystemClock.elapsedRealtime()+30000;while(SystemClock.elapsedRealtime()<end) { if(fn())return;Thread.sleep(60) };fail(label) }
    private fun click(label:String) { until(label) { main { shown().filterIsInstance<TextView>().any { it.isEnabled&&it.isClickable&&(it.text.toString()==label||it.tag==label) } } };main { shown().filterIsInstance<TextView>().first { it.isEnabled&&it.isClickable&&(it.text.toString()==label||it.tag==label) }.performClick() } }
    private fun config():JSONObject {
        assumeTrue(InstrumentationRegistry.getArguments().getString("nativeDeletionFixture")=="true")
        require(context.packageName=="dev.mote.collector.dev"&&Build.FINGERPRINT.contains("emu64a")&&!Settings(context).enabled)
        val value=JSONObject(File(context.filesDir,"native-deletion-fixture.json").readText());require(value.getBoolean("generatedOnly"))
        val origin=java.net.URI(value.getString("origin"));require(origin.scheme=="http"&&origin.host in setOf("127.0.0.1","localhost")&&origin.port>0&&value.getString("token").length>=32)
        MoteI18n.select(context,"zh-CN");return value
    }
    private fun connect(value:JSONObject):CentralClient {
        val origin=value.getString("origin");val token=value.getString("token");ConnectionGuard.change(context,origin,bindLocal=true) { Settings(context).let { settings -> settings.saveConnection(origin,token,"Generated deletion fixture",true);settings.save(settings.read().copy(syncMode="manual",syncPaused=true,wifiOnly=false,syncChargingOnly=false,syncBatteryNotLow=false),confirmCentralEndpoint=true) } }
        return CentralClient(origin,token)
    }
    private inner class ReaderSession(val host:ActivityScenario<CentralActivity>,val reader:Activity):AutoCloseable {
        val state get()=main { if(reader.isFinishing||reader.isDestroyed) Lifecycle.State.DESTROYED else Lifecycle.State.RESUMED }
        override fun close() { main { if(!reader.isFinishing&&!reader.isDestroyed) reader.finish() };host.close() }
    }
    private fun open(api:CentralClient,id:String,conversation:String?=null):ReaderSession {
        val row=api.get("/api/capture-browser/"+id)
        require(row.getString("source")=="message" && row.getString("libraryVersion").isNotBlank())
        val target=conversation ?: JSONObject(File(context.filesDir,"native-deletion-fixture.json").readText()).getJSONObject("conversations").getString(id)
        val host=ActivityScenario.launch<CentralActivity>(Intent(context,CentralActivity::class.java).putExtra("page","ask").putExtra("conversationId",target))
        until("actual conversation citation action") { main { shown().any { it.contentDescription?.toString()?.startsWith("查看引用 1 ·")==true } } }
        main { shown().single { it.contentDescription?.toString()?.startsWith("查看引用 1 ·")==true }.performClick() }
        until("public citation route opens exact literal original") { main { ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED).any { it is CaptureRecordsActivity } && shown().filterIsInstance<TextView>().any { it.text.toString()==row.getString("ocrText") } } }
        val reader=main { ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED).single { it is CaptureRecordsActivity } }
        return ReaderSession(host,reader)
    }
    private fun screenshot(name:String) { main {
        val root=android.view.inspector.WindowInspector.getGlobalWindowViews().last { it.isShown&&it.hasWindowFocus() };val bitmap=android.graphics.Bitmap.createBitmap(root.width,root.height,android.graphics.Bitmap.Config.ARGB_8888)
        try { root.draw(android.graphics.Canvas(bitmap));File(context.filesDir,"native-deletion-scenes").apply { mkdirs() }.resolve(name+".png").outputStream().use { bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it) } } finally { bitmap.recycle() }
    } }
    @Test fun currentNoteAnchorDeletesOnlyItsOriginalAndKeepsHistoricalAnswer() {
        val value=config();val api=connect(value);val id=value.getString("noteAnchor");val conversation=value.getString("conversationId")
        val before=api.get("/api/conversations/"+conversation).getJSONArray("turns").toString()
        assertTrue(CentralConversationReference.available(api,conversation,id))
        open(api,id,conversation).use { scenario ->
            click("capture-reader-more");screenshot("note-before-delete");click("删除记录");click("确认")
            until("positive deletion closes exact reader") { scenario.state==Lifecycle.State.DESTROYED }
        }
        assertTrue(runCatching { api.get("/api/capture-browser/"+id) }.exceptionOrNull() is CentralFailure)
        assertEquals(1,api.get("/api/conversations/"+conversation).getJSONArray("turns").length())
        val turn=api.get("/api/conversations/"+conversation).getJSONArray("turns").getJSONObject(0)
        assertEquals(value.getString("answer"),turn.getJSONObject("result").getString("answer"));assertEquals(value.getString("question"),turn.getString("question"));assertFalse(turn.optBoolean("evidenceDeleted"));assertTrue(turn.optBoolean("evidenceUnavailable"));assertFalse(CentralConversationReference.available(api,conversation,id));assertTrue(before.contains(value.getString("answer")))
        assertEquals(value.getString("otherRaw"),api.get("/api/capture-browser/"+value.getString("otherRaw")).getString("id"))
    }
    @Test fun readOnlyVirtualOriginalExplainsUnavailableDeletionWithoutAnAction() {
        val value=config();val api=connect(value);val id=value.getString("readOnlyAnchor")
        assertNull(CentralDeletion.kind(api.get("/api/capture-browser/"+id)))
        open(api,id).use {
            click("capture-reader-more");until("readonly explanation") { main { shown().filterIsInstance<TextView>().any { it.text.toString()=="此引用不能直接删除原始记录。" } } }
            assertFalse(main { shown().filterIsInstance<TextView>().any { it.isClickable&&it.text.toString() in setOf("删除记录","删除文件") } });screenshot("readonly-original-more")
        }
        assertEquals(0,api.get("/api/native-deletion-fixture").getInt("readOnlyDeletes"))
    }
    @Test fun zeroAndUnknownReceiptsKeepReaderAndLateOwnerReceiptCannotCloseIt() {
        val value=config();val api=connect(value)
        for(key in listOf("zeroAnchor","unknownAnchor")) open(api,value.getString(key)).use { scenario ->
            click("capture-reader-more");click("删除记录");click("确认")
            until("unconfirmed deletion remains readable") { main { shown().filterIsInstance<TextView>().any { it.text.toString().contains(if(key=="zeroAnchor") "未能确认删除完成" else "503") } } }
            assertEquals(Lifecycle.State.RESUMED,scenario.state);screenshot(key+"-reader-retained")
            if(key=="zeroAnchor") assertEquals(value.getString(key),api.get("/api/capture-browser/"+value.getString(key)).getString("id"))
            else assertEquals(404,(runCatching { api.get("/api/capture-browser/"+value.getString(key)) }.exceptionOrNull() as CentralFailure).status)
        }
        open(api,value.getString("lateAnchor")).use { scenario ->
            click("capture-reader-more");click("删除记录");click("确认")
            until("real old-owner DELETE started") { api.get("/api/native-deletion-fixture").optBoolean("lateStarted") }
            val other="http://127.0.0.1:9";ConnectionGuard.change(context,other,bindLocal=true) { Settings(context).saveConnection(other,"generated-other-owner-token-000000000000","Generated other owner",true) }
            api.post("/api/native-deletion-fixture",JSONObject().put("release",true))
            until("real old-owner DELETE completed") { api.get("/api/native-deletion-fixture").optBoolean("lateCompleted") }
            instrumentation.waitForIdleSync();assertEquals(Lifecycle.State.RESUMED,scenario.state);screenshot("old-owner-late-receipt-ignored")
            assertEquals(404,(runCatching { api.get("/api/capture-browser/"+value.getString("lateAnchor")) }.exceptionOrNull() as CentralFailure).status)
        }
        connect(value)
    }
}
