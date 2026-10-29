package dev.mote.collector

import android.app.Activity
import android.app.Instrumentation
import android.content.Intent
import android.net.Uri
import android.provider.CalendarContract
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.Spinner
import androidx.core.content.FileProvider
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Build
import android.os.SystemClock
import android.system.Os
import android.view.View
import android.view.ViewGroup
import android.view.inspector.WindowInspector
import android.widget.CheckBox
import android.widget.EditText
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.WorkManager
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.InetAddress
import java.net.ServerSocket
import java.time.Instant
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

/** Explicit, generated-only gaps. Keeps final collector, originals, private configs and calendar untouched. */
@RunWith(AndroidJUnit4::class)
class FinalSelectedRiskInstrumentedTest {
    private val instrumentation get()=InstrumentationRegistry.getInstrumentation()
    private val context get()=instrumentation.targetContext
    private fun <T> main(block:()->T):T { val r=AtomicReference<Result<T>>();instrumentation.runOnMainSync{r.set(runCatching(block))};return r.get().getOrThrow() }
    private fun views(v:View):List<View> = listOf(v)+if(v is ViewGroup)(0 until v.childCount).flatMap{views(v.getChildAt(it))}else emptyList()
    private fun shown()=WindowInspector.getGlobalWindowViews().filter{it.isShown&&it.hasWindowFocus()}.flatMap(::views).filter{it.isShown}
    private fun until(label:String,check:()->Boolean){val end=SystemClock.elapsedRealtime()+30_000;while(SystemClock.elapsedRealtime()<end){if(check())return;Thread.sleep(50)};fail(label)}
    private fun has(text:String)=main{shown().filterIsInstance<TextView>().any{it.text.toString().contains(text)}}
    private fun click(label:String){until("Action $label"){main{shown().filterIsInstance<TextView>().any{it.isClickable&&it.isEnabled&&(it.text.toString()==label||it.contentDescription==label)}}};main{shown().filterIsInstance<TextView>().first{it.isClickable&&it.isEnabled&&(it.text.toString()==label||it.contentDescription==label)}.also{it.requestRectangleOnScreen(android.graphics.Rect(0,0,it.width,it.height),true)}.performClick()}}
    private fun chooseNativeListItem(label:String){
        until("Native dialog row $label"){main{shown().filterIsInstance<TextView>().any{it.text.toString()==label}}}
        main{val text=shown().filterIsInstance<TextView>().single{it.text.toString()==label};var row:View=text;while(row.parent is View&&row.parent !is android.widget.AdapterView<*>)row=row.parent as View;val list=row.parent as android.widget.AdapterView<*>;val position=list.getPositionForView(row);assertTrue(position>=0);assertTrue(list.performItemClick(row,position,list.adapter.getItemId(position)))}
    }
    private fun picture(name:String){instrumentation.waitForIdleSync();until("Focused native window before $name"){main{WindowInspector.getGlobalWindowViews().any{it.isShown&&it.hasWindowFocus()&&it.width>0&&it.height>0}}};val frames=java.util.concurrent.CountDownLatch(1);main{WindowInspector.getGlobalWindowViews().last{it.isShown&&it.hasWindowFocus()}.postOnAnimation{frames.countDown()}};assertTrue(frames.await(5,java.util.concurrent.TimeUnit.SECONDS));main{val root=WindowInspector.getGlobalWindowViews().last{it.isShown&&it.hasWindowFocus()};val image=Bitmap.createBitmap(root.width,root.height,Bitmap.Config.ARGB_8888);try{root.draw(android.graphics.Canvas(image));File(context.filesDir,"final-selected-risk").apply{mkdirs()}.resolve("$name.png").outputStream().use{image.compress(Bitmap.CompressFormat.PNG,100,it)}}finally{image.recycle()}}}
    private fun png():ByteArray {val b=Bitmap.createBitmap(80,60,Bitmap.Config.ARGB_8888).apply{eraseColor(Color.LTGRAY)};return try{ByteArrayOutputStream().also{b.compress(Bitmap.CompressFormat.PNG,100,it)}.toByteArray()}finally{b.recycle()}}
    private fun fixture(block:()->Unit){
        assumeTrue(InstrumentationRegistry.getArguments().getString("nativeFinalSelectedRisk")=="true")
        require(context.packageName=="dev.mote.collector.dev"&&Build.FINGERPRINT.contains("emu64a"))
        val settings=Settings(context);val before=settings.read();val device=settings.deviceId;require(!settings.enabled&&!CaptureAccessibilityService.connected&&!ProjectionService.running&&before.syncMode=="manual"&&before.syncPaused)
        val language=MoteI18n.preference();val appearance=MoteAppearance.preference();val ids=context.queue().dedupeIds().toSet();val originals=ids.associateWith{context.queue().capture(it)!!.toString()}
        val privateFiles=listOf(File(context.filesDir,"final-central-journey.json"),File(context.filesDir,"final-calendar-journey.json"),File(context.noBackupFilesDir,"final-calendar-journey-state.json"));val privateBytes=privateFiles.associateWith{if(it.exists())it.readBytes()else null}
        try{MoteI18n.select(context,"zh-CN");main{MoteAppearance.select(context,AppearancePreference.LIGHT)};until("Idle existing configuration"){!ConnectionGuard.changing()&&!QueueStorage.recovering};block()}
        finally{CentralDraftWrites.barrier{};until("Test operation released configuration"){!ConnectionGuard.changing()};settings.save(before,confirmCentralEndpoint=true);CentralSession.get(context).select(before.server);MoteI18n.select(context,language);main{MoteAppearance.select(context,appearance)};assertEquals(before,settings.read());assertEquals(device,settings.deviceId);assertFalse(settings.enabled);assertEquals(ids,context.queue().dedupeIds().toSet());originals.forEach{(id,value)->assertEquals("Existing original unchanged",value,context.queue().capture(id)!!.toString())};privateBytes.forEach{(file,value)->if(value==null)assertFalse(file.exists())else assertArrayEquals(value,file.readBytes())}}
    }
    @Test fun expiredInvitationAndActualTransportFailureRetainInputAndReviewName()=fixture{
        val before=Settings(context).read();val pending=File(context.noBackupFilesDir,"connection-pending.enc");require(!pending.exists())
        HttpFixture().use{http->ActivityScenario.launch(ConnectionActivity::class.java).use{scenario->
            until("Invitation entry"){has("把记录接到一起")}
            fun invitation(expiry:Instant)=JSONObject().put("format","mote.connection").put("version",1).put("serverUrl",http.origin).put("code","B".repeat(43)).put("expiresAt",expiry.toString()).toString()
            val expired=invitation(Instant.ofEpochMilli(System.currentTimeMillis()-60_000));main{shown().filterIsInstance<EditText>().single().setText(expired)};click("核对连接")
            until("Expired invitation is readable"){has(ConnectionActivity.message("expired"))};assertEquals(0,http.redeems.get());picture("connection-expired-retains-input")
            scenario.recreate();until("Expired input retained on recreation"){main{shown().filterIsInstance<EditText>().singleOrNull()?.text.toString()==expired}};assertEquals(before,Settings(context).read())
            val valid=invitation(Instant.ofEpochMilli(System.currentTimeMillis()+600_000));main{shown().filterIsInstance<EditText>().single().setText(valid)};click("核对连接");until("Actual review"){has("这是你的 Mote 吗？")}
            val name="Generated retained connection review";main{shown().filterIsInstance<EditText>().single().setText(name)};click("确认连接")
            until("Actual HTTP EOF returns readable transport failure"){has(ConnectionActivity.message("network"))};assertEquals(1,http.redeems.get());assertEquals(before,Settings(context).read());assertFalse(pending.exists());picture("connection-transport-failure-retains-name")
            scenario.recreate();until("Review name survives actual failed attempt and recreation"){main{shown().filterIsInstance<EditText>().singleOrNull()?.text.toString()==name}};click("返回上一页")
            until("Back returns the same invitation"){main{shown().filterIsInstance<EditText>().singleOrNull()?.text.toString()==valid}};picture("connection-failure-back-retains-invitation");click("核对连接");until("Review name retained after Back"){main{shown().filterIsInstance<EditText>().singleOrNull()?.text.toString()==name}};assertEquals(1,http.redeems.get())
        }}
    }
    @Test fun conversationDeleteCancelAndHttpFailureKeepLaterDraftAndAttachment()=fixture{
        HttpFixture().use{http->
            val settings=Settings(context);ConnectionGuard.change(context,http.origin,bindLocal=true){settings.saveConnection(http.origin,http.token,"Generated isolated deletion failure",true);settings.save(settings.read().copy(syncMode="manual",syncPaused=true),confirmCentralEndpoint=true)}
            val dir=File(context.noBackupFilesDir,"central-native/"+SourceRules.hash(http.origin));val store=CentralStateFile(dir,"ask",context.secretBox());val attachment=JSONObject().put("id",UUID.randomUUID().toString()).put("name","generated-retained-image.png").put("mimeType","image/png");val draft="Generated later draft retained across delete failure"
            store.write(JSONObject().put("conversationId",http.conversation).put("question",draft).put("attachments",JSONArray().put(attachment)))
            try{ActivityScenario.launch<CentralActivity>(Intent(context,CentralActivity::class.java).putExtra("page","ask").putExtra("conversationId",http.conversation)).use{scenario->
                until("Own controlled conversation selected"){var yes=false;scenario.onActivity{yes=!it.isWorking&&it.selectedAskConversationId==http.conversation};yes};assertTrue(has("generated-retained-image.png"))
                fun checkDraft(){CentralDraftWrites.barrier{val s=store.read();assertEquals(http.conversation,s.getString("conversationId"));assertEquals(draft,s.getString("question"));assertEquals(JSONArray().put(attachment).toString(),s.getJSONArray("attachments").toString())}}
                click("对话更多");chooseNativeListItem("删除这段对话");until("Destructive confirmation"){has("删除整段对话？")};picture("conversation-delete-confirm");click("取消");checkDraft();assertEquals(0,http.deletes.get());picture("conversation-delete-cancel-retains-draft")
                click("对话更多");chooseNativeListItem("删除这段对话");click("删除对话");until("Controlled real HTTP503 delete completed"){var idle=false;scenario.onActivity{idle=!it.isWorking};http.deletes.get()==1&&idle&&has("未能确认删除完成。请刷新查看当前状态。")};checkDraft();assertFalse(has("generated_delete_unavailable"));picture("conversation-delete-http503-keeps-context");click("对话更多");chooseNativeListItem("查看详情");until("Full delete diagnostic remains explicitly readable"){has("generated_delete_unavailable")&&has("503")};picture("conversation-delete-http503-explicit-details");click("关闭")
                scenario.recreate();until("Failure recreation retains same conversation and attachment"){var yes=false;scenario.onActivity{yes=!it.isWorking&&it.selectedAskConversationId==http.conversation};yes&&has("generated-retained-image.png")};checkDraft();click("对话更多");chooseNativeListItem("查看详情");until("Same conversation diagnostics survive recreation"){has("generated_delete_unavailable")};click("关闭");assertEquals(0,http.queryPosts.get());assertEquals(1,http.deletes.get())
                click("对话更多");chooseNativeListItem("删除这段对话");until("Old owner confirmation exists"){has("删除整段对话？")}
                main{val stale=shown().filterIsInstance<TextView>().single{it.text.toString()=="删除对话"};Settings(context).signIn(http.origin,"generated-new-owner-revocation-token",86400000);stale.performClick()}
                instrumentation.waitForIdleSync();assertEquals("Old owner confirmation cannot issue a second DELETE",1,http.deletes.get());assertEquals(0,http.queryPosts.get())
            }}finally{CentralDraftWrites.barrier{};dir.deleteRecursively()}
        }
    }
    @Test fun disablingComparisonDiagnosticsThroughSaveErasesOnlyGeneratedSamples()=fixture{
        val settings=Settings(context);val before=settings.read();require(!before.imageDedupeDiagnosticsEnabled);val folder=File(context.noBackupFilesDir,"image-dedupe-diagnostics");require(folder.listFiles().orEmpty().isEmpty());val store=context.imageDedupeDiagnostics()
        settings.save(before.copy(imageDedupeDiagnosticsEnabled=true));val pixels=png();val features=BulkDedupeRules.features(pixels,ScreenshotDedupeHelper.Mode.EXACT);val metadata=ImageDedupeDiagnosticsDetails.metadata(ScreenshotDedupeHelper.Mode.EXACT,ScreenshotDedupeHelper.compareFeatures(features,features,ScreenshotDedupeHelper.Mode.EXACT),UUID.randomUUID().toString(),Instant.now().minusSeconds(2).toString(),UUID.randomUUID().toString(),Instant.now().toString(),"generated.final.cleanup",80,60,80,60)
        val id=requireNotNull(store.record(metadata,pixels,pixels));val file=File(folder,"$id.enc");assertTrue(file.isFile)
        try{ActivityScenario.launch<MainActivity>(Intent(context,MainActivity::class.java).putExtra("page","PROCESSING")).awaitMainUi().use{
            until("Existing diagnostic switch is on"){main{shown().filterIsInstance<CheckBox>().any{it.text.toString()=="临时保留图片去重对比记录"&&it.isChecked}}};picture("diagnostic-existing-sample-before-off")
            main{shown().filterIsInstance<CheckBox>().single{it.text.toString()=="临时保留图片去重对比记录"}.isChecked=false};assertTrue("Draft switch alone cannot erase",file.isFile);assertTrue(settings.read().imageDedupeDiagnosticsEnabled);click("保存设置")
            // Inspect files directly: calling store.list() while disabled would itself clear and mask a missing save effect.
            until("Actual saved off transition erased the existing encrypted sample"){!settings.read().imageDedupeDiagnosticsEnabled&&!file.exists()&&folder.listFiles().orEmpty().isEmpty()&&!ConnectionGuard.changing()};picture("diagnostic-off-save-cleared-samples")
            assertEquals(before,settings.read());assertEquals(0,store.list().size)
        }}finally{store.clear();ImageDedupeDiagnosticsMaintenance.configure(context,false)}
    }
    @Test fun generatedBulkDeleteSucceedsAndRealUnreadableRecordIsReportedRetained()=fixture{
        val queue=context.queue();val store=BulkDedupeStore(context);val report=store.read("report");val plan=store.read("plan");val manager=WorkManager.getInstance(context);require(manager.getWorkInfosForUniqueWork(BulkDedupeWorker.NAME).get().all{it.state.isFinished});val ids=List(3){UUID.randomUUID().toString()};val folder=File(QueueStorage(context).current().path);var blocked:File?=null;var blockedMode=384
        Settings(context).save(Settings(context).read().copy(imageDedupeMode="exact"))
        fun enqueue(id:String,second:Boolean){queue.enqueue(JSONObject().put("id",id).put("source","screen").put("capturedAt",if(second)"2026-10-30T00:00:01Z"else"2026-10-30T00:00:00Z").put("appId","generated.final.bulk").put("appName","Generated final bulk").put("privacy",JSONObject().put("excluded",false)).put("ocr",JSONObject().put("status","disabled")),png(),64L*1024*1024)}
        fun finish(message:String){until(message){manager.getWorkInfosForUniqueWork(BulkDedupeWorker.NAME).get().all{it.state.isFinished}&&has(message)}}
        try{enqueue(ids[0],false);enqueue(ids[1],true)
            ActivityScenario.launch(BulkDedupeActivity::class.java).use{
                until("Scan action"){has("扫描本机图片")};click("扫描本机图片");until("Actual generated candidate scan"){store.read("report").optBoolean("complete")&&has("候选 1 张")};val pair=store.read("report").getJSONArray("pairs");assertEquals(1,pair.length());assertEquals(ids[1],pair.getJSONObject(0).getJSONObject("candidate").getString("id"));assertEquals(ids[0],pair.getJSONObject(0).getJSONObject("reference").getString("id"))
                main{shown().filterIsInstance<CheckBox>().single().isChecked=true};click("删除候选副本");click("确认");finish("处理完成：成功 1，失效或失败 0");assertNull(queue.capture(ids[1]));assertNotNull(queue.capture(ids[0]));assertArrayEquals(png(),queue.image(ids[0]));picture("bulk-permanent-delete-success-reference-retained")
                enqueue(ids[2],true);click("扫描本机图片");until("Rebuilt real candidate"){has("候选 1 张")&&store.read("report").getJSONArray("pairs").length()==1&&manager.getWorkInfosForUniqueWork(BulkDedupeWorker.NAME).get().all{it.state.isFinished}}
                main{shown().filterIsInstance<CheckBox>().single().isChecked=true};click("删除候选副本");until("Confirmation before actual IO failure"){has("确认永久删除本机记录及图片？")}
                blocked=File(folder,ids[2]+".event");blockedMode=Os.stat(blocked!!.path).st_mode and 511;Os.chmod(blocked!!.path,0);click("确认");finish("处理完成：成功 0，失效或失败 1");assertTrue(blocked!!.isFile);picture("bulk-real-io-failure-keeps-record")
                Os.chmod(blocked!!.path,blockedMode);blocked=null;assertNotNull(queue.capture(ids[2]));assertNotNull(queue.capture(ids[0]));assertArrayEquals(png(),queue.image(ids[0]));assertArrayEquals(png(),queue.image(ids[2]))
            }
        }finally{blocked?.let{Os.chmod(it.path,blockedMode)};manager.cancelUniqueWork(BulkDedupeWorker.NAME).result.get();until("Generated worker stopped"){manager.getWorkInfosForUniqueWork(BulkDedupeWorker.NAME).get().all{it.state.isFinished}};ids.forEach{id->queue.dedupeRow(id)?.let{queue.resolveDedupe(id,it.getString("blob"),null,null,null)}};store.write("report",report);store.write("plan",plan)}
    }

    /** The browser is real; only the external URL at the Intent boundary is redirected to generated loopback HTML. */
    @Test fun actualInstallDocumentViewReturnsToTheUnsentEditorDraft()=fixture{
        val store=context.recordDraftStore();require(!store.hasPrepared());val previous=store.draft()
        val text="Generated installation-return draft ${UUID.randomUUID()}";val description="Generated separate explanation retained across the browser"
        val originalUrl="https://github.com/utopiafar/mote/blob/main/docs/agent-install.md"
        HttpFixture().use{http->
            val seen=AtomicReference<String>();val monitor=object:Instrumentation.ActivityMonitor(){override fun onStartActivity(intent:Intent):Instrumentation.ActivityResult?{
                if(intent.action==Intent.ACTION_VIEW&&intent.dataString==originalUrl){seen.set(intent.dataString);intent.data=Uri.parse(http.origin+"/generated-install-help")};return null
            }}
            instrumentation.addMonitor(monitor)
            try{ActivityScenario.launch(RecordEditorActivity::class.java).use{scenario->
                until("Editor ready"){main{shown().filterIsInstance<EditText>().any{it.contentDescription=="正在想什么"&&it.isEnabled}}}
                main{shown().filterIsInstance<EditText>().single{it.contentDescription=="正在想什么"}.setText(text)};click("资料说明（选填）");main{(shown().single{it.tag=="record-description"}as EditText).setText(description)}
                until("Actual draft persisted"){store.draft().optString("text")==text&&store.draft().optString("description")==description}
                scenario.onActivity{it.startActivity(Intent(it,StartUsingActivity::class.java))};until("Install help"){has("查看安装文档")};picture("install-document-before-browser");click("查看安装文档")
                until("Real browser loaded only generated loopback page"){
                    val nodes=systemNodes();nodes.firstOrNull{it.packageName?.toString()=="com.android.chrome"&&it.text?.toString()in setOf("Stay signed out","No thanks")}?.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                    seen.get()==originalUrl&&http.helpReads.get()>0&&nodes.any{it.packageName?.toString()=="com.android.chrome"&&it.text?.toString()?.contains("Generated Mote installation help boundary")==true}
                }
                assertEquals(originalUrl,seen.get());assertTrue(systemNodes().any{it.text?.toString()?.contains(http.origin.removePrefix("http://"))==true});systemPicture("install-document-actual-browser")
                assertTrue(instrumentation.uiAutomation.performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK));until("Returned to exact help screen"){has("查看安装文档")};click("返回上一页")
                until("Same editor and full unsent draft returned"){main{shown().filterIsInstance<EditText>().any{it.contentDescription=="正在想什么"&&it.text.toString()==text}}};assertEquals(text,store.draft().getString("text"));assertEquals(description,store.draft().getString("description"));picture("install-document-back-same-editor-draft")
            }}finally{instrumentation.removeMonitor(monitor);store.edit(previous.getString("text"),previous.getJSONArray("attachments"),previous.getJSONObject("origin"),previous.optString("description"))}
        }
    }
    private fun systemNodes():List<AccessibilityNodeInfo>{fun children(node:AccessibilityNodeInfo?):List<AccessibilityNodeInfo> = if(node==null)emptyList()else listOf(node)+(0 until node.childCount).flatMap{children(node.getChild(it))}
        return children(instrumentation.uiAutomation.rootInActiveWindow)}
    private fun systemPicture(name:String){SystemClock.sleep(500);instrumentation.uiAutomation.waitForIdle(100,3000);val image=requireNotNull(instrumentation.uiAutomation.takeScreenshot());try{File(context.filesDir,"final-selected-risk").apply{mkdirs()}.resolve("$name.png").outputStream().use{image.compress(Bitmap.CompressFormat.PNG,100,it)}}finally{image.recycle()}}

    @Test fun physicallyMissingLocalOriginalCannotBeReadOrResurrectedByExplicitRecovery()=fixture{
        require(context.localSources().sources().none{it.enabled})
        val id=UUID.randomUUID().toString();lateinit var queue:DurableQueue;val dir=File(QueueStorage(context).current().path);val eventFile=File(dir,"$id.event");val held=File(context.cacheDir,"generated-missing-$id.event")
        val recovery=context.getSharedPreferences("sync-recovery",0);val oldRecovery=recovery.all.toMap();val manager=WorkManager.getInstance(context)
        require(manager.getWorkInfosForUniqueWork("mote-sync-recovery").get().all{it.state.isFinished})
        HttpFixture().use{http->
            val settings=Settings(context);ConnectionGuard.change(context,http.origin,bindLocal=true){settings.saveConnection(http.origin,http.token,"Generated isolated missing-local recovery",true);settings.save(settings.read().copy(syncMode="manual",syncPaused=false,wifiOnly=false,syncChargingOnly=false,syncBatteryNotLow=false),confirmCentralEndpoint=true)}
            queue=context.queue()
            try{
                val body=JSONObject().put("id",id).put("deviceId",settings.deviceId).put("source","note").put("capturedAt",Instant.now().toString()).put("durationMs",0).put("ocrText","Generated local original physically removed before recovery").put("privacy",JSONObject().put("excluded",false))
                queue.enqueue(body,null,64L*1024*1024);val version=CaptureUploadVersion.of(requireNotNull(queue.archiveRecord(id)).first);assertNotNull(queue.capture(id));check(eventFile.renameTo(held));assertTrue(held.isFile);assertNull(queue.capture(id));assertFalse(eventFile.exists())
                ActivityScenario.launch<CaptureRecordsActivity>(Intent(context,CaptureRecordsActivity::class.java).putExtra("recordId",id).putExtra("historyOriginalVersion",version)).use{
                    until("Exact history reader reports local original unavailable"){has("历史版本不可用：本机原件已更新或清理")};assertFalse(has("中央不可用 / 已删除"));picture("recovery-missing-local-exact-reader")
                }
                assertTrue("Isolated origin must have no retained local originals",queue.syncIds().isEmpty())
                ActivityScenario.launch(SyncRecoveryActivity::class.java).use{
                    until("Recovery entry"){has("补传本机保留的记录")};main{shown().single{it.tag=="recovery-replay"}.performClick()};until("Explicit warning distinguishes cleaned local data"){has("已从手机清理的数据无法补传")};picture("recovery-missing-local-explicit-scope");click("开始补传")
                    until("Production recovery finishes with zero existing originals"){recovery.getString("message","")!!.startsWith("已安排补传 0 条本机采集记录及 0 个保留来源版本")&&manager.getWorkInfosForUniqueWork("mote-sync-recovery").get().all{it.state.isFinished}}
                    until("Actual zero replay result renders"){has("已安排补传 0 条本机采集记录")};assertFalse(eventFile.exists());assertNull(queue.capture(id));assertEquals(0,http.capturePosts.get());picture("recovery-missing-local-zero-not-restored")
                }
            }finally{
                manager.cancelUniqueWork("mote-sync-recovery").result.get();manager.cancelUniqueWork("mote-upload").result.get();until("Selected recovery/upload stopped"){listOf("mote-sync-recovery","mote-upload").all{name->manager.getWorkInfosForUniqueWork(name).get().all{it.state.isFinished}}}
                if(held.exists()){check(held.renameTo(eventFile));queue.resolveDedupe(id,"",null,null,null)}
                val edit=recovery.edit().clear();oldRecovery.forEach{(key,value)->when(value){is String->edit.putString(key,value);is Int->edit.putInt(key,value);is Long->edit.putLong(key,value);is Boolean->edit.putBoolean(key,value);else->error("Unsupported recovery preference")}};edit.commit()
            }
        }
    }

    @Test fun existingLocalCalendarRangeBoundariesAndAllNewSaveAndCancelNeverChangeProvider()=fixture{
        val resolver=context.contentResolver;fun rows(uri:Uri,projection:Array<String>,selection:String):String=resolver.query(uri,projection,selection,null,"_id")!!.use{c->JSONArray().apply{while(c.moveToNext())put(JSONArray().apply{for(i in projection.indices)put(if(c.isNull(i))JSONObject.NULL else c.getString(i))})}.toString()}
        val calendarBefore=rows(CalendarContract.Calendars.CONTENT_URI,arrayOf("_id","account_name","account_type","calendar_displayName"),"_id=1");require(JSONArray(calendarBefore).length()==1)
        val eventColumns=arrayOf("_id","calendar_id","title","description","dtstart","dtend","allDay","eventLocation","eventTimezone","deleted");val eventsBefore=rows(CalendarContract.Events.CONTENT_URI,eventColumns,"calendar_id=1")
        val store=context.localSources();val before=store.sources();require(before.none{it.enabled||it.calendarId==1L});var created:String?=null
        fun fields(values:Pair<String,String>){main{val edits=shown().filterIsInstance<EditText>();val form=edits.single{it.tag=="calendar-description"}.parent as ViewGroup;val children=(0 until form.childCount).map{form.getChildAt(it)};fun field(label:String):EditText { return children[children.indexOfFirst{it is TextView&&it.text.toString()==label}+1]as EditText }
            field("过去多少天（0–365）").setText(values.first);field("未来多少天（1–365）").setText(values.second)}}
        fun initial(position:Int){main{shown().filterIsInstance<Spinner>().single{it.adapter.count==2&&it.adapter.getItem(0).toString()=="已有内容分批导入（默认）"}.setSelection(position)}}
        try{
            ActivityScenario.launch<SourcesActivity>(Intent(context,SourcesActivity::class.java).putExtra("addCalendar",true)).use{
                until("Existing sole generated calendar picker"){main{shown().filterIsInstance<TextView>().any{it.text.toString().contains("Generated")}}};val label=resolver.query(CalendarContract.Calendars.CONTENT_URI,arrayOf(CalendarContract.Calendars.CALENDAR_DISPLAY_NAME),"_id=1",null,null)!!.use{c->check(c.moveToFirst());c.getString(0)};chooseNativeListItem(label)
                until("Existing calendar scope form"){main{shown().any{it.tag=="calendar-description"}}};main{shown().filterIsInstance<CheckBox>().single{it.text.toString()=="允许读取并按所选策略发送这个来源"}.isChecked=false};fields("0" to "1");initial(0);picture("calendar-existing-minimum-all-before-save");click("保存来源设置")
                until("Real minimum all save"){store.sources().any{it.calendarId==1L&&!it.enabled&&it.daysBefore==0&&it.daysAfter==1&&it.initialSync=="all"}};created=store.sources().single{it.calendarId==1L}.id
            }
            fun reopen(block:(ActivityScenario<SourcesActivity>)->Unit){ActivityScenario.launch<SourcesActivity>(Intent(context,SourcesActivity::class.java).putExtra("sourceId",created)).use{scenario->until("Actual saved calendar scope reopens"){main{shown().any{it.tag=="calendar-description"}}};block(scenario)}}
            val minimum=store.sources().single{it.id==created}
            reopen{
                for(invalid in listOf("366" to "1","0" to "0","0" to "366")){fields(invalid);initial(1);click("保存来源设置");instrumentation.waitForIdleSync();assertEquals("Each independently invalid boundary must not persist",minimum,store.sources().single{it.id==created});assertTrue(main{shown().any{it.tag=="calendar-description"}})}
                picture("calendar-invalid-range-not-saved");click("取消")
            }
            reopen{fields("365" to "365");initial(1);click("保存来源设置");until("Real maximum new-only saved"){store.sources().any{it.id==created&&!it.enabled&&it.daysBefore==365&&it.daysAfter==365&&it.initialSync=="new_only"}}}
            val maximum=store.sources().single{it.id==created};reopen{picture("calendar-existing-maximum-new-saved");fields("0" to "1");initial(0);click("取消");assertEquals(maximum,store.sources().single{it.id==created})}
            reopen{picture("calendar-cancel-keeps-maximum-new");click("取消")}
            assertEquals(calendarBefore,rows(CalendarContract.Calendars.CONTENT_URI,arrayOf("_id","account_name","account_type","calendar_displayName"),"_id=1"));assertEquals(eventsBefore,rows(CalendarContract.Events.CONTENT_URI,eventColumns,"calendar_id=1"))
        }finally{created?.let{store.remove(it)};assertEquals(before,store.sources());assertEquals(eventsBefore,rows(CalendarContract.Events.CONTENT_URI,eventColumns,"calendar_id=1"))}
    }

    @Test fun actualSupportExportExcludesPlantedBodyKnownTokenAndGeneratedImage()=fixture{
        val settings=Settings(context);val config=settings.read();val knownToken=config.connectionToken();require(knownToken.length>=32)
        val marker="generated-sensitive-body-${UUID.randomUUID()}";val imageMarker="generated-sensitive-image-${UUID.randomUUID()}";val image=Bitmap.createBitmap(600,80,Bitmap.Config.ARGB_8888).apply{eraseColor(Color.WHITE);android.graphics.Canvas(this).drawText(imageMarker,5f,40f,android.graphics.Paint().apply{color=Color.BLACK;textSize=20f})};val bytes=try{ByteArrayOutputStream().also{image.compress(Bitmap.CompressFormat.PNG,100,it)}.toByteArray()}finally{image.recycle()}
        val id=UUID.randomUUID().toString();val event=JSONObject().put("id",id).put("deviceId",settings.deviceId).put("source","note").put("capturedAt",Instant.now().toString()).put("durationMs",0).put("ocrText",marker+"\n"+knownToken).put("metadata",JSONObject().put("ownerDescription",imageMarker)).put("privacy",JSONObject().put("excluded",false))
        val directory=File(context.cacheDir,"record-camera/generated-support-$id").apply{mkdirs()};val output=File(directory,"safe-support.json")
        val monitor=object:Instrumentation.ActivityMonitor(){override fun onStartActivity(intent:Intent):Instrumentation.ActivityResult?=if(intent.action==Intent.ACTION_CREATE_DOCUMENT)Instrumentation.ActivityResult(Activity.RESULT_OK,Intent().setData(FileProvider.getUriForFile(context,"${context.packageName}.record-files",output)))else null}
        try{
            context.queue().enqueue(event,bytes,64L*1024*1024);assertTrue(context.queue().capture(id)!!.getString("ocrText").contains(marker));assertArrayEquals(bytes,context.queue().image(id))
            SupportEvents.failure(context,EventStage.SUPPORT,java.io.IOException(marker+" "+knownToken+" "+imageMarker));SupportEvents.record(context,EventStage.SUPPORT,EventCode.OK,errorName=knownToken,sourceId=marker)
            instrumentation.addMonitor(monitor)
            ActivityScenario.launch<MainActivity>(Intent(context,MainActivity::class.java).putExtra("page","DIAGNOSTICS")).awaitMainUi().use{
                click("导出安全支持包 JSON");until("Actual SAF provider output completed"){has("诊断包已导出")&&output.length()>0};val body=output.readText();val json=JSONObject(body);assertTrue(json.has("configuration")&&json.has("logs")&&json.has("events")&&json.has("samples"));assertFalse("Captured body excluded",body.contains(marker));assertFalse("Current generated token excluded",body.contains(knownToken));assertFalse("Independent explanation excluded",body.contains(imageMarker));assertFalse("Original image excluded",body.contains(java.util.Base64.getEncoder().encodeToString(bytes)));assertFalse(body.contains(java.security.MessageDigest.getInstance("SHA-256").digest(bytes).joinToString(""){"%02x".format(it)}));assertNotNull(context.queue().capture(id));assertArrayEquals(bytes,context.queue().image(id));picture("support-real-export-sensitive-originals-excluded")
                val safe=File(context.filesDir,"final-selected-risk").apply{mkdirs()};File(safe,"support-absence-facts.json").writeText(JSONObject().put("schema",1).put("actualSupportBytes",output.length()).put("bodyAbsent",true).put("knownCurrentTokenAbsent",true).put("imageAndDescriptionAbsent",true).put("originalRetainedUntilTestCleanup",true).toString())
            }
        }finally{instrumentation.removeMonitor(monitor);context.queue().dedupeRow(id)?.let{context.queue().resolveDedupe(id,it.getString("blob"),null,null,null)};directory.deleteRecursively()}
    }

    private class HttpFixture:AutoCloseable{
        val token="generated-only-local-risk-owner-token";val conversation=UUID.randomUUID().toString();val redeems=AtomicInteger();val deletes=AtomicInteger();val queryPosts=AtomicInteger();val capturePosts=AtomicInteger();val helpReads=AtomicInteger();private val server=ServerSocket(0,10,InetAddress.getByName("127.0.0.1"));val origin="http://127.0.0.1:${server.localPort}";private val threads=Executors.newCachedThreadPool()
        init{threads.submit{while(!server.isClosed)runCatching{server.accept()}.getOrNull()?.let{socket->threads.submit{socket.use{
            val input=it.getInputStream().bufferedReader();val first=input.readLine().orEmpty();val path=first.split(' ').getOrElse(1){""};val headers=mutableListOf<String>();while(true){val h=input.readLine();if(h.isNullOrEmpty())break;headers.add(h)};val size=headers.firstOrNull{h->h.startsWith("Content-Length:",true)}?.substringAfter(':')?.trim()?.toInt()?:0;val body=CharArray(size);var n=0;while(n<size){val x=input.read(body,n,size-n);if(x<0)break;n+=x}
            if(path=="/generated-install-help"){helpReads.incrementAndGet();val bytes="<!doctype html><title>Generated Mote help</title><h1>Generated Mote installation help boundary</h1><p>Generated local documentation only. No sign in or installation.</p>".toByteArray();it.getOutputStream().apply{write("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray());write(bytes);flush()};return@use}
            if(first.startsWith("POST ")&&path=="/api/captures")capturePosts.incrementAndGet()
            if(path=="/api/connections/redeem"){redeems.incrementAndGet();return@use}
            var status="200 OK";val response=when{
                first.startsWith("DELETE ")&&path=="/api/conversations/$conversation"->{deletes.incrementAndGet();status="503 Service Unavailable";JSONObject().put("error","generated_delete_unavailable")}
                first.startsWith("POST ")&&path.startsWith("/api/query-runs")->{queryPosts.incrementAndGet();status="503 Service Unavailable";JSONObject().put("error","query_not_allowed")}
                path.startsWith("/api/conversations/$conversation")->JSONObject().put("id",conversation).put("scope",JSONObject()).put("turns",JSONArray().put(JSONObject().put("id",UUID.randomUUID().toString()).put("status","completed").put("question","Generated isolated history").put("result",JSONObject().put("answer","Generated controlled existing answer").put("citations",JSONArray()))))
                path.startsWith("/api/conversations?")->JSONObject().put("items",JSONArray().put(JSONObject().put("id",conversation).put("title","Generated isolated history").put("turnCount",1).put("updatedAt","2026-10-30T00:00:00Z")))
                path.startsWith("/api/model-settings")->JSONObject().put("profiles",JSONArray())
                else->JSONObject().put("items",JSONArray())
            };val bytes=response.toString().toByteArray();it.getOutputStream().apply{write("HTTP/1.1 $status\r\nContent-Type: application/json\r\nContent-Length: ${bytes.size}\r\nConnection: close\r\n\r\n".toByteArray());write(bytes);flush()}
        }}}}}
        override fun close(){server.close();threads.shutdownNow()}
    }
}
