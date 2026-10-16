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
        val monitor=instrumentation.addMonitor(android.content.IntentFilter(android.content.Intent.ACTION_CREATE_DOCUMENT),android.app.Instrumentation.ActivityResult(android.app.Activity.RESULT_OK,android.content.Intent().setData(android.net.Uri.fromFile(output))),true)
        fun views(root:android.view.View):List<android.view.View> = listOf(root) + if(root is android.view.ViewGroup)(0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
        try {
            androidx.test.core.app.ActivityScenario.launch<CentralActivity>(android.content.Intent(app,CentralActivity::class.java).putExtra("page","vault")).use { scenario ->
                fun button(label:String):android.widget.Button? {var result:android.widget.Button?=null;scenario.onActivity {activity->result=views(activity.window.decorView).filterIsInstance<android.widget.Button>().firstOrNull {it.text.toString()==label&&it.isEnabled}};return result}
                fun click(label:String) {waitFor {button(label)!=null};val target=button(label)!!;instrumentation.runOnMainSync {target.performClick()}}
                waitFor {var ready=false;scenario.onActivity {ready=it.client!=null&&!it.isWorking};ready}
                click("中央资料与附件导出")
                waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready}
                waitFor {if(button("下载")!=null)true else {val refresh=button("刷新");if(refresh!=null)instrumentation.runOnMainSync {refresh.performClick()};false}}
                val oldDownload=button("下载")!!;click("下载")
                waitFor {output.isFile&&output.length()>0};waitFor {var ready=false;scenario.onActivity {ready=!it.isWorking};ready}
                val bytes=output.readBytes();val archive=JSONObject(String(bytes,Charsets.UTF_8));assertEquals(settings.read().account()!!.userId,archive.getString("userId"));assertEquals(3,archive.getInt("version"))
                assertEquals(1,monitor.hits);assertFalse(String(bytes,Charsets.UTF_8).contains(token("a")))
                val page=CentralPortable(CentralAccess.requireClient(app)).list();val id=page.getJSONArray("items").getJSONObject(0).getString("id")
                assertEquals(Ingress3Client.hash(bytes),CentralPortable(CentralAccess.requireClient(app)).read(id).getString("sha256"))
                val sentinel="Generated existing document must survive a retired export"
                output.writeText(sentinel)
                CentralPortable(CentralAccess.requireClient(app)).control(id,"cancel")
                click("下载")
                waitFor {var ready=false;scenario.onActivity {activity->ready=!activity.isWorking&&views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.tag=="central-status"&&it.text.isNotBlank()}};ready}
                assertEquals(2,monitor.hits);assertEquals(sentinel,output.readText())
                login(app,"b");scenario.onActivity {it.navigate("vault")};waitFor {var ready=false;scenario.onActivity {ready=it.client!=null&&!it.isWorking};ready}
                scenario.onActivity {activity->oldDownload.performClick();assertFalse(views(activity.window.decorView).filterIsInstance<android.widget.TextView>().any {it.text.toString().contains(id)})}
                assertEquals(2,monitor.hits);assertEquals(sentinel,output.readText());assertEquals(0,CentralPortable(CentralAccess.requireClient(app)).list().getJSONArray("items").length())
            }
        } finally {instrumentation.removeMonitor(monitor);output.delete()}
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
