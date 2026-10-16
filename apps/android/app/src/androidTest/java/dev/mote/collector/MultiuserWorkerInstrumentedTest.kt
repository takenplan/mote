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
