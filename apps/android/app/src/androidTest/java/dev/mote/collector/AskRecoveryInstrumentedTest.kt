package dev.mote.collector

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
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.After
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.UUID
import java.util.concurrent.atomic.AtomicReference

/** The proxy loses real admission receipts or hides per-ID reads. Actual Central
 * stores/runs the generated requests; no run state or answer is injected in the app. */
@RunWith(AndroidJUnit4::class)
class AskRecoveryInstrumentedTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private val origin="http://127.0.0.1:47886"
    private val api get()=CentralClient(origin,"generated-native-discovery-owner-token")
    private lateinit var fixture:JSONObject
    private val directory get()=File(context.noBackupFilesDir,"central-native/"+SourceRules.hash(origin))
    private fun saved()=CentralDraftWrites.barrier { CentralStateFile(directory,"ask",context.secretBox()).read() }
    private fun <T> main(block:()->T):T { val result=AtomicReference<Result<T>>();instrumentation.runOnMainSync { result.set(runCatching(block)) };return result.get().getOrThrow() }
    private fun views(root:View):List<View> = listOf(root)+if(root is ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
    private fun shown(a:CentralActivity)=views(a.window.decorView).filter { it.isShown }
    private fun until(label:String,check:()->Boolean){val end=SystemClock.elapsedRealtime()+25_000;while(SystemClock.elapsedRealtime()<end){if(check())return;Thread.sleep(60)};fail(label)}
    private fun ready(s:ActivityScenario<CentralActivity>,label:String,check:(CentralActivity)->Boolean){until(label){var yes=false;s.onActivity { yes=check(it) };yes}}
    private fun click(s:ActivityScenario<CentralActivity>,label:String){ready(s,label){a -> !a.isWorking && shown(a).filterIsInstance<TextView>().any { it.isEnabled && it.isClickable && (it.text.toString()==label || it.contentDescription?.toString()==label) }};s.onActivity { a -> shown(a).filterIsInstance<TextView>().first { it.isEnabled && it.isClickable && (it.text.toString()==label || it.contentDescription?.toString()==label) }.performClick() }}
    private fun question(s:ActivityScenario<CentralActivity>,text:String){ready(s,"Enabled native composer"){a -> !a.isWorking && shown(a).filterIsInstance<EditText>().any { it.contentDescription=="你的问题" && it.isEnabled }};s.onActivity { a -> shown(a).filterIsInstance<EditText>().single { it.contentDescription=="你的问题" }.setText(text) }}
    private fun open()=ActivityScenario.launch<CentralActivity>(Intent(context,CentralActivity::class.java).putExtra("page","ask").putExtra("evidenceId",fixture.getString("noteId")).putExtra("evidenceOrigin",origin))
    private fun state()=api.get("/api/__fixture/state")
    private fun control(name:String)=api.post("/api/__fixture/$name",JSONObject())
    private fun screenshot(s:ActivityScenario<CentralActivity>,name:String){instrumentation.waitForIdleSync();s.onActivity { a -> val root=a.window.decorView;assertTrue(a.window.attributes.flags and android.view.WindowManager.LayoutParams.FLAG_SECURE != 0);val image=android.graphics.Bitmap.createBitmap(root.width,root.height,android.graphics.Bitmap.Config.ARGB_8888);try{root.draw(android.graphics.Canvas(image));File(context.filesDir,"ask-recovery-final").apply { mkdirs() }.resolve("$name.png").outputStream().use { image.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it) }}finally{image.recycle()} }}
    @Before fun generatedOnly(){
        assumeTrue(InstrumentationRegistry.getArguments().getString("nativeAskRecoveryFixture")=="true")
        require(context.packageName=="dev.mote.collector.dev" && Build.FINGERPRINT.contains("emu64a") && !Settings(context).enabled)
        fixture=control("reset"); directory.deleteRecursively()
        val settings=Settings(context);settings.save(settings.read().copy(server=origin,token="",debugHttp=true,syncMode="manual",authSignedOut=false,authExpiresAt=0,authProcess=""),confirmCentralEndpoint=true)
        CentralSession.get(context).select(origin);CentralSession.get(context).signIn(origin,"generated-native-discovery-owner-token")
        MoteI18n.select(context,"zh-CN");main { MoteAppearance.select(context,AppearancePreference.LIGHT) }
    }
    @After fun release(){if(::fixture.isInitialized){control("release-query");control("show-ask")}}
    @Test fun lostNewAdmissionNeverPollsAnOlderCompletedRunAndRetriesItsExactBodyAfterRecreation(){
        open().use { scenario ->
            question(scenario,"Generated first completed question");click(scenario,"发送")
            until("First real run completes"){saved().optString("runStatus")=="completed"}
            ready(scenario,"Own completed draft clears"){a -> shown(a).filterIsInstance<EditText>().any { it.contentDescription=="你的问题" && it.isEnabled && it.text.isEmpty() }}
            val old=saved().getString("runId");val readsBefore=state().getJSONArray("askGetIds").length()
            question(scenario,"Generated newer question with an uncertain admission");control("drop-ask-ack");control("hide-ask");click(scenario,"发送")
            ready(scenario,"Unconfirmed admission remains explicit"){a -> !a.isWorking && shown(a).filterIsInstance<TextView>().any { it.text.toString()=="重试同一请求" }}
            val admitted=saved().getJSONObject("pending").toString();val request=JSONObject(admitted);assertNotEquals(old,request.getString("id"));assertEquals(fixture.getString("noteId"),request.getJSONObject("input").getJSONArray("anchorEvidenceIds").getString(0))
            scenario.recreate();ready(scenario,"Durable unconfirmed request restores"){a -> !a.isWorking && shown(a).filterIsInstance<TextView>().any { it.text.toString()=="重试同一请求" }}
            click(scenario,"检查结果")
            ready(scenario,"404 remains unconfirmed"){a -> !a.isWorking && shown(a).filterIsInstance<TextView>().any { it.text.toString()=="请求尚未确认，可重试同一请求。" }}
            assertEquals(admitted,saved().getJSONObject("pending").toString());assertEquals("Generated newer question with an uncertain admission",saved().getString("question"))
            scenario.onActivity { a ->
                val retry=shown(a).filterIsInstance<TextView>().single { it.text.toString()=="重试同一请求" }
                retry.requestRectangleOnScreen(android.graphics.Rect(0,0,retry.width,retry.height),true)
                val bounds=android.graphics.Rect();assertTrue(retry.getGlobalVisibleRect(bounds));assertEquals(retry.height,bounds.height())
                assertTrue("Retry uses a readable full action",retry.layout.height<=retry.height-retry.paddingTop-retry.paddingBottom)
            }
            val reads=state().getJSONArray("askGetIds");assertTrue(reads.length()>readsBefore);for(i in readsBefore until reads.length())assertEquals(request.getString("id"),reads.getString(i));screenshot(scenario,"new-admission-404-held")
            control("show-ask");click(scenario,"重试同一请求")
            until("Same real admission completes"){saved().optString("runStatus")=="completed" && !saved().has("pending") && saved().optString("runId")==request.getString("id")}
            ready(scenario,"Same native composer clears only the admitted question"){a -> shown(a).filterIsInstance<EditText>().any { it.contentDescription=="你的问题" && it.isEnabled && it.text.isEmpty() }}
            val receipt=state();assertEquals(2,receipt.getInt("queryCalls"));val seen=receipt.getJSONArray("seenAskRequests");assertEquals(3,seen.length());assertEquals(seen.getString(1),seen.getString(2));assertEquals(admitted,JSONObject(seen.getString(2)).toString());screenshot(scenario,"same-admission-recovered")
        }
    }
    @Test fun acceptedRun404KeepsItsRequestAndOnlyActualCancellationReleasesIt(){
        control("hold-query")
        open().use { scenario ->
            question(scenario,"Generated running question whose receipt becomes unavailable");click(scenario,"发送")
            until("Actually admitted running request"){saved().optString("runStatus")=="running" && saved().has("activeRequest") && !saved().has("pending")}
            val body=saved().getJSONObject("activeRequest").toString();val id=saved().getString("runId");control("hide-ask");click(scenario,"检查结果")
            ready(scenario,"Accepted404 is held for the same request"){a -> !a.isWorking && shown(a).filterIsInstance<TextView>().any { it.text.toString()=="重试同一请求" }}
            assertEquals(id,saved().getString("runId"));assertEquals("running",saved().getString("runStatus"));assertEquals(body,saved().getJSONObject("pending").toString())
            click(scenario,"重试同一请求");until("Same running receipt is reacquired"){!saved().has("pending") && saved().optString("runStatus")=="running"};assertEquals(1,state().getInt("queryCalls"))
            val seen=state().getJSONArray("seenAskRequests");assertEquals(2,seen.length());assertEquals(seen.getString(0),seen.getString(1));screenshot(scenario,"accepted-running-recovered")
            click(scenario,"停止回答");until("Only actual server cancellation releases execution"){saved().optString("runStatus")=="cancelled" && !saved().has("pending") && !saved().has("activeRequest")}
            assertEquals("Generated running question whose receipt becomes unavailable",saved().getString("question"));control("release-query");until("Late fixture model returns"){state().getInt("activeQueries")==0};control("show-ask");assertEquals("cancelled",api.get("/api/query-runs/$id").getString("status"));screenshot(scenario,"server-cancelled-draft-retained")
        }
    }
    @Test fun anAdoptedOtherDeviceRunCannotEraseThisDevicesUnsentDraft(){
        val draft="Generated private next question on this device"
        open().use { scenario -> question(scenario,draft);until("Private draft is durable"){saved().optString("question")==draft} }
        control("hold-query");val id=UUID.randomUUID().toString()
        api.post("/api/query-runs",JSONObject().put("id",id).put("input",JSONObject().put("question","Generated question submitted from another device")))
        open().use { scenario ->
            until("Existing native consumer adopts the real running task"){saved().optString("runId")==id && saved().optString("runStatus")=="running"};assertFalse(saved().has("activeRequest"));control("hide-ask");click(scenario,"检查结果")
            ready(scenario,"Missing adopted receipt stays unresolved"){a -> !a.isWorking && shown(a).filterIsInstance<TextView>().any { it.text.toString()=="请刷新检查结果，避免重复发送。" }}
            assertEquals(id,saved().getString("runId"));assertEquals("running",saved().getString("runStatus"));assertFalse(saved().has("pending"));assertEquals(draft,saved().getString("question"))
            control("show-ask");control("release-query");until("Real other-device task completes"){api.get("/api/query-runs/$id").getString("status")=="completed"};click(scenario,"检查结果")
            ready(scenario,"Completion preserves the unrelated local draft"){a -> !a.isWorking && shown(a).filterIsInstance<EditText>().any { it.contentDescription=="你的问题" && it.isEnabled && it.text.toString()==draft }}
            assertEquals(draft,saved().getString("question"));assertEquals(1,state().getJSONArray("seenAskRequests").length());screenshot(scenario,"adopted-completion-preserved-local-draft")
        }
    }
}
