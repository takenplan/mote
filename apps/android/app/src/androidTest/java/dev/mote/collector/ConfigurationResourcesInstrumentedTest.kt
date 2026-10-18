package dev.mote.collector

import android.content.Context
import android.content.Intent
import android.os.Build
import android.view.View
import android.view.ViewGroup
import android.widget.*
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

/** Explicit combined-tree fixture only: real startup and generated archives,
 * model bundles and workers. Never run against a personal server or device. */
@RunWith(AndroidJUnit4::class)
class ConfigurationResourcesInstrumentedTest {
    private fun fixture() = JSONObject(File(InstrumentationRegistry.getArguments().getString("fixture")!!).readText()).also { require(it.getBoolean("resourceFixture")) }
    private fun context(): Context = InstrumentationRegistry.getInstrumentation().targetContext.also {
        require(it.packageName == "dev.mote.collector.m15fixture")
        require(Build.FINGERPRINT.contains("sdk_gphone") || Build.FINGERPRINT.contains("emu64"))
    }
    private fun endpoint() = fixture().getString("androidAddress")
    private fun api(owner: String) = CentralClient(endpoint(), fixture().getJSONObject(owner).getString("token"))
    private fun control(path: String = "/generated/resource-state"): JSONObject {
        val (status, value) = HttpJson.post(fixture().getString("androidControlAddress") + path, JSONObject()); assertEquals(200, status); return value!!
    }
    private fun waitFor(predicate: () -> Boolean) {
        val deadline = android.os.SystemClock.elapsedRealtime() + 45000
        while (!predicate()) { check(android.os.SystemClock.elapsedRealtime() < deadline) { "Generated resource journey timed out" }; Thread.sleep(40) }
    }
    private fun login(app: Context, owner: String) = RuntimeSettings.replaceAccount(app) { Settings(app).signIn(endpoint(), fixture().getJSONObject(owner).getString("token"), 2592000000) }
    private fun prepare(owner: String): Context = context().also { app ->
        waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null }
        WorkManager.getInstance(app).cancelAllWork().result.get(15, TimeUnit.SECONDS)
        waitFor { !ConnectionGuard.changing() && ConnectionGuard.processing.get() == 0 }
        val settings = Settings(app); settings.save(settings.read().copy(server = "", token = "", debugHttp = true, wifiOnly = false, syncMode = "manual", metadataEnabled = false))
        login(app, owner); MoteI18n.select(app, "zh-CN")
    }
    private fun views(root: View): List<View> = listOf(root) + if (root is ViewGroup) (0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
    private fun ready(scenario: ActivityScenario<CentralActivity>) = waitFor { var value = false; scenario.onActivity { value = it.client != null && !it.isWorking }; value }
    private fun press(scenario: ActivityScenario<CentralActivity>, label: String) {
        scenario.onActivity { activity -> views(activity.window.decorView).filterIsInstance<Button>().single { it.text.toString() == label && it.isEnabled }.performClick() }
        ready(scenario)
    }
    private fun fill(scenario: ActivityScenario<CentralActivity>, label: String, value: String) = scenario.onActivity { activity ->
        views(activity.window.decorView).filterIsInstance<EditText>().single { it.contentDescription == label }.setText(value)
    }
    private fun shown(scenario: ActivityScenario<CentralActivity>, label: String): Boolean {
        var result = false; scenario.onActivity { activity -> result = views(activity.window.decorView).filterIsInstance<TextView>().any { it.text.toString().contains(label) } }; return result
    }

    @Test fun actualNativeImageControlsUseOwnedPreviewConfirmationAndRetireAcceptedSaves() {
        val app = prepare("a"); val a = api("a"); val b = api("b"); val bBefore = b.get("/api/perception").getJSONObject("settings").toString()
        ActivityScenario.launch<CentralActivity>(Intent(app, CentralActivity::class.java).putExtra("page", "settings")).use { scenario ->
            ready(scenario); press(scenario, "文字识别设置")
            fill(scenario, "图片处理并发", "2")
            scenario.onActivity { activity -> views(activity.window.decorView).filterIsInstance<CheckBox>().single { it.text.toString().startsWith("允许查询模型按需读取") }.isChecked = true }
            press(scenario, "保存图片设置")
            val saved = a.get("/api/perception").getJSONObject("settings"); assertEquals(2, saved.getInt("concurrency")); assertTrue(saved.getBoolean("allowQueryImages")); assertEquals(bBefore, b.get("/api/perception").getJSONObject("settings").toString())
            fill(scenario, "开始日期", "2026-10-16"); fill(scenario, "结束日期", "2026-10-16")
            scenario.onActivity { activity ->
                val fields = views(activity.window.decorView).filterIsInstance<Spinner>()
                fields.single { it.contentDescription == "来源" }.setSelection(1)
                fields.single { it.contentDescription == "处理方式" }.setSelection(1)
            }
            InstrumentationRegistry.getInstrumentation().waitForIdleSync()
            val before = control().getJSONArray("requests").let { rows -> (0 until rows.length()).count { rows.getJSONObject(it).getString("path").endsWith("/historical-process") } }
            press(scenario, "预览处理范围"); assertTrue(shown(scenario, "范围内共 2 张图片"))
            assertEquals(before, control().getJSONArray("requests").let { rows -> (0 until rows.length()).count { rows.getJSONObject(it).getString("path").endsWith("/historical-process") } })
            fill(scenario, "结束日期", "2026-10-17"); press(scenario, "安排全部图片")
            assertEquals(before, control().getJSONArray("requests").let { rows -> (0 until rows.length()).count { rows.getJSONObject(it).getString("path").endsWith("/historical-process") } })
            fill(scenario, "结束日期", "2026-10-16"); press(scenario, "预览处理范围"); press(scenario, "安排全部图片")
            waitFor { val rows = a.get("/api/perception").getJSONArray("backfills"); (0 until rows.length()).any { rows.getJSONObject(it).let { row -> row.getString("state") == "succeeded" && row.getInt("queued") == 2 } } }
            assertEquals(0, b.get("/api/perception").getJSONArray("backfills").length())
            val rows = a.get("/api/perception").getJSONArray("backfills"); for (index in 0 until rows.length()) { assertFalse(rows.getJSONObject(index).has("cursor")); assertFalse(rows.getJSONObject(index).has("watermark")) }
            // A producer-accepted response held by the loopback transport may
            // finish after switching accounts, but cannot reopen the old page.
            fill(scenario, "处理模型／配置版本", "generated-held-save"); control("/generated/hold-image-save")
            scenario.onActivity { activity -> views(activity.window.decorView).filterIsInstance<Button>().single { it.text.toString() == "保存图片设置" }.performClick() }
            try {
                waitFor { control().getBoolean("imageEntered") }; login(app, "b"); scenario.onActivity { it.navigate("settings") }; control("/generated/release-image-save"); ready(scenario)
                assertTrue(shown(scenario, "模型配置")); assertFalse(shown(scenario, "generated-held-save")); assertEquals(bBefore, b.get("/api/perception").getJSONObject("settings").toString())
            } finally { control("/generated/release-image-save") }
        }
    }

    @Test fun actualNativeAdministratorMediaUsesExplicitInstallCancellationAndFailureRecovery() {
        val app = prepare("admin"); val administrator = api("admin")
        ActivityScenario.launch<CentralActivity>(Intent(app, CentralActivity::class.java).putExtra("page", "settings")).use { scenario ->
            ready(scenario); press(scenario, "文字识别设置"); val before = administrator.get("/api/perception").getJSONObject("settings").toString()
            control("/generated/hold-media"); press(scenario, "下载并安装 OCR 模型")
            try { waitFor { administrator.get("/api/media-models").getJSONObject("ocr").getString("state") == "downloading" }; press(scenario, "取消下载") } finally { control("/generated/release-media") }
            assertEquals("cancelled", administrator.get("/api/media-models").getJSONObject("ocr").getString("state")); assertTrue(shown(scenario, "已取消"))
            control("/generated/worker-offline"); press(scenario, "下载并安装 OCR 模型")
            try {
                waitFor { administrator.get("/api/media-models").getJSONObject("ocr").getString("state") == "ready" }
                waitFor { shown(scenario, "正在准备本地 OCR 服务") }; assertFalse(administrator.get("/api/media-models").getJSONObject("ocr").getBoolean("runtimeReady"))
            } finally { control("/generated/worker-online") }
            waitFor { shown(scenario, "OCR Worker 已就绪") }; assertEquals(before, administrator.get("/api/perception").getJSONObject("settings").toString())
            scenario.onActivity { it.navigate("settings") }; ready(scenario); press(scenario, "处理设置")
            control("/generated/corrupt-media"); press(scenario, "下载并安装本地音频模型")
            try { waitFor { administrator.get("/api/media-models").getJSONObject("dialogue").getString("state") == "failed" }; waitFor { shown(scenario, "处理失败") } } finally { control("/generated/valid-media") }
            press(scenario, "下载并安装本地音频模型"); waitFor { administrator.get("/api/media-models").getJSONObject("dialogue").getBoolean("runtimeReady") }
            press(scenario, "安装可选声纹模型"); waitFor { administrator.get("/api/media-models").getJSONObject("speaker-wespeaker").getBoolean("runtimeReady") }
            login(app, "b"); scenario.onActivity { it.navigate("settings") }; ready(scenario); press(scenario, "处理设置")
            scenario.onActivity { activity -> assertFalse(views(activity.window.decorView).filterIsInstance<Button>().any { it.text.toString() in listOf("下载并安装本地音频模型", "安装可选声纹模型", "取消下载") }) }
            assertEquals(403, HttpJson.post(endpoint() + "/api/admin/media-models/ocr/install", JSONObject().put("source", "auto"), fixture().getJSONObject("b").getString("token")).first)
        }
    }

    @Test fun actualNativeAdministratorStoragePreservesSavedEffectiveValuesAndOrdinaryEntryPermissions() {
        val app = prepare("admin"); val administrator = api("admin"); val before = administrator.get("/api/admin/storage-settings")
        ActivityScenario.launch<CentralActivity>(Intent(app, CentralActivity::class.java).putExtra("page", "settings")).use { scenario ->
            ready(scenario); press(scenario, "保留与容量"); fill(scenario, "自定义保留天数", "90"); fill(scenario, "自定义容量（MiB）", "5120"); press(scenario, "保存设置")
            val saved = administrator.get("/api/admin/storage-settings"); assertEquals(90, saved.getJSONObject("saved").getInt("retentionDays")); assertEquals(5L * 1024 * 1024 * 1024, saved.getJSONObject("saved").getLong("maxStorageBytes"))
            assertEquals(before.getJSONObject("effective").toString(), saved.getJSONObject("effective").toString()); assertEquals("restart-required", saved.getString("status")); assertTrue(shown(scenario, "重启后生效"))
            login(app, "b"); scenario.onActivity { it.navigate("settings") }; ready(scenario)
            scenario.onActivity { activity -> assertFalse(views(activity.window.decorView).filterIsInstance<Button>().any { it.text.toString() == "保留与容量" }) }
            assertEquals(403, HttpJson.get(endpoint() + "/api/admin/storage-settings", fixture().getJSONObject("b").getString("token")).first)
        }
    }
}
