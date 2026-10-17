package dev.mote.collector

import android.app.UiModeManager
import android.content.Context
import android.content.res.Configuration
import android.os.Build
import android.os.SystemClock
import android.util.TypedValue
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/** Observe package-qualified resources independently of MoteAppearance.wrap and its palette. */
internal fun assertPlatformAppearance(context: Context, dark: Boolean): JSONObject {
    val application = context.applicationContext
    val night = if (dark) Configuration.UI_MODE_NIGHT_YES else Configuration.UI_MODE_NIGHT_NO
    val color = android.graphics.Color.parseColor(if (dark) "#1c1b1a" else "#f7f5f1")
    val deadline = SystemClock.elapsedRealtime() + 10000
    while (application.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK != night && SystemClock.elapsedRealtime() < deadline) Thread.sleep(20)
    assertEquals("Application resources must follow the resolved package appearance", night, application.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK)
    assertEquals("Day/night color resource before a scoped Activity is created", color, application.getColor(R.color.mote_background))
    val launchTheme = application.resources.newTheme().apply { applyStyle(R.style.AppTheme, true) }
    val splash = TypedValue()
    assertTrue("Manifest launch theme supplies a native splash background", launchTheme.resolveAttribute(android.R.attr.windowSplashScreenBackground, splash, true))
    val splashColor = if (splash.type in TypedValue.TYPE_FIRST_COLOR_INT..TypedValue.TYPE_LAST_COLOR_INT) splash.data else application.getColor(splash.resourceId)
    assertEquals("Native launch theme must agree with package-qualified colors", color, splashColor)
    return JSONObject().put("nightMask", night).put("background", String.format("#%08x", color)).put("splashBackground", String.format("#%08x", splashColor))
}

@RunWith(AndroidJUnit4::class)
class AppearancePlatformInstrumentedTest {
    @Test fun autoAfterEitherExplicitChoiceUsesTheManuallySelectedSystemResourcesAndLaunchTheme() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        org.junit.Assume.assumeTrue(InstrumentationRegistry.getArguments().getString("appearanceFixture") == "true" && Build.VERSION.SDK_INT >= 31)
        val context = instrumentation.targetContext
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("emu64a"))
        require(!Settings(context).enabled && Settings(context).read().token.isBlank() && context.queue().depth() == 0 && context.localSources().sources().isEmpty() && QuickNotes.draft(context).read() == NoteDraft())
        val manager = context.getSystemService(UiModeManager::class.java)
        val originalMode = manager.nightMode
        val originalChoice = MoteAppearance.preference()
        fun system(value: String) {
            instrumentation.uiAutomation.executeShellCommand("cmd uimode night $value").use { java.io.FileInputStream(it.fileDescriptor).readBytes() }
            instrumentation.waitForIdleSync()
        }
        val results = JSONArray()
        try {
            for (dark in listOf(false, true)) {
                system(if (dark) "yes" else "no")
                assertEquals(if (dark) UiModeManager.MODE_NIGHT_YES else UiModeManager.MODE_NIGHT_NO, manager.nightMode)
                for (explicit in listOf(AppearancePreference.LIGHT, AppearancePreference.DARK)) {
                    instrumentation.runOnMainSync { MoteAppearance.select(context, explicit) }
                    assertPlatformAppearance(context, explicit == AppearancePreference.DARK)
                    instrumentation.runOnMainSync { MoteAppearance.select(context, AppearancePreference.AUTO) }
                    val report = assertPlatformAppearance(context, dark).put("from", explicit.value).put("system", if (dark) "dark" else "light")
                    ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
                        scenario.onActivity { activity ->
                            assertEquals(if (dark) Configuration.UI_MODE_NIGHT_YES else Configuration.UI_MODE_NIGHT_NO, activity.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK)
                            assertEquals(context.getColor(R.color.mote_background), MoteTheme.background)
                            assertEquals(AppearancePreference.AUTO, MoteAppearance.preference())
                        }
                    }
                    results.put(report)
                }
            }
            File(context.getExternalFilesDir(null), "appearance-platform.json").writeText(JSONObject().put("sdk", Build.VERSION.SDK_INT).put("build", Build.ID).put("cases", results).toString(2))
        } finally {
            instrumentation.runOnMainSync { MoteAppearance.select(context, originalChoice) }
            system(when (originalMode) { UiModeManager.MODE_NIGHT_NO -> "no"; UiModeManager.MODE_NIGHT_YES -> "yes"; else -> "auto" })
        }
    }
}
