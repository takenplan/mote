package dev.mote.collector

import android.os.Build
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

/** Separate opt-in process: force-stop only the dedicated generated dev package between runs.
 * Select Light -> Dark -> Auto -> Auto. The final run leaves the fixture following the OS. */
@RunWith(AndroidJUnit4::class)
class AppearanceRestartInstrumentedTest {
    @Test fun freshProcessReadsThePersistedChoiceBeforeOpeningItsActivity() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val arguments = InstrumentationRegistry.getArguments()
        val context = instrumentation.targetContext
        org.junit.Assume.assumeTrue(arguments.getString("appearanceFixture") == "true" &&
            arguments.getString("appearanceRestartExpected") != null && arguments.getString("appearanceRestartSelect") != null)
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("emu64a"))
        require(!Settings(context).enabled && Settings(context).read().token.isBlank() && context.queue().depth() == 0 && context.localSources().sources().isEmpty() && QuickNotes.draft(context).read() == NoteDraft())
        val expected = AppearancePreference.valueOf(requireNotNull(arguments.getString("appearanceRestartExpected")).uppercase())
        val next = AppearancePreference.valueOf(requireNotNull(arguments.getString("appearanceRestartSelect")).uppercase())
        // The product Application already initialized in this new process; do not initialize it here.
        assertEquals(expected, MoteAppearance.preference())
        assertEquals(expected.value, context.getSharedPreferences("mote.appearance", 0).getString("appearance", "auto"))
        ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
            scenario.onActivity { activity ->
                val dark = expected.dark(MoteAppearance.systemDark())
                assertEquals(android.graphics.Color.parseColor(if (dark) "#1c1b1a" else "#f7f5f1"), MoteTheme.background)
                val flags = activity.window.insetsController!!.systemBarsAppearance
                assertEquals(!dark, flags and android.view.WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS != 0)
                MoteAppearance.select(activity, next)
                assertEquals(next.value, context.getSharedPreferences("mote.appearance", 0).getString("appearance", null))
            }
        }
    }
}
