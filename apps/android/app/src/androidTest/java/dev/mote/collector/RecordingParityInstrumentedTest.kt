package dev.mote.collector

import android.content.Context
import android.content.Intent
import android.os.Build
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.CheckBox
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
import java.text.DateFormat
import java.util.Date
import java.util.concurrent.TimeUnit

/** Only a dedicated SDK-emulator package and generated scoped recording host. */
@RunWith(AndroidJUnit4::class)
class RecordingParityInstrumentedTest {
    private fun fixture() = JSONObject(File(InstrumentationRegistry.getArguments().getString("fixture")!!).readText())
    private fun endpoint() = fixture().getString("androidAddress")
    private fun token(owner: String) = fixture().getJSONObject(owner).getString("token")
    private fun waitFor(read: () -> Boolean) {
        val until = android.os.SystemClock.elapsedRealtime() + 45000
        while (!read()) { check(android.os.SystemClock.elapsedRealtime() < until) { "Generated recording UI deadline exceeded" }; Thread.sleep(40) }
    }
    private fun views(root: View): List<View> = listOf(root) + if (root is ViewGroup) (0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
    private fun login(app: Context, owner: String) = RuntimeSettings.replaceAccount(app) { Settings(app).signIn(endpoint(), token(owner), 2592000000) }
    private fun calls(): String {
        val (code, value) = HttpJson.post(fixture().getString("androidControlAddress") + "/generated/recording-calls", JSONObject())
        check(code == 200); return value!!.getJSONArray("calls").toString()
    }

    @Test fun scopedRecordingPagePreservesIndependentStagesAfterRestartAndRetiresOldOwnerControls() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext
        require(app.packageName == "dev.mote.collector.m15fixture")
        require(Build.FINGERPRINT.contains("sdk_gphone") || Build.FINGERPRINT.contains("emu64"))
        waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null }
        WorkManager.getInstance(app).cancelAllWork().result.get(15, TimeUnit.SECONDS)
        waitFor { !ConnectionGuard.changing() && ConnectionGuard.processing.get() == 0 }
        Settings(app).let { settings -> settings.save(settings.read().copy(server = "", token = "", debugHttp = true, wifiOnly = false, syncMode = "manual", metadataEnabled = false)) }
        login(app, "a"); MoteI18n.select(app, "zh-CN")
        val a = CentralAccess.requireClient(app); val b = CentralClient(endpoint(), token("b")); val path = "/api/connectors/same-recorder"
        val beforeB = b.get(path + "/recordings?limit=20").toString(); val beforeCalls = calls()
        val initial = a.get(path + "/recordings?limit=20").getJSONArray("items")
        val receipt = (0 until initial.length()).map(initial::getJSONObject).single { it.getString("id") == "recording-01" }
        val completedTranscript = (0 until initial.length()).map(initial::getJSONObject).single { it.getString("id") == "recording-02" }.getString("transcriptCaptureId")
        ActivityScenario.launch<CentralActivity>(Intent(app, CentralActivity::class.java).putExtra("page", "settings")).use { scenario ->
            fun ready() = waitFor { var value = false; scenario.onActivity { value = it.client != null && !it.isWorking }; value }
            fun press(label: String) { scenario.onActivity { activity -> val button = views(activity.window.decorView).filterIsInstance<Button>().singleOrNull { it.text.toString() == label }; assertNotNull(label, button); button!!.performClick() } }
            fun recordings() { ready(); press("来源与外部应用"); ready(); press("录音归档"); ready() }
            fun phase(id: String, key: String): String {
                var result = ""; scenario.onActivity { activity ->
                    val row = views(activity.window.decorView).single { it.tag == "recording-checkpoint:$id" }
                    val phase = views(row).single { it.tag == "recording-phase:$key" }
                    result = views(phase).filterIsInstance<TextView>().joinToString("\n") { it.text.toString() }
                }; return result
            }
            recordings(); press("同步步骤与状态"); ready()
            assertTrue(phase("recording-00", "metadata").contains("读取信息 · 需要处理")); assertTrue(phase("recording-00", "metadata").contains("generated_metadata_blocked"))
            for (key in listOf("transcript", "audio")) { assertTrue(phase("recording-00", key).contains("等待处理")); assertFalse(phase("recording-00", key).contains("generated_metadata_blocked")) }
            val transcript = phase("recording-01", "transcript"); val audio = phase("recording-01", "audio")
            assertTrue(transcript.contains("generated_transcript_pending")); assertFalse(transcript.contains("generated_audio_pending")); assertTrue(transcript.contains("下次可运行时间"))
            assertTrue(audio.contains("generated_audio_pending")); assertFalse(audio.contains("generated_transcript_pending")); assertTrue(audio.contains("下次可运行时间"))
            for ((key, text) in listOf("transcript" to transcript, "audio" to audio)) assertTrue(text.contains(DateFormat.getDateTimeInstance(DateFormat.DEFAULT, DateFormat.DEFAULT, MoteI18n.locale()).format(Date(receipt.getJSONObject(key).getLong("nextAttemptAt")))))
            assertTrue(phase("recording-02", "transcript").contains("归档转写 · 已完成")); assertFalse(phase("recording-02", "transcript").contains("generated_media_failed"))
            assertTrue(phase("recording-02", "audio").contains("备份音频 · 未完成")); assertTrue(phase("recording-02", "audio").contains("自动重试已停止，请核对原因后手动重试"))
            scenario.onActivity { activity -> assertEquals(30, views(activity.window.decorView).count { it.tag?.toString()?.startsWith("recording-checkpoint:") == true }) }
            press("下一页"); ready()
            scenario.onActivity { activity -> assertEquals(listOf("recording-checkpoint:recording-30", "recording-checkpoint:recording-31"), views(activity.window.decorView).mapNotNull { it.tag?.toString()?.takeIf { tag -> tag.startsWith("recording-checkpoint:") } }) }
            press("返回第一页"); ready(); assertTrue(phase("recording-00", "metadata").contains("generated_metadata_blocked"))
            assertEquals("Reading scoped phase receipts cannot acquire provider content", beforeCalls, calls())
            press("返回"); ready(); press("同步范围"); ready()
            scenario.onActivity { activity -> assertFalse("Audio backup was fixed on in the original native form", views(activity.window.decorView).filterIsInstance<CheckBox>().any { it.text.toString().contains("备份") }) }
            assertTrue(a.get(path).getJSONObject("selection").getBoolean("backupAudio"))
            press("取消"); ready()
            press("重试失败步骤"); ready()
            waitFor {
                val rows = a.get(path + "/recordings?limit=20").getJSONArray("items")
                (0 until rows.length()).map(rows::getJSONObject).single { it.getString("id") == "recording-02" }.getJSONObject("audio").getString("state") == "succeeded"
            }
            val retried = a.get(path + "/recordings?limit=20").getJSONArray("items").let { rows -> (0 until rows.length()).map(rows::getJSONObject).single { it.getString("id") == "recording-02" } }
            assertEquals("Retrying audio cannot replace its already archived transcript", completedTranscript, retried.getString("transcriptCaptureId"))
            val beforeSwitchCalls = calls(); assertEquals(beforeB, b.get(path + "/recordings?limit=20").toString())
            lateinit var oldRetry: Button; scenario.onActivity { activity -> oldRetry = views(activity.window.decorView).filterIsInstance<Button>().single { it.text.toString() == "重试失败步骤" } }
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED); login(app, "b"); scenario.moveToState(androidx.lifecycle.Lifecycle.State.RESUMED); ready()
            scenario.onActivity { oldRetry.performClick() }; ready()
            assertEquals(beforeB, b.get(path + "/recordings?limit=20").toString()); assertEquals(beforeSwitchCalls, calls())
            scenario.onActivity { it.navigate("settings") }; recordings(); press("同步步骤与状态"); ready()
            assertTrue(phase("recording-00", "metadata").contains("读取信息 · 已完成")); assertFalse(phase("recording-00", "metadata").contains("generated_metadata_blocked"))
            scenario.onActivity { activity -> assertFalse(views(activity.window.decorView).filterIsInstance<TextView>().any { it.text.toString().contains(fixture().getJSONObject("a").getString("userId")) }) }
        }
    }

    @Test fun firstEnabledNativeSaveStartsExactlyOnceWithAutomaticDiscoveryOffAndOn() {
        val app = InstrumentationRegistry.getInstrumentation().targetContext
        require(app.packageName == "dev.mote.collector.m15fixture")
        require(Build.FINGERPRINT.contains("sdk_gphone") || Build.FINGERPRINT.contains("emu64"))
        waitFor { !QueueStorage.recovering && QueueStorage.recoveryFailure == null }
        WorkManager.getInstance(app).cancelAllWork().result.get(15, TimeUnit.SECONDS)
        waitFor { !ConnectionGuard.changing() && ConnectionGuard.processing.get() == 0 }
        Settings(app).let { settings -> settings.save(settings.read().copy(server = "", token = "", debugHttp = true, wifiOnly = false, syncMode = "manual", metadataEnabled = false)) }
        login(app, "c"); MoteI18n.select(app, "zh-CN")
        val api = CentralAccess.requireClient(app)
        ActivityScenario.launch<CentralActivity>(Intent(app, CentralActivity::class.java).putExtra("page", "settings")).use { scenario ->
            fun ready() = waitFor { var value = false; scenario.onActivity { value = it.client != null && !it.isWorking }; value }
            fun press(label: String, id: String? = null) { scenario.onActivity { activity ->
                val root = if (id == null) activity.window.decorView else views(activity.window.decorView).single { it.tag == "recording-connection:$id" }
                views(root).filterIsInstance<Button>().single { it.text.toString() == label }.performClick()
            }; ready() }
            ready(); press("来源与外部应用"); press("录音归档")
            for (automatic in listOf(false, true)) {
                val id = if (automatic) "first-save-on" else "first-save-off"; val path = "/api/connectors/$id"
                assertFalse("The first native save has no prior selection or manual sync", api.get(path).getJSONObject("selection").getBoolean("enabled"))
                assertEquals(0, api.get(path + "/recordings?limit=20").getJSONArray("items").length())
                press("同步范围", id)
                scenario.onActivity { activity ->
                    val all = views(activity.window.decorView)
                    all.filterIsInstance<CheckBox>().single { it.text.toString() == "启用" }.isChecked = true
                    all.filterIsInstance<CheckBox>().single { it.text.toString() == "自动同步" }.isChecked = automatic
                    val dates = all.filterIsInstance<EditText>(); assertEquals(2, dates.size)
                    dates[0].setText("2026-09-30T00:00:00Z"); dates[1].setText("2026-10-02T00:00:00Z")
                }
                press("保存设置")
                waitFor { val rows = api.get(path + "/recordings?limit=20").getJSONArray("items"); rows.length() == 1 && rows.getJSONObject(0).getJSONObject("transcript").getString("state") == "succeeded" && rows.getJSONObject(0).getJSONObject("audio").getString("state") == "succeeded" }
                assertEquals(automatic, api.get(path).getJSONObject("selection").getBoolean("autoSync"))
                val (code, control) = HttpJson.post(fixture().getString("androidControlAddress") + "/generated/recording-calls", JSONObject()); assertEquals(200, code)
                val calls = control!!.getJSONArray("calls")
                assertEquals("One saved range admits one scan without a second native sync", 1, (0 until calls.length()).map(calls::getJSONObject).count { it.getString("instance") == id && it.getString("kind") == "minutes-search" })
                val syncs = control.getJSONArray("syncRequests"); assertFalse((0 until syncs.length()).any { syncs.getString(it) == path + "/sync" })
            }
        }
    }
}
