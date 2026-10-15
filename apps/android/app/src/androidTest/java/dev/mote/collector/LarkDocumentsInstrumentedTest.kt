package dev.mote.collector

import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/** Explicit generated provider only, driven through the fifth home action and native owner login. */
@RunWith(AndroidJUnit4::class)
class LarkDocumentsInstrumentedTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private val arguments get() = InstrumentationRegistry.getArguments()
    private val origin get() = arguments.getString("larkFixtureOrigin") ?: error("Generated Lark fixture origin required")
    private val owner get() = arguments.getString("larkFixtureOwner") ?: error("Generated Lark fixture owner required")
    private fun views(root: View): List<View> = buildList { add(root); if (root is ViewGroup) repeat(root.childCount) { addAll(views(root.getChildAt(it))) } }
    private fun read(path: String): JSONObject {
        val connection = URL(origin + path).openConnection() as HttpURLConnection
        connection.connectTimeout = 5000; connection.readTimeout = 5000; connection.setRequestProperty("Authorization", "Bearer $owner")
        return try { assertEquals(200, connection.responseCode); JSONObject(connection.inputStream.bufferedReader().use { it.readText() }) } finally { connection.disconnect() }
    }
    private fun await(label: String, condition: () -> Boolean) {
        val end = SystemClock.elapsedRealtime() + 20000
        while (SystemClock.elapsedRealtime() < end) { if (condition()) return; Thread.sleep(50) }
        fail("Timed out: $label")
    }
    private fun text(activity: CentralActivity, value: String): Boolean {
        var found = false; instrumentation.runOnMainSync { found = !activity.isWorking && views(activity.window.decorView).filterIsInstance<TextView>().any { it.text.toString().contains(value) } }; return found
    }
    private fun click(activity: CentralActivity, label: String) {
        await("Native action $label") { var ready = false; instrumentation.runOnMainSync { ready = !activity.isWorking && views(activity.window.decorView).filterIsInstance<Button>().any { it.isEnabled && it.text.toString() == label } }; ready }
        instrumentation.runOnMainSync { views(activity.window.decorView).filterIsInstance<Button>().first { it.text.toString() == label }.performClick() }
    }
    @Test fun homeFeishuActionAuthorizesPreviewsAndArchivesGeneratedDocumentsWithoutCalendarSelection() {
        assumeTrue("Explicit generated Lark provider fixture required", arguments.getString("larkDocumentFixture") == "true")
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("emu64a"))
        val settings = Settings(context); val previous = settings.read(); val language = MoteI18n.preference()
        require(!settings.enabled && !ProjectionService.running && !CaptureAccessibilityService.connected)
        val monitor = instrumentation.addMonitor(CentralActivity::class.java.name, null, false)
        val renderDirectory = File(context.filesDir, "ui-iterations/feishu-documents").apply { mkdirs() }
        var central: CentralActivity? = null
        try {
            File(context.noBackupFilesDir, "central-native").deleteRecursively()
            MoteI18n.select(context, "zh-CN"); CentralSession.get(context).select("")
            settings.save(previous.copy(server = origin, token = "", debugHttp = true, authSignedOut = false, authExpiresAt = 0, authProcess = ""), confirmCentralEndpoint = true)
            ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { main ->
                main.onActivity { activity ->
                    val rows = views(activity.window.decorView)
                    assertEquals(listOf("add:FOLDER", "add:FILE", "add:SCREEN", "add:NOTE", "add:FEISHU"), rows.filter { it.tag?.toString()?.startsWith("add:") == true }.map { it.tag })
                    rows.single { it.tag == "add:FEISHU" }.performClick()
                }
                val activity = instrumentation.waitForMonitorWithTimeout(monitor, 10000) as? CentralActivity ?: error("Feishu action did not open native CentralActivity")
                central = activity
                await("Native owner login") { text(activity, "中央管理令牌") }
                instrumentation.runOnMainSync { views(activity.window.decorView).filterIsInstance<EditText>().single { it.contentDescription == "中央管理令牌" }.setText(owner) }
                click(activity, "登录并继续"); click(activity, "检查状态"); click(activity, "扫码登录并授权只读权限")
                await("Generated provider authorization") { read("/api/connectors/lark").optBoolean("connected") }
                click(activity, "刷新"); click(activity, "选择文档与活动范围")
                await("Native document scope") { text(activity, "自动发现我的文档活动") }
                instrumentation.runOnMainSync {
                    val controls = views(activity.window.decorView)
                    for (label in listOf("我创建的", "我编辑过的", "我打开过的")) assertTrue(controls.filterIsInstance<CheckBox>().single { it.text.toString() == label }.isChecked)
                    assertEquals("30", controls.filterIsInstance<EditText>().single { it.contentDescription == "首次回溯天数" }.text.toString())
                    assertTrue(controls.none { it is WebView })
                }
                click(activity, "保存同步范围")
                await("Scope save acknowledged") { read("/api/connectors/lark").getJSONObject("selection").has("documentDiscovery") }
                assertEquals(0, read("/generated/lark-metrics").getInt("bodyReads"))
                click(activity, "预览文档范围")
                await("Generated metadata preview") { read("/api/connectors/lark").optJSONObject("documentSync")?.optInt("previewTotal") == 2 }
                click(activity, "刷新"); await("Native preview feedback") { text(activity, "Generated journal") && text(activity, "确认并开始归档") }
                assertTrue(text(activity, "已完成")); assertFalse(text(activity, "completed"))
                assertEquals(0, read("/generated/lark-metrics").getInt("bodyReads"))
                instrumentation.runOnMainSync { GeneratedWindowRendering.save(activity, renderDirectory, "feishu-preview") }
                click(activity, "确认并开始归档")
                await("Partial archive feedback") { read("/api/connectors/lark").optJSONObject("documentSync")?.optInt("failed") == 1 }
                click(activity, "刷新"); click(activity, "重试此文档")
                await("Generated documents archived") { val status = read("/api/connectors/lark").getJSONObject("documentSync"); status.getInt("documents") == 2 && status.getInt("failed") == 0 }
                click(activity, "刷新"); await("Native archive feedback") { text(activity, "已归档 2 篇文档") }
                assertEquals(0, read("/api/connectors/lark").getJSONObject("selection").getJSONArray("calendarIds").length())
                assertEquals(0, read("/generated/lark-metrics").getInt("modelCalls")); assertFalse(settings.enabled)
                instrumentation.runOnMainSync { GeneratedWindowRendering.save(activity, renderDirectory, "feishu-archived") }
            }
        } finally {
            central?.let { activity -> instrumentation.runOnMainSync { activity.finish() } }
            instrumentation.removeMonitor(monitor); settings.enabled = false; settings.save(previous, confirmCentralEndpoint = true); MoteI18n.select(context, language)
        }
    }
}
