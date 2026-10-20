package dev.mote.collector

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.WorkManager
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.UUID
import java.util.concurrent.TimeUnit

/** Real native entry points with multiuser-ask-backend's generated HTTP model only. */
@RunWith(AndroidJUnit4::class)
class NativeAskParityInstrumentedTest {
    private fun context(): Context = InstrumentationRegistry.getInstrumentation().targetContext.also {
        require(it.packageName == "dev.mote.collector.m15fixture")
        require(Build.FINGERPRINT.contains("sdk_gphone") || Build.FINGERPRINT.contains("emu64"))
    }
    private fun fixture() = JSONObject(File(InstrumentationRegistry.getArguments().getString("fixture")!!).readText())
    private fun endpoint() = fixture().getString("androidAddress")
    private fun token(name: String) = fixture().getJSONObject(name).getString("token")
    private fun api(name: String) = CentralClient(endpoint(), token(name))
    private fun control(path: String): JSONObject {
        val (status, result) = HttpJson.post(fixture().getString("androidControlAddress") + path, JSONObject())
        assertEquals("Generated Ask fixture control $path", 200, status)
        return requireNotNull(result)
    }
    private fun waitFor(label: String, predicate: () -> Boolean) {
        val deadline = SystemClock.elapsedRealtime() + 45_000
        while (!predicate()) {
            check(SystemClock.elapsedRealtime() < deadline) { "Generated native Ask deadline: $label" }
            Thread.sleep(40)
        }
    }
    private fun rows(value: JSONArray) = (0 until value.length()).map(value::getJSONObject)
    private fun runs(client: CentralClient) = rows(client.get("/api/query-runs?limit=100").getJSONArray("items"))
    private fun runIds(client: CentralClient) = runs(client).map { it.getString("id") }.toSet()
    private fun newRun(client: CentralClient, before: Set<String>): JSONObject {
        var found: JSONObject? = null
        waitFor("native admission") {
            val added = runs(client).filter { it.getString("id") !in before }
            assertTrue("One native send must admit at most one run", added.size <= 1)
            found = added.singleOrNull()
            found != null
        }
        return requireNotNull(found)
    }
    private fun terminal(client: CentralClient, id: String, status: String): JSONObject {
        var result: JSONObject? = null
        waitFor("$status run $id") {
            result = client.get("/api/query-runs/$id")
            result!!.getString("status") != "running"
        }
        assertEquals(result!!.optJSONObject("error")?.optString("code"), status, result!!.getString("status"))
        return requireNotNull(result)
    }
    private fun login(app: Context, name: String) {
        RuntimeSettings.replaceAccount(app) { Settings(app).signIn(endpoint(), token(name), 2592000000L) }
    }
    private fun prepare(): Context {
        val app = context()
        waitFor("local recovery") { !QueueStorage.recovering && QueueStorage.recoveryFailure == null }
        WorkManager.getInstance(app).cancelAllWork().result.get(15, TimeUnit.SECONDS)
        waitFor("account reconfiguration drain") { !ConnectionGuard.changing() && ConnectionGuard.processing.get() == 0 }
        val settings = Settings(app)
        settings.save(settings.read().copy(server = "", token = "", debugHttp = true, wifiOnly = false, syncMode = "manual", metadataEnabled = false))
        login(app, "a")
        MoteI18n.select(app, "zh-CN")
        return app
    }
    private fun views(view: View): List<View> = listOf(view) + if (view is ViewGroup) {
        (0 until view.childCount).flatMap { views(view.getChildAt(it)) }
    } else emptyList()

    private inner class AskScreen(private val scenario: ActivityScenario<CentralActivity>) {
        fun ready() = waitFor("native Ask controls") {
            var ready = false
            scenario.onActivity { activity ->
                ready = activity.client != null && !activity.isWorking && views(activity.window.decorView)
                    .filterIsInstance<EditText>().any { it.contentDescription == "你的问题" }
            }
            ready
        }
        fun texts(): List<String> {
            var result = emptyList<String>()
            scenario.onActivity { activity -> result = views(activity.window.decorView).filterIsInstance<TextView>().map { it.text.toString() } }
            return result
        }
        fun question(): String {
            var value = ""
            scenario.onActivity { activity -> value = views(activity.window.decorView).filterIsInstance<EditText>().single { it.contentDescription == "你的问题" }.text.toString() }
            return value
        }
        fun awaitText(value: String) = waitFor("native question, answer or failure visibility") { texts().contains(value) }
        fun press(label: String) {
            ready()
            scenario.onActivity { activity ->
                val button = views(activity.window.decorView).filterIsInstance<Button>().singleOrNull { it.text.toString() == label }
                assertNotNull("Missing original native Ask control: $label", button)
                assertTrue("Original native Ask control must be enabled: $label", button!!.isEnabled)
                button.performClick()
            }
        }
        fun send(value: String): Button {
            ready()
            lateinit var selected: Button
            scenario.onActivity { activity ->
                views(activity.window.decorView).filterIsInstance<EditText>().single { it.contentDescription == "你的问题" }.setText(value)
                selected = views(activity.window.decorView).filterIsInstance<Button>().single { it.text.toString() == "发送" }
                assertTrue(selected.isEnabled)
                selected.performClick()
            }
            return selected
        }
        fun history(client: CentralClient, conversationId: String) {
            press("刷新")
            ready()
            val item = rows(client.get("/api/conversations?limit=30").getJSONArray("items")).single { it.getString("id") == conversationId }
            val title = item.getString("title")
            assertTrue("The actual saved conversation must have a visible history title", title.isNotBlank())
            scenario.onActivity { activity ->
                val button = views(activity.window.decorView).filterIsInstance<Button>().singleOrNull { it.text.toString().startsWith(title + "\n") }
                assertNotNull("Saved conversation must remain reachable through original history controls", button)
                button!!.performClick()
            }
        }
    }

    @Test fun originalInputHistoryAndFailedAnswerRemainVisibleAndRetryThroughTheOriginalSendControl() {
        val app = prepare()
        val a = api("a"); val b = api("b")
        val bBefore = b.get("/api/conversations?limit=30").toString()
        val successfulQuestion = "Generated native Ask history ${UUID.randomUUID()}"
        val failedQuestion = "Generated native Ask failure retry ${UUID.randomUUID()}"
        ActivityScenario.launch<CentralActivity>(Intent(app, CentralActivity::class.java).putExtra("page", "ask")).use { scenario ->
            val screen = AskScreen(scenario)
            screen.ready()
            val before = runIds(a)
            screen.send(successfulQuestion)
            val successful = terminal(a, newRun(a, before).getString("id"), "completed")
            val answer = successful.getJSONObject("result").getString("answer")
            assertTrue(answer.isNotBlank())
            screen.awaitText(answer)
            assertEquals("Completed native sends clear the input", "", screen.question())
            screen.press("新对话")
            screen.history(a, successful.getString("conversationId"))
            screen.awaitText(successfulQuestion); screen.awaitText(answer)
            scenario.recreate(); screen.ready(); screen.awaitText(answer)

            screen.press("新对话"); screen.ready()
            control("/fail-next") // A real generated model HTTP failure, after native admission.
            val beforeFailure = runIds(a)
            screen.send(failedQuestion)
            val failed = terminal(a, newRun(a, beforeFailure).getString("id"), "failed")
            val conversationId = failed.getString("conversationId")
            var failedTurn: JSONObject? = null
            waitFor("durable failed conversation turn") {
                failedTurn = rows(a.get("/api/conversations/$conversationId?limit=20").getJSONArray("turns"))
                    .singleOrNull { it.getString("question") == failedQuestion && it.optString("status") == "failed" }
                failedTurn != null
            }
            val failureMessage = failedTurn!!.getJSONObject("error").optString("message")
            assertTrue("Original native failure reader consumes a nonempty turn.error.message", failureMessage.isNotBlank())
            screen.awaitText(failedQuestion); screen.awaitText(failureMessage)
            assertEquals("A failed answer keeps the original question for explicit retry", failedQuestion, screen.question())
            scenario.recreate(); screen.ready(); screen.awaitText(failedQuestion); screen.awaitText(failureMessage)
            assertEquals(failedQuestion, screen.question())

            // Accepted model failures use the existing Send control. Only an unconfirmed
            // admission has the separate same-request retry label in the native product.
            val beforeRetry = runIds(a)
            screen.press("发送")
            val retried = terminal(a, newRun(a, beforeRetry).getString("id"), "completed")
            assertNotEquals(failed.getString("id"), retried.getString("id"))
            assertEquals(conversationId, retried.getString("conversationId"))
            val retryAnswer = retried.getJSONObject("result").getString("answer")
            screen.awaitText(retryAnswer)
            val attempts = rows(a.get("/api/conversations/$conversationId?limit=20").getJSONArray("turns"))
                .filter { it.getString("question") == failedQuestion }
            assertEquals(listOf("failed", "completed"), attempts.map { it.getString("status") })
            screen.press("新对话"); screen.history(a, conversationId)
            screen.awaitText(failureMessage); screen.awaitText(retryAnswer)
            assertEquals(bBefore, b.get("/api/conversations?limit=30").toString())
        }
    }

    @Test fun aHeldAAnswerCannotEnterBAndNewNativeBInputStillCompletes() {
        val app = prepare()
        val a = api("a"); val b = api("b")
        val beforeA = runIds(a); val beforeB = runIds(b)
        val aQuestion = "Generated held native A question ${UUID.randomUUID()}"
        val bQuestion = "Generated independent native B question ${UUID.randomUUID()}"
        try {
            ActivityScenario.launch<CentralActivity>(Intent(app, CentralActivity::class.java).putExtra("page", "ask")).use { scenario ->
                val screen = AskScreen(scenario)
                screen.ready(); control("/hold-next")
                val detachedASend = screen.send(aQuestion)
                waitFor("actual generated A model hold") { control("/state").let { it.getBoolean("entered") && it.getBoolean("held") } }
                val held = newRun(a, beforeA)
                assertEquals("running", held.getString("status"))
                scenario.moveToState(Lifecycle.State.CREATED)
                login(app, "b")
                scenario.moveToState(Lifecycle.State.RESUMED)
                screen.ready()
                assertEquals("A question draft must retire before B controls are usable", "", screen.question())
                assertFalse(screen.texts().any { it.contains(aQuestion) })
                scenario.onActivity { detachedASend.performClick() }
                screen.ready()
                assertEquals("Detached A controls cannot admit a B request", beforeB, runIds(b))

                control("/release")
                val completedA = terminal(a, held.getString("id"), "completed")
                val aAnswer = completedA.getJSONObject("result").getString("answer")
                assertTrue(aAnswer.isNotBlank())
                screen.ready()
                assertFalse("Late A question must not enter B", screen.texts().contains(aQuestion))
                assertFalse("Late A answer must not enter B", screen.texts().contains(aAnswer))
                assertEquals(404, HttpJson.get(endpoint() + "/api/query-runs/" + held.getString("id"), token("b")).first)
                assertEquals(404, HttpJson.get(endpoint() + "/api/conversations/" + held.getString("conversationId"), token("b")).first)
                assertEquals(beforeB, runIds(b))

                screen.send(bQuestion)
                val completedB = terminal(b, newRun(b, beforeB).getString("id"), "completed")
                val bAnswer = completedB.getJSONObject("result").getString("answer")
                assertTrue(bAnswer.isNotBlank())
                assertNotEquals("Generated fixture answers must distinguish owners", aAnswer, bAnswer)
                screen.awaitText(bQuestion); screen.awaitText(bAnswer)
                assertFalse(screen.texts().contains(aQuestion)); assertFalse(screen.texts().contains(aAnswer))
                assertEquals(beforeA + held.getString("id"), runIds(a))
                assertEquals(beforeB + completedB.getString("id"), runIds(b))
            }
        } finally { control("/release") }
    }
}
