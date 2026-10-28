package dev.mote.collector

import android.content.pm.ActivityInfo
import android.content.Intent
import android.content.res.Configuration
import android.os.Build
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Only a newly generated, explicitly named task-private AVD may own this fixture's app data. */
@RunWith(AndroidJUnit4::class)
class NoteDraftLifecycleInstrumentedTest {
    private fun views(root: View): List<View> = buildList {
        add(root)
        if (root is ViewGroup) repeat(root.childCount) { addAll(views(root.getChildAt(it))) }
    }
    private fun editor(activity: MainActivity) = views(activity.window.decorView).filterIsInstance<EditText>()
        .single { it.contentDescription?.toString() == MoteI18n.text("正在想什么") }
    private fun await(message: String, condition: () -> Boolean) {
        val deadline = SystemClock.elapsedRealtime() + 10_000
        while (!condition() && SystemClock.elapsedRealtime() < deadline) Thread.sleep(25)
        assertTrue(message, condition())
    }
    private fun ActivityScenario<MainActivity>.awaitEditor(): ActivityScenario<MainActivity> {
        await("The real note page must finish its background draft read") {
            var ready = false
            onActivity { ready = editor(it).isEnabled }
            ready
        }
        return this
    }

    @Test fun acceptedDraftSurvivesNavigationRotationAndDestroyWithoutUpdatingRetiredViews() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val fixture = "mote_a13_acceptance_20261029"
        require(InstrumentationRegistry.getArguments().getString("fixtureAvd") == fixture)
        val avd = instrumentation.uiAutomation.executeShellCommand("getprop ro.boot.qemu.avd_name").use {
            ParcelFileDescriptor.AutoCloseInputStream(it).bufferedReader().use { reader -> reader.readText().trim() }
        }
        require(avd == fixture && Build.VERSION.SDK_INT == 37 && context.packageName == "dev.mote.collector.dev")
        val settings = Settings(context)
        require(!settings.enabled && !CaptureAccessibilityService.connected && !ProjectionService.running)
        require(settings.read().token.isBlank() && context.queue().depth() == 0 && QuickNotes.draft(context).read().text.isEmpty())
        val original = settings.read()
        val language = MoteI18n.preference()
        val release = CountDownLatch(1)
        val entered = CountDownLatch(1)
        val text = "Generated accepted note before rotation\n  保留原文与空白。🙂  "
        var scenario: ActivityScenario<MainActivity>? = null
        try {
            settings.save(original.copy(server = "", token = "", syncMode = "manual"))
            MoteI18n.select(context, "zh-CN")
            fun noteIntent() = Intent(context, MainActivity::class.java).putExtra("page", "NOTES")
            val first = ActivityScenario.launch<MainActivity>(noteIntent()).awaitMainUi()
            scenario = first
            first.awaitEditor()
            lateinit var oldActivity: MainActivity
            lateinit var oldEditor: EditText
            lateinit var oldProgress: TextView
            QuickNotes.io.execute { entered.countDown(); check(release.await(30, TimeUnit.SECONDS)) }
            assertTrue(entered.await(5, TimeUnit.SECONDS))
            first.onActivity { activity ->
                oldActivity = activity
                oldEditor = editor(activity)
                oldEditor.setText(text) // Actual TextWatcher accepts the write while the app executor is held.
                oldProgress = views(activity.window.decorView).filterIsInstance<TextView>()
                    .single { it.text.toString() == MoteI18n.text("正在保存草稿…") }
                views(activity.window.decorView).single { it.tag == "primary:SOURCES" }.performClick()
                assertFalse(oldEditor.isShown)
                activity.startActivity(noteIntent().addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP))
            }
            await("The existing NOTES intent must return to the same page") {
                var shown = false
                first.onActivity { shown = editor(it).isShown }
                shown
            }
            first.onActivity { activity ->
                assertSame(oldEditor, editor(activity))
                assertTrue(oldEditor.isShown)
                assertEquals(text, oldEditor.text.toString())
                activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
            }
            await("An actual orientation change must destroy the previous Activity") { oldActivity.isDestroyed }
            first.awaitMainUi()
            lateinit var replacement: MainActivity
            lateinit var replacementEditor: EditText
            lateinit var replacementProgress: TextView
            first.onActivity { activity ->
                replacement = activity
                assertNotSame(oldActivity, activity)
                assertEquals(Configuration.ORIENTATION_LANDSCAPE, activity.resources.configuration.orientation)
                replacementEditor = editor(activity)
                assertFalse("The queued read must not run ahead of the accepted write", replacementEditor.isEnabled)
                replacementProgress = views(activity.window.decorView).filterIsInstance<TextView>()
                    .single { it.text.toString().startsWith(MoteI18n.text("正在读取草稿…")) }
            }
            first.close(); scenario = null
            assertTrue(replacement.isDestroyed)
            val oldStatus = oldProgress.text.toString()
            val replacementStatus = replacementProgress.text.toString()
            release.countDown()
            QuickNotes.io.submit {}.get(10, TimeUnit.SECONDS)
            assertEquals(text, QuickNotes.draft(context).read().text)
            // Wait beyond UiTask's 500 ms polling interval after the queued read completes.
            Thread.sleep(650)
            instrumentation.runOnMainSync {
                assertEquals(text, oldEditor.text.toString())
                assertEquals(oldStatus, oldProgress.text.toString())
                assertEquals("", replacementEditor.text.toString())
                assertFalse(replacementEditor.isEnabled)
                assertEquals(replacementStatus, replacementProgress.text.toString())
            }
            ActivityScenario.launch<MainActivity>(noteIntent()).awaitMainUi().use { reopened ->
                reopened.awaitEditor().onActivity { assertEquals(text, editor(it).text.toString()) }
            }
            assertFalse(settings.enabled)
            assertEquals(0, context.queue().depth())
        } finally {
            release.countDown(); scenario?.close()
            QuickNotes.io.submit {}.get(10, TimeUnit.SECONDS)
            QuickNotes.draft(context).clear()
            settings.save(original)
            MoteI18n.select(context, language)
        }
    }
}
