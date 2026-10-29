package dev.mote.collector

import android.content.ContentUris
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.provider.CalendarContract
import android.system.Os
import android.view.View
import android.view.ViewGroup
import android.view.inspector.WindowInspector
import android.widget.Spinner
import android.widget.TextView
import androidx.lifecycle.Observer
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry
import androidx.test.runner.lifecycle.Stage
import androidx.work.WorkInfo
import androidx.work.WorkManager
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicReference

/** Observe the existing periodic OS job only. Never enqueue, force, deliver, claim or execute. */
@RunWith(AndroidJUnit4::class)
class FinalCalendarPeriodicObserverInstrumentedTest {
    private val instrumentation get()=InstrumentationRegistry.getInstrumentation()
    private val context get()=instrumentation.targetContext
    private val input get()=File(context.filesDir,"final-calendar-worker-observer.json")
    private val output get()=File(context.filesDir,"final-calendar-worker-results").apply{mkdirs();Os.chmod(path,448)}
    private fun <T> main(block:()->T):T{val r=AtomicReference<Result<T>>();instrumentation.runOnMainSync{r.set(runCatching(block))};return r.get().getOrThrow()}
    private fun views(v:View):List<View> = listOf(v)+if(v is ViewGroup)(0 until v.childCount).flatMap{views(v.getChildAt(it))}else emptyList()
    private fun shown()=WindowInspector.getGlobalWindowViews().filter{it.isShown&&it.hasWindowFocus()}.flatMap(::views).filter{it.isShown}
    private fun until(label:String,check:()->Boolean){val end=SystemClock.elapsedRealtime()+30_000;while(SystemClock.elapsedRealtime()<end){if(check())return;Thread.sleep(50)};fail(label)}
    private fun click(label:String){until(label){main{shown().filterIsInstance<TextView>().any{it.isEnabled&&it.isClickable&&(it.text.toString()==label||it.tag==label)}}};main{shown().filterIsInstance<TextView>().first{it.isEnabled&&it.isClickable&&(it.text.toString()==label||it.tag==label)}.performClick()}}
    private fun write(name:String,value:JSONObject){val file=File(output,"$name.json");val tmp=File(output,"$name.tmp");FileOutputStream(tmp).use{Os.chmod(tmp.path,384);it.write(value.toString(2).toByteArray());it.fd.sync()};check(tmp.renameTo(file));Os.chmod(file.path,384)}
    private fun setMode(mode:String){
        if(Settings(context).read().syncMode==mode)return
        ActivityScenario.launch<MainActivity>(Intent(context,MainActivity::class.java).putExtra("page","CONNECTION")).awaitMainUi().use{
            until("Existing mode control"){main{shown().filterIsInstance<TextView>().any{it.text.toString()=="高级同步设置"}}};click("高级同步设置")
            main{shown().filterIsInstance<Spinner>().single{it.tag=="syncMode"}.setSelection(if(mode=="manual")3 else 0)};click("保存设置")
            until("Mode saved through production settings"){Settings(context).read().syncMode==mode&&!ConnectionGuard.changing()}
        }
    }
    private fun setPaused(paused:Boolean){
        if(Settings(context).read().syncPaused==paused)return
        ActivityScenario.launch(SyncQueueActivity::class.java).use{
            until("Existing send-pause control ready"){main{shown().any{it.tag=="sync-send-pause"&&it.isEnabled}}};click("sync-send-pause")
            until("Send state saved through production control"){Settings(context).read().syncPaused==paused}
        }
    }
    private fun event(id:String,calendar:String):JSONObject= requireNotNull(context.contentResolver.query(ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI,id.toLong()),arrayOf("_id","calendar_id","title","description","dtstart","dtend","allDay","eventLocation","eventTimezone","deleted"),null,null,null)).use{c->require(c.moveToFirst()&&c.getString(1)==calendar&&c.getInt(9)==0);JSONObject().put("id",c.getString(0)).put("calendarId",c.getString(1)).put("title",c.getString(2)).put("description",c.getString(3)).put("start",c.getLong(4)).put("end",c.getLong(5)).put("allDay",c.getInt(6)).put("location",c.getString(7)).put("timeZone",c.getString(8))}
    private fun info(value:WorkInfo)=JSONObject().put("id",value.id.toString()).put("state",value.state.name).put("runAttemptCount",value.runAttemptCount).put("nextScheduleTimeMillis",value.nextScheduleTimeMillis).put("at",System.currentTimeMillis()).put("automaticSendingEnabled",Settings(context).read().let{it.syncMode!="manual"&&!it.syncPaused})
    @Test fun observeExistingPeriodicUpdateAndRestoreOriginalSendPolicy(){
        assumeTrue(InstrumentationRegistry.getArguments().getString("nativeFinalCalendarPeriodic")=="true")
        require(context.packageName=="dev.mote.collector.dev"&&Build.FINGERPRINT.contains("emu64a"));require(input.isFile&&Os.stat(input.path).st_mode and 63==0)
        val config=JSONObject(input.readText());require(config.getBoolean("generatedOnly")&&config.getString("expectedActionId")=="5cf99c75-e02c-424f-ac90-f670630879ff")
        val settings=Settings(context);val before=settings.read();val device=settings.deviceId;require(device==config.getString("deviceId")&&before.server==config.getString("origin")&&before.connectionToken()==config.getString("collectorToken"));require(!settings.enabled&&!ProjectionService.running&&!CaptureAccessibilityService.connected&&before.syncMode=="manual"&&before.syncPaused)
        val privateFiles=listOf(File(context.filesDir,"final-central-journey.json"),File(context.filesDir,"final-calendar-journey.json"),File(context.noBackupFilesDir,"final-calendar-journey-state.json"));val privateBytes=privateFiles.associateWith{it.readBytes()};val ids=context.queue().dedupeIds().toSet();val originals=ids.associateWith{context.queue().capture(it)!!.toString()}
        val owner=CentralClient(config.getString("origin"),config.getString("ownerToken"));val collector=CentralClient(config.getString("origin"),config.getString("collectorToken"));val actionId=config.getString("expectedActionId");val language=MoteI18n.preference();MoteI18n.select(context,"zh-CN")
        val manager=WorkManager.getInstance(context);val live=manager.getWorkInfosForUniqueWorkLiveData("mote-calendar-delivery");val transitions=CopyOnWriteArrayList<JSONObject>();val observer=Observer<List<WorkInfo>>{rows->rows.filter{!it.state.isFinished}.forEach{transitions.add(info(it))}}
        var changed=false;var finished=false;var finalAction:JSONObject?=null;var selectedWork:WorkInfo?=null
        val result=JSONObject().put("generatedOnly",true).put("actionId",actionId).put("periodicWorkName","mote-calendar-delivery").put("forceJobScheduler",false).put("oneTimeWorkEnqueued",false).put("adapterExecutorCalled",false).put("modelInvoked",false)
        try{
            // No send policy changes until both the whole collector and all local pending work are isolated.
            val pending=JSONObject().put("hasPendingConnectionData",settings.hasPendingData()).put("captures",context.queue().pendingSync().count).put("sources",context.localSources().pendingSync().count).put("files",context.fileArchives().pendingSync().count);result.put("localPendingPreflight",pending)
            require(!pending.getBoolean("hasPendingConnectionData")&&pending.getInt("captures")==0&&pending.getInt("sources")==0&&pending.getInt("files")==0)
            require(context.localSources().sources().none{it.enabled}) { "An enabled source could create unrelated pending material" }
            val deliveries=collector.get("/api/managed-calendar-deliveries");val rows=deliveries.getJSONArray("items");result.put("managedPreflight",deliveries);require(rows.length()==1&&rows.getJSONObject(0).getString("id")==actionId&&!deliveries.optBoolean("manualReviewAllowed",false)&&!deliveries.optBoolean("truncated",false)&&deliveries.optString("nextCursor").isBlank())
            var action=owner.get("/api/actions/$actionId");require(action.getString("status")=="approved"&&action.getString("kind")=="calendar.update");val target=action.getJSONObject("target");require(target.getString("deviceId")==device&&target.getString("calendarId")=="1")
            require(action.getJSONObject("related").getString("actionId")=="d6a735b5-2c64-4d92-8901-307cef1a250f"&&action.getJSONObject("related").getString("externalId")=="6")
            val grants=owner.get("/api/action-capabilities").getJSONArray("grants");val grant=(0 until grants.length()).map{grants.getJSONObject(it)}.single{it.getString("id")==config.getString("grantId")};require(grant.getBoolean("available")&&grant.getString("state")=="active"&&grant.getBoolean("executionEnabled"));require(grant.getLong("revision")==action.getJSONObject("managed").getLong("grantRevision"));val sources=grant.getJSONObject("inputs").getJSONArray("sources");require(sources.length()==1&&sources.getJSONObject(0).getString("sourceId")==config.getString("sourceId"))
            val expected=action.getJSONObject("event");require(expected.getString("location")=="雨松厅"&&expected.getString("timeZone")=="UTC"&&expected.getString("start").contains("T13:00:00")&&expected.getString("end").contains("T14:00:00"))
            val old6=event("6","1");val old7=event("7","1");result.put("event6Before",old6).put("event7Before",old7).put("grantId",grant.getString("id")).put("grantRevision",grant.getLong("revision")).put("sourceId",config.getString("sourceId"))
            until("Existing production periodic registration readable"){manager.getWorkInfosForUniqueWork("mote-calendar-delivery").get().any{!it.state.isFinished}}
            val existing=manager.getWorkInfosForUniqueWork("mote-calendar-delivery").get().single{!it.state.isFinished};selectedWork=existing;require(existing.tags.contains("dev.mote.collector.CalendarActionWorker"));require(existing.nextScheduleTimeMillis<=System.currentTimeMillis()+1_200_000)
            result.put("initialWork",info(existing));main{live.observeForever(observer)}
            changed=true;setMode("realtime");setPaused(false);require(!settings.enabled&&settings.read()==before.copy(syncMode="realtime",syncPaused=false));require(SyncSchedule.waitingReason(context,settings.read())==null)
            val enabledAt=System.currentTimeMillis();result.put("observationStartedAt",enabledAt).put("observerDeadlineAt",enabledAt+1_200_000).put("leaseActive",true);write("observer-progress",result)
            val deadline=SystemClock.elapsedRealtime()+1_200_000
            while(SystemClock.elapsedRealtime()<deadline){
                assertFalse(settings.enabled);assertTrue(main{ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED).isEmpty()})
                action=owner.get("/api/actions/$actionId");finalAction=action
                require(action.getString("status") !in listOf("stale","dismissed","uncertain")) { "The actual operation requires attention; do not retry an effect" }
                val now=manager.getWorkInfoById(existing.id).get();require(now!=null&&!now.state.isFinished)
                result.put("latestWork",info(now)).put("latestActionStatus",action.getString("status")).put("transitions",JSONArray(transitions.toList()));write("observer-progress",result)
                if(action.getString("status")=="succeeded"&&now.state==WorkInfo.State.ENQUEUED&&transitions.any{it.getString("id")==existing.id.toString()&&it.getString("state")=="RUNNING"&&it.getBoolean("automaticSendingEnabled")}){
                    val actual=event("6","1");val times=CalendarActionRules.times(action.getJSONObject("event"));assertEquals(times.first,actual.getLong("start"));assertEquals(times.second,actual.getLong("end"));assertEquals(expected.getString("title"),actual.getString("title"));assertEquals("雨松厅",actual.getString("location"));assertEquals("UTC",actual.getString("timeZone"));assertTrue(actual.getString("description").contains(CalendarActionRules.marker("d6a735b5-2c64-4d92-8901-307cef1a250f")));assertEquals(old7.toString(),event("7","1").toString());require(now.nextScheduleTimeMillis>System.currentTimeMillis())
                    result.put("event6After",actual).put("event7After",event("7","1")).put("receipt",action).put("naturalPeriodicRunObserved",true).put("success",true).put("completedAt",System.currentTimeMillis());finished=true;break
                }
                Thread.sleep(1000)
            }
            assertTrue("Existing natural periodic job must complete within the explicitly selected20min window",finished)
        }finally{
            main{live.removeObserver(observer)}
            var restoreError:Throwable?=null
            if(changed)try{setPaused(true);setMode("manual")}catch(error:Throwable){restoreError=error;settings.save(before,confirmCentralEndpoint=true)}
            MoteI18n.select(context,language);result.put("leaseActive",false).put("success",finished).put("finalActionStatus",finalAction?.optString("status")).put("transitions",JSONArray(transitions.toList())).put("configurationRestored",settings.read()==before).put("deviceIdUnchanged",settings.deviceId==device).put("collectorStopped",!settings.enabled).put("restoreUiError",restoreError?.javaClass?.simpleName)
            require(settings.read()==before&&!settings.enabled&&settings.deviceId==device);require(ids==context.queue().dedupeIds().toSet());originals.forEach{(id,value)->assertEquals(value,context.queue().capture(id)!!.toString())};privateBytes.forEach{(file,bytes)->assertArrayEquals(bytes,file.readBytes())};result.put("privateFilesUnchanged",true).put("originalQueueUnchanged",true);input.delete();write("observer-result",result);write("observer-progress",result)
            restoreError?.let{throw it}
        }
    }
}
