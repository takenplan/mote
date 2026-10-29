package dev.mote.collector

import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.os.SystemClock
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.EditText
import android.widget.TextView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/** Navigation-only fixtures. These tests never enable capture or call a model. */
@RunWith(AndroidJUnit4::class)
class NavigationInstrumentedTest {
    private var previousLanguage = "system"
    @org.junit.Before fun fixtureLanguage() {
        previousLanguage = MoteI18n.preference()
        MoteI18n.select(InstrumentationRegistry.getInstrumentation().targetContext, "zh-CN")
    }
    @org.junit.After fun restoreLanguage() {
        MoteI18n.select(InstrumentationRegistry.getInstrumentation().targetContext, previousLanguage)
    }
    private fun views(root: View): List<View> = buildList {
        add(root)
        if (root is ViewGroup) for (index in 0 until root.childCount) addAll(views(root.getChildAt(index)))
    }
    private fun editor(activity: MainActivity, hint: String) = views(activity.window.decorView)
        .filterIsInstance<EditText>().single { it.hint?.toString() == hint }
    private fun tab(activity: MainActivity, label: String) {
        fun discard() = android.view.inspector.WindowInspector.getGlobalWindowViews().flatMap { views(it) }
            .filterIsInstance<TextView>().firstOrNull { it.isShown && it.text.toString() == "丢弃修改" }?.performClick()
        if (label !in listOf("设置", "首页", "概览", "问一问", "内容", "来源", "活动", "记录屏幕")) {
            views(activity.window.decorView).filterIsInstance<TextView>().single { it.isShown && it.isClickable && it.text.toString() == label }.performClick()
            return
        }
        repeat(8) {
            if (views(activity.window.decorView).any { it.isShown && it.tag == "home-record-action" }) return@repeat
            activity.onBackPressed(); discard()
        }
        when (label) {
            "首页", "概览" -> Unit
            "问一问" -> views(activity.window.decorView).single { it.isShown && it.tag == "home-ask-action" }.performClick()
            "记录屏幕" -> activity.openGeneratedAdd(MoteAddAction.SCREEN)
            else -> {
                activity.openGeneratedMenu()
                val key = when(label) { "内容" -> "资料与记忆"; "来源" -> "采集与同步"; "活动" -> "采集与同步"; else -> label }
                views(activity.window.decorView).single { it.isShown && it.tag == "menu:$key" }.performClick()
                if (label == "活动") views(activity.window.decorView).filterIsInstance<TextView>().single { it.isShown && it.isClickable && it.text.toString() == "活动" }.performClick()
            }
        }
    }
    private fun menu(activity: MainActivity, label: String) {
        if (label in listOf("按应用配置", "记录屏幕")) { tab(activity, "记录屏幕"); return }
        var found = views(activity.window.decorView).firstOrNull { it.isShown && it.tag == "menu:$label" }
        if (found == null) {
            views(activity.window.decorView).filterIsInstance<TextView>().firstOrNull { it.isShown && it.text.toString() == "高级与维护" }?.performClick()
            found = views(activity.window.decorView).firstOrNull { it.isShown && it.tag == "menu:$label" }
        }
        requireNotNull(found) { "Menu unavailable: $label" }.performClick()
    }

    @Test fun tappingOutsideTheNoteDismissesEditorFocus() {
        ActivityScenario.launch(RecordEditorActivity::class.java).use { scenario ->
            val deadline=SystemClock.elapsedRealtime()+10000; var enabled=false
            while(!enabled && SystemClock.elapsedRealtime()<deadline){scenario.onActivity { enabled=views(it.window.decorView).filterIsInstance<EditText>().single { row -> row.contentDescription == "正在想什么" }.isEnabled };if(!enabled)Thread.sleep(25)}
            scenario.onActivity { activity ->
                val field = views(activity.window.decorView).filterIsInstance<EditText>().single { it.contentDescription == "正在想什么" }
                field.requestFocus(); assertTrue(field.hasFocus())
                val down = SystemClock.uptimeMillis()
                val event = MotionEvent.obtain(down, down, MotionEvent.ACTION_DOWN, 1f, 1f, 0)
                try { activity.dispatchTouchEvent(event) } finally { event.recycle() }
                assertFalse(field.hasFocus())
            }
        }
    }

    @Test fun permissionsAndLocalLogsOpenWithoutStartingCapture() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        assertFalse(Settings(context).enabled)
        ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
            scenario.onActivity { activity ->
                tab(activity, "设置"); menu(activity, "权限与后台运行")
                assertTrue(views(activity.window.decorView).filterIsInstance<TextView>().any {
                    it.isShown && it.text.contains("通知使用权")
                })
                assertFalse(Settings(activity).enabled)
            }
        }
        ActivityScenario.launch(LogViewerActivity::class.java).use { scenario ->
            val deadline = SystemClock.elapsedRealtime() + 10_000
            var loaded = false
            while (!loaded && SystemClock.elapsedRealtime() < deadline) {
                instrumentation.waitForIdleSync()
                scenario.onActivity { activity ->
                    assertTrue(activity.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE != 0)
                    loaded = views(activity.window.decorView).filterIsInstance<TextView>().any { it.text.contains("原始日志 ·") || it.text.toString() == "暂无日志。" }
                }
                if (!loaded) Thread.sleep(50)
            }
            assertTrue("Local event log must finish loading", loaded)
        }
        assertFalse(Settings(context).enabled)
    }

    private fun navigate(scenario: ActivityScenario<MainActivity>, label: String) {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        repeat(8) {
            var home = false
            scenario.onActivity { activity ->
                home = views(activity.window.decorView).any { it.isShown && it.tag == "home-record-action" }
                if (!home) activity.onBackPressed()
            }
            if (!home) {
                instrumentation.waitForIdleSync()
                instrumentation.runOnMainSync {
                    android.view.inspector.WindowInspector.getGlobalWindowViews().flatMap { views(it) }
                        .filterIsInstance<TextView>().firstOrNull { it.isShown && it.text.toString() == "丢弃修改" }?.performClick()
                }
                instrumentation.waitForIdleSync()
            }
        }
        scenario.onActivity { tab(it,label) }
        instrumentation.waitForIdleSync()
    }
    @Test fun leavingSettingsPagesDiscardsInputsAndHidesSaveBar() {
        val saved=Settings(InstrumentationRegistry.getInstrumentation().targetContext).read()
        ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
            scenario.onActivity { activity ->
                assertTrue(activity.window.attributes.flags and WindowManager.LayoutParams.FLAG_SECURE != 0)
                assertFalse("Advanced forms are lazy",views(activity.window.decorView).any { it is EditText })
            }
            navigate(scenario,"设置")
            scenario.onActivity { activity ->
                menu(activity,"连接与同步")
                editor(activity,"https://mote.example.com").setText("https://127.0.0.1:1")
                editor(activity,"建议通过邀请获取本设备凭据").setText("generated-navigation-fixture-token-1234567890")
            }
            navigate(scenario,"设置")
            scenario.onActivity { activity ->
                menu(activity,"采集与存储")
                assertEquals(saved,Settings(activity).read())
                editor(activity,"30").setText("47")
            }
            navigate(scenario,"首页")
            scenario.onActivity { activity ->
                assertTrue(views(activity.window.decorView).any { it.isShown && it.tag == "home-record-action" })
                assertFalse(views(activity.window.decorView).filterIsInstance<TextView>().any { it.isShown&&it.text=="保存设置" })
            }
            navigate(scenario,"设置")
            scenario.onActivity { activity ->
                menu(activity,"采集与存储")
                assertEquals(saved.intervalSeconds.toString(),editor(activity,"30").text.toString())
                assertEquals(saved,Settings(activity).read());assertFalse(Settings(activity).enabled)
            }
        }
    }

    @Test fun backUsesTheSameUnsavedSettingsConfirmation() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
            scenario.onActivity { activity ->
                tab(activity, "设置"); menu(activity, "采集与存储")
                editor(activity, "30").setText("47")
                activity.onBackPressed()
                assertTrue(editor(activity, "30").isShown)
            }
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync {
                android.view.inspector.WindowInspector.getGlobalWindowViews().flatMap { views(it) }
                    .filterIsInstance<TextView>().single { it.isShown && it.text.toString() == "继续编辑" }.performClick()
            }
            scenario.onActivity { activity -> assertEquals("47", editor(activity, "30").text.toString()) }
            navigate(scenario, "问一问")
            scenario.onActivity { activity -> assertTrue(views(activity.window.decorView).any { it.isShown && it.tag == "central-title" }) }
            navigate(scenario, "设置")
            scenario.onActivity { activity -> menu(activity, "采集与存储"); assertEquals(Settings(activity).read().intervalSeconds.toString(), editor(activity, "30").text.toString()) }
        }
    }

    @Test fun activePageDraftSurvivesRotationAndBackgroundWithoutChangingSavedConfiguration() {
        ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
            val saved = Settings(InstrumentationRegistry.getInstrumentation().targetContext).read()
            scenario.onActivity { activity ->
                tab(activity, "设置"); menu(activity, "采集与存储")
                editor(activity, "30").setText("47")
            }
            scenario.recreate(); scenario.awaitMainUi()
            scenario.onActivity { activity ->
                assertTrue(editor(activity, "30").isShown)
                assertEquals("47", editor(activity, "30").text.toString())
            }
            scenario.moveToState(androidx.lifecycle.Lifecycle.State.CREATED)
            scenario.resumeGeneratedTask()
            scenario.onActivity { activity ->
                assertEquals("47", editor(activity, "30").text.toString())
                assertTrue(views(activity.window.decorView).filterIsInstance<TextView>().any { it.isShown && it.text == "保存设置" })
                assertEquals(saved, Settings(activity).read())
            }
        }
    }

    @Test fun numericAppAndMaskPickersKeepConfigurationStructured() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        fun dialogViews() = android.view.inspector.WindowInspector.getGlobalWindowViews()
            .filter { it.hasWindowFocus() }.flatMap { views(it) }
        fun clickDialogLabel(label: String) {
            val deadline = SystemClock.elapsedRealtime() + 10_000
            var clicked = false
            // Installed-app choices arrive from a background query after the UI thread becomes idle.
            while (!clicked) {
                instrumentation.waitForIdleSync()
                instrumentation.runOnMainSync {
                    val selected = dialogViews().filterIsInstance<TextView>().firstOrNull { it !is EditText && it.isShown && it.text.toString() == label } ?: return@runOnMainSync
                    var row: View = selected
                    while (row.parent is View && row.parent !is android.widget.ListView) row = row.parent as View
                    val list = row.parent as? android.widget.ListView
                    if (list != null) {
                        val position = list.getPositionForView(row)
                        assertTrue(list.performItemClick(row, position, list.getItemIdAtPosition(position)))
                    } else assertTrue("Dialog choice must be clickable: $label", selected.performClick())
                    clicked = true
                }
                if (!clicked) { check(SystemClock.elapsedRealtime() < deadline) { "Generated dialog choice did not appear: $label" }; Thread.sleep(50) }
            }
            instrumentation.waitForIdleSync()
        }
        ActivityScenario.launch(MainActivity::class.java).awaitMainUi().use { scenario ->
            scenario.onActivity { activity -> tab(activity, "设置"); menu(activity, "采集与存储"); assertNull(editor(activity, "30").keyListener); editor(activity, "30").performClick() }
            clickDialogLabel("60")
            scenario.onActivity { activity ->
                assertEquals("60", editor(activity, "30").text.toString())
            }
            navigate(scenario,"设置")
            scenario.onActivity { activity -> menu(activity,"按应用配置") }
            val appName = instrumentation.targetContext.applicationInfo.loadLabel(instrumentation.targetContext.packageManager).toString()
            val searchDeadline = SystemClock.elapsedRealtime() + 10_000
            var searched = false
            while (!searched && SystemClock.elapsedRealtime() < searchDeadline) {
                instrumentation.runOnMainSync {
                    dialogViews().filterIsInstance<EditText>().firstOrNull { it.isShown && it.hint?.toString() == "搜索应用名称" }?.let {
                        it.setText(appName); searched = true
                    }
                }
                if (!searched) Thread.sleep(25)
            }
            assertTrue("The app configuration list must be ready before entering a search", searched)
            val appDeadline = SystemClock.elapsedRealtime() + 10_000
            var appOpened = false
            while (!appOpened && SystemClock.elapsedRealtime() < appDeadline) {
                instrumentation.runOnMainSync {
                    dialogViews().firstOrNull { it.isShown && it.tag == "app-capture:${instrumentation.targetContext.packageName}" }?.let {
                        it.performClick(); appOpened = true
                    }
                }
                if (!appOpened) Thread.sleep(25)
            }
            assertTrue("The installed app catalog must finish loading before app selection", appOpened)
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync {
                val inherit = dialogViews().filterIsInstance<android.widget.CheckBox>().single { it.isShown && it.tag == "app-inherit:${instrumentation.targetContext.packageName}" }
                if (inherit.isChecked) inherit.performClick()
            }
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync {
                val choices = dialogViews().filterIsInstance<android.widget.CheckBox>().filter { it.isShown }
                listOf("应用时长" to true, "截图" to false, "结构化内容" to false).forEach { (name, checked) ->
                    choices.single { it.text.toString() == name }.let { if (it.isChecked != checked) it.performClick() }
                }
            }
            clickDialogLabel("返回应用列表")
            scenario.onActivity { activity ->
                assertTrue(editor(activity, "com.example.chat=activity\ncom.example.private=off").text.contains("${activity.packageName}=activity"))
                tab(activity, "遮住顶部 8%"); tab(activity, "遮住底部 12%")
                assertEquals(2, Mask.parse(editor(activity, "0,0,1,0.08").text.toString()).size)
                assertFalse(editor(activity, "0,0,1,0.08").isShown)
            }
            scenario.recreate(); scenario.awaitMainUi()
            scenario.onActivity { activity -> assertEquals(2, Mask.parse(editor(activity, "0,0,1,0.08").text.toString()).size) }
        }
    }



}
