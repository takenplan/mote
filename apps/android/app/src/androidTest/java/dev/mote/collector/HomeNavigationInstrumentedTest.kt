package dev.mote.collector

import android.os.Build
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.net.InetAddress
import java.net.ServerSocket
import java.util.concurrent.Executors

/** Generated data on the task-owned emulator; no capture, user account or model is used. */
@RunWith(AndroidJUnit4::class)
class HomeNavigationInstrumentedTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private val conversation = "14d4ef91-48c4-4372-b9ac-008f59b71e46"
    private fun views(root: View): List<View> = listOf(root) + if (root is ViewGroup) (0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
    private fun shown(activity: MainActivity) = views(activity.window.decorView).filter { it.isShown }
    private fun waitFor(scenario: ActivityScenario<MainActivity>, description: String, check: (MainActivity) -> Boolean) {
        val until = SystemClock.elapsedRealtime() + 20000
        while (SystemClock.elapsedRealtime() < until) {
            var done = false; scenario.onActivity { done = check(it) }
            if (done) return
            Thread.sleep(50)
        }
        var labels = ""; scenario.onActivity { labels = shown(it).filterIsInstance<TextView>().joinToString(" | ") { row -> row.text.toString() } }
        fail("$description: $labels")
    }
    private fun screenshot(scenario: ActivityScenario<MainActivity>, name: String) {
        waitFor(scenario, "The requested screen must finish its foreground read before visual comparison") { activity ->
            shown(activity).filterIsInstance<TextView>().none { it.tag == "central-status" && it.text.isNotBlank() }
        }
        val committed = java.util.concurrent.CountDownLatch(1)
        scenario.onActivity { it.window.decorView.postOnAnimation { it.window.decorView.postOnAnimation { committed.countDown() } } }
        assertTrue("The native window must draw before its screenshot", committed.await(5, java.util.concurrent.TimeUnit.SECONDS))
        instrumentation.waitForIdleSync()
        scenario.onActivity { activity -> GeneratedWindowRendering.save(activity, File(context.filesDir, "ui-final-home").apply { mkdirs() }, name) }
    }

    @Before fun generatedOnly() {
        org.junit.Assume.assumeTrue(InstrumentationRegistry.getArguments().getString("uiFinalFixture") == "true")
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("emu64a"))
        require(!Settings(context).enabled)
        MoteI18n.select(context, "zh-CN")
        MoteAppearance.select(context, AppearancePreference.LIGHT)
    }

    @Test fun recentConversationAndDraftSurviveMenuAndBackWithoutPersistentTabs() {
        ConversationFixture().use { fixture ->
            val settings = Settings(context)
            settings.save(settings.read().copy(server = fixture.origin, token = "generated-home-owner-token-1234567890", debugHttp = true, syncMode = "manual", syncPaused = true, authSignedOut = false), confirmCentralEndpoint = true)
            File(context.noBackupFilesDir, "central-native/" + SourceRules.hash(fixture.origin)).deleteRecursively()
            ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
                waitFor(scenario, "Recent history must load from the selected Central") { shown(it).any { row -> row.tag == "home-conversation:$conversation" } }
                screenshot(scenario, "home-recent")
                scenario.onActivity { activity ->
                    assertTrue(shown(activity).any { it.tag == "home-record-action" })
                    assertTrue(shown(activity).any { it.tag == "home-ask-action" })
                    assertFalse(shown(activity).any { it.tag?.toString()?.startsWith("primary:") == true })
                    assertFalse("An intentional capture pause is not a home error", shown(activity).any { it.tag == "home-attention" })
                    activity.openGeneratedMenu()
                    for (label in listOf("资料与记忆", "发现历史", "日程与待办", "采集与同步", "设置", "中央工作台"))
                        assertTrue("Secondary capability remains reachable: $label", shown(activity).any { it.tag == "menu:$label" })
                    assertFalse(shown(activity).any { it.tag == "home-record-action" })
                }
                screenshot(scenario, "home-menu")
                scenario.onActivity { activity ->
                    activity.onBackPressed()
                    shown(activity).single { it.tag == "home-conversation:$conversation" }.performClick()
                }
                waitFor(scenario, "The clicked summary opens its original conversation") { shown(it).filterIsInstance<TextView>().any { row -> row.text.toString() == "这是已提交的生成回答。" } }
                assertEquals(conversation, fixture.openedId)
                scenario.onActivity { activity ->
                    shown(activity).filterIsInstance<EditText>().single { it.contentDescription == "你的问题" }.setText("生成的未发送草稿")
                    activity.onBackPressed()
                    activity.openGeneratedMenu(); activity.onBackPressed()
                    shown(activity).single { it.tag == "home-ask-action" }.performClick()
                }
                waitFor(scenario, "Menu and home transitions preserve the existing native draft") { shown(it).filterIsInstance<EditText>().any { field -> field.contentDescription == "你的问题" && field.text.toString() == "生成的未发送草稿" } }
                scenario.onActivity { assertFalse(Settings(it).enabled) }
                screenshot(scenario, "ask-retained-draft")
                scenario.recreate(); scenario.awaitMainUi()
                waitFor(scenario, "Recreation preserves draft and secondary back path") { shown(it).filterIsInstance<EditText>().any { field -> field.text.toString() == "生成的未发送草稿" } }
                scenario.onActivity { it.onBackPressed(); assertTrue(shown(it).any { row -> row.tag == "home-record-action" }) }
            }
            settings.save(settings.read().copy(server = "", token = "", debugHttp = false), confirmCentralEndpoint = true)
        }
    }

    @Test fun failedHistoryIsDistinctFromEmptyAndUnconnectedFirstUseKeepsLocalRecording() {
        ConversationFixture().use { fixture ->
            val settings = Settings(context)
            settings.save(settings.read().copy(server = fixture.origin, token = "generated-home-owner-token-1234567890", debugHttp = true, syncMode = "manual", authSignedOut = false), confirmCentralEndpoint = true)
            for (failure in listOf("http", "missing-items", "invalid-id")) {
                fixture.failure = failure
                ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
                    waitFor(scenario, "Read failure is reported as a failure, not an empty history") { shown(it).filterIsInstance<TextView>().any { row -> row.text.toString() == "对话暂不可读取，请稍后重试。" } }
                    scenario.onActivity { assertFalse(shown(it).filterIsInstance<TextView>().any { row -> row.text.toString() == "还没有对话。" }) }
                    if (failure == "http") screenshot(scenario, "home-history-error")
                }
            }
            settings.save(settings.read().copy(server = "", token = "", debugHttp = false), confirmCentralEndpoint = true)
        }
        context.recordDraftStore().edit("生成的本机草稿", JSONArray(), JSONObject().put("kind", "manual"))
        try { ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
            waitFor(scenario, "Unconnected local drafts remain available") { shown(it).any { row -> row.contentDescription == "继续草稿" } }
            screenshot(scenario, "home-first-use-draft")
            scenario.onActivity { activity ->
                assertFalse(Settings(activity).enabled)
                assertTrue(shown(activity).any { it.tag == "home-ask-action" })
                activity.openGeneratedMenu()
                shown(activity).single { it.tag == "menu:设置" }.performClick()
                assertFalse(shown(activity).any { it.tag == "home-record-action" })
                activity.onBackPressed(); activity.onBackPressed()
                assertEquals("生成的本机草稿", context.recordDraftStore().draft().getString("text"))
            }
        } } finally { context.recordDraftStore().edit("", JSONArray(), JSONObject().put("kind", "manual")) }
    }

    @Test fun permissionInterruptionAndStaleConversationDoNotStartOrCrossTargets() {
        ConversationFixture().use { fixture ->
            val settings = Settings(context)
            settings.save(settings.read().copy(server = fixture.origin, token = "generated-home-owner-token-1234567890", debugHttp = true, syncMode = "manual", authSignedOut = false), confirmCentralEndpoint = true)
            settings.status("permission_required", "生成的权限中断，请恢复权限")
            try {
                ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
                    waitFor(scenario, "A service interruption stays visible after capture safely stops") { shown(it).any { row -> row.tag == "home-attention" } }
                    waitFor(scenario, "Conversation row is ready") { shown(it).any { row -> row.tag == "home-conversation:$conversation" } }
                    scenario.onActivity { activity ->
                        val stale = shown(activity).single { it.tag == "home-conversation:$conversation" }
                        settings.save(settings.read().copy(server = "", token = "", debugHttp = false), confirmCentralEndpoint = true)
                        stale.performClick()
                        assertTrue(shown(activity).any { it.tag == "home-record-action" })
                        assertFalse(shown(activity).any { it.tag == "home-conversation:$conversation" })
                        assertFalse(settings.enabled)
                    }
                }
            } finally { settings.status("paused", "生成的主动暂停"); settings.save(settings.read().copy(server = "", token = "", debugHttp = false), confirmCentralEndpoint = true) }
        }
    }

    private inner class ConversationFixture : AutoCloseable {
        private val listener = ServerSocket(0, 8, InetAddress.getByName("127.0.0.1"))
        val origin = "http://127.0.0.1:${listener.localPort}"
        @Volatile var failure = ""
        @Volatile var openedId: String? = null
        private val executor = Executors.newSingleThreadExecutor()
        init { executor.submit {
            while (!listener.isClosed) runCatching { listener.accept() }.getOrNull()?.use { socket ->
                val input = socket.getInputStream().bufferedReader()
                val first = input.readLine().orEmpty(); val path = first.split(' ').getOrElse(1) { "" }
                while (!input.readLine().isNullOrBlank()) Unit
                val isHistory = path.startsWith("/api/conversations?")
                val isFailure = failure == "http" && isHistory
                val body = when {
                    isFailure -> JSONObject().put("error", "generated_failure")
                    isHistory && failure == "missing-items" -> JSONObject().put("unrelated", true)
                    isHistory && failure == "invalid-id" -> JSONObject().put("items", JSONArray().put(JSONObject().put("id", "not-a-conversation-id")))
                    path.startsWith("/api/conversations?") -> JSONObject().put("items", JSONArray().put(JSONObject().put("id", conversation).put("title", "周五评审需要准备什么？").put("updatedAt", "2026-10-28T10:00:00Z").put("turnCount", 1)))
                    path.startsWith("/api/conversations/") -> { openedId = path.substringAfter("/api/conversations/").substringBefore('?'); JSONObject().put("id", conversation).put("scope", JSONObject()).put("turns", JSONArray().put(JSONObject().put("question", "周五评审需要准备什么？").put("result", JSONObject().put("answer", "这是已提交的生成回答。").put("citations", JSONArray())))) }
                    path.startsWith("/api/model-settings") -> JSONObject().put("profiles", JSONArray())
                    else -> JSONObject().put("items", JSONArray())
                }.toString().toByteArray()
                val status = if (isFailure) "503 Service Unavailable" else "200 OK"
                socket.getOutputStream().apply { write("HTTP/1.1 $status\r\nContent-Type: application/json\r\nContent-Length: ${body.size}\r\nConnection: close\r\n\r\n".toByteArray()); write(body); flush() }
            }
        } }
        override fun close() { listener.close(); executor.shutdownNow() }
    }
}
