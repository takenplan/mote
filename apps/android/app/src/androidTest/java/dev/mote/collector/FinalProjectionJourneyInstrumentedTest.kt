package dev.mote.collector

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.os.SystemClock
import android.provider.CalendarContract
import android.view.View
import android.view.ViewGroup
import android.view.inspector.WindowInspector
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/** Manually selected system consent on the sole hidden generated AVD. No network policy or grant is replaced. */
class FinalProjectionJourneyInstrumentedTest {
    private val instrumentation get()=InstrumentationRegistry.getInstrumentation()
    private val context get()=instrumentation.targetContext
    private val automation get()=instrumentation.getUiAutomation(android.app.UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES)
    private val out get()=File(context.filesDir,"final-projection").apply{mkdirs()}
    private fun <T> main(block:()->T):T{val result=AtomicReference<Result<T>>();instrumentation.runOnMainSync{result.set(runCatching(block))};return result.get().getOrThrow()}
    private fun views(v:View):List<View> = listOf(v)+if(v is ViewGroup)(0 until v.childCount).flatMap{views(v.getChildAt(it))}else emptyList()
    private fun shown()=WindowInspector.getGlobalWindowViews().filter{it.isShown&&it.hasWindowFocus()}.flatMap(::views).filter{it.isShown}
    private fun until(label:String,check:()->Boolean){val end=SystemClock.elapsedRealtime()+45_000;while(SystemClock.elapsedRealtime()<end){if(check())return;Thread.sleep(50)};fail(label)}
    private fun click(text:String){until("Actual UI action $text"){main{shown().filterIsInstance<TextView>().any{it.isClickable&&it.isEnabled&&it.text.toString()==text}}};main{shown().filterIsInstance<TextView>().first{it.isClickable&&it.isEnabled&&it.text.toString()==text}.performClick()}}
    private fun clickTag(tag:String){until("Actual UI row $tag"){main{shown().any{it.tag==tag&&it.isEnabled}}};main{shown().single{it.tag==tag&&it.isEnabled}.performClick()}}
    private fun picture(name:String){instrumentation.waitForIdleSync();val frame=CountDownLatch(1);main{WindowInspector.getGlobalWindowViews().last{it.isShown&&it.hasWindowFocus()}.postOnAnimation{frame.countDown()}};check(frame.await(5,TimeUnit.SECONDS));main{val root=WindowInspector.getGlobalWindowViews().last{it.isShown&&it.hasWindowFocus()};val image=Bitmap.createBitmap(root.width,root.height,Bitmap.Config.ARGB_8888);try{out.resolve("$name.png").outputStream().use{root.draw(android.graphics.Canvas(image));image.compress(Bitmap.CompressFormat.PNG,100,it)}}finally{image.recycle()}}}
    private fun stop(){val done=CountDownLatch(1);main{RuntimeSettings.cancelProjectionConsentRequest();RuntimeSettings.stop(context){done.countDown()}};check(done.await(30,TimeUnit.SECONDS));until("Projection producer stopped and drained"){!Settings(context).enabled&&!ProjectionService.running&&ProjectionService.instance==null&&ConnectionGuard.processing.get()==0}}
    private data class Saved(val bytes:ByteArray,val mtime:Long)
    private fun files(directory:File)=directory.listFiles().orEmpty().also{require(it.all(File::isFile))}.associate{it.name to Saved(it.readBytes(),it.lastModified())}
    private fun restorePrefs(values:Map<String,*>) {val prefs=context.getSharedPreferences("mote",0);val edit=prefs.edit().clear();values.forEach{(k,v)->when(v){is String->edit.putString(k,v);is Boolean->edit.putBoolean(k,v);is Int->edit.putInt(k,v);is Long->edit.putLong(k,v);is Float->edit.putFloat(k,v);is Set<*>->edit.putStringSet(k,v.filterIsInstance<String>().toSet());else->error("Unsupported stored preference")}};check(edit.commit());assertEquals(values,prefs.all)}
    private fun calendarState():String {
        fun rows(uri:android.net.Uri,columns:Array<String>,where:String):JSONArray = context.contentResolver.query(uri,columns,where,null,"_id")!!.use { cursor ->
            JSONArray().apply { while(cursor.moveToNext())put(JSONArray().apply { for(i in columns.indices)put(if(cursor.isNull(i))JSONObject.NULL else cursor.getString(i)) }) }
        }
        return JSONObject().put("calendar",rows(CalendarContract.Calendars.CONTENT_URI,arrayOf("_id","account_name","account_type","calendar_displayName"),"_id=1"))
            .put("events",rows(CalendarContract.Events.CONTENT_URI,arrayOf("_id","calendar_id","title","description","dtstart","dtend","allDay","eventLocation","eventTimezone","deleted"),"calendar_id=1")).toString()
    }
    @Test fun explicitProjectionConsentAndStorageResumePreserveTheFinalCollectorWithoutUploading(){
        assumeTrue(InstrumentationRegistry.getArguments().getString("nativeFinalProjection")=="true")
        require(context.packageName=="dev.mote.collector.dev"&&Build.FINGERPRINT.contains("emu64a"))
        val settings=Settings(context);val before=settings.read();require(!settings.enabled&&!ProjectionService.running&&!CaptureAccessibilityService.connected&&before.syncMode=="manual"&&before.syncPaused)
        require(context.getSystemService(android.app.NotificationManager::class.java).areNotificationsEnabled())
        val privateFiles=listOf(File(context.filesDir,"final-central-journey.json"),File(context.filesDir,"final-calendar-journey.json"),File(context.noBackupFilesDir,"final-calendar-journey-state.json"));val privateBytes=privateFiles.associateWith{it.readBytes()};require(JSONObject(privateBytes.getValue(privateFiles[1]).toString(Charsets.UTF_8)).getBoolean("generatedOnly"))
        val originalPrefs=context.getSharedPreferences("mote",0).all.toMap();val device=settings.deviceId;val language=MoteI18n.preference();val appearance=MoteAppearance.preference();val calendar=calendarState()
        val storage=QueueStorage(context);val initial=storage.current();require(initial.baseId=="internal");val ids=context.queue().dedupeIds().toSet();val originalFiles=files(File(initial.path));val pointer=File(context.noBackupFilesDir,"queue-location.json");val pointerBytes=pointer.readBytes();require(!File(context.noBackupFilesDir,"queue-migration.json").exists());val createdLocations=mutableSetOf<QueueLocation>();var consents=0
        fun shell(command:String)=automation.executeShellCommand(command).use{android.os.ParcelFileDescriptor.AutoCloseInputStream(it).bufferedReader().use{reader->reader.readText().trim()}}
        val originalServices=shell("settings get secure enabled_accessibility_services");val originalAccessibility=shell("settings get secure accessibility_enabled");require(originalServices in setOf("null","")&&originalAccessibility in setOf("null","0","1"))
        fun systemPicture(name:String){val image=automation.takeScreenshot()?:error("System screenshot unavailable");try{out.resolve("$name.png").outputStream().use{image.compress(Bitmap.CompressFormat.PNG,100,it)}}finally{image.recycle()}}
        fun systemNodes():List<android.view.accessibility.AccessibilityNodeInfo>{
            val found=mutableListOf<android.view.accessibility.AccessibilityNodeInfo>()
            fun visit(node:android.view.accessibility.AccessibilityNodeInfo){found.add(node);for(index in 0 until node.childCount)node.getChild(index)?.let{visit(it)}}
            automation.rootInActiveWindow?.let{visit(it)}
            return found
        }
        fun systemClick(node:android.view.accessibility.AccessibilityNodeInfo):Boolean{var current:android.view.accessibility.AccessibilityNodeInfo?=node;while(current!=null&&!current.isClickable)current=current.parent;return current?.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK)==true}
        val serviceName=context.packageManager.getServiceInfo(android.content.ComponentName(context,CaptureAccessibilityService::class.java),0).loadLabel(context.packageManager).toString()
        fun dismissOwnServiceConsent(){val nodes=systemNodes();if(automation.rootInActiveWindow?.packageName?.toString()=="com.android.settings"&&nodes.any{it.text?.toString()?.contains(serviceName)==true})nodes.firstOrNull{it.text?.toString()=="Deny"}?.let(::systemClick)}
        fun enableIdentityService(){
            dismissOwnServiceConsent()
            main{context.startActivity(Intent(android.provider.Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP))}
            until("Normal Android accessibility service list"){automation.rootInActiveWindow?.packageName?.toString()=="com.android.settings"}
            until("Select only installed Mote Screen Capture service"){
                val nodes=systemNodes()
                when {
                    nodes.any{it.text?.toString()=="Deny"} -> {dismissOwnServiceConsent();false}
                    nodes.any{it.text?.toString()=="Use $serviceName"} -> true
                    else -> {val service=nodes.firstOrNull{it.text?.toString()==serviceName};if(service!=null)systemClick(service)else{nodes.firstOrNull{it.text?.toString() in setOf("Downloaded apps","Installed apps")}?.let(::systemClick);false}}
                }
            }
            until("Service enable switch for the selected Mote service"){
                val nodes=systemNodes();nodes.firstOrNull{it.isCheckable&&!it.isChecked&&(it.viewIdResourceName?.endsWith("switch_widget")==true||it.className?.toString()?.endsWith("Switch")==true)}?.let(::systemClick)==true
            }
            until("System confirms service authorization without starting capture"){
                val confirm=systemNodes().firstOrNull{it.text?.toString()=="Allow"&&it.isEnabled};if(confirm!=null){systemPicture("projection-identity-service-consent");systemClick(confirm)}
                CaptureAccessibilityService.connected
            };assertFalse(settings.enabled);systemPicture("projection-identity-service-authorized")
        }
        val network=java.util.concurrent.atomic.AtomicInteger();val previousHook=HttpJson.onRequest;HttpJson.onRequest={network.incrementAndGet();previousHook?.invoke()}
        fun consent(){until("Real Android MediaProjection consent window"){automation.rootInActiveWindow?.packageName?.toString()=="com.android.systemui"&&automation.rootInActiveWindow.findAccessibilityNodeInfosByViewId("android:id/button1").any{it.isEnabled&&it.isClickable}};automation.waitForIdle(500,5000);val image=automation.takeScreenshot();check(image!=null);try{out.resolve("projection-consent-${consents+1}.png").outputStream().use{image!!.compress(Bitmap.CompressFormat.PNG,100,it)}}finally{image?.recycle()};val root=automation.rootInActiveWindow;require(root.packageName.toString()=="com.android.systemui");val confirm=root.findAccessibilityNodeInfosByViewId("android:id/button1").single{it.isEnabled&&it.isClickable};assertTrue(confirm.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK));consents++;until("Actual foreground ProjectionService running"){settings.enabled&&ProjectionService.running&&ProjectionService.instance!=null}}
        fun start(){ActivityScenario.launch<MainActivity>(Intent(context,MainActivity::class.java).putExtra("page","PRIVACY")).awaitMainUi().use{click("保存范围并开始记录");until("Current scope preview before explicit start"){main{shown().filterIsInstance<TextView>().any{it.text.toString()=="按此范围开始"}}};assertFalse(settings.enabled);picture("projection-scope-preview-$consents");click("按此范围开始");consent();until("Actual scope page reflects the running capture flag"){main{shown().filterIsInstance<TextView>().any{it.tag=="capture-range-state"&&it.text.toString()=="正在本机采集"}}};picture("projection-running-$consents")}}
        fun generatedFrame(){val entered=System.currentTimeMillis();val component=android.content.ComponentName(context.packageName+".test",ExternalFixtureActivity::class.java.name)
            main{context.startActivity(Intent().setComponent(component).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))}
            try{until("Only external generated fixture is foreground"){automation.rootInActiveWindow?.packageName?.toString()==context.packageName+".test"};until("Actual generated white fixture frame is durably retained without ACK"){context.queue().dedupeIds().filter{it !in ids}.any{id->val row=context.queue().capture(id)?:return@any false;if(row.optString("source")!="screen"||java.time.Instant.parse(row.getString("capturedAt")).toEpochMilli()<entered)return@any false;val bytes=context.queue().image(id)?:return@any false;val bitmap=BitmapFactory.decodeByteArray(bytes,0,bytes.size)?:return@any false;try{var white=0;var dark=0;for(x in 10..90 step 2)for(y in 10..90 step 2){val pixel=bitmap.getPixel(bitmap.width*x/100,bitmap.height*y/100);val light=(android.graphics.Color.red(pixel)+android.graphics.Color.green(pixel)+android.graphics.Color.blue(pixel))/3;if(light>230)white++;if(light<80)dark++};white>1000&&dark>2}finally{bitmap.recycle()}}};systemPicture("projection-generated-fixture")}
            finally{main{context.startActivity(Intent().setComponent(component).putExtra("finishPageFixture",true).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP))};until("External generated fixture closed"){automation.rootInActiveWindow?.packageName?.toString()!=context.packageName+".test"}}
        }
        fun migrate(target:String){ActivityScenario.launch(StorageActivity::class.java).use{clickTag("storage-choice:$target");click("迁移并应用");until("Actual storage migration committed and processing resumed"){!ConnectionGuard.changing()&&storage.current().baseId==target};createdLocations.add(storage.current());picture("projection-storage-${if(target=="internal")"internal"else"external"}")}}
        try{
            MoteI18n.select(context,"zh-CN");main{MoteAppearance.select(context,AppearancePreference.LIGHT)}
            enableIdentityService()
            settings.save(before.copy(mode="projection",uiPageMode="screen_only",screenCollectionEnabled=true,notificationCollectionEnabled=false,deviceEventCollectionEnabled=false,mediaCollectionEnabled=false,metadataEnabled=false,localContentOcr=false,appCollectionRules=AppCollectionRules.fromLines(AppCollectionMode.OFF,context.packageName+".test=screenshot").json(),excludedPackages="",intervalSeconds=5,chargingOnly=false,batteryPauseBelowPct=0,imageDedupeMode="off",imageDedupeDiagnosticsEnabled=false),confirmCentralEndpoint=true)
            start();if(InstrumentationRegistry.getArguments().getString("nativeFinalProjectionConsentFrameOnly")=="true"){
                assertEquals(1,consents);assertEquals(0,network.get());assertEquals(ids,context.queue().dedupeIds().toSet())
                out.resolve("result.json").writeText(JSONObject().put("generatedOnly",true).put("consentFrameOnly",true).put("realSystemProjectionConsents",consents).put("networkRequests",network.get()).put("generatedScreenIds",JSONArray()).put("migrationRun",false).put("modelCalls",0).put("notificationPromptTested",false).toString());return
            };generatedFrame();val alive=ProjectionService.instance;val target=storage.choices().first{it.id!="internal"};migrate(target.id);assertSame("Live grant survives ordinary pipeline relocation",alive,ProjectionService.instance);assertTrue(ProjectionService.running&&settings.enabled);assertEquals(1,consents)
            ActivityScenario.launch<MainActivity>(Intent(context,MainActivity::class.java).putExtra("page","MANAGE")).awaitMainUi().use{click("暂停");until("Normal menu pause stops the only selected capture channel"){!settings.enabled&&!ProjectionService.running&&ProjectionService.instance==null};picture("projection-menu-paused")}
            migrate("internal");assertFalse(settings.enabled);assertFalse(ProjectionService.running);assertEquals(1,consents)
            start();assertEquals(2,consents)
            ActivityScenario.launch<MainActivity>(Intent(context,MainActivity::class.java).putExtra("page","SOURCES")).awaitMainUi().use{click("查看状态与操作");click("暂停采集");until("Explicit master Stop drains the fresh granted session"){!settings.enabled&&!ProjectionService.running&&ProjectionService.instance==null};picture("projection-explicit-stop")}
            assertEquals("Manual pause forbids network, including heartbeat and originals",0,network.get())
            val generated=context.queue().dedupeIds().filter{it !in ids};require(generated.isNotEmpty());generated.forEach{assertEquals("screen",context.queue().capture(it)!!.getString("source"))}
            out.resolve("result.json").writeText(JSONObject().put("generatedOnly",true).put("realSystemProjectionConsents",consents).put("liveGrantReusedAcrossMigration",true).put("stoppedMigrationDidNotStart",true).put("laterStartRequiredFreshSystemConsent",true).put("networkRequests",network.get()).put("generatedScreenIds",JSONArray(generated)).put("modelCalls",0).put("notificationPromptTested",false).put("normalAccessibilitySettingsAuthorization",true).put("captureScope","only generated external test APK screenshots; default OFF").toString())
        }finally{
            stop();dismissOwnServiceConsent();if(originalServices=="null")shell("settings delete secure enabled_accessibility_services")else shell("settings put secure enabled_accessibility_services ''");if(originalAccessibility=="null")shell("settings delete secure accessibility_enabled")else shell("settings put secure accessibility_enabled $originalAccessibility");until("Temporary identity service disconnected"){!CaptureAccessibilityService.connected};HttpJson.onRequest=previousHook
            // Test-only teardown restores the complete original generated profile, not a product migration path.
            DurableQueue.exclusive{val current=storage.current();if(current!=initial)createdLocations.add(current);for(location in createdLocations){require(location!=initial&&File(location.path).name=="mote-queue-${location.id}");check(File(location.path).deleteRecursively())};val directory=File(initial.path);if(directory.exists())check(directory.deleteRecursively());check(directory.mkdirs());originalFiles.forEach{(name,saved)->File(directory,name).apply{FileOutputStream(this).use{it.write(saved.bytes);it.fd.sync()};setLastModified(saved.mtime)}};FileOutputStream(pointer).use{it.write(pointerBytes);it.fd.sync()};File(context.noBackupFilesDir,"queue-migration.json").delete()}
            restorePrefs(originalPrefs);CentralSession.get(context).select(before.server);MoteI18n.select(context,language);main{MoteAppearance.select(context,appearance)}
            assertEquals(initial,storage.current());assertEquals(ids,context.queue().dedupeIds().toSet());val after=files(File(initial.path));assertEquals(originalFiles.keys,after.keys);originalFiles.forEach{(name,saved)->assertArrayEquals(saved.bytes,after.getValue(name).bytes)};assertArrayEquals(pointerBytes,pointer.readBytes());assertEquals(before,settings.read());assertEquals(device,settings.deviceId);assertFalse(settings.enabled);assertEquals(calendar,calendarState());privateBytes.forEach{(file,bytes)->assertArrayEquals(bytes,file.readBytes())}
            out.resolve("result.json").takeIf{it.exists()}?.let{it.writeText(JSONObject(it.readText()).put("originalQueuePointerAndFileBytesRestored",true).put("originalPreferencesAndCollectorRestored",true).put("private3AndCalendarUnchanged",true).toString())}
        }
    }
}
