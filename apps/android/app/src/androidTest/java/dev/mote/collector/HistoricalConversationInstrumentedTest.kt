package dev.mote.collector

import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.Spinner
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.net.HttpURLConnection
import java.net.URI

/** Actual wire-2 account service; generated originals/provider, no capture or live model. */
@RunWith(AndroidJUnit4::class)
class HistoricalConversationInstrumentedTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private lateinit var fixture: JSONObject
    private val stale get() = MoteI18n.text("这是历史版本，当前资料已更新。")
    private val deleted get() = MoteI18n.text("相关证据已删除，这条历史回答已清除。可以继续提问查阅现有记录。")
    @Before fun prepare() {
        val args = InstrumentationRegistry.getArguments()
        require(args.getString("historyFixture") == "true")
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("emu64a"))
        fixture = JSONObject(File(requireNotNull(args.getString("fixture"))).readText())
        require(fixture.getString("address").startsWith("http://127.0.0.1:"))
        require(fixture.getString("controlAddress").startsWith("http://127.0.0.1:"))
        require(!Settings(context).enabled && !ProjectionService.running && !CaptureAccessibilityService.connected)
        MoteI18n.select(context, args.getString("language", "zh-CN")!!)
        MoteAppearance.select(context, AppearancePreference.parse(args.getString("appearance", "light")))
    }
    private fun control(action: String): JSONObject {
        val connection = URI(fixture.getString("controlAddress") + "/" + action).toURL().openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"; connection.doOutput = true
            connection.connectTimeout = 15_000
            // Reset generates 22 real query runs; each retains its own 30s guard.
            // This bound belongs only to the test control, never a product call.
            connection.readTimeout = if (action == "reset") 22 * 30_000 else 30_000
            connection.setRequestProperty("Content-Type", "application/json")
            connection.outputStream.use { it.write("{}".toByteArray()) }
            assertEquals("Generated $action control", 200, connection.responseCode)
            return JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
        } finally { connection.disconnect() }
    }
    private fun reset() {
        val value = control("reset")
        for (key in value.keys()) fixture.put(key, value.get(key))
        File(context.accountDirectory(), "central-native").deleteRecursively()
        CentralSession.get(context).select("")
        val settings = Settings(context)
        RuntimeSettings.replaceAccount(context) {
            settings.save(settings.read().copy(server = fixture.getString("address"), token = "", accountBinding = "", debugHttp = true,
                authSignedOut = true, authExpiresAt = 0, authProcess = "", syncMode = "manual", metadataEnabled = false), confirmCentralEndpoint = true)
        }
        val self = CentralClient(fixture.getString("address"), fixture.getJSONObject("a").getString("token")).get("/api/connections/self")
        assertEquals(fixture.getJSONObject("a").getString("userId"), self.getJSONObject("account").getString("userId"))
        assertEquals(ProtocolRange(2, 2), ProtocolCompatibility.requireCompatible(self.get("protocol")))
    }
    private fun views(root: View): List<View> = buildList {
        add(root); if (root is ViewGroup) repeat(root.childCount) { addAll(views(root.getChildAt(it))) }
    }
    private fun shown(activity: MainActivity) = views(activity.window.decorView).filter { it.isShown }
    private fun labels(activity: MainActivity) = shown(activity).filterIsInstance<TextView>().map { it.text.toString() }
    private fun waitFor(scenario: ActivityScenario<MainActivity>, reason: String, predicate: (MainActivity) -> Boolean) {
        val deadline = SystemClock.elapsedRealtime() + 20_000
        while (SystemClock.elapsedRealtime() < deadline) {
            var ready = false; scenario.onActivity { ready = predicate(it) }
            if (ready) { instrumentation.waitForIdleSync(); return }
            Thread.sleep(40)
        }
        fail(reason)
    }
    private fun click(scenario: ActivityScenario<MainActivity>, label: String, prefix: Boolean = false) {
        waitFor(scenario, "Original native action $label") { activity -> shown(activity).filterIsInstance<Button>().any {
            it.isEnabled && if (prefix) it.text.toString().startsWith(label) else it.text.toString() == label
        } }
        scenario.onActivity { activity -> assertTrue(shown(activity).filterIsInstance<Button>().first {
            it.isEnabled && if (prefix) it.text.toString().startsWith(label) else it.text.toString() == label
        }.performClick()) }
    }
    private fun login(scenario: ActivityScenario<MainActivity>) {
        waitFor(scenario, "Original account login") { activity -> shown(activity).any { it.contentDescription == MoteI18n.text("用户名") } }
        scenario.onActivity { activity ->
            shown(activity).filterIsInstance<EditText>().single { it.contentDescription == MoteI18n.text("用户名") }.setText("generated-a")
            shown(activity).filterIsInstance<EditText>().single { it.contentDescription == MoteI18n.text("密码") }.setText(fixture.getString("password"))
        }
        click(scenario, MoteI18n.text("登录并继续"))
        waitFor(scenario, "Owned account session ready") { activity -> labels(activity).none { it == MoteI18n.text("登录并继续") } }
    }
    private fun open(work: Boolean) = ActivityScenario.launch<MainActivity>(Intent(context, MainActivity::class.java)
        .putExtra("page", if (work) "ACTIVITY" else "ASK")).awaitMainUi()
    private fun conversation(scenario: ActivityScenario<MainActivity>, work: Boolean) {
        if (!work) {
            click(scenario, fixture.getString("title") + "\n", prefix = true)
        } else {
            click(scenario, MoteI18n.text("最近完成"))
            val title = fixture.optString("workTitle", fixture.getString("title"))
            waitFor(scenario, "Original work list") { activity -> shown(activity).any { it.isClickable && it.contentDescription?.startsWith(title + ". ") == true } }
            scenario.onActivity { activity -> assertTrue(shown(activity).single { it.isClickable && it.contentDescription?.startsWith(title + ". ") == true }.performClick()) }
            waitFor(scenario, "Original work sections") { activity -> shown(activity).filterIsInstance<Spinner>().any { it.contentDescription == MoteI18n.text("工作详情") } }
            scenario.onActivity { activity ->
                val selector = shown(activity).filterIsInstance<Spinner>().single { it.contentDescription == MoteI18n.text("工作详情") }
                selector.setSelection((0 until selector.adapter.count).single { selector.adapter.getItem(it).toString() == MoteI18n.text("成果") })
            }
            click(scenario, MoteI18n.text("查看成果"))
        }
        waitFor(scenario, "Original saved conversation") { labels(it).contains(fixture.getString("answer")) || labels(it).contains(deleted) }
    }
    private fun assertCurrent(scenario: ActivityScenario<MainActivity>) = scenario.onActivity { activity ->
        val text = labels(activity)
        assertTrue(text.contains(fixture.getString("answer"))); assertTrue(text.contains(fixture.getString("excerpt")))
        assertFalse(text.contains(stale)); assertFalse(text.contains(deleted))
    }
    private fun assertStale(scenario: ActivityScenario<MainActivity>, older: Boolean = false) {
        val answer = fixture.getString(if (older) "olderAnswer" else "answer")
        val excerpt = fixture.getString(if (older) "olderExcerpt" else "excerpt")
        waitFor(scenario, "Original historical answer response must finish loading") { activity ->
            labels(activity).contains(answer) && shown(activity).filterIsInstance<TextView>().filter { it.tag == "central-status" }.all { it.text.isBlank() }
        }
        scenario.onActivity { activity ->
            val text = labels(activity)
            assertTrue("Historical version notice must accompany retained native answer", text.contains(stale))
            assertTrue(text.contains(answer)); assertTrue(text.contains(excerpt)); assertFalse(text.contains(deleted))
            assertTrue(shown(activity).filterIsInstance<Button>().any { it.text.toString().startsWith(MoteI18n.text("查看原文依据")) })
        }
    }
    private fun assertDeleted(scenario: ActivityScenario<MainActivity>) {
        waitFor(scenario, "Deleted history notice") { labels(it).contains(deleted) }
        scenario.onActivity { activity ->
            val text = labels(activity)
            assertFalse(text.contains(stale)); assertFalse(text.contains(fixture.getString("answer"))); assertFalse(text.contains(fixture.getString("excerpt")))
            assertFalse(text.contains(fixture.getString("olderAnswer"))); assertFalse(text.contains(fixture.getString("olderExcerpt")))
            assertFalse(shown(activity).filterIsInstance<Button>().any { it.text.toString().startsWith(MoteI18n.text("查看原文依据")) })
        }
    }
    private fun refresh(scenario: ActivityScenario<MainActivity>, work: Boolean) {
        if (!work) click(scenario, MoteI18n.text("刷新"))
        else {
            scenario.onActivity { activity -> assertTrue(shown(activity).single { it.contentDescription == MoteI18n.text("返回上级") }.performClick()) }
            click(scenario, MoteI18n.text("查看成果"))
        }
    }
    private fun waitForHeldRead() {
        val deadline = SystemClock.elapsedRealtime() + 20_000
        while (!control("state").getBoolean("readHeld")) {
            check(SystemClock.elapsedRealtime() < deadline) { "Original history HTTP read was not held" }
            Thread.sleep(40)
        }
    }
    private fun journey(work: Boolean) {
        reset()
        open(work).use { scenario ->
            login(scenario); conversation(scenario, work); assertCurrent(scenario)
            control("stale"); refresh(scenario, work); assertStale(scenario)
            click(scenario, MoteI18n.text("加载更早的对话")); assertStale(scenario, older = true)
            scenario.recreate(); scenario.awaitMainUi()
            if (work) click(scenario, MoteI18n.text("查看成果"))
            assertStale(scenario)
            if (work) {
                scenario.onActivity { activity -> assertTrue(shown(activity).single { it.contentDescription == MoteI18n.text("返回上级") }.performClick()) }
                control("arm-history-read")
                click(scenario, MoteI18n.text("查看成果"))
                waitForHeldRead()
                control("deleted"); control("release-history-read"); assertDeleted(scenario)
                scenario.onActivity { activity -> assertTrue(shown(activity).single { it.contentDescription == MoteI18n.text("返回上级") }.performClick()) }
                waitFor(scenario, "Deleted work results withdraw their conversation link") { activity ->
                    shown(activity).filterIsInstance<Spinner>().any { it.contentDescription == MoteI18n.text("工作详情") } &&
                        labels(activity).contains(MoteI18n.text("成果确认保存后会出现在这里。"))
                }
                scenario.onActivity { assertFalse(labels(it).contains(MoteI18n.text("查看成果"))) }
            } else {
                control("deleted"); refresh(scenario, false); assertDeleted(scenario)
                click(scenario, MoteI18n.text("加载更早的对话")); assertDeleted(scenario)
            }
        }
    }
    @Test fun originalAskKeepsHistoricalNoticeAcrossPagingRecreationAndDeletion() = journey(false)
    @Test fun originalWorkResultKeepsHistoricalNoticeAcrossPagingRecreationAndDeletion() = journey(true)
    @Test fun heldHistoricalAReaderCannotPublishAcrossBThemeAndAccountRecreation() {
        reset()
        open(false).use { scenario ->
            login(scenario); conversation(scenario, false); control("stale"); refresh(scenario, false); assertStale(scenario)
            control("arm-history-read"); refresh(scenario, false); waitForHeldRead()
            RuntimeSettings.replaceAccount(context) {
                Settings(context).signIn(fixture.getString("address"), fixture.getJSONObject("b").getString("token"), 2592000000L)
            }
            MoteAppearance.select(context, AppearancePreference.DARK)
            scenario.recreate(); scenario.awaitMainUi()
            click(scenario, fixture.getString("bTitle") + "\n", prefix = true)
            waitFor(scenario, "B own conversation is visible") { labels(it).contains(fixture.getString("bAnswer")) }
            control("release-history-read")
            val deadline = SystemClock.elapsedRealtime() + 20_000
            while (control("state").getInt("heldReadCompleted") == 0) {
                check(SystemClock.elapsedRealtime() < deadline) { "Retired A response did not settle" }
                Thread.sleep(40)
            }
            instrumentation.waitForIdleSync()
            scenario.onActivity { activity ->
                val text = labels(activity)
                assertTrue(text.contains(fixture.getString("bAnswer")))
                assertFalse(text.contains(fixture.getString("answer"))); assertFalse(text.contains(fixture.getString("excerpt")))
                assertFalse(text.contains(stale)); assertFalse(text.contains(deleted))
                assertEquals(android.content.res.Configuration.UI_MODE_NIGHT_YES,
                    activity.resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK)
            }
        }
    }
    @Test fun newProcessPhaseOneRetainsOriginalOwnerHistory() {
        reset()
        open(false).use { scenario ->
            login(scenario); conversation(scenario, false); control("stale"); refresh(scenario, false); assertStale(scenario)
            CentralDraftWrites.barrier { }
            File(context.filesDir, "history-process.json").writeText(JSONObject().put("pid", android.os.Process.myPid())
                .put("started", android.os.Process.getStartElapsedRealtime()).toString())
        }
    }
    @Test fun newProcessPhaseTwoReadsRetainedHistoryAndThenErasesIt() {
        val state = control("state")
        for (key in state.keys()) fixture.put(key, state.get(key))
        val previous = JSONObject(File(context.filesDir, "history-process.json").readText())
        assertTrue("The persisted conversation must be read by a genuinely new process",
            previous.getInt("pid") != android.os.Process.myPid() || previous.getLong("started") != android.os.Process.getStartElapsedRealtime())
        open(false).use { scenario ->
            waitFor(scenario, "Persisted owner and conversation must restore in a new process") { labels(it).contains(fixture.getString("answer")) }
            assertStale(scenario)
            click(scenario, MoteI18n.text("加载更早的对话")); assertStale(scenario, older = true)
            control("deleted"); refresh(scenario, false); assertDeleted(scenario)
        }
    }
}
