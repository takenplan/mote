package dev.mote.collector

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.view.View
import android.view.ViewGroup
import android.widget.Button
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

/** Explicit generated-only expansion/confirmation states, without granting any system permission. */
@RunWith(AndroidJUnit4::class)
class UiSupplementRolloutInstrumentedTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private fun views(root: View): List<View> = buildList {
        add(root); if (root is ViewGroup) repeat(root.childCount) { addAll(views(root.getChildAt(it))) }
    }
    private fun click(activity: Activity, key: String) {
        val button = views(activity.window.decorView).filterIsInstance<Button>().single { it.isShown && it.text.toString() == MoteI18n.text(key) }
        assertTrue(button.performClick())
    }
    private fun overlay() = android.view.inspector.WindowInspector.getGlobalWindowViews().single { root ->
        root.isShown && views(root).any { it.id in setOf(android.R.id.button1, android.R.id.button2) && it.isShown }
    }

    @Test fun explicitAdvancedPanelsAndNativeConfirmationFactsRemainReadable() {
        val args = InstrumentationRegistry.getArguments()
        assumeTrue(args.getString("uiIterationFixture") == "true" && args.getString("uiScrollEvidence") == "true")
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("/emu64a:"))
        val variant = args.getString("uiIterationVariant", "default")!!
        MoteI18n.select(context, if (variant.contains("english")) "en" else "zh-CN")
        Settings(context).enabled = false
        val directory = File(context.filesDir, "ui-state-evidence/$variant").apply { mkdirs() }
        fun save(activity: Activity, state: String, scene: String, dialog: Boolean = false) {
            val target = File(directory, state).apply { mkdirs() }
            GeneratedWindowRendering.save(activity, target, scene, if (dialog) listOf(overlay()) else emptyList())
            val metadataFile = File(target, "$scene.json")
            metadataFile.writeText(JSONObject(metadataFile.readText()).put("supplementState", state).put("automaticVisualAcceptance", false).toString(2))
            assertFalse(Settings(context).enabled)
        }
        ActivityScenario.launch<MainActivity>(Intent(context, MainActivity::class.java).putExtra("page", "SETTINGS")).awaitMainUi().use { scenario ->
            scenario.onActivity { click(it, "高级与维护") }; instrumentation.waitForIdleSync()
            scenario.onActivity { save(it, "settings-expanded", "settings") }
        }
        // Give the real native dialog a completed layout before drawing.
        ActivityScenario.launch<MainActivity>(Intent(context, MainActivity::class.java).putExtra("page", "SETTINGS")).awaitMainUi().use { scenario ->
            scenario.onActivity { activity ->
                val label = if (MoteI18n.language() == "en") "Language" else "界面语言"
                assertTrue(views(activity.window.decorView).single { it.isShown && it.tag == "menu:$label" }.performClick())
            }
            instrumentation.waitForIdleSync()
            scenario.onActivity { save(it, "language-choice", "settings", dialog = true); overlay().findViewById<View>(android.R.id.button2).performClick() }
        }
        ActivityScenario.launch<MainActivity>(Intent(context, MainActivity::class.java).putExtra("page", "PRIVACY")).awaitMainUi().use { scenario ->
            scenario.onActivity { activity ->
                listOf("高级：手工编辑包名规则", "高级：查看或编辑全部页面规则", "高级：编辑精确坐标", "高级：截图文字隐私审查").forEach { click(activity, it) }
            }
            instrumentation.waitForIdleSync()
            scenario.onActivity { save(it, "scope-all-advanced", "screen-scope"); click(it, "预览当前配置的记录格式") }
            instrumentation.waitForIdleSync()
            scenario.onActivity { save(it, "scope-preview-dialog", "screen-scope", dialog = true); overlay().findViewById<View>(android.R.id.button2).performClick() }
        }
        ActivityScenario.launch<MainActivity>(Intent(context, MainActivity::class.java).putExtra("page", "PERMISSIONS")).awaitMainUi().use { scenario ->
            scenario.onActivity { click(it, "启用无障碍截图服务") }; instrumentation.waitForIdleSync()
            scenario.onActivity { save(it, "accessibility-explanation", "rollout-permissions", dialog = true); overlay().findViewById<View>(android.R.id.button2).performClick() }
        }
        ActivityScenario.launch<MainActivity>(Intent(context, MainActivity::class.java).putExtra("page", "NOTES")).awaitMainUi().use { scenario ->
            val deadline = System.currentTimeMillis() + 10_000
            var ready = false
            while (!ready && System.currentTimeMillis() < deadline) { scenario.onActivity { ready = GeneratedWindowRendering.hasNoPendingLabels(it.window.decorView) }; if (!ready) Thread.sleep(30) }
            assertTrue(ready)
            scenario.onActivity { click(it, "新建一条 · 清除草稿") }; instrumentation.waitForIdleSync()
            scenario.onActivity { save(it, "note-clear-confirmation", "note", dialog = true); overlay().findViewById<View>(android.R.id.button2).performClick() }
        }
        ActivityScenario.launch<FileTaskActivity>(Intent(context, FileTaskActivity::class.java).putExtra("addAction", "FILE")).use { scenario ->
            instrumentation.waitForIdleSync(); scenario.onActivity { click(it, "高级设置") }; instrumentation.waitForIdleSync()
            scenario.onActivity { save(it, "import-advanced", "import-local-task") }
        }
        ActivityScenario.launch<SourcesActivity>(Intent(context, SourcesActivity::class.java)).use { scenario ->
            instrumentation.waitForIdleSync(); scenario.onActivity { click(it, "来源限制与同步说明") }; instrumentation.waitForIdleSync()
            scenario.onActivity { save(it, "source-restrictions-dialog", "sources", dialog = true); overlay().findViewById<View>(android.R.id.button1).performClick() }
        }
        ActivityScenario.launch<ActivityStatsActivity>(Intent(context, ActivityStatsActivity::class.java)).use { scenario ->
            val deadline = System.currentTimeMillis() + 10_000
            var ready = false
            while (!ready && System.currentTimeMillis() < deadline) { scenario.onActivity { ready = GeneratedWindowRendering.hasNoPendingLabels(it.window.decorView) }; if (!ready) Thread.sleep(30) }
            assertTrue(ready)
            scenario.onActivity { activity -> listOf("记录明细抽样 · 展开 / 收起", "资料在哪里 · 展开 / 收起", "生效设置 · 展开 / 收起").forEach { click(activity, it) } }
            instrumentation.waitForIdleSync(); scenario.onActivity { save(it, "statistics-expanded", "rollout-activity-statistics") }
        }
    }
}
