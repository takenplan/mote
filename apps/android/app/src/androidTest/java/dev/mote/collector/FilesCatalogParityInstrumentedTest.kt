package dev.mote.collector

import android.content.Context
import android.content.Intent
import android.os.Build
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.WorkManager
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.concurrent.TimeUnit

/** Real scoped producer + native Activity. Only generated accounts and WAVs. */
@RunWith(AndroidJUnit4::class)
class FilesCatalogParityInstrumentedTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private fun fixture() = JSONObject(File(InstrumentationRegistry.getArguments().getString("fixture")!!).readText())
    private fun endpoint() = fixture().getString("androidAddress")
    private fun token(actor: String) = fixture().getJSONObject(actor).getString("token")
    private fun control(path: String): JSONObject {
        val (status, value) = HttpJson.post(fixture().getString("androidControlAddress") + path, JSONObject())
        assertEquals(200, status); return requireNotNull(value)
    }
    private fun waitFor(predicate: () -> Boolean) {
        val deadline = android.os.SystemClock.elapsedRealtime() + 45000
        while (!predicate()) { check(android.os.SystemClock.elapsedRealtime() < deadline) { "Generated Files catalog deadline" }; Thread.sleep(40) }
    }
    private fun login(app: Context, actor: String) = RuntimeSettings.replaceAccount(app) { Settings(app).signIn(endpoint(), token(actor), 2592000000) }
    private fun prepare(): Context {
        val app = instrumentation.targetContext
        require(app.packageName == "dev.mote.collector.m15fixture")
        require(Build.FINGERPRINT.contains("sdk_gphone") || Build.FINGERPRINT.contains("emu64"))
        waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null }
        WorkManager.getInstance(app).cancelAllWork().result.get(15, TimeUnit.SECONDS)
        waitFor { !ConnectionGuard.changing() && ConnectionGuard.processing.get() == 0 }
        val settings = Settings(app)
        settings.save(settings.read().copy(server = "", token = "", debugHttp = true, wifiOnly = false, syncMode = "manual", metadataEnabled = false))
        login(app, "a"); MoteI18n.select(app, "zh-CN"); return app
    }
    private fun views(root: View): List<View> = listOf(root) + if (root is ViewGroup) (0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
    private fun ready(scenario: ActivityScenario<CentralActivity>) = waitFor { var result = false; scenario.onActivity { result = it.client != null && !it.isWorking }; result }
    private fun press(scenario: ActivityScenario<CentralActivity>, label: String): Button {
        lateinit var target: Button
        scenario.onActivity { activity ->
            val found = views(activity.window.decorView).filterIsInstance<Button>().singleOrNull { it.text.toString() == label }
            assertNotNull("Missing Files control: $label", found); target = found!!; target.performClick()
        }; return target
    }
    private fun open(scenario: ActivityScenario<CentralActivity>, title: String) {
        ready(scenario)
        scenario.onActivity { activity -> views(activity.window.decorView).filterIsInstance<EditText>().single { it.hint.toString() == "文件名" }.setText(title) }
        press(scenario, "搜索"); ready(scenario); press(scenario, "查看详情"); ready(scenario)
    }
    private fun assertNoProcessingControls(scenario: ActivityScenario<CentralActivity>, metadata: Boolean) {
        scenario.onActivity { activity ->
            val labels = views(activity.window.decorView).filterIsInstance<Button>().map { it.text.toString() }
            assertFalse(labels.any { it.startsWith("重试") || it in setOf("确认说话人", "纠正此段", "保存校正", "保存说话人姓名", "停止处理") })
            if (metadata) assertFalse(labels.any { it in setOf("播放录音", "保存原件", "查看原图", "导出") })
        }
    }
    private fun confirmDelete(scenario: ActivityScenario<CentralActivity>) {
        press(scenario, "删除文件")
        scenario.onActivity {
            @Suppress("UNCHECKED_CAST")
            val dialogs = MoteDialogBuilder::class.java.getDeclaredField("dialogs").apply { isAccessible = true }.get(null) as List<java.lang.ref.WeakReference<android.app.AlertDialog>>
            dialogs.mapNotNull { it.get() }.single { it.isShowing }.getButton(android.app.AlertDialog.BUTTON_POSITIVE).performClick()
        }; ready(scenario)
    }

    @Test fun metadataDetailSkipsChunksAndRecoversItsSameDeleteAfterLostAckRecreationAndAccountSwitch() {
        val app = prepare(); val setup = control("/generated/file-parity/setup-metadata"); val id = setup.getString("metadataCaptureId")
        val api = CentralAccess.requireClient(app); val before = api.get("/api/files/$id")
        val b = CentralClient(endpoint(), token("b")); val beforeB = b.get("/api/files/$id").toString()
        assertFalse(before.getBoolean("hasOriginal")); assertFalse(before.has("originalRef")); assertFalse(before.has("sha256"))
        val priorDeletes = setup.getJSONArray("deletes").length()
        control("/generated/drop-file-delete-ack")
        try {
            ActivityScenario.launch<CentralActivity>(Intent(app, CentralActivity::class.java).putExtra("page", "files")).use { scenario ->
                open(scenario, "GENERATED_A_REFERENCE")
                scenario.onActivity { activity -> assertTrue(views(activity.window.decorView).filterIsInstance<TextView>().any { it.text.toString().startsWith("已登记目录") }) }
                assertNoProcessingControls(scenario, true)
                val reads = control("/generated/file-parity/state").getJSONArray("catalogReads")
                assertFalse((0 until reads.length()).map { reads.getJSONObject(it) }.any { it.getString("actor") == "a" && it.getString("path") == "/api/files/$id/chunks" })
                confirmDelete(scenario)
                val admitted = control("/generated/file-retries").getJSONArray("deletes")
                assertTrue(admitted.length() > priorDeletes)
                val intent = admitted.getJSONObject(priorDeletes).getJSONObject("body")
                assertEquals(before.getLong("originalGeneration"), intent.getLong("originalGeneration"))
                assertEquals(404, HttpJson.get(endpoint() + "/api/files/$id", token("a")).first)
                assertEquals(beforeB, b.get("/api/files/$id").toString())
                scenario.recreate(); ready(scenario); control("/generated/release-file-delete-ack")
                val oldRetry = press(scenario, "重试同一请求"); ready(scenario)
                val settled = control("/generated/file-retries").getJSONArray("deletes")
                assertTrue(settled.length() > admitted.length())
                for (index in priorDeletes until settled.length()) {
                    val receipt = settled.getJSONObject(index); assertEquals("a", receipt.getString("actor")); assertEquals(200, receipt.getInt("status"))
                    assertEquals(SourceRules.canonical(intent), SourceRules.canonical(receipt.getJSONObject("body")))
                }
                scenario.recreate(); ready(scenario)
                scenario.onActivity { activity -> assertFalse(views(activity.window.decorView).filterIsInstance<Button>().any { it.text.toString() == "重试同一请求" }) }
                scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED); login(app, "b"); scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED); ready(scenario)
                scenario.onActivity { oldRetry.performClick() }; ready(scenario)
                assertEquals(settled.length(), control("/generated/file-retries").getJSONArray("deletes").length())
                assertEquals(beforeB, b.get("/api/files/$id").toString())
            }
        } finally { control("/generated/release-file-delete-ack") }
    }

    @Test fun historicalArchiveReadsRawTranscriptAndDownloadsOriginalAndExportWithoutEditOrRetry() {
        val app = prepare(); val id = control("/generated/file-parity/setup-history").getString("historyCaptureId")
        val api = CentralAccess.requireClient(app); val row = api.get("/api/files/$id")
        assertTrue(row.getBoolean("hasOriginal")); assertFalse(row.getJSONObject("processing").getBoolean("current"))
        val b = CentralClient(endpoint(), token("b")); val beforeB = b.get("/api/files/$id/chunks").toString()
        val original = File(app.cacheDir, "generated-parity-history.wav").apply { delete() }
        val exported = File(app.cacheDir, "generated-parity-history.tar.gz").apply { delete() }
        val monitors = mutableListOf<android.app.Instrumentation.ActivityMonitor>()
        fun intercept(mime: String, target: File) {
            monitors += instrumentation.addMonitor(android.content.IntentFilter(Intent.ACTION_CREATE_DOCUMENT).apply { addCategory(Intent.CATEGORY_OPENABLE); addDataType(mime) }, android.app.Instrumentation.ActivityResult(android.app.Activity.RESULT_OK, Intent().setData(android.net.Uri.fromFile(target))), true)
        }
        try {
            ActivityScenario.launch<CentralActivity>(Intent(app, CentralActivity::class.java).putExtra("page", "files")).use { scenario ->
                open(scenario, "GENERATED_A_HISTORICAL"); assertNoProcessingControls(scenario, false)
                scenario.onActivity { activity ->
                    val text = views(activity.window.decorView).filterIsInstance<TextView>().map { it.text.toString() }
                    assertTrue(text.any { it.contains("Generated A raw recording") }); assertTrue(text.any { it.contains("来源已不可见") })
                }
                press(scenario, "播放录音"); ready(scenario)
                intercept("audio/wav", original); press(scenario, "保存原件"); waitFor { original.isFile && original.length() == row.getLong("sizeBytes") }; ready(scenario)
                assertArrayEquals(android.util.Base64.decode(fixture().getString("wave"), android.util.Base64.DEFAULT), original.readBytes())
                intercept("application/gzip", exported); press(scenario, "导出"); waitFor { exported.isFile && exported.length() > 0 }; ready(scenario)
                assertTrue(java.util.zip.GZIPInputStream(exported.inputStream()).use { String(it.readBytes(), Charsets.UTF_8) }.contains("Generated A raw recording"))
                scenario.recreate(); open(scenario, "GENERATED_A_HISTORICAL"); assertNoProcessingControls(scenario, false)
                assertEquals(beforeB, b.get("/api/files/$id/chunks").toString())
            }
        } finally { monitors.forEach(instrumentation::removeMonitor); original.delete(); exported.delete() }
    }
}
