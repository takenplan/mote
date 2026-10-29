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
    private fun button(label: String) = dialogViews().filterIsInstance<TextView>().singleOrNull { it.isShown && it.isClickable && it.text.toString() == label } ?: error("Missing action $label: " + dialogViews().filterIsInstance<TextView>().filter { it.isShown }.joinToString(" | ") { it.text.toString() })
    private fun menu(activity: MainActivity, label: String) { if (label == "权限与后台运行") button("系统权限").performClick() else views(activity.window.decorView).single { it.isShown && it.tag == "menu:$label" }.performClick() }
    private fun waitFor(condition: () -> Boolean) {
        val deadline = SystemClock.elapsedRealtime() + 10000
        while (!condition()) { check(SystemClock.elapsedRealtime() < deadline) { "Setup did not finish" }; Thread.sleep(30) }
    }
    private fun capture(activity: MainActivity, filename: String, focusTag: String? = null) {
        val root = activity.window.decorView
        focusTag?.let { root.findViewWithTag<View>(it)?.let { view ->
            view.requestRectangleOnScreen(android.graphics.Rect(0, 0, view.width, view.height), true)
        } }
        val image = android.graphics.Bitmap.createBitmap(root.width, root.height, android.graphics.Bitmap.Config.ARGB_8888)
        try {
            val canvas=android.graphics.Canvas(image)
            android.view.inspector.WindowInspector.getGlobalWindowViews().filter { it.isShown && it.width>0 && it.height>0 }.forEach { window ->
                val position=IntArray(2);window.getLocationOnScreen(position);canvas.save();canvas.translate(position[0].toFloat(),position[1].toFloat());window.draw(canvas);canvas.restore()
            }
            java.io.File(context.filesDir,"capture-final").apply { mkdirs() }.resolve(filename).outputStream().use { image.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, it) }
        } finally { image.recycle() }
    }
    private fun openApp(scenario: ActivityScenario<MainActivity>, id: String = context.packageName) {
        scenario.onActivity { activity ->
            views(activity.window.decorView).filterIsInstance<EditText>().single { it.hint?.toString() == "搜索应用" }.setText(id)
        }
        waitFor {
            var selected = false
            scenario.onActivity { activity ->
                views(activity.window.decorView).firstOrNull { it.isShown && it.tag == "app-capture:$id" }?.let {
                    capture(activity, "app-capture-list.png"); it.performClick(); selected = true
                }
            }
            selected
        }
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
                scenario.onActivity { capture(it,"capture-preview-before-cancel.png") }
                button("暂不开始").performClick()
            }
            scenario.recreate(); scenario.awaitMainUi()
            scenario.onActivity { activity ->
                assertTrue(views(activity.window.decorView).filterIsInstance<TextView>().any { row -> row.tag == "local-page-title" && row.text.toString() == "采集范围" })
                assertTrue(views(activity.window.decorView).filterIsInstance<TextView>().any {it.isShown&&it.text.toString()=="采集范围"})
                assertFalse(settings.enabled);assertFalse(settings.capturePreviewSeen())
                capture(activity,"capture-preview-cancelled.png")
            }
        }
    }
    @Test fun independentChoicesAndLocalOcrRemainDraftsAcrossRecreationUntilSaved() = fixture { settings ->
        settings.save(settings.read().copy(uiPageMode="screen_only",appCollectionRules=AppCollectionRules(AppCollectionMode.ACTIVITY,mapOf(context.packageName to AppCollectionMode.ACTIVITY)).json()))
        ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
            scenario.onActivity { activity ->
                activity.openGeneratedAdd(MoteAddAction.SCREEN)
                assertFalse(views(activity.window.decorView).filterIsInstance<Spinner>().any {it.isShown&&it.tag=="uiPageMode"})
            }
            openApp(scenario)
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync {
                val choices=dialogViews().filterIsInstance<CheckBox>().filter {it.isShown}
                assertTrue(choices.single {it.text.toString()=="应用时长"}.isChecked)
                choices.single {it.text.toString()=="应用时长"}.performClick()
                choices.single {it.text.toString()=="截图"}.performClick()
                choices.single {it.text.toString()=="结构化内容"}.performClick()
                scenario.onActivity { capture(it,"app-unsupported-detail.png") }
            }
            assertEquals(AppCollectionMode.ACTIVITY,settings.read().collectionRules.apps[context.packageName])
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync {button("返回应用列表").performClick()}
            scenario.onActivity {activity -> button("资料说明与其他设置").performClick(); views(activity.window.decorView).filterIsInstance<CheckBox>().single {it.text.toString()=="本机 OCR 补充"}.performClick()}
            assertFalse(settings.read().localContentOcr);assertFalse(settings.enabled)
            scenario.recreate();scenario.awaitMainUi()
            scenario.onActivity {activity ->
                assertTrue(views(activity.window.decorView).filterIsInstance<CheckBox>().single {it.text.toString()=="本机 OCR 补充"}.isChecked)
                button("资料说明与其他设置").performClick(); button("高级采集设置").performClick(); button("保存并预览").performClick()
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
            }
            openApp(scenario)
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync {
                assertTrue(dialogViews().filterIsInstance<TextView>().any { it.isShown && it.text.contains("安装版本：$version") })
                assertTrue(dialogViews().filterIsInstance<TextView>().any { it.isShown && it.text.contains("已配置 文章") && it.text.contains("正文") })
                assertFalse(dialogViews().filterIsInstance<TextView>().any { it.isShown && it.text.toString() == "配置当前版本的文章或商品字段" })
                assertTrue(dialogViews().filterIsInstance<TextView>().any { it.isShown && it.text.toString() == "当前版本有规则" })
                assertTrue(dialogViews().filterIsInstance<TextView>().any { it.isShown && it.text.contains("实际页面仍需匹配") })
                assertFalse(dialogViews().filterIsInstance<TextView>().any { it.isShown && it.text.toString()=="保存范围并开始记录" })
                scenario.onActivity { capture(it,"app-supported-detail.png") }
                button("预览此应用的记录格式").performClick()
            }
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync {
                assertTrue(dialogViews().filterIsInstance<TextView>().any { it.isShown && it.text.contains("结构化格式示例") && it.text.contains("实际可见字段") })
                scenario.onActivity { capture(it,"app-supported-preview.png") }
                button("关闭预览").performClick(); button("返回应用列表").performClick()
            }
            assertFalse(settings.enabled)
        }
    }
    @Test fun advancedFieldSettingsKeepTheirDraftAndExpansionAcrossRecreationWithoutGrantingContentAccess() = fixture { settings ->
        settings.save(settings.read().copy(uiPageMode = "screen_only", appCollectionRules = AppCollectionRules(AppCollectionMode.ACTIVITY, mapOf(context.packageName to AppCollectionMode.ACTIVITY)).json()))
        ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
            scenario.onActivity { activity ->
                activity.openGeneratedAdd(MoteAddAction.SCREEN)
            }
            openApp(scenario)
            instrumentation.waitForIdleSync()
            scenario.onActivity { activity ->
                val current = views(activity.window.decorView)
                assertFalse(current.single { it.tag == "app-rule-settings" }.isShown)
                assertFalse(current.filterIsInstance<TextView>().any { it.isShown && it.text.toString() == "配置当前版本的文章或商品字段" })
                assertTrue(current.filterIsInstance<CheckBox>().single { it.tag == "app-channel:${context.packageName}:0" }.isShown)
                current.single { it.tag == "app-rule-settings-toggle" }.performClick()
            }
            scenario.recreate(); scenario.awaitMainUi()
            scenario.onActivity { activity ->
                val current = views(activity.window.decorView)
                assertTrue(current.single { it.tag == "app-rule-settings" }.isShown)
                assertTrue(current.single { it.tag == "app-rule-settings-toggle" }.isSelected)
                capture(activity, "app-capture-advanced.png", "app-rule-settings")
                button("载入当前版本内置字段规则").performClick()
                button("导入当前版本的字段规则").performClick()
            }
            waitFor { instrumentation.uiAutomation.rootInActiveWindow?.packageName?.toString()?.endsWith(".documentsui") == true }
            instrumentation.uiAutomation.executeShellCommand("input keyevent 4").close()
            waitFor { instrumentation.uiAutomation.rootInActiveWindow?.packageName?.toString() == context.packageName }
            assertEquals("[]", settings.read().uiPageRules)
            scenario.onActivity { activity ->
                assertTrue(views(activity.window.decorView).single { it.tag == "app-rule-settings" }.isShown)
                button("配置当前版本的文章或商品字段").performClick()
            }
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync {
                val fields = dialogViews().filterIsInstance<EditText>().filter { it.isShown }
                fields.single { it.hint.toString() == "${context.packageName}:id/title" }.setText("generated:id/title")
                fields.single { it.hint.toString() == "${context.packageName}:id/body" }.setText("generated:id/body")
                button("加入配置草稿").performClick()
            }
            assertEquals("[]", settings.read().uiPageRules)
            instrumentation.waitForIdleSync()
            scenario.onActivity { activity ->
                assertTrue(views(activity.window.decorView).single { it.tag == "app-rule-settings" }.isShown)
                assertTrue(views(activity.window.decorView).filterIsInstance<TextView>().any { it.isShown && it.text.contains("已配置 文章") })
                views(activity.window.decorView).single { it.tag == "app-rule-settings-toggle" }.performClick()
                assertFalse(views(activity.window.decorView).filterIsInstance<TextView>().any { it.isShown && it.text.toString() == "配置当前版本的文章或商品字段" })
            }
            scenario.recreate(); scenario.awaitMainUi()
            scenario.onActivity { activity ->
                assertFalse(views(activity.window.decorView).single { it.tag == "app-rule-settings" }.isShown)
                assertTrue(views(activity.window.decorView).filterIsInstance<TextView>().any { it.isShown && it.text.contains("已配置 文章") })
                capture(activity, "app-capture-daily.png", "app-rule-settings-toggle")
                button("返回应用列表").performClick()
            }
            scenario.onActivity { activity ->
                assertFalse(views(activity.window.decorView).filterIsInstance<Spinner>().any {it.isShown&&it.tag=="uiPageMode"})
                button("资料说明与其他设置").performClick(); button("高级采集设置").performClick(); button("保存并预览").performClick()
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
    @Test fun defaultChannelsAreIndependentAndPersistOnlyAfterSaving() = fixture { settings ->
        ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
            scenario.onActivity { activity ->
                activity.openGeneratedAdd(MoteAddAction.SCREEN)
                views(activity.window.decorView).single { it.tag == "app-default-summary" }.performClick()
                val defaults = views(activity.window.decorView).filterIsInstance<CheckBox>()
                defaults.single { it.text.toString() == "默认：应用时长" }.performClick()
                defaults.single { it.text.toString() == "默认：截图" }.performClick()
                defaults.single { it.text.toString() == "默认：结构化内容" }.performClick()
                assertFalse(views(activity.window.decorView).filterIsInstance<Spinner>().any { it.isShown && it.tag == "appDefault" })
            }
            assertEquals(AppCollectionMode.ACTIVITY, settings.read().collectionRules.defaultMode)
            scenario.recreate(); scenario.awaitMainUi()
            scenario.onActivity { activity ->
                val defaults = views(activity.window.decorView).filterIsInstance<CheckBox>()
                assertFalse(defaults.single { it.text.toString() == "默认：应用时长" }.isChecked)
                assertTrue(defaults.single { it.text.toString() == "默认：截图" }.isChecked)
                assertTrue(defaults.single { it.text.toString() == "默认：结构化内容" }.isChecked)
                button("保存设置").performClick()
            }
            waitFor { settings.read().collectionRules.defaultMode == AppCollectionMode.SCREENSHOT_STRUCTURED }
            assertFalse(settings.enabled)
        }
    }
    @Test fun ruleScopeShowsVersionMismatchAndInheritanceRemovesOnlyTheAppOverride() = fixture { settings ->
        @Suppress("DEPRECATION") val version = context.packageManager.getPackageInfo(context.packageName, 0).versionName!!
        val wrongVersion = "$version.other"
        val rule = AppPageSetup.fieldRule(context.packageName, wrongVersion, "article", mapOf("title" to "generated:id/title", "body" to "generated:id/body"))
        settings.save(settings.read().copy(uiPageRules = rule, appCollectionRules = AppCollectionRules(AppCollectionMode.ACTIVITY,
            mapOf(context.packageName to AppCollectionMode.DURATION_STRUCTURED)).json()))
        ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
            scenario.onActivity { activity -> activity.openGeneratedAdd(MoteAddAction.SCREEN) }
            openApp(scenario)
            scenario.onActivity { activity ->
                assertTrue(views(activity.window.decorView).filterIsInstance<TextView>().any { it.isShown && it.text.contains("规则版本不符") })
                views(activity.window.decorView).single { it.tag == "app-rule-settings-toggle" }.performClick()
                assertTrue(views(activity.window.decorView).filterIsInstance<TextView>().any { it.isShown && it.text.contains("适用应用版本：$wrongVersion") })
                val root = activity.window.decorView
                capture(activity, "app-capture-detail.png")
                views(root).filterIsInstance<CheckBox>().single { it.tag == "app-inherit:${context.packageName}" }.performClick()
            }
            assertEquals(AppCollectionMode.DURATION_STRUCTURED, settings.read().collectionRules.apps[context.packageName])
            scenario.recreate(); scenario.awaitMainUi()
            scenario.onActivity { activity ->
                val current = views(activity.window.decorView)
                assertTrue(current.filterIsInstance<CheckBox>().single { it.tag == "app-inherit:${context.packageName}" }.isChecked)
                assertFalse(current.filterIsInstance<CheckBox>().single { it.tag == "app-channel:${context.packageName}:2" }.isChecked)
                button("返回应用列表").performClick()
                button("资料说明与其他设置").performClick(); views(activity.window.decorView).single { it.tag == "app-scope:RULES" }.performClick()
                button("保存设置").performClick()
            }
            waitFor { context.packageName !in settings.read().collectionRules.apps }
            assertEquals(rule, settings.read().uiPageRules)
            assertFalse(settings.enabled)
        }
    }
    @Test fun discardedCaptureModeDoesNotChangeAppCapabilityLabels() = fixture { settings ->
        @Suppress("DEPRECATION") val version = context.packageManager.getPackageInfo(context.packageName, 0).versionName!!
        val rule = AppPageSetup.fieldRule(context.packageName, version, "article", mapOf("title" to "generated:id/title", "body" to "generated:id/body"))
        settings.save(settings.read().copy(uiPageRules = rule, appCollectionRules = AppCollectionRules(AppCollectionMode.ACTIVITY,
            mapOf(context.packageName to AppCollectionMode.STRUCTURED)).json()))
        val intent = android.content.Intent(context, MainActivity::class.java).putExtra("page", "SETTINGS")
        ActivityScenario.launch<MainActivity>(intent).awaitMainUi().use { scenario ->
            scenario.onActivity { activity ->
                menu(activity,"偏好与本机维护"); button("高级与维护").performClick(); menu(activity,"采集与存储")
                views(activity.window.decorView).filterIsInstance<CheckBox>().single { it.text.toString() == "使用投屏模式（只截图，每次需授权）" }.performClick()
                activity.openMoteLocalPage("PRIVACY")
            }
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync { button("丢弃修改").performClick() }
            openApp(scenario)
            scenario.onActivity { activity ->
                val labels = views(activity.window.decorView).filterIsInstance<TextView>().filter { it.isShown }.map { it.text.toString() }
                assertTrue(labels.any { it == "结构化 · 当前版本有规则" })
                assertFalse(labels.any { it == "结构化 · 投屏模式不可用" })
                assertFalse(labels.any { it == "投屏模式不支持结构化内容" })
            }
            assertEquals("accessibility", settings.read().mode)
            assertFalse(settings.enabled)
        }
    }
    @Test fun permissionPageReturnsToDeviceAndOriginalConfiguration() = fixture {
        ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
            scenario.onActivity { activity ->
                activity.openGeneratedAdd(MoteAddAction.SCREEN); menu(activity, "权限与后台运行")
            }
            scenario.recreate(); scenario.awaitMainUi()
            scenario.onActivity { activity ->
                button("返回采集范围").performClick()
                assertTrue(views(activity.window.decorView).filterIsInstance<TextView>().any { it.isShown && it.text.toString() == "采集范围" })
                menu(activity, "权限与后台运行"); button("返回采集范围").performClick(); activity.openGeneratedHome()
                assertTrue(views(activity.window.decorView).any { it.isShown && it.tag == "home-record-action" })
                assertFalse(views(activity.window.decorView).any { row -> row.isShown && row.tag?.toString()?.startsWith("primary:") == true })
                assertFalse(Settings(context).enabled)
            }
        }
    }
    @Test fun deniedAccessibilityAfterExplicitPreviewKeepsCaptureStoppedOnReturn() = fixture { settings ->
        val automation=instrumentation.getUiAutomation(android.app.UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES)
        automation.grantRuntimePermission(context.packageName,android.Manifest.permission.POST_NOTIFICATIONS)
        require(!CaptureAccessibilityService.connected)
        val services=android.provider.Settings.Secure.getString(context.contentResolver,android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
        require(services.isNullOrBlank()) { "Only the disposable emulator with no enabled accessibility services is allowed" }
        val wasEnabled=android.provider.Settings.Secure.getInt(context.contentResolver,android.provider.Settings.Secure.ACCESSIBILITY_ENABLED,0)
        fun shell(command:String){automation.executeShellCommand(command).use { descriptor -> java.io.FileInputStream(descriptor.fileDescriptor).use { it.readBytes() } }}
        ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
            scenario.onActivity { a -> a.openGeneratedAdd(MoteAddAction.SCREEN);button("保存范围并开始记录").performClick() }
            waitFor { var shown=false;instrumentation.runOnMainSync { shown=dialogViews().filterIsInstance<TextView>().any { it.isShown && it.text.toString()=="按此范围开始" } };shown }
            instrumentation.runOnMainSync { button("按此范围开始").performClick() }
            waitFor { var shown=false;scenario.onActivity { a -> shown=views(a.window.decorView).filterIsInstance<TextView>().any { it.isShown && it.text.toString()=="返回采集范围" } };shown }
            scenario.onActivity { a -> assertFalse(settings.enabled);capture(a,"capture-permission-denied.png");button("返回采集范围").performClick() }
            scenario.recreate();scenario.awaitMainUi()
            scenario.onActivity { a -> assertFalse(settings.enabled);assertFalse(ProjectionService.running);capture(a,"capture-permission-return-still-stopped.png") }
            try {
                // A controlled grant on this generated emulator exercises a real service
                // connection. It is not evidence of an OEM Settings permission journey.
                shell("settings put secure enabled_accessibility_services ${context.packageName}/dev.mote.collector.CaptureAccessibilityService")
                shell("settings put secure accessibility_enabled 1")
                waitFor { CaptureAccessibilityService.connected }
                scenario.recreate();scenario.awaitMainUi()
                scenario.onActivity { a -> assertFalse(settings.enabled);assertFalse(ProjectionService.running);assertEquals(0,context.queue().inventory().records);capture(a,"capture-permission-restored-still-stopped.png") }
            } finally {
                shell("settings delete secure enabled_accessibility_services");shell("settings put secure accessibility_enabled $wasEnabled")
                waitFor { CaptureAccessibilityService.instance==null }
            }
        }
    }
}
