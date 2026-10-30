package dev.mote.collector

import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.view.inspector.WindowInspector
import android.widget.Spinner
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.concurrent.atomic.AtomicReference

/** Explicit opt-in, private generated Central with the real SQLite and HTTP routes; no model. */
@RunWith(AndroidJUnit4::class)
class RealWorkMemoryJourneyInstrumentedTest {
    private val instrumentation get()=InstrumentationRegistry.getInstrumentation()
    private val context get()=instrumentation.targetContext
    private fun <T> main(block:()->T):T { val result=AtomicReference<Result<T>>();instrumentation.runOnMainSync{result.set(runCatching(block))};return result.get().getOrThrow() }
    private fun views(view:View):List<View> = listOf(view)+if(view is ViewGroup)(0 until view.childCount).flatMap{views(view.getChildAt(it))}else emptyList()
    private fun shown()=WindowInspector.getGlobalWindowViews().filter{it.isShown&&it.hasWindowFocus()}.flatMap(::views).filter{it.isShown}
    private fun until(label:String,check:()->Boolean){val end=SystemClock.elapsedRealtime()+30_000;while(SystemClock.elapsedRealtime()<end){if(check())return;Thread.sleep(50)};fail(label+"; visible="+main{shown().filterIsInstance<TextView>().joinToString(" | "){it.text.toString().take(100)}})}
    private fun has(value:String)=main{shown().filterIsInstance<TextView>().any{it.text.toString().contains(value)}}
    private fun click(value:String){until("Action $value"){main{shown().any{it.isEnabled&&it.isClickable&&(it.contentDescription==value||(it as? TextView)?.text.toString()==value)}}};main{shown().first{it.isEnabled&&it.isClickable&&(it.contentDescription==value||(it as? TextView)?.text.toString()==value)}.also{it.requestRectangleOnScreen(android.graphics.Rect(0,0,it.width,it.height),true)}.performClick()}}
    private fun position(view:View):Pair<Int,Int> = main{val p=IntArray(2);view.getLocationOnScreen(p);shown().filterIsInstance<android.widget.ScrollView>().first().scrollY to p[1]}
    private fun record(name:String){instrumentation.waitForIdleSync();main{val root=WindowInspector.getGlobalWindowViews().last{it.isShown&&it.hasWindowFocus()};val image=android.graphics.Bitmap.createBitmap(root.width,root.height,android.graphics.Bitmap.Config.ARGB_8888);try{root.draw(android.graphics.Canvas(image));File(context.filesDir,"work-memory-generated").apply{mkdirs()}.resolve("$name.png").outputStream().use{image.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it)}}finally{image.recycle()}}}
    private fun tap(view:View){main{view.requestRectangleOnScreen(android.graphics.Rect(0,0,view.width,view.height),true)};Thread.sleep(400);val p=main{val xy=IntArray(2);view.getLocationOnScreen(xy);(xy[0]+view.width/2f) to (xy[1]+view.height/2f)};val t=SystemClock.uptimeMillis();instrumentation.sendPointerSync(android.view.MotionEvent.obtain(t,t,android.view.MotionEvent.ACTION_DOWN,p.first,p.second,0));instrumentation.sendPointerSync(android.view.MotionEvent.obtain(t,t+40,android.view.MotionEvent.ACTION_UP,p.first,p.second,0))}
    @Test fun realOwnerReceiptExactMemoryAndNoteReturn() {
        assumeTrue(InstrumentationRegistry.getArguments().getString("generatedRealCentral")=="true")
        require(context.packageName=="dev.mote.collector.dev"&&Build.FINGERPRINT.contains("emu64a"))
        val config=JSONObject(File(context.filesDir,"generated-real-work-memory.private.json").readText())
        val origin=config.getString("origin");val token=config.getString("token");val work=config.getString("workId");val id=config.getString("memoryId");val evidence=config.getString("evidenceId");val quote=config.getString("quote")
        val settings=Settings(context);val saved=settings.read();val before=context.queue().dedupeIds().toSet();require(!settings.enabled&&saved.syncMode=="manual"&&saved.syncPaused)
        val api=CentralClient(origin,token);val countersBefore=api.get("/api/__fixture/android-counters")
        try {
            until("Private generated connection is ready") { try{ConnectionGuard.change(context,origin,bindLocal=true){settings.saveConnection(origin,token,"Generated real Central",true);settings.save(settings.read().copy(syncMode="manual",syncPaused=true),confirmCentralEndpoint=true)};true}catch(error:ConnectionFailure){if(error.category=="busy")false else throw error} }
            MoteI18n.select(context,"zh-CN");main{MoteAppearance.select(context,AppearancePreference.LIGHT)}
            ActivityScenario.launch<CentralActivity>(Intent(context,CentralActivity::class.java).putExtra("page","activity")).use{scenario->
                click("最近完成");val goal="整理所选资料的记忆";val detailGoal="核对生成资料的工作分支";until("Real activity receipt appears"){has(goal)}
                assertEquals(detailGoal,api.get("/api/work-activity/"+CentralScreens.encode(work)+"?limit=20&cursor=0").getString("goal"))
                main{shown().first{it.isClickable&&it.contentDescription?.toString()?.startsWith(goal)==true}.performClick()};until("Real activity has its 22 saved Memory results"){has(detailGoal)&&has("22 项已保存成果")}
                main{val spinner=shown().filterIsInstance<Spinner>().single{it.contentDescription=="工作详情"};spinner.setSelection((0 until spinner.count).single{spinner.getItemAtPosition(it).toString()=="成果"})}
                until("The real first page exposes the exact ID"){main{shown().any{it.tag=="work-memory:$id"}}};assertTrue(has("Generated activity memory 01"));assertFalse(has("Generated activity memory 21"))
                val row=main{shown().single{it.tag=="work-memory:$id"}};main{row.requestRectangleOnScreen(android.graphics.Rect(0,0,row.width,row.height),true)};Thread.sleep(400);val activityBefore=position(row);tap(row)
                until("The exact real Memory opens"){has("Generated activity memory 01")&&has("A saved memory from a generated private Activity receipt.")}
                val button=main{shown().filterIsInstance<TextView>().single{it.text.toString()=="查看原文依据 1"}};main{button.requestRectangleOnScreen(android.graphics.Rect(0,0,button.width,button.height),true)};Thread.sleep(400);val memoryBefore=position(button);tap(button)
                until("The real note reader opens the exact original"){has(quote)};record("real-note-original");instrumentation.uiAutomation.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK)
                until("The original returns to the same real Memory"){has("Generated activity memory 01")&&has("查看原文依据 1")};Thread.sleep(400);val memoryAfter=position(main{shown().filterIsInstance<TextView>().single{it.text.toString()=="查看原文依据 1"}})
                assertEquals(memoryBefore.first,memoryAfter.first);assertTrue(kotlin.math.abs(memoryBefore.second-memoryAfter.second)<=2)
                scenario.onActivity{it.onBackPressed()};until("The real activity results return"){has(detailGoal)&&main{shown().any{it.tag=="work-memory:$id"}}};Thread.sleep(400);val activityAfter=position(main{shown().single{it.tag=="work-memory:$id"}});record("real-activity-return")
                assertEquals(activityBefore.first,activityAfter.first);assertTrue(kotlin.math.abs(activityBefore.second-activityAfter.second)<=2)
                val countersAfter=api.get("/api/__fixture/android-counters");assertEquals(0,countersBefore.getInt("modelCalls"));assertEquals(0,countersAfter.getInt("modelCalls"));assertEquals(countersBefore.getInt("androidMutations"),countersAfter.getInt("androidMutations"))
                File(context.filesDir,"work-memory-generated").apply{mkdirs()}.resolve("real-central-facts.json").writeText(JSONObject().put("generatedOnly",true).put("workId",work).put("memoryId",id).put("evidenceId",evidence).put("activityBeforeScroll",activityBefore.first).put("activityBeforeY",activityBefore.second).put("activityAfterScroll",activityAfter.first).put("activityAfterY",activityAfter.second).put("memoryBeforeScroll",memoryBefore.first).put("memoryBeforeY",memoryBefore.second).put("memoryAfterScroll",memoryAfter.first).put("memoryAfterY",memoryAfter.second).put("modelCalls",0).put("newMutations",0).toString(2))
            }
            assertEquals(before,context.queue().dedupeIds().toSet())
        } finally { CentralDraftWrites.barrier{};File(context.noBackupFilesDir,"central-native/"+SourceRules.hash(origin)).deleteRecursively();settings.save(saved,confirmCentralEndpoint=true);CentralSession.get(context).select(saved.server) }
    }
}
