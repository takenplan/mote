package dev.mote.collector

import android.content.Context
import android.os.Build
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.*
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.concurrent.TimeUnit

/** Only the isolated m15fixture package on an SDK emulator, with synthetic host accounts. */
@RunWith(AndroidJUnit4::class)
class MultiuserWorkerInstrumentedTest {
    private fun context(): Context = InstrumentationRegistry.getInstrumentation().targetContext.also {
        require(it.packageName == "dev.mote.collector.m15fixture")
        require(Build.FINGERPRINT.contains("sdk_gphone") || Build.FINGERPRINT.contains("emu64"))
    }
    private fun fixture(): JSONObject = JSONObject(File(InstrumentationRegistry.getArguments().getString("fixture")!!).readText())
    private fun endpoint() = fixture().getString("androidAddress")
    private fun token(name: String) = fixture().getJSONObject(name).getString("token")
    private fun waitFor(predicate: () -> Boolean) {
        val deadline = android.os.SystemClock.elapsedRealtime() + 45000
        while (!predicate()) { check(android.os.SystemClock.elapsedRealtime() < deadline) { "Synthetic worker deadline exceeded" }; Thread.sleep(40) }
    }
    private fun cancel(context: Context) { WorkManager.getInstance(context).cancelAllWork().result.get(15,TimeUnit.SECONDS); waitFor { !ConnectionGuard.changing() && ConnectionGuard.processing.get()==0 } }
    private fun login(context: Context, name: String) { RuntimeSettings.replaceAccount(context) { Settings(context).signIn(endpoint(),token(name),2592000000) } }
    private fun get(context: Context, name: String, path: String) = HttpJson.get(endpoint()+path,token(name))

    private fun control(path: String): JSONObject {
        val (code,value)=HttpJson.post(fixture().getString("androidControlAddress")+path,JSONObject());check(code==200);return value!!
    }
    @Test fun actualNativeVaultExportsVerifiedPersonalBytesThroughTheDocumentResultAndRetiresOnSwitch() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val output=File(app.cacheDir,"generated-portable-result.json").apply {delete()}
        val instrumentation=InstrumentationRegistry.getInstrumentation()
        var monitor: android.app.Instrumentation.ActivityMonitor? = null
        val watchdog=Thread { try { Thread.sleep(15000);File(app.cacheDir,"m15-vault-stall.txt").writeText(Thread.getAllStackTraces().entries.joinToString("\n\n") { (thread,stack)->thread.name+" "+thread.state+"\n"+stack.joinToString("\n") }) } catch (_:InterruptedException) {} }.apply {isDaemon=true;start()}
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        try {
            androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","vault")).use { scenario ->
                fun button(label:String):android.widget.Button? {var result:android.widget.Button?=null;scenario.onActivity {activity->result=views(activity.window.decorView).filterIsInstance<android.widget.Button>().firstOrNull {it.text.toString()==label&&it.isEnabled}};return result}
                fun click(label:String) {waitFor {button(label)!=null};val target=button(label)!!;instrumentation.runOnMainSync {target.performClick()}}
                waitFor {var ready=false;scenario.onActivity {ready=it.client!=null&&!it.isWorking};ready}
                click("中央资料与附件导出")
                waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready}
                waitFor {if(button("下载")!=null)true else {val refresh=button("刷新");if(refresh!=null)instrumentation.runOnMainSync {refresh.performClick()};false}}
                monitor=instrumentation.addMonitor(android.content.IntentFilter(android.content.Intent.ACTION_CREATE_DOCUMENT).apply {addCategory(android.content.Intent.CATEGORY_OPENABLE);addDataType("application/json")},android.app.Instrumentation.ActivityResult(android.app.Activity.RESULT_OK,android.content.Intent().setData(android.net.Uri.fromFile(output))),true)
                val oldDownload=button("下载")!!;click("下载")
                waitFor {output.isFile&&output.length()>0};waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready}
                val bytes=output.readBytes();val archive=JSONObject(String(bytes,Charsets.UTF_8));assertEquals(settings.read().account()!!.userId,archive.getString("userId"));assertEquals(3,archive.getInt("version"))
                assertEquals(1,monitor!!.hits);assertFalse(String(bytes,Charsets.UTF_8).contains(token("a")))
                val page=CentralPortable(CentralAccess.requireClient(app)).list();val id=page.getJSONArray("items").getJSONObject(0).getString("id")
                assertEquals(Ingress3Client.hash(bytes),CentralPortable(CentralAccess.requireClient(app)).read(id).getString("sha256"))
                // Reopen through normal native navigation before the independent cancellation case.
                scenario.onActivity {it.navigate("vault")};waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready};click("查看详情")
                waitFor {button("下载")!=null}
                val sentinel="Generated existing document must survive a retired export"
                output.writeText(sentinel)
                CentralPortable(CentralAccess.requireClient(app)).control(id,"cancel")
                click("下载")
                waitFor {monitor!!.hits==2}
                waitFor {var ready=false;scenario.onActivity {activity->ready=!activity.isWorking&&views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.tag=="central-status"&&it.text.isNotBlank()&&it.text.toString()!="资料已导出"}};ready}
                assertEquals(sentinel,output.readText())
                login(app,"b");scenario.onActivity {it.navigate("vault")};waitFor {var ready=false;scenario.onActivity {ready=it.client!=null&&!it.isWorking};ready}
                scenario.onActivity {activity->oldDownload.performClick();assertFalse(views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString().contains(id)})}
                assertEquals(2,monitor!!.hits);assertEquals(sentinel,output.readText());assertEquals(0,CentralPortable(CentralAccess.requireClient(app)).list().getJSONArray("items").length())
            }
        } finally {watchdog.interrupt();monitor?.let(instrumentation::removeMonitor);output.delete()}
    }
    @Test fun actualNativeActionsPreservesTheOpaqueSecondPageFromRealProducer() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val initial=CentralAccess.requireClient(app).get("/api/actions")
        assertEquals(20,initial.getJSONArray("items").length());assertTrue(initial.get("nextCursor") is String)
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CalendarActionsActivity>(android.content.Intent(app,CalendarActionsActivity::class.java)).use {scenario->
            fun count():Int {var value=0;scenario.onActivity {activity->value=views(activity.window.decorView).filterIsInstance<android.widget.TextView>().count {it.text.toString()=="Generated A"}};return value}
            waitFor {count()==20}
            scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()=="更早建议"}.performClick()}
            waitFor {var ready=false;scenario.onActivity {activity->ready=!(CalendarActionsActivity::class.java.getDeclaredField("task").apply {isAccessible=true}.get(activity) as UiTask).busy};ready}
            assertEquals("The existing earlier-page action must preserve the server's opaque cursor",1,count())
        }
    }

    @Test fun actualNativeCalendarDeliveryReconcilesUncertainInsertWithItsOriginalAccountAndMarker() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        assertNotEquals(android.content.pm.PackageManager.PERMISSION_GRANTED,app.checkSelfPermission(android.Manifest.permission.READ_CALENDAR))
        assertNotEquals(android.content.pm.PackageManager.PERMISSION_GRANTED,app.checkSelfPermission(android.Manifest.permission.WRITE_CALENDAR))
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false))
        check(app.getSharedPreferences("mote",Context.MODE_PRIVATE).edit().putString("deviceId","same-device").commit());login(app,"a")
        val generated=File(app.cacheDir,"generated-calendar-native-state.json");generated.delete()
        val native=GeneratedCalendarProvider(generated);val device=GeneratedCalendarContext(app,native)
        try {
            fun currentAction(id:String):JSONObject {
                val rows=CentralAccess.requireClient(app).get("/api/actions?limit=100").getJSONArray("items")
                return (0 until rows.length()).map(rows::getJSONObject).single {it.getString("id")==id}
            }
            val client=CalendarActions(device,foreground=true);client.connect()
            val items=client.list().getJSONArray("items")
            val original=(0 until items.length()).map(items::getJSONObject).first {it.getString("status")=="proposed"}
            val approved=client.confirm(original,original.getJSONObject("event"),"7");val id=approved.getString("id")
            assertEquals("approved",approved.getString("status"))
            native.failAfterNextInsert=true
            assertThrows(IllegalStateException::class.java){client.execute(id)}
            assertEquals(1,native.inserts)
            assertEquals("uncertain",currentAction(id).getString("status"))
            val operation=approved.getString("operationId")
            val journal=File(app.accountDirectory(),"calendar-actions/"+SourceRules.hash(settings.read().server.trimEnd('/')+settings.deviceId)+"/"+operation)
            assertEquals("attempting",String(SecretBox().open(journal.readBytes()),Charsets.UTF_8))
            val previousCalls=native.calls;device.allowed=false
            assertThrows(IllegalStateException::class.java){client.execute(id)}
            assertEquals(previousCalls,native.calls);device.allowed=true
            login(app,"b")
            assertThrows(IllegalStateException::class.java){client.execute(id)}
            assertEquals(previousCalls,native.calls)
            val bRows=CentralAccess.requireClient(app).get("/api/actions?limit=100").getJSONArray("items")
            assertFalse((0 until bRows.length()).any {bRows.getJSONObject(it).getString("id")==id})
            val bClient=CalendarActions(device,foreground=true);bClient.connect()
            val bItems=bClient.list().getJSONArray("items")
            val bOriginal=(0 until bItems.length()).map(bItems::getJSONObject).first {it.getString("status")=="proposed"}
            val bApproved=bClient.confirm(bOriginal,bOriginal.getJSONObject("event"),"7")
            bClient.execute(bApproved.getString("id"))
            assertEquals("succeeded",currentAction(bApproved.getString("id")).getString("status"));assertEquals(2,native.inserts)
            login(app,"a")
            // Reconstruct the native adapter and original client from durable files.
            // This is reconstruction evidence, not a claimed OS SIGKILL.
            val recoveredNative=GeneratedCalendarProvider(generated)
            val recovered=CalendarActions(GeneratedCalendarContext(app,recoveredNative),foreground=true)
            recovered.execute(id)
            assertEquals(2,recoveredNative.inserts)
            val completed=currentAction(id)
            assertEquals("succeeded",completed.getString("status"));assertEquals("101",completed.getString("externalId"))
            assertEquals("101",String(SecretBox().open(journal.readBytes()),Charsets.UTF_8))
            recovered.execute(id);assertEquals(2,recoveredNative.inserts)
        } finally {cancel(app);generated.delete()}
    }

    @Test fun anOldCalendarWorkerCannotAcquireBWhileItsNativePermissionCheckIsDelayed() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        assertNotEquals(android.content.pm.PackageManager.PERMISSION_GRANTED,app.checkSelfPermission(android.Manifest.permission.WRITE_CALENDAR))
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false))
        check(app.getSharedPreferences("mote",Context.MODE_PRIVATE).edit().putString("deviceId","same-device").commit())
        val generated=File(app.cacheDir,"generated-calendar-worker-state.json");generated.delete()
        val native=GeneratedCalendarProvider(generated);val device=GeneratedCalendarContext(app,native)
        val pool=java.util.concurrent.Executors.newSingleThreadExecutor();val release=java.util.concurrent.CountDownLatch(1)
        fun parameters(owner:String):WorkerParameters {
            // Direct doWork boundary. These unused async progress/foreground
            // collaborators are null; no WorkManager persistence claim is made.
            return WorkerParameters::class.java.constructors.single().newInstance(java.util.UUID.randomUUID(),workDataOf("owner" to owner),emptyList<String>(),WorkerParameters.RuntimeExtras(),0,0,java.util.concurrent.Executor {it.run()},kotlin.coroutines.EmptyCoroutineContext,null,null,null,null) as WorkerParameters
        }
        try {
            login(app,"b");val bClient=CalendarActions(device,foreground=true);bClient.connect()
            val rows=bClient.list().getJSONArray("items");val original=(0 until rows.length()).map(rows::getJSONObject).first {it.getString("status")=="proposed"}
            val approved=bClient.confirm(original,original.getJSONObject("event"),"7");val id=approved.getString("id")
            login(app,"a");settings.save(settings.read().copy(syncMode="realtime",syncPaused=false))
            val ownerA=settings.read().ownerKey();val entered=java.util.concurrent.CountDownLatch(1)
            device.beforePermission={entered.countDown();check(release.await(20,TimeUnit.SECONDS))}
            val old=pool.submit<androidx.work.ListenableWorker.Result> {CalendarActionWorker(device,parameters(ownerA)).doWork()}
            assertTrue(entered.await(5,TimeUnit.SECONDS));login(app,"b")
            // Explicit B sending policy must not legitimize an old A job.
            settings.save(settings.read().copy(syncMode="realtime",syncPaused=false));release.countDown();old.get(20,TimeUnit.SECONDS)
            assertEquals("The old A worker must not dispatch B's approved native operation",0,native.inserts)
            fun bAction():JSONObject {val page=CentralAccess.requireClient(app).get("/api/actions?limit=100").getJSONArray("items");return (0 until page.length()).map(page::getJSONObject).single {it.getString("id")==id}}
            assertEquals("approved",bAction().getString("status"))
            val current=CalendarActionWorker(device,parameters(settings.read().ownerKey())).doWork()
            assertEquals(androidx.work.ListenableWorker.Result.success(),current);assertEquals(1,native.inserts);assertEquals("succeeded",bAction().getString("status"))
        } finally {release.countDown();pool.shutdownNow();cancel(app);generated.delete()}
    }

    @Test fun actualNativeActionsRetiresVisiblePrivateProposalsBeforeAnotherAccountResumes() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CalendarActionsActivity>(android.content.Intent(app,CalendarActionsActivity::class.java)).use {scenario->
            waitFor {var shown=false;scenario.onActivity {activity->shown=views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString()=="Generated A"}};shown}
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);login(app,"b");scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED)
            scenario.onActivity {activity->assertFalse("B must not resume A's already rendered private Actions proposals",views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString()=="Generated A"})}
            waitFor {var shown=false;scenario.onActivity {activity->shown=views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString()=="Generated B"}};shown}
            assertEquals(21,get(app,"a","/api/actions?limit=100").second!!.getJSONArray("items").length())
        }
    }

    @Test fun actualNativeActionsClosesOriginalEvidenceOnSwitchAndKeepsSameOwnerRecreation() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        fun dialogs():List<android.app.AlertDialog> {
            @Suppress("UNCHECKED_CAST")
            val all=MoteDialogBuilder::class.java.getDeclaredField("dialogs").apply {isAccessible=true}.get(null) as List<java.lang.ref.WeakReference<android.app.AlertDialog>>
            return all.mapNotNull {it.get()}.filter {it.isShowing}
        }
        androidx.test.core.app.ActivityScenario.launch<CalendarActionsActivity>(android.content.Intent(app,CalendarActionsActivity::class.java)).use {scenario->
            fun shown(label:String):Boolean {var value=false;scenario.onActivity {activity->value=views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString()==label}};return value}
            waitFor {shown("Generated A")};scenario.recreate();waitFor {shown("Generated A")}
            lateinit var evidence:android.app.AlertDialog
            scenario.onActivity {activity->
                views(activity.window.decorView).filterIsInstance<android.widget.Button>().first {it.text.toString()=="查看原文依据"}.performClick()
                evidence=dialogs().single()
                assertTrue(views(evidence.window!!.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString().contains("GENERATED_A_PRIVATE_APPOINTMENT")})
            }
            val statuses=get(app,"a","/api/actions?limit=100").second!!.getJSONArray("items").let {rows->(0 until rows.length()).associate {rows.getJSONObject(it).getString("id") to rows.getJSONObject(it).getString("status")}}
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);login(app,"b");scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED)
            scenario.onActivity {assertFalse("The original account's evidence dialog must retire with its page",evidence.isShowing)}
            waitFor {shown("Generated B")}
            assertFalse(shown("Generated A"))
            val retained=get(app,"a","/api/actions?limit=100").second!!.getJSONArray("items").let {rows->(0 until rows.length()).associate {rows.getJSONObject(it).getString("id") to rows.getJSONObject(it).getString("status")}}
            assertEquals(statuses,retained)
        }
    }

    @Test fun calendarReviewClientRetainsItsOriginalAccountWithoutRequestingCalendarPermission() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val original=CalendarActions(app,foreground=true)
        assertNotNull(original.list().getJSONArray("items"))
        login(app,"b")
        assertThrows("A's retained native Actions client cannot borrow B's current credential",IllegalStateException::class.java){original.list()}
        assertNotNull(CalendarActions(app,foreground=true).list().getJSONArray("items"))
    }

    @Test fun queuedArchiveReadCannotResolveTheNextAccountsCredentialWhilePaused() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false,uploadedRetentionDays=7));login(app,"a");MoteI18n.select(app,"zh-CN")
        val note="Generated queued A archive "+java.util.UUID.randomUUID();QuickNotes.save(app,note,"");UploadWorker.schedule(app,settings.read(),true);waitFor {app.queue().pendingSync().count==0}
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CaptureRecordsActivity>(android.content.Intent(app,CaptureRecordsActivity::class.java).putExtra("recordSource","note")).use {scenario->
            scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Spinner>().single {it.adapter.getItem(0).toString()=="本机记录"}.setSelection(1)}
            waitFor {var shown=false;scenario.onActivity {activity->shown=views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString().contains(note)}};shown}
            lateinit var executor:java.util.concurrent.ThreadPoolExecutor
            scenario.onActivity {activity->executor=CaptureRecordsActivity::class.java.getDeclaredField("executor").apply {isAccessible=true}.get(activity) as java.util.concurrent.ThreadPoolExecutor}
            val entered=java.util.concurrent.CountDownLatch(1);val release=java.util.concurrent.CountDownLatch(1)
            executor.execute {entered.countDown();release.await(20,TimeUnit.SECONDS)};assertTrue(entered.await(5,TimeUnit.SECONDS))
            try {
                scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()=="刷新"}.performClick()}
                scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);login(app,"b");control("/archive-reads/reset")
                release.countDown();executor.submit {}.get(15,TimeUnit.SECONDS)
                val reads=control("/archive-reads").getJSONArray("archiveReads")
                assertEquals("The old queued A operation must not issue a private read using B's credential before resume",0,(0 until reads.length()).count {reads.getJSONObject(it).getString("owner")=="b"})
            } finally {release.countDown()}
        }
    }

    @Test fun actualNativeArchiveRetiresVisiblePrivateRowsBeforeResumingAnotherAccount() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false,uploadedRetentionDays=7));login(app,"a");MoteI18n.select(app,"zh-CN")
        val privateText="Generated private A visible archive "+java.util.UUID.randomUUID()
        QuickNotes.save(app,privateText,"");UploadWorker.schedule(app,settings.read(),true);waitFor {app.queue().pendingSync().count==0}
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CaptureRecordsActivity>(android.content.Intent(app,CaptureRecordsActivity::class.java).putExtra("recordSource","note")).use {scenario->
            scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Spinner>().single {it.adapter.getItem(0).toString()=="本机记录"}.setSelection(1)}
            waitFor {var shown=false;scenario.onActivity {activity->shown=views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString().contains(privateText)}};shown}
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED)
            login(app,"b")
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED)
            // Inspect before any touch, explicit navigation or refresh could retire the old page.
            scenario.onActivity {activity->assertFalse("Returning under B must not display A's already rendered private archive",views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString().contains(privateText)})}
        }
    }

    @Test fun originalNativeCentralArchiveReaderShowsActualDerivedOcrInsteadOfImmutableEmptyIntake() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false,uploadedRetentionDays=7));login(app,"a");MoteI18n.select(app,"zh-CN")
        val id=java.util.UUID.randomUUID().toString();val label="Generated OCR reader "+id
        val bitmap=android.graphics.Bitmap.createBitmap(24,24,android.graphics.Bitmap.Config.ARGB_8888).apply {eraseColor(android.graphics.Color.GREEN)}
        val bytes=java.io.ByteArrayOutputStream().also {bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it)}.toByteArray();bitmap.recycle()
        app.queue().enqueue(JSONObject().put("id",id).put("deviceId",settings.deviceId).put("deviceName","Generated OCR reader").put("platform","android").put("source","screen").put("capturedAt",java.time.Instant.now().toString()).put("durationMs",0).put("appId","generated.reader").put("appName",label).put("imageMime","image/png").put("ocrText","").put("ocr",JSONObject().put("status","disabled")).put("privacy",JSONObject().put("excluded",false).put("redacted",false).put("mode","local").put("collection","content")),bytes,settings.read().maxQueueMiB*1024L*1024L)
        UploadWorker.schedule(app,settings.read(),true);waitFor {app.queue().pendingSync().count==0};control("/ocr/a/$id")
        assertEquals("",CentralAccess.requireClient(app).get("/api/captures/$id").getString("ocrText"))
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","archive")).use {scenario->
            fun ready() {waitFor {var value=false;scenario.onActivity {value=it.client!=null&&!it.isWorking};value}}
            fun click(label:String) {var done=false;waitFor {scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().firstOrNull {it.text.toString()==label&&it.isEnabled}?.let {it.performClick();done=true}};done}}
            ready();click("原始采集记录");ready()
            var opened=false;waitFor {scenario.onActivity {activity->val title=views(activity.window.decorView).filterIsInstance<android.widget.TextView>().firstOrNull {it.text.toString()==label};if(title!=null){views(title.parent as android.view.View).filterIsInstance<android.widget.Button>().single {it.text.toString()=="查看原文"}.performClick();opened=true}};opened};ready()
            scenario.onActivity {activity->assertTrue("Original native raw reader must show actual M06 OCR, while immutable intake stays unchanged",views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString()=="GENERATED_A_NATIVE_CENTRAL_OCR"})}
        }
    }

    @Test fun deviceBoundPerceptionPullCachesItsOwnActualCentralOcrAndResetsFutureCursor() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false,uploadedRetentionDays=7));login(app,"a");MoteI18n.select(app,"zh-CN")
        val api=CentralAccess.requireClient(app);val bitmap=android.graphics.Bitmap.createBitmap(24,24,android.graphics.Bitmap.Config.ARGB_8888).apply {eraseColor(android.graphics.Color.BLUE)}
        val bytes=java.io.ByteArrayOutputStream().also {bitmap.compress(android.graphics.Bitmap.CompressFormat.PNG,100,it)}.toByteArray();bitmap.recycle()
        val at=java.time.Instant.now().toString();val id=java.util.UUID.randomUUID().toString()
        val event=JSONObject().put("id",id).put("deviceId",settings.deviceId).put("deviceName","Generated native OCR").put("platform","android").put("source","screen").put("capturedAt",at).put("durationMs",0).put("appId","generated.raw").put("appName","Generated raw").put("imageMime","image/png").put("ocrText","").put("ocr",JSONObject().put("status","disabled")).put("privacy",JSONObject().put("excluded",false).put("redacted",false).put("mode","local").put("collection","content"))
        app.queue().enqueue(event,bytes,settings.read().maxQueueMiB*1024L*1024L);UploadWorker.schedule(app,settings.read(),true);waitFor {app.queue().pendingSync().count==0}
        val range=java.time.Instant.parse(at);val browser=CaptureRecordClient(settings.read(),settings.deviceId,api)
        assertTrue(browser.albums(range.minusSeconds(60).toString(),range.plusSeconds(60).toString(),null).getJSONArray("items").length()>0)
        assertArrayEquals(bytes,browser.image(id,false));assertNotNull(CapturePreview.decode(browser.image(id,true),480))
        control("/ocr/a/$id");assertEquals("",api.get("/api/captures/$id").getString("ocrText"));assertEquals("GENERATED_A_NATIVE_CENTRAL_OCR",browser.detail(id).getString("ocrText"))
        val invitation=api.post("/api/login/session",JSONObject().put("serverUrl",endpoint()).put("deviceId",settings.deviceId).put("deviceName","Generated native OCR").put("platform","android"))
        RuntimeSettings.replaceAccount(app){settings.signIn(endpoint(),invitation.getString("token"),2592000000)};val bound=settings.read();assertTrue(bound.deviceBoundCredential)
        val prefs=app.accountPreferences("central-perception");val key=SourceRules.hash(bound.ownerKey()+"\n"+settings.deviceId);check(prefs.edit().putLong(key,9007199254740991L).commit())
        val queue=app.queue();PerceptionSync.pull(app,settings,bound,queue)
        assertEquals("Device-bound sync must use its narrow ingress reader and repair a verified future cursor", "GENERATED_A_NATIVE_CENTRAL_OCR",queue.capture(id)!!.getString("ocrText"))
        assertTrue(prefs.getLong(key,0) in 1 until 9007199254740991L)
        login(app,"b");assertThrows(IllegalStateException::class.java){PerceptionSync.pull(app,settings,bound,queue)};assertEquals(0,app.queue().depth())
        login(app,"a");assertEquals("GENERATED_A_NATIVE_CENTRAL_OCR",app.queue().capture(id)!!.getString("ocrText"))
    }

    @Test fun actualNativePortableImportUsesTheChosenArchiveAndOriginalOwnerReceipt() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val api=CentralAccess.requireClient(app);val defaults=api.get("/api/configuration").toString();val note=QuickNotes.save(app,"Generated portable import original "+java.util.UUID.randomUUID(),"");UploadWorker.schedule(app,settings.read(),true);waitFor {app.queue().pendingSync().count==0}
        val portable=CentralPortable(api);val export=portable.start(java.util.UUID.randomUUID().toString());var receipt=export
        waitFor {receipt=portable.read(export.getString("id"));receipt.getString("state")=="completed"}
        val file=File(app.filesDir,"generated-file-sync/native-portable.json").apply {parentFile!!.mkdirs()};portable.save(receipt,app.cacheDir) {file.outputStream()}
        val uri=android.provider.DocumentsContract.buildDocumentUri(app.packageName+".file-fixtures","native-portable.json")
        val instrumentation=InstrumentationRegistry.getInstrumentation();var monitor:android.app.Instrumentation.ActivityMonitor?=null
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        try {
            androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","imports")).use {scenario->
                fun ready() {waitFor {var value=false;scenario.onActivity {value=it.client!=null&&!it.isWorking};value}}
                fun click(label:String) {var done=false;waitFor {scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().firstOrNull {it.text.toString()==label&&it.isEnabled}?.let {it.performClick();done=true}};done}}
                ready()
                scenario.onActivity {activity->assertTrue("The native import page must offer the frozen same-account portable import",views(activity.window.decorView).filterIsInstance<android.widget.Button>().any {it.text.toString()=="导入个人归档"&&it.isEnabled})}
                monitor=instrumentation.addMonitor(android.content.IntentFilter(android.content.Intent.ACTION_OPEN_DOCUMENT).apply {addCategory(android.content.Intent.CATEGORY_OPENABLE);addDataType("application/json")},android.app.Instrumentation.ActivityResult(android.app.Activity.RESULT_OK,android.content.Intent().setData(uri)),true)
                click("导入个人归档");ready();assertEquals(1,monitor!!.hits)
                var imported:JSONObject?=null;waitFor {val items=api.get("/api/portable/imports?limit=20").getJSONArray("items");imported=(0 until items.length()).map {items.getJSONObject(it)}.firstOrNull {it.getString("state")=="completed"};imported!=null}
                click("刷新");ready()
                scenario.onActivity {activity->assertTrue(views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString()=="已完成"})}
                assertEquals(defaults,api.get("/api/configuration").toString());assertEquals(200,get(app,"a","/api/captures/$note").first)
                assertEquals(409,assertThrows(CentralFailure::class.java){api.post("/api/portable/imports/"+imported!!.getString("id")+"/cancel")}.status)
                login(app,"b");scenario.onActivity {it.navigate("imports")};ready()
                scenario.onActivity {activity->CentralActivity::class.java.getDeclaredMethod("onActivityResult",Int::class.javaPrimitiveType,Int::class.javaPrimitiveType,android.content.Intent::class.java).apply {isAccessible=true}.invoke(activity,74,android.app.Activity.RESULT_OK,android.content.Intent().setData(uri))};ready()
                assertEquals(0,CentralAccess.requireClient(app).get("/api/portable/imports?limit=20").getJSONArray("items").length())
                assertEquals(404,assertThrows(CentralFailure::class.java){CentralAccess.requireClient(app).get("/api/portable/imports/"+imported!!.getString("id"))}.status)
            }
        } finally {monitor?.let(instrumentation::removeMonitor);file.delete()}
    }

    @Test fun failedGenericSupportDownloadPreservesTheSelectedExistingDocument() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val sentinel="Generated existing support document "+java.util.UUID.randomUUID()
        val output=File(app.cacheDir,"generated-support-result.json").apply {writeText(sentinel)}
        val instrumentation=InstrumentationRegistry.getInstrumentation();var monitor:android.app.Instrumentation.ActivityMonitor?=null
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        try {
            androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","developer")).use {scenario->
                waitFor {var ready=false;scenario.onActivity {ready=it.client!=null&&!it.isWorking};ready}
                monitor=instrumentation.addMonitor(android.content.IntentFilter(android.content.Intent.ACTION_CREATE_DOCUMENT).apply {addCategory(android.content.Intent.CATEGORY_OPENABLE);addDataType("application/json")},android.app.Instrumentation.ActivityResult(android.app.Activity.RESULT_OK,android.content.Intent().setData(android.net.Uri.fromFile(output))),true)
                var clicked=false;waitFor {scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().firstOrNull {it.text.toString()=="导出支持包"&&it.isEnabled}?.let {it.performClick();clicked=true}};clicked}
                waitFor {monitor!!.hits==1};waitFor {var ready=false;scenario.onActivity {activity->ready=!activity.isWorking&&views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.tag=="central-status"&&it.text.isNotBlank()&&it.text.toString()!="资料已导出"}};ready}
                assertEquals("An unavailable or forbidden download must not truncate an existing selected document",sentinel,output.readText())
            }
        } finally {monitor?.let(instrumentation::removeMonitor);output.delete()}
    }

    @Test fun actualNativeCentralDraftStoresRetireWhenTheSameOriginChangesAccount() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server=endpoint(),token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false),confirmCentralEndpoint=true);login(app,"a");MoteI18n.select(app,"zh-CN")
        val aDraft="Synthetic A unsaved private central draft";val bDraft="Synthetic B explicitly created central draft"
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","notes")).use { scenario ->
            fun ready() {waitFor {var value=false;scenario.onActivity {activity->value=activity.client!=null&&!activity.isWorking&&views(activity.window.decorView).filterIsInstance<android.widget.EditText>().any {it.hint.toString()=="此刻想留下什么？"}};value}}
            fun draft():String {var value="";scenario.onActivity {activity->value=views(activity.window.decorView).filterIsInstance<android.widget.EditText>().single {it.hint.toString()=="此刻想留下什么？"}.text.toString()};return value}
            fun edit(text:String) {scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.EditText>().single {it.hint.toString()=="此刻想留下什么？"}.setText(text)};CentralDraftWrites.barrier {Unit}}
            ready();edit(aDraft);var original:CentralClient?=null;scenario.onActivity {original=it.client}
            login(app,"b");scenario.onActivity {it.navigate("notes")};waitFor {var changed=false;scenario.onActivity {changed=it.client!=null&&it.client!==original&&!it.isWorking};changed};ready()
            assertEquals("B must not read A's retained native draft","",draft());edit(bDraft)
            scenario.onActivity {original=it.client};login(app,"a");scenario.onActivity {it.navigate("notes")};waitFor {var changed=false;scenario.onActivity {changed=it.client!=null&&it.client!==original&&!it.isWorking};changed};ready();assertEquals(aDraft,draft())
            scenario.onActivity {original=it.client};login(app,"b");scenario.onActivity {it.navigate("notes")};waitFor {var changed=false;scenario.onActivity {changed=it.client!=null&&it.client!==original&&!it.isWorking};changed};ready();assertEquals(bDraft,draft())
        }
    }

    @Test fun pausedNativeNotesRetirePrivateTextBeforeQueuedSessionResolutionOnResume() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val privateDraft="Generated A private draft before blocked resume "+java.util.UUID.randomUUID()
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","notes")).use {scenario->
            waitFor {var ready=false;scenario.onActivity {activity->ready=activity.client!=null&&!activity.isWorking&&views(activity.window.decorView).filterIsInstance<android.widget.EditText>().any {it.hint.toString()=="此刻想留下什么？"}};ready}
            lateinit var executor:java.util.concurrent.ExecutorService
            scenario.onActivity {activity->
                views(activity.window.decorView).filterIsInstance<android.widget.EditText>().single {it.hint.toString()=="此刻想留下什么？"}.setText(privateDraft)
                val content=CentralActivity::class.java.getDeclaredField("content").apply {isAccessible=true}.get(activity)
                val task=(CentralContent::class.java.getDeclaredField("task\$delegate").apply {isAccessible=true}.get(content) as Lazy<*>).value
                executor=UiTask::class.java.getDeclaredField("executor").apply {isAccessible=true}.get(task) as java.util.concurrent.ExecutorService
            }
            CentralDraftWrites.barrier {Unit}
            val entered=java.util.concurrent.CountDownLatch(1);val release=java.util.concurrent.CountDownLatch(1)
            executor.execute {entered.countDown();release.await(20,TimeUnit.SECONDS)};assertTrue(entered.await(5,TimeUnit.SECONDS))
            try {
                scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);login(app,"b");scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED)
                scenario.onActivity {activity->assertFalse("The old private draft must retire before the queued account resolver runs",views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString().contains(privateDraft)})}
            } finally {release.countDown();executor.submit {}.get(15,TimeUnit.SECONDS)}
            waitFor {var ready=false;scenario.onActivity {activity->ready=activity.client!=null&&!activity.isWorking&&views(activity.window.decorView).filterIsInstance<android.widget.EditText>().any {it.hint.toString()=="此刻想留下什么？"&&it.text.isEmpty()}};ready}
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);login(app,"a");scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED)
            waitFor {var ready=false;scenario.onActivity {activity->ready=!activity.isWorking&&views(activity.window.decorView).filterIsInstance<android.widget.EditText>().any {it.text.toString()==privateDraft}};ready}
        }
    }

    @Test fun originalNativeMcpDiscoveryAndImportUseTheOwnedConnectionAndKeepAccountDraftsSeparate() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val a=CentralAccess.requireClient(app);val view=a.get("/api/configuration")
        val domains=view.getJSONArray("domains");val saved=(0 until domains.length()).map(domains::getJSONObject).single {it.getString("id")=="mcpConnections"}.getJSONObject("saved")
        assertEquals("same-connection",saved.getJSONArray("connections").getJSONObject(0).getString("id"))
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","settings")).use {scenario->
            waitFor {var ready=false;scenario.onActivity {ready=it.client!=null&&!it.isWorking};ready}
            scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()=="来源与外部应用"}.performClick()}
            waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready}
            scenario.onActivity {activity->
                assertTrue("MCP must select a saved owned connection instead of sending endpoint credentials in discovery",views(activity.window.decorView).filterIsInstance<android.widget.Spinner>().any {spinner->(0 until spinner.count).any {spinner.getItemAtPosition(it).toString().contains("same-connection")}})
                views(activity.window.decorView).filterIsInstance<android.widget.Spinner>().single {spinner->(0 until spinner.count).any {spinner.getItemAtPosition(it).toString().contains("same-connection")}}.setSelection(1)
            }
            InstrumentationRegistry.getInstrumentation().waitForIdleSync()
            scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()=="发现 MCP 资源"}.performClick()}
            waitFor {var ready=false;scenario.onActivity {activity->ready=!activity.isWorking&&views(activity.window.decorView).filterIsInstance<android.widget.CheckBox>().any {it.text.toString()=="GENERATED_A_RESOURCE"}};ready}
            lateinit var oldImport:android.widget.Button
            scenario.onActivity {activity->
                views(activity.window.decorView).filterIsInstance<android.widget.CheckBox>().single {it.text.toString()=="GENERATED_A_RESOURCE"}.isChecked=true
                oldImport=views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()=="导入所选资源"};oldImport.performClick()
            }
            waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready}
            val imported=a.get("/api/source-items?sourceId=same-source")
            assertTrue(imported.toString().contains("GENERATED_A_PRIVATE_MCP_CONTENT"));assertFalse(imported.toString().contains("GENERATED_B_PRIVATE_MCP_CONTENT"))
            scenario.onActivity {oldImport.performClick()};waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready}
            val sourceItems=a.get("/api/source-items?sourceId=same-source").getJSONArray("items");assertEquals(1,sourceItems.length())
            lateinit var toolImport:android.widget.Button
            scenario.onActivity {activity->
                assertTrue(views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString()=="导入完成：0 条新资料，1 条已存在。"})
                toolImport=views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()=="导入工具结果"};toolImport.performClick()
            }
            assertEquals("Unchecked native tool approval must not import anything",1,a.get("/api/source-items?sourceId=same-source").getJSONArray("items").length())
            scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.CheckBox>().single {it.text.toString()=="我确认此工具只读"}.isChecked=true;toolImport.performClick()}
            waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready}
            val withTool=a.get("/api/source-items?sourceId=same-source");assertEquals(2,withTool.getJSONArray("items").length());assertTrue(withTool.toString().contains("GENERATED_A_READ_ONLY_TOOL_CONTENT"))
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);login(app,"b");scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED)
            scenario.onActivity {activity->assertFalse(views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString().contains("GENERATED_A_RESOURCE")});oldImport.performClick()}
            waitFor {var ready=false;scenario.onActivity {ready=it.client!=null&&!it.isWorking};ready}
            assertEquals(0,CentralAccess.requireClient(app).get("/api/source-items?sourceId=same-source").getJSONArray("items").length())
        }
    }

    @Test fun nativeMcpPreparationExplicitlySavesOwnedConfigurationAndPreservesExistingMaskedSecrets() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val api=CentralAccess.requireClient(app)
        fun configured():org.json.JSONArray {val domains=api.get("/api/configuration").getJSONArray("domains");return (0 until domains.length()).map(domains::getJSONObject).single {it.getString("id")=="mcpConnections"}.getJSONObject("saved").getJSONArray("connections")}
        val before=configured();assertEquals(1,before.length());assertTrue(before.getJSONObject(0).getBoolean("token"))
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","settings")).use {scenario->
            waitFor {var ready=false;scenario.onActivity {ready=it.client!=null&&!it.isWorking};ready}
            scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()=="来源与外部应用"}.performClick()}
            waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready}
            lateinit var originalSave:android.widget.Button
            scenario.onActivity {activity->
                val inputs=views(activity.window.decorView).filterIsInstance<android.widget.EditText>()
                inputs.single {it.hint.toString()=="MCP 地址"}.setText(fixture().getString("mcpUrl"))
                inputs.single {it.hint.toString()=="来源名称"}.setText("Generated explicit native MCP source")
                inputs.single {it.hint.toString()=="访问令牌（可选）"}.setText("GENERATED_A_EXTRA")
                originalSave=views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()=="保存并应用"};originalSave.performClick()
            }
            waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready}
            val after=configured();assertEquals(2,after.length());val old=(0 until after.length()).map(after::getJSONObject).single {it.getString("id")=="same-connection"};assertTrue(old.getBoolean("token"))
            val created=(0 until after.length()).map(after::getJSONObject).single {it.getString("id")!="same-connection"};assertTrue(created.getBoolean("token"))
            val sourceId=created.getJSONArray("sourceIds").getString(0);assertEquals(sourceId,created.getString("id"))
            val sources=api.get("/api/sources").getJSONArray("items");assertTrue((0 until sources.length()).map(sources::getJSONObject).any {it.getString("id")==sourceId&&it.getString("name")=="Generated explicit native MCP source"})
            assertTrue(api.post("/api/connectors/mcp/discover",JSONObject().put("connectionId","same-connection")).getJSONArray("resources").getJSONObject(0).getString("name").contains("GENERATED_A"))
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);login(app,"b");scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED)
            scenario.onActivity {originalSave.performClick()}
            val bDomains=CentralAccess.requireClient(app).get("/api/configuration").getJSONArray("domains");assertEquals(1,(0 until bDomains.length()).map(bDomains::getJSONObject).single {it.getString("id")=="mcpConnections"}.getJSONObject("saved").getJSONArray("connections").length())
        }
    }

    @Test fun originalNativeProcessingSettingsUseTheScopedProcessingDomainAndKeepSpeakerChoices() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val api=CentralAccess.requireClient(app)
        fun processing():Pair<Long,JSONObject> {val view=api.get("/api/configuration");val domains=view.getJSONArray("domains");return view.getLong("revision") to (0 until domains.length()).map(domains::getJSONObject).single {it.getString("id")=="processing"}.getJSONObject("saved")}
        val before=processing()
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","settings")).use {scenario->
            waitFor {var ready=false;scenario.onActivity {ready=it.client!=null&&!it.isWorking};ready}
            scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()=="处理设置"}.performClick()}
            waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready}
            lateinit var oldSave:android.widget.Button
            scenario.onActivity {activity->
                val automatic=views(activity.window.decorView).filterIsInstance<android.widget.CheckBox>().singleOrNull {it.text.toString()=="自动处理"}
                assertNotNull("The original native processing form must consume the actual owned M04/M06 settings",automatic)
                automatic!!.isChecked=!before.second.getBoolean("automatic")
                oldSave=views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()=="保存设置"};oldSave.performClick()
            }
            waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready}
            val after=processing();assertTrue(after.first>before.first);assertEquals(!before.second.getBoolean("automatic"),after.second.getBoolean("automatic"))
            for(key in listOf("audioProcessor","diarizationProcessor","speakerCount","speakerMin","speakerMax","maxAudioMinutes","timeoutMs","enabled","summarize","semanticTurns","understandingEnabled"))assertEquals(key,before.second.get(key),after.second.get(key))
            login(app,"b");scenario.onActivity {it.navigate("settings")};waitFor {var ready=false;scenario.onActivity {ready=it.client!=null&&!it.isWorking};ready}
            val b=CentralAccess.requireClient(app);val bBefore=b.get("/api/configuration").toString();scenario.onActivity {oldSave.performClick()};assertEquals(bBefore,b.get("/api/configuration").toString())
        }
    }

    @Test fun originalNativeDeviceInventoryUsesCanonicalSameIdOwnedMetadata() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));MoteI18n.select(app,"zh-CN")
        for(owner in listOf("a","b")){login(app,owner);CentralAccess.requireClient(app).post("/api/ingress/devices",JSONObject().put("id","same-device").put("name","Generated native inventory "+owner).put("platform","android"))};login(app,"a")
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","devices")).use {scenario->
            waitFor {var ready=false;scenario.onActivity {ready=it.client!=null&&!it.isWorking};ready}
            scenario.onActivity {activity->val text=views(activity.window.decorView).filterIsInstance<android.widget.TextView>().map {it.text.toString()};assertTrue("The original devices entry must read the scoped canonical inventory",text.any {it.contains("Generated native inventory a")});assertFalse(text.any {it.contains("Generated native inventory b")})}
        }
    }

    @Test fun originalNativeStatisticsUsesCurrentOwnerCountsInsteadOfGlobalStorage() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val expected=CentralAccess.requireClient(app).get("/api/data/statistics")
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","statistics")).use {scenario->
            waitFor {var ready=false;scenario.onActivity {ready=it.client!=null&&!it.isWorking};ready}
            scenario.onActivity {activity->val text=views(activity.window.decorView).filterIsInstance<android.widget.TextView>().map {it.text.toString()};assertTrue("Native account statistics must not call the retired global storage endpoint",text.contains("原始采集记录 · "+expected.getLong("captures")));assertTrue(text.contains("来源与连接 · "+expected.getLong("sources")))}
        }
    }

    @Test fun originalNativeLarkUsesSavedOwnedConnectionAndExplicitDocumentArchive() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val a=CentralAccess.requireClient(app);val b=CentralClient(endpoint(),token("b"));val beforeB=b.get("/api/source-items").toString()
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","lark")).use {scenario->
            fun ready(){waitFor {var value=false;scenario.onActivity {value=it.client!=null&&!it.isWorking};value}}
            fun button(label:String):android.widget.Button? {var value:android.widget.Button?=null;scenario.onActivity {activity->value=views(activity.window.decorView).filterIsInstance<android.widget.Button>().singleOrNull {it.text.toString()==label}};return value}
            fun press(label:String){val target=button(label);assertNotNull("Missing original Lark control: "+label,target);scenario.onActivity {target!!.performClick()}}
            ready();scenario.onActivity {activity->
                val choice=views(activity.window.decorView).filterIsInstance<android.widget.Spinner>().singleOrNull {spinner->(0 until spinner.count).any {spinner.getItemAtPosition(it).toString()=="same-lark"}}
                assertNotNull("The original Lark entry must select a saved owned connection instead of the retired global vendor route",choice)
                choice!!.setSelection((0 until choice.count).single {choice.getItemAtPosition(it).toString()=="same-lark"})
            };ready();press("检查状态");ready();press("扫码登录并授权只读权限");ready()
            waitFor {button("打开授权页面")!=null};control("/generated/release-lark-login")
            waitFor {val tasks=a.get("/api/tasks").getJSONArray("items");(0 until tasks.length()).map(tasks::getJSONObject).any {it.optString("state")=="succeeded"&&it.optJSONObject("result")?.optBoolean("connected")==true}};press("选择文档与活动范围");ready()
            scenario.onActivity {activity->
                for(choice in views(activity.window.decorView).filterIsInstance<android.widget.CheckBox>())if(choice.text.toString() in listOf("我创建的","我编辑过的","我打开过的","在后台定期同步选中内容"))choice.isChecked=false
                views(activity.window.decorView).filterIsInstance<android.widget.EditText>().single {it.hint.toString()=="指定文档（每行一个）"}.setText("DocumentFixture123")
            };press("保存同步范围");ready();press("预览文档范围");ready();waitFor {button("确认并开始归档")!=null};press("确认并开始归档");ready()
            var original:JSONObject?=null
            waitFor {val sources=a.get("/api/sources").getJSONArray("items");val source=(0 until sources.length()).map(sources::getJSONObject).singleOrNull {it.optString("kind")=="lark-docs"};if(source==null)false else {val rows=a.get("/api/ingress/sources/"+source.getString("id")+"/originals").getJSONArray("items");if(rows.length()==0)false else {original=rows.getJSONObject(0);true}}}
            assertNotNull(original);assertEquals(beforeB,b.get("/api/source-items").toString())
            press("资料说明（选填）");ready();scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.EditText>().single {it.hint.toString()=="可说明格式、时间、作者，以及哪些内容属于你。"}.setText("Generated native Lark source context")};press("保存说明");ready()
            val sourceRows=a.get("/api/sources").getJSONArray("items");val source=(0 until sourceRows.length()).map(sourceRows::getJSONObject).single {it.optString("kind")=="lark-docs"}
            assertEquals("Generated native Lark source context",a.get("/api/sources/"+source.getString("id")+"/context").getString("description"))
            press("选择日历");ready();waitFor {var visible=false;scenario.onActivity {activity->visible=views(activity.window.decorView).filterIsInstance<android.widget.CheckBox>().any {it.text.toString().startsWith("GENERATED_CALENDAR_")}};visible}
            scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.CheckBox>().single {it.text.toString().startsWith("GENERATED_CALENDAR_")}.isChecked=true};press("保存设置");ready()
            waitFor {a.get("/api/connectors/same-lark").getJSONObject("selection").getJSONArray("calendarIds").let {it.length()==1&&it.getString(0)=="same-calendar"}}
            control("/generated/fail-document");press("立即同步");ready();waitFor {button("重试此文档")!=null}
            scenario.onActivity {activity->assertFalse(views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString().contains("GENERATED_PROVIDER_PRIVATE_FAILURE")})}
            control("/generated/retry-document");press("重试此文档");ready();waitFor {button("重试此文档")==null&&button("立即同步")!=null}
            assertEquals(1,a.get("/api/ingress/sources/"+source.getString("id")+"/originals").getJSONArray("items").length())
            press("暂停接入");ready();assertFalse(a.get("/api/sources/"+source.getString("id")).getBoolean("enabled"));assertNull(button("立即同步"));press("恢复接入");ready();assertTrue(a.get("/api/sources/"+source.getString("id")).getBoolean("enabled"))
            control("/generated/hold-document");press("立即同步");ready();waitFor {control("/generated/document-state").getBoolean("documentEntered")&&button("取消当前操作")!=null};press("取消当前操作");control("/generated/release-document");ready();waitFor {button("取消当前操作")==null}
            assertEquals(1,a.get("/api/ingress/sources/"+source.getString("id")+"/originals").getJSONArray("items").length())
            val oldSync=button("立即同步");assertNotNull(oldSync)
            val beforeDisconnect=a.get("/api/tasks").getJSONArray("items").let {rows->(0 until rows.length()).map {rows.getJSONObject(it).getString("id")}.toSet()}
            control("/generated/drop-disconnect-ack")
            press("断开连接");scenario.onActivity {
                @Suppress("UNCHECKED_CAST") val dialogs=MoteDialogBuilder::class.java.getDeclaredField("dialogs").apply {isAccessible=true}.get(null) as List<java.lang.ref.WeakReference<android.app.AlertDialog>>
                dialogs.mapNotNull {it.get()}.single {it.isShowing}.getButton(android.app.AlertDialog.BUTTON_POSITIVE).performClick()
            };ready()
            waitFor {a.get("/api/tasks").getJSONArray("items").let {rows->(0 until rows.length()).map(rows::getJSONObject).any {it.getString("id") !in beforeDisconnect&&it.optString("state")=="succeeded"&&it.optJSONObject("result")?.optBoolean("connected",true)==false}}}
            assertNotNull("The original disconnect intent remains retryable after its real acknowledgement is lost",button("重试"));control("/generated/release-disconnect-ack");press("重试");ready()
            val disconnects=control("/generated/document-state").getJSONArray("disconnectCommands");assertTrue(disconnects.length()>=2);assertEquals(1,(0 until disconnects.length()).map {disconnects.getJSONObject(it).getString("operationId")}.toSet().size);assertEquals(1,(0 until disconnects.length()).map {disconnects.getJSONObject(it).getString("taskId")}.toSet().size)
            val taskCount=a.get("/api/tasks").getJSONArray("items").length();press("检查状态");ready()
            assertEquals("An acknowledged disconnect must retire its old generation and leave the original connection controls usable",taskCount+1,a.get("/api/tasks").getJSONArray("items").length())
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);login(app,"b");scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED);scenario.onActivity {oldSync!!.performClick()};ready();assertEquals(beforeB,b.get("/api/source-items").toString())
        }
    }

    @Test fun originalNativeRecordingConnectionRetainsScopeVendorTextAndFailedAudioRetryUnderItsOwner() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val a=CentralAccess.requireClient(app);val b=CentralClient(endpoint(),token("b"));val beforeB=b.get("/api/connectors/same-recordings/recordings?limit=1").toString()
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","settings")).use {scenario->
            fun ready(){waitFor {var value=false;scenario.onActivity {value=it.client!=null&&!it.isWorking};value}}
            fun press(label:String){scenario.onActivity {activity->val button=views(activity.window.decorView).filterIsInstance<android.widget.Button>().singleOrNull {it.text.toString()==label};assertNotNull("Missing original recording control: "+label,button);button!!.performClick()}}
            fun recordings(){ready();press("来源与外部应用");ready();press("录音归档");ready()}
            recordings();press("连接已授权账号");ready();waitFor {a.get("/api/connectors/same-recordings").getBoolean("connected")};press("同步范围");ready()
            scenario.onActivity {activity->
                views(activity.window.decorView).filterIsInstance<android.widget.CheckBox>().single {it.text.toString()=="启用"}.isChecked=true
                views(activity.window.decorView).filterIsInstance<android.widget.CheckBox>().single {it.text.toString()=="自动同步"}.isChecked=false
                views(activity.window.decorView).filterIsInstance<android.widget.EditText>().single {it.hint.toString()=="开始时间"}.setText("2026-10-16T00:00:00.000Z")
                views(activity.window.decorView).filterIsInstance<android.widget.EditText>().single {it.hint.toString()=="结束时间"}.setText("2026-10-17T00:00:00.000Z")
            };press("保存设置");ready();waitFor {a.get("/api/connectors/same-recordings").getJSONObject("selection").getBoolean("enabled")};press("立即同步");ready()
            var record:JSONObject?=null;waitFor {val rows=a.get("/api/connectors/same-recordings/recordings?limit=1").getJSONArray("items");if(rows.length()==0)false else {record=rows.getJSONObject(0);record!!.getJSONObject("transcript").getBoolean("archived")&&record!!.getJSONObject("audio").getBoolean("blocked")}}
            val transcript=record!!.getString("transcriptCaptureId");waitFor {a.get("/api/files/"+transcript+"/chunks").getJSONArray("items").length()>0}
            val chunks=a.get("/api/files/"+transcript+"/chunks").getJSONArray("items");assertTrue(chunks.getJSONObject(0).getString("ocrText").contains("GENERATED_VENDOR_TEXT_"+fixture().getJSONObject("a").getString("userId")));assertFalse(chunks.toString().contains(fixture().getJSONObject("b").getString("userId")))
            press("同步步骤与状态");ready();scenario.onActivity {activity->assertTrue(views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString().contains("recording_media_failed")})}
            scenario.onActivity {it.navigate("settings")};recordings()
            control("/generated/recover-recording-audio");press("重试失败步骤");ready();waitFor {a.get("/api/connectors/same-recordings/recordings?limit=1").getJSONArray("items").getJSONObject(0).getJSONObject("audio").getBoolean("archived")}
            assertEquals(transcript,a.get("/api/connectors/same-recordings/recordings?limit=1").getJSONArray("items").getJSONObject(0).getString("transcriptCaptureId"))
            press("最近归档的录音");ready();press("播放录音");ready()
            waitFor {var prepared=false;scenario.onActivity {activity->prepared=views(activity.window.decorView).filterIsInstance<android.widget.SeekBar>().any {it.isEnabled&&it.max==1000}};prepared}
            press("播放或暂停");press("播放或暂停")
            scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.SeekBar>().single {it.isEnabled&&it.max==1000}.progress=400}
            scenario.onActivity {it.navigate("settings")};recordings()
            lateinit var oldRetry:android.widget.Button;scenario.onActivity {activity->oldRetry=views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()=="重试失败步骤"};assertTrue(oldRetry.isEnabled)}
            val commands=control("/generated/recording-commands").getJSONArray("commands").length()
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);login(app,"b");scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED);scenario.onActivity {oldRetry.performClick()};ready();assertEquals(beforeB,b.get("/api/connectors/same-recordings/recordings?limit=1").toString())
            assertEquals(commands,control("/generated/recording-commands").getJSONArray("commands").length())
        }
    }

    @Test fun originalNativeGenericImportRetainsMultipartPrivatePreviewAndLostAckUntilExplicitOwnerConfirmation() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val a=CentralAccess.requireClient(app);val b=CentralClient(endpoint(),token("b"));val content="GENERATED_NATIVE_IMPORT_LINE_\n".repeat(150000);val bytes=content.toByteArray();assertTrue(bytes.size>4*1024*1024)
        val file=File(app.cacheDir,"generated-native-import.txt").apply {writeBytes(bytes)}
        val instrumentation=InstrumentationRegistry.getInstrumentation();val monitor=instrumentation.addMonitor(android.content.IntentFilter(android.content.Intent.ACTION_OPEN_DOCUMENT).apply {addCategory(android.content.Intent.CATEGORY_OPENABLE);addDataType("*/*")},android.app.Instrumentation.ActivityResult(android.app.Activity.RESULT_OK,android.content.Intent().setData(android.net.Uri.fromFile(file))),true)
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        try {androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","imports")).use {scenario->
            fun ready(){waitFor {var value=false;scenario.onActivity {value=it.client!=null&&!it.isWorking};value}}
            fun button(label:String):android.widget.Button? {var value:android.widget.Button?=null;scenario.onActivity {activity->value=views(activity.window.decorView).filterIsInstance<android.widget.Button>().singleOrNull {it.text.toString()==label}};return value}
            fun press(label:String){val target=button(label);assertNotNull("Missing original import control: "+label,target);scenario.onActivity {target!!.performClick()}}
            ready();control("/generated/drop-import-ack");press("选择文件导入");ready();assertEquals(1,monitor.hits)
            val admissions=control("/generated/import-commands").getJSONArray("commands");val first=(0 until admissions.length()).map(admissions::getJSONObject).first {it.getString("path")=="/api/imports"};val id=first.getString("requestId");val fileId=first.getString("fileId")
            waitFor {a.get("/api/imports/"+id).getString("status")=="awaiting_confirmation"};assertEquals(0,a.get("/api/captures").getJSONArray("items").length());assertEquals(0,a.get("/api/imports/"+id).getJSONObject("progress").getInt("imported"))
            val bJob=b.post("/api/imports",JSONObject().put("requestId",id).put("processing","automatic").put("files",org.json.JSONArray().put(JSONObject().put("name","generated-b.txt").put("mimeType","text/plain").put("dataBase64",android.util.Base64.encodeToString("GENERATED_B_INDEPENDENT_IMPORT".toByteArray(),android.util.Base64.NO_WRAP)))))
            assertEquals(id,bJob.getString("id"));waitFor {b.get("/api/imports/"+id).getString("status")=="completed"};val beforeB=b.get("/api/imports/"+id).toString()
            scenario.recreate();ready();val oldRetry=button("重试同一请求");assertNotNull("Lost ACK must retain the original encrypted upload/admission intent across recreation",oldRetry)
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);login(app,"b");scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED);ready();scenario.onActivity {oldRetry!!.performClick()};ready();assertNull(button("重试同一请求"));assertEquals(beforeB,b.get("/api/imports/"+id).toString())
            control("/generated/release-import-ack");scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);login(app,"a");scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED);ready();press("重试同一请求");ready()
            val after=control("/generated/import-commands").getJSONArray("commands");val repeated=(0 until after.length()).map(after::getJSONObject).filter {it.getString("actor")=="a"&&it.getString("path")=="/api/imports"};assertTrue(repeated.size>=2);assertEquals(setOf(id),repeated.map {it.getString("requestId")}.toSet());assertEquals(setOf(fileId),repeated.map {it.getString("fileId")}.toSet())
            assertEquals(2,(0 until after.length()).map(after::getJSONObject).count {it.getString("actor")=="a"&&it.getString("path").contains("/parts/")})
            press("确认导入");scenario.onActivity {
                @Suppress("UNCHECKED_CAST") val all=MoteDialogBuilder::class.java.getDeclaredField("dialogs").apply {isAccessible=true}.get(null) as List<java.lang.ref.WeakReference<android.app.AlertDialog>>
                all.mapNotNull {it.get()}.single {it.isShowing}.getButton(android.app.AlertDialog.BUTTON_POSITIVE).performClick()
            };ready();waitFor {CentralAccess.requireClient(app).get("/api/imports/"+id).getString("status")=="completed"}
            val complete=CentralAccess.requireClient(app).get("/api/imports/"+id);assertTrue(complete.getJSONObject("progress").getInt("imported")>0);assertTrue(complete.getJSONArray("captureIds").length()>0)
            val archived=CentralAccess.requireClient(app).get("/api/archived-files/"+fileId);assertEquals(bytes.size.toLong(),archived.getLong("sizeBytes"));assertEquals(Ingress3Client.hash(bytes),archived.getString("hash"));assertEquals(beforeB,b.get("/api/imports/"+id).toString())
            assertEquals(1,CentralAccess.requireClient(app).get("/api/imports").getJSONArray("items").length())
        }} finally {instrumentation.removeMonitor(monitor);file.delete()}
    }

    @Test fun originalQrPairingRecoversItsOwnPkceClaimAndAckWithoutOpeningBrowserOrReassigningQueuedBytes() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));MoteI18n.select(app,"zh-CN")
        val note=QuickNotes.save(app,"GENERATED_LOCAL_BEFORE_EXPLICIT_QR_PAIRING","",scheduleUpload={})
        val issuer=CentralClient(endpoint(),token("a"));val issued=issuer.post("/api/connections/invitations",JSONObject().put("serverUrl",endpoint()).put("label","Generated Android QR"))
        val invitation=issued.getJSONObject("invitation");assertEquals(2,invitation.getInt("version"));assertEquals("device",invitation.getString("purpose"))
        val instrumentation=InstrumentationRegistry.getInstrumentation()
        val browser=instrumentation.addMonitor(android.content.IntentFilter(android.content.Intent.ACTION_VIEW).apply {addDataScheme("http")},android.app.Instrumentation.ActivityResult(android.app.Activity.RESULT_CANCELED,null),true)
        fun views(root:android.view.View):List<android.view.View> = listOf(root)+if(root is android.view.ViewGroup)(0 until root.childCount).flatMap {views(root.getChildAt(it))} else emptyList()
        try {androidx.test.core.app.ActivityScenario.launch<ConnectionActivity>(android.content.Intent(app,ConnectionActivity::class.java).setData(android.net.Uri.parse(issued.getString("uri")))).use {scenario->
            fun ready(){waitFor {var value=false;scenario.onActivity {activity->value=views(activity.window.decorView).filterIsInstance<android.widget.Button>().any {it.text.toString()=="确认连接此节点"}&&!(ConnectionActivity::class.java.getDeclaredField("working").apply {isAccessible=true}.get(activity) as Boolean)};value}}
            fun press(label:String){scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()==label}.performClick()}}
            fun confirm(){scenario.onActivity {
                @Suppress("UNCHECKED_CAST") val dialogs=MoteDialogBuilder::class.java.getDeclaredField("dialogs").apply {isAccessible=true}.get(null) as List<java.lang.ref.WeakReference<android.app.AlertDialog>>
                dialogs.mapNotNull {it.get()}.single {it.isShowing}.getButton(android.app.AlertDialog.BUTTON_POSITIVE).performClick()
            };ready()}
            ready();control("/generated/drop-redeem");press("确认连接此节点")
            scenario.onActivity {
                @Suppress("UNCHECKED_CAST") val dialogs=MoteDialogBuilder::class.java.getDeclaredField("dialogs").apply {isAccessible=true}.get(null) as List<java.lang.ref.WeakReference<android.app.AlertDialog>>
                assertEquals("The original native confirmation must accept the actual v2 producer",1,dialogs.mapNotNull {it.get()}.count {it.isShowing})
            }
            confirm();assertNull(settings.read().account());assertEquals(1,app.queue().pendingSync().count)
            assertEquals("The PKCE intent must survive even when the first real redeem reply is lost",endpoint(),ConnectionClient(app).pendingServer())
            val first=control("/generated/pairing-state").getJSONArray("claims");assertEquals(1,first.length());val claim=first.getJSONObject(0)
            scenario.recreate();ready();control("/generated/drop-ack");press("恢复中断的连接确认");ready();confirm()
            val paired=settings.read();assertEquals(invitation.getString("userId"),paired.account()!!.userId);assertEquals(invitation.getString("deploymentId"),paired.account()!!.deploymentId);assertTrue(paired.deviceBoundCredential);assertFalse(settings.enabled)
            assertEquals(endpoint(),ConnectionClient(app).pendingServer());assertEquals(403,HttpJson.get(endpoint()+"/api/captures",paired.connectionToken()).first)
            val recovery=control("/generated/release-pairing");scenario.recreate();ready();press("恢复中断的连接确认");ready();confirm()
            if(recovery.optBoolean("revokedAfterRestart")) {
                assertEquals(endpoint(),ConnectionClient(app).pendingServer());assertEquals(401,HttpJson.get(endpoint()+"/api/connections/self",paired.token).first)
                assertEquals(1,app.queue().pendingSync().count);assertEquals(404,get(app,"a","/api/captures/"+note).first);assertEquals(404,get(app,"b","/api/captures/"+note).first);assertEquals(0,browser.hits)
                return@use
            }
            assertNull(ConnectionClient(app).pendingServer())
            assertEquals(paired.token,settings.read().token);val trace=control("/generated/pairing-state");val claims=trace.getJSONArray("claims");assertTrue(claims.length()>=2)
            for(index in 0 until claims.length()){val row=claims.getJSONObject(index);assertEquals(claim.getString("id"),row.getString("id"));assertEquals(claim.getString("challenge"),row.getString("challenge"));assertEquals(settings.deviceId,row.getString("deviceId"))}
            if(trace.optBoolean("restarted")) {
                assertEquals(listOf(200,410),(0 until trace.getJSONArray("ackStatuses").length()).map {trace.getJSONArray("ackStatuses").getInt(it)})
                assertFalse(app.getSharedPreferences("connection",Context.MODE_PRIVATE).getBoolean("pairingAcknowledged",true))
                assertEquals(200,HttpJson.get(endpoint()+"/api/connections/self",settings.read().connectionToken()).first)
            } else {assertEquals(2,trace.getJSONArray("acks").length());assertTrue(app.getSharedPreferences("connection",Context.MODE_PRIVATE).getBoolean("pairingAcknowledged",false))}
            assertEquals(0,browser.hits)
            UploadWorker.schedule(app,settings.read(),true);waitFor {app.queue().pendingSync().count==0};assertEquals(200,get(app,"a","/api/captures/"+note).first);assertEquals(404,get(app,"b","/api/captures/"+note).first)
        }} finally {instrumentation.removeMonitor(browser)}
    }
    @Test fun actualQrPairingRejectsChangedSelfBeforeLocalWriteAndReauthorizesOnlyItsOriginalDevice() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false))
        QuickNotes.draft(app).update("GENERATED_UNBOUND_QR_DRAFT","")
        val issuer=CentralClient(endpoint(),token("a"))
        var latest:ConnectionInvitation?=null
        for(field in listOf("owner","deployment","credential","device","kind")) {
            control("/generated/release-pairing")
            val value=issuer.post("/api/connections/invitations",JSONObject().put("serverUrl",endpoint()).put("label","Generated bound device").put("deviceId",settings.deviceId))
            val invitation=ConnectionInvitation.parse(value.getString("uri"),true,true);latest=invitation
            control("/generated/bad-self/"+field)
            assertThrows(ConnectionFailure::class.java){RuntimeSettings.replaceAccount(app,bindLocal=true){ConnectionClient(app).connect(invitation,"Generated Android",true,bindLocal=true)}}
            assertNull("Changed self "+field+" must fail before writing an account",settings.read().account());assertEquals("",settings.read().token)
            assertEquals("GENERATED_UNBOUND_QR_DRAFT",QuickNotes.draft(app).read().text)
        }
        control("/generated/release-pairing");RuntimeSettings.replaceAccount(app,bindLocal=true){ConnectionClient(app).resume("Ignored changed recovery name",true,bindLocal=true)}
        val original=settings.read();assertEquals(latest!!.userId,original.account()!!.userId);assertEquals("Generated Android",original.deviceName);assertTrue(original.authExpiresAt>System.currentTimeMillis());assertFalse(settings.enabled)
        assertEquals("GENERATED_UNBOUND_QR_DRAFT",QuickNotes.draft(app).read().text)
        val note=QuickNotes.save(app,"GENERATED_SAME_OWNER_REAUTHORIZE","",scheduleUpload={});QuickNotes.draft(app).update("GENERATED_A_UNSAVED_REAUTHORIZE_DRAFT","");val owner=original.ownerKey();val directory=app.accountDirectory().canonicalPath
        val replacement=issuer.post("/api/connections/invitations",JSONObject().put("serverUrl",endpoint()).put("label","Generated explicit reauthorization").put("deviceId",settings.deviceId))
        RuntimeSettings.replaceAccount(app){ConnectionClient(app).connect(ConnectionInvitation.parse(replacement.getString("uri"),true,true),"Generated renamed Android",true)}
        assertEquals(owner,settings.read().ownerKey());assertEquals(directory,app.accountDirectory().canonicalPath);assertNotEquals(original.token,settings.read().token)
        assertEquals(401,HttpJson.get(endpoint()+"/api/connections/self",original.token).first);assertEquals(note,app.queue().peek()!!.getString("id"));assertEquals("GENERATED_A_UNSAVED_REAUTHORIZE_DRAFT",QuickNotes.draft(app).read().text)
        UploadWorker.schedule(app,settings.read(),true);waitFor {app.queue().pendingSync().count==0};assertEquals(200,get(app,"a","/api/captures/"+note).first);assertEquals(404,get(app,"b","/api/captures/"+note).first)
    }
    @Test fun originalNativeDevicesGeneratesALocallyDecodableAccountBoundQrAndRetiresOldIssuerActions() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val api=CentralAccess.requireClient(app);api.post("/api/ingress/devices",JSONObject().put("id",settings.deviceId).put("name","Generated original Android").put("platform","android"))
        fun views(root:android.view.View):List<android.view.View> = listOf(root)+if(root is android.view.ViewGroup)(0 until root.childCount).flatMap {views(root.getChildAt(it))} else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","devices")).use {scenario->
            fun ready(){waitFor {var value=false;scenario.onActivity {value=it.client!=null&&!it.isWorking};value}}
            fun button(label:String):android.widget.Button {var value:android.widget.Button?=null;scenario.onActivity {activity->value=views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()==label}};return value!!}
            ready();scenario.onActivity {button("为此设备重新生成邀请").performClick()};val oldSave=button("保存设置");scenario.onActivity {oldSave.performClick()};ready()
            lateinit var bitmap:android.graphics.Bitmap
            scenario.onActivity {activity->val image=views(activity.window.decorView).filterIsInstance<android.widget.ImageView>().single {it.contentDescription?.toString()=="设备连接邀请二维码"};bitmap=(image.drawable as android.graphics.drawable.BitmapDrawable).bitmap}
            val pixels=IntArray(bitmap.width*bitmap.height);bitmap.getPixels(pixels,0,bitmap.width,0,0,bitmap.width,bitmap.height)
            val decoded=com.google.zxing.qrcode.QRCodeReader().decode(com.google.zxing.BinaryBitmap(com.google.zxing.common.HybridBinarizer(com.google.zxing.RGBLuminanceSource(bitmap.width,bitmap.height,pixels)))).text
            val invitation=ConnectionInvitation.parse(decoded,true,true);assertEquals(settings.read().account()!!.userId,invitation.userId);assertEquals(settings.deviceId,invitation.deviceId);assertEquals(endpoint(),invitation.serverUrl)
            val count=control("/generated/pairing-state").getJSONArray("invitations").length()
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);login(app,"b");scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED);ready();scenario.onActivity {oldSave.performClick()};ready()
            assertEquals(count,control("/generated/pairing-state").getJSONArray("invitations").length())
            scenario.onActivity {activity->assertFalse(views(activity.window.decorView).filterIsInstance<android.widget.ImageView>().any {it.contentDescription?.toString()=="设备连接邀请二维码"})}
        }
    }
    @Test fun originalInvitationFilePickerDiscardsAHeldAReadAfterBSwitchAndStillAcceptsANewBSelection() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        fun invitation(actor:String)=CentralClient(endpoint(),token(actor)).post("/api/connections/invitations",JSONObject().put("serverUrl",endpoint()).put("label","Generated JSON selection")).getJSONObject("invitation")
        val a=invitation("a");val b=invitation("b");val selected=java.util.concurrent.atomic.AtomicReference<android.net.Uri>()
        val file=File(app.cacheDir,"generated-pairing-selection.json").apply {writeText(a.toString())};selected.set(android.net.Uri.fromFile(file))
        val fifo=File(app.cacheDir,"generated-pairing-held.pipe").apply {delete()};android.system.Os.mkfifo(fifo.path,384)
        val entered=java.util.concurrent.CountDownLatch(1);val release=java.util.concurrent.CountDownLatch(1)
        val writer=Thread {java.io.FileOutputStream(fifo).use {out->entered.countDown();check(release.await(30,TimeUnit.SECONDS));out.write(a.toString().toByteArray())}}.apply {isDaemon=true}
        val instrumentation=InstrumentationRegistry.getInstrumentation();val monitor=object:android.app.Instrumentation.ActivityMonitor(){override fun onStartActivity(intent:android.content.Intent):android.app.Instrumentation.ActivityResult? = if(intent.action==android.content.Intent.ACTION_OPEN_DOCUMENT)android.app.Instrumentation.ActivityResult(android.app.Activity.RESULT_OK,android.content.Intent().setData(selected.get()))else null};instrumentation.addMonitor(monitor)
        fun views(root:android.view.View):List<android.view.View> = listOf(root)+if(root is android.view.ViewGroup)(0 until root.childCount).flatMap {views(root.getChildAt(it))} else emptyList()
        try {androidx.test.core.app.ActivityScenario.launch<ConnectionActivity>(android.content.Intent(app,ConnectionActivity::class.java)).use {scenario->
            fun ready(){waitFor {var value=false;scenario.onActivity {activity->value=views(activity.window.decorView).filterIsInstance<android.widget.Button>().any {it.text.toString()=="选择连接 JSON 文件"}&&!(ConnectionActivity::class.java.getDeclaredField("working").apply {isAccessible=true}.get(activity) as Boolean)};value}}
            fun choose(){scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()=="选择连接 JSON 文件"}.performClick()}}
            fun input():String{var value="";scenario.onActivity {activity->value=(ConnectionActivity::class.java.getDeclaredField("input").apply {isAccessible=true}.get(activity) as android.widget.EditText).text.toString()};return value}
            ready();choose();ready();assertTrue(input().contains(a.getString("code")))
            scenario.onActivity {activity->(ConnectionActivity::class.java.getDeclaredField("input").apply {isAccessible=true}.get(activity) as android.widget.EditText).text.clear()}
            selected.set(android.net.Uri.fromFile(fifo));writer.start();choose();assertTrue(entered.await(10,TimeUnit.SECONDS))
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);login(app,"b");scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED)
            // Hold the periodic refresh to expose the real reader-completion window;
            // it must not be the authority fence for an already admitted A file.
            scenario.onActivity {activity->val handler=ConnectionActivity::class.java.getDeclaredField("handler").apply {isAccessible=true}.get(activity) as android.os.Handler;val refresh=ConnectionActivity::class.java.getDeclaredField("refresh").apply {isAccessible=true}.get(activity) as Runnable;handler.removeCallbacks(refresh)}
            release.countDown();writer.join(10000);ready();assertFalse("A's held JSON result must not populate B's invitation input",input().contains(a.getString("code")))
            scenario.recreate();ready();file.writeText(b.toString());selected.set(android.net.Uri.fromFile(file));choose();ready();assertTrue(input().contains(b.getString("code")));assertEquals(fixture().getJSONObject("b").getString("userId"),settings.read().account()!!.userId)
            assertEquals(0,control("/generated/pairing-state").getJSONArray("claims").length())
        }} finally {release.countDown();writer.join(10000);instrumentation.removeMonitor(monitor);file.delete();fifo.delete()}
    }
    @Test fun originalNativeInstanceSettingsExplainOperatorOwnershipWithoutCallingRetiredGlobalWrites() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val notice="实例级执行与诊断设置由部署操作者管理；客户端仍可修改本账号的模型和处理设置。"
        fun views(root:android.view.View):List<android.view.View> = listOf(root)+if(root is android.view.ViewGroup)(0 until root.childCount).flatMap {views(root.getChildAt(it))} else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","settings")).use {scenario->
            fun ready(){waitFor {var value=false;scenario.onActivity {value=it.client!=null&&!it.isWorking};value}}
            fun press(label:String){scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()==label}.performClick()};ready()}
            fun explained(){scenario.onActivity {activity->assertTrue("The original setting entry must explain its actual M04 operator contract",views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString()==notice})}}
            ready();press("并发与执行设置");explained();assertEquals(0,control("/generated/pairing-state").getJSONArray("retiredConfigurationRequests").length())
            // The original per-account editor remains available under the same user.
            scenario.onActivity {it.navigate("settings")};ready();press("处理设置");scenario.onActivity {activity->assertTrue(views(activity.window.decorView).filterIsInstance<android.widget.Button>().any {it.text.toString()=="保存设置"})}
            login(app,"admin");scenario.onActivity {it.navigate("developer")};ready();assertEquals(200,HttpJson.get(endpoint()+"/api/diagnostics",token("admin")).first)
            press("诊断设置");explained();assertEquals(0,control("/generated/pairing-state").getJSONArray("retiredConfigurationRequests").length())
        }
    }
    @Test fun originalInvitationReviewRetiresAnAlreadyVisibleCapabilityBeforeAChangedAccountResumes() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val invite=CentralAccess.requireClient(app).post("/api/connections/invitations",JSONObject().put("serverUrl",endpoint()).put("label","Generated visible invitation"))
        val code=invite.getJSONObject("invitation").getString("code")
        val entered=java.util.concurrent.CountDownLatch(1);val release=java.util.concurrent.CountDownLatch(1)
        fun views(root:android.view.View):List<android.view.View> = listOf(root)+if(root is android.view.ViewGroup)(0 until root.childCount).flatMap {views(root.getChildAt(it))} else emptyList()
        try {androidx.test.core.app.ActivityScenario.launch<ConnectionActivity>(android.content.Intent(app,ConnectionActivity::class.java).setData(android.net.Uri.parse(invite.getString("uri")))).use {scenario->
            waitFor {var ready=false;scenario.onActivity {activity->ready=views(activity.window.decorView).filterIsInstance<android.widget.Button>().any {it.text.toString()=="确认连接此节点"}};ready}
            lateinit var dialog:android.app.AlertDialog
            scenario.onActivity {activity->
                val raw=(ConnectionActivity::class.java.getDeclaredField("input").apply {isAccessible=true}.get(activity) as android.widget.EditText).text.toString()
                assertEquals(code,ConnectionInvitation.parse(raw,true,BuildConfig.DEBUG).code)
                views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()=="确认连接此节点"}.performClick()
                @Suppress("UNCHECKED_CAST") val dialogs=MoteDialogBuilder::class.java.getDeclaredField("dialogs").apply {isAccessible=true}.get(null) as List<java.lang.ref.WeakReference<android.app.AlertDialog>>
                dialog=dialogs.mapNotNull {it.get()}.single {it.isShowing}
                val executor=ConnectionActivity::class.java.getDeclaredField("executor").apply {isAccessible=true}.get(activity) as java.util.concurrent.ExecutorService
                executor.execute {entered.countDown();check(release.await(20,TimeUnit.SECONDS))}
            }
            assertTrue(entered.await(10,TimeUnit.SECONDS));scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);login(app,"b");scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED)
            scenario.onActivity {activity->
                assertFalse("Old invitation dialog must retire synchronously with its page owner",dialog.isShowing)
                assertFalse("The already visible A capability cannot await an asynchronous B resolver",(ConnectionActivity::class.java.getDeclaredField("input").apply {isAccessible=true}.get(activity) as android.widget.EditText).text.toString().contains(code))
            }
            release.countDown();scenario.recreate();waitFor {var ready=false;scenario.onActivity {activity->ready=views(activity.window.decorView).filterIsInstance<android.widget.Button>().any {it.text.toString()=="确认连接此节点"}};ready}
            scenario.onActivity {activity->assertFalse("Retired incoming intent must not repopulate A's capability after recreation",(ConnectionActivity::class.java.getDeclaredField("input").apply {isAccessible=true}.get(activity) as android.widget.EditText).text.toString().contains(code))}
            assertEquals(0,control("/generated/pairing-state").getJSONArray("claims").length())
        }} finally {release.countDown()}
    }
    @Test fun originalNativeAgentCatalogExpandsTheActualCanonicalMaterialUnderItsOwner() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val a=CentralAccess.requireClient(app);val b=CentralClient(endpoint(),token("b"));val row=a.get("/api/agent-view/catalog?path=/context/episodes&limit=1").getJSONArray("entries").getJSONObject(0)
        assertEquals("material_read",row.getString("expand"));assertTrue(a.get("/api/agent-view/material-read?ref="+CentralScreens.encode(row.getString("ref"))).getString("text").contains("GENERATED_AGENT_A_VISIBLE_TEXT"))
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","agentView")).use {scenario->
            fun ready(){waitFor {var value=false;scenario.onActivity {value=it.client!=null&&!it.isWorking};value}}
            ready();scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()=="/context/episodes"}.performClick()};ready()
            lateinit var expand:android.widget.Button;scenario.onActivity {activity->expand=views(activity.window.decorView).filterIsInstance<android.widget.Button>().first {it.text.toString()=="展开"};expand.performClick()};ready()
            scenario.onActivity {activity->val text=views(activity.window.decorView).filterIsInstance<android.widget.TextView>().map {it.text.toString()};assertTrue("Original Agent catalog must follow its declared material_read instead of the retired evidence alias",text.any {it.contains("GENERATED_AGENT_A_VISIBLE_TEXT")});assertFalse(text.any {it.contains("GENERATED_AGENT_B_VISIBLE_TEXT")})}
            assertThrows(CentralFailure::class.java) {b.get("/api/agent-view/material-read?ref="+CentralScreens.encode(row.getString("ref")))}
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);login(app,"b");scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED);scenario.onActivity {expand.performClick()};ready()
            scenario.onActivity {activity->assertFalse(views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString().contains("GENERATED_AGENT_A_VISIBLE_TEXT")})}
        }
    }

    @Test fun originalNativeBrowserLoginReturnsACentralSessionWhileDevicePairingRemainsScoped() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        for(actor in listOf("a","b"))CentralClient(endpoint(),token(actor)).post("/api/ingress/devices",JSONObject().put("id","browser-native-device").put("name","Generated browser "+actor).put("platform","android"))
        RuntimeSettings.replaceAccount(app) { settings.signOut() }
        val requestId=java.util.concurrent.atomic.AtomicReference<String?>()
        val instrumentation=InstrumentationRegistry.getInstrumentation()
        val monitor=object:android.app.Instrumentation.ActivityMonitor(){override fun onStartActivity(intent:android.content.Intent):android.app.Instrumentation.ActivityResult? {
            val url=intent.data ?: return null
            if(intent.action==android.content.Intent.ACTION_VIEW&&url.toString().startsWith(endpoint()+"/#/ask?loginRequest=")){
                requestId.set(android.net.Uri.parse("https://fixture.invalid/?"+url.fragment!!.substringAfter('?')).getQueryParameter("loginRequest"))
                return android.app.Instrumentation.ActivityResult(android.app.Activity.RESULT_CANCELED,null)
            }
            return null
        }};instrumentation.addMonitor(monitor)
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        try{androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","devices")).use {scenario->
            waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready}
            scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()=="使用浏览器登录"}.performClick()};waitFor {requestId.get()!=null}
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED)
            val id=requestId.get()!!;val approval=CentralClient(endpoint(),token("a"));val detail=approval.get("/api/login/requests/"+id)
            approval.post("/api/login/requests/"+id+"/approve");scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED)
            waitFor { !settings.read().authSignedOut };waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready}
            scenario.onActivity {activity->assertNotNull("The original browser login must return a usable native central session, not an ingestion-only device grant",activity.client)
                val text=views(activity.window.decorView).filterIsInstance<android.widget.TextView>().map {it.text.toString()};assertTrue(text.any {it.contains("Generated browser a")});assertFalse(text.any {it.contains("Generated browser b")})}
            assertEquals("central",detail.getString("purpose"));assertFalse(settings.read().deviceBoundCredential);assertEquals(fixture().getJSONObject("a").getString("userId"),settings.read().account()!!.userId)
        }}finally{instrumentation.removeMonitor(monitor)}
    }

    @Test fun optedInGeneratedNativeAskUsesTheVerifiedLocalCodexModelWithoutPrivateCentralData() {
        val app=context();require(fixture().optString("model")=="gpt-6.1-sol");waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val api=CentralAccess.requireClient(app);assertEquals("gpt-6.1-sol",api.get("/api/models/selection/chat").getString("model"));assertEquals(0,api.get("/api/query-runs").getJSONArray("items").length())
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","ask")).use {scenario->
            waitFor {var ready=false;scenario.onActivity {ready=it.client!=null&&!it.isWorking};ready}
            scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.EditText>().single {it.contentDescription=="你的问题"}.setText("This is a generated M15 Android connectivity regression. There are no private records. Reply with a short confirmation; no external tools or private information are needed.");views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()=="发送"}.performClick()}
            var run:JSONObject?=null;val deadline=android.os.SystemClock.elapsedRealtime()+180000
            while(true){val rows=api.get("/api/query-runs").getJSONArray("items");if(rows.length()>0){run=api.get("/api/query-runs/"+rows.getJSONObject(0).getString("id"));if(run!!.getString("status")!="running")break};check(android.os.SystemClock.elapsedRealtime()<deadline){"Generated local Codex regression deadline; state="+run?.optString("status")};Thread.sleep(300)}
            assertEquals(run!!.optJSONObject("error")?.optString("code"),"completed",run!!.getString("status"));assertTrue(run!!.getJSONObject("result").getString("answer").isNotBlank())
            assertEquals(404,HttpJson.get(endpoint()+"/api/query-runs/"+run!!.getString("id"),token("b")).first)
            waitFor {var visible=false;scenario.onActivity {activity->visible=views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString()==run!!.getJSONObject("result").getString("answer")}};visible}
        }
    }

    @Test fun originalNativeRecordingRetainsProcessingAndAnonymousSpeakerConfirmationWithCorrections() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val api=CentralAccess.requireClient(app);val id=fixture().getString("captureId");val initial=api.get("/api/files/"+id+"/chunks").getJSONArray("items").getJSONObject(0)
        val bApi=CentralClient(endpoint(),token("b"));val beforeB=bApi.get("/api/files/"+id+"/chunks").toString()
        assertEquals("SPEAKER_0",initial.getJSONObject("fileEvidence").getString("speaker"))
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","files")).use {scenario->
            fun ready(){waitFor {var value=false;scenario.onActivity {value=it.client!=null&&!it.isWorking};value}}
            fun press(label:String){scenario.onActivity {activity->val button=views(activity.window.decorView).filterIsInstance<android.widget.Button>().singleOrNull {it.text.toString()==label};assertNotNull("Missing original file control: "+label,button);button!!.performClick()}}
            ready();press("查看详情");ready()
            scenario.onActivity {activity->val text=views(activity.window.decorView).filterIsInstance<android.widget.TextView>().map {it.text.toString()};assertFalse("Actual succeeded M06 work must not be called unscheduled",text.any {it.contains("尚未调度")});assertTrue("Anonymous cluster identity must remain visible",text.any {it.contains("SPEAKER_0")})}
            press("确认说话人");ready();scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.EditText>().single {it.hint.toString()=="SPEAKER_0"}.setText("Generated A confirmed speaker")};press("保存说话人姓名");ready()
            val named=api.get("/api/files/"+id+"/chunks").getJSONArray("items").getJSONObject(0);assertEquals("Generated A confirmed speaker",named.getJSONObject("fileEvidence").getJSONObject("speakerAttribution").getString("name"));assertEquals(initial.getString("ocrText"),named.getString("ocrText"))
            press("纠正此段");scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.EditText>().single {it.hint.toString()=="校正此段文字"}.setText("Generated A owner corrected recording")};press("保存校正");ready()
            val corrected=api.get("/api/files/"+id+"/chunks").getJSONArray("items").getJSONObject(0);assertEquals("Generated A owner corrected recording",corrected.getString("ocrText"));assertNotEquals(initial.getJSONObject("fileEvidence").getString("artifactId"),corrected.getJSONObject("fileEvidence").getString("artifactId"));assertEquals("Generated A confirmed speaker",corrected.getJSONObject("fileEvidence").getJSONObject("speakerAttribution").getString("name"))
            assertEquals(initial.getString("ocrText"),api.get("/api/processing/artifacts/"+initial.getJSONObject("fileEvidence").getString("artifactId")).getJSONObject("payload").getJSONArray("segments").getJSONObject(0).getString("text"))
            press("确认说话人");ready();lateinit var oldSave:android.widget.Button;scenario.onActivity {activity->oldSave=views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()=="保存说话人姓名"}}
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);login(app,"b");scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED);scenario.onActivity {oldSave.performClick()};ready();assertEquals(beforeB,CentralAccess.requireClient(app).get("/api/files/"+id+"/chunks").toString())
        }
    }

    @Test fun originalFileStageRetryRetainsItsAdmittedOperationAcrossLostAckRecreationAndAccountSwitch() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val api=CentralAccess.requireClient(app);val id=fixture().getString("captureId")
        val before=api.get("/api/files/"+id+"/chunks").getJSONArray("items").getJSONObject(0)
        val b=CentralClient(endpoint(),token("b"));val beforeB=b.get("/api/files/"+id+"/chunks").toString()
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        control("/generated/drop-file-retry-ack")
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","files")).use {scenario->
            fun ready(){waitFor {var value=false;scenario.onActivity {value=it.client!=null&&!it.isWorking};value}}
            fun press(label:String){scenario.onActivity {activity->val button=views(activity.window.decorView).filterIsInstance<android.widget.Button>().singleOrNull {it.text.toString()==label};assertNotNull("Missing original file control: "+label,button);button!!.performClick()}}
            ready();press("查看详情");ready();press("重试 · 转写");ready()
            val first=control("/generated/file-retries").getJSONArray("retries")
            assertTrue("The original file retry must reach real admission",first.length()>0)
            val admitted=first.getJSONObject(0);assertEquals(200,admitted.getInt("status"));assertEquals("a",admitted.getString("actor"))
            val body=admitted.getJSONObject("body");java.util.UUID.fromString(body.getString("operationId"));assertEquals("transcribe",body.getString("stage"))
            val taskId=admitted.getString("taskId");assertTrue(Regex("[a-f0-9]{64}").matches(taskId))
            for(index in 0 until first.length()){val attempt=first.getJSONObject(index);assertEquals("a",attempt.getString("actor"));assertEquals(200,attempt.getInt("status"));assertEquals(taskId,attempt.getString("taskId"));assertEquals(SourceRules.canonical(body),SourceRules.canonical(attempt.getJSONObject("body")))}
            scenario.recreate();ready();press("查看详情");ready();control("/generated/release-file-retry-ack")
            lateinit var oldRetry:android.widget.Button
            scenario.onActivity {activity->oldRetry=views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()=="重试同一请求"};oldRetry.performClick()};ready()
            val attempts=control("/generated/file-retries").getJSONArray("retries");assertTrue(attempts.length()>first.length())
            for(index in 0 until attempts.length()){val attempt=attempts.getJSONObject(index);assertEquals("a",attempt.getString("actor"));assertEquals(200,attempt.getInt("status"));assertEquals(SourceRules.canonical(body),SourceRules.canonical(attempt.getJSONObject("body")));assertEquals(taskId,attempt.getString("taskId"))}
            waitFor {api.get("/api/tasks/"+taskId).getString("state")=="succeeded"}
            val after=api.get("/api/files/"+id+"/chunks").getJSONArray("items").getJSONObject(0)
            assertNotEquals(before.getJSONObject("fileEvidence").getString("artifactId"),after.getJSONObject("fileEvidence").getString("artifactId"))
            assertEquals(before.getString("ocrText"),after.getString("ocrText"))
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);login(app,"b");scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED)
            scenario.onActivity {oldRetry.performClick()};ready()
            assertEquals(attempts.length(),control("/generated/file-retries").getJSONArray("retries").length());assertEquals(beforeB,b.get("/api/files/"+id+"/chunks").toString())
        }
    }

    @Test fun originalFileStopRequiresExplicitUnknownConsentBeforeFreshRetryAndDeletesOnlyItsOwner() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val api=CentralAccess.requireClient(app);val id=fixture().getString("captureId");val b=CentralClient(endpoint(),token("b"))
        val before=api.get("/api/files/"+id);val beforeB=b.get("/api/files/"+id+"/chunks").toString()
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        fun dialog():android.app.AlertDialog {
            @Suppress("UNCHECKED_CAST") val dialogs=MoteDialogBuilder::class.java.getDeclaredField("dialogs").apply {isAccessible=true}.get(null) as List<java.lang.ref.WeakReference<android.app.AlertDialog>>
            return dialogs.mapNotNull {it.get()}.single {it.isShowing}
        }
        control("/generated/hold-next-asr")
        try {androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","files")).use {scenario->
            fun ready(){waitFor {var value=false;scenario.onActivity {value=it.client!=null&&!it.isWorking};value}}
            fun press(label:String){scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()==label}.performClick()}}
            fun reopen(){scenario.onActivity {it.navigate("files")};ready();press("查看详情");ready()}
            ready();press("查看详情");ready();press("重试 · 转写");ready();waitFor {control("/generated/file-retries").getBoolean("asrHeld")}
            val first=control("/generated/file-retries").getJSONArray("retries").getJSONObject(0);assertEquals(200,first.getInt("status"))
            reopen();press("停止处理");ready();assertEquals("cancelled",api.get("/api/tasks/"+first.getString("taskId")).getString("state"))
            val stopped=api.get("/api/files/"+id);assertTrue(stopped.getBoolean("hasOriginal"));assertEquals(before.getString("sha256"),stopped.getString("sha256"));assertFalse(stopped.getJSONObject("cancellation").getBoolean("canCancel"))
            val wait=stopped.getJSONObject("cancellation").optString("wait")
            if(wait=="unknown") {
                press("重试 · 转写");scenario.onActivity {assertTrue(dialog().isShowing);dialog().getButton(android.app.AlertDialog.BUTTON_NEGATIVE).performClick()}
                assertEquals(1,control("/generated/file-retries").getJSONArray("retries").length())
            } else assertEquals("running",wait)
            control("/generated/release-asr");waitFor {!control("/generated/file-retries").getBoolean("asrHeld") && api.get("/api/files/"+id).getJSONObject("cancellation").optString("wait")!="running"}
            val confirmationRequired=api.get("/api/files/"+id).getJSONObject("cancellation").optString("wait")=="unknown"
            reopen();press("重试 · 转写")
            if(confirmationRequired)scenario.onActivity {dialog().getButton(android.app.AlertDialog.BUTTON_POSITIVE).performClick()}
            ready();val attempts=control("/generated/file-retries").getJSONArray("retries");assertEquals(2,attempts.length())
            val fresh=attempts.getJSONObject(1);assertEquals(confirmationRequired,fresh.getJSONObject("body").getBoolean("confirmUnknown"));assertNotEquals(first.getJSONObject("body").getString("operationId"),fresh.getJSONObject("body").getString("operationId"))
            waitFor {api.get("/api/tasks/"+fresh.getString("taskId")).getString("state")=="succeeded"};assertEquals(beforeB,b.get("/api/files/"+id+"/chunks").toString())
            reopen();press("删除文件");scenario.onActivity {dialog().getButton(android.app.AlertDialog.BUTTON_POSITIVE).performClick()};ready()
            assertEquals(404,HttpJson.get(endpoint()+"/api/files/"+id,token("a")).first);assertEquals(beforeB,b.get("/api/files/"+id+"/chunks").toString())
        }}finally{control("/generated/release-asr")}
    }

    @Test fun originalFileUnknownResultRequiresExplicitConfirmationAndPreservesUnresolvedFacts() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val api=CentralAccess.requireClient(app);val id=fixture().getString("captureId");val b=CentralClient(endpoint(),token("b"));val beforeB=b.get("/api/files/"+id+"/chunks").toString()
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        fun tasks():List<JSONObject> {val rows=api.get("/api/tasks").getJSONArray("items");return (0 until rows.length()).map(rows::getJSONObject)}
        fun dialog():android.app.AlertDialog {
            @Suppress("UNCHECKED_CAST") val dialogs=MoteDialogBuilder::class.java.getDeclaredField("dialogs").apply {isAccessible=true}.get(null) as List<java.lang.ref.WeakReference<android.app.AlertDialog>>
            return dialogs.mapNotNull {it.get()}.single {it.isShowing}
        }
        control("/generated/drop-next-asr")
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","files")).use {scenario->
            fun ready(){waitFor {var value=false;scenario.onActivity {value=it.client!=null&&!it.isWorking};value}}
            fun press(label:String){scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()==label}.performClick()}}
            fun reopen(){scenario.onActivity {it.navigate("files")};ready();press("查看详情");ready()}
            ready();press("查看详情");ready();press("重试 · 转写");ready()
            waitFor {api.get("/api/files/"+id).getJSONObject("cancellation").optString("wait")=="unknown"}
            // Unknown is not proof of physical termination. Await actual public
            // task settlement before the separate explicit retry decision.
            waitFor {tasks().none {it.getString("kind").startsWith("processing.")&&it.getString("state") in setOf("waiting","running")}}
            val unresolved=tasks().filter {it.optInt("externalUnresolved")>0}.map {it.getString("id")};assertTrue(unresolved.isNotEmpty())
            val before=control("/generated/file-retries").getJSONArray("retries").length()
            reopen();press("重试 · 转写");scenario.onActivity {dialog().getButton(android.app.AlertDialog.BUTTON_NEGATIVE).performClick()}
            assertEquals(before,control("/generated/file-retries").getJSONArray("retries").length())
            press("重试 · 转写");lateinit var oldConfirm:android.widget.Button
            scenario.onActivity {oldConfirm=dialog().getButton(android.app.AlertDialog.BUTTON_POSITIVE);oldConfirm.performClick()};ready()
            val attempts=control("/generated/file-retries").getJSONArray("retries");assertEquals(before+1,attempts.length());val fresh=attempts.getJSONObject(attempts.length()-1)
            assertTrue(fresh.getJSONObject("body").getBoolean("confirmUnknown"));assertEquals(200,fresh.getInt("status"))
            waitFor {api.get("/api/tasks/"+fresh.getString("taskId")).getString("state")=="succeeded"}
            for(taskId in unresolved)assertTrue("Explicit replay consent must not invent a resolved external fact",api.get("/api/tasks/"+taskId).getInt("externalUnresolved")>0)
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);login(app,"b");scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED);scenario.onActivity {oldConfirm.performClick()};ready()
            assertEquals(attempts.length(),control("/generated/file-retries").getJSONArray("retries").length());assertEquals(beforeB,b.get("/api/files/"+id+"/chunks").toString())
        }
    }

    @Test fun originalNativeRecordingSavesExactAuthenticatedOriginalThroughItsDocumentResult() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val output=File(app.cacheDir,"generated-recording.wav").apply {writeText("Generated existing document sentinel")};val instrumentation=InstrumentationRegistry.getInstrumentation()
        val monitor=instrumentation.addMonitor(android.content.IntentFilter(android.content.Intent.ACTION_CREATE_DOCUMENT).apply {addCategory(android.content.Intent.CATEGORY_OPENABLE);addDataType("audio/wav")},android.app.Instrumentation.ActivityResult(android.app.Activity.RESULT_OK,android.content.Intent().setData(android.net.Uri.fromFile(output))),true)
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        try {androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","files")).use {scenario->
            fun ready(){waitFor {var value=false;scenario.onActivity {value=it.client!=null&&!it.isWorking};value}}
            fun press(label:String){scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()==label}.performClick()}}
            ready();press("查看详情");ready();press("保存原件");waitFor {monitor.hits==1}
            var outcome=""
            waitFor {var settled=false;scenario.onActivity {activity->outcome=views(activity.window.decorView).filterIsInstance<android.widget.TextView>().filter {it.tag=="central-status"}.joinToString {it.text.toString()};settled=!activity.isWorking&&outcome.isNotBlank()&&outcome!="正在导出中央资料…"&&outcome!="正在读取…"};settled}
            assertArrayEquals("Native document outcome: "+outcome,android.util.Base64.decode(fixture().getString("wave"),android.util.Base64.DEFAULT),output.readBytes())
        }}finally{instrumentation.removeMonitor(monitor)}
    }

    private fun connectGeneratedGoogle(actor:String,id:String,provider:String) {
        val api=CentralClient(endpoint(),token(actor));val path="/api/connectors/"+id;val inventory=api.get("/api/connectors")
        api.put(path,JSONObject().put("expectedRevision",inventory.getLong("revision")).put("connection",JSONObject().put("provider",provider).put("autoSync",false).put("syncIntervalMs",300000).put("googleClientId","GENERATED_"+actor+"_CLIENT").put("googleClientSecret","GENERATED_"+actor+"_SECRET").put("googleRedirectUri","https://fixture.invalid/generated-callback")))
        api.post(path+"/enable",JSONObject().put("expectedRevision",api.get("/api/plugins").getLong("revision")))
        val auth=api.post(path+"/start");val state=android.net.Uri.parse(auth.getString("authorizationUrl")).getQueryParameter("state")!!
        val callback=java.net.URL(endpoint()+"/oauth/google/callback?state="+CentralScreens.encode(state)+"&code=generated-native-code").openConnection() as java.net.HttpURLConnection
        try{assertEquals(200,callback.responseCode);callback.inputStream.close()}finally{callback.disconnect()}
        waitFor {api.get("/api/tasks/"+auth.getString("taskId")).getString("state")=="succeeded"};assertTrue(api.get(path).getBoolean("connected"))
    }

    @Test fun originalNativeGmailLostAckSurvivesRecreationAndSwitchWithoutCreatingANewAdmission() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val id="same-native-mail";for(actor in listOf("a","b"))connectGeneratedGoogle(actor,id,"gmail")
        val a=CentralAccess.requireClient(app);val b=CentralClient(endpoint(),token("b"));val beforeB=b.get("/api/source-items").toString()
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","settings")).use {scenario->
            fun ready(){waitFor {var value=false;scenario.onActivity {value=it.client!=null&&!it.isWorking};value}}
            fun card(activity:CentralActivity)=views(activity.window.decorView).filterIsInstance<android.widget.TextView>().single {it.text.toString()==id+" · gmail"}.parent as android.view.ViewGroup
            fun button(label:String):android.widget.Button? {var value:android.widget.Button?=null;scenario.onActivity {activity->value=views(card(activity)).filterIsInstance<android.widget.Button>().singleOrNull {it.text.toString()==label}};return value}
            fun sources(){ready();scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()=="来源与外部应用"}.performClick()};ready()}
            fun press(label:String){val target=button(label);assertNotNull("Missing owned Gmail control: "+label,target);scenario.onActivity {target!!.performClick()}}
            sources();control("/generated/drop-commands");press("立即同步");ready()
            waitFor {button("重试")!=null};val oldRetry=button("重试")!!
            waitFor {a.get("/api/source-items").getJSONArray("items").length()>0}
            val attempts=control("/generated/commands").getJSONArray("commands");val before=(0 until attempts.length()).map(attempts::getJSONObject).filter {it.getString("actor")=="a"&&it.getString("path").endsWith("/sync")};assertTrue(before.isNotEmpty());assertEquals(1,before.map {it.getString("operationId")}.toSet().size);val operation=before.first().getString("operationId");val task=before.first().getString("taskId")
            scenario.recreate();sources();assertNotNull(button("重试"))
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);login(app,"b");scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED);ready();scenario.onActivity {oldRetry.performClick()};sources();assertNull("A pending command must not appear in same-ID B",button("重试"));assertEquals(beforeB,b.get("/api/source-items").toString())
            control("/generated/release-commands");scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);login(app,"a");scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED);sources();press("重试");ready()
            val after=control("/generated/commands").getJSONArray("commands");val retried=(0 until after.length()).map(after::getJSONObject).filter {it.getString("actor")=="a"&&it.getString("path").endsWith("/sync")};assertTrue(retried.size>before.size);assertEquals(setOf(operation),retried.map {it.getString("operationId")}.toSet());assertEquals(setOf(task),retried.map {it.getString("taskId")}.toSet())
            assertThrows(IllegalStateException::class.java) { a.get("/api/source-items") };assertEquals(1,CentralAccess.requireClient(app).get("/api/source-items").getJSONArray("items").length());assertEquals(beforeB,b.get("/api/source-items").toString())
        }
    }

    @Test fun originalNativeGoogleCalendarSelectionAndSyncUseOwnedM10TasksAndRetireDetachedAButtons() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val id="same-native-calendar";val path="/api/connectors/"+id
        for(actor in listOf("a","b")) connectGeneratedGoogle(actor,id,"google-calendar")
        val a=CentralAccess.requireClient(app);val b=CentralClient(endpoint(),token("b"));val beforeB=b.get("/api/source-items").toString()
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","settings")).use {scenario->
            fun ready(){waitFor {var value=false;scenario.onActivity {value=it.client!=null&&!it.isWorking};value}}
            fun card(activity:CentralActivity)=views(activity.window.decorView).filterIsInstance<android.widget.TextView>().single {it.text.toString()==id+" · google-calendar"}.parent as android.view.ViewGroup
            fun press(label:String,connection:Boolean=true){scenario.onActivity {activity->val candidates=views(if(connection)card(activity) else activity.window.decorView).filterIsInstance<android.widget.Button>();val button=candidates.singleOrNull {it.text.toString()==label};assertNotNull("Missing original Google operation: "+label,button);button!!.performClick()}}
            ready();press("来源与外部应用",false);ready();press("读取日历列表");ready()
            waitFor {var value=false;scenario.onActivity {activity->value=views(card(activity)).filterIsInstance<android.widget.CheckBox>().any {it.text.toString().startsWith("Generated calendar ")}};value}
            scenario.onActivity {activity->views(card(activity)).filterIsInstance<android.widget.CheckBox>().single {it.text.toString().startsWith("Generated calendar ")}.isChecked=true};press("保存选择");ready()
            waitFor {a.get(path).getJSONArray("selectedCalendarIds").let {it.length()==1&&it.getString(0)=="same-calendar"}}
            press("立即同步");ready();waitFor {a.get("/api/source-items").getJSONArray("items").length()>0}
            val own=a.get("/api/source-items").toString();assertTrue(own.contains("GENERATED_PRIVATE_"+fixture().getJSONObject("a").getString("userId")));assertFalse(own.contains(fixture().getJSONObject("b").getString("userId")))
            lateinit var oldSync:android.widget.Button;scenario.onActivity {activity->oldSync=views(card(activity)).filterIsInstance<android.widget.Button>().single {it.text.toString()=="立即同步"}}
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);login(app,"b");scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED);scenario.onActivity {oldSync.performClick()};ready();assertEquals(beforeB,b.get("/api/source-items").toString())
        }
    }

    @Test fun originalNativeGoogleConnectionSettingsCreateDisabledAndKeepMaskedCasUnderTheirOwner() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val a=CentralAccess.requireClient(app);assertEquals(0,a.get("/api/connectors").getJSONArray("connections").length())
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","settings")).use {scenario->
            fun ready(){waitFor {var value=false;scenario.onActivity {value=it.client!=null&&!it.isWorking};value}}
            fun press(label:String){scenario.onActivity {activity->val button=views(activity.window.decorView).filterIsInstance<android.widget.Button>().singleOrNull {it.text.toString()==label};assertNotNull("Missing original owned connection control: "+label,button);button!!.performClick()}}
            fun fill(label:String,value:String){scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.EditText>().single {it.hint.toString()==label}.setText(value)}}
            ready();press("来源与外部应用");ready();press("新建连接");ready()
            scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Spinner>().single {spinner->(0 until spinner.count).any {spinner.getItemAtPosition(it).toString()=="gmail"}}.let {spinner->spinner.setSelection((0 until spinner.count).single {spinner.getItemAtPosition(it).toString()=="gmail"})}}
            InstrumentationRegistry.getInstrumentation().waitForIdleSync()
            fill("连接 ID","same-mail");fill("Google 客户端 ID","GENERATED_A_CLIENT");fill("Google 客户端密钥","GENERATED_A_SECRET");fill("Google 授权回调地址","https://fixture.invalid/a-callback");press("保存连接");ready()
            val inventory=a.get("/api/connectors");assertEquals(1,inventory.getJSONArray("connections").length());assertEquals("same-mail",inventory.getJSONArray("connections").getJSONObject(0).getString("id"))
            fun instance():JSONObject {val rows=a.get("/api/plugins").getJSONArray("instances");return (0 until rows.length()).map(rows::getJSONObject).single {it.getString("id")=="connector.same-mail"}}
            assertFalse("Saving never starts background execution",instance().getBoolean("desired"))
            press("编辑连接");ready();scenario.onActivity {activity->assertEquals("",views(activity.window.decorView).filterIsInstance<android.widget.EditText>().single {it.hint.toString()=="Google 客户端密钥"}.text.toString())}
            fill("Google 授权回调地址","https://fixture.invalid/a-callback-edited");press("保存连接");ready()
            val domains=a.get("/api/configuration").getJSONArray("domains");val saved=(0 until domains.length()).map(domains::getJSONObject).single {it.getString("id")=="connectorSettings"}.getJSONObject("saved").getJSONArray("connections").getJSONObject(0)
            assertTrue(saved.getBoolean("googleClientSecret"));assertEquals("https://fixture.invalid/a-callback-edited",saved.getString("googleRedirectUri"));assertTrue(a.get("/api/connectors/same-mail").getBoolean("configured"))
            press("启用");ready();assertTrue(instance().getBoolean("desired"));press("暂停");ready();assertFalse(instance().getBoolean("desired"))
            press("编辑连接");ready();fill("Google 授权回调地址","https://fixture.invalid/old-a-save")
            lateinit var oldSave:android.widget.Button;scenario.onActivity {activity->oldSave=views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()=="保存连接"}}
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);login(app,"b");scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED);scenario.onActivity {oldSave.performClick()};ready()
            val bDomains=CentralAccess.requireClient(app).get("/api/configuration").getJSONArray("domains");val bSaved=(0 until bDomains.length()).map(bDomains::getJSONObject).single {it.getString("id")=="connectorSettings"}.getJSONObject("saved").getJSONArray("connections").getJSONObject(0)
            assertEquals("same-mail",bSaved.getString("id"));assertEquals("GENERATED_B_CLIENT",bSaved.getString("googleClientId"));assertEquals("https://fixture.invalid/b-callback",bSaved.getString("googleRedirectUri"))
        }
    }

    @Test fun actualNativeOverviewReadsOwnedStatisticsAndCanonicalDeviceMetadata() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val statistics=CentralAccess.requireClient(app).get("/api/data/statistics")
        assertTrue(statistics.getLong("captures")>0)
        CentralAccess.requireClient(app).post("/api/ingress/devices",JSONObject().put("id",settings.deviceId).put("name","Generated A overview device").put("platform","android"))
        val devices=CentralAccess.requireClient(app).get("/api/ingress/devices").getJSONArray("items")
        assertTrue(devices.length()>0)
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","overview")).use {scenario->
            waitFor {var ready=false;scenario.onActivity {ready=it.client!=null&&!it.isWorking};ready}
            scenario.onActivity {activity->
                val text=views(activity.window.decorView).filterIsInstance<android.widget.TextView>().map {it.text.toString()}
                assertTrue("Original native overview must display this account's actual capture count",text.contains("原始采集记录 · "+statistics.getLong("captures")))
                assertTrue(text.contains("正式资料 · "+statistics.getLong("materials")))
                assertTrue(text.contains("来源与连接 · "+statistics.getLong("sources")))
                for(index in 0 until devices.length())assertTrue(text.any {it.contains(devices.getJSONObject(index).getString("name"))})
            }
        }
    }

    @Test fun originalOverviewKeepsRecentOwnedOperationPreviewsAndTheirDetails() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val operations=CentralAccess.requireClient(app).get("/api/operations?limit=5").getJSONArray("items")
        assertTrue("The actual M12 producer must have admitted M05 operations",operations.length()>0)
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","overview")).use {scenario->
            waitFor {var ready=false;scenario.onActivity {ready=it.client!=null&&!it.isWorking};ready}
            scenario.onActivity {activity->
                val all=views(activity.window.decorView)
                assertEquals("The original recent-five operation cards must remain beside the full Activity entry",operations.length(),all.filterIsInstance<android.widget.Button>().count {it.text.toString()=="查看详情"})
                for(index in 0 until operations.length()) {
                    val row=operations.getJSONObject(index)
                    assertTrue(all.filterIsInstance<android.widget.TextView>().any {it.text.toString()==row.optString("title",row.optString("kind",row.optString("id")))})
                }
                all.filterIsInstance<android.widget.Button>().first {it.text.toString()=="查看详情"}.performClick()
            }
            waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready}
            scenario.onActivity {activity->assertTrue(views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString().contains(operations.getJSONObject(0).getString("id"))})}
        }
    }

    @Test fun actualNativeActionsSettingsPreserveOwnedRevisionAndRetireTheOriginalSave() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val a=CentralAccess.requireClient(app);val before=a.get("/api/actions");assertTrue(before.getJSONObject("settings").getBoolean("enabled"))
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","actions")).use {scenario->
            waitFor {var ready=false;scenario.onActivity {ready=it.client!=null&&!it.isWorking};ready}
            scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()=="行动设置"}.performClick()}
            waitFor {var ready=false;scenario.onActivity {activity->ready=!activity.isWorking&&views(activity.window.decorView).filterIsInstance<android.widget.CheckBox>().any {it.text.toString()=="启用"}};ready}
            lateinit var originalSave:android.widget.Button
            scenario.onActivity {activity->
                views(activity.window.decorView).filterIsInstance<android.widget.CheckBox>().single {it.text.toString()=="启用"}.isChecked=false
                originalSave=views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()=="保存设置"};originalSave.performClick()
            }
            waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready}
            val after=a.get("/api/actions")
            assertFalse("The native setting form must submit M12 revision and authorizationRevision with its settings",after.getJSONObject("settings").getBoolean("enabled"))
            assertEquals(before.getJSONObject("settings").getJSONArray("reviewDeviceIds").toString(),after.getJSONObject("settings").getJSONArray("reviewDeviceIds").toString())
            assertTrue(after.getLong("revision")>before.getLong("revision"))
            login(app,"b");scenario.onActivity {it.navigate("actions")};waitFor {var ready=false;scenario.onActivity {ready=it.client!=null&&!it.isWorking};ready}
            scenario.onActivity {originalSave.performClick()}
            assertTrue(CentralAccess.requireClient(app).get("/api/actions").getJSONObject("settings").getBoolean("enabled"))
        }
    }

    @Test fun sameIdentityResumeKeepsTheNativeSaveActionUsable() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val text="Generated note after a same-account native Activity resume "+java.util.UUID.randomUUID()
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","notes")).use { scenario ->
            waitFor {var ready=false;scenario.onActivity {ready=it.client!=null&&!it.isWorking};ready}
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED);scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED)
            waitFor {var ready=false;scenario.onActivity {ready=it.client!=null&&!it.isWorking};ready}
            scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.EditText>().single {it.hint.toString()=="此刻想留下什么？"}.setText(text);views(activity.window.decorView).filterIsInstance<android.widget.Button>().single {it.text.toString()=="保存并同步"}.performClick()}
            waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready}
            val rows=CentralAccess.requireClient(app).get("/api/captures?kind=note&limit=30").getJSONArray("items")
            val saved=(0 until rows.length()).map {rows.getJSONObject(it)}.firstOrNull {it.optString("ocrText")==text}
            assertNotNull("Same-identity resume must not retire every existing native action",saved)
            assertEquals(404,get(app,"b","/api/captures/"+saved!!.getString("id")).first)
        }
    }

    @Test fun actualNativeMemorySettingsUseTheOwnedConfigurationCAS() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val api=CentralAccess.requireClient(app);val before=api.get("/api/configuration")
        val bBefore=CentralClient(endpoint(),token("b")).get("/api/configuration")
        fun domain(view:JSONObject):JSONObject { val items=view.getJSONArray("domains");return (0 until items.length()).map {items.getJSONObject(it)}.single {it.getString("id")=="memory"}.getJSONObject("saved") }
        val zone=if(domain(before).getString("timeZone")=="Asia/Tokyo")"UTC" else "Asia/Tokyo"
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","memories")).use { scenario ->
            fun ready() {waitFor {var value=false;scenario.onActivity {value=it.client!=null&&!it.isWorking};value}}
            fun click(label:String) {var done=false;waitFor {scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().firstOrNull {it.text.toString()==label&&it.isEnabled}?.let {it.performClick();done=true}};done}}
            ready();click("记忆设置");ready();click("记忆自动处理");ready()
            scenario.onActivity {activity->val field=views(activity.window.decorView).filterIsInstance<android.widget.EditText>().firstOrNull {it.hint.toString()=="timeZone"};assertNotNull("Native Memory settings must open the actual owned M04 domain",field);field!!.setText(zone)}
            click("保存设置");ready()
            val after=api.get("/api/configuration");assertEquals(zone,domain(after).getString("timeZone"))
            assertEquals(domain(bBefore).toString(),domain(CentralClient(endpoint(),token("b")).get("/api/configuration")).toString())
            assertEquals(409,assertThrows(CentralFailure::class.java){api.put("/api/configuration/memory",JSONObject().put("revision",before.getLong("revision")).put("value",domain(before)).put("preserveRedactedSecrets",true))}.status)
        }
    }

    @Test fun actualNativeModelSettingsUseTheOwnedDomainAndPreserveMaskedCredentials() {
        val app=context();check(fixture().has("published"));waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val api=CentralAccess.requireClient(app);val bApi=CentralClient(endpoint(),token("b"));val bBefore=bApi.get("/api/configuration")
        fun models(view:JSONObject):JSONObject {val domains=view.getJSONArray("domains");return (0 until domains.length()).map {domains.getJSONObject(it)}.single {it.getString("id")=="models"}.getJSONObject("saved")}
        val before=models(api.get("/api/configuration"));val name="Generated native owned profile "+java.util.UUID.randomUUID()
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","settings")).use {scenario->
            fun ready() {waitFor {var value=false;scenario.onActivity {value=it.client!=null&&!it.isWorking};value}}
            fun click(label:String) {var done=false;waitFor {scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().firstOrNull {it.text.toString()==label&&it.isEnabled}?.let {it.performClick();done=true}};done}}
            ready();click("模型配置");ready()
            scenario.onActivity {activity->val field=views(activity.window.decorView).filterIsInstance<android.widget.EditText>().firstOrNull {it.hint.toString()=="profiles · 高级 JSON"};assertNotNull("Native models must use the owned M04 configuration",field);val profiles=org.json.JSONArray(field!!.text.toString());profiles.getJSONObject(0).put("name",name);field.setText(profiles.toString())}
            click("保存设置");ready()
            val after=models(api.get("/api/configuration"));assertEquals(name,after.getJSONArray("profiles").getJSONObject(0).getString("name"));assertEquals(before.getJSONObject("selections").toString(),after.getJSONObject("selections").toString())
            assertEquals(before.getJSONArray("profiles").getJSONObject(0).getJSONObject("settings").toString(),after.getJSONArray("profiles").getJSONObject(0).getJSONObject("settings").toString())
            assertEquals(models(bBefore).toString(),models(bApi.get("/api/configuration")).toString())
        }
    }

    @Test fun actualNativeRecipeSelectionUsesTheScopedCatalogAndOwnedCAS() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val api=CentralAccess.requireClient(app);val bApi=CentralClient(endpoint(),token("b"));val bBefore=bApi.get("/api/configuration")
        val catalog=api.get("/api/memory/recipes").getJSONArray("items");val recipe=(0 until catalog.length()).map {catalog.getJSONObject(it)}.first {it.optBoolean("available",true)}
        val label=recipe.optString("name",recipe.getString("id"))+" · "+recipe.getString("version")
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","memories")).use { scenario ->
            fun ready() {waitFor {var value=false;scenario.onActivity {value=it.client!=null&&!it.isWorking};value}}
            fun click(label:String) {var done=false;waitFor {scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().firstOrNull {it.text.toString()==label&&it.isEnabled}?.let {it.performClick();done=true}};done}}
            ready();click("记忆设置");ready();click("记忆提取配方");ready()
            scenario.onActivity {activity->val boxes=views(activity.window.decorView).filterIsInstance<android.widget.CheckBox>();val chosen=boxes.firstOrNull {it.text.toString()==label};assertNotNull("Native recipe choices must consume the actual M07 catalog",chosen);chosen!!.isChecked=true;boxes.filter {it!==chosen}.forEach {it.isChecked=false}}
            click("保存设置");ready()
            fun memory(view:JSONObject):JSONObject {val values=view.getJSONArray("domains");return (0 until values.length()).map {values.getJSONObject(it)}.single {it.getString("id")=="memory"}.getJSONObject("saved")}
            val refs=memory(api.get("/api/configuration")).getJSONArray("recipes");assertEquals(1,refs.length());assertEquals(recipe.getString("id"),refs.getJSONObject(0).getString("id"));assertEquals(recipe.getString("version"),refs.getJSONObject(0).getString("version"))
            assertEquals(memory(bBefore).toString(),memory(bApi.get("/api/configuration")).toString())
        }
    }

    @Test fun actualNativeMemoryExtractionSelectsPinnedCanonicalMaterialsUnderItsOwner() {
        val app=context();check(fixture().has("published"));waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val api=CentralAccess.requireClient(app);val bApi=CentralClient(endpoint(),token("b"));val before=api.get("/api/memory/jobs").getJSONArray("items");val oldIds=(0 until before.length()).map {before.getJSONObject(it).getString("id")}.toSet()
        val bBefore=bApi.get("/api/memory/jobs").getJSONArray("items").length();val material=fixture().getJSONObject("published").getJSONObject("a")
        val defaults=api.get("/api/configuration").toString()
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","memories")).use {scenario->
            fun ready() {waitFor {var value=false;scenario.onActivity {value=it.client!=null&&!it.isWorking};value}}
            fun click(label:String) {var done=false;waitFor {scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().firstOrNull {it.text.toString()==label&&it.isEnabled}?.let {it.performClick();done=true}};done}}
            ready();click("提取记忆");ready();click("开始提取");ready()
            scenario.onActivity {activity->val fields=views(activity.window.decorView).filterIsInstance<android.widget.CheckBox>();val selected=fields.firstOrNull {it.tag=="material:"+material.getString("materialId")+"@"+material.getString("revision")};assertNotNull("Manual extraction must offer the selected canonical Material revision instead of the old global start route",selected);selected!!.isChecked=true}
            api.post("/api/test/m15/memory-admissions")
            click("提交所选资料");ready();scenario.recreate();ready();click("提取记忆");ready();click("重试同一请求");ready()
            val sent=api.get("/api/test/m15/memory-admissions").getJSONArray("items");assertEquals(2,sent.length());assertEquals(sent.getJSONObject(0).toString(),sent.getJSONObject(1).toString())
            val request=sent.getJSONObject(0);assertEquals(1,request.getJSONArray("materialIds").length());assertEquals(material.getString("materialId"),request.getJSONArray("materialIds").getString(0));assertEquals(material.getString("revision"),request.getJSONObject("materialRevisions").getString(material.getString("materialId")))
            val page=api.get("/api/memory/jobs").getJSONArray("items");val admitted=(0 until page.length()).map {page.getJSONObject(it)}.single {it.getString("id") !in oldIds}
            assertEquals(request.getString("operationId"),admitted.getString("id"));assertTrue(admitted.getJSONObject("tasks").length()>0)
            assertEquals(bBefore,bApi.get("/api/memory/jobs").getJSONArray("items").length());assertEquals(defaults,api.get("/api/configuration").toString())
            assertEquals(404,assertThrows(CentralFailure::class.java){bApi.get("/api/memory/jobs/"+admitted.getString("id"))}.status)
        }
    }

    @Test fun actualPublishedMemoryEvidenceUsesTheCanonicalReaderUnderItsOwner() {
        val app=context();check(fixture().has("published"));waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","memories")).use { scenario ->
            fun click(label:String) {var done=false;waitFor {scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().firstOrNull {it.text.toString()==label&&it.isEnabled}?.let {it.performClick();done=true}};done}}
            waitFor {var ready=false;scenario.onActivity {ready=it.client!=null&&!it.isWorking};ready};click("查看详情")
            waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready};click("查看原文依据 1")
            waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready}
            scenario.onActivity {activity->assertTrue("Canonical M07 evidence text must remain readable",views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString().contains("GENERATED_MEMORY_A")})}
            login(app,"b");scenario.onActivity {it.navigate("memories")};waitFor {var ready=false;scenario.onActivity {ready=it.client!=null&&!it.isWorking};ready}
            scenario.onActivity {activity->assertFalse(views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString().contains("GENERATED_MEMORY_A")})}
        }
    }

    @Test fun actualPublishedMemoryCorrectionFollowsItsCommittedNewVersion() {
        val app=context();check(fixture().has("published"));waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val corrected="Generated explicit owner correction from the native Memory editor "+java.util.UUID.randomUUID()
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","memories")).use { scenario ->
            fun click(label:String) {var done=false;waitFor {scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.Button>().firstOrNull {it.text.toString()==label&&it.isEnabled}?.let {it.performClick();done=true}};done}}
            waitFor {var ready=false;scenario.onActivity {ready=it.client!=null&&!it.isWorking};ready};click("查看详情")
            waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready}
            scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.EditText>().single {it.hint.toString()=="陈述"}.setText(corrected)}
            click("保存校正");waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready}
            val deadline=android.os.SystemClock.elapsedRealtime()+10000
            var saved:JSONObject?=null
            do {val page=CentralAccess.requireClient(app).get("/api/memories?limit=30").getJSONArray("items");saved=(0 until page.length()).map {page.getJSONObject(it)}.firstOrNull {it.optString("statement").contains(corrected)};if(saved!=null)break;Thread.sleep(30)} while(android.os.SystemClock.elapsedRealtime()<deadline)
            assertNotNull("Owner correction must publish a new current Memory",saved)
            assertNotEquals(fixture().getJSONObject("published").getJSONObject("a").getString("memoryId"),saved!!.getString("id"))
            click("刷新");waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready};click("查看记忆")
            waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready}
            scenario.onActivity {activity->assertTrue("Native correction must open the actual succeeded task result",views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString()==saved!!.getString("statement")})}
            assertFalse(CentralClient(endpoint(),token("b")).get("/api/memories?limit=30").toString().contains(corrected))
        }
    }

    @Test fun generatedScreenshotDuringAccountDrainCannotEnterBAndExplicitBStillCaptures() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false,
            uploadGate=UploadGateConfig(enabled=false),appCollectionRules=AppCollectionRules.CONTENT_DEFAULT,excludedPackages="",screenCollectionEnabled=true))
        login(app,"a");val a=settings.read();settings.enabled=true
        val entered=java.util.concurrent.CountDownLatch(1);val release=java.util.concurrent.CountDownLatch(1)
        val windows=WindowSnapshot(setOf("dev.synthetic.generated"),"dev.synthetic.generated",true)
        fun image()=android.graphics.Bitmap.createBitmap(64,64,android.graphics.Bitmap.Config.ARGB_8888).apply {for(y in 0 until 64)for(x in 0 until 64)setPixel(x,y,android.graphics.Color.rgb(x*4,y*4,(x+y)*2))}
        val pipeline=CapturePipeline(app) { }
        val executor=java.util.concurrent.Executors.newSingleThreadExecutor()
        try {
            pipeline.submit(image(),windows,a,isCurrent={entered.countDown();check(release.await(15,TimeUnit.SECONDS));true})
            assertTrue(entered.await(10,TimeUnit.SECONDS))
            val switching=executor.submit {login(app,"b")};waitFor {ConnectionGuard.reconfiguring()};release.countDown();switching.get(30,TimeUnit.SECONDS)
            assertFalse(settings.enabled);assertEquals(0,app.queue().depth())
            settings.enabled=true;val b=settings.read();pipeline.submit(image(),windows,b)
            waitFor {!pipeline.isBusy()};assertEquals(1,app.queue().pendingSync().count);val id=app.queue().peek()!!.getString("id")
            UploadWorker.schedule(app,b,true);waitFor {app.queue().pendingSync().count==0}
            assertEquals(200,get(app,"b","/api/captures/$id").first);assertEquals(404,get(app,"a","/api/captures/$id").first)
            val before=app.queue().depth();pipeline.submit(image(),windows,b,isCurrent={false});waitFor {!pipeline.isBusy()};assertEquals(before,app.queue().depth())
        } finally {release.countDown();pipeline.close();executor.shutdownNow();settings.enabled=false}
    }

    @Test fun actualNativeUsernameLoginNoteAndAccountSwitchUseTheSamePrivateSession() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server=endpoint(),token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false),confirmCentralEndpoint=true)
        MoteI18n.select(app,"zh-CN")
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","notes")).use { scenario ->
            fun click(label:String) {var clicked=false;waitFor {scenario.onActivity { activity -> val button=views(activity.window.decorView).filterIsInstance<android.widget.Button>().firstOrNull {it.text.toString()==label&&it.isEnabled};if(button!=null){button.performClick();clicked=true} };clicked}}
            waitFor {var visible=false;scenario.onActivity { visible=views(it.window.decorView).filterIsInstance<android.widget.EditText>().any { field->field.contentDescription=="用户名" } };visible}
            scenario.onActivity {activity->val fields=views(activity.window.decorView).filterIsInstance<android.widget.EditText>();fields.single {it.contentDescription=="用户名"}.setText("generated-a");fields.single {it.contentDescription=="密码"}.setText(fixture().getString("password"))}
            click("登录并继续")
            waitFor { var ready=false;scenario.onActivity {ready=it.client!=null&&!it.isWorking};ready }
            scenario.onActivity {activity->views(activity.window.decorView).filterIsInstance<android.widget.EditText>().single {it.hint.toString()=="此刻想留下什么？"}.setText("Synthetic native actual view note A")}
            click("保存并同步")
            waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready}
            val history=get(app,"a","/api/captures?kind=note");assertEquals(200,history.first)
            val rows=history.second!!.getJSONArray("items");assertEquals(1,rows.length());val id=rows.getJSONObject(0).getString("id");assertEquals("Synthetic native actual view note A",rows.getJSONObject(0).getString("ocrText"))
            login(app,"b");scenario.onActivity {it.navigate("notes")}
            waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking&&it.client!=null};ready}
            scenario.onActivity {activity->assertFalse(views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString().contains("Synthetic native actual view note A")})}
            assertEquals(404,get(app,"b","/api/captures/$id").first)
        }
    }

    @Test fun lateActualAckAndNetworkRecoveryNeverAdoptAnotherAccountsCredentials() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false))
        login(app,"a");val aowner=settings.read().ownerKey();val path=QueueStorage(app).current().path
        val aid=QuickNotes.save(app,"Synthetic A held actual server ACK","")
        control("/hold-next");UploadWorker.schedule(app,settings.read(),true)
        waitFor { control("/state").optBoolean("held") }
        login(app,"b");control("/release")
        assertEquals(404,get(app,"b","/api/captures/$aid").first)
        val aqueue=DurableQueue(File(path),app.localContentCipher()).apply {archiveOrigin=aowner};assertEquals(1,aqueue.pendingSync().count)
        val bid=QuickNotes.save(app,"Synthetic B after old A ACK","");UploadWorker.schedule(app,settings.read(),true);waitFor {app.queue().pendingSync().count==0}
        assertEquals(200,get(app,"b","/api/captures/$bid").first)
        login(app,"a");assertEquals(aid,app.queue().peek()!!.getString("id"));UploadWorker.schedule(app,settings.read(),true);waitFor {app.queue().pendingSync().count==0}
        assertEquals(200,get(app,"a","/api/captures/$aid").first)
        control("/network/off")
        try {
            QuickNotes.save(app,"Synthetic A offline actual worker","");UploadWorker.schedule(app,settings.read(),true)
            waitFor {settings.syncState()=="error"};assertEquals(1,app.queue().pendingSync().count)
        } finally {control("/network/on")}
        UploadWorker.schedule(app,settings.read(),true);waitFor {app.queue().pendingSync().count==0}
        assertEquals(404,get(app,"b","/api/captures/$aid").first)
    }

    @Test fun actualNativePluginEditorUsesOwnedGrantSelectionAndPreservesMaskedReferenceOnEdit() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        check(fixture().has("pluginPackageId"));val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        val api=CentralAccess.requireClient(app);val sourceId="plugin-source-"+java.util.UUID.randomUUID();val sourceName="Synthetic owned plugin source"
        app.ingress3(settings.read()).register(JSONObject().put("id",sourceId).put("name",sourceName).put("kind","custom").put("retention","archive").put("deviceId",settings.deviceId).put("platform","android"))
        val pkg=api.get("/api/plugins").getJSONArray("packages").getJSONObject(0);val fields=pkg.getJSONArray("configurationSchema");val labels=(0 until fields.length()).associate {fields.getJSONObject(it).getString("id") to fields.getJSONObject(it).getString("label")}
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","plugins")).use { scenario ->
            fun click(label:String) {waitFor {var clicked=false;scenario.onActivity {activity->val button=views(activity.window.decorView).filterIsInstance<android.widget.Button>().firstOrNull {it.text.toString()==label&&it.isEnabled};if(button!=null&&!activity.isWorking){button.performClick();clicked=true}};clicked}}
            click("新增实例");waitFor {var ready=false;scenario.onActivity {activity->ready=views(activity.window.decorView).filterIsInstance<android.widget.EditText>().any {it.contentDescription=="实例名称"}&&!activity.isWorking};ready}
            scenario.onActivity {activity->val all=views(activity.window.decorView);val inputs=all.filterIsInstance<android.widget.EditText>();inputs.single {it.contentDescription=="实例名称"}.setText("Synthetic native A plugin");inputs.single {it.contentDescription==labels["label"]}.setText("Synthetic native A label");inputs.single {it.contentDescription==labels["credential"]}.setText("personal:A");all.filterIsInstance<android.widget.CheckBox>().single {it.text.toString()=="processor"}.isChecked=true;all.filterIsInstance<android.widget.CheckBox>().single {it.text.toString()==sourceName}.isChecked=true}
            click("创建实例");waitFor {api.get("/api/plugins").getJSONArray("instances").length()==1}
            val instance=api.get("/api/plugins").getJSONArray("instances").getJSONObject(0);val id=instance.getString("id")
            assertEquals(listOf(sourceId),PluginControlProjection.strings(instance.getJSONObject("grants").getJSONArray("sourceIds")));assertFalse(instance.getJSONObject("grants").getBoolean("history"))
            click("配置");waitFor {var ready=false;scenario.onActivity {activity->ready=views(activity.window.decorView).filterIsInstance<android.widget.EditText>().any {it.contentDescription=="实例名称"}&&!activity.isWorking};ready}
            scenario.onActivity {activity->val inputs=views(activity.window.decorView).filterIsInstance<android.widget.EditText>();assertEquals("",inputs.single {it.contentDescription==labels["credential"]}.text.toString());inputs.single {it.contentDescription=="实例名称"}.setText("Synthetic native A edited")}
            click("保存配置");waitFor {api.get("/api/plugins").getJSONArray("instances").getJSONObject(0).getString("name")=="Synthetic native A edited"}
            val edited=api.get("/api/plugins").getJSONArray("instances").getJSONObject(0);assertEquals(id,edited.getString("id"));assertTrue(edited.getJSONObject("secretStatus").getBoolean("credential"));assertFalse(edited.getJSONObject("configuration").has("credential"))
            login(app,"b");scenario.onActivity {it.navigate("plugins")};waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking&&it.client!=null};ready};assertEquals(0,get(app,"b","/api/plugins").second!!.getJSONArray("instances").length())
            scenario.onActivity {activity->assertFalse(views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString().contains("Synthetic native A edited")})}
        }
    }

    @Test fun openMemoryStopDialogRetiresOnAccountSwitchBeforeAnyBCommand() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false));login(app,"a");MoteI18n.select(app,"zh-CN")
        assertEquals(200,get(app,"a","/api/configuration").first);assertEquals(200,get(app,"b","/api/configuration").first)
        val before=get(app,"b","/api/memory").second!!.getLong("revision");assertEquals(before,get(app,"a","/api/memory").second!!.getLong("revision"))
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","plugins")).use { scenario ->
            waitFor {var ready=false;scenario.onActivity {activity->val select=views(activity.window.decorView).filterIsInstance<android.widget.Spinner>().firstOrNull {it.contentDescription=="插件页面"};if(select!=null&&!activity.isWorking){select.setSelection(2);ready=true}};ready}
            waitFor {var clicked=false;scenario.onActivity {activity->val button=views(activity.window.decorView).filterIsInstance<android.widget.Button>().firstOrNull {it.text.toString()=="立即停止自动记忆"};if(button!=null&&!activity.isWorking){button.performClick();clicked=true}};clicked}
            fun confirmNode():android.view.accessibility.AccessibilityNodeInfo? {
                fun find(node:android.view.accessibility.AccessibilityNodeInfo?):android.view.accessibility.AccessibilityNodeInfo? {if(node==null)return null;if(node.text?.toString()=="确认"&&node.isClickable)return node;for(index in 0 until node.childCount)find(node.getChild(index))?.let {return it};return null}
                return find(InstrumentationRegistry.getInstrumentation().uiAutomation.rootInActiveWindow)
            }
            waitFor {confirmNode()!=null};login(app,"b");scenario.onActivity {it.navigate("plugins")}
            waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking&&it.client!=null};ready}
            confirmNode()?.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK)
            InstrumentationRegistry.getInstrumentation().waitForIdleSync()
            waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready}
            assertEquals(before,get(app,"b","/api/memory").second!!.getLong("revision"));assertEquals(before,get(app,"a","/api/memory").second!!.getLong("revision"))
            waitFor {var clicked=false;scenario.onActivity {activity->val button=views(activity.window.decorView).filterIsInstance<android.widget.Button>().firstOrNull {it.text.toString()=="立即停止自动记忆"};if(button!=null&&!activity.isWorking){button.performClick();clicked=true}};clicked}
            waitFor {confirmNode()!=null};assertTrue(confirmNode()!!.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK));InstrumentationRegistry.getInstrumentation().waitForIdleSync()
            waitFor {get(app,"b","/api/memory").second!!.getLong("revision")==before+1};assertEquals(before,get(app,"a","/api/memory").second!!.getLong("revision"))
        }
    }

    @Test fun tokenRotationKeepsOriginalQueueDraftAndDirectoryButRetiresOldWorkerIntent() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false))
        login(app,"a");val before=settings.read();val directory=app.accountDirectory().absolutePath
        QuickNotes.save(app,"Synthetic A before token rotation","");QuickNotes.draft(app).update("Synthetic A unsent draft","")
        val capture=app.queue().peek()!!.getString("id")
        val (status,rotated)=HttpJson.post(endpoint()+"/api/auth/login",JSONObject().put("username","generated-a").put("password",fixture().getString("password")).put("mode","client"))
        assertEquals(200,status);val nextToken=rotated!!.getString("token");assertNotEquals(before.token,nextToken)
        RuntimeSettings.replaceAccount(app) {settings.signIn(endpoint(),nextToken,2592000000)}
        assertEquals(before.ownerKey(),settings.read().ownerKey());assertEquals(directory,app.accountDirectory().absolutePath)
        assertEquals("Synthetic A unsent draft",QuickNotes.draft(app).read().text);assertEquals(capture,app.queue().peek()!!.getString("id"))
        val old=OneTimeWorkRequestBuilder<UploadWorker>().setInputData(workDataOf("manual" to true,"syncStamp" to SyncSchedule.stamp(before))).build()
        WorkManager.getInstance(app).enqueue(old).result.get();waitFor {WorkManager.getInstance(app).getWorkInfoById(old.id).get()!!.state.isFinished}
        assertEquals(1,app.queue().pendingSync().count);assertEquals(404,get(app,"a","/api/captures/$capture").first)
        UploadWorker.schedule(app,settings.read(),true);waitFor {app.queue().pendingSync().count==0}
        assertEquals("Synthetic A before token rotation",get(app,"a","/api/captures/$capture").second!!.getString("ocrText"));assertEquals(404,get(app,"b","/api/captures/$capture").first)
    }

    @Test fun expiredSnapshotUsesActualProviderDurableRecoveryAndExistingWorkerUnderAOnly() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false))
        login(app,"a");val config=settings.read();val api=CentralAccess.requireClient(app)
        val view=api.get("/api/configuration");val domains=view.getJSONArray("domains");val processing=(0 until domains.length()).map {domains.getJSONObject(it)}.single {it.getString("id")=="processing"}.getJSONObject("effective")
        api.put("/api/configuration/processing",JSONObject().put("revision",view.getLong("revision")).put("value",processing.put("automatic",false).put("summarize",false).put("understandingEnabled",false)))
        val file=File(app.filesDir,"generated-file-sync/generated-snapshot.txt").apply {parentFile!!.mkdirs();writeText("Synthetic provider snapshot exact bytes")}
        val uri=android.provider.DocumentsContract.buildDocumentUri(app.packageName+".file-fixtures","generated-snapshot.txt")
        val source=LocalSource(id="snapshot-"+java.util.UUID.randomUUID(),name="Synthetic snapshot",kind="local-files",uri=uri.toString(),retention="snapshot",syncContinuously=false,centralProcessingConsent=true,extensions="txt")
        app.localSources().save(source);val scanner=FileSources(app);assertTrue(scanner.scan(source));val row=scanner.prepare(source)!!;val manifest=row.getJSONObject("pending").getJSONObject("manifest")
        fun runUpload(c:CollectorConfig) {val request=OneTimeWorkRequestBuilder<SourceUploadWorker>().setInputData(workDataOf("manual" to true,"syncStamp" to SyncSchedule.stamp(c))).build();WorkManager.getInstance(app).enqueue(request).result.get();waitFor {WorkManager.getInstance(app).getWorkInfoById(request.id).get()!!.state.isFinished};assertEquals(app.localSources().state(source.id).toString(),WorkInfo.State.SUCCEEDED,WorkManager.getInstance(app).getWorkInfoById(request.id).get()!!.state)}
        runUpload(config);assertEquals(0,app.fileArchives().pendingCount(source.id))
        val original=api.get("/api/ingress/sources/${source.id}/originals").getJSONArray("items").getJSONObject(0);control("/snapshot/expire")
        val task=api.post("/api/processing",JSONObject().put("originalRef",original.getString("ref")).put("operationId","generated-android-recovery"))
        waitFor {api.get("/api/tasks/"+task.getString("id")).optString("state")=="blocked"}
        assertEquals(1,api.get("/api/ingress/sources/${source.id}/recovery").getJSONArray("items").length())
        login(app,"b");runUpload(config);assertEquals(404,get(app,"b","/api/processing/originals/"+original.getString("ref").removePrefix("original:")).first)
        login(app,"a");runUpload(settings.read())
        assertEquals(0,CentralAccess.requireClient(app).get("/api/ingress/sources/${source.id}/recovery").getJSONArray("items").length())
        waitFor {get(app,"a","/api/tasks/"+task.getString("id")).second!!.optString("state")=="succeeded"}
        assertEquals(0,app.fileArchives().pendingCount(source.id));assertEquals(1,CentralAccess.requireClient(app).get("/api/sources/${source.id}/history?externalId="+java.net.URLEncoder.encode(manifest.getJSONObject("item").getString("externalId"),"UTF-8")).getJSONArray("items").length())
        assertEquals("Synthetic provider snapshot exact bytes",file.readText())
    }

    @Test fun actualQueueValidationDoesNotWaitForTheCredentialSettingsMonitor() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val queue=app.queue();val completed=java.util.concurrent.CountDownLatch(1);val entered=java.util.concurrent.CountDownLatch(1);val failure=java.util.concurrent.atomic.AtomicReference<Throwable>()
        val reader=Thread {entered.countDown();try {queue.depth()} catch(error:Throwable){failure.set(error)} finally {completed.countDown()}}
        try {
            synchronized(Settings::class.java) {reader.start();assertTrue(entered.await(2,TimeUnit.SECONDS));assertTrue("Existing queue identity validation must not invert queue and credential-settings locks",completed.await(2,TimeUnit.SECONDS))}
        } finally {reader.join(10000)}
        failure.get()?.let {throw it}
    }

    @Test fun actualSourceWorkerKeepsEqualIdsSpoolsContextAndRevokedAccessUnderTheirOriginalOwner() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val watchdog=Thread { try { Thread.sleep(10000);File(app.cacheDir,"m15-source-stall.txt").writeText(Thread.getAllStackTraces().entries.joinToString("\n\n") { (thread,stack)->thread.name+" "+thread.state+"\n"+stack.joinToString("\n") }) } catch (_:InterruptedException) {} }.apply {isDaemon=true;start()}
        try {
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false))
        login(app,"a");val a=settings.read();val source=LocalSource(id="native-source-"+java.util.UUID.randomUUID(),name="Synthetic source",kind="local-files",uri="content://dev.synthetic.generated/document",retention="archive",syncContinuously=false,description="Synthetic A source context",contextDirty=true)
        val bytes="Synthetic preserved source original bytes".toByteArray()
        fun prepare(selected:LocalSource):JSONObject {
            app.localSources().save(selected);val q=app.fileArchives();val generation=q.configure(selected).getString("generation")
            val item=JSONObject().put("externalId","same-file-external").put("observedAt","2026-01-01T00:00:00Z").put("title","generated.txt").put("kind","file").put("layer","original").put("text","").put("mimeType","text/plain")
            q.observe(selected,item,generation);q.finish(selected,generation){false}
            return q.prepare(selected,{java.io.ByteArrayInputStream(bytes)},{true},captureImmediately=true)!!.getJSONObject("pending").getJSONObject("manifest")
        }
        val manifest=prepare(source);val aDirectory=app.accountDirectory().absolutePath
        login(app,"b");val bsource=source.copy(description="Synthetic B source context");val bmanifest=prepare(bsource)
        assertEquals(Ingress3Receipt.captureId(source.id,manifest.getJSONObject("item")),Ingress3Receipt.captureId(source.id,bmanifest.getJSONObject("item")))
        fun runUpload(config:CollectorConfig) {
            val request=OneTimeWorkRequestBuilder<SourceUploadWorker>().setInputData(workDataOf("manual" to true,"syncStamp" to SyncSchedule.stamp(config))).build()
            WorkManager.getInstance(app).enqueue(request).result.get();waitFor {WorkManager.getInstance(app).getWorkInfoById(request.id).get()!!.state.isFinished}
            assertEquals(WorkInfo.State.SUCCEEDED,WorkManager.getInstance(app).getWorkInfoById(request.id).get()!!.state)
        }
        runUpload(a);assertEquals(1,app.fileArchives().pendingCount(source.id))
        runUpload(settings.read());assertEquals(0,app.fileArchives().pendingCount(source.id))
        val id=Ingress3Receipt.captureId(source.id,bmanifest.getJSONObject("item"));assertEquals(200,get(app,"b","/api/captures/$id").first);assertEquals(404,get(app,"a","/api/captures/$id").first)
        assertEquals("Synthetic B source context",get(app,"b","/api/sources/${source.id}/context").second!!.getString("description"))
        login(app,"a");assertEquals(aDirectory,app.accountDirectory().absolutePath);assertArrayEquals(bytes,app.fileArchives().part(source.id,0))
        runUpload(settings.read());assertEquals(0,app.fileArchives().pendingCount(source.id));assertEquals(200,get(app,"a","/api/captures/$id").first)
        assertEquals("Synthetic A source context",get(app,"a","/api/sources/${source.id}/context").second!!.getString("description"))
        app.localSources().save(source.copy(syncContinuously=true))
        val scan=OneTimeWorkRequestBuilder<SourceScanWorker>().setInputData(workDataOf("manual" to true,"owner" to settings.read().ownerKey(),"sourceId" to source.id)).build()
        WorkManager.getInstance(app).enqueue(scan).result.get();waitFor {WorkManager.getInstance(app).getWorkInfoById(scan.id).get()!!.state.isFinished}
        assertEquals("permission",app.localSources().state(source.id).optString("status"));assertEquals(0,app.fileArchives().pendingCount(source.id))
        } finally {watchdog.interrupt()}
    }

    @Test fun anonymousFileTaskDraftRequiresExplicitBindingWithAnEmptyQueue() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false))
        val directory=app.accountDirectory();val file=File(directory,"file-task-${SourceRules.hash("FILE")}.enc")
        val bytes=app.localContentCipher().seal(JSONObject().put("values",JSONObject().put("description","Synthetic anonymous source draft")).put("preset","custom").put("retentionEdited",false).toString().toByteArray())
        file.writeBytes(bytes);assertEquals(0,app.queue().depth())
        assertEquals("local_confirmation",assertThrows(ConnectionFailure::class.java) {login(app,"a")}.category)
        assertNull(settings.read().account());assertArrayEquals(bytes,file.readBytes())
        RuntimeSettings.replaceAccount(app,bindLocal=true) {settings.signIn(endpoint(),token("a"),2592000000)}
        assertEquals(directory.absolutePath,app.accountDirectory().absolutePath);assertArrayEquals(bytes,file.readBytes())
    }
    @Test fun anonymousSourceConfigurationRequiresExplicitBindingBeforeAnyCapture() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false))
        val source=LocalSource(name="Synthetic anonymous selection",kind="local-files",uri="content://dev.synthetic.generated/document",syncContinuously=false)
        app.localSources().save(source);assertEquals(0,app.queue().depth());assertEquals(0,app.localSources().pendingSync().count)
        val directory=app.accountDirectory().absolutePath
        assertEquals("local_confirmation",assertThrows(ConnectionFailure::class.java) {login(app,"a")}.category)
        assertNull(settings.read().account());assertEquals(source.id,app.localSources().sources().single().id)
        RuntimeSettings.replaceAccount(app,bindLocal=true) {settings.signIn(endpoint(),token("a"),2592000000)}
        assertEquals(directory,app.accountDirectory().absolutePath);assertEquals(source.uri,app.localSources().sources().single().uri)
    }

    @Test fun plainAnonymousDraftRequiresConfirmationAndExplicitlyAdoptsWithoutChangingBytes() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false))
        val store=QuickNotes.draft(app);store.update("Synthetic plain anonymous draft","");assertEquals(0,app.queue().depth())
        val path=app.accountDirectory().absolutePath
        val rejected=assertThrows(ConnectionFailure::class.java) { login(app,"a") }
        assertEquals("local_confirmation",rejected.category);assertNull(settings.read().account());assertEquals("Synthetic plain anonymous draft",QuickNotes.draft(app).read().text)
        RuntimeSettings.replaceAccount(app,bindLocal=true) { settings.signIn(endpoint(),token("a"),2592000000) }
        assertNotNull(settings.read().account());assertEquals(path,app.accountDirectory().absolutePath)
        assertEquals("Synthetic plain anonymous draft",QuickNotes.draft(app).read().text);assertEquals(0,app.queue().depth())
    }

    @Test fun localInventoryDoesNotRetainPreviousOwnerCounts() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app)
        val settings=Settings(app);settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false))
        login(app,"a");QuickNotes.save(app,"Synthetic private inventory A","")
        val repository=LocalStateRepository.get(app)
        waitFor { repository.state.value.active?.records==1 }
        val observed=repository.state.value.checkedAt
        login(app,"b");assertEquals(0,app.queue().depth())
        waitFor { repository.state.value.checkedAt>observed && repository.state.value.error==null }
        assertEquals(0,repository.state.value.active!!.records)
    }

    @Test fun offlineAThenBPreparesDurableProcessDeathCheckpoint() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };cancel(app);val settings=Settings(app)
        settings.save(settings.read().copy(server="",token="",debugHttp=true,wifiOnly=false,syncMode="manual",metadataEnabled=false,uploadedRetentionDays=7))
        login(app,"a");val a=settings.read();val originalQueue=app.queue();val adir=QueueStorage(app).current().path
        assertEquals(0,originalQueue.depth());val aid=QuickNotes.save(app,"Synthetic A offline before switch","")
        QuickNotes.draft(app).update("Synthetic A private draft","")
        settings.enabled=true
        login(app,"b");val aqueue=DurableQueue(File(adir),app.localContentCipher()).apply { archiveOrigin=a.ownerKey() };assertThrows(IllegalStateException::class.java) { originalQueue.peek() };assertFalse(settings.enabled);assertNotEquals(a.ownerKey(),settings.read().ownerKey());assertEquals(0,app.queue().depth());assertEquals("",QuickNotes.draft(app).read().text)
        val bid=QuickNotes.save(app,"Synthetic B explicit new note","")
        val request=OneTimeWorkRequestBuilder<UploadWorker>().setInputData(workDataOf("manual" to true,"syncStamp" to SyncSchedule.stamp(a))).build()
        WorkManager.getInstance(app).enqueue(request).result.get();waitFor { WorkManager.getInstance(app).getWorkInfoById(request.id).get()!!.state.isFinished }
        assertEquals(1,app.queue().pendingSync().count);assertEquals(1,aqueue.pendingSync().count)
        assertEquals(404,get(app,"b","/api/captures/$aid").first)
        app.getSharedPreferences("m15-test",0).edit().putString("aid",aid).putString("bid",bid).putString("adir",adir).putString("aowner",a.ownerKey()).putString("bowner",settings.read().ownerKey()).commit()
        UploadWorker.schedule(app,settings.read(),true)
        waitFor { app.queue().pendingSync().count==0 }
        assertEquals(200,get(app,"b","/api/captures/$bid").first);assertEquals(404,get(app,"a","/api/captures/$aid").first)
        assertEquals(1,aqueue.pendingSync().count)
    }

    @Test fun restartAfterActualProcessDeathRestoresOnlyBThenExplicitAResumesOriginalBytes() {
        val app=context();waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null };val settings=Settings(app);val prefs=app.getSharedPreferences("m15-test",0)
        val aid=prefs.getString("aid",null)!!;val bid=prefs.getString("bid",null)!!
        assertEquals(prefs.getString("bowner",null),settings.read().ownerKey());assertFalse(settings.enabled)
        assertEquals(0,app.queue().pendingSync().count);assertEquals(404,get(app,"b","/api/captures/$aid").first)
        assertEquals(200,get(app,"b","/api/captures/$bid").first)
        login(app,"a");assertEquals(prefs.getString("aowner",null),settings.read().ownerKey());assertEquals(prefs.getString("adir",null),QueueStorage(app).current().path)
        assertEquals("Synthetic A private draft",QuickNotes.draft(app).read().text)
        assertEquals("Synthetic A offline before switch",app.queue().peek()!!.getString("ocrText"));assertEquals(aid,app.queue().peek()!!.getString("id"))
        UploadWorker.schedule(app,settings.read(),true);waitFor {app.queue().pendingSync().count==0}
        val received=get(app,"a","/api/captures/$aid");assertEquals(200,received.first);assertEquals("Synthetic A offline before switch",received.second!!.getString("ocrText"))
        assertEquals(404,get(app,"b","/api/captures/$aid").first)
    }
}
