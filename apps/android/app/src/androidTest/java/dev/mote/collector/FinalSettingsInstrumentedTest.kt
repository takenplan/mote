package dev.mote.collector

import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.widget.CheckBox
import android.widget.Spinner
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/** Tests the native final settings routes with generated configuration on the dedicated AVD. */
@RunWith(AndroidJUnit4::class)
class FinalSettingsInstrumentedTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private fun views(root: View): List<View> = listOf(root) + if (root is ViewGroup) (0 until root.childCount).flatMap { views(root.getChildAt(it)) } else emptyList()
    private fun shown(activity: MainActivity) = views(activity.window.decorView).filter { it.isShown }
    private fun waitFor(scenario: ActivityScenario<MainActivity>, check: (MainActivity) -> Boolean) {
        val deadline = SystemClock.elapsedRealtime() + 15_000
        while (SystemClock.elapsedRealtime() < deadline) { var ready = false; scenario.onActivity { ready = check(it) }; if (ready) return; Thread.sleep(40) }
        var labels = ""; scenario.onActivity { labels = shown(it).filterIsInstance<TextView>().joinToString(" | ") { it.text.toString() } }
        fail("The generated settings surface did not become ready: $labels")
    }
    private fun click(activity: MainActivity,label: String) = shown(activity).filterIsInstance<TextView>().single { it.isClickable && it.text.toString() == label }.performClick()
    private fun row(activity: MainActivity,label: String) = shown(activity).single { it.tag == "menu:$label" }.performClick()
    private fun dialogWindows(title: String) = android.view.inspector.WindowInspector.getGlobalWindowViews().filter { root ->
        root.findViewById<View>(android.R.id.button1) != null &&
            views(root).filterIsInstance<TextView>().any { it.isShown && it.text.toString() == title }
    }
    private fun overlay(title: String) = dialogWindows(title).single()
    private fun capture(scenario: ActivityScenario<MainActivity>,name: String,title: String? = null) {
        val frames = java.util.concurrent.CountDownLatch(1)
        scenario.onActivity { it.window.decorView.postOnAnimation { it.window.decorView.postOnAnimation { frames.countDown() } } }
        assertTrue(frames.await(5,java.util.concurrent.TimeUnit.SECONDS))
        scenario.onActivity { GeneratedWindowRendering.save(it,File(context.filesDir,"ui-final-settings").apply { mkdirs() },name,if (title == null) emptyList() else listOf(overlay(title))) }
    }
    private fun generatedOnly() {
        org.junit.Assume.assumeTrue(InstrumentationRegistry.getArguments().getString("uiFinalFixture") == "true")
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("emu64a"))
        require(!Settings(context).enabled)
        MoteI18n.select(context,"zh-CN"); MoteAppearance.select(context,AppearancePreference.LIGHT)
    }
    @Test fun settingsRoutesKeepAllLanguageChoicesAndPermissionsDoNotStartCapture() {
        generatedOnly()
        ActivityScenario.launch<MainActivity>(Intent(context,MainActivity::class.java).putExtra("page","SETTINGS")).awaitMainUi().use { scenario ->
            capture(scenario,"final-settings")
            scenario.onActivity { row(it,"偏好与本机维护") }
            capture(scenario,"final-device-options")
            scenario.onActivity { row(it,"外观与语言") }
            scenario.onActivity { activity ->
                val selects = shown(activity).filterIsInstance<Spinner>()
                assertEquals(listOf(3,8),selects.map { it.count })
                selects[0].setSelection(AppearancePreference.entries.indexOf(AppearancePreference.DARK))
            }
            waitFor(scenario) { MoteAppearance.preference() == AppearancePreference.DARK }
            scenario.onActivity { shown(it).filterIsInstance<Spinner>()[0].setSelection(AppearancePreference.entries.indexOf(AppearancePreference.LIGHT)) }
            waitFor(scenario) { MoteAppearance.preference() == AppearancePreference.LIGHT }
            capture(scenario,"final-appearance")
            scenario.onActivity { it.onBackPressed(); row(it,"系统权限与后台运行") }
            waitFor(scenario) { shown(it).filterIsInstance<TextView>().none { it.text.toString() == "正在检查系统权限…" } }
            capture(scenario,"final-permissions")
            scenario.onActivity { activity -> click(activity,"返回采集范围"); assertFalse(Settings(context).enabled) }
            waitFor(scenario) { shown(it).any { it.tag == "app-default-summary" } && shown(it).filterIsInstance<TextView>().none { row -> row.text.toString() == "正在读取已安装应用…" } }
            capture(scenario,"final-capture-range")
        }
    }
    @Test fun observationCancelKeepsSettingsAndSavePreservesUnsubmittedAppScope() {
        generatedOnly()
        val settings = Settings(context); val original = settings.read()
        try {
            ActivityScenario.launch<MainActivity>(Intent(context,MainActivity::class.java).putExtra("page","CAPTURE")).awaitMainUi().use { scenario ->
                waitFor(scenario) { shown(it).any { it.tag == "app-default-summary" } }
                scenario.onActivity { activity ->
                    shown(activity).single { it.tag == "app-default-summary" }.performClick()
                    val duration = shown(activity).filterIsInstance<CheckBox>().single { it.text.toString() == "默认：应用时长" }
                    duration.isChecked = !duration.isChecked
                    click(activity,"资料说明与其他设置"); click(activity,"通知与设备信息")
                }
                capture(scenario,"final-observations","通知与设备信息")
                scenario.onActivity {
                    val dialog = overlay("通知与设备信息")
                    val fields = views(dialog).filterIsInstance<CheckBox>(); assertEquals(3,fields.size)
                    fields[0].isChecked = !original.notificationCollectionEnabled
                    dialog.findViewById<View>(android.R.id.button2).performClick()
                    assertEquals(original,settings.read())
                }
                waitFor(scenario) { dialogWindows("通知与设备信息").isEmpty() }
                scenario.onActivity {
                    click(it,"通知与设备信息")
                }
                waitFor(scenario) {
                    dialogWindows("通知与设备信息").singleOrNull()?.findViewById<View>(android.R.id.button1)
                        ?.getTag(R.id.mote_button_role) == MoteUi.ButtonRole.PRIMARY
                }
                scenario.onActivity {
                    val next = overlay("通知与设备信息")
                    views(next).filterIsInstance<CheckBox>()[0].isChecked = !original.notificationCollectionEnabled
                    next.findViewById<View>(android.R.id.button1).performClick()
                }
                waitFor(scenario) { settings.read().notificationCollectionEnabled != original.notificationCollectionEnabled && !ConnectionGuard.changing() }
                scenario.onActivity { activity ->
                    val duration = views(activity.window.decorView).filterIsInstance<CheckBox>().single { it.text.toString() == "默认：应用时长" }
                    assertEquals(!original.collectionRules.defaultMode.duration,duration.isChecked)
                    assertEquals(original.appCollectionRules,settings.read().appCollectionRules)
                    assertTrue(shown(activity).filterIsInstance<TextView>().any { it.text.toString() == "有未保存的更改" })
                    assertFalse(settings.enabled)
                }
            }
        } finally { settings.save(original,confirmCentralEndpoint = true) }
    }
}
