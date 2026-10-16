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
