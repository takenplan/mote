package dev.mote.collector

import android.os.Build
import android.os.SystemClock
import android.view.View
import android.view.ViewGroup
import android.widget.CheckBox
import android.widget.Button
import android.widget.EditText
import android.widget.Spinner
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

/** Setup-only generated emulator journeys; these tests never start a capture service. */
@RunWith(AndroidJUnit4::class)
class AppCaptureSetupInstrumentedTest {
    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val context get() = instrumentation.targetContext
    private fun views(root: View): List<View> = buildList {
        add(root); if (root is ViewGroup) repeat(root.childCount) { addAll(views(root.getChildAt(it))) }
    }
    private fun dialogViews() = android.view.inspector.WindowInspector.getGlobalWindowViews().flatMap(::views)
    private fun button(label: String) = dialogViews().filterIsInstance<TextView>().single { it.isShown && it.isClickable && it.text.toString() == label }
    private fun menu(activity: MainActivity, label: String) = views(activity.window.decorView).single { it.isShown && it.tag == "menu:$label" }.performClick()
    private fun waitFor(condition: () -> Boolean) {
        val deadline = SystemClock.elapsedRealtime() + 10000
        while (!condition()) { check(SystemClock.elapsedRealtime() < deadline) { "Setup did not finish" }; Thread.sleep(30) }
    }
    private fun fixture(block: (Settings) -> Unit) {
        require(context.packageName == "dev.mote.collector.dev" && Build.FINGERPRINT.contains("emu64a"))
        val settings = Settings(context); require(!settings.enabled && CaptureAccessibilityService.instance == null && !ProjectionService.running)
        val original = settings.read(); val prefs = context.getSharedPreferences("mote", 0)
        val previewSeen = prefs.all["capturePreviewSeen"] as? Boolean
        val language = MoteI18n.preference()
        try {
            MoteI18n.select(context, "zh-CN")
            prefs.edit().putBoolean("capturePreviewSeen", false).commit()
            settings.save(original.copy(server = "", token = "", screenCollectionEnabled = true, mode = "accessibility", uiPageMode = "ui_preferred",
                localContentOcr = false, appCollectionRules = AppCollectionRules.DEFAULT, uiPageRules = "[]"))
            block(settings)
        } finally {
            assertFalse("Setup must not silently start capture", settings.enabled)
            settings.save(original)
            if (previewSeen == null) prefs.edit().remove("capturePreviewSeen").commit() else prefs.edit().putBoolean("capturePreviewSeen", previewSeen).commit()
            MoteI18n.select(context, language)
        }
    }
    @Test fun firstStartShowsGeneratedScopePreviewAndCancelPreservesPausedState() = fixture { settings ->
        ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
            scenario.onActivity { activity ->
                activity.openGeneratedAdd(MoteAddAction.SCREEN)
                button("保存范围并开始记录").performClick()
            }
            waitFor {
                var shown=false
                instrumentation.runOnMainSync {shown=dialogViews().filterIsInstance<TextView>().any {it.isShown&&it.text.contains("这里是生成的格式示例")}}
                shown
            }
            instrumentation.runOnMainSync {
                assertTrue(dialogViews().filterIsInstance<TextView>().any { it.isShown && it.text.contains("这里是生成的格式示例") })
                assertTrue(dialogViews().filterIsInstance<TextView>().any { it.isShown && it.text.contains("未单独设置的应用：应用时长") })
                assertFalse(settings.enabled); assertFalse(settings.capturePreviewSeen())
                button("暂不开始").performClick()
            }
            scenario.recreate(); scenario.awaitMainUi()
            scenario.onActivity { assertTrue(views(it.window.decorView).single { row -> row.tag == "primary:LIBRARY" }.isSelected); assertFalse(settings.enabled) }
        }
    }
    @Test fun independentChoicesAndLocalOcrRemainDraftsAcrossRecreationUntilSaved() = fixture { settings ->
        settings.save(settings.read().copy(uiPageMode="screen_only",appCollectionRules=AppCollectionRules(AppCollectionMode.ACTIVITY,mapOf(context.packageName to AppCollectionMode.ACTIVITY)).json()))
        ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
            scenario.onActivity { activity ->
                activity.openGeneratedAdd(MoteAddAction.SCREEN)
                assertFalse(views(activity.window.decorView).filterIsInstance<Spinner>().any {it.isShown&&it.tag=="uiPageMode"})
                views(activity.window.decorView).filterIsInstance<Button>().single {it.isShown&&it.contentDescription?.toString()?.contains(context.packageName)==true}.performClick()
            }
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync {button("修改此应用的记录范围").performClick()}
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync {
                val choices=dialogViews().filterIsInstance<CheckBox>().filter {it.isShown}
                assertTrue(choices.single {it.text.toString()=="应用时长"}.isChecked)
                choices.single {it.text.toString()=="应用时长"}.performClick()
                choices.single {it.text.toString()=="截图"}.performClick()
                choices.single {it.text.toString()=="结构化内容"}.performClick()
                button("加入配置草稿").performClick()
            }
            assertEquals(AppCollectionMode.ACTIVITY,settings.read().collectionRules.apps[context.packageName])
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync {button("完成").performClick()}
            scenario.onActivity {activity ->views(activity.window.decorView).filterIsInstance<CheckBox>().single {it.text.toString()=="使用本机 OCR 补充结构化内容"}.performClick()}
            assertFalse(settings.read().localContentOcr);assertFalse(settings.enabled)
            scenario.recreate();scenario.awaitMainUi()
            scenario.onActivity {activity ->
                assertTrue(views(activity.window.decorView).filterIsInstance<CheckBox>().single {it.text.toString()=="使用本机 OCR 补充结构化内容"}.isChecked)
                button("保存并预览").performClick()
            }
            waitFor {settings.read().localContentOcr&&settings.read().collectionRules.apps[context.packageName]==AppCollectionMode.SCREENSHOT_STRUCTURED}
            waitFor {var shown=false;instrumentation.runOnMainSync {shown=dialogViews().filterIsInstance<TextView>().any {it.isShown&&it.text.contains("这里是生成的格式示例")}};shown}
            instrumentation.runOnMainSync {button("关闭预览").performClick()}
            assertEquals("screen_only",settings.read().uiPageMode)
            assertFalse(settings.enabled);assertFalse(settings.capturePreviewSeen())
        }
    }
    @Test fun configuredAppDetailShowsExactVersionAndFieldsWithoutClaimingLiveValidation() = fixture { settings ->
        @Suppress("DEPRECATION") val version = context.packageManager.getPackageInfo(context.packageName, 0).versionName!!
        val rule = AppPageSetup.fieldRule(context.packageName, version, "article", mapOf("title" to "generated:id/title", "author" to "generated:id/author", "body" to "generated:id/body"))
        settings.save(settings.read().copy(uiPageRules = rule, appCollectionRules = AppCollectionRules(AppCollectionMode.ACTIVITY, mapOf(context.packageName to AppCollectionMode.CONTENT)).json()))
        ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
            scenario.onActivity { activity ->
                activity.openGeneratedAdd(MoteAddAction.SCREEN)
                views(activity.window.decorView).filterIsInstance<Button>().single { it.isShown && it.contentDescription?.toString()?.contains(context.packageName) == true }.performClick()
            }
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync {
                assertTrue(dialogViews().filterIsInstance<TextView>().any { it.isShown && it.text.contains("安装版本：$version") })
                assertTrue(dialogViews().filterIsInstance<TextView>().any { it.isShown && it.text.contains("已配置 文章") && it.text.contains("正文") })
                assertTrue(dialogViews().filterIsInstance<TextView>().any { it.isShown && it.text.contains("不代表已经通过真机验证") })
                assertTrue(dialogViews().filterIsInstance<TextView>().any { it.isShown && it.text.toString() == "结构化字段规则按应用和版本匹配，仅在该应用已选择结构化内容时运行。" })
                button("预览此应用的记录格式").performClick()
            }
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync {
                assertTrue(dialogViews().filterIsInstance<TextView>().any { it.isShown && it.text.contains("结构化格式示例") && it.text.contains("实际可见字段") })
                button("关闭预览").performClick(); button("完成").performClick()
            }
            assertFalse(settings.enabled)
        }
    }
    @Test fun configuringFieldsCreatesSavableDraftWithoutGrantingAppContentAccess() = fixture { settings ->
        settings.save(settings.read().copy(uiPageMode = "screen_only", appCollectionRules = AppCollectionRules(AppCollectionMode.ACTIVITY, mapOf(context.packageName to AppCollectionMode.ACTIVITY)).json()))
        ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
            scenario.onActivity { activity ->
                activity.openGeneratedAdd(MoteAddAction.SCREEN)
                views(activity.window.decorView).filterIsInstance<Button>().single { it.isShown && it.contentDescription?.toString()?.contains(context.packageName) == true }.performClick()
            }
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync { button("配置当前版本的文章或商品字段").performClick() }
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync {
                val fields = dialogViews().filterIsInstance<EditText>().filter { it.isShown }
                fields.single { it.hint.toString() == "${context.packageName}:id/title" }.setText("generated:id/title")
                fields.single { it.hint.toString() == "${context.packageName}:id/body" }.setText("generated:id/body")
                button("加入配置草稿").performClick()
            }
            assertEquals("[]", settings.read().uiPageRules)
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync { button("完成").performClick() }
            scenario.onActivity { activity ->
                assertFalse(views(activity.window.decorView).filterIsInstance<Spinner>().any {it.isShown&&it.tag=="uiPageMode"})
                button("保存并预览").performClick()
            }
            waitFor { settings.read().uiPageRules != "[]" }
            waitFor {
                var shown = false
                instrumentation.runOnMainSync { shown = dialogViews().filterIsInstance<TextView>().any { it.isShown && it.text.contains("这里是生成的格式示例") } }
                shown
            }
            instrumentation.runOnMainSync { button("关闭预览").performClick() }
            @Suppress("DEPRECATION") val version = context.packageManager.getPackageInfo(context.packageName, 0).versionName!!
            assertEquals(1, AppPageSetup.adapters(settings.read().uiPageRules, context.packageName, version).size)
            assertEquals("screen_only", settings.read().uiPageMode)
            assertEquals(AppCollectionMode.ACTIVITY, settings.read().collectionRules.apps[context.packageName])
            assertFalse(settings.enabled); assertFalse(settings.capturePreviewSeen())
        }
    }
    @Test fun permissionPageReturnsToDeviceAndOriginalConfiguration() = fixture {
        ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
            scenario.onActivity { activity ->
                activity.openGeneratedAdd(MoteAddAction.SCREEN); menu(activity, "权限与后台运行")
            }
            scenario.recreate(); scenario.awaitMainUi()
            scenario.onActivity { activity ->
                button("返回原配置页面").performClick()
                assertTrue(views(activity.window.decorView).filterIsInstance<TextView>().any { it.isShown && it.text.toString() == "记录屏幕" })
                menu(activity, "权限与后台运行"); button("返回首页继续记录").performClick()
                assertTrue(views(activity.window.decorView).filterIsInstance<TextView>().any { it.isShown && it.text.toString() == "记录屏幕" })
                assertTrue(views(activity.window.decorView).single { row -> row.tag == "primary:LIBRARY" }.isSelected)
            }
        }
    }
}
