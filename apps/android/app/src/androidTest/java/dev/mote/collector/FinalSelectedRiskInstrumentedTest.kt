package dev.mote.collector

import android.content.Intent
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
    private class HttpFixture:AutoCloseable{
        val token="generated-only-local-risk-owner-token";val conversation=UUID.randomUUID().toString();val redeems=AtomicInteger();val deletes=AtomicInteger();val queryPosts=AtomicInteger();private val server=ServerSocket(0,10,InetAddress.getByName("127.0.0.1"));val origin="http://127.0.0.1:${server.localPort}";private val threads=Executors.newCachedThreadPool()
        init{threads.submit{while(!server.isClosed)runCatching{server.accept()}.getOrNull()?.let{socket->threads.submit{socket.use{
            val input=it.getInputStream().bufferedReader();val first=input.readLine().orEmpty();val path=first.split(' ').getOrElse(1){""};val headers=mutableListOf<String>();while(true){val h=input.readLine();if(h.isNullOrEmpty())break;headers.add(h)};val size=headers.firstOrNull{h->h.startsWith("Content-Length:",true)}?.substringAfter(':')?.trim()?.toInt()?:0;val body=CharArray(size);var n=0;while(n<size){val x=input.read(body,n,size-n);if(x<0)break;n+=x}
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
